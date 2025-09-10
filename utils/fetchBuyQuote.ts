import { BASE_URL } from '../constants/BASE_URL';

export async function fetchBuyQuote(payload: {
  country: string;
  subdivision: string;
  paymentCurrency: string;
  paymentMethod: string;
  purchaseCurrency: string;
  purchaseNetwork: string;
  paymentAmount: string;
}) {
  const response = await fetch(`${BASE_URL}/server/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://api.developer.coinbase.com/onramp/v1/buy/quote',
      method: 'POST',
      body: payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}