import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function NotificationSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings');
  }, []);
  return null;
}
