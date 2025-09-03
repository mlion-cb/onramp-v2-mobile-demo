const BASE_URL = "http://192.168.18.121:3000";

export async function fetchTransactionHistory(
  partnerUserRef: string, 
  pageKey?: string, 
  pageSize: number = 10
) {
  try {
    let fullUrl = `https://api.developer.coinbase.com/onramp/v1/transactions/by-partner-user-ref/${encodeURIComponent(partnerUserRef)}?pageSize=${pageSize}`;
    if (pageKey) {
      fullUrl += `&pageKey=${encodeURIComponent(pageKey)}`;
    }
    
    console.log('Transaction history request →', {
      method: "POST", // Calling local proxy with POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: fullUrl,
        method: "GET" 
      })
    });

    const response = await fetch(`${BASE_URL}/server/api`, {
      method: "POST", // Calling local proxy with POST
      headers: { "Content-Type": "application/json" },
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
      throw new Error(`HTTP error! status: ${response.status}`);
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