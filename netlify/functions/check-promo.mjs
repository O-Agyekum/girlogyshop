import { promoPercent } from "../lib/pricing.mjs";
import { json } from "../lib/http.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body = {};
  try { body = await req.json(); } catch {}
  const percent = promoPercent(String(body.code || "").slice(0, 40));
  return json({ valid: percent > 0, percent });
};

export const config = { path: "/api/check-promo" };
