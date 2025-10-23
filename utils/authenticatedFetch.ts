/**
 * Authenticated Fetch Wrapper
 *
 * Automatically adds CDP access token to all backend requests.
 * Drop-in replacement for fetch() - handles authentication transparently.
 *
 * Usage:
 * ```typescript
 * import { authenticatedFetch } from '@/utils/authenticatedFetch';
 *
 * // Instead of:
 * const response = await fetch(url, { headers: { Authorization: ... } });
 *
 * // Simply use:
 * const response = await authenticatedFetch(url, options);
 * ```
 *
 * Features:
 * - Automatically retrieves and injects CDP access token
 * - Merges with existing headers (won't overwrite Content-Type, etc.)
 * - Throws helpful errors if token unavailable
 * - Works with both string URLs and Request objects
 */

import { getAccessTokenGlobal } from './getAccessTokenGlobal';
import { isTestSessionActive } from './sharedState';

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Prepare headers
  const headers = new Headers(init?.headers || {});

  // Handle TestFlight test accounts (bypass CDP authentication)
  if (isTestSessionActive()) {
    console.log('🧪 [AUTH FETCH] TestFlight mode - using mock authentication');
    if (!headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer testflight-mock-token');
    }
  } else {
    // Real account - get CDP access token
    const token = await getAccessTokenGlobal();

    if (!token) {
      throw new Error('Authentication required. Please connect your wallet first.');
    }

    // Add Authorization header (won't overwrite if already exists)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Log for debugging (in development)
  if (__DEV__) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    console.log('🔐 [AUTH FETCH] Authenticated request to:', url);
  }

  // Make the request with authentication
  return fetch(input, {
    ...init,
    headers,
  });
}
