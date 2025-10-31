/**
 * ============================================================================
 * PROFILE PAGE - WALLET & SETTINGS MANAGEMENT (Tab 3)
 * ============================================================================
 *
 * Central hub for:
 * 1. Wallet connection & export
 * 2. Phone verification management
 * 3. Region selection (country/subdivision)
 * 4. Sandbox/Production mode toggle
 * 5. Manual address input (sandbox only)
 *
 * WALLET EXPORT FLOW:
 *
 * User has multiple wallets (EVM + SOL):
 * 1. Click "Export private key"
 * 2. Choose wallet type modal (EVM or Solana)
 * 3. Confirmation modal (security warning)
 * 4. exportEvmAccount() or exportSolanaAccount() from CDP
 * 5. Private key copied to clipboard
 * 6. Alert shown with security reminder
 *
 * Single wallet (EVM only or SOL only):
 * 1. Click "Export private key"
 * 2. Skip choice modal (auto-detect wallet type)
 * 3. Go directly to confirmation modal
 * 4. Export and copy to clipboard
 *
 * EXPO GO LIMITATIONS:
 * - Wallet export disabled (expo-crypto doesn't support key export)
 * - Wallet creation limited (can only use previously verified emails)
 * - Shows explanatory hints in UI
 * - Button disabled with "(Expo Go)" text
 *
 * TestFlight/Production:
 * - Full wallet export supported via react-native-quick-crypto
 * - Full wallet creation for new emails
 * - Export button enabled
 *
 * PHONE VERIFICATION STATE (useFocusEffect):
 *
 * Phone state is stored in sharedState (global), but UI needs local state:
 * - Local state: verifiedPhone, phoneFresh, phoneExpiry
 * - Updated on tab focus (useFocusEffect)
 * - Also updated immediately when user unlinks phone
 *
 * Why both local and global?
 * - Global: Shared across components (OnrampForm needs phone for orders)
 * - Local: Triggers React re-renders (profile UI updates)
 * - useFocusEffect: Syncs local from global when tab becomes active
 *
 * This ensures phone state updates when:
 * - User verifies phone (returns from phone-code screen)
 * - User unlinks phone (clicks "Unlink Phone" button)
 * - User switches tabs and comes back
 *
 * REGION SELECTION IMPACT:
 *
 * Changing region triggers:
 * 1. setCountry() or setSubdivision() in sharedState
 * 2. OnrampForm remount (key=`${country}-${subdivision}`)
 * 3. fetchOptions() called with new region
 * 4. Available assets/networks/currencies update
 *
 * US subdivisions:
 * - Only shown when country is "US"
 * - Required for compliance (state regulations vary)
 * - Auto-sets to "CA" if US selected without subdivision
 *
 * SANDBOX MODE (Not Persisted):
 *
 * Intentionally resets on app restart for safety:
 * - Toggle ON: Manual address input appears, mock phone accepted
 * - Toggle OFF: Production warnings shown, real transactions
 * - Affects validation, phone requirements, address priority
 *
 * Why not persisted?
 * - Prevent accidental real transactions thinking it's sandbox
 * - Forces user to consciously enable sandbox each session
 * - Production mode is the safe default
 *
 * @see utils/sharedState.ts for address priority system
 * @see app/phone-verify.tsx for phone verification flow
 * @see hooks/useOnramp.ts for how region affects options
 */

import { useOnramp } from "@/hooks/useOnramp";
import {
  useCurrentUser,
  useEvmAddress,
  useExportEvmAccount,
  useExportSolanaAccount,
  useIsInitialized,
  useIsSignedIn,
  useLinkSms,
  useSignOut,
  useSolanaAddress,
} from "@coinbase/cdp-hooks";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { BASE_URL } from "../../constants/BASE_URL";
import { COLORS } from "../../constants/Colors";
import { TEST_ACCOUNTS } from "../../constants/TestAccounts";
import { clearManualAddress, clearTestSession, daysUntilExpiry, formatPhoneDisplay, getCountry, getManualWalletAddress, getSandboxMode, getSubdivision, getTestWalletSol, getVerifiedPhone, isPhoneFresh60d, isTestSessionActive, setCountry, setCurrentSolanaAddress, setCurrentWalletAddress, setManualWalletAddress, setSandboxMode, setSubdivision, setVerifiedPhone } from "../../utils/sharedState";

const { CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, BORDER, WHITE, VIOLET, ORANGE } = COLORS;

