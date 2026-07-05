/* ═══════════════════════════════════════════════════════════════
   KOYO — 고요 · tea product page
   (shared behavior in common.js, cart & Shopify in shop.js)
   ═══════════════════════════════════════════════════════════════ */

import { initSite, reduced } from "./common.js";
import { initShop, addToCart, fetchProductInfo, isShopifyConnected } from "./shop.js";

const site = initSite();

if (site) {
  initShop({ lenis: site.lenis });

  /* ── Gallery ────────────────────────────────────────────────── */

  const stage = document.getElementById("tea-stage-img");
  document.querySelectorAll(".tea-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      if (thumb.classList.contains("is-active")) return;
      document.querySelector(".tea-thumb.is-active")?.classList.remove("is-active");
      thumb.classList.add("is-active");
      gsap.to(stage, {
        opacity: 0, duration: 0.22, ease: "power1.in",
        onComplete: () => {
          stage.src = thumb.dataset.src;
          gsap.fromTo(stage, { opacity: 0, scale: 1.03 },
            { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
        },
      });
    });
  });

  /* ── Format (loose leaf / sachets) ──────────────────────────── */

  let format = "loose";
  const pouchThumb = document.getElementById("pouch-thumb");
  const teaId = document.getElementById("add-to-cart").dataset.teaId;
  const prices = {
    loose: parseInt(document.getElementById("add-to-cart").dataset.priceLoose, 10) || null,
    sachet: parseInt(document.getElementById("add-to-cart").dataset.priceSachet, 10) || null,
  };

  document.querySelectorAll(".format-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      if (opt.dataset.format === format) return;
      format = opt.dataset.format;
      document.querySelector(".format-opt.is-active")?.classList.remove("is-active");
      opt.classList.add("is-active");
      // the pouch imagery follows the chosen format
      if (pouchThumb) {
        const src = `../assets/img/packcut-${teaId}-${format}.webp`;
        pouchThumb.dataset.src = src;
        pouchThumb.querySelector("img").src = src;
        if (pouchThumb.classList.contains("is-active")) {
          gsap.to(stage, {
            opacity: 0, duration: 0.2, ease: "power1.in",
            onComplete: () => {
              stage.src = src;
              gsap.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
            },
          });
        }
      }
      refreshPrice();
    });
  });

  /* ── Quantity ───────────────────────────────────────────────── */

  const qtyValue = document.getElementById("qty-value");
  let qty = 1;
  const setQty = (n) => {
    qty = Math.min(20, Math.max(1, n));
    qtyValue.textContent = qty;
  };
  document.getElementById("qty-minus").addEventListener("click", () => setQty(qty - 1));
  document.getElementById("qty-plus").addEventListener("click", () => setQty(qty + 1));

  /* ── Add to order ───────────────────────────────────────────── */

  const addBtn = document.getElementById("add-to-cart");
  const defaultLabel = addBtn.textContent.trim();
  addBtn.addEventListener("click", async () => {
    addBtn.classList.add("is-busy");
    try {
      await addToCart({
        id: addBtn.dataset.teaId,
        name: addBtn.dataset.teaName,
        kr: addBtn.dataset.teaKr,
        qty,
        format,
        price: prices[format],
      });
      addBtn.textContent = "Added — 감사합니다";
      setTimeout(() => { addBtn.textContent = defaultLabel; }, 2200);
      setQty(1);
    } catch (e) {
      console.warn("[koyo shop]", e.message);
      addBtn.textContent = "Try again";
      setTimeout(() => { addBtn.textContent = defaultLabel; }, 2200);
    } finally {
      addBtn.classList.remove("is-busy");
    }
  });

  /* ── Live price & availability (once Shopify is connected) ──── */

  function refreshPrice() {
    const priceEl = document.getElementById("tea-price");
    if (prices[format]) priceEl.textContent = `$${prices[format]}`;
    if (!isShopifyConnected()) return;
    fetchProductInfo(teaId, format).then((info) => {
      if (!info) return;
      const priceEl = document.getElementById("tea-price");
      priceEl.textContent = info.price;
      priceEl.classList.add("is-visible");
      if (!info.available) {
        addBtn.textContent = "Sold out — next harvest soon";
        addBtn.classList.add("is-busy");
      } else {
        addBtn.textContent = defaultLabel;
        addBtn.classList.remove("is-busy");
      }
    });
  }
  refreshPrice();
}
