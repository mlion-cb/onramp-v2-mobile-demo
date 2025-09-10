
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../components";
import { CoinbaseAlert } from "../components/ui/CoinbaseAlerts";
import { COLORS } from "../constants/Colors";


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
  const isConnected = address.length > 0;
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const onConnectPress = useCallback(async () => {
    if (connecting || isConnected) return;
    try {
      setConnecting(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      const mock = generateMockAddress();
      setAddress(mock);
      setAlertMessage(`Dummy Wallet connected: ${mock}`);
      setShowAlert(true);
    } finally {
      setConnecting(false);
    }
  }, [connecting, isConnected]);

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
    setIsProcessingPayment 
  } = useOnramp();

  // Fetch options on component mount
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);
    
  
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
              {isConnected ? "Connected" : connecting ? "Connecting…" : "Connect Dummy Wallet"}
            </Text>
          </View>
        </Pressable>
      </View>

      <OnrampForm
        address={address}
        onAddressChange={setAddress}
        onSubmit={createOrder}
        isLoading={isProcessingPayment}
        options={options}
        isLoadingOptions={isLoadingOptions}
        getAvailableNetworks={getAvailableNetworks}
        getAvailableAssets={getAvailableAssets}
        currentQuote={currentQuote}      // Add this
        isLoadingQuote={isLoadingQuote}  // Add this
        fetchQuote={fetchQuote}          // Add this
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

