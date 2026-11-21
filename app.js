/* Tasmīʿ — récitation de mémoire.
   Le suivi de la voix est fait par le moteur libre Tilawa (vendor/tilawa.js), entièrement sur l'appareil.
   Ce fichier décide seulement de ce qui s'affiche : un mot reste caché tant qu'il n'a pas été récité juste,
   une erreur fait un bip sans montrer le mot, et la correction n'apparaît que si on la demande. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};

/* ---------- Texte (Ḥafṣ, graphie othmanienne), découpé en mots comme le moteur les compte ---------- */
let QURAN = null;
// Trois ayahs où le texte affiché écrit en un mot ce que le moteur compte en deux.
const MERGED = { '2:181': 3, '8:6': 4, '13:37': 8 };
const dispIdx = (s, a, w) => { const m = MERGED[s + ':' + a]; return m !== undefined && w > m ? w - 2 : w - 1; };

/* ---------- Session ---------- */
let S = null;      // { surah, from, to, words[], start{ayah→index}, cursor, finished, added[] }
let els = [];

function build(surah, from, to){
  const words = [], start = {};
  for(let an = from; an <= to; an++){
    start[an] = words.length;
    for(const text of QURAN[surah - 1].a[an - 1])
      words.push({ text, ayah: an, state: 'hidden', shown: false, said: false, sus: new Set(), err: null, pend: null, end: 0 });
    if(words.length) words[words.length - 1].end = an;
  }
  return { surah, from, to, words, start, cursor: -1, finished: false, added: [], doubts: new Map(), stalled: false };
}
// Position d'un mot donné par le moteur ({surah, ayah, word}) dans le passage, ou -1 s'il est ailleurs.
function idxOf(ref){
  if(!ref || ref.surah !== S.surah || ref.ayah < S.from || ref.ayah > S.to) return -1;
  const a = S.start[ref.ayah], b = (S.start[ref.ayah + 1] ?? S.words.length) - 1;
  return Math.max(a, Math.min(b, a + dispIdx(ref.surah, ref.ayah, ref.word)));
}
function spanStart(ref){
  if(!ref || ref.surah !== S.surah) return -1;
  if(ref.ayah < S.from) return 0;
  return idxOf(ref);
}

const isErr = st => st === 'wrong' || st === 'skipped';
function setState(i, state){
  const w = S.words[i];
  w.state = state;
  const el = els[i];
  el.dataset.s = state;
  el.classList.toggle('shown', w.shown);
  el.classList.toggle('doubt', (w.sus.size > 0 || !!w.pend) && state === 'hidden');
}

/* ---------- Ce que dit le moteur → ce qui s'affiche ---------- */
const CONF = 0.75;        // confiance minimale pour considérer un mot comme récité
const LOW_COST = 0.05;    // écart phonétique maximal quand la confiance est partagée entre plusieurs endroits du Coran

const EXACT = 0.01;       // écart quasi nul : ce qui est entendu correspond exactement au texte
const STALL_MS = 2500;    // doute qui dure autant sans avancer : on prévient

function onEvent(e){
  if(!S || S.finished) return;
  if(e.type === 'position') onPosition(e);
  else if(e.type === 'checker') onChecker(e);
  if(e.timeMs != null) stall(e.timeMs);
}
// La récitation ne correspond plus au texte depuis un moment (par exemple une autre ayah) : un bip, sans rien montrer.
function stall(now){
  if(S.stalled || !S.doubts.size) return;
  let since = Infinity;
  for(const t of S.doubts.values()) since = Math.min(since, t);
  if(now - since < STALL_MS) return;
  S.stalled = true;
  buzz();
  setStatus('Je ne reconnais plus le passage à partir de la case entourée. Reprenez-le, ou touchez « Voir un mot ».');
}

