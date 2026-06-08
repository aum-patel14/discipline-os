import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/Theme';
import { Platform, TouchableOpacity } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        headerStyle: {
          backgroundColor: COLORS.background,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
          fontWeight: 'bold',
          color: COLORS.text,
          fontSize: 20,
          letterSpacing: 1,
        },
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerTitle: 'DISCIPLINE OS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={24} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/profile')} style={{ marginRight: 16 }}>
              <Ionicons name="person-circle-outline" size={26} color={COLORS.green} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerTitle: 'CALENDAR',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: 'Challenge',
          headerTitle: 'HARD CHALLENGE',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flame' : 'flame-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="energy"
        options={{
          title: 'Energy',
          headerTitle: 'ENERGY STATUS',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Manage',
          headerTitle: 'HABITS MANAGER',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'options' : 'options-outline'} size={24} color={color} />
          ),
        }}
      />
      
      {/* Hide two.tsx which was pre-created in the template */}
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
