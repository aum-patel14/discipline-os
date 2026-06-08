import { Expo } from 'expo-server-sdk';
import logger from '../config/logger.js';

let expo = new Expo();

/**
 * Sends a push notification to a specific user push token
 * @param {string} pushToken - Expo push token
 * @param {string} title - Title of notification
 * @param {string} body - Body of notification
 * @param {object} data - Custom metadata
 */
export const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken) {
    logger.warn('Skipping notification: pushToken is undefined or null');
    return false;
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    logger.error(`Push token ${pushToken} is not a valid Expo push token`);
    return false;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    logger.info(`Notification sent successfully to ${pushToken}. Title: "${title}"`);
    return tickets;
  } catch (error) {
    logger.error(`Error sending push notification: ${error.message}`);
    return false;
  }
};

/**
 * Sends push notifications to multiple recipients
 * @param {Array} notifications - Array of { pushToken, title, body, data }
 */
export const sendMultiplePushNotifications = async (notifications) => {
  const validMessages = [];
  
  for (const n of notifications) {
    if (n.pushToken && Expo.isExpoPushToken(n.pushToken)) {
      validMessages.push({
        to: n.pushToken,
        sound: 'default',
        title: n.title,
        body: n.body,
        data: n.data || {},
      });
    }
  }

  if (validMessages.length === 0) return;

  try {
    let chunks = expo.chunkPushNotifications(validMessages);
    let tickets = [];
    for (let chunk of chunks) {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    logger.info(`Dispatched ${validMessages.length} push notifications in bulk.`);
    return tickets;
  } catch (error) {
    logger.error(`Error sending bulk notifications: ${error.message}`);
  }
};
