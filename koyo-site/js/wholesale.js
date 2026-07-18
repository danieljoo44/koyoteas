/* ═══════════════════════════════════════════════════════════════
   KOYO — wholesale page
   Line-sheet quantities + order request via email; invoicing is
   handled person-to-person (Shopify draft orders on our side).
   ═══════════════════════════════════════════════════════════════ */

import { initSite } from "./common.js";
import { initShop } from "./shop.js";

const site = initSite();
if (site) initShop({ lenis: site.lenis });

const ORDER_EMAIL = (window.KOYO_SHOP && window.KOYO_SHOP.orderEmail) || "info@koyoteas.com";
const fmtUsd = (n) => `$${n % 1 === 0 ? n : n.toFixed(2)}`;

const rows = [...document.querySelectorAll(".ws-row")];
const subtotalEl = document.getElementById("ws-subtotal");
const hintEl = document.getElementById("ws-hint");
const form = document.getElementById("ws-form");

const qtyOf = (row) => parseInt(row.querySelector(".ws-qty span").textContent, 10) || 0;

function recalc() {
  let cases = 0, kg = 0, subtotal = 0;
  rows.forEach((row) => {
    const q = qtyOf(row);
    if (row.dataset.bulk) kg += q;
    else { cases += q; subtotal += q * parseFloat(row.dataset.price); }
  });
  subtotalEl.textContent = fmtUsd(subtotal) + (kg ? " + BULK" : "");
  const met = cases >= 1 || kg >= 1;
  hintEl.textContent = met
    ? `${cases * 10} UNITS${kg ? ` + ${kg} KG BULK` : ""} — 감사합니다`
    : "MINIMUM ORDER 10 UNITS · ONE CASE";
  hintEl.classList.toggle("is-met", met);
  return { cases, kg, subtotal };
}

rows.forEach((row) => {
  const span = row.querySelector(".ws-qty span");
  row.querySelectorAll(".ws-qty button").forEach((b) =>
    b.addEventListener("click", () => {
      span.textContent = Math.min(99, Math.max(0, qtyOf(row) + parseInt(b.dataset.d, 10)));
      recalc();
    }));
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const { cases, kg, subtotal } = recalc();
  const val = (id) => document.getElementById(id).value.trim();
  const missing = [];
  if (!val("ws-shop")) missing.push("shop name");
  if (!val("ws-contact")) missing.push("contact name");
  if (!/.+@.+\..+/.test(val("ws-email"))) missing.push("email");
  if (cases < 1 && kg < 1) missing.push("at least one case or bulk kilogram");
  if (missing.length) {
    hintEl.textContent = ("PLEASE ADD " + missing.join(", ")).toUpperCase();
    hintEl.classList.remove("is-met");
    return;
  }

  const lines = rows
    .filter((row) => qtyOf(row) > 0)
    .map((row) => {
      const q = qtyOf(row);
      const p = parseFloat(row.dataset.price);
      return `- ${row.dataset.name} × ${q}${row.dataset.bulk ? " kg (quote)" : ` — ${fmtUsd(p * q)}`}`;
    })
    .join("\n");

  const body = encodeURIComponent(
    `Hello Koyo,\n\nWe'd like to place a wholesale order:\n\n${lines}\n\n` +
    `Cases subtotal: ${fmtUsd(subtotal)}${kg ? `\nBulk loose leaf: ${kg} kg total, please quote` : ""}\n\n` +
    `Shop: ${val("ws-shop")}\nContact: ${val("ws-contact")}\nEmail: ${val("ws-email")}\n` +
    (val("ws-phone") ? `Phone: ${val("ws-phone")}\n` : "") +
    (val("ws-address") ? `Shipping address: ${val("ws-address")}\n` : "") +
    (val("ws-notes") ? `\nNotes: ${val("ws-notes")}\n` : "") +
    `\nThank you.`);

  window.location.href =
    `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(`Koyo wholesale order — ${val("ws-shop")}`)}&body=${body}`;
});

recalc();
