// 背景：全部用矢量路径 + 渐变在代码里绘制（不用背景图片，没有贴图接缝）。
// 整个世界共用一条连续的“虚空色”纵向渐变 voidColor(y)：地表天空 → 晨光林缘 → 垂藤之森 → 静晶之海。
// 每块背景画布先铺这条渐变，再画景物层，景物层在画布上下边缘按透明度渐隐——画布与画布之间只剩同一种颜色，看不出拼接。
// 地表：太阳、积云、三重远山（向阳面受光）、对岸崖台与小村剪影、瀑布、云海、崖顶后方的绿丘。
// 各深层：对岸崖壁与崖架树林、浮空小岛、巨树横枝与垂藤、水下晶簇 / 游鱼 / 气泡 / 焦散光。
import { canvas, rng, rgba, lerpColor, softDot, foliage, vine, haze, rays } from './kit.js';
import { LAYERS, SHAFTS_PER_LAYER } from '../data/layers.js';
import { envImg } from './sprites.js';

export const BG = 1.25, LBG = 1.6;
export const ROW = 150, SURF = 420, CLIFF_X = 330;
export const VOID_X0 = -720, VOID_W = CLIFF_X + 40 - VOID_X0;
export const LAYER_H = SHAFTS_PER_LAYER * ROW;
export const SURF_X0 = VOID_X0, SURF_Y0 = -120, SURF_W = 1100 - VOID_X0, SURF_H = SURF - SURF_Y0;
export const VOID_BOTTOM = '#121838';
const L3 = LAYER_H, P2 = Math.PI * 2;
const cache = {};
const memo = (k, fn) => cache[k] ?? (cache[k] = fn());

// ━━ 连续的虚空色 ━━
const VSTOPS = [[-120, '#3f7fcc'], [0, '#4d8fd6'], [200, '#8fc0e6'], [330, '#d4e6e6'], [SURF, '#ece8c8'], [SURF + L3 * 0.5, '#d2dcaa'],
  [SURF + L3, '#8fbf98'], [SURF + L3 * 1.5, '#5f9a94'], [SURF + 2 * L3, '#3e6a96'], [SURF + 2.5 * L3, '#283a74'], [SURF + 3 * L3, VOID_BOTTOM]];
export function voidColor(y) {
  if (y <= VSTOPS[0][0]) return VSTOPS[0][1];
  for (let k = 1; k < VSTOPS.length; k++) { const [y1, c1] = VSTOPS[k]; if (y <= y1) { const [y0, c0] = VSTOPS[k - 1]; return lerpColor(c0, c1, (y - y0) / (y1 - y0)); } }
  return VSTOPS[VSTOPS.length - 1][1];
}
function voidGradient(g, ya, yb) {
  const gr = g.createLinearGradient(0, ya, 0, yb); gr.addColorStop(0, voidColor(ya));
  for (const [y, c] of VSTOPS) if (y > ya && y < yb) gr.addColorStop((y - ya) / (yb - ya), c);
  gr.addColorStop(1, voidColor(yb)); return gr;
}
// 在雾里：颜色往该高度的虚空色靠 k
const fog = (col, y, k) => lerpColor(col, voidColor(y), k);

// 画布：底 = 虚空渐变；景物层画在世界坐标里，上下 fadeTop / fadeBot 个单位内渐隐
function compose(x0, y0, w, h, S, draw, fadeTop, fadeBot) {
  const c = canvas(w * S, h * S), g = c.getContext('2d');
  g.scale(S, S); g.translate(-x0, -y0); g.fillStyle = voidGradient(g, y0, y0 + h); g.fillRect(x0, y0, w, h);
  const lc = canvas(w * S, h * S), lg = lc.getContext('2d');
  lg.scale(S, S); lg.translate(-x0, -y0); draw(lg);
  lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'destination-in';
  const m = lg.createLinearGradient(0, 0, 0, lc.height), a = (v) => `rgba(0,0,0,${v})`;
  if (fadeTop) { m.addColorStop(0, a(0)); m.addColorStop(fadeTop / h * 0.4, a(0.3)); m.addColorStop(fadeTop / h * 0.75, a(0.78)); m.addColorStop(fadeTop / h, a(1)); } else m.addColorStop(0, a(1));
  if (fadeBot) { m.addColorStop(1 - fadeBot / h, a(1)); m.addColorStop(1 - fadeBot / h * 0.75, a(0.78)); m.addColorStop(1 - fadeBot / h * 0.4, a(0.3)); m.addColorStop(1, a(0)); } else m.addColorStop(1, a(1));
  lg.fillStyle = m; lg.fillRect(0, 0, lc.width, lc.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(lc, 0, 0);
  return c;
}

// ━━ 噪声 + 基本形 ━━
function makeNoise(seed) {
  const r = rng(seed), v = new Float32Array(512); for (let i = 0; i < 512; i++) v[i] = r();
  return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return v[i & 511] + (v[(i + 1) & 511] - v[i & 511]) * u; };
}
const fbm = (n, x) => n(x) * 0.55 + n(x * 2.03 + 17) * 0.28 + n(x * 4.1 + 41) * 0.17;
const ridged = (n, x) => 0.62 * fbm(n, x) + 0.38 * (1 - Math.abs(fbm(n, x * 1.3 + 9) * 2 - 1));
// 山形：把噪声拉开对比，峰更尖、谷更深
const peak = (n, x) => Math.max(0, Math.min(1.15, ridged(n, x) * 1.7 - 0.45));
const vgrad = (g, y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };

