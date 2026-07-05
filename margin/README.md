# Margin

A Bible verse-anchored note-taking PWA. Every note is tied to a verse (or range),
so sermon notes and study thoughts resurface whenever you return to a passage.

- **One shared library** across iPhone + desktop via a small Node/Express + SQLite server
- **Offline-first** on the phone: notes are cached in IndexedDB, writes queue in an
  outbox and sync when connectivity returns
- **Never loses a note**: any sync conflict keeps *both* versions (the copy is tagged
  "conflict copy" so you can merge by hand); stale deletes are refused
- **Protected** by a single passphrase (scrypt-hashed on the server, HttpOnly session cookie)
- **Backed up three ways**: daily server-side SQLite snapshots (last 30 kept in
  `data/backups/`), one-click JSON export, and JSON import to restore

## Run locally

```bash
npm install
npm start            # http://localhost:8787
```

On first launch the app asks you to choose a passphrase. To reset it later:

```bash
node scripts/set-passphrase.js "my new passphrase"
```

Environment variables: `PORT` (default 8787), `DATA_DIR` (default `./data`),
`PASSPHRASE` (optional — seeds the passphrase on first boot).

## Deploy to Fly.io

```bash
curl -L https://fly.io/install.sh | sh      # once; then: fly auth signup (or login)
cd margin
fly launch --no-deploy      # reuses the included fly.toml + Dockerfile;
                            # pick a unique app name and a region near you
fly volumes create margin_data --size 1
fly secrets set PASSPHRASE="choose-a-long-passphrase"   # optional; or use the first-run screen
fly deploy
```

The app is then at `https://<app-name>.fly.dev` with HTTPS (required for PWA
install and offline mode). The SQLite database and its daily backups live on the
volume, so deploys never touch your notes. Keep it at **one machine** — SQLite
wants a single writer (`fly scale count 1` if it ever creeps up).

The machine auto-sleeps when idle and wakes on the first request (a second or
two); the app itself opens instantly from its offline cache regardless.

**Grabbing a server backup:** `fly ssh sftp get /data/backups/<file>.db`
(list them with `fly ssh console -C "ls /data/backups"`).

**Resetting the passphrase:**
`fly ssh console -C "node scripts/set-passphrase.js \"new passphrase\""`

**Updating the app:** bump `VERSION` in `public/sw.js`, then `fly deploy`.

## Install on your devices

- **iPhone:** open `https://<app-name>.fly.dev` in Safari → Share →
  **Add to Home Screen**. It launches full-screen with the app icon, and works
  offline in the pew.
- **Desktop:** open the same URL in Chrome/Edge → install icon in the address bar
  ("Install Margin").

## Releasing app updates

Static assets are served with `no-cache`, and the offline copy is controlled by the
service worker. After changing frontend files, bump `VERSION` in `public/sw.js`
(e.g. `margin-v1` → `margin-v2`) so installed clients pick up the new files.

## How sync stays safe

Every write goes to IndexedDB first, then an outbox op is pushed to `/api/sync`:

- new id → insert; same `updatedAt` → already applied (idempotent re-push)
- edit whose `baseUpdatedAt` matches the server → normal update
- **anything else → the server inserts a conflict copy instead of overwriting**
- deletes only apply if `baseUpdatedAt` matches; otherwise the note is kept

So two devices editing the same note offline ends with both versions saved, never a
silent overwrite.
