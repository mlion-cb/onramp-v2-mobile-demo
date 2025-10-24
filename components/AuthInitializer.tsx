/**
 * Auth Initializer Component
 *
 * Initializes:
 * - Global access token getter for API calls
 * - Push notification registration
 *
 * Must be placed inside CDPHooksProvider to access useGetAccessToken.
 *
 * Usage:
 * <CDPHooksProvider>
 *   <AuthInitializer>
 *     <YourApp />
 *   </AuthInitializer>
 * </CDPHooksProvider>
 */

import { useGetAccessToken, useCurrentUser } from '@coinbase/cdp-hooks';
import { initializeAccessTokenGetter } from '@/utils/getAccessTokenGlobal';
import { registerForPushNotifications, sendPushTokenToServer, startNotificationPolling, stopNotificationPolling } from '@/utils/pushNotifications';
import { useEffect } from 'react';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useGetAccessToken();
  const { currentUser } = useCurrentUser();

  useEffect(() => {
    // Initialize the global token getter once
    initializeAccessTokenGetter(getAccessToken);
  }, [getAccessToken]);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (currentUser?.userId) {
      // Use userId as partnerUserRef (matches transaction format)
      const partnerUserRef = currentUser.userId;

      registerForPushNotifications().then(async (pushToken) => {
        if (pushToken) {
          console.log('✅ [APP] Push token registered for user:', partnerUserRef);
          await sendPushTokenToServer(pushToken, partnerUserRef, getAccessToken);
        } else {
          console.log('ℹ️ [APP] No push token (likely simulator), will use polling instead');
        }
      }).catch((error) => {
        console.error('❌ [APP] Failed to register push notifications:', error);
      });

      // Start polling for notifications (works on simulator)
      console.log('🔄 [APP] Starting notification polling for user:', partnerUserRef);
      startNotificationPolling(partnerUserRef, getAccessToken);

      // Cleanup: stop polling when user logs out
      return () => {
        console.log('⏹️ [APP] Stopping notification polling');
        stopNotificationPolling();
      };
    }
  }, [currentUser?.userId]);

  return <>{children}</>;
}
