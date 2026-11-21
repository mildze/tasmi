// Construit tout ce dont l'app a besoin pour tourner hors ligne :
//   vendor/tilawa.js      le moteur Tilawa + ONNX Runtime Web, en un seul fichier
//   tilawa/v1/…           modèles, référence et fichiers WASM (copie vérifiée de https://tilawa.dev/v1/)
//   data/quran.json       texte du Coran (Ḥafṣ, graphie othmanienne), découpé en mots comme le moteur les compte
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

await build({
  entryPoints: [join(here, 'entry.js')], outfile: join(root, 'vendor', 'tilawa.js'),
  bundle: true, format: 'esm', minify: true, target: 'es2022', legalComments: 'none', logLevel: 'warning'
});
console.log('vendor/tilawa.js', ((await stat(join(root, 'vendor', 'tilawa.js'))).size / 1e6).toFixed(2), 'Mo');

const SRC = 'https://tilawa.dev/v1/', out = join(root, 'tilawa', 'v1');
const manifest = await (await fetch(SRC + 'manifest.json')).json();
const sha = b => createHash('sha256').update(b).digest('hex');
for (const f of manifest.files) {
  const dest = join(out, f.path);
  let bytes = null;
  try { bytes = await readFile(dest); if (sha(bytes) !== f.sha256) bytes = null; } catch {}
  if (!bytes) {
    const r = await fetch(SRC + f.path);
    if (!r.ok) throw new Error(r.status + ' ' + f.path);
    bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length !== f.bytes || sha(bytes) !== f.sha256) throw new Error('Somme de contrôle incorrecte : ' + f.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
  }
  console.log('ok', (f.bytes / 1e6).toFixed(1).padStart(6), 'Mo', f.path);
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));

// Texte affiché : même fichier que la démonstration Tilawa, pour que les numéros de mots correspondent.
const QURAN = 'https://raw.githubusercontent.com/yazinsai/tilawa/main/web/frontend/public/quran.json';
const verses = await (await fetch(QURAN)).json();
const ATTACHED = /^[ۖ-ۜ۩]{1,2}$/;   // signes de pause et de prosternation : rattachés au mot précédent
function words(text, surah, ayah) {
  const o = [];
  for (const t of text.replace(/﻿/g, '').split(/\s+/)) {
    if (!t || t === '۞') continue;
    if (ATTACHED.test(t) && o.length) o[o.length - 1] += ' ' + t; else o.push(t);
  }
  return ayah === 1 && surah !== 1 && surah !== 9 && o.length > 4 ? o.slice(4) : o;   // basmala d'ouverture retirée
}
const surahs = [];
for (const v of verses) {
  const s = surahs[v.surah - 1] ??= { n: v.surah, ar: v.surah_name, fr: v.surah_name_en, a: [] };
  s.a[v.ayah - 1] = words(v.text_uthmani, v.surah, v.ayah);
}
await mkdir(join(root, 'data'), { recursive: true });
await writeFile(join(root, 'data', 'quran.json'), JSON.stringify(surahs));
console.log('data/quran.json', surahs.length, 'sourates,', surahs.reduce((n, s) => n + s.a.length, 0), 'ayahs');
console.log(surahs[0].ar, '|', surahs[0].fr, '|', surahs[0].a[0].join(' '), '|', surahs[1].a[0].join(' '));
