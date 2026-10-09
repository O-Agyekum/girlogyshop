/*
  Serves index.html for the shop's page addresses (/her, /her/tops, /product/tee-black ...)
  with that page's title, description and sharing image already in the HTML, so search
  engines and link previews (WhatsApp, Instagram, Facebook) show the right page.
  Unknown addresses get the same page with a 404 status; the app shows "Page not found".
*/
import { SITE, describe } from "../lib/site.mjs";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function withMeta(html, url, m) {
  const set = (re, value) => { html = html.replace(re, (all, a, b) => a + esc(value) + b); };
  set(/(<title>)[^<]*(<\/title>)/, m.title);
  set(/(<meta property="og:title" content=")[^"]*(">)/, m.title);
  set(/(<link rel="canonical" href=")[^"]*(">)/, url);
  set(/(<meta property="og:url" content=")[^"]*(">)/, url);
  set(/(<meta property="og:image" content=")[^"]*(">)/, m.image);
  if (m.description) {
    set(/(<meta name="description" content=")[^"]*(">)/, m.description);
    set(/(<meta property="og:description" content=")[^"]*(">)/, m.description);
  }
  if (m.type === "product") set(/(<meta property="og:type" content=")[^"]*(">)/, "product");
  if (m.type === "product") html = html.replace(/<meta property="og:image:(width|height)"[^>]*>\n?/g, "");
  if (m.noindex) html = html.replace("</head>", '<meta name="robots" content="noindex">\n</head>');
  return html;
}

export default async (req) => {
  const { pathname, search } = new URL(req.url);
  const res = await fetch(new URL("/index.html", req.url));
  if (!res.ok) return new Response("Not found", { status: 404 });
  const html = await res.text();

  const m = describe(pathname);
  const status = m ? 200 : 404;
  const body = m ? withMeta(html, SITE + pathname + (pathname === "/search" ? search : ""), m)
                 : html.replace("</head>", '<meta name="robots" content="noindex">\n</head>');

  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
};

export const config = {
  path: [
    "/product/*",
    "/new", "/new/*",
    "/her", "/her/*",
    "/plus-one", "/plus-one/*",
    "/accessories", "/accessories/*",
    "/couples", "/couples/*",
    "/sale", "/sale/*",
    "/shop", "/favourites", "/bag", "/checkout", "/help", "/about", "/collection", "/search"
  ]
};
