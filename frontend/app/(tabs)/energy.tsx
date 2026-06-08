import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import apiClient from '../../utils/api';
import { useMoodStore } from '../../stores/moodStore';
import { useAuthStore } from '../../stores/authStore';

const { width } = Dimensions.get('window');

interface PillarData {
  percentage: number;
  current: number;
  goal: number;
  unit: string;
}

interface EnergyData {
  energyScore: number;
  water: PillarData;
  workout: PillarData;
  sleep: PillarData;
}

export default function EnergyScreen() {
  const token = useAuthStore(state => state.token);
  const { correlation, history, fetchCorrelation, fetchMoodHistory } = useMoodStore();
  const [energyData, setEnergyData] = useState<EnergyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/api/analytics/energy/today');
      setEnergyData(response.data);
      await Promise.all([
        fetchCorrelation(),
        fetchMoodHistory(14),
      ]);
    } catch (e) {
      console.warn('Error fetching energy analytics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  if (!token) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  if (isLoading || !energyData) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const score = energyData.energyScore;
  
  // Grade label logic
  let gradeLabel = 'RECHARGE';
  let gradeColor = COLORS.red;
  if (score >= 90) {
    gradeLabel = 'PEAK PERFORMANCE';
    gradeColor = COLORS.green;
  } else if (score >= 70) {
    gradeLabel = 'STRONG';
    gradeColor = COLORS.cyan;
  } else if (score >= 50) {
    gradeLabel = 'AVERAGE';
    gradeColor = COLORS.yellow;
  }

  // SVG parameters for 180px circular gauge
  const radius = 76;
  const circ = 2 * Math.PI * radius;
  const strokeDashoffset = circ - (score / 100) * circ;

  const moodEmojis = ['😩', '😟', '😐', '🙂', '🤩'];
  const moodColors = [COLORS.red, '#fb923c', COLORS.yellow, COLORS.green, COLORS.cyan];

  // Insufficient data lock check (needs 3+ mood log days)
  const isCorrelationLocked = history.length < 3;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 180px BIG GAUGE RING */}
      <View style={styles.gaugeCard}>
        <Text style={styles.gaugeHeader}>ENERGY SCORE</Text>
        <View style={styles.gaugeWrapper}>
          <Svg width="180" height="180" viewBox="0 0 180 180">
            <Circle cx="90" cy="90" r={radius} stroke={COLORS.border} strokeWidth="8" fill="none" />
            <Circle
              cx="90"
              cy="90"
              r={radius}
              stroke={gradeColor}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
          </Svg>
          <View style={styles.gaugeTextWrapper}>
            <Text style={[styles.gaugeScoreText, { color: gradeColor }]}>{score}</Text>
            <Text style={[styles.gradeText, { color: gradeColor }]}>{gradeLabel}</Text>
          </View>
        </View>
      </View>

      {/* THREE PILLAR CARDS */}
      <View style={styles.pillarsRow}>
        {/* Hydration Card */}
        <View style={[styles.pillarCard, { borderTopColor: COLORS.cyan }]}>
          <Text style={styles.pillarEmoji}>💧</Text>
          <Text style={styles.pillarTitle}>HYDRATION</Text>
          <Text style={styles.pillarVal}>
            {energyData.water.current}/{energyData.water.goal} L
          </Text>
          <Text style={[styles.pillarPct, { color: COLORS.cyan }]}>{energyData.water.percentage}%</Text>
          <View style={styles.miniBarBg}>
            <View style={[styles.miniBarFill, { width: `${energyData.water.percentage}%`, backgroundColor: COLORS.cyan }]} />
          </View>
        </View>

        {/* Movement Card */}
        <View style={[styles.pillarCard, { borderTopColor: COLORS.red }]}>
          <Text style={styles.pillarEmoji}>🏋️</Text>
          <Text style={styles.pillarTitle}>MOVEMENT</Text>
          <Text style={styles.pillarVal}>
            {energyData.workout.current}/{energyData.workout.goal} hr
          </Text>
          <Text style={[styles.pillarPct, { color: COLORS.red }]}>{energyData.workout.percentage}%</Text>
          <View style={styles.miniBarBg}>
            <View style={[styles.miniBarFill, { width: `${energyData.workout.percentage}%`, backgroundColor: COLORS.red }]} />
          </View>
        </View>

        {/* Sleep Card */}
        <View style={[styles.pillarCard, { borderTopColor: COLORS.purple }]}>
          <Text style={styles.pillarEmoji}>😴</Text>
          <Text style={styles.pillarTitle}>REST</Text>
          <Text style={styles.pillarVal}>
            {energyData.sleep.current}/{energyData.sleep.goal} hr
          </Text>
          <Text style={[styles.pillarPct, { color: COLORS.purple }]}>{energyData.sleep.percentage}%</Text>
          <View style={styles.miniBarBg}>
            <View style={[styles.miniBarFill, { width: `${energyData.sleep.percentage}%`, backgroundColor: COLORS.purple }]} />
          </View>
        </View>
      </View>

      {/* MOOD x HABIT CORRELATION CHART */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>MOOD × HABIT CORRELATION</Text>
        
        {isCorrelationLocked ? (
          <View style={styles.lockOverlayContainer}>
            <Text style={styles.lockEmoji}>🔒</Text>
            <Text style={styles.lockText}>Log mood for 3+ days to unlock correlation insights</Text>
            <Text style={styles.lockSubtext}>Currently logged: {history.length} days</Text>
          </View>
        ) : (
          <View style={styles.barChartContainer}>
            {correlation.map((item, idx) => {
              const heightPct = Math.max(8, (item.avgMood / 4) * 100);
              const moodColor = moodColors[Math.round(item.avgMood)];
              const roundedMood = Math.round(item.avgMood);
              const emoji = moodEmojis[roundedMood >= 0 && roundedMood <= 4 ? roundedMood : 2];

              return (
                <View key={idx} style={styles.barWrapper}>
                  <View style={styles.barTopLabelWrapper}>
                    <Text style={styles.barTopText}>{item.avgMood.toFixed(1)}</Text>
                  </View>
                  <View style={styles.barChartTrack}>
                    <View style={[styles.barChartFill, { height: `${heightPct}%`, backgroundColor: moodColor }]} />
                  </View>
                  <Text style={styles.barEmojiLabel}>{emoji}</Text>
                  <Text style={styles.barBucketLabel}>{item.bucket}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 14-DAY MOOD TIMELINE */}
      <View style={styles.timelineCard}>
        <Text style={styles.chartTitle}>14-DAY MIND TIMELINE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
          {history.map((log, idx) => {
            const formattedDate = new Date(log.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            return (
              <View key={log.id || idx} style={styles.timelineItem}>
                <Text style={styles.timelineDate}>{formattedDate}</Text>
                <Text style={styles.timelineEmoji}>{moodEmojis[log.mood]}</Text>
                <View style={styles.timelineHabitTrack}>
                  <View style={[styles.timelineHabitFill, { width: `${log.habit_pct}%` }]} />
                </View>
                <Text style={styles.timelinePctText}>{log.habit_pct}%</Text>
              </View>
            );
          })}
          {history.length === 0 && (
            <Text style={styles.emptyTimelineText}>No logged mood logs found. Log your mood on the Today screen.</Text>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  gaugeHeader: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginBottom: 16,
  },
  gaugeWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeScoreText: {
    ...TYPOGRAPHY.heading,
    fontSize: 40,
    lineHeight: 44,
  },
  gradeText: {
    ...TYPOGRAPHY.heading,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 4,
  },
  pillarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pillarCard: {
    width: '31%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 4,
    padding: 10,
    alignItems: 'center',
  },
  pillarEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  pillarTitle: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pillarVal: {
    ...TYPOGRAPHY.heading,
    fontSize: 10,
    color: COLORS.text,
  },
  pillarPct: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    marginTop: 4,
  },
  miniBarBg: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 1.5,
    width: '100%',
    marginTop: 8,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  lockOverlayContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  lockEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  lockText: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockSubtext: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  barChartContainer: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barTopLabelWrapper: {
    marginBottom: 6,
  },
  barTopText: {
    ...TYPOGRAPHY.heading,
    fontSize: 10,
    color: COLORS.text,
  },
  barChartTrack: {
    height: 80,
    width: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  barChartFill: {
    width: '100%',
    borderRadius: 3,
  },
  barEmojiLabel: {
    fontSize: 16,
    marginTop: 6,
  },
  barBucketLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: 'bold',
  },
  timelineCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  timelineScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  timelineItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
  },
  timelineDate: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  timelineEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  timelineHabitTrack: {
    height: 3,
    width: '100%',
    backgroundColor: COLORS.border,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  timelineHabitFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 1.5,
  },
  timelinePctText: {
    ...TYPOGRAPHY.heading,
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyTimelineText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 10,
  },
});
