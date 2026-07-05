# Verse Notes

A Bible verse-anchored note-taking PWA. Every note is tied to a verse (or range),
so sermon notes and devotional thoughts resurface whenever you return to a passage.

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
`PASSPHRASE` (optional — seeds the passphrase on first boot, e.g. from fly secrets).

## Deploy to Fly.io (recommended)

```bash
brew install flyctl && fly auth signup      # once
cd verse-notes
fly launch --no-deploy                      # accept the detected Dockerfile; pick an app name
fly volumes create verse_notes_data --size 1
fly secrets set PASSPHRASE="choose-a-long-passphrase"
fly deploy
```

Your app is then at `https://<app-name>.fly.dev` with HTTPS (required for PWA install).
The SQLite file and its backups live on the volume, so deploys never touch your data.

**Grabbing a server backup:** `fly ssh sftp get /data/backups/<file>.db`
(list them with `fly ssh console -C "ls /data/backups"`).

Any other host works the same way (Railway, a home server behind Caddy/Tailscale…):
run `node server/index.js` with `DATA_DIR` pointing at persistent storage, and put
HTTPS in front of it.

## Install on your devices

- **iPhone:** open the site in Safari → Share → **Add to Home Screen**. It launches
  full-screen with the app icon, and works offline in the pew.
- **Desktop:** open the site in Chrome/Edge → install icon in the address bar
  ("Install Verse Notes").

## Releasing app updates

Static assets are served with `no-cache`, and the offline copy is controlled by the
service worker. After changing frontend files, bump `VERSION` in `public/sw.js`
(e.g. `vn-v1` → `vn-v2`) so installed clients pick up the new files.

## How sync stays safe

Every write goes to IndexedDB first, then an outbox op is pushed to `/api/sync`:

- new id → insert; same `updatedAt` → already applied (idempotent re-push)
- edit whose `baseUpdatedAt` matches the server → normal update
- **anything else → the server inserts a conflict copy instead of overwriting**
- deletes only apply if `baseUpdatedAt` matches; otherwise the note is kept

So two devices editing the same note offline ends with both versions saved, never a
silent overwrite.
