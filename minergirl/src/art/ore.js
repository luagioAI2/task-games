// 矿石（照原版的三种矿：煤 → 金 → 钻石）。按层的矿色找到矿种，画成有棱角的矿块：
// 煤 = 黑灰色多棱块 + 冷色反光面；金 = 圆润的金块 + 暖色高光；钻石 = 切面宝石 + 白色闪光。
import { LAYERS } from '../data/layers.js';
import { rgba, softDot } from './kit.js';

const kindOf = (ore) => LAYERS.find((L) => L.ore === ore)?.oreKind ?? 'coal';
export const ORE_GLOW = { coal: null, gold: '#ffd060', diamond: '#9ae8ff' };

// 不规则多边形顶点（r 半径，n 顶点数，jag 起伏）
function shape(r, n, jag, rnd, rot = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = rot + (k / n) * Math.PI * 2, j = 1 - jag / 2 + rnd() * jag; pts.push([Math.cos(a) * r * j, Math.sin(a) * r * j * 0.85]); }
  return pts;
}
const path = (g, x, y, pts) => { g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py))); g.closePath(); };

// 一块矿：ore 为层的矿色（用来认矿种），rnd 为随机数函数
export function oreChunk(g, ore, x, y, r, rnd, glow = false) {
  const kind = kindOf(ore);
  if (glow && ORE_GLOW[kind]) softDot(g, x, y, r * 2.6, ORE_GLOW[kind], kind === 'diamond' ? 0.5 : 0.4);
  if (kind === 'coal') {
    const pts = shape(r, 6 + Math.floor(rnd() * 2), 0.5, rnd, rnd());
    path(g, x, y, pts); g.fillStyle = '#2a2e36'; g.fill();
    // 反光面：左上两片冷灰色三角
    g.save(); path(g, x, y, pts); g.clip();
    g.fillStyle = '#5a6372'; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r * 0.3, y - r); g.lineTo(x - r * 0.1, y + r * 0.1); g.lineTo(x - r, y + r * 0.2); g.closePath(); g.fill();
    g.fillStyle = '#8c97aa'; g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.9); g.lineTo(x - r * 0.05, y - r * 0.85); g.lineTo(x - r * 0.35, y - r * 0.2); g.closePath(); g.fill();
    g.fillStyle = '#16181e'; g.beginPath(); g.moveTo(x + r, y + r); g.lineTo(x + r * 0.1, y + r); g.lineTo(x + r * 0.5, y - r * 0.1); g.lineTo(x + r, y - r * 0.2); g.closePath(); g.fill();
    g.restore();
    path(g, x, y, pts); g.strokeStyle = '#0c0e12'; g.lineWidth = Math.max(0.7, r * 0.16); g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x - r * 0.45, y - r * 0.55, Math.max(0.8, r * 0.18), Math.max(0.8, r * 0.18));
  } else if (kind === 'gold') {
    const pts = shape(r, 8, 0.32, rnd, rnd());
    g.beginPath(); pts.forEach(([px, py], k) => { const [nx, ny] = pts[(k + 1) % pts.length], mx = x + (px + nx) / 2, my = y + (py + ny) / 2; if (!k) g.moveTo(mx, my); else g.quadraticCurveTo(x + px, y + py, mx, my); }); const [fx, fy] = pts[0], [sx, sy] = pts[1]; g.quadraticCurveTo(x + fx, y + fy, x + (fx + sx) / 2, y + (fy + sy) / 2); g.closePath();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#f2b632'); gr.addColorStop(1, '#a86808');
    g.fillStyle = gr; g.fill(); g.strokeStyle = '#6a3e04'; g.lineWidth = Math.max(0.7, r * 0.15); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.38, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,70,0,0.45)'; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.2, r * 0.16, 0, Math.PI * 2); g.fill();
  } else {
    // 钻石：上面一圈冠部切面、下面尖底
    const w = r * 1.05, h = r * 1.15, top = y - h * 0.45, mid = y - h * 0.08, bot = y + h * 0.75;
    g.beginPath(); g.moveTo(x - w * 0.55, top); g.lineTo(x + w * 0.55, top); g.lineTo(x + w, mid); g.lineTo(x, bot); g.lineTo(x - w, mid); g.closePath();
    const gr = g.createLinearGradient(x - w, top, x + w, bot); gr.addColorStop(0, '#f0fdff'); gr.addColorStop(0.45, '#7ae0ff'); gr.addColorStop(1, '#2a8ad0');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(0.5, r * 0.08);
    g.beginPath(); g.moveTo(x - w, mid); g.lineTo(x + w, mid); g.moveTo(x - w * 0.55, top); g.lineTo(x - w * 0.25, mid); g.lineTo(x, top); g.lineTo(x + w * 0.25, mid); g.lineTo(x + w * 0.55, top);
    g.moveTo(x - w * 0.25, mid); g.lineTo(x, bot); g.lineTo(x + w * 0.25, mid); g.stroke();
    g.beginPath(); g.moveTo(x - w * 0.55, top); g.lineTo(x + w * 0.55, top); g.lineTo(x + w, mid); g.lineTo(x, bot); g.lineTo(x - w, mid); g.closePath();
    g.strokeStyle = '#1a5a8a'; g.lineWidth = Math.max(0.7, r * 0.13); g.lineJoin = 'round'; g.stroke();
    // 闪光
    const sx = x - w * 0.3, sy = top + h * 0.12, s = r * 0.5;
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(sx, sy - s); g.lineTo(sx + s * 0.2, sy - s * 0.2); g.lineTo(sx + s, sy); g.lineTo(sx + s * 0.2, sy + s * 0.2); g.lineTo(sx, sy + s); g.lineTo(sx - s * 0.2, sy + s * 0.2); g.lineTo(sx - s, sy); g.lineTo(sx - s * 0.2, sy - s * 0.2); g.closePath(); g.fill();
  }
}
// 一堆矿（箱子 / 篮子 / 车 / 麻袋里）：在 (x0..x0+w) 宽、底在 yb 的范围里堆 n 块，越往上越少
export function orePile(g, ore, x0, yb, w, hgt, n, rnd, r = 3.6) {
  const items = [];
  for (let k = 0; k < n; k++) { const t = k / Math.max(1, n - 1), x = x0 + r + rnd() * (w - r * 2) * (1 - t * 0.45) + (w - r * 2) * t * 0.22, y = yb - r * 0.6 - t * hgt + (rnd() - 0.5) * 2; items.push([x, y, r * (0.8 + rnd() * 0.45)]); }
  items.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rr] of items) oreChunk(g, ore, x, y, rr, rnd);   // 上面的先画、下面的盖在前面
}
export const oreKind = kindOf;
export { rgba };
