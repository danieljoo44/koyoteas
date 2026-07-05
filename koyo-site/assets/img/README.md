# Koyo — site guide

**Pages**: `index.html` (home) + `tea/sejak.html`, `tea/artemisia.html`,
`tea/persimmon.html` (order pages). Product pages are generated — edit copy in
`../build-tea-pages.py` (one dict per tea) and re-run `python3 build-tea-pages.py`.

**Shopify**: paste your store domain, Storefront API token, and product
handles into `js/shop-config.js`. That switches the cart from email
order-requests to real Shopify checkout with live prices.

# Image assets

All page imagery lives in this folder. To swap any visual, replace the file
and keep the same name — no code changes needed.

| File | Used in | Notes |
|---|---|---|
| `hero-field.jpg` / `hero-field-mobile.jpg` | Hero background | Golden-hour Hadong terraces, graded to paper tones (source: Screenshot 2026-07-04 8.33.28 PM on Desktop) |
| `koyo-mark-ink.png` | Nav, quote, preloader | Brand swirl, ink on transparent |
| `koyo-mark-paper.png` | Footer | Brand swirl, paper on transparent (for dark bg) |
| `favicon.png` | Browser tab | 64×64 |
| `cup-sejak.jpg` `cup-artemisia.jpg` `cup-persimmon.jpg` | Collection section (the cup) | Square ~900×900, steeped cup centered top-down. Replace with any photo per tea — keep the cup centered |
| `specimen-sejak.jpg` | Ethos section figure | Wide 2.4:1 crop, white/light bg (multiply-blended) |
| `pack-{tea}-loose.jpg` / `pack-{tea}-sachet.jpg` | Shelf cards (loose) + PDP pouch gallery (follows format picker) | Loose = tin-tie bags (DSC05215-2/17/18/33), sachets = tea-bag pouches (DSC05240/41/44/48) |
| `loose-sejak.jpg` `loose-artemisia.jpg` `loose-persimmon.jpg` | Shelf hover state | 4:5 portrait, loose-leaf piles |

Videos live in `../video/`:

| File | Used in |
|---|---|
| `hadong-mountains.mp4` + `-poster.jpg` | Origin section background (from C0040.MP4) |
| `hadong-stream.mp4` + `-poster.jpg` | Quote section background (from C0035.MP4, slowed 1.4×) |

The three cup liquor colors in the collection section are sampled from the
real cup photography (`Sejak_Cup.jpg` etc. from the Sept 2025 shoot) and set
as `data-deep` / `data-light` attributes on each `.panel` in `index.html`.
