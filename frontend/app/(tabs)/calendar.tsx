import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';
import { useProgressStore, MonthDay } from '../../stores/progressStore';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

const { width, height } = Dimensions.get('window');

export default function CalendarScreen() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const { monthProgress, fetchMonthProgress, toggleProgress, isLoading } = useProgressStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayData, setSelectedDayData] = useState<MonthDay | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const yearStr = format(currentDate, 'yyyy');
  const monthStr = format(currentDate, 'MM');
  const cacheKey = `${yearStr}-${monthStr}`;
  const daysData = monthProgress[cacheKey] || [];

  useEffect(() => {
    if (token) {
      fetchMonthProgress(yearStr, monthStr);
    }
  }, [currentDate, token]);

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  // 1. Calculate Monthly Average Score
  const validDays = daysData.filter(d => d.daily_score > 0 || new Date(d.date) <= new Date());
  const monthlyScore = validDays.length > 0 
    ? Math.round(validDays.reduce((sum, d) => sum + d.daily_score, 0) / validDays.length) 
    : 0;

  // 2. 4 Mini Habit Stats (Days completed this month per habit)
  const habitCompletionCounts: { [key: string]: { name: string, emoji: string, count: number, color: string } } = {};
  daysData.forEach(day => {
    day.habits.forEach(h => {
      if (!habitCompletionCounts[h.habit_id]) {
        habitCompletionCounts[h.habit_id] = { name: h.name, emoji: h.emoji, count: 0, color: h.color };
      }
      if (h.completed) {
        habitCompletionCounts[h.habit_id].count += 1;
      }
    });
  });

  const topHabitIds = Object.keys(habitCompletionCounts).slice(0, 4);

  // 3. Grid Rendering Helpers
  const firstDayOfMonth = startOfMonth(currentDate);
  const blankDaysCount = firstDayOfMonth.getDay(); // Sunday = 0
  const daysInGrid: (MonthDay | null)[] = Array(blankDaysCount).fill(null);
  daysData.forEach(d => daysInGrid.push(d));

  // Chunk grid into weeks (7 days per row)
  const weeks: (MonthDay | null)[][] = [];
  let tempWeek: (MonthDay | null)[] = [];
  
  daysInGrid.forEach((day, index) => {
    tempWeek.push(day);
    if (tempWeek.length === 7 || index === daysInGrid.length - 1) {
      // Pad end of last week if needed
      while (tempWeek.length < 7) {
        tempWeek.push(null);
      }
      weeks.push(tempWeek);
      tempWeek = [];
    }
  });

  // 4. Calculate Weekly Scores
  const weeklyScores = weeks.map(week => {
    const activeDays = week.filter((d): d is MonthDay => d !== null && (d.daily_score > 0 || new Date(d.date) <= new Date()));
    if (activeDays.length === 0) return 0;
    const sum = activeDays.reduce((total, d) => total + d.daily_score, 0);
    return Math.round(sum / activeDays.length);
  });

  const handleDayTap = (day: MonthDay) => {
    setSelectedDayData(day);
    setShowBottomSheet(true);
  };

  const handleToggleHabitInSheet = async (habitId: string) => {
    if (!selectedDayData) return;
    try {
      await toggleProgress(habitId, selectedDayData.date);
      // Reload month progress
      await fetchMonthProgress(yearStr, monthStr);
      // Update local bottom sheet data
      const updatedDays = monthProgress[cacheKey] || [];
      const updatedDay = updatedDays.find(d => d.date === selectedDayData.date);
      if (updatedDay) {
        setSelectedDayData(updatedDay);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // SVGs rings parameters
  const ringRadiusLarge = 40;
  const circLarge = 2 * Math.PI * ringRadiusLarge;
  const offsetLarge = circLarge - (monthlyScore / 100) * circLarge;
  const ringColorLarge = monthlyScore >= 80 ? COLORS.green : monthlyScore >= 50 ? COLORS.yellow : COLORS.red;

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* MONTH HEADER */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={24} color={COLORS.green} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentDate, 'MMMM yyyy').toUpperCase()}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.green} />
          </TouchableOpacity>
        </View>

        {/* TOP MONTH STATS BLOCK */}
        <View style={styles.statsCard}>
          {/* Large Donut Ring */}
          <View style={styles.donutContainer}>
            <Svg width="96" height="96" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r={ringRadiusLarge} stroke={COLORS.border} strokeWidth="6" fill="none" />
              <Circle
                cx="50"
                cy="50"
                r={ringRadiusLarge}
                stroke={ringColorLarge}
                strokeWidth="7"
                fill="none"
                strokeDasharray={circLarge}
                strokeDashoffset={offsetLarge}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={styles.donutTextWrapper}>
              <Text style={styles.donutPercentage}>{monthlyScore}%</Text>
              <Text style={styles.donutLabel}>MONTHLY</Text>
            </View>
          </View>

          {/* 4 Mini Habit Completion Stats */}
          <View style={styles.miniStatsContainer}>
            {topHabitIds.map(id => {
              const habit = habitCompletionCounts[id];
              return (
                <View key={id} style={styles.miniStatBox}>
                  <Text style={styles.miniStatEmoji}>{habit.emoji}</Text>
                  <Text style={styles.miniStatCount}>{habit.count}d</Text>
                  <Text style={styles.miniStatLabel} numberOfLines={1}>{habit.name.toUpperCase()}</Text>
                </View>
              );
            })}
            {topHabitIds.length === 0 && (
              <Text style={styles.emptyStatsText}>No habit progress logs this month.</Text>
            )}
          </View>
        </View>

        {/* HABIT COLOR LEGEND DOTS */}
        <View style={styles.legendRow}>
          {topHabitIds.map(id => (
            <View key={id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: habitCompletionCounts[id].color }]} />
              <Text style={styles.legendText}>{habitCompletionCounts[id].emoji}</Text>
            </View>
          ))}
        </View>

        {/* 8-COLUMN GRID CALENDAR */}
        <View style={styles.calendarGrid}>
          {/* Day Headers: Su Mo Tu We Th Fr Sa Wk */}
          <View style={styles.gridHeaderRow}>
            {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'WK'].map((h, i) => (
              <Text key={i} style={[styles.gridHeaderCell, h === 'WK' && styles.weekHeaderCell]}>{h}</Text>
            ))}
          </View>

          {/* Grid Rows */}
          {isLoading && daysData.length === 0 ? (
            <ActivityIndicator size="large" color={COLORS.green} style={{ marginVertical: 40 }} />
          ) : (
            weeks.map((week, wIdx) => (
              <View key={wIdx} style={styles.gridRow}>
                {week.map((day, dIdx) => {
                  if (day === null) {
                    return <View key={dIdx} style={styles.gridCellEmpty} />;
                  }

                  const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
                  const isFuture = new Date(day.date) > new Date();
                  
                  // Score-based tint
                  let tintStyle = {};
                  if (!isFuture) {
                    if (day.daily_score >= 80) tintStyle = styles.cellGreenTint;
                    else if (day.daily_score >= 50) tintStyle = styles.cellYellowTint;
                  }

                  return (
                    <TouchableOpacity
                      key={dIdx}
                      style={[
                        styles.gridCell,
                        tintStyle,
                        isToday && styles.cellTodayGlow,
                        isFuture && { opacity: 0.3 }
                      ]}
                      disabled={isFuture}
                      onPress={() => handleDayTap(day)}
                    >
                      <Text style={styles.dayNumber}>{day.day_number}</Text>
                      
                      {/* Habit Dots row (max 4 dots) */}
                      <View style={styles.dotsRow}>
                        {day.habits.slice(0, 4).map((h, hIdx) => (
                          <View
                            key={hIdx}
                            style={[
                              styles.miniDot,
                              { backgroundColor: h.completed ? h.color : COLORS.border }
                            ]}
                          />
                        ))}
                      </View>

                      {/* Daily Score text */}
                      <Text style={styles.cellScoreText}>{day.daily_score}%</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* 8th Column: Week Score */}
                <View style={styles.weekScoreCell}>
                  <Svg width="24" height="24" viewBox="0 0 24 24">
                    <Circle cx="12" cy="12" r="10" stroke={COLORS.border} strokeWidth="2" fill="none" />
                    <Circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke={weeklyScores[wIdx] >= 80 ? COLORS.green : weeklyScores[wIdx] >= 50 ? COLORS.yellow : COLORS.red}
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 10}
                      strokeDashoffset={2 * Math.PI * 10 - (weeklyScores[wIdx] / 100) * 2 * Math.PI * 10}
                      transform="rotate(-90 12 12)"
                    />
                  </Svg>
                  <Text style={styles.weekScoreText}>{weeklyScores[wIdx]}%</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* DAILY SCORE BAR CHART */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>DAILY COMPLETION PROFILE</Text>
          <View style={styles.barChartContainer}>
            {daysData.map((day, idx) => {
              const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
              const barColor = isToday 
                ? COLORS.cyan 
                : day.daily_score >= 80 
                  ? COLORS.green 
                  : day.daily_score >= 50 
                    ? COLORS.yellow 
                    : COLORS.red;

              return (
                <View key={idx} style={styles.barWrapper}>
                  <View 
                    style={[
                      styles.barFill, 
                      { 
                        height: `${Math.max(4, day.daily_score)}%`, 
                        backgroundColor: barColor 
                      }
                    ]} 
                  />
                  <Text style={styles.barLabel}>{day.day_number}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* WEEKLY DONUT RINGS ROW */}
        <View style={styles.weeklyDonutsCard}>
          <Text style={styles.chartTitle}>WEEKLY AVERAGES</Text>
          <View style={styles.donutsRow}>
            {weeklyScores.map((score, idx) => (
              <View key={idx} style={styles.weeklyDonutItem}>
                <Svg width="36" height="36" viewBox="0 0 36 36">
                  <Circle cx="18" cy="18" r="14" stroke={COLORS.border} strokeWidth="3" fill="none" />
                  <Circle
                    cx="18"
                    cy="18"
                    r="14"
                    stroke={score >= 80 ? COLORS.green : score >= 50 ? COLORS.yellow : COLORS.red}
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={2 * Math.PI * 14}
                    strokeDashoffset={2 * Math.PI * 14 - (score / 100) * 2 * Math.PI * 14}
                    transform="rotate(-90 18 18)"
                  />
                </Svg>
                <Text style={styles.weeklyDonutPct}>{score}%</Text>
                <Text style={styles.weeklyDonutLabel}>WK {idx + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* CUSTOM ANIMATED BOTTOM SHEET DETAILED DRAWER */}
      {showBottomSheet && selectedDayData && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={() => setShowBottomSheet(false)}
          />
          <Animated.View 
            entering={SlideInDown.duration(300)} 
            exiting={SlideOutDown.duration(300)} 
            style={styles.sheetContainer}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />
            
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {format(parseISO(selectedDayData.date), 'EEEE, MMMM d').toUpperCase()}
              </Text>
              <Text style={styles.sheetSubtitle}>DAILY SCORE: {selectedDayData.daily_score}%</Text>
            </View>

            {/* List of habits */}
            <ScrollView style={styles.sheetScroll}>
              {selectedDayData.habits.map((habit) => (
                <View key={habit.habit_id} style={styles.sheetHabitRow}>
                  <Text style={styles.sheetHabitEmoji}>{habit.emoji}</Text>
                  <View style={styles.sheetHabitInfo}>
                    <Text style={styles.sheetHabitName}>{habit.name}</Text>
                    {/* Mini progress bar track */}
                    <View style={styles.sheetProgressBarTrack}>
                      <View 
                        style={[
                          styles.sheetProgressBarFill, 
                          { 
                            width: habit.completed ? '100%' : '10%',
                            backgroundColor: habit.color 
                          }
                        ]} 
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sheetToggleBtn,
                      habit.completed ? { borderColor: COLORS.green, backgroundColor: 'rgba(0, 255, 136, 0.05)' } : { borderColor: COLORS.border }
                    ]}
                    onPress={() => handleToggleHabitInSheet(habit.habit_id)}
                  >
                    <Text style={[styles.sheetToggleText, { color: habit.completed ? COLORS.green : COLORS.textSecondary }]}>
                      {habit.completed ? 'DONE' : 'UNDONE'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  navArrow: {
    padding: 4,
  },
  monthTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    fontSize: 18,
    letterSpacing: 1,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  donutContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  donutTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutPercentage: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.text,
  },
  donutLabel: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  miniStatsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  miniStatBox: {
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  miniStatEmoji: {
    fontSize: 16,
  },
  miniStatCount: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.green,
    marginTop: 2,
  },
  miniStatLabel: {
    fontSize: 7,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  emptyStatsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
  },
  calendarGrid: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 20,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 8,
  },
  gridHeaderCell: {
    flex: 1,
    ...TYPOGRAPHY.heading,
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  weekHeaderCell: {
    color: COLORS.cyan,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 0.85,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  cellGreenTint: {
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  cellYellowTint: {
    backgroundColor: 'rgba(255, 214, 10, 0.05)',
    borderColor: 'rgba(255, 214, 10, 0.2)',
  },
  cellTodayGlow: {
    borderColor: COLORS.green,
    borderWidth: 1.5,
  },
  gridCellEmpty: {
    flex: 1,
    aspectRatio: 0.85,
  },
  dayNumber: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.text,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    height: 4,
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  cellScoreText: {
    fontSize: 7,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  weekScoreCell: {
    flex: 1,
    aspectRatio: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekScoreText: {
    ...TYPOGRAPHY.heading,
    fontSize: 8,
    color: COLORS.text,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  barChartContainer: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 1,
  },
  barFill: {
    width: '70%',
    borderRadius: 2,
  },
  barLabel: {
    fontSize: 7,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  weeklyDonutsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  donutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  weeklyDonutItem: {
    alignItems: 'center',
    position: 'relative',
  },
  weeklyDonutPct: {
    position: 'absolute',
    top: 10,
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weeklyDonutLabel: {
    ...TYPOGRAPHY.heading,
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheetContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    maxHeight: height * 0.7,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 15,
  },
  sheetTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: COLORS.green,
    letterSpacing: 1,
  },
  sheetSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  sheetScroll: {
    marginBottom: 20,
  },
  sheetHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sheetHabitEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  sheetHabitInfo: {
    flex: 1,
  },
  sheetHabitName: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
  },
  sheetProgressBarTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 1.5,
    marginTop: 8,
    overflow: 'hidden',
  },
  sheetProgressBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  sheetToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  sheetToggleText: {
    ...TYPOGRAPHY.heading,
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