// 一道山脊（底边封到 bottom）；env(x) 0..1 控制两端是否沉下去
function ridgePath(g, n, x0, x1, base, amp, freq, bottom, dx = 0, env = () => 1) {
  g.beginPath(); g.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + 3; x += 3) { const e = env(x); g.lineTo(x, base + (1 - e) * 90 - amp * e * peak(n, (x - dx) * freq)); }
  g.lineTo(x1, bottom); g.closePath();
}
// 山：先画背光色，再把同一道山脊往右挪一点画受光色（裁在原山脊里）→ 每座峰的左坡留下一道阴影；山脚叠一层雾
function mountains(g, o) {
  const n = makeNoise(o.seed), bottom = o.bottom ?? o.base + 140, env = o.env ?? (() => 1);
  g.save();
  ridgePath(g, n, o.x0, o.x1, o.base, o.amp, o.freq, bottom, 0, env);
  g.fillStyle = vgrad(g, o.base - o.amp, o.base + 40, o.shade[0], o.shade[1]); g.fill(); g.clip();
  ridgePath(g, n, o.x0, o.x1, o.base + 1.5, o.amp, o.freq, bottom, o.lightDx ?? 9, env);
  g.fillStyle = vgrad(g, o.base - o.amp, o.base + 40, o.lit[0], o.lit[1]); g.fill();
  if (o.snow) { g.fillStyle = rgba('#ffffff', 0.8); g.beginPath(); g.moveTo(o.x0, o.base - o.amp * 2); for (let x = o.x0; x <= o.x1 + 6; x += 6) g.lineTo(x, o.base - o.amp * (0.8 + 0.05 * Math.sin(x * 0.07))); g.lineTo(o.x1, o.base - o.amp * 2); g.closePath(); g.fill(); }
  if (o.trees) { const r = rng(o.seed + 5); for (let x = o.x0; x < o.x1; x += 5 + r() * 7) { const e = env(x); if (e < 0.5) continue; const y = o.base + (1 - e) * 90 - o.amp * e * peak(n, x * o.freq) + 4 + r() * 18; g.globalAlpha = 0.55; g.fillStyle = r() < 0.5 ? o.trees[0] : o.trees[1]; g.beginPath(); g.ellipse(x, y, 2.5 + r() * 2.5, 3 + r() * 3.5, 0, 0, P2); g.fill(); } g.globalAlpha = 1; }
  g.fillStyle = vgrad(g, o.base - o.amp * 0.15, bottom, rgba(o.mist, 0), rgba(o.mist, o.mistA ?? 0.75)); g.fillRect(o.x0, o.base - o.amp, o.x1 - o.x0, bottom - o.base + o.amp);
  g.restore();
}
// 积云：一串圆团 + 平底，上白下灰紫
function cloud(g, r, cx, cy, w, a = 1, shade = '#cdd6ea') {
  const h = w * 0.34, n = 7;
  g.save(); g.beginPath(); g.rect(cx - w, cy - h * 3, w * 2, h * 3 + h * 0.18); g.clip();
  const puffs = [];
  for (let k = 0; k < n; k++) { const u = k / (n - 1), pr = h * (0.42 + r() * 0.42) * (1 - Math.abs(u - 0.5) * 1.1); puffs.push([cx - w / 2 + w * u + (r() - 0.5) * w * 0.08, cy - pr * 0.45, pr]); }
  for (let k = 0; k < 3; k++) { const pr = h * (0.55 + r() * 0.3); puffs.push([cx - w * 0.22 + k * w * 0.22 + (r() - 0.5) * 10, cy - h * 0.55 - pr * 0.4, pr]); }
  g.globalAlpha = a;
  g.fillStyle = shade; g.beginPath(); for (const [x, y, pr] of puffs) { g.moveTo(x + pr, y + h * 0.1); g.arc(x, y + h * 0.1, pr, 0, P2); } g.fill();
  g.fillStyle = vgrad(g, cy - h * 1.3, cy + h * 0.2, '#ffffff', '#eef0f8'); g.beginPath(); for (const [x, y, pr] of puffs) { g.moveTo(x - 2 + pr * 0.94, y - 2); g.arc(x - 2, y - 2, pr * 0.94, 0, P2); } g.fill();
  g.globalAlpha = 1; g.restore();
}
// 瀑布：一条半透明白水 + 细水纹，底部一团水雾
function waterfall(g, r, x, y0, y1, w, a = 0.85) {
  g.fillStyle = vgrad(g, y0, y1, rgba('#ffffff', a), rgba('#ffffff', a * 0.25));
  g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x + w / 2, y0); g.quadraticCurveTo(x + w * 0.7, (y0 + y1) / 2, x + w * 0.9, y1); g.lineTo(x - w * 0.9, y1); g.quadraticCurveTo(x - w * 0.7, (y0 + y1) / 2, x - w / 2, y0); g.fill();
  g.strokeStyle = rgba('#dbeaf4', a * 0.8); g.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) { const dx = (r() - 0.5) * w; g.beginPath(); g.moveTo(x + dx * 0.6, y0 + 4); g.lineTo(x + dx, y1 - 6); g.stroke(); }
  softDot(g, x, y1, w * 3.5, '#ffffff', a * 0.5);
}
// 浮空小岛：倒锥形岩块 + 草顶 + 一棵树 + 垂根
function islet(g, r, cx, cy, w, k, rock = '#9a7a56') {
  const y = cy, h = w * 0.85, rk = fog(rock, y, k), rkD = fog(lerpColor(rock, '#2a1a10', 0.45), y + h, k);
  g.fillStyle = vgrad(g, y, y + h, rk, rkD);
  g.beginPath(); g.moveTo(cx - w / 2, y);
  for (let t = 0; t <= 1.0001; t += 0.125) g.lineTo(cx - w / 2 + w * 0.5 * t + (r() - 0.5) * w * 0.06, y + h * t * (0.9 + r() * 0.1));
  for (let t = 1; t >= 0; t -= 0.125) g.lineTo(cx + w / 2 - w * 0.5 * t + (r() - 0.5) * w * 0.06, y + h * t * (0.85 + r() * 0.1));
  g.closePath(); g.fill();
  g.strokeStyle = rgba(fog('#2a1a10', y, k), 0.25); g.lineWidth = 1; for (let s = 1; s < 4; s++) { g.beginPath(); g.moveTo(cx - w / 2 + s * w * 0.12, y + s * h * 0.18); g.lineTo(cx + w / 2 - s * w * 0.12, y + s * h * 0.18 + 2); g.stroke(); }
  for (let s = 0; s < 5; s++) vine(g, r, cx - w * 0.3 + r() * w * 0.6, y + h * (0.3 + r() * 0.4), 18 + r() * w * 0.5, fog('#4a6a3a', y, k), fog('#7aa858', y, k), 5);
  g.fillStyle = fog('#6a9a48', y, k); g.beginPath(); g.ellipse(cx, y + 1, w * 0.53, w * 0.07, 0, 0, P2); g.fill();
  const tx = cx + (r() - 0.5) * w * 0.3, th = w * 0.55;
  g.fillStyle = fog('#5a3a22', y, k); g.fillRect(tx - w * 0.025, y - th * 0.55, w * 0.05, th * 0.56);
  for (const [dx, dy, s, c] of [[0, -0.62, 0.3, '#4f8a3e'], [-0.15, -0.5, 0.22, '#5f9a48'], [0.15, -0.52, 0.22, '#3f7a36'], [0.03, -0.75, 0.18, '#7ab65a']]) { g.fillStyle = fog(c, y, k); g.beginPath(); g.ellipse(tx + dx * th, y + dy * th, s * th, s * th * 0.85, 0, 0, P2); g.fill(); }
}
// 对岸崖壁：左边一整面墙，右缘起伏；崖架上长树
function farWall(g, r, n, x0, yA, yB, edge, wobble, cols, k, ledgeCol) {
  const ex = (y) => edge + (fbm(n, y * 0.008) - 0.5) * wobble * 2 + Math.sin(y * 0.031) * 8;
  g.save(); g.beginPath(); g.moveTo(x0, yA); for (let y = yA; y <= yB; y += 4) g.lineTo(ex(y), y); g.lineTo(x0, yB); g.closePath();
  const ym = (yA + yB) / 2, gr = g.createLinearGradient(x0, 0, edge + wobble, 0); gr.addColorStop(0, fog(cols[1], ym, Math.min(1, k + 0.2))); gr.addColorStop(1, fog(cols[0], ym, k));
  g.fillStyle = gr; g.fill(); g.clip();
  g.strokeStyle = rgba(fog(cols[1], ym, k), 0.55); g.lineWidth = 1.2;
  for (let x = x0; x < edge + wobble; x += 8 + r() * 12) { const y = yA + r() * (yB - yA); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 30 + r() * 80); g.stroke(); }
  g.restore();
  const ledges = [];
  for (let y = yA + 30 + r() * 30; y < yB - 20; y += 60 + r() * 50) {
    const xr = ex(y); ledges.push([xr, y]);
    g.fillStyle = fog(ledgeCol[0], y, k); g.beginPath(); g.moveTo(x0, y + 6); g.lineTo(xr + 8, y + 2); g.quadraticCurveTo(xr + 14, y - 2, xr + 4, y - 4); g.lineTo(x0, y - 2); g.fill();
    for (let x = x0; x < xr + 4; x += 6 + r() * 8) { g.fillStyle = fog(r() < 0.5 ? ledgeCol[1] : ledgeCol[2], y, k); g.beginPath(); g.ellipse(x, y - 4 - r() * 6, 4 + r() * 5, 4 + r() * 6, 0, 0, P2); g.fill(); }
  }
  return ledges;
}

