// Read-only: what does the Sign in page offer?
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe10-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(outDir, 'probe.log'), l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launchPersistentContext(path.join(root, '.profile'), { channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 } });
const page = browser.pages()[0] || (await browser.newPage());
page.setDefaultTimeout(15000);
try {
  await page.goto('https://reservation.pc.gc.ca/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  for (let i = 0; i < 3; i++) {
    const d = page.getByRole('button', { name: /acknowledge|i consent/i }).first();
    if (await d.count()) { await d.click().catch(() => {}); await sleep(800); } else break;
  }
  await page.getByRole('button', { name: /sign in to your account/i }).first().click();
  await sleep(3000);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  log(`url after Sign in click: ${page.url()}`);
  await page.screenshot({ path: path.join(outDir, 'signin.png'), fullPage: true });
  const snap = await page.locator('body').ariaSnapshot().catch(() => '');
  fs.writeFileSync(path.join(outDir, 'signin.aria.txt'), snap);
  const text = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
  log(`page text: ${JSON.stringify(text.slice(0, 1500))}`);
} catch (e) {
  log(`error: ${e.message}`);
} finally {
  await browser.close();
  log('done');
}
