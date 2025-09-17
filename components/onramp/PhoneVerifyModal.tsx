import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../../constants/BASE_URL';
import { COLORS } from '../../constants/Colors';
import { CoinbaseAlert } from '../ui/CoinbaseAlerts';

const { CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, BLUE, WHITE } = COLORS;
const RESEND_SECONDS = 30;


type Props = {
  visible: boolean;
  onClose: () => void;
  onVerified: (phoneE164: string) => void;
  initialPhone?: string; // ← add
};

export default function PhoneVerifyModal({ visible, onClose, onVerified, initialPhone }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const insets = useSafeAreaInsets();

  const e164Like = (s: string) => /^\+[1-9]\d{6,15}$/.test(s.trim());
  const canResend = step === 'code' && resendSeconds <= 0 && !sending && !verifying && e164Like(phone);
  
  useEffect(() => {
    if (visible) {
      // prefill when opening
      const pre = (initialPhone ?? '').trim();
      setPhone(pre);
      setCode('');
      setResendSeconds(0);
      setStep('phone'); // ← always start here; only move to 'code' after startSms success
    } else {
      setPhone(''); setCode(''); setResendSeconds(0); setStep('phone');
    }
  }, [visible, initialPhone]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  const startSms = async () => {
    if (!e164Like(phone)) {
      setAlert({ visible:true, title:'Error', message:'Enter phone in E.164 (e.g. +14155552671)', type:'error' });
      return;
    }
    setSending(true);
    try {
      const r = await fetch(`${BASE_URL}/auth/sms/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone }) }).then(res => res.json());
      if (r.error) throw new Error(r.error);
      setResendSeconds(RESEND_SECONDS);
      setStep('code'); // ← only here
    } catch (e:any) {
      setAlert({ visible:true, title:'Error', message:e.message || 'Failed to send SMS', type:'error' });
    } finally { setSending(false); }
  };

  const verifySms = async () => {
    if (!phone || !code) return;
    setVerifying(true);
    try {
      const r = await fetch(`${BASE_URL}/auth/sms/verify`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ phone, code })
      }).then(res => res.json());
      if (r.error) throw new Error(r.error);
      if (r.status === 'approved' && r.valid) {
        onVerified(phone);
        onClose();
      } else {
        setAlert({visible:true,title:'Invalid code',message:'Please try again',type:'error'});
      }
    } catch (e:any) {
      setAlert({visible:true,title:'Error',message:e.message || 'Verification failed',type:'error'});
    } finally { setVerifying(false); }
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Modal
        transparent
        visible={visible}
        animationType="slide"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={onClose}
      >    
      <Pressable style={styles.backdrop} onPress={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={-8} // lift sheet a bit more on iOS
        style={{ width: '100%' }}
      >
        <ScrollView
          contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom + 4) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.hint}>Required to complete your purchase</Text>

            {step === 'phone' && (
              <>
                <Text style={styles.label}>Phone (E.164)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1xxxxxxxxxx"
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="phone-pad"
                  editable={!sending && !verifying}
                  autoCapitalize='none'
                />

                <Pressable
                  style={[styles.button, (sending || !e164Like(phone)) && styles.disabled]}
                  onPress={startSms}
                  disabled={sending || !e164Like(phone)}
                >
                  <Text style={styles.buttonText}>{sending ? 'Sending…' : 'Send SMS Code'}</Text>
                </Pressable>
              </>
            )}

            {step === 'code' && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: TEXT_PRIMARY }}>{phone || 'No phone'}</Text>
                  <Pressable onPress={() => setStep('phone')} style={{ marginTop: 6 }}>
                    <Text style={{ color: TEXT_SECONDARY }}>Edit phone</Text>
                  </Pressable>
                </View>
                <Text style={styles.label}>EnterCode</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  textContentType="oneTimeCode" 
                  autoComplete="sms-otp" 
                  placeholderTextColor={TEXT_SECONDARY}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!verifying}
                  selectTextOnFocus={true}   
                  autoFocus
                />

                <Pressable
                  style={[styles.button, (verifying || code.length < 4) && styles.disabled]}
                  onPress={verifySms}
                  disabled={verifying || code.length < 4}
                >
                  {verifying ? <ActivityIndicator color={WHITE} /> : <Text style={styles.buttonText}>Verify</Text>}
                </Pressable>

                {/* Resend controls */}
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  {resendSeconds > 0 ? (
                    <Text style={{ color: TEXT_SECONDARY }}>Resend in {resendSeconds}s</Text>
                  ) : (
                    <Pressable onPress={startSms} disabled={!canResend}>
                      <Text style={{ color: canResend ? BLUE : TEXT_SECONDARY, fontWeight: '600' }}>
                        Resend code
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Pressable>

      <CoinbaseAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onConfirm={() => setAlert(a => ({ ...a, visible:false }))}
      />
    </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet: { backgroundColor: CARD_BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { color: TEXT_PRIMARY, fontSize: 20, fontWeight:'600' },
  hint: { color: TEXT_SECONDARY, marginBottom: 12 },
  label: { color: TEXT_PRIMARY, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: CARD_BG, borderColor: BORDER, borderWidth:1, borderRadius:12, color: TEXT_PRIMARY, padding:14 },
  button: { backgroundColor: BLUE, borderRadius:12, padding:14, alignItems:'center', marginTop:12 },
  buttonText: { color: WHITE, fontWeight:'600' },
  disabled: { opacity: 0.6 }
});