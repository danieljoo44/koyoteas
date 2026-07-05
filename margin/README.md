# Margin

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
`PASSPHRASE` (optional — seeds the passphrase on first boot).

## Deploy on your home server (Docker + Tailscale)

Copy the `margin/` folder to the server (or clone it), then:

```bash
cd margin
docker compose up -d --build
```

The app is now on `http://localhost:8787`, and the SQLite database plus its daily
backups live in `./data/` **on the host**, so container rebuilds never touch your
notes.

**HTTPS via Tailscale** — required: browsers only allow service workers (offline
mode) and full PWA install on secure origins, so don't skip this. With Tailscale
on the server (MagicDNS + HTTPS certificates enabled under DNS settings in the
admin console):

```bash
tailscale serve --bg localhost:8787
```

That publishes the app inside your tailnet at `https://<machine>.<tailnet>.ts.net`
with a valid certificate — nothing is exposed to the public internet; the
passphrase is a second layer on top.

**Updating the app:** pull/copy the new files, bump `VERSION` in `public/sw.js`,
then `docker compose up -d --build`.

**Resetting the passphrase:**
`docker compose exec margin node scripts/set-passphrase.js "new passphrase"`

**Backups:** grab `./data/backups/*.db` off the host any way you like (they're
plain SQLite files — restoring is just replacing `data/notes.db` while the
container is stopped), or use the in-app JSON export.

## Install on your devices

- **iPhone:** install the Tailscale app and connect, then open the
  `https://….ts.net` URL in Safari → Share → **Add to Home Screen**. It launches
  full-screen with the app icon, and works offline in the pew.
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
