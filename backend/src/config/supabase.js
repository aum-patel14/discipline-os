import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  logger.error('Missing Supabase environment variables! Check your .env file.');
}

// Client for general use, respects RLS when JWT is passed
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Admin client to bypass RLS for system/cron tasks
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
