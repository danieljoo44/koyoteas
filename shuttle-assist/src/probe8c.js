// Cleanup: release the held item via "Edit this reservation" or any remove path.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'runs', `probe8c-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });
const log = (m) => { const l = `[${new Date().toISOString()}] ${m}`; console.log(l); fs.appendFileSync(path.join(outDir, 'probe.log'), l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let step = 0;
async function record(page, name) {
  step++;
  const tag = `${String(step).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: path.join(outDir, `${tag}.png`), fullPage: true }).catch(() => {});
  const snap = await page.locator('body').ariaSnapshot().catch(() => '');
  fs.writeFileSync(path.join(outDir, `${tag}.aria.txt`), snap);
  log(`recorded ${tag} | aria=${snap.length} | url=${page.url().slice(0, 90)}`);
}
async function ackAll(page) {
  for (let i = 0; i < 4; i++) {
    const ack = page.getByRole('button', { name: /acknowledge|i consent/i }).first();
    if (await ack.count()) { await ack.click().catch(() => {}); await sleep(900); } else break;
  }
}
const browser = await chromium.launchPersistentContext(path.join(root, '.profile'), { channel: 'chrome', headless: false, viewport: { width: 1440, height: 900 } });
const page = browser.pages()[0] || (await browser.newPage());
page.setDefaultTimeout(15000);
try {
  await page.goto('https://reservation.pc.gc.ca/create-booking/reservationmessages', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  await ackAll(page);
  await record(page, 'review');
  const edit = page.getByRole('button', { name: /edit this reservation/i }).first();
  if (await edit.count()) {
    await edit.click();
    await sleep(2500);
    await ackAll(page);
    await record(page, 'after-edit');
    const btns = page.getByRole('button');
    const names = [];
    for (let i = 0; i < (await btns.count()); i++) {
      const t = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) || (await btns.nth(i).innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
      if (t) names.push(t.slice(0, 90));
    }
    log(`buttons after edit: ${JSON.stringify(names)}`);
    const text = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/\s+/g, ' ');
    log(`text: ${JSON.stringify(text.slice(0, 700))}`);
    const remove = page.getByRole('button', { name: /remove|delete|cancel this|release/i }).first();
    if (await remove.count()) {
      log(`clicking: "${(await remove.innerText().catch(() => '')) || (await remove.getAttribute('aria-label'))}"`);
      await remove.click();
      await sleep(1500);
      const confirm = page.getByRole('button', { name: /^(yes|ok|confirm|remove|delete)/i }).first();
      if (await confirm.count()) await confirm.click().catch(() => {});
      await sleep(1500);
      await record(page, 'after-remove');
    }
  }
  const cartTxt = (await page.getByRole('button', { name: /view shopping cart/i }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  log(`cart control now: "${cartTxt}"`);
} catch (e) {
  log(`error: ${e.stack || e.message}`);
  await record(page, 'error');
} finally {
  await record(page, 'final');
  await browser.close();
  log('done');
}
