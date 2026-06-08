import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY } from '../constants/Theme';
import apiClient from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface PartnerUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

interface Partnership {
  partnership_id: string;
  status: 'pending' | 'active';
  role: 'sender' | 'receiver';
  user: PartnerUser;
  stats?: {
    today_score_pct: number;
    challenge_day: number;
    habits_completed: number;
    habits_total: number;
    is_locked: boolean;
  };
}

interface LeaderboardItem {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  weekly_score: number;
  challenge_day: number;
}

export default function PartnerScreen() {
  const router = useRouter();
  const currentUser = useAuthStore(state => state.user);

  const [partnerCode, setPartnerCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [partners, setPartners] = useState<Partnership[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch partnerships list
      const partnersRes = await apiClient.get('/api/partners/list');
      const partnerList: Partnership[] = partnersRes.data;

      // 2. Fetch stats for active partners
      const enrichedPartners = [];
      for (const p of partnerList) {
        if (p.status === 'active') {
          try {
            const statsRes = await apiClient.get(`/api/partners/${p.user.id}/progress`);
            enrichedPartners.push({
              ...p,
              stats: statsRes.data
            });
          } catch {
            enrichedPartners.push(p);
          }
        } else {
          enrichedPartners.push(p);
        }
      }
      setPartners(enrichedPartners);

      // 3. Fetch leaderboard
      const leaderboardRes = await apiClient.get('/api/partners/leaderboard');
      setLeaderboard(leaderboardRes.data);

    } catch (e) {
      console.warn('Error loading partner data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnect = async () => {
    if (!partnerCode || partnerCode.length !== 8) {
      Alert.alert('Error', 'Please enter a valid 8-character partner code.');
      return;
    }
    setIsConnecting(true);
    try {
      await apiClient.post('/api/partners/connect', { partner_code: partnerCode.toUpperCase() });
      setPartnerCode('');
      Alert.alert('Success', 'Partnership request sent!');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to connect.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAcceptRequest = async (partnershipId: string) => {
    try {
      await apiClient.put(`/api/partners/${partnershipId}/status`, { status: 'active' });
      Alert.alert('Success', 'Partnership accepted!');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to accept request.');
    }
  };

  const handleDeclineRequest = async (partnershipId: string) => {
    try {
      await apiClient.put(`/api/partners/${partnershipId}/status`, { status: 'declined' });
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to decline request.');
    }
  };

  const handleDeletePartner = (partnershipId: string) => {
    Alert.alert(
      'DISCONNECT PARTNER',
      'Are you sure you want to disconnect from this partner? You will no longer share progress logs.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'DISCONNECT', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/partners/${partnershipId}`);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to disconnect.');
            }
          }
        }
      ]
    );
  };

  const handleVerifyDay = async (partnerId: string) => {
    try {
      // Local local timezone date string
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: currentUser?.timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      await apiClient.post('/api/partners/verify', {
        partner_id: partnerId,
        date: todayStr,
        note: 'Verified! Great job locking in today.'
      });
      Alert.alert('Success', 'Day verified! We sent a push notification to your partner.');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to verify partner\'s progress.');
    }
  };

  const activePartners = partners.filter(p => p.status === 'active');
  const pendingRequests = partners.filter(p => p.status === 'pending');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.green} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PARTNERS</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* CONNECT PARTNER FORM */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CONNECT ACCOUNTABILITY PARTNER</Text>
        <Text style={styles.codeSubtitle}>Enter your accountability partner\'s 8-character code to link trackers.</Text>
        
        <View style={styles.connectRow}>
          <TextInput
            style={styles.textInput}
            placeholder="CODE (e.g. AB4F9K1L)"
            placeholderTextColor={COLORS.textSecondary}
            value={partnerCode}
            onChangeText={setPartnerCode}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity 
            style={styles.connectBtn} 
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.connectBtnText}>LINK</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* PENDING REQUESTS */}
      {pendingRequests.length > 0 && (
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: COLORS.yellow }]}>PENDING REQUESTS</Text>
          {pendingRequests.map(p => (
            <View key={p.partnership_id} style={styles.pendingRow}>
              <View>
                <Text style={styles.partnerUsername}>@{p.user.username}</Text>
                <Text style={styles.pendingRoleText}>{p.role === 'sender' ? 'Sent request' : 'Received request'}</Text>
              </View>
              {p.role === 'receiver' ? (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAcceptRequest(p.partnership_id)}>
                    <Text style={styles.actionBtnText}>ACCEPT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => handleDeclineRequest(p.partnership_id)}>
                    <Text style={styles.actionBtnText}>DECLINE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => handleDeclineRequest(p.partnership_id)}>
                  <Text style={styles.actionBtnText}>CANCEL</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ACTIVE PARTNERS */}
      <Text style={styles.sectionHeading}>PARTNERS LIST</Text>
      {isLoading ? (
        <ActivityIndicator size="small" color={COLORS.green} style={{ marginVertical: 20 }} />
      ) : activePartners.length === 0 ? (
        <Text style={styles.emptyText}>No accountability partners linked yet.</Text>
      ) : (
        activePartners.map(p => (
          <View key={p.partnership_id} style={styles.partnerCard}>
            <View style={styles.partnerHeader}>
              <View style={styles.partnerMeta}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{p.user.username.substring(0, 2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.partnerUsername}>@{p.user.username}</Text>
                  <Text style={styles.fullName}>{p.user.full_name}</Text>
                </View>
              </View>
              
              <TouchableOpacity onPress={() => handleDeletePartner(p.partnership_id)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              </TouchableOpacity>
            </View>

            {/* Partner limited progress info */}
            {p.stats && (
              <View style={styles.partnerStatsBlock}>
                <View style={styles.statsRowItem}>
                  <Text style={styles.statsVal}>{p.stats.today_score_pct}%</Text>
                  <Text style={styles.statsLabel}>TODAY SCORE</Text>
                </View>
                <View style={styles.statsRowItem}>
                  <Text style={styles.statsVal}>Day {p.stats.challenge_day}</Text>
                  <Text style={styles.statsLabel}>CHALLENGE DAY</Text>
                </View>
                <View style={styles.statsRowItem}>
                  <Text style={styles.statsVal}>{p.stats.habits_completed}/{p.stats.habits_total}</Text>
                  <Text style={styles.statsLabel}>DONE</Text>
                </View>
              </View>
            )}

            {/* Accountability Day verification button */}
            {p.stats && p.stats.is_locked ? (
              <TouchableOpacity 
                style={styles.verifyBtn} 
                onPress={() => handleVerifyDay(p.user.id)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkbox-outline" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.verifyBtnText}>VERIFY PARTNER DAY</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.verifyBtnDisabled}>
                <Text style={styles.verifyBtnDisabledText}>WAITING FOR PARTNER TO LOCK TODAY</Text>
              </View>
            )}
          </View>
        ))
      )}

      {/* MINI LEADERBOARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>WEEKLY ACCOUNTABILITY LEADERBOARD</Text>
        <Text style={styles.codeSubtitle}>Ranked by average daily habit completion over the last 7 days.</Text>
        
        {leaderboard.map((item, index) => {
          const isMe = item.user_id === currentUser?.id;
          return (
            <View key={item.user_id} style={[styles.leaderboardRow, isMe && styles.leaderboardRowMe]}>
              <View style={styles.leaderboardLeft}>
                <Text style={[styles.rankText, index === 0 && { color: COLORS.yellow }]}>#{index + 1}</Text>
                <View style={styles.leaderboardProfile}>
                  <Text style={[styles.leaderboardUsername, isMe && { color: COLORS.green }]}>
                    {isMe ? 'YOU' : `@${item.username}`}
                  </Text>
                  <Text style={styles.leaderboardSub}>Challenge Day: {item.challenge_day}</Text>
                </View>
              </View>
              <Text style={styles.leaderboardScore}>{item.weekly_score}%</Text>
            </View>
          );
        })}
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  codeSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  connectRow: {
    flexDirection: 'row',
    height: 48,
  },
  textInput: {
    ...TYPOGRAPHY.body,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 15,
    marginRight: 10,
  },
  connectBtn: {
    backgroundColor: COLORS.green,
    width: 80,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 13,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pendingRoleText: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  acceptBtn: {
    backgroundColor: COLORS.green,
  },
  declineBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  actionBtnText: {
    ...TYPOGRAPHY.heading,
    fontSize: 10,
    color: COLORS.text,
  },
  sectionHeading: {
    ...TYPOGRAPHY.heading,
    color: COLORS.green,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 24,
  },
  partnerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    ...TYPOGRAPHY.heading,
    fontSize: 12,
    color: COLORS.text,
  },
  partnerUsername: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
  },
  fullName: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  partnerStatsBlock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    marginBottom: 14,
  },
  statsRowItem: {
    alignItems: 'center',
  },
  statsVal: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
  },
  statsLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  verifyBtn: {
    backgroundColor: COLORS.green,
    height: 40,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnText: {
    ...TYPOGRAPHY.heading,
    color: '#000000',
    fontSize: 12,
  },
  verifyBtnDisabled: {
    backgroundColor: COLORS.disabled,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyBtnDisabledText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  leaderboardRowMe: {
    borderBottomColor: COLORS.green,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankText: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.textSecondary,
    width: 28,
  },
  leaderboardProfile: {
    marginLeft: 4,
  },
  leaderboardUsername: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: COLORS.text,
  },
  leaderboardSub: {
    ...TYPOGRAPHY.body,
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaderboardScore: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.green,
  },
});