// ━━ 地表 ━━
function drawSurface(g) {
  const r = rng(901), x0 = SURF_X0, x1 = SURF_X0 + SURF_W;
  softDot(g, 790, 20, 360, '#fff4cc', 0.5); softDot(g, 790, 20, 110, '#ffffff', 0.6);
  g.fillStyle = '#fffbea'; g.beginPath(); g.arc(790, 20, 26, 0, P2); g.fill();
  for (let k = 0; k < 8; k++) { const y = -90 + r() * 120, x = x0 + r() * SURF_W; g.fillStyle = rgba('#ffffff', 0.22 + r() * 0.15); g.beginPath(); g.ellipse(x, y, 90 + r() * 140, 4 + r() * 5, 0, 0, P2); g.fill(); }
  for (const [cx, cy, w, a] of [[-560, 60, 320, 1], [-190, 10, 240, 1], [180, 90, 200, 0.95], [540, -10, 280, 1], [930, 70, 240, 1], [40, 175, 120, 0.75], [700, 175, 140, 0.75], [-420, 190, 130, 0.7]]) cloud(g, r, cx, cy, w, a);
  // 远山三重
  mountains(g, { seed: 11, x0, x1, base: 292, amp: 175, freq: 0.0055, shade: ['#7d9fcc', '#a9c3de'], lit: ['#bcd2ec', '#d8e6f2'], lightDx: 16, snow: true, mist: '#dbe8ee', mistA: 0.6, bottom: 420 });
  mountains(g, { seed: 23, x0, x1, base: 326, amp: 120, freq: 0.008, shade: ['#5f86ac', '#97b6cc'], lit: ['#98bcd6', '#c4d8e4'], lightDx: 12, mist: '#dde8e6', mistA: 0.7, bottom: 420 });
  mountains(g, { seed: 37, x0, x1, base: 352, amp: 78, freq: 0.011, shade: ['#4f7c78', '#8eb2a6'], lit: ['#80b096', '#b6d2be'], lightDx: 10, trees: ['#5a8a72', '#6a967c'], mist: '#e2ead8', mistA: 0.85, bottom: 420 });
  // 对岸崖台：小村剪影 + 崖壁 + 瀑布，脚下没入云海
  const n = makeNoise(51), top = (x) => 334 + (fbm(n, x * 0.02) - 0.5) * 12, edgeX = 120;
  g.fillStyle = vgrad(g, 330, 440, '#a8a684', '#d2d4bc');
  g.beginPath(); g.moveTo(x0, 440); for (let x = x0; x <= edgeX; x += 4) g.lineTo(x, top(x)); g.quadraticCurveTo(edgeX + 18, 360, edgeX + 30, 440); g.closePath(); g.fill();
  g.strokeStyle = rgba('#8a8a6a', 0.45); g.lineWidth = 1; for (let x = x0 + 6; x < edgeX + 20; x += 7 + r() * 9) { const y = top(Math.min(x, edgeX)) + 8 + r() * 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 20 + r() * 40); g.stroke(); }
  for (let x = x0; x < edgeX + 6; x += 5 + r() * 6) { g.fillStyle = r() < 0.5 ? '#7c9a76' : '#8eaa82'; g.beginPath(); g.ellipse(x, top(Math.min(x, edgeX)) - 2 - r() * 3, 4 + r() * 4, 4 + r() * 4, 0, 0, P2); g.fill(); }
  // 小村：几座屋顶 + 一座五重塔（远处的灰调剪影）
  const roof = '#7a8090', wall = '#dcd8c8';
  for (const [hx, hw] of [[-470, 22], [-438, 18], [-404, 26], [-250, 20], [-222, 24], [-120, 18], [-60, 22]]) { const y = top(hx) - 2; g.fillStyle = wall; g.fillRect(hx - hw / 2, y - 9, hw, 9); g.fillStyle = roof; g.beginPath(); g.moveTo(hx - hw / 2 - 3, y - 8); g.lineTo(hx, y - 16); g.lineTo(hx + hw / 2 + 3, y - 8); g.fill(); }
  { const px = -330, y = top(px) - 2; for (let s = 0; s < 5; s++) { const yy = y - s * 9, w = 26 - s * 4; g.fillStyle = wall; g.fillRect(px - w / 2 + 3, yy - 7, w - 6, 7); g.fillStyle = roof; g.beginPath(); g.moveTo(px - w / 2 - 3, yy - 6); g.lineTo(px + w / 2 + 3, yy - 6); g.lineTo(px + w / 2 - 2, yy - 10); g.lineTo(px - w / 2 + 2, yy - 10); g.fill(); } g.fillRect(px - 0.8, y - 58, 1.6, 12); }
  waterfall(g, r, 40, top(40) + 2, 430, 7, 0.8); waterfall(g, r, -540, top(-540) + 2, 430, 5, 0.6);
  g.strokeStyle = rgba('#3a4a5a', 0.55); g.lineWidth = 1.2;
  for (const [bx, by, s] of [[-80, 140, 5], [-60, 150, 4], [-100, 155, 3.5], [260, 120, 4], [280, 128, 3]]) { g.beginPath(); g.moveTo(bx - s, by - s * 0.4); g.quadraticCurveTo(bx - s * 0.4, by - s * 0.7, bx, by); g.quadraticCurveTo(bx + s * 0.4, by - s * 0.7, bx + s, by - s * 0.4); g.stroke(); }
  // 云海（深渊口）
  for (let k = 0; k < 110; k++) { const cx = x0 + r() * (CLIFF_X + 120 - x0), cy = 384 + r() * 56, rr = 8 + r() * 24; g.fillStyle = vgrad(g, cy - rr, cy + rr, rgba('#ffffff', 0.55 + r() * 0.3), rgba('#e6ecee', 0.2)); g.beginPath(); g.arc(cx, cy, rr, 0, P2); g.fill(); }
  haze(g, x0, 360, SURF_W, 80, '#ffffff', 0.35);
  // 崖顶后方的绿丘（小镇坐在上面），往深渊那一侧沉下去
  const env = (x) => { const u = Math.max(0, Math.min(1, (x - 250) / 130)); return u * u * (3 - 2 * u); };
  mountains(g, { seed: 63, x0: 230, x1, base: 372, amp: 58, freq: 0.009, env, shade: ['#5f9a52', '#86b66a'], lit: ['#8cc06a', '#acd28a'], trees: ['#5a9248', '#6aa252'], mist: '#e8eed8', mistA: 0.25, bottom: 440 });
  mountains(g, { seed: 71, x0: 280, x1, base: 404, amp: 30, freq: 0.014, env: (x) => env(x - 40), shade: ['#4f8a44', '#6aa456'], lit: ['#78b25a', '#98c876'], trees: ['#4a8240', '#5a9448'], mist: '#e8eed8', mistA: 0.1, bottom: 440 });
}
export function surfaceBackdrop() {
  return memo('surf', () => compose(SURF_X0, SURF_Y0, SURF_W, SURF_H, BG, drawSurface, 0, 46));
}

