/**
 * Transfer Page - Send tokens to any address
 *
 * Features:
 * - Network selection (Base, Ethereum, Solana)
 * - Token selector
 * - Recipient address input with validation
 * - Amount input with quick % buttons (10%, 50%, 100%)
 * - USD value preview
 * - Gasless transfers on Base via Paymaster
 * - Transaction confirmation and status
 */

import { COLORS } from '@/constants/Colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSendEvmTransaction, useSendSolanaTransaction, useSendUserOperation, useEvmAddress, useSolanaAddress, useCurrentUser } from '@coinbase/cdp-hooks';
import { CoinbaseAlert } from '@/components/ui/CoinbaseAlerts';
import { isTestSessionActive } from '@/utils/sharedState';

const { DARK_BG, CARD_BG, TEXT_PRIMARY, TEXT_SECONDARY, BLUE, WHITE, BORDER } = COLORS;

export default function TransferScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [network, setNetwork] = useState('base'); // base, ethereum, solana
  const [sending, setSending] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Alert states
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error' | 'info'>('info');

  const { sendEvmTransaction } = useSendEvmTransaction();
  const { sendSolanaTransaction } = useSendSolanaTransaction();
  const { sendUserOperation } = useSendUserOperation();
  const { evmAddress } = useEvmAddress();
  const { solanaAddress } = useSolanaAddress();
  const { currentUser } = useCurrentUser();

  // Get smart account address for Base (needed for sendUserOperation with Paymaster)
  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] || null;

  // Get EOA address for Ethereum (needed for sendEvmTransaction)
  const eoaAddress = currentUser?.evmAccounts?.[0] || null;

  // Load token data from params (only on mount)
  useEffect(() => {
    if (params.token) {
      try {
        const tokenData = JSON.parse(params.token as string);
        setSelectedToken(tokenData);
      } catch (e) {
        console.error('Error parsing token data:', e);
      }
    }
    if (params.network) {
      setNetwork(params.network as string);
    }
  }, [params.token, params.network]); // Only depend on specific param values, not the entire params object

  // Validate address format
  const validateAddress = (address: string) => {
    if (!address) {
      setAddressError(null);
      return false;
    }

    if (network === 'solana') {
      // Solana address validation (base58, 32-44 chars)
      if (!address.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        setAddressError('Invalid Solana address format');
        return false;
      }
    } else {
      // EVM address validation (0x + 40 hex chars)
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        setAddressError('Invalid EVM address format');
        return false;
      }
    }

    setAddressError(null);
    return true;
  };

  // Update address and validate
  const handleAddressChange = (address: string) => {
    setRecipientAddress(address);
    if (address) {
      validateAddress(address);
    } else {
      setAddressError(null);
    }
  };

  // Helper to show custom alerts
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  // Calculate token balance and set percentage
  const handleQuickAmount = (percentage: number) => {
    if (!selectedToken?.amount) return;

    const tokenAmount = parseFloat(selectedToken.amount.amount || '0');
    const decimals = parseInt(selectedToken.amount.decimals || '0');
    const actualBalance = tokenAmount / Math.pow(10, decimals);
    const calculatedAmount = (actualBalance * percentage) / 100;

    setAmount(calculatedAmount.toFixed(6));
  };

  const handleSend = async () => {
    // Validate inputs
    if (!validateAddress(recipientAddress)) {
      showAlert('Invalid Address', addressError || 'Please enter a valid recipient address', 'error');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid amount', 'error');
      return;
    }

    if (!selectedToken) {
      showAlert('No Token Selected', 'Please select a token to transfer', 'error');
      return;
    }

    // Check balance
    const tokenAmount = parseFloat(selectedToken.amount.amount || '0');
    const decimals = parseInt(selectedToken.amount.decimals || '0');
    const actualBalance = tokenAmount / Math.pow(10, decimals);

    if (parseFloat(amount) > actualBalance) {
      showAlert('Insufficient Balance', `You only have ${actualBalance.toFixed(6)} ${selectedToken.token.symbol}`, 'error');
      return;
    }

    setSending(true);
    try {
      // Handle TestFlight demo mode
      if (isTestSessionActive()) {
        console.log('🧪 TestFlight mode - simulating transfer');
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
        setTxHash(mockTxHash);
        showAlert(
          'Transfer Demo Complete! 🧪',
          `TestFlight Demo Mode\n\nThis is a simulated transfer for testing the UI flow.\n\nAmount: ${amount} ${selectedToken.token.symbol}\nTo: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}\n\nIn production, this would execute a real blockchain transaction.`,
          'success'
        );
        return;
      }

      if (network === 'solana') {
        // Solana transfer
        await handleSolanaTransfer();
      } else {
        // EVM transfer (Base or Ethereum)
        await handleEvmTransfer();
      }
    } catch (error) {
      console.error('Transfer error:', error);
      showAlert('Transfer Failed', error instanceof Error ? error.message : 'Unknown error occurred', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleEvmTransfer = async () => {
    if (!evmAddress || !selectedToken) return;

    const tokenAddress = selectedToken.token?.contractAddress;
    const decimals = parseInt(selectedToken.amount?.decimals || '0');
    const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

    try {
      // Use Paymaster for Base network (gasless transactions)
      if (network === 'base') {
        if (!smartAccountAddress) {
          showAlert('Error', 'Smart account not found. Please create a smart wallet first.', 'error');
          return;
        }

        // For native ETH transfers on Base
        if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
          const result = await sendUserOperation({
            evmSmartAccount: smartAccountAddress as `0x${string}`,
            network: network as any,
            calls: [{
              to: recipientAddress as `0x${string}`,
              value: amountInSmallestUnit,
            }],
            useCdpPaymaster: true
          });

          setTxHash(result.userOperationHash);
          showAlert(
            'Transfer Complete! ✨',
            `Gasless transfer via Coinbase Paymaster\n\nSent ${amount} ${selectedToken.token?.symbol} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
            'success'
          );
        } else {
          // For ERC-20 token transfers on Base
          // ERC-20 transfer function signature: transfer(address,uint256)
          const transferFunctionSelector = '0xa9059cbb';

          // Encode recipient address (32 bytes, padded)
          const encodedRecipient = recipientAddress.slice(2).padStart(64, '0');

          // Encode amount (32 bytes, padded)
          const encodedAmount = amountInSmallestUnit.toString(16).padStart(64, '0');

          // Combine into calldata
          const calldata = `${transferFunctionSelector}${encodedRecipient}${encodedAmount}`;

          const result = await sendUserOperation({
            evmSmartAccount: smartAccountAddress as `0x${string}`,
            network: network as any,
            calls: [{
              to: tokenAddress as `0x${string}`,
              value: 0n,
              data: calldata as `0x${string}`,
            }],
            useCdpPaymaster: true
          });

          setTxHash(result.userOperationHash);
          showAlert(
            'Transfer Complete! ✨',
            `Gasless transfer via Coinbase Paymaster\n\nSent ${amount} ${selectedToken.token?.symbol} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
            'success'
          );
        }
      } else {
        // Use regular EVM transactions for Ethereum (NOT gasless)
        if (!eoaAddress) {
          showAlert('Error', 'EVM account not found. Please create an Ethereum wallet first.', 'error');
          return;
        }

        const chainId = 1; // Ethereum mainnet

        // For native ETH transfers on Ethereum
        if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
          const result = await sendEvmTransaction({
            evmAccount: eoaAddress as `0x${string}`,
            network: network as any,
            transaction: {
              to: recipientAddress as `0x${string}`,
              value: amountInSmallestUnit,
              chainId,
              type: 'eip1559'
            }
          });

          setTxHash(result.transactionHash);
          showAlert(
            'Transfer Complete!',
            `Sent ${amount} ${selectedToken.token?.symbol} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
            'success'
          );
        } else {
          // For ERC-20 token transfers on Ethereum
          // ERC-20 transfer function signature: transfer(address,uint256)
          const transferFunctionSelector = '0xa9059cbb';

          // Encode recipient address (32 bytes, padded)
          const encodedRecipient = recipientAddress.slice(2).padStart(64, '0');

          // Encode amount (32 bytes, padded)
          const encodedAmount = amountInSmallestUnit.toString(16).padStart(64, '0');

          // Combine into calldata
          const calldata = `${transferFunctionSelector}${encodedRecipient}${encodedAmount}`;

          const result = await sendEvmTransaction({
            evmAccount: eoaAddress as `0x${string}`,
            network: network as any,
            transaction: {
              to: tokenAddress as `0x${string}`,
              value: 0n,
              data: calldata as `0x${string}`,
              chainId,
              type: 'eip1559'
            }
          });

          setTxHash(result.transactionHash);
          showAlert(
            'Transfer Complete!',
            `Sent ${amount} ${selectedToken.token?.symbol} to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
            'success'
          );
        }
      }
    } catch (error) {
      console.error('EVM transfer error:', error);
      throw error;
    }
  };

  const handleSolanaTransfer = async () => {
    if (!solanaAddress || !selectedToken) return;

    // TODO: Implement proper Solana SPL token transfer
    // This requires creating a Solana transfer instruction
    showAlert('Coming Soon', 'Solana transfers will be implemented with proper SPL token support', 'info');
  };

  const handleAlertDismiss = () => {
    setAlertVisible(false);
    // If it was a success alert, navigate back
    if (alertType === 'success') {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>Transfer Tokens</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Network Info */}
          <View style={styles.card}>
            <Text style={styles.label}>Network</Text>
            <Text style={styles.networkText}>{network === 'base' ? 'Base' : network === 'ethereum' ? 'Ethereum' : 'Solana'}</Text>
            {network === 'base' && (
              <Text style={styles.helper}>✨ Gasless transfer powered by Coinbase Paymaster</Text>
            )}
          </View>

          {/* Token Info */}
          <View style={styles.card}>
            <Text style={styles.label}>Token</Text>
            {selectedToken ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.tokenSymbol}>{selectedToken.token?.symbol}</Text>
                    <Text style={styles.tokenName}>{selectedToken.token?.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.label}>Balance</Text>
                    <Text style={styles.tokenAmount}>
                      {(parseFloat(selectedToken.amount?.amount || '0') / Math.pow(10, parseInt(selectedToken.amount?.decimals || '0'))).toFixed(6)}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.helper}>No token selected</Text>
            )}
          </View>

          {/* Recipient Address */}
          <View style={styles.card}>
            <Text style={styles.label}>Recipient Address</Text>
            <TextInput
              style={[styles.input, addressError && { borderColor: '#FF6B6B' }]}
              value={recipientAddress}
              onChangeText={handleAddressChange}
              placeholder={network === 'solana' ? 'Solana address' : '0x...'}
              placeholderTextColor={TEXT_SECONDARY}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {addressError && (
              <Text style={[styles.helper, { color: '#FF6B6B', marginTop: 8 }]}>
                {addressError}
              </Text>
            )}
          </View>

          {/* Amount Input */}
          <View style={styles.card}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={TEXT_SECONDARY}
              keyboardType="decimal-pad"
            />

            {/* Quick Amount Buttons */}
            <View style={styles.quickButtons}>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(10)}
              >
                <Text style={styles.quickButtonText}>10%</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(50)}
              >
                <Text style={styles.quickButtonText}>50%</Text>
              </Pressable>
              <Pressable
                style={styles.quickButton}
                onPress={() => handleQuickAmount(100)}
              >
                <Text style={styles.quickButtonText}>Max</Text>
              </Pressable>
            </View>
          </View>

          {/* Send Button */}
          <Pressable
            style={[styles.sendButton, (!recipientAddress || !amount) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={!recipientAddress || !amount || sending}
          >
            {sending ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert */}
      <CoinbaseAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onConfirm={handleAlertDismiss}
        confirmText="Got it"
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  networkText: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
  },
  selectorText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  input: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickButton: {
    flex: 1,
    backgroundColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sendButton: {
    backgroundColor: BLUE,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 52,
  },
  sendButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  tokenName: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  tokenAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
});
