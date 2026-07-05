import fs from 'node:fs';
import { DateTime } from 'luxon';

export function loadConfig(path) {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`could not read ${path}: ${e.message}`);
  }
  const errs = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.targetDate || '')) errs.push('targetDate must be YYYY-MM-DD');
  if (!Number.isInteger(cfg.partySize) || cfg.partySize < 1 || cfg.partySize > 10) errs.push('partySize must be an integer 1-10');
  if (!Array.isArray(cfg.slotPriority) || cfg.slotPriority.length === 0) errs.push('slotPriority must be a non-empty array');
  if (!Array.isArray(cfg.destinationPriority) || cfg.destinationPriority.length === 0) errs.push('destinationPriority must be a non-empty array');
  const r = cfg.release || {};
  if (!Number.isInteger(r.daysBefore) || r.daysBefore < 0) errs.push('release.daysBefore must be a non-negative integer');
  if (!/^\d{2}:\d{2}$/.test(r.time || '')) errs.push('release.time must be HH:MM (24h)');
  if (!DateTime.now().setZone(r.timezone || '').isValid) errs.push(`release.timezone "${r.timezone}" is not a valid IANA zone`);
  if (!(cfg.pollSecondsMin >= 2)) errs.push('pollSecondsMin must be >= 2 (polite polling is non-negotiable)');
  if (!(cfg.pollSecondsMax >= cfg.pollSecondsMin)) errs.push('pollSecondsMax must be >= pollSecondsMin');
  if (errs.length) throw new Error(`config.json invalid:\n  - ${errs.join('\n  - ')}`);
  return cfg;
}

// The moment the rolling release opens for cfg.targetDate, as a luxon DateTime
// in the release timezone (verified on-site: 2 days before arrival at
// 8:00 a.m. Mountain / 10:00 a.m. Eastern).
export function releaseMoment(cfg, targetDate = cfg.targetDate) {
  const [hour, minute] = cfg.release.time.split(':').map(Number);
  return DateTime.fromISO(targetDate, { zone: cfg.release.timezone })
    .minus({ days: cfg.release.daysBefore })
    .set({ hour, minute, second: 0, millisecond: 0 });
}

export function describeMoment(dt) {
  const local = dt.setZone(DateTime.local().zoneName);
  const site = dt;
  return `${site.toFormat('ccc MMM d, h:mm a ZZZZ')} (= ${local.toFormat('h:mm a ZZZZ')} your time)`;
}
