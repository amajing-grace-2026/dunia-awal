// ===== Dunia Awal — logika simulasi =====
'use strict';

let S = null;
const R01 = () => S.rnd();
const pick = a => a[(S.rnd() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const has = id => S.tech.has(id);
const ageY = h => (S.day - h.born) / YEAR_DAYS;
const yearOf = d => Math.floor(d / YEAR_DAYS) + 1;
const gauss = () => (R01() + R01() + R01() - 1.5) / 1.5;

function initSim(seed) {
  const world = genWorld(seed);
  S = {
    seed, world, rnd: mulberry32(seed ^ 0x9e3779b9),
    simTime: 6 * 3600, day: 0, real: 0, speedIdx: 0, paused: true, over: false, lag: false,
    humans: [], alive: [], byId: new Map(), nextId: 1,
    households: new Map(), nextHH: 1, villages: [],
    tech: new Set(), techLog: [], availTechs: [], lightning: 0, deathSeen: false,
    flora: genFlora(world), animals: genAnimals(world), floraDirty: true, floraCount0: 0,
    weather: { type: 'cerah', temp: 14, windA: 0.6, windS: 3, cloud: 0.25 }, drought: 0, harsh: 0,
    stats: {
      born: 0, deaths: 0, causes: {}, peak: 2, peakYear: 1, popHist: [], milestones: [], arts: 0, songs: 0, stories: 0,
      toolsMade: 0, toolsFixed: 0, maxGen: 1, marriages: 0, disasters: [], yearAgg: { born: 0, died: 0, causes: {} },
      firstOf: {}, oldest: null,
    },
    logQueue: [], keyLogs: [], budget: 4, impBudget: 8, thoughtBudget: 1,
  };
  S.floraCount0 = S.flora.length;

  // Taman awal: tepi danau
  const L = world.lake;
  let spot = null;
  for (let k = 0; k < 80 && !spot; k++) {
    const a = S.rnd() * 6.283, d = Math.max(L.rx, L.ry) + 40 + S.rnd() * 60;
    const x = L.x + Math.cos(a) * d, y = L.y + Math.sin(a) * d, t = world.typeAt(x, y);
    if (t === 4 || t === 9 || t === 5) spot = { x, y };
  }
  spot = spot || { x: L.x + L.rx + 50, y: L.y };
  const v0 = makeVillage('Taman Awal', spot.x, spot.y);
  const hh = makeHousehold(v0, spot.x, spot.y);
  const adam = makeHuman({ name: 'Adam', sex: 'L', age: 20, vil: v0.id, hh: hh.id, x: spot.x - 4, y: spot.y,
    traits: { cur: 0.75, cre: 0.6, soc: 0.6, bra: 0.75, kin: 0.7, agg: 0.25, str: 0.75 } });
  const hawa = makeHuman({ name: 'Hawa', sex: 'P', age: 19, vil: v0.id, hh: hh.id, x: spot.x + 4, y: spot.y,
    traits: { cur: 0.7, cre: 0.75, soc: 0.75, bra: 0.5, kin: 0.8, agg: 0.15, str: 0.5 } });
  adam.partner = hawa.id; hawa.partner = adam.id; adam.love = hawa.love = 0.9;
  hh.food = 6;
  // makanan liar melimpah
  for (const f of S.flora) if (f.kind === 'buah' || f.kind === 'semak') f.fruit = 1;
  log('alam', '🌍 Dunia baru tercipta: gunung menjulang, sungai mengalir ke danau, hutan dan padang rumput penuh kehidupan.', 3);
  log('lahir', '👫 Adam dan Hawa membuka mata untuk pertama kalinya di tepi danau, di sebuah taman yang subur.', 3);
  milestone('Adam dan Hawa hadir di dunia');
  updateAvailTechs();
  return S;
}

function makeVillage(name, x, y) {
  const v = { id: S.villages.length, name, x, y, founded: S.day, forage: 1, game: 1, fish: 1, fields: 0, fieldSpots: [],
    herd: { kambing: 0, sapi: 0, ayam: 0, kuda: 0 }, leader: 0, pop: 0, sick: 0, epidemic: 0, farmers: 0, alive: true,
    waterD: nearWater(S.world, x, y, 200), waterSpot: null };
  // titik air terdekat
  for (let d = 10; d <= 260 && !v.waterSpot; d += 10) for (let a = 0; a < 6.283; a += 0.4) {
    const wx = x + Math.cos(a) * d, wy = y + Math.sin(a) * d, t = S.world.typeAt(wx, wy);
    if (t === 1 || t === 2) { v.waterSpot = { x: wx - Math.cos(a) * 8, y: wy - Math.sin(a) * 8 }; break; }
  }
  S.villages.push(v);
  return v;
}
function makeHousehold(v, x, y) {
  const hh = { id: S.nextHH++, vil: v.id, members: [], food: 0, shelter: 0, build: 0, x, y };
  S.households.set(hh.id, hh); return hh;
}
function homeSpot(v) {
  for (let k = 0; k < 40; k++) {
    const a = S.rnd() * 6.283, d = 18 + S.rnd() * (30 + Math.sqrt(v.pop + 1) * 9);
    const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d, t = S.world.typeAt(x, y);
    if (t >= 3 && t <= 6 || t === 9) return { x, y };
  }
  return { x: v.x + gauss() * 20, y: v.y + gauss() * 20 };
}

function inheritTraits(fa, mo) {
  const t = {};
  for (const k of ['cur', 'cre', 'soc', 'bra', 'kin', 'agg', 'str']) {
    const base = fa && mo ? (fa.traits[k] + mo.traits[k]) / 2 : 0.5;
    t[k] = clamp(base + gauss() * 0.28, 0.02, 0.99);
  }
  return t;
}

function makeHuman(o) {
  const h = {
    id: S.nextId++, name: o.name, sex: o.sex, born: S.day - Math.round((o.age || 0) * YEAR_DAYS), gen: o.gen || 1,
    father: o.father || 0, mother: o.mother || 0, partner: 0, kids: [], alive: true, died: null, cause: '', causeText: '',
    hh: o.hh, vil: o.vil, x: o.x, y: o.y, tx: o.x, ty: o.y, task: 'main', taskDay: -1,
    hunger: 0, energy: 1, health: 1, happy: 0.7, grief: 0, griefFor: '', fear: 0, fearFor: '', lonely: 0.15, love: 0,
    traits: o.traits || inheritTraits(o.fa, o.mo),
    skills: { kumpul: 0.1, buru: 0.1, ikan: 0.05, tani: 0.05, ternak: 0.05, kriya: 0.1, bangun: 0.1, seni: 0.1 },
    tools: {}, preg: null, lastBirth: -9999, sick: null, injured: 0, inventions: [], arts: 0, respect: 0,
    thought: '', want: '', widowed: false, leader: false,
  };
  S.humans.push(h); S.alive.push(h); S.byId.set(h.id, h);
  const hh = S.households.get(h.hh); if (hh) hh.members.push(h.id);
  if (h.gen > S.stats.maxGen) { S.stats.maxGen = h.gen; if (h.gen > 2) milestone(`Generasi ke-${h.gen} lahir`); }
  return h;
}

// ===== Logging =====
function stamp() {
  const d = S.day, y = yearOf(d), doy = d % YEAR_DAYS;
  return { y, doy, hr: Math.floor((S.simTime / 3600) % 24) };
}
// imp: 3 selalu, 2 penting (dibatasi longgar), 1 biasa (sampel), 0 pikiran
function log(type, text, imp = 1) {
  if (imp === 2) { if (S.impBudget < 1) return false; S.impBudget--; }
  else if (imp === 1) { if (S.budget < 1) return false; S.budget--; }
  else if (imp === 0) { if (S.thoughtBudget < 1) return false; S.thoughtBudget--; }
  const e = { ...stamp(), type, text, imp };
  S.logQueue.push(e);
  if (imp >= 3) S.keyLogs.push(e);
  return true;
}
function milestone(text) { S.stats.milestones.push({ day: S.day, text }); }
function first(key, text) { if (S.stats.firstOf[key]) return false; S.stats.firstOf[key] = S.day; milestone(text); return true; }
const popCount = () => S.alive.length;
const notable = h => h.gen <= 2 || h.inventions.length > 0 || h.leader;
const bigWorld = () => popCount() > 45;
const fast = () => SPEEDS[S.speedIdx].f >= SPEEDS[3].f;

// ===== Waktu =====
function advance(realDt) {
  if (S.paused || S.over) return;
  S.real += realDt;
  S.budget = Math.min(5, S.budget + realDt * 2.2);
  S.impBudget = Math.min(10, S.impBudget + realDt * 5);
  S.thoughtBudget = Math.min(2, S.thoughtBudget + realDt * 0.7);
  const target = S.simTime + realDt * SPEEDS[S.speedIdx].f;
  const t0 = performance.now();
  S.lag = false;
  while (Math.floor(target / DAY) > S.day) {
    dailyTick();
    if (S.over) return;
    if (performance.now() - t0 > 28) { S.lag = true; S.simTime = (S.day + 0.999) * DAY; break; }
    S.simTime = S.day * DAY + 1;
  }
  if (!S.lag) S.simTime = target;
  if (S.real >= MAX_REAL_SECONDS && !S.unlimited) endSim('waktu');
}

function season() { return SEASONS[Math.floor((S.day % YEAR_DAYS) / 91.25)]; }

function dailyTick() {
  S.day++;
  const doy = S.day % YEAR_DAYS, se = season();
  if (doy === 0) yearEnd();
  weatherDay(se, doy);
  ecologyDay(se);
  for (const v of S.villages) { v.pop = 0; v.sick = 0; v.farmersToday = 0; }
  for (const h of S.alive) { const v = S.villages[h.vil]; v.pop++; if (h.sick) v.sick++; }
  if (S.day % 7 === 0) updateAvailTechs();
  if (!S.rDay) { S.rDay = {}; S.research = {}; }
  const spoil = (has('lumbung') ? 0.005 : has('gerabah') ? 0.012 : has('api') ? 0.02 : 0.03) * (se.name === 'Dingin' ? 0.5 : 1);
  for (const hh of S.households.values()) hh.food *= 1 - spoil;
  const list = S.alive;
  for (let i = 0; i < list.length; i++) { const h = list[i]; if (h.alive) humanDay(h, se, doy); }
  researchDay();
  eatDay();
  if (S.day % 2 === 0) marriageDay();
  if (S.day % 30 === 15) monthlyVillage(se);
  if (S.day % 3 === 0) conflictDay();
  // bersihkan yang wafat
  if (S.alive.some(h => !h.alive)) S.alive = S.alive.filter(h => h.alive);
  const p = popCount();
  if (p > S.stats.peak) { S.stats.peak = p; S.stats.peakYear = yearOf(S.day); }
  for (const m of [10, 50, 100, 250, 500, 1000]) if (p >= m) first('pop' + m, `Populasi mencapai ${m} jiwa`);
  if (p === 0) endSim('punah');
}

function yearEnd() {
  const y = yearOf(S.day) - 1, A = S.stats.yearAgg;
  S.stats.popHist.push({ y, pop: popCount(), tech: S.tech.size, vil: S.villages.filter(v => v.alive).length });
  if (fast() && (A.born || A.died)) {
    const cs = Object.entries(A.causes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${CAUSES[k]}`).join(', ');
    log('statistik', `📊 Rangkuman tahun ${y}: ${A.born} bayi lahir, ${A.died} orang wafat${cs ? ' (' + cs + ')' : ''}. Populasi kini ${popCount()} jiwa.`, 3);
  }
  S.stats.yearAgg = { born: 0, died: 0, causes: {} };
  // rasa hormat & pemimpin
  for (const v of S.villages) if (v.alive && (v.pop >= 25 || has('hukum'))) electLeader(v);
  jobYear();
  // peristiwa tahunan
  if (S.rnd() < 0.07) { S.drought = 50 + ((S.rnd() * 40) | 0); disaster('🌵 Kemarau panjang melanda. Sungai menyusut dan tanaman layu.'); }
  if (S.rnd() < 0.08) { S.harsh = 1; }
  else S.harsh = 0;
  if (S.rnd() < 0.004 && popCount() > 5) earthquake();
}

function electLeader(v) {
  let best = null, bs = -1;
  for (const h of S.alive) {
    if (h.vil !== v.id || ageY(h) < 25) continue;
    const s = h.respect + ageY(h) * 0.05 + h.traits.kin * 2 + h.traits.soc + h.inventions.length * 2 - h.traits.agg;
    if (s > bs) { bs = s; best = h; }
  }
  if (best && best.id !== v.leader) {
    const old = S.byId.get(v.leader); if (old) old.leader = false;
    v.leader = best.id; best.leader = true;
    log('sosial', `👑 ${best.name} (${Math.floor(ageY(best))} th) dipercaya menjadi pemimpin ${v.name}.`, 2);
    first('leader', `Pemimpin pertama: ${best.name} di ${v.name}`);
  }
}

// ===== Cuaca =====
function weatherDay(se, doy) {
  const w = S.weather, r = S.rnd();
  if (S.drought > 0) S.drought--;
  let rainP = se.rain * (S.drought > 0 ? 0.25 : 1);
  if (w.type === 'hujan' || w.type === 'badai') rainP += 0.22;
  w.temp = Math.round(se.temp + gauss() * 4 - (S.harsh && se.name === 'Dingin' ? 7 : 0) + (S.drought ? 3 : 0));
  if (r < rainP) {
    const storm = S.rnd() < 0.16;
    w.type = w.temp <= 1 ? (storm ? 'badai salju' : 'salju') : storm ? 'badai' : 'hujan';
  } else w.type = S.rnd() < 0.4 ? 'berawan' : 'cerah';
  w.windA += gauss() * 0.4;
  w.windS = clamp((w.type.startsWith('badai') ? 11 : 3) + gauss() * 3, 0.5, 18);
  w.cloud = { cerah: 0.15, berawan: 0.55, hujan: 0.8, salju: 0.75, badai: 1, 'badai salju': 1 }[w.type];
  if (S.lightning > 0) S.lightning--;
  if (w.type === 'badai') {
    if (S.rnd() < 0.5) { S.lightning = 12; S.flash = 1; }
    if (S.alive.length && !has('api') && S.day - (S.lastBoltLog || -999) > 90 && (S.lastBoltLog = S.day)) log('alam', '⚡ Petir menyambar sebatang pohon hingga terbakar. Manusia memandang api itu dengan takjub dan takut.', 1);
    if (se.name === 'Semi' && S.rnd() < 0.03) flood();
    if ((se.name === 'Panas' || S.drought) && S.rnd() < 0.06) forestFire();
  }
  if (w.type === 'badai salju' && S.rnd() < 0.3) log('alam', '🌨️ Badai salju menerjang. Semua orang meringkuk mencari kehangatan.', 1);
}

function disaster(text, imp = 3) { S.stats.disasters.push({ day: S.day, text }); log('alam', text, imp); }

function flood() {
  const hit = S.villages.filter(v => v.alive && v.waterD < 70);
  if (!hit.length) return;
  const v = pick(hit);
  disaster(`🌊 Banjir besar! Sungai meluap dan merendam ${v.name}. Persediaan makanan hanyut.`);
  for (const hh of S.households.values()) if (hh.vil === v.id) { hh.food *= 0.4; if (S.rnd() < 0.3) hh.shelter = Math.max(0, hh.shelter - 1); }
  for (const h of S.alive) if (h.vil === v.id && S.rnd() < 0.004 + (ageY(h) < 6 ? 0.008 : 0)) die(h, 'bencana', 'terseret banjir');
}
function forestFire() {
  const trees = S.flora.filter(f => f.alive && (f.kind === 'pohon' || f.kind === 'pinus'));
  if (!trees.length) return;
  const c = pick(trees), rad = 90 + S.rnd() * 90;
  let n = 0;
  for (const f of S.flora) if (f.alive && Math.hypot(f.x - c.x, f.y - c.y) < rad && S.rnd() < 0.8) { f.alive = false; n++; }
  S.burns = S.burns || []; S.burns.push({ x: c.x, y: c.y, r: rad, day: S.day });
  S.floraDirty = true;
  if (n > 15) disaster(`🔥 Kebakaran hutan! Petir menyulut hutan kering, ${n} pohon hangus terbakar.`);
  for (const v of S.villages) if (v.alive && Math.hypot(v.x - c.x, v.y - c.y) < rad + 40) {
    v.forage *= 0.6; v.game *= 0.6;
    for (const h of S.alive) if (h.vil === v.id && S.rnd() < 0.01) die(h, 'bencana', 'terjebak kebakaran hutan');
  }
  if (!has('api')) S.lightning = 20;
}
function earthquake() {
  disaster('🌋 Gempa bumi mengguncang dunia! Tanah retak dan bebatuan berjatuhan dari gunung.');
  for (const hh of S.households.values()) if (hh.shelter > 0 && S.rnd() < 0.4) hh.shelter--;
  for (const h of S.alive) if (S.rnd() < 0.01) die(h, 'bencana', 'tertimpa reruntuhan gempa');
}

// ===== Ekologi =====
function ecologyDay(se) {
  const winter = se.name === 'Dingin';
  for (const v of S.villages) {
    if (!v.alive) continue;
    v.forage = Math.min(1, v.forage + 0.013 * (1 - v.forage) * (winter ? 0.3 : 1) * (S.drought ? 0.4 : 1));
    v.game = Math.min(1, v.game + 0.006 * (1 - v.game));
    v.fish = Math.min(1, v.fish + 0.01 * (1 - v.fish));
    if (v.epidemic > 0) v.epidemic--;
  }
  // hewan: kelahiran, kematian alami, predasi
  if (S.day % 3 === 0) {
    const cnt = {};
    for (const a of S.animals) if (a.alive) cnt[a.sp] = (cnt[a.sp] || 0) + 1;
    for (const sp of SPECIES) {
      const n = cnt[sp.id] || 0;
      const rate = n < 2 ? 0 : 0.03 * n * (1 - n / sp.cap) * (winter ? 0.3 : 1);
      if (S.rnd() < rate) {
        const par = S.animals.find(a => a.alive && a.sp === sp.id && S.rnd() < 0.3) || S.animals.find(a => a.alive && a.sp === sp.id);
        if (par) S.animals.push(makeAnimal(sp, par.x + gauss() * 15, par.y + gauss() * 15, S.rnd));
      }
    }
    for (const a of S.animals) if (a.alive && S.rnd() < 0.0018) a.alive = false;
    const preds = (cnt.serigala || 0) + (cnt.harimau || 0) + (cnt.beruang || 0);
    if (S.rnd() < preds * 0.02) { const prey = S.animals.find(a => a.alive && ['rusa', 'kelinci', 'kambing', 'ayam', 'babi'].includes(a.sp) && S.rnd() < 0.05); if (prey) prey.alive = false; }
    if (S.day % 30 === 0) S.animals = S.animals.filter(a => a.alive);
    // pohon tumbuh kembali
    const alive = S.flora.filter(f => f.alive).length;
    if (alive < S.floraCount0 && !winter) {
      for (let k = 0; k < 2; k++) {
        const src = pick(S.flora); if (!src.alive) { if (S.rnd() < 0.15) { src.alive = true; src.size *= 0.6; S.floraDirtySoft = true; } continue; }
      }
    }
    if (S.day % 60 === 0 && S.floraDirtySoft) { S.floraDirty = true; S.floraDirtySoft = false; }
  }
}

// ===== Teknologi =====
function updateAvailTechs() {
  const p = popCount();
  S.availTechs = TECHS.filter(t => !S.tech.has(t.id) && t.pre.every(x => S.tech.has(x)) && (!t.minPop || p >= t.minPop) && (!t.needDeath || S.deathSeen));
  S.availByTask = {};
  for (const t of S.availTechs) for (const c of t.ctx) (S.availByTask[c] = S.availByTask[c] || []).push(t);
}
let COST_SCALE = 1;
const techCost = t => (TECH_COST[t.id] || 500) * COST_SCALE;
// Setiap hari kerja yang relevan = satu "percobaan" kecil menuju salah satu penemuan yang mungkin.
function tryInvent(h, task) {
  const list = S.availByTask[task]; if (!list || !list.length) return;
  const t = list[(S.rnd() * list.length) | 0];
  if (S.tech.has(t.id)) return;
  const T = h.traits, job = h.job ? JOB[h.job] : null;
  let c = (0.3 + T.cur) * (0.3 + T.cre) * (job && job.research ? job.research : 1) * (task === 'riset' ? 1.5 : task === 'jelajah' ? 1.2 : 1);
  if (t.id === 'api' && S.lightning > 0) c *= 6;
  S.rDay[t.id] = (S.rDay[t.id] || 0) + c;
  let r = S.research[t.id];
  if (!r) r = S.research[t.id] = { p: 0, acc: 0, lead: h.id, logged: 0, start: S.day, need: 0.85 + S.rnd() * 0.3 };
  r.acc += c; if (S.rnd() < c / r.acc * 3) r.lead = h.id;
}
function researchDay() {
  const lit = (has('tulisan') ? 1.25 : 1) * (has('kertas') ? 1.15 : 1) * (has('cetak') ? 1.4 : 1) * (has('ilmiah') ? 1.6 : 1) * (has('listrik') ? 1.15 : 1) * (has('komputer') ? 1.4 : 1) * (has('internet') ? 1.4 : 1) * (has('ai') ? 1.5 : 1);
  for (const id in S.rDay) {
    if (S.tech.has(id)) continue;
    const r = S.research[id], t = TECH[id];
    r.p += Math.sqrt(S.rDay[id]) * lit;
    const cost = techCost(t) * r.need, f = r.p / cost, stage = Math.floor(f * 4);
    if (stage > r.logged && stage < 4) {
      r.logged = stage;
      const ld = S.byId.get(r.lead);
      if (ld && ld.alive && t.idx >= 12) log('riset', `🧪 ${ld.name} bereksperimen menuju ${t.icon} ${t.name} (±${stage * 25}%): ${pick(RESEARCH_FAIL)}.`, t.idx >= 40 ? 2 : 1);
    }
    // Masyarakat belum "siap" sebelum ~90% dari tahun target: kemajuan tertahan di ambang penemuan
    if (r.p >= cost && S.day / YEAR_DAYS < t.yr * 0.9) { r.p = cost * 0.97; continue; }
    if (r.p >= cost) { let ld = S.byId.get(r.lead); if (!ld || !ld.alive) ld = pick(S.alive.filter(x => ageY(x) >= 14)) || pick(S.alive); if (ld) discover(ld, t); }
  }
  S.rDay = {};
}
function discover(h, t) {
  S.tech.add(t.id);
  h.inventions.push(t.id); h.respect += 5; h.happy = Math.min(1, h.happy + 0.3);
  S.techLog.push({ id: t.id, name: t.name, icon: t.icon, day: S.day, who: h.name, whoId: h.id, age: Math.floor(ageY(h)) });
  const rs = S.research[t.id], yrs = rs ? (S.day - rs.start) / YEAR_DAYS : 0;
  S.techLog[S.techLog.length - 1].yrs = yrs;
  log('temu', `💡 PENEMUAN: ${t.icon} ${t.name} — ${t.story(h.name)}${yrs >= 1 ? ` (setelah ±${Math.round(yrs)} tahun percobaan dari generasi ke generasi)` : ''}`, 3);
  milestone(`${t.icon} ${t.name} ditemukan oleh ${h.name}`);
  // efek langsung
  if (t.id === 'domestikasi') { const v = S.villages[h.vil]; v.herd.kambing += 3; }
  if (t.id === 'berteduh') for (const hh of S.households.values()) if (hh.shelter < 1 && hh.vil === h.vil) hh.build = 0.5;
  // era
  const era = currentEra();
  if (era.id !== S.era) { if (S.era) { log('era', `🏛️ ERA BARU: Dunia memasuki ${era.name}.`, 3); milestone(`Memasuki ${era.name}`); } S.era = era.id; }
  updateAvailTechs();
}
function currentEra() {
  let e = ERAS[0];
  for (const x of ERAS) if (x.need.length && x.need.every(n => S.tech.has(n))) e = x;
  return e;
}

// ===== Alat =====
function toolBonus(h, act) {
  let b = 0;
  if (!h.hasTools) return 0;
  for (const tl of TOOLS) {
    if (!tl.act.includes(act) || !(h.tools[tl.id] > 0)) continue;
    b += tl.bonus;
    h.tools[tl.id] -= tl.wear * (h.toolMul || 1) * (0.6 + S.rnd() * 0.8);
    if (h.tools[tl.id] <= 0) {
      h.tools[tl.id] = 0;
      log('alat', `💥 ${tl.name[0].toUpperCase() + tl.name.slice(1)} milik ${h.name} patah saat ${ACTS[act].name}.`, 1);
    }
  }
  return b;
}
function toolNeed(h) {
  let n = 0;
  for (const tl of TOOLS) if (has(tl.tech)) { const d = h.tools[tl.id]; if (d === undefined || d <= 0) n += 0.5; else if (d < 35) n += 0.35; }
  return Math.min(1.5, n);
}
function doCraft(h) {
  // perbaiki yang rusak dulu, lalu buat yang belum punya
  const [mat, mul] = MATERIAL();
  let best = null, bd = 999;
  for (const tl of TOOLS) {
    if (!has(tl.tech)) continue;
    const d = h.tools[tl.id];
    const score = d === undefined ? 0 : d;
    if (score < bd) { bd = score; best = tl; }
  }
  skillUp(h, 'kriya');
  if (!best || bd >= 70) {
    if (S.rnd() < 0.015) { h.arts++; S.stats.arts++; log('alat', `✨ ${h.name} menyempurnakan alat-alatnya dengan ukiran dan pegangan yang lebih nyaman.`, 1); }
    return;
  }
  const nm = best.name + (mat ? ' ' + mat : '');
  const d = h.tools[best.id];
  if (d !== undefined && d > 0) {
    h.tools[best.id] = Math.min(100, d + 45 + h.skills.kriya * 50);
    S.stats.toolsFixed++;
    if (S.rnd() < (notable(h) ? 0.12 : 0.05)) log('alat', `🔧 ${h.name} memperbaiki ${nm}-nya yang mulai aus.`, 1);
  } else {
    h.tools[best.id] = 70 + h.skills.kriya * 30; h.hasTools = true;
    h.toolMul = mul;
    S.stats.toolsMade++;
    if (d === undefined || S.rnd() < (notable(h) ? 0.5 : 0.12)) log('alat', `🔨 ${h.name} ${d === 0 ? 'membuat ' + nm + ' baru menggantikan yang patah' : 'membuat ' + nm + ' pertamanya'}.`, 1);
  }
}
function skillUp(h, k, amt = 0.004) { h.skills[k] = Math.min(1, h.skills[k] + amt * (1 - h.skills[k])); }

// ===== Kehidupan harian =====
function worldCap() {
  return 150 + (has('pertanian') ? 130 : 0) + (has('domestikasi') ? 40 : 0) + (has('irigasi') ? 60 : 0) + (has('bajak') ? 60 : 0) + (has('lumbung') ? 40 : 0) + (has('pengobatan') ? 40 : 0) + (has('besi') ? 60 : 0) + (has('vaksin') ? 50 : 0) + (has('antibiotik') ? 50 : 0) + (has('pertanian_modern') ? 80 : 0) + (has('listrik') ? 30 : 0);
}
function hhNeed(hh) {
  let n = 0;
  for (const id of hh.members) { const m = S.byId.get(id); if (!m || !m.alive) continue; const a = ageY(m); n += a < 2 ? 0.3 : a < 12 ? 0.6 : 1; }
  return n;
}
function shelterKnown() { return has('baja') ? 4 : has('rumah_batu') ? 3 : has('rumah_kayu') ? 2 : has('berteduh') ? 1 : 0; }

const TASK_K = ['kumpul', 'buru', 'ikan', 'tani', 'ternak', 'kriya', 'bangun', 'jelajah', 'seni', 'sosial', 'asuh', 'ajar', 'riset'], TASK_W = new Float64Array(13);
function chooseTask(h, age, v, hh, se, doy) {
  if (h.sick || h.injured > 0 || (h.health < 0.3 && h.hunger < 0.5)) return 'istirahat';
  if (h.preg && S.day > h.preg.due - 25) return 'istirahat';
  const T = h.traits, need = Math.max(0.5, hh.needCache || 1), days = hh.food / need;
  const winter = se.name === 'Dingin', fp = clamp(1 - days / (se.name === 'Gugur' ? 45 : winter ? 20 : 14), 0, 1);
  const K = TASK_K, w = TASK_W; w.fill(0);
  w[0] = 0.6 + fp * 1.3 - (winter ? 0.4 : 0) + h.skills.kumpul * 0.3;
  w[1] = (has('tombak') ? 0.6 : 0.12) + (has('busur') ? 0.2 : 0) + fp * 1.0 + T.bra * 0.5 + (h.sex === 'L' ? 0.35 : -0.15) - (h.preg ? 0.7 : 0) - (age > 55 ? 0.4 : 0) - (has('domestikasi') ? 0.2 : 0) + (winter ? 0.3 : 0);
  if (has('kail') && v.waterD < 160) w[2] = 0.45 + fp * 0.8 + h.skills.ikan * 0.4 + (has('jala') ? 0.2 : 0);
  if (has('pertanian')) w[3] = (winter ? 0.05 : 1.1) + fp * 0.9 + h.skills.tani * 0.5 + (se.name === 'Semi' || se.name === 'Gugur' ? 0.6 : 0);
  const herd = v.herd.kambing + v.herd.sapi + v.herd.ayam + v.herd.kuda;
  if (herd > 0) w[4] = 0.3 + Math.min(1, herd / 20) + h.skills.ternak * 0.3;
  w[5] = toolNeed(h) * 1.1 + T.cre * 0.25;
  const sk = shelterKnown();
  w[6] = hh.shelter < sk ? 0.8 + (winter ? 0.4 : 0) + (S.weather.type.includes('hujan') ? 0.2 : 0) : 0.02;
  w[7] = T.cur * 0.55 + T.cre * 0.25 - fp * 0.9 + (age < 30 ? 0.1 : 0);
  w[8] = T.cre * 0.35 + (has('musik') || has('seni_gua') ? 0.15 : 0) - fp * 0.8;
  w[9] = T.soc * 0.3 + h.lonely * 0.5 + h.grief * 0.4 - fp * 0.5;
  if (hh.youngKids > 0) w[10] = 0.2 * hh.youngKids + (h.sex === 'P' ? 0.4 : 0.05) - fp * 0.6;
  if (age > 50 && S.tech.size > 3) w[11] = 0.35 + T.kin * 0.3;
  if (has('tulisan')) w[12] = T.cur * 0.3 + T.cre * 0.1 - fp * 0.9;
  if (h.job) { const j = JOB[h.job]; const ji = TASK_K.indexOf(j.task); if (ji >= 0 && (ji !== 6 || hh.shelter < sk || j.id !== 'tukang')) w[ji] += 1.0 - (j.food ? 0 : fp * 0.6); }
  let sum = 0; for (let i = 0; i < 13; i++) { const x = w[i] > 0 ? w[i] * w[i] : 0; w[i] = x; sum += x; }
  let r = S.rnd() * sum;
  for (let i = 0; i < 13; i++) { r -= w[i]; if (r <= 0 && w[i] > 0) return K[i]; }
  return 'kumpul';
}

function huntPrey(v) {
  let best = null, bd = 450 * 450;
  const A = S.animals, n = A.length; if (!n) return null;
  for (let k = 0; k < 24; k++) {
    const a = A[(S.rnd() * n) | 0];
    if (!a.alive) continue;
    const sp = SPEC[a.sp]; if (sp.pred || sp.water || sp.fly) continue;
    const d = (a.x - v.x) ** 2 + (a.y - v.y) ** 2;
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function humanDay(h, se, doy) {
  const age = ageY(h), v = S.villages[h.vil];
  let hh = S.households.get(h.hh);
  if (!hh) { hh = makeHousehold(v, h.x, h.y); hh.members.push(h.id); h.hh = hh.id; }
  // emosi
  h.grief *= 0.992; h.fear *= 0.96;
  if (h.partner) h.lonely *= 0.95; else if (age >= 16) h.lonely = Math.min(1, h.lonely + 0.003 * (0.5 + h.traits.soc));
  if (h.injured > 0) h.injured--;

  // penyakit
  if (h.sick) {
    h.sick.days--;
    const ageF = age < 2 ? 1.6 : age < 6 ? 1.1 : age > 60 ? 1 + (age - 60) * 0.06 : 0.8;
    const med = Math.min(0.92, (has('obat_herbal') ? 0.25 : 0) + (has('pengobatan') ? 0.25 : 0) + (has('memasak') ? 0.05 : 0) + (has('antibiotik') ? 0.3 : 0) + Math.min(0.2, (v.healers || 0) / Math.max(1, v.pop) * 3));
    const pD = h.sick.sev * 0.0035 * ageF * (1 - med) * (1 + h.hunger) * (h.health < 0.5 ? 1.6 : 1);
    h.health = Math.max(0.05, h.health - 0.015 * h.sick.sev);
    if (S.rnd() < pD) { die(h, age < 5 ? 'bayi' : 'penyakit', h.sick.name); return; }
    if (h.sick.days <= 0) {
      if (h.gen === 1 || S.rnd() < 0.04) log('sehat', `🌿 ${h.name} sembuh dari ${h.sick.name}.`, h.gen === 1 ? 2 : 1);
      h.sick = null;
    }
  } else {
    const crowd = Math.min(1, v.pop / 150), contag = v.pop ? v.sick / v.pop : 0;
    let p = 0.0007 + (se.name === 'Dingin' ? 0.0012 : 0) + crowd * 0.0012 + contag * 0.05 + (v.epidemic ? 0.01 : 0);
    if (has('memasak')) p *= 0.75; if (has('pengobatan')) p *= 0.7; if (has('vaksin')) p *= 0.5; if (has('lampu')) p *= 0.9; if (h.hunger > 0.5) p *= 1.6;
    if (age < 5) p *= 1.2;
    if (S.rnd() < p) {
      let pool = DISEASES.filter(d => (!d.crowd || v.pop > 50 || v.epidemic) && (!d.cold || se.name !== 'Panas'));
      const d = v.epidemic && S.rnd() < 0.7 ? DISEASES[5] : pick(pool);
      h.sick = { name: d.name, sev: d.sev * (0.6 + S.rnd() * 0.8), days: d.dur + ((S.rnd() * 5) | 0) };
      if (h.gen === 1) log('sakit', `🤒 ${h.name} jatuh sakit ${d.name}.`, 2);
      else if (S.rnd() < 0.06) log('sakit', `🤒 ${h.name} terserang ${d.name}.`, 1);
    }
  }

  // pekerjaan
  let task;
  if (age < 3) task = 'asuh';
  else if (age < 7) task = 'main';
  else if (age < 13) task = S.rnd() < 0.45 ? 'main' : pick(['kumpul', 'kumpul', 'asuh', 'ikan', 'tani', 'ternak', 'seni']);
  else task = chooseTask(h, age, v, hh, se, doy);
  if ((task === 'ikan' && !has('kail')) || (task === 'tani' && !has('pertanian')) || (task === 'ternak' && !(v.herd.kambing + v.herd.sapi + v.herd.ayam + v.herd.kuda))) task = 'kumpul';
  h.task = task; h.taskDay = S.day;
  perform(h, task, age, v, hh, se);
  if (!h.alive) return;
  if (age >= 7) tryInvent(h, task);

  // dingin
  if (se.name === 'Dingin' && S.weather.temp < 2) {
    const lack = (has('api') ? 0 : 1) + (hh.shelter > 0 ? 0 : 1) + (has('pakaian') ? 0 : 1);
    if (lack) {
      h.health -= 0.0025 * lack * (S.weather.type.startsWith('badai') ? 3 : 1) * (age < 3 || age > 65 ? 1.8 : 1);
      if (h.health <= 0) { die(h, 'dingin', 'membeku di musim dingin'); return; }
    }
  }
  // lapar
  if (h.hunger > 0.6) { h.health -= 0.012 * (h.hunger - 0.5); if (h.health <= 0) { die(h, 'lapar', 'kelaparan'); return; } }
  else if (!h.sick) h.health = Math.min(1, h.health + 0.008);
  h.happy = clamp(h.happy + (0.62 - h.hunger * 0.5 - h.grief * 0.5 - h.fear * 0.3 - (h.sick ? 0.25 : 0) + (h.partner ? 0.12 : 0) - h.lonely * 0.2 - h.happy) * 0.04, 0, 1);

  // usia
  if (age > 1) {
    const med = (has('memasak') ? 0.1 : 0) + (has('pengobatan') ? 0.2 : 0) + (has('obat_herbal') ? 0.08 : 0) + (has('vaksin') ? 0.12 : 0) + (has('antibiotik') ? 0.15 : 0) + (has('ai') ? 0.1 : 0);
    const ann = 0.00012 * Math.exp(0.083 * age) * (1 - med);
    if (S.rnd() < ann / YEAR_DAYS) { die(h, 'tua', 'usia tua'); return; }
  }
  if (age < 1) {
    const careB = Math.min(0.92, (has('memasak') ? 0.15 : 0) + (has('obat_herbal') ? 0.15 : 0) + (has('pengobatan') ? 0.25 : 0) + (has('vaksin') ? 0.2 : 0) + (has('antibiotik') ? 0.15 : 0));
    if (S.rnd() < 0.07 * (1 - careB) / YEAR_DAYS * (1 + h.hunger * 2)) { die(h, 'bayi', 'sakit saat bayi'); return; }
  }

  // kehamilan
  if (h.preg && S.day >= h.preg.due) giveBirth(h);
  else if (!h.preg && h.sex === 'P' && h.partner && age >= 16 && age <= 45) {
    const pa = S.byId.get(h.partner);
    if (pa && pa.alive && S.day - h.lastBirth > 420) {
      const vCap = 30 + Math.min(110, v.fields * 1.6 + (v.herd.kambing + v.herd.sapi) * 0.3);
      const capF = Math.max(0.03, 1 - popCount() / worldCap()) * clamp(1.4 - v.pop / vCap, 0.08, 1);
      const p = 0.0075 * (1 - h.hunger) * (0.55 + h.happy * 0.6) * (age > 37 ? 0.45 : 1) * capF;
      if (S.rnd() < p) {
        h.preg = { due: S.day + 270 + ((gauss() * 8) | 0), father: pa.id };
        if (notable(h) || popCount() < 20) log('lahir', `🤰 ${h.name} mengandung anak ${pa.name}. Kabar bahagia menyebar.`, popCount() < 20 ? 3 : 2);
      }
    }
  }

  // pikiran & keinginan
  if (S.rnd() < 0.08) { h.thought = thinkOf(h, age, hh, v); h.want = wantOf(h, age, hh); }
  if (S.rnd() < 0.004 * (h.gen <= 2 ? 5 : 1) && h.thought) log('pikir', `💭 ${h.name}: ${h.thought}`, 0);
}

function perform(h, task, age, v, hh, se) {
  const eff = (age < 14 ? 0.45 : age > 62 ? 0.6 : 1) * (1 - h.hunger * 0.25) * (h.preg ? 0.8 : 1);
  let food = 0;
  switch (task) {
    case 'kumpul': {
      const tb = toolBonus(h, 'kumpul');
      food = 2.6 * se.gather * (0.25 + 0.75 * v.forage) * (1 + tb) * eff * (0.75 + h.skills.kumpul * 0.5) * (S.drought ? 0.6 : 1);
      v.forage = Math.max(0.03, v.forage - 0.0011);
      skillUp(h, 'kumpul');
      if (S.rnd() < 0.002 * h.traits.cur) log('kerja', `🍓 ${h.name} menemukan semak buah ${pick(['beri merah', 'anggur liar', 'ara', 'delima liar', 'murbei'])} di ${pick(['tepi hutan', 'lereng bukit', 'dekat sungai'])}.`, 1);
      break;
    }
    case 'buru': {
      const tb = toolBonus(h, 'buru');
      const p = (0.3 + tb * 0.3 + h.skills.buru * 0.25) * (0.3 + 0.7 * v.game) * eff;
      skillUp(h, 'buru');
      v.game = Math.max(0.05, v.game - 0.0035);
      const prey = huntPrey(v);
      const sp = prey ? SPEC[prey.sp] : null;
      if (S.rnd() < p) {
        food = sp ? Math.min(14, sp.meat) : 2.5;
        if (prey && S.rnd() < 0.18) prey.alive = false;
        if (sp && sp.dom && has('domestikasi') && S.rnd() < 0.08) { v.herd[sp.dom]++; log('ternak', `🪢 ${h.name} berhasil menangkap ${sp.name.toLowerCase()} hidup-hidup dan menjinakkannya.`, 1); first('dom_' + sp.dom, `${sp.name} pertama dijinakkan`); food *= 0.3; }
        else if (sp && (notable(h) && S.rnd() < 0.08 || S.rnd() < 0.008)) log('kerja', `🏹 ${h.name} pulang membawa ${sp.name.toLowerCase()} hasil buruan. Keluarganya bersorak.`, 1);
        if (has('pakaian') && S.rnd() < 0.2) h.happy += 0.02;
      }
      const dang = (sp ? sp.danger : 0.3);
      const pr = Math.max(0.0001, 0.0003 + dang * 0.0012 - tb * 0.0002 + (has('busur') ? -0.0002 : 0));
      if (S.rnd() < pr) {
        const beast = pick(['babi hutan', 'serigala', 'harimau', 'beruang', 'kerbau liar']);
        const med = has('pengobatan') ? 0.5 : has('obat_herbal') ? 0.7 : 1;
        if (S.rnd() < 0.22 * med) { die(h, 'buas', `diserang ${beast}`); return; }
        h.injured = 10 + ((S.rnd() * 15) | 0); h.fear = 0.6; h.fearFor = `diserang ${beast}`;
        log('celaka', `🩸 ${h.name} terluka diserang ${beast} saat berburu, tapi berhasil selamat.`, notable(h) ? 2 : 1);
      }
      break;
    }
    case 'ikan': {
      const tb = toolBonus(h, 'ikan');
      const p = (0.25 + tb * 0.35 + h.skills.ikan * 0.25) * (0.3 + 0.7 * v.fish) * eff;
      skillUp(h, 'ikan');
      v.fish = Math.max(0.05, v.fish - 0.0025);
      if (S.rnd() < p) food = 2.6 * (has('perahu') ? 1.35 : 1) * (has('kapal_layar') ? 1.25 : 1);
      if (S.rnd() < 0.000015 * (S.weather.type.startsWith('badai') ? 4 : 1)) { die(h, 'tenggelam', 'tenggelam di sungai'); return; }
      break;
    }
    case 'tani': {
      const tb = toolBonus(h, 'tani');
      v.farmersToday++;
      const maxF = 70;
      if (se.name !== 'Dingin') v.fields = Math.min(maxF, v.fields + 0.03 * eff * (1 + tb));
      while (v.fieldSpots.length < Math.floor(v.fields)) addField(v);
      const sf = { Semi: 0.7, Panas: 1.7, Gugur: 4.2, Dingin: 0.1 }[se.name];
      const landF = Math.min(1, (v.fields + 0.5) / Math.max(1, v.farmersYest || 1));
      food = sf * landF * (1 + tb) * eff * (0.8 + h.skills.tani * 0.5) * (has('irigasi') ? 1.3 : 1) * (has('kincir') ? 1.15 : 1) * (has('kincir_angin') ? 1.1 : 1) * (has('pertanian_modern') ? 2 : 1) * (S.drought && !has('irigasi') ? 0.45 : 1);
      skillUp(h, 'tani');
      break;
    }
    case 'ternak': {
      const herd = v.herd.kambing + v.herd.sapi + v.herd.ayam + v.herd.kuda;
      food = Math.min(3.2, 0.7 + herd * 0.06) * eff * (0.8 + h.skills.ternak * 0.4);
      skillUp(h, 'ternak');
      for (const k in v.herd) if (v.herd[k] > 0 && v.herd[k] < 45 && S.rnd() < 0.012 * v.herd[k] / Math.max(1, v.herd[k] / 4)) v.herd[k]++;
      break;
    }
    case 'kriya': doCraft(h); break;
    case 'bangun': {
      const tb = toolBonus(h, 'bangun');
      const target = shelterKnown();
      if (hh.shelter < target) {
        hh.build += 0.035 * (1 + tb) * eff * (0.7 + h.skills.bangun * 0.6) / (hh.shelter + 1);
        if (hh.build >= 1) {
          hh.build = 0; hh.shelter++;
          const nm = ['', 'gubuk daun', 'rumah kayu', 'rumah batu', 'rumah modern'][hh.shelter];
          const fam = familyName(hh);
          log('bangun', `🛖 ${h.name} menyelesaikan ${nm} untuk keluarga ${fam}.`, notable(h) ? 2 : 1);
          first('shelter' + hh.shelter, `${nm[0].toUpperCase() + nm.slice(1)} pertama dibangun oleh ${h.name}`);
          if (hh.shelter >= 2) cutTrees(hh.x, hh.y, 3);
        }
      }
      skillUp(h, 'bangun');
      if (S.rnd() < 0.00005) { die(h, 'celaka', 'tertimpa kayu saat membangun'); return; }
      break;
    }
    case 'riset': {
      h.happy = Math.min(1, h.happy + 0.01); skillUp(h, 'kriya', 0.002);
      break;
    }
    case 'jelajah': {
      h.happy = Math.min(1, h.happy + 0.01);
      if (S.rnd() < 0.00012) { die(h, 'celaka', pick(['jatuh dari tebing', 'tergelincir di lereng gunung', 'dipatuk ular berbisa'])); return; }
      if (S.rnd() < 0.006) log('jelajah', `🧭 ${h.name} ${pick(['mendaki lereng gunung dan melihat seluruh dunia dari ketinggian', 'menyusuri sungai sampai ke ujung dunia', 'menemukan gua yang dalam dan sejuk', 'mengamati kawanan burung terbang ke selatan', 'menemukan batu berwarna aneh dan membawanya pulang', 'duduk lama memandangi bintang-bintang'])}.`, 1);
      food = 0.4 * se.gather;
      break;
    }
    case 'seni': {
      const major = S.rnd() < 0.08; if (major) { h.arts++; S.stats.arts++; } skillUp(h, 'seni', 0.006); h.happy = Math.min(1, h.happy + 0.03);
      let kind = 'menghias kerang dan batu menjadi kalung';
      if (has('musik') && S.rnd() < 0.4) { kind = 'menciptakan lagu baru yang dinyanyikan bersama di malam hari'; if (major) S.stats.songs++; }
      else if (has('bahasa') && S.rnd() < 0.3) { kind = `menuturkan kisah tentang ${pick(['asal-usul gunung', 'Adam dan Hawa', 'roh sungai', 'pemburu pemberani', 'bintang yang jatuh', 'musim dingin yang panjang'])}`; if (major) S.stats.stories++; }
      else if (has('seni_gua') && S.rnd() < 0.4) kind = `melukis ${pick(['rusa', 'tangan', 'matahari', 'perburuan', 'keluarganya'])} di dinding batu`;
      else if (has('gerabah') && S.rnd() < 0.3) kind = 'membuat gerabah berhias motif spiral';
      else if (has('tenun') && S.rnd() < 0.3) kind = 'menenun kain bermotif warna-warni';
      if (S.rnd() < 0.05 + (h.gen <= 2 ? 0.1 : 0)) log('seni', `🎨 ${h.name} ${kind}.`, 1);
      break;
    }
    case 'sosial': {
      h.lonely = Math.max(0, h.lonely - 0.08); h.happy = Math.min(1, h.happy + 0.02); h.grief *= 0.97; h.respect += 0.01 * h.traits.kin;
      break;
    }
    case 'asuh': {
      if (age >= 13) { hh.care = S.day; for (const id of hh.members) { const k = S.byId.get(id); if (k && k.alive && ageY(k) < 12) k.happy = Math.min(1, k.happy + 0.01); } }
      break;
    }
    case 'ajar': {
      h.respect += 0.03;
      if (h.job === 'guru' || h.job === 'juru_tulis') { const vk = S.alive; for (let q = 0; q < 6; q++) { const k = vk[(S.rnd() * vk.length) | 0]; if (k && k.vil === h.vil && ageY(k) > 5 && ageY(k) < 18) for (const s2 in k.skills) skillUp(k, s2, 0.004); } }
      for (const id of hh.members) { const k = S.byId.get(id); if (k && k.alive && ageY(k) < 18 && ageY(k) > 5) for (const s in k.skills) skillUp(k, s, 0.002); }
      break;
    }
    case 'main': {
      if (S.rnd() < 0.5) skillUp(h, pick(['kumpul', 'kriya', 'seni', 'buru']), 0.003);
      break;
    }
    case 'istirahat': h.energy = 1; break;
  }
  hh.food += food;
}

function addField(v) {
  for (let k = 0; k < 30; k++) {
    const a = S.rnd() * 6.283, d = 40 + Math.sqrt(v.fieldSpots.length + 1) * 22 + S.rnd() * 30;
    const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d, t = S.world.typeAt(x, y);
    if (t === 4 || t === 9 || t === 3 || t === 5) {
      if (v.fieldSpots.some(f => Math.abs(f.x - x) < 14 && Math.abs(f.y - y) < 11)) continue;
      v.fieldSpots.push({ x, y, rot: (S.rnd() - 0.5) * 0.4 });
      if (t === 5) cutTrees(x, y, 2);
      S.floraDirty = true;
      return;
    }
  }
  v.fieldSpots.push({ x: v.x + gauss() * 60, y: v.y + gauss() * 60, rot: 0 });
}
function cutTrees(x, y, n) {
  let c = 0;
  for (const f of S.flora) if (f.alive && (f.kind === 'pohon' || f.kind === 'pinus') && Math.abs(f.x - x) < 60 && Math.abs(f.y - y) < 60) { f.alive = false; if (++c >= n) break; }
  if (c) S.floraDirtySoft = true;
}

function familyName(hh) {
  const ad = hh.members.map(id => S.byId.get(id)).filter(m => m && m.alive && ageY(m) >= 16);
  return ad.length ? ad.map(m => m.name).slice(0, 2).join(' & ') : 'kecil';
}

function eatDay() {
  const byVil = {};
  for (const hh of S.households.values()) { hh.needCache = 0; hh.youngKids = 0; (byVil[hh.vil] = byVil[hh.vil] || []).push(hh); }
  for (const m of S.alive) {
    if (!m.alive) continue;
    const hh = S.households.get(m.hh); if (!hh) continue;
    const a = (S.day - m.born) / YEAR_DAYS;
    hh.needCache += a < 2 ? 0.3 : a < 12 ? 0.6 : 1;
    if (a < 6) hh.youngKids++;
  }
  for (const v of S.villages) v.farmersYest = v.farmersToday;
  // berbagi dalam desa
  if (S.day % 3 === 0) for (const vid in byVil) {
    const list = byVil[vid];
    const rich = list.filter(x => x.food > x.needCache * 8).sort((a, b) => b.food - a.food);
    for (const hh of list) {
      if (hh.food >= hh.needCache || !rich.length) continue;
      const donor = rich[0]; if (donor === hh) continue;
      const give = Math.min(hh.needCache * 3, donor.food - donor.needCache * 6);
      if (give > 0) {
        donor.food -= give; hh.food += give;
        if (S.rnd() < 0.01) log('sosial', `🤝 Keluarga ${familyName(donor)} berbagi makanan dengan keluarga ${familyName(hh)} yang kekurangan.`, 1);
      }
    }
  }
  for (const hh of S.households.values()) {
    const need = hh.needCache; if (need <= 0) continue;
    let ratio = 1;
    if (hh.food >= need) hh.food -= need; else { ratio = hh.food / need; hh.food = 0; }
    for (const id of hh.members) {
      const m = S.byId.get(id); if (!m || !m.alive) continue;
      if (ratio >= 1) m.hunger = Math.max(0, m.hunger - 0.25);
      else m.hunger = Math.min(1, m.hunger + (1 - ratio) * 0.2 - ratio * 0.05);
    }
    if (ratio < 0.4 && S.rnd() < 0.01) log('lapar', `🍂 Keluarga ${familyName(hh)} kelaparan; persediaan makanan habis.`, 1);
  }
}

function related(a, b) {
  if (a.father === b.id || a.mother === b.id || b.father === a.id || b.mother === a.id) return 2;
  if ((a.father && a.father === b.father) || (a.mother && a.mother === b.mother)) return 1;
  return 0;
}
function marriageDay() {
  const singles = S.alive.filter(h => !h.partner && h.alive && ((h.sex === 'P' && ageY(h) >= 16 && ageY(h) <= 45) || (h.sex === 'L' && ageY(h) >= 18 && ageY(h) <= 60)) && (!h.widowed || h.grief < 0.25));
  const women = singles.filter(h => h.sex === 'P'), men = singles.filter(h => h.sex === 'L');
  if (!women.length || !men.length) return;
  for (const w of women) {
    if (S.rnd() > 0.02 * (0.5 + w.traits.soc)) continue;
    let cands = men.filter(m => !m.partner && related(w, m) < 2 && Math.abs(ageY(m) - ageY(w)) < 20);
    const nonSib = cands.filter(m => related(w, m) === 0);
    if (nonSib.length) cands = nonSib;
    if (!cands.length) continue;
    let best = null, bs = -9;
    for (const m of cands) {
      let s = 1 - Math.abs(ageY(m) - ageY(w) - 2) / 18 + (m.vil === w.vil ? 0.6 : 0) + S.rnd() * 0.7;
      for (const k of ['cur', 'cre', 'soc', 'kin']) s -= Math.abs(m.traits[k] - w.traits[k]) * 0.2;
      if (s > bs) { bs = s; best = m; }
    }
    marry(best, w);
  }
}
function marry(m, w) {
  m.partner = w.id; w.partner = m.id; m.love = w.love = 0.6 + S.rnd() * 0.4; m.lonely = w.lonely = 0;
  S.stats.marriages++;
  const v = S.villages[m.vil];
  const sp = homeSpot(v);
  const hh = makeHousehold(v, sp.x, sp.y);
  for (const p of [m, w]) {
    const old = S.households.get(p.hh);
    if (old) { old.members = old.members.filter(id => id !== p.id); if (!old.members.length) S.households.delete(old.id); }
    p.hh = hh.id; p.vil = v.id; hh.members.push(p.id);
  }
  // bawa anak (pernikahan kedua)
  for (const p of [m, w]) for (const kid of p.kids) { const k = S.byId.get(kid); if (k && k.alive && !k.partner && ageY(k) < 14) { const o = S.households.get(k.hh); if (o) o.members = o.members.filter(i => i !== k.id); k.hh = hh.id; k.vil = v.id; hh.members.push(k.id); } }
  hh.shelter = has('berteduh') ? 0 : 0; hh.food = 4;
  const sib = related(m, w) === 1;
  const imp = notable(m) || notable(w) || popCount() < 30 ? 3 : 2;
  log('nikah', `💞 ${m.name} dan ${w.name} saling jatuh cinta dan memutuskan hidup bersama${sib ? ' (belum ada keluarga lain di dunia ini)' : ''}.`, imp);
  first('nikah', `Pernikahan pertama generasi baru: ${m.name} & ${w.name}`);
}

function giveBirth(mo) {
  const fa = S.byId.get(mo.preg.father);
  const founder = mo.gen === 1;
  const n = founder || S.rnd() < 0.015 ? 2 : 1;
  mo.preg = null; mo.lastBirth = S.day;
  const names = [];
  for (let i = 0; i < n; i++) {
    const sex = founder ? (i === 0 ? 'L' : 'P') : S.rnd() < 0.51 ? 'L' : 'P';
    const k = makeHuman({ name: genName(sex, S.rnd), sex, age: 0, vil: mo.vil, hh: mo.hh, x: mo.x, y: mo.y, gen: Math.max(mo.gen, fa ? fa.gen : 0) + 1, father: fa ? fa.id : 0, mother: mo.id, fa, mo });
    mo.kids.push(k.id); if (fa) fa.kids.push(k.id);
    names.push(k);
    S.stats.born++; S.stats.yearAgg.born++;
  }
  mo.happy = Math.min(1, mo.happy + 0.3); if (fa) fa.happy = Math.min(1, fa.happy + 0.25);
  const kidTxt = names.map(k => `${k.name} (${k.sex === 'L' ? 'laki-laki' : 'perempuan'})`).join(' dan ');
  const imp = notable(mo) || (fa && notable(fa)) || popCount() < 25 ? 3 : bigWorld() && fast() ? 1 : 2;
  log('lahir', `👶 ${founder ? 'Seperti kisah turun-temurun, sepasang bayi kembar laki-laki dan perempuan' : n > 1 ? 'Bayi kembar' : 'Seorang bayi'} lahir dari ${mo.name}${fa ? ' & ' + fa.name : ''}: ${kidTxt}.`, imp);
  if (first('lahir', `Anak pertama di dunia lahir: ${names[0].name}`)) {}
  const med = Math.min(0.9, (has('obat_herbal') ? 0.25 : 0) + (has('pengobatan') ? 0.4 : 0) + (has('antibiotik') ? 0.2 : 0));
  if (S.rnd() < 0.014 * (1 - med) * (ageY(mo) > 38 ? 1.8 : 1)) die(mo, 'melahirkan', 'saat melahirkan');
}

function die(h, cause, detail) {
  if (!h.alive) return;
  // Masa perintisan: saat manusia masih sangat sedikit, celaka fatal pada orang dewasa jadi "nyaris tewas"
  if (popCount() < 12 && ageY(h) >= 14 && ['lapar', 'dingin', 'buas', 'celaka', 'tenggelam', 'bencana', 'tikai', 'penyakit', 'melahirkan'].includes(cause) && S.rnd() < 0.85) {
    h.injured = 20; h.fear = 0.8; h.fearFor = 'nyaris tewas karena ' + detail; h.health = Math.max(0.3, h.health - 0.3);
    if (h.sick) h.sick.days = 1;
    log('celaka', `😰 ${h.name} nyaris tewas — ${detail} — namun berhasil selamat dan perlahan pulih.`, 3);
    return;
  }
  h.alive = false; h.died = S.day; h.cause = cause; h.causeText = detail || CAUSES[cause];
  S.stats.deaths++; S.stats.causes[cause] = (S.stats.causes[cause] || 0) + 1;
  S.stats.yearAgg.died++; S.stats.yearAgg.causes[cause] = (S.stats.yearAgg.causes[cause] || 0) + 1;
  const age = ageY(h);
  if (!S.stats.oldest || age > S.stats.oldest.age) S.stats.oldest = { name: h.name, age, id: h.id };
  if (!S.deathSeen) { S.deathSeen = true; milestone(`Kematian pertama: ${h.name} (${detail})`); updateAvailTechs(); }
  const ageTxt = age < 1 ? `${Math.max(1, Math.round(age * 12))} bulan` : `${Math.floor(age)} tahun`;
  const imp = notable(h) || popCount() < 25 ? 3 : bigWorld() && fast() ? 1 : 2;
  log('mati', `🕯️ ${h.name} wafat pada usia ${ageTxt} — ${detail}.${h.gen === 1 ? ' Seluruh keturunannya berduka.' : ''}`, imp);
  if (h.name === 'Adam' || h.name === 'Hawa') if (h.gen === 1) milestone(`${h.name} wafat pada usia ${Math.floor(age)} tahun (${detail})`);
  // duka keluarga
  const fam = [h.partner, h.father, h.mother, ...h.kids].map(id => S.byId.get(id)).filter(x => x && x.alive);
  for (const f of fam) { f.grief = Math.min(1, f.grief + (f.id === h.partner ? 0.9 : 0.6)); f.griefFor = h.name; }
  const pa = S.byId.get(h.partner); if (pa && pa.alive) { pa.partner = 0; pa.widowed = true; }
  if (h.leader) { const v = S.villages[h.vil]; v.leader = 0; }
  // rumah tangga
  const hh = S.households.get(h.hh);
  if (hh) {
    hh.members = hh.members.filter(id => id !== h.id);
    const adults = hh.members.map(id => S.byId.get(id)).filter(m => m && m.alive && ageY(m) >= 14);
    if (!adults.length) {
      const orphans = hh.members.map(id => S.byId.get(id)).filter(m => m && m.alive);
      S.households.delete(hh.id);
      for (const o of orphans) adopt(o, h);
    }
  }
}
function adopt(o, deadParent) {
  // kakek/nenek, kakak, atau keluarga lain di desa
  const cand = [];
  for (const id of [deadParent.father, deadParent.mother, ...deadParent.kids]) { const r = S.byId.get(id); if (r && r.alive && ageY(r) >= 16 && S.households.has(r.hh)) cand.push(r); }
  let hh = cand.length ? S.households.get(cand[0].hh) : null;
  if (!hh) { const list = [...S.households.values()].filter(x => x.vil === o.vil); hh = list.length ? pick(list) : null; }
  if (!hh) { const list = [...S.households.values()]; hh = list.length ? pick(list) : null; }
  if (!hh) { const v = S.villages[o.vil]; hh = makeHousehold(v, v.x, v.y); hh.food = 3; }
  o.hh = hh.id; o.vil = hh.vil; hh.members.push(o.id);
  if (popCount() < 60 || S.rnd() < 0.2) log('sosial', `🫂 ${o.name} yang yatim piatu kini diasuh keluarga ${familyName(hh)}.`, 1);
}

function monthlyVillage(se) {
  for (const v of S.villages) {
    if (!v.alive) continue;
    if (v.founded === S.day) continue;
    if (v.pop === 0) { v.alive = false; log('desa', `🏚️ ${v.name} kini kosong ditinggalkan penghuninya.`, 3); continue; }
    // wabah
    if (v.pop > 60 && !v.epidemic && S.rnd() < 0.006) { v.epidemic = 40; disaster(`☣️ Wabah cacar menyebar di ${v.name}! Banyak orang jatuh sakit.`); }
    // migrasi
    const cap = 40 + (has('pertanian') ? 45 : 0) + (has('irigasi') ? 15 : 0);
    if (v.pop > cap && S.villages.filter(x => x.alive).length < Math.min(14, 2 + Math.floor(popCount() / 45)) && S.rnd() < 0.35) migrate(v);
  }
  // pikiran Adam/Hawa
}
function migrate(v) {
  const hhs = [...S.households.values()].filter(hh => hh.vil === v.id && hh.members.length >= 2);
  let pioneer = null, bc = -1;
  for (const hh of hhs) {
    const ad = hh.members.map(id => S.byId.get(id)).filter(m => m && m.alive && ageY(m) >= 18 && ageY(m) < 40);
    if (ad.length < 2) continue;
    const c = ad.reduce((s, m) => s + m.traits.cur + m.traits.bra, 0);
    if (c > bc) { bc = c; pioneer = hh; }
  }
  if (!pioneer) return;
  // cari lokasi
  let best = null, bs = -1;
  for (let k = 0; k < 60; k++) {
    const p = randLand(S.world, S.rnd, t => t === 4 || t === 9 || t === 5 || t === 3, 50); if (!p) continue;
    const dv = Math.min(...S.villages.filter(x => x.alive).map(x => Math.hypot(x.x - p.x, x.y - p.y)));
    if (dv < 220) continue;
    const wd = nearWater(S.world, p.x, p.y, 150);
    const sc = (wd < 150 ? 2 - wd / 150 : 0) + (S.world.typeAt(p.x, p.y) === 4 ? 0.5 : 0) - dv / 2000 + S.rnd() * 0.5;
    if (sc > bs) { bs = sc; best = p; }
  }
  if (!best) return;
  let name = pick(VIL_A) + ' ' + pick(VIL_B);
  for (let k = 0; k < 20 && S.villages.some(x => x.name === name); k++) name = pick(VIL_A) + ' ' + pick(VIL_B);
  const nv = makeVillage(name, best.x, best.y);
  const groups = [pioneer, ...hhs.filter(x => x !== pioneer && S.rnd() < 0.25).slice(0, 3)];
  let moved = 0;
  for (const hh of groups) {
    hh.vil = nv.id; const sp = homeSpot(nv); hh.x = sp.x; hh.y = sp.y; hh.shelter = 0; hh.build = 0.3;
    for (const id of hh.members) { const m = S.byId.get(id); if (m) { m.vil = nv.id; moved++; } }
  }
  if (has('domestikasi') && v.herd.kambing > 4) { v.herd.kambing -= 2; nv.herd.kambing += 2; }
  log('desa', `🏕️ ${moved} orang dipimpin keluarga ${familyName(pioneer)} meninggalkan ${v.name} dan mendirikan desa baru: ${name}.`, 3);
  first('desa2', `Desa kedua berdiri: ${name}`);
}

function conflictDay() {
  if (popCount() < 12) return;
  if (S.rnd() > 0.02) return;
  const a = pick(S.alive); if (ageY(a) < 16 || a.traits.agg < 0.45) return;
  const pool = S.alive.filter(b => b !== a && b.vil === a.vil && ageY(b) >= 16 && b.sex === 'L');
  if (!pool.length) return;
  const b = pick(pool);
  const hh = S.households.get(a.hh), scarce = hh && hh.food < 2;
  const reason = scarce ? 'berebut makanan' : pick(['berselisih soal hasil buruan', 'cemburu', 'berebut tempat berburu', 'salah paham']);
  if (has('hukum') && S.rnd() < 0.7) {
    const v = S.villages[a.vil], ld = S.byId.get(v.leader);
    log('sosial', `⚖️ ${a.name} dan ${b.name} ${reason}; ${ld ? ld.name : 'para tetua'} menengahi sesuai hukum adat.`, 1);
    return;
  }
  if (S.rnd() < 0.08 * a.traits.agg) {
    die(b, 'tikai', `tewas dalam perkelahian dengan ${a.name} (${reason})`);
    a.grief = 0.8; a.griefFor = b.name; a.respect -= 5;
    first('bunuh', `Pembunuhan pertama: ${a.name} membunuh ${b.name}`);
  } else log('sosial', `😠 ${a.name} dan ${b.name} bertengkar karena ${reason}, lalu berdamai keesokan harinya.`, 1);
}

// ===== Pekerjaan =====
function jobYear() {
  const specCap = Math.min(0.75, 0.12 + (has('pertanian') ? 0.08 : 0) + (has('lumbung') ? 0.05 : 0) + (has('besi') ? 0.05 : 0) + (has('mesin_uap') ? 0.12 : 0) + (has('pertanian_modern') ? 0.2 : 0) + (has('komputer') ? 0.08 : 0));
  for (const v of S.villages) v.jobStats = { spec: 0, adults: 0, counts: {}, cap: specCap };
  for (const h of S.alive) {
    if (ageY(h) < 15) continue;
    const st = S.villages[h.vil].jobStats; st.adults++;
    if (h.job) { st.counts[h.job] = (st.counts[h.job] || 0) + 1; if (!JOB[h.job].food) st.spec++; }
  }
  for (const h of S.alive) if (ageY(h) >= 15 && (!h.job || S.rnd() < 0.12)) assignJob(h);
  for (const v of S.villages) { v.healers = 0; v.traders = 0; }
  S.jobCount = {};
  for (const h of S.alive) if (h.job) {
    const j = JOB[h.job], v = S.villages[h.vil];
    S.jobCount[h.job] = (S.jobCount[h.job] || 0) + 1;
    if (j.healer) v.healers++; if (j.trader) v.traders++;
  }
  tradeYear();
}
function assignJob(h) {
  const v = S.villages[h.vil], st = v.jobStats || { spec: 0, adults: 1, counts: {}, cap: 0.12 };
  const specFull = st.spec / Math.max(1, st.adults) >= st.cap;
  const fa = S.byId.get(h.father), mo = S.byId.get(h.mother);
  let best = null, bs = -99;
  for (const j of JOBS) {
    if (j.tech && !has(j.tech)) continue;
    if (!j.food && specFull && h.job !== j.id) continue;
    if (j.task === 'ikan' && v.waterD > 160) continue;
    let sc = (j.skill ? h.skills[j.skill] * 1.5 : 0.2) + (j.trait ? h.traits[j.trait] : 0.4) + S.rnd() * 0.9 + (j.food ? 0.3 : 0);
    sc -= (st.counts[j.id] || 0) / Math.max(1, st.adults) * (j.food ? 1.2 : 4);
    if (h.job === j.id) sc += 0.6;
    if ((fa && fa.job === j.id) || (mo && mo.job === j.id)) sc += 0.35;
    if (j.id === 'pengumpul') sc -= (has('pertanian') ? 0.6 : 0) + (has('pertanian_modern') ? 1 : 0);
    if (j.id === 'pemburu') sc -= (has('domestikasi') ? 0.3 : 0) + (has('pertanian_modern') ? 0.8 : 0);
    if (j.research) sc += 0.25;
    if (sc > bs) { bs = sc; best = j; }
  }
  if (!best) return;
  const old = h.job;
  if (old === best.id) return;
  h.job = best.id;
  const st2 = v.jobStats; if (st2) { st2.counts[best.id] = (st2.counts[best.id] || 0) + 1; if (!best.food) st2.spec++; if (old) { st2.counts[old]--; if (!JOB[old].food) st2.spec--; } }
  if (!best.food && first('job_' + best.id, `${best.icon} ${best.name} pertama: ${h.name}`)) log('kerja', `${best.icon} ${h.name} menjadi ${best.name.toLowerCase()} pertama di dunia.`, 3);
  else if (old && (h.gen <= 2 || S.rnd() < 0.03)) log('kerja', `👷 ${h.name} beralih profesi dari ${JOB[old].name.toLowerCase()} menjadi ${best.name.toLowerCase()}.`, 1);
}
function tradeYear() {
  const vs = S.villages.filter(v => v.alive && v.pop > 0);
  if (vs.length < 2 || !vs.some(v => v.traders)) return;
  const food = v => { let f = 0; for (const hh of S.households.values()) if (hh.vil === v.id) f += hh.food; return f / Math.max(1, v.pop); };
  const rows = vs.map(v => ({ v, f: food(v) })).sort((a, b) => b.f - a.f);
  const rich = rows[0], poor = rows[rows.length - 1];
  if (rich.f - poor.f < 3) return;
  const amt = Math.min((rich.f - poor.f) / 2 * Math.min(rich.v.pop, poor.v.pop), 40 + 30 * (rich.v.traders + poor.v.traders));
  for (const hh of S.households.values()) {
    if (hh.vil === rich.v.id) hh.food *= 1 - amt / Math.max(1, rich.f * rich.v.pop);
    if (hh.vil === poor.v.id) hh.food += amt / Math.max(1, poor.v.pop) * hh.members.length;
  }
  if (S.rnd() < 0.3) log('sosial', `🐪 Para pedagang membawa ${Math.round(amt)} porsi makanan dari ${rich.v.name} ke ${poor.v.name} untuk ditukar dengan barang kerajinan.`, 1);
}

// ===== Pikiran & keinginan =====
function thinkOf(h, age, hh, v) {
  const opts = [];
  if (h.grief > 0.35) opts.push([3, `masih berduka atas kepergian ${h.griefFor}, sering termenung sendirian.`]);
  if (h.hunger > 0.5) opts.push([3, `perutnya keroncongan, ia memikirkan di mana masih ada makanan.`]);
  if (h.sick) opts.push([3, `terbaring lemah karena ${h.sick.name}, berharap segera pulih.`]);
  if (h.fear > 0.35) opts.push([2, `masih gemetar setelah ${h.fearFor}.`]);
  if (h.preg) opts.push([2, `mengelus perutnya, membayangkan wajah anak yang akan lahir.`]);
  if (age < 6) opts.push([3, pick(['tertawa riang mengejar kupu-kupu.', 'bermain lumpur di tepi sungai.', 'menangis minta digendong ibunya.', 'menyusun kerikil menjadi menara kecil.'])]);
  else if (age < 13) opts.push([3, pick(['meniru orang tuanya membuat alat dari batu.', 'bertanya kepada ayahnya mengapa langit berwarna biru.', 'berlomba lari dengan saudara-saudaranya.', 'memanjat pohon untuk melihat desa dari atas.'])]);
  if (!h.partner && age >= 16 && age < 45) opts.push([1 + h.lonely * 2, 'merasa sepi dan berharap menemukan seseorang untuk berbagi hidup.']);
  if (h.partner && h.love > 0.5) { const p = S.byId.get(h.partner); if (p) opts.push([1, `bersyukur memiliki ${p.name} di sisinya.`]); }
  opts.push([h.traits.cur * 1.5, `bertanya-tanya ${pick(WONDERS)}.`]);
  opts.push([h.traits.cre * 1.2, `membayangkan alat baru yang bisa ${pick(['membuat berburu lebih mudah', 'membawa air dari sungai', 'menyimpan makanan lebih lama', 'membelah kayu lebih cepat', 'menghangatkan rumah'])}.`]);
  if (h.kids.length > 0) opts.push([1, `merasa bangga melihat ${h.kids.length} anaknya tumbuh.`]);
  if (age > 55) opts.push([1.5, `menceritakan kisah masa mudanya kepada anak-cucu.`]);
  if (h.happy > 0.75) opts.push([1, 'merasa damai menatap matahari terbenam di balik gunung.']);
  if (S.weather.type.includes('badai')) opts.push([2, 'gelisah mendengar gemuruh badai di luar.']);
  if (hh && hh.shelter === 0 && season().name === 'Dingin') opts.push([2, 'menggigil kedinginan, ingin punya tempat berlindung yang hangat.']);
  let sum = opts.reduce((s, o) => s + o[0], 0), r = S.rnd() * sum;
  for (const o of opts) { r -= o[0]; if (r <= 0) return o[1]; }
  return opts[0][1];
}
function wantOf(h, age, hh) {
  if (age < 7) return 'bermain & disayang orang tua';
  if (age < 14) return 'belajar menjadi seperti orang dewasa';
  if (h.hunger > 0.5) return 'makanan yang cukup untuk keluarga';
  if (h.sick) return 'sembuh dari penyakit';
  if (!h.partner && age < 45) return 'menemukan pasangan hidup';
  if (h.partner && h.kids.length < 2 && h.sex === 'P' && age < 40) return 'memiliki anak';
  if (hh && hh.shelter < shelterKnown()) return 'rumah yang lebih kokoh';
  if (h.traits.cur > 0.65) return 'menemukan rahasia alam';
  if (h.traits.cre > 0.65) return 'menciptakan sesuatu yang indah';
  if (h.traits.soc > 0.65) return 'dihormati dan dicintai banyak orang';
  return 'hidup tenang bersama keluarga';
}

// ===== Akhir =====
function endSim(reason) {
  if (S.over) return;
  S.over = true; S.endReason = reason;
  if (reason === 'punah') log('mati', '⚫ Manusia terakhir telah tiada. Dunia kembali sunyi, hanya angin dan hewan yang tersisa.', 3);
  else log('era', `⏹️ Waktu simulasi habis setelah ${yearOf(S.day)} tahun dunia berjalan.`, 3);
  S.stats.popHist.push({ y: yearOf(S.day), pop: popCount(), tech: S.tech.size, vil: S.villages.filter(v => v.alive).length });
  if (typeof onSimEnd === 'function') onSimEnd(reason);
}
