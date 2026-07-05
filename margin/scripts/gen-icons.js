// Generates PWA icons (solid indigo background, open book + amber bookmark)
// as raw PNGs with no image dependencies.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ---- minimal PNG encoder ----
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing: a page with a margin rule (the app's namesake) ----
const BG = [67, 56, 202]; // indigo
const PAGE = [255, 255, 255];
const RULE = [245, 158, 11]; // amber margin line
const TEXT = [205, 210, 220]; // faint body-text lines

// page bounds (normalized) and corner radius
const PX0 = 0.26, PX1 = 0.74, PY0 = 0.18, PY1 = 0.82, R = 0.05;

function inPage(x, y) {
  if (x < PX0 || x > PX1 || y < PY0 || y > PY1) return false;
  const cx = Math.max(PX0 + R, Math.min(x, PX1 - R));
  const cy = Math.max(PY0 + R, Math.min(y, PY1 - R));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}

const BODY_LINES = [
  [0.305, 0.43, 0.66],
  [0.42, 0.43, 0.66],
  [0.535, 0.43, 0.66],
  [0.65, 0.43, 0.575], // last line ends short, like a paragraph
];

function sampleColor(x, y) {
  if (!inPage(x, y)) return BG;
  // vertical margin rule
  if (x >= 0.355 && x <= 0.378 && y >= PY0 + 0.04 && y <= PY1 - 0.04) return RULE;
  // body-text lines to the right of the rule
  for (const [ly, lx0, lx1] of BODY_LINES) {
    if (y >= ly && y <= ly + 0.045 && x >= lx0 && x <= lx1) return TEXT;
  }
  return PAGE;
}

function render(size) {
  const S = 3; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = sampleColor((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (py * size + px) * 4;
      rgba[i] = Math.round(r / (S * S));
      rgba[i + 1] = Math.round(g / (S * S));
      rgba[i + 2] = Math.round(b / (S * S));
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-64.png', 64],
];
for (const [name, size] of targets) {
  fs.writeFileSync(path.join(OUT, name), render(size));
  console.log(`wrote icons/${name}`);
}
