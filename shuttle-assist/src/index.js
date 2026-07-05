#!/usr/bin/env node
// shuttle-assist — personal reservation assist for the Parks Canada
// Lake Louise / Moraine Lake shuttle.
//
//   node src/index.js run                              the real morning
//   node src/index.js dry-run --date=YYYY-MM-DD        rehearsal (stops before Reserve)
//   node src/index.js dry-run --date=... --armed       rehearsal incl. a real cart hold
//   node src/index.js login                            sign in ahead of time
//   node src/index.js test-alert                       test alarm sound + phone notification
//
// Guardrails (by design, not by option):
//   - one reservation path, then full stop (state.json refuses re-runs)
//   - polite polling only (config enforces >= 2s between cycles)
//   - never touches CAPTCHAs, queues/waiting rooms, payment, or personal info
//   - anything unexpected -> stop + alarm + phone notification
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { DateTime } from 'luxon';

import { loadConfig, releaseMoment, describeMoment } from './config.js';
import { syncClock } from './clock.js';
import { sendNotification } from './notify.js';
import { startAlarm, stopAlarm, chirp, alarmActive } from './alarm.js';
import { createRunLog } from './logger.js';
import { classifyPage } from './guards.js';
import { sleep, jitterMs, humanPause } from './humanize.js';
import * as flow from './flow.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STATE_PATH = path.join(ROOT, 'state.json');
const PROFILE_DIR = path.join(ROOT, '.profile');

// ---------- CLI ----------
const argv = process.argv.slice(2);
const mode = argv[0];
const flagVal = (name) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : null;
};
const hasFlag = (name) => argv.includes(`--${name}`);

// ---------- shared state ----------
const ctx = {
  cfg: null,
  log: console.log,
  shot: async () => {},
  page: null,
  browser: null,
  clockOffsetMs: 0,
  paused: false,
  stopping: false,
  handoff: false,
  armed: true,
  enterWaiters: [],
};
const trueNow = () => Date.now() + ctx.clockOffsetMs;

// ---------- keyboard ----------
function setupKeyboard() {
  if (!process.stdin.isTTY) {
    ctx.log('note: no interactive terminal detected — pause key disabled, prompts auto-continue');
    return;
  }
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    if (alarmActive()) {
      stopAlarm();
      ctx.log('alarm silenced');
    }
    if (key.name === 'return' || key.name === 'enter') {
      const w = ctx.enterWaiters.splice(0);
      w.forEach((fn) => fn());
      return;
    }
    if ((key.ctrl && key.name === 'c') || key.name === 'q') {
      requestQuit();
    } else if (key.name === 'p') {
      ctx.paused = !ctx.paused;
      ctx.log(ctx.paused
        ? '*** PAUSED — automation halted. Press "p" to resume, "q" to quit. ***'
        : '*** RESUMED ***');
    } else if (key.name === 's' && ctx.page) {
      ctx.shot(ctx.page, 'manual').catch(() => {});
    }
  });
}

function requestQuit() {
  if (ctx.stopping) process.exit(0);
  ctx.stopping = true;
  stopAlarm();
  ctx.log('quit requested — shutting down');
  (async () => {
    try { if (ctx.browser) await ctx.browser.close(); } catch {}
    process.exit(0);
  })();
}

async function pauseGate() {
  while (ctx.paused && !ctx.stopping) await sleep(200);
  if (ctx.stopping) throw new Error('stopped by user');
}

function waitForEnter(promptText) {
  ctx.log(promptText);
  if (!process.stdin.isTTY) {
    ctx.log('(non-interactive terminal: continuing automatically in 5s)');
    return sleep(5000);
  }
  return new Promise((resolve) => ctx.enterWaiters.push(resolve));
}

// ---------- state (one and done) ----------
const readState = () => {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { return null; }
};
const writeState = (obj) => fs.writeFileSync(STATE_PATH, JSON.stringify({ ...obj, at: new Date().toISOString() }, null, 2));

