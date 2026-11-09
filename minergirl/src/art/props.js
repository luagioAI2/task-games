// 道具：矿箱、缆车（大号吊斗）、矿车、站台矿堆、仓库、绞盘站栈桥、岩障、地面草皮、铁轨、木牌。
// 容器类都是“手绘原画 + 后面垫一堆手绘矿石”：矿堆按装载量一层层堆高、从箱沿上冒出来。RES 倍绘制；尺寸单位为设计单位。
import { canvas, rng, roundRect, rgba, lerpColor, softDot, RES } from './kit.js';
import { oreKind } from './ore.js';
import { envImg, envInfo } from './sprites.js';

const cache = {};
const memo = (k, fn) => cache[k] ?? (cache[k] = fn());
const make = (w, h, draw) => { const c = canvas(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); draw(g); return c; };
const HEAP = { coal: 'heap-coal', gold: 'heap-gold', diamond: 'heap-diamond' };
const ar = (k) => envImg(k).height / envImg(k).width;

// 一堆矿：level 层，每层更窄、更高；cx 为中心，yb 为底边，w 为最底层宽度
function heap(g, ore, level, cx, yb, w, step) {
  const kind = oreKind(ore), im = envImg(HEAP[kind]), a = im.height / im.width;
  if (kind !== 'coal' && level > 0) { g.save(); g.globalCompositeOperation = 'lighter'; softDot(g, cx, yb - level * step * 0.6, w * 0.6, kind === 'gold' ? '#ffc040' : '#80e0ff', 0.25); g.restore(); }
  for (let k = 0; k < level; k++) {
    const ww = w * Math.pow(0.8, k), hh = ww * a, x = cx - ww / 2 + (k % 2 ? ww * 0.04 : -ww * 0.03);
    g.drawImage(im, x, yb - k * step - hh, ww, hh);
  }
}

