// Development probe #6: (a) click a truly Available regular cell to learn the
// reserve step (then remove any cart hold immediately); (b) click a
// "(Last Minute)" cell outside the 48h window to learn its behaviour.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe6-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(900 + Math.random() * 1100);

const DATE = process.argv[2] || '2026-10-06';
const NEXT = new Date(new Date(DATE + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);

function deepLink() {
  const q = new URLSearchParams({
    transactionLocationId: '-2147483647',
    resourceLocationId: '-2147483642',
    mapId: '-2147483634',
    searchTabGroupId: '3',
    bookingCategoryId: '9',
    startDate: DATE,
    endDate: NEXT,
    nights: '1',
    isReserving: 'true',
    peopleCapacityCategoryCounts: '[[-32767,null,2,null]]',
    searchTime: new Date().toISOString().slice(0, 23),
    flexibleSearch: '[false,false,null,1]',
  });
  return `https://reservation.pc.gc.ca/create-booking/results?${q}`;
}

let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true }).catch(() => {});
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
    log(`recorded ${tag} | aria=${snap.length}`);
  } catch (e) {
    log(`aria fail ${tag}: ${e.message}`);
  }
}

async function dumpNewText(page, label) {
  const dialogs = page.getByRole('dialog');
  for (let i = 0; i < (await dialogs.count()); i++) {
    log(`[${label}] dialog: ${JSON.stringify((await dialogs.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400))}`);
  }
  const alerts = page.getByRole('alert');
  for (let i = 0; i < (await alerts.count()); i++) {
    log(`[${label}] alert: ${JSON.stringify((await alerts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400))}`);
  }
}

async function clearCartIfHeld(page) {
  const cartBtn = page.getByRole('button', { name: /view shopping cart/i }).first();
  const cartText = (await cartBtn.innerText().catch(() => '')).replace(/\s+/g, ' ');
  log(`cart button text: "${cartText}"`);
  const held = page.getByRole('cell', { name: /Held in Cart/ });
  const heldCount = await held.count().catch(() => 0);
  log(`cells showing Held in Cart: ${heldCount}`);
  if (/[1-9]/.test(cartText) || heldCount > 0) {
    log('possible cart hold — opening cart to release it');
    await cartBtn.click();
    await sleep(2200);
    await record(page, 'cart');
    const remove = page.getByRole('button', { name: /remove|delete|trash/i }).first();
    if (await remove.count()) {
      await remove.click();
      await sleep(1200);
      const confirm = page.getByRole('button', { name: /^(yes|ok|confirm|remove)/i }).first();
      if (await confirm.count()) await confirm.click().catch(() => {});
      await sleep(1200);
      log('cart hold released');
      await record(page, 'cart-cleared');
    } else {
      log('no remove button found in cart view — check screenshots');
    }
    return true;
  }
  return false;
}

async function openSlot(page, slotRe) {
  const listRadio = page.getByRole('radio', { name: /list view of results/i });
  if (await listRadio.count()) {
    const checked = await listRadio.first().getAttribute('aria-checked').catch(() => null);
    if (checked !== 'true') { await listRadio.first().click(); await sleep(1600); }
  }
  const slotBtn = page.getByRole('button', { name: slotRe }).first();
  if (!(await slotBtn.count())) { log(`slot not found: ${slotRe}`); return false; }
  await slotBtn.click();
  await sleep(2000);
  return true;
}

async function main() {
  const browser = await chromium.launchPersistentContext(path.join(root, '.profile'), {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = browser.pages()[0] || (await browser.newPage());
  page.setDefaultTimeout(20000);
  try {
    await page.goto(deepLink(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    const consent = page.getByRole('button', { name: /i consent/i });
    if (await consent.count()) { await consent.click(); await pause(); }

    // --- Experiment A: regular "Lake Louise: 6:30am-7am" Available cell (earliest available date) ---
    if (!(await openSlot(page, /time slot 6:30am-7am departures/i))) return;
    await record(page, 'slot-table');

    // Case-sensitive: "... Available" has a word boundary before Available; "Unavailable" does not.
    const regAvail = page.getByRole('cell', { name: /^Lake Louise: 6:30am-7am\b(?!.*Last Minute).*\bAvailable$/ }).first();
    if (await regAvail.count()) {
      const label = await regAvail.getAttribute('aria-label').catch(() => null) || '';
      log(`EXPERIMENT A: clicking regular available cell: "${label}"`);
      await regAvail.click();
      await sleep(2200);
      await record(page, 'regular-clicked');
      await dumpNewText(page, 'A');
      const btns = page.getByRole('button');
      const names = [];
      for (let i = 0; i < (await btns.count()); i++) {
        const t = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
          (await btns.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
        if (t) names.push(t.slice(0, 90));
      }
      log(`[A] buttons: ${JSON.stringify(names)}`);
      await clearCartIfHeld(page);
    } else {
      log('EXPERIMENT A: no regular Lake Louise available cell this week');
    }

    // --- Experiment B: "(Last Minute)" cell outside the 48h window ---
    await page.goto(deepLink(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await pause();
    if (!(await openSlot(page, /time slot 6:30am-7am departures/i))) return;
    const lastMin = page.getByRole('cell', { name: /^Lake Louise: 6:30am-7am \(Last Minute\).*\bAvailable$/ }).first();
    if (await lastMin.count()) {
      const label = await lastMin.getAttribute('aria-label').catch(() => null) || '';
      log(`EXPERIMENT B: clicking last-minute cell: "${label}"`);
      await lastMin.click();
      await sleep(2200);
      await record(page, 'lastminute-clicked');
      await dumpNewText(page, 'B');
      await clearCartIfHeld(page);
    } else {
      log('EXPERIMENT B: no last-minute available cell found');
    }
  } catch (e) {
    log(`probe6 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe6 done');
  }
}

main();
