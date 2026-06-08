import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';

// Validation Schemas
const moodLogSchema = z.object({
  mood: z.number().int().min(0).max(4),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
});

export const getTodayMood = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user timezone
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const tz = userProfile?.timezone || 'UTC';
    const localDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const { data: mood, error } = await supabaseAdmin
      .from('mood_log')
      .select('*')
      .eq('user_id', userId)
      .eq('date', localDateStr)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(mood || null);
  } catch (error) {
    next(error);
  }
};

export const getMoodHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;

    const { data: moods, error } = await supabaseAdmin
      .from('mood_log')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(days);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(moods);
  } catch (error) {
    next(error);
  }
};

export const logMood = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { mood, date, note } = moodLogSchema.parse(req.body);

    // Fetch active habits to calculate completion percentage
    const { data: habits, error: habitsError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habitsError) {
      return res.status(400).json({ error: habitsError.message });
    }

    // Fetch progress for that date
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (logsError) {
      return res.status(400).json({ error: logsError.message });
    }

    let habitPct = 0;
    if (habits.length > 0) {
      const completedCount = habits.filter(habit => {
        const log = logs.find(l => l.habit_id === habit.id);
        return log && log.completed;
      }).length;

      habitPct = Math.round((completedCount / habits.length) * 100);
    }

    // Upsert mood log
    const { data: moodLog, error: upsertError } = await supabaseAdmin
      .from('mood_log')
      .upsert({
        user_id: userId,
        date,
        mood,
        habit_pct: habitPct,
        note: note || '',
      }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    return res.status(200).json(moodLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const getCorrelation = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch all mood logs for this user to aggregate buckets
    const { data: moods, error } = await supabaseAdmin
      .from('mood_log')
      .select('mood, habit_pct')
      .eq('user_id', userId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const buckets = {
      '0-25%': { sum: 0, count: 0 },
      '26-50%': { sum: 0, count: 0 },
      '51-75%': { sum: 0, count: 0 },
      '76-100%': { sum: 0, count: 0 },
    };

    moods.forEach(log => {
      const pct = log.habit_pct;
      let bucketKey = '0-25%';
      if (pct > 25 && pct <= 50) bucketKey = '26-50%';
      else if (pct > 50 && pct <= 75) bucketKey = '51-75%';
      else if (pct > 75) bucketKey = '76-100%';

      buckets[bucketKey].sum += log.mood;
      buckets[bucketKey].count += 1;
    });

    const correlation = Object.keys(buckets).map(key => {
      const b = buckets[key];
      return {
        bucket: key,
        avgMood: b.count > 0 ? Number((b.sum / b.count).toFixed(2)) : 0,
        count: b.count,
      };
    });

    return res.status(200).json(correlation);
  } catch (error) {
    next(error);
  }
};
