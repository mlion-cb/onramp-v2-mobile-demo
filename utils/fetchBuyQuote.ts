
import { createApplePayOrder } from './createApplePayOrder';
import { demoAddressForNetwork } from './randomAddresses';

export async function fetchBuyQuote(payload: {
  paymentCurrency: string;
  purchaseCurrency: string;
  paymentAmount: string;
  destinationNetwork: string;
}) {
  const destinationAddress = demoAddressForNetwork(payload.destinationNetwork);
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
}