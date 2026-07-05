// Development probe #2: consent -> select shuttle -> date -> party size -> Search,
// then record the results page structure. Read-only; never clicks Reserve.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe2-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(700 + Math.random() * 1000);

const PROBE_DATE = process.argv[2] || '2026-07-07';
const PARTY = 2;

let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: path.join(outDir, `${tag}.png`) }).catch((e) => log(`shot fail ${tag}: ${e.message}`));
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
    log(`recorded ${tag} | url=${page.url()} | aria=${snap.length}`);
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
    await page.goto('https://reservation.pc.gc.ca/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await pause();

    const consent = page.getByRole('button', { name: /i consent/i });
    if (await consent.count()) {
      await consent.click();
      log('clicked I Consent');
      await pause();
    }
    await record(page, 'home-consented');

    await page.getByText(/day.?use/i).first().click();
    await pause();
    const shuttleRadio = page.getByRole('radio', { name: /shuttle to lake louise/i });
    if (await shuttleRadio.count()) {
      await shuttleRadio.check().catch(async () => shuttleRadio.click());
      log('selected shuttle radio');
    } else {
      await page.getByText(/shuttle to lake louise and moraine lake/i).first().click();
      log('clicked shuttle text (no radio role found)');
    }
    await pause();
    await record(page, 'shuttle-selected');

    // Open the date field and pick the probe date.
    const human = DateTime.fromISO(PROBE_DATE).toFormat('MMMM d, yyyy'); // e.g. "July 7, 2026"
    const dateField = page.getByLabel(/date/i).first();
    await dateField.click();
    await pause();
    const dayBtn = page.getByRole('button', { name: human });
    await dayBtn.click();
    log(`picked date ${human}`);
    await pause();
    await record(page, 'date-picked');

    // Party size stepper: find +/- buttons; log their accessible names first.
    const btns = page.getByRole('button');
    const n = await btns.count();
    const names = [];
    for (let i = 0; i < n; i++) {
      const name = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
        (await btns.nth(i).innerText().catch(() => ''))).trim();
      if (name) names.push(name.slice(0, 60));
    }
    log(`buttons on page: ${JSON.stringify(names)}`);

    const plus = page.getByRole('button', { name: /(add|increase|plus|more).*(person|people|party|guest)|^\+$/i }).first();
    if (await plus.count()) {
      for (let i = 1; i < PARTY; i++) { await plus.click(); await sleep(300); }
      log(`party size set to ${PARTY} via stepper`);
    } else {
      log('no plus button matched — inspect button list above');
    }
    await record(page, 'party-set');

    await page.getByRole('button', { name: /search/i }).first().click();
    log('clicked Search');
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await sleep(2500);
    await record(page, 'results');
    log(`results url: ${page.url()}`);

    // If there is a list-view toggle, use it and re-record.
    const listToggle = page.getByRole('button', { name: /list/i }).first();
    if (await listToggle.count()) {
      await listToggle.click().catch(() => {});
      await sleep(1500);
      await record(page, 'results-list');
      log(`list url: ${page.url()}`);
    }

    // Log anything that looks like a departure time row.
    const times = await page.getByText(/\b\d{1,2}:\d{2}\s*(am|pm)\b/i).allInnerTexts().catch(() => []);
    log(`time-like texts (${times.length}): ${JSON.stringify(times.slice(0, 40))}`);
  } catch (e) {
    log(`probe2 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe2 done');
  }
}

main();
