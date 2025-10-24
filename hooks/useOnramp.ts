/**
 * ============================================================================
 * ONRAMP HOOK - CENTRAL STATE & API ORCHESTRATION
 * ============================================================================
 *
 * This hook manages all onramp-related state and coordinates API calls.
 * It's the single source of truth for the onramp flow.
 *
 * RESPONSIBILITIES:
 * 1. Fetch available options (assets, networks, payment methods, currencies)
 * 2. Dynamic quote fetching (real-time pricing with fees)
 * 3. Order creation (Apple Pay native flow)
 * 4. Widget session creation (Coinbase-hosted checkout)
 * 5. Form validation state management
 *
 * DATA FLOW:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ 1. USER SELECTS REGION (Profile) → fetchOptions()               │
 * │    ↓                                                             │
 * │ 2. LOADS ASSETS/NETWORKS → getAvailableAssets/Networks()        │
 * │    ↓                                                             │
 * │ 3. USER ENTERS AMOUNT/SELECTS ASSET → fetchQuote() (debounced)  │
 * │    ↓                                                             │
 * │ 4. SHOWS FEES/TOTAL → User reviews                              │
 * │    ↓                                                             │
 * │ 5. USER SLIDES CONFIRM → createOrder() OR createWidgetSession() │
 * │    ↓                                                             │
 * │ 6. PAYMENT FLOW → ApplePayWidget OR Browser Redirect            │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * TWO PAYMENT PATHS:
 *
 * A. APPLE PAY (GUEST_CHECKOUT_APPLE_PAY):
 *    - Native iOS Apple Pay sheet
 *    - Requires phone verification (60-day cache)
 *    - USD only
 *    - Hidden WebView handles v2 orders API
 *    - Real-time transaction tracking via post-events
 *    Flow: createOrder() → ApplePayWidget → Native sheet → Blockchain
 *
 * B. COINBASE WIDGET (COINBASE_WIDGET):
 *    - Browser-based checkout (Linking.openURL)
 *    - NO phone verification required
 *    - Multi-currency support (USD, EUR, GBP, etc.)
 *    - User can select payment method in widget (Card, ACH, etc.)
 *    - Coinbase-hosted page handles payment
 *    Flow: createWidgetSession() → Browser → Coinbase page → Return to app
 *
 * API DATA FORMAT MAPPING (Critical for integration):
 *
 * Coinbase API uses TWO different name formats:
 * 1. DISPLAY NAMES (for UI): "USD Coin", "Base", "Ethereum"
 * 2. API VALUES (for submission): "USDC", "base", "ethereum"
 *
 * Helper functions:
 * - getAssetSymbolFromName(): "USD Coin" → "USDC"
 * - getNetworkNameFromDisplayName(): "Base" → "base"
 *
 * These ensure form selects (display names) are properly converted
 * before sending to Coinbase API (needs lowercase network names, uppercase symbols).
 *
 * @see components/onramp/OnrampForm.tsx for form UI and validation
 * @see utils/createApplePayOrder.ts for Apple Pay API integration
 * @see utils/createOnrampSession.ts for Widget session API
 * @see utils/fetchBuyQuote.ts for quote generation logic
 */

import { createOnrampSession } from "@/utils/createOnrampSession";
import { fetchBuyConfig } from "@/utils/fetchBuyConfig";
import { useCurrentUser } from "@coinbase/cdp-hooks";
import { useCallback, useMemo, useState } from "react";
import { OnrampFormData } from "../components/onramp/OnrampForm";
import { createApplePayOrder } from "../utils/createApplePayOrder";
import { fetchBuyOptions } from "../utils/fetchBuyOptions";
import { fetchBuyQuote } from "../utils/fetchBuyQuote";
import { getCountry, getSandboxMode, getSubdivision, getVerifiedPhone, getVerifiedPhoneAt, isPhoneFresh60d, setCurrentPartnerUserRef, setSubdivision } from "../utils/sharedState";


