import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as SecureStore from './secureStore';
import { Platform } from 'react-native';

// Set this to your local server IP address when testing on a physical device.
// 10.0.2.2 is the standard loopback address to host machine from Android Emulator.
const getBackendUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }
  // Change to your production Railway URL when deployed
  return 'https://discipline-os-production.up.railway.app';
};

export const BACKEND_URL = getBackendUrl();
export const BUNDLE_ID = 'host.exp.Exponent'; // Matches Expo Go during development

// Supabase URL & Anon Key (Loaded dynamically from Expo environment variables)
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-supabase-project.supabase.co';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: async (key) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch {
          return null;
        }
      },
      setItem: async (key, value) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch {}
      },
      removeItem: async (key) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {}
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Configure Axios API client
const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
});

// Interceptor to attach Supabase JWT & Bundle ID header
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('user_session_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      config.headers['x-app-bundle-id'] = BUNDLE_ID;
    } catch (error) {
      console.error('Error fetching secure store token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
