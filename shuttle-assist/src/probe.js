// One-time development probe: walks the public booking flow slowly and records
// what the pages actually look like (URLs, roles, labels) so the real tool can
// use verified selectors. Read-only — it never clicks Reserve.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });

const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(800 + Math.random() * 1200);

const PROBE_DATE = process.argv[2] || '2026-07-07'; // a date whose 2-day release already happened

let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  try {
    await page.screenshot({ path: path.join(outDir, `${tag}.png`) });
  } catch (e) {
    log(`screenshot failed at ${tag}: ${e.message}`);
  }
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
    log(`recorded ${tag} | url=${page.url()} | aria=${snap.length} chars`);
  } catch (e) {
    log(`aria snapshot failed at ${tag}: ${e.message}`);
  }
}

async function main() {
  log(`probe start, availability date ${PROBE_DATE}, output ${outDir}`);
  let browser;
  const profileDir = path.join(root, '.profile');
  try {
    browser = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless: false,
      viewport: { width: 1440, height: 900 },
    });
    log('launched headed Chrome');
  } catch (e) {
    log(`headed launch failed (${e.message}); trying headless`);
    browser = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless: true,
      viewport: { width: 1440, height: 900 },
    });
  }
  const page = browser.pages()[0] || (await browser.newPage());
  page.setDefaultTimeout(20000);

  try {
    await page.goto('https://reservation.pc.gc.ca/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await pause();
    await record(page, 'home');

    // Find the Day Use entry point, trying roles in order of specificity.
    const dayUseCandidates = [
      page.getByRole('tab', { name: /day.?use/i }),
      page.getByRole('link', { name: /day.?use/i }),
      page.getByRole('button', { name: /day.?use/i }),
      page.getByText(/day.?use/i),
    ];
    let clicked = false;
    for (const [i, loc] of dayUseCandidates.entries()) {
      const n = await loc.count();
      log(`day-use candidate #${i}: ${n} match(es)`);
      if (n > 0 && !clicked) {
        await loc.first().click();
        clicked = true;
        log(`clicked day-use candidate #${i}`);
      }
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await pause();
    await record(page, 'after-day-use');

    // Look for anything mentioning shuttles.
    const shuttleTexts = await page.getByText(/shuttle/i).allInnerTexts().catch(() => []);
    log(`shuttle-related texts: ${JSON.stringify(shuttleTexts.slice(0, 12))}`);
    const shuttle = page.getByText(/shuttle to lake louise and moraine lake/i).first();
    if (await shuttle.count()) {
      await shuttle.click();
      log('clicked "Shuttle to Lake Louise and Moraine Lake"');
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await pause();
    }
    await record(page, 'after-shuttle-select');

    // Inventory the search form.
    for (const role of ['combobox', 'textbox', 'spinbutton', 'button', 'radio', 'checkbox']) {
      const els = page.getByRole(role);
      const n = await els.count();
      const names = [];
      for (let i = 0; i < Math.min(n, 25); i++) {
        const el = els.nth(i);
        const name = (await el.getAttribute('aria-label').catch(() => null)) ||
          (await el.innerText().catch(() => '')) || '';
        names.push(name.trim().slice(0, 60));
      }
      log(`role=${role}: ${n} -> ${JSON.stringify(names)}`);
    }

    // Best-effort: set park, date, party size, then search.
    const park = page.getByRole('combobox').filter({ hasText: /park|banff/i }).first();
    const parkByLabel = page.getByLabel(/park/i).first();
    const parkTarget = (await parkByLabel.count()) ? parkByLabel : park;
    if (await parkTarget.count()) {
      const tagName = await parkTarget.evaluate((el) => el.tagName).catch(() => '?');
      log(`park control tag: ${tagName}`);
      if (tagName === 'SELECT') {
        await parkTarget.selectOption({ label: /Banff/ }).catch(async () => {
          const opts = await parkTarget.locator('option').allInnerTexts();
          log(`park options: ${JSON.stringify(opts)}`);
        });
      } else {
        await parkTarget.click().catch((e) => log(`park click failed: ${e.message}`));
        await pause();
        await record(page, 'park-open');
        const opt = page.getByRole('option', { name: /banff/i }).first();
        if (await opt.count()) { await opt.click(); log('picked Banff park option'); }
      }
      await pause();
    } else {
      log('no park control found');
    }

    const dateBox = page.getByLabel(/date/i).first();
    if (await dateBox.count()) {
      log('found date control by label');
      await dateBox.click().catch(() => {});
      await pause();
      await record(page, 'date-open');
    } else {
      log('no date control found by label');
    }

    await record(page, 'form-state');

    const searchBtn = page.getByRole('button', { name: /^search$/i }).first();
    if (await searchBtn.count()) {
      log('search button present (not clicking blind — form may be incomplete)');
    }
    log(`final url: ${page.url()}`);
  } catch (e) {
    log(`probe error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe done');
  }
}

main();