export type PaymentMethodOption = { display: string; value: string };
export function useOnramp() {
  // These states from index.tsx:
  const [applePayVisible, setApplePayVisible] = useState(false);
  const [hostedUrl, setHostedUrl] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [options, setOptions] = useState<any>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const { currentUser } = useCurrentUser();
  const [buyConfig, setBuyConfig] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


  /**
     * API Data Format Mapping
     * Coinbase API uses different formats for display vs. submission:
     * - Display: asset.name ("USD Coin") + network.display_name ("Base") 
     * - API Submission: asset.symbol ("USDC") + network.name ("base")
     * 
     * Helper functions handle this mapping:
     * - getAssetSymbolFromName(): "USD Coin" → "USDC" 
     * - getNetworkNameFromDisplayName(): "Base" → "base"
     */
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

  /**
   * Creates an onramp order and triggers Apple Pay flow
   * Flow: Form validation → API call → WebView → Apple Pay → Transaction tracking
   */
  const createOrder = useCallback(async (formData: OnrampFormData) => {
    try {
      setIsProcessingPayment(true); // Start loading

      // Get email from CDP user, fallback to placeholder
      const userEmail = currentUser?.authenticationMethods.email?.email || 'noemail@test.com';

      // Generate unique user reference for transaction tracking
      // Apple Pay: Use userId with sandbox prefix for sandbox environment
      const sandboxPrefix = getSandboxMode() ? "sandbox-" : "";
      const userId = currentUser?.userId || 'unknown-user';
      const partnerUserRef = `${sandboxPrefix}${userId}`;
      setCurrentPartnerUserRef(partnerUserRef);

      // IMPORTANT: Register push token before transaction (ensures webhook can send notification)
      try {
        const { registerForPushNotifications, sendPushTokenToServer } = await import('@/utils/pushNotifications');
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');

        console.log('📱 [TRANSACTION] Pre-registering push token for:', partnerUserRef);
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          await sendPushTokenToServer(pushToken, partnerUserRef, getAccessTokenGlobal);
          console.log('✅ [TRANSACTION] Push token registered successfully');
        }
      } catch (pushError) {
        console.warn('⚠️ [TRANSACTION] Failed to register push token:', pushError);
        // Don't block transaction if push token fails
      }

      let phone = getVerifiedPhone();
      let phoneAt = getVerifiedPhoneAt();
      if (getSandboxMode() && (!phone || !isPhoneFresh60d())) {
        phone = '+12345678901'; // Mock US number for sandbox
        phoneAt = Date.now();
      } else if (!phone || !isPhoneFresh60d()) {
        throw new Error('Phone not verified or expired');
      }

      // Map form values to API format (display names → API values)
      // Order creation: API call to Coinbase (auth handled by authenticatedFetch)
      const result = await createApplePayOrder({
        paymentAmount: formData.amount,
        paymentCurrency: formData.paymentCurrency,
        purchaseCurrency: getAssetSymbolFromName(formData.asset),
        paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
        destinationNetwork: getNetworkNameFromDisplayName(formData.network),
        destinationAddress: formData.address,
        email: userEmail,
        phoneNumber: phone,
        phoneNumberVerifiedAt: new Date(phoneAt!).toISOString(),
        partnerUserRef: partnerUserRef,
        agreementAcceptedAt: new Date().toISOString(),
        webhookUrl: `${process.env.EXPO_PUBLIC_BASE_URL}/webhooks/onramp`, // Webhook for push notifications
        isQuote: false
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
  }, [getAssetSymbolFromName, getNetworkNameFromDisplayName, currentUser]);

  const createWidgetSession = useCallback(async (formData: OnrampFormData) => {
    setIsProcessingPayment(true);
    try {
      const assetSymbol = getAssetSymbolFromName(formData.asset);
      const networkName = getNetworkNameFromDisplayName(formData.network);
      const country = getCountry();
      let subdivision = getSubdivision();
      if (country === 'US' && !subdivision) {
        subdivision = 'CA';
        setSubdivision('CA');
      }

      // Generate unique user reference for transaction tracking
      // Widget: Use userId directly (no sandbox prefix needed)
      const userId = currentUser?.userId || 'unknown-user';
      const partnerUserRef = userId;
      setCurrentPartnerUserRef(partnerUserRef);

      // IMPORTANT: Register push token before transaction (ensures webhook can send notification)
      try {
        const { registerForPushNotifications, sendPushTokenToServer } = await import('@/utils/pushNotifications');
        const { getAccessTokenGlobal } = await import('@/utils/getAccessTokenGlobal');

        console.log('📱 [TRANSACTION] Pre-registering push token for:', partnerUserRef);
        const pushToken = await registerForPushNotifications();
        if (pushToken) {
          await sendPushTokenToServer(pushToken, partnerUserRef, getAccessTokenGlobal);
          console.log('✅ [TRANSACTION] Push token registered successfully');
        }
      } catch (pushError) {
        console.warn('⚠️ [TRANSACTION] Failed to register push token:', pushError);
        // Don't block transaction if push token fails
      }

      // Auth handled by authenticatedFetch
      const res = await createOnrampSession({
        purchaseCurrency: assetSymbol,
        destinationNetwork: networkName,
        destinationAddress: formData.address,
        paymentAmount: formData.amount,
        paymentCurrency: formData.paymentCurrency,
        country,
        subdivision,
        webhookUrl: `${process.env.EXPO_PUBLIC_BASE_URL}/webhooks/onramp`, // Webhook for push notifications
      });

      let url = res?.session?.onrampUrl;
      if (getSandboxMode() && url) {
        url = url.replace('pay.coinbase.com', 'pay-sandbox.coinbase.com');
      }

      // Add partnerUserId as URL parameter (temporary workaround until supported as body param)
      if (url) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}partnerUserId=${encodeURIComponent(partnerUserRef)}`;
      }

      if (!url) throw new Error('No onrampUrl returned');
      return url;
    } finally {
      setIsProcessingPayment(false);
    }
  }, [getAssetSymbolFromName, getNetworkNameFromDisplayName, setIsProcessingPayment]);

  const closeApplePay = useCallback(() => {
    setApplePayVisible(false);
    setHostedUrl('');
    setIsProcessingPayment(false);
    setTransactionStatus(null);
  }, []);

  /**
   * Fetches available assets/networks from Coinbase API
   * Used to populate form dropdowns dynamically
   */
  const fetchOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    setOptionsError(null); // Clear previous error
    try {
      const country = getCountry();
      let subdivision = getSubdivision();
      if (country === 'US' && !subdivision) subdivision = 'CA';
      const [opts, cfg] = await Promise.all([
        fetchBuyOptions({ country, subdivision }),
        fetchBuyConfig(),
      ]);
      setOptions(opts);
        // Filter countries to only those with CARD payment method (Buy & Send)
        const filteredConfig = {
          ...cfg,
          countries: (cfg?.countries || []).filter((country: any) =>
            country.payment_methods?.some((pm: any) => pm.id === 'CARD')
          )
      };
      setBuyConfig(filteredConfig);
      setOptionsError(null); // Success - clear error
    } catch (error) {
      console.error('Failed to fetch options:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load payment options';
      setOptionsError(errorMessage);
      // Keep any existing options instead of clearing (better UX)
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  // hooks/useOnramp.ts - add comment about dual quote system
  /**
   * Quote fetching strategy:
   * - Apple Pay: Uses v2 orders API (USD only, requires phone)
   * - Coinbase Widget: Uses v2 session API (multi-currency based on options, no phone required)
   */
  const fetchQuote = useCallback(async (formData: {
    amount: string;
    asset: string;
    network: string;
    paymentCurrency: string;
    paymentMethod?: string;
  }) => {
    const amt = Number.parseFloat(formData?.amount as any);
    if (!formData.amount || !formData.asset || !formData.network || !Number.isFinite(amt) || amt <= 0) {
      setCurrentQuote(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      const assetSymbol = getAssetSymbolFromName(formData.asset);
      const networkName = getNetworkNameFromDisplayName(formData.network);

      // Auth handled by authenticatedFetch
      const quote = await fetchBuyQuote({
        paymentAmount: formData.amount,
        paymentCurrency: formData.paymentCurrency,
        purchaseCurrency: assetSymbol,
        destinationNetwork: networkName,
        paymentMethod: formData.paymentMethod || 'COINBASE_WIDGET'
      });

      setCurrentQuote(quote);
    } catch (error) {
      console.log('Failed to fetch quote (unsupported network or demo address unavailable):', error);
      setCurrentQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [getAssetSymbolFromName, getNetworkNameFromDisplayName]);

  // Helper functions that use the stored options
  const getAvailableNetworks = useCallback((selectedAsset?: string) => {
    if (!options?.purchase_currencies) return [
      { name: "ethereum", display_name: "Ethereum", icon_url: null },
      { name: "base", display_name: "Base", icon_url: null }
    ];
    
    if (!selectedAsset) {
      const allNetworks = options.purchase_currencies.flatMap((asset: any) => asset.networks);
      return [...new Map(allNetworks.map((net: any) => [net.name, net])).values()]; // Dedupe by name
    }
    
    const asset = options.purchase_currencies.find((a: any) => a.name === selectedAsset);
    return asset?.networks || [];
  }, [options]);

  const getAvailableAssets = useCallback((selectedNetwork?: string) => {
    if (!options?.purchase_currencies) return [
      { name: "USDC", symbol: "USDC", icon_url: null },
      { name: "ETH", symbol: "ETH", icon_url: null }
    ];
    
    if (!selectedNetwork) {
      return options.purchase_currencies; // Return full objects with icon_url
    }
    
    return options.purchase_currencies.filter((asset: any) => 
      asset.networks.some((network: any) => network.display_name === selectedNetwork)
    );
  }, [options]);

  const paymentCurrencies = useMemo(() => {
    const country = getCountry();
  
    // Try v1 options first (supports array of strings or objects with id)
    const fromOptions = Array.isArray(options?.payment_currencies)
      ? options.payment_currencies.map((c: any) => (typeof c === 'string' ? c : c?.id)).filter(Boolean)
      : [];
  
    if (fromOptions.length) return fromOptions;
  
    // Else derive from buyConfig by country
    const entry = Array.isArray(buyConfig?.countries)
      ? buyConfig.countries.find((c: any) => c.id === country)
      : null;
  
    const fromConfig =
      (Array.isArray(entry?.payment_currencies) && entry.payment_currencies) ||
      (Array.isArray(entry?.currencies) && entry.currencies) ||
      [];
  
    return fromConfig.length ? fromConfig : ['USD'];
  }, [options, buyConfig]);


  return {
    // State
    applePayVisible,
    hostedUrl,
    isProcessingPayment,
    transactionStatus,
    options,
    isLoadingOptions,
    optionsError,
    isLoadingQuote,
    currentQuote,
    paymentCurrencies,
    buyConfig,
    // Actions
    createOrder,
    createWidgetSession,
    closeApplePay,
    fetchOptions,
    getAvailableNetworks,
    getAvailableAssets,
    setTransactionStatus,
    setIsProcessingPayment,
    fetchQuote,
  };
}