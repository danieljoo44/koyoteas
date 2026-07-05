import { BOOKS, bookName, isSingleChapter, refString } from './books.js';
import * as store from './store.js';
import { api } from './api.js';
import { syncNow, saveNote, removeNote, onSync } from './sync.js';

// ---------- state ----------
let notes = [];
let byId = new Map();
let editingId = null;
let returnHash = '#/log';

const browseState = { book: null, chapter: null };
const logState = { filter: 'all', query: '' };
const heatState = { level: 'books', book: null, chapter: null, filter: 'all', selVerse: null };

const PREFS_KEY = 'margin-add-prefs';
const DRAFT_KEY = 'margin-draft-text';
let prefs = { book: 43, chapter: 3, source: 'sermon', speaker: '', sermonTitle: '' };
try {
  prefs = { ...prefs, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
} catch { /* ignore */ }

const SOURCE_LABEL = { study: 'Study', devotional: 'Devotional', sermon: 'Sermon' };

// ---------- tiny DOM helper ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

const view = document.getElementById('view');

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso) {
  return (
    fmtDate(iso) + ' · ' + new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

// ---------- toast ----------
const toastBox = document.getElementById('toast');
let toastTimer = null;
function toast(msg, opts = {}) {
  clearTimeout(toastTimer);
  toastBox.textContent = '';
  toastBox.append(msg);
  if (opts.action) {
    toastBox.append(
      el('button', {
        onclick: () => {
          toastBox.hidden = true;
          opts.action.fn();
        },
      }, opts.action.label)
    );
  }
  toastBox.hidden = false;
  toastTimer = setTimeout(() => (toastBox.hidden = true), opts.duration || (opts.action ? 6000 : 2200));
}

// ---------- data ----------
async function refreshFromStore() {
  notes = await store.getAllNotes();
  byId = new Map(notes.map((n) => [n.id, n]));
}

function countsByBook(list = notes) {
  const m = new Map();
  for (const n of list) m.set(n.book, (m.get(n.book) || 0) + 1);
  return m;
}
function countsByChapter(book, list = notes) {
  const m = new Map();
  for (const n of list) if (n.book === book) m.set(n.chapter, (m.get(n.chapter) || 0) + 1);
  return m;
}

function heatColor(count, max) {
  if (count === 0) return null;
  const effMax = Math.max(max, 6); // keep 1-note cells light even in a sparse map
  const t = 0.12 + 0.88 * (count / effMax);
  const lo = [224, 231, 255];
  const hi = [49, 46, 129];
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
  return { bg: `rgb(${c[0]},${c[1]},${c[2]})`, dark: t > 0.5 };
}

// ---------- sync status pill ----------
const pill = document.getElementById('sync-pill');
let lastSyncAt = null;
onSync(async (state, detail) => {
  pill.className = 'sync-pill';
  if (state === 'syncing') {
    pill.classList.add('syncing');
    pill.textContent = 'Syncing…';
  } else if (state === 'offline') {
    pill.classList.add('offline');
    pill.textContent = detail.pending ? `Offline · ${detail.pending} unsynced` : 'Offline';
  } else if (state === 'error') {
    pill.classList.add('error');
    pill.textContent = detail.pending ? `Sync failed · ${detail.pending} queued` : 'Sync failed';
  } else if (state === 'auth') {
    if (authOverlay.hidden) {
      // Ask the server which screen is right — a 401 during first-run must not
      // replace the setup form with a login form.
      api('GET', '/api/auth/status')
        .then((st) => showAuth(st.needsSetup ? 'setup' : 'login'))
        .catch(() => showAuth('login'));
    }
  } else if (state === 'synced') {
    lastSyncAt = detail.at;
    pill.textContent = detail.pending ? `${detail.pending} queued` : 'Synced';
    if (detail.conflicts) {
      toast(`Sync conflict: kept both versions of ${detail.conflicts} note${detail.conflicts > 1 ? 's' : ''}`);
    }
    await refreshFromStore();
    route();
  }
});

// ---------- router ----------
const routes = { add: renderAdd, browse: renderBrowse, log: renderLog, heat: renderHeat, more: renderMore };
function currentTab() {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && routes[m[1]] ? m[1] : 'add';
}
function route() {
  const tab = currentTab();
  for (const a of document.querySelectorAll('#tabbar a')) {
    a.classList.toggle('active', a.dataset.tab === tab);
  }
  if (tab !== 'add' && editingId) editingId = null; // leaving add cancels edit mode
  view.textContent = '';
  routes[tab]();
  view.scrollIntoView({ block: 'start' });
}
window.addEventListener('hashchange', route);

// ---------- shared: note card ----------
function noteCard(note) {
  const tagClass = `tag tag-${note.source}`;
  const refBtn = el('button', {
    class: 'note-ref',
    title: 'Show this passage in Browse',
    onclick: () => {
      browseState.book = note.book;
      browseState.chapter = note.chapter;
      location.hash = '#/browse';
    },
  }, refString(note));

  const head = el('div', { class: 'note-head' },
    refBtn,
    el('span', { class: tagClass }, SOURCE_LABEL[note.source]),
    note.edited ? el('span', { class: 'tag tag-edited', title: `Edited ${fmtDateTime(note.updatedAt)}` }, 'edited') : null,
    note.conflict ? el('span', { class: 'tag tag-conflict', title: 'Kept during a sync conflict — review and delete the copy you don’t want' }, 'conflict copy') : null,
    el('span', { class: 'note-date' }, fmtDateTime(note.createdAt))
  );

  const card = el('div', { class: 'note-card' }, head);
  if (note.source === 'sermon' && (note.speaker || note.sermonTitle)) {
    card.append(
      el('div', { class: 'note-sermon-meta' },
        [note.speaker, note.sermonTitle].filter(Boolean).join(' — '))
    );
  }
  card.append(el('div', { class: 'note-text' }, note.text));

  const delBtn = el('button', {
    onclick: () => {
      if (!delBtn.classList.contains('confirm-delete')) {
        delBtn.classList.add('confirm-delete');
        delBtn.textContent = 'Confirm delete?';
        setTimeout(() => {
          delBtn.classList.remove('confirm-delete');
          delBtn.textContent = 'Delete';
        }, 3500);
        return;
      }
      const snapshot = { ...note };
      removeNote(note.id, note.updatedAt).then(async () => {
        await refreshFromStore();
        route();
        toast('Note deleted', {
          action: {
            label: 'Undo',
            fn: async () => {
              await saveNote(snapshot, null);
              await refreshFromStore();
              route();
            },
          },
        });
      });
    },
  }, 'Delete');

  card.append(
    el('div', { class: 'note-actions' },
      el('button', {
        onclick: () => {
          editingId = note.id;
          returnHash = location.hash || '#/log';
          if (currentTab() === 'add') route();
          else location.hash = '#/add';
        },
      }, 'Edit'),
      delBtn
    )
  );
  return card;
}

function emptyState(icon, lines, showAddLink) {
  return el('div', { class: 'empty-state' },
    el('div', { class: 'big' }, icon),
    lines.map((l) => el('p', {}, l)),
    showAddLink ? el('p', {}, el('a', { href: '#/add' }, 'Add your first note')) : null
  );
}

// ---------- Add view ----------
function renderAdd() {
  const editing = editingId ? byId.get(editingId) : null;
  if (editingId && !editing) editingId = null;

  const init = editing
    ? {
        book: editing.book, chapter: editing.chapter, source: editing.source,
        speaker: editing.speaker || '', sermonTitle: editing.sermonTitle || '',
        verseStart: editing.verseStart, verseEnd: editing.verseEnd || '', text: editing.text,
      }
    : {
        book: prefs.book, chapter: prefs.chapter, source: prefs.source,
        speaker: prefs.speaker, sermonTitle: prefs.sermonTitle,
        verseStart: '', verseEnd: '', text: localStorage.getItem(DRAFT_KEY) || '',
      };

  // --- source segmented control ---
  let source = init.source;
  const segButtons = {};
  const segmented = el('div', { class: 'segmented' },
    ['study', 'devotional', 'sermon'].map((s) => {
      const b = el('button', { type: 'button', onclick: () => setSource(s) }, SOURCE_LABEL[s]);
      segButtons[s] = b;
      return b;
    })
  );
  function setSource(s) {
    source = s;
    for (const [k, b] of Object.entries(segButtons)) b.className = k === s ? `sel-${s}` : '';
    sermonFields.hidden = s !== 'sermon';
  }

  // --- reference row ---
  const bookSel = el('select', { 'aria-label': 'Book' },
    BOOKS.map((b, i) => el('option', { value: i + 1 }, b.name))
  );
  bookSel.value = init.book;
  const chapSel = el('select', { 'aria-label': 'Chapter' });
  function fillChapters() {
    const total = BOOKS[bookSel.value - 1].chapters;
    const prev = Number(chapSel.value) || init.chapter;
    chapSel.textContent = '';
    for (let c = 1; c <= total; c++) chapSel.append(el('option', { value: c }, String(c)));
    chapSel.value = Math.min(prev, total);
    chapSel.disabled = total === 1;
  }
  fillChapters();
  bookSel.addEventListener('change', fillChapters);

  const vStart = el('input', {
    type: 'number', min: 1, max: 176, inputmode: 'numeric', placeholder: 'Verse', 'aria-label': 'Starting verse', required: '',
  });
  vStart.value = init.verseStart;
  const vEnd = el('input', {
    type: 'number', min: 1, max: 176, inputmode: 'numeric', placeholder: 'to (opt.)', 'aria-label': 'Ending verse',
  });
  vEnd.value = init.verseEnd;

  // --- sermon fields ---
  const speakerInput = el('input', { type: 'text', list: 'speaker-list', placeholder: 'Pastor / speaker', autocomplete: 'off' });
  speakerInput.value = init.speaker;
  const titleInput = el('input', { type: 'text', placeholder: 'Sermon title (optional)', autocomplete: 'off' });
  titleInput.value = init.sermonTitle;
  const speakerList = el('datalist', { id: 'speaker-list' },
    [...new Set(notes.filter((n) => n.speaker).map((n) => n.speaker))].sort().map((s) => el('option', { value: s }))
  );
  const sermonFields = el('div', {},
    el('label', { class: 'field-label' }, 'Speaker'),
    speakerInput, speakerList,
    el('label', { class: 'field-label' }, 'Title'),
    titleInput
  );

  // --- note text ---
  const textArea = el('textarea', { placeholder: 'Write your note…', 'aria-label': 'Note text' });
  textArea.value = init.text;
  const autogrow = () => {
    textArea.style.height = 'auto';
    textArea.style.height = Math.max(textArea.scrollHeight, window.innerWidth >= 840 ? 260 : 140) + 'px';
  };
  textArea.addEventListener('input', () => {
    autogrow();
    if (!editing) localStorage.setItem(DRAFT_KEY, textArea.value);
  });
  textArea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') form.requestSubmit();
  });

  // --- save ---
  const saveBtn = el('button', { type: 'submit', class: 'btn-primary' }, editing ? 'Save changes' : 'Save note');
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const text = textArea.value.trim();
      if (!text) { textArea.focus(); return; }
      let vs = parseInt(vStart.value, 10);
      if (!vs || vs < 1) { vStart.focus(); return; }
      let ve = parseInt(vEnd.value, 10) || null;
      if (ve && ve < vs) [vs, ve] = [ve, vs];
      if (ve === vs) ve = null;
      if (source === 'sermon' && !speakerInput.value.trim()) { speakerInput.focus(); return; }

      const fields = {
        book: Number(bookSel.value),
        chapter: Number(chapSel.value),
        verseStart: vs,
        verseEnd: ve,
        source,
        speaker: source === 'sermon' ? speakerInput.value.trim() : null,
        sermonTitle: source === 'sermon' ? titleInput.value.trim() || null : null,
        text,
      };

      prefs = {
        book: fields.book, chapter: fields.chapter, source,
        speaker: speakerInput.value.trim(), sermonTitle: titleInput.value.trim(),
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

      if (editing) {
        const updated = { ...editing, ...fields, updatedAt: new Date().toISOString(), edited: 1 };
        await saveNote(updated, editing.updatedAt);
        editingId = null;
        await refreshFromStore();
        toast('Note updated');
        location.hash = returnHash;
        if (location.hash === returnHash) route();
      } else {
        const now = new Date().toISOString();
        const note = {
          id: crypto.randomUUID ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...fields, createdAt: now, updatedAt: now, edited: 0, conflict: 0,
        };
        await saveNote(note, null);
        await refreshFromStore();
        localStorage.removeItem(DRAFT_KEY);
        textArea.value = '';
        vStart.value = '';
        vEnd.value = '';
        autogrow();
        toast(`Saved · ${refString(note)}`);
        vStart.focus();
      }
    },
  },
    el('label', { class: 'field-label' }, 'Type'),
    segmented,
    el('label', { class: 'field-label' }, 'Passage'),
    el('div', { class: 'ref-row' },
      bookSel, chapSel,
      el('div', { class: 'verse-pair' }, vStart, el('span', { class: 'dash' }, '–'), vEnd)
    ),
    sermonFields,
    el('label', { class: 'field-label' }, 'Note'),
    textArea,
    el('div', { class: 'save-bar' }, saveBtn)
  );

  setSource(source);

  if (editing) {
    view.append(
      el('div', { class: 'edit-banner' },
        el('span', {}, `Editing note · ${refString(editing)}`),
        el('button', {
          onclick: () => {
            editingId = null;
            location.hash = returnHash;
            if (currentTab() === 'add') route();
          },
        }, 'Cancel')
      )
    );
  } else {
    view.append(el('h2', { class: 'view-title' }, 'Add a note'));
  }
  view.append(form);
  requestAnimationFrame(autogrow);
}

