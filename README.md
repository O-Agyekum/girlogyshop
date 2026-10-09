# The Girlogist — girlogyshop.com

Online shop for the girlogy brand. Plain HTML, CSS and JavaScript, hosted for free on
**Netlify**, with payments through **Revolut** (hosted checkout page).

> Why Netlify and not GitHub Pages? GitHub's rules say Pages "is not intended for or allowed
> to be used as a free web-hosting service to run your online business, e-commerce site".
> Netlify's free plan allows commercial sites, deploys straight from this repository,
> accepts your own domain and can run the small server code that card payments need.

## How it works

| Part | Where | What it does |
|---|---|---|
| Website | Root folder (`index.html`, `css/`, `js/`, `images/`, `fonts/`) | Pages, styles, images, fonts, translations (EN, FR, ES) |
| Catalogue | `data/catalog.json` | Products, prices, colours, sizes, bundles, delivery prices |
| Payment | `netlify/functions/create-order.mjs` | Recalculates the total from the catalogue, then asks Revolut for a payment page |
| Payment check | `netlify/functions/order-status.mjs` | After payment, asks Revolut whether the order is paid |
| Promo codes | `netlify/functions/check-promo.mjs` | Checks codes stored in the `PROMO_CODES` setting |
| Forms | Netlify Forms | Contact form, newsletter and an "order" notification with the delivery address |
| Legal pages | `legal/` | Mentions légales, CGV, droit de rétractation, confidentialité |

Prices shown in the browser are only for display. The server never trusts them: it reprices
every order from `catalog.json` before sending the amount to Revolut.

## Orders switch

Online orders are **closed** for now: girlogyshop.com opens on a **pre-launch page**
(illustration, story, collection preview and an email sign-up that goes to the
`newsletter` list in Netlify Forms). The shop itself is at `/shop`; visitors can browse
and fill their bag, but the checkout button reads "Online orders opening soon". When Revolut is set up and tested,
open orders by changing `ordersOpen: false` to `ordersOpen: true` in `js/config.js`. The shop then becomes
the homepage again and the pre-launch page is no longer shown.

## Put the site online (one time)

1. Create a free account on **netlify.com** (sign in with GitHub).
2. **Add new site → Import an existing project → GitHub → O-Agyekum/girlogyshop**.
   Netlify reads `netlify.toml`, so leave the build settings as they are and deploy.
3. **Site configuration → Environment variables**, add:
   - `REVOLUT_SECRET_KEY`: your Revolut Merchant API **secret** key
     (Revolut Business → Merchant → APIs). Never put it in the code.
   - `PROMO_CODES`: for example `BIENVENUE10:10` (code:percent, separated by commas).
   - Optional: `REVOLUT_ENV` = `sandbox` to test with Revolut's sandbox key first.
4. **Forms → enable form detection**, then **Forms → notifications**: add an email
   notification for the `order` and `contact` forms so you receive each order's address.
5. **Domain management → Add a domain → girlogyshop.com**. Netlify shows the DNS records
   to add at OVH (Web Cloud → Domain names → girlogyshop.com → DNS zone). HTTPS is free
   and automatic once the domain points to Netlify.
6. Redeploy once after adding the variables.

## Test a payment before going live

Set `REVOLUT_ENV=sandbox` and use a sandbox secret key, place an order with a Revolut test
card, check you are sent back to the site with the confirmation, then switch to the live key
and remove `REVOLUT_ENV`.

## Day-to-day

- **Change a price, add a product or a photo**: edit `data/catalog.json` and add the
  images in `images/products/`. Each commit to `main` redeploys the site.
- **Orders**: payments appear in your Revolut Business account; the delivery details arrive
  by email through the `order` form. Match them with the reference `TG-…`.
- **Text**: all wording is in `js/i18n.js` (English, French, Spanish).
- **Social links and contact email**: `js/config.js`.

## Page addresses, Google and link previews

Every page has its own address, so the Back button works and links can be shared:
`/her`, `/her/tops`, `/plus-one`, `/accessories/bags`, `/couples`, `/new`,
`/product/<product id>` (for example `/product/tee-black`), `/help`, `/about`, `/bag`.

- `netlify/functions/page.mjs` serves the site for these addresses with the page's title,
  description and sharing image already in the HTML (for Google and WhatsApp/Instagram previews).
  An address that matches nothing returns "Page not found" (`404.html`).
- `/sitemap.xml` is built automatically from `data/catalog.json`; `robots.txt` points to it.
  Once the site is live, add it in Google Search Console (Sitemaps).
- Icons: `favicon.ico`, `favicon-192.png`, `apple-touch-icon.png`. Sharing image: `images/og-girlogy.jpg`.

## Product photos per colour

`"images"` are the product's photos; they show its first colour (or the colour named in
`"photoColor"`). To give another colour its own photos, add for example
`"colorImages": {"rust": ["/images/products/hoodie-rust-1.webp", "..."]}`. Choosing that colour
then switches the photos. A colour without photos shows a plain colour swatch and the note
"Photo shows the cream colour", so customers are never shown the wrong colour as if it were theirs.
Gelato's mockup generator can produce one photo per colour.

## Products not made by Gelato

Products with `"pod": false` in `data/catalog.json` (the varsity jackets and the couple
tracksuits) are not print-on-demand and have no supplier yet, so they are shown as
**Coming soon**: a "Coming soon" badge on the tile, no size choice, a disabled button instead
of "Add to bag", and no maker or delivery promise. A couples bundle that contains one of them
is "Coming soon" too. Nothing with `"pod": false` can be added to the bag, even by an old link.
Once a supplier and a real delivery time are confirmed, remove `"pod": false` (or set it to
`true`) and the piece sells like the others. Selling something you cannot deliver on time is
a breach of the Code de la consommation (article L216-1), so keep this until then.

## Honest prices and badges (French consumer law)

- **Crossed-out prices** (`"was"` in `data/catalog.json`): only use one when the crossed-out price is
  the lowest price you actually charged in the 30 days before the reduction
  (Code de la consommation, art. L112-1-1). The "Sale" section and links appear only when at least
  one product has a `"was"` price.
- **Badges** (`"badge"`): `"b_new"` and `"b_plus"` are descriptive. Only add `"b_best"`
  ("Best seller"), `"b_teen"` or `"b_lim"` ("Limited") when it is true and you can show it
  (sales figures, a real limited run). False claims are misleading commercial practices (art. L121-2).
- **Sold out** (`"soldOut"`): products are printed to order, so only mark a size sold out if the
  printer genuinely cannot make it.

## Before launch: complete the legal pages

Fill in every highlighted blank in `legal/` (name, SIREN, address, VAT mention,
mediator, return address). French law requires these for any shop selling to consumers.
Have them checked by a professional (CCI, lawyer or accountant).

## Fonts

Self-hosted in `fonts/` (Jost, Fraunces, Parisienne, SIL Open Font License 1.1), so no
visitor data is sent to Google Fonts.
