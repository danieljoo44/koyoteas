// Outbox-based sync: every write (online or offline) goes to IndexedDB first,
// then pushes to the server whenever we can. The server keeps both versions on
// any conflict, so nothing is ever silently lost.
import * as store from './store.js';
import { api } from './api.js';

const listeners = new Set();
export function onSync(fn) {
  listeners.add(fn);
}
function emit(state, detail = {}) {
  for (const fn of listeners) fn(state, detail);
}

let syncing = false;
let runAgain = false;

export async function syncNow() {
  if (syncing) {
    runAgain = true;
    return;
  }
  if (!navigator.onLine) {
    emit('offline', { pending: await store.countOps() });
    return;
  }
  syncing = true;
  emit('syncing');
  try {
    const ops = await store.getOps();
    const res = await api('POST', '/api/sync', { ops });
    await store.removeOps(ops.map((o) => o.opId));
    await store.replaceAllNotes(res.notes);
    // Re-apply anything queued while the request was in flight.
    const remaining = await store.getOps();
    for (const op of remaining) {
      if (op.type === 'upsert') await store.putNote(op.note);
      else await store.deleteNote(op.id);
    }
    const conflicts = (res.results || []).filter((r) => r.status === 'conflict-copy' || r.status === 'kept').length;
    emit('synced', { conflicts, pending: remaining.length, at: new Date() });
  } catch (e) {
    if (e.status === 401) emit('auth');
    else emit('error', { pending: await store.countOps() });
  } finally {
    syncing = false;
    if (runAgain) {
      runAgain = false;
      syncNow();
    }
  }
}

export async function saveNote(note, baseUpdatedAt) {
  await store.putNote(note);
  await store.addOp({ type: 'upsert', note, baseUpdatedAt: baseUpdatedAt || null });
  syncNow();
}

export async function removeNote(id, baseUpdatedAt) {
  await store.deleteNote(id);
  await store.addOp({ type: 'delete', id, baseUpdatedAt: baseUpdatedAt || null });
  syncNow();
}

window.addEventListener('online', () => syncNow());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncNow();
});
setInterval(() => syncNow(), 60_000);
