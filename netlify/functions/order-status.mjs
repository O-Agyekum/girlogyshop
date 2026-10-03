import { getOrder } from "../lib/revolut.mjs";
import { json } from "../lib/http.mjs";

const ORDER_ID = /^[A-Za-z0-9-]{8,64}$/;

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!ORDER_ID.test(id)) return json({ error: "invalid id" }, 400);
  try {
    const order = await getOrder(id);
    /* Only the state is returned to the browser, never customer details. */
    return json({ state: order?.state || "unknown" });
  } catch (e) {
    console.error("Revolut get order failed", e.message);
    return json({ state: "unknown" }, 502);
  }
};

export const config = { path: "/api/order-status" };
