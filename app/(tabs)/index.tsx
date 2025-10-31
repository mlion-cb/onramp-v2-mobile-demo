/**
 * ============================================================================
 * HOME/INDEX - MAIN ONRAMP PAGE (Tab 1)
 * ============================================================================
 *
 * This is the main page where users purchase crypto. It coordinates:
 * - OnrampForm component (user input)
 * - useOnramp hook (API calls)
 * - ApplePayWidget component (payment processing)
 * - Wallet connection state
 *
 * ADDRESS STATE MANAGEMENT (Critical for UX):
 *
 * Three address-related states:
 * 1. address: Current form input (what user sees in form)
 * 2. connectedAddress: Wallet connection status (for "Connected" button)
 * 3. isConnected: Derived boolean (has ANY wallet, regardless of network support)
 *
 * Why separate states?
 * - address: Can be empty for unsupported networks (Bitcoin in prod)
 * - connectedAddress: Still valid (user HAS a wallet, just wrong type)
 * - isConnected: Shows "Connected" button (user is signed in with wallet)
 *
 * Example:
 * - User has EVM wallet, selects Bitcoin network
 * - address: "" (no EVM wallet works for Bitcoin)
 * - connectedAddress: "0x1234..." (still has EVM wallet)
 * - isConnected: true (shows "Connected" button, not "Connect Wallet")
 *
 * NETWORK POLLING (200ms interval):
 *
 * Polls getCurrentNetwork() to detect changes from OnrampForm:
 * 1. Form dropdown changes network
 * 2. setCurrentNetwork() called in sharedState
 * 3. Polling detects change (trackedNetwork !== currentNetwork)
 * 4. Calls getCurrentWalletAddress() for new network
 * 5. Updates address and connectedAddress
 *
 * Why polling instead of callback?
 * - Shared state is global (not React state)
 * - Multiple components can change network
 * - Polling ensures all components stay in sync
 * - 200ms is fast enough for real-time feel, low overhead
 *
 * PHONE VERIFICATION FLOW (Apple Pay only):
 *
 * Decision tree for submission:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ User clicks "Swipe to Deposit"                              │
 * │   ↓                                                         │
 * │ Payment method?                                             │
 * │   ├─ Widget → createWidgetSession() → Browser (NO PHONE)   │
 * │   └─ Apple Pay → Check phone verification:                 │
 * │       ├─ Sandbox → Use mock phone (+12345678901)           │
 * │       └─ Production:                                        │
 * │           ├─ Has fresh phone? → createOrder()              │
 * │           └─ No phone? → setPendingForm() → /phone-verify  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * PENDING FORM RESUMPTION:
 *
 * When user returns from phone verification:
 * 1. useFocusEffect detects tab focus
 * 2. Checks getPendingForm() for saved form data
 * 3. If Widget: Creates session immediately (no phone needed)
 * 4. If Apple Pay: Verifies phone is fresh, then creates order
 * 5. Clears pending form to prevent re-processing
 *
 * WALLET INITIALIZATION (Multiple sources):
 *
 * CDP wallets can come from multiple sources:
 * - currentUser.evmAccounts[0]: EOA (Externally Owned Account)
 * - currentUser.evmSmartAccounts[0]: Smart Account (Account Abstraction)
 * - currentUser.solanaAccounts[0]: Solana account
 * - evmAddress hook: Fallback EVM address
 * - solanaAddress hook: Fallback Solana address
 *
 * Priority for setting shared state:
 * EVM: evmEOA > evmSmartAccount > evmAddress hook
 * SOL: solanaAccounts[0] > solanaAddress hook
 *
 * This runs in multiple useEffects to handle:
 * - Initial load (may take 5s for wallet creation)
 * - Tab focus (user might verify in another tab)
 * - Network changes (switch between EVM/SOL)
 *
 * @see components/onramp/OnrampForm.tsx for form UI
 * @see components/onramp/ApplePayWidget.tsx for payment WebView
 * @see hooks/useOnramp.ts for API calls
 * @see utils/sharedState.ts for address resolution
 */

