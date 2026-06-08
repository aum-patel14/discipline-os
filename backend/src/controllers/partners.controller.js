import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { sendPushNotification } from '../services/notification.service.js';
import { subDays, format } from 'date-fns';

const connectSchema = z.object({
  partner_code: z.string().length(8),
});

const verifySchema = z.object({
  partner_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export const connectPartner = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partner_code } = connectSchema.parse(req.body);

    // Find user by partner code
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('partner_code', partner_code.toUpperCase())
      .maybeSingle();

    if (findError || !targetUser) {
      return res.status(404).json({ error: 'User with this partner code not found' });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ error: 'You cannot connect with yourself' });
    }

    // Check if partnership already exists (any direction)
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('partnerships')
      .select('id, status')
      .or(`and(user_id.eq.${userId},partner_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},partner_id.eq.${userId})`)
      .maybeSingle();

    if (checkError) {
      return res.status(400).json({ error: checkError.message });
    }

    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'A partnership request is already pending.' });
      }
      return res.status(400).json({ error: 'You are already partners with this user.' });
    }

    // Create partnership (incoming request to targetUser or outgoing from us)
    const { data: newPartnership, error: insertError } = await supabaseAdmin
      .from('partnerships')
      .insert({
        user_id: userId, // from us
        partner_id: targetUser.id, // to them
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(201).json(newPartnership);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const listPartners = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch partnerships where user is user_id or partner_id
    const { data: list, error } = await supabaseAdmin
      .from('partnerships')
      .select(`
        id,
        status,
        user_id,
        partner_id
      `)
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const partners = [];

    for (const p of list) {
      const isRequester = p.user_id === userId;
      const targetUserId = isRequester ? p.partner_id : p.user_id;

      // Fetch user profile
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url')
        .eq('id', targetUserId)
        .single();

      if (profile) {
        partners.push({
          partnership_id: p.id,
          status: p.status,
          role: isRequester ? 'sender' : 'receiver',
          user: profile,
        });
      }
    }

    return res.status(200).json(partners);
  } catch (error) {
    next(error);
  }
};

export const updatePartnershipStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // partnership id
    const { status } = req.body; // 'active' or 'declined'

    if (!['active', 'declined'].includes(status)) {
      return res.status(400).json({ error: "Invalid status, must be 'active' or 'declined'" });
    }

    // Verify partnership exists and current user is the receiver (partner_id)
    const { data: partnership, error: fetchError } = await supabaseAdmin
      .from('partnerships')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !partnership || partnership.partner_id !== userId) {
      return res.status(404).json({ error: 'Partnership request not found or not authorized' });
    }

    if (status === 'active') {
      const { data: updated, error } = await supabaseAdmin
        .from('partnerships')
        .update({ status: 'active' })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(updated);
    } else {
      // Declined, delete the record
      const { error } = await supabaseAdmin
        .from('partnerships')
        .delete()
        .eq('id', id);

      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ message: 'Partnership request declined and removed.' });
    }
  } catch (error) {
    next(error);
  }
};

