// 每条矿道一行：电梯停靠的短码头（放矿箱）→ 崖壁上的洞口（管理员站在这里）→ 短短一段矿道 → 尽头的矿脉。
// 岩体是矢量绘制的岩层：每一条岩层带的边界、颜色和带上的石块 / 裂纹 / 苔藓都只由它在世界里的编号决定，
// 相邻两行画同一条带时完全一致，所以行与行之间没有接缝；层与层交界处岩色逐渐过渡。洞内压暗 + 暖色吊灯，矿脉是手绘矿簇原画。
// 崖面以左是透明的（露出深渊远景），只画栈道、支架、绳索、灯和垂下来的植物。RES 倍绘制。
import { canvas, rng, rgba, lerpColor, softDot, foliage, vine, RES } from './kit.js';
import { LAYERS } from '../data/layers.js';
import { oreKind } from './ore.js';
import { ROW, CLIFF_X, SURF, LAYER_H } from './backdrop.js';
import { envImg } from './sprites.js';

export const X0 = 60, X1 = 1000, T_TOP = 40, T_BOT = 122, CRATE_X = 320, MINE_X = 432, WALL_X = 458, DOCK_X = 268;
const cache = {};
const memo = (k, fn) => cache[k] ?? (cache[k] = fn());
const W = X1 - X0, BH = 26;
export const VEIN = { coal: 'vein-coal', gold: 'vein-gold', diamond: 'vein-diamond' };
// 崖面轮廓：以一行高度为周期，上下行连贯；洞口那段比较直
export const faceX = (y) => CLIFF_X + Math.sin((2 * Math.PI * y) / ROW) * 8 + Math.sin((6 * Math.PI * y) / ROW) * 4;

// 岩色：按世界高度取层调色，层交界上下各 0.15 层高内渐变到下一层
function rockPal(wy) {
  const p = (wy - SURF) / LAYER_H, li = Math.max(0, Math.min(LAYERS.length - 1, Math.floor(p))), f = p - li;
  let a = LAYERS[li], b = a, t = 0;
  if (f > 0.85 && li < LAYERS.length - 1) { b = LAYERS[li + 1]; t = (f - 0.85) / 0.3; }
  else if (f < 0.15 && li > 0) { a = LAYERS[li - 1]; t = 0.5 + f / 0.3; }
  t = Math.max(0, Math.min(1, t));
  return { rock: lerpColor(a.rock, b.rock, t), rock2: lerpColor(a.rock2, b.rock2, t), moss: lerpColor(a.moss, b.moss, t) };
}
// 第 k 条岩层带的上边界（世界坐标，略微倾斜 + 起伏）
const bandY = (k, xw) => k * BH + 5 * Math.sin(xw * 0.011 + k * 1.9) + 2.5 * Math.sin(xw * 0.037 + k * 0.7) + (xw - CLIFF_X) * 0.035;
// 矢量岩层：画在行画布坐标（x 从 X0 起，y 从行顶起），覆盖整行
function strata(g, i) {
  const top = SURF + i * ROW, kA = Math.floor((top - 60) / BH), kB = Math.ceil((top + ROW + 40) / BH);
  const line = (k, dy = 0) => { for (let x = 0; x <= W + 8; x += 8) { const y = bandY(k, x + X0) - top + dy; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); } };
  for (let k = kA; k <= kB; k++) {
    const r = rng(k * 7919 + 13), P = rockPal(k * BH + BH / 2), h = r();
    const base = lerpColor(lerpColor(P.rock, P.rock2, h), '#d8b088', r() * 0.12);
    // 带体：上亮下暗
    g.beginPath(); line(k); for (let x = W + 8; x >= 0; x -= 8) g.lineTo(x, bandY(k + 1, x + X0) - top); g.closePath();
    const yy = k * BH - top; g.fillStyle = (() => { const gr = g.createLinearGradient(0, yy - 6, 0, yy + BH + 18); gr.addColorStop(0, lerpColor(base, '#fff0d8', 0.12)); gr.addColorStop(1, lerpColor(base, '#140c08', 0.18)); return gr; })(); g.fill();
    // 横向的细纹理
    for (let s = 0; s < 9; s++) { const x = r() * W, y = bandY(k, x + X0) - top + 4 + r() * (BH - 8); g.fillStyle = rgba(r() < 0.5 ? '#fff0d8' : '#1a1008', 0.06 + r() * 0.06); g.beginPath(); g.ellipse(x, y, 20 + r() * 50, 1 + r() * 1.6, 0, 0, Math.PI * 2); g.fill(); }
    // 石块（上边亮、下边投影）
    for (let s = 0; s < 7; s++) {
      const x = r() * W, y = bandY(k, x + X0) - top + 6 + r() * (BH - 10), rx = 5 + r() * 10, ry = rx * (0.45 + r() * 0.2), sc = lerpColor(base, r() < 0.5 ? '#000000' : '#ffffff', 0.12);
      g.fillStyle = rgba('#140c08', 0.25); g.beginPath(); g.ellipse(x + 1, y + 2, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = sc; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba('#fff4e0', 0.22); g.beginPath(); g.ellipse(x - rx * 0.2, y - ry * 0.35, rx * 0.6, ry * 0.35, 0, 0, Math.PI * 2); g.fill();
    }
    // 裂纹
    g.strokeStyle = rgba('#140c08', 0.35); g.lineWidth = 1;
    for (let s = 0; s < 3; s++) { let x = r() * W, y = bandY(k, x + X0) - top + 2; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (r() - 0.5) * 10; y += 3 + r() * 5; g.lineTo(x, y); } g.stroke(); }
    // 带上沿的苔藓
    for (let s = 0; s < 3; s++) { const x = r() * W, y = bandY(k, x + X0) - top, w = 14 + r() * 30; g.fillStyle = rgba(P.moss, 0.38); g.beginPath(); g.ellipse(x, y + 1.5, w, 2.2 + r() * 1.6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = rgba(lerpColor(P.moss, '#ffffff', 0.3), 0.3); g.beginPath(); g.ellipse(x - w * 0.2, y + 0.5, w * 0.5, 1.4, 0, 0, Math.PI * 2); g.fill(); }
    // 层理线：暗缝 + 下方一道亮边
    g.strokeStyle = rgba('#1a1008', 0.42); g.lineWidth = 1.3; g.beginPath(); line(k); g.stroke();
    g.strokeStyle = rgba('#fff0d8', 0.16); g.lineWidth = 1.2; g.beginPath(); line(k, 2); g.stroke();
  }
}
function drawVein(g, kind, cx, cy, h, alpha = 1) {
  const im = envImg(VEIN[kind]), w = h * im.width / im.height;
  g.globalAlpha = alpha; g.drawImage(im, cx - w / 2, cy - h / 2, w, h); g.globalAlpha = 1;
}

