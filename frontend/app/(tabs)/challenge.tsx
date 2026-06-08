import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, AppState, ActivityIndicator, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useChallengeStore, ChallengeDay } from '../../stores/challengeStore';
import { useAuthStore } from '../../stores/authStore';

export default function ChallengeScreen() {
  const token = useAuthStore(state => state.token);
  const { challenge, fetchCurrentChallenge, startChallenge, resetChallenge, isLoading } = useChallengeStore();
  const [appState, setAppState] = useState(AppState.currentState);

  // AppState listener for auto-refreshing challenge on app foreground
  useEffect(() => {
    if (token) {
      fetchCurrentChallenge();
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        if (token) {
          fetchCurrentChallenge();
        }
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [token]);

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const handleStart = async () => {
    try {
      await startChallenge();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start challenge.');
    }
  };

  const handleReset = () => {
    Alert.alert(
      'RESET CHALLENGE',
      'Are you sure you want to quit this challenge? All daily compound progress will be lost and goals will reset to base values.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'YES, QUIT', 
          style: 'destructive',
          onPress: async () => {
            try {
              await resetChallenge();
              fetchCurrentChallenge();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to reset challenge.');
            }
          }
        }
      ]
    );
  };

  if (isLoading && !challenge) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  // 1. START CHALLENGE SCREEN (No active challenge)
  if (!challenge || !challenge.active) {
    return (
      <ScrollView contentContainerStyle={styles.containerStart}>
        <Text style={styles.fireEmoji}>🔥</Text>
        <Text style={styles.mainTitle}>21-DAY HARD CHALLENGE</Text>
        <Text style={styles.subtitle}>ELIMINATE WEAKNESS. BUILD ABSOLUTE DISCIPLINE.</Text>
        
        {/* 2x2 Feature Grid */}
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Text style={styles.featureEmoji}>🛡️</Text>
            <Text style={styles.featureTitle}>SHIELDS</Text>
            <Text style={styles.featureText}>Earn 1 shield every 7 perfect days. Protects streak if you miss a rollover.</Text>
          </View>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureEmoji}>📈</Text>
            <Text style={styles.featureTitle}>1% RULE</Text>
            <Text style={styles.featureText}>Active habit goals compound by +1% daily on lock. Exponential growth.</Text>
          </View>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureEmoji}>📅</Text>
            <Text style={styles.featureTitle}>CALENDAR</Text>
            <Text style={styles.featureText}>Every day tracked. No skips. Miss a day without a shield, go back to Day 1.</Text>
          </View>
          
          <View style={styles.featureCard}>
            <Text style={styles.featureEmoji}>🧠</Text>
            <Text style={styles.featureTitle}>INSIGHTS</Text>
            <Text style={styles.featureText}>Syncs daily mood against habit logs to reveal performance patterns.</Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.8}>
          <Text style={styles.startButtonText}>BEGIN DAY 1</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // 2. COMPLETED CHALLENGE SCREEN
  if (challenge.completed) {
    return (
      <ScrollView contentContainerStyle={styles.containerStart}>
        <Text style={styles.trophyEmoji}>🏆</Text>
        <Text style={[styles.mainTitle, { color: COLORS.yellow }]}>YOU DID IT.</Text>
        <Text style={styles.subtitle}>21 DAYS OF UNBROKEN DISCIPLINE</Text>
        
        {/* Completed Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>+{challenge.growth_pct}%</Text>
            <Text style={styles.statLabel}>GOALS GROWN</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{challenge.perfect_days}</Text>
            <Text style={styles.statLabel}>PERFECT DAYS</Text>
          </View>
        </View>

        {/* Full 21-cell completed grid */}
        <View style={styles.completedGridTitleWrapper}>
          <Text style={styles.completedGridTitle}>DISCIPLINE MAP</Text>
        </View>
        <View style={styles.grid21}>
          {Array.from({ length: 21 }).map((_, index) => (
            <View key={index} style={[styles.gridCell21, styles.gridCell21Done]}>
              <Text style={[styles.gridCellText, { color: '#000' }]}>✓</Text>
            </View>
          ))}
        </View>

        {/* Start Again Button */}
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.8}>
          <Text style={styles.startButtonText}>START NEW CHALLENGE</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // 3. ACTIVE CHALLENGE SCREEN
  const daysRemaining = 21 - challenge.current_day + 1;
  const ringRadius = 38;
  const circ = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circ - (challenge.current_day / 21) * circ;

  // Render 21 cells
  const challengeDaysList = challenge.days || [];

  return (
    <ScrollView contentContainerStyle={styles.containerActive}>
      {/* Warning Banner if yesterday missed but not rolled over yet */}
      {challenge.last_marked_date === null && challenge.current_day > 1 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={16} color={COLORS.yellow} style={{ marginRight: 8 }} />
          <Text style={styles.warningText}>Complete all habits today to lock in Day {challenge.current_day}!</Text>
        </View>
      )}

      {/* Day and remaining count */}
      <View style={styles.activeHeader}>
        <View>
          <Text style={styles.activeTitle}>DAY {challenge.current_day} / 21</Text>
          <Text style={styles.daysRemainingText}>{daysRemaining} DAYS REMAINING</Text>
        </View>

        {/* Large SVG ring (86px) */}
        <View style={styles.progressRingContainer}>
          <Svg width="86" height="86" viewBox="0 0 86 86">
            <Circle cx="43" cy="43" r={ringRadius} stroke={COLORS.border} strokeWidth="5" fill="none" />
            <Circle
              cx="43"
              cy="43"
              r={ringRadius}
              stroke={COLORS.yellow}
              strokeWidth="5"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 43 43)"
            />
          </Svg>
          <View style={styles.progressRingTextWrapper}>
            <Text style={styles.progressPercent}>{Math.round((challenge.current_day / 21) * 100)}%</Text>
          </View>
        </View>
      </View>

      {/* Badges row */}
      <View style={styles.badgesRow}>
        <View style={styles.badgeItem}>
          <Text style={styles.badgeLabel}>SHIELDS</Text>
          <Text style={styles.badgeValue}>🛡️ × {challenge.shields}</Text>
        </View>
        <View style={styles.badgeItem}>
          <Text style={styles.badgeLabel}>COMPOUND GROWTH</Text>
          <Text style={styles.badgeValue}>📈 +{challenge.growth_pct}%</Text>
        </View>
      </View>

      {/* 21-cell Grid (7 columns x 3 rows) */}
      <View style={styles.grid21Container}>
        <Text style={styles.grid21Header}>CHALLENGE GRID MAP</Text>
        <View style={styles.grid21}>
          {Array.from({ length: 21 }).map((_, index) => {
            const dayNum = index + 1;
            const isCompleted = dayNum < challenge.current_day;
            const isCurrent = dayNum === challenge.current_day;
            const isFuture = dayNum > challenge.current_day;
            
            // Check challenge day status
            const dayDetails = challengeDaysList.find((d: ChallengeDay) => d.day_number === dayNum);
            
            let cellStyle = styles.gridCell21Future;
            let label = String(dayNum);
            let textStyle = styles.gridCellTextFuture;

            if (isCompleted) {
              if (dayDetails?.status === 'skipped') {
                cellStyle = styles.gridCell21Skipped;
                label = '🛡️';
                textStyle = styles.gridCellTextSkipped;
              } else {
                cellStyle = styles.gridCell21Done;
                label = '✓';
                textStyle = styles.gridCellTextDone;
              }
            } else if (isCurrent) {
              cellStyle = styles.gridCell21Current;
              label = '→';
              textStyle = styles.gridCellTextCurrent;
            }

            return (
              <View key={index} style={[styles.gridCell21, cellStyle]}>
                <Text style={[styles.gridCellText, textStyle]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Reset button */}
      <TouchableOpacity style={styles.resetButton} onPress={handleReset} activeOpacity={0.8}>
        <Text style={styles.resetButtonText}>RESET CHALLENGE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerStart: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  fireEmoji: {
    fontSize: 70,
    marginTop: 10,
    marginBottom: 20,
  },
  trophyEmoji: {
    fontSize: 70,
    marginTop: 10,
    marginBottom: 20,
  },
  mainTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    marginTop: 6,
    textAlign: 'center',
    marginBottom: 30,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  featureCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    minHeight: 140,
  },
  featureEmoji: {
    fontSize: 22,
    marginBottom: 8,
  },
  featureTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: COLORS.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  startButton: {
    backgroundColor: COLORS.green,
    height: 56,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  startButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 15,
    letterSpacing: 2,
  },
  containerActive: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.yellow,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  warningText: {
    ...TYPOGRAPHY.body,
    color: COLORS.yellow,
    fontSize: 12,
    flex: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  activeTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 22,
    color: COLORS.green,
  },
  daysRemainingText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: 4,
  },
  progressRingContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingTextWrapper: {
    position: 'absolute',
  },
  progressPercent: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  badgeItem: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    alignItems: 'center',
  },
  badgeLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  badgeValue: {
    ...TYPOGRAPHY.heading,
    fontSize: 15,
    color: COLORS.text,
  },
  grid21Container: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 30,
  },
  grid21Header: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  grid21: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridCell21: {
    width: '12.5%', // 7 cols + padding, roughly fits 7 or 8 cells per row
    aspectRatio: 1,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0.8%',
  },
  gridCell21Future: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    opacity: 0.3,
  },
  gridCell21Current: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)', // Cyan tint
    borderWidth: 1.5,
    borderColor: COLORS.cyan,
  },
  gridCell21Done: {
    backgroundColor: COLORS.green,
  },
  gridCell21Skipped: {
    backgroundColor: 'rgba(232, 121, 249, 0.2)', // Purple tint for shield used
    borderWidth: 1.5,
    borderColor: COLORS.purple,
  },
  gridCellText: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
  },
  gridCellTextFuture: {
    color: COLORS.textSecondary,
  },
  gridCellTextCurrent: {
    color: COLORS.cyan,
    fontWeight: 'bold',
  },
  gridCellTextDone: {
    color: '#000000',
    fontWeight: 'bold',
  },
  gridCellTextSkipped: {
    color: COLORS.purple,
  },
  resetButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.red,
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  resetButtonText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.red,
    fontSize: 13,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  completedGridTitleWrapper: {
    width: '100%',
    marginBottom: 10,
    alignItems: 'center',
  },
  completedGridTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
  },
});
