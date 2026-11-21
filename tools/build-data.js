// Construit data/quran.json (texte Hafs, orthographe simple Tanzil) à partir de l'export alquran.cloud.
const fs = require('fs'), path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'quran-raw.json'), 'utf8')).data.surahs;
const strip = s => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '');
let stripped = 0;
const out = raw.map(s => {
  const a = s.ayahs.map(x => x.text.replace(/﻿/g, '').trim());
  if (s.number !== 1 && s.number !== 9) {
    const p = a[0].split(/\s+/);
    if (strip(p.slice(0, 4).join(' ')) === 'بسم الله الرحمن الرحيم') { a[0] = p.slice(4).join(' '); stripped++; }
  }
  return { n: s.number, ar: s.name.replace(/^سُورَةُ\s*/, ''), fr: s.englishName, a };
});
fs.writeFileSync(path.join(__dirname, '..', 'data', 'quran.json'), JSON.stringify(out));
console.log('sourates', out.length, 'ayahs', out.reduce((n, s) => n + s.a.length, 0), 'basmalas retirées', stripped);
console.log(out[1].a[0], '|', out[95].a[0], '|', out[8].a[0].slice(0, 30));
