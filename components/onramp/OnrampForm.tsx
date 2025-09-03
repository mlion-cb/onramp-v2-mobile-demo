import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { COLORS } from '../../constants/Colors';
import { SwipeToConfirm } from '../ui/SwipeToConfirm';


const { BLUE, DARK_BG, CARD_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, WHITE, SILVER } = COLORS;

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
  options: any;
  isLoadingOptions: boolean;
  getAvailableNetworks: (selectedAsset?: string) => string[];
  getAvailableAssets: (selectedNetwork?: string) => string[];
};

/**
 * Main form component with dynamic asset/network selection
 * Assets and networks are filtered based on each other (many-to-many relationship)
 */
export function OnrampForm({
  address,
  onAddressChange,
  onSubmit,
  isLoading,
  options,
  isLoadingOptions,
  getAvailableNetworks,
  getAvailableAssets
}: OnrampFormProps) {
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [network, setNetwork] = useState("Base");
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

  /**
   * Dynamic filtering: changing asset updates available networks, and vice versa
   * 
   * Data Flow:
   * 1. fetchBuyOptions() → loads all combinations
   * 2. getAvailableAssets(network) → filters by network
   * 3. getAvailableNetworks(asset) → filters by asset
   * 4. useEffect hooks → auto-clear invalid selections
   */
  const availableNetworks = useMemo(() => {
    if (!getAvailableNetworks) return ["ethereum", "base"]; // Fallback
    return getAvailableNetworks(asset);
  }, [asset, getAvailableNetworks]);

  const availableAssets = useMemo(() => {
    if (!getAvailableAssets) return ["USDC", "ETH"]; // Fallback
    return getAvailableAssets(network);
  }, [network, getAvailableAssets]);

  // Auto-clear invalid selections when options change
  useEffect(() => {
    // If current network is no longer valid for selected asset, reset to first available
    if (asset && !availableNetworks.includes(network)) {
      setNetwork(availableNetworks[0] || "");
    }
  }, [asset, availableNetworks, network]);

  useEffect(() => {
    // If current asset isn't available for selected network, clear it
    if (network && availableAssets.length > 0) {
      if (!availableAssets.includes(asset)) {
        setAsset(availableAssets[0] || "");
      }
    }
  }, [network, availableAssets, asset]);

  /**
   * Form submission: bypasses confirmation popup, directly calls API
   * Validation: amount > 0, valid 0x address, asset/network selected
   */
  const handleSwipeConfirm = useCallback((reset: () => void) => {
    if (!isFormValid) {
      console.log('Form is invalid, resetting slider')
      reset(); // Snap slider back if invalid
      return;
    }

    // Direct submission with one-click (/ slide) experience
    console.log('Form is valid, submitting')
    onSubmit({
      amount: amountNumber.toString(),
      asset,
      network,
      address,
      paymentMethod,
      sandbox,
    });
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
          trackColor={{ true: BLUE, false: BORDER }}
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
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {isLoadingOptions ? (
                <View style={styles.modalItem}>
                  <Text style={styles.modalItemText}>Loading assets...</Text>
                </View>
              ) : (
                availableAssets.map((assetOption: string, index: number) => (
                  <Pressable
                    key={`asset-${index}-${assetOption}`}
                    onPress={() => {
                      setAsset(assetOption);
                      setAssetPickerVisible(false);
                    }}
                    style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
                  >
                    <Text style={styles.modalItemText}>{assetOption}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
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
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {isLoadingOptions ? (
                <View style={styles.modalItem}>
                  <Text style={styles.modalItemText}>Loading networks...</Text>
                </View>
              ) : (
                availableNetworks.map((networkOption: string, index: number) => (
                  <Pressable
                    key={`network-${index}-${networkOption}`}
                    onPress={() => {
                      setNetwork(networkOption);
                      setNetworkPickerVisible(false);
                    }}
                    style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
                  >
                    <Text style={styles.modalItemText}>{networkOption}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
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
                style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
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
    backgroundColor: DARK_BG, 
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
    backgroundColor: CARD_BG,     
    borderColor: BORDER,
    borderWidth: 1,               
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 14 }), // More padding
    color: TEXT_PRIMARY,
    fontSize: 16,
    // Add subtle focus styling
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  select: {
    backgroundColor: CARD_BG,     
    borderColor: BORDER,
    borderWidth: 1,              
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 14 }), // More padding
    // Add subtle styling
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  switchRow: {
    marginTop: 8,
    paddingVertical: 12,         
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    color: "#FF6B6B",           
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 11, 13, 0.8)", 
    justifyContent: "flex-end",
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalSheet: {
    backgroundColor: CARD_BG,    
    padding: 16,                 
    borderTopLeftRadius: 20,     
    borderTopRightRadius: 20,
    gap: 8,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalItem: {
    paddingVertical: 16,         
    paddingHorizontal: 16,
    borderRadius: 12,            
    borderWidth: 1,
    borderColor: 'transparent',  
  },
  modalItemText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "500",
  },
  modalCancel: {
    paddingVertical: 16,        
    alignItems: "center",
    marginTop: 8,
    backgroundColor: BORDER,     
    borderRadius: 12,
  },
  modalCancelText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: "600",
  },
});