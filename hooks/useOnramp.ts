import { useCallback, useState } from "react";
import { OnrampFormData } from "../components/onramp/OnrampForm";
import { createApplePayOrder } from "../utils/createApplePayOrder";
import { fetchBuyOptions } from "../utils/fetchBuyOptions";
import { setCurrentPartnerUserRef } from "../utils/sharedState";


export function useOnramp() {
  // These states from index.tsx:
  const [applePayVisible, setApplePayVisible] = useState(false);
  const [hostedUrl, setHostedUrl] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [options, setOptions] = useState<any>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const getAssetSymbolFromName = useCallback((assetName: string) => {
    if (!options?.purchase_currencies) return assetName;
    const asset = options.purchase_currencies.find((a: any) => a.name === assetName);
    return asset?.symbol || assetName;
  }, [options]);
  
  const getNetworkNameFromDisplayName = useCallback((displayName: string) => {
    if (!options?.purchase_currencies) return displayName;
    
    for (const asset of options.purchase_currencies) {
      const network = asset.networks.find((n: any) => n.display_name === displayName);
      if (network) return network.name;
    }
    return displayName;
  }, [options]);

  const createOrder = useCallback(async (formData: OnrampFormData) => {
    try {
      setIsProcessingPayment(true); // Start loading

      const partnerUserRef = `${formData.sandbox ? "sandbox-" : ""}user-${formData.address}`;      
      setCurrentPartnerUserRef(partnerUserRef);

      const result = await createApplePayOrder({
        paymentAmount: formData.amount,
        paymentCurrency: "USD",
        purchaseCurrency: getAssetSymbolFromName(formData.asset),
        paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
        destinationNetwork: getNetworkNameFromDisplayName(formData.network),
        destinationAddress: formData.address,
        email: 'test@test.com',
        phoneNumber: '+13412133368',
        phoneNumberVerifiedAt: new Date().toISOString(),
        partnerUserRef: partnerUserRef,
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
  }, [getAssetSymbolFromName, getNetworkNameFromDisplayName]);

  const closeApplePay = useCallback(() => {
    setApplePayVisible(false);
    setHostedUrl('');
    setIsProcessingPayment(false);
    setTransactionStatus(null);
  }, []);

  const fetchOptions = useCallback(async () => {
    try {
      setIsLoadingOptions(true);
      const result = await fetchBuyOptions({ 
        country: 'US', 
        subdivision: 'CA' 
      });
      setOptions(result);
    
    } catch (error) {
      console.error('Failed to fetch options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  // Helper functions that use the stored options
  const getAvailableNetworks = useCallback((selectedAsset?: string) => {
    if (!options?.purchase_currencies) return ['ethereum', 'base'];
    
    if (!selectedAsset) {
      const allNetworks = options.purchase_currencies.flatMap((asset: any) => asset.networks);
      return [...new Set(allNetworks.map((net: any) => net.display_name))];
    }
    
    const asset = options.purchase_currencies.find((a: any) => a.name === selectedAsset);
    return asset?.networks.map((net: any) => net.display_name) || [];
  }, [options]);

  const getAvailableAssets = useCallback((selectedNetwork?: string) => {
    if (!options?.purchase_currencies) return ['USDC', 'ETH'];
    
    if (!selectedNetwork) {
      return options.purchase_currencies.map((asset: any) => asset.name);
    }
    
    return options.purchase_currencies.filter((asset: any) => 
      asset.networks.some((network: any) => network.display_name === selectedNetwork)
    ).map((asset: any) => asset.name);
  }, [options]);

  return {
    // State
    applePayVisible,
    hostedUrl,
    isProcessingPayment,
    transactionStatus,
    options,
    isLoadingOptions,
    
    // Actions
    createOrder,
    closeApplePay,
    fetchOptions,
    getAvailableNetworks,
    getAvailableAssets,
    setTransactionStatus,
    setIsProcessingPayment,
  };
}