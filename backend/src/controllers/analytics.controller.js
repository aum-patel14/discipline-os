import { supabaseAdmin } from '../config/supabase.js';
import { parseISO, differenceInDays, format, subMonths, eachDayOfInterval } from 'date-fns';

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

export const getMonthlyScore = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.params;

    const startStr = `${year}-${month.padStart(2, '0')}-01`;
    const start = parseISO(startStr);
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(parseISO(`${year}-${Number(month) + 1}-01`), 'yyyy-MM-dd'); // approximate next month start

    // Fetch habits
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const totalHabits = habits ? habits.length : 0;
    if (totalHabits === 0) {
      return res.status(200).json({ score: 0 });
    }

    // Fetch logs in the range
    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', fromStr)
      .lt('date', toStr);

    if (!logs || logs.length === 0) {
      return res.status(200).json({ score: 0 });
    }

    // Group logs by date
    const dateGroups = {};
    logs.forEach(log => {
      if (!dateGroups[log.date]) {
        dateGroups[log.date] = [];
      }
      dateGroups[log.date].push(log);
    });

    let totalScoreSum = 0;
    let loggedDaysCount = 0;

    Object.keys(dateGroups).forEach(date => {
      const dayLogs = dateGroups[date];
      const completedCount = dayLogs.filter(l => l.completed).length;
      const score = Math.round((completedCount / totalHabits) * 100);
      totalScoreSum += score;
      loggedDaysCount += 1;
    });

    const averageScore = loggedDaysCount > 0 ? Math.round(totalScoreSum / loggedDaysCount) : 0;
    return res.status(200).json({ score: averageScore });
  } catch (error) {
    next(error);
  }
};

export const getWeeklyScore = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Get last 7 days of daily score
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const todayStr = getUserLocalDate(userProfile?.timezone);
    const today = parseISO(todayStr);
    const startOfWeek = parseISO(format(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const totalHabits = habits ? habits.length : 0;

    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', format(startOfWeek, 'yyyy-MM-dd'))
      .lte('date', todayStr);

    const scores = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs ? logs.filter(l => l.date === dateStr) : [];
      const completedCount = dayLogs.filter(l => l.completed).length;
      const score = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
      scores.push({
        date: dateStr,
        dayName: format(d, 'eee'),
        score
      });
    }

    return res.status(200).json(scores);
  } catch (error) {
    next(error);
  }
};

