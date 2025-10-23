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

import { useGetAccessToken, useCurrentUser, useEvmAddress } from '@coinbase/cdp-hooks';
import { initializeAccessTokenGetter } from '@/utils/getAccessTokenGlobal';
import { registerForPushNotifications, sendPushTokenToServer } from '@/utils/pushNotifications';
import { getSandboxMode } from '@/utils/sharedState';
import { useEffect } from 'react';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useGetAccessToken();
  const { currentUser } = useCurrentUser();
  const { address: primaryAddress } = useEvmAddress();

  useEffect(() => {
    // Initialize the global token getter once
    initializeAccessTokenGetter(getAccessToken);
  }, [getAccessToken]);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (currentUser?.userId && primaryAddress) {
      // Generate partnerUserRef (same format as transactions: user-<address>)
      const sandboxPrefix = getSandboxMode() ? "sandbox-" : "";
      const partnerUserRef = `${sandboxPrefix}user-${primaryAddress}`;

      registerForPushNotifications().then(async (pushToken) => {
        if (pushToken) {
          console.log('✅ [APP] Push token registered for user:', partnerUserRef);
          await sendPushTokenToServer(pushToken, partnerUserRef);
        }
      }).catch((error) => {
        console.error('❌ [APP] Failed to register push notifications:', error);
      });
    }
  }, [currentUser?.userId, primaryAddress]);

  return <>{children}</>;
}