// 缆车吊斗：GW 宽；挂钩在顶部中点；箱沿在 GRIM 处。level 0..6
export const GW = 96, GH = GW * 332 / 360, GRIM = GH * 0.54;
// 吊斗：木斗 / 工业钢斗 / 赛博光舱。三套原画都要“装进 GW×GH 的框、挂钩落在顶边中点”，
// 所以按高度等比缩小，宽度取原图比例；箱沿高度 GRIM 是给矿堆用的，各档一致。
export function basket(ore, level, tier = 1) {
  return memo(`bk${ore}${level}-${tier}`, () => make(GW, GH, (g) => {
    if (level > 0) heap(g, ore, level, GW * 0.58, GRIM + 16, GW * 0.8, 7.5);
    const im = envImg(tierKey('gondola', tier)), s = GH / im.height, w = im.width * s;
    g.drawImage(im, (GW - w) / 2, 0, w, GH);
  }));
}
// 矿箱（level 0..4）
export const CRATE_W = 44, CRATE_HEAD = 18;
export function crate(ore, level) {
  const h = CRATE_W * ar('crate');
  return memo(`cr${ore}${level}`, () => make(CRATE_W, h + CRATE_HEAD, (g) => {
    if (level > 0) heap(g, ore, level, CRATE_W / 2, CRATE_HEAD + 8, CRATE_W * 0.9, 5);
    g.drawImage(envImg('crate'), 0, CRATE_HEAD, CRATE_W, h);
  }));
}
// 矿车（朝右；level 0..3）
export function cart(ore, level) {
  const w = 50, h = w * ar('cart'), head = 14;
  return memo(`ca${ore}${level}`, () => make(w, h + head, (g) => {
    if (level > 0) heap(g, ore, level, w / 2, head + 7, w * 0.82, 4.5);
    g.drawImage(envImg('cart'), 0, head, w, h);
  }));
}
// 车轮：叠在手绘矿车原有的轮子上，带辐条所以看得出在转
export const WHEEL = 12;
const WHEEL_X = [0.3, 0.7], WHEEL_Y = 0.545;
export function wheel() {
  return memo('wheel', () => {
    const c = canvas(WHEEL, WHEEL), g = c.getContext('2d'), r = WHEEL / 2;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(46,30,16,0.95)'; g.lineWidth = 1.8; g.beginPath(); g.arc(r, r, r - 2.4, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(70,48,26,0.85)'; g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4, e = r - 3; g.beginPath(); g.moveTo(r - Math.cos(a) * e, r - Math.sin(a) * e); g.lineTo(r + Math.cos(a) * e, r + Math.sin(a) * e); g.stroke(); }
    g.fillStyle = 'rgba(46,30,16,0.95)'; g.beginPath(); g.arc(r, r, 1.5, 0, Math.PI * 2); g.fill();
    return c;
  });
}
// 车轮在车身上的位置（比例，已按车头偏移换算成像素）
export const wheelAt = () => WHEEL_X.map((fx) => ({ x: fx * 50, y: 14 + WHEEL_Y * 50 * ar('cart') }));
// 站台上的矿堆（垫木托盘；level 0..5）
export function topPile(ore, level) {
  return memo(`tp${ore}${level}`, () => make(72, 44, (g) => {
    if (level > 0) heap(g, ore, level, 36, 36, 70, 5.5);
    const gr = g.createLinearGradient(0, 35, 0, 43); gr.addColorStop(0, '#9a6a38'); gr.addColorStop(1, '#5a3a1c');
    g.fillStyle = gr; roundRect(g, 2, 35, 68, 8, 2); g.fill(); g.strokeStyle = 'rgba(40,24,10,0.7)'; g.lineWidth = 1; g.stroke();
  }));
}
// ── 档次（造型跟着升级走）：1 木制 → 2 工业 → 3 赛博 ──
// 缆车 / 绞盘站 / 仓库各三套原画，按各自的升级等级选。各级原画比例不一致，
// 所以不直接拉伸，而是等比例“装进”各自的占位尺寸（保持底边和中心对齐，轮廓不跨级破坏）。
export const TIER_AT = [15, 35, 150, 200];   // 15 级起工业、35 级起赛博、150 级起量子、200 级（满级）天穹
export const TIER_COUNT = TIER_AT.length + 1;
export const tierOf = (level) => { let t = 1; for (const a of TIER_AT) if (level >= a) t++; return t; };
const tierKey = (base, t) => (t > 1 ? `${base}-${t}` : base);
// 把 key 的图按“装进 maxW×maxH”缩放后画在 (x, y)
function fitImg(g, key, x, y, maxW, maxH) {
  const im = envImg(key), s = Math.min(maxW / im.width, maxH / im.height), w = im.width * s, h = im.height * s;
  g.drawImage(im, x, y, w, h);
  return { w, h };
}
// 仓库（和风土藏 / 工业矿仓 / 赛博集运站）：原点左上，宽 HOUSE_W
export const HOUSE_W = 190;
export const HOUSE_H = () => Math.min(HOUSE_W * ar('warehouse'), HOUSE_W * 1.1);
// 三档原画高宽比不同：等比缩到宽 HOUSE_W，再把原画“最下面一行不透明像素”（打包时量的 bot）对齐到画布底边——
// 画布底边就是地面，所以哪一档都稳稳坐在地上（以前是顶部对齐，矮一点的档位就会悬空）。
export const warehouse = (level = 1) => memo('house' + tierOf(level), () => make(HOUSE_W, HOUSE_H(), (g) => {
  const key = tierKey('warehouse', tierOf(level)), im = envImg(key), s = Math.min(HOUSE_W / im.width, (HOUSE_W * 1.1) / im.height);
  const w = im.width * s, h = im.height * s, bot = (envInfo(key)?.bot ?? im.height - 1) + 1;
  g.drawImage(im, (HOUSE_W - w) / 2, HOUSE_H() - bot * s, w, h);
}));

