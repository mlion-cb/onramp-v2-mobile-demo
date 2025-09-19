import { BASE_URL } from "../constants/BASE_URL";

export async function createOnrampSession(payload: any) {
try {
  console.log(`${BASE_URL}/server/api`);
  // Enhanced request logging
  console.log('API request →', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: "https://api.cdp.coinbase.com/platform/v2/onramp/sessions",
      method: "POST",
      body: payload
    })
      });

  const res = await fetch(`${BASE_URL}/server/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://api.cdp.coinbase.com/platform/v2/onramp/sessions",
      method: "POST",
      body: payload
    })
  });
  // Log response
  const responseClone = res.clone();
  const responseText = await responseClone.text().catch(() => '<non-text body>');
  console.log('API response ←', {
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type'),
    bodyPreview: responseText.slice(0, 1000)
  });
  if (!res.ok) 
    throw new Error(`HTTP error! status: ${res.status}`);
  return res.json(); // { session: { onrampUrl }, quote?: {...} }
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