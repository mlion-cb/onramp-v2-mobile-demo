import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { COLORS } from '../constants/Colors';
import { TEST_ACCOUNTS } from '../constants/TestAccounts';
import { setVerifiedPhone, setCurrentWalletAddress, setCurrentSolanaAddress, setTestSession } from '../utils/sharedState';
import { useVerifySmsOTP, useSignInWithSms, useLinkSms, useIsInitialized } from '@coinbase/cdp-hooks';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, BLUE, WHITE } = COLORS;
const RESEND_SECONDS = 30;

export default function PhoneCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = params.phone as string;
  const flowId = params.flowId as string;
  const mode = (params.mode as 'signin' | 'link') || 'link'; // Default to link for backwards compat

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  // CDP hooks - use different hook based on mode (use same verify hook for both)
  const { verifySmsOTP } = useVerifySmsOTP();
  const { signInWithSms } = useSignInWithSms();
  const { linkSms } = useLinkSms();
  const { isInitialized } = useIsInitialized();

  const canResend = resendSeconds <= 0 && !sending && !verifying;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const resendCode = async () => {
    // Skip resend for test accounts
    if (phone === TEST_ACCOUNTS.phone) {
      setResendSeconds(RESEND_SECONDS);
      return;
    }

    setSending(true);
    try {
      console.log(`📤 [SMS Resend] Resending code for ${mode} flow`);

      let result;
      if (mode === 'signin') {
        result = await signInWithSms({ phoneNumber: phone });
      } else {
        result = await linkSms(phone); // linkSms takes string directly
      }

      console.log('✅ [SMS Resend] SMS sent successfully');
      setResendSeconds(RESEND_SECONDS);
    } catch (e: any) {
      console.error('❌ [SMS Resend] Error:', e);

      // Handle METHOD_ALREADY_LINKED - already linked, just reset timer
      if (e.code === 'METHOD_ALREADY_LINKED') {
        setResendSeconds(RESEND_SECONDS);
        return;
      }

      setAlert({
        visible: true,
        title: 'Error',
        message: e.message || 'Failed to resend SMS',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
  };

  const verifySms = async () => {
    if (!phone || !code) return;
    setVerifying(true);
    try {
      // Check if this is test phone (TestFlight)
      if (phone === TEST_ACCOUNTS.phone) {
        console.log(`🧪 Test phone detected, using mock verification (mode: ${mode})`);

        if (code !== TEST_ACCOUNTS.smsCode) {
          throw new Error(`Test SMS code must be: ${TEST_ACCOUNTS.smsCode}`);
        }

        if (mode === 'signin') {
          // Mock wallet creation for TestFlight
          console.log('🧪 Creating test session for phone signin');
          await setTestSession(TEST_ACCOUNTS.wallets.evm, TEST_ACCOUNTS.wallets.solana);
          setCurrentWalletAddress(TEST_ACCOUNTS.wallets.evm);
          setCurrentSolanaAddress(TEST_ACCOUNTS.wallets.solana);
        } else {
          // Mock phone linking
          console.log('🧪 Storing test phone for linking');
          await setVerifiedPhone(phone);
        }

        router.dismissAll();
        return;
      }

      // Real phone verification flow via CDP
      console.log(`📤 [SMS Verify] Verifying ${mode} flow`);

      // Use same verification hook for both signin and link
      await verifySmsOTP({ flowId, otp: code });

      if (mode === 'signin') {
        // Sign in with phone - creates wallet
        // Wait for wallet initialization
        console.log('⏳ Waiting for wallet creation...');
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        while (!isInitialized) {
          if (Date.now() - startTime > maxWaitTime) {
            console.warn('⚠️ Wallet initialization timeout - navigating anyway');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Check every 200ms
        }

        // Mark phone as verified (fresh OTP = verified for 60 days)
        await setVerifiedPhone(phone);
        console.log('✅ Phone sign-in successful, wallet ready, phone verified');
        router.dismissAll();
      } else {
        // Link phone to existing account
        console.log('✅ Phone linked successfully');
        await setVerifiedPhone(phone);

        // Show success message
        setAlert({
          visible: true,
          title: 'Phone Verified',
          message: 'Your phone number has been linked to your account.',
          type: 'success'
        });

        setTimeout(() => router.dismissAll(), 1500);
      }
    } catch (e: any) {
      console.error(`❌ [SMS Verify] ${mode} error:`, e);
      setAlert({
        visible: true,
        title: 'Verification Failed',
        message: e.message || 'Invalid code. Please try again.',
        type: 'error'
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepContainer}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Verify your phone' : 'Link your phone'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? 'Please enter the verification code we texted you to sign in.'
                : 'Please enter the verification code we texted you to link your phone.'}
            </Text>

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={setCode}
                placeholder=""
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                keyboardType="number-pad"
                maxLength={6}
                editable={!verifying}
                selectTextOnFocus={true}
                autoFocus
              />
            </View>

            <Pressable
              style={[styles.continueButton, (verifying || code.length < 4) && styles.disabledButton]}
              onPress={verifySms}
              disabled={verifying || code.length < 4}
            >
              {verifying ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.continueButtonText}>Verify</Text>
              )}
            </Pressable>

            {/* Resend section */}
            <View style={styles.resendContainer}>
              {resendSeconds > 0 ? (
                <Text style={styles.resendText}>You can resend in {resendSeconds}s</Text>
              ) : (
                <Pressable onPress={resendCode} disabled={!canResend}>
                  <Text style={[styles.resendButton, !canResend && styles.disabledText]}>
                    Resend code
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CoinbaseAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onConfirm={() => setAlert(a => ({ ...a, visible:false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  codeInputContainer: {
    marginBottom: 32,
    width: '100%',
  },
  codeInput: {
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: BLUE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 24,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  continueButton: {
    backgroundColor: BLUE,
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  continueButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  resendContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  resendText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  resendButton: {
    color: BLUE,
    fontSize: 16,
    fontWeight: '600',
  },
  topPadding: {
    height: 20,
  },
  disabledText: {
    color: TEXT_SECONDARY,
  },
  smsPreview: {
    marginTop: 40,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  smsLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  smsCode: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
});