// Generates the PWA icons as real PNGs with no image library: we rasterise a
// blocky "B" monogram into an RGBA buffer and deflate it ourselves.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// 7 x 10 glyph for "B"
const GLYPH = [
  '1111100',
  '1100110',
  '1100110',
  '1100110',
  '1111100',
  '1111100',
  '1100110',
  '1100110',
  '1100110',
  '1111100',
].map((r) => r.padEnd(7, ' '));

const BRAND = [26, 94, 224];
const BRAND_DARK = [23, 63, 144];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? size : Math.round(size * 0.22);
  const inset = maskable ? Math.round(size * 0.1) : 0;

  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // rounded-square background with a soft vertical gradient
      const inCorner =
        (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x >= size - radius && y < radius && (x - (size - radius - 1)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x < radius && y >= size - radius && (x - radius) ** 2 + (y - (size - radius - 1)) ** 2 > radius ** 2) ||
        (x >= size - radius &&
          y >= size - radius &&
          (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 > radius ** 2);
      if (inCorner) {
        set(x, y, [0, 0, 0], 0);
        continue;
      }
      const t = y / size;
      set(x, y, [
        Math.round(BRAND[0] + (BRAND_DARK[0] - BRAND[0]) * t),
        Math.round(BRAND[1] + (BRAND_DARK[1] - BRAND[1]) * t),
        Math.round(BRAND[2] + (BRAND_DARK[2] - BRAND[2]) * t),
      ]);
    }
  }

  // centre the glyph
  const cell = Math.floor((size - inset * 2) / 14);
  const glyphW = GLYPH[0].length * cell;
  const glyphH = GLYPH.length * cell;
  const originX = Math.round((size - glyphW) / 2);
  const originY = Math.round((size - glyphH) / 2);

  GLYPH.forEach((row, gy) => {
    [...row].forEach((ch, gx) => {
      if (ch !== '1') return;
      for (let y = 0; y < cell; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const px2 = originX + gx * cell + x;
          const py2 = originY + gy * cell + y;
          if (px2 >= 0 && py2 >= 0 && px2 < size && py2 < size) set(px2, py2, [255, 255, 255]);
        }
      }
    });
  });

  // raw scanlines with filter byte 0
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: false }],
];

for (const [file, size, opts] of targets) {
  writeFileSync(resolve(outDir, file), png(size, opts));
  console.log(`wrote icons/${file} (${size}x${size})`);
}
