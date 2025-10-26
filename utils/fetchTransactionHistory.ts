import { BASE_URL } from "../constants/BASE_URL";
import { getAccessTokenGlobal } from "./getAccessTokenGlobal";

export async function fetchTransactionHistory(
  userId: string,
  pageKey?: string,
  pageSize: number = 10
) {
  try {
    // Format: /buy/user/{userId}/transactions
    let fullUrl = `https://api.developer.coinbase.com/onramp/v1/buy/user/${encodeURIComponent(userId)}/transactions?pageSize=${pageSize}`;
    if (pageKey) {
      fullUrl += `&pageKey=${encodeURIComponent(pageKey)}`;
    }

    // Get access token for authentication
    const accessToken = getAccessTokenGlobal();

    console.log('Transaction history request →', {
      url: fullUrl,
      userId,
      method: "GET",
      hasToken: !!accessToken
    });

    const response = await fetch(`${BASE_URL}/server/api`, {
      method: "POST", // Calling local proxy with POST
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url: fullUrl,
        method: "GET"
      })
    });

    const responseClone = response.clone();
    const responseText = await responseClone.text().catch(() => '<non-text body>');
    console.log('Transaction history response ←', {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      bodyPreview: responseText.slice(0, 1000)
    });

    if (!response.ok) {
      console.error('❌ Transaction history failed:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText.slice(0, 500)
      });
      throw new Error(`HTTP error! status: ${response.status} - ${responseText.slice(0, 200)}`);
    }

    const responseJson = await response.json();
    
    return {
      transactions: responseJson.transactions || [],
      nextPageKey: responseJson.nextPageKey // For next page
    };
  } catch (error) {
    console.error("Transaction history API request failed:", error);
    console.error('API request failed (details):', {
      name: (error as any)?.name,
      message: (error as any)?.message,
      stack: (error as any)?.stack
    });
    throw error;
  }
}