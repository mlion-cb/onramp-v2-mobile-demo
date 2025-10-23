/**
 * Global Access Token Retrieval
 *
 * Provides a way to get the CDP access token from anywhere in the app
 * without requiring hook context.
 *
 * This is initialized once in the root component and can be called
 * from any utility function.
 */

type GetAccessTokenFn = () => Promise<string | null>;

let globalGetAccessToken: GetAccessTokenFn | null = null;

/**
 * Initialize the global access token getter
 * Call this once in your root component with the CDP hook
 */
export function initializeAccessTokenGetter(getter: GetAccessTokenFn) {
  globalGetAccessToken = getter;
  console.log('✅ [AUTH] Access token getter initialized');
}

/**
 * Get the current access token
 * Throws if not initialized (wallet not connected)
 */
export async function getAccessTokenGlobal(): Promise<string | null> {
  if (!globalGetAccessToken) {
    throw new Error('Access token getter not initialized. Ensure wallet is connected.');
  }

  return globalGetAccessToken();
}

/**
 * Check if access token getter is initialized
 */
export function isAccessTokenInitialized(): boolean {
  return globalGetAccessToken !== null;
}
