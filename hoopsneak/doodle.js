// Hand-drawn doodle primitives with "line boil": every shape is pre-drawn in 3 jittered variants
// that are cycled ~8 times a second.
import * as PIXI from 'pixi.js';

                                                                                                                             
                     
                                                                                                        
                                                 
  

export const THEMES          = [
  { kind: 'lined', bg: 0xf6f0e1, line: 0xaac4e4, margin: 0xe58b8b, ink: 0x1f2a44, hatch: 0x3b6fd8, hatch2: 0x4f9a3e, soft: 0x7d8aa6 },
  { kind: 'grid', bg: 0xeef5e6, line: 0xa9d3a4, margin: 0x7fbf7a, ink: 0x1e3b2a, hatch: 0x3fa34d, hatch2: 0x2f7fc2, soft: 0x6f9a7a },
  { kind: 'dark', bg: 0x1d2b4f, line: 0x2c3d6a, margin: 0x3b4f85, ink: 0xf4f1e8, hatch: 0x8fb3ff, hatch2: 0xffd166, soft: 0x8a97bd },
  { kind: 'sticky', bg: 0xffd9e4, line: 0xf5b1c5, margin: 0xe98aa5, ink: 0x3a2233, hatch: 0xe0527a, hatch2: 0x8f5bd6, soft: 0xb07a90 },
  { kind: 'kraft', bg: 0xd9ba8e, line: 0xc6a274, margin: 0xb08658, ink: 0x3b2414, hatch: 0xc8352c, hatch2: 0x6b4a2a, soft: 0x8a6a48 },
  { kind: 'blueprint', bg: 0x1f5a9e, line: 0x3a78bf, margin: 0x5a93d3, ink: 0xeaf4ff, hatch: 0x9fd0ff, hatch2: 0xffffff, soft: 0x9cc2ea },
  { kind: 'legal', bg: 0xfff3a6, line: 0x9dbad6, margin: 0xe27b7b, ink: 0x1e2a3a, hatch: 0xff4fa3, hatch2: 0x2fcf7a, soft: 0x8a8a6a },
  { kind: 'dots', bg: 0xede3fa, line: 0xb79be0, margin: 0xc8b2ea, ink: 0x2a1747, hatch: 0x9b59d0, hatch2: 0xe86fb0, soft: 0x8a79a8 },
  { kind: 'water', bg: 0xf7f7f2, line: 0xcfe6f5, margin: 0xa8d3ef, ink: 0x25303f, hatch: 0x4ba3e3, hatch2: 0x6cc6b0, soft: 0x8195a8 },
  { kind: 'sketch', bg: 0xeadbb8, line: 0xd8c59b, margin: 0xc9a979, ink: 0x3a2e1f, hatch: 0x3b6fd8, hatch2: 0xe0527a, soft: 0x8f7f60 },
  // notebooks 11-20
  { kind: 'lined', bg: 0xe8f6f3, line: 0x9fd6cc, margin: 0xf28fb2, ink: 0x1d3a3a, hatch: 0xf2549b, hatch2: 0x2aa38f, soft: 0x6e9e98 },
  { kind: 'grid', bg: 0xe6f0ff, line: 0xa9c6ef, margin: 0x7aa7e0, ink: 0x1a2c52, hatch: 0x2f8fe0, hatch2: 0xff8a3d, soft: 0x7189b0 },
  { kind: 'dark', bg: 0x2a1f47, line: 0x3b2e63, margin: 0x5a4591, ink: 0xf4ecff, hatch: 0xc9a2ff, hatch2: 0x7fe0c4, soft: 0x9a8cc4 },
  { kind: 'kraft', bg: 0xe3d3b8, line: 0xccb694, margin: 0xb69a6f, ink: 0x2f2418, hatch: 0xd6452f, hatch2: 0x2d7fbf, soft: 0x8f7a5c },
  { kind: 'dots', bg: 0xfff0dc, line: 0xf3c58f, margin: 0xf0a860, ink: 0x3a2412, hatch: 0xff7a1a, hatch2: 0xe0337a, soft: 0xa27b58 },
  { kind: 'sketch', bg: 0xd9d4cc, line: 0xc4bdb2, margin: 0xa89f92, ink: 0x2b2b2b, hatch: 0x5a5a5a, hatch2: 0xd0392b, soft: 0x7d766c },
  { kind: 'water', bg: 0xf1fbff, line: 0xc6e9f7, margin: 0x94d4ee, ink: 0x1f3244, hatch: 0x3cb4d6, hatch2: 0x9b6fe0, soft: 0x86a4b8 },
  { kind: 'legal', bg: 0xeaf7d4, line: 0xb4d38a, margin: 0xd98a5c, ink: 0x243218, hatch: 0x6aa82f, hatch2: 0xe07a1f, soft: 0x86996a },
  { kind: 'blueprint', bg: 0x14493f, line: 0x25695c, margin: 0x3a8a79, ink: 0xecfff8, hatch: 0x8ff0cf, hatch2: 0xffe27a, soft: 0x8fc4b5 },
  { kind: 'sticky', bg: 0xfff5b8, line: 0xf0dc7c, margin: 0xe6b84a, ink: 0x3a2f14, hatch: 0x3b6fd8, hatch2: 0xe84a5f, soft: 0xa08f52 },
  // notebooks 21-40
  { kind: 'dark', bg: 0x1c1633, line: 0x2c2450, margin: 0x4a3a80, ink: 0xf1ecff, hatch: 0xb79cff, hatch2: 0xffd166, soft: 0x8f86b8 },
  { kind: 'dots', bg: 0xeefaf7, line: 0xa6dcd2, margin: 0x58b8a6, ink: 0x163a36, hatch: 0x14b8a6, hatch2: 0xe84a9a, soft: 0x6f9a94 },
  { kind: 'water', bg: 0xeef8ff, line: 0xbfe2f7, margin: 0x8fcbee, ink: 0x1b3550, hatch: 0x3a9bd8, hatch2: 0x7fd3f0, soft: 0x86a4b8 },
  { kind: 'lined', bg: 0xfff3e6, line: 0xf5c9a0, margin: 0xf08a24, ink: 0x3a2412, hatch: 0xf08a24, hatch2: 0xe84a5f, soft: 0xa27b58 },
  { kind: 'blueprint', bg: 0x23151c, line: 0x3a2430, margin: 0x6a2a3a, ink: 0xfff0f3, hatch: 0xff6b81, hatch2: 0xffd166, soft: 0xb08a96 },
  { kind: 'grid', bg: 0xf1fae6, line: 0xc4e3a8, margin: 0x8fcf5a, ink: 0x22401a, hatch: 0x6aa82f, hatch2: 0x2f7fc2, soft: 0x86996a },
  { kind: 'kraft', bg: 0xe6d6bb, line: 0xcdb894, margin: 0xb69a6f, ink: 0x2f2418, hatch: 0xa0522d, hatch2: 0x3b6fd8, soft: 0x8f7a5c },
  { kind: 'sketch', bg: 0xfdf7e1, line: 0xefe1a8, margin: 0xe6c35a, ink: 0x332a12, hatch: 0xf0a020, hatch2: 0x8f5bd6, soft: 0x9a8a5a },
  { kind: 'dots', bg: 0xe9f7f3, line: 0xa9d9cc, margin: 0x2fb39a, ink: 0x123832, hatch: 0x1f8a76, hatch2: 0xf08a24, soft: 0x6f9a94 },
  { kind: 'legal', bg: 0xf4f4f6, line: 0xd0d3da, margin: 0x9aa0ad, ink: 0x23262e, hatch: 0x5a6070, hatch2: 0xe84a5f, soft: 0x8a8f9c },
  { kind: 'water', bg: 0xeaf4ff, line: 0xbcd6f2, margin: 0x7aa7e0, ink: 0x18304d, hatch: 0x3b9ad9, hatch2: 0x9b6fe0, soft: 0x7189b0 },
  { kind: 'dark', bg: 0x241a3d, line: 0x352a57, margin: 0x5a4591, ink: 0xf4ecff, hatch: 0xc9a2ff, hatch2: 0x7fe0c4, soft: 0x9a8cc4 },
  { kind: 'sticky', bg: 0xfff8c9, line: 0xf2e08a, margin: 0xe6c04a, ink: 0x3a3014, hatch: 0xd4a017, hatch2: 0xe84a5f, soft: 0xa08f52 },
  { kind: 'kraft', bg: 0xdcd3c4, line: 0xc4b9a6, margin: 0xa89f92, ink: 0x2b2b2b, hatch: 0x4a4f5c, hatch2: 0xd0392b, soft: 0x7d766c },
  { kind: 'lined', bg: 0xfff1ec, line: 0xf5c4b8, margin: 0xe8322a, ink: 0x3a1a14, hatch: 0xe8322a, hatch2: 0x3b6fd8, soft: 0xa0766b },
  { kind: 'blueprint', bg: 0x14202e, line: 0x22334a, margin: 0x3a5577, ink: 0xecf5ff, hatch: 0xff4d6d, hatch2: 0x7fd3f0, soft: 0x8fa4bd },
  { kind: 'grid', bg: 0xeef0f4, line: 0xc6ccd8, margin: 0x8a93a8, ink: 0x1f2433, hatch: 0x6b7280, hatch2: 0xf08a24, soft: 0x7d8494 },
  { kind: 'dark', bg: 0x0f1424, line: 0x1c2440, margin: 0x2e3a66, ink: 0xf6f2e2, hatch: 0xf2d16b, hatch2: 0x8fb3ff, soft: 0x8a93b8 },
  { kind: 'sketch', bg: 0xe4e0d8, line: 0xcdc6ba, margin: 0x9a9284, ink: 0x22201c, hatch: 0x4a4f5c, hatch2: 0x2fb39a, soft: 0x7d766c },
  { kind: 'lined', bg: 0xf7f1e3, line: 0xb9cde8, margin: 0xe58b8b, ink: 0x1f2a44, hatch: 0xe8322a, hatch2: 0x8f5bd6, soft: 0x7d8aa6 },
];

