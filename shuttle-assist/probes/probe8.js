// Development probe #8: acknowledge the park-alerts dialog, record the cart
// page structure, then RELEASE the held item so no inventory is hoarded.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe8-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(outDir, { recursive: true });
const logFile = path.join(outDir, 'probe.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true }).catch(() => {});
  try {
    const snap = await page.locator('body').ariaSnapshot();
    fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
    log(`recorded ${tag} | url=${page.url().slice(0, 90)} | aria=${snap.length}`);
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
  page.setDefaultTimeout(15000);
  try {
    await page.goto('https://reservation.pc.gc.ca/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const consent = page.getByRole('button', { name: /i consent/i });
    if (await consent.count()) { await consent.click(); await sleep(1000); }
    const ack = page.getByRole('button', { name: /acknowledge/i });
    if (await ack.count()) { await ack.click(); log('acknowledged park alerts'); await sleep(1000); }
    await record(page, 'home');

    // Open the cart (accessible name may vary with item count).
    const cart = page.getByRole('button', { name: /cart/i }).last();
    log(`cart control name: "${await cart.getAttribute('aria-label').catch(() => '')}" text: "${(await cart.innerText().catch(() => '')).replace(/\s+/g, ' ')}"`);
    await cart.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await record(page, 'cart-page');
    log(`cart url: ${page.url()}`);
    const bodyText = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
    log(`cart text: ${JSON.stringify(bodyText.slice(0, 900))}`);

    // Release the hold.
    const remove = page.getByRole('button', { name: /remove|delete|trash/i }).first();
    if (await remove.count()) {
      log(`remove control: "${await remove.getAttribute('aria-label').catch(() => '')}"`);
      await remove.click();
      await sleep(1500);
      await record(page, 'after-remove-click');
      const confirm = page.getByRole('button', { name: /^(yes|ok|confirm|remove)/i }).first();
      if (await confirm.count()) { await confirm.click().catch(() => {}); log('confirmed removal'); }
      await sleep(1500);
      await record(page, 'cart-cleared');
      const after = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
      log(`cart after removal: ${JSON.stringify(after.slice(0, 400))}`);
    } else {
      log('no remove control found — dumping buttons');
      const btns = page.getByRole('button');
      const names = [];
      for (let i = 0; i < (await btns.count()); i++) {
        const t = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
          (await btns.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
        if (t) names.push(t.slice(0, 90));
      }
      log(`buttons: ${JSON.stringify(names)}`);
    }
  } catch (e) {
    log(`probe8 error: ${e.stack || e.message}`);
    await record(page, 'error');
  } finally {
    await record(page, 'final');
    await browser.close();
    log('probe8 done');
  }
}

main();
