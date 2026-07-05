// IndexedDB: local mirror of all notes plus an outbox of pending writes.
const DB_NAME = 'margin';
const DB_VERSION = 1;

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'opId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqProm(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(name, mode, fn) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(name, mode);
    let out;
    try {
      out = fn(t.objectStore(name));
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function getAllNotes() {
  const d = await openDB();
  return reqProm(d.transaction('notes').objectStore('notes').getAll());
}

export function putNote(note) {
  return withStore('notes', 'readwrite', (s) => s.put(note));
}

export function deleteNote(id) {
  return withStore('notes', 'readwrite', (s) => s.delete(id));
}

export function replaceAllNotes(notes) {
  return withStore('notes', 'readwrite', (s) => {
    s.clear();
    for (const n of notes) s.put(n);
  });
}

// Outbox: opIds are zero-padded timestamps so getAll returns ops in write order.
let opCounter = 0;
export function addOp(op) {
  const opId = `${String(Date.now()).padStart(14, '0')}-${String(opCounter++).padStart(4, '0')}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return withStore('outbox', 'readwrite', (s) => s.put({ ...op, opId }));
}

export async function getOps() {
  const d = await openDB();
  return reqProm(d.transaction('outbox').objectStore('outbox').getAll());
}

export function removeOps(opIds) {
  return withStore('outbox', 'readwrite', (s) => {
    for (const id of opIds) s.delete(id);
  });
}

export async function countOps() {
  const d = await openDB();
  return reqProm(d.transaction('outbox').objectStore('outbox').count());
}