// ━━ 深层远景 ━━
function drawRim(g, Y0) {
  const r = rng(1201), x0 = VOID_X0, n = makeNoise(1203);
  rays(g, r, -260, Y0 - 20, 520, L3 + 40, '#fff2c0', 7, 0.1);
  const ledges = farWall(g, r, n, x0, Y0 - 40, Y0 + L3 + 40, 34, 46, ['#c2ae7e', '#9a8a64'], 0.42, ['#8a9a58', '#7a9a4e', '#a2b866']);
  for (const [xr, y] of ledges.filter((_, k) => k % 2 === 0)) waterfall(g, r, xr - 30 - r() * 60, y + 4, y + 120 + r() * 80, 6, 0.65);
  islet(g, r, 190, Y0 + 130, 92, 0.12); islet(g, r, 262, Y0 + 330, 54, 0.22); islet(g, r, 130, Y0 + 40, 34, 0.45); islet(g, r, -260, Y0 + 220, 120, 0.2); islet(g, r, -520, Y0 + 90, 70, 0.35);
  haze(g, x0, Y0 + 170, VOID_W, 90, '#fff6dc', 0.35);
  g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 26; k++) softDot(g, x0 + r() * VOID_W, Y0 + r() * L3, 3 + r() * 5, '#ffe9a0', 0.5); g.restore();
}
function trunk(g, r, pts, w, k, y) {
  const [a, b, c] = pts, bark = fog('#6a5038', y, k), barkD = fog('#3e2c1e', y, k), barkL = fog('#9a7a58', y, k);
  const at = (t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  const path = () => { g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(b[0], b[1], c[0], c[1]); };
  g.lineCap = 'round';
  g.strokeStyle = barkD; g.lineWidth = w; path(); g.stroke();
  g.strokeStyle = bark; g.lineWidth = w * 0.72; g.save(); g.translate(0, -w * 0.1); path(); g.stroke(); g.restore();
  g.strokeStyle = barkL; g.lineWidth = w * 0.16; g.save(); g.translate(0, -w * 0.32); path(); g.stroke(); g.restore();
  g.strokeStyle = rgba(barkD, 0.6); g.lineWidth = 1;
  for (let t = 0.05; t < 0.95; t += 0.06) { const [px, py] = at(t); g.beginPath(); g.moveTo(px, py - w * 0.3); g.lineTo(px + 3, py + w * 0.3); g.stroke(); }
  return at;
}
function canopy(g, r, x, y, w, h, k) {
  const pal = ['#2f5a40', '#4a8a58', '#8ac878'].map((c) => fog(c, y, k));
  for (let s = 0; s < 7; s++) { g.fillStyle = pal[s % 2]; g.beginPath(); g.ellipse(x + (r() - 0.5) * w, y + (r() - 0.5) * h * 0.6, w * (0.22 + r() * 0.16), h * (0.3 + r() * 0.2), 0, 0, P2); g.fill(); }
  foliage(g, r, x - w / 2, y - h / 2, w, h, pal, 40, 3.4);
}
function drawWoods(g, Y0) {
  const r = rng(2201), x0 = VOID_X0, n = makeNoise(2203);
  rays(g, r, -300, Y0 - 20, 560, L3 + 40, '#e8ffd8', 6, 0.08);
  farWall(g, r, n, x0, Y0 - 40, Y0 + L3 + 40, 20, 40, ['#7c9a86', '#5e7a6c'], 0.45, ['#4a7a58', '#3e6e4e', '#5e8e62']);
  const far = trunk(g, r, [[x0, Y0 + 200], [-200, Y0 + 160], [150, Y0 + 210]], 12, 0.55, Y0 + 200); canopy(g, r, 150, Y0 + 200, 70, 34, 0.55);
  for (let t = 0.3; t < 1; t += 0.12) { const [px, py] = far(t); vine(g, r, px, py, 40 + r() * 60, fog('#3a6a48', py, 0.5), fog('#5aa068', py, 0.5), 6); }
  const t1 = trunk(g, r, [[x0, Y0 + 70], [-160, Y0 + 30], [190, Y0 + 110]], 34, 0.1, Y0 + 80);
  const t2 = trunk(g, r, [[x0, Y0 + 330], [-60, Y0 + 290], [250, Y0 + 360]], 26, 0.18, Y0 + 330);
  for (const [tf, kk, len] of [[t1, 0.1, 150], [t2, 0.18, 110]]) for (let t = 0.15; t < 0.98; t += 0.05) { const [px, py] = tf(t); vine(g, r, px + (r() - 0.5) * 6, py + 8, len * (0.4 + r() * 0.8), fog('#2f5a3a', py, kk), fog('#5aa068', py, kk), 8); }
  canopy(g, r, 190, Y0 + 100, 120, 60, 0.1); canopy(g, r, 20, Y0 + 50, 140, 50, 0.1); canopy(g, r, 250, Y0 + 350, 90, 46, 0.18); canopy(g, r, 90, Y0 + 312, 110, 40, 0.18);
  haze(g, x0, Y0 + 200, VOID_W, 100, '#cfe6d6', 0.3);
  g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 34; k++) softDot(g, x0 + r() * VOID_W, Y0 + r() * L3, 4 + r() * 6, '#ffd27a', 0.55); g.restore();
}
function crystal(g, x, yb, w, h, lean, k) {
  const y = yb - h, c1 = fog('#a8eaff', y, k), c2 = fog('#2a4a9a', yb, k);
  g.fillStyle = vgrad(g, y, yb, c1, c2);
  g.beginPath(); g.moveTo(x - w / 2, yb); g.lineTo(x - w / 2 + lean, y + w * 0.5); g.lineTo(x + lean, y); g.lineTo(x + w / 2 + lean, y + w * 0.5); g.lineTo(x + w / 2, yb); g.closePath(); g.fill();
  g.fillStyle = rgba('#ffffff', 0.22 * (1 - k)); g.beginPath(); g.moveTo(x - w / 2 + lean, y + w * 0.5); g.lineTo(x + lean, y); g.lineTo(x + lean * 0.4, yb); g.lineTo(x - w / 2, yb); g.closePath(); g.fill();
  g.strokeStyle = rgba('#e8fbff', 0.5 * (1 - k)); g.lineWidth = 1; g.beginPath(); g.moveTo(x + lean, y); g.lineTo(x + lean * 0.4, yb); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, x + lean, y + 6, w * 1.6, '#6ad8ff', 0.35 * (1 - k)); g.restore();
}
function drawSea(g, Y0) {
  const r = rng(3201), x0 = VOID_X0, x1 = VOID_X0 + VOID_W;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.4;
  for (let k = 0; k < 16; k++) { const y = Y0 + 10 + r() * 140, ph = r() * 9, a = 0.06 + r() * 0.08; g.strokeStyle = rgba('#9ad8ff', a); g.beginPath(); for (let x = x0; x <= x1; x += 8) { const yy = y + Math.sin(x * 0.03 + ph) * 5 + Math.sin(x * 0.011 + ph * 2) * 7; if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy); } g.stroke(); }
  g.restore();
  rays(g, r, -400, Y0 - 20, 700, L3, '#9ad8ff', 6, 0.07);
  // 远处的古石拱
  for (const [ax, aw, ah, k] of [[-430, 120, 170, 0.6], [120, 90, 130, 0.68]]) {
    const yb = Y0 + L3 + 20, inner = aw / 2 - aw * 0.22; g.fillStyle = fog('#4a5a8a', yb - ah, k);
    g.beginPath(); g.moveTo(ax - aw / 2, yb); g.lineTo(ax - aw / 2, yb - ah); g.lineTo(ax + aw / 2, yb - ah); g.lineTo(ax + aw / 2, yb); g.lineTo(ax + inner, yb); g.lineTo(ax + inner, yb - ah * 0.55); g.arc(ax, yb - ah * 0.55, inner, 0, Math.PI, true); g.lineTo(ax - inner, yb); g.closePath(); g.fill();
    g.fillStyle = fog('#5a6a9a', yb - ah, k); g.fillRect(ax - aw / 2 - 6, yb - ah - 8, aw + 12, 10);
  }
  for (let k = 0; k < 14; k++) { const x = x0 + 40 + r() * (VOID_W - 80); crystal(g, x, Y0 + L3 + 40, 16 + r() * 18, 90 + r() * 140, (r() - 0.5) * 18, 0.55); }
  for (let k = 0; k < 10; k++) { const x = k % 2 ? 10 + r() * 290 : x0 + 60 + r() * (VOID_W - 120), h = 120 + r() * 200; crystal(g, x, Y0 + L3 + 40, 24 + r() * 26, h, (r() - 0.5) * 26, 0.12); crystal(g, x + 22, Y0 + L3 + 40, 14 + r() * 10, h * 0.55, 10, 0.18); }
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let s = 0; s < 4; s++) { const sx = s % 2 ? 60 + r() * 200 : x0 + 160 + r() * (VOID_W - 320), sy = Y0 + 80 + r() * 260; for (let k = 0; k < 7; k++) { const fx = sx + (r() - 0.5) * 90, fy = sy + (r() - 0.5) * 50, fl = 5 + r() * 4; softDot(g, fx, fy, fl * 2.2, '#9ae8ff', 0.3); g.fillStyle = rgba('#d8f6ff', 0.8); g.beginPath(); g.ellipse(fx, fy, fl, fl * 0.38, 0, 0, P2); g.fill(); g.beginPath(); g.moveTo(fx - fl * 0.8, fy); g.lineTo(fx - fl * 1.6, fy - fl * 0.45); g.lineTo(fx - fl * 1.6, fy + fl * 0.45); g.fill(); } }
  g.restore();
  g.strokeStyle = rgba('#d8f0ff', 0.45); g.lineWidth = 1;
  for (let k = 0; k < 40; k++) { const bx = x0 + r() * VOID_W, by = Y0 + r() * L3, br = 1.5 + r() * 3.5; g.beginPath(); g.arc(bx, by, br, 0, P2); g.stroke(); }
  haze(g, x0, Y0 + 220, VOID_W, 120, '#8090d0', 0.25);
}
const DRAW = [drawRim, drawWoods, drawSea];
export function layerBackdrop(li) {
  return memo('L' + li, () => { const Y0 = SURF + li * L3; return compose(VOID_X0, Y0, VOID_W, L3 + 2, LBG, (g) => DRAW[li](g, Y0), 70, li === LAYERS.length - 1 ? 120 : 70); });
}

