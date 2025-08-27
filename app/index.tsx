import { Stack } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { ApplePayWidget } from "../components/ApplePayWidget";
import { SwipeToConfirm } from "../components/SwipeToConfirm";
import { createApplePayOrder } from "../utils/createApplePayOrder";

const PRIMARY_BLUE = "#0052FF"; // Coinbase primary
const NEUTRAL_BG = "#F6F8FB";
const BORDER = "#E6E8EC";
const TEXT_PRIMARY = "#0B1B2B";
const TEXT_SECONDARY = "#3A4A5E";

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
  const [connecting, setConnecting] = useState(false);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [assetPickerVisible, setAssetPickerVisible] = useState(false);
  const [network, setNetwork] = useState("base");
  const [networkPickerVisible, setNetworkPickerVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Apple Pay");
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [applePayVisible, setApplePayVisible] = useState(false);
  const [hostedUrl, setHostedUrl] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false); // Add this
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

  const amountNumber = useMemo(() => {
    const cleaned = amount.replace(/,/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [amount]);

  const isAmountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const isAddressValid = /^0x[0-9a-fA-F]{40}$/.test(address);
  const isFormValid = isAmountValid && isAddressValid && !!network && !!asset && !!paymentMethod;

  const handleSwipeConfirm = useCallback((reset: () => void) => {
    if (!isFormValid) {
      reset();
      return;
    }
    Alert.alert(
      "Continue",
      `Amount: ${amount}\nAsset: ${asset}\nNetwork: ${network}\nAddress: ${address}`,
      [
        {
          text: "OK",
          onPress: async () => {
            try {
              // Show loading state if needed
              setIsProcessingPayment(true); // Start loading
              const result = await createApplePayOrder({
                paymentAmount: amount,
                paymentCurrency: "USD",
                purchaseCurrency: asset,
                paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
                destinationNetwork: network,
                destinationAddress: address,
                email: 'test@test.com',
                phoneNumber: '+13412133368',
                phoneNumberVerifiedAt: new Date().toISOString(),
                partnerUserRef: `${!!sandbox && "sandbox-"}user-${address}`,
                agreementAcceptedAt: new Date().toISOString()
              });
              
              // Handle successful response (maybe navigate to next screen, show success, etc.)
              console.log('Success:', result);

              // Extract hosted URL and show WebView
              if (result.hostedUrl) {
                setHostedUrl(result.hostedUrl);
                setApplePayVisible(true);
              } else {
                Alert.alert('Error', 'No payment URL received');
                setIsProcessingPayment(false);
                reset();  // Reset the swiper
              }
              
              
            } catch (error) {
              console.error('API Error:', error);
              Alert.alert('Error', 'Failed to create onramp session. Please try again.');
              setIsProcessingPayment(false);
              reset();  // Reset swiper even on error
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => reset(),
      }
    );
  }, [isFormValid, amount, network, asset, address, sandbox]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Onramp Demo",
          headerTitleStyle: { fontWeight: "600" },
          headerRight: () => (
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
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={TEXT_SECONDARY + "99"}
            keyboardType={Platform.select({ ios: "decimal-pad", android: "numeric", default: "numeric" })}
            inputMode="decimal"
            style={styles.input}
          />
          {!isAmountValid && amount.length > 0 ? (
            <Text style={styles.errorText}>Enter a valid amount greater than 0</Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Network</Text>
          <Pressable style={styles.select} onPress={() => setNetworkPickerVisible(true)}>
            <Text style={styles.selectText}>{network}</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Asset</Text>
          <Pressable style={styles.select} onPress={() => setAssetPickerVisible(true)}>
            <Text style={styles.selectText}>{asset}</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Wallet address</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="0x…"
            placeholderTextColor={TEXT_SECONDARY + "99"}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {!isAddressValid && address.length > 0 ? (
            <Text style={styles.errorText}>Enter a valid 0x address</Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Payment method</Text>
          <Pressable style={styles.select} onPress={() => setPaymentPickerVisible(true)}>
            <Text style={styles.selectText}>{paymentMethod}</Text>
          </Pressable>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Sandbox environment?</Text>
          <Switch
            value={sandbox}
            onValueChange={setSandbox}
            trackColor={{ true: PRIMARY_BLUE, false: BORDER }}
            thumbColor={Platform.OS === "android" ? (sandbox ? "#ffffff" : "#f4f3f4") : undefined}
          />
        </View>

        <SwipeToConfirm
          label="Swipe to Deposit"
          disabled={!isFormValid}
          onConfirm={handleSwipeConfirm}
          isLoading={isProcessingPayment} // Pass loading state
        />
      </ScrollView>

      {/* Asset picker modal */}
      <Modal
        visible={assetPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssetPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {(["USDC", "ETH"] as const).map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  setAsset(n);
                  setAssetPickerVisible(false);
                }}
                style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: NEUTRAL_BG }]}
              >
                <Text style={styles.modalItemText}>{n}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setAssetPickerVisible(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>


      {/* Network picker modal */}
      <Modal
        visible={networkPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNetworkPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {(["base"] as const).map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  setNetwork(n);
                  setNetworkPickerVisible(false);
                }}
                style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: NEUTRAL_BG }]}
              >
                <Text style={styles.modalItemText}>{n}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setNetworkPickerVisible(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Payment method picker modal */}
      <Modal
        visible={paymentPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPaymentPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {(["Apple Pay"] as const).map((method) => (
              <Pressable
                key={method}
                onPress={() => {
                  setPaymentMethod(method);
                  setPaymentPickerVisible(false);
                }}
                style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: NEUTRAL_BG }]}
              >
                <Text style={styles.modalItemText}>{method}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setPaymentPickerVisible(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {applePayVisible && (
        <ApplePayWidget

          paymentUrl={hostedUrl}
          onClose={() => {
            setApplePayVisible(false);
            setHostedUrl('');
            setIsProcessingPayment(false); // Stop loading when closed
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
  content: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    backgroundColor: NEUTRAL_BG,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10, default: 12 }),
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  select: {
    backgroundColor: NEUTRAL_BG,
    borderColor: BORDER,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10, default: 12 }),
  },
  selectText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  switchRow: {
    marginTop: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 8,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalItemText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  modalCancel: {
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: "600",
  },
});

