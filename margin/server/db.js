const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'notes.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  book INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse_start INTEGER NOT NULL,
  verse_end INTEGER,
  source TEXT NOT NULL,
  speaker TEXT,
  sermon_title TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  edited INTEGER NOT NULL DEFAULT 0,
  conflict INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notes_ref ON notes(book, chapter, verse_start);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 30;

async function backupNow(reason) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const existing = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();

  // Never rotate good backups away in favor of an empty database.
  const count = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
  if (count === 0 && existing.length > 0) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(BACKUP_DIR, `notes-${stamp}.db`);
  await db.backup(dest);

  const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
  for (const f of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
  }
  console.log(`[backup] ${reason}: ${dest} (${count} notes)`);
  return dest;
}

function startBackupSchedule() {
  setTimeout(() => backupNow('startup').catch((e) => console.error('[backup] failed:', e)), 5000);
  setInterval(() => backupNow('daily').catch((e) => console.error('[backup] failed:', e)), 24 * 3600 * 1000);
}

module.exports = { db, DATA_DIR, backupNow, startBackupSchedule };
