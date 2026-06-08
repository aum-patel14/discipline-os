import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🔥',
    title: '21-DAY CHALLENGE',
    description: 'Commit to 21 days of unbroken discipline. Miss a single day, and you reset back to Day 1. No exceptions.',
    accent: COLORS.red,
  },
  {
    emoji: '📈',
    title: 'THE 1% RULE',
    description: 'Every perfect day you lock in, all active habit goals compound by +1%. Push your limits incrementally every single day.',
    accent: COLORS.green,
  },
  {
    emoji: '🛡️',
    title: 'ACCOUNTABILITY',
    description: 'Earn shields every 7 perfect days to protect your streak. Connect with accountability partners to verify your progress.',
    accent: COLORS.cyan,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const { signup, login } = useAuthStore();

  const handleGuestLogin = async () => {
    setIsCreatingGuest(true);
    try {
      const randId = Math.random().toString(36).substring(2, 10);
      const guestEmail = `disciplineos.guest.${randId}@gmail.com`;
      const guestPassword = `GuestPassword_${randId}`;
      const guestUsername = `guest_${randId.substring(0, 5)}`;
      const guestFullName = `Guest Recruit`;

      // 1. Sign up guest in backend
      await signup(guestEmail, guestPassword, guestUsername, guestFullName);
      // 2. Log in guest
      await login(guestEmail, guestPassword);
      // 3. Go to dashboard
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to create guest session:', error);
      // Fallback: send them to login screen if background creation fails
      router.replace('/(auth)/login');
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const handleNextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <View style={styles.container}>
      {/* Slide Content */}
      <Animated.View 
        key={currentSlide} 
        entering={FadeInRight.duration(400)} 
        exiting={FadeOutLeft.duration(400)} 
        style={styles.slideContainer}
      >
        <Text style={[styles.emoji, { textShadowColor: slide.accent }]}>{slide.emoji}</Text>
        <Text style={[styles.title, { color: slide.accent }]}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </Animated.View>

      {/* Footer controls */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentSlide(index)}
              disabled={isCreatingGuest}
              style={[
                styles.dot,
                currentSlide === index ? [styles.activeDot, { backgroundColor: slide.accent }] : styles.inactiveDot
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: slide.accent }]} 
          onPress={handleGuestLogin}
          disabled={isCreatingGuest}
          activeOpacity={0.8}
        >
          {isCreatingGuest ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={styles.buttonText}>ENTER AS GUEST</Text>
          )}
        </TouchableOpacity>

        {/* Secondary Links Row */}
        <View style={styles.secondaryLinksRow}>
          {currentSlide < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity onPress={handleNextSlide} disabled={isCreatingGuest}>
                <Text style={styles.secondaryLinkText}>NEXT SLIDE</Text>
              </TouchableOpacity>
              <Text style={styles.separator}>|</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} disabled={isCreatingGuest}>
                <Text style={styles.secondaryLinkText}>LOG IN</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} disabled={isCreatingGuest}>
                <Text style={styles.secondaryLinkText}>LOG IN</Text>
              </TouchableOpacity>
              <Text style={styles.separator}>|</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')} disabled={isCreatingGuest}>
                <Text style={styles.secondaryLinkText}>SIGN UP</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 30,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  title: {
    ...TYPOGRAPHY.heading,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 20,
  },
  description: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: COLORS.border,
  },
  button: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: '#000000',
    letterSpacing: 2,
  },
  secondaryLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  secondaryLinkText: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    paddingHorizontal: 8,
  },
  separator: {
    color: COLORS.border,
    fontSize: 12,
  },
});
