import { create } from 'zustand';
import apiClient from '../utils/api';

export interface ProgressItem {
  habit_id: string;
  name: string;
  emoji: string;
  unit: string;
  base_goal: number;
  current_goal: number;
  step_size: number;
  color: string;
  is_villain: boolean;
  sort_order: number;
  value: number;
  completed: boolean;
}

export interface MonthDay {
  date: string;
  day_number: number;
  daily_score: number;
  habits: {
    habit_id: string;
    name: string;
    emoji: string;
    color: string;
    completed: boolean;
  }[];
}

interface ProgressState {
  todayProgress: ProgressItem[];
  monthProgress: { [key: string]: MonthDay[] }; // cache key: "year-month"
  isLoading: boolean;
  fetchTodayProgress: () => Promise<void>;
  fetchMonthProgress: (year: string, month: string) => Promise<void>;
  logProgress: (habitId: string, date: string, value: number) => Promise<void>;
  toggleProgress: (habitId: string, date: string) => Promise<void>;
  resetToday: () => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  todayProgress: [],
  monthProgress: {},
  isLoading: false,

  fetchTodayProgress: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/progress/today');
      set({ todayProgress: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching today progress:', error);
    }
  },

  fetchMonthProgress: async (year, month) => {
    const cacheKey = `${year}-${month}`;
    set({ isLoading: true });
    try {
      const response = await apiClient.get(`/api/progress/month/${year}/${month}`);
      set((state) => ({
        monthProgress: {
          ...state.monthProgress,
          [cacheKey]: response.data,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ isLoading: false });
      console.error(`Error fetching month progress (${cacheKey}):`, error);
    }
  },

  logProgress: async (habitId, date, value) => {
    const previousToday = get().todayProgress;

    // Optimistically update today's list if logging for today
    set((state) => ({
      todayProgress: state.todayProgress.map((p) => {
        if (p.habit_id !== habitId) return p;
        
        let completed = false;
        if (p.is_villain) {
          if (p.unit.toLowerCase() === 'day') {
            completed = value >= p.current_goal;
          } else {
            completed = value <= p.current_goal;
          }
        } else {
          completed = value >= p.current_goal;
        }

        return { ...p, value, completed };
      }),
    }));

    try {
      const response = await apiClient.post('/api/progress/log', {
        habit_id: habitId,
        date,
        value,
      });

      // Update local state with the exact record from the server
      const updatedLog = response.data;
      set((state) => ({
        todayProgress: state.todayProgress.map((p) =>
          p.habit_id === habitId ? { ...p, value: Number(updatedLog.value), completed: updatedLog.completed } : p
        ),
      }));
    } catch (error) {
      // Rollback
      set({ todayProgress: previousToday });
      console.error('Error logging progress:', error);
      throw error;
    }
  },

  toggleProgress: async (habitId, date) => {
    const previousToday = get().todayProgress;

    // Optimistic toggle
    set((state) => ({
      todayProgress: state.todayProgress.map((p) => {
        if (p.habit_id !== habitId) return p;
        const targetCompleted = !p.completed;
        const targetValue = targetCompleted ? p.current_goal : 0;
        return { ...p, value: targetValue, completed: targetCompleted };
      }),
    }));

    try {
      const response = await apiClient.post('/api/progress/toggle', {
        habit_id: habitId,
        date,
      });

      const updatedLog = response.data;
      set((state) => ({
        todayProgress: state.todayProgress.map((p) =>
          p.habit_id === habitId ? { ...p, value: Number(updatedLog.value), completed: updatedLog.completed } : p
        ),
      }));
    } catch (error) {
      set({ todayProgress: previousToday });
      console.error('Error toggling progress:', error);
      throw error;
    }
  },

  resetToday: async () => {
    set({ isLoading: true });
    try {
      await apiClient.delete('/api/progress/reset-today');
      // Refetch
      const response = await apiClient.get('/api/progress/today');
      set({ todayProgress: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error resetting today progress:', error);
      throw error;
    }
  },
}));
