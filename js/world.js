// ===== Dunia Awal — pembangkit dunia (medan, sungai, flora, fauna) =====
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(rnd) {
  const perm = new Uint8Array(512), val = new Float32Array(256);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) val[i] = rnd();
  const sm = t => t * t * (3 - 2 * t);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = val[perm[(xi & 255) + perm[yi & 255]]], b = val[perm[((xi + 1) & 255) + perm[yi & 255]]];
    const c = val[perm[(xi & 255) + perm[(yi + 1) & 255]]], d = val[perm[((xi + 1) & 255) + perm[(yi + 1) & 255]]];
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return function fbm(x, y, oct = 5) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  };
}

// Tipe sel: 0 luar, 1 danau, 2 sungai, 3 pasir, 4 padang rumput, 5 hutan, 6 bukit, 7 gunung batu, 8 salju, 9 padang bunga
const TNAME = ['—', 'Danau', 'Sungai', 'Tepian berpasir', 'Padang rumput', 'Hutan', 'Perbukitan', 'Pegunungan', 'Puncak bersalju', 'Padang bunga'];

const W = { R: 1000, G: 200, cell: 10 };

function genWorld(seed) {
  const rnd = mulberry32(seed);
  const fbm = makeNoise(rnd), fbm2 = makeNoise(rnd), fbm3 = makeNoise(rnd);
  const G = W.G, N = G * G, R = W.R;
  const h = new Float32Array(N), m = new Float32Array(N), type = new Uint8Array(N), water = new Uint8Array(N);
  const cx = i => (i % G) * W.cell - R + W.cell / 2, cy = i => ((i / G) | 0) * W.cell - R + W.cell / 2;

  // Gunung utama + perbukitan
  const ang = rnd() * Math.PI * 2, rr = R * (0.45 + rnd() * 0.15);
  const peaks = [{ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr, a: 0.62, s: 190 }];
  for (let i = 0; i < 3; i++) {
    const a2 = ang + (rnd() - 0.5) * 0.9, r2 = rr + (rnd() - 0.5) * 250;
    peaks.push({ x: Math.cos(a2) * r2, y: Math.sin(a2) * r2, a: 0.3 + rnd() * 0.2, s: 110 + rnd() * 60 });
  }
  for (let i = 0; i < 6; i++) {
    const a2 = rnd() * Math.PI * 2, r2 = R * (0.2 + rnd() * 0.65);
    peaks.push({ x: Math.cos(a2) * r2, y: Math.sin(a2) * r2, a: 0.12 + rnd() * 0.16, s: 70 + rnd() * 60 });
  }
  let mn = 9, mx = -9;
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i);
    if (x * x + y * y > R * R) continue;
    let v = fbm(x / 420 + 10, y / 420 + 10, 5) * 0.5;
    for (const p of peaks) { const dx = x - p.x, dy = y - p.y; v += p.a * Math.exp(-(dx * dx + dy * dy) / (2 * p.s * p.s)); }
    v += (fbm3(x / 90, y / 90, 3) - 0.5) * 0.06;
    h[i] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
    m[i] = fbm2(x / 300, y / 300, 4);
  }
  for (let i = 0; i < N; i++) h[i] = (h[i] - mn) / (mx - mn);

  const idx = (x, y) => { const gx = Math.floor((x + R) / W.cell), gy = Math.floor((y + R) / W.cell); return gx < 0 || gy < 0 || gx >= G || gy >= G ? -1 : gy * G + gx; };

  // Danau: titik rendah di sisi berlawanan gunung
  let lake = { x: -Math.cos(ang) * R * 0.25, y: -Math.sin(ang) * R * 0.25 };
  let best = 9;
  for (let k = 0; k < 60; k++) {
    const a = rnd() * 6.283, r = rnd() * R * 0.45;
    const x = lake.x + Math.cos(a) * r * 0.5, y = lake.y + Math.sin(a) * r * 0.5;
    const i = idx(x, y); if (i >= 0 && h[i] < best && x * x + y * y < (R * 0.6) ** 2) { best = h[i]; lake = { x, y }; }
  }
  lake.rx = 70 + rnd() * 40; lake.ry = 45 + rnd() * 30; lake.rot = rnd() * Math.PI;

  // Sungai
  const rivers = [];
  function carvePath(sx, sy, tx, ty, w0, w1, toEdge) {
    const pts = []; let x = sx, y = sy, heading = Math.atan2(ty - y, tx - x);
    for (let s = 0; s < 600; s++) {
      const goal = toEdge ? Math.atan2(y, x) : Math.atan2(ty - y, tx - x);
      const wob = (fbm3(x / 160 + s * 0.001, y / 160) - 0.5) * 2.6;
      heading += (goal + wob - heading) * 0.25;
      x += Math.cos(heading) * 8; y += Math.sin(heading) * 8;
      pts.push({ x, y, w: w0 + (w1 - w0) * Math.min(1, s / 120) });
      if (toEdge && x * x + y * y > (R + 10) ** 2) break;
      if (!toEdge && Math.hypot(tx - x, ty - y) < 25) break;
    }
    rivers.push(pts); return pts;
  }
  carvePath(peaks[0].x * 0.92, peaks[0].y * 0.92, lake.x, lake.y, 5, 14, false);
  const p2 = peaks[1 + ((rnd() * 3) | 0)];
  carvePath(p2.x, p2.y, lake.x, lake.y, 4, 10, false);
  carvePath(lake.x, lake.y, 0, 0, 12, 18, true);

  // Lembah di sepanjang sungai + tandai air
  for (const pts of rivers) for (const p of pts) {
    const rad = 80;
    for (let gy = -9; gy <= 9; gy++) for (let gx = -9; gx <= 9; gx++) {
      const x = p.x + gx * W.cell, y = p.y + gy * W.cell, i = idx(x, y); if (i < 0) continue;
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < rad) h[i] -= 0.025 * (1 - d / rad) * h[i];
      if (d < p.w) water[i] = 2;
    }
  }
  const cr = Math.cos(lake.rot), sr = Math.sin(lake.rot);
  for (let i = 0; i < N; i++) {
    const x = cx(i) - lake.x, y = cy(i) - lake.y, u = (x * cr + y * sr) / lake.rx, v = (-x * sr + y * cr) / lake.ry;
    if (u * u + v * v < 1 + (fbm3(cx(i) / 40, cy(i) / 40, 2) - 0.5) * 0.5) water[i] = 1;
  }

  // Klasifikasi
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i);
    if (x * x + y * y > R * R) { type[i] = 0; continue; }
    if (water[i]) { type[i] = water[i]; continue; }
    const v = h[i];
    let t;
    if (v > 0.86) t = 8; else if (v > 0.68) t = 7; else if (v > 0.52) t = 6;
    else if (m[i] > 0.56) t = 5; else if (m[i] < 0.38) t = 9; else t = 4;
    type[i] = t;
  }
  // pasir di tepi air
  for (let i = 0; i < N; i++) {
    if (type[i] < 4 || type[i] > 5 && type[i] !== 9) continue;
    const gx = i % G, gy = (i / G) | 0;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (gy + dy) * G + gx + dx; if (j >= 0 && j < N && (type[j] === 1 || (type[j] === 2 && rnd() < 0.35))) { near = true; break; }
    }
    if (near) type[i] = 3;
  }

  return { seed, rnd, h, m, type, water, idx, lake, rivers, peaks, cx, cy, fbm3,
    typeAt(x, y) { const i = idx(x, y); return i < 0 ? 0 : type[i]; },
    hAt(x, y) { const i = idx(x, y); return i < 0 ? 0 : h[i]; },
  };
}

