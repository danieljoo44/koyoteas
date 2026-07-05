// Site interaction steps for reservation.pc.gc.ca (Day Use -> Lake Louise &
// Moraine Lake shuttles). All selectors are role/label/text based and were
// verified against the live site on 2026-07-05 (see runs/probe*).
//
// Verified page model:
//   results list:  buttons "Time Slot 6:30am-7am Departures Available",
//                  "Time Slot 5am Alpine Start Departure Available", ...
//   slot table:    rows "Lake Louise: 6:30am-7am", "Lake Louise: 6:30am-7am
//                  (Last Minute)", "Moraine Lake: ...", "Alpine Start -
//                  Moraine Lake: 5am"; columns are dates starting at the
//                  searched date; cell name = "<row name> <status>".
//   reserve step:  click Available cell -> "Reserve" button appears ->
//                  "Park Alerts" dialog ("Acknowledge") -> review page at
//                  /create-booking/reservationmessages ("Review Reservation
//                  Details", checkbox, "Confirm reservation details").
//   too early:     alert "Reserving these dates is not yet allowed. These
//                  dates cannot be reserved until <date> at <time>."
import { DateTime } from 'luxon';
import { sleep, humanPause } from './humanize.js';

export const SITE_HOME = 'https://reservation.pc.gc.ca/';
export const REVIEW_PATH = '/create-booking/reservationmessages';

export function resultsDeepLink(cfg, dateISO) {
  const next = DateTime.fromISO(dateISO).plus({ days: 1 }).toISODate();
  const q = new URLSearchParams({
    transactionLocationId: '-2147483647',
    resourceLocationId: '-2147483642',
    mapId: '-2147483634',
    searchTabGroupId: '3',
    bookingCategoryId: '9',
    startDate: dateISO,
    endDate: next,
    nights: '1',
    isReserving: 'true',
    peopleCapacityCategoryCounts: `[[-32767,null,${cfg.partySize},null]]`,
    searchTime: DateTime.now().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"),
    flexibleSearch: '[false,false,null,1]',
  });
  return `${SITE_HOME}create-booking/results?${q}`;
}

// Dismiss cookie-consent and "Park Alerts" interstitials wherever they pop up.
// These are informational (parking rules etc.), not terms/payment consents.
export async function dismissInterstitials(page, log) {
  for (let i = 0; i < 5; i++) {
    const btn = page.getByRole('button', { name: /^(i consent|acknowledge)$/i }).first();
    if (await btn.count()) {
      const name = (await btn.innerText().catch(() => '')).trim();
      await btn.click().catch(() => {});
      log(`dismissed interstitial ("${name}")`);
      await sleep(700);
    } else {
      return;
    }
  }
}

export async function isSignedIn(page) {
  return (await page.getByRole('button', { name: /sign in to your account/i }).count()) === 0;
}

export async function ensureListView(page, log) {
  const radio = page.getByRole('radio', { name: /list view of results/i }).first();
  if (!(await radio.count())) return false;
  const checked = await radio.getAttribute('aria-checked').catch(() => null);
  if (checked !== 'true') {
    await radio.click();
    log('switched results to List view');
    await sleep(1500);
  }
  return true;
}

// Return to the slot list from a slot's chart view.
export async function backToList(page, log) {
  if (await ensureListView(page, log)) {
    const anySlot = page.getByRole('button', { name: /^time slot /i }).first();
    if (await anySlot.count()) return true;
  }
  const back = page.getByRole('button', { name: /view previous map/i }).first();
  if (await back.count()) {
    await back.click();
    await sleep(1500);
    await ensureListView(page, log);
    return (await page.getByRole('button', { name: /^time slot /i }).count()) > 0;
  }
  return false;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// List all "Time Slot ..." buttons with parsed start times (minutes from midnight).
export async function listSlotButtons(page) {
  const btns = page.getByRole('button', { name: /^time slot /i });
  const out = [];
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const name = ((await btns.nth(i).getAttribute('aria-label').catch(() => null)) ||
      (await btns.nth(i).innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
    const label = name.replace(/^Time Slot\s*/i, '').replace(/\s*(Available|Unavailable|Restrictions|Not Operating|Held in Cart)\s*$/i, '');
    const m = label.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)/i);
    let minutes = null;
    if (m) {
      let h = parseInt(m[1], 10) % 12;
      if (/pm/i.test(m[3])) h += 12;
      minutes = h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    }
    out.push({ index: i, name, label, minutes, isAlpine: /alpine/i.test(label) });
  }
  return out;
}