// 崖顶小镇：随基地档次换风格（和风村落 → 工业矿镇 → 赛博都市）。
// 三张原画构图不同，所以各自裁到“建筑底线”，再按同一底线贴在崖顶（切口藏在地面草皮后面）。
export const TOWN_W = 560;   // 一档（和风村落）的宽度；其他档按高度定尺寸
export const TOWN_CROP = { 1: 0.86, 2: 0.86, 3: 0.86, 4: 0.86, 5: 0.86 };   // 五张图构图一致（同一台地 + 矿口），裁掉同样比例的岩基
const TOWN_GROW = { 1: 1, 2: 1.1, 3: 1.18, 4: 1.22, 5: 1.26 };              // 越高级的小镇越气派一点
// 远处的大气色：和风 / 工业暖褐 / 赛博冷蓝 / 量子淡紫 / 天穹暖金
const TOWN_TINT = { 1: 'rgba(214,232,240,0.16)', 2: 'rgba(230,196,150,0.14)', 3: 'rgba(120,150,220,0.18)', 4: 'rgba(150,120,220,0.16)', 5: 'rgba(255,226,160,0.14)' };
const townImg = (tier) => envImg(tier > 1 ? `town-${tier}` : 'town');
const H1 = () => { const im = townImg(1); return TOWN_W * (im.height * TOWN_CROP[1]) / im.width; };
export const TOWN_H = (tier = 1) => Math.round(H1() * TOWN_GROW[tier]);
export const TOWN_WT = (tier = 1) => { const im = townImg(tier); return Math.round(TOWN_H(tier) * im.width / (im.height * TOWN_CROP[tier])); };
export function town(tier = 1) {
  return memo('town' + tier, () => {
    const img = townImg(tier), H = TOWN_H(tier), Wt = TOWN_WT(tier);
    const c = canvas(Wt * LBG, H * LBG), g = c.getContext('2d');
    g.drawImage(img, 0, 0, img.width, img.height * TOWN_CROP[tier], 0, 0, c.width, c.height);
    // 远处一层淡淡的大气色，和深渊远景同一个色系
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = TOWN_TINT[tier] ?? TOWN_TINT[1];
    g.fillRect(0, 0, c.width, c.height);
    return c;
  });
}
