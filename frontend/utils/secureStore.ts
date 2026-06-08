import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export const getItemAsync = async (key: string): Promise<string | null> => {
  try {
    if (isWeb) {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error('Error getting item from secure store:', err);
    return null;
  }
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  try {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    console.error('Error setting item in secure store:', err);
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  try {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (err) {
    console.error('Error deleting item from secure store:', err);
  }
};
