import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { BASE_URL } from '../constants/BASE_URL';
import { COLORS } from '../constants/Colors';
import { TEST_ACCOUNTS } from '../constants/TestAccounts';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { clearPendingForm, markPhoneVerifyCanceled } from '../utils/sharedState';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, BLUE, WHITE } = COLORS;

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialPhone = params.initialPhone as string || '';
  const [phoneDisplay, setPhoneDisplay] = useState(''); // What user sees: (201) 555-0123
  const [phoneE164, setPhoneE164] = useState(''); // What we send: +12015550123

  const [phone, setPhone] = useState(initialPhone);
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  // Format phone number as user types
  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    
    // Limit to 10 digits (US phone number)
    const limitedDigits = digits.slice(0, 10);
    
    // Format based on length
    if (limitedDigits.length === 0) {
      return '';
    } else if (limitedDigits.length <= 3) {
      return `(${limitedDigits}`;
    } else if (limitedDigits.length <= 6) {
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    } else {
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
    }
  };

  const handlePhoneChange = (input: string) => {
    // If user is deleting and hits a formatted character, remove it
    if (input.length < phoneDisplay.length) {
      // User is deleting - extract just the digits
      const digits = input.replace(/\D/g, '');
      const formatted = formatPhoneNumber(digits);
      setPhoneDisplay(formatted);
      
      // Convert to E164 format
      if (digits.length === 10) {
        setPhoneE164(`+1${digits}`);
      } else {
        setPhoneE164('');
      }
      return;
    }
    
    // User is typing - normal formatting
    const formatted = formatPhoneNumber(input);
    setPhoneDisplay(formatted);
    
    // Convert to E164 format
    const digits = input.replace(/\D/g, '');
    if (digits.length === 10) {
      setPhoneE164(`+1${digits}`);
    } else {
      setPhoneE164('');
    }
  };

  const isPhoneValid = phoneE164.length === 12; // +1 + 10 digits


  // const e164Like = (s: string) => /^\+[1-9]\d{6,15}$/.test(s.trim());

  const startSms = async () => {
    if (!isPhoneValid) {
      setAlert({ visible:true, title:'Error', message:'Please enter a valid US phone number', type:'error' });
      return;
    }
    setSending(true);
    try {
      // Check if this is test phone (TestFlight) - bypass Twilio
      if (phoneE164 === TEST_ACCOUNTS.phone) {
        console.log('🧪 Test phone detected, skipping Twilio SMS');

        // Navigate directly to code screen
        router.push({
          pathname: '/phone-code',
          params: { phone: phoneE164 }
        });
        return;
      }

      // Real phone verification flow (auth handled by authenticatedFetch)
      console.log('📤 [SMS Start] Sending authenticated request to backend');

      const r = await authenticatedFetch(`${BASE_URL}/auth/sms/start`, {
        method:'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneE164 }) // Send E164 format
      }).then(res => res.json());

      if (r.error) throw new Error(r.error);

      console.log('✅ [SMS Start] SMS sent successfully');

      // Navigate to code verification page
      router.push({
        pathname: '/phone-code',
        params: { phone: phoneE164 }
      });
    } catch (e:any) {
      console.error('❌ [SMS Start] Error:', e.message);
      setAlert({ visible:true, title:'Error', message:e.message || 'Failed to send SMS', type:'error' });
    } finally { setSending(false); }
  };

  const handleBack = () => {
    clearPendingForm();
    markPhoneVerifyCanceled();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
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
            <Text style={styles.title}>What's your phone number?</Text>
            <Text style={styles.subtitle}>
              We'll text you a code. We keep your number private and won't send spam.
            </Text>

            <View style={styles.phoneInputContainer}>
              <Text style={styles.countryCode}>🇺🇸 +1</Text>
              <TextInput
                style={styles.phoneInput}
                value={phoneDisplay}
                onChangeText={handlePhoneChange}
                placeholder="(201) 555-0123"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="phone-pad"
                editable={!sending}
                autoFocus
                maxLength={14}
              />
            </View>

            <Pressable
              style={[styles.continueButton, (!isPhoneValid || sending) && styles.disabledButton]}
              onPress={startSms}
              disabled={!isPhoneValid || sending}
            >
              {sending ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </Pressable>
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
  topPadding: {
    height: 20,
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
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 32,
    width: '100%',
  },
  flagEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  countryCode: {
    fontSize: 18,
    color: TEXT_PRIMARY,
    marginRight: 12,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    fontSize: 18,
    color: TEXT_PRIMARY,
    padding: 0,
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
});