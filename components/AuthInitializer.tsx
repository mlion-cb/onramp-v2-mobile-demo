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
import { registerForPushNotifications, sendPushTokenToServer } from '@/utils/pushNotifications';
import { useEffect } from 'react';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useGetAccessToken();
  const { currentUser } = useCurrentUser();

  console.log('🔍 [AUTH INITIALIZER] Component rendered, currentUser:', {
    hasUser: !!currentUser,
    userId: currentUser?.userId
  });

  useEffect(() => {
    // Initialize the global token getter once
    initializeAccessTokenGetter(getAccessToken);
    console.log('✅ [AUTH INITIALIZER] Access token getter initialized');
  }, [getAccessToken]);

  // Register for push notifications when user logs in
  useEffect(() => {
    console.log('🔍 [PUSH] useEffect triggered, currentUser.userId:', currentUser?.userId);

    if (currentUser?.userId) {
      // Use userId as partnerUserRef (matches transaction format)
      const partnerUserRef = currentUser.userId;

      console.log('📱 [APP] Registering push notifications for user:', partnerUserRef);

      registerForPushNotifications().then(async (result) => {
        if (result) {
          console.log('✅ [APP] Push token obtained, sending to server:', partnerUserRef, `(${result.type})`);
          await sendPushTokenToServer(result.token, partnerUserRef, getAccessToken, result.type);
          console.log('✅ [APP] Push token successfully sent to server');
        } else {
          console.log('ℹ️ [APP] No push token (likely simulator or permission denied)');
        }
      }).catch((error) => {
        console.error('❌ [APP] Failed to register push notifications:', error);
      });
    } else {
      console.log('⚠️ [APP] No currentUser.userId, skipping push notification setup');
    }
  }, [currentUser?.userId, getAccessToken]);

  return <>{children}</>;
}
