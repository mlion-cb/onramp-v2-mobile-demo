import { useCallback, useState } from "react";
import { OnrampFormData } from "../components/onramp/OnrampForm";
import { createApplePayOrder } from "../utils/createApplePayOrder";


export function useOnramp() {
  // These states from index.tsx:
  const [applePayVisible, setApplePayVisible] = useState(false);
  const [hostedUrl, setHostedUrl] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'success' | 'error' | null>(null);

  const createOrder = useCallback(async (formData: OnrampFormData) => {
    try {
      setIsProcessingPayment(true); // Start loading
      const result = await createApplePayOrder({
        paymentAmount: formData.amount,
        paymentCurrency: "USD",
        purchaseCurrency: formData.asset,
        paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
        destinationNetwork: formData.network,
        destinationAddress: formData.address,
        email: 'test@test.com',
        phoneNumber: '+13412133368',
        phoneNumberVerifiedAt: new Date().toISOString(),
        partnerUserRef: `${!!formData.sandbox && "sandbox-"}user-${formData.address}`,
        agreementAcceptedAt: new Date().toISOString()
      });
      
      // Handle successful response (maybe navigate to next screen, show success, etc.)
      console.log('Success:', result);

      // Extract hosted URL and show WebView
      if (result.hostedUrl) {
        setHostedUrl(result.hostedUrl);
        setApplePayVisible(true);
      } else {
        throw new Error('No payment URL received');
      }
      
    
    } catch (error) {
      console.error('API Error:', error);
      setIsProcessingPayment(false);
      throw error;
    }
  }, []);

  const closeApplePay = useCallback(() => {
    setApplePayVisible(false);
    setHostedUrl('');
    setIsProcessingPayment(false);
    setTransactionStatus(null);
  }, []);

  return {
    // State
    applePayVisible,
    hostedUrl,
    isProcessingPayment,
    transactionStatus,
    
    // Actions
    createOrder,
    closeApplePay,
    setTransactionStatus,
    setIsProcessingPayment,
  };
}