// ---------- halt & handoff ----------
async function haltAndAlert(title, message, { alarm = true } = {}) {
  ctx.log('');
  ctx.log('='.repeat(72));
  ctx.log(`YOUR TURN >>> ${title}`);
  ctx.log(message);
  ctx.log('The browser window is yours now. Automation has fully stopped.');
  ctx.log('Press any key to silence the alarm; press "q" ONLY when you are done in the browser (quitting closes it).');
  ctx.log('='.repeat(72));
  if (ctx.page) await ctx.shot(ctx.page, 'handoff');
  if (alarm && process.stdin.isTTY) startAlarm(title);
  else if (alarm) ctx.log('(non-interactive terminal: alarm sound skipped)');
  await sendNotification(ctx.cfg.notify, title, message, ctx.log);
}

// ---------- browser ----------
async function launchBrowser() {
  ctx.browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1440, height: 900 },
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  ctx.page = ctx.browser.pages()[0] || (await ctx.browser.newPage());
  ctx.page.setDefaultTimeout(15000);
}

async function guardCheck(where) {
  const g = await classifyPage(ctx.page);
  if (g.kind === 'ok') return true;
  if (g.kind === 'unknown') {
    ctx.log(`guard: page unreadable at ${where} — continuing carefully`);
    return true;
  }
  const titles = {
    queue: 'Waiting room / queue detected',
    captcha: 'CAPTCHA detected',
    error: 'Unexpected error page',
  };
  await haltAndAlert(
    titles[g.kind] || 'Unexpected page',
    `At step "${where}": ${g.detail}. The tool never automates past this — please handle it in the browser window.`,
  );
  return false;
}

// ---------- waiting with countdown ----------
async function waitUntilEpochMs(targetMs, label) {
  let resynced = false;
  for (;;) {
    if (ctx.stopping) throw new Error('stopped by user');
    const rem = targetMs - trueNow();
    if (rem <= 0) break;
    if (!resynced && rem < 150000) {
      resynced = true;
      const { offsetMs } = await syncClock(ctx.log);
      ctx.clockOffsetMs = offsetMs;
      continue;
    }
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    process.stdout.write(`\r  ${label} in ${h ? `${h}h ` : ''}${m}m ${String(s).padStart(2, '0')}s   `);
    await sleep(Math.min(rem, rem > 600000 ? 30000 : rem > 60000 ? 5000 : 1000));
  }
  process.stdout.write('\n');
}