// Open a slot's availability table from the list view. slotLabel matches by
// substring, e.g. "6:30am-7am Departures".
export async function openSlot(page, slotLabel, log) {
  const btn = page.getByRole('button', { name: new RegExp(`^Time Slot\\s+${escapeRe(slotLabel)}`, 'i') }).first();
  if (!(await btn.count())) return false;
  await humanPause(250, 600);
  await btn.click();
  const table = page.getByRole('table').first();
  try {
    await table.waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    log(`opened "${slotLabel}" but no availability table appeared`);
    return false;
  }
  await sleep(600);
  return true;
}

// Read the slot table: which column is the target date, and per-row status there.
export async function scanSlotTable(page, targetISO, log) {
  const target = DateTime.fromISO(targetISO);
  const headerWanted = target.toFormat('ccc, LLL d'); // e.g. "Mon, Jul 13"
  const table = page.getByRole('table').first();
  if (!(await table.count())) return { error: 'no table' };

  const headers = table.getByRole('columnheader');
  const nH = await headers.count();
  let dateIdx = -1;
  const headerNames = [];
  for (let i = 0; i < nH; i++) {
    const h = ((await headers.nth(i).getAttribute('aria-label').catch(() => null)) ||
      (await headers.nth(i).innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
    headerNames.push(h);
    if (dateIdx === -1 && h.startsWith(headerWanted)) dateIdx = i;
  }
  if (dateIdx === -1) {
    return { error: `target date column "${headerWanted}" not found in [${headerNames.join(' | ')}]` };
  }

  const rows = table.getByRole('row');
  const nR = await rows.count();
  const out = [];
  for (let i = 0; i < nR; i++) {
    const cells = rows.nth(i).getByRole('cell');
    const nC = await cells.count();
    if (nC <= dateIdx) continue;
    const rowName = ((await cells.nth(0).getAttribute('aria-label').catch(() => null)) ||
      (await cells.nth(0).innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
    if (!rowName) continue;
    const cell = cells.nth(dateIdx);
    const cellName = ((await cell.getAttribute('aria-label').catch(() => null)) ||
      (await cell.innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
    const status = cellName.startsWith(rowName) ? cellName.slice(rowName.length).trim() : cellName;
    out.push({
      rowName,
      status: status || 'Unknown',
      lastMinute: /\(last minute\)/i.test(rowName),
      cell,
    });
  }
  return { rows: out, headerNames };
}

// Order candidate rows: destination priority first, and within a destination
// the "(Last Minute)" row first — that is the bucket the 2-day release fills.
// Rows that match none of the configured destinations are never booked.
export function pickRows(rows, destinationPriority) {
  const rank = (r) => destinationPriority.findIndex((dest) => r.rowName.toLowerCase().includes(dest.toLowerCase()));
  return rows
    .filter((r) => /^Available$/i.test(r.status) && rank(r) !== -1)
    .sort((a, b) => (rank(a) * 2 + (a.lastMinute ? 0 : 1)) - (rank(b) * 2 + (b.lastMinute ? 0 : 1)));
}

export async function tooEarlyAlert(page) {
  const alerts = page.getByRole('alert');
  const n = await alerts.count();
  for (let i = 0; i < n; i++) {
    const t = (await alerts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (/not yet allowed|cannot be reserved until/i.test(t)) return t;
  }
  return null;
}

export async function clearAlerts(page) {
  await page.keyboard.press('Escape').catch(() => {});
  const close = page.getByRole('alert').getByRole('button', { name: /close|dismiss/i }).first();
  if (await close.count()) await close.click().catch(() => {});
}

// How many items the header cart shows (0 when it just says "Cart").
export async function cartItemCount(page) {
  const cart = page.getByRole('button', { name: /view shopping cart/i }).first();
  if (!(await cart.count())) return 0;
  const text = (await cart.innerText().catch(() => '')).replace(/\s+/g, ' ');
  const m = text.match(/(\d+)\s*item/i);
  return m ? parseInt(m[1], 10) : 0;
}

// Click an Available cell and wait for one of the known outcomes.
// The release-gate alert can render AFTER the Reserve button does, so an
// unarmed dry run passes graceMs to wait it out before declaring success;
// the real morning uses graceMs=0 because clickReserve resolves the truth
// without losing time.
// Returns: 'reserve-visible' | 'too-early' | 'nothing' | 'stale'
export async function selectCell(page, row, log, graceMs = 0) {
  await humanPause(250, 600);
  try {
    await row.cell.click({ timeout: 8000 });
  } catch (e) {
    log(`cell click failed (${e.message.split('\n')[0]}) — table needs a refresh`);
    return 'stale';
  }
  const reserveBtn = page.getByRole('button', { name: /^reserve$/i }).first();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const early = await tooEarlyAlert(page);
    if (early) {
      log(`site says: ${early}`);
      return 'too-early';
    }
    if (await reserveBtn.count()) {
      try {
        if (await reserveBtn.isVisible()) {
          const graceEnd = Date.now() + graceMs;
          while (Date.now() < graceEnd) {
            const lateAlert = await tooEarlyAlert(page);
            if (lateAlert) {
              log(`site says (late): ${lateAlert}`);
              return 'too-early';
            }
            await sleep(200);
          }
          return 'reserve-visible';
        }
      } catch {}
    }
    await sleep(250);
  }
  return 'nothing';
}

// Click Reserve and follow through to the review page (cart hold secured).
// Returns: 'held' | 'too-early' | 'gone' | 'stuck'
export async function clickReserve(page, log) {
  const reserveBtn = page.getByRole('button', { name: /^reserve$/i }).first();
  await humanPause(200, 500);
  try {
    await reserveBtn.click({ timeout: 8000 });
  } catch (e) {
    log(`Reserve click failed (${e.message.split('\n')[0]})`);
    return 'gone';
  }
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    await dismissInterstitials(page, log);
    if (page.url().includes(REVIEW_PATH)) return 'held';
    if (await page.getByRole('heading', { name: /review reservation details/i }).count()) return 'held';
    const early = await tooEarlyAlert(page);
    if (early) {
      log(`site says: ${early}`);
      return 'too-early';
    }
    const alerts = page.getByRole('alert');
    for (let i = 0; i < (await alerts.count()); i++) {
      const t = (await alerts.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/no longer available|sold out|not available/i.test(t)) {
        log(`site says: ${t}`);
        return 'gone';
      }
    }
    await sleep(400);
  }
  return 'stuck';
}

// Refresh availability data in place via the persistent search widget.
export async function refetchAvailability(page, log) {
  const search = page.getByRole('button', { name: /search for availability/i }).first();
  if (await search.count()) {
    await search.click();
    await sleep(1800);
    return true;
  }
  return false;
}

// On the review page: tick the details checkbox and click "Confirm
// reservation details" — one step further toward checkout, nothing entered.
export async function advanceReviewPage(page, log) {
  try {
    const box = page.getByRole('checkbox').first();
    if (await box.count()) {
      await humanPause(300, 700);
      await box.check().catch(async () => box.click());
      log('checked "All reservation details are correct."');
    }
    const confirm = page.getByRole('button', { name: /confirm reservation details/i }).first();
    if (await confirm.count()) {
      await humanPause(300, 700);
      await confirm.click();
      log('clicked "Confirm reservation details" — the next page is yours');
      await sleep(3000);
      return true;
    }
  } catch (e) {
    log(`could not advance past review page (${e.message}) — take over from the review page`);
  }
  return false;
}
