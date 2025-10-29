import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CoinbaseAlert } from '../components/ui/CoinbaseAlerts';
import { COLORS } from '../constants/Colors';
import { TEST_ACCOUNTS } from '../constants/TestAccounts';
import { clearPendingForm, markPhoneVerifyCanceled } from '../utils/sharedState';
import { useSignInWithSms, useLinkSms, useCurrentUser, useIsSignedIn } from '@coinbase/cdp-hooks';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, BLUE, WHITE } = COLORS;

export default function PhoneVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialPhone = params.initialPhone as string || '';
  const mode = (params.mode as 'signin' | 'link') || 'link'; // Default to link for backwards compat

  const [phoneDisplay, setPhoneDisplay] = useState(''); // What user sees: (201) 555-0123
  const [phoneE164, setPhoneE164] = useState(''); // What we send: +12015550123

  const [phone, setPhone] = useState(initialPhone);
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState<{visible:boolean; title:string; message:string; type:'success'|'error'|'info'}>({
    visible:false, title:'', message:'', type:'info'
  });

  // CDP hooks - use different hook based on mode
  const { signInWithSms } = useSignInWithSms();
  const { linkSms } = useLinkSms();
  const { isSignedIn } = useIsSignedIn();

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

  const startSms = async () => {
    if (!isPhoneValid) {
      setAlert({ visible:true, title:'Error', message:'Please enter a valid US phone number', type:'error' });
      return;
    }

    // For linking mode, ensure user is signed in
    if (mode === 'link' && !isSignedIn) {
      setAlert({
        visible: true,
        title: 'Not Signed In',
        message: 'You must be signed in before linking a phone number. Please sign in first.',
        type: 'error'
      });
      return;
    }

    setSending(true);
    try {
      // Check if this is test phone (TestFlight) - bypass CDP
      if (phoneE164 === TEST_ACCOUNTS.phone) {
        console.log(`🧪 Test phone detected, skipping CDP SMS (mode: ${mode})`);

        // Navigate directly to code screen
        router.push({
          pathname: '/phone-code',
          params: { phone: phoneE164, mode }
        });
        return;
      }

      // Real phone verification flow via CDP
      console.log(`📤 [SMS] Starting ${mode} flow for phone`);
      console.log('Debug info:', {
        phoneE164,
        isSignedIn,
        mode,
        linkSmsType: typeof linkSms,
        signInWithSmsType: typeof signInWithSms
      });

      let result;
      if (mode === 'signin') {
        console.log('Calling signInWithSms with:', { phoneNumber: phoneE164 });
        result = await signInWithSms({ phoneNumber: phoneE164 });
      } else {
        console.log('Calling linkSms with:', phoneE164);
        result = await linkSms(phoneE164); // linkSms takes string directly
      }

      console.log('Result from CDP:', result);

      console.log(`✅ [SMS] ${mode} SMS sent successfully`);

      // Navigate to code verification page
      router.push({
        pathname: '/phone-code',
        params: { phone: phoneE164, flowId: result.flowId, mode }
      });
    } catch (e: any) {
      console.error(`❌ [SMS] ${mode} error:`, e);
      console.error('Error details:', {
        message: e.message,
        code: e.code,
        status: e.status,
        stack: e.stack
      });

      // Handle METHOD_ALREADY_LINKED - phone already linked to this user
      if (e.code === 'METHOD_ALREADY_LINKED') {
        console.log('✅ Phone already linked to your account');
        setAlert({
          visible: true,
          title: 'Already Linked',
          message: 'This phone number is already linked to your account.',
          type: 'info'
        });
        // Navigate back after acknowledgment
        setTimeout(() => router.back(), 2000);
        return;
      }

      // Handle ACCOUNT_EXISTS - phone linked to different account
      if (e.code === 'ACCOUNT_EXISTS') {
        setAlert({
          visible: true,
          title: mode === 'signin' ? 'Sign In Instead?' : 'Phone Already Used',
          message: mode === 'signin'
            ? 'This phone number is already associated with another account. Would you like to sign in with that account instead?'
            : 'This phone number is associated with another account. Please use a different number or sign in with that account.',
          type: 'error'
        });
        return;
      }

      // Generic error
      setAlert({
        visible: true,
        title: 'Error',
        message: e.message || 'Failed to send SMS',
        type: 'error'
      });
    } finally {
      setSending(false);
    }
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
            <Text style={styles.title}>
              {mode === 'signin' ? 'Sign in with phone' : 'Link your phone number'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin'
                ? "We'll text you a code to sign in. Standard message rates may apply."
                : "We'll text you a code to link your phone. This is required for Apple Pay checkout."}
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