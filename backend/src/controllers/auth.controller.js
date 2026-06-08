import { z } from 'zod';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../config/logger.js';

// Validation Schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).optional(),
  full_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleSchema = z.object({
  idToken: z.string(),
});

const profileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  full_name: z.string().optional(),
  timezone: z.string().optional(),
  villain_mode: z.boolean().optional(),
});

export const signup = async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    
    // Register user in Supabase Auth via Admin API to auto-confirm their email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username,
        full_name: data.full_name,
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData || !authData.user) {
      return res.status(400).json({ error: 'Signup failed. User could not be created.' });
    }

    // Return the created user and session token if auto-logged in
    return res.status(201).json({
      message: 'Signup successful! Verification email sent if enabled.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (sessionError) {
      return res.status(401).json({ error: sessionError.message });
    }

    // Fetch public profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      logger.error(`Error fetching profile on login: ${profileError.message}`);
    }

    return res.status(200).json({
      message: 'Login successful',
      token: sessionData.session.access_token,
      user: {
        ...sessionData.user,
        profile: profile || null,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const data = googleSchema.parse(req.body);

    // Verify and sign in user with Google ID token
    const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: data.idToken,
    });

    if (authError) {
      return res.status(401).json({ error: authError.message });
    }

    // Fetch public profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    return res.status(200).json({
      message: 'Google login successful',
      token: authData.session.access_token,
      user: {
        ...authData.user,
        profile: profile || null,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    // Supabase handles token invalidation on signOut
    const { error } = await supabase.auth.signOut();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    return res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const data = profileSchema.parse(req.body);

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('users')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
};
