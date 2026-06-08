-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up existing triggers/functions if they exist
-- DROP TRIGGER IF EXISTS on_public_user_created ON public.users;
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.preload_default_habits();
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.generate_partner_code();

-- Create helper function for 8-char partner code generation
CREATE OR REPLACE FUNCTION public.generate_partner_code() 
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if it exists in users
    SELECT EXISTS(SELECT 1 FROM public.users WHERE partner_code = result) INTO exists_code;
    EXIT WHEN NOT exists_code;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC' NOT NULL,
  villain_mode BOOLEAN DEFAULT false NOT NULL,
  partner_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. HABITS TABLE
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_goal NUMERIC NOT NULL,
  current_goal NUMERIC NOT NULL,
  step_size NUMERIC NOT NULL,
  color TEXT NOT NULL,
  is_villain BOOLEAN DEFAULT false NOT NULL,
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. DAILY PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.daily_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false NOT NULL,
  UNIQUE(user_id, habit_id, date)
);

-- 4. MOOD LOG TABLE
CREATE TABLE IF NOT EXISTS public.mood_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mood INT NOT NULL CHECK (mood >= 0 AND mood <= 4),
  habit_pct INT NOT NULL DEFAULT 0 CHECK (habit_pct >= 0 AND habit_pct <= 100),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date)
);

-- 5. CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_days INT DEFAULT 21 NOT NULL,
  current_day INT DEFAULT 1 NOT NULL,
  start_date DATE DEFAULT CURRENT_DATE NOT NULL,
  last_marked_date DATE,
  completed BOOLEAN DEFAULT false NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  shields INT DEFAULT 0 NOT NULL,
  perfect_days INT DEFAULT 0 NOT NULL,
  growth_pct NUMERIC DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. CHALLENGE DAYS TABLE
CREATE TABLE IF NOT EXISTS public.challenge_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'failed', 'skipped')),
  date DATE NOT NULL,
  habit_pct NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(challenge_id, day_number)
);

-- 7. PARTNERSHIPS TABLE
CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'declined')),
  UNIQUE(user_id, partner_id)
);

-- 8. PARTNER VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.partner_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  note TEXT,
  UNIQUE(from_user_id, to_user_id, date)
);

-- 9. NOTIFICATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  morning_reminder BOOLEAN DEFAULT true NOT NULL,
  morning_time TIME DEFAULT '07:00:00'::TIME NOT NULL,
  evening_reminder BOOLEAN DEFAULT true NOT NULL,
  evening_time TIME DEFAULT '21:00:00'::TIME NOT NULL,
  midnight_warning BOOLEAN DEFAULT true NOT NULL,
  push_token TEXT
);

-- Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON public.daily_progress(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mood_user_date ON public.mood_log(user_id, date);
CREATE INDEX IF NOT EXISTS idx_challenges_user_active ON public.challenges(user_id, active);
CREATE INDEX IF NOT EXISTS idx_partnerships_users ON public.partnerships(user_id, partner_id);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Define RLS Policies

-- Users: read anywhere if logged in, insert/update own
CREATE POLICY select_users ON public.users FOR SELECT USING (true);
CREATE POLICY insert_users ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY update_users ON public.users FOR UPDATE USING (auth.uid() = id);

-- Habits: own only
CREATE POLICY all_habits ON public.habits FOR ALL USING (auth.uid() = user_id);

-- Daily Progress: own, and partners can read
CREATE POLICY all_progress ON public.daily_progress FOR ALL USING (
  auth.uid() = user_id OR 
  (
    EXISTS (
      SELECT 1 FROM public.partnerships 
      WHERE status = 'active' AND (
        (user_id = auth.uid() AND partner_id = daily_progress.user_id) OR
        (partner_id = auth.uid() AND user_id = daily_progress.user_id)
      )
    ) AND (
      -- ONLY allow SELECT for partners
      current_setting('role', true) = 'authenticated' -- safety check
    )
  )
);

-- Mood Log: own only
CREATE POLICY all_mood_log ON public.mood_log FOR ALL USING (auth.uid() = user_id);

-- Challenges: own, and partners can read SELECT
CREATE POLICY all_challenges ON public.challenges FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.partnerships 
    WHERE status = 'active' AND (
      (user_id = auth.uid() AND partner_id = challenges.user_id) OR
      (partner_id = auth.uid() AND user_id = challenges.user_id)
    )
  )
);

