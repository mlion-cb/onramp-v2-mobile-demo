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
 *
 * IMPORTANT: Both Base and Ethereum use Smart Account (balances stored there)
 */

import { CoinbaseAlert } from '@/components/ui/CoinbaseAlerts';
import { COLORS } from '@/constants/Colors';
import { isTestSessionActive } from '@/utils/sharedState';
import { useCurrentUser, useSendSolanaTransaction, useSendUserOperation, useSolanaAddress } from '@coinbase/cdp-hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import * as Clipboard from 'expo-clipboard';
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
import { parseEther, parseUnits } from 'viem';

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

  const { sendSolanaTransaction } = useSendSolanaTransaction();
  const { sendUserOperation, status: userOpStatus, data: userOpData, error: userOpError } = useSendUserOperation();
  const { solanaAddress } = useSolanaAddress();
  const { currentUser } = useCurrentUser();

  // Get smart account address (where balances are stored for both Base and Ethereum)
  const smartAccountAddress = currentUser?.evmSmartAccounts?.[0] || null;

  // Paymaster only supports specific tokens on Base: USDC, EURC, BTC (CBBTC)
  const tokenSymbol = selectedToken?.token?.symbol?.toUpperCase() || '';
  const isPaymasterSupported = network === 'base' && ['USDC', 'EURC', 'BTC'].includes(tokenSymbol);

  console.log('🔍 [TRANSFER] Account addresses:', {
    solanaAddress,
    smartAccountAddress,
  });

  // Watch user operation status and update alerts
  useEffect(() => {
    if (userOpStatus === 'pending' && userOpData?.userOpHash) {
      showAlert(
        'Transaction Pending ⏳',
        `User Operation Hash:\n${userOpData.userOpHash}\n\nWaiting for confirmation...\nPlease do NOT close this alert until transaction is complete. This may take a few seconds.`,
        'info'
      );
    } else if (userOpStatus === 'success' && userOpData) {
      const successInfo = `🔍 TRANSACTION CONFIRMED:

User Operation Hash:
${userOpData.userOpHash}

${userOpData.transactionHash ? `Transaction Hash:\n${userOpData.transactionHash}\n\n` : ''}Status: ${userOpData.status}
Network: ${network}
From: ${smartAccountAddress}

📋 Search on block explorer:
- Base: basescan.org
- Ethereum: etherscan.io`;

      showAlert(
        'Transfer Complete! ✨',
        successInfo,
        'success'
      );
    } else if (userOpStatus === 'error' && userOpError) {
      showAlert(
        'Transfer Failed ❌',
        `Error: ${userOpError.message}\n\nPlease try again or check your balance.`,
        'error'
      );
    }
  }, [userOpStatus, userOpData, userOpError]);

  // Load token data from params (only on mount)
  useEffect(() => {
    if (params.token) {
      try {
        const tokenData = JSON.parse(params.token as string);
        console.log('🔍 [TRANSFER] Loaded token data:', {
          symbol: tokenData.token?.symbol,
          contractAddress: tokenData.token?.contractAddress,
          mintAddress: tokenData.token?.mintAddress,
          amount: tokenData.amount?.amount,
          decimals: tokenData.amount?.decimals,
          network: params.network
        });
        setSelectedToken(tokenData);
      } catch (e) {
        console.error('Error parsing token data:', e);
      }
    }
    if (params.network) {
      setNetwork(params.network as string);
    }
  }, [params.token, params.network]);

  // Validate address format
  const validateAddress = (address: string) => {
    if (!address) {
      setAddressError(null);
      return false;
    }

    // Check if network is Solana (includes both 'solana' and 'solana-devnet')
    const isSolanaNetwork = network?.toLowerCase().includes('solana');

    if (isSolanaNetwork) {
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

    // Note: We don't check balance here - let the blockchain handle it
    // The smart account will reject if insufficient funds, giving a clearer error

    setSending(true);
    try {
      // Handle TestFlight demo mode
      if (isTestSessionActive()) {
        console.log('🧪 TestFlight mode - simulating transfer');
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
        await handleSolanaTransfer();
      } else {
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
    if (!selectedToken) return;

    // CRITICAL: Both Base and Ethereum use Smart Account (balances stored there)
    if (!smartAccountAddress) {
      showAlert('Error', 'Smart account not found. Cannot transfer funds.', 'error');
      return;
    }

    const tokenAddress = selectedToken.token?.contractAddress;
    // Treat as native if no address, zero address, or 0xeeee... sentinel (used by some SDKs)
    const isNativeTransfer = !tokenAddress ||
      tokenAddress === '0x0000000000000000000000000000000000000000' ||
      tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Convert amount to wei (smallest unit)
    // Native ETH: Use parseEther (always 18 decimals)
    // ERC-20: Use parseUnits with token-specific decimals
    const amountInSmallestUnit = isNativeTransfer
      ? parseEther(amount)
      : parseUnits(amount, parseInt(selectedToken.amount?.decimals || '0'));

    console.log('🔍 [EVM TRANSFER] Starting transfer:', {
      network,
      tokenAddress,
      amount,
      isNativeTransfer,
      decimals: isNativeTransfer ? 18 : parseInt(selectedToken.amount?.decimals || '0'),
      smartAccountAddress,
      amountInSmallestUnit: amountInSmallestUnit.toString()
    });

    try {
      // Use sendUserOperation for both Base and Ethereum (smart account transfers)
      if (isNativeTransfer) {
        // Native ETH transfer
        console.log('💸 [TRANSFER] Sending native ETH from smart account');
        const result = await sendUserOperation({
          evmSmartAccount: smartAccountAddress as `0x${string}`,
          network: network as any,
          calls: [{
            to: recipientAddress as `0x${string}`,
            value: amountInSmallestUnit,
            data: '0x' // Empty data for native transfer
          }],
          useCdpPaymaster: isPaymasterSupported, // Paymaster only on Base for USDC/EURC/CBBTC
          // paymasterUrl: 'https://api.developer.coinbase.com/rpc/v1/base/6DmPQTz8egifUIDdGm3wl4aoXAdYWw5H'
        });

        console.log('✅ [TRANSFER] User operation submitted:', result);
        setTxHash(result.userOperationHash);

        // Status updates handled by useEffect watching userOpStatus
      } else {
        // ERC-20 token transfer
        console.log('💸 [TRANSFER] Sending ERC-20 token from smart account');
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
          useCdpPaymaster: network === 'base' // Paymaster only on Base
        });

        console.log('✅ [TRANSFER] User operation submitted:', result);
        setTxHash(result.userOperationHash);

        // Status updates handled by useEffect watching userOpStatus
      }
    } catch (error) {
      console.error('EVM transfer error:', error);
      throw error;
    }
  };

  const handleSolanaTransfer = async () => {
    if (!solanaAddress || !selectedToken) return;

    try {
      const amountFloat = parseFloat(amount);
      const decimals = parseInt(selectedToken.amount?.decimals || '9');
      const amountRaw = Math.floor(amountFloat * Math.pow(10, decimals));

      // Check if this is an SPL token (has mintAddress) or native SOL
      const isSPLToken = selectedToken.token?.mintAddress;
      const tokenSymbol = selectedToken.token?.symbol || 'SOL';
      const isDevnet = network?.toLowerCase().includes('devnet');

      console.log('🔄 [SOLANA] Building transfer transaction:', {
        from: solanaAddress,
        to: recipientAddress,
        amount: amountRaw,
        isSPLToken,
        isDevnet,
        network,
        mintAddress: selectedToken.token?.mintAddress
      });

      // Show pending alert
      showAlert(
        'Transaction Pending ⏳',
        `Building and submitting Solana transaction...\n\nAmount: ${amount} ${tokenSymbol}\nTo: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}\n\nPlease do NOT close this alert until transaction is complete. This may take a few seconds.`,
        'info'
      );

      // Create Solana connection - use network parameter to determine cluster
      const { Connection, clusterApiUrl } = await import('@solana/web3.js');
      const cluster = isDevnet ? 'devnet' : 'mainnet-beta';
      const connection = new Connection(clusterApiUrl(cluster));

      // Fetch recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      let transaction: Transaction;

      if (isSPLToken) {
        // SPL Token Transfer (USDC, etc.) - only on devnet
        console.log('📦 [SPL] Building SPL token transfer...');

        const mintAddress = new PublicKey(selectedToken.token.mintAddress);
        const fromPubkey = new PublicKey(solanaAddress);
        const toPubkey = new PublicKey(recipientAddress);

        // Get sender's token account (ATA)
        const fromTokenAccount = await getAssociatedTokenAddress(
          mintAddress,
          fromPubkey
        );

        // Get recipient's token account (ATA)
        const toTokenAccount = await getAssociatedTokenAddress(
          mintAddress,
          toPubkey
        );

        // Check if recipient's token account exists
        let needsATACreation = false;
        try {
          await getAccount(connection, toTokenAccount);
          console.log('✅ [SPL] Recipient ATA exists');
        } catch (error) {
          console.log('⚠️ [SPL] Recipient ATA does not exist, will create');
          needsATACreation = true;
        }

        transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: fromPubkey
        });

        // Add create ATA instruction if needed
        if (needsATACreation) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              fromPubkey, // payer
              toTokenAccount, // ata
              toPubkey, // owner
              mintAddress // mint
            )
          );
          console.log('📝 [SPL] Added create ATA instruction');
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            fromTokenAccount, // source
            toTokenAccount, // destination
            fromPubkey, // owner
            amountRaw // amount
          )
        );

        console.log('✅ [SPL] Transaction built with', transaction.instructions.length, 'instructions');
      } else {
        // Native SOL transfer
        console.log('💎 [SOL] Building native SOL transfer...');

        transaction = new Transaction({
          recentBlockhash: blockhash,
          feePayer: new PublicKey(solanaAddress)
        }).add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(solanaAddress),
            toPubkey: new PublicKey(recipientAddress),
            lamports: amountRaw
          })
        );
      }

      // Serialize transaction to base64 (required by CDP API)
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      console.log('📤 [SOLANA] Sending transaction...');

      // Determine CDP network parameter
      const cdpNetwork = isDevnet ? 'solana-devnet' : 'solana';

      // Send transaction using CDP hook
      const result = await sendSolanaTransaction({
        solanaAccount: solanaAddress,
        network: cdpNetwork as any,
        transaction: serializedTransaction
      });

      console.log('✅ [SOLANA] Transaction successful:', result.transactionSignature);

      setTxHash(result.transactionSignature);

      // Show success alert with signature
      const explorerUrl = isDevnet
        ? `https://explorer.solana.com/tx/${result.transactionSignature}?cluster=devnet`
        : `https://solscan.io/tx/${result.transactionSignature}`;

      const successInfo = `🔍 TRANSACTION CONFIRMED:

Signature:
${result.transactionSignature}

Amount: ${amount} ${tokenSymbol}
Network: Solana ${isDevnet ? 'Devnet' : 'Mainnet'}
From: ${solanaAddress.slice(0, 6)}...${solanaAddress.slice(-4)}
To: ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}

📋 View on explorer:
${explorerUrl}`;

      showAlert(
        'Transfer Complete! ✨',
        successInfo,
        'success'
      );
    } catch (error) {
      console.error('Solana transfer error:', error);
      throw error;
    }
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
          style={{ flex: 1, backgroundColor: CARD_BG }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Solana SPL Token Notice - only show on mainnet SPL tokens */}
          {network === 'solana' && selectedToken?.token?.mintAddress && (
            <View style={[styles.card, { backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="information-circle" size={20} color="#856404" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.helper, { color: '#856404', fontWeight: '600' }]}>
                    Mainnet SPL Token
                  </Text>
                  <Text style={[styles.helper, { color: '#856404', marginTop: 4 }]}>
                    SPL token transfers are only supported on Solana Devnet. For mainnet SPL tokens, please export your private key from the Profile tab.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Network Info */}
          <View style={styles.card}>
            <Text style={styles.label}>Network</Text>
            <Text style={styles.networkText}>{network === 'base' ? 'Base' : network === 'ethereum' ? 'Ethereum' : 'Solana'}</Text>
            {isPaymasterSupported && (
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
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { flex: 1 } , addressError && { borderColor: '#FF6B6B' }]}
                value={recipientAddress}
                onChangeText={handleAddressChange}
                placeholder={network === 'solana' ? 'Solana address' : '0x...'}
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {recipientAddress ? (
                <Pressable
                  style={styles.pasteButton}
                  onPress={() => {
                    setRecipientAddress('');
                    setAddressError(null);
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={TEXT_SECONDARY} />
                </Pressable>
              ) : (
                <Pressable
                  style={styles.pasteButton}
                  onPress={async () => {
                    const text = await Clipboard.getStringAsync();
                    if (text) handleAddressChange(text);
                  }}
                >
                  <Ionicons name="clipboard-outline" size={20} color={BLUE} />
                </Pressable>
              )}
            </View>

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
    backgroundColor: CARD_BG, // was DARK_BG
  },
  content: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pasteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
