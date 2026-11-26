// ===== Dunia Awal — rendering kanvas =====
'use strict';

const TS = 1200; // resolusi gambar medan
const VIS = { clouds: [], drops: [], weather: null, wTimer: 0, flash: 0, t: 0, sprites: {}, terrain: null, floraCv: null, floraSeason: -1, floraTimer: 0 };
const cam = { x: 0, y: 0, zoom: 1, follow: 0 };

const TCOL = [null, [40, 96, 146], [62, 132, 178], [212, 196, 142], [112, 160, 72], [72, 122, 56], [128, 138, 86], [124, 114, 102], [236, 240, 246], [150, 174, 82]];

function sprite(emoji, px = 40) {
  const key = emoji + px; if (VIS.sprites[key]) return VIS.sprites[key];
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d'); g.font = `${px * 0.8}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, px / 2, px / 2 + px * 0.05);
  VIS.sprites[key] = c; return c;
}

function buildTerrain() {
  const w = S.world, R = W.R, G = W.G;
  const c = document.createElement('canvas'); c.width = c.height = TS;
  const g = c.getContext('2d'); const img = g.createImageData(TS, TS); const d = img.data;
  const hb = (x, y) => { // tinggi bilinear
    const fx = (x + R) / W.cell - 0.5, fy = (y + R) / W.cell - 0.5;
    const ix = clamp(Math.floor(fx), 0, G - 2), iy = clamp(Math.floor(fy), 0, G - 2), ux = fx - ix, uy = fy - iy;
    const i = iy * G + ix;
    return (w.h[i] * (1 - ux) + w.h[i + 1] * ux) * (1 - uy) + (w.h[i + G] * (1 - ux) + w.h[i + G + 1] * ux) * uy;
  };
  const sc = 2 * R / TS;
  for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
    const x = px * sc - R, y = py * sc - R, o = (py * TS + px) * 4;
    if (x * x + y * y > R * R) { d[o + 3] = 0; continue; }
    const j = (w.fbm3(x / 22, y / 22, 2) - 0.5) * 16;
    const t = w.typeAt(x + j, y - j);
    let [r, gg, b] = TCOL[t] || TCOL[4];
    const hv = hb(x, y);
    const shade = 1 + (hb(x - 4, y - 4) - hv) * -9 + (hv - 0.4) * 0.25;
    const tex = (w.fbm3(x / 7, y / 7, 2) - 0.5) * 0.18;
    let k = clamp(shade + tex, 0.55, 1.45);
    if (t === 1 || t === 2) { k = 0.9 + tex * 0.6 + (t === 1 ? -hv * 0.3 : 0); }
    r *= k; gg *= k; b *= k;
    if (t === 9 && w.fbm3(x / 3, y / 3, 1) > 0.78) { const fl = [[240, 200, 60], [230, 110, 160], [250, 250, 250], [170, 120, 220]][(px * 7 + py * 13) % 4]; r = fl[0]; gg = fl[1]; b = fl[2]; }
    // tepi dunia sedikit gelap
    const rr = Math.sqrt(x * x + y * y) / R; if (rr > 0.97) { const f = 1 - (rr - 0.97) * 8; r *= f; gg *= f; b *= f; }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  VIS.terrain = c;
  VIS.floraCv = document.createElement('canvas'); VIS.floraCv.width = VIS.floraCv.height = TS;
  // awan
  VIS.clouds = [];
  for (let i = 0; i < 18; i++) {
    const puffs = []; const n = 4 + ((Math.random() * 5) | 0);
    for (let k = 0; k < n; k++) puffs.push({ dx: (Math.random() - 0.5) * 120, dy: (Math.random() - 0.5) * 50, r: 30 + Math.random() * 45 });
    VIS.clouds.push({ x: (Math.random() - 0.5) * 2600, y: (Math.random() - 0.5) * 2600, puffs, th: i / 18 });
  }
}

function seasonIdx() { return Math.floor((S.day % YEAR_DAYS) / 91.25); }