// ---------- phases ----------
async function phaseWarmup({ dateISO, promptLogin }) {
  const { cfg, log } = ctx;
  await launchBrowser();
  log('browser launched (headed Chrome, dedicated profile in .profile/)');

  await ctx.page.goto(flow.SITE_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ctx.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await flow.dismissInterstitials(ctx.page, log);
  if (!(await guardCheck('home page'))) return false;
  await ctx.shot(ctx.page, 'warmup-home');

  if (promptLogin) {
    if (await flow.isSignedIn(ctx.page)) {
      log('already signed in from a previous session — good');
    } else {
      chirp();
      await waitForEnter(
        '\n>>> In the Chrome window, click "Sign in" and log into your Parks Canada account.\n' +
        '>>> (The tool never sees or stores your password.)\n' +
        '>>> Press ENTER here when you are signed in.');
      await flow.dismissInterstitials(ctx.page, log);
      if (await flow.isSignedIn(ctx.page)) {
        log('sign-in confirmed');
      } else {
        log('WARNING: you still appear signed OUT. You can continue, but checkout will require login.');
        await waitForEnter('>>> Press ENTER to continue anyway (or sign in first, then ENTER).');
      }
    }
  }

  // A leftover held item silently blocks new Reserve clicks (verified during
  // development) — refuse to run until the cart is clean.
  const cartItems = await flow.cartItemCount(ctx.page);
  if (cartItems > 0) {
    await haltAndAlert(
      'Cart is not empty',
      `Your Parks Canada cart already holds ${cartItems} item(s), which blocks new reservations. ` +
      'Complete or abandon it (holds expire on their own after ~20 minutes), then restart the tool.');
    return false;
  }

  log(`pre-positioning: availability results for ${dateISO}, party of ${cfg.partySize}`);
  await ctx.page.goto(flow.resultsDeepLink(cfg, dateISO), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ctx.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await flow.dismissInterstitials(ctx.page, log);
  if (!(await guardCheck('results page'))) return false;
  await flow.ensureListView(ctx.page, log);
  await ctx.shot(ctx.page, 'warmup-results');

  const slots = await flow.listSlotButtons(ctx.page);
  log(`slot list (${slots.length}): ${slots.map((s) => s.label).join(' | ') || 'NONE FOUND'}`);
  if (slots.length === 0) {
    await haltAndAlert('Slot list is empty', 'The results page has no "Time Slot" entries — page layout may have changed. Check the browser window.');
    return false;
  }

  // Open the top-priority slot that exists and show its table.
  for (const wanted of cfg.slotPriority) {
    if (slots.some((s) => s.label.toLowerCase().startsWith(wanted.toLowerCase()))) {
      if (await flow.openSlot(ctx.page, wanted, log)) {
        ctx.currentSlot = wanted;
        log(`pre-opened slot table: "${wanted}"`);
        const scan = await flow.scanSlotTable(ctx.page, dateISO, log);
        if (scan.error) log(`table scan note: ${scan.error}`);
        else scan.rows.forEach((r) => log(`  ${r.rowName} -> ${r.status}`));
        await ctx.shot(ctx.page, 'warmup-slot-table');
        break;
      }
    } else {
      log(`note: slotPriority entry "${wanted}" not in today's slot list`);
    }
  }
  log('warm-up complete — everything pre-selected that can be pre-selected');
  return true;
}

async function gotoSlot(dateISO, slotLabel) {
  const { log } = ctx;
  if (ctx.currentSlot === slotLabel && (await ctx.page.getByRole('table').first().count())) return true;
  if (!(await flow.backToList(ctx.page, log))) {
    log('could not reach slot list — reloading results deep link');
    await ctx.page.goto(flow.resultsDeepLink(ctx.cfg, dateISO), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ctx.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await flow.dismissInterstitials(ctx.page, log);
    await flow.ensureListView(ctx.page, log);
  }
  const ok = await flow.openSlot(ctx.page, slotLabel, log);
  ctx.currentSlot = ok ? slotLabel : null;
  return ok;
}

// After a failed/blocked click the SPA can be left in a stuck selection
// state — refresh the availability data and force the slot table to reopen.
async function refreshTable(dateISO) {
  await flow.clearAlerts(ctx.page);
  await flow.refetchAvailability(ctx.page, ctx.log);
  ctx.currentSlot = null;
}

// One pass over a slot's table for the target date. Every disruptive outcome
// (gate alert, dead click, stale row) refreshes the table before the next
// candidate row is tried.
// Returns 'held' | 'dry-run-stop' | 'too-early' | 'none' | 'halt'
async function trySlot(dateISO, slotLabel) {
  const { cfg, log } = ctx;
  // In a dry run the release gate ("not yet allowed") is expected — skip past
  // it to test the rest of the flow. On the real morning it means "hold this
  // position and keep trying".
  const dryRunGateSkip = mode === 'dry-run';
  let skip = 0; // candidates already tried this pass
  for (let attempt = 0; attempt < 5; attempt++) {
    await pauseGate();
    if (!(await gotoSlot(dateISO, slotLabel))) {
      log(`slot "${slotLabel}" not openable right now`);
      return 'none';
    }
    const scan = await flow.scanSlotTable(ctx.page, dateISO, log);
    if (scan.error) {
      log(`scan "${slotLabel}": ${scan.error}`);
      return 'none';
    }
    if (attempt === 0) log(`"${slotLabel}": ${scan.rows.map((r) => `${r.rowName}=${r.status}`).join(' | ')}`);
    const candidates = flow.pickRows(scan.rows, cfg.destinationPriority);
    if (skip >= candidates.length) return 'none';
    const row = candidates[skip];

    const sel = await flow.selectCell(ctx.page, row, log, ctx.armed ? 0 : 1500);
    if (sel === 'too-early') {
      if (!dryRunGateSkip) {
        await flow.clearAlerts(ctx.page);
        return 'too-early';
      }
      log('(dry run: gate is closed for this row, as expected — moving on)');
      skip++;
      await refreshTable(dateISO);
      continue;
    }
    if (sel === 'nothing' || sel === 'stale') {
      if (sel === 'nothing') log(`clicked "${row.rowName}" but nothing happened — refreshing and trying next option`);
      skip++;
      await refreshTable(dateISO);
      continue;
    }

    // Reserve button is visible.
    if (!ctx.armed) {
      await ctx.shot(ctx.page, 'dryrun-reserve-visible');
      log(`DRY RUN SUCCESS: "${row.rowName}" is selectable and the Reserve button is up — stopping here (no hold taken).`);
      return 'dry-run-stop';
    }
    const res = await flow.clickReserve(ctx.page, log);
    if (res === 'held') {
      ctx.heldRow = row.rowName;
      return 'held';
    }
    if (res === 'too-early') {
      if (!dryRunGateSkip) {
        await flow.clearAlerts(ctx.page);
        return 'too-early';
      }
      skip++;
      await refreshTable(dateISO);
      continue;
    }
    if (res === 'gone') {
      log(`"${row.rowName}" was taken before the hold completed — trying next option`);
      skip++;
      await refreshTable(dateISO);
      continue;
    }
    if (res === 'stuck') {
      await haltAndAlert('Unexpected page after Reserve', 'The site did not land on the review page and showed no known message. Check the browser window — the reservation may or may not be held.');
      return 'halt';
    }
  }
  return 'none';
}

async function phasePoll({ dateISO }) {
  const { cfg, log } = ctx;
  const startedMs = trueNow();
  const deadlineMs = startedMs + cfg.pollMaxMinutes * 60000;
  let cycle = 0;

  while (!ctx.stopping) {
    await pauseGate();
    if (trueNow() > deadlineMs) {
      await haltAndAlert(
        'No slots found',
        `Polled for ${cfg.pollMaxMinutes} minutes after release without finding a bookable slot for ${dateISO}. Check the site manually — cancellations pop up through the day.`);
      return;
    }
    cycle++;

    if (!(await guardCheck(`poll cycle ${cycle}`))) return;
    await flow.dismissInterstitials(ctx.page, log);

    let sawTooEarly = false;
    let outcome = 'none';
    for (const slotLabel of cfg.slotPriority) {
      outcome = await trySlot(dateISO, slotLabel);
      if (outcome === 'held' || outcome === 'dry-run-stop' || outcome === 'halt') break;
      if (outcome === 'too-early') { sawTooEarly = true; break; }
    }

    if (outcome === 'none' && !sawTooEarly && cfg.fallbackToEarliest) {
      if (await flow.backToList(ctx.page, log)) {
        ctx.currentSlot = null;
        const all = await flow.listSlotButtons(ctx.page);
        const tried = cfg.slotPriority.map((s) => s.toLowerCase());
        const fallbacks = all
          .filter((s) => s.minutes !== null && !s.isAlpine)
          .filter((s) => !tried.some((t) => s.label.toLowerCase().startsWith(t)))
          .sort((a, b) => a.minutes - b.minutes)
          .slice(0, 4);
        for (const s of fallbacks) {
          outcome = await trySlot(dateISO, s.label);
          if (outcome === 'held' || outcome === 'dry-run-stop' || outcome === 'halt') break;
          if (outcome === 'too-early') { sawTooEarly = true; break; }
        }
      }
    }

    if (outcome === 'halt') return;
    if (outcome === 'held') {
      await onHeld(dateISO);
      return;
    }
    if (outcome === 'dry-run-stop') {
      chirp();
      await sendNotification(cfg.notify, '[DRY RUN] shuttle-assist rehearsal succeeded',
        `Reserve button reached for ${dateISO}. No hold was taken.`, log);
      log('dry run finished — browser stays open for inspection; press "q" to quit.');
      return;
    }

    const napMs = jitterMs(cfg.pollSecondsMin * 1000, cfg.pollSecondsMax * 1000);
    if (sawTooEarly) {
      log(`cycle ${cycle}: release gate still closed — next attempt in ${(napMs / 1000).toFixed(1)}s`);
    } else {
      log(`cycle ${cycle}: nothing bookable yet — refreshing in ${(napMs / 1000).toFixed(1)}s`);
    }
    await sleep(napMs);

    // Refresh availability data every cycle (the release gate may be
    // evaluated against fetched data, so stale tables cost seconds); a full
    // reload every 10th cycle in case the SPA got into a weird state.
    if (cycle % 10 === 0) {
      await ctx.page.goto(flow.resultsDeepLink(cfg, dateISO), { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await ctx.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await flow.dismissInterstitials(ctx.page, log);
      await flow.ensureListView(ctx.page, log);
      ctx.currentSlot = null;
      await ctx.shot(ctx.page, `poll-cycle-${cycle}`);
    } else {
      await flow.refetchAvailability(ctx.page, log);
    }
  }
}

async function onHeld(dateISO) {
  const { cfg, log } = ctx;
  ctx.handoff = true;
  if (mode === 'run') {
    writeState({ status: 'handoff', targetDate: cfg.targetDate, slot: ctx.heldRow });
  }
  log('');
  log(`*** HELD IN CART: ${ctx.heldRow} for ${dateISO} (party of ${cfg.partySize}) ***`);
  await ctx.shot(ctx.page, 'held-review-page');
  // Alert FIRST — the hold is time-limited, every second of your attention counts.
  await haltAndAlert(
    'Shuttle held — finish checkout NOW',
    `${ctx.heldRow} on ${dateISO} for ${cfg.partySize} is held in the cart. Complete sign-in/payment in the Chrome window before the hold expires.`);
  if (cfg.advancePastReview) {
    await flow.advanceReviewPage(ctx.page, log);
    await ctx.shot(ctx.page, 'after-review-advance');
    const g = await classifyPage(ctx.page);
    if (g.kind !== 'ok') log(`note: next page shows ${g.kind} (${g.detail}) — handle it manually, as planned`);
  }
  log('automation is DONE for good (one reservation, one run). The window is yours.');
}

// ---------- modes ----------
async function modeTestAlert() {
  ctx.cfg = loadConfig(path.join(ROOT, 'config.json'));
  const { log } = ctx;
  log('testing alarm sound for 4 seconds...');
  startAlarm('This is a test of the shuttle assist alarm');
  await sleep(4000);
  stopAlarm();
  log('testing phone notification...');
  const ok = await sendNotification(ctx.cfg.notify, 'shuttle-assist test', 'If you can read this on your phone, notifications work.', log);
  log(ok ? 'notification sent — check your phone' : 'notification NOT sent — check config.notify');
  process.exit(0);
}

async function modeLogin() {
  ctx.cfg = loadConfig(path.join(ROOT, 'config.json'));
  const runlog = createRunLog(ROOT, 'login');
  ctx.log = runlog.log;
  ctx.shot = runlog.shot;
  await launchBrowser();
  await ctx.page.goto(flow.SITE_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await flow.dismissInterstitials(ctx.page, ctx.log);
  ctx.log('sign in to your Parks Canada account in the Chrome window.');
  ctx.log('your session is saved to .profile/ so release morning starts signed in.');
  ctx.log('press "q" here when done.');
  await new Promise(() => {}); // until q
}

async function modeDryRun() {
  ctx.cfg = loadConfig(path.join(ROOT, 'config.json'));
  const dateISO = flagVal('date');
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    console.error('dry-run needs --date=YYYY-MM-DD (pick a date that has open availability, e.g. a weekday in late September/October)');
    process.exit(1);
  }
  ctx.armed = hasFlag('armed');
  const runlog = createRunLog(ROOT, `dryrun-${dateISO}`);
  ctx.log = runlog.log;
  ctx.shot = runlog.shot;
  const { log } = ctx;

  log(`DRY RUN against ${dateISO} — ${ctx.armed
    ? 'ARMED: this WILL hold a real seat in the cart; complete or abandon it afterwards!'
    : 'unarmed: stops right before the Reserve click, takes nothing'}`);
  const { offsetMs } = await syncClock(log);
  ctx.clockOffsetMs = offsetMs;

  if (!(await phaseWarmup({ dateISO, promptLogin: !hasFlag('no-login') }))) return;
  log('starting availability check immediately (dry run skips the release wait)');
  await phasePoll({ dateISO });
}

async function modeRun() {
  ctx.cfg = loadConfig(path.join(ROOT, 'config.json'));
  const cfg = ctx.cfg;
  const prior = readState();
  if (prior && !hasFlag('reset')) {
    console.error(`state.json says a run already reached "${prior.status}" for ${prior.targetDate} at ${prior.at}.`);
    console.error('This tool books exactly one reservation. If that attempt failed and you need to retry,');
    console.error('re-run with --reset (or delete state.json).');
    process.exit(1);
  }
  if (prior && hasFlag('reset')) fs.rmSync(STATE_PATH, { force: true });

  const runlog = createRunLog(ROOT, `run-${cfg.targetDate}`);
  ctx.log = runlog.log;
  ctx.shot = runlog.shot;
  const { log } = ctx;
  ctx.armed = true;

  const release = releaseMoment(cfg);
  const dateISO = cfg.targetDate;
  log(`target date:   ${DateTime.fromISO(dateISO).toFormat('cccc, MMMM d, yyyy')} (party of ${cfg.partySize})`);
  log(`slot priority: ${cfg.slotPriority.join('  >  ')}${cfg.fallbackToEarliest ? '  >  earliest available' : ''}`);
  log(`release:       ${describeMoment(release)}`);

  const { offsetMs } = await syncClock(log);
  ctx.clockOffsetMs = offsetMs;

  const releaseMs = release.toMillis();
  const warmupMs = releaseMs - cfg.warmupMinutes * 60000;
  const now = trueNow();
  if (now >= releaseMs) {
    log('NOTE: release time has already passed — going straight to warm-up + availability check');
  } else if (now < warmupMs) {
    if (warmupMs - now > 12 * 3600000) {
      log('WARNING: warm-up is more than 12h away. You can leave this running, but a fresh start closer to release is safer.');
    }
    await waitUntilEpochMs(warmupMs, `warm-up starts (release ${describeMoment(release)})`);
  } else {
    log('inside the warm-up window — starting immediately');
  }

  if (!(await phaseWarmup({ dateISO, promptLogin: true }))) return;

  if (trueNow() < releaseMs) {
    await waitUntilEpochMs(releaseMs - 3000, 'release');
    log('T-minus 3 seconds — starting availability polling');
  }
  await phasePoll({ dateISO });
}

// ---------- main ----------
process.on('unhandledRejection', (e) => {
  ctx.log(`unhandled error: ${e?.stack || e}`);
});

setupKeyboard();
try {
  if (mode === 'run') await modeRun();
  else if (mode === 'dry-run') await modeDryRun();
  else if (mode === 'login') await modeLogin();
  else if (mode === 'test-alert') await modeTestAlert();
  else {
    console.log('usage: node src/index.js <run | dry-run --date=YYYY-MM-DD [--armed] | login | test-alert>');
    process.exit(1);
  }
  // Automation is done (handoff, dry-run end, or halt) — stay alive for the
  // human: alarm keeps ringing until a key, browser stays open until "q".
  if (ctx.page && process.stdin.isTTY) {
    await new Promise(() => {});
  } else if (ctx.page) {
    ctx.log('non-interactive terminal: closing browser and exiting in 15s');
    await sleep(15000);
    await ctx.browser.close().catch(() => {});
    process.exit(0);
  } else {
    process.exit(0);
  }
} catch (e) {
  if (!ctx.stopping) {
    ctx.log(`FATAL: ${e.stack || e.message}`);
    if (ctx.page) {
      await ctx.shot(ctx.page, 'fatal').catch(() => {});
      if (ctx.cfg) {
        await haltAndAlert('shuttle-assist crashed', `Unexpected failure: ${e.message}. Check the browser window and runs/ logs.`).catch(() => {});
        if (process.stdin.isTTY) {
          await new Promise(() => {});
        } else {
          await sleep(10000);
          await ctx.browser?.close().catch(() => {});
        }
      }
    }
    process.exit(1);
  }
}
