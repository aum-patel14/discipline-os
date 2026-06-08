import { supabaseAdmin } from '../config/supabase.js';
import { sendPushNotification } from '../services/notification.service.js';
import logger from '../config/logger.js';

// Helper to get local date based on user timezone
const getUserLocalDate = (timezone) => {
  const tz = timezone || 'UTC';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

export const getCurrentChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: challenge, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!challenge) {
      return res.status(200).json(null);
    }

    // Fetch details of marked days for this challenge
    const { data: days, error: daysError } = await supabaseAdmin
      .from('challenge_days')
      .select('*')
      .eq('challenge_id', challenge.id)
      .order('day_number', { ascending: true });

    if (daysError) {
      return res.status(400).json({ error: daysError.message });
    }

    return res.status(200).json({
      ...challenge,
      days: days || []
    });
  } catch (error) {
    next(error);
  }
};

export const startChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if there is already an active challenge
    const { data: activeChallenge, error: checkError } = await supabaseAdmin
      .from('challenges')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (checkError) {
      return res.status(400).json({ error: checkError.message });
    }

    if (activeChallenge) {
      return res.status(400).json({ error: 'You already have an active 21-day challenge.' });
    }

    // Reset current_goals to base_goals upon starting new challenge
    const { data: habits, error: habitsError } = await supabaseAdmin
      .from('habits')
      .select('id, base_goal')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habitsError) {
      return res.status(400).json({ error: habitsError.message });
    }

    for (const habit of habits) {
      await supabaseAdmin
        .from('habits')
        .update({ current_goal: habit.base_goal })
        .eq('id', habit.id);
    }

    // Insert new challenge
    const { data: newChallenge, error: insertError } = await supabaseAdmin
      .from('challenges')
      .insert({
        user_id: userId,
        total_days: 21,
        current_day: 1,
        active: true,
        completed: false,
        shields: 0,
        perfect_days: 0,
        growth_pct: 0
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(201).json(newChallenge);
  } catch (error) {
    next(error);
  }
};

export const markDay = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user timezone
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('timezone, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(400).json({ error: 'User profile not found' });
    }

    const todayDateStr = getUserLocalDate(userProfile.timezone);

    // Fetch active challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (challengeError || !challenge) {
      return res.status(404).json({ error: 'No active challenge found' });
    }

    // Check if today has already been locked
    if (challenge.last_marked_date === todayDateStr) {
      return res.status(400).json({ error: 'Today has already been locked.' });
    }

    // Fetch active habits
    const { data: activeHabits, error: habitsError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habitsError) {
      return res.status(400).json({ error: habitsError.message });
    }

    if (activeHabits.length === 0) {
      return res.status(400).json({ error: 'You must create at least one active habit before locking a day.' });
    }

    // Fetch progress logs for today
    const { data: todayLogs, error: logsError } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayDateStr);

    if (logsError) {
      return res.status(400).json({ error: logsError.message });
    }

    // Verify all active habits are completed
    const allHabitsCompleted = activeHabits.every(habit => {
      const log = todayLogs.find(l => l.habit_id === habit.id);
      return log && log.completed;
    });

    if (!allHabitsCompleted) {
      return res.status(400).json({ error: 'Cannot lock day: not all habits are completed.' });
    }

    // Insert day record into challenge_days
    const habitPct = 100.0; // Completed all active habits
    const { error: dayInsertError } = await supabaseAdmin
      .from('challenge_days')
      .insert({
        challenge_id: challenge.id,
        user_id: userId,
        day_number: challenge.current_day,
        status: 'done',
        date: todayDateStr,
        habit_pct: habitPct
      });

    if (dayInsertError) {
      return res.status(400).json({ error: dayInsertError.message });
    }

    // Compound Goals: multiply current_goal of all active habits by 1.01
    for (const habit of activeHabits) {
      const updatedGoal = Number((habit.current_goal * 1.01).toFixed(2));
      await supabaseAdmin
        .from('habits')
        .update({ current_goal: updatedGoal })
        .eq('id', habit.id);
    }

    // Update challenge stats
    const nextPerfectDays = challenge.perfect_days + 1;
    const nextDay = challenge.current_day + 1;
    
    // Formula for growth compounding %: (1.01 ^ nextPerfectDays - 1) * 100
    const compoundMultiplier = Math.pow(1.01, nextPerfectDays);
    const growthPct = Number(((compoundMultiplier - 1) * 100).toFixed(1));

    let shieldsAwarded = 0;
    let notificationsToTrigger = [];

    // Award shield every 7 perfect days
    if (nextPerfectDays % 7 === 0) {
      shieldsAwarded = 1;
    }

    // Fetch user notification settings for push token
    const { data: notifSettings } = await supabaseAdmin
      .from('notification_settings')
      .select('push_token')
      .eq('user_id', userId)
      .single();

    const pushToken = notifSettings?.push_token;

    // Check challenge completion status (perfect_days hits total_days)
    const isCompleted = challenge.current_day >= challenge.total_days;

    const updateFields = {
      perfect_days: nextPerfectDays,
      last_marked_date: todayDateStr,
      growth_pct: growthPct,
      shields: challenge.shields + shieldsAwarded
    };

    if (isCompleted) {
      updateFields.completed = true;
      updateFields.active = false;
    } else {
      updateFields.current_day = nextDay;
    }

    const { data: updatedChallenge, error: updateError } = await supabaseAdmin
      .from('challenges')
      .update(updateFields)
      .eq('id', challenge.id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Send push notification if pushToken exists
    if (pushToken) {
      if (shieldsAwarded > 0) {
        notificationsToTrigger.push({
          token: pushToken,
          title: '🛡️ New shield earned!',
          body: '7 perfect days — you earned a shield!'
        });
      }
      if (isCompleted) {
        notificationsToTrigger.push({
          token: pushToken,
          title: '🏆 21-DAY CHALLENGE COMPLETE!',
          body: `Goals grew ${growthPct}%. You are unstoppable.`
        });
      }

      // Fire notifications
      for (const n of notificationsToTrigger) {
        sendPushNotification(n.token, n.title, n.body);
      }
    }

    return res.status(200).json(updatedChallenge);
  } catch (error) {
    next(error);
  }
};

export const resetChallenge = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Reset current challenge to inactive
    const { error } = await supabaseAdmin
      .from('challenges')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('active', true);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Reset habit goals back to base values
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id, base_goal')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habits) {
      for (const habit of habits) {
        await supabaseAdmin
          .from('habits')
          .update({ current_goal: habit.base_goal })
          .eq('id', habit.id);
      }
    }

    return res.status(200).json({ message: 'Challenge reset successfully. Habit goals rolled back.' });
  } catch (error) {
    next(error);
  }
};

export const getChallengeHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: history, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(history);
  } catch (error) {
    next(error);
  }
};
