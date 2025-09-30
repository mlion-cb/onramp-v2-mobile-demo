
import { useCurrentUser, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../../components";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { clearPhoneVerifyWasCanceled, getCountry, getCurrentWalletAddress, getPendingForm, getPhoneVerifyWasCanceled, getSandboxMode, getSubdivision, getVerifiedPhone, isPhoneFresh60d, setPendingForm } from "../../utils/sharedState";


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
  const [connectedAddress, setConnectedAddress] = useState('');
  const isConnected = connectedAddress.length > 0;

  useFocusEffect(
    useCallback(() => {
      setConnectedAddress(getCurrentWalletAddress() ?? '');
    }, [])
  );

  // Update when CDP session changes
  useEffect(() => {
    if (!isSignedIn) return;
  
    // prefer CDP user → fallback to shared state
    const sa = (currentUser?.evmSmartAccounts?.[0] as string) || (getCurrentWalletAddress() || '');
    if (sa) {
      setConnectedAddress(sa);
      if (!address) setAddress(sa);
      return;
    }
    // Poll if not found immediately
    let tries = 0;
    const t = setInterval(() => {
      const sa = currentUser?.evmSmartAccounts?.[0] as string;
      const shared = getCurrentWalletAddress() || '';
      if (sa || shared) {
        setConnectedAddress(sa || shared);
        if (!address) setAddress(sa || shared);
        clearInterval(t);
      }
      if (++tries > 10) clearInterval(t); // Reduce to 5s max
    }, 500);

    return () => clearInterval(t);
  }, [isSignedIn, currentUser]);

  useFocusEffect(
    useCallback(() => {
      // Check wallet status when tab becomes active
      if (isSignedIn) {
        const sa = currentUser?.evmSmartAccounts?.[0] as string;
        const shared = getCurrentWalletAddress() || '';
        const bestAddress = sa || shared;
        
        if (bestAddress) {
          setConnectedAddress(bestAddress);
          if (!address) setAddress(bestAddress);
        }
      } else {
        setConnectedAddress('');
      }
    }, [isSignedIn, currentUser, address])
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
            createOrder({ ...pendingForm, phoneNumber: phone });
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
      // Coinbase Widget: skip phone verification
      if ((formData.paymentMethod || '').toUpperCase() === 'COINBASE_WIDGET') {
        const url = await createWidgetSession(formData);
        if (url) Linking.openURL(url);
        return; // do not call createOrder()
      }
    
      // Apple Pay: require phone verification
      const isSandbox = getSandboxMode();
      const fresh = isPhoneFresh60d();
      const phone = getVerifiedPhone();
      if (!isSandbox && (!fresh || !phone)) {
        setPendingForm(formData); 
        router.push({ pathname: '/phone-verify', params: { initialPhone: phone || '' } });
        return;
      }
    
      await createOrder({ ...formData });
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
  }, [createOrder, createWidgetSession, router]);
    
  
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
        onAddressChange={() => {}}
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

