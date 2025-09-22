
import { BASE_URL } from '@/constants/BASE_URL';
import { createApplePayOrder } from './createApplePayOrder';
import { demoAddressForNetwork } from './randomAddresses';
import { getCountry, getSubdivision } from './sharedState';

export async function fetchBuyQuote(payload: {
  paymentCurrency: string;
  purchaseCurrency: string;
  paymentAmount: string;
  destinationNetwork: string;
  paymentMethod: string;
}) {
  const destinationAddress = demoAddressForNetwork(payload.destinationNetwork);
  const isApplePay = payload.paymentMethod === 'GUEST_CHECKOUT_APPLE_PAY';

  if (isApplePay) {
    const response = await createApplePayOrder(
      {...payload, 
        isQuote: true,
        paymentMethod: "GUEST_CHECKOUT_APPLE_PAY",
        email: 'testquote@test.com',
        phoneNumber: '+12345678901',
        agreementAcceptedAt: new Date().toISOString(),
        phoneNumberVerifiedAt: new Date().toISOString(),
        partnerUserRef: 'testquote',
        destinationAddress,
      },
    );
      
    const order = response?.order ?? response;
    
    const coinbaseFee = order?.fees?.find((f: any) => f.type === 'FEE_TYPE_EXCHANGE');
    const networkFee  = order?.fees?.find((f: any) => f.type === 'FEE_TYPE_NETWORK');
    
    return {
      purchase_amount:  { value: order?.purchaseAmount ?? '0', currency: order?.purchaseCurrency },
      payment_subtotal: { value: order?.paymentSubtotal ?? '0', currency: order?.paymentCurrency },
      payment_total:    { value: order?.paymentTotal ?? '0',    currency: order?.paymentCurrency },
      coinbase_fee:     { value: coinbaseFee?.amount ?? '0',    currency: coinbaseFee?.currency ?? order?.paymentCurrency },
      network_fee:      { value: networkFee?.amount ?? '0',     currency: networkFee?.currency ?? order?.paymentCurrency },
      exchange_rate:    order?.exchangeRate,
      raw:              order, 
    };
  } else {
    const country = getCountry();
    const subdivision = getSubdivision();
    
    const v1Payload = {
      country,
      subdivision,
      paymentCurrency: payload.paymentCurrency,
      paymentMethod: 'CARD', // v1 generic payment method
      purchaseCurrency: payload.purchaseCurrency,
      purchaseNetwork: payload.destinationNetwork, // note: purchaseNetwork not destinationNetwork
      paymentAmount: payload.paymentAmount
    };
    // v1 quote for Coinbase Widget (generic quote endpoint)
    const response = await fetch(`${BASE_URL}/server/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://api.developer.coinbase.com/onramp/v1/buy/quote',
        method: 'POST',
        body: v1Payload,
      }),
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
  
    return {
      purchase_amount: { value: data?.purchase_amount?.value ?? '0', currency: data?.purchase_amount?.currency },
      payment_subtotal: { value: data?.payment_subtotal?.value ?? '0', currency: data?.payment_subtotal?.currency },
      payment_total: { value: data?.payment_total?.value ?? '0', currency: data?.payment_total?.currency },
      coinbase_fee: { value: data?.coinbase_fee?.value ?? '0', currency: data?.coinbase_fee?.currency },
      network_fee: { value: data?.network_fee?.value ?? '0', currency: data?.network_fee?.currency },
      exchange_rate: data?.exchange_rate,
      quote_id: data?.quote_id, // add this field
      raw: data,
    };
  }
}