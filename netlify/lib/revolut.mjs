/*
  Minimal Revolut Merchant API client.
  Needs the REVOLUT_SECRET_KEY environment variable (never put it in the code).
  Set REVOLUT_ENV=sandbox to test with Revolut's sandbox.
*/
const BASE = () => (process.env.REVOLUT_ENV === "sandbox"
  ? "https://sandbox-merchant.revolut.com"
  : "https://merchant.revolut.com");

const VERSION = () => process.env.REVOLUT_API_VERSION || "2026-08-17";

async function call(method, path, body) {
  const key = process.env.REVOLUT_SECRET_KEY;
  if (!key) throw new Error("REVOLUT_SECRET_KEY is not set");
  const res = await fetch(BASE() + path, {
    method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Revolut-Api-Version": VERSION(),
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Revolut ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

export const createOrder = body => call("POST", "/api/orders", body);
export const getOrder = id => call("GET", `/api/orders/${encodeURIComponent(id)}`);