function drawFlora() {
  const c = VIS.floraCv, g = c.getContext('2d'), s = TS / (2 * W.R), si = seasonIdx();
  g.clearRect(0, 0, TS, TS);
  g.save(); g.scale(s, s); g.translate(W.R, W.R);
  // bekas terbakar
  for (const b of S.burns || []) {
    const age = (S.day - b.day) / 365; if (age > 3) continue;
    g.fillStyle = `rgba(40,30,20,${0.45 * (1 - age / 3)})`; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.fill();
  }
  // ladang
  const fieldCol = ['#7a5a32', '#6fa83a', '#d9b44a', '#6b5434'][si];
  for (const v of S.villages) for (const f of v.fieldSpots) {
    g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
    g.fillStyle = '#5e452a'; g.fillRect(-12, -8, 24, 16);
    g.fillStyle = fieldCol; for (let k = -6; k <= 6; k += 4) g.fillRect(-11, k - 1, 22, 2.2);
    g.restore();
  }
  const leaf = [['#5f9e3c', '#8ccf5a'], ['#3f8a32', '#6cb24a'], ['#c0782a', '#e3a33d'], ['#7a6a55', '#9c8a70']][si];
  const pine = si === 3 ? ['#2e5a3a', '#e8eef2'] : ['#21512f', '#3a7a45'];
  for (const f of S.flora) {
    if (!f.alive) continue;
    const r = f.size;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(f.x + r * 0.4, f.y + r * 0.45, r, r * 0.6, 0, 0, 6.283); g.fill();
    if (f.kind === 'pinus') {
      g.fillStyle = pine[0]; g.beginPath(); g.moveTo(f.x, f.y - r * 1.3); g.lineTo(f.x + r * 0.8, f.y + r * 0.6); g.lineTo(f.x - r * 0.8, f.y + r * 0.6); g.fill();
      g.fillStyle = pine[1]; g.beginPath(); g.moveTo(f.x, f.y - r * 1.3); g.lineTo(f.x + r * 0.35, f.y - r * 0.2); g.lineTo(f.x - r * 0.4, f.y - r * 0.1); g.fill();
    } else if (f.kind === 'palem') {
      g.strokeStyle = '#3d8a3a'; g.lineWidth = 1.6;
      for (let a = 0; a < 6.28; a += 1.05) { g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.8); g.stroke(); }
    } else if (f.kind === 'semak') {
      g.fillStyle = si === 3 ? '#6d6450' : '#4c8a38'; g.beginPath(); g.arc(f.x, f.y, r * 0.6, 0, 6.283); g.fill();
      if (si === 1 || si === 2) { g.fillStyle = '#d63a4a'; for (let k = 0; k < 4; k++) g.fillRect(f.x + Math.cos(k * 1.7) * r * 0.35, f.y + Math.sin(k * 1.7) * r * 0.35, 1.6, 1.6); }
    } else {
      const bare = si === 3;
      g.fillStyle = bare ? '#5a4632' : leaf[0]; g.beginPath(); g.arc(f.x, f.y, bare ? r * 0.55 : r, 0, 6.283); g.fill();
      if (!bare) { g.fillStyle = leaf[1]; g.beginPath(); g.arc(f.x - r * 0.3, f.y - r * 0.3, r * 0.5, 0, 6.283); g.fill(); }
      if (f.kind === 'buah' && (si === 0)) { g.fillStyle = '#f4b6cf'; for (let k = 0; k < 5; k++) g.fillRect(f.x + Math.cos(k * 1.3) * r * 0.6, f.y + Math.sin(k * 1.3) * r * 0.6, 2, 2); }
      if (f.kind === 'buah' && (si === 1 || si === 2)) { g.fillStyle = si === 1 ? '#e8443a' : '#f2a020'; for (let k = 0; k < 5; k++) g.fillRect(f.x + Math.cos(k * 1.3) * r * 0.55, f.y + Math.sin(k * 1.3) * r * 0.55, 2.2, 2.2); }
    }
  }
  g.restore();
  VIS.floraSeason = si; S.floraDirty = false;
}

function daylight(hr) {
  // 0 malam .. 1 siang
  if (hr < 4.5 || hr > 20) return 0;
  if (hr < 7) return (hr - 4.5) / 2.5;
  if (hr > 17.5) return 1 - (hr - 17.5) / 2.5;
  return 1;
}

