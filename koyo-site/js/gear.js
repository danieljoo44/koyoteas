/* ═══════════════════════════════════════════════════════════════
   KOYO — teaware product page
   (shared behavior in common.js, cart in shop.js)
   ═══════════════════════════════════════════════════════════════ */

import { initSite } from "./common.js";
import { initShop, addToCart, fetchProductInfo } from "./shop.js";

const site = initSite();

if (site) {
  initShop({ lenis: site.lenis });

  const stage = document.getElementById("tea-stage-img");
  const priceEl = document.getElementById("gear-price");
  const addBtn = document.getElementById("add-to-cart");

  /* ── Gallery thumbs ─────────────────────────────────────────── */

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

  /* ── Variant picker ─────────────────────────────────────────── */

  document.querySelectorAll(".format-opt").forEach((opt) => {
    opt.addEventListener("click", () => {
      if (!addBtn || opt.classList.contains("is-active")) return;
      document.querySelector(".format-opt.is-active")?.classList.remove("is-active");
      opt.classList.add("is-active");
      addBtn.dataset.variant = opt.dataset.variant;
      addBtn.dataset.variantLabel = opt.dataset.label;
      addBtn.dataset.price = opt.dataset.price;
      applyAvailability();
      priceEl.textContent = "$" + Number(opt.dataset.price).toLocaleString(undefined, {
        minimumFractionDigits: 0, maximumFractionDigits: 2,
      });
      if (opt.dataset.img && stage.getAttribute("src") !== opt.dataset.img) {
        gsap.to(stage, {
          opacity: 0, duration: 0.22, ease: "power1.in",
          onComplete: () => {
            stage.src = opt.dataset.img;
            gsap.fromTo(stage, { opacity: 0, scale: 1.03 },
              { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
          },
        });
      }
    });
  });

  /* ── Quantity ───────────────────────────────────────────────── */

  let qty = 1;
  const qtyEl = document.getElementById("qty-value");
  const setQty = (n) => { qty = Math.min(9, Math.max(1, n)); if (qtyEl) qtyEl.textContent = qty; };
  if (qtyEl && addBtn) {
    document.getElementById("qty-minus").addEventListener("click", () => setQty(qty - 1));
    document.getElementById("qty-plus").addEventListener("click", () => setQty(qty + 1));
  }

  /* ── Add to order ───────────────────────────────────────────── */

  const defaultLabel = addBtn ? addBtn.textContent.trim() : "";

  /* Sold-out state from live Shopify availability (no-op offline) */
  async function applyAvailability() {
    if (!addBtn) return;
    const info = await fetchProductInfo(addBtn.dataset.gearId, addBtn.dataset.variantLabel);
    if (info && info.available === false) {
      addBtn.disabled = true;
      addBtn.textContent = "Sold out — back soon";
    } else if (info && addBtn.disabled) {
      addBtn.disabled = false;
      addBtn.textContent = defaultLabel;
    }
  }
  applyAvailability();
  if (addBtn) addBtn.addEventListener("click", async () => {
    addBtn.classList.add("is-busy");
    try {
      await addToCart({
        id: addBtn.dataset.gearId,
        name: addBtn.dataset.gearName,
        kr: "",
        qty,
        format: addBtn.dataset.variantLabel,
        price: Number(addBtn.dataset.price),
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
}
