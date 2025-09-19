
import { useCurrentUser, useIsSignedIn } from "@coinbase/cdp-hooks";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../../components";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { getCountry, getCurrentWalletAddress, getSubdivision, getVerifiedPhone, isPhoneFresh60d } from "../../utils/sharedState";


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
  const router = useRouter();
  const [pendingForm, setPendingForm] = useState<any | null>(null);


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
  
    let tries = 0;
    const t = setInterval(() => {
      // prefer CDP user → fallback to shared state
      const sa = (currentUser?.evmSmartAccounts?.[0] as string) || (getCurrentWalletAddress() || '');
      if (sa) {
        setConnectedAddress(sa);
        if (!address) setAddress(sa);
        clearInterval(t);
      }
      if (++tries > 20) clearInterval(t); // ~10s max
    }, 500);
  
    return () => clearInterval(t);
  }, [isSignedIn, currentUser]);

  

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
      fetchOptions();
    }, [fetchOptions])
  );

  // 1) Resume after returning to this tab
  useFocusEffect(
    useCallback(() => {
      if (!pendingForm) return;

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
      if (isPhoneFresh60d() && getVerifiedPhone()) {
        const phone = getVerifiedPhone();
        createOrder({ ...pendingForm, phoneNumber: phone });
        setPendingForm(null);
      }
    }, [pendingForm, createOrder, createWidgetSession])
  );

  const handleSubmit = useCallback(async (formData: any) => {
    // Coinbase Widget: skip phone verification
    if ((formData.paymentMethod || '').toUpperCase() === 'COINBASE_WIDGET') {
      const url = await createWidgetSession(formData);
      if (url) Linking.openURL(url);
      return; // do not call createOrder()
    }
  
    // Apple Pay: require phone verification
    const fresh = isPhoneFresh60d();
    const phone = getVerifiedPhone();
    if (!fresh || !phone) {
      setPendingForm(formData);
      router.push({ pathname: '/phone-verify', params: { initialPhone: phone || '' } });
      return;
    }
  
    createOrder({ ...formData });
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