function lerpC(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;

function renderFrame(cv, g, realDt) {
  VIS.t += realDt;
  const cw = cv.width, ch = cv.height, dpr = window.devicePixelRatio || 1;
  const sp = SPEEDS[S.speedIdx].f;
  const cycle = sp <= DAY;
  const hr = (S.simTime / 3600) % 24;
  const light = cycle ? daylight(hr) : 1;
  // cuaca visual (diperhalus saat cepat)
  VIS.wTimer -= realDt;
  if (!VIS.weather || VIS.wTimer <= 0) { VIS.weather = { ...S.weather }; VIS.wTimer = sp >= DAY * 7 ? 0.8 : 0.05; }
  const wv = VIS.weather;
  if (S.flash) { VIS.flash = 1; S.flash = 0; }
  VIS.flash = Math.max(0, VIS.flash - realDt * 3);

  // langit
  const si = seasonIdx();
  const dayTop = [[96, 160, 220], [70, 150, 230], [120, 150, 190], [150, 170, 195]][si];
  const night = [8, 12, 30], dusk = [230, 120, 80];
  let top = lerpC(night, dayTop, light);
  if (cycle && light > 0 && light < 1) top = lerpC(top, dusk, 0.35 * (1 - Math.abs(light - 0.5) * 2));
  const grey = wv.cloud > 0.7 ? 0.35 : 0;
  top = lerpC(top, [90, 95, 105], grey * light);
  const grd = g.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  grd.addColorStop(0, rgb(lerpC(top, [255, 255, 255], 0.15)));
  grd.addColorStop(1, rgb(lerpC(top, [0, 0, 0], 0.35)));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
  if (light < 0.6) {
    g.fillStyle = `rgba(255,255,255,${(0.6 - light) * 1.4})`;
    for (let i = 0; i < 140; i++) { const x = (i * 9301 + 49297) % cw, y = (i * 233 + 7919 * i) % ch; const tw = 0.5 + 0.5 * Math.sin(VIS.t * 2 + i); g.fillRect(x, y, 1.3 * dpr * tw + 0.3, 1.3 * dpr * tw + 0.3); }
  }

  // kamera
  if (cam.follow) { const h = S.byId.get(cam.follow); if (h && h.alive) { cam.x += (h.x - cam.x) * Math.min(1, realDt * 4); cam.y += (h.y - cam.y) * Math.min(1, realDt * 4); } }
  const base = Math.min(cw, ch) * 0.44 / W.R, sc = base * cam.zoom;
  const ox = cw / 2 - cam.x * sc, oy = ch / 2 - cam.y * sc;
  VIS.view = { sc, ox, oy };
  const R = W.R;

  // matahari / bulan mengorbit dunia
  g.setTransform(sc, 0, 0, sc, ox, oy);
  if (cycle) {
    const a = (hr / 24) * Math.PI * 2 + Math.PI / 2;
    const sx = Math.cos(a) * R * 1.22, sy = Math.sin(a) * R * 1.22;
    const sg = g.createRadialGradient(sx, sy, 5, sx, sy, 140); sg.addColorStop(0, 'rgba(255,240,170,1)'); sg.addColorStop(0.25, 'rgba(255,210,90,0.8)'); sg.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, 140, 0, 6.283); g.fill();
    const mx = -sx, my = -sy; g.fillStyle = 'rgba(235,238,250,0.95)'; g.beginPath(); g.arc(mx, my, 34, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(200,205,225,0.9)'; g.beginPath(); g.arc(mx + 10, my - 6, 7, 0, 6.283); g.arc(mx - 9, my + 9, 5, 0, 6.283); g.fill();
  } else {
    const sg = g.createRadialGradient(-R * 0.95, -R * 1.05, 5, -R * 0.95, -R * 1.05, 150); sg.addColorStop(0, 'rgba(255,240,170,1)'); sg.addColorStop(0.3, 'rgba(255,210,90,0.7)'); sg.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(-R * 0.95, -R * 1.05, 150, 0, 6.283); g.fill();
  }

  // bayangan & kerak bumi
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(30, 60, R * 1.01, R * 1.01, 0, 0, 6.283); g.fill();
  const rim = g.createLinearGradient(0, R * 0.6, 0, R * 1.08); rim.addColorStop(0, '#5a3e28'); rim.addColorStop(1, '#2a1c12');
  g.fillStyle = rim; g.beginPath(); g.arc(0, 26, R, 0, 6.283); g.fill();

  // medan
  g.save();
  g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.clip();
  g.imageSmoothingEnabled = true;
  g.drawImage(VIS.terrain, -R, -R, 2 * R, 2 * R);
  // musim dingin: salju
  if (si === 3) { g.fillStyle = `rgba(240,245,255,${S.weather.temp < 0 ? 0.42 : 0.22})`; g.fillRect(-R, -R, 2 * R, 2 * R); }
  if (si === 2) { g.fillStyle = 'rgba(200,120,30,0.08)'; g.fillRect(-R, -R, 2 * R, 2 * R); }
  if (S.drought > 0) { g.fillStyle = 'rgba(200,160,60,0.15)'; g.fillRect(-R, -R, 2 * R, 2 * R); }
  // air berkilau
  VIS.floraTimer -= realDt;
  if ((S.floraDirty && VIS.floraTimer <= 0) || VIS.floraSeason !== si) { drawFlora(); VIS.floraTimer = 0.8; }
  g.drawImage(VIS.floraCv, -R, -R, 2 * R, 2 * R);

  const k = 1 / sc, zf = clamp(Math.sqrt(cam.zoom), 1, 2.6);
  // desa & bangunan
  drawInfra(g, k, zf);
  drawVillages(g, k, zf, light);
  // hewan
  drawAnimals(g, k, zf, realDt, sp);
  // manusia
  drawHumans(g, k, zf, realDt, sp, cycle, hr);

  // awan + bayangan
  const ws = wv.windS, wa = S.weather.windA;
  const cs = Math.min(ws * 6, ws * 0.25 * sp / 1) * realDt;
  for (const c of VIS.clouds) {
    c.x += Math.cos(wa) * cs; c.y += Math.sin(wa) * cs;
    if (c.x > 1400) c.x -= 2800; if (c.x < -1400) c.x += 2800; if (c.y > 1400) c.y -= 2800; if (c.y < -1400) c.y += 2800;
  }
  for (const pass of [0, 1]) for (const c of VIS.clouds) {
    const al = clamp((wv.cloud - c.th * 0.9) * 2.5, 0, 1) * clamp(1.5 - cam.zoom * 0.25, 0.2, 1); if (al <= 0) continue;
    const dark = wv.cloud > 0.75;
    g.fillStyle = pass === 0 ? `rgba(0,0,0,${0.14 * al})` : dark ? `rgba(120,125,135,${0.75 * al})` : `rgba(255,255,255,${0.72 * al})`;
    for (const p of c.puffs) { g.beginPath(); g.arc(c.x + p.dx + (pass ? 0 : 40), c.y + p.dy + (pass ? 0 : 55), p.r, 0, 6.283); g.fill(); }
  }
  g.restore();
  drawSkyTech(g, k, zf);

  // malam
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (light < 1) {
    g.fillStyle = `rgba(8,12,40,${(1 - light) * 0.62})`;
    g.beginPath(); g.arc(ox, oy, R * sc, 0, 6.283); g.fill();
    // cahaya api
    g.globalCompositeOperation = 'lighter';
    for (const v of S.villages) {
      if (!v.alive || !has('api')) continue;
      const x = ox + v.x * sc, y = oy + v.y * sc, rr = (40 + Math.sqrt(v.pop) * 8) * sc * (0.9 + Math.sin(VIS.t * 9 + v.id) * 0.06);
      const fg = g.createRadialGradient(x, y, 1, x, y, rr); fg.addColorStop(0, `rgba(255,170,60,${0.5 * (1 - light)})`); fg.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
    }
    if (has('lampu')) {
      g.fillStyle = `rgba(255,215,120,${0.55 * (1 - light)})`;
      for (const hh of S.households.values()) { if (hh.shelter < 2) continue; g.beginPath(); g.arc(ox + hh.x * sc, oy + hh.y * sc, Math.max(2, 9 * sc), 0, 6.283); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
  }

  // hujan / salju
  const rainy = wv.type === 'hujan' || wv.type === 'badai', snowy = wv.type.includes('salju');
  if (rainy || snowy) {
    const n = wv.type.startsWith('badai') ? 420 : 200;
    while (VIS.drops.length < n) VIS.drops.push({ x: Math.random() * cw, y: Math.random() * ch, v: 0.7 + Math.random() * 0.6 });
    VIS.drops.length = n;
    g.save(); g.beginPath(); g.arc(ox, oy, R * sc, 0, 6.283); g.clip();
    const wx = Math.cos(wa) * ws * 0.8;
    g.strokeStyle = 'rgba(200,215,240,0.55)'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = dpr;
    g.beginPath();
    for (const d of VIS.drops) {
      if (snowy) { d.y += 60 * d.v * realDt * dpr; d.x += (wx * 6 + Math.sin(VIS.t + d.v * 9) * 15) * realDt * dpr; g.rect(d.x, d.y, 2 * dpr, 2 * dpr); }
      else { d.y += 700 * d.v * realDt * dpr; d.x += wx * 30 * realDt * dpr; g.moveTo(d.x, d.y); g.lineTo(d.x + wx * 2, d.y + 12 * dpr); }
      if (d.y > ch) { d.y = -10; d.x = Math.random() * cw; } if (d.x > cw) d.x = 0; if (d.x < 0) d.x = cw;
    }
    if (snowy) g.fill(); else g.stroke();
    g.restore();
  }
  if (VIS.flash > 0) {
    g.fillStyle = `rgba(230,235,255,${VIS.flash * 0.45})`; g.fillRect(0, 0, cw, ch);
    if (VIS.flash > 0.7) {
      g.strokeStyle = `rgba(255,255,230,${VIS.flash})`; g.lineWidth = 2.5 * dpr; g.beginPath();
      let x = ox + (Math.random() - 0.5) * R * sc, y = oy - R * sc * 0.9; g.moveTo(x, y);
      for (let i = 0; i < 9; i++) { x += (Math.random() - 0.5) * 50 * dpr; y += 45 * dpr; g.lineTo(x, y); }
      g.stroke();
    }
  }
  // label
  drawLabels(g, sc, ox, oy, dpr);
}

function villageLinks() {
  const vs = S.villages.filter(v => v.alive), key = vs.map(v => v.id).join(',');
  if (VIS.linkKey === key) return VIS.links;
  const links = [], seen = new Set();
  for (const a of vs) {
    const near = vs.filter(b => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, 2);
    for (const b of near) { const id = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id); if (!seen.has(id)) { seen.add(id); links.push([a, b]); } }
  }
  VIS.linkKey = key; VIS.links = links; return links;
}
function drawInfra(g, k, zf) {
  if (!has('roda')) return;
  const links = villageLinks(), t = VIS.t, rail = has('kereta_api'), road = has('mobil') ? '#555a60' : '#9a7a52';
  for (const [a, b] of links) {
    g.strokeStyle = road; g.lineWidth = (has('mobil') ? 5 : 3) * k * zf; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    if (rail) {
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), nx = -dy / L * 6, ny = dx / L * 6;
      g.strokeStyle = '#3b3029'; g.lineWidth = 1.5 * k * zf; g.beginPath(); g.moveTo(a.x + nx, a.y + ny); g.lineTo(b.x + nx, b.y + ny); g.stroke();
    }
  }
  links.forEach(([a, b], i) => {
    const sz = 14 * k * zf;
    if (rail && i % 2 === 0) { const f = (Math.sin(t * 0.25 + i) + 1) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); g.drawImage(sprite('🚂', 40), a.x + dx * f - dy / L * 6 - sz / 2, a.y + dy * f + dx / L * 6 - sz / 2, sz, sz); }
    if (has('mobil')) for (let c = 0; c < 2; c++) { const f = ((t * 0.08 + i * 0.37 + c * 0.5) % 1); g.drawImage(sprite(c ? '🚙' : '🚗', 40), a.x + (b.x - a.x) * f - sz * 0.4, a.y + (b.y - a.y) * f - sz * 0.4, sz * 0.8, sz * 0.8); }
    else if (has('gerobak') && i % 2 === 1) { const f = (Math.sin(t * 0.12 + i) + 1) / 2; g.drawImage(sprite('🛒', 40), a.x + (b.x - a.x) * f - sz * 0.35, a.y + (b.y - a.y) * f - sz * 0.35, sz * 0.7, sz * 0.7); }
  });
}
function drawSkyTech(g, k, zf) {
  const t = VIS.t, R = W.R;
  if (has('kapal_layar') && S.world.lake) { const L = S.world.lake, a = t * 0.15; g.drawImage(sprite('⛵', 40), L.x + Math.cos(a) * L.rx * 0.5 - 8 * k * zf, L.y + Math.sin(a) * L.ry * 0.5 - 8 * k * zf, 16 * k * zf, 16 * k * zf); }
  if (has('pesawat')) { const f = (t * 0.05) % 1.4 - 0.2, sz = 22 * k * zf; g.drawImage(sprite('✈️', 48), -R + f * 2 * R - sz / 2, -R * 0.3 + f * R * 0.6 - sz / 2, sz, sz); }
  if (has('satelit')) for (let i = 0; i < (has('internet') ? 3 : 1); i++) { const a = t * 0.2 + i * 2.1, sz = 20 * k * zf; g.drawImage(sprite('🛰️', 48), Math.cos(a) * R * 1.12 - sz / 2, Math.sin(a) * R * 1.12 * 0.9 - sz / 2, sz, sz); }
  if (has('roket')) { const cyc = (t % 30) / 6; if (cyc < 1) { const v = S.villages.find(x => x.alive) || { x: 0, y: 0 }, sz = 20 * k * zf; g.drawImage(sprite('🚀', 48), v.x + 40 - sz / 2, v.y - cyc * R * 1.4 - sz / 2, sz, sz); } }
}

