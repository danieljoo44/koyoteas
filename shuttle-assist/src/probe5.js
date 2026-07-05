// Development probe #5: click an Available cell in the slot table to learn the
// reserve step. Does NOT complete a reservation; if anything ends up held in
// the cart it is removed immediately.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe5-${new Date().toISOString().replace(/[:.]/g, '-')}`);
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
const SLOT = process.argv[3] || 'Time Slot 6:30am-7am Departures';

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

    const listRadio = page.getByRole('radio', { name: /list view of results/i });
    if (await listRadio.count()) { await listRadio.first().click(); await sleep(1800); }

    const slotBtn = page.getByRole('button', { name: new RegExp(SLOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (!(await slotBtn.count())) { log(`slot button not found: ${SLOT}`); return; }
    await slotBtn.click();
    log(`opened slot: ${SLOT}`);
    await sleep(2000);
    await record(page, 'slot-table');

    // List rows + first-column availability for our date.
    const rows = page.getByRole('row');
    const nRows = await rows.count();
    for (let i = 0; i < nRows; i++) {
      const cells = rows.nth(i).getByRole('cell');
      const nc = await cells.count();
      if (!nc) continue;
      const names = [];
      for (let j = 0; j < Math.min(nc, 3); j++) {
        names.push(((await cells.nth(j).getAttribute('aria-label').catch(() => null)) ||
          (await cells.nth(j).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ').slice(0, 80));
      }
      log(`row ${i}: ${JSON.stringify(names)}${nc > 3 ? ` (+${nc - 3} more cells)` : ''}`);
    }

    // Click the first Available cell (first data column = our date).
    const avail = page.getByRole('cell', { name: /available/i }).filter({ hasNotText: /unavailable/i }).first();
    if (!(await avail.count())) { log('no Available cell found'); return; }
    const cellName = await avail.getAttribute('aria-label').catch(() => null) || (await avail.innerText().catch(() => ''));
    log(`clicking cell: ${cellName.trim().replace(/\s+/g, ' ')}`);
    await avail.click();
    await sleep(2000);
    await record(page, 'cell-clicked');

    // What appeared?
    const btns = page.getByRole('button');
    const n = await btns.count();
    const names = [];
    for (let i = 0; i < n; i++) {
      const t = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
        (await btns.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
      if (t) names.push(t.slice(0, 90));
    }
    log(`buttons after cell click: ${JSON.stringify(names)}`);

    // Check whether the cart got anything (we do NOT want to hold inventory).
    const cartBtn = page.getByRole('button', { name: /view shopping cart/i }).first();
    const cartText = (await cartBtn.innerText().catch(() => '')).replace(/\s+/g, ' ');
    log(`cart button text now: "${cartText}"`);
    if (/[1-9]/.test(cartText)) {
      log('cart appears non-empty — opening cart to remove the hold');
      await cartBtn.click();
      await sleep(2000);
      await record(page, 'cart');
      const remove = page.getByRole('button', { name: /remove|delete/i }).first();
      if (await remove.count()) {
        await remove.click();
        await sleep(1500);
        const confirm = page.getByRole('button', { name: /yes|confirm|remove/i }).first();
        if (await confirm.count()) await confirm.click().catch(() => {});
        log('removed held item from cart');
        await record(page, 'cart-cleared');
      }
    }
  } catch (e) {
    log(`probe5 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe5 done');
  }
}

main();
