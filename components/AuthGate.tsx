/**
 * Auth Gate - Enforces authentication before app access
 *
 * Wraps the entire app to ensure users are logged in.
 * Shows loading spinner while checking auth status.
 * Redirects to login screen if not authenticated.
 *
 * TestFlight accounts bypass this check automatically.
 */

import { useIsSignedIn, useIsInitialized } from '@coinbase/cdp-hooks';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { isTestSessionActive } from '@/utils/sharedState';
import { COLORS } from '@/constants/Colors';

const { DARK_BG, BLUE } = COLORS;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useIsSignedIn();
  const { isInitialized } = useIsInitialized();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const testSession = isTestSessionActive();
  const [isReady, setIsReady] = useState(false);

  // TestFlight bypass OR real CDP auth
  const isAuthenticated = testSession || isSignedIn;

  // Wait for navigation to be ready before attempting any navigation
  useEffect(() => {
    if (navigationState?.key) {
      setIsReady(true);
    }
  }, [navigationState?.key]);

  useEffect(() => {
    // Only run navigation logic after the router AND CDP are ready
    if (!isReady || !isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';

    // Allow unauthenticated access to email/SMS verification flows
    const publicRoutes = ['email-verify', 'email-code', 'sms-verify', 'sms-code'];
    const isPublicRoute = publicRoutes.includes(segments[0]);

    if (!isAuthenticated && !inAuthGroup && !isPublicRoute) {
      // Not logged in and not on login/public screen → redirect
      console.log('🚫 [AUTH GATE] Not authenticated, redirecting to login');
      // Use setTimeout to defer navigation to next tick
      setTimeout(() => {
        try {
          const router = require('expo-router').router;
          router.replace('/auth/login');
        } catch (e) {
          console.error('Navigation error:', e);
        }
      }, 0);
    } else if (isAuthenticated && inAuthGroup) {
      // Logged in but still on login screen → redirect to home
      console.log('✅ [AUTH GATE] Already authenticated, redirecting to home');
      setTimeout(() => {
        try {
          const router = require('expo-router').router;
          router.replace('/(tabs)');
        } catch (e) {
          console.error('Navigation error:', e);
        }
      }, 0);
    }
  }, [isReady, isInitialized, isAuthenticated, segments]);

  // Show loading spinner while navigation or CDP is initializing
  if (!isReady || !isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  // Navigation ready → render children (let navigation happen via useEffect)
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