// ---------- Browse view ----------
function renderBrowse() {
  if (browseState.book && isSingleChapter(browseState.book)) browseState.chapter = 1;

  if (!browseState.book) {
    view.append(el('h2', { class: 'view-title' }, 'Browse by passage'));
    if (notes.length === 0) {
      view.append(emptyState('📖', ['No notes yet.', 'Notes will appear here under the books they belong to.'], true));
      return;
    }
    const counts = countsByBook();
    const section = (label, filterFn) =>
      el('div', {},
        el('div', { class: 'testament-label' }, label),
        el('div', { class: 'book-grid' },
          BOOKS.map((b, i) => {
            const num = i + 1;
            const c = counts.get(num) || 0;
            if (!filterFn(b)) return null;
            return el('button', {
              class: `book-btn${c ? '' : ' zero'}`,
              onclick: () => {
                browseState.book = num;
                browseState.chapter = isSingleChapter(num) ? 1 : null;
                route();
              },
            }, el('span', {}, b.name), c ? el('span', { class: 'count' }, String(c)) : null);
          })
        )
      );
    view.append(section('Old Testament', (b) => b.ot), section('New Testament', (b) => !b.ot));
    return;
  }

  const book = browseState.book;
  const bName = bookName(book);

  if (!browseState.chapter) {
    const counts = countsByChapter(book);
    const max = Math.max(0, ...counts.values());
    view.append(
      el('div', { class: 'view-head' },
        el('button', { class: 'back-btn', onclick: () => { browseState.book = null; route(); } }, '‹ Books'),
        el('h2', {}, bName)
      )
    );
    const total = BOOKS[book - 1].chapters;
    const cells = [];
    for (let c = 1; c <= total; c++) {
      const count = counts.get(c) || 0;
      const color = heatColor(count, max);
      const cell = el('button', {
        class: `grid-cell${color ? ' lit' : ''}${color && color.dark ? ' dark-cell' : ''}`,
        title: `${bName} ${c} — ${count} note${count === 1 ? '' : 's'}`,
        onclick: () => { browseState.chapter = c; route(); },
      }, String(c), count ? el('span', { class: 'sub' }, `${count} ✎`) : null);
      if (color) cell.style.background = color.bg;
      cells.push(cell);
    }
    view.append(el('div', { class: 'cell-grid' }, cells));
    if (counts.size === 0) {
      view.append(emptyState('🗒️', [`No notes in ${bName} yet.`], true));
    }
    return;
  }

  const chapter = browseState.chapter;
  const single = isSingleChapter(book);
  const chapterNotes = notes
    .filter((n) => n.book === book && n.chapter === chapter)
    .sort((a, b) => a.verseStart - b.verseStart || (a.verseEnd || a.verseStart) - (b.verseEnd || b.verseStart) || a.createdAt.localeCompare(b.createdAt));

  view.append(
    el('div', { class: 'view-head' },
      el('button', {
        class: 'back-btn',
        onclick: () => {
          browseState.chapter = null;
          if (single) browseState.book = null;
          route();
        },
      }, single ? '‹ Books' : '‹ Chapters'),
      el('h2', {}, single ? bName : `${bName} ${chapter}`),
      el('span', { class: 'spacer' }),
      el('span', { class: 'result-count' }, `${chapterNotes.length} note${chapterNotes.length === 1 ? '' : 's'}`)
    )
  );
  if (chapterNotes.length === 0) {
    view.append(emptyState('🗒️', ['No notes here yet.'], true));
    return;
  }
  for (const n of chapterNotes) view.append(noteCard(n));
}

