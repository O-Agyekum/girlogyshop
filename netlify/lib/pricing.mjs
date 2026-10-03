/*
  Server-side pricing. Every amount sent to Revolut is computed here from
  data/catalog.json, never taken from the browser.
*/
import catalog from "../../data/catalog.json" with { type: "json" };

export { catalog };

const MAX_QTY = 20;
const MAX_LINES = 30;

/** Promo codes come from the PROMO_CODES environment variable, e.g. "BIENVENUE10:10,SOLDES20:20". */
export function promoTable() {
  const raw = process.env.PROMO_CODES ?? "BIENVENUE10:10";
  const table = {};
  for (const part of raw.split(",")) {
    const [code, pct] = part.split(":").map(s => (s || "").trim());
    const n = Number(pct);
    if (code && Number.isFinite(n) && n > 0 && n < 100) table[code.toUpperCase()] = n;
  }
  return table;
}

export function promoPercent(code) {
  if (!code) return 0;
  return promoTable()[String(code).trim().toUpperCase()] || 0;
}

const toCents = n => Math.round(Number(n) * 100);

/**
 * Validate the cart sent by the browser and price it from the catalogue.
 * Throws an Error with a short message when something is not acceptable.
 */
export function priceCart({ items, promo, shipping }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("empty cart");
  if (items.length > MAX_LINES) throw new Error("too many lines");
  if (!catalog.shipping.methods[shipping]) throw new Error("unknown shipping method");

  const lines = [];
  let subtotal = 0;

  for (const it of items) {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error("bad quantity");

    if (it.bundle) {
      const b = catalog.bundles.find(x => x.id === it.bundle);
      if (!b) throw new Error("unknown bundle");
      const unit = toCents(b.price);
      subtotal += unit * qty;
      const parts = [b.hers, b.his].map(id => {
        const p = catalog.products.find(x => x.id === id);
        const size = (catalog.sizes[p.sk] || []).includes("M") ? " M" : "";
        return `${p.txt.en[0]} (${p.colors[0]}${size})`;
      });
      lines.push({ name: `${b.txt.en[0]}: ${parts.join(" + ")}`, qty, unit });
      continue;
    }

    const p = catalog.products.find(x => x.id === it.id && x.visible !== false);
    if (!p) throw new Error("unknown product");
    if (!p.colors.includes(it.color)) throw new Error("unknown colour");
    const sizes = catalog.sizes[p.sk] || [];
    if (sizes.length) {
      if (!sizes.includes(it.size)) throw new Error("unknown size");
      if ((p.soldOut || []).includes(it.size)) throw new Error("size sold out");
    } else if (it.size) {
      throw new Error("size not expected");
    }
    const unit = toCents(p.price);
    subtotal += unit * qty;
    lines.push({ name: `${p.txt.en[0]} (${it.color}${it.size ? ", " + it.size : ""})`, qty, unit });
  }

  const percent = promoPercent(promo);
  const discount = Math.round(subtotal * percent / 100);
  const free = subtotal - discount >= toCents(catalog.shipping.freeFrom);
  const shippingCost = free ? 0 : toCents(catalog.shipping.methods[shipping]);
  const total = subtotal - discount + shippingCost;

  return { lines, subtotal, percent, discount, shippingCost, total, currency: catalog.currency };
}