function drawVillages(g, k, zf, light) {
  const t = VIS.t;
  for (const hh of S.households.values()) {
    const x = hh.x, y = hh.y, s = 5 * k * zf * 1.6;
    if (hh.shelter === 0) continue;
    if (hh.shelter === 1) {
      g.fillStyle = '#7d6a3a'; g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
      g.fillStyle = '#a89150'; g.beginPath(); g.arc(x - s * 0.2, y - s * 0.2, s * 0.55, 0, 6.283); g.fill();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - s + s * 0.3, y - s * 0.8 + s * 0.3, s * 2, s * 1.6);
      if (hh.shelter === 4) {
        g.fillStyle = '#7f93a8'; g.fillRect(x - s, y - s * 1.6, s * 2, s * 2.4);
        g.fillStyle = light < 0.7 && has('lampu') ? '#ffe28a' : '#cfe3f5';
        for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 2; wx++) g.fillRect(x - s * 0.7 + wx * s * 0.8, y - s * 1.35 + wy * s * 0.7, s * 0.5, s * 0.4);
        continue;
      }
      g.fillStyle = hh.shelter === 2 ? '#8a5a33' : '#a8a39a'; g.fillRect(x - s, y - s * 0.8, s * 2, s * 1.6);
      g.fillStyle = hh.shelter === 2 ? '#5c3a1f' : '#7e3b2b'; g.beginPath(); g.moveTo(x - s * 1.15, y - s * 0.1); g.lineTo(x, y - s * 1.1); g.lineTo(x + s * 1.15, y - s * 0.1); g.closePath(); g.fill();
      if (light < 0.7) { g.fillStyle = 'rgba(255,200,90,0.9)'; g.fillRect(x - s * 0.2, y + s * 0.1, s * 0.4, s * 0.4); }
    }
  }
  for (const v of S.villages) {
    if (!v.alive) continue;
    const s = k * zf;
    if (has('api')) {
      const fl = 1 + Math.sin(t * 12 + v.id) * 0.15;
      g.fillStyle = '#4a3a2a'; g.beginPath(); g.arc(v.x, v.y, 5 * s, 0, 6.283); g.fill();
      g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(v.x, v.y, 3.2 * s * fl, 0, 6.283); g.fill();
      g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(v.x, v.y, 1.6 * s * fl, 0, 6.283); g.fill();
    }
    if (has('pemakaman')) g.drawImage(sprite('🪨', 32), v.x + 22 * s * 1.5, v.y - 26 * s * 1.5, 10 * s * 1.4, 10 * s * 1.4);
    if (has('lumbung') && v.fieldSpots.length) g.drawImage(sprite('🛖', 40), v.x - 34 * s, v.y + 8 * s, 14 * s, 14 * s);
    if (has('kincir') && v.waterSpot) g.drawImage(sprite('🎡', 40), v.waterSpot.x - 8 * s, v.waterSpot.y - 8 * s, 16 * s, 16 * s);
    if (has('hukum') && v.pop > 20) g.drawImage(sprite('🏛️', 40), v.x + 10 * s, v.y + 12 * s, 15 * s, 15 * s);
    if (has('tekstil') && v.pop > 25) g.drawImage(sprite('🏭', 40), v.x - 30 * s, v.y - 30 * s, 18 * s, 18 * s);
    if (has('radio') && v.pop > 20) g.drawImage(sprite('📡', 40), v.x + 26 * s, v.y + 26 * s, 13 * s, 13 * s);
    if (has('surya') && v.pop > 20) g.drawImage(sprite('🔆', 40), v.x - 44 * s, v.y + 30 * s, 12 * s, 12 * s);
    if (has('cetak') && v.pop > 30) g.drawImage(sprite('📚', 40), v.x - 12 * s, v.y + 30 * s, 11 * s, 11 * s);
    // ternak
    let i = 0;
    for (const kind in v.herd) {
      const n = Math.min(6, Math.ceil(v.herd[kind] / 4));
      for (let j = 0; j < n; j++, i++) {
        const a = i * 0.9 + v.id, d = 40 + (i % 3) * 7;
        const px = v.x + Math.cos(a) * d + Math.sin(t * 0.3 + i) * 3, py = v.y + Math.sin(a) * d * 0.7 + 30;
        g.drawImage(sprite(DOMESTIC[kind], 32), px - 5 * s, py - 5 * s, 10 * s, 10 * s);
      }
    }
    if (i > 0) { g.strokeStyle = '#7b5a36'; g.lineWidth = 1.2 * s; g.strokeRect(v.x - 52, v.y + 10, 104, 42); }
  }
}