export function mulberry(seed        ) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

;                            
const J = (r   , a        ) => (r() - 0.5) * 2 * a;

/** polyline through pts with jitter; closed adds a small overshoot like a hand closing a loop */
export function jpath(g               , pts          , r   , amp = 1.3, seg = 16, closed = false) {
  const out           = [];
  const n = pts.length / 2;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const j = (i + 1) % n;
    const x2 = pts[j * 2], y2 = pts[j * 2 + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.max(1, Math.ceil(len / seg));
    const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
    for (let s = 0; s < k; s++) {
      const t = s / k;
      const o = s === 0 ? J(r, amp * 0.6) : J(r, amp);
      out.push(x1 + (x2 - x1) * t + nx * o + J(r, amp * 0.3), y1 + (y2 - y1) * t + ny * o + J(r, amp * 0.3));
    }
  }
  if (closed) {
    // overshoot past the start
    const x0 = pts[0], y0 = pts[1], x1 = pts[2], y1 = pts[3];
    out.push(x0 + J(r, amp), y0 + J(r, amp));
    out.push(x0 + (x1 - x0) * 0.08 + J(r, amp), y0 + (y1 - y0) * 0.08 + J(r, amp));
  } else {
    out.push(pts[pts.length - 2] + J(r, amp * 0.6), pts[pts.length - 1] + J(r, amp * 0.6));
  }
  g.moveTo(out[0], out[1]);
  for (let i = 2; i < out.length; i += 2) g.lineTo(out[i], out[i + 1]);
  return g;
}

