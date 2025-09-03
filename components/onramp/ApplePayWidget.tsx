import { useRef } from "react";
import { WebView } from "react-native-webview";

/**
 * CRITICAL: Apple Pay Webview Event Flow
 * 
 * This component orchestrates the entire payment process:
 * 
 * - onramp_api.load_success: Page loaded → Auto-hide & click Apple Pay button
 * - onramp_api.commit_success: Payment authorized by user → start blockchain tracking
 * - onramp_api.polling_start: Begin tracking blockchain transaction
 * - onramp_api.polling_success: Crypto delivered to wallet → show success
 * - onramp_api.polling_error: Transaction failed on blockchain → show error
 * - onramp_api.cancel: User cancels payment → show info 
 * - onramp_api.load_error: Page load fails → show error 
 * - onramp_api.commit_error: Payment authorization fails → show error 
 * 
 * These post events ensure smooth execution of the payment process from start to finish.
 * 
 * The WebView is hidden (1x1px, off-screen) but functional.
 * All user interaction happens through native Apple Pay sheet.
 */
export function ApplePayWidget({ 
  paymentUrl, 
  onClose, 
  setIsProcessingPayment,
  setTransactionStatus,
  onAlert
}: { 
  paymentUrl: string;
  onClose?: () => void;
  setIsProcessingPayment?: (loading: boolean) => void;
  setTransactionStatus?: (status: 'pending' | 'success' | 'error' | null) => void; 
  onAlert?: (title: string, message: string, type: 'success' | 'error' | 'info') => void; // Add this line
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
      // Hidden WebView (1x1 pixel, off-screen) - only for functionality
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
              console.log('Coinbase v2 API loading...');
              break;
              
              case "onramp_api.load_success":
                // Inject CSS to hide button + JavaScript to click it automatically
                console.log('Coinbase v2 API loaded successfully, Apple Pay button ready');
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
                  console.log('Apple Pay button found', btn);
                  if (btn) btn.click();
                  console.log('Apple Pay button hidden & clicked');
                `);
                break;
              
            case "onramp_api.cancel":
              console.log('User cancels Apple pop-up');
              onAlert?.("Payment Cancelled", "The payment was cancelled by the user", 'info');
              // Stop loading and close
              setIsProcessingPayment?.(false);
              onClose?.();
              break;
              
            case "onramp_api.commit_error":
            case "onramp_api.load_error":
              console.log('Payment cancelled or error,', data.data);
              onAlert?.("Payment Error", `The payment failed: ${data.data.errorMessage}`, 'error');
              // Stop loading and close
              setIsProcessingPayment?.(false);
              onClose?.();
              break;
              
            case "onramp_api.commit_success":
              console.log('Payment successful! Now tracking transaction...');
              setTransactionStatus?.('pending');
              // Alert.alert("Success!", "Payment completed successfully.");
              // Stop loading and close
              // setIsProcessingPayment?.(false);
              // onClose?.();
              break;

            case "onramp_api.polling_start":
              console.log('Started tracking blockchain transaction...');
              break;
            
            case "onramp_api.polling_success":
              console.log('Funds delivered to wallet!');
              setTransactionStatus?.('success');
              onAlert?.("Complete!", "Your crypto has been delivered to your wallet!", 'success');
              setTimeout(() => onClose?.(), 2000);
              break;
            
            case "onramp_api.polling_error":
              console.log('Transaction failed on blockchain', data.data);
              setTransactionStatus?.('error');
              onAlert?.("Transaction Failed", `There was an issue processing your transaction: ${data.data.errorMessage}`, 'error');
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