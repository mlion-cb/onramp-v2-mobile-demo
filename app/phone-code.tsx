import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { BASE_URL } from '../constants/BASE_URL';
import { COLORS } from '../constants/Colors';
import { TEST_ACCOUNTS } from '../constants/TestAccounts';
import { setVerifiedPhone } from '../utils/sharedState';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, BLUE, WHITE } = COLORS;
const RESEND_SECONDS = 30;

export default function PhoneCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = params.phone as string;
  
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  const canResend = resendSeconds <= 0 && !sending && !verifying;

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const resendCode = async () => {
    setSending(true);
    try {
      const r = await fetch(`${BASE_URL}/auth/sms/start`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body: JSON.stringify({ phone }) 
      }).then(res => res.json());
      if (r.error) throw new Error(r.error);
      setResendSeconds(RESEND_SECONDS);
    } catch (e:any) {
      setAlert({ visible:true, title:'Error', message:e.message || 'Failed to resend SMS', type:'error' });
    } finally { setSending(false); }
  };

  const verifySms = async () => {
    if (!phone || !code) return;
    setVerifying(true);
    try {
      // Check if this is test phone (TestFlight)
      if (phone === TEST_ACCOUNTS.phone) {
        console.log('🧪 Test phone detected, using mock verification');

        if (code !== TEST_ACCOUNTS.smsCode) {
          throw new Error(`Test SMS code must be: ${TEST_ACCOUNTS.smsCode}`);
        }

        // Store test phone with 60-day expiry (same as real flow)
        await setVerifiedPhone(phone);
        router.dismissAll();
        return;
      }

      // Real phone verification flow
      const r = await fetch(`${BASE_URL}/auth/sms/verify`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ phone, code })
      }).then(res => res.json());
      if (r.error) throw new Error(r.error);
      if (r.status === 'approved' && r.valid) {
        await setVerifiedPhone(phone);
        // Navigate back to home (or wherever you want)
        router.dismissAll(); // This will go back to the main screen
      } else {
        setAlert({visible:true,title:'Invalid code',message:'Please try again',type:'error'});
      }
    } catch (e:any) {
      setAlert({visible:true,title:'Error',message:e.message || 'Verification failed',type:'error'});
    } finally { setVerifying(false); }
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
            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.subtitle}>
              Please enter the verification code we texted you to continue.
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