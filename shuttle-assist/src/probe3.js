// Development probe #3: load the results deep-link directly, set party size,
// switch to List view, and record slot rows. Read-only; never clicks Reserve.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe3-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(900 + Math.random() * 1100);

const DATE = process.argv[2] || '2026-07-07';
const NEXT = new Date(new Date(DATE + 'T12:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
const PARTY = 2;

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
    peopleCapacityCategoryCounts: `[[-32767,null,${PARTY},null]]`,
    searchTime: new Date().toISOString().slice(0, 23),
    flexibleSearch: '[false,false,null,1]',
  });
  return `https://reservation.pc.gc.ca/create-booking/results?${q}`;
}

let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true }).catch((e) => log(`shot fail: ${e.message}`));
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
    log(`recorded ${tag} | url=${page.url().slice(0, 120)} | aria=${snap.length}`);
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
    log(`deep link: ${deepLink()}`);
    await page.goto(deepLink(), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await pause();
    const consent = page.getByRole('button', { name: /i consent/i });
    if (await consent.count()) { await consent.click(); log('consented'); await pause(); }
    await record(page, 'deeplink-results');

    // Verify party size took effect.
    const party = page.getByRole('spinbutton', { name: /party size/i });
    if (await party.count()) log(`party size shows: ${await party.first().inputValue().catch(() => '?')}`);

    // Switch to list view.
    const listRadio = page.getByRole('radio', { name: /list view of results/i });
    if (await listRadio.count()) {
      await listRadio.first().click();
      log('switched to List view');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await sleep(2000);
    }
    await record(page, 'list-view');

    // Log all links/buttons/rows that look like locations or time slots.
    for (const role of ['link', 'button', 'radio', 'tab', 'listitem', 'row', 'gridcell']) {
      const els = page.getByRole(role);
      const n = await els.count();
      const names = [];
      for (let i = 0; i < Math.min(n, 60); i++) {
        const t = ((await els.nth(i).getAttribute('aria-label').catch(() => null)) ||
          (await els.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
        if (t) names.push(t.slice(0, 90));
      }
      if (n) log(`role=${role} (${n}): ${JSON.stringify(names)}`);
    }

    // Try to open the Lake Louise shuttle location if list view shows locations.
    const ll = page.getByText(/lake louise\s*-\s*shuttle/i).first();
    if (await ll.count()) {
      await ll.click();
      log('clicked "Lake Louise - Shuttle" entry');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await sleep(2000);
      await record(page, 'lake-louise-slots');
      const times = await page.getByText(/\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)/i).allInnerTexts().catch(() => []);
      log(`time-like texts (${times.length}): ${JSON.stringify([...new Set(times)].slice(0, 50))}`);
    } else {
      log('no "Lake Louise - Shuttle" text found in list view');
    }
  } catch (e) {
    log(`probe3 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe3 done');
  }
}

main();
