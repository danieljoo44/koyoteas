const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, DATA_DIR, backupNow, startBackupSchedule } = require('./db');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '25mb' }));

const PUB = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 8787;
const SESSION_DAYS = 180;

const nowIso = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- settings / passphrase ----------
const getSetting = (k) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  return row ? row.value : null;
};
const setSetting = (k, v) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v);

const hashPass = (pass, salt) => crypto.scryptSync(pass, salt, 64).toString('hex');
const passIsSet = () => !!getSetting('pass_hash');

function setPassphrase(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  setSetting('pass_salt', salt);
  setSetting('pass_hash', hashPass(pass, salt));
}

function verifyPass(pass) {
  const salt = getSetting('pass_salt');
  const hash = getSetting('pass_hash');
  if (!salt || !hash) return false;
  const test = Buffer.from(hashPass(pass, salt), 'hex');
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

// Allow seeding the passphrase from the environment (handy for fly secrets).
if (!passIsSet() && process.env.PASSPHRASE) setPassphrase(process.env.PASSPHRASE);

// ---------- sessions ----------
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function createSession(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash, created_at) VALUES(?,?)').run(sha256(token), nowIso());
  const secure = req.secure ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `margin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
  );
}

function checkSession(req) {
  const token = getCookie(req, 'margin_session');
  if (!token) return false;
  const row = db.prepare('SELECT created_at FROM sessions WHERE token_hash = ?').get(sha256(token));
  if (!row) return false;
  if (Date.now() - Date.parse(row.created_at) > SESSION_DAYS * 86400e3) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    return false;
  }
  return true;
}

// ---------- login rate limit ----------
const attempts = new Map(); // ip -> { n, since }
function rateLimited(ip) {
  const rec = attempts.get(ip);
  const WINDOW = 15 * 60 * 1000;
  if (!rec || Date.now() - rec.since > WINDOW) {
    attempts.set(ip, { n: 1, since: Date.now() });
    return false;
  }
  rec.n++;
  return rec.n > 20;
}

// ---------- notes ----------
const SOURCES = ['study', 'devotional', 'sermon'];

function rowToNote(r) {
  return {
    id: r.id,
    book: r.book,
    chapter: r.chapter,
    verseStart: r.verse_start,
    verseEnd: r.verse_end,
    source: r.source,
    speaker: r.speaker,
    sermonTitle: r.sermon_title,
    text: r.text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    edited: r.edited,
    conflict: r.conflict,
  };
}

const getNoteStmt = db.prepare('SELECT * FROM notes WHERE id = ?');
const insertStmt = db.prepare(`INSERT INTO notes
  (id, book, chapter, verse_start, verse_end, source, speaker, sermon_title, text, created_at, updated_at, edited, conflict)
  VALUES (@id, @book, @chapter, @verseStart, @verseEnd, @source, @speaker, @sermonTitle, @text, @createdAt, @updatedAt, @edited, @conflict)`);
const updateStmt = db.prepare(`UPDATE notes SET
  book=@book, chapter=@chapter, verse_start=@verseStart, verse_end=@verseEnd, source=@source,
  speaker=@speaker, sermon_title=@sermonTitle, text=@text, updated_at=@updatedAt, edited=@edited
  WHERE id=@id`);

const allNotes = () => db.prepare('SELECT * FROM notes').all().map(rowToNote);

function cleanNote(n) {
  if (!n || typeof n !== 'object') return null;
  const book = Number(n.book);
  const chapter = Number(n.chapter);
  const verseStart = Number(n.verseStart);
  let verseEnd = n.verseEnd === null || n.verseEnd === undefined || n.verseEnd === '' ? null : Number(n.verseEnd);
  if (!Number.isInteger(book) || book < 1 || book > 66) return null;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;
  if (!Number.isInteger(verseStart) || verseStart < 1 || verseStart > 200) return null;
  if (verseEnd !== null && (!Number.isInteger(verseEnd) || verseEnd <= verseStart || verseEnd > 200)) verseEnd = null;
  if (!SOURCES.includes(n.source)) return null;
  const text = String(n.text || '').trim().slice(0, 100000);
  if (!text) return null;
  const id = String(n.id || '').slice(0, 64);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const validDate = (d, fallback) => (typeof d === 'string' && !Number.isNaN(Date.parse(d)) ? d : fallback);
  const createdAt = validDate(n.createdAt, nowIso());
  return {
    id,
    book,
    chapter,
    verseStart,
    verseEnd,
    source: n.source,
    speaker: n.speaker ? String(n.speaker).trim().slice(0, 200) : null,
    sermonTitle: n.sermonTitle ? String(n.sermonTitle).trim().slice(0, 300) : null,
    text,
    createdAt,
    updatedAt: validDate(n.updatedAt, createdAt),
    edited: n.edited ? 1 : 0,
    conflict: n.conflict ? 1 : 0,
  };
}

// Conservative merge: on any doubt, keep both versions rather than overwrite.
function applyUpsert(note, baseUpdatedAt) {
  const existing = getNoteStmt.get(note.id);
  if (!existing) {
    insertStmt.run(note);
    return { status: 'added', id: note.id };
  }
  if (existing.updated_at === note.updatedAt) {
    return { status: 'unchanged', id: note.id }; // re-push after a lost ack
  }
  if (baseUpdatedAt && existing.updated_at === baseUpdatedAt) {
    updateStmt.run(note);
    return { status: 'updated', id: note.id };
  }
  const copy = { ...note, id: crypto.randomUUID(), conflict: 1, updatedAt: nowIso() };
  insertStmt.run(copy);
  return { status: 'conflict-copy', id: note.id, newId: copy.id };
}

function applyDelete(id, baseUpdatedAt) {
  const existing = getNoteStmt.get(id);
  if (!existing) return { status: 'gone', id };
  if (baseUpdatedAt && existing.updated_at === baseUpdatedAt) {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return { status: 'deleted', id };
  }
  return { status: 'kept', id }; // changed on the server since the client last saw it
}

// ---------- auth routes ----------
app.get('/api/auth/status', (req, res) => {
  res.json({ needsSetup: !passIsSet(), authed: checkSession(req) });
});

app.post('/api/auth/setup', (req, res) => {
  if (passIsSet()) return res.status(403).json({ error: 'Passphrase already set' });
  const pass = String((req.body || {}).passphrase || '');
  if (pass.length < 8) return res.status(400).json({ error: 'Passphrase must be at least 8 characters' });
  setPassphrase(pass);
  createSession(req, res);
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many attempts, try again later' });
  const pass = String((req.body || {}).passphrase || '');
  if (!verifyPass(pass)) return res.status(401).json({ error: 'Wrong passphrase' });
  createSession(req, res);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getCookie(req, 'margin_session');
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', 'margin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

// ---------- protected API ----------
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  if (!checkSession(req)) return res.status(401).json({ error: 'Not authenticated' });
  next();
});

app.get('/api/notes', (req, res) => {
  res.json({ notes: allNotes() });
});

app.post('/api/sync', (req, res) => {
  const ops = Array.isArray((req.body || {}).ops) ? req.body.ops : [];
  const results = [];
  const run = db.transaction(() => {
    for (const op of ops) {
      if (op && op.type === 'upsert') {
        const note = cleanNote(op.note);
        if (!note) {
          results.push({ opId: op.opId, status: 'invalid' });
          continue;
        }
        results.push({ opId: op.opId, ...applyUpsert(note, op.baseUpdatedAt || null) });
      } else if (op && op.type === 'delete' && typeof op.id === 'string') {
        results.push({ opId: op.opId, ...applyDelete(op.id, op.baseUpdatedAt || null) });
      } else {
        results.push({ opId: op && op.opId, status: 'invalid' });
      }
    }
  });
  run();
  res.json({ results, notes: allNotes() });
});

app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="margin-${nowIso().slice(0, 10)}.json"`);
  res.json({ app: 'margin', version: 1, exportedAt: nowIso(), notes: allNotes() });
});

app.post('/api/import', async (req, res) => {
  const incoming = Array.isArray((req.body || {}).notes) ? req.body.notes : null;
  if (!incoming) return res.status(400).json({ error: 'Expected { notes: [...] }' });
  try {
    await backupNow('pre-import');
  } catch (e) {
    console.error('[backup] pre-import failed:', e);
  }
  let added = 0, skipped = 0, copied = 0, invalid = 0;
  const run = db.transaction(() => {
    for (const raw of incoming) {
      const note = cleanNote(raw);
      if (!note) { invalid++; continue; }
      const r = applyUpsert(note, null);
      if (r.status === 'added') added++;
      else if (r.status === 'conflict-copy') copied++;
      else skipped++;
    }
  });
  run();
  res.json({ added, skipped, copied, invalid, notes: allNotes() });
});

// ---------- static ----------
app.use(
  express.static(PUB, {
    setHeaders(res, filePath) {
      // Icons rarely change; everything else must revalidate so app updates
      // are never trapped behind the HTTP cache (offline is the SW's job).
      if (filePath.includes('/icons/')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.listen(PORT, () => {
  console.log(`Margin running on http://localhost:${PORT} (data: ${DATA_DIR})`);
  startBackupSchedule();
});