// 绞盘站栈桥：画布原点在世界 (PIER_X0, DECK_Y - PIER_TOP)。左端是绞盘小屋（踩着高脚立在桥面上），中间给吊斗留出井口，
// 右边一座木门架把滑轮伸到吊斗正上方；绞盘的绳先拉到滑轮，再垂下去挂吊斗。
export const PIER_X0 = 30, PIER_W = 310, PIER_TOP = 118, PIER_H = 168;
export function pier(basketX, gapL, gapR, level = 1) {
  return memo(`pier${basketX}-${tierOf(level)}`, () => make(PIER_W, PIER_H, (g) => {
    const D = PIER_TOP, bx = basketX - PIER_X0, gl = gapL - PIER_X0, gr = gapR - PIER_X0, line = '#3a2412';
    const plank = (x0, x1) => {
      g.fillStyle = '#5a3a1e'; g.fillRect(x0, D - 1, x1 - x0, 9);
      for (let x = x0; x < x1; x += 10) { const w = Math.min(9.4, x1 - x); const gg = g.createLinearGradient(0, D - 3, 0, D + 4); gg.addColorStop(0, x / 10 % 2 < 1 ? '#a8743e' : '#956434'); gg.addColorStop(1, '#6a4422'); g.fillStyle = gg; g.fillRect(x, D - 3, w, 7); }
      g.fillStyle = 'rgba(255,232,190,0.35)'; g.fillRect(x0, D - 3, x1 - x0, 1.2);
    };
    // 斜撑
    g.strokeStyle = '#4a2e16'; g.lineWidth = 4; g.lineCap = 'round';
    for (const x of [24, 70, gr + 14]) { g.beginPath(); g.moveTo(x, D + 6); g.lineTo(Math.min(PIER_W - 4, x + 46), D + 46); g.stroke(); }
    // 绞盘站（原画）：木屋 / 工业绞车塔 / 赛博绞盘站。原画比例各不相同，
    // 所以按“占位宽 sw × 高度上限”等比装进去；越高级的档位画得越高大，坐在桥面上（木屋档带高脚，压在桥面下一点）。
    // 占位：木屋档窄一些（124 宽），后两档更宽大（最宽 168，不会伸到吊斗井口里）
    // 摆位：宽度不越过吊斗井口（gl），底边按“不透明的最低一行”正好坐在桥面上，绝不悬空。
    // 各档的占位：木屋窄而高，之后各档一档比一档高大
    const t = tierOf(level), sx = 8, boxW = Math.min(t === 1 ? 124 : 150, gl - 6 - sx);
    const im = envImg(tierKey('station', t)), hMax = PIER_TOP * [1.15, 1.5, 1.75, 1.85, 1.95][t - 1];
    const k = Math.min(boxW / im.width, hMax / im.height);
    const sh = im.height * k, swx = im.width * k;
    const sy = D + 2 - (((envInfo(tierKey('station', t))?.bot ?? im.height - 1) + 1) / im.height) * sh;   // 底边（打包时量的最低不透明行）压在桥面下 2px
    // 落在桥面上的一点影子，让设备“站住”而不是浮着
    g.fillStyle = 'rgba(20,12,6,0.28)';
    g.beginPath(); g.ellipse(sx + boxW / 2, D + 4, swx * 0.46, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(im, sx + (boxW - swx) / 2, sy, swx, sh);
    plank(0, gl); plank(gr, PIER_W);
    // 门架：立柱 + 横梁 + 斜撑 + 滑轮
    const py = 14, postX = gr + 10;
    const beam = (x1, y1, x2, y2, w) => { g.strokeStyle = '#4a2e16'; g.lineWidth = w + 1.6; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#8a5a30'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    beam(postX, D - 2, postX, py - 4, 6); beam(postX + 4, py, bx - 12, py, 5); beam(postX, py + 34, postX - 26, py + 2, 3.5);
    g.fillStyle = '#c8402c'; g.beginPath(); g.moveTo(postX, py - 6); g.lineTo(postX + 16, py - 1); g.lineTo(postX, py + 4); g.closePath(); g.fill();   // 小红旗
    // 绞盘绳：小屋右侧绞盘轮 → 滑轮
    g.strokeStyle = rgba('#3a2a1a', 0.95); g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx + (boxW + swx) / 2 * 0.94, sy + sh * 0.5); g.quadraticCurveTo((sx + boxW + bx) / 2, py + 26, bx - 6, py + 2); g.stroke();
    g.fillStyle = '#3a3a44'; g.beginPath(); g.arc(bx, py + 2, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c8b080'; g.beginPath(); g.arc(bx, py + 2, 3.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = line; g.lineWidth = 1.2; g.beginPath(); g.arc(bx, py + 2, 8, 0, Math.PI * 2); g.stroke();
  }));
}
export const PULLEY_DY = PIER_TOP - 16;   // 滑轮中心在桥面上方多少

// 岩障：两堆大石头把整条矿道堵住
export function barrier(w = 680) {
  return memo('bar' + w, () => make(w, 150, (g) => {
    const im = envImg('barrier'), half = w / 2 + 30;
    g.fillStyle = 'rgba(20,16,24,0.55)'; g.fillRect(6, 30, w - 6, 112);
    g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(im, 0, 6, half, 144); g.restore();
    g.drawImage(im, -10, 2, half, 146);
  }));
}
// 铁轨（地表，从站台到仓库）
export function rail(len) {
  return memo('rail' + len, () => make(len, 12, (g) => {
    for (let x = 4; x < len; x += 13) { const gg = g.createLinearGradient(0, 4, 0, 12); gg.addColorStop(0, '#8a5c32'); gg.addColorStop(1, '#4a2e16'); g.fillStyle = gg; g.fillRect(x, 4, 8, 8); }
    for (const y of [3, 8]) { g.fillStyle = '#4a4a56'; g.fillRect(0, y, len, 2.6); g.fillStyle = '#b8bcc8'; g.fillRect(0, y, len, 0.9); }
  }));
}
// 崖顶地面（矢量）：草皮 + 草叶 + 小花，下面一条泥土带（底边起伏、带根须和投影，压在岩壁上）；左端崖口收成圆弧尖角
export function groundStrip(len) {
  return memo('gs' + len, () => make(len, 44, (g) => {
    const r = rng(4401), top = (x) => 9 + Math.sin(x * 0.05) * 1.2 + Math.sin(x * 0.17) * 0.8, bot = (x) => 34 + Math.sin(x * 0.031) * 4 + Math.sin(x * 0.11) * 2;
    const lip = (x) => Math.min(1, x / 16);
    // 底边投影
    g.fillStyle = 'rgba(20,12,6,0.22)'; g.beginPath(); g.moveTo(8, 20); for (let x = 8; x <= len; x += 4) g.lineTo(x, bot(x) + 5 * lip(x)); g.lineTo(len, 20); g.fill();
    // 泥土带
    g.beginPath(); g.moveTo(0, top(0) + 6); for (let x = 0; x <= len; x += 4) g.lineTo(x, top(x) + 3); for (let x = len; x >= 0; x -= 4) g.lineTo(x, top(x) + 3 + (bot(x) - top(x) - 3) * lip(x)); g.closePath();
    const eg = g.createLinearGradient(0, 10, 0, 40); eg.addColorStop(0, '#8a6238'); eg.addColorStop(1, '#5a3a20'); g.fillStyle = eg; g.fill();
    for (let k = 0; k < len / 9; k++) { const x = 6 + r() * (len - 6), y = top(x) + 6 + r() * (bot(x) - top(x) - 8) * lip(x); g.fillStyle = r() < 0.5 ? 'rgba(160,130,96,0.7)' : 'rgba(60,38,20,0.5)'; g.beginPath(); g.ellipse(x, y, 1.6 + r() * 2.4, 1 + r() * 1.4, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(70,46,24,0.8)'; g.lineWidth = 0.8;
    for (let k = 0; k < len / 14; k++) { const x = 10 + r() * (len - 10), y = bot(x) - 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 6, y + 4, x + (r() - 0.5) * 8, y + 4 + r() * 6); g.stroke(); }
    // 草皮
    g.beginPath(); g.moveTo(0, top(0) + 2); for (let x = 0; x <= len; x += 4) g.lineTo(x, top(x)); for (let x = len; x >= 0; x -= 4) g.lineTo(x, top(x) + 6 + Math.sin(x * 0.3) * 1.5); g.closePath();
    const gg = g.createLinearGradient(0, 6, 0, 16); gg.addColorStop(0, '#8cc458'); gg.addColorStop(1, '#4e8a36'); g.fillStyle = gg; g.fill();
    // 草叶
    for (let k = 0; k < len / 2.2; k++) { const x = r() * len, y = top(x) + 2, h = 3 + r() * 5, lean = (r() - 0.4) * 3; g.fillStyle = ['#5e9a3e', '#7ab64c', '#9ad064', '#4a8236'][Math.floor(r() * 4)]; g.beginPath(); g.moveTo(x - 1.2, y); g.lineTo(x + lean, y - h); g.lineTo(x + 1.2, y); g.closePath(); g.fill(); }
    // 小花
    for (let k = 0; k < len / 26; k++) { const x = 8 + r() * (len - 8), y = top(x) - 1 - r() * 3, c = ['#ffffff', '#ffe066', '#ffb0c8', '#c8b0ff'][Math.floor(r() * 4)]; g.fillStyle = c; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.3, 1.1, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y, 0.8, 0, Math.PI * 2); g.fill(); }
    // 草皮上沿一道受光
    g.strokeStyle = 'rgba(220,255,170,0.45)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= len; x += 4) { if (x === 0) g.moveTo(x, top(x) + 0.6); else g.lineTo(x, top(x) + 0.6); } g.stroke();
  }));
}
// 木牌（新矿道 / 岩障）：返回画布，文字由渲染器另外叠加
export function board(w, h, tone = 'wood') {
  return memo(`bd${w}x${h}${tone}`, () => make(w, h + 8, (g) => {
    const base = tone === 'gold' ? '#e8b23a' : tone === 'locked' ? '#8a8078' : '#c89a5a', dark = lerpColor(base, '#000000', 0.35);
    g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, 2, 6, w - 4, h - 4, 7); g.fill();
    g.fillStyle = base; roundRect(g, 2, 2, w - 4, h - 4, 7); g.fill();
    g.fillStyle = rgba('#ffffff', 0.25); roundRect(g, 5, 4, w - 10, (h - 8) * 0.4, 5); g.fill();
    g.strokeStyle = dark; g.lineWidth = 2.5; roundRect(g, 2, 2, w - 4, h - 4, 7); g.stroke();
  }));
}
