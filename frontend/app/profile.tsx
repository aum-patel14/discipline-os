import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Clipboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, TYPOGRAPHY } from '../constants/Theme';
import { useAuthStore } from '../stores/authStore';
import apiClient, { supabase } from '../utils/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuthStore();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [isUpdating, setIsUpdating] = useState(false);
  const [stats, setStats] = useState({ perfectDays: 0, completedChallenges: 0, longestStreak: 0 });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setTimezone(user.timezone);
      loadProfileStats();
    }
  }, [user]);

  const loadProfileStats = async () => {
    try {
      const [streakRes, challengeRes] = await Promise.all([
        apiClient.get('/api/analytics/streak'),
        apiClient.get('/api/challenge/history'),
      ]);
      
      const history = challengeRes.data || [];
      const completedChallenges = history.filter((c: any) => c.completed).length;
      
      // Calculate perfect days from history or set placeholder
      const perfectDays = history.reduce((sum: number, c: any) => sum + c.perfect_days, 0);

      setStats({
        perfectDays,
        completedChallenges,
        longestStreak: streakRes.data.longestStreak || 0
      });
    } catch (e) {
      console.warn('Error loading stats:', e);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateProfile({ full_name: fullName, timezone });
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyCode = () => {
    if (user?.partner_code) {
      Clipboard.setString(user.partner_code);
      Alert.alert('Copied', 'Partner code copied to clipboard!');
    }
  };

  const handleSelectAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'We need access to your photos to upload avatars.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets[0]) return;

      const selectedAsset = result.assets[0];
      setIsUpdating(true);

      // Upload file to Supabase Storage bucket 'avatars'
      const fileUri = selectedAsset.uri;
      const response = await fetch(fileUri);
      const blob = await response.blob();
      
      const fileName = `${user?.id}/${Date.now()}.jpg`;

      // Upload to supabase storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Save to database
      await updateProfile({ avatar_url: publicUrl });
      Alert.alert('Success', 'Avatar updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload image.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'LOG OUT',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* HEADER ROW WITH BACK BUTTON */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.green} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* AVATAR SELECT */}
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={handleSelectAvatar}>
          {user?.avatar_url ? (
            <Text style={styles.avatarPlaceholderText}>👤</Text> // Simple placeholder image or icon
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {user?.username ? user.username.substring(0, 2).toUpperCase() : 'OS'}
              </Text>
            </View>
          )}
          <View style={styles.editAvatarIcon}>
            <Ionicons name="camera" size={16} color="#000" />
          </View>
        </TouchableOpacity>
        <Text style={styles.usernameText}>@{user?.username || 'user'}</Text>
        <Text style={styles.joinText}>JOINED {user ? new Date(user.created_at).toLocaleDateString() : 'TODAY'}</Text>
      </View>

      {/* STATS MATRIX */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>🔥 {stats.longestStreak}</Text>
          <Text style={styles.statLabel}>BEST STREAK</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>🏆 {stats.completedChallenges}</Text>
          <Text style={styles.statLabel}>CHALLENGES</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>📅 {stats.perfectDays}</Text>
          <Text style={styles.statLabel}>PERFECT DAYS</Text>
        </View>
      </View>

      {/* EDIT PROFILE FORM */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ACCOUNT OPTIONS</Text>
        
        <Text style={styles.inputLabel}>FULL NAME</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter display name"
          placeholderTextColor={COLORS.textSecondary}
        />

        <Text style={styles.inputLabel}>TIMEZONE</Text>
        <TextInput
          style={styles.input}
          value={timezone}
          onChangeText={setTimezone}
          placeholder="e.g. UTC, Asia/Kolkata"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={styles.updateButton} 
          onPress={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.updateButtonText}>SAVE PROFILE</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PARTNER CODE & QR CODE */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ACCOUNTABILITY CODE</Text>
        <Text style={styles.codeSubtitle}>Share this code with a partner so they can hold you accountable.</Text>
        
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{user?.partner_code || 'CODE'}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={20} color={COLORS.green} />
          </TouchableOpacity>
        </View>

        {/* QR Code SVG Placeholder */}
        <View style={styles.qrContainer}>
          <View style={styles.qrMockBorder}>
            {/* Draw a premium digital matrix layout */}
            <View style={styles.qrSquareRow}>
              <View style={[styles.qrMockSquare, { backgroundColor: COLORS.green }]} />
              <View style={styles.qrMockSquare} />
              <View style={[styles.qrMockSquare, { backgroundColor: COLORS.green }]} />
            </View>
            <View style={styles.qrSquareRow}>
              <View style={styles.qrMockSquare} />
              <View style={[styles.qrMockSquare, { backgroundColor: COLORS.green }]} />
              <View style={styles.qrMockSquare} />
            </View>
            <View style={styles.qrSquareRow}>
              <View style={[styles.qrMockSquare, { backgroundColor: COLORS.green }]} />
              <View style={styles.qrMockSquare} />
              <View style={[styles.qrMockSquare, { backgroundColor: COLORS.green }]} />
            </View>
          </View>
          <Text style={styles.qrLabel}>SCAN DIGITAL KEY</Text>
        </View>
      </View>

      {/* LINKS & SYSTEM ACTIONS */}
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/partner')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="people" size={20} color={COLORS.cyan} style={{ marginRight: 12 }} />
            <Text style={styles.menuText}>ACCOUNTABILITY PARTNERS</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings')}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="settings" size={20} color={COLORS.green} style={{ marginRight: 12 }} />
            <Text style={styles.menuText}>SYSTEM SETTINGS</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out" size={20} color={COLORS.red} style={{ marginRight: 12 }} />
            <Text style={[styles.menuText, { color: COLORS.red }]}>LOG OUT SYSTEM</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    fontSize: 20,
    letterSpacing: 2,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    ...TYPOGRAPHY.heading,
    fontSize: 24,
    color: COLORS.green,
  },
  avatarPlaceholderText: {
    fontSize: 60,
  },
  editAvatarIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.green,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  usernameText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
    fontSize: 16,
  },
  joinText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '31%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statVal: {
    ...TYPOGRAPHY.heading,
    fontSize: 15,
    color: COLORS.text,
  },
  statLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  inputLabel: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
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
  updateButton: {
    backgroundColor: COLORS.green,
    height: 46,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  codeSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 6,
    height: 52,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  codeText: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 3,
  },
  copyBtn: {
    padding: 4,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrMockBorder: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 6,
    justifyContent: 'space-around',
    marginBottom: 10,
    borderRadius: 4,
  },
  qrSquareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
  },
  qrMockSquare: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
  qrLabel: {
    ...TYPOGRAPHY.heading,
    fontSize: 8,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.text,
    letterSpacing: 1,
  },
});