// ---------- Log view ----------
function renderLog() {
  view.append(el('h2', { class: 'view-title' }, 'Log'));

  const chips = ['all', 'study', 'devotional', 'sermon'].map((f) =>
    el('button', {
      class: `chip chip-${f}${logState.filter === f ? ' active' : ''}`,
      onclick: () => { logState.filter = f; route(); },
    }, f === 'all' ? 'All' : SOURCE_LABEL[f])
  );
  view.append(el('div', { class: 'filter-row' }, chips));

  const search = el('input', {
    type: 'search',
    placeholder: 'Search notes, references, speakers…',
    'aria-label': 'Search notes',
  });
  search.value = logState.query;
  let debounce = null;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      logState.query = search.value;
      renderList();
    }, 150);
  });
  view.append(el('div', { class: 'search-box' }, search));

  const listBox = el('div', {});
  view.append(listBox);

  function renderList() {
    listBox.textContent = '';
    let list = notes;
    if (logState.filter !== 'all') list = list.filter((n) => n.source === logState.filter);
    const q = logState.query.trim().toLowerCase();
    if (q) {
      const tokens = q.split(/\s+/);
      list = list.filter((n) => {
        const hay = [n.text, refString(n), bookName(n.book), n.speaker || '', n.sermonTitle || '']
          .join(' ')
          .toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
    }
    list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (notes.length === 0) {
      listBox.append(emptyState('🕰️', ['Nothing here yet.', 'Every note you take will show up in this timeline.'], true));
      return;
    }
    if (list.length === 0) {
      listBox.append(emptyState('🔍', ['No notes match.', 'Try a different search or filter.'], false));
      return;
    }
    listBox.append(el('p', { class: 'result-count' }, `${list.length} note${list.length === 1 ? '' : 's'}`));
    for (const n of list) listBox.append(noteCard(n));
  }
  renderList();
}

// ---------- Heatmap view ----------
function renderHeat() {
  const filtered = heatState.filter === 'all' ? notes : notes.filter((n) => n.source === heatState.filter);

  const chips = ['all', 'study', 'devotional', 'sermon'].map((f) =>
    el('button', {
      class: `chip chip-${f}${heatState.filter === f ? ' active' : ''}`,
      onclick: () => { heatState.filter = f; heatState.selVerse = null; route(); },
    }, f === 'all' ? 'All' : SOURCE_LABEL[f])
  );

  const legend = el('div', { class: 'heat-legend' },
    'fewer',
    [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const lo = [224, 231, 255];
      const hi = [49, 46, 129];
      const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
      const sw = el('span', { class: 'swatch' });
      sw.style.background = t === 0 ? 'var(--cell0)' : `rgb(${c[0]},${c[1]},${c[2]})`;
      return sw;
    }),
    'more'
  );

  if (heatState.level === 'books') {
    view.append(
      el('div', { class: 'view-head' }, el('h2', {}, 'Heatmap')),
      el('div', { class: 'filter-row' }, chips),
      legend
    );
    if (notes.length === 0) {
      view.append(emptyState('🌡️', ['The heatmap fills in as you take notes.', 'Books you study most will glow darkest.'], true));
      return;
    }
    const counts = countsByBook(filtered);
    const max = Math.max(0, ...counts.values());
    const grid = (label, filterFn) =>
      el('div', {},
        el('div', { class: 'testament-label' }, label),
        el('div', { class: 'cell-grid' },
          BOOKS.map((b, i) => {
            if (!filterFn(b)) return null;
            const num = i + 1;
            const count = counts.get(num) || 0;
            const color = heatColor(count, max);
            const cell = el('button', {
              class: `grid-cell${color ? ' lit' : ''}${color && color.dark ? ' dark-cell' : ''}`,
              title: `${b.name} — ${count} note${count === 1 ? '' : 's'}`,
              onclick: () => {
                heatState.level = 'chapters';
                heatState.book = num;
                if (isSingleChapter(num)) {
                  heatState.level = 'verses';
                  heatState.chapter = 1;
                }
                heatState.selVerse = null;
                route();
              },
            }, b.abbr, count ? el('span', { class: 'sub' }, String(count)) : null);
            if (color) cell.style.background = color.bg;
            return cell;
          })
        )
      );
    view.append(grid('Old Testament', (b) => b.ot), grid('New Testament', (b) => !b.ot));
    return;
  }

  const book = heatState.book;
  const bName = bookName(book);

  if (heatState.level === 'chapters') {
    const counts = countsByChapter(book, filtered);
    const max = Math.max(0, ...counts.values());
    view.append(
      el('div', { class: 'view-head' },
        el('button', { class: 'back-btn', onclick: () => { heatState.level = 'books'; route(); } }, '‹ All books'),
        el('h2', {}, bName)
      ),
      el('div', { class: 'filter-row' }, chips),
      legend
    );
    const total = BOOKS[book - 1].chapters;
    const cells = [];
    for (let c = 1; c <= total; c++) {
      const count = counts.get(c) || 0;
      const color = heatColor(count, max);
      const cell = el('button', {
        class: `grid-cell${color ? ' lit' : ''}${color && color.dark ? ' dark-cell' : ''}`,
        title: `${bName} ${c} — ${count} note${count === 1 ? '' : 's'}`,
        onclick: () => { heatState.level = 'verses'; heatState.chapter = c; heatState.selVerse = null; route(); },
      }, String(c), count ? el('span', { class: 'sub' }, String(count)) : null);
      if (color) cell.style.background = color.bg;
      cells.push(cell);
    }
    view.append(el('div', { class: 'cell-grid' }, cells));
    return;
  }

  // verse level
  const chapter = heatState.chapter;
  const single = isSingleChapter(book);
  const chapterNotes = filtered.filter((n) => n.book === book && n.chapter === chapter);
  const verseCounts = new Map();
  let maxVerse = 0;
  for (const n of chapterNotes) {
    const end = n.verseEnd || n.verseStart;
    for (let v = n.verseStart; v <= end; v++) verseCounts.set(v, (verseCounts.get(v) || 0) + 1);
    maxVerse = Math.max(maxVerse, end);
  }
  const max = Math.max(0, ...verseCounts.values());

  view.append(
    el('div', { class: 'view-head' },
      el('button', {
        class: 'back-btn',
        onclick: () => {
          heatState.level = single ? 'books' : 'chapters';
          heatState.selVerse = null;
          route();
        },
      }, single ? '‹ All books' : `‹ ${bName}`),
      el('h2', {}, single ? bName : `${bName} ${chapter}`)
    ),
    el('div', { class: 'filter-row' }, chips),
    legend
  );

  if (chapterNotes.length === 0) {
    view.append(emptyState('🗒️', ['No notes in this chapter for the current filter.'], false));
    return;
  }

  const cells = [];
  for (let v = 1; v <= maxVerse; v++) {
    const count = verseCounts.get(v) || 0;
    const color = heatColor(count, max);
    const cell = el('button', {
      class: `grid-cell${color ? ' lit' : ''}${color && color.dark ? ' dark-cell' : ''}${heatState.selVerse === v ? ' selected' : ''}`,
      title: `Verse ${v} — ${count} note${count === 1 ? '' : 's'}`,
      onclick: () => { heatState.selVerse = heatState.selVerse === v ? null : v; route(); },
    }, String(v), count ? el('span', { class: 'sub' }, String(count)) : null);
    if (color) cell.style.background = color.bg;
    cells.push(cell);
  }
  view.append(
    el('div', { class: 'cell-grid' }, cells),
    el('p', { class: 'heat-info' },
      heatState.selVerse
        ? `Notes touching verse ${heatState.selVerse}:`
        : `Showing verses 1–${maxVerse} (the highest verse with a note). Tap a verse to see its notes.`)
  );
  if (heatState.selVerse) {
    const vNotes = chapterNotes
      .filter((n) => n.verseStart <= heatState.selVerse && (n.verseEnd || n.verseStart) >= heatState.selVerse)
      .sort((a, b) => a.verseStart - b.verseStart);
    for (const n of vNotes) view.append(noteCard(n));
  }
}

