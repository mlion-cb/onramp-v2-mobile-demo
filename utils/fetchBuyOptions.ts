import { BASE_URL } from "../constants/BASE_URL";

export async function fetchBuyOptions(payload: any ) {

  try {
  // Build query parameters using spread
    const params = new URLSearchParams(payload);
    const fullUrl = `https://api.developer.coinbase.com/onramp/v1/buy/options?${params.toString()}`;
    
    console.log(`${BASE_URL}/server/api`);
    console.log('API request →', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: fullUrl,
        method: "GET",
      })
        });

    const response = await fetch(`${BASE_URL}/server/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: fullUrl,
        method: "GET",
      })
    });
    // Log response early (without consuming it)
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
    return responseJson;
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
