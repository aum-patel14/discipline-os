import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

// Validation Schemas
const logProgressSchema = z.object({
  habit_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  value: z.number().nonnegative(),
});

const toggleProgressSchema = z.object({
  habit_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

const calculateCompletion = (value, currentGoal, isVillain, unit) => {
  if (isVillain) {
    // For villain habits:
    // If unit is "day", 1 = avoided (completed), 0 = indulged (not completed)
    if (unit && unit.toLowerCase() === 'day') {
      return value >= currentGoal;
    }
    // Otherwise, limit-based (e.g., social media < 1 hour), so value <= currentGoal means success
    return value <= currentGoal;
  }
  // For hero habits: value >= goal means completed
  return value >= currentGoal;
};

export const getProgressByDate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.params; // YYYY-MM-DD

    // Get active habits
    const { data: habits, error: habitsError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habitsError) {
      return res.status(400).json({ error: habitsError.message });
    }

    // Get progress logs for this date
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (logsError) {
      return res.status(400).json({ error: logsError.message });
    }

    // Merge progress logs with active habits
    const progressList = habits.map(habit => {
      const log = logs.find(l => l.habit_id === habit.id);
      return {
        habit_id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        unit: habit.unit,
        base_goal: habit.base_goal,
        current_goal: habit.current_goal,
        step_size: habit.step_size,
        color: habit.color,
        is_villain: habit.is_villain,
        sort_order: habit.sort_order,
        value: log ? Number(log.value) : 0,
        completed: log ? log.completed : false,
      };
    }).sort((a, b) => a.sort_order - b.sort_order);

    return res.status(200).json(progressList);
  } catch (error) {
    next(error);
  }
};

export const getTodayProgress = async (req, res, next) => {
  try {
    // Get user timezone (default to UTC if not set)
    const userId = req.user.id;
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const tz = userProfile?.timezone || 'UTC';
    
    // Get local date string for the user's timezone
    const localDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    req.params.date = localDateStr;
    return getProgressByDate(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const getMonthProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.params; // e.g. 2026, 06

    const startStr = `${year}-${month.padStart(2, '0')}-01`;
    const start = parseISO(startStr);
    const end = endOfMonth(start);
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');

    // Get active habits
    const { data: habits, error: habitsError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (habitsError) {
      return res.status(400).json({ error: habitsError.message });
    }

    // Get logs in this month
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .gte('date', fromStr)
      .lte('date', toStr);

    if (logsError) {
      return res.status(400).json({ error: logsError.message });
    }

    // Generate dates for the month
    const daysInMonth = eachDayOfInterval({ start, end });

    const calendar = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLogs = logs.filter(l => l.date === dateStr);

      const habitsDetail = habits.map(habit => {
        const log = dayLogs.find(l => l.habit_id === habit.id);
        const value = log ? Number(log.value) : 0;
        
        // Compute completed status (respecting potential historic current_goal variations, 
        // fallback to standard calculation if not logged yet)
        const completed = log ? log.completed : calculateCompletion(value, habit.current_goal, habit.is_villain, habit.unit);
        
        return {
          habit_id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          color: habit.color,
          completed,
        };
      });

      const totalHabits = habits.length;
      const completedHabits = habitsDetail.filter(h => h.completed).length;
      const dailyScore = totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0;

      return {
        date: dateStr,
        day_number: day.getDate(),
        daily_score: dailyScore,
        habits: habitsDetail,
      };
    });

    return res.status(200).json(calendar);
  } catch (error) {
    next(error);
  }
};

export const getProgressRange = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.query; // YYYY-MM-DD

    if (!from || !to) {
      return res.status(400).json({ error: "Missing 'from' or 'to' query parameters" });
    }

    const { data: logs, error } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
};

export const logProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { habit_id, date, value } = logProgressSchema.parse(req.body);

    // Fetch habit details to compute completion
    const { data: habit, error: habitError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('id', habit_id)
      .eq('user_id', userId)
      .single();

    if (habitError || !habit) {
      return res.status(404).json({ error: 'Habit not found or not owned by user' });
    }

    const completed = calculateCompletion(value, habit.current_goal, habit.is_villain, habit.unit);

    // Upsert daily progress
    const { data: log, error: upsertError } = await supabaseAdmin
      .from('daily_progress')
      .upsert({
        user_id: userId,
        habit_id,
        date,
        value,
        completed,
      }, { onConflict: 'user_id,habit_id,date' })
      .select()
      .single();

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    return res.status(200).json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const toggleProgress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { habit_id, date } = toggleProgressSchema.parse(req.body);

    // Fetch habit details
    const { data: habit, error: habitError } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('id', habit_id)
      .eq('user_id', userId)
      .single();

    if (habitError || !habit) {
      return res.status(404).json({ error: 'Habit not found' });
    }

    // Check existing progress
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('habit_id', habit_id)
      .eq('date', date)
      .maybeSingle();

    let targetValue;
    let targetCompleted;

    if (existing && existing.completed) {
      // Toggle to undone
      targetValue = 0;
      targetCompleted = false;
    } else {
      // Toggle to done (sets value to current_goal)
      targetValue = habit.current_goal;
      targetCompleted = true;
    }

    const { data: log, error: upsertError } = await supabaseAdmin
      .from('daily_progress')
      .upsert({
        user_id: userId,
        habit_id,
        date,
        value: targetValue,
        completed: targetCompleted,
      }, { onConflict: 'user_id,habit_id,date' })
      .select()
      .single();

    if (upsertError) {
      return res.status(400).json({ error: upsertError.message });
    }

    return res.status(200).json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const resetTodayProgress = async (req, res, next) => {
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

    const { error } = await supabaseAdmin
      .from('daily_progress')
      .delete()
      .eq('user_id', userId)
      .eq('date', localDateStr);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Today\'s progress reset successfully' });
  } catch (error) {
    next(error);
  }
};