// ---------- More / settings ----------
function renderMore() {
  view.append(el('h2', { class: 'view-title' }, 'More'));

  // sync section
  const syncSec = el('div', { class: 'settings-section' },
    el('h3', {}, 'Sync'),
    el('p', {},
      lastSyncAt ? `Last synced ${fmtDateTime(lastSyncAt.toISOString())}. ` : 'Not synced yet this session. ',
      `${notes.length} note${notes.length === 1 ? '' : 's'} on this device.`),
    el('button', { class: 'btn-secondary', onclick: () => syncNow() }, 'Sync now')
  );

  // export
  const exportSec = el('div', { class: 'settings-section' },
    el('h3', {}, 'Backup'),
    el('p', {}, 'Downloads every note as a JSON file — including any not yet synced. The server also keeps daily database backups automatically.'),
    el('button', {
      class: 'btn-secondary',
      onclick: () => {
        const payload = { app: 'margin', version: 1, exportedAt: new Date().toISOString(), notes };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: `margin-${new Date().toISOString().slice(0, 10)}.json` });
        a.click();
        URL.revokeObjectURL(a.href);
        toast(`Exported ${notes.length} notes`);
      },
    }, 'Export all notes (JSON)')
  );

  // import
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data.notes;
      if (!Array.isArray(incoming)) throw new Error('No notes array found');
      let queued = 0, skipped = 0;
      for (const raw of incoming) {
        if (!raw || !raw.id) { skipped++; continue; }
        const existing = byId.get(raw.id);
        if (existing && existing.updatedAt === raw.updatedAt) { skipped++; continue; }
        await store.putNote(raw);
        await store.addOp({ type: 'upsert', note: raw, baseUpdatedAt: null });
        queued++;
      }
      await refreshFromStore();
      syncNow();
      toast(`Import: ${queued} restored, ${skipped} already present`);
      route();
    } catch (e) {
      toast(`Import failed: ${e.message}`);
    }
    fileInput.value = '';
  });
  const importSec = el('div', { class: 'settings-section' },
    el('h3', {}, 'Restore'),
    el('p', {}, 'Re-import a JSON export. Existing notes are never overwritten — anything that differs is kept as a separate copy.'),
    el('button', { class: 'btn-secondary', onclick: () => fileInput.click() }, 'Import from file'),
    fileInput
  );

  // logout
  const logoutSec = el('div', { class: 'settings-section' },
    el('h3', {}, 'Session'),
    el('p', {}, 'Signing out clears the notes cached on this device. They stay safe on the server.'),
    el('button', {
      class: 'btn-secondary',
      onclick: async () => {
        const pending = await store.countOps();
        if (pending > 0) {
          toast(`${pending} notes not yet synced — sync before signing out`);
          return;
        }
        try {
          await api('POST', '/api/auth/logout');
        } catch {
          toast('Could not reach the server — are you offline?');
          return;
        }
        await store.replaceAllNotes([]);
        location.reload();
      },
    }, 'Sign out')
  );

  view.append(syncSec, exportSec, importSec, logoutSec);
}

