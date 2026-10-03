import crypto from "node:crypto";
import { priceCart } from "../lib/pricing.mjs";
import { createOrder } from "../lib/revolut.mjs";
import { json } from "../lib/http.mjs";

const clean = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reference() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  return `TG-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "invalid request" }, 400); }

  if (body.acceptedTerms !== true) return json({ error: "terms not accepted" }, 400);

  const c = body.customer || {};
  const customer = {
    email: clean(c.email, 254), phone: clean(c.phone, 40),
    firstName: clean(c.firstName, 60), lastName: clean(c.lastName, 60),
    address: clean(c.address, 200), postcode: clean(c.postcode, 12),
    city: clean(c.city, 80), country: clean(c.country, 60)
  };
  if (Object.values(customer).some(v => !v)) return json({ error: "missing customer details" }, 400);
  if (!EMAIL.test(customer.email)) return json({ error: "invalid email" }, 400);

  let priced;
  try {
    priced = priceCart({ items: body.items, promo: body.promo, shipping: body.shipping });
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  const ref = reference();
  const origin = process.env.SITE_URL || new URL(req.url).origin;
  const summary = priced.lines.map(l => `${l.qty} x ${l.name}`).join("; ");
  const description = [
    `${ref}: ${summary}`,
    `Shipping: ${body.shipping}${priced.shippingCost ? "" : " (free)"}`,
    priced.discount ? `Promo ${String(body.promo).toUpperCase()} -${priced.percent}%` : ""
  ].filter(Boolean).join(" | ").slice(0, 1000);

  try {
    const order = await createOrder({
      amount: priced.total,
      currency: priced.currency,
      description,
      redirect_url: `${origin}/?checkout=return`,
      customer: {
        email: customer.email,
        full_name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone
      },
      merchant_order_data: { reference: ref },
      metadata: {
        reference: ref,
        ship_name: `${customer.firstName} ${customer.lastName}`,
        ship_address: customer.address,
        ship_postcode: customer.postcode,
        ship_city: customer.city,
        ship_country: customer.country,
        shipping_method: String(body.shipping),
        lang: clean(body.lang, 5)
      }
    });

    if (!order?.checkout_url) return json({ error: "no checkout url" }, 502);
    return json({
      checkoutUrl: order.checkout_url,
      orderId: order.id,
      reference: ref,
      total: priced.total / 100,
      summary
    });
  } catch (e) {
    console.error("Revolut create order failed", e.message, JSON.stringify(e.details || {}));
    return json({ error: "payment provider error" }, 502);
  }
};

export const config = { path: "/api/create-order" };
