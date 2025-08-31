import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SwipeToConfirm } from '../ui/SwipeToConfirm';


const { PRIMARY_BLUE, NEUTRAL_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY } = COLORS;

export type OnrampFormData = {
  amount: string;
  asset: string;
  network: string;
  address: string;
  sandbox: boolean;
  paymentMethod: string;
};

type OnrampFormProps = {
  address: string;
  onAddressChange: (address: string) => void;
  onSubmit: (data: OnrampFormData) => void;
  isLoading: boolean;
};

export function OnrampForm({
  address,
  onAddressChange,
  onSubmit,
  isLoading
}: OnrampFormProps) {
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [network, setNetwork] = useState("base");
  const [paymentMethod, setPaymentMethod] = useState("Apple Pay");
  const [sandbox, setSandbox] = useState(true);
  const [assetPickerVisible, setAssetPickerVisible] = useState(false);
  const [networkPickerVisible, setNetworkPickerVisible] = useState(false);
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);

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
      "Confirm Transaction",
      `Confirm wallet address for non-Sandbox payment.\nAmount: ${amount}\nAsset: ${asset}\nNetwork: ${network}\nAddress: ${address}`,
      [
        {
          text: "Confirm",
          style: "default",
          onPress: async () => {
            try {
              await onSubmit({
                amount,
                asset,
                network,
                address,
                sandbox,
                paymentMethod
              });
            } catch (error) {
              console.error('API Error:', error);
              Alert.alert('Error', 'Failed to create onramp session. Please try again.');
              reset(); 
            }
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => reset(),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => reset(),
      }
    );
  }, [isFormValid, amount, network, asset, address, sandbox, paymentMethod, onSubmit]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Amount Field */}
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

      {/* Network Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Network</Text>
        <Pressable style={styles.select} onPress={() => setNetworkPickerVisible(true)}>
          <Text style={styles.selectText}>{network}</Text>
        </Pressable>
      </View>

      {/* Asset Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Asset</Text>
        <Pressable style={styles.select} onPress={() => setAssetPickerVisible(true)}>
          <Text style={styles.selectText}>{asset}</Text>
        </Pressable>
      </View>

      {/* Wallet Address Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Wallet address</Text>
        <TextInput
          value={address}
          onChangeText={onAddressChange}
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

      {/* Payment Method Field */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Payment method</Text>
        <Pressable style={styles.select} onPress={() => setPaymentPickerVisible(true)}>
          <Text style={styles.selectText}>{paymentMethod}</Text>
        </Pressable>
      </View>

      {/* Sandbox Switch */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Sandbox environment?</Text>
        <Switch
          value={sandbox}
          onValueChange={setSandbox}
          trackColor={{ true: PRIMARY_BLUE, false: BORDER }}
          thumbColor={Platform.OS === "android" ? (sandbox ? "#ffffff" : "#f4f3f4") : undefined}
        />
      </View>

      {/* Swipe to Confirm */}
      <SwipeToConfirm
        label="Swipe to Deposit"
        disabled={!isFormValid}
        onConfirm={handleSwipeConfirm}
        isLoading={isLoading}
      />

      {/* All your existing modals */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  errorText: {
    color: "#D32F2F",
    fontSize: 12,
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