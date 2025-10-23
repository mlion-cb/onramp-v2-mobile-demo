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
  useSignOut,
  useSolanaAddress,
} from "@coinbase/cdp-hooks";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { BASE_URL } from "../../constants/BASE_URL";
import { COLORS } from "../../constants/Colors";
import { TEST_ACCOUNTS } from "../../constants/TestAccounts";
import { clearManualAddress, clearTestSession, daysUntilExpiry, formatPhoneDisplay, getCountry, getManualWalletAddress, getSandboxMode, getSubdivision, getTestWalletEvm, getTestWalletSol, getVerifiedPhone, isPhoneFresh60d, isTestSessionActive, setCountry, setCurrentSolanaAddress, setCurrentWalletAddress, setManualWalletAddress, setSandboxMode, setSubdivision, setVerifiedPhone } from "../../utils/sharedState";

const { CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, BORDER, WHITE } = COLORS;

export default function WalletScreen() {
  // Check for test session first
  const testSession = isTestSessionActive();

  // CDP hooks (only used for real accounts)
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { signOut } = useSignOut();

  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    type: 'success' as 'success' | 'error' | 'info'
  });

  // Override CDP data if test session active
  const explicitEOAAddress = testSession ? getTestWalletEvm() : (currentUser?.evmAccounts?.[0] as string);
  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] as string;

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

  // Add debugging similar to working reference
  useEffect(() => {
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


  const [countries, setCountries] = useState<string[]>([]);
  const [usSubs, setUsSubs] = useState<string[]>([]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [subPickerVisible, setSubPickerVisible] = useState(false);
  const country = getCountry();
  const subdivision = getSubdivision();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(300)).current;
  const { buyConfig, fetchOptions } = useOnramp(); 

  const sandboxEnabled = getSandboxMode();
  const [localSandboxEnabled, setLocalSandboxEnabled] = useState(getSandboxMode());
  const [manualAddress, setManualAddress] = useState('');

  // Balance state
  const [balances, setBalances] = useState<any[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balancesExpanded, setBalancesExpanded] = useState(false);

  // sync local state with shared state on mount
  useEffect(() => {
    setLocalSandboxEnabled(getSandboxMode());
    // Load manual address if in sandbox mode
    const stored = getManualWalletAddress();
    if (sandboxEnabled && stored) {
      setManualAddress(stored);
    }
  }, [sandboxEnabled]);

  useEffect(() => {
    // Ensure this hook instance has loaded the config (only when signed in)
    if (!buyConfig && effectiveIsSignedIn) {
      fetchOptions();
    }
  }, [buyConfig, fetchOptions, effectiveIsSignedIn]);

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

  useEffect(() => {
    if (buyConfig?.countries) {
      const validCountries = buyConfig.countries.map((c: any) => c.id).filter(Boolean);
      setCountries(validCountries);

      const us = buyConfig.countries.find((c: any) => c.id === 'US');
      setUsSubs(us?.subdivisions || []);
    }
  }, [buyConfig]);

  useEffect(() => {
    const anyVisible = countryPickerVisible || subPickerVisible;
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: anyVisible ? 1 : 0, duration: anyVisible ? 200 : 150, useNativeDriver: true }),
      Animated[anyVisible ? "spring" : "timing"](sheetTranslate, {
        toValue: anyVisible ? 0 : 300,
        ...(anyVisible ? { useNativeDriver: true, damping: 20, stiffness: 90 } : { duration: 150, useNativeDriver: true }),
      }),
    ]).start();
  }, [countryPickerVisible, subPickerVisible]);

  const openPhoneVerify = useCallback(() => {
    router.push({
      pathname: '/phone-verify',
      params: { initialPhone: verifiedPhone || '' }
    });
  }, [router, verifiedPhone]);

  useEffect(() => {
    setCurrentWalletAddress(primaryAddress ?? null);
    setCurrentSolanaAddress(solanaAddress ?? null);
  }, [primaryAddress, solanaAddress]);

  // Fetch balances when wallet addresses are available
  const fetchBalances = useCallback(async () => {
    if (!primaryAddress && !solanaAddress) return;

    setLoadingBalances(true);
    setBalancesError(null);

    try {
      // Get access token from CDP (same as other API calls)
      const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');
      const accessToken = await getAccessTokenGlobal();

      if (!accessToken) {
        console.error('❌ [PROFILE] No access token available');
        setBalancesError('Authentication required');
        setLoadingBalances(false);
        return;
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
      console.log(`✅ [PROFILE] Loaded ${allBalances.length} token balances`);
    } catch (error) {
      console.error('❌ [PROFILE] Error fetching balances:', error);
      setBalancesError('Failed to load balances');
    } finally {
      setLoadingBalances(false);
    }
  }, [primaryAddress, solanaAddress]);

  // Fetch balances on mount and when addresses change
  useEffect(() => {
    if (effectiveIsSignedIn && (primaryAddress || solanaAddress)) {
      fetchBalances();
    }
  }, [effectiveIsSignedIn, primaryAddress, solanaAddress, fetchBalances]);

  // Re-fetch balances when profile tab comes into focus
  useFocusEffect(
    useCallback(() => {
      if (effectiveIsSignedIn && (primaryAddress || solanaAddress)) {
        console.log('🔄 [PROFILE] Tab focused - refreshing balances');
        fetchBalances();
      }
    }, [effectiveIsSignedIn, primaryAddress, solanaAddress, fetchBalances])
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
      setCurrentWalletAddress(null);
      setManualWalletAddress(null);
      await setVerifiedPhone(null);
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

  const unverifyPhone = async () => {
    await setVerifiedPhone(null);
    // Update local state immediately
    setVerifiedPhoneLocal(null);
    setPhoneFresh(false);
    setPhoneExpiry(-1);
    setAlertState({
      visible: true,
      title: "Phone removed",
      message: "Phone verification was cleared for this demo. You'll be asked to verify again on next purchase.",
      type: "info",
    });
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
              <Text style={styles.rowLabel}>Embedded wallet (by Email)</Text>

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

                  <View style={styles.subBox}>
                    <Text style={styles.subHint}>EVM wallet address</Text>
                    <Text selectable style={styles.subValue}>{primaryAddress}</Text>
                  </View>

                  {solanaAddress && (
                    <View style={styles.subBox}>
                      <Text style={styles.subHint}>Solana wallet address</Text>
                      <Text selectable style={styles.subValue}>{solanaAddress}</Text>
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
                  Showing balances for Base and Ethereum mainnet only
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
                          <Text style={styles.buttonText}>🔄 Refresh Balances</Text>
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
                                <Pressable
                                  style={[styles.button, { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 }]}
                                  onPress={() => {
                                    // Navigate to transfer page with token data
                                    router.push({
                                      pathname: '/transfer',
                                      params: {
                                        token: JSON.stringify(balance),
                                        network: network.toLowerCase()
                                      }
                                    });
                                  }}
                                >
                                  <Text style={[styles.buttonText, { fontSize: 12 }]}>Transfer</Text>
                                </Pressable>
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

            {/* Phone verification card */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Phone verification (for Apple Pay)</Text>

              <View style={styles.subBox}>
                <Text style={styles.subValue}>
                  {verifiedPhone ? (phoneFresh ? formattedPhone : `${formattedPhone} (expired)`) : 'No verified phone'}
                </Text>
                <Text style={styles.subHint}>
                  {verifiedPhone ? (phoneFresh ? `Verified • expires in ${d} day${d===1?'':'s'}` : 'Re-verify required') : 'Required before buying crypto'}
                </Text>
              </View>

              <Pressable style={[styles.button, phoneFresh ? { backgroundColor: BORDER } : null]} onPress={openPhoneVerify}>
                <Text style={[styles.buttonText, phoneFresh ? { color: TEXT_PRIMARY } : null]}>
                  {verifiedPhone ? (phoneFresh ? 'Update phone' : 'Re-verify phone') : 'Verify phone'}
                </Text>
              </Pressable>
              {verifiedPhone && (
                <Pressable
                  style={[styles.buttonSecondary, { backgroundColor: BORDER }]}
                  onPress={unverifyPhone}
                >
                  <Text style={[styles.buttonTextSecondary, { color: TEXT_PRIMARY }]}>Unlink Phone</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.rowLabel}>Region (for Onramp Options)</Text>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Country</Text>
                <Pressable style={styles.pillSelect} onPress={() => setCountryPickerVisible(true)}>
                  <View style={styles.selectContent}>
                    <Text style={styles.pillText}>{country}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
                </Pressable>
              </View>

              {country === "US" && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Text style={styles.rowLabel}>Subdivision</Text>
                  <Pressable style={styles.pillSelect} onPress={() => setSubPickerVisible(true)}>
                    <View style={styles.selectContent}>
                      <Text style={styles.pillText}>{subdivision}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.card}>
              
              <View style={styles.row}>
                <View style={styles.textContainer}>
                  <Text style={styles.rowValue}>{localSandboxEnabled ? 'Sandbox Environment' : 'Production Environment'}</Text>
                  <Text style={localSandboxEnabled ? styles.subHint : styles.productionWarning}>
                    {localSandboxEnabled ? 'Test Mode\n\nNo real transactions will be executed.\n\nYou may experience Onramp flow with optional phone and email verification.\n\nOnly Guest Checkout (Debit Card) will be available for Coinbase Widget.' : 'Production Mode\n\nReal transactions will be executed on chain and balances will be debited if successful.\n\nPhone and email vericiation required.'}
                  </Text>
                </View>
                <Switch
                  value={localSandboxEnabled}
                  onValueChange={(value) => {
                    if (!value && manualAddress) {
                      // Switching to production with manual address set - show confirmation
                      Alert.alert(
                        'Switch to Production?',
                        'Your manual wallet address will be cleared.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Confirm',
                            style: 'destructive',
                            onPress: () => {
                              setLocalSandboxEnabled(value);
                              setSandboxMode(value);
                              clearManualAddress();
                              setManualAddress('');
                            }
                          }
                        ]
                      );
                    } else {
                      setLocalSandboxEnabled(value); // Update local state (triggers re-render)
                      setSandboxMode(value); // Update shared state (for other components)
                    }
                  }}
                  trackColor={{ true: BLUE, false: BORDER }}
                  thumbColor={Platform.OS === "android" ? (sandboxEnabled ? "#ffffff" : "#f4f3f4") : undefined}
                />
              </View>
            </View>

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

            {/* Country picker modal */}
            <Modal visible={countryPickerVisible} transparent animationType="none" presentationStyle="overFullScreen" onRequestClose={() => setCountryPickerVisible(false)}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)", opacity: backdropOpacity }]}>
                  <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCountryPickerVisible(false)} />
                </Animated.View>

                <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslate }] }]}>
                  <View style={styles.modalHandle} />
                  <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {countries.map((c, index) => {
                      const isSelected = c === country;
                      return (
                        <Pressable
                          key={`country-${index}-${c}`}
                          onPress={() => {
                            setCountry(c);
                            if (c === 'US') {
                              const current = getSubdivision();
                              setSubdivision(current || 'CA');
                            } else {
                            setSubdivision("");
                            }
                            setCountryPickerVisible(false);
                          }}
                          style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        >
                          <View style={styles.modalItemContent}>
                            <View style={styles.modalItemLeft}>
                              <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{c}</Text>
                            </View>
                            {isSelected && <Ionicons name="checkmark" size={20} color={BLUE} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              </View>
            </Modal>

            {/* Subdivision picker modal */}
            <Modal visible={subPickerVisible} transparent animationType="none" presentationStyle="overFullScreen" onRequestClose={() => setSubPickerVisible(false)}>
              <View style={{ flex: 1, justifyContent: "flex-end" }}>
                <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)", opacity: backdropOpacity }]}>
                  <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSubPickerVisible(false)} />
                </Animated.View>

                <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslate }] }]}>
                  <View style={styles.modalHandle} />
                  <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                    {usSubs.map((s, index) => {
                      const isSelected = s === subdivision;
                      return (
                        <Pressable
                          key={`sub-${index}-${s}`}
                          onPress={() => {
                            setSubdivision(s);
                            setSubPickerVisible(false);
                          }}
                          style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        >
                          <View style={styles.modalItemContent}>
                            <View style={styles.modalItemLeft}>
                              <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{s}</Text>
                            </View>
                            {isSelected && <Ionicons name="checkmark" size={20} color={BLUE} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              </View>
            </Modal>

            <CoinbaseAlert
              visible={alertState.visible}
              title={alertState.title}
              message={alertState.message}
              type={alertState.type}
              onConfirm={() => setAlertState({ ...alertState, visible: false })}
            />
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
    gap: 6,
    marginBottom: 8,
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
});