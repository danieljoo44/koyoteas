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
  domain: "",            // e.g. "koyo-teas.myshopify.com"
  storefrontToken: "",   // e.g. "shpat_xxx… (Storefront, not Admin)"
  apiVersion: "2024-07",
  products: {
    sejak:     "",       // e.g. "sejak-green-tea"
    artemisia: "",       // e.g. "artemisia-tea"
    persimmon: "",       // e.g. "persimmon-leaf-tea"
    hwangto:   "",       // e.g. "hwangto-red-tea-quince"
    /* teaware — variant titles in Shopify should match the site's
       option labels (e.g. "Matte Black + Walnut", "Space Gray") */
    "simple-steeper": "",
    "atmos":          "",
    "stagg-ekg":      "",
    "monty":          "",
    "lunar":          "",
    "pearl":          "",
    "tea-scoop":      "",
  },
  // Fallback used while Shopify isn't connected:
  orderEmail: "info@koyoteas.com",
};
