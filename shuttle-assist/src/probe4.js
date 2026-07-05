// Development probe #4: open an available time slot to see the reserve step.
// Records structure only — never clicks Reserve / never adds to cart.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe4-${new Date().toISOString().replace(/[:.]/g, '-')}`);
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

async function dumpButtons(page, label) {
  const btns = page.getByRole('button');
  const n = await btns.count();
  const names = [];
  for (let i = 0; i < n; i++) {
    const t = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
      (await btns.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
    if (t) names.push(t.slice(0, 90));
  }
  log(`[${label}] buttons: ${JSON.stringify(names)}`);
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
    await record(page, 'list');

    // Open the 5am Alpine Start slot.
    const alpine = page.getByRole('button', { name: /time slot 5am alpine start/i }).first();
    if (await alpine.count()) {
      await alpine.click();
      log('clicked "Time Slot 5am Alpine Start Departure"');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await sleep(1800);
      await record(page, 'alpine-5am-open');
      await dumpButtons(page, 'alpine-5am');
    } else {
      log('5am alpine slot button not found');
    }

    // Back to list (if slot view replaced it) and open the 6:30 regular slot.
    const back = page.getByRole('button', { name: /back|previous/i }).first();
    if ((await page.getByRole('button', { name: /time slot 6:30am/i }).count()) === 0 && (await back.count())) {
      await back.click();
      await sleep(1500);
    }
    const regular = page.getByRole('button', { name: /time slot 6:30am/i }).first();
    if (await regular.count()) {
      await regular.click();
      log('clicked "Time Slot 6:30am-7am Departures"');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await sleep(1800);
      await record(page, 'regular-630-open');
      await dumpButtons(page, 'regular-630');
    } else {
      log('6:30am slot button not found after alpine view');
    }
  } catch (e) {
    log(`probe4 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe4 done');
  }
}

main();
