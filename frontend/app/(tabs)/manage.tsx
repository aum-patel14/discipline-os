import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../../constants/Theme';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore, Habit } from '../../stores/habitStore';

const PRESET_EMOJIS = ['⏰', '🏋️', '💧', '📖', '🧘', '😴', '🚫', '📵', '🥗', '🚶', '💻', '🧠', '🍎', '🚬', '🍻', '📱'];
const PRESET_COLORS = ['#ffd60a', '#f43f5e', '#22d3ee', '#a78bfa', '#34d399', '#818cf8', '#fb923c', '#e879f9'];

export default function ManageScreen() {
  const { user, token, updateProfile } = useAuthStore();
  const { habits, fetchHabits, addHabit, deleteHabit, reorderHabits } = useHabitStore();

  const [villainMode, setVillainMode] = useState(user?.villain_mode || false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(PRESET_EMOJIS[0]);
  const [unit, setUnit] = useState('times');
  const [goal, setGoal] = useState('');
  const [stepSize, setStepSize] = useState('1');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isVillain, setIsVillain] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (token) {
      fetchHabits();
      if (user) {
        setVillainMode(user.villain_mode);
      }
    }
  }, [user, token]);

  if (!token) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  const handleToggleVillainMode = async () => {
    const nextVal = !villainMode;
    setVillainMode(nextVal);
    try {
      await updateProfile({ villain_mode: nextVal });
    } catch (e) {
      console.error('Failed to sync villain mode status:', e);
      setVillainMode(!nextVal); // Rollback
    }
  };

  const handleCreateHabit = async () => {
    if (!name || !goal || !stepSize || !unit) {
      Alert.alert('Error', 'Please fill in all the habit fields.');
      return;
    }

    setIsLoading(true);
    try {
      await addHabit({
        name,
        emoji,
        unit,
        base_goal: parseFloat(goal),
        step_size: parseFloat(stepSize),
        color,
        is_villain: isVillain,
      });

      // Clear Form
      setName('');
      setEmoji(PRESET_EMOJIS[0]);
      setUnit('times');
      setGoal('');
      setStepSize('1');
      setColor(PRESET_COLORS[0]);
      setIsVillain(false);
      setShowAddForm(false);

      Alert.alert('Success', 'New habit enlisted!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create habit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'DELETE HABIT',
      'Are you sure you want to permanently soft-delete this habit? All historic progress will be retained, but it will be removed from your tracker.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'DELETE', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHabit(id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete habit.');
            }
          }
        }
      ]
    );
  };

  const moveHabit = async (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= habits.length) return;

    const newOrder = [...habits];
    const temp = newOrder[index];
    newOrder[index] = newOrder[nextIndex];
    newOrder[nextIndex] = temp;

    const ids = newOrder.map(h => h.id);
    await reorderHabits(ids);
  };

  const activeAccent = villainMode ? COLORS.purple : COLORS.green;

  // Split into Hero vs Villain lists
  const heroes = habits.filter(h => !h.is_villain);
  const villains = habits.filter(h => h.is_villain);

  return (
    <View style={styles.container}>
      {/* HEADER WITH VILLAIN MODE TOGGLE */}
      <View style={[styles.headerStrip, { borderBottomColor: activeAccent }]}>
        <Text style={[styles.headerTitle, { color: activeAccent }]}>
          {villainMode ? 'VILLAIN MODE 🦹' : 'HERO MODE 🦸'}
        </Text>
        <View style={styles.toggleWrapper}>
          <Text style={styles.toggleLabel}>VILLAIN TRACKING</Text>
          <Switch
            value={villainMode}
            onValueChange={handleToggleVillainMode}
            trackColor={{ false: COLORS.border, true: COLORS.purple }}
            thumbColor={villainMode ? '#000000' : '#8e8e93'}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ADD HABIT BUTTON */}
        {!showAddForm && (
          <TouchableOpacity 
            style={[styles.addButton, { borderColor: activeAccent }]} 
            onPress={() => setShowAddForm(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={activeAccent} style={{ marginRight: 8 }} />
            <Text style={[styles.addButtonText, { color: activeAccent }]}>CREATE NEW HABIT</Text>
          </TouchableOpacity>
        )}

        {/* ADD HABIT FORM PANEL */}
        {showAddForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>NEW DISCIPLINE</Text>
              <TouchableOpacity onPress={() => setShowAddForm(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <Text style={styles.inputLabel}>HABIT NAME</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Read books"
              placeholderTextColor={COLORS.textSecondary}
              value={name}
              onChangeText={setName}
            />

            {/* Emojis Picker Grid */}
            <Text style={styles.inputLabel}>EMOJI ICON</Text>
            <View style={styles.emojiGrid}>
              {PRESET_EMOJIS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.emojiSelect, emoji === item && [styles.emojiSelectActive, { borderColor: activeAccent }]]}
                  onPress={() => setEmoji(item)}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Colors Palette */}
            <Text style={styles.inputLabel}>COLOR SPEC</Text>
            <View style={styles.colorPalette}>
              {PRESET_COLORS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.colorOption,
                    { backgroundColor: item },
                    color === item && styles.colorOptionActive
                  ]}
                  onPress={() => setColor(item)}
                />
              ))}
            </View>

            {/* Goal and Unit Fields */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldColumn, { marginRight: 12 }]}>
                <Text style={styles.inputLabel}>DAILY GOAL</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 20"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  value={goal}
                  onChangeText={setGoal}
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={styles.inputLabel}>UNIT OF MEASURE</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. pages"
                  placeholderTextColor={COLORS.textSecondary}
                  value={unit}
                  onChangeText={setUnit}
                />
              </View>
            </View>

            {/* Step size */}
            <Text style={styles.inputLabel}>STEP INCREMENT SIZE</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 5"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={stepSize}
              onChangeText={setStepSize}
            />

            {/* Villain Mode switch */}
            <View style={styles.villainToggleRow}>
              <View>
                <Text style={styles.villainToggleTitle}>IS VILLAIN HABIT?</Text>
                <Text style={styles.villainToggleSub}>Habit you want to avoid/limit (e.g. social media)</Text>
              </View>
              <Switch
                value={isVillain}
                onValueChange={setIsVillain}
                trackColor={{ false: COLORS.border, true: COLORS.purple }}
                thumbColor={isVillain ? COLORS.purple : '#8e8e93'}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: activeAccent }]} 
              onPress={handleCreateHabit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>SAVE HABIT</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* HERO HABITS LIST */}
        <Text style={styles.sectionHeading}>HERO HABITS 🦸</Text>
        {heroes.length === 0 ? (
          <Text style={styles.emptyText}>No hero habits. Press button to create one.</Text>
        ) : (
          heroes.map((habit, index) => {
            const overallIndex = habits.findIndex(h => h.id === habit.id);
            return (
              <HabitRow
                key={habit.id}
                habit={habit}
                index={overallIndex}
                onDelete={handleDelete}
                onMove={moveHabit}
                canMoveUp={overallIndex > 0}
                canMoveDown={overallIndex < habits.length - 1}
              />
            );
          })
        )}

        {/* VILLAIN HABITS LIST */}
        <Text style={[styles.sectionHeading, { color: COLORS.purple, marginTop: 30 }]}>VILLAIN HABITS 🦹</Text>
        {villains.length === 0 ? (
          <Text style={styles.emptyText}>No active villain habits.</Text>
        ) : (
          villains.map((habit, index) => {
            const overallIndex = habits.findIndex(h => h.id === habit.id);
            return (
              <HabitRow
                key={habit.id}
                habit={habit}
                index={overallIndex}
                onDelete={handleDelete}
                onMove={moveHabit}
                canMoveUp={overallIndex > 0}
                canMoveDown={overallIndex < habits.length - 1}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Inner habit display component
interface HabitRowProps {
  habit: Habit;
  index: number;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function HabitRow({ habit, index, onDelete, onMove, canMoveUp, canMoveDown }: HabitRowProps) {
  return (
    <View style={[
      styles.habitRow,
      habit.is_villain ? styles.rowVillainBorder : styles.rowStandardBorder
    ]}>
      {/* Color Dot */}
      <View style={[styles.colorDot, { backgroundColor: habit.color }]} />

      <Text style={styles.rowEmoji}>{habit.emoji}</Text>
      
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{habit.name}</Text>
        <Text style={styles.rowGoals}>
          Goal: {habit.base_goal} → <Text style={{ color: habit.color, fontWeight: 'bold' }}>{habit.current_goal}</Text> {habit.unit}
        </Text>
      </View>

      {/* Sorting / Move Buttons */}
      <View style={styles.sortingWrapper}>
        <TouchableOpacity 
          style={[styles.sortBtn, !canMoveUp && { opacity: 0.2 }]} 
          disabled={!canMoveUp} 
          onPress={() => onMove(index, 'up')}
        >
          <Ionicons name="chevron-up" size={16} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortBtn, !canMoveDown && { opacity: 0.2 }]} 
          disabled={!canMoveDown} 
          onPress={() => onMove(index, 'down')}
        >
          <Ionicons name="chevron-down" size={16} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Delete button */}
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(habit.id)}>
        <Ionicons name="trash-outline" size={18} color={COLORS.red} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    backgroundColor: COLORS.card,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
  },
  toggleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    ...TYPOGRAPHY.heading,
    fontSize: 8,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginRight: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  addButton: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    letterSpacing: 1,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  formTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
    letterSpacing: 1,
  },
  inputLabel: {
    ...TYPOGRAPHY.heading,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  textInput: {
    ...TYPOGRAPHY.body,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    height: 44,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 16,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  emojiSelect: {
    width: '12%',
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0.25%',
  },
  emojiSelectActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emojiText: {
    fontSize: 20,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: COLORS.text,
    scaleX: 1.1,
    scaleY: 1.1,
  },
  rowFields: {
    flexDirection: 'row',
  },
  fieldColumn: {
    flex: 1,
  },
  villainToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  villainToggleTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.text,
  },
  villainToggleSub: {
    ...TYPOGRAPHY.body,
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  saveButton: {
    height: 50,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  sectionHeading: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 10,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginVertical: 10,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  rowStandardBorder: {
    borderColor: COLORS.border,
  },
  rowVillainBorder: {
    borderColor: 'rgba(232, 121, 249, 0.3)',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  rowEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
  },
  rowGoals: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sortingWrapper: {
    flexDirection: 'row',
    marginRight: 8,
  },
  sortBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 6,
  },
});
