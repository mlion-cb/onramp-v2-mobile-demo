// utils/fetchBuyConfig.ts
import { BASE_URL } from "../constants/BASE_URL";
import { authenticatedFetch } from "./authenticatedFetch";

export async function fetchBuyConfig() {
  const url = "https://api.developer.coinbase.com/onramp/v1/buy/config";
  const res = await authenticatedFetch(`${BASE_URL}/server/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, method: "GET" })
  });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json(); // shape: { countries: [{ id: 'US', subdivisions: ['CA', 'NY', ...], payment_methods: [...] }, ...] }
}