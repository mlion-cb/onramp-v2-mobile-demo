import { BASE_URL } from "../constants/BASE_URL";
/**
 * Pattern used across all API utilities:
 * 1. Enhanced request logging (method, headers, body preview)
 * 2. Response cloning for safe logging 
 * 3. Proper error re-throwing for UI handling
 */

export async function createApplePayOrder(payload: any) {
  try {
    const response = await fetch(`${BASE_URL}/server/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://api.cdp.coinbase.com/platform/v2/onramp/orders",
        method: "POST",
        body: 
          payload
      })
    });
    // Log response
    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => '<non-text body>');

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.errorMessage 
        ? `${errorData.errorType}: ${errorData.errorMessage}`
        : `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const responseJson = await response.json();

    // Return the hosted URL from Coinbase response
    return {
      ...responseJson,
      hostedUrl: responseJson.paymentLink?.url, 
      orderId: responseJson.order?.orderId
    };
  } catch (error) {
    throw error;
  }
}
