import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function HabitDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/manage');
  }, []);
  return null;
}
