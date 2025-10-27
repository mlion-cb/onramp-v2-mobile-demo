/**
 * TestFlight Test Account Configuration
 *
 * This file contains fixed credentials for Apple TestFlight reviewers
 * to test the app without needing real email/phone verification.
 *
 * SECURITY NOTE: These are MOCK credentials only. No real CDP account
 * is created. All wallet addresses and seed phrases are for testing only.
 */

export const TEST_ACCOUNTS = {
  email: 'reviewer@coinbase-demo.app',
  otp: '123456',
  phone: '+12345678901', // Standard test phone number (accepted by most APIs)
  smsCode: '654321',

  // Mock user ID for history fetching
  userId: 'f5ad4b85-368d-4ab5-a1b6-4f63fb1aab85',

  // Mock wallet addresses (consistent for testing)
  wallets: {
    evm: '0x84ac0b2636ce2a40F7f558c1C449CBD15ec6F93E', // Smart Account for demo
    eoaDummy: '0x4a0Db3874642b0FedFAaf7d797872E0E34657CcB', // Dummy EOA address for display
    solana: '7YjXXvu3iCv9g3Ek5g8HoNT6o8CuapriCJzNeBg2eDQy'
  },

  // Mock seed phrase for export functionality (TestFlight only)
  seedPhrase: 'test flight review demo wallet please approve thank you coinbase reviewer mock seed phrase'
};

export function isTestAccount(email: string): boolean {
  return email.toLowerCase() === TEST_ACCOUNTS.email.toLowerCase();
}
