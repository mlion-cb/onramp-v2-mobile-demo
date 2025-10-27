import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Push Notification Utilities
 *
 * Handles:
 * - Push token registration
 * - Permission requests
 * - Notification display configuration
 * - Token storage (for webhook usage)
 */

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get push token
 * Returns the appropriate push token based on environment:
 * - Standalone builds: Native device token (for direct APNs/FCM)
 * - Expo Go: Expo push token (for Expo push service)
 */
export async function registerForPushNotifications(): Promise<{ token: string; type: 'native' | 'expo' } | null> {
  try {
    // Note: Push tokens work in simulator, but notifications won't be delivered
    // This is fine for testing the webhook flow
    if (!Constants.isDevice) {
      console.log('ℹ️ [PUSH] Running in simulator - token will work but notifications won\'t show');
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('⚠️ [PUSH] Permission not granted for push notifications');
      return null;
    }

    // Get push token based on environment
    // Standalone builds: Use native token for direct APNs
    // Expo Go: Use Expo token for Expo push service
    let token;
    let tokenType: 'native' | 'expo';

    // Check if running in Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';

    if (isExpoGo) {
      // Expo Go: Get Expo push token (requires project ID)
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error('❌ [PUSH] No EAS project ID found');
        return null;
      }
      token = await Notifications.getExpoPushTokenAsync({ projectId });
      tokenType = 'expo';
      console.log('✅ [PUSH] Expo push token obtained (Expo Go):', token.data);
    } else {
      // Standalone build: Get native device token (for direct APNs)
      token = await Notifications.getDevicePushTokenAsync();
      tokenType = 'native';
      console.log('✅ [PUSH] Native device push token obtained (Standalone):', token.data);
      console.log('📱 [PUSH] Build environment - isDevice:', Constants.isDevice, '| Platform:', Platform.OS);
    }

    // iOS-specific: Register for APNs
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('transaction', [
        {
          identifier: 'view',
          buttonTitle: 'View Details',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }

    return { token: token.data, type: tokenType };
  } catch (error) {
    console.error('❌ [PUSH] Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send push token to server for webhook notifications
 */
export async function sendPushTokenToServer(pushToken: string, userId: string, getAccessToken: () => Promise<string>, tokenType: 'native' | 'expo' = 'native'): Promise<void> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId,
        pushToken,
        platform: Platform.OS,
        tokenType, // Tell server which type of token this is
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send push token: ${response.status}`);
    }

    console.log('✅ [PUSH] Push token sent to server');
  } catch (error) {
    console.error('❌ [PUSH] Error sending push token to server:', error);
  }
}

/**
 * Show local notification (for testing)
 */
export async function showLocalNotification(title: string, body: string, data?: any): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data,
    },
    trigger: null, // Show immediately
  });
}