// ---------- auth ----------
const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authPass = document.getElementById('auth-pass');
const authPass2 = document.getElementById('auth-pass2');
const authHint = document.getElementById('auth-hint');
const authError = document.getElementById('auth-error');
const authSubmit = document.getElementById('auth-submit');
let authMode = 'login';

function showAuth(mode) {
  authMode = mode;
  authOverlay.hidden = false;
  authError.textContent = '';
  authPass2.hidden = mode !== 'setup';
  authHint.textContent =
    mode === 'setup'
      ? 'First run — choose the passphrase that will protect your notes (at least 8 characters).'
      : 'Enter your passphrase to unlock your notes.';
  authSubmit.textContent = mode === 'setup' ? 'Set passphrase' : 'Unlock';
  setTimeout(() => authPass.focus(), 50);
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const pass = authPass.value;
  if (authMode === 'setup' && pass !== authPass2.value) {
    authError.textContent = 'Passphrases don’t match.';
    return;
  }
  try {
    await api('POST', authMode === 'setup' ? '/api/auth/setup' : '/api/auth/login', { passphrase: pass });
    authOverlay.hidden = true;
    authPass.value = '';
    authPass2.value = '';
    syncNow();
  } catch (err) {
    authError.textContent = (err.body && err.body.error) || 'Something went wrong — try again.';
  }
});

// ---------- boot ----------
async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  await refreshFromStore();
  if (!location.hash) location.hash = '#/add';
  route();

  try {
    const st = await api('GET', '/api/auth/status');
    if (st.needsSetup) showAuth('setup');
    else if (!st.authed) showAuth('login');
    else syncNow();
  } catch {
    // offline — run from the local cache; sync retries automatically
    pill.className = 'sync-pill offline';
    pill.textContent = 'Offline';
  }
}
boot();
