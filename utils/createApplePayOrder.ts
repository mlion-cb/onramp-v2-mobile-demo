// Update this to your local proxy server URL with command 'ipconfig getifaddr en0' on terminal
const BASE_URL = "http://192.168.18.121:3000";
// const BASE_URL = "http://localhost:3000"; // For local simulator on same device - does not work for Apple Pay

/**
 * Pattern used across all API utilities:
 * 1. Enhanced request logging (method, headers, body preview)
 * 2. Response cloning for safe logging 
 * 3. Proper error re-throwing for UI handling
 */

export async function createApplePayOrder(payload: any) {
  try {

    console.log(`${BASE_URL}/server/api`);
    // Enhanced request logging
    console.log('API request →', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://api.developer.coinbase.com/onramp/v2/onramp/order",
        body: 
          payload
      })
        });

    const response = await fetch(`${BASE_URL}/server/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://api.developer.coinbase.com/onramp/v2/onramp/order",
        method: "POST",
        body: 
          payload
      })
    });
    // Log response
    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => '<non-text body>');
    console.log('API response ←', {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      bodyPreview: responseText.slice(0, 1000)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseJson = await response.json();

    // Return the hosted URL from Coinbase response
    return {
      ...responseJson,
      hostedUrl: responseJson.paymentLink?.url, 
      orderId: responseJson.order?.orderId
    };
  } catch (error) {
    console.error("API request failed:", error);
    // Enhanced error logging
    console.error('API request failed (details):', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack
    });
    throw error;
  }
}