export default function WalletScreen() {
  // Check for test session first
  const testSession = isTestSessionActive();

  // CDP hooks (only used for real accounts)
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { signOut } = useSignOut();
  const { linkSms } = useLinkSms();

  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    type: 'success' as 'success' | 'error' | 'info'
  });

  // Override CDP data if test session active
  const explicitEOAAddress = testSession ? TEST_ACCOUNTS.wallets.eoaDummy : (currentUser?.evmAccounts?.[0] as string);
  const smartAccountAddress = testSession ? TEST_ACCOUNTS.wallets.evm : (currentUser?.evmSmartAccounts?.[0] as string);

  // For display: prefer smart account, then EOA
  const primaryAddress = smartAccountAddress || explicitEOAAddress;

  const { exportEvmAccount } = useExportEvmAccount();
  const { exportSolanaAccount } = useExportSolanaAccount();
  const { solanaAddress: cdpSolanaAddress } = useSolanaAddress();
  const { evmAddress } = useEvmAddress();

  // Override solana address for test session
  const solanaAddress = testSession ? getTestWalletSol() : cdpSolanaAddress;

  // For export: Use EOA first, then evmAddress hook, then smart account
  const evmWalletAddress = explicitEOAAddress || evmAddress || smartAccountAddress;

  // Add debugging + track user changes
  useEffect(() => {
    console.log('🔄 [PROFILE] currentUser changed:', {
      userId: currentUser?.userId,
      hasUser: !!currentUser,
      isSignedIn,
      testSession
    });

    if (currentUser) {
      console.log('=== DETAILED WALLET INFORMATION ===');

      // EOA Information
      if (currentUser.evmAccounts && currentUser.evmAccounts.length > 0) {
        console.log('--- EOA ADDRESSES ---');
        currentUser.evmAccounts.forEach((account, index) => {
          console.log(`EOA Address ${index + 1}:`, account);
        });
      } else {
        console.log('EOA Addresses: None found');
      }

      // Smart Account Information
      if (currentUser.evmSmartAccounts && currentUser.evmSmartAccounts.length > 0) {
        console.log('--- SMART ACCOUNT ADDRESSES ---');
        currentUser.evmSmartAccounts.forEach((account, index) => {
          console.log(`Smart Account ${index + 1}:`, account);
        });
      } else {
        console.log('Smart Accounts: None found');
      }

      // Address Resolution
      console.log('--- ADDRESS RESOLUTION ---');
      console.log('Explicit EOA:', explicitEOAAddress);
      console.log('Smart Account:', smartAccountAddress);
      console.log('useEvmAddress() hook:', evmAddress);
      console.log('Final evmWalletAddress:', evmWalletAddress);
      console.log('Solana Address:', solanaAddress);

      // Authentication Methods
      console.log('--- AUTHENTICATION METHODS ---');
      console.log('Full authenticationMethods:', JSON.stringify(currentUser.authenticationMethods, null, 2));
      console.log('Email:', currentUser.authenticationMethods?.email?.email);
      console.log('Phone (sms - CORRECT FIELD):', currentUser.authenticationMethods?.sms?.phoneNumber);
      console.log('Verified Phone (AsyncStorage):', verifiedPhone);
      console.log('Phone Fresh:', phoneFresh);
      console.log('=== END DETAILED WALLET INFO ===');
    }
  }, [currentUser, evmAddress, solanaAddress, explicitEOAAddress, smartAccountAddress, evmWalletAddress]);

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportType, setExportType] = useState<'evm' | 'solana'>('evm');
  const [exporting, setExporting] = useState(false);

  // Phone verification state - use local state that updates on focus
  const [verifiedPhone, setVerifiedPhoneLocal] = useState(getVerifiedPhone());
  const [phoneFresh, setPhoneFresh] = useState(isPhoneFresh60d());
  const [phoneExpiry, setPhoneExpiry] = useState(daysUntilExpiry());

  const formattedPhone = formatPhoneDisplay(verifiedPhone);
  const d = phoneExpiry;

  // Override sign-in status for test session
  const effectiveIsSignedIn = testSession || isSignedIn;
  const signedButNoSA = effectiveIsSignedIn && !primaryAddress;

  // Override email display for test session
  const displayEmail = testSession ? TEST_ACCOUNTS.email : (currentUser?.authenticationMethods.email?.email || 'No email');

  // Refresh phone verification state when tab becomes active
  useFocusEffect(
    useCallback(() => {
      setVerifiedPhoneLocal(getVerifiedPhone());
      setPhoneFresh(isPhoneFresh60d());
      setPhoneExpiry(daysUntilExpiry());
    }, [])
  );

  // Clear stale verified phone data when user changes or CDP phone doesn't match
  useEffect(() => {
    const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;
    const storedVerifiedPhone = getVerifiedPhone();

    // If there's a stored verified phone but no CDP phone, clear it (user signed in with different account)
    if (storedVerifiedPhone && !cdpPhone) {
      console.log('🧹 [PROFILE] Clearing stale verified phone (no CDP phone)');
      setVerifiedPhone(null).then(() => {
        setVerifiedPhoneLocal(null);
        setPhoneFresh(false);
        setPhoneExpiry(-1);
      });
    }
    // If stored phone doesn't match CDP phone, clear it (switched accounts or unlinked phone)
    else if (storedVerifiedPhone && cdpPhone && storedVerifiedPhone !== cdpPhone) {
      console.log('🧹 [PROFILE] Clearing stale verified phone (mismatch with CDP)');
      setVerifiedPhone(null).then(() => {
        setVerifiedPhoneLocal(null);
        setPhoneFresh(false);
        setPhoneExpiry(-1);
      });
    }
  }, [currentUser]);


  const [productionSwitchAlertVisible, setProductionSwitchAlertVisible] = useState(false); 

  const sandboxEnabled = getSandboxMode();
  const [localSandboxEnabled, setLocalSandboxEnabled] = useState(getSandboxMode());
  const [manualAddress, setManualAddress] = useState('');

  // Balance state
  const [balances, setBalances] = useState<any[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balancesExpanded, setBalancesExpanded] = useState(false);

  // Testnet balance state
  const [testnetBalances, setTestnetBalances] = useState<any[]>([]);
  const [loadingTestnetBalances, setLoadingTestnetBalances] = useState(false);
  const [testnetBalancesError, setTestnetBalancesError] = useState<string | null>(null);
  const [testnetBalancesExpanded, setTestnetBalancesExpanded] = useState(false);

  // sync local state with shared state on mount
  useEffect(() => {
    setLocalSandboxEnabled(getSandboxMode());
    // Load manual address if in sandbox mode
    const stored = getManualWalletAddress();
    if (sandboxEnabled && stored) {
      setManualAddress(stored);
    }
  }, [sandboxEnabled]);

  // Save manual address to shared state when changed
  useEffect(() => {
    if (localSandboxEnabled) {
      // In sandbox mode, save manual address (can be empty string or actual address)
      setManualWalletAddress(manualAddress || null);
    } else {
      // In production mode, always clear manual address
      setManualWalletAddress(null);
    }
  }, [manualAddress, localSandboxEnabled]);

  const openPhoneVerify = useCallback(async () => {
    const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;

    console.log('📱 [PROFILE] openPhoneVerify called:', {
      cdpPhone,
      hasCurrentUser: !!currentUser,
      authMethods: currentUser?.authenticationMethods
    });

    // If phone already linked to CDP, automatically send OTP and go to code screen
    if (cdpPhone) {
      try {
        console.log('📱 [PROFILE] Phone already linked, sending OTP automatically');
        console.log('📱 [PROFILE] Phone format:', {
          raw: cdpPhone,
          type: typeof cdpPhone,
          length: cdpPhone.length,
          startsWithPlus: cdpPhone.startsWith('+')
        });

        // Trigger OTP via CDP
        const result = await linkSms(cdpPhone);

        console.log('✅ [PROFILE] OTP sent successfully:', {
          flowId: result.flowId,
          hasFlowId: !!result.flowId
        });

        // Go directly to code entry screen
        router.push({
          pathname: '/phone-code',
          params: {
            phone: cdpPhone,
            flowId: result.flowId,
            mode: 'link'
          }
        });
      } catch (error: any) {
        console.error('❌ [PROFILE] Failed to send OTP:', {
          message: error.message,
          code: error.code,
          status: error.status,
          fullError: error
        });

        // Build detailed error message
        let errorMessage = error.message || 'Unable to send verification code. Please try again.';
        if (error.code || error.status) {
          errorMessage += '\n\nError Details:';
          if (error.code) errorMessage += `\nCode: ${error.code}`;
          if (error.status) errorMessage += `\nStatus: ${error.status}`;
        }

        // Show error alert
        setAlertState({
          visible: true,
          title: 'Failed to Send Code',
          message: errorMessage,
          type: 'error'
        });
      }
    } else {
      console.log('📱 [PROFILE] No CDP phone, navigating to phone entry screen');
      // No phone linked yet, go to phone entry screen
      router.push({
        pathname: '/phone-verify',
        params: { initialPhone: verifiedPhone || '', mode: 'link' }
      });
    }
  }, [router, verifiedPhone, currentUser, linkSms]);

  const openEmailLink = useCallback(() => {
    router.push('/email-verify?mode=link');
  }, [router]);

  // Clear UI state when user signs out
  useEffect(() => {
    if (!effectiveIsSignedIn) {
      console.log('🧹 [PROFILE] User signed out - clearing UI state');
      setBalances([]);
      setBalancesError(null);
      setTestnetBalances([]);
      setTestnetBalancesError(null);
      setCurrentWalletAddress(null);
      setCurrentSolanaAddress(null);
    }
  }, [effectiveIsSignedIn]);

  // Update wallet addresses when they change
  useEffect(() => {
    if (effectiveIsSignedIn) {
      console.log('💼 [PROFILE] Updating wallet addresses:', {
        primaryAddress,
        solanaAddress
      });
      setCurrentWalletAddress(primaryAddress ?? null);
      setCurrentSolanaAddress(solanaAddress ?? null);
    }
  }, [primaryAddress, solanaAddress, effectiveIsSignedIn]);

  // Fetch balances when wallet addresses are available
  const fetchBalances = useCallback(async () => {
    if (!primaryAddress && !solanaAddress) return;

    setLoadingBalances(true);
    setBalancesError(null);

    try {
      // Check if TestFlight mode
      const { isTestSessionActive } = await import('@/utils/sharedState');
      const isTestFlight = isTestSessionActive();

      let accessToken: string | null = null;

      if (isTestFlight) {
        console.log('🧪 [PROFILE] TestFlight mode - using mock token');
        accessToken = 'testflight-mock-token';
      } else {
        // Get access token from CDP (real accounts)
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
        accessToken = await getAccessTokenGlobal();

        if (!accessToken) {
          console.error('❌ [PROFILE] No access token available');
          setBalancesError('Authentication required');
          setLoadingBalances(false);
          return;
        }
      }

      const allBalances: any[] = [];

      // Fetch EVM balances (Base + Ethereum)
      if (primaryAddress) {
        try {
          // Fetch Base balances
          const baseResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=base`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (baseResponse.ok) {
            const baseData = await baseResponse.json();
            allBalances.push(...(baseData.balances || []).map((b: any) => ({ ...b, network: 'Base' })));
          }

          // Fetch Ethereum balances
          const ethResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=ethereum`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (ethResponse.ok) {
            const ethData = await ethResponse.json();
            allBalances.push(...(ethData.balances || []).map((b: any) => ({ ...b, network: 'Ethereum' })));
          }
        } catch (e) {
          console.error('Error fetching EVM balances:', e);
        }
      }

      // Fetch Solana balances
      if (solanaAddress) {
        try {
          const solResponse = await fetch(`${BASE_URL}/balances/solana?address=${solanaAddress}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (solResponse.ok) {
            const solData = await solResponse.json();
            allBalances.push(...(solData.balances || []).map((b: any) => ({ ...b, network: 'Solana' })));
          }
        } catch (e) {
          console.error('Error fetching Solana balances:', e);
        }
      }

      setBalances(allBalances);
      console.log(`✅ [PROFILE] Loaded ${allBalances.length} mainnet token balances`);
    } catch (error) {
      console.error('❌ [PROFILE] Error fetching mainnet balances:', error);
      setBalancesError('Failed to load balances');
    } finally {
      setLoadingBalances(false);
    }
  }, [primaryAddress, solanaAddress]);

  // Fetch testnet balances
  const fetchTestnetBalances = useCallback(async () => {
    if (!primaryAddress && !solanaAddress) return;

    setLoadingTestnetBalances(true);
    setTestnetBalancesError(null);

    try {
      // Check if TestFlight mode
      const { isTestSessionActive } = await import('@/utils/sharedState');
      const isTestFlight = isTestSessionActive();

      let accessToken: string | null = null;

      if (isTestFlight) {
        console.log('🧪 [PROFILE] TestFlight mode - using mock token for testnet');
        accessToken = 'testflight-mock-token';
      } else {
        // Get access token from CDP (real accounts)
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
        accessToken = await getAccessTokenGlobal();

        if (!accessToken) {
          console.error('❌ [PROFILE] No access token available for testnet');
          setTestnetBalancesError('Authentication required');
          setLoadingTestnetBalances(false);
          return;
        }
      }

      const allTestnetBalances: any[] = [];

      // Fetch EVM testnet balances
      if (primaryAddress) {
        try {
          // Fetch Base Sepolia balances
          const baseSepoliaResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=base-sepolia`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (baseSepoliaResponse.ok) {
            const baseSepoliaData = await baseSepoliaResponse.json();
            allTestnetBalances.push(...(baseSepoliaData.balances || []).map((b: any) => ({ ...b, network: 'Base Sepolia' })));
          }

          // Fetch Ethereum Sepolia balances via backend
          const ethSepoliaResponse = await fetch(`${BASE_URL}/balances/evm?address=${primaryAddress}&network=ethereum-sepolia`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (ethSepoliaResponse.ok) {
            const ethSepoliaData = await ethSepoliaResponse.json();
            allTestnetBalances.push(...(ethSepoliaData.balances || []).map((b: any) => ({ ...b, network: 'Ethereum Sepolia' })));
          }
        } catch (e) {
          console.error('Error fetching EVM testnet balances:', e);
        }
      }

      // Fetch Solana Devnet balances
      if (solanaAddress) {
        try {
          const solDevnetResponse = await fetch(`${BASE_URL}/balances/solana?address=${solanaAddress}&network=solana-devnet`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (solDevnetResponse.ok) {
            const solDevnetData = await solDevnetResponse.json();
            allTestnetBalances.push(...(solDevnetData.balances || []).map((b: any) => ({ ...b, network: 'Solana Devnet' })));
          }
        } catch (e) {
          console.error('Error fetching Solana Devnet balances:', e);
        }
      }

      setTestnetBalances(allTestnetBalances);
      console.log(`✅ [PROFILE] Loaded ${allTestnetBalances.length} testnet token balances`);
    } catch (error) {
      console.error('❌ [PROFILE] Error fetching testnet balances:', error);
      setTestnetBalancesError('Failed to load testnet balances');
    } finally {
      setLoadingTestnetBalances(false);
    }
  }, [primaryAddress, solanaAddress]);

  // Fetch balances on mount and when addresses change
  useEffect(() => {
    if (effectiveIsSignedIn && (primaryAddress || solanaAddress)) {
      fetchBalances();
      fetchTestnetBalances();
    }
  }, [effectiveIsSignedIn, primaryAddress, solanaAddress, fetchBalances, fetchTestnetBalances]);

  // Re-fetch balances when profile tab comes into focus
  useFocusEffect(
    useCallback(() => {
      if (effectiveIsSignedIn && (primaryAddress || solanaAddress)) {
        console.log('🔄 [PROFILE] Tab focused - refreshing balances');
        fetchBalances();
        fetchTestnetBalances();
      }
    }, [effectiveIsSignedIn, primaryAddress, solanaAddress, fetchBalances, fetchTestnetBalances])
  );

  const handleSignOut = useCallback(async () => {
    try {
      // Check if this is a test session
      if (isTestSessionActive()) {
        console.log('🧪 Clearing test session');
        await clearTestSession();
      } else {
        // Real CDP sign out
        await signOut();
      }
    } catch (e) {
      console.warn('signOut error', e);
    } finally {
      // Clear all user-specific state
      setCurrentWalletAddress(null);
      setManualWalletAddress(null);
      await setVerifiedPhone(null);
      setCountry('US'); // Reset to default
      setSubdivision('CA'); // Reset to default
      // Sandbox mode will reset to ON automatically on next app start
      // Navigate to login screen
      router.replace('/auth/login');
    }
  }, [signOut, router]);

  

  const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

  const [showWalletChoice, setShowWalletChoice] = useState(false);

  const handleRequestExport = () => {
    if (!effectiveIsSignedIn || (!evmWalletAddress && !solanaAddress)) return; // Allow export if either wallet exists

    if (isExpoGo) {
      setAlertState({
        visible: true,
        title: "Export not available",
        message: "Private key export is not available in Expo Go. Please use a development build or TestFlight.",
        type: "info",
      });
      return;
    }

    // If both wallets exist, show choice modal, otherwise export the available one
    if (evmWalletAddress && solanaAddress) {
      setShowWalletChoice(true);
    } else if (evmWalletAddress) {
      setExportType('evm');
      setShowExportConfirm(true);
    } else if (solanaAddress) {
      setExportType('solana');
      setShowExportConfirm(true);
    }
  };

  const handleConfirmedExport = async () => {
    // Check if this is a test account (TestFlight)
    if (isTestSessionActive()) {
      console.log('🧪 Test account - exporting mock seed phrase');
      setExporting(true);
      try {
        // Copy mock seed phrase to clipboard
        await Clipboard.setStringAsync(TEST_ACCOUNTS.seedPhrase);
        setAlertState({
          visible: true,
          title: "Mock Seed Phrase Copied (TestFlight)",
          message: `This is a mock seed phrase for TestFlight testing only:\n\n"${TEST_ACCOUNTS.seedPhrase}"\n\nNo real wallet exists. This is for demonstration purposes only.`,
          type: "info",
        });
      } catch (e) {
        setAlertState({
          visible: true,
          title: "Export failed",
          message: "Unable to copy mock seed phrase to clipboard.",
          type: "error",
        });
      } finally {
        setExporting(false);
        setShowExportConfirm(false);
      }
      return;
    }

    // Real account export flow
    const isEvmExport = exportType === 'evm';
    const targetAddress = isEvmExport ? evmWalletAddress : solanaAddress;

    if (!targetAddress) {
      setAlertState({
        visible: true,
        title: "Export failed",
        message: `No ${isEvmExport ? 'EVM' : 'Solana'} address found for export.`,
        type: "error",
      });
      return;
    }

    setExporting(true);
    try {
      console.log(`Exporting ${isEvmExport ? 'EVM' : 'Solana'} wallet:`, targetAddress);
      let result;
      if (isEvmExport) {
        // Use the EVM address string - this is what CDP expects
        result = await exportEvmAccount({ evmAccount: evmWalletAddress! as `0x${string}` });
      } else {
        // Export Solana wallet
        result = await exportSolanaAccount({ solanaAccount: solanaAddress! });
      }

      await Clipboard.setStringAsync(result.privateKey);
      setAlertState({
        visible: true,
        title: "Private key copied",
        message: `Your ${isEvmExport ? 'EVM' : 'Solana'} private key has been copied to the clipboard. Store it securely and clear your clipboard.`,
        type: "info",
      });
    } catch (e) {
      console.error('Export Error Details:', e);

      // Get detailed error information
      let errorMessage = "Unable to export private key.";
      let errorDetails = "";

      if (e instanceof Error) {
        errorMessage = e.message;
        errorDetails = `\n\nError Type: ${e.name}`;
        if (e.stack) {
          // Show first few lines of stack for debugging
          const stackLines = e.stack.split('\n').slice(0, 3);
          errorDetails += `\nStack: ${stackLines.join('\n')}`;
        }
      } else if (typeof e === 'object' && e !== null) {
        errorMessage = JSON.stringify(e, null, 2);
      } else {
        errorMessage = String(e);
      }

      setAlertState({
        visible: true,
        title: "Export failed",
        message: `${errorMessage}${errorDetails}\n\nWallet: ${isEvmExport ? 'EVM' : 'Solana'}\nAddress: ${targetAddress}`,
        type: "error",
      });
    } finally {
      setExporting(false);
      setShowExportConfirm(false);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Initializing wallet...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ flex: 1, backgroundColor: CARD_BG }}
          contentContainerStyle={{ padding: 20, gap: 24}}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          bounces={true}
          overScrollMode="always"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.container}>
            {/* Account card */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Embedded wallet</Text>

              {signedButNoSA ? (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subValue}>Wallet creation in progress</Text>
                    <Text style={styles.subHint}>
                      {isExpoGo
                        ? "Wallet creation is limited in Expo Go. Please use an email address that has been verified for embedded wallet creation previously, or use a development build/TestFlight to create new wallets."
                        : "Please wait while your embedded wallet is being created. This may take a few moments."}
                    </Text>
                  </View>

                  <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                    <Text style={styles.buttonTextSecondary}>Sign out</Text>
                  </Pressable>
                </View>
              ) : !effectiveIsSignedIn ? (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subValue}>No wallet connected</Text>
                    <Text style={styles.subHint}>Sign in with email to create your embedded wallet</Text>
                  </View>
                  <Pressable
                    style={[styles.button]}
                    onPress={() => router.push('/email-verify')}
                  >
                    <Text style={styles.buttonText}>Connect wallet</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subHint}>Email address {testSession && '(TestFlight)'}</Text>
                    <Text style={styles.subValue}>{displayEmail}</Text>
                  </View>

                  {/* Link Email Button (show if user signed in with phone only) */}
                  {!currentUser?.authenticationMethods.email?.email && !testSession && (
                    <Pressable style={styles.button} onPress={openEmailLink}>
                      <Text style={styles.buttonText}>Link Email</Text>
                    </Pressable>
                  )}

                  {/* Phone Number Section */}
                  <View style={styles.subBox}>
                    <Text style={styles.subHint}>Phone number {testSession && '(TestFlight)'}</Text>
                    <Text style={styles.subValue}>
                      {(() => {
                        const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;

                        if (!cdpPhone) return 'No phone linked';

                        const cdpPhoneFormatted = formatPhoneDisplay(cdpPhone);

                        // Check if CDP phone matches verified phone and is fresh
                        const isVerified = verifiedPhone === cdpPhone && phoneFresh;
                        const isExpired = verifiedPhone === cdpPhone && !phoneFresh;

                        if (isVerified) return cdpPhoneFormatted;
                        if (isExpired) return `${cdpPhoneFormatted} (expired)`;
                        return `${cdpPhoneFormatted} (needs verification)`;
                      })()}
                    </Text>
                    {(() => {
                      const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;
                      if (!cdpPhone) return null;

                      const isVerified = verifiedPhone === cdpPhone && phoneFresh;
                      const isExpired = verifiedPhone === cdpPhone && !phoneFresh;

                      if (isVerified) {
                        return (
                          <Text style={styles.subHint}>
                            Verified for Apple Pay • expires in {d} day{d===1?'':'s'}
                          </Text>
                        );
                      } else if (isExpired) {
                        return (
                          <Text style={styles.subHint}>
                            Verification expired • Re-verify below for Apple Pay
                          </Text>
                        );
                      } else {
                        return (
                          <Text style={styles.subHint}>
                            Linked to account • Verify below to use with Apple Pay
                          </Text>
                        );
                      }
                    })()}
                  </View>

                  {/* Phone Link/Verify Buttons */}
                  {(() => {
                    const cdpPhone = currentUser?.authenticationMethods?.sms?.phoneNumber;

                    console.log('📱 [PHONE BUTTON] Debug:', {
                      cdpPhone,
                      verifiedPhone,
                      phoneFresh,
                      testSession,
                      match: verifiedPhone === cdpPhone
                    });

                    // Skip button for test sessions
                    if (testSession) return null;

                    // No phone in CDP → Link Phone
                    if (!cdpPhone) {
                      return (
                        <Pressable style={styles.button} onPress={openPhoneVerify}>
                          <Text style={styles.buttonText}>Link Phone</Text>
                        </Pressable>
                      );
                    }

                    // Has CDP phone but verified and fresh → No button needed
                    if (verifiedPhone === cdpPhone && phoneFresh) {
                      return null;
                    }

                    // Has CDP phone but not verified or expired → Show verify/re-verify
                    const isExpired = verifiedPhone === cdpPhone && !phoneFresh;
                    return (
                      <Pressable style={styles.button} onPress={openPhoneVerify}>
                        <Text style={styles.buttonText}>
                          {isExpired ? 'Re-verify phone' : 'Verify phone'}
                        </Text>
                      </Pressable>
                    );
                  })()}

                  {smartAccountAddress && (
                    <View style={[styles.subBox, { flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.subHint}>EVM Smart Account Address (used for transactions)</Text>
                        <Text
                          selectable
                          style={styles.subValue}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {smartAccountAddress}
                        </Text>
                      </View>
                      <Pressable
                        onPress={async () => {
                          await Clipboard.setStringAsync(smartAccountAddress || '');
                          setAlertState({
                            visible: true,
                            title: "Address copied",
                            message: "Smart Account address copied to clipboard",
                            type: "info",
                          });
                        }}
                        style={styles.copyButton}
                      >
                        <Ionicons name="copy-outline" size={20} color={BLUE} />
                      </Pressable>
                    </View>
                  )}

                  {explicitEOAAddress && (
                    <View style={[styles.subBox, { flexDirection: 'row', alignItems: 'center' }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.subHint}>EVM EOA Address (owner of Smart Account)</Text>
                        <Text
                          selectable
                          style={styles.subValue}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {explicitEOAAddress}
                        </Text>
                      </View>
                      <Pressable
                        onPress={async () => {
                          await Clipboard.setStringAsync(explicitEOAAddress || '');
                          setAlertState({
                            visible: true,
                            title: "Address copied",
                            message: "EOA address copied to clipboard",
                            type: "info",
                          });
                        }}
                        style={styles.copyButton}
                      >
                        <Ionicons name="copy-outline" size={20} color={BLUE} />
                      </Pressable>
                    </View>
                  )}

                  {solanaAddress && (
                    <View style={[styles.subBox, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.subHint}>Solana wallet address</Text>
                      <Text
                        selectable
                        style={styles.subValue}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {solanaAddress}
                      </Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        await Clipboard.setStringAsync(solanaAddress || '');
                        setAlertState({
                          visible: true,
                          title: "Address copied",
                          message: "Solana wallet address copied to clipboard",
                          type: "info",
                        });
                      }}
                      style={styles.copyButton}
                    >
                      <Ionicons name="copy-outline" size={20} color={BLUE} />
                    </Pressable>
                  </View>
                  )}

                  <Pressable
                    style={[
                      styles.button,
                      { backgroundColor: '#DC2626' },
                      (isExpoGo || (!evmWalletAddress && !solanaAddress) || exporting) && styles.buttonDisabled
                    ]}
                    onPress={handleRequestExport}
                    disabled={(!evmWalletAddress && !solanaAddress) || exporting}
                  >
                    <Text style={styles.buttonText}>
                      {exporting ? "Exporting..." : isExpoGo ? "Export unavailable (Expo Go)" : "Export private key"}
                    </Text>
                  </Pressable>

                  <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                    <Text style={styles.buttonTextSecondary}>Sign out</Text>
                  </Pressable>
                </View>
              )}
            </View>
            {/* Wallet Balances - show when wallet is connected */}
            {effectiveIsSignedIn && primaryAddress && (
              <View style={styles.card}>
                <Pressable
                  onPress={() => setBalancesExpanded(!balancesExpanded)}
                  style={styles.row}
                >
                  <Text style={styles.rowLabel}>Wallet Balances</Text>
                  <Ionicons
                    name={balancesExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={TEXT_SECONDARY}
                  />
                </Pressable>

                <Text style={styles.helper}>
                  Showing balances for Base, Ethereum, and Solana mainnet
                </Text>

                {balancesExpanded && (
                  <>
                    {loadingBalances && (
                      <View style={{ marginTop: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={BLUE} />
                        <Text style={[styles.subHint, { marginTop: 8 }]}>Loading balances...</Text>
                      </View>
                    )}

                    {balancesError && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.helper, { color: '#FF6B6B' }]}>{balancesError}</Text>
                        <Pressable style={[styles.button, { marginTop: 8 }]} onPress={fetchBalances}>
                          <Text style={styles.buttonText}>Retry</Text>
                        </Pressable>
                      </View>
                    )}

                    {!loadingBalances && !balancesError && balances.length === 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.subHint, { textAlign: 'center' }]}>
                          No tokens found. Purchase crypto to see your balances.
                        </Text>
                        <Pressable style={[styles.button, { marginTop: 12 }]} onPress={fetchBalances}>
                          <Text style={styles.buttonText}>Refresh Balances</Text>
                        </Pressable>
                      </View>
                    )}

                    {!loadingBalances && !balancesError && balances.length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        {balances.map((balance, index) => {
                          const symbol = balance.token?.symbol || 'UNKNOWN';
                          const amount = parseFloat(balance.amount?.amount || '0');
                          const decimals = parseInt(balance.amount?.decimals || '0');
                          const actualAmount = amount / Math.pow(10, decimals);
                          const formattedAmount = actualAmount.toFixed(6);
                          const usdValue = balance.usdValue;
                          const network = balance.network;

                          return (
                            <View
                              key={`${balance.token?.contractAddress || balance.token?.mintAddress}-${index}`}
                              style={[
                                styles.tokenRow,
                                index < balances.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER }
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.tokenSymbol}>{symbol}</Text>
                                <Text style={styles.tokenNetwork}>{network}</Text>
                              </View>

                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.tokenAmount}>{formattedAmount}</Text>
                                {usdValue ? (
                                  <Text style={styles.tokenUsd}>${usdValue.toFixed(2)}</Text>
                                ) : (
                                  <Text style={styles.tokenUsd}>Price N/A</Text>
                                )}
                                {(() => {
                                  // Check if this is a Solana SPL token (has mintAddress)
                                  const isSolanaNetwork = network?.toLowerCase().includes('solana');
                                  const isSPLToken = isSolanaNetwork && balance.token?.mintAddress;
                                  const isDevnet = network?.toLowerCase().includes('devnet');

                                  // SPL tokens only supported on devnet
                                  if (isSPLToken && !isDevnet) {
                                    return (
                                      <Text style={[styles.tokenUsd, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
                                        Transfer not supported on mainnet
                                      </Text>
                                    );
                                  }

                                  return (
                                    <Pressable
                                      style={[
                                        styles.button,
                                        { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
                                        isExpoGo && styles.buttonDisabled
                                      ]}
                                      onPress={() => {
                                        if (isExpoGo) {
                                          setAlertState({
                                            visible: true,
                                            title: "Transfer not available",
                                            message: "Crypto transfers are not available in Expo Go due to missing crypto.subtle package. Please use TestFlight or a development build.",
                                            type: "info",
                                          });
                                          return;
                                        }
                                        // Navigate to transfer page with token data
                                        router.push({
                                          pathname: '/transfer',
                                          params: {
                                            token: JSON.stringify(balance),
                                            network: network.toLowerCase()
                                          }
                                        });
                                      }}
                                      disabled={isExpoGo}
                                    >
                                      <Text style={[styles.buttonText, { fontSize: 12 }]}>
                                        {isExpoGo ? "Transfer unavailable (Expo Go)" : "Transfer"}
                                      </Text>
                                    </Pressable>
                                  );
                                })()}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Testnet Balances - show when wallet is connected */}
            {effectiveIsSignedIn && (primaryAddress || solanaAddress) && (
              <View style={styles.card}>
                <Pressable
                  onPress={() => setTestnetBalancesExpanded(!testnetBalancesExpanded)}
                  style={styles.row}
                >
                  <Text style={styles.rowLabel}>🧪 Testnet Balances</Text>
                  <Ionicons
                    name={testnetBalancesExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={TEXT_SECONDARY}
                  />
                </Pressable>

                <Text style={styles.helper}>
                  Showing balances for Base Sepolia, Ethereum Sepolia, and Solana Devnet
                </Text>

                {testnetBalancesExpanded && (
                  <>
                    {loadingTestnetBalances && (
                      <View style={{ marginTop: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={BLUE} />
                        <Text style={[styles.subHint, { marginTop: 8 }]}>Loading testnet balances...</Text>
                      </View>
                    )}

                    {testnetBalancesError && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.helper, { color: '#FF6B6B' }]}>{testnetBalancesError}</Text>
                        <Pressable style={[styles.button, { marginTop: 8 }]} onPress={fetchTestnetBalances}>
                          <Text style={styles.buttonText}>Retry</Text>
                        </Pressable>
                      </View>
                    )}

                    {!loadingTestnetBalances && !testnetBalancesError && testnetBalances.length === 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.subHint, { textAlign: 'center', marginBottom: 12 }]}>
                          No testnet tokens found. Get free testnet tokens from the faucets below.
                        </Text>

                        {/* Faucet buttons */}
                        <View style={{ gap: 8 }}>
                          {primaryAddress && (
                            <>
                              <Pressable
                                style={[styles.button, { backgroundColor: VIOLET }]}
                                onPress={() => {
                                  const faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${primaryAddress}&network=base-sepolia`;
                                  Linking.openURL(faucetUrl);
                                }}
                              >
                                <Ionicons name="water-outline" size={16} color={WHITE} style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>Get Base Sepolia ETH</Text>
                              </Pressable>

                              <Pressable
                                style={[styles.button, { backgroundColor: VIOLET }]}
                                onPress={() => {
                                  const faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${primaryAddress}&network=ethereum-sepolia`;
                                  Linking.openURL(faucetUrl);
                                }}
                              >
                                <Ionicons name="water-outline" size={16} color={WHITE} style={{ marginRight: 8 }} />
                                <Text style={styles.buttonText}>Get Ethereum Sepolia ETH</Text>
                              </Pressable>
                            </>
                          )}

                          {solanaAddress && (
                            <Pressable
                              style={[styles.button, { backgroundColor: VIOLET }]}
                              onPress={() => {
                                const faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${solanaAddress}&network=solana-devnet`;
                                Linking.openURL(faucetUrl);
                              }}
                            >
                              <Ionicons name="water-outline" size={16} color={WHITE} style={{ marginRight: 8 }} />
                              <Text style={styles.buttonText}>Get Solana Devnet SOL</Text>
                            </Pressable>
                          )}
                        </View>

                        <Pressable style={[styles.button, { marginTop: 12 }]} onPress={fetchTestnetBalances}>
                          <Text style={styles.buttonText}>Refresh Testnet Balances</Text>
                        </Pressable>
                      </View>
                    )}

                    {!loadingTestnetBalances && !testnetBalancesError && testnetBalances.length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        {/* Group balances by network */}
                        {['Base Sepolia', 'Ethereum Sepolia', 'Solana Devnet'].map(networkName => {
                          const networkBalances = testnetBalances.filter(b => b.network === networkName);
                          if (networkBalances.length === 0) return null;

                          return (
                            <View key={networkName} style={{ marginBottom: 24 }}>
                              {/* Network header */}
                              <View style={styles.networkHeader}>
                                <Text style={styles.networkTitle}>{networkName}</Text>
                                {/* Faucet button per network */}
                                <Pressable
                                  style={styles.faucetIconButton}
                                  onPress={() => {
                                    let faucetUrl;
                                    const address = networkName.includes('Solana') ? solanaAddress : primaryAddress;
                                    const networkParam = networkName === 'Base Sepolia' ? 'base-sepolia'
                                      : networkName === 'Ethereum Sepolia' ? 'ethereum-sepolia'
                                      : 'solana-devnet';
                                    faucetUrl = `https://portal.cdp.coinbase.com/products/faucet?address=${address}&network=${networkParam}`;
                                    Linking.openURL(faucetUrl);
                                  }}
                                >
                                  <Ionicons name="water-outline" size={18} color={VIOLET} />
                                </Pressable>
                              </View>

                              {/* Tokens for this network */}
                              {networkBalances.map((balance, index) => {
                                const symbol = balance.token?.symbol || 'UNKNOWN';
                                const amount = parseFloat(balance.amount?.amount || '0');
                                const decimals = parseInt(balance.amount?.decimals || '0');
                                const actualAmount = amount / Math.pow(10, decimals);
                                const formattedAmount = actualAmount.toFixed(6);
                                const usdValue = balance.usdValue;

                                return (
                                  <View
                                    key={`${balance.token?.contractAddress || balance.token?.mintAddress}-${index}`}
                                    style={[
                                      styles.tokenRow,
                                      index < networkBalances.length - 1 && { borderBottomWidth: 1, borderBottomColor: BORDER }
                                    ]}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.tokenSymbol}>{symbol}</Text>
                                      {balance.token?.name && (
                                        <Text style={styles.tokenName}>{balance.token.name}</Text>
                                      )}
                                    </View>

                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={styles.tokenAmount}>{formattedAmount}</Text>
                                      {usdValue ? (
                                        <Text style={styles.tokenUsd}>${usdValue.toFixed(2)}</Text>
                                      ) : (
                                        <Text style={styles.tokenUsd}>Testnet</Text>
                                      )}
                                      <Pressable
                                        style={[
                                          styles.button,
                                          { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
                                          isExpoGo && styles.buttonDisabled
                                        ]}
                                        onPress={() => {
                                          if (isExpoGo) {
                                            setAlertState({
                                              visible: true,
                                              title: "Transfer not available",
                                              message: "Crypto transfers are not available in Expo Go due to missing crypto.subtle package. Please use TestFlight or a development build.",
                                              type: "info",
                                            });
                                            return;
                                          }
                                          // Navigate to transfer page with token data
                                          router.push({
                                            pathname: '/transfer',
                                            params: {
                                              token: JSON.stringify(balance),
                                              network: networkName.toLowerCase().replace(' ', '-')
                                            }
                                          });
                                        }}
                                        disabled={isExpoGo}
                                      >
                                        <Text style={[styles.buttonText, { fontSize: 12 }]}>
                                          {isExpoGo ? "Transfer unavailable (Expo Go)" : "Transfer"}
                                        </Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Fallback sign out for edge cases */}
            {effectiveIsSignedIn && !signedButNoSA && !primaryAddress && (
              <View style={styles.card}>
                <Text style={styles.rowLabel}>Session Management</Text>
                <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                  <Text style={styles.buttonTextSecondary}>Sign out</Text>
                </Pressable>
              </View>
            )}


            {/* Sandbox Wallet Card - show when sandbox mode is enabled */}
            {localSandboxEnabled && (
              <View style={styles.card}>
                <Text style={styles.rowLabel}>🧪 Sandbox Testing</Text>

                <View style={styles.subBox}>
                  <Text style={styles.subHint}>Manual Wallet Address (Optional Override)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 8 }]}
                      value={manualAddress}
                      onChangeText={setManualAddress}
                      placeholder="Enter any wallet address for testing"
                      placeholderTextColor={TEXT_SECONDARY}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {manualAddress ? (
                      <Pressable
                        style={styles.pasteButton}
                        onPress={() => setManualAddress('')}
                      >
                        <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.pasteButton}
                        onPress={async () => {
                          const text = await Clipboard.getStringAsync();
                          if (text) setManualAddress(text);
                        }}
                      >
                        <Ionicons name="clipboard-outline" size={20} color={BLUE} />
                      </Pressable>
                    )}
                  </View>
                </View>
                <Text style={styles.helper}>
                  ⚠️ Manual address will be cleared when switching to production mode. In sandbox mode, you can input any address to override your connected wallet for testing purposes.
                </Text>
              </View>
            )}

            {/* Wallet choice modal - shown when user has both EVM and Solana wallets */}
            <Modal
              visible={showWalletChoice}
              transparent
              animationType="fade"
              onRequestClose={() => setShowWalletChoice(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Choose Wallet Type</Text>
                  <Text style={styles.modalMessage}>
                    Which wallet would you like to export?
                  </Text>

                  <View style={styles.modalButtonsVertical}>
                    <Pressable
                      style={[styles.button, styles.modalButton, { backgroundColor: BLUE }]}
                      onPress={() => {
                        setExportType('evm');
                        setShowWalletChoice(false);
                        setShowExportConfirm(true);
                      }}
                    >
                      <Text style={styles.buttonText}>Export EVM Wallet</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, styles.modalButton, { backgroundColor: BLUE }]}
                      onPress={() => {
                        setExportType('solana');
                        setShowWalletChoice(false);
                        setShowExportConfirm(true);
                      }}
                    >
                      <Text style={styles.buttonText}>Export Solana Wallet</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, styles.modalButton, { backgroundColor: BORDER }]}
                      onPress={() => setShowWalletChoice(false)}
                    >
                      <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Export confirm modal */}
            <Modal
              visible={showExportConfirm}
              transparent
              animationType="fade"
              onRequestClose={() => setShowExportConfirm(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Export Private Key</Text>
                  <Text style={styles.modalMessage}>
                    Your private key will be copied to the clipboard. Keep it secure and never share it with anyone.
                  </Text>

                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.button, { backgroundColor: BORDER, flex: 1 }]}
                      onPress={() => setShowExportConfirm(false)}
                    >
                      <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Cancel</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.button, { backgroundColor: '#DC2626', flex: 1 }]}
                      onPress={handleConfirmedExport}
                      disabled={exporting}
                    >
                      <Text style={styles.buttonText}>
                        {exporting ? "Exporting..." : "Export"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            <CoinbaseAlert
              visible={alertState.visible}
              title={alertState.title}
              message={alertState.message}
              type={alertState.type}
              onConfirm={() => setAlertState({ ...alertState, visible: false })}
            />

            {/* Production switch confirmation alert */}
            <Modal
              visible={productionSwitchAlertVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setProductionSwitchAlertVisible(false)}
            >
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Pressable
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => setProductionSwitchAlertVisible(false)}
                />
                <View style={styles.productionAlertCard}>
                  <View style={styles.alertHandle} />
                  <View style={styles.alertIconContainer}>
                    <Ionicons name="information-circle" size={48} color={BLUE} />
                  </View>
                  <Text style={styles.alertTitle}>Switch to Production?</Text>
                  <Text style={styles.alertMessage}>
                    Your manual wallet address will be cleared when switching to production mode.
                  </Text>
                  <View style={styles.alertButtonRow}>
                    <Pressable
                      style={({ pressed }) => [styles.alertCancelButton, pressed && styles.buttonPressed]}
                      onPress={() => setProductionSwitchAlertVisible(false)}
                    >
                      <Text style={styles.alertCancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.alertConfirmButton, pressed && styles.buttonPressed]}
                      onPress={() => {
                        setProductionSwitchAlertVisible(false);
                        setLocalSandboxEnabled(false);
                        setSandboxMode(false);
                        clearManualAddress();
                        setManualAddress('');
                      }}
                    >
                      <Text style={styles.alertConfirmButtonText}>Confirm</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 24,
  },
  rowLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 8,
  },
  subBox: {
    backgroundColor: CARD_BG,
    padding: 12,
    gap: 12,
    marginBottom: 8,
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  subValue: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  subHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    backgroundColor: BLUE,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 36,
    flexDirection: 'row',
  },
  modalButton: {
    marginTop: 0,
  },
  textContainer: {
    flex: 1,           
    marginRight: 12,  
  },
  productionWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  primary: {
    backgroundColor: BLUE,
  },
  secondary: {
    backgroundColor: BORDER,
  },
  buttonText: {
    color: WHITE,
    fontSize: 14,              
    fontWeight: '600',
    letterSpacing: 0.1,          
  },
  buttonSecondary: {
    backgroundColor: BORDER,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 36,
  },
  buttonTextSecondary: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  container: {
    flex: 1,
    backgroundColor: CARD_BG,
  },
  authContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  walletContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    color: TEXT_PRIMARY,
    padding: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonDanger: {
    backgroundColor: '#DC2626',     // Proper red (not too bright)
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 36,
  },
  helper: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 8,
    lineHeight: 16,
  },
  signOutButton: {
    backgroundColor: '#f44336',
    marginTop: 20,
  },
  subContainer: {
    marginBottom: 4,
  },
  loadingText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  message: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rowValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1
  },
  rowAction: {
    backgroundColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  rowActionText: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  modalMessage: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonsVertical: {
    flexDirection: 'column',
    gap: 8,
  },
  pillSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    minWidth: 80,
    maxWidth: 140,
  },
    pillText: {
      fontSize: 14,
      fontWeight: "500",
      color: TEXT_PRIMARY,
    },
    selectContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    modalSheet: {
      backgroundColor: CARD_BG,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "75%",
      width: "100%",
      minHeight: 280,
      paddingBottom: 20,
      paddingTop: 8,
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: BORDER,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 16,
    },
    modalItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    modalItemSelected: {
      backgroundColor: BLUE + "15",
    },
    modalItemText: {
    fontSize: 18,
    fontWeight: "500",
    color: TEXT_PRIMARY,
    flex: 1,
    },
    modalItemTextSelected: {
      color: BLUE,
      fontWeight: "600",
    },
    modalScrollView: {
      maxHeight: 400,
    },
    modalItemContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    tokenRow: {
      flexDirection: 'row',
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tokenSymbol: {
      fontSize: 18,
      fontWeight: '700',
      color: TEXT_PRIMARY,
      marginBottom: 4,
    },
    tokenName: {
      fontSize: 14,
      color: TEXT_SECONDARY,
      marginBottom: 2,
    },
    tokenNetwork: {
      fontSize: 12,
      color: TEXT_SECONDARY,
      fontStyle: 'italic',
    },
    tokenAmount: {
      fontSize: 16,
      fontWeight: '600',
      color: TEXT_PRIMARY,
      marginBottom: 4,
    },
    tokenUsd: {
      fontSize: 14,
      color: TEXT_SECONDARY,
      marginBottom: 4,
    },
  // Network grouping styles
  networkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: BORDER,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  networkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  faucetIconButton: {
    padding: 8,
    backgroundColor: 'rgba(105, 145, 255, 0.2)', // VIOLET with opacity
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Production switch alert styles (matching CoinbaseAlert)
  productionAlertCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    minHeight: 220,
  },
  alertHandle: {
    width: 36,
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 2,
    marginBottom: 20,
    alignSelf: 'center',
  },
  alertIconContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  alertButtonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: BORDER,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  alertConfirmButton: {
    flex: 1,
    backgroundColor: BLUE,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  alertCancelButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  alertConfirmButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});