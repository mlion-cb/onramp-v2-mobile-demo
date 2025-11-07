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
import { useEffect, useRef } from 'react';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useGetAccessToken();
  const { currentUser } = useCurrentUser();
  const hasRegisteredPush = useRef(false);

  // Log every render to diagnose timing
  console.log('🔍 [AUTH INITIALIZER] Render:', {
    hasUser: !!currentUser,
    userId: currentUser?.userId,
    hasEmail: !!currentUser?.authenticationMethods?.email,
    hasPhone: !!currentUser?.authenticationMethods?.sms,
    hasRegistered: hasRegisteredPush.current,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    // Initialize the global token getter once
    initializeAccessTokenGetter(getAccessToken);
    console.log('✅ [AUTH INITIALIZER] Access token getter initialized');
  }, [getAccessToken]);

  // Register for push notifications when user logs in
  // With retry mechanism for timing issues in CDP hooks 0.0.57
  useEffect(() => {
    console.log('🔍 [PUSH] useEffect triggered, currentUser.userId:', currentUser?.userId, 'hasRegistered:', hasRegisteredPush.current);

    if (hasRegisteredPush.current) {
      console.log('⏭️ [PUSH] Already registered, skipping');
      return;
    }

    if (currentUser?.userId) {
      // Use userId as partnerUserRef (matches transaction format)
      const partnerUserRef = currentUser.userId;

      console.log('📱 [APP] Registering push notifications for user:', partnerUserRef);
      hasRegisteredPush.current = true;

      registerForPushNotifications().then(async (result) => {
        if (result) {
          console.log('✅ [APP] Push token obtained, sending to server:', partnerUserRef, `(${result.type})`);
          await sendPushTokenToServer(result.token, partnerUserRef, getAccessToken, result.type);
          console.log('✅ [APP] Push token successfully sent to server');
        } else {
          console.log('ℹ️ [APP] No push token (likely simulator or permission denied)');
          hasRegisteredPush.current = false; // Allow retry if we couldn't get token
        }
      }).catch((error) => {
        console.error('❌ [APP] Failed to register push notifications:', error);
        hasRegisteredPush.current = false; // Allow retry on error
      });
    } else {
      console.log('⚠️ [APP] No currentUser.userId, will retry when available');
    }
  }, [currentUser?.userId, currentUser, getAccessToken]); // Added currentUser to deps to catch object changes

  return <>{children}</>;
}
