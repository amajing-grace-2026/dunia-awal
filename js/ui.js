// ===== Dunia Awal — antarmuka =====
'use strict';

const UI = { selected: 0, selAnimal: null, selVillage: null, labels: true, filter: 'all', lastT: 0, inspT: 0, sideT: 0 };
const $ = id => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
let seed = (Math.random() * 1e9) | 0;

function boot(newSeed) {
  seed = newSeed;
  initSim(seed);
  buildTerrain();
  cam.x = 0; cam.y = 0; cam.zoom = 1; cam.follow = 0;
  UI.selected = 0; UI.selAnimal = null; UI.selVillage = null;
  $('log').innerHTML = '';
  $('seedTxt').textContent = seed;
  $('techT').textContent = TECHS.length;
  renderSpeeds(); updateSide(true); flushLog();
}

// ===== kecepatan =====
function renderSpeeds() {
  $('speeds').innerHTML = SPEEDS.map((s, i) => `<button data-i="${i}" class="${i === S.speedIdx ? 'on' : ''}">${s.label}<small>${s.desc}</small></button>`).join('');
}
$('speeds').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.speedIdx = +b.dataset.i; renderSpeeds();
  log('statistik', `⏩ Kecepatan diubah: ${SPEEDS[S.speedIdx].desc}.`, 3);
});
$('btnPause').onclick = () => {
  if (S.over) return;
  S.paused = !S.paused; $('btnPause').textContent = S.paused ? '▶ Lanjut' : '⏸ Jeda';
};
$('btnEnd').onclick = () => { if (!S.over && confirm('Akhiri simulasi sekarang dan lihat ringkasan?')) endSim('manual'); };
$('btnStart').onclick = () => { $('startModal').hidden = true; S.paused = false; $('btnPause').textContent = '⏸ Jeda'; };
$('btnInf').onclick = () => {
  S.unlimited = !S.unlimited; $('btnInf').classList.toggle('on', S.unlimited);
  log('statistik', S.unlimited ? '♾️ Mode tanpa batas aktif — simulasi akan terus berjalan.' : '⏱️ Batas 15 menit diaktifkan kembali.', 3);
  if (!S.unlimited && S.real >= MAX_REAL_SECONDS) endSim('waktu');
};
$('btnReseed').onclick = () => boot((Math.random() * 1e9) | 0);
$('zin').onclick = () => zoomAt(1.5);
$('zout').onclick = () => zoomAt(1 / 1.5);
$('zreset').onclick = () => { cam.x = cam.y = 0; cam.zoom = 1; cam.follow = 0; };
$('lbl').onclick = () => { UI.labels = !UI.labels; };
document.querySelectorAll('.filt').forEach(b => b.onclick = () => {
  document.querySelectorAll('.filt').forEach(x => x.classList.toggle('on', x === b));
  UI.filter = b.dataset.f; applyFilter();
});
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); $('btnPause').click(); }
  if (/^Digit[1-6]$/.test(e.code)) { S.speedIdx = +e.code.slice(5) - 1; renderSpeeds(); }
});

