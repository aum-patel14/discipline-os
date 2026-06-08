import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { sendPushNotification } from '../services/notification.service.js';

// Validation Schemas
const settingsSchema = z.object({
  morning_reminder: z.boolean().optional(),
  morning_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/).optional(), // HH:MM or HH:MM:SS
  evening_reminder: z.boolean().optional(),
  evening_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/).optional(),
  midnight_warning: z.boolean().optional(),
});

const tokenSchema = z.object({
  push_token: z.string().min(1),
});

export const getSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: settings, error } = await supabaseAdmin
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = settingsSchema.parse(req.body);

    const { data: settings, error } = await supabaseAdmin
      .from('notification_settings')
      .update(data)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const registerToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { push_token } = tokenSchema.parse(req.body);

    const { data: settings, error } = await supabaseAdmin
      .from('notification_settings')
      .update({ push_token })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Push token registered successfully', settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const testNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch the push token
    const { data: settings } = await supabaseAdmin
      .from('notification_settings')
      .select('push_token')
      .eq('user_id', userId)
      .single();

    if (!settings || !settings.push_token) {
      return res.status(400).json({ error: 'No registered push token found for your account' });
    }

    const ticket = await sendPushNotification(
      settings.push_token,
      '🔥 Discipline OS Test',
      'If you see this, push notifications are working perfectly!'
    );

    if (ticket) {
      return res.status(200).json({ message: 'Test notification sent!', ticket });
    } else {
      return res.status(500).json({ error: 'Failed to send test notification' });
    }
  } catch (error) {
    next(error);
  }
};