function cliff(g, L, li, i, r, solid) {
  const lx = (y) => faceX(y) - X0, kind = oreKind(L.ore);
  g.save(); g.beginPath(); g.moveTo(lx(0), 0); for (let y = 0; y <= ROW; y += 5) g.lineTo(lx(y), y); g.lineTo(W, ROW); g.lineTo(W, 0); g.closePath(); g.clip();
  strata(g, i);
  // 光影：崖面受天光、越往里越暗；锁住的行整体再暗一点（顶边渐入，和上面已开放的行之间没有硬边）
  const sh = g.createLinearGradient(lx(75), 0, W, 0);
  sh.addColorStop(0, rgba('#fff2d8', 0.16)); sh.addColorStop(0.08, rgba('#fff2d8', 0)); sh.addColorStop(0.5, rgba('#0a0610', 0.12)); sh.addColorStop(1, rgba('#0a0610', 0.42));
  g.fillStyle = sh; g.fillRect(0, 0, W, ROW);
  if (solid === 'first') { const dg = g.createLinearGradient(0, 0, 0, 40); dg.addColorStop(0, rgba('#0a0814', 0)); dg.addColorStop(1, rgba('#0a0814', 0.28)); g.fillStyle = dg; g.fillRect(0, 0, W, ROW); }
  else if (solid) { g.fillStyle = rgba('#0a0814', 0.28); g.fillRect(0, 0, W, ROW); }
  // 散落在岩体里的小矿簇
  for (let k = 0; k < (solid ? 4 : 6); k++) { const x = lx(70) + 200 + r() * (W - lx(70) - 230), y = 18 + r() * (ROW - 36); drawVein(g, kind, x, y, 12 + r() * 10, 0.92); }
  g.restore();
  // 崖面边缘：一道亮边 + 细墨线
  g.strokeStyle = rgba('#fff0d0', 0.28); g.lineWidth = 3; g.beginPath(); g.moveTo(lx(0) + 2, 0); for (let y = 0; y <= ROW; y += 5) g.lineTo(lx(y) + 2, y); g.stroke();
  g.strokeStyle = rgba('#1e140c', 0.6); g.lineWidth = 1.4; g.beginPath(); g.moveTo(lx(0), 0); for (let y = 0; y <= ROW; y += 5) g.lineTo(lx(y), y); g.stroke();
}

