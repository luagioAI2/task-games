// Monster collision shapes traced from the sprite's real silhouette (alpha channel).
import * as PIXI from 'pixi.js';

const RAYS = 72;          // angular resolution of the outline
const SAMPLE = 160;       // texture is sampled at SAMPLE×SAMPLE
const ALPHA_MIN = 90;     // pixels below this alpha count as empty (soft glow / shadows)

/** Radial outline in texture pixels: radius per ray around the texture centre. */
const cache = new Map                         ();

function trace(tex              )                  {
  const res = (tex.source       )?.resource                                 ;
  if (!res || tex.width < 2) return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SAMPLE;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(res, 0, 0, SAMPLE, SAMPLE);
    const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    const c = SAMPLE / 2, maxR = SAMPLE * 0.71;
    const out           = [];
    for (let k = 0; k < RAYS; k++) {
      const ang = (k / RAYS) * Math.PI * 2;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      let last = 0;
      for (let r = 0; r < maxR; r += 0.5) {
        const x = Math.round(c + ux * r), y = Math.round(c + uy * r);
        if (x < 0 || y < 0 || x >= SAMPLE || y >= SAMPLE) break;
        if (data[(y * SAMPLE + x) * 4 + 3] >= ALPHA_MIN) last = r;
      }
      out.push(last);
    }
    // median-of-3 removes single-ray whiskers (hair strands, sparkles) but keeps real corners
    const sm = out.map((v, i) => {
      const a = out[(i + RAYS - 1) % RAYS], b = out[(i + 1) % RAYS];
      return [a, v, b].sort((p, q) => p - q)[1];
    });
    if (Math.max(...sm) < 4) return null;
    const scale = tex.width / SAMPLE;
    return sm.map(v => v * scale);
  } catch { return null; }
}

/** World-space outline points (relative to the sprite centre) for a sprite drawn at `spriteScale`. */
export function monsterShape(url        , tex              , spriteScale        , fallbackR        )           {
  if (!cache.has(url)) cache.set(url, trace(tex));
  const radii = cache.get(url);
  const pts           = [];
  for (let k = 0; k < RAYS; k++) {
    const ang = (k / RAYS) * Math.PI * 2;
    const r = radii ? Math.max(fallbackR * 0.35, radii[k] * spriteScale) : fallbackR;
    pts.push(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  return pts;
}

;                                                                          

/**
 * Circle (local centre qx,qy, radius R) vs closed outline. Returns the push-out position
 * (local) and outward normal when they overlap, else null.
 */
export function circleVsShape(pts          , maxR        , qx        , qy        , R        )                 {
  const q2 = qx * qx + qy * qy;
  if (q2 > (maxR + R) * (maxR + R)) return null;
  const n = pts.length / 2;
  let best = Infinity, cx = 0, cy = 0, inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ax = pts[j * 2], ay = pts[j * 2 + 1], bx = pts[i * 2], by = pts[i * 2 + 1];
    // point-in-polygon (even-odd)
    if ((ay > qy) !== (by > qy) && qx < ((bx - ax) * (qy - ay)) / (by - ay) + ax) inside = !inside;
    const ex = bx - ax, ey = by - ay;
    const L = ex * ex + ey * ey || 1;
    let tt = ((qx - ax) * ex + (qy - ay) * ey) / L;
    tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
    const px = ax + ex * tt, py = ay + ey * tt;
    const d2 = (qx - px) * (qx - px) + (qy - py) * (qy - py);
    if (d2 < best) { best = d2; cx = px; cy = py; }
  }
  const d = Math.sqrt(best);
  if (!inside && d >= R) return null;
  let nx        , ny        ;
  if (d < 1e-4) { const m = Math.sqrt(q2) || 1; nx = qx / m; ny = qy / m; }
  else if (inside) { nx = (cx - qx) / d; ny = (cy - qy) / d; }
  else { nx = (qx - cx) / d; ny = (qy - cy) / d; }
  return { nx, ny, px: cx + nx * R, py: cy + ny * R };
}

export function shapeMaxR(pts          ) {
  let m = 0;
  for (let i = 0; i < pts.length; i += 2) m = Math.max(m, Math.hypot(pts[i], pts[i + 1]));
  return m;
}