// ===== kanvas: ukuran, zoom, geser, klik =====
function resize() {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.max(200, r.width * dpr); cv.height = Math.max(200, r.height * dpr);
}
window.addEventListener('resize', resize);
function zoomAt(f, sx, sy) {
  const v = VIS.view; if (!v) return;
  const dpr = window.devicePixelRatio || 1;
  sx = sx ?? cv.width / 2; sy = sy ?? cv.height / 2;
  const wx = (sx - v.ox) / v.sc, wy = (sy - v.oy) / v.sc;
  cam.zoom = clamp(cam.zoom * f, 0.6, 14);
  const base = Math.min(cv.width, cv.height) * 0.44 / W.R, sc = base * cam.zoom;
  cam.x = wx - (sx - cv.width / 2) / sc; cam.y = wy - (sy - cv.height / 2) / sc;
  void dpr;
}
cv.addEventListener('wheel', e => { e.preventDefault(); const dpr = window.devicePixelRatio || 1; const r = cv.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, (e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr); }, { passive: false });
const ptrs = new Map(); let drag = null, pinch0 = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag = { x: e.clientX, y: e.clientY, moved: 0 }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const dpr = window.devicePixelRatio || 1;
  const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) zoomAt(d / pinch0); pinch0 = d; if (drag) drag.moved = 99; return; }
  if (!drag) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.moved > 4) { cam.follow = 0; cam.x -= dx * dpr / VIS.view.sc; cam.y -= dy * dpr / VIS.view.sc; }
});
cv.addEventListener('pointerup', e => {
  ptrs.delete(e.pointerId); pinch0 = 0;
  if (drag && drag.moved <= 4) pickAt(e);
  if (!ptrs.size) drag = null;
});
function pickAt(e) {
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(), v = VIS.view;
  const wx = ((e.clientX - r.left) * dpr - v.ox) / v.sc, wy = ((e.clientY - r.top) * dpr - v.oy) / v.sc;
  const tol = 14 * dpr / v.sc * clamp(Math.sqrt(cam.zoom), 1, 2.6);
  let best = null, bd = tol * tol;
  for (const h of S.alive) { const d = (h.x - wx) ** 2 + (h.y - wy) ** 2; if (d < bd) { bd = d; best = h; } }
  if (best) { UI.selected = best.id; UI.selAnimal = null; UI.selVillage = null; cam.follow = best.id; if (cam.zoom < 3) cam.zoom = 3; updateInspector(); return; }
  for (const a of S.animals) { if (!a.alive) continue; const d = (a.x - wx) ** 2 + (a.y - wy) ** 2; if (d < bd) { bd = d; best = a; } }
  if (best) { UI.selAnimal = best; UI.selected = 0; UI.selVillage = null; updateInspector(); return; }
  for (const vv of S.villages) { if (!vv.alive) continue; const d = (vv.x - wx) ** 2 + (vv.y - wy) ** 2; if (d < (90 ** 2)) { UI.selVillage = vv; UI.selected = 0; UI.selAnimal = null; updateInspector(); return; } }
  UI.selected = 0; cam.follow = 0; updateInspector();
}

// ===== log kisah =====
const FILT = {
  all: () => true, imp: e => e.imp >= 3, life: e => ['lahir', 'mati', 'nikah'].includes(e.type),
  temu: e => ['temu', 'alat', 'era', 'bangun', 'riset', 'kerja'].includes(e.type), pikir: e => e.type === 'pikir', alam: e => ['alam', 'desa', 'statistik', 'era'].includes(e.type),
};
function stampTxt(e) { return `Th ${e.y} · H${e.doy + 1}${SPEEDS[S.speedIdx].f <= DAY ? ' · ' + String(e.hr).padStart(2, '0') + ':00' : ''}`; }
function flushLog() {
  if (!S.logQueue.length) return;
  const box = $('log'), atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  const frag = document.createDocumentFragment();
  for (const e of S.logQueue) {
    const d = document.createElement('div');
    d.className = `le t-${e.type} imp${e.imp}`; d.dataset.type = e.type; d.dataset.imp = e.imp;
    d.innerHTML = `<time>${stampTxt(e)}</time><div></div>`; d.lastChild.textContent = e.text;
    if (!FILT[UI.filter](e)) d.hidden = true;
    frag.appendChild(d);
  }
  S.logQueue.length = 0;
  box.appendChild(frag);
  while (box.childElementCount > 450) box.firstElementChild.remove();
  if (atBottom) box.scrollTop = box.scrollHeight;
}
function applyFilter() {
  for (const d of $('log').children) d.hidden = !FILT[UI.filter]({ type: d.dataset.type, imp: +d.dataset.imp });
  $('log').scrollTop = $('log').scrollHeight;
}

