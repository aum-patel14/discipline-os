import { create } from 'zustand';
import * as SecureStore from '../utils/secureStore';
import apiClient, { supabase } from '../utils/api';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  timezone: string;
  villain_mode: boolean;
  partner_code: string;
  created_at: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  signup: (email: string, password: string, username: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      await SecureStore.setItemAsync('user_session_token', token);
      set({ token, user: user.profile, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  googleLogin: async (idToken) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/auth/google', { idToken });
      const { token, user } = response.data;

      await SecureStore.setItemAsync('user_session_token', token);
      set({ token, user: user.profile, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Google login failed');
    }
  },

  signup: async (email, password, username, fullName) => {
    set({ isLoading: true });
    try {
      await apiClient.post('/api/auth/signup', { email, password, username, full_name: fullName });
      set({ isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Signup failed');
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post('/api/auth/logout').catch(() => {});
      await supabase.auth.signOut().catch(() => {});
    } catch (err) {
      console.warn('Backend logout error, cleaning local state anyway:', err);
    } finally {
      await SecureStore.deleteItemAsync('user_session_token');
      set({ token: null, user: null, isLoading: false });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync('user_session_token');
      if (!token) {
        set({ user: null, token: null, isLoading: false });
        return false;
      }

      // Sync Supabase Auth state just in case
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const response = await apiClient.get('/api/auth/me');
      set({ token, user: response.data, isLoading: false });
      return true;
    } catch (error) {
      console.warn('Session check failed, clearing token:', error);
      await SecureStore.deleteItemAsync('user_session_token');
      set({ user: null, token: null, isLoading: false });
      return false;
    }
  },

  updateProfile: async (data) => {
    try {
      const response = await apiClient.put('/api/auth/profile', data);
      set({ user: response.data });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update profile');
    }
  },
}));
