import * as SecureStore from 'expo-secure-store';

export const getItemAsync = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error('Error getting item from secure store:', err);
    return null;
  }
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.error('Error setting item in secure store:', err);
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error('Error deleting item from secure store:', err);
  }
};
