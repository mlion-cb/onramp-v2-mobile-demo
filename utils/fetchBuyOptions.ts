import { BASE_URL } from "../constants/BASE_URL";

export async function fetchBuyOptions(payload: any ) {

  try {
  // Build query parameters using spread
    const params = new URLSearchParams(payload);
    const fullUrl = `https://api.developer.coinbase.com/onramp/v1/buy/options?${params.toString()}`;

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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseJson = await response.json();

    // Return the hosted URL from Coinbase response
    return responseJson;
  } catch (error) {
    throw error;
  }
}
