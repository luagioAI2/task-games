// 美术工具箱：离屏画布、随机数、颜色、柔和形状。所有贴图都按 RES 像素 / 设计单位绘制。
export { rng } from '../sim/rng.js';
export const RES = 2;

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export const lerpColor = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * t));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
export const rgba = (hex, a) => { const p = parseInt(hex.slice(1), 16); return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`; };
export function grain(g, w, h, r, alpha = 0.05, density = 0.06, size = 2) {
  const n = Math.floor(w * h * density / 16);
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`; g.fillRect(r() * w, r() * h, 1 + r() * size, 1 + r() * size); }
}
// 不规则团块（岩石、树冠、云）
export function blob(g, x, y, rx, ry, r, n = 9, jag = 0.25) {
  g.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2, j = 1 - jag / 2 + r() * jag;
    const px = x + Math.cos(a) * rx * j, py = y + Math.sin(a) * ry * j;
    if (k === 0) g.moveTo(px, py); else { const pa = ((k - 0.5) / n) * Math.PI * 2; g.quadraticCurveTo(x + Math.cos(pa) * rx * (1 + jag * 0.3), y + Math.sin(pa) * ry * (1 + jag * 0.3), px, py); }
  }
  g.closePath();
}
// 柔光圆
export function softDot(g, x, y, r, col, a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ━━━━ 手绘质感工具（水彩 / 水粉笔触）━━━━
// 在当前裁剪区域里撒大量半透明笔触，颜色在 cols 之间抖动；用来给岩壁、树冠、远景上“笔触感”。
export function dabs(g, r, n, x0, y0, w, h, cols, size = [2, 6], alpha = [0.08, 0.25], ang = 0, stretch = 1.8) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, s = size[0] + r() * (size[1] - size[0]);
    g.globalAlpha = alpha[0] + r() * (alpha[1] - alpha[0]);
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath(); g.ellipse(x, y, s * stretch, s, ang + (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
// 带光影的一团（左上亮、右下暗），先底色再笔触
export function paintBlob(g, r, x, y, rx, ry, base, light, dark, n = 60) {
  g.save(); blob(g, x, y, rx, ry, r, 11, 0.3); g.fillStyle = base; g.fill(); g.clip();
  dabs(g, r, n, x - rx, y - ry, rx * 1.2, ry * 1.2, [light], [rx * 0.08, rx * 0.22], [0.15, 0.35]);
  dabs(g, r, n * 0.7, x - rx * 0.1, y, rx * 1.1, ry, [dark], [rx * 0.08, rx * 0.2], [0.12, 0.3]);
  g.restore();
}
// 树叶簇：三种色调的小叶片
export function foliage(g, r, x, y, w, h, pal, n = 80, leaf = 3.2) {
  for (let k = 0; k < 3; k++) for (let i = 0; i < n * (k === 1 ? 1.2 : 0.8); i++) {
    const px = x + r() * w, py = y + r() * h * (k === 2 ? 0.7 : 1);
    g.globalAlpha = 0.55 + r() * 0.4; g.fillStyle = pal[k];
    g.beginPath(); g.ellipse(px, py, leaf * (0.7 + r() * 0.8), leaf * 0.55, r() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
// 垂藤：一条弯曲的线 + 沿途的小叶
export function vine(g, r, x, y, len, col, leaf, sway = 8) {
  g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y);
  const cx = x + (r() - 0.5) * sway * 2, ex = x + (r() - 0.5) * sway;
  g.quadraticCurveTo(cx, y + len * 0.5, ex, y + len); g.stroke();
  for (let t = 0.1; t < 1; t += 0.07 + r() * 0.05) { const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex, py = y + len * t; g.fillStyle = leaf; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(px + (r() < 0.5 ? -2 : 2), py, 2.6, 1.4, r() * 2, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}
// 光束（从上往下斜照，叠加模式）
export function rays(g, r, x, y, w, h, col, n = 5, a = 0.12) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const sx = x + r() * w, bw = 20 + r() * 50, dx = h * 0.35; const gr = g.createLinearGradient(sx, y, sx + dx, y + h); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + bw, y); g.lineTo(sx + bw * 2.2 + dx, y + h); g.lineTo(sx + dx, y + h); g.closePath(); g.fill(); }
  g.restore();
}
// 水平雾带
export function haze(g, x, y, w, h, col, a) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
// 纸纹（极淡的颗粒，统一质感）
export function paper(g, r, w, h, a = 0.04) { grain(g, w, h, r, a, 0.05, 1.5); }
// 支持 ctx.filter 时用模糊做远景柔边，否则直接画
export function drawSoft(g, src, x, y, w, h, blurPx) {
  if ('filter' in g && blurPx > 0) { g.filter = `blur(${blurPx}px)`; g.drawImage(src, x, y, w, h); g.filter = 'none'; }
  else g.drawImage(src, x, y, w, h);
}