import { useCurrentUser, useEvmAddress, useIsSignedIn, useSolanaAddress } from "@coinbase/cdp-hooks";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../../components";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { clearPhoneVerifyWasCanceled, getCountry, getCurrentNetwork, getCurrentWalletAddress, getPendingForm, getPhoneVerifyWasCanceled, getSandboxMode, getSubdivision, getTestWalletEvm, getTestWalletSol, getVerifiedPhone, isPhoneFresh60d, isTestSessionActive, setCountry, setCurrentSolanaAddress, setCurrentWalletAddress, setPendingForm, setSandboxMode, setSubdivision } from "../../utils/sharedState";
import Ionicons from "@expo/vector-icons/Ionicons";


const { BLUE, DARK_BG, CARD_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, WHITE } = COLORS;

function generateMockAddress(): string {
  const hexChars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 40; i++) {
    const idx = Math.floor(Math.random() * hexChars.length);
    result += hexChars[idx];
  }
  return result;
}

export default function Index() {
  const [address, setAddress] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [sandboxMode, setSandboxModeState] = useState(getSandboxMode());
  const router = useRouter();
  const pendingForm = getPendingForm();

  // Region state
  const [countries, setCountries] = useState<string[]>([]);
  const [usSubs, setUsSubs] = useState<string[]>([]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [subPickerVisible, setSubPickerVisible] = useState(false);
  const country = getCountry();
  const subdivision = getSubdivision();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(300)).current;


  // Check for test session first
  const testSession = isTestSessionActive();

  // CDP hooks (overridden for test session)
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { evmAddress: cdpEvmAddress } = useEvmAddress();
  const { solanaAddress: cdpSolanaAddress } = useSolanaAddress();
  const [connectedAddress, setConnectedAddress] = useState('');

  // Override addresses for test session
  const evmAddress = testSession ? getTestWalletEvm() : cdpEvmAddress;
  const solanaAddress = testSession ? getTestWalletSol() : cdpSolanaAddress;

  // Wallet is connected if user has ANY wallet (EVM or SOL), regardless of current network
  const hasEvmWallet = testSession ? !!getTestWalletEvm() : !!(currentUser?.evmAccounts?.[0] || currentUser?.evmSmartAccounts?.[0] || evmAddress);
  const hasSolWallet = testSession ? !!getTestWalletSol() : !!(currentUser?.solanaAccounts?.[0] || solanaAddress);
  const effectiveIsSignedIn = testSession || isSignedIn;
  const isConnected = effectiveIsSignedIn && (hasEvmWallet || hasSolWallet);

  const [trackedNetwork, setTrackedNetwork] = useState(getCurrentNetwork());

  // Initialize on mount AND when test session changes
  useEffect(() => {
    const walletAddress = getCurrentWalletAddress();
    if (walletAddress) {
      setConnectedAddress(walletAddress);
      setAddress(walletAddress);
    }
  }, [testSession]); // Re-run when test session changes

  // Watch for network changes and update address accordingly
  useEffect(() => {
    const interval = setInterval(() => {
      const currentNetwork = getCurrentNetwork();
      if (currentNetwork !== trackedNetwork) {
        setTrackedNetwork(currentNetwork);

        // getCurrentWalletAddress() handles the logic for both modes:
        // - Sandbox: manual > wallet (network-aware)
        // - Production: wallet only (network-aware), null for unsupported networks
        const walletAddress = getCurrentWalletAddress();
        if (walletAddress) {
          setConnectedAddress(walletAddress);
          setAddress(walletAddress);
        } else {
          // No address available for this network (e.g., unsupported network in prod)
          setConnectedAddress('');
          setAddress('');
        }
      }
    }, 200); // Poll every 200ms for network changes

    return () => clearInterval(interval);
  }, [trackedNetwork]);

  // Watch for wallet address changes when user is signed in or when addresses load
  useEffect(() => {
    const walletAddress = getCurrentWalletAddress();

    if (effectiveIsSignedIn && walletAddress) {
      // User is signed in and we have an address - update if different
      setConnectedAddress(prev => prev !== walletAddress ? walletAddress : prev);
      setAddress(prev => prev !== walletAddress ? walletAddress : prev);
    } else if (!effectiveIsSignedIn) {
      // User signed out, clear addresses
      setConnectedAddress('');
      setAddress('');
    }
  }, [effectiveIsSignedIn, currentUser, evmAddress, solanaAddress]);

  useFocusEffect(
    useCallback(() => {
      const walletAddress = getCurrentWalletAddress();
      setConnectedAddress(walletAddress ?? '');
      // Always update address on focus (important for test account returning from verification)
      if (walletAddress) {
        setAddress(walletAddress);
      }
      // Update sandbox mode state when tab becomes active
      setSandboxModeState(getSandboxMode());
    }, [])
  );

  // Update shared state and local state when CDP wallet addresses load
  useEffect(() => {
    if (!effectiveIsSignedIn) return;

    // Skip CDP polling for test session (addresses already set)
    if (testSession) {
      const walletAddress = getCurrentWalletAddress();
      if (walletAddress) {
        setConnectedAddress(walletAddress);
        if (!address) setAddress(walletAddress);
      }
      return;
    }

    // Get addresses from CDP hooks
    console.log('🔍 [DEBUG] currentUser.evmSmartAccounts:', currentUser?.evmSmartAccounts);
    console.log('🔍 [DEBUG] currentUser.evmAccounts:', currentUser?.evmAccounts);
    console.log('🔍 [DEBUG] evmAddress from hook:', evmAddress);
    console.log('🔍 [DEBUG] currentUser.solanaAccounts:', currentUser?.solanaAccounts);
    console.log('🔍 [DEBUG] solanaAddress from hook:', solanaAddress);

    const evmSmartAccount = currentUser?.evmSmartAccounts?.[0] as string;
    const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
    const solAccount = currentUser?.solanaAccounts?.[0] as string || solanaAddress;

    // Set in shared state (so getCurrentWalletAddress works)
    // IMPORTANT: Prioritize Smart Account over EOA for onramp (balances are in Smart Account)
    const primaryEvmAddress = evmSmartAccount || evmEOA;
    if (primaryEvmAddress) {
      setCurrentWalletAddress(primaryEvmAddress);
    }
    if (solAccount) {
      setCurrentSolanaAddress(solAccount);
    }

    // Get network-aware wallet address from shared state
    const walletAddress = getCurrentWalletAddress();

    if (walletAddress) {
      setConnectedAddress(walletAddress);
      if (!address) setAddress(walletAddress);
      return;
    }

    // Poll if not found immediately
    let tries = 0;
    const t = setInterval(() => {
      const polledAddress = getCurrentWalletAddress();

      if (polledAddress) {
        setConnectedAddress(polledAddress);
        if (!address) setAddress(polledAddress);
        clearInterval(t);
      }
      if (++tries > 10) clearInterval(t); // Reduce to 5s max
    }, 500);

    return () => clearInterval(t);
  }, [effectiveIsSignedIn, testSession, currentUser, evmAddress, solanaAddress]);

  useFocusEffect(
    useCallback(() => {
      // Check wallet status when tab becomes active - network-aware
      if (effectiveIsSignedIn) {
        const walletAddress = getCurrentWalletAddress();

        if (walletAddress) {
          setConnectedAddress(walletAddress);
          if (!address) setAddress(walletAddress);
        }
      } else {
        setConnectedAddress('');
      }
    }, [effectiveIsSignedIn, currentUser, address, evmAddress, solanaAddress])
  );

  

  useFocusEffect(
    useCallback(() => {
      setAddress(getCurrentWalletAddress() ?? "");
    }, [])
  );


  const [applePayAlert, setApplePayAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });


  const {
    createOrder,
    createWidgetSession,
    closeApplePay,
    options,
    isLoadingOptions,
    optionsError,
    getAvailableNetworks,
    getAvailableAssets,
    fetchOptions,
    currentQuote,
    isLoadingQuote,
    fetchQuote,
    applePayVisible,
    hostedUrl,
    isProcessingPayment,
    setTransactionStatus,
    setIsProcessingPayment,
    paymentCurrencies,
    buyConfig
  } = useOnramp();

  // Load countries and subdivisions from buyConfig
  useEffect(() => {
    if (buyConfig?.countries) {
      const validCountries = buyConfig.countries.map((c: any) => c.id).filter(Boolean);
      setCountries(validCountries);

      const us = buyConfig.countries.find((c: any) => c.id === 'US');
      setUsSubs(us?.subdivisions || []);
    }
  }, [buyConfig]);

  // Sync sandbox mode state on mount and when shared state changes
  useEffect(() => {
    setSandboxModeState(getSandboxMode());
  }, []);

  // Refetch options when region changes
  useEffect(() => {
    if (effectiveIsSignedIn) {
      console.log('🌍 Region changed, refetching options:', { country, subdivision });
      fetchOptions();
    }
  }, [country, subdivision, effectiveIsSignedIn, fetchOptions]);

  // Animate region picker modals
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

  // Fetch options on component mount (only when signed in)
  useFocusEffect(
    useCallback(() => {
      if (effectiveIsSignedIn) {
        fetchOptions(); // only refetch options on focus when logged in
      }
      if (getPhoneVerifyWasCanceled()) {
        setIsProcessingPayment(false); // reset slider
        clearPhoneVerifyWasCanceled();
      }
    }, [fetchOptions, setIsProcessingPayment, effectiveIsSignedIn])
  );

  // 1) Resume after returning to this tab
  useFocusEffect(
    useCallback(() => {
      if (!pendingForm) return;

      const handlePendingForm = async () => {
        try {
          // If pending was for Coinbase Widget, do it immediately (no phone gate)
          if ((pendingForm.paymentMethod || '').toUpperCase() === 'COINBASE_WIDGET') {
            (async () => {
              const url = await createWidgetSession(pendingForm);
              if (url) {
                Linking.openURL(url);
                setPendingForm(null);
              }
            })();
            return;
          }

          // Apple Pay path still requires fresh phone
          const isSandbox = getSandboxMode();
          if (isSandbox || (isPhoneFresh60d() && getVerifiedPhone())) {
            const phone = getVerifiedPhone();

            // Determine the correct address based on network type for pending form
            let targetAddress = pendingForm.address;
            if (!isSandbox) {
              const networkType = (pendingForm.network || '').toLowerCase();
              const isEvmNetwork = ['ethereum', 'base', 'unichain', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'avax', 'bsc', 'fantom', 'linea', 'zksync', 'scroll'].some(k => networkType.includes(k));
              const isSolanaNetwork = ['solana', 'sol'].some(k => networkType.includes(k));

              if (isEvmNetwork) {
                const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
                const evmSmart = currentUser?.evmSmartAccounts?.[0] as string;
                targetAddress = evmEOA || evmSmart || targetAddress;
              } else if (isSolanaNetwork) {
                const solAccount = currentUser?.solanaAccounts?.[0] as string || solanaAddress;
                targetAddress = solAccount || targetAddress;
              }
            }

            createOrder({ ...pendingForm, phoneNumber: phone, address: targetAddress });
            setPendingForm(null);
          }
        } catch (error) {
          setPendingForm(null); // Clear pending form on error
          setApplePayAlert({
            visible: true,
            title: 'Transaction Failed',
            message: error instanceof Error ? error.message : 'Unable to create transaction. Please try again.',
            type: 'error'
          });
        }
      };
      handlePendingForm();
    }, [pendingForm, createOrder, createWidgetSession])
  );

  const handleSubmit = useCallback(async (formData: any) => {
    setIsProcessingPayment(true);

    // Determine the correct address based on network type (moved outside try-catch)
    const isSandbox = getSandboxMode();
    let targetAddress = formData.address;

    if (!isSandbox) {
      // In production mode, use network-specific addresses
      const networkType = (formData.network || '').toLowerCase();
      const isEvmNetwork = ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'avax', 'bsc', 'fantom', 'linea', 'zksync', 'scroll'].some(k => networkType.includes(k));
      const isSolanaNetwork = ['solana', 'sol'].some(k => networkType.includes(k));

      if (isEvmNetwork) {
        // Use EVM address for EVM networks
        const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
        const evmSmart = currentUser?.evmSmartAccounts?.[0] as string;
        targetAddress = evmEOA || evmSmart || targetAddress;
      } else if (isSolanaNetwork) {
        // Use Solana address for Solana networks
        const solAccount = currentUser?.solanaAccounts?.[0] as string || solanaAddress;
        targetAddress = solAccount || targetAddress;
      }
    }

    // Update the form data with the correct address
    const updatedFormData = { ...formData, address: targetAddress };

    try {
      // Coinbase Widget: skip phone/email verification
      if ((formData.paymentMethod || '').toUpperCase() === 'COINBASE_WIDGET') {
        const url = await createWidgetSession(updatedFormData);
        if (url) Linking.openURL(url);
        return; // do not call createOrder()
      }

      // Apple Pay: createOrder will validate email + phone and throw appropriate errors
      await createOrder(updatedFormData);
    } catch (error: any) {
      // Handle missing email - show confirmation before linking
      if (error.code === 'MISSING_EMAIL') {
        setPendingForm(updatedFormData);
        setApplePayAlert({
          visible: true,
          title: 'Link Email for Apple Pay',
          message: 'Apple Pay requires both email and phone verification for compliance.\n\nWould you like to link your email to this account to continue?',
          type: 'info'
        });
        // Note: User can dismiss alert to cancel, or we navigate after acknowledgment
        setTimeout(() => {
          router.push('/email-verify?mode=link');
          setApplePayAlert({ visible: false, title: '', message: '', type: 'info' });
        }, 3000);
        return;
      }

      // Handle missing phone - show confirmation before linking
      if (error.code === 'MISSING_PHONE') {
        setPendingForm(updatedFormData);
        setApplePayAlert({
          visible: true,
          title: 'Link Phone for Apple Pay',
          message: 'Apple Pay requires both email and phone verification for compliance.\n\nWould you like to link your phone to this account to continue?',
          type: 'info'
        });
        // Note: User can dismiss alert to cancel, or we navigate after acknowledgment
        setTimeout(() => {
          router.push('/phone-verify?mode=link');
          setApplePayAlert({ visible: false, title: '', message: '', type: 'info' });
        }, 3000);
        return;
      }

      // Generic error
      setApplePayAlert({
        visible: true,
        title: 'Transaction Failed',
        message: error instanceof Error ? error.message : 'Unable to create transaction. Please try again.',
        type: 'error'
      });
      console.error('Error submitting form:', error);
      setIsProcessingPayment(false);
    }
  }, [createOrder, createWidgetSession, router, currentUser, evmAddress, solanaAddress]);
    
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Onramp V2 Demo</Text>
      </View>

      {/* Sandbox Mode Toggle */}
      <View style={styles.sandboxToggleContainer}>
        <View style={styles.sandboxToggleContent}>
          <Text style={styles.sandboxToggleLabel}>
            {sandboxMode ? '🧪 Sandbox Mode' : '🔴 Production Mode'}
          </Text>
          <Text style={styles.sandboxToggleHint}>
            {sandboxMode
              ? 'Test without real transactions'
              : 'Real transactions will be executed'}
          </Text>
        </View>
        <Switch
          value={sandboxMode}
          onValueChange={(value) => {
            setSandboxMode(value);
            setSandboxModeState(value);
          }}
          trackColor={{ true: BLUE, false: BORDER }}
          thumbColor={Platform.OS === "android" ? (sandboxMode ? "#ffffff" : "#f4f3f4") : undefined}
        />
      </View>

      {/* Region Selection */}
      <View style={styles.regionContainer}>
        <Text style={styles.regionLabel}>Region</Text>
        <View style={styles.regionRow}>
          <View style={styles.regionItem}>
            <Text style={styles.regionItemLabel}>Country</Text>
            <Pressable style={styles.pillSelect} onPress={() => setCountryPickerVisible(true)}>
              <Text style={styles.pillText}>{country}</Text>
              <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
            </Pressable>
          </View>

          {country === "US" && (
            <View style={styles.regionItem}>
              <Text style={styles.regionItemLabel}>State</Text>
              <Pressable style={styles.pillSelect} onPress={() => setSubPickerVisible(true)}>
                <Text style={styles.pillText}>{subdivision}</Text>
                <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Error banner for failed options fetch */}
      {optionsError && !isLoadingOptions && (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>⚠️ Failed to load payment options</Text>
            <Text style={styles.errorMessage}>{optionsError}</Text>
          </View>
          <Pressable
            onPress={fetchOptions}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.7 }
            ]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <OnrampForm
        key={`${getCountry()}-${getSubdivision()}`}   // remount on region change
        address={address}
        onAddressChange={(newAddress) => {
          setAddress(newAddress);
          setConnectedAddress(newAddress);
        }}
        onSubmit={handleSubmit}
        isLoading={isProcessingPayment}
        options={options}
        isLoadingOptions={isLoadingOptions}
        getAvailableNetworks={getAvailableNetworks}
        getAvailableAssets={getAvailableAssets}
        currentQuote={currentQuote}
        isLoadingQuote={isLoadingQuote}
        fetchQuote={fetchQuote}
        paymentCurrencies={paymentCurrencies}
        amount={amount}
        onAmountChange={setAmount}
        sandboxMode={sandboxMode}
      />

      {applePayVisible && (
        <ApplePayWidget
          paymentUrl={hostedUrl}
          onClose={() => {
            closeApplePay(); // Stop loading when closed
          }}
          setIsProcessingPayment={setIsProcessingPayment}
          onAlert={(title, message, type) => {
            setApplePayAlert({ visible: true, title, message, type });
          }}
        />
      )}
      {/* OnrampForm Alert - Wallet Connection (Always Success) */}
      <CoinbaseAlert
        visible={showAlert}
        title="Success"
        message={alertMessage}
        onConfirm={() => setShowAlert(false)}
      />
      {/* ApplePayWidget Alert */}
      <CoinbaseAlert
        visible={applePayAlert.visible}
        title={applePayAlert.title}
        message={applePayAlert.message}
        type={applePayAlert.type}
        onConfirm={() => setApplePayAlert(prev => ({ ...prev, visible: false }))}
      />

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
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{c}</Text>
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
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{s}</Text>
                      {isSelected && <Ionicons name="checkmark" size={20} color={BLUE} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG, 
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CARD_BG, 
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  headerButton: {
    // Button styling
    backgroundColor: BLUE,             
    paddingHorizontal: 16,            
    paddingVertical: 12,               
    borderRadius: 20,                 
    minWidth: 100,                   
    alignItems: 'center',
    justifyContent: 'center',
    
    // shadow
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    
    // Border (optional)
    borderWidth: 0,
    borderColor: BLUE,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80", // Green dot
    marginRight: 6,             // Space from text
  },
  headerButtonText: {
    fontSize: 14,              
    fontWeight: '600',         
    color: WHITE,             
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoContainer: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: '#FF6B6B', // Error red (same as alert icon)
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  sandboxToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  sandboxToggleContent: {
    flex: 1,
    marginRight: 12,
  },
  sandboxToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  sandboxToggleHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  regionContainer: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  regionLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  regionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  regionItem: {
    flex: 1,
  },
  regionItemLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  pillSelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_PRIMARY,
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
  modalScrollView: {
    maxHeight: 400,
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
  modalItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
});