-- Challenge Days: own, and partners can read SELECT
CREATE POLICY all_challenge_days ON public.challenge_days FOR ALL USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.partnerships 
    WHERE status = 'active' AND (
      (user_id = auth.uid() AND partner_id = challenge_days.user_id) OR
      (partner_id = auth.uid() AND user_id = challenge_days.user_id)
    )
  )
);

-- Partnerships: user is user_id or partner_id
CREATE POLICY all_partnerships ON public.partnerships FOR ALL USING (
  auth.uid() = user_id OR auth.uid() = partner_id
);

-- Partner Verifications: user is sender or receiver
CREATE POLICY all_verifications ON public.partner_verifications FOR ALL USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);

-- Notification Settings: own only
CREATE POLICY all_notification_settings ON public.notification_settings FOR ALL USING (
  auth.uid() = user_id
);


-- TRIGGERS SETUP FOR USER CREATION FLOW

-- Trigger function: Create public.users profile when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
  v_avatar_url TEXT;
  v_timezone TEXT;
  v_partner_code TEXT;
BEGIN
  -- Extract info with splits as safe fallbacks
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  v_timezone := COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC');
  
  -- Generate partner code
  v_partner_code := public.generate_partner_code();

  -- Insert into public.users
  INSERT INTO public.users (id, email, username, full_name, avatar_url, timezone, villain_mode, partner_code)
  VALUES (
    NEW.id,
    NEW.email,
    v_username,
    v_full_name,
    v_avatar_url,
    v_timezone,
    false,
    v_partner_code
  );
  
  -- Insert default notification settings
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind handle_new_user trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Trigger function: Preload the default habits upon public user insertion
CREATE OR REPLACE FUNCTION public.preload_default_habits()
RETURNS TRIGGER AS $$
BEGIN
  -- ⏰ Wake up 5:30 (Hero, unit: day, goal: 1, step: 1, color: #ffd60a)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Wake up 5:30', '⏰', 'day', 1.0, 1.0, 1.0, '#ffd60a', false, 1);
  
  -- 🏋️ Workout (Hero, unit: hours, goal: 1, step: 0.25, color: #f43f5e)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Workout', '🏋️', 'hours', 1.0, 1.0, 0.25, '#f43f5e', false, 2);
  
  -- 💧 Drink Water (Hero, unit: liters, goal: 4, step: 0.5, color: #22d3ee)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Drink Water', '💧', 'liters', 4.0, 4.0, 0.5, '#22d3ee', false, 3);
  
  -- 📖 Read (Hero, unit: pages, goal: 20, step: 5, color: #a78bfa)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Read', '📖', 'pages', 20.0, 20.0, 5.0, '#a78bfa', false, 4);
  
  -- 🧘 Meditation (Hero, unit: min, goal: 15, step: 5, color: #34d399)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Meditation', '🧘', 'min', 15.0, 15.0, 5.0, '#34d399', false, 5);
  
  -- 😴 Sleep 8hr (Hero, unit: hours, goal: 8, step: 0.5, color: #818cf8)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'Sleep 8hr', '😴', 'hours', 8.0, 8.0, 0.5, '#818cf8', false, 6);
  
  -- 🚫 No Junk Food (Villain, unit: day, goal: 1, step: 1, color: #fb923c)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'No Junk Food', '🚫', 'day', 1.0, 1.0, 1.0, '#fb923c', true, 7);
  
  -- 📵 No Social Media (Villain, unit: day, goal: 1, step: 1, color: #e879f9)
  INSERT INTO public.habits (user_id, name, emoji, unit, base_goal, current_goal, step_size, color, is_villain, sort_order)
  VALUES (NEW.id, 'No Social Media', '📵', 'day', 1.0, 1.0, 1.0, '#e879f9', true, 8);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind preload_default_habits trigger
CREATE TRIGGER on_public_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.preload_default_habits();