function wood(g, x, y, w, h, base = '#7a5230') {
  const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, lerpColor(base, '#ffffff', 0.18)); gr.addColorStop(1, lerpColor(base, '#000000', 0.25));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = rgba('#2a180a', 0.7); g.lineWidth = 0.9; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function cave(g, L, li, i, r) {
  const x0 = faceX((T_TOP + T_BOT) / 2) - X0 - 4, x1 = WALL_X - X0 + 22, y0 = T_TOP, y1 = T_BOT, kind = oreKind(L.ore);
  const shape = () => { g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + 14); g.quadraticCurveTo(x0 + 6, y0 - 2, x0 + 28, y0);
    for (let x = x0 + 28; x < x1 - 30; x += 22) g.lineTo(x, y0 + (r() - 0.5) * 6 - 2);
    g.quadraticCurveTo(x1 + 4, y0 - 2, x1 + 8, y0 + 26); g.quadraticCurveTo(x1 + 12, y1 - 8, x1 - 12, y1); g.closePath(); };
  g.save(); shape(); g.clip();
  strata(g, i);
  // 洞内压暗：洞口偏暖、深处偏冷
  const ig = g.createLinearGradient(x0, 0, x1, 0); ig.addColorStop(0, rgba('#2a1608', 0.55)); ig.addColorStop(0.55, rgba('#120a06', 0.7)); ig.addColorStop(1, rgba('#0a0610', 0.62));
  g.fillStyle = ig; g.fillRect(x0 - 2, y0 - 8, x1 - x0 + 30, y1 - y0 + 12);
  const vg = g.createLinearGradient(0, y0, 0, y1); vg.addColorStop(0, rgba('#000000', 0.35)); vg.addColorStop(0.3, rgba('#000000', 0)); vg.addColorStop(1, rgba('#000000', 0.1));
  g.fillStyle = vg; g.fillRect(x0 - 2, y0 - 8, x1 - x0 + 30, y1 - y0 + 12);
  // 尽头的矿脉（手绘矿簇），金 / 钻石带光晕
  const mx = MINE_X - X0 + 30, my = (y0 + y1) / 2 + 2;
  if (kind !== 'coal') { g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, mx, my, 70, kind === 'gold' ? '#ffb840' : '#6ad8ff', 0.4); g.restore(); }
  drawVein(g, kind, mx + 14, my - 18, 40); drawVein(g, kind, mx + 18, my + 18, 46); drawVein(g, kind, mx - 2, my, 62);
  // 洞内地面：压实的泥土 + 枕木
  const fg = g.createLinearGradient(0, y1 - 9, 0, y1); fg.addColorStop(0, rgba('#3a2614', 0.9)); fg.addColorStop(1, rgba('#1e1208', 0.95));
  g.fillStyle = fg; g.fillRect(x0, y1 - 8, x1 - x0 + 20, 8);
  for (let x = x0 + 8; x < x1; x += 16) { g.fillStyle = rgba('#6a4424', 0.85); g.fillRect(x, y1 - 5, 9, 3); }
  // 暖色吊灯照亮洞口一带
  g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, x0 + 33, y0 + 26, 60, '#ffb060', 0.32); g.restore();
  g.restore();
  // 粗木支架 + 吊灯
  const x = x0 + 8;
  wood(g, x, y0 + 2, 7, y1 - y0 - 6, '#6a4424'); wood(g, x + 48, y0 + 2, 7, y1 - y0 - 6, '#6a4424');
  wood(g, x - 7, y0 - 1, 70, 9, '#8a5c32');
  g.fillStyle = rgba('#ffe2b0', 0.3); g.fillRect(x - 7, y0 - 1, 70, 2);
  g.strokeStyle = '#2a1a10'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 27, y0 + 8); g.lineTo(x + 27, y0 + 16); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, x + 27, y0 + 21, 26, '#ffc070', 0.6); g.restore();
  g.fillStyle = '#c8402c'; g.beginPath(); g.ellipse(x + 27, y0 + 21, 4.2, 5.4, 0, 0, Math.PI * 2); g.fill();   // 红纸灯笼
  g.fillStyle = '#ffd890'; g.beginPath(); g.ellipse(x + 27, y0 + 21, 2.4, 3.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1a10'; g.fillRect(x + 25, y0 + 15.5, 4, 1.4); g.fillRect(x + 25, y0 + 25.6, 4, 1.4);
  g.strokeStyle = rgba('#140c06', 0.6); g.lineWidth = 1.4; shape(); g.stroke();
}

