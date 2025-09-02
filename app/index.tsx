
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ApplePayWidget, OnrampForm, useOnramp } from "../components";
import { COLORS } from "../constants/colors";
const { PRIMARY_BLUE, NEUTRAL_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } = COLORS;


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

  const onConnectPress = useCallback(async () => {
    if (connecting || isConnected) return;
    try {
      setConnecting(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      const mock = generateMockAddress();
      setAddress(mock);
      Alert.alert("Dummy Wallet connected: ", mock);
    } finally {
      setConnecting(false);
    }
  }, [connecting, isConnected]);


  const { 
    createOrder, 
    closeApplePay, 
    options,
    isLoadingOptions,
    getAvailableNetworks,
    getAvailableAssets,
    fetchOptions,
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
        <Text style={[styles.headerButtonText, { textAlign: "center" }]}>
          {isConnected ? "Connected" : connecting ? "Connecting…" : "Connect Wallet\n(Dummy)"}
        </Text>
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
      />

      {applePayVisible && (
        <ApplePayWidget

          paymentUrl={hostedUrl}
          onClose={() => {
            closeApplePay(); // Stop loading when closed
          }}
          setIsProcessingPayment={setIsProcessingPayment}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  headerButton: {
    backgroundColor: PRIMARY_BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  headerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

