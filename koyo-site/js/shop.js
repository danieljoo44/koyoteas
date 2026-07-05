/* ═══════════════════════════════════════════════════════════════
   KOYO — 고요 · shop layer
   Shopify Storefront API cart + checkout, with an email
   order-request fallback while Shopify isn't connected yet.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.KOYO_SHOP || {};
const configured = !!(CFG.domain && CFG.storefrontToken);

const LOCAL_KEY = "koyo-cart-local";
const CART_ID_KEY = "koyo-shopify-cart-id";

let lenisRef = null;
let drawer, backdrop, listEl, subtotalRow, subtotalEl, checkoutBtn, noteEl, countEls;

const fmtUsd = (n) => `$${Number(n) % 1 === 0 ? Number(n) : Number(n).toFixed(2)}`;

/* ── Shopify Storefront API ───────────────────────────────────── */

async function gql(query, variables = {}) {
  const res = await fetch(`https://${CFG.domain}/api/${CFG.apiVersion || "2024-07"}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": CFG.storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { amount currencyCode } }
  lines(first: 20) {
    nodes {
      id
      quantity
      merchandise {
        ... on ProductVariant {
          id
          title
          product { title handle }
          price { amount currencyCode }
        }
      }
    }
  }
`;

const variantCache = {};

const FORMAT_MATCHERS = {
  loose: /loose/i,
  sachet: /sachet|bag/i,
};

async function resolveVariant(teaId, format = "loose") {
  const key = `${teaId}:${format}`;
  if (variantCache[key]) return variantCache[key];
  const handle = CFG.products?.[teaId];
  if (!handle) throw new Error(`No Shopify product handle configured for "${teaId}"`);
  const data = await gql(
    `query($handle: String!) {
       product(handle: $handle) {
         title
         variants(first: 10) {
           nodes {
             id
             title
             availableForSale
             price { amount currencyCode }
             selectedOptions { name value }
           }
         }
       }
     }`,
    { handle }
  );
  const variants = data.product?.variants?.nodes || [];
  if (!variants.length) throw new Error(`Product "${handle}" not found in Shopify`);
  const rx = FORMAT_MATCHERS[format] || FORMAT_MATCHERS.loose;
  const match =
    variants.find((v) =>
      v.selectedOptions?.some((o) => rx.test(o.value)) || rx.test(v.title)) ||
    variants[0];
  variantCache[key] = match;
  return match;
}

async function shopifyCart() {
  const id = localStorage.getItem(CART_ID_KEY);
  if (id) {
    try {
      const data = await gql(`query($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`, { id });
      if (data.cart) return data.cart;
    } catch { /* stale cart — create a new one below */ }
  }
  const data = await gql(`mutation { cartCreate { cart { ${CART_FIELDS} } } }`);
  const cart = data.cartCreate.cart;
  localStorage.setItem(CART_ID_KEY, cart.id);
  return cart;
}

/* ── Local fallback cart ──────────────────────────────────────── */

const localCart = {
  read: () => JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"),
  write: (items) => localStorage.setItem(LOCAL_KEY, JSON.stringify(items)),
};

/* ── Public API ───────────────────────────────────────────────── */

export function isShopifyConnected() { return configured; }

export async function fetchProductInfo(teaId, format = "loose") {
  if (!configured) return null;
  try {
    const v = await resolveVariant(teaId, format);
    return {
      available: v.availableForSale,
      price: formatMoney(v.price),
    };
  } catch (e) {
    console.warn("[koyo shop]", e.message);
    return null;
  }
}

const FORMAT_LABELS = { loose: "Loose Leaf", sachet: "Sachets" };

export async function addToCart({ id, name, kr, qty = 1, format = "loose", price = null }) {
  if (configured) {
    const variant = await resolveVariant(id, format);
    const cart = await shopifyCart();
    await gql(
      `mutation($cartId: ID!, $lines: [CartLineInput!]!) {
         cartLinesAdd(cartId: $cartId, lines: $lines) { cart { id } }
       }`,
      { cartId: cart.id, lines: [{ merchandiseId: variant.id, quantity: qty }] }
    );
  } else {
    const items = localCart.read();
    const lineId = `${id}:${format}`;
    const line = items.find((i) => i.id === lineId);
    if (line) line.qty += qty;
    else items.push({ id: lineId, name: `${name} — ${FORMAT_LABELS[format] || format}`, kr, qty, price });
    localCart.write(items);
  }
  await refresh();
  openDrawer();
}

export function initShop({ lenis } = {}) {
  lenisRef = lenis || null;
  drawer = document.getElementById("cart-drawer");
  backdrop = document.getElementById("cart-backdrop");
  if (!drawer) return;
  listEl = drawer.querySelector(".cart-lines");
  subtotalRow = drawer.querySelector(".cart-subtotal");
  subtotalEl = drawer.querySelector(".cart-subtotal-amount");
  checkoutBtn = drawer.querySelector(".cart-checkout");
  noteEl = drawer.querySelector(".cart-note");
  countEls = document.querySelectorAll("[data-cart-count]");

  document.querySelectorAll("[data-cart-open]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); openDrawer(); }));
  drawer.querySelector(".cart-close").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  noteEl.textContent = configured
    ? "Small-batch — hand-packed and shipped from Grand Rapids."
    : "Online checkout is coming soon. Send your order request and we'll reply within a day with payment and shipping.";

  refresh();
}

/* ── Drawer state & rendering ─────────────────────────────────── */

let isOpen = false;

function openDrawer() {
  if (!drawer || isOpen) return;
  isOpen = true;
  drawer.classList.add("is-open");
  backdrop.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  if (lenisRef) lenisRef.stop();
}

function closeDrawer() {
  if (!drawer || !isOpen) return;
  isOpen = false;
  drawer.classList.remove("is-open");
  backdrop.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  if (lenisRef) lenisRef.start();
}

function formatMoney(m) {
  if (!m) return "";
  const n = parseFloat(m.amount);
  const sym = m.currencyCode === "USD" ? "$" : `${m.currencyCode} `;
  return `${sym}${n % 1 === 0 ? n : n.toFixed(2)}`;
}

function setCount(n) {
  countEls.forEach((el) => (el.textContent = `CART — ${n}`));
}

async function refresh() {
  if (!drawer) return;
  if (configured) {
    try {
      const cart = await shopifyCart();
      setCount(cart.totalQuantity);
      renderShopifyLines(cart);
      return;
    } catch (e) {
      console.warn("[koyo shop]", e.message);
    }
  }
  const items = localCart.read();
  setCount(items.reduce((s, i) => s + i.qty, 0));
  renderLocalLines(items);
}

function lineRow({ title, kr, qty, price, onQty, onRemove }) {
  const row = document.createElement("div");
  row.className = "cart-line";
  row.innerHTML = `
    <div class="cart-line-info">
      <p class="cart-line-name">${title}${kr ? ` <span>${kr}</span>` : ""}</p>
      ${price ? `<p class="cart-line-price mono">${price}</p>` : ""}
    </div>
    <div class="cart-line-controls">
      <button class="cart-qty-btn" data-d="-1" aria-label="Decrease quantity">−</button>
      <span class="cart-qty mono">${qty}</span>
      <button class="cart-qty-btn" data-d="1" aria-label="Increase quantity">+</button>
      <button class="cart-remove" aria-label="Remove">×</button>
    </div>`;
  row.querySelectorAll(".cart-qty-btn").forEach((b) =>
    b.addEventListener("click", () => onQty(qty + parseInt(b.dataset.d, 10))));
  row.querySelector(".cart-remove").addEventListener("click", onRemove);
  return row;
}

function renderEmpty() {
  listEl.innerHTML = `<p class="cart-empty">Your cart is quiet.<br /><span class="mono">고요 — AS IT SHOULD BE, FOR NOW</span></p>`;
  subtotalRow.style.display = "none";
  checkoutBtn.style.display = "none";
}

function renderShopifyLines(cart) {
  listEl.innerHTML = "";
  if (!cart.lines.nodes.length) return renderEmpty();
  cart.lines.nodes.forEach((line) => {
    const vTitle = line.merchandise.title;
    listEl.appendChild(lineRow({
      title: line.merchandise.product.title +
        (vTitle && vTitle !== "Default Title" ? ` — ${vTitle}` : ""),
      kr: "",
      qty: line.quantity,
      price: formatMoney(line.merchandise.price),
      onQty: async (q) => {
        await gql(
          `mutation($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
             cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { id } }
           }`,
          { cartId: cart.id, lines: [{ id: line.id, quantity: Math.max(0, q) }] });
        refresh();
      },
      onRemove: async () => {
        await gql(
          `mutation($cartId: ID!, $lineIds: [ID!]!) {
             cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { id } }
           }`,
          { cartId: cart.id, lineIds: [line.id] });
        refresh();
      },
    }));
  });
  subtotalRow.style.display = "flex";
  subtotalEl.textContent = formatMoney(cart.cost.subtotalAmount);
  checkoutBtn.style.display = "inline-block";
  checkoutBtn.textContent = "Checkout";
  checkoutBtn.onclick = () => { window.location.href = cart.checkoutUrl; };
}

function renderLocalLines(items) {
  listEl.innerHTML = "";
  if (!items.length) return renderEmpty();
  items.forEach((item) => {
    listEl.appendChild(lineRow({
      title: item.name,
      kr: item.kr,
      qty: item.qty,
      price: item.price ? fmtUsd(item.price) : "",
      onQty: (q) => {
        if (q <= 0) items.splice(items.indexOf(item), 1);
        else item.qty = q;
        localCart.write(items);
        refresh();
      },
      onRemove: () => {
        items.splice(items.indexOf(item), 1);
        localCart.write(items);
        refresh();
      },
    }));
  });
  const total = items.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  if (total > 0) {
    subtotalRow.style.display = "flex";
    subtotalEl.textContent = fmtUsd(total);
  } else {
    subtotalRow.style.display = "none";
  }
  checkoutBtn.style.display = "inline-block";
  checkoutBtn.textContent = "Send order request";
  checkoutBtn.onclick = () => {
    const lines = items.map((i) =>
      `- ${i.name}${i.kr ? ` (${i.kr})` : ""} × ${i.qty}${i.price ? ` — $${i.price * i.qty}` : ""}`).join("\n");
    const totalLine = total > 0 ? `\nSubtotal: $${total}\n` : "";
    const body = encodeURIComponent(
      `Hello Koyo,\n\nI'd like to order:\n\n${lines}\n${totalLine}\nName:\nShipping address:\n\nThank you.`);
    window.location.href = `mailto:${CFG.orderEmail || "info@koyoteas.com"}?subject=${encodeURIComponent("Koyo order request")}&body=${body}`;
  };
}
