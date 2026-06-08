import cron from 'node-cron';
import { supabaseAdmin } from './config/supabase.js';
import { sendPushNotification } from './services/notification.service.js';
import logger from './config/logger.js';
import { parseISO, subDays, format } from 'date-fns';

// Helper to get local date/time parts based on timezone
const getLocalTimeDetails = (timezone) => {
  const tz = timezone || 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const dict = {};
    parts.forEach(p => { dict[p.type] = p.value; });
    return {
      dateStr: `${dict.year}-${dict.month}-${dict.day}`, // YYYY-MM-DD
      hour: parseInt(dict.hour),
      minute: parseInt(dict.minute)
    };
  } catch (err) {
    // Fallback if timezone string is invalid
    logger.error(`Error parsing timezone ${timezone}: ${err.message}. Falling back to UTC.`);
    const now = new Date();
    return {
      dateStr: format(now, 'yyyy-MM-dd'),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes()
    };
  }
};

// Main task runner (runs hourly)
export const runHourlyJobs = async () => {
  logger.info('Running hourly cron job updates...');
  
  try {
    // 1. Fetch all users and their notification settings
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, timezone');

    if (usersError) {
      logger.error(`Cron failed to fetch users: ${usersError.message}`);
      return;
    }

    for (const user of users) {
      const { data: settings } = await supabaseAdmin
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!settings) continue;

      const localTime = getLocalTimeDetails(user.timezone);
      const localHour = localTime.hour;
      
      // A. MIDNIGHT ROLLOVER (Hour 0)
      if (localHour === 0) {
        logger.info(`Running midnight rollover check for user ${user.id} in timezone ${user.timezone}`);
        await handleMidnightRollover(user.id, localTime.dateStr, settings.push_token);
      }

      // B. MORNING REMINDER
      if (settings.morning_reminder && settings.push_token) {
        const morningHour = parseInt(settings.morning_time.split(':')[0]);
        if (localHour === morningHour) {
          await sendMorningReminder(user.id, settings.push_token);
        }
      }

      // C. EVENING REMINDER
      if (settings.evening_reminder && settings.push_token) {
        const eveningHour = parseInt(settings.evening_time.split(':')[0]);
        if (localHour === eveningHour) {
          await sendEveningReminder(user.id, localTime.dateStr, settings.push_token);
        }
      }

      // D. MIDNIGHT WARNING (Hour 23)
      if (settings.midnight_warning && settings.push_token && localHour === 23) {
        await sendMidnightWarning(user.id, localTime.dateStr, settings.push_token);
      }
    }
  } catch (error) {
    logger.error(`Error in runHourlyJobs: ${error.message}`);
  }
};

/**
 * Rollover logic for challenges at midnight
 */
const handleMidnightRollover = async (userId, todayStr, pushToken) => {
  try {
    // Fetch active challenge
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (!challenge) return;

    // Yesterday in user's timezone
    const yesterdayDate = subDays(parseISO(todayStr), 1);
    const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd');

    // If they already locked yesterday or locked today, they are safe
    if (challenge.last_marked_date === yesterdayStr || challenge.last_marked_date === todayStr) {
      return; 
    }

    // They missed yesterday! Let's check shields
    if (challenge.shields > 0) {
      // Deduct 1 shield
      const nextShields = challenge.shields - 1;
      
      // Update challenge to keep streak alive (mark last_marked_date as yesterday so they don't compound penalize)
      await supabaseAdmin
        .from('challenges')
        .update({
          shields: nextShields,
          last_marked_date: yesterdayStr // save yesterday as "marked" with shield
        })
        .eq('id', challenge.id);

      // Insert skipped day into challenge_days
      await supabaseAdmin
        .from('challenge_days')
        .insert({
          challenge_id: challenge.id,
          user_id: userId,
          day_number: challenge.current_day,
          status: 'skipped', // skipped using shield
          date: yesterdayStr,
          habit_pct: 0
        });

      // Send push notification
      if (pushToken) {
        await sendPushNotification(
          pushToken,
          '🛡️ Shield activated!',
          `Streak saved. ${nextShields} shields remaining.`
        );
      }
      logger.info(`User ${userId} missed yesterday. Shield used. ${nextShields} remaining.`);
    } else {
      // No shields! Reset challenge back to Day 1
      await supabaseAdmin
        .from('challenges')
        .update({
          current_day: 1,
          perfect_days: 0,
          growth_pct: 0,
          last_marked_date: null
        })
        .eq('id', challenge.id);

      // Delete all marked days for this challenge
      await supabaseAdmin
        .from('challenge_days')
        .delete()
        .eq('challenge_id', challenge.id);

      // Reset all habit goals back to base values
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

      // Send push notification
      if (pushToken) {
        await sendPushNotification(
          pushToken,
          '😞 Back to Day 1',
          'You missed a day. Champions restart. Go again.'
        );
      }
      logger.info(`User ${userId} missed yesterday. No shields. Challenge reset back to Day 1.`);
    }
  } catch (error) {
    logger.error(`Error in handleMidnightRollover for user ${userId}: ${error.message}`);
  }
};

/**
 * Morning reminder
 */
const sendMorningReminder = async (userId, pushToken) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('current_day')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    const dayNum = challenge ? challenge.current_day : 1;
    await sendPushNotification(
      pushToken,
      `Day ${dayNum} starts now 🔥`,
      'Build the discipline. Open your tracker.'
    );
  } catch (error) {
    logger.error(`Error in sendMorningReminder for user ${userId}: ${error.message}`);
  }
};

/**
 * Evening reminder
 */
const sendEveningReminder = async (userId, dateStr, pushToken) => {
  try {
    // Get active habits count
    const { data: habits } = await supabaseAdmin
      .from('habits')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const total = habits ? habits.length : 0;
    if (total === 0) return;

    // Get completed habits count
    const { data: logs } = await supabaseAdmin
      .from('daily_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .eq('completed', true);

    const completed = logs ? logs.length : 0;

    await sendPushNotification(
      pushToken,
      "Don't forget today 📋",
      `You've done ${completed}/${total} habits. Keep going!`
    );
  } catch (error) {
    logger.error(`Error in sendEveningReminder for user ${userId}: ${error.message}`);
  }
};

/**
 * Midnight warning
 */
const sendMidnightWarning = async (userId, dateStr, pushToken) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('current_day, last_marked_date')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();

    if (!challenge) return;

    // If today is already locked, no need to send warning
    if (challenge.last_marked_date === dateStr) return;

    await sendPushNotification(
      pushToken,
      `⚠️ 1 hour left — Day ${challenge.current_day} deadline!`,
      'Complete all habits and lock in before midnight.'
    );
  } catch (error) {
    logger.error(`Error in sendMidnightWarning for user ${userId}: ${error.message}`);
  }
};

// Register the cron job to run at minute 0 of every hour
// '0 * * * *' = at the start of every hour
export const startCronScheduler = () => {
  cron.schedule('0 * * * *', runHourlyJobs);
  logger.info('Scheduler cron task registered.');
};
