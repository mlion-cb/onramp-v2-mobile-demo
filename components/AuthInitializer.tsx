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
  // Enhanced retry mechanism with polling for CDP hooks 0.0.58 timing issues
  useEffect(() => {
    console.log('🔍 [PUSH] useEffect triggered, currentUser.userId:', currentUser?.userId, 'hasRegistered:', hasRegisteredPush.current);

    if (hasRegisteredPush.current) {
      console.log('⏭️ [PUSH] Already registered, skipping');
      return;
    }

    // Polling approach: Keep checking for userId every 500ms for up to 10 seconds
    const maxAttempts = 20; // 20 attempts * 500ms = 10 seconds
    let attempts = 0;

    const pollForUserId = async () => {
      attempts++;
      console.log(`🔄 [PUSH] Polling attempt ${attempts}/${maxAttempts}, userId:`, currentUser?.userId);

      if (currentUser?.userId) {
        // Use userId as partnerUserRef (matches transaction format)
        const partnerUserRef = currentUser.userId;

        console.log('📱 [APP] Registering push notifications for user:', partnerUserRef);
        hasRegisteredPush.current = true;

        try {
          const result = await registerForPushNotifications();
          if (result) {
            console.log('✅ [APP] Push token obtained, sending to server:', partnerUserRef, `(${result.type})`);
            await sendPushTokenToServer(result.token, partnerUserRef, getAccessToken, result.type);
            console.log('✅ [APP] Push token successfully sent to server');
          } else {
            console.log('ℹ️ [APP] No push token (likely simulator or permission denied)');
            hasRegisteredPush.current = false; // Allow retry if we couldn't get token
          }
        } catch (error) {
          console.error('❌ [APP] Failed to register push notifications:', error);
          hasRegisteredPush.current = false; // Allow retry on error
        }
      } else if (attempts < maxAttempts) {
        // Keep polling
        setTimeout(pollForUserId, 500);
      } else {
        console.warn('⚠️ [APP] Gave up waiting for currentUser.userId after 10 seconds');
      }
    };

    // Start polling
    pollForUserId();
  }, [currentUser, getAccessToken]); // Simplified deps - rely on polling instead

  return <>{children}</>;
}
