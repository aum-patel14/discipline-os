import { create } from 'zustand';
import apiClient from '../utils/api';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  unit: string;
  base_goal: number;
  current_goal: number;
  step_size: number;
  color: string;
  is_villain: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  fetchHabits: () => Promise<void>;
  addHabit: (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'is_active' | 'sort_order' | 'current_goal'>) => Promise<void>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  reorderHabits: (ids: string[]) => Promise<void>;
  resetGoals: () => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,

  fetchHabits: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get('/api/habits');
      set({ habits: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching habits:', error);
    }
  },

  addHabit: async (habitData) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/habits', habitData);
      set((state) => ({
        habits: [...state.habits, response.data].sort((a, b) => a.sort_order - b.sort_order),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to add habit');
    }
  },

  updateHabit: async (id, updates) => {
    // Optimistic Update
    const previousHabits = get().habits;
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    }));

    try {
      await apiClient.put(`/api/habits/${id}`, updates);
    } catch (error: any) {
      // Rollback
      set({ habits: previousHabits });
      throw new Error(error.response?.data?.error || 'Failed to update habit');
    }
  },

  deleteHabit: async (id) => {
    const previousHabits = get().habits;
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));

    try {
      await apiClient.delete(`/api/habits/${id}`);
    } catch (error: any) {
      set({ habits: previousHabits });
      throw new Error(error.response?.data?.error || 'Failed to delete habit');
    }
  },

  reorderHabits: async (ids) => {
    const previousHabits = get().habits;

    // Optimistically reorder in local state based on index position
    const ordered = [...previousHabits].sort((a, b) => {
      const indexA = ids.indexOf(a.id);
      const indexB = ids.indexOf(b.id);
      return indexA - indexB;
    }).map((h, index) => ({ ...h, sort_order: index + 1 }));

    set({ habits: ordered });

    try {
      await apiClient.put('/api/habits/reorder', { ids });
    } catch (error: any) {
      // Rollback on error
      set({ habits: previousHabits });
      console.error('Failed to save reorder state:', error);
    }
  },

  resetGoals: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post('/api/habits/reset-goals');
      // Refetch
      const response = await apiClient.get('/api/habits');
      set({ habits: response.data, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      throw new Error(error.response?.data?.error || 'Failed to reset goals');
    }
  },
}));
