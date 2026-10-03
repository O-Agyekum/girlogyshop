# girlogy — Shopify theme

Custom Shopify theme for **girlogyshop.com**, built from the girlogy shop design
(cream, near-black and rust palette, Archivo Black + Hind, italic serif wordmark).
Written from scratch. Validated with Shopify Theme Check: 0 errors, 0 warnings.

## Connect it to Shopify

1. Shopify admin: **Online Store → Themes → Add theme → Connect from GitHub**.
2. Choose the account **O-Agyekum**, the repository **girlogyshop**, branch **main**.
3. The theme arrives in your theme library as a draft. Click **Customize** to preview it.
4. When happy, click **Publish**.

Every change pushed to `main` updates the connected theme. Changes made in the theme
editor are committed back to GitHub by Shopify.

## What's inside

| Page | Sections |
|---|---|
| Home | Split banner, perks strip, featured collection, caption marquee, collection list, image with text, rich text, newsletter. Slideshow also available. |
| Product | Gallery, colour swatches and size pills, quantity, add to cart, express checkout, size guide, collapsible rows, related products |
| Collection | Chip filters (colour, size, category…), sorting, pagination |
| Cart | Slide-out drawer (default) or full cart page, order note |
| Other | Search, pages, contact form (`page.contact`), blog, article, 404, password page, gift card |

English and French translations are included (`locales/`).

## Shopify settings to make it look like the design

- **Menus** (Online Store → Navigation): `main-menu` for the header, `footer` for the footer.
- **Filters**: install Shopify's free *Search & Discovery* app and add Colour, Size and
  Product type filters. They appear as chips on collection pages.
- **Product tagline**: Settings → Custom data → Products → add a definition named
  `Tagline`, namespace and key `custom.tagline`, type *Single line text*.
- **Product badges**: add a tag like `badge:New`, `badge:Best seller` or `badge:Drop 02`.
- **Product details list** (optional): definition `custom.details`, type
  *List of single line text*.
- **Colour swatches**: name the variant option `Colour` (or `Color` / `Couleur`).
  Values like Rust, Cream, Black, Chocolate, Sage, Blush, Butter, Denim, White, Gold,
  Marble get the brand swatch colours.
- **Size guide**: shown automatically on products with a `Size` option.
- **Legal pages**: Settings → Policies (refund, privacy, terms, shipping, contact) are
  linked in the footer automatically. Put your *Mentions légales* page in a menu and
  select it as the footer's *Legal menu*.

## Privacy

Fonts are self-hosted in `assets/` and served from Shopify's CDN, so no visitor data is
sent to Google Fonts. Font licences: see `FONT-LICENSES.md` (SIL Open Font License 1.1).
