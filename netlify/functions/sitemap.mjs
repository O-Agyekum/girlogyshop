/*
  /sitemap.xml, built from data/catalog.json so it always lists the current products.
  Search engines find it through robots.txt.
*/
import { SITE, allPaths } from "../lib/site.mjs";

export default async () => {
  const urls = allPaths().map(p => `  <url><loc>${SITE}${p}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
};

export const config = { path: "/sitemap.xml" };
