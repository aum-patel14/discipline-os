import { create } from 'zustand';
import apiClient from '../utils/api';

export interface MoodLog {
  id: string;
  user_id: string;
  date: string;
  mood: number; // 0-4
  habit_pct: number;
  note: string;
  created_at: string;
}

export interface MoodCorrelation {
  bucket: string;
  avgMood: number;
  count: number;
}

interface MoodState {
  todayMood: MoodLog | null;
  history: MoodLog[];
  correlation: MoodCorrelation[];
  isLoading: boolean;
  fetchTodayMood: () => Promise<void>;
  fetchMoodHistory: (days?: number) => Promise<void>;
  logMood: (mood: number, date: string, note?: string) => Promise<void>;
  fetchCorrelation: () => Promise<void>;
}

export const useMoodStore = create<MoodState>((set, get) => ({
  todayMood: null,
  history: [],
  correlation: [],
  isLoading: false,

  fetchTodayMood: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/mood/today');
      set({ todayMood: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching today mood:', error);
    }
  },

  fetchMoodHistory: async (days = 30) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get(`/api/mood/history?days=${days}`);
      set({ history: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching mood history:', error);
    }
  },

  logMood: async (mood, date, note) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/mood/log', { mood, date, note });
      set({ todayMood: response.data, isLoading: false });
      // Refresh history & correlation
      get().fetchMoodHistory();
      get().fetchCorrelation();
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to log mood');
    }
  },

  fetchCorrelation: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/mood/correlation');
      set({ correlation: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching mood correlation:', error);
    }
  },
}));