function moveTo(o, tx, ty, spd, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const st = Math.min(d, spd * dt); o.x += dx / d * st; o.y += dy / d * st;
  if (Math.abs(dx) > 0.5) o.flip = dx < 0;
  return st >= d - 0.01;
}

function drawAnimals(g, k, zf, dt, sp) {
  const tm = Math.min(1, sp * 0.03);
  for (const a of S.animals) {
    if (!a.alive) continue;
    const s = SPEC[a.sp];
    a.wait -= dt;
    if (a.wait <= 0) {
      if (moveTo(a, a.tx, a.ty, s.speed * Math.max(0.05, tm), dt)) {
        a.wait = s.fly ? 0 : 0.5 + Math.random() * 3 / Math.max(0.3, tm * 3);
        for (let tries = 0; tries < 6; tries++) {
          const r = s.fly ? 300 : 90, nx = a.x + (Math.random() - 0.5) * r * 2, ny = a.y + (Math.random() - 0.5) * r * 2;
          const t = S.world.typeAt(nx, ny);
          if (s.fly ? nx * nx + ny * ny < W.R * W.R * 0.95 : s.biomes.includes(t) || (!s.water && (t === 4 || t === 9 || t === 5) && Math.random() < 0.3)) { a.tx = nx; a.ty = ny; break; }
        }
      }
    }
    const size = (s.id === 'gajah' ? 15 : s.id === 'kelinci' || s.id === 'ayam' || s.id === 'burung' || s.id === 'ikan' ? 8 : 11) * k * zf;
    if (s.water) g.globalAlpha = 0.55;
    if (a.flip) { g.save(); g.translate(a.x, a.y); g.scale(-1, 1); g.drawImage(sprite(s.emoji), -size / 2, -size / 2, size, size); g.restore(); }
    else g.drawImage(sprite(s.emoji), a.x - size / 2, a.y - size / 2, size, size);
    g.globalAlpha = 1;
  }
}

