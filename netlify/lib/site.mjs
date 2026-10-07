/*
  Shop addresses, shared by the page and sitemap functions.
  They mirror the addresses used in js/app.js (pathFor / routeFrom).
*/
import { catalog } from "./pricing.mjs";

export const SITE = (process.env.URL || "https://girlogyshop.com").replace(/\/$/, "");
export const BRAND = "The Girlogist";

export const DEPTS = {
  new: { slug: "new", name: "New in" },
  her: { slug: "her", name: "Her" },
  plus: { slug: "plus-one", name: "Plus One" },
  acc: { slug: "accessories", name: "Accessories" },
  couples: { slug: "couples", name: "Couples" },
  sale: { slug: "sale", name: "Sale" }
};
export const VIEWS = {
  shop: "Shop",
  favourites: "Favourites",
  bag: "Shopping bag",
  checkout: "Checkout",
  help: "Customer service",
  about: "Our story"
};

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
const visible = () => catalog.products.filter(p => p.visible !== false);
export const hasSale = () => visible().some(p => p.was);
const catsOf = d => catalog.deptCats[d] || [...new Set(catalog.products.map(p => p.cat))];

/** Every public address of the shop (for the sitemap). */
export function allPaths() {
  const paths = ["/", "/shop"];
  for (const [d, { slug: s }] of Object.entries(DEPTS)) {
    if (d === "sale" && !hasSale()) continue;
    paths.push("/" + s);
    for (const c of catalog.deptCats[d] || []) paths.push(`/${s}/${slug(c)}`);
  }
  for (const p of visible()) paths.push("/product/" + p.id);
  paths.push("/help", "/about");
  return paths;
}

/**
 * Title, description and image for an address, or null when it matches nothing.
 * The English text is used here; visitors still see their own language once the page loads.
 */
export function describe(pathname) {
  const parts = pathname.split("/").filter(Boolean).map(x => {
    try { return decodeURIComponent(x); } catch { return x; }
  });
  const base = { image: SITE + "/images/og-girlogy.jpg" };

  if (parts[0] === "product" && parts.length === 2) {
    const p = visible().find(x => x.id === parts[1]);
    if (!p) return null;
    return {
      ...base,
      title: `${p.txt.en[0]} · ${BRAND}`,
      description: p.txt.en[1],
      image: p.images?.[0] ? SITE + p.images[0] : base.image,
      type: "product"
    };
  }
  const entry = Object.entries(DEPTS).find(([, v]) => v.slug === parts[0]);
  if (entry && parts.length <= 2) {
    const [d, { name }] = entry;
    if (d === "sale" && !hasSale()) return null;
    const c = parts[1] ? catsOf(d).find(x => slug(x) === parts[1]) : "all";
    if (!c) return null;
    return { ...base, title: `${c === "all" ? name : `${c} · ${name}`} · ${BRAND}` };
  }
  if (VIEWS[parts[0]] && parts.length === 1) {
    return { ...base, title: `${VIEWS[parts[0]]} · ${BRAND}`, noindex: ["favourites", "bag", "checkout"].includes(parts[0]) };
  }
  if (parts[0] === "search" && parts.length === 1) {
    return { ...base, title: `Search · ${BRAND}`, noindex: true };
  }
  return null;
}
