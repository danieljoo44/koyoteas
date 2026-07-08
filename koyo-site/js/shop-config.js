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
  storefrontToken: "186dd7093a36874bb84b472527153980", // Headless channel public token (public-safe)
  apiVersion: "2024-07",
  /* Each entry is either a single product handle, or a map from the
     site's format/variant label to a handle — the store keeps one
     Shopify product per format (e.g. "Sejak Green Tea - Loose Leaf"
     and "Sejak Green Tea - Sachets" are separate products). Handles
     are the slug in the product's URL in Shopify admin. */
  products: {
    sejak:     { loose: "sejak-green-tea-loose-leaf", sachet: "sejak-green-tea-sachets" },
    /* artemisia handles are crossed in the store: the Sachet product
       was created first and owns "artemisia-loose" — do not "fix"
       these by symmetry */
    artemisia: { loose: "artemisia-loose-1", sachet: "artemisia-loose" },
    persimmon: { loose: "young-persimmon-leaf-loose", sachet: "young-persimmon-leaf-sachet" },
    hwangto:   { loose: "hwangto-loose", sachet: "hwangto-sachet" },
    "simple-steeper": "the-simple-steeper",
    "atmos": {
      electric: "fellow-atmos-vacuum-canister-0-7l-electric",
      manual:   "fellow-atmos-vacuum-canister-0-7l-manual",
    },
    "stagg-ekg": {
      "matte black":          "stagg-ekg-pro-black",
      "matte black + walnut": "stagg-ekg-pro-black-and-walnut",
    },
    "monty":     "fellow-monty-cup",
    "lunar":     "acaia-lunar-scale",   // single variant — color rides as a line attribute
    "pearl":     "acaia-pearl-scale",   // single variant — color rides as a line attribute
    "tea-scoop": "acaia-tea-scoops",
  },
  // Fallback used while Shopify isn't connected:
  orderEmail: "info@koyoteas.com",
};
