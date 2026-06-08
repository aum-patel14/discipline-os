import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function LeaderboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/partner');
  }, []);
  return null;
}