const SKINS = ['#8d5a3b', '#a8714a', '#c68b5e', '#6e4529', '#b97c50', '#d3a173'];
const CLOTH = ['#2f6db5', '#b5372f', '#7a3fa0', '#2f9a7a', '#c58a1c', '#3c4f9a'];

function taskTarget(h, v, hh, night) {
  if (night || h.task === 'istirahat' || h.task === 'tidur') return { x: hh.x, y: hh.y, r: 6 };
  switch (h.task) {
    case 'kumpul': return { x: v.x + Math.cos(h.id * 2.1) * 110, y: v.y + Math.sin(h.id * 2.1) * 110, r: 50 };
    case 'buru': { const a = huntSight(v, h); return a ? { x: a.x, y: a.y, r: 15 } : { x: v.x + Math.cos(h.id) * 230, y: v.y + Math.sin(h.id) * 230, r: 70 }; }
    case 'ikan': return v.waterSpot ? { x: v.waterSpot.x, y: v.waterSpot.y, r: 12 } : { x: v.x, y: v.y, r: 30 };
    case 'tani': { const f = v.fieldSpots[h.id % Math.max(1, v.fieldSpots.length)]; return f ? { x: f.x, y: f.y, r: 10 } : { x: v.x, y: v.y, r: 40 }; }
    case 'ternak': return { x: v.x, y: v.y + 30, r: 40 };
    case 'bangun': case 'kriya': case 'asuh': return { x: hh.x, y: hh.y, r: 12 };
    case 'jelajah': return { x: v.x + Math.cos(h.id * 3.7 + S.day * 0.1) * 380, y: v.y + Math.sin(h.id * 3.7 + S.day * 0.1) * 380, r: 60 };
    default: return { x: v.x, y: v.y, r: 25 + Math.sqrt(v.pop) * 3 };
  }
}
function huntSight(v, h) {
  if (h._prey && h._prey.alive && h._preyDay === S.day) return h._prey;
  let best = null, bd = 300 * 300;
  for (let i = 0; i < 40; i++) { const a = S.animals[(h.id * 7 + i * 13 + S.day) % S.animals.length]; if (!a || !a.alive) continue; const s = SPEC[a.sp]; if (s.pred || s.water || s.fly) continue; const d = (a.x - v.x) ** 2 + (a.y - v.y) ** 2; if (d < bd) { bd = d; best = a; } }
  h._prey = best; h._preyDay = S.day; return best;
}

