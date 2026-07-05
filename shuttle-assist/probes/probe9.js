// Find the cart-item remove control and release the stale dev hold.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe9-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(outDir, 'probe.log'), l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launchPersistentContext(path.join(root, '.profile'), { channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 } });
const page = browser.pages()[0] || (await browser.newPage());
page.setDefaultTimeout(12000);
try {
  await page.goto('https://reservation.pc.gc.ca/create-booking/reservationmessages', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  for (let i = 0; i < 4; i++) {
    const d = page.getByRole('button', { name: /acknowledge|i consent/i }).first();
    if (await d.count()) { await d.click().catch(() => {}); await sleep(800); } else break;
  }
  const snap = await page.locator('body').ariaSnapshot().catch(() => '');
  fs.writeFileSync(path.join(outDir, 'review.aria.txt'), snap);
  log(`review page aria saved (${snap.length} chars)`);
  const text = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
  log(`page text: ${JSON.stringify(text.slice(0, 300))}`);
  // Dump every interactive element incl. icon-only ones.
  const info = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, [role="button"], [role="link"]')];
    return els.map((e) => ({
      tag: e.tagName,
      text: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      aria: e.getAttribute('aria-label'),
      cls: (e.className || '').toString().slice(0, 80),
      title: e.getAttribute('title'),
    })).filter((x) => x.text || x.aria || x.title);
  });
  log(JSON.stringify(info, null, 1));
} catch (e) {
  log(`error: ${e.message}`);
} finally {
  await browser.close();
  log('done');
}