export function stroke(g               , color        , width = 3, alpha = 1) {
  g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
}

export function jrect(g               , x        , y        , w        , h        , r   , color        , width = 3, amp = 1.3) {
  jpath(g, [x, y, x + w, y, x + w, y + h, x, y + h], r, amp, 18, true);
  stroke(g, color, width);
}

export function jcircle(g               , cx        , cy        , rad        , r   , color        , width = 3, amp = 1.2) {
  const n = Math.max(14, Math.round(rad * 0.9));
  const a0 = r() * Math.PI * 2;
  const pts           = [];
  for (let i = 0; i <= n + 1; i++) {
    const a = a0 + (i / n) * Math.PI * 2 * 1.04;
    const rr = rad + J(r, amp);
    pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  stroke(g, color, width);
}

/** coloured-pencil hatching inside a rect */
export function hatchRect(g               , x        , y        , w        , h        , r   , color        , spacing = 7, width = 2.4, alpha = 0.8) {
  const k = 0.75; // slope (dy per dx)
  // lines y = -k*(X - c) + y+h  → iterate c
  for (let c = -h / k; c < w + 2; c += spacing + J(r, 1.2)) {
    // param along line: X from c to c + h/k, Y from y+h to y
    let x1 = x + c, y1 = y + h, x2 = x + c + h / k, y2 = y;
    // clip against x range
    if (x1 < x) { y1 = y + h - (x - x1) * k; x1 = x; }
    if (x2 > x + w) { y2 = y + (x2 - (x + w)) * k; x2 = x + w; }
    if (y1 < y || y2 > y + h || x1 > x2) continue;
    g.moveTo(x1 + J(r, 1.5), y1 + J(r, 1.5)).lineTo(x2 + J(r, 1.5), y2 + J(r, 1.5));
  }
  g.stroke({ color, width, alpha, cap: 'round' });
}

export function hatchCircle(g               , cx        , cy        , rad        , r   , color        , spacing = 6, width = 2.2, alpha = 0.85) {
  const dx = 0.8, dy = -0.6; // line direction
  const px = 0.6, py = 0.8; // perpendicular
  for (let o = -rad + 2; o < rad - 1; o += spacing + J(r, 1)) {
    const hl = Math.sqrt(Math.max(0, rad * rad - o * o)) * 0.92;
    const mx = cx + px * o, my = cy + py * o;
    g.moveTo(mx - dx * hl + J(r, 1.2), my - dy * hl + J(r, 1.2)).lineTo(mx + dx * hl + J(r, 1.2), my + dy * hl + J(r, 1.2));
  }
  g.stroke({ color, width, alpha, cap: 'round' });
}

// ── boil registry ──
const boils         = [];
let boilFrame = 0;
export class Boil extends PIXI.Container {
  vars                  = [];
  constructor(draw                                             , seed = 1, n = 3) {
    super();
    for (let v = 0; v < n; v++) {
      const g = new PIXI.Graphics();
      draw(g, mulberry(seed * 977 + v * 131 + 7), v);
      g.visible = v === boilFrame % n;
      this.vars.push(g);
      this.addChild(g);
    }
    boils.push(this);
  }
}
export function boilTick(frame        ) {
  boilFrame = frame;
  for (let i = boils.length - 1; i >= 0; i--) {
    const b = boils[i];
    if (b.destroyed) { boils.splice(i, 1); continue; }
    const n = b.vars.length;
    for (let v = 0; v < n; v++) b.vars[v].visible = v === frame % n;
  }
}

/** Paper background for a theme, covering (x,y,w,h) in the given container space. */
export function drawPaper(g               , th       , x        , y        , w        , h        , seed = 3, marginX = 90) {
  const r = mulberry(seed);
  g.rect(x, y, w, h).fill(th.bg);
  const k = th.kind;
  if (k === 'lined' || k === 'legal' || k === 'sticky' || k === 'sketch' || k === 'kraft') {
    if (k !== 'kraft' && k !== 'sketch') {
      for (let yy = 30 + Math.ceil((y - 30) / 32) * 32; yy < y + h; yy += 32) g.moveTo(x, yy).lineTo(x + w, yy);
      g.stroke({ color: th.line, width: 1.6, alpha: k === 'sticky' ? 0.5 : 0.8 });
    }
    if (k === 'lined' || k === 'legal') {
      g.moveTo(marginX, y).lineTo(marginX, y + h);
      if (k === 'legal') g.moveTo(marginX + 6, y).lineTo(marginX + 6, y + h);
      g.stroke({ color: th.margin, width: 1.8, alpha: 0.85 });
    }
    if (k === 'kraft' || k === 'sketch') {
      // paper fibres / speckles
      for (let i = 0; i < w * h / 900; i++) {
        const px = x + r() * w, py = y + r() * h, l = 2 + r() * 8, a = r() * Math.PI;
        g.moveTo(px, py).lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      }
      g.stroke({ color: th.line, width: 1.2, alpha: 0.7 });
    }
  } else if (k === 'grid' || k === 'blueprint' || k === 'dark') {
    const s = k === 'dark' ? 64 : 40;
    for (let xx = Math.ceil(x / s) * s; xx < x + w; xx += s) g.moveTo(xx, y).lineTo(xx, y + h);
    for (let yy = Math.ceil(y / s) * s; yy < y + h; yy += s) g.moveTo(x, yy).lineTo(x + w, yy);
    g.stroke({ color: th.line, width: k === 'blueprint' ? 1.4 : 1.2, alpha: 0.9 });
    if (k === 'blueprint') {
      for (let xx = Math.ceil(x / 200) * 200; xx < x + w; xx += 200) g.moveTo(xx, y).lineTo(xx, y + h);
      for (let yy = Math.ceil(y / 200) * 200; yy < y + h; yy += 200) g.moveTo(x, yy).lineTo(x + w, yy);
      g.stroke({ color: th.margin, width: 2.2, alpha: 0.9 });
    }
    if (k === 'dark') {
      for (let i = 0; i < w * h / 6000; i++) g.circle(x + r() * w, y + r() * h, 0.8 + r() * 1.4);
      g.fill({ color: 0xffffff, alpha: 0.35 });
    }
  } else if (k === 'dots') {
    for (let xx = Math.ceil(x / 32) * 32; xx < x + w; xx += 32) for (let yy = Math.ceil(y / 32) * 32; yy < y + h; yy += 32) g.circle(xx, yy, 2);
    g.fill({ color: th.line, alpha: 0.9 });
    for (let i = 0; i < w * h / 5000; i++) g.circle(x + r() * w, y + r() * h, 1 + r() * 1.5);
    g.fill({ color: 0xffffff, alpha: 0.8 });
  } else if (k === 'water') {
    const cols = [0xa8d3ef, 0xbfe3d8, 0xd6e8f7];
    for (let i = 0; i < 9; i++) {
      const cx = x + r() * w, cy = y + r() * h, rad = 90 + r() * 200;
      g.circle(cx, cy, rad).fill({ color: cols[i % 3], alpha: 0.28 });
      g.circle(cx + J(r, 40), cy + J(r, 40), rad * 0.7).fill({ color: cols[(i + 1) % 3], alpha: 0.22 });
    }
  }
}

export function coffeeStain(g               , cx        , cy        , rad        , seed = 5) {
  const r = mulberry(seed);
  for (let k = 0; k < 3; k++) {
    const pts           = [];
    const rr = rad - k * 3;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      pts.push(cx + Math.cos(a) * (rr + J(r, 3)), cy + Math.sin(a) * (rr + J(r, 3)));
    }
    g.poly(pts, false).stroke({ color: 0xa87a45, width: 5 - k * 1.5, alpha: 0.28 });
  }
  for (let i = 0; i < 6; i++) g.circle(cx + J(r, rad * 1.5), cy + J(r, rad * 1.5), 2 + r() * 5);
  g.fill({ color: 0xa87a45, alpha: 0.25 });
}