function onPosition(e){
  const cands = [];
  for(const c of e.observed){
    const end = idxOf(c.word);
    if(end >= 0) cands.push({ c, end, start: spanStart(c.span.start) });
  }
  if(!cands.length) return;
  let pick = null;
  const top = e.observed[0], first = cands[0];
  if(e.state === 'locked' && first.c === top){
    const follows = first.start >= 0 && first.start <= S.cursor + 1;
    if(top.confidence >= CONF || (follows && top.confidence >= 0.5 && top.cost <= LOW_COST && !anyDoubt())) pick = first;
  } else if(e.state === 'ambiguous' || e.state === 'acquiring'){
    // Plusieurs endroits du Coran correspondent (basmala, formules répétées) : on ne retient que la suite directe du passage.
    const cont = cands.filter(x => x.end > S.cursor && x.start >= 0 && x.start <= S.cursor + 1 && x.c.cost <= LOW_COST);
    if(cont.length === 1) pick = cont[0];
  }
  if(!pick || pick.start < 0) return;
  if(pick.end <= S.cursor){
    // Retour en arrière : un mot en erreur récité juste devient « corrigé par vous ».
    const w = S.words[pick.end];
    if(isErr(w.state) && pick.c.confidence >= CONF){ w.said = true; setState(pick.end, 'fixed'); refresh(); }
    return;
  }
  let bad = false;
  // Mots sautés : entre le dernier mot récité et le début de ce que le moteur vient d'entendre.
  for(let i = S.cursor + 1; i < pick.start; i++){
    const w = S.words[i];
    if(w.state === 'hidden'){ setState(i, 'skipped'); bad = true; }
  }
  const exact = pick.c.cost <= EXACT;
  for(let i = Math.max(pick.start, S.cursor + 1); i <= pick.end; i++){
    const w = S.words[i];
    w.said = true;
    if(w.pend){
      // Erreur annoncée par le moteur avant que la récitation n'arrive à ce mot : on ne la garde
      // que si ce qu'il entend maintenant ne correspond pas exactement au texte.
      if(exact){ w.pend = null; }
      else { w.err = w.pend; w.pend = null; if(w.state === 'hidden'){ setState(i, 'wrong'); bad = true; } continue; }
    }
    if(w.state === 'hidden' && !w.sus.size) setState(i, 'ok');
  }
  S.cursor = pick.end;
  if(S.stalled && take) setStatus('Écoute en cours… récitez.');
  S.doubts.clear(); S.stalled = false;
  refresh();
  if(bad) buzz();
  if(S.cursor >= S.words.length - 1) scheduleFinish();
}
const anyDoubt = () => S.words.some(w => w.sus.size > 0);

function onChecker(e){
  const i = idxOf(e.location);
  if(i < 0) return;
  const w = S.words[i];
  // Doutes ouverts : s'ils durent sans que la récitation avance, on prévient par un bip (voir stall()).
  if(e.state === 'suspected'){ if(!S.doubts.has(e.id)) S.doubts.set(e.id, e.timeMs); }
  else S.doubts.delete(e.id);
  if(e.errorClass === 'added_word'){
    const k = S.added.findIndex(a => a.id === e.id);
    if(e.state === 'confirmed' && k < 0){ S.added.push({ id: e.id, i }); refresh(); buzz(); }
    else if(e.state === 'resolved' && k >= 0){ S.added.splice(k, 1); refresh(); }
    return;
  }
  if(e.state === 'suspected'){
    w.sus.add(e.id); setState(i, w.state);
  } else if(e.state === 'resolved' || e.state === 'uncertain'){
    w.sus.delete(e.id);
    if(e.state === 'resolved' && w.err === e.id && isErr(w.state)){ w.said = true; setState(i, 'fixed'); }
    else if(w.state === 'hidden' && w.said && !w.sus.size) setState(i, 'ok');
    else setState(i, w.state);
    refresh();
  } else if(e.state === 'confirmed'){
    w.sus.delete(e.id);
    if(w.state === 'hint' || w.state === 'fixed'){ setState(i, w.state); return; }
    let bad = false;
    const st = e.errorClass === 'wrong_word' ? 'wrong' : 'skipped';
    if(st === 'wrong' && i > S.cursor + 1 && w.state === 'hidden'){
      // Mot faux annoncé loin devant le mot courant : jugé quand la récitation y arrive.
      w.pend = e.id; setState(i, w.state); return;
    }
    if(w.state === 'hidden' || w.state === 'ok'){ w.shown = false; w.err = e.id; setState(i, st); bad = true; }
    if(st === 'skipped'){
      // Passage sauté : le moteur donne le premier mot ; les suivants non récités jusqu'au mot courant le sont aussi.
      for(let j = i + 1; j < S.cursor; j++){
        const x = S.words[j];
        if(x.state !== 'hidden' || x.said) break;
        setState(j, 'skipped'); bad = true;
      }
    }
    refresh();
    if(bad) buzz();
  }
}
// Fin d'une prise : les doutes encore ouverts sont levés (le moteur n'a pas pu trancher).
function settle(){
  if(!S) return;
  S.doubts.clear(); S.stalled = false;
  S.words.forEach((w, i) => {
    w.pend = null;
    if(!w.sus.size) return;
    w.sus.clear();
    setState(i, w.state === 'hidden' && w.said ? 'ok' : w.state);
  });
  refresh();
}

