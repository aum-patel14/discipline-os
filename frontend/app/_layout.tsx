import React, { useEffect, useState } from 'react';
import { Stack, Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { COLORS } from '../constants/Theme';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { usePushNotifications } from '../hooks/usePushNotifications';

// Create a client for React Query caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
    },
  },
});

function NavigationGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { user, token, checkSession, isLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  // Initialize push notification services for active users
  usePushNotifications();

  useEffect(() => {
    const runGuard = async () => {
      const activeSession = await checkSession();
      setIsReady(true);
    };
    runGuard();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!token && !inAuthGroup) {
      // User is not authenticated, redirect to splash/login
      router.replace('/(auth)/splash');
    } else if (token && inAuthGroup) {
      // User is authenticated, redirect to main tabs
      router.replace('/(tabs)');
    }
  }, [token, segments, isReady]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="partner" options={{ presentation: 'card', headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationGuard />
    </QueryClientProvider>
  );
}