export const getStreaks = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user timezone
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const todayStr = getUserLocalDate(userProfile?.timezone);

    // Fetch active habits
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const totalHabits = habits ? habits.length : 0;
    if (totalHabits === 0) {
      return res.status(200).json({ currentStreak: 0, longestStreak: 0 });
    }

    // Fetch all completed progress logs
    const { data: logs, error } = await supabaseAdmin
      .from('daily_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Group logs by date
    const dateCounts = {};
    logs.forEach(log => {
      dateCounts[log.date] = (dateCounts[log.date] || 0) + 1;
    });

    // Extract dates where all active habits were completed
    const perfectDates = Object.keys(dateCounts)
      .filter(date => dateCounts[date] === totalHabits)
      .sort((a, b) => new Date(b) - new Date(a)); // sorted descending (newest first)

    if (perfectDates.length === 0) {
      return res.status(200).json({ currentStreak: 0, longestStreak: 0 });
    }

    // Calculate Current Streak
    let currentStreak = 0;
    let expectedDate = parseISO(todayStr);

    // If today is not perfect, check if yesterday was. If neither, current streak is 0.
    const hasToday = perfectDates.includes(todayStr);
    const yesterdayStr = format(new Date(expectedDate.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const hasYesterday = perfectDates.includes(yesterdayStr);

    if (hasToday || hasYesterday) {
      let streakDate = hasToday ? expectedDate : new Date(expectedDate.getTime() - 24 * 60 * 60 * 1000);
      while (true) {
        const dateStr = format(streakDate, 'yyyy-MM-dd');
        if (perfectDates.includes(dateStr)) {
          currentStreak++;
          streakDate = new Date(streakDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    // Calculate Longest Streak
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;

    // Sort ascending for longest streak calculation
    const perfectDatesAsc = [...perfectDates].sort((a, b) => new Date(a) - new Date(b));

    perfectDatesAsc.forEach(dateStr => {
      const currentDate = parseISO(dateStr);
      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const diff = differenceInDays(currentDate, lastDate);
        if (diff === 1) {
          tempStreak++;
        } else if (diff > 1) {
          if (tempStreak > longestStreak) {
            longestStreak = tempStreak;
          }
          tempStreak = 1;
        }
      }
      lastDate = currentDate;
    });

    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    return res.status(200).json({ currentStreak, longestStreak });
  } catch (error) {
    next(error);
  }
};

export const getEnergyScoreToday = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user timezone
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const todayStr = getUserLocalDate(userProfile?.timezone);

    // Get active habits
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!habits || habits.length === 0) {
      return res.status(200).json({ energyScore: 0, water: 0, workout: 0, sleep: 0 });
    }

    // Find specific habits
    const waterHabit = habits.find(h => h.emoji === '💧' || h.name.toLowerCase().includes('water') || h.name.toLowerCase().includes('hydration'));
    const workoutHabit = habits.find(h => h.emoji === '🏋️' || h.name.toLowerCase().includes('workout') || h.name.toLowerCase().includes('movement'));
    const sleepHabit = habits.find(h => h.emoji === '😴' || h.name.toLowerCase().includes('sleep'));

    // Fetch logs for today
    const habitIds = [waterHabit?.id, workoutHabit?.id, sleepHabit?.id].filter(Boolean);
    const { data: logs } = habitIds.length > 0 ? await supabaseAdmin
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .in('habit_id', habitIds) : { data: [] };

    const getCompletionRate = (habit, logsList) => {
      if (!habit) return 0; // Default to 0 if not configured
      const log = logsList.find(l => l.habit_id === habit.id);
      const val = log ? Number(log.value) : 0;
      const goal = Number(habit.current_goal);
      if (goal === 0) return 0;
      
      const pct = (val / goal) * 100;
      return Math.min(100, Math.max(0, pct)); // bound 0-100
    };

    const waterRate = getCompletionRate(waterHabit, logs || []);
    const workoutRate = getCompletionRate(workoutHabit, logs || []);
    const sleepRate = getCompletionRate(sleepHabit, logs || []);

    // Energy formula: Water * 0.35 + Workout * 0.35 + Sleep * 0.30
    const rawScore = (waterRate * 0.35) + (workoutRate * 0.35) + (sleepRate * 0.30);
    const energyScore = Math.round(Math.min(100, rawScore));

    return res.status(200).json({
      energyScore,
      water: {
        percentage: Math.round(waterRate),
        current: logs?.find(l => l.habit_id === waterHabit?.id)?.value || 0,
        goal: waterHabit?.current_goal || 0,
        unit: waterHabit?.unit || 'liters'
      },
      workout: {
        percentage: Math.round(workoutRate),
        current: logs?.find(l => l.habit_id === workoutHabit?.id)?.value || 0,
        goal: workoutHabit?.current_goal || 0,
        unit: workoutHabit?.unit || 'hours'
      },
      sleep: {
        percentage: Math.round(sleepRate),
        current: logs?.find(l => l.habit_id === sleepHabit?.id)?.value || 0,
        goal: sleepHabit?.current_goal || 0,
        unit: sleepHabit?.unit || 'hours'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBestHabits = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user's active habits
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id, name, emoji, color')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!habits || habits.length === 0) {
      return res.status(200).json([]);
    }

    const habitIds = habits.map(h => h.id);

    // Fetch all logs for these habits
    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('habit_id, completed')
      .in('habit_id', habitIds);

    const stats = habits.map(habit => {
      const habitLogs = logs ? logs.filter(l => l.habit_id === habit.id) : [];
      const totalLogged = habitLogs.length;
      const completedCount = habitLogs.filter(l => l.completed).length;
      
      const completionRate = totalLogged > 0 ? Math.round((completedCount / totalLogged) * 100) : 0;
      
      return {
        id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        color: habit.color,
        completionRate,
        completedCount,
        totalLogged
      };
    });

    // Sort by completion rate descending
    stats.sort((a, b) => b.completionRate - a.completionRate);

    return res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

export const getHeatmap = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const months = parseInt(req.query.months) || 3;

    // Fetch timezone
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('timezone')
      .eq('id', userId)
      .single();

    const todayStr = getUserLocalDate(userProfile?.timezone);
    const today = parseISO(todayStr);
    const startDate = subMonths(today, months);
    
    // Fetch active habits
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const totalHabits = habits ? habits.length : 0;

    // Fetch logs in the timeframe
    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', todayStr);

    const datesList = eachDayOfInterval({ start: startDate, end: today });

    const heatmap = datesList.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLogs = logs ? logs.filter(l => l.date === dateStr) : [];
      const completedCount = dayLogs.filter(l => l.completed).length;
      const score = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

      return {
        date: dateStr,
        score
      };
    });

    return res.status(200).json(heatmap);
  } catch (error) {
    next(error);
  }
};