// « Voir un mot » : c'est vous qui demandez à voir le mot suivant.
function hint(){
  if(!S || S.finished) return;
  closePop();
  const i = S.cursor + 1;
  if(i >= S.words.length) return;
  const w = S.words[i];
  if(w.state === 'hidden'){ w.sus.clear(); setState(i, 'hint'); }
  else if(isErr(w.state) && !w.shown){ w.shown = true; setState(i, w.state); }
  S.cursor = i;
  refresh();
  if(S.cursor >= S.words.length - 1) scheduleFinish();
}

/* ---------- Bip d'erreur ---------- */
let audioCtx = null, lastBuzz = 0;
function beepCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function buzz(){
  if(!$('soundToggle').checked) return;
  const now = performance.now();
  if(now - lastBuzz < 900) return;
  lastBuzz = now;
  try{
    const c = beepCtx(); if(c.state === 'suspended') c.resume();
    const t0 = c.currentTime + 0.01;
    for(const dt of [0, 0.16]){
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 196;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.12);
      o.connect(g); g.connect(c.destination);
      o.start(t0 + dt); o.stop(t0 + dt + 0.13);
    }
  }catch{}
}

/* ---------- Affichage ---------- */
const arNum = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
function render(){
  const page = $('page');
  page.textContent = ''; els = [];
  const frag = document.createDocumentFragment();
  S.words.forEach((w, i) => {
    const el = document.createElement('span');
    el.className = 'w'; el.dataset.s = 'hidden'; el.dataset.i = i;
    const t = document.createElement('span'); t.className = 't'; t.textContent = w.text;
    el.appendChild(t); frag.appendChild(el); els.push(el);
    frag.appendChild(document.createTextNode(' '));
    if(w.end){
      const e = document.createElement('span'); e.className = 'end'; e.textContent = '۝' + arNum(w.end);
      frag.appendChild(e); frag.appendChild(document.createTextNode(' '));
    }
  });
  page.appendChild(frag);
  $('done').hidden = true;
  refresh();
}
function moveCursor(){
  const old = document.querySelector('.w.cur'); if(old) old.classList.remove('cur');
  if(!S || S.finished) return;
  const i = S.cursor + 1;
  if(i >= els.length) return;
  els[i].classList.add('cur');
  const r = els[i].getBoundingClientRect();
  if(r.bottom > innerHeight - 200 || r.top < 80) els[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function counts(){
  const c = { hidden:0, ok:0, wrong:0, skipped:0, fixed:0, hint:0 };
  for(const w of S.words) c[w.state]++;
  return c;
}
const LABEL = { wrong: 'mot erroné', skipped: 'mot oublié', fixed: 'corrigé par vous' };
function refresh(){
  const c = counts();
  const total = S.words.length, done = total - c.hidden;
  $('nDone').textContent = done; $('nLeft').textContent = c.hidden;
  $('nErr').textContent = c.wrong; $('nSkip').textContent = c.skipped;
  $('nHint').textContent = c.hint; $('nFix').textContent = c.fixed;
  $('score').textContent = done ? Math.round(100 * c.ok / done) + ' %' : '—';
  $('bar').style.width = (total ? 100 * done / total : 0) + '%';

  const log = $('log'); log.textContent = '';
  const row = (cls, ref, text) => {
    const li = document.createElement('li'); li.className = cls;
    const r = document.createElement('span'); r.className = 'ref'; r.textContent = ref; li.appendChild(r);
    if(text){ const ar = document.createElement('span'); ar.className = 'ar'; ar.lang = 'ar'; ar.textContent = text; li.appendChild(ar); }
    log.appendChild(li);
  };
  S.words.forEach(w => {
    if(isErr(w.state) || w.state === 'fixed')
      row(w.state, S.surah + ':' + w.ayah + ' · ' + LABEL[w.state], w.shown || w.state === 'fixed' ? w.text : '');
  });
  for(const a of S.added) row('added', S.surah + ':' + S.words[a.i].ayah + ' · mot en trop', '');
  $('logEmpty').style.display = log.children.length ? 'none' : '';
  moveCursor();
}
let finishTimer = 0;
function scheduleFinish(){
  if(finishTimer || !S || S.finished) return;
  // On laisse au moteur le temps d'entendre la fin du dernier mot avant de conclure.
  finishTimer = setTimeout(async () => {
    finishTimer = 0;
    if(!S || S.finished || S.cursor < S.words.length - 1) return;
    await micStop(true);
    S.finished = true;
    showDone();
  }, take && take.fast ? 0 : 1300);
}
function showDone(){
  const c = counts(), total = S.words.length;
  const pct = total ? Math.round(100 * c.ok / total) : 0;
  const mistakes = c.wrong + c.skipped + c.fixed + S.added.length;
  const d = $('done'); d.textContent = '';
  const b = document.createElement('b');
  b.textContent = mistakes === 0 && c.hint === 0 ? 'Récitation parfaite — ما شاء الله' : 'Récitation terminée : ' + pct + ' % de précision';
  const p = document.createElement('div');
  p.textContent = total + ' mots · ' + c.wrong + ' erreur(s) · ' + c.skipped + ' oubli(s) · ' + c.fixed + ' corrigé(s) · ' + c.hint + ' mot(s) demandé(s)' + (S.added.length ? ' · ' + S.added.length + ' mot(s) en trop' : '') + '.';
  d.append(b, p);
  if(S.words.some(w => isErr(w.state) && !w.shown)){
    const btn = document.createElement('button'); btn.className = 'btn'; btn.type = 'button'; btn.textContent = 'Voir les corrections';
    btn.onclick = () => { S.words.forEach((w, i) => { if(isErr(w.state)){ w.shown = true; setState(i, w.state); } }); refresh(); btn.remove(); };
    d.appendChild(btn);
  }
  d.hidden = false;
  moveCursor();
  setStatus('Terminé. « Recommencer » pour refaire le passage.');
  d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function setStatus(msg, bad){ const s = $('status'); s.textContent = msg; s.classList.toggle('bad', !!bad); }

/* Menu d'une case en erreur : voir le mot, ou annuler l'erreur. Rien n'est montré sans votre choix. */
let popI = -1;
function closePop(){ $('pop').hidden = true; popI = -1; }
$('page').addEventListener('click', e => {
  const el = e.target.closest('.w'); if(!el || !S) return;
  const i = +el.dataset.i, w = S.words[i];
  if(!isErr(w.state) && w.state !== 'fixed'){ closePop(); return; }
  if(popI === i){ closePop(); return; }
  popI = i;
  $('popHead').textContent = ({ wrong: 'Mot erroné', skipped: 'Mot oublié', fixed: 'Erreur corrigée par vous' })[w.state];
  $('popShow').hidden = w.shown || w.state === 'fixed';
  const pop = $('pop'); pop.hidden = false;
  const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), innerWidth - pw - 8);
  let y = r.bottom + 8; if(y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
  e.stopPropagation();
});
$('popShow').addEventListener('click', () => {
  if(popI < 0) return;
  const w = S.words[popI]; w.shown = true; setState(popI, w.state); closePop(); refresh();
});
$('popOk').addEventListener('click', () => {
  if(popI < 0) return;
  const i = popI, w = S.words[i]; w.shown = false; w.said = true; w.err = null; setState(i, 'ok');
  closePop(); refresh();
  if(S.finished) showDone();
});
document.addEventListener('click', e => { if(!e.target.closest('#pop')) closePop(); });
addEventListener('scroll', closePop, { passive: true });

/* ---------- Moteur Tilawa ---------- */
let MOD = null, TL = null;
const ASSETS = new URL('./tilawa/v1/', location.href).href;
function engineFail(err){
  $('mic').disabled = true;
  setStatus('Le moteur vocal n\'a pas pu démarrer (' + ((err && err.message) || err) + ').', true);
}
async function loadEngine(){
  setStatus('Chargement du moteur vocal…');
  try{
    MOD = await import('./vendor/tilawa.js');
    const part = { model: 0, reference: 0, warmup: 0 };
    TL = await MOD.createTilawa({
      assetBase: ASSETS, tier: 'auto', providers: ['wasm'], threads: 1,
      onProgress: p => {
        part[p.stage] = p.fraction;
        if(!TL) setStatus('Chargement du moteur vocal… ' + Math.round(100 * (part.model * 0.75 + part.reference * 0.2 + part.warmup * 0.05)) + ' %');
      }
    });
    $('mic').disabled = false;
    setStatus('Prêt. Appuyez sur le micro et récitez : le texte reste caché.');
    offlineBadge();
  }catch(err){ engineFail(err); }
}

/* ---------- Une prise : une session du moteur et le micro ---------- */
let take = null, starting = false, wakeLock = null;
function setMic(on){
  $('mic').setAttribute('aria-pressed', on ? 'true' : 'false');
  $('mic').setAttribute('aria-label', on ? 'Mettre en pause' : 'Démarrer la récitation');
  if(!on) $('mic').classList.remove('voice');
}
function newSession(){
  const next = S.words[Math.min(S.cursor + 1, S.words.length - 1)];
  // « next-word » : une erreur est confirmée dès que le mot suivant commence.
  const session = TL.startMemorization({ surah: S.surah, fromAyah: next.ayah, toAyah: S.to }, { confirm: { after: 'next-word' } });
  session.subscribe(onEvent);
  return session;
}
function micStart(){
  if(take || starting || !TL || !S || S.finished) return;
  let prepared;
  // Sans attendre : iOS n'ouvre le son que pendant le geste de l'utilisateur.
  try{ prepared = MOD.prepareMicrophone(); beepCtx().resume(); }catch(err){ micError(err); return; }
  starting = true;
  const session = newSession();
  TL.listen(session, { prepared, onLevel: db => $('mic').classList.toggle('voice', db > -42) }).then(async mic => {
    take = { session, mic };
    setMic(true);
    setStatus('Écoute en cours… récitez.');
    try{ if(navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }catch{}
  }).catch(err => {
    try{ session.dispose(); }catch{}
    micError(err);
  }).finally(() => { starting = false; });
}
function micError(err){
  const r = err && err.reason;
  setStatus(r === 'denied' ? 'Micro refusé. Autorisez le micro pour cette page (icône à gauche de l\'adresse ; sur iPhone : Réglages › Safari › Micro), puis réessayez.'
          : r === 'insecure-context' ? 'Micro indisponible ici : la page doit être ouverte en https ou sur localhost.'
          : r === 'unavailable' ? 'Aucun micro détecté.'
          : 'Impossible d\'ouvrir le micro (' + ((err && err.message) || err) + ').', true);
}
async function micStop(quiet){
  const t = take;
  if(!t) return;
  take = null; setMic(false);
  try{ await t.mic.stop(); }catch{}     // termine aussi la session : ses derniers événements arrivent avant la suite
  try{ t.session.dispose(); }catch{}
  try{ if(wakeLock){ wakeLock.release(); wakeLock = null; } }catch{}
  settle();
  if(!quiet && S && !S.finished) setStatus('En pause. Appuyez sur le micro pour reprendre.');
}
$('mic').addEventListener('click', () => { if(take) micStop(); else micStart(); });
document.addEventListener('visibilitychange', () => { if(document.hidden && take) micStop(); });
addEventListener('pagehide', () => { if(take) micStop(true); });
$('hintBtn').addEventListener('click', hint);
$('resetBtn').addEventListener('click', async () => { await micStop(true); start(); });
document.addEventListener('keydown', e => {
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if(e.code === 'Space'){ e.preventDefault(); $('mic').click(); }
  else if(e.key === 'i' || e.key === 'I') hint();
});
$('soundToggle').addEventListener('change', e => store.set('tasmi:sound', e.target.checked));

/* ---------- Sélection du passage ---------- */
function start(){
  const n = +$('surah').value || 1;
  const meta = QURAN[n - 1];
  if(!meta) return;
  const count = meta.a.length;
  const from = Math.min(Math.max(1, +$('from').value || 1), count);
  const to = Math.min(Math.max(from, +$('to').value || count), count);
  $('from').value = from; $('to').value = to; $('from').max = count; $('to').max = count;
  store.set('tasmi:prefs', { n, from, to });
  $('surahAr').textContent = meta.ar;
  $('rangeLabel').textContent = n + '. ' + meta.fr + ' — ayahs ' + from + ' à ' + to;
  closePop(); clearTimeout(finishTimer); finishTimer = 0;
  S = build(n, from, to);
  render();
  if(TL) setStatus('Prêt. Appuyez sur le micro et récitez : le texte reste caché.');
}
$('surah').addEventListener('change', async () => {
  await micStop(true);
  const meta = QURAN[+$('surah').value - 1];
  $('from').value = 1; $('to').value = meta ? meta.a.length : 1;
  start();
});
for(const id of ['from', 'to']) $(id).addEventListener('change', async () => { await micStop(true); start(); });

/* ---------- Hors ligne et installation ---------- */
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
let swOn = false;
async function offlineBadge(){
  const b = $('badge');
  if(!swOn){ if(local){ b.hidden = false; b.textContent = 'Sur ce PC, sans Internet ✓'; b.classList.add('ok'); } return; }
  const all = self.TASMI_APP.concat(self.TASMI_BIG);
  b.hidden = false;
  for(;;){
    let n = 0;
    try{ for(const u of all) if(await caches.match(u, { ignoreSearch: true })) n++; }catch{ b.hidden = true; return; }
    if(n >= all.length && TL){ b.textContent = 'Hors ligne : prêt ✓'; b.classList.add('ok'); return; }
    b.textContent = 'Copie hors ligne… ' + Math.min(99, Math.round(100 * n / all.length)) + ' %';
    await new Promise(r => setTimeout(r, 2500));
  }
}
if('serviceWorker' in navigator && (!local || /[?&]sw=1/.test(location.search))){
  swOn = true;
  navigator.serviceWorker.register('./sw.js').then(offlineBadge).catch(() => {});
} else offlineBadge();
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if(ios && !navigator.standalone && !store.get('tasmi:noInstall', false)) $('install').hidden = false;
$('installClose').addEventListener('click', () => { $('install').hidden = true; store.set('tasmi:noInstall', true); });

/* ---------- Démarrage ---------- */
(async () => {
  $('soundToggle').checked = store.get('tasmi:sound', true);
  try{
    const r = await fetch('./data/quran.json');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    QURAN = await r.json();
  }catch{
    $('page').innerHTML = '<p class="note bad">Le texte du Coran n\'a pas pu être chargé. Rechargez la page.</p>';
    return;
  }
  const sel = $('surah'); sel.textContent = '';
  for(const s of QURAN){
    const o = document.createElement('option'); o.value = s.n;
    o.textContent = s.n + '. ' + s.fr + ' — ' + s.ar.replace(/^سُورَةُ\s*/, '');
    sel.appendChild(o);
  }
  const p = store.get('tasmi:prefs', null);
  if(p && QURAN[p.n - 1]){ sel.value = p.n; $('from').value = p.from; $('to').value = p.to; }
  else { sel.value = 1; $('from').value = 1; $('to').value = 7; }
  start();
  loadEngine();
})();

/* Outil de test : faire écouter des fichiers audio au moteur comme s'ils venaient du micro. */
window.tasmi = {
  hint, get state(){ return S; }, get engine(){ return TL; },
  async feed(urls, cuts){
    const session = newSession(), log = [];
    session.subscribe(e => { if(e.type === 'checker') log.push(e.state + ' ' + e.errorClass + ' @' + e.location.ayah + ':' + e.location.word); });
    take = { session, mic: { stop: () => session.end() }, fast: true };
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    for(const url of [].concat(urls)){
      if(!take) break;
      const ab = await new OC(1, 1, 16000).decodeAudioData(await (await fetch(url)).arrayBuffer());
      let d = ab.getChannelData(0);
      const cut = cuts && cuts[url]; if(cut) d = d.subarray(Math.floor(cut[0] * 16000), Math.floor(cut[1] * 16000));
      for(let i = 0; i < d.length && take; i += 4800) await session.pushAudio(d.subarray(i, i + 4800), 16000).catch(() => {});
      if(take) await session.pushAudio(new Float32Array(12800), 16000).catch(() => {});
    }
    await micStop(true);
    return log;
  }
};
})();
