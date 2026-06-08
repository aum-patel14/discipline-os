import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore } from '../../stores/habitStore';
import { useProgressStore, ProgressItem } from '../../stores/progressStore';
import { useChallengeStore } from '../../stores/challengeStore';
import { useMoodStore } from '../../stores/moodStore';
import apiClient from '../../utils/api';

// Helper to get local date string (YYYY-MM-DD)
const getLocalDateStr = (timezone: string) => {
  const tz = timezone || 'UTC';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

export default function TodayScreen() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  
  // Stores
  const { todayProgress, fetchTodayProgress, logProgress, toggleProgress, isLoading: progressLoading } = useProgressStore();
  const { challenge, fetchCurrentChallenge, markDay } = useChallengeStore();
  const { todayMood, logMood, fetchTodayMood } = useMoodStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ hours: '00', minutes: '00', seconds: '00' });
  const [energyScore, setEnergyScore] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [partnersProgress, setPartnersProgress] = useState<any[]>([]);

  const localDateStr = getLocalDateStr(user?.timezone || 'UTC');

  // Load screen data
  const loadData = async () => {
    try {
      await Promise.all([
        fetchTodayProgress(),
        fetchCurrentChallenge(),
        fetchTodayMood(),
        loadStreakAndEnergy(),
        loadPartnerStatus(),
      ]);
    } catch (err) {
      console.error('Error loading Today data:', err);
    }
  };

  const loadStreakAndEnergy = async () => {
    try {
      const [energyRes, streakRes] = await Promise.all([
        apiClient.get('/api/analytics/energy/today'),
        apiClient.get('/api/analytics/streak'),
      ]);
      setEnergyScore(energyRes.data.energyScore);
      setStreakCount(streakRes.data.currentStreak);
    } catch (e) {
      console.warn('Error loading analytics for today screen:', e);
    }
  };

  const loadPartnerStatus = async () => {
    try {
      const partnersRes = await apiClient.get('/api/partners/list');
      const activePartners = partnersRes.data.filter((p: any) => p.status === 'active');
      
      const detailsList = [];
      for (const partner of activePartners) {
        try {
          const progressRes = await apiClient.get(`/api/partners/${partner.user.id}/progress`);
          detailsList.push({
            ...partner.user,
            is_locked: progressRes.data.is_locked,
            score: progressRes.data.today_score_pct
          });
        } catch {}
      }
      setPartnersProgress(detailsList);
    } catch (e) {
      console.warn('Error loading partner status:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Countdown timer effect
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      
      // Calculate local midnight
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      
      const diffMs = midnight.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeRemaining({ hours: '00', minutes: '00', seconds: '00' });
        // Auto-refresh today's list on midnight rollover
        if (token) {
          loadData();
        }
        return;
      }
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      setTimeRemaining({
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0')
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [token]);

  // Run on mount
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Split Hero vs Villain habits
  const heroHabits = todayProgress.filter(h => !h.is_villain);
  const villainHabits = todayProgress.filter(h => h.is_villain);

  // Challenge computations
  const totalActiveHabits = todayProgress.length;
  const completedHabitsCount = todayProgress.filter(h => h.completed).length;
  const dailyScorePct = totalActiveHabits > 0 ? Math.round((completedHabitsCount / totalActiveHabits) * 100) : 0;
  
  const allHabitsCompleted = totalActiveHabits > 0 && completedHabitsCount === totalActiveHabits;
  const isChallengeLockedToday = challenge ? challenge.last_marked_date === localDateStr : false;

  const handleLockDay = async () => {
    try {
      await markDay();
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to lock day.');
    }
  };

  // SVG parameters for 50px energy ring
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (energyScore / 100) * ringCircumference;
  const ringColor = energyScore >= 70 ? COLORS.green : energyScore >= 35 ? COLORS.yellow : COLORS.red;

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top thin green challenge progress bar */}
      {challenge && challenge.active && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${(challenge.current_day / challenge.total_days) * 100}%` }]} />
        </View>
      )}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.green} />}
      >
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </Text>
            {/* Live Countdown */}
            <Text style={styles.countdownText}>
              {timeRemaining.hours}:{timeRemaining.minutes}:{timeRemaining.seconds}
            </Text>
            <Text style={styles.countdownLabel}>UNTIL RESET</Text>
          </View>

          <View style={styles.headerRight}>
            {/* Compounding Growth badge */}
            {challenge && challenge.active && (
              <View style={styles.growthBadge}>
                <Text style={styles.growthBadgeText}>+{challenge.growth_pct}%</Text>
              </View>
            )}

            {/* Energy Score Ring */}
            <View style={styles.energyRingContainer}>
              <Svg width="50" height="50" viewBox="0 0 50 50">
                <Circle cx="25" cy="25" r={ringRadius} stroke={COLORS.border} strokeWidth="3" fill="none" />
                <Circle
                  cx="25"
                  cy="25"
                  r={ringRadius}
                  stroke={ringColor}
                  strokeWidth="3.5"
                  fill="none"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 25 25)"
                />
              </Svg>
              <View style={styles.energyScoreTextWrapper}>
                <Text style={styles.energyScoreText}>{energyScore}</Text>
                <Text style={styles.energyScoreLabel}>NRG</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SUMMARY STRIP */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{completedHabitsCount}/{totalActiveHabits}</Text>
            <Text style={styles.summaryLabel}>HABITS</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{dailyScorePct}%</Text>
            <Text style={styles.summaryLabel}>DAILY SCORE</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>🛡️ {challenge ? challenge.shields : 0}</Text>
            <Text style={styles.summaryLabel}>SHIELDS</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>🔥 {streakCount}</Text>
            <Text style={styles.summaryLabel}>STREAK</Text>
          </View>
        </View>

        {/* MOOD PICKER */}
        <View style={styles.cardContainer}>
          <Text style={styles.sectionTitle}>STATE OF MIND</Text>
          <View style={styles.moodRow}>
            {['😩', '😟', '😐', '🙂', '🤩'].map((emoji, index) => {
              const isActive = todayMood !== null && todayMood.mood === index;
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.moodBtn, isActive && styles.moodBtnActive]} 
                  onPress={() => logMood(index, localDateStr)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.moodEmoji, isActive && styles.moodEmojiActive]}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* HERO HABITS SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>HERO HABITS 🦸</Text>
        </View>
        
        {heroHabits.map((habit) => (
          <HabitCard key={habit.habit_id} habit={habit} date={localDateStr} onLog={logProgress} onToggle={toggleProgress} />
        ))}

        {/* VILLAIN HABITS SECTION */}
        {villainHabits.length > 0 && (
          <View style={styles.villainSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: COLORS.purple }]}>VILLAIN HABITS 🦹</Text>
            </View>
            {villainHabits.map((habit) => (
              <HabitCard key={habit.habit_id} habit={habit} date={localDateStr} onLog={logProgress} onToggle={toggleProgress} isVillainSection />
            ))}
          </View>
        )}

        {/* PARTNER LOCK STATUS AVATARS */}
        {partnersProgress.length > 0 && (
          <View style={styles.partnersStrip}>
            <Text style={styles.partnersTitle}>ACCOUNTABILITY WATCH</Text>
            <View style={styles.partnersList}>
              {partnersProgress.map((partner, idx) => (
                <View key={idx} style={styles.partnerAvatarCard}>
                  <View style={[styles.partnerAvatar, partner.is_locked ? styles.partnerLockedGlow : styles.partnerUnlockedBorder]}>
                    <Text style={styles.partnerAvatarText}>{partner.username.substring(0,2).toUpperCase()}</Text>
                    {partner.is_locked && (
                      <View style={styles.partnerCheck}>
                        <Text style={styles.partnerCheckText}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.partnerNameText} numberOfLines={1}>{partner.username}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CHALLENGE LOCK BOX */}
        {challenge && challenge.active ? (
          <View style={styles.lockBoxContainer}>
            {isChallengeLockedToday ? (
              <View style={[styles.lockButton, styles.lockButtonSuccess]}>
                <Text style={styles.lockButtonTextSuccess}>TODAY LOCKED ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.lockButton, 
                  allHabitsCompleted ? styles.lockButtonActive : styles.lockButtonDisabled
                ]}
                disabled={!allHabitsCompleted}
                onPress={handleLockDay}
                activeOpacity={0.8}
              >
                <Text style={styles.lockButtonText}>
                  {allHabitsCompleted ? `LOCK DAY ${challenge.current_day}` : 'COMPLETE ALL HABITS TO LOCK DAY'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.lockBoxContainer}>
            <TouchableOpacity 
              style={[styles.lockButton, styles.lockButtonActive, { backgroundColor: COLORS.yellow }]}
              onPress={() => router.push('/(tabs)/challenge')}
            >
              <Text style={[styles.lockButtonText, { color: '#000000' }]}>START 21-DAY HARD CHALLENGE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FOOTER NOTE */}
        <Text style={styles.footerNote}>
          Auto-resets midnight · Miss day = Day 1 · +1% per perfect day.
        </Text>
      </ScrollView>
    </View>
  );
}

// INNER HABIT CARD COMPONENT (Handles local values and debounced logging)
interface HabitCardProps {
  habit: ProgressItem;
  date: string;
  onLog: (habitId: string, date: string, value: number) => Promise<any>;
  onToggle: (habitId: string, date: string) => Promise<any>;
  isVillainSection?: boolean;
}

function HabitCard({ habit, date, onLog, onToggle, isVillainSection }: HabitCardProps) {
  const [localVal, setLocalVal] = useState(habit.value);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync with store when habit props update
  useEffect(() => {
    setLocalVal(habit.value);
  }, [habit.value]);

  const triggerDebouncedLog = (nextVal: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      onLog(habit.habit_id, date, nextVal).catch(() => {
        // Rollback on fail
        setLocalVal(habit.value);
      });
    }, 300);
  };

  const handleIncrement = () => {
    const nextVal = Math.min(999, localVal + habit.step_size);
    setLocalVal(nextVal);
    triggerDebouncedLog(nextVal);
  };

  const handleDecrement = () => {
    const nextVal = Math.max(0, localVal - habit.step_size);
    setLocalVal(nextVal);
    triggerDebouncedLog(nextVal);
  };

  const handleToggle = () => {
    onToggle(habit.habit_id, date);
  };

  const percentage = habit.current_goal > 0 ? Math.min(100, Math.round((localVal / habit.current_goal) * 100)) : 0;
  
  // Reanimated style for progress bar
  const progressStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${percentage}%`, { duration: 250 }),
      backgroundColor: habit.color,
    };
  });

  return (
    <View style={[
      styles.habitCard, 
      isVillainSection ? styles.villainCardBorder : styles.standardCardBorder
    ]}>
      <View style={styles.habitMainRow}>
        {/* Toggle Box */}
        <TouchableOpacity 
          style={[styles.emojiBox, { backgroundColor: `${habit.color}15` }]} 
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <Text style={styles.habitEmoji}>{habit.emoji}</Text>
          {habit.completed && (
            <View style={[styles.checkBadge, { backgroundColor: COLORS.green }]}>
              <Text style={styles.checkBadgeText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Habit Info */}
        <View style={styles.habitInfoWrapper}>
          <Text style={styles.habitName}>{habit.name}</Text>
          <Text style={styles.habitGoalText}>
            {Number(localVal.toFixed(2))}/{habit.current_goal} {habit.unit}
          </Text>
        </View>

        {/* Adjuster controls */}
        {habit.unit.toLowerCase() !== 'day' ? (
          <View style={styles.adjusterRow}>
            <TouchableOpacity style={styles.adjustBtn} onPress={handleDecrement}>
              <Text style={styles.adjustBtnText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adjustBtn} onPress={handleIncrement}>
              <Text style={styles.adjustBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.checkboxBtn, habit.completed && { borderColor: COLORS.green }]} 
            onPress={handleToggle}
          >
            {habit.completed && <Text style={{ color: COLORS.green, fontWeight: 'bold' }}>✓</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      {habit.unit.toLowerCase() !== 'day' && (
        <View style={styles.progressBarTrack}>
          <Animated.View style={[styles.progressBarFillInner, progressStyle]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressBarBg: {
    height: 3,
    width: '100%',
    backgroundColor: COLORS.border,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.green,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  headerLeft: {
    flex: 1,
  },
  dateText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
  },
  countdownText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    fontSize: 24,
    marginTop: 4,
  },
  countdownLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  growthBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
  },
  growthBadgeText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 12,
  },
  energyRingContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  energyScoreTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  energyScoreText: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 14,
  },
  energyScoreLabel: {
    fontSize: 7,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryVal: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: COLORS.text,
  },
  summaryLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  moodBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moodBtnActive: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  moodEmoji: {
    fontSize: 22,
    opacity: 0.5,
  },
  moodEmojiActive: {
    opacity: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    marginBottom: 10,
    marginTop: 10,
  },
  sectionHeading: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: COLORS.green,
    letterSpacing: 1.5,
  },
  habitCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  standardCardBorder: {
    borderColor: COLORS.border,
  },
  villainCardBorder: {
    borderColor: 'rgba(232, 121, 249, 0.4)', // Villain border
  },
  habitMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  habitEmoji: {
    fontSize: 22,
  },
  checkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  checkBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  habitInfoWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  habitName: {
    ...TYPOGRAPHY.heading,
    fontSize: 15,
    color: COLORS.text,
  },
  habitGoalText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  adjusterRow: {
    flexDirection: 'row',
  },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  adjustBtnText: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  checkboxBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFillInner: {
    height: '100%',
    borderRadius: 2,
  },
  villainSection: {
    marginTop: 15,
    paddingTop: 10,
  },
  partnersStrip: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 15,
    marginBottom: 20,
  },
  partnersTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  partnersList: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  partnerAvatarCard: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1.5,
  },
  partnerLockedGlow: {
    borderColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  partnerUnlockedBorder: {
    borderColor: COLORS.border,
  },
  partnerAvatarText: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.text,
  },
  partnerCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerCheckText: {
    fontSize: 8,
    color: '#000',
    fontWeight: 'bold',
  },
  partnerNameText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
    width: 60,
    textAlign: 'center',
  },
  lockBoxContainer: {
    marginTop: 15,
  },
  lockButton: {
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButtonActive: {
    backgroundColor: COLORS.green,
  },
  lockButtonDisabled: {
    backgroundColor: COLORS.disabled,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lockButtonSuccess: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderWidth: 1.5,
    borderColor: COLORS.green,
  },
  lockButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  lockButtonTextSuccess: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 14,
    letterSpacing: 2,
  },
  footerNote: {
    ...TYPOGRAPHY.body,
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.5,
  },
});
