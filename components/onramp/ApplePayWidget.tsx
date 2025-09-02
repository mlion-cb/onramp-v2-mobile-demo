import { useRef } from "react";
import { Alert } from "react-native";
import { WebView } from "react-native-webview";

export function ApplePayWidget({ 
  paymentUrl, 
  onClose, 
  setIsProcessingPayment,
  setTransactionStatus 
}: { 
  paymentUrl: string;
  onClose?: () => void;
  setIsProcessingPayment?: (loading: boolean) => void;
  setTransactionStatus?: (status: 'pending' | 'success' | 'error' | null) => void; 
}) {
  const webViewRef = useRef<WebView>(null);
  // const finalUrl = `${paymentUrl}`;
  const finalUrl = `${paymentUrl}&forceFeature=true`;


  // Don't render anything if not visible or no URL
  if (!paymentUrl) {
    return null;
  }


  return (
    <WebView
      ref={webViewRef}
      style={{
        width: 1,
        height: 1,
        position: 'absolute',
        left: -1000,
        top: -1000,
        opacity: 0,
      }}
      onMessage={({ nativeEvent }) => {
        try {
          const data = JSON.parse(nativeEvent.data);

          
          // Handle Coinbase events
          const { eventName } = data;
          console.log(eventName);
          switch (eventName) {
            case "onramp_api.load_pending":
              console.log('🔄 Coinbase v2 API loading...');
              break;
              
              case "onramp_api.load_success":
                console.log('🔄 Coinbase v2 API loaded successfully, Apple Pay button ready');
                webViewRef.current?.injectJavaScript(`
                  const style = document.createElement('style');
                  style.textContent = \`
                    apple-pay-button {
                      display: none !important;
                    }
                  \`;
                  document.head.appendChild(style);
                  
                  // Click the hidden button
                  const btn = document.querySelector('apple-pay-button');
                  console.log('🔄 Apple Pay button found', btn);
                  if (btn) btn.click();
                  console.log('🔄 Apple Pay button hidden & clicked');
                `);
                break;
              
            case "onramp_api.cancel":
              console.log('User cancels Apple pop-up');
              Alert.alert("Payment cancelled");
              // Stop loading and close
              setIsProcessingPayment?.(false);
              onClose?.();
              break;
              
            case "onramp_api.commit_error":
            case "onramp_api.load_error":
              console.log('❌ Payment cancelled or error,', data.data);
              Alert.alert("Payment cancelled or error", "The payment was cancelled or failed. Error: " + data.data.errorMessage);
              // Stop loading and close
              setIsProcessingPayment?.(false);
              onClose?.();
              break;
              
            case "onramp_api.commit_success":
              console.log('🎉 Payment successful! Now tracking transaction...');
              setTransactionStatus?.('pending');
              // Alert.alert("Success!", "Payment completed successfully.");
              // Stop loading and close
              // setIsProcessingPayment?.(false);
              // onClose?.();
              break;

            case "onramp_api.polling_start":
              console.log('🔍 Started tracking blockchain transaction...');
              break;
            
            case "onramp_api.polling_success":
              console.log('✅ Funds delivered to wallet!');
              setTransactionStatus?.('success');
              Alert.alert("Complete!", "Your crypto has been delivered to your wallet!");
              setTimeout(() => onClose?.(), 2000);
              break;
            
            case "onramp_api.polling_error":
              console.log('❌ Transaction failed on blockchain', data.data);
              setTransactionStatus?.('error');
              Alert.alert("Transaction Failed", "There was an issue processing your transaction. Please contact support. Error: " + data.data.errorMessage);
              setTimeout(() => onClose?.(), 2000);
              break;
              
            default:
              console.log("Other event: " + eventName, data.data);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebView message:', error);
        }
      }}
      source={{ uri: finalUrl }}
      startInLoadingState={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
}