import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
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
  quoteId?: string;
  phoneNumber?: string;
};

type OnrampFormProps = {
  address: string;
  onAddressChange: (address: string) => void;
  onSubmit: (data: OnrampFormData) => void;
  isLoading: boolean;
  options: any;
  isLoadingOptions: boolean;
  getAvailableNetworks: (selectedAsset?: string) => any[];
  getAvailableAssets: (selectedNetwork?: string) => any[];
  currentQuote: any;          
  isLoadingQuote: boolean;    
  fetchQuote: (formData: any) => void; 
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
  getAvailableAssets,
  currentQuote,       
  isLoadingQuote,     
  fetchQuote         
}: OnrampFormProps) {
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [network, setNetwork] = useState("Base");
  const [paymentMethod, setPaymentMethod] = useState("Apple Pay");
  const [sandbox, setSandbox] = useState(true);
  const [assetPickerVisible, setAssetPickerVisible] = useState(false);
  const [networkPickerVisible, setNetworkPickerVisible] = useState(false);
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [paymentCurrencyPickerVisible, setPaymentCurrencyPickerVisible] = useState(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);


  const amountNumber = useMemo(() => {
    const cleaned = amount.replace(/,/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [amount]);

  const isAmountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const isAddressValid = /^0x[0-9a-fA-F]{40}$/.test(address);
  const isFormValid = isAmountValid && isAddressValid && !!network && !!asset;

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
    if (asset && availableNetworks.length > 0) {
      const networkExists = availableNetworks.some((net: any) => 
        net.display_name === network || net.name === network
      );
      if (!networkExists) {
        const firstNetwork: any = availableNetworks[0];
        setNetwork(firstNetwork?.display_name || firstNetwork?.name || "");
      }
    }
  }, [asset, availableNetworks, network]);

  useEffect(() => {
    // If current asset isn't available for selected network, clear it
    if (network && availableAssets.length > 0) {
      const assetExists = availableAssets.some((assetObj: any) => 
        assetObj.name === asset || assetObj.symbol === asset
      );
      if (!assetExists) {
        const firstAsset: any = availableAssets[0];
        setAsset(firstAsset?.name || firstAsset?.symbol || "");
      }
    }
  }, [network, availableAssets, asset]);

  // Debounced quote fetching
  useEffect(() => {
    console.log('Quote useEffect triggered:', { amount, asset, network, address, paymentCurrency });
    
    const timeoutId = setTimeout(() => {
      if (amount && asset && network) {
        console.log('Calling fetchQuote with:', { amount, asset, network, address, paymentCurrency });
        fetchQuote?.({ amount, asset, network, paymentCurrency });
      } else {
        console.log('Missing required fields for quote');
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [amount, asset, network, paymentCurrency, fetchQuote]);

  /**
   * Form submission: directly calls API
   * Validation: amount > 0, valid 0x address, asset/network selected
   */
  const handleSwipeConfirm = useCallback((reset: () => void) => {
    if (!isFormValid) {
      console.log('Form is invalid or no quote, resetting slider');
      reset();
      return;
    }

    // Direct submission with one-click (/ slide) experience
    console.log('Form is valid, submitting with quote')
    onSubmit({
      amount: amount, // Use total payment amount from quote
      asset,
      network,
      address,
      paymentMethod,
      sandbox,
      quoteId: currentQuote.quote_id, // Include quote ID
    });
  }, [isFormValid, currentQuote, asset, network, address, sandbox, paymentMethod, onSubmit]);
  return (
    <ScrollView 
      contentContainerStyle={styles.content} 
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!isSwipeActive} // Disable scrolling during swipe
    >
      
      {/* Buy Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Buy</Text>
        <View style={styles.inputRow}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor={TEXT_SECONDARY}
            keyboardType="decimal-pad"
            style={styles.amountInput}
          />
          <Pressable 
            style={styles.currencyTag}
            onPress={() => setPaymentCurrencyPickerVisible(true)} // Make it clickable
          >
            <Text style={styles.currencyText}>🇺🇸 {paymentCurrency}</Text>
            <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
          </Pressable>
        </View>
      </View>
  
      {/* Receive Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Receive</Text>
        <View style={styles.inputRow}>
          <View style={styles.receiveAmountContainer}>
            {isLoadingQuote ? (
              <ActivityIndicator size="small" color={BLUE} />
            ) : (
              <Text style={styles.receiveAmount}>
                {currentQuote?.purchase_amount?.value || '0'}
              </Text>
            )}
          </View>
          <Pressable style={styles.assetSelect} onPress={() => setAssetPickerVisible(true)}>
            <View style={styles.selectContent}>
              {(() => {
                const selectedAssetObj = availableAssets.find((assetObj: any) => 
                  assetObj.name === asset || assetObj.symbol === asset
                );
                return selectedAssetObj?.icon_url && (
                  <Image 
                    source={{ uri: selectedAssetObj.icon_url }} 
                    style={styles.assetIcon}
                  />
                );
              })()}
              <Text style={styles.assetText}>{asset}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
          </Pressable>
        </View>
        
        {/* Network Row */}
        <View style={styles.networkRow}>
          <Text style={styles.networkLabel}>Network</Text>
          <Pressable style={styles.networkSelect} onPress={() => setNetworkPickerVisible(true)}>
            <View style={styles.selectContent}>
              {(() => {
                const selectedNetworkObj = availableNetworks.find((net: any) => 
                  net.display_name === network || net.name === network
                );
                return selectedNetworkObj?.icon_url && (
                  <Image 
                    source={{ uri: selectedNetworkObj.icon_url }} 
                    style={styles.networkIcon}
                  />
                );
              })()}
              <Text style={styles.networkText}>{network}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
          </Pressable>
        </View>
      </View>
  
      {/* Payment Method Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pay with</Text>
        <Pressable style={styles.paymentSelect} onPress={() => setPaymentPickerVisible(true)}>
          <View style={styles.selectContent}>
            <Text style={styles.paymentText}>Apple Pay</Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
        </Pressable>
      </View>
  
      {/* Wallet Address */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Wallet address</Text>
        <TextInput
          value={address}
          editable={false}
          selectTextOnFocus={false}
          onChangeText={onAddressChange}
          placeholder="0x..."
          placeholderTextColor={TEXT_SECONDARY + "99"}
          style={styles.input}
        />
        {!isAddressValid && address.length > 0 && (
          <Text style={styles.errorText}>Enter a valid Ethereum address</Text>
        )}
      </View>
  
      {/* Sandbox Toggle */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Sandbox Environment</Text>
        <Switch
          value={sandbox}
          onValueChange={setSandbox}
          trackColor={{ true: BLUE, false: BORDER }}
          thumbColor={Platform.OS === "android" ? (sandbox ? "#ffffff" : "#f4f3f4") : undefined}
        />
      </View>
  
      {/* Quote Summary */}
      {currentQuote && (
        <View style={styles.quoteCard}>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Purchase amount</Text>
            <Text style={styles.quoteValue}>
              ${currentQuote.payment_subtotal?.value || currentQuote.paymentSubtotal?.value || '0'}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Coinbase fee</Text>
            <Text style={styles.quoteValue}>
              ${currentQuote.coinbase_fee?.value || currentQuote.coinbaseFee?.value || '0'}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>Network fee</Text>
            <Text style={styles.quoteValue}>
              ${currentQuote.network_fee?.value || currentQuote.networkFee?.value || '0'}
            </Text>
          </View>
          <View style={[styles.quoteRow, styles.quoteTotalRow]}>
            <Text style={styles.quoteTotalLabel}>Total</Text>
            <Text style={styles.quoteTotalValue}>
              ${currentQuote.payment_total?.value || currentQuote.paymentTotal?.value || '0'}
            </Text>
          </View>
        </View>
      )}
  
      <SwipeToConfirm
        label="Swipe to Deposit"
        disabled={!isFormValid}
        onConfirm={handleSwipeConfirm}
        isLoading={isLoading}
        onSwipeStart={() => setIsSwipeActive(true)}
        onSwipeEnd={() => setIsSwipeActive(false)}
      />
  
      {/* All existing modals */}
      {/* Payment Currency picker modal */}
      <Modal 
        visible={paymentCurrencyPickerVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={() => setPaymentCurrencyPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {["USD"].map((currency, index) => (
                <Pressable
                  key={`currency-${index}-${currency}`}
                  onPress={() => {
                    setPaymentCurrency(currency);
                    setPaymentCurrencyPickerVisible(false);
                  }}
                  style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
                >
                  <View style={styles.modalItemContent}>
                    <View style={styles.modalItemLeft}>
                      <Text style={styles.modalItemIcon}>🇺🇸</Text>
                      <Text style={styles.modalItemText}>{currency}</Text>
                    </View>
                    <Text style={styles.modalItemMeta}>United States Dollar</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setPaymentCurrencyPickerVisible(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
                availableAssets.map((assetOption: any, index: number) => {
                  const displayName = assetOption.name || assetOption.symbol || 'Unknown Asset'; // Add fallback
                  const iconUrl = assetOption.icon_url;
                  
                  return (
                    <Pressable
                      key={`asset-${index}-${displayName}`}
                      onPress={() => {
                        setAsset(displayName);
                        setAssetPickerVisible(false);
                      }}
                      style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
                    >
                      <View style={styles.modalItemContent}>
                        <View style={styles.modalItemLeft}>
                          {iconUrl && (
                            <Image 
                              source={{ uri: iconUrl }} 
                              style={styles.modalItemIcon}
                            />
                          )}
                          <Text style={styles.modalItemText}>{displayName}</Text>
                        </View>
                        {/* Add asset symbol/meta info if available */}
                        <Text style={styles.modalItemMeta}>
                          {assetOption.symbol && assetOption.symbol !== displayName ? assetOption.symbol.toUpperCase() : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
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
                availableNetworks.map((networkOption: any, index: number) => {
                  const displayName = networkOption.display_name || networkOption.name || 'Unknown Network';
                  const iconUrl = networkOption.icon_url;
                  
                  return (
                    <Pressable
                      key={`network-${index}-${displayName}`}
                      onPress={() => {
                        setNetwork(displayName);
                        setNetworkPickerVisible(false);
                      }}
                      style={({ pressed }) => [styles.modalItem, pressed && { backgroundColor: CARD_BG }]}
                    >
                      <View style={styles.modalItemContent}>
                        <View style={styles.modalItemLeft}>
                          {iconUrl && (
                            <Image 
                              source={{ uri: iconUrl }} 
                              style={styles.modalItemIcon}
                            />
                          )}
                          <Text style={styles.modalItemText}>{displayName}</Text>
                        </View>
                        {/* Add network/chain info if available */}
                        <Text style={styles.modalItemMeta}>
                          {networkOption.name ? networkOption.name.toUpperCase() : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
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
          <ScrollView 
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
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
            </ScrollView>
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
    padding: 12,                
    gap: 12,                     
    backgroundColor: DARK_BG,
    paddingBottom: 100,       
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  // Input row styles
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '300',
    color: TEXT_SECONDARY,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    padding: 0,
  },
  currencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BORDER,
    paddingHorizontal: 12,      
    paddingVertical: 8,        
    borderRadius: 16,
    gap: 8,                    
    minWidth: 80,              
    maxWidth: 120,             
  },
  currencyText: {
    fontSize: 14,             
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  // Receive styles
  receiveAmountContainer: {
    flex: 1,
    minWidth: 100,              
    height: 40,                 
    justifyContent: 'center',   
    alignItems: 'flex-start',   
  },
  receiveAmount: {
    fontSize: 32,
    fontWeight: '300',
    color: TEXT_PRIMARY,
    minWidth: 100,          
  },
  assetSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BORDER,
    paddingHorizontal: 12,    
    paddingVertical: 8,        
    borderRadius: 16,
    gap: 8,                    
    maxWidth: 140,             
  },
  assetIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 4,            
  },
  assetText: {
    fontSize: 14,              
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
    // Network row
    networkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: BORDER,
    },
    networkLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: TEXT_PRIMARY,
    },
    networkSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: BORDER,
      paddingHorizontal: 12,     
      paddingVertical: 8,        
      borderRadius: 16,
      gap: 8,                    
      maxWidth: 120,             
    },
    networkIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 4,           
    },
    networkText: {
      fontSize: 14,             
      fontWeight: '500',
      color: TEXT_PRIMARY,
    },
      // Payment styles
  paymentSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  applePayIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',  
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  applePayText: {
    fontSize: 14,
  },
  paymentText: {
    fontSize: 14,            
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  // Quote summary
  quoteCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  quoteTotalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  quoteTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  quoteTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  quoteLoader: {
    marginRight: 8,
  },
  input: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,       
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '400',
  },
  select: {
    backgroundColor: CARD_BG,     
    borderColor: BORDER,
    borderWidth: 1,              
    borderRadius: 12,            
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 16, android: 14, default: 16 }),
    
    // Same focus styling as input
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',      
    alignItems: 'center',       
    justifyContent: 'space-between', 
  },
  selectText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '400',         
  },
  switchRow: {
    marginTop: 6,             
    paddingVertical: 8,       
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
    maxHeight: 400,
  },
  modalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',        
    width: '100%',
    paddingTop: 8,
    paddingBottom: 20,
  },
  modalItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Add this
  },
  modalItemIcon: {
    width: 32,
    height: 32,
    marginRight: 16,
    borderRadius: 16,
  },
  modalItemText: {
    fontSize: 18,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalItemMeta: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    marginLeft: 8,
  },
  modalCancel: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20, // Add horizontal padding
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginHorizontal: 16, // Add side margins
    backgroundColor: BORDER,
    borderRadius: 12,
  },
  modalCancelText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: '500',
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    borderRadius: 12,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,           
    padding: 16,                
    borderWidth: 1,
    borderColor: BORDER,
    
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },  
    shadowOpacity: 0.05,        
    shadowRadius: 4,            
    elevation: 2,              
  },
  cardTitle: {
    fontSize: 14,              
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 12,          
  },
});