function drawHumans(g, k, zf, dt, sp, cycle, hr) {
  const night = cycle && (hr < 5.5 || hr > 20.5);
  const spd = Math.min(28, 0.28 * sp);
  const sel = UI.selected;
  for (const h of S.alive) {
    const v = S.villages[h.vil], hh = S.households.get(h.hh);
    if (!v || !hh) continue;
    if (h._tday !== h.taskDay || h._night !== night || h._tt == null) {
      const t = taskTarget(h, v, hh, night);
      h._tt = t; h._tday = h.taskDay; h._night = night;
      h.tx = t.x + (Math.random() - 0.5) * t.r * 2; h.ty = t.y + (Math.random() - 0.5) * t.r * 2;
    }
    if (moveTo(h, h.tx, h.ty, spd * (ageY(h) < 4 ? 0.6 : 1), dt) && Math.random() < dt * 0.5 * Math.min(1, sp / 60)) {
      const t = h._tt; h.tx = t.x + (Math.random() - 0.5) * t.r * 2; h.ty = t.y + (Math.random() - 0.5) * t.r * 2;
    }
    const age = ageY(h), s = (age < 3 ? 0.5 : age < 12 ? 0.72 : 1) * 5 * k * zf;
    if (!h.skin) h.skin = SKINS[h.gen === 1 ? (h.sex === 'L' ? 1 : 2) : (h.id * 7) % SKINS.length];
    const cloth = has('tenun') ? CLOTH[h.id % CLOTH.length] : has('pakaian') ? '#7a5636' : null;
    const x = h.x, y = h.y;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + s * 0.3, y + s * 1.3, s * 0.8, s * 0.35, 0, 0, 6.283); g.fill();
    g.fillStyle = cloth || h.skin; g.beginPath(); g.ellipse(x, y + s * 0.4, s * 0.62, s * 0.95, 0, 0, 6.283); g.fill();
    if (!cloth) { g.fillStyle = '#3f7d2c'; g.fillRect(x - s * 0.6, y + s * 0.5, s * 1.2, s * 0.45); }
    g.fillStyle = h.skin; g.beginPath(); g.arc(x, y - s * 0.85, s * 0.55, 0, 6.283); g.fill();
    g.fillStyle = age > 58 ? '#d8d8d8' : h.sex === 'P' ? '#2a1a10' : '#3a2616';
    g.beginPath(); g.arc(x, y - s * 1.0, s * 0.5, Math.PI, 0); g.fill();
    if (h.sex === 'P' && age > 3) { g.fillRect(x - s * 0.55, y - s * 1.0, s * 0.22, s * 0.9); g.fillRect(x + s * 0.33, y - s * 1.0, s * 0.22, s * 0.9); }
    g.strokeStyle = h.sex === 'L' ? 'rgba(120,190,255,0.95)' : 'rgba(255,140,190,0.95)'; g.lineWidth = s * 0.25;
    g.beginPath(); g.arc(x, y + s * 0.4, s * 1.15, 0, 6.283); g.stroke();
    if (h.sick) { g.fillStyle = 'rgba(140,220,90,0.9)'; g.beginPath(); g.arc(x + s, y - s * 1.4, s * 0.35, 0, 6.283); g.fill(); }
    if (sel === h.id) { g.strokeStyle = '#ffe066'; g.lineWidth = s * 0.35; g.beginPath(); g.arc(x, y, s * 2.4 + Math.sin(VIS.t * 5) * s * 0.3, 0, 6.283); g.stroke(); }
    if (cam.zoom > 2.2 && ACTS[h.task] && !night) g.drawImage(sprite(ACTS[h.task].icon, 32), x + s * 0.8, y - s * 2.6, s * 1.6, s * 1.6);
  }
}

