export const getItemAsync = async (key: string): Promise<string | null> => {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch (err) {
    console.error('Error getting item from localStorage:', err);
    return null;
  }
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch (err) {
    console.error('Error setting item in localStorage:', err);
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Error deleting item from localStorage:', err);
  }
};
