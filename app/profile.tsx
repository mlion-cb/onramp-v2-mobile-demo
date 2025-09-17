import PhoneVerifyModal from "@/components/onramp/PhoneVerifyModal";
import {
  useCurrentUser,
  useExportEvmAccount,
  useIsInitialized,
  useIsSignedIn,
  useSignInWithEmail,
  useSignOut,
  useVerifyEmailOTP
} from "@coinbase/cdp-hooks";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { CoinbaseAlert } from "../components/ui/CoinbaseAlerts";
import { COLORS } from "../constants/Colors";
import { daysUntilExpiry, getVerifiedPhone, isPhoneFresh60d, setCurrentWalletAddress, setVerifiedPhone } from "../utils/sharedState";

const { CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, BORDER, WHITE } = COLORS;

export default function WalletScreen() {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP } = useVerifyEmailOTP();
  const { signOut } = useSignOut();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState("");
  const [alertState, setAlertState] = useState({
    visible: false,
    title: "",
    message: "",
    type: 'success' as 'success' | 'error' | 'info'
  });

  const smartAccount = currentUser?.evmSmartAccounts?.[0];
  const RESEND_SECONDS = 30;
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  // console.log(currentUser?.evmAccounts, currentUser?.evmSmartAccounts);

  // Wallet export hooks
  const { exportEvmAccount } = useExportEvmAccount();

  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const verifiedPhone = getVerifiedPhone();
  const phoneFresh = isPhoneFresh60d();
  const d = daysUntilExpiry();

  const openPhoneModal = () => setPhoneModalVisible(true);
  const signedButNoSA = isSignedIn && !smartAccount;


  useEffect(() => {
    if (!flowId) return;
    setResendSeconds(RESEND_SECONDS);
  }, [flowId]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const canResend = !!flowId && resendSeconds <= 0 && !sending && !verifying;

  useEffect(() => {
    setCurrentWalletAddress(smartAccount ?? null);
  }, [smartAccount]);

  const handleSignIn = async () => {
    if (!email) {
      setAlertState({
        visible: true,
        title: "Error",
        message: "Please enter an email address",
        type: 'error'
      });
    return;
    }

    if (isSignedIn) {
      setAlertState({
        visible: true,
        title: "Already signed in",
        message: "You’re already authenticated. Please sign out first to change email.",
        type: "info",
      });
      return;
    }

    setSending(true);
    try {
      const result = await signInWithEmail({ email });
      setFlowId(result.flowId);
      setResendSeconds(RESEND_SECONDS);
    } catch (error) {
      setAlertState({
        visible: true,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to sign in",
        type: 'error'
      });
      setFlowId("");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !flowId) {
      setAlertState({
        visible: true,
        title: "Error",
        message: "Please enter the OTP",
        type: 'error'
      });
      return;
    }

    setVerifying(true);
    try {
      await verifyEmailOTP({ flowId, otp });
      setAlertState({
        visible: true,
        title: "Success",
        message: "Wallet connected successfully!",
        type: 'success'
      });
      setOtp("");
      setFlowId("");
    } catch (error) {
      setAlertState({
        visible: true,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to verify OTP",
        type: 'error'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setSending(true);
    try {
      const r = await signInWithEmail({ email });
      setFlowId(r.flowId);
      setResendSeconds(RESEND_SECONDS);
    } catch (error) {
      setAlertState({
        visible: true,
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to resend OTP",
        type: 'error'
      });
    }
    finally { setSending(false); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setAlertState({
        visible: true,
        title: "Copied!",
        message: "Address copied to clipboard",
        type: 'success'
      });
    } catch (error) {
      setAlertState({
        visible: true,
        title: "Error",
        message: "Failed to copy to clipboard",
        type: 'error'
      });
    }
  };

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      setAlertState({ visible: true, title: "Signed out", message: "You’ve been signed out.", type: 'success' });
    } finally {
      setCurrentWalletAddress(null);  // clear shared state
      setEmail(""); setOtp(""); setFlowId(""); setResendSeconds(0);
    }
  }, [signOut]);

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>Initializing wallet...</Text>
      </View>
    );
  }

  const handleRequestExport = () => {
    if (!isSignedIn || !smartAccount) return;
    setShowExportConfirm(true);
  };

  const handleConfirmedExport = async () => {
    if (!smartAccount) return;
    setExporting(true);
    try {
      const { privateKey } = await exportEvmAccount({ evmAccount: smartAccount });
      await Clipboard.setStringAsync(privateKey);
      setAlertState({
        visible: true,
        title: "Private key copied",
        message: "Your private key has been copied to the clipboard. Store it securely and clear your clipboard.",
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
    await setVerifiedPhone(null); // clears phone + verifiedAt in shared state (and AsyncStorage)
    setAlertState({
      visible: true,
      title: "Phone removed",
      message: "Phone verification was cleared for this demo. You’ll be asked to verify again on next purchase.",
      type: "info",
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ flex: 1, backgroundColor: CARD_BG }}
          contentContainerStyle={[styles.container, { padding: 16, gap: 20, justifyContent: undefined }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          <View style={styles.container}>
            <Text style={styles.title}>Your Wallet</Text>

            {/* Account card (shows either email flow or smart account details) */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Smart account</Text>

              {signedButNoSA ? (
                <View style={styles.subContainer}>
                  <View style={styles.subBox}>
                    <Text style={styles.subValue}>Session active, wallet not ready yet</Text>
                    <Text style={styles.subHint}>Sign out, then sign in again to create your wallet.</Text>
                  </View>
                  <Pressable style={[styles.button, { backgroundColor: BORDER }]} onPress={handleSignOut}>
                    <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Sign out</Text>
                  </Pressable>
                </View>
              ) : (

              !isSignedIn ? (
                <View style={styles.subContainer}>
                  <Text style={styles.rowLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor={TEXT_SECONDARY}
                    editable={!sending}
                  />

                  <Pressable
                    style={[styles.button, (sending || !!flowId) && styles.buttonDisabled]}
                    onPress={handleSignIn}
                    disabled={sending || !!flowId}
                  >
                    <Text style={styles.buttonText}>
                      {sending ? "Sending..." : flowId ? "Enter code below" : "Sign In with Email"}
                    </Text>
                  </Pressable>

                  {flowId && (
                    <>
                      <Text style={[styles.label, { textAlign: 'center', marginTop: 8 }]}>
                        We sent a 6‑digit code to {email}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={otp}
                        onChangeText={setOtp}
                        placeholder="Enter 6-digit OTP"
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        maxLength={6}
                        placeholderTextColor={TEXT_SECONDARY}
                        editable={!verifying}
                        autoFocus
                        selectTextOnFocus
                      />

                      <View style={{ alignItems: 'center', marginTop: 8 }}>
                        {canResend ? (
                          <Pressable onPress={handleResend}>
                            <Text style={{ color: BLUE, fontWeight: '700' }}>Resend code</Text>
                          </Pressable>
                        ) : (
                          <Text style={{ color: TEXT_SECONDARY }}>Resend in {resendSeconds}s</Text>
                        )}
                      </View>

                      <Pressable
                        style={[styles.button, verifying && styles.buttonDisabled]}
                        onPress={handleVerifyOTP}
                        disabled={verifying}
                      >
                        <Text style={styles.buttonText}>{verifying ? "Verifying..." : "Verify OTP"}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.subContainer}>
                  <Pressable style={styles.subBox} onPress={() => copyToClipboard(smartAccount!)}>
                    <Text selectable style={styles.subValue}>{smartAccount}</Text>
                    <Text style={styles.subHint}>Tap to copy</Text>
                  </Pressable>

                  {/* Stacked full-width buttons */}
                  <Pressable
                    style={[styles.button, { backgroundColor: '#8B0000' }]}
                    onPress={handleRequestExport}
                    disabled={!smartAccount || exporting}
                  >
                    <Text style={styles.buttonText}>{exporting ? "Exporting..." : "Export private key"}</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.button, { backgroundColor: BORDER }]}
                    onPress={handleSignOut}
                  >
                    <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Sign out</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Phone verification (always rendered) */}
            <View style={styles.card}>
              <Text style={styles.rowLabel}>Phone verification</Text>

              <View style={styles.subBox}>
                <Text style={styles.subValue}>
                  {verifiedPhone ? (phoneFresh ? verifiedPhone : `${verifiedPhone} (expired)`) : 'No verified phone'}
                </Text>
                <Text style={styles.subHint}>
                  {verifiedPhone ? (phoneFresh ? `Verified • expires in ${d} day${d===1?'':'s'}` : 'Re-verify required') : 'Required before buying crypto'}
                </Text>
              </View>

              <Pressable style={[styles.button, phoneFresh ? { backgroundColor: BORDER } : null]} onPress={openPhoneModal}>
                <Text style={[styles.buttonText, phoneFresh ? { color: TEXT_PRIMARY } : null]}>
                  {verifiedPhone ? (phoneFresh ? 'Update phone' : 'Re-verify phone') : 'Verify phone'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, { backgroundColor: BORDER }]}
                onPress={unverifyPhone}
              >
                <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Unlink Phone</Text>
              </Pressable>
            </View>

            {/* Phone modal */}
            <PhoneVerifyModal
              visible={phoneModalVisible}
              initialPhone={verifiedPhone || ''}
              onClose={() => setPhoneModalVisible(false)}
              onVerified={async (phoneE164) => {
                await setVerifiedPhone(phoneE164);
                setPhoneModalVisible(false);
                setAlertState({
                  visible: true,
                  title: "Phone verified",
                  message: `${phoneE164} has been verified. You can now buy crypto.`,
                  type: "success",
                });
              }}
            />

            {/* Export confirm */}
            <Modal
              visible={showExportConfirm}
              transparent
              animationType="fade"
              onRequestClose={() => setShowExportConfirm(false)}
            >
              <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowExportConfirm(false)}>
                <Pressable
                  style={{
                    marginTop: 'auto',
                    backgroundColor: CARD_BG,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    padding: 20,
                  }}
                  onPress={() => {}}
                >
                  <Text style={[styles.title, { marginBottom: 8 }]}>Security warning</Text>
                  <Text style={styles.message}>
                    Exporting your private key is high risk. Anyone with it has full control of your wallet.
                    Don’t share it, don’t store it unencrypted, and clear your clipboard after use.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <Pressable
                      style={[styles.button, { backgroundColor: BORDER, flex: 1 }]}
                      onPress={() => setShowExportConfirm(false)}
                      disabled={exporting}
                    >
                      <Text style={[styles.buttonText, { color: TEXT_PRIMARY }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, { backgroundColor: '#8B0000', flex: 1 }]}
                      onPress={handleConfirmedExport}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Yes, Export</Text>
                      )}
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
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
    padding: 16,
    marginBottom: 20,
  },
  rowLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 8,
  },
  subBox: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  subValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
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
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primary: {
    backgroundColor: BLUE,
  },
  secondary: {
    backgroundColor: BORDER,
  },
  buttonText: {
    color: WHITE,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
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
  signOutButton: {
    backgroundColor: '#f44336',
    marginTop: 20,
  },
  subContainer: {
    marginBottom: 4,
  },
  loadingText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
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
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1
  },
  rowAction: {
    backgroundColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12
  },
  rowActionText: {
    color: TEXT_PRIMARY,
    fontWeight: '600'
  },
});