// Jarak ke air terdekat (sampling kasar)
function nearWater(world, x, y, maxD) {
  for (let d = 10; d <= maxD; d += 10) for (let a = 0; a < 6.283; a += 0.5) {
    const t = world.typeAt(x + Math.cos(a) * d, y + Math.sin(a) * d); if (t === 1 || t === 2) return d;
  }
  return 999;
}

function randLand(world, rnd, pred, tries = 200) {
  for (let k = 0; k < tries; k++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * W.R * 0.97, x = Math.cos(a) * r, y = Math.sin(a) * r;
    const t = world.typeAt(x, y); if (pred(t, x, y)) return { x, y };
  }
  return null;
}

function genFlora(world) {
  const rnd = world.rnd, flora = [];
  const add = (x, y, kind, size) => flora.push({ x, y, kind, size, fruit: 0, alive: true });
  for (let k = 0; k < 9000 && flora.length < 2600; k++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * W.R * 0.98, x = Math.cos(a) * r, y = Math.sin(a) * r;
    const t = world.typeAt(x, y), hh = world.hAt(x, y);
    if (t === 5) { if (rnd() < 0.9) add(x, y, hh > 0.45 ? 'pinus' : rnd() < 0.12 ? 'buah' : 'pohon', 7 + rnd() * 6); }
    else if (t === 4) { if (rnd() < 0.14) add(x, y, rnd() < 0.3 ? 'buah' : rnd() < 0.5 ? 'semak' : 'pohon', 5 + rnd() * 5); }
    else if (t === 9) { if (rnd() < 0.07) add(x, y, rnd() < 0.6 ? 'semak' : 'pohon', 4 + rnd() * 4); }
    else if (t === 6) { if (rnd() < 0.35) add(x, y, 'pinus', 6 + rnd() * 5); }
    else if (t === 3) { if (rnd() < 0.08) add(x, y, 'palem', 6 + rnd() * 3); }
    else if (t === 7) { if (rnd() < 0.05) add(x, y, 'pinus', 4 + rnd() * 3); }
  }
  return flora;
}

function genAnimals(world) {
  const rnd = world.rnd, out = [];
  for (const sp of SPECIES) {
    const n = Math.round(sp.cap * 0.7);
    for (let i = 0; i < n; i++) {
      const p = randLand(world, rnd, t => sp.biomes.includes(t), 300); if (!p) continue;
      out.push(makeAnimal(sp, p.x, p.y, rnd));
    }
  }
  return out;
}
function makeAnimal(sp, x, y, rnd) {
  return { sp: sp.id, x, y, tx: x, ty: y, wait: rnd() * 3, alive: true, flip: rnd() < 0.5 };
}