function drawLabels(g, sc, ox, oy, dpr) {
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  const showAll = UI.labels && cam.zoom > (S.alive.length > 80 ? 6 : 2.4);
  g.font = `${11 * dpr}px system-ui,sans-serif`;
  for (const v of S.villages) {
    if (!v.alive) continue;
    const x = ox + v.x * sc, y = oy + v.y * sc - (60 * sc + 8 * dpr);
    g.fillStyle = 'rgba(0,0,0,0.55)'; const tw = g.measureText(v.name).width; g.fillRect(x - tw / 2 - 5 * dpr, y - 15 * dpr, tw + 10 * dpr, 17 * dpr);
    g.fillStyle = '#ffe9b0'; g.fillText(v.name, x, y);
  }
  g.font = `600 ${11 * dpr}px system-ui,sans-serif`;
  for (const h of S.alive) {
    if (!(UI.labels && (h.gen === 1 || showAll || UI.selected === h.id))) continue;
    const x = ox + h.x * sc, y = oy + h.y * sc - 12 * dpr * clamp(Math.sqrt(cam.zoom), 1, 2.6);
    g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(h.name, x, y);
    g.fillStyle = h.sex === 'L' ? '#bfe0ff' : '#ffd0e4'; g.fillText(h.name, x, y);
  }
}