// ===== panel samping =====
const WX_ICON = { cerah: '☀️', berawan: '⛅', hujan: '🌧️', badai: '⛈️', salju: '🌨️', 'badai salju': '🌬️' };
function updateSide(force) {
  const p = S.alive, men = p.filter(h => h.sex === 'L').length, kids = p.filter(h => ageY(h) < 15).length;
  const st = [
    ['Populasi', p.length], ['Pria / Wanita', `${men} / ${p.length - men}`], ['Anak-anak', kids],
    ['Desa', S.villages.filter(v => v.alive).length], ['Generasi', S.stats.maxGen], ['Pasangan', S.stats.marriages + 1],
    ['Lahir', S.stats.born], ['Wafat', S.stats.deaths], ['Karya seni', S.stats.arts],
  ];
  $('stats').innerHTML = st.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  $('era').textContent = '🏛️ ' + currentEra().name;
  $('techN').textContent = S.tech.size;
  if (force || $('techs').childElementCount !== S.techLog.length) $('techs').innerHTML = S.techLog.length ? S.techLog.map(t => `<span title="Ditemukan ${t.who}, tahun ${yearOf(t.day)}">${t.icon} ${t.name}</span>`).join('') : '<span style="opacity:.6">Belum ada…</span>';
  const rs = Object.entries(S.research || {}).filter(([id]) => !S.tech.has(id)).map(([id, r]) => [TECH[id], r.p / techCost(TECH[id]) / r.need, r]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  $('research').innerHTML = rs.length ? rs.map(([t, f, r]) => { const ld = S.byId.get(r.lead); return `<div class="rs">${t.icon} ${t.name} <span style="color:var(--mute)">· ${Math.floor((S.day - r.start) / YEAR_DAYS)} th${ld ? ' · ' + ld.name : ''}</span>${bar(Math.min(0.99, f), '#b48cff')}</div>`; }).join('') : '<span style="opacity:.6">Belum ada…</span>';
  const jc = Object.entries(S.jobCount || {}).sort((a, b) => b[1] - a[1]);
  $('jobs').innerHTML = jc.length ? jc.map(([id, n]) => `<span title="${JOB[id].name}">${JOB[id].icon} ${JOB[id].name} ${n}</span>`).join('') : '<span style="opacity:.6">Belum ada (dihitung tiap akhir tahun)</span>';
  const cnt = {}; for (const a of S.animals) if (a.alive) cnt[a.sp] = (cnt[a.sp] || 0) + 1;
  $('animals').innerHTML = SPECIES.map(s => `<span title="${s.name}">${s.emoji} ${cnt[s.id] || 0}</span>`).join('');
  const w = S.weather, se = season();
  $('wx').textContent = `${WX_ICON[w.type] || '☀️'} ${w.type} · ${w.temp}°C · 🍃 ${Math.round(w.windS * 3.6)} km/j${S.drought ? ' · 🌵 kemarau' : ''}`;
  drawMini();
  void se;
}
function drawMini() {
  const c = $('mini'), dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
  if (c.width !== Math.round(r.width * dpr)) { c.width = r.width * dpr; c.height = r.height * dpr; }
  const x = c.getContext('2d'), H = S.stats.popHist.concat([{ y: yearOf(S.day), pop: popCount() }]);
  x.clearRect(0, 0, c.width, c.height);
  const mx = Math.max(4, ...H.map(h => h.pop)), n = H.length;
  x.strokeStyle = '#7fd18b'; x.lineWidth = 1.6 * dpr; x.beginPath();
  H.forEach((h, i) => { const px = n < 2 ? 0 : i / (n - 1) * (c.width - 8 * dpr) + 4 * dpr, py = c.height - 6 * dpr - h.pop / mx * (c.height - 16 * dpr); i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.stroke();
  x.fillStyle = '#9db3a4'; x.font = `${10 * dpr}px system-ui`; x.fillText(`puncak ${mx}`, 6 * dpr, 12 * dpr);
}

function bar(v, col) { return `<div class="bar"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${col || 'var(--acc)'}"></i></div>`; }
function nameLink(id) { const h = S.byId.get(id); return h ? `<span class="lnk" data-id="${h.id}">${h.name}</span>${h.alive ? '' : ' †'}` : '—'; }
$('insp').addEventListener('click', e => { const l = e.target.closest('.lnk'); if (!l) return; const h = S.byId.get(+l.dataset.id); if (h) { UI.selected = h.id; if (h.alive) cam.follow = h.id; updateInspector(); } });

function updateInspector() {
  const el = $('insp');
  if (UI.selAnimal) {
    const a = UI.selAnimal, s = SPEC[a.sp];
    const n = S.animals.filter(x => x.alive && x.sp === a.sp).length;
    el.innerHTML = `<div class="nm">${s.emoji} ${s.name}</div><div class="row">Populasi di dunia <b>${n}</b></div><div class="row">Habitat <b>${s.biomes.map(b => TNAME[b]).join(', ')}</b></div><div class="row">${s.pred ? 'Predator — berbahaya bagi manusia' : s.dom ? 'Bisa dijinakkan' : 'Hewan liar'}</div>${a.alive ? '' : '<div class="row">Hewan ini sudah mati.</div>'}`;
    return;
  }
  if (UI.selVillage) {
    const v = UI.selVillage, hhs = [...S.households.values()].filter(h => h.vil === v.id);
    const food = hhs.reduce((s, h) => s + h.food, 0), ld = S.byId.get(v.leader);
    const herd = Object.entries(v.herd).filter(([, n]) => n > 0).map(([k, n]) => `${DOMESTIC[k]} ${n}`).join(' ') || '—';
    el.innerHTML = `<div class="nm">🏘️ ${v.name}</div><div class="row">Didirikan <b>tahun ${yearOf(v.founded)}</b></div><div class="row">Penduduk <b>${v.pop}</b></div><div class="row">Keluarga <b>${hhs.length}</b></div><div class="row">Pemimpin <b>${ld ? nameLink(ld.id) : '—'}</b></div><div class="row">Cadangan makanan <b>${Math.round(food)} porsi</b></div><div class="row">Ladang <b>${v.fieldSpots.length} petak</b></div><div class="row">Ternak <b>${herd}</b></div>Ketersediaan buah liar${bar(v.forage)}Hewan buruan${bar(v.game, '#e0a85a')}Ikan${bar(v.fish, '#6bb7e0')}${v.epidemic ? '<div class="row" style="color:var(--warn)">☣️ Sedang dilanda wabah</div>' : ''}`;
    return;
  }
  const h = S.byId.get(UI.selected);
  if (!h) { el.innerHTML = 'Klik seseorang di peta untuk melihat perasaan, pikiran, kebutuhan, dan keinginannya. Klik desa atau hewan untuk info lainnya.'; return; }
  const age = ageY(h), hh = S.households.get(h.hh), v = S.villages[h.vil];
  if (!h.thought && h.alive) { h.thought = thinkOf(h, age, hh, v); h.want = wantOf(h, age, hh); }
  const ageTxt = age < 1 ? `${Math.floor(age * 12)} bulan` : `${Math.floor(age)} tahun`;
  const T = h.traits;
  const tr = [['Rasa ingin tahu', T.cur], ['Kreativitas', T.cre], ['Kemampuan sosial', T.soc], ['Keberanian', T.bra], ['Kebaikan hati', T.kin], ['Sifat agresif', T.agg]];
  const mood = h.grief > 0.4 ? '😢 berduka' : h.fear > 0.4 ? '😨 takut' : h.sick ? '🤒 sakit' : h.hunger > 0.5 ? '😣 lapar' : h.happy > 0.75 ? '😊 bahagia' : h.happy > 0.5 ? '🙂 tenang' : h.lonely > 0.6 ? '😔 kesepian' : '😐 biasa';
  const tools = Object.entries(h.tools).map(([id, d]) => { const t = TOOLS.find(x => x.id === id); return `${t.name} ${d <= 0 ? '(patah)' : Math.round(d) + '%'}`; }).join(', ') || 'belum punya';
  const kidsAlive = h.kids.filter(id => S.byId.get(id)?.alive).length;
  el.innerHTML = `
    <div class="nm">${h.sex === 'L' ? '👨' : '👩'} ${h.name} ${h.leader ? '👑' : ''}${h.alive ? '' : ' †'}</div>
    <div class="row">${h.alive ? 'Usia' : 'Wafat usia'} <b>${ageTxt}${h.alive ? '' : ' — ' + h.causeText}</b></div>
    <div class="row">Generasi <b>ke-${h.gen}</b></div>
    <div class="row">Orang tua <b>${h.father ? nameLink(h.father) + ' & ' + nameLink(h.mother) : 'Diciptakan langsung'}</b></div>
    <div class="row">Pasangan <b>${h.partner ? nameLink(h.partner) : h.widowed ? 'ditinggal wafat' : '—'}</b></div>
    <div class="row">Anak <b>${h.kids.length} (${kidsAlive} hidup)</b></div>
    <div class="row">Desa <b>${v ? v.name : '—'}</b></div>
    ${h.alive ? `
    <div class="row">Pekerjaan <b>${h.job ? JOB[h.job].icon + ' ' + JOB[h.job].name : ageY(h) < 15 ? 'anak-anak' : 'belum ada'}</b></div>
    <div class="row">Sedang <b>${ACTS[h.task] ? ACTS[h.task].icon + ' ' + ACTS[h.task].name : '—'}</b></div>
    <div class="row">Suasana hati <b>${mood}</b></div>
    <div class="thought">💭 “${h.name} ${h.thought}”</div>
    <div class="row">Keinginan <b>✨ ${h.want}</b></div>
    Kesehatan${bar(h.health, '#7fd18b')}Kenyang${bar(1 - h.hunger, '#e0b85a')}Kebahagiaan${bar(h.happy, '#ffd36b')}${h.grief > 0.05 ? 'Duka' + bar(h.grief, '#8a9fc0') : ''}${!h.partner && age > 15 ? 'Kesepian' + bar(h.lonely, '#b08ad0') : ''}
    ${h.preg ? `<div class="row">🤰 Mengandung <b>${Math.max(0, h.preg.due - S.day)} hari lagi</b></div>` : ''}
    ${h.sick ? `<div class="row" style="color:var(--warn)">🤒 Sakit ${h.sick.name}</div>` : ''}
    <div class="row">Rumah <b>${['tanpa atap (di bawah pohon)', 'gubuk daun', 'rumah kayu', 'rumah batu'][hh ? hh.shelter : 0]}</b></div>
    <div class="row">Makanan keluarga <b>${hh ? Math.round(hh.food) : 0} porsi</b></div>` : ''}
    <div class="row">Alat <b>${tools}</b></div>
    ${h.inventions.length ? `<div class="row">Penemuan <b>${h.inventions.map(id => TECH[id].icon + ' ' + TECH[id].name).join(', ')}</b></div>` : ''}
    <div style="margin-top:6px;color:var(--mute);font-size:12px">Kepribadian</div>
    ${tr.map(([k, val]) => `<div class="row" style="font-size:12px">${k}<b>${'●'.repeat(Math.round(val * 5))}${'○'.repeat(5 - Math.round(val * 5))}</b></div>`).join('')}
  `;
}

// ===== loop =====
function frame(t) {
  const dt = Math.min(0.1, (t - (UI.lastT || t)) / 1000); UI.lastT = t;
  advance(dt);
  if (cv.width < 10) resize();
  renderFrame(cv, g, S.paused ? dt * 0.3 : dt);
  flushLog();
  const left = S.unlimited ? S.real : Math.max(0, MAX_REAL_SECONDS - S.real);
  $('timer').textContent = `${S.unlimited ? '∞ ' : ''}${String(Math.floor(left / 60)).padStart(2, '0')}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('low', !S.unlimited && left < 60);
  const se = season(), hr = Math.floor((S.simTime / 3600) % 24), mi = Math.floor((S.simTime / 60) % 60);
  $('clk').textContent = `Tahun ${yearOf(S.day)} · Hari ${(S.day % YEAR_DAYS) + 1}`;
  $('clk2').textContent = `${se.icon} ${se.name}${SPEEDS[S.speedIdx].f <= DAY ? ` · ${String(hr).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : ''}${S.paused && !S.over ? ' · dijeda' : ''}`;
  $('lagChip').hidden = !S.lag;
  UI.sideT -= dt; if (UI.sideT <= 0) { updateSide(); UI.sideT = 0.5; }
  UI.inspT -= dt; if (UI.inspT <= 0) { updateInspector(); UI.inspT = 0.4; }
  requestAnimationFrame(frame);
}

// ===== ringkasan akhir =====
function onSimEnd(reason) {
  $('btnPause').textContent = '⏹ Selesai';
  setTimeout(() => { flushLog(); showSummary(reason); }, 300);
}
function descendantsOf(id) {
  let n = 0; const seen = new Set(), st = [...(S.byId.get(id)?.kids || [])];
  while (st.length) { const k = st.pop(); if (seen.has(k)) continue; seen.add(k); n++; st.push(...(S.byId.get(k)?.kids || [])); }
  return n;
}
function showSummary(reason) {
  const years = (S.day / YEAR_DAYS).toFixed(1), st = S.stats, pop = popCount();
  const adam = S.humans[0], hawa = S.humans[1];
  const dead = S.humans.filter(h => !h.alive);
  const avgLife = dead.length ? dead.reduce((s, h) => s + (h.died - h.born) / YEAR_DAYS, 0) / dead.length : 0;
  const adults = dead.filter(h => (h.died - h.born) / YEAR_DAYS >= 15);
  const avgAdult = adults.length ? adults.reduce((s, h) => s + (h.died - h.born) / YEAR_DAYS, 0) / adults.length : 0;
  const byKids = [...S.humans].sort((a, b) => b.kids.length - a.kids.length)[0];
  const byInv = [...S.humans].sort((a, b) => b.inventions.length - a.inventions.length)[0];
  const byArt = [...S.humans].sort((a, b) => b.arts - a.arts)[0];
  const oldestAlive = S.alive.reduce((b, h) => (!b || ageY(h) > ageY(b) ? h : b), null);
  const era = currentEra();
  const fate = h => h.alive ? `masih hidup (${Math.floor(ageY(h))} th)` : `wafat usia ${Math.floor((h.died - h.born) / YEAR_DAYS)} th, tahun ke-${yearOf(h.died)} — ${h.causeText}`;
  const causes = Object.entries(st.causes).sort((a, b) => b[1] - a[1]);
  const cmax = causes.length ? causes[0][1] : 1;
  const vils = S.villages.map(v => `${v.name} (${v.alive ? v.pop + ' jiwa' : 'ditinggalkan'})`).join(', ');
  const reasonTxt = reason === 'punah' ? '⚫ Umat manusia punah' : reason === 'manual' ? '⏹️ Dihentikan manual' : '⏱️ Batas 15 menit tercapai';
  const narr = narrative({ years, pop, era, adam, hawa, avgAdult });
  $('endCard').innerHTML = `
    <h1>📜 Ringkasan Dunia Awal</h1>
    <p style="color:var(--mute)">${reasonTxt} · ${years} tahun dunia berjalan · seed ${S.seed}</p>
    <p>${narr}</p>
    <div class="kpis">
      <div class="kpi"><b>${pop}</b><span>populasi akhir</span></div>
      <div class="kpi"><b>${st.peak}</b><span>puncak populasi (th ${st.peakYear})</span></div>
      <div class="kpi"><b>${st.born}</b><span>kelahiran</span></div>
      <div class="kpi"><b>${st.deaths}</b><span>kematian</span></div>
      <div class="kpi"><b>${st.maxGen}</b><span>generasi</span></div>
      <div class="kpi"><b>${S.tech.size}/${TECHS.length}</b><span>penemuan</span></div>
      <div class="kpi"><b>${S.villages.filter(v => v.alive).length}</b><span>desa berdiri</span></div>
      <div class="kpi"><b>${avgAdult.toFixed(0)} th</b><span>rata-rata umur dewasa</span></div>
    </div>
    <h2>Pencapaian peradaban</h2>
    <p><b>${era.name}</b>. ${st.arts} karya seni, ${st.songs} lagu, ${st.stories} cerita rakyat, ${st.toolsMade} alat dibuat dan ${st.toolsFixed} kali alat diperbaiki, ${st.marriages + 1} pasangan menikah.</p>
    <canvas id="sumChart"></canvas>
    <div class="grid2">
      <div>
        <h2>Nasib Adam & Hawa</h2>
        <p>👨 <b>Adam</b>: ${fate(adam)}; ${adam.kids.length} anak, ${descendantsOf(adam.id)} keturunan.<br>👩 <b>Hawa</b>: ${fate(hawa)}; ${hawa.kids.length} anak, ${descendantsOf(hawa.id)} keturunan.</p>
        <h2>Tokoh menonjol</h2>
        <p>👴 Umur terpanjang: <b>${st.oldest ? st.oldest.name + ' (' + Math.floor(st.oldest.age) + ' th)' : '—'}</b><br>
        👪 Anak terbanyak: <b>${byKids.name} (${byKids.kids.length})</b><br>
        💡 Penemu terbesar: <b>${byInv.inventions.length ? byInv.name + ' (' + byInv.inventions.length + ' penemuan)' : '—'}</b><br>
        🎨 Seniman paling produktif: <b>${byArt.arts ? byArt.name + ' (' + byArt.arts + ' karya)' : '—'}</b><br>
        ${oldestAlive ? `🧓 Tertua yang masih hidup: <b>${oldestAlive.name} (${Math.floor(ageY(oldestAlive))} th)</b>` : ''}</p>
        <h2>Desa</h2><p>${vils}</p>
      </div>
      <div>
        <h2>Penyebab kematian</h2>
        ${causes.map(([k, n]) => `<div class="cbar"><span>${CAUSES[k]}</span><i style="width:${Math.max(4, n / cmax * 180)}px"></i>${n}</div>`).join('') || '<p>Belum ada yang wafat.</p>'}
        <p style="font-size:12.5px;color:var(--mute)">Rata-rata usia saat wafat (semua umur, termasuk bayi): ${avgLife.toFixed(1)} tahun.</p>
        <h2>Bencana & wabah (${st.disasters.length})</h2>
        <ul class="tl">${st.disasters.slice(-8).map(d => `<li><time>Th ${yearOf(d.day)}</time>${d.text}</li>`).join('') || '<li>Tidak ada bencana besar.</li>'}</ul>
      </div>
    </div>
    <h2>Penemuan & teknologi</h2>
    <ul class="tl">${S.techLog.map(t => `<li><time>Th ${yearOf(t.day)}</time>${t.icon} <b>${t.name}</b> — oleh ${t.who} (usia ${t.age})${t.yrs >= 1 ? `, setelah ±${Math.round(t.yrs)} th percobaan` : ''}</li>`).join('') || '<li>Belum ada penemuan.</li>'}</ul>
    <h2>Hampir ditemukan</h2>
    <p>${Object.entries(S.research || {}).filter(([id]) => !S.tech.has(id)).map(([id, r]) => [TECH[id], Math.min(99, Math.round(r.p / techCost(TECH[id]) / r.need * 100))]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, p]) => `${t.icon} ${t.name} (${p}%)`).join(' · ') || '—'}</p>
    <h2>Pekerjaan penduduk (akhir simulasi)</h2>
    <p>${Object.entries(S.jobCount || {}).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${JOB[id].icon} ${JOB[id].name}: <b>${n}</b>`).join(' · ') || '—'}</p>
    <h2>Garis waktu peristiwa penting</h2>
    <ul class="tl">${st.milestones.filter(m => !m.text.includes('ditemukan oleh')).map(m => `<li><time>Th ${yearOf(m.day)}</time>${m.text}</li>`).join('')}</ul>
    <div class="actions">
      <button class="btn primary" id="sNew">🌍 Mulai dunia baru</button>
      <button class="btn" id="sLook">👀 Lihat dunia terakhir</button>
      <button class="btn" id="sDl">⬇️ Unduh ringkasan (.txt)</button>
    </div>`;
  $('endModal').hidden = false;
  drawSumChart();
  $('sNew').onclick = () => { $('endModal').hidden = true; boot((Math.random() * 1e9) | 0); $('startModal').hidden = false; $('btnPause').textContent = '▶ Jalankan'; };
  $('sLook').onclick = () => { $('endModal').hidden = true; };
  $('sDl').onclick = () => {
    const txt = $('endCard').innerText.replace(/\n{3,}/g, '\n\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = `ringkasan-dunia-awal-${S.seed}.txt`; a.click();
  };
}
function narrative({ years, pop, era, adam, hawa, avgAdult }) {
  const st = S.stats, first = S.techLog[0], last = S.techLog[S.techLog.length - 1];
  let s = `Selama ${years} tahun, dunia kecil ini berkembang dari dua manusia — Adam dan Hawa — menjadi ${pop > 0 ? pop + ' jiwa yang tersebar di ' + S.villages.filter(v => v.alive).length + ' desa' : 'sebuah kisah yang berakhir dengan kepunahan'}. `;
  s += `Sebanyak ${st.born} bayi lahir dalam ${st.maxGen} generasi. `;
  if (first) s += `Penemuan pertama adalah ${first.name} oleh ${first.who}, ${last && last !== first ? 'dan yang terakhir ' + last.name + ' oleh ' + last.who + ' pada tahun ke-' + yearOf(last.day) : ''}. `;
  s += `Pada akhir simulasi, umat manusia berada di ${era.name}. `;
  if (st.causes.lapar > st.deaths * 0.2) s += 'Kelaparan menjadi tantangan terbesar mereka. ';
  else if ((st.causes.penyakit || 0) + (st.causes.bayi || 0) > st.deaths * 0.35) s += 'Penyakit, terutama pada bayi, menjadi musuh terbesar. ';
  if (avgAdult) s += `Mereka yang berhasil melewati masa kanak-kanak rata-rata hidup hingga ${avgAdult.toFixed(0)} tahun.`;
  return s;
}
function drawSumChart() {
  const c = $('sumChart'), dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
  c.width = r.width * dpr; c.height = r.height * dpr;
  const x = c.getContext('2d'), H = S.stats.popHist;
  if (H.length < 2) { x.fillStyle = '#9db3a4'; x.font = `${12 * dpr}px system-ui`; x.fillText('Data kurang dari 2 tahun — grafik populasi muncul jika simulasi berjalan lebih lama.', 12 * dpr, 24 * dpr); return; }
  const mx = Math.max(...H.map(h => h.pop)), mt = TECHS.length, pad = 30 * dpr, W2 = c.width - pad - 10 * dpr, H2 = c.height - 2 * pad;
  x.strokeStyle = '#2c3b32'; x.lineWidth = dpr;
  for (let i = 0; i <= 4; i++) { const y = pad + H2 * i / 4; x.beginPath(); x.moveTo(pad, y); x.lineTo(pad + W2, y); x.stroke(); }
  const line = (key, max, col) => { x.strokeStyle = col; x.lineWidth = 2 * dpr; x.beginPath(); H.forEach((h, i) => { const px = pad + i / (H.length - 1) * W2, py = pad + H2 - h[key] / max * H2; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); };
  line('pop', mx, '#7fd18b'); line('tech', mt, '#ffd36b');
  x.fillStyle = '#9db3a4'; x.font = `${11 * dpr}px system-ui`;
  x.fillText(`Populasi (maks ${mx})`, pad, 16 * dpr); x.fillStyle = '#ffd36b'; x.fillText('Penemuan', pad + 150 * dpr, 16 * dpr);
  x.fillStyle = '#9db3a4'; x.fillText('Th 1', pad, c.height - 8 * dpr); x.textAlign = 'right'; x.fillText(`Th ${H[H.length - 1].y}`, pad + W2, c.height - 8 * dpr);
}

// ===== uji cepat (untuk pengembang) =====
window.__dunia = {
  ff(years) { const was = S.paused; S.paused = false; const t0 = performance.now(); for (let i = 0; i < years * YEAR_DAYS && !S.over; i++) { dailyTick(); S.simTime = S.day * DAY + 1; } S.paused = was; return { ms: Math.round(performance.now() - t0), year: yearOf(S.day), pop: popCount(), tech: S.tech.size, vil: S.villages.filter(v => v.alive).length, era: currentEra().name, causes: S.stats.causes }; },
  get S() { return S; },
};

boot(seed);
resize();
requestAnimationFrame(frame);
