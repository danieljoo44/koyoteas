/* ═══════════════════════════════════════════════════════════════
   KOYO — Shopify connection
   ───────────────────────────────────────────────────────────────
   Fill in the three values below to switch the cart from
   "email order request" mode to real Shopify checkout.

   1. domain          — your store's myshopify.com domain
                        e.g. "koyo-teas.myshopify.com"
   2. storefrontToken — a Storefront API access token (safe to be
                        public). In Shopify admin: Settings → Apps
                        and sales channels → Develop apps → Create
                        an app → Configure Storefront API scopes
                        (enable unauthenticated_read_product_listings
                        and unauthenticated_write_checkouts) →
                        Install → copy the Storefront API access token.
   3. products        — the product *handle* for each tea (the slug
                        from the product URL in your Shopify admin,
                        e.g. .../products/sejak-green-tea → "sejak-green-tea")
   ═══════════════════════════════════════════════════════════════ */

window.KOYO_SHOP = {
  domain: "koyo-teas.myshopify.com",
  storefrontToken: "",   // e.g. "shpat_xxx… (Storefront, not Admin)"
  apiVersion: "2024-07",
  /* Each entry is either a single product handle, or a map from the
     site's format/variant label to a handle — the store keeps one
     Shopify product per format (e.g. "Sejak Green Tea - Loose Leaf"
     and "Sejak Green Tea - Sachets" are separate products). Handles
     are the slug in the product's URL in Shopify admin. */
  products: {
    sejak:     { loose: "", sachet: "" },
    artemisia: { loose: "", sachet: "" },
    persimmon: { loose: "", sachet: "" },
    hwangto:   { loose: "", sachet: "" },
    "simple-steeper": "",
    "atmos":     { electric: "", manual: "" },
    "stagg-ekg": { "matte black": "", "matte black + walnut": "" },
    "monty":     "",
    "lunar":     "",   // one product — needs Color variants in Shopify
    "pearl":     "",   // one product — needs Color variants in Shopify
    "tea-scoop": "",
  },
  // Fallback used while Shopify isn't connected:
  orderEmail: "info@koyoteas.com",
};