export const deletePartner = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // partnership id

    // Verify ownership (user is user_id or partner_id)
    const { data: partnership, error: checkError } = await supabaseAdmin
      .from('partnerships')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !partnership || (partnership.user_id !== userId && partnership.partner_id !== userId)) {
      return res.status(404).json({ error: 'Partnership not found' });
    }

    const { error } = await supabaseAdmin
      .from('partnerships')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Partnership removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const verifyPartner = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { partner_id, date, note } = verifySchema.parse(req.body);

    // Verify active partnership exists
    const { data: partnership, error: checkError } = await supabaseAdmin
      .from('partnerships')
      .select('id')
      .eq('status', 'active')
      .or(`and(user_id.eq.${userId},partner_id.eq.${partner_id}),and(user_id.eq.${partner_id},partner_id.eq.${userId})`)
      .maybeSingle();

    if (checkError || !partnership) {
      return res.status(400).json({ error: 'Active partnership not found with this user' });
    }

    // Upsert partner verification log
    const { data: verification, error: upsertError } = await supabaseAdmin
      .from('partner_verifications')
      .upsert({
        from_user_id: userId,
        to_user_id: partner_id,
        date,
        verified: true,
        note: note || '',
      }, { onConflict: 'from_user_id,to_user_id,date' })
      .select()
      .single();

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    // Trigger push notification to partner
    const { data: senderProfile } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    const { data: notifSettings } = await supabaseAdmin
      .from('notification_settings')
      .select('push_token')
      .eq('user_id', partner_id)
      .single();

    if (notifSettings?.push_token) {
      const senderName = senderProfile?.full_name || 'Your partner';
      sendPushNotification(
        notifSettings.push_token,
        `✅ ${senderName} verified your day!`,
        'Your accountability partner confirmed your progress.'
      );
    }

    return res.status(200).json(verification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const getPartnerProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.id;

    // Verify active partnership exists
    const { data: partnership } = await supabaseAdmin
      .from('partnerships')
      .select('id')
      .eq('status', 'active')
      .or(`and(user_id.eq.${userId},partner_id.eq.${partnerId}),and(user_id.eq.${partnerId},partner_id.eq.${userId})`)
      .maybeSingle();

    if (!partnership) {
      return res.status(403).json({ error: 'Access denied: Active partnership required.' });
    }

    // Fetch partner's timezone
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', partnerId)
      .single();

    const tz = profile?.timezone || 'UTC';
    const localDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    // Fetch active habits of partner
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', partnerId)
      .eq('is_active', true);

    const totalHabits = habits ? habits.length : 0;

    // Fetch progress for today
    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('completed')
      .eq('user_id', partnerId)
      .eq('date', localDateStr);

    const completedCount = logs ? logs.filter(l => l.completed).length : 0;
    const todayScore = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

    // Fetch active challenge info of partner
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('current_day, last_marked_date')
      .eq('user_id', partnerId)
      .eq('active', true)
      .maybeSingle();

    return res.status(200).json({
      today_score_pct: todayScore,
      challenge_day: challenge ? challenge.current_day : 0,
      habits_completed: completedCount,
      habits_total: totalHabits,
      is_locked: challenge ? (challenge.last_marked_date === localDateStr) : false,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get active partnerships
    const { data: partnerships } = await supabaseAdmin
      .from('partnerships')
      .select('user_id, partner_id')
      .eq('status', 'active')
      .or(`user_id.eq.${userId},partner_id.eq.${userId}`);

    const memberIds = [userId];
    if (partnerships) {
      partnerships.forEach(p => {
        if (p.user_id !== userId) memberIds.push(p.user_id);
        if (p.partner_id !== userId) memberIds.push(p.partner_id);
      });
    }

    const leaderboard = [];
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    for (const memberId of memberIds) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url')
        .eq('id', memberId)
        .single();

      if (!profile) continue;

      // Calculate weekly average score
      const { data: habits } = await supabaseAdmin
        .from('habits')
        .select('id')
        .eq('user_id', memberId)
        .eq('is_active', true);

      const totalHabits = habits ? habits.length : 0;

      const { data: logs } = await supabaseAdmin
        .from('daily_progress')
        .select('date, completed')
        .eq('user_id', memberId)
        .gte('date', sevenDaysAgo);

      // Group logs by date for last 7 days
      const dateGroups = {};
      if (logs) {
        logs.forEach(log => {
          if (!dateGroups[log.date]) dateGroups[log.date] = [];
          dateGroups[log.date].push(log);
        });
      }

      let scoresSum = 0;
      let daysCount = 0;
      for (let i = 0; i < 7; i++) {
        const dStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const dayLogs = dateGroups[dStr] || [];
        const completedCount = dayLogs.filter(l => l.completed).length;
        const score = totalHabits > 0 ? (completedCount / totalHabits) : 0;
        scoresSum += score;
        daysCount++;
      }

      const weeklyScore = Math.round((scoresSum / daysCount) * 100);

      // Get challenge day
      const { data: challenge } = await supabaseAdmin
        .from('challenges')
        .select('current_day')
        .eq('user_id', memberId)
        .eq('active', true)
        .maybeSingle();

      leaderboard.push({
        user_id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        weekly_score: weeklyScore,
        challenge_day: challenge ? challenge.current_day : 0,
      });
    }

    // Sort leaderboard by score descending
    leaderboard.sort((a, b) => b.weekly_score - a.weekly_score);

    return res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
};