// 短码头：从崖口伸出一小段，电梯停在左端；斜撑插进岩壁，左端一根柱子挂着灯笼
function walkway(g) {
  const face = faceX(T_BOT) - X0, x0 = DOCK_X - X0, y = T_BOT;
  g.strokeStyle = '#4a2e16'; g.lineWidth = 3.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0 + 6, y + 4); g.lineTo(face, y + 30); g.stroke();
  g.beginPath(); g.moveTo(x0 + 30, y + 4); g.lineTo(face, y + 16); g.stroke();
  wood(g, x0 - 4, y - 2, face - x0 + 10, 7, '#6a4424');
  for (let x = x0 - 4; x < face + 4; x += 9) { wood(g, x, y - 3, 8.4, 5, (x / 9) % 2 < 1 ? '#9a6838' : '#8a5c30'); }
  g.fillStyle = 'rgba(255,230,180,0.3)'; g.fillRect(x0 - 4, y - 3, face - x0 + 8, 1.2);
  wood(g, x0 + 1, y - 32, 4, 30, '#5a3a1e');
  g.strokeStyle = 'rgba(160,130,90,0.95)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + 4, y - 28); g.quadraticCurveTo((x0 + face) / 2, y - 18, face, y - 30); g.stroke();
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 4, y - 31); g.lineTo(x0 + 11, y - 33); g.lineTo(x0 + 11, y - 30); g.stroke();
  g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, x0 + 11, y - 24, 24, '#ffb860', 0.55); g.restore();
  g.fillStyle = '#c8402c'; g.beginPath(); g.ellipse(x0 + 11, y - 24, 3.6, 4.6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd890'; g.beginPath(); g.ellipse(x0 + 11, y - 24, 2, 3, 0, 0, Math.PI * 2); g.fill();
}

// 每层的植被点缀（崖面、洞口上沿）
const FLORA = {
  rim(g, L, r) { for (let i = 0; i < 5; i++) { const y = r() * ROW, x = faceX(y) - X0; foliage(g, r, x - 14, y - 8, 26, 14, ['#3f6a3a', '#5a8a48', '#a8d080'], 36, 3); }
    foliage(g, r, faceX(T_TOP) - X0 + 4, T_TOP - 12, 150, 10, ['#3f6a3a', '#5a8a48', '#a8d080'], 70, 3);
    for (let i = 0; i < 5; i++) vine(g, r, faceX(0) - X0 - 6 + r() * 18, r() * 20, 40 + r() * 70, '#4a6a3a', '#7aa858', 6); },
  vines(g, L, r) { for (let i = 0; i < 10; i++) vine(g, r, faceX(0) - X0 - 16 + r() * 200, -4, 40 + r() * 90, '#3a6a48', '#5aa068', 10);
    foliage(g, r, faceX(T_TOP) - X0, T_TOP - 14, 170, 12, ['#2f5a40', '#4a8a58', '#8ac878'], 90, 3.2);
    g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) softDot(g, faceX(0) - X0 + r() * 260, 10 + r() * 40, 5, L.glow, 0.8); g.restore(); },
  sea(g, L, r) {
    g.strokeStyle = 'rgba(210,235,255,0.55)'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(faceX(0) - X0 - 100 + r() * 120, r() * ROW, 1.5 + r() * 3, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 3; i++) { const y = 10 + r() * (ROW - 20); drawVein(g, 'diamond', faceX(y) - X0 + 4, y, 14 + r() * 8, 0.95); } },
};

// solid：false = 已开放；'first' = 已开放行正下方的第一条未开放行（压暗从顶边渐入）；true = 更深的未开放行
export function rowTexture(li, i, solid = false) {
  return memo(`r${li}-${i}-${solid === 'first' ? 'f' : solid ? 's' : 't'}`, () => {
    const L = LAYERS[li], c = canvas(W * RES, ROW * RES), g = c.getContext('2d'), r = rng(31 + li * 97 + i * 13 + (solid ? 500 : 0));
    g.scale(RES, RES);
    cliff(g, L, li, i, r, solid);
    if (!solid) { cave(g, L, li, i, r); walkway(g); }
    FLORA[L.id]?.(g, L, r);
    return c;
  });
}
