import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';

export default function SplashScreen() {
  const router = useRouter();
  const token = useAuthStore(state => state.token);
  
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    // Start animations
    opacity.value = withTiming(1, { duration: 1000 });
    scale.value = withTiming(1, { duration: 1000 });

    const init = async () => {
      // Small artificial delay to allow animation to show
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/onboarding');
      }
    };

    init();
  }, [token]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        <Text style={styles.logoText}>DISCIPLINE OS</Text>
        <Text style={styles.tagline}>THE 1% RULE · NO EXCUSES</Text>
        <ActivityIndicator size="small" color={COLORS.green} style={styles.loader} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoText: {
    ...TYPOGRAPHY.heading,
    fontSize: 36,
    color: COLORS.green,
    letterSpacing: 2,
    marginBottom: 8,
  },
  tagline: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 4,
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
});
