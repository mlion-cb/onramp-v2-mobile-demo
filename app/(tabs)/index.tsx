
import { useCurrentUser, useEvmAddress, useIsSignedIn, useSolanaAddress } from "@coinbase/cdp-hooks";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../../components";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { clearPhoneVerifyWasCanceled, getCountry, getCurrentNetwork, getCurrentWalletAddress, getPendingForm, getPhoneVerifyWasCanceled, getSandboxMode, getSubdivision, getVerifiedPhone, isPhoneFresh60d, setCurrentSolanaAddress, setCurrentWalletAddress, setPendingForm } from "../../utils/sharedState";


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
  const [connecting, setConnecting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [amount, setAmount] = useState("");
  const router = useRouter();
  const pendingForm = getPendingForm();


  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { evmAddress } = useEvmAddress();
  const { solanaAddress } = useSolanaAddress();
  const [connectedAddress, setConnectedAddress] = useState('');

  // Wallet is connected if user has ANY wallet (EVM or SOL), regardless of current network
  const hasEvmWallet = !!(currentUser?.evmAccounts?.[0] || currentUser?.evmSmartAccounts?.[0] || evmAddress);
  const hasSolWallet = !!(currentUser?.solanaAccounts?.[0] || solanaAddress);
  const isConnected = isSignedIn && (hasEvmWallet || hasSolWallet);

  const [trackedNetwork, setTrackedNetwork] = useState(getCurrentNetwork());

  // Initialize on mount
  useEffect(() => {
    const walletAddress = getCurrentWalletAddress();
    if (walletAddress) {
      setConnectedAddress(walletAddress);
      setAddress(walletAddress);
    }
  }, []);

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

    if (isSignedIn && walletAddress) {
      // User is signed in and we have an address - update if different
      setConnectedAddress(prev => prev !== walletAddress ? walletAddress : prev);
      setAddress(prev => prev !== walletAddress ? walletAddress : prev);
    } else if (!isSignedIn) {
      // User signed out, clear addresses
      setConnectedAddress('');
      setAddress('');
    }
  }, [isSignedIn, currentUser, evmAddress, solanaAddress]);

  useFocusEffect(
    useCallback(() => {
      setConnectedAddress(getCurrentWalletAddress() ?? '');
    }, [])
  );

  // Update shared state and local state when CDP wallet addresses load
  useEffect(() => {
    if (!isSignedIn) return;

    // Get addresses from CDP hooks
    const evmSmartAccount = currentUser?.evmSmartAccounts?.[0] as string;
    const evmEOA = currentUser?.evmAccounts?.[0] as string || evmAddress;
    const solAccount = currentUser?.solanaAccounts?.[0] as string || solanaAddress;

    // Set in shared state (so getCurrentWalletAddress works)
    const primaryEvmAddress = evmEOA || evmSmartAccount;
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
  }, [isSignedIn, currentUser, evmAddress, solanaAddress]);

  useFocusEffect(
    useCallback(() => {
      // Check wallet status when tab becomes active - network-aware
      if (isSignedIn) {
        const walletAddress = getCurrentWalletAddress();

        if (walletAddress) {
          setConnectedAddress(walletAddress);
          if (!address) setAddress(walletAddress);
        }
      } else {
        setConnectedAddress('');
      }
    }, [isSignedIn, currentUser, address, evmAddress, solanaAddress])
  );

  

  useFocusEffect(
    useCallback(() => {
      setAddress(getCurrentWalletAddress() ?? "");
    }, [])
  );

  const onConnectPress = useCallback(() => router.push("../email-verify"), [router]);


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
    setIsProcessingPayment ,
    paymentCurrencies
  } = useOnramp();

  // Fetch options on component mount
  useFocusEffect(
    useCallback(() => {
      fetchOptions(); // only refetch options on focus
      if (getPhoneVerifyWasCanceled()) {
        setIsProcessingPayment(false); // reset slider
        clearPhoneVerifyWasCanceled();
      }
    }, [fetchOptions, setIsProcessingPayment])
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
    try {
      // Determine the correct address based on network type
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

      // Coinbase Widget: skip phone verification
      if ((formData.paymentMethod || '').toUpperCase() === 'COINBASE_WIDGET') {
        const url = await createWidgetSession(updatedFormData);
        if (url) Linking.openURL(url);
        return; // do not call createOrder()
      }

      // Apple Pay: require phone verification
      const fresh = isPhoneFresh60d();
      const phone = getVerifiedPhone();
      if (!isSandbox && (!fresh || !phone)) {
        setPendingForm(updatedFormData);
        router.push({ pathname: '/phone-verify', params: { initialPhone: phone || '' } });
        return;
      }

      await createOrder(updatedFormData);
    } catch (error) {
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
        <Pressable
          onPress={onConnectPress}
          disabled={connecting || isConnected}
          style={({ pressed }) => [
            styles.headerButton,
            (connecting || isConnected) && { opacity: 0.6 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isConnected && <View style={styles.connectedDot} />}
            <Text style={[styles.headerButtonText, { 
              textAlign: "center",
              color: isConnected ? "#4ADE80" : TEXT_PRIMARY
            }]}>
              {isConnected ? "Connected" : connecting ? "Connecting…" : "Connect Wallet"}
            </Text>
          </View>
        </Pressable>
      </View>

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
});

