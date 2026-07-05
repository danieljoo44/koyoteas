// Development probe #7: click Reserve on an available regular cell to learn
// what gate follows (sign-in wall vs cart hold). Any cart hold is removed
// immediately. No reservation is completed.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe7-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    log(`recorded ${tag} | url=${page.url().slice(0, 100)} | aria=${snap.length}`);
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
    if (await consent.count()) { await consent.click(); await sleep(1200); }

    const listRadio = page.getByRole('radio', { name: /list view of results/i });
    if (await listRadio.count()) { await listRadio.first().click(); await sleep(1600); }
    const slotBtn = page.getByRole('button', { name: /time slot 6:30am-7am departures/i }).first();
    await slotBtn.click();
    await sleep(2000);

    const cell = page.getByRole('cell', { name: /^Lake Louise: 6:30am-7am\b(?!.*Last Minute).*\bAvailable$/ }).first();
    if (!(await cell.count())) { log('no available regular cell'); return; }
    log(`clicking cell: ${await cell.getAttribute('aria-label')}`);
    await cell.click();
    await sleep(1500);

    const reserve = page.getByRole('button', { name: /^reserve$/i }).first();
    if (!(await reserve.count())) { log('no Reserve button appeared'); await record(page, 'no-reserve'); return; }
    log('clicking Reserve');
    await reserve.click();
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await sleep(2500);
    await record(page, 'after-reserve');

    // What are we looking at?
    const bodyText = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
    log(`page text sample: ${JSON.stringify(bodyText.slice(0, 600))}`);
    log(`url: ${page.url()}`);

    // Clean up any cart hold.
    const cartBtn = page.getByRole('button', { name: /view shopping cart/i }).first();
    const cartText = (await cartBtn.innerText().catch(() => '')).replace(/\s+/g, ' ');
    log(`cart button text: "${cartText}"`);
    if (/[1-9]/.test(cartText) || /held|expires|time remaining/i.test(bodyText)) {
      log('cart hold detected — releasing');
      if (!/cart/i.test(page.url())) { await cartBtn.click(); await sleep(2000); }
      await record(page, 'cart');
      const remove = page.getByRole('button', { name: /remove|delete|trash/i }).first();
      if (await remove.count()) {
        await remove.click();
        await sleep(1200);
        const confirm = page.getByRole('button', { name: /^(yes|ok|confirm|remove)/i }).first();
        if (await confirm.count()) await confirm.click().catch(() => {});
        await sleep(1500);
        log('released');
        await record(page, 'cart-cleared');
      } else {
        log('NO REMOVE BUTTON FOUND — leaving for manual cleanup; hold expires on its own');
      }
    }
  } catch (e) {
    log(`probe7 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe7 done');
  }
}

main();
