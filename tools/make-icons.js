// Icônes PNG générées sans dépendance : fond émeraude, étoile à huit branches dorée (rub el hizb).
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
function shade(x, y) { // x,y dans [-1,1]
  const r = Math.hypot(x, y);
  const sq = (a, b, s) => Math.max(Math.abs(a), Math.abs(b)) < s;
  const c = Math.SQRT1_2, xr = x * c - y * c, yr = x * c + y * c;
  const star = (s) => sq(x, y, s) || sq(xr, yr, s);
  const bg = [14 + 10 * (1 - r), 92 - 26 * r, 70 - 20 * r];
  const gold = [214, 176, 96];
  if (star(0.50) && !star(0.42)) return gold;
  if (r < 0.27 && r > 0.20) return gold;
  if (r < 0.09) return gold;
  return bg;
}
function png(size) {
  const SS = 4, raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade(((px + (sx + .5) / SS) / size) * 2 - 1, ((py + (sy + .5) / SS) / size) * 2 - 1);
        R += c[0]; G += c[1]; B += c[2];
      }
      const o = py * (size * 3 + 1) + 1 + px * 3, n = SS * SS;
      raw[o] = R / n; raw[o + 1] = G / n; raw[o + 2] = B / n;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(__dirname, '..', 'icons', `icon-${s}.png`), png(s));
console.log('icônes ok');
