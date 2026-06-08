import { create } from 'zustand';
import apiClient from '../utils/api';

export interface ChallengeDay {
  id: string;
  challenge_id: string;
  user_id: string;
  day_number: number;
  status: 'done' | 'failed' | 'skipped';
  date: string;
  habit_pct: number;
}

export interface Challenge {
  id: string;
  user_id: string;
  total_days: number;
  current_day: number;
  start_date: string;
  last_marked_date: string | null;
  completed: boolean;
  active: boolean;
  shields: number;
  perfect_days: number;
  growth_pct: number;
  created_at: string;
  days?: ChallengeDay[];
}

interface ChallengeState {
  challenge: Challenge | null;
  history: Challenge[];
  isLoading: boolean;
  fetchCurrentChallenge: () => Promise<void>;
  startChallenge: () => Promise<void>;
  markDay: () => Promise<void>;
  resetChallenge: () => Promise<void>;
  fetchHistory: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenge: null,
  history: [],
  isLoading: false,

  fetchCurrentChallenge: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/challenge/current');
      set({ challenge: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching current challenge:', error);
    }
  },

  startChallenge: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/challenge/start');
      set({ challenge: { ...response.data, days: [] }, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to start challenge');
    }
  },

  markDay: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/challenge/mark-day');
      // Update state with updated challenge
      set({ challenge: response.data, isLoading: false });
      // Reload current challenge to fetch challenge_days list
      await get().fetchCurrentChallenge();
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to lock today');
    }
  },

  resetChallenge: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post('/api/challenge/reset');
      set({ challenge: null, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to reset challenge');
    }
  },

  fetchHistory: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/challenge/history');
      set({ history: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching challenge history:', error);
    }
  },
}));
