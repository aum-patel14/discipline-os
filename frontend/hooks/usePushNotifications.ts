import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import apiClient from '../utils/api';
import { useAuthStore } from '../stores/authStore';

// Configure how foreground notifications are handled
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const token = useAuthStore(state => state.token);
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!token) return;

    registerForPushNotificationsAsync()
      .then(async (pushToken) => {
        if (pushToken) {
          try {
            await apiClient.post('/api/notifications/register-token', { push_token: pushToken });
            console.log('Push token registered on backend:', pushToken);
          } catch (error) {
            console.error('Failed to register push token on backend:', error);
          }
        }
      })
      .catch(err => console.warn('Failed to configure push notifications:', err));

    // Handle user interaction with notifications (when app is tapped open)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [token]);
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00ff88',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-expo-project-id' // Replace with your actual EAS projectId
  });
  token = tokenData.data;

  return token;
}
