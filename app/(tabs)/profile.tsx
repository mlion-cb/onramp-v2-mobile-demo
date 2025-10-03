import { useOnramp } from "@/hooks/useOnramp";
import {
  useCurrentUser,
  useEvmAddress,
  useExportEvmAccount,
  useExportSolanaAccount,
  useIsInitialized,
  useIsSignedIn,
  useSignOut,
  useSolanaAddress,
} from "@coinbase/cdp-hooks";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { daysUntilExpiry, formatPhoneDisplay, getCountry, getSandboxMode, getSubdivision, getVerifiedPhone, isPhoneFresh60d, setCountry, setCurrentWalletAddress, setManualWalletAddress, setSandboxMode, setSubdivision, setVerifiedPhone } from "../../utils/sharedState";

const { CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, BORDER, WHITE } = COLORS;

export default function WalletScreen() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { signOut } = useSignOut();

  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    type: 'success' as 'success' | 'error' | 'info'
  });

  // Address resolution matching working reference project
  const explicitEOAAddress = currentUser?.evmAccounts?.[0] as string;
  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] as string;

  // For display: prefer smart account, then EOA
  const primaryAddress = smartAccountAddress || explicitEOAAddress;

  const { exportEvmAccount } = useExportEvmAccount();
  const { exportSolanaAccount } = useExportSolanaAccount();
  const { solanaAddress } = useSolanaAddress();
  const { evmAddress } = useEvmAddress();

  // For export: Use EOA first, then evmAddress hook, then smart account
  const evmWalletAddress = explicitEOAAddress || evmAddress || smartAccountAddress;

  // Add debugging similar to working reference
  useEffect(() => {
    if (currentUser) {
      console.log('=== DETAILED WALLET INFORMATION ===');

      // EOA Information
      if (currentUser.evmAccounts && currentUser.evmAccounts.length > 0) {
        console.log('--- EOA ADDRESSES ---');
        currentUser.evmAccounts.forEach((account, index) => {
          console.log(`EOA Address ${index + 1}:`, account);
        });
      } else {
        console.log('EOA Addresses: None found');
      }

      // Smart Account Information
      if (currentUser.evmSmartAccounts && currentUser.evmSmartAccounts.length > 0) {
        console.log('--- SMART ACCOUNT ADDRESSES ---');
        currentUser.evmSmartAccounts.forEach((account, index) => {
          console.log(`Smart Account ${index + 1}:`, account);
        });
      } else {
        console.log('Smart Accounts: None found');
      }

      // Address Resolution
      console.log('--- ADDRESS RESOLUTION ---');
      console.log('Explicit EOA:', explicitEOAAddress);
      console.log('Smart Account:', smartAccountAddress);
      console.log('useEvmAddress() hook:', evmAddress);
      console.log('Final evmWalletAddress:', evmWalletAddress);
      console.log('Solana Address:', solanaAddress);
      console.log('=== END DETAILED WALLET INFO ===');
    }
  }, [currentUser, evmAddress, solanaAddress, explicitEOAAddress, smartAccountAddress, evmWalletAddress]);

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportType, setExportType] = useState<'evm' | 'solana'>('evm');
  const [exporting, setExporting] = useState(false);

  const verifiedPhone = getVerifiedPhone();
  const formattedPhone = formatPhoneDisplay(verifiedPhone);
  const phoneFresh = isPhoneFresh60d();
  const d = daysUntilExpiry();
  const signedButNoSA = isSignedIn && !primaryAddress;


  const [countries, setCountries] = useState<string[]>([]);
  const [usSubs, setUsSubs] = useState<string[]>([]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [subPickerVisible, setSubPickerVisible] = useState(false);
  const country = getCountry();
  const subdivision = getSubdivision();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(300)).current;
  const { buyConfig, fetchOptions } = useOnramp(); 

  const sandboxEnabled = getSandboxMode();
  const [localSandboxEnabled, setLocalSandboxEnabled] = useState(getSandboxMode());
  const [manualAddress, setManualAddress] = useState('');
  // sync local state with shared state on mount
  useEffect(() => {
    setLocalSandboxEnabled(getSandboxMode());
  }, []);

  useEffect(() => {
    // Ensure this hook instance has loaded the config
    if (!buyConfig) {
      fetchOptions();
    }
  }, [buyConfig, fetchOptions]);

  useEffect(() => {
    if (isSignedIn && primaryAddress) {
      setManualAddress(''); // Clear manual input when real wallet connects
      setManualWalletAddress(null);
    }
  }, [isSignedIn, primaryAddress]);

  // sync manual address with shared state
  useEffect(() => {
    if (localSandboxEnabled && !isSignedIn) {
      setManualWalletAddress(manualAddress);
    } else {
      setManualWalletAddress(null);
    }
  }, [manualAddress, localSandboxEnabled, isSignedIn]);

  useEffect(() => {
    if (buyConfig?.countries) {
      const validCountries = buyConfig.countries.map((c: any) => c.id).filter(Boolean);
      setCountries(validCountries);

      const us = buyConfig.countries.find((c: any) => c.id === 'US');
      setUsSubs(us?.subdivisions || []);
    }
  }, [buyConfig]);

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

  const openPhoneVerify = useCallback(() => {
    router.push({
      pathname: '/phone-verify',
      params: { initialPhone: verifiedPhone || '' }
    });
  }, [router, verifiedPhone]);

  useEffect(() => {
    setCurrentWalletAddress(primaryAddress ?? null);
  }, [primaryAddress]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('signOut error', e);
    } finally {
      setCurrentWalletAddress(null);
      setManualWalletAddress(null);
      await setVerifiedPhone(null);
      setAlertState({ visible: true, title: "Signed out", message: "You've been signed out.", type: 'success' });
    }
  }, [signOut]);

  

  const isExpoGo = process.env.EXPO_PUBLIC_USE_EXPO_CRYPTO === 'true';

  const handleRequestExport = () => {
    if (!isSignedIn || (!evmWalletAddress && !solanaAddress)) return; // Allow export if either wallet exists

    if (isExpoGo) {
      setAlertState({
        visible: true,
        title: "Export not available",
        message: "Private key export is not available in Expo Go. Please use a development build or TestFlight.",
        type: "info",
      });
      return;
    }

    // If both wallets exist, show choice modal, otherwise export the available one
    if (evmWalletAddress && solanaAddress) {
      // Show choice modal
      setAlertState({
        visible: true,
        title: "Choose Wallet Type",
        message: "Which wallet would you like to export?",
        type: "info",
      });
    } else if (evmWalletAddress) {
      setExportType('evm');
      setShowExportConfirm(true);
    } else if (solanaAddress) {
      setExportType('solana');
      setShowExportConfirm(true);
    }
  };

  const handleConfirmedExport = async () => {
    const isEvmExport = exportType === 'evm';
    const targetAddress = isEvmExport ? evmWalletAddress : solanaAddress;

    if (!targetAddress) {
      setAlertState({
        visible: true,
        title: "Export failed",
        message: `No ${isEvmExport ? 'EVM' : 'Solana'} address found for export.`,
        type: "error",
      });
      return;
    }

    setExporting(true);
    try {
      console.log(`Exporting ${isEvmExport ? 'EVM' : 'Solana'} wallet:`, targetAddress);
      let result;
      if (isEvmExport) {
        // Use the EVM address string - this is what CDP expects
        result = await exportEvmAccount({ evmAccount: evmWalletAddress as `0x${string}` });
      } else {
        // Export Solana wallet
        result = await exportSolanaAccount({ solanaAccount: solanaAddress as string });
      }

      await Clipboard.setStringAsync(result.privateKey);
      setAlertState({
        visible: true,
        title: "Private key copied",
        message: `Your ${isEvmExport ? 'EVM' : 'Solana'} private key has been copied to the clipboard. Store it securely and clear your clipboard.`,
        type: "info",
      });
    } catch (e) {
      setAlertState({
        visible: true,
        title: "Export failed",
        message: e instanceof Error ? e.message : "Unable to export private key.",
        type: "error",
      });
    } finally {
      setExporting(false);
      setShowExportConfirm(false);
    }
  };

  const unverifyPhone = async () => {
    await setVerifiedPhone(null);
    setAlertState({
      visible: true,
      title: "Phone removed",
      message: "Phone verification was cleared for this demo. You'll be asked to verify again on next purchase.",
      type: "info",
    });
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Initializing wallet...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ flex: 1, backgroundColor: CARD_BG }}
          contentContainerStyle={{ padding: 20, gap: 24}}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          bounces={true}
          overScrollMode="always"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.container}>
            {/* Account card */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Embedded wallet (by Email)</Text>

              {signedButNoSA ? (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subValue}>Wallet creation in progress</Text>
                    <Text style={styles.subHint}>Please wait while your embedded wallet is being created. This may take a few moments.</Text>
                  </View>

                  <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                    <Text style={styles.buttonTextSecondary}>Sign out</Text>
                  </Pressable>
                </View>
              ) : !isSignedIn ? (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subValue}>No wallet connected</Text>
                    <Text style={styles.subHint}>Sign in with email to create your embedded wallet</Text>
                  </View>
                  <Pressable 
                    style={[styles.button]} 
                    onPress={() => router.push('/email-verify')}
                  >
                    <Text style={styles.buttonText}>Connect wallet</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subHint}>Email address</Text>
                    <Text style={styles.subValue}>{currentUser?.authenticationMethods.email?.email || 'No email'}</Text>
                  </View>

                  <View style={styles.subBox}>
                    <Text style={styles.subHint}>EVM wallet address</Text>
                    <Text selectable style={styles.subValue}>{primaryAddress}</Text>
                  </View>

                  {solanaAddress && (
                    <View style={styles.subBox}>
                      <Text style={styles.subHint}>Solana wallet address</Text>
                      <Text selectable style={styles.subValue}>{solanaAddress}</Text>
                    </View>
                  )}

                  <Pressable
                    style={[
                      styles.button,
                      { backgroundColor: '#DC2626' },
                      (isExpoGo || (!evmWalletAddress && !solanaAddress) || exporting) && styles.buttonDisabled
                    ]}
                    onPress={handleRequestExport}
                    disabled={(!evmWalletAddress && !solanaAddress) || exporting}
                  >
                    <Text style={styles.buttonText}>
                      {exporting ? "Exporting..." : isExpoGo ? "Export unavailable (Expo Go)" : "Export private key"}
                    </Text>
                  </Pressable>

                  <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                    <Text style={styles.buttonTextSecondary}>Sign out</Text>
                  </Pressable>
                </View>
              )}
            </View>
            {/* Fallback sign out for edge cases */}
            {isSignedIn && !signedButNoSA && !primaryAddress && (
              <View style={styles.card}>
                <Text style={styles.rowLabel}>Session Management</Text>
                <Pressable style={[styles.buttonSecondary]} onPress={handleSignOut}>
                  <Text style={styles.buttonTextSecondary}>Sign out</Text>
                </Pressable>
              </View>
            )}
            {/* Sandbox Wallet Card - NEW, only show when sandbox + no connected wallet */}
            {localSandboxEnabled && !isSignedIn && (
              <View style={styles.card}>
                <Text style={styles.rowLabel}>Sandbox Wallet Address</Text>
                
                <View style={styles.subBox}>
                  <Text style={styles.subHint}>Manual address input (testing only)</Text>
                  <TextInput
                    style={styles.input}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    placeholder="Enter any wallet address for testing"
                    placeholderTextColor={TEXT_SECONDARY}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.helper}>
                  In sandbox mode, you can input any valid address format for any network to test the onramp flow.
                </Text>
              </View>
            )}

            {/* Phone verification card */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Phone verification (for Apple Pay)</Text>

              <View style={styles.subBox}>
                <Text style={styles.subValue}>
                  {verifiedPhone ? (phoneFresh ? formattedPhone : `${formattedPhone} (expired)`) : 'No verified phone'}
                </Text>
                <Text style={styles.subHint}>
                  {verifiedPhone ? (phoneFresh ? `Verified • expires in ${d} day${d===1?'':'s'}` : 'Re-verify required') : 'Required before buying crypto'}
                </Text>
              </View>

              <Pressable style={[styles.button, phoneFresh ? { backgroundColor: BORDER } : null]} onPress={openPhoneVerify}>
                <Text style={[styles.buttonText, phoneFresh ? { color: TEXT_PRIMARY } : null]}>
                  {verifiedPhone ? (phoneFresh ? 'Update phone' : 'Re-verify phone') : 'Verify phone'}
                </Text>
              </Pressable>
              {verifiedPhone && (
                <Pressable
                  style={[styles.buttonSecondary, { backgroundColor: BORDER }]}
                  onPress={unverifyPhone}
                >
                  <Text style={[styles.buttonTextSecondary, { color: TEXT_PRIMARY }]}>Unlink Phone</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.rowLabel}>Region (for Onramp Options)</Text>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Country</Text>
                <Pressable style={styles.pillSelect} onPress={() => setCountryPickerVisible(true)}>
                  <View style={styles.selectContent}>
                    <Text style={styles.pillText}>{country}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
                </Pressable>
              </View>

              {country === "US" && (
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Text style={styles.rowLabel}>Subdivision</Text>
                  <Pressable style={styles.pillSelect} onPress={() => setSubPickerVisible(true)}>
                    <View style={styles.selectContent}>
                      <Text style={styles.pillText}>{subdivision}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color={TEXT_SECONDARY} />
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.card}>
              
              <View style={styles.row}>
                <View style={styles.textContainer}>
                  <Text style={styles.rowValue}>Sandbox Environment</Text>
                  <Text style={localSandboxEnabled ? styles.subHint : styles.productionWarning}>
                    {localSandboxEnabled ? 'Test Mode\n\nNo real transactions will be executed.\n\nYou may experience Onramp flow with optional phone and email verification.\n\nOnly Guest Checkout (Debit Card) will be available for Coinbase Widget.' : 'Production Mode\n\nReal transactions will be executed on chain and balances will be debited if successful.\n\nPhone and email vericiation required.'}
                  </Text>
                </View>
                <Switch
                  value={localSandboxEnabled}
                  onValueChange={(value) => {
                    setLocalSandboxEnabled(value); // Update local state (triggers re-render)
                    setSandboxMode(value); // Update shared state (for other components)
                  }}
                  trackColor={{ true: BLUE, false: BORDER }}
                  thumbColor={Platform.OS === "android" ? (sandboxEnabled ? "#ffffff" : "#f4f3f4") : undefined}
                />
              </View>
            </View>

            {/* Export confirm modal */}
            <Modal
              visible={showExportConfirm}
              transparent
              animationType="fade"
              onRequestClose={() => setShowExportConfirm(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Export Private Key</Text>
                  <Text style={styles.modalMessage}>
                    Your private key will be copied to the clipboard. Keep it secure and never share it with anyone.
                  </Text>
                  
                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.button, { backgroundColor: BORDER, flex: 1 }]}
                      onPress={() => setShowExportConfirm(false)}
                    >
                      <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Cancel</Text>
                    </Pressable>
                    
                    <Pressable
                      style={[styles.button, { backgroundColor: '#DC2626', flex: 1 }]}
                      onPress={handleConfirmedExport}
                      disabled={exporting}
                    >
                      <Text style={styles.buttonText}>
                        {exporting ? "Exporting..." : "Export"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

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
                            <View style={styles.modalItemLeft}>
                              <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{c}</Text>
                            </View>
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
                            <View style={styles.modalItemLeft}>
                              <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{s}</Text>
                            </View>
                            {isSelected && <Ionicons name="checkmark" size={20} color={BLUE} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              </View>
            </Modal>

            <CoinbaseAlert
              visible={alertState.visible}
              title={alertState.title}
              message={alertState.message}
              type={alertState.type}
              onConfirm={() => setAlertState({ ...alertState, visible: false })}
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    marginBottom: 24,
  },
  rowLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 8,
  },
  subBox: {
    backgroundColor: CARD_BG,

    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  subValue: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  subHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    backgroundColor: BLUE,
    borderRadius: 22,            
    paddingVertical: 12,         
    paddingHorizontal: 20,       
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,               
    minHeight: 36,               
  },
  textContainer: {
    flex: 1,           
    marginRight: 12,  
  },
  productionWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  primary: {
    backgroundColor: BLUE,
  },
  secondary: {
    backgroundColor: BORDER,
  },
  buttonText: {
    color: WHITE,
    fontSize: 14,              
    fontWeight: '600',
    letterSpacing: 0.1,          
  },
  buttonSecondary: {
    backgroundColor: BORDER,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 36,
  },
  buttonTextSecondary: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  container: {
    flex: 1,
    backgroundColor: CARD_BG,
  },
  authContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  walletContainer: {
    maxWidth: 300,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    color: TEXT_PRIMARY,
    padding: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonDanger: {
    backgroundColor: '#DC2626',     // Proper red (not too bright)
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 36,
  },
  helper: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 8,
    lineHeight: 16,
  },
  signOutButton: {
    backgroundColor: '#f44336',
    marginTop: 20,
  },
  subContainer: {
    marginBottom: 4,
  },
  loadingText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  message: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  rowValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1
  },
  rowAction: {
    backgroundColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  rowActionText: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  modalMessage: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pillSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    minWidth: 80,
    maxWidth: 140,
  },
    pillText: {
      fontSize: 14,
      fontWeight: "500",
      color: TEXT_PRIMARY,
    },
    selectContent: {
      flexDirection: "row",
      alignItems: "center",
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
    modalItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    modalItemSelected: {
      backgroundColor: BLUE + "15",
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
    modalScrollView: {
      maxHeight: 400,
    },
    modalItemContent: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    modalItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
});