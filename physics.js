// Pure, deterministic 2D sim for 上课偷偷投个篮 — shared by the game and the offline solver.
// Units: grid cells (1 cell = 40 logical px), y grows downward, seconds.

export const G = 18;
export const BALL_R = 0.42;
export const DT = 1 / 120;
// One shared power range for every level (uniform shot feel). Power 0..1 maps linearly onto it.
export const VMIN = 2;
export const VMAX = 38;
export const RIM_HALF = 1.2;
export const RIM_R = 0.12;
export const SPRING_V = 20;
export const BELT_V = 6;
export const BOMB_R = 3;
export const MAG_R = 4.5;
export const MAG_K = 32;
export const FAN_F = 30;
export const MAX_T = 8; // legacy; no longer used as a miss rule
// A shot ends when the ball leaves the page, or has not moved more than SLOW_DIST cells for SLOW_FRAMES steps.
export const SLOW_DIST = 0.35;
export const SLOW_FRAMES = 120;
export const STAR_R = 0.8; // pickup radius (cells) for trajectory stars
export const BLOB_KO_V = 7; // impact speed (cells/s) needed to knock the shooter out; slower hits just bump
export const BUMP_V = 15;
export const GLASS_V = 9;
export const CANNON_V = 17;
export const CANNON_HOLD = 0.45;
export const BUBBLE_T = 2.0;
export const BUBBLE_UP = 3.2;
export const BOOST_V = 13; // directional boost ring kick (cells/s)
export const HOLE_R = 5; export const HOLE_K = 40; export const WHITE_R = 4.5; export const WHITE_K = 36;
export const VORTEX_R = 3; export const VORTEX_K = 42; // whirlwind radius (cells) and swirl strength
export const PAINT_COLS = [0xe84a5f, 0x3b9ad9, 0x4fb83a]; // red / blue / green paint + gates

                                             // dx, dy, period seconds
// br = bomb-breakable brick, rb = rubber, dr = door (opened by a button), gl = glass, ow = one-way (solid from its top side only), rot = spin deg/s
// notebooks 21+: ic = ice (frictionless), sg = sponge (dead bounce), gu = glue (stops the ball), lz = laser (touch = miss),
// cr = crumbles after one bounce, hp = breaks after N hits, bl = blinks [period s, on-fraction, phase s] (solid only while on)
                                                                                                                                                                                                                                                                                     
                    
                                                                 
                                                            
                                                     
                                       
                                         
                                                                         
                                                               
                                                                                        
                                                              
                                                             
                                                                 
                                         
                                                                
                                         
                                                                                                               
                                                                                                       
                                                                                                                                 
                                                                                                                                                       
                                                                                                             
                                                                     
                                                                                                                                         
                                                                                                                     
                                                                                                                            
                                                                               // whirlwind: swirls the ball around (d=1 counter-clockwise on screen, -1 clockwise) and flings it out

                        
                                                      
                      
                                   
                                         
                                                       
                           
               
               
                        
                                                                                                                            
  

                   
                                                                                                                                                                                                                   
                                                                         
                                                                                                       
                                                                
                                        
                                                                                        
                                                   
                                                             
                                                
             
  
                                                                                                                                                                                                                                                                                                 
                                                                                                                         
                                                                                                                                      
                                                                                                                                                                                                            
                                                                                                          
                                                                                                          
                                                                                                                                                                                                                                                                                                                                                                                                                                  

const D2R = Math.PI / 180;

export function launchPoint(lv          )                   {
  return [lv.p[0] + lv.f * 0.6, lv.p[1] - 1.25];
}
export function launchVel(lv          , power        )                   {
  const [a, b] = lv.sp || [VMIN, VMAX];
  const v = a + (b - a) * Math.max(0, Math.min(1, power));
  const r = lv.a * D2R;
  return [Math.cos(r) * v * lv.f, -Math.sin(r) * v];
}

function pathOff(m                  , t        )                                   {
  if (!m) return [0, 0, 0, 0];
  const w = (2 * Math.PI) / m[2];
  const k = 0.5 - 0.5 * Math.cos(w * t);
  const dk = 0.5 * w * Math.sin(w * t);
  return [m[0] * k, m[1] * k, m[0] * dk, m[1] * dk];
}

export class Sim {
  lv          ;
  boxes        = [];
  circs         = [];
  zones         = [];
  portals           = [];
  cannons           = [];
  warps         = [];
  gsign = 1; // gravity direction (flip orbs)
  ballCol = -1; // paint colour of the ball (-1 = clean)
  inside = new Set        (); // sensor circles the ball is currently inside
  hold = -1; holdT = 0; cannonCd = 0; cannonLast = -1;
  bubbled = false; bubbleT = 0; hitThisStep = false; wasWet = false;
  hoop = { x: 0, y: 0, bx: 0, by: 0, vx: 0, vy: 0 };
  stars                                                       = [];
  starsGot = 0;
  bx = 0; by = 0; vx = 0; vy = 0;
  t = 0;
  flying = false;
  state                                   = 'aim';
  stall = 0;
  ax = 0; ay = 0; // slow-movement anchor
  blobArmed = false; // becomes true once the ball has left the shooter
  blobBumpT = -1;
  wasAbove = false;
  portalLock = -1; portalCd = 0;
  events             = [];
  pendingBombs           = [];
  touched = new Set        ();

  constructor(lv          ) {
    this.lv = lv;
    let id = 0;
    this.stars = (lv.st || []).map(([x, y], k) => ({ x, y, id: 1000 + k, got: false }));
    const addBox = (kind             , x        , y        , w        , h        , a = 0, m       )      => {
      const b      = { kind, bx: x + w / 2, by: y + h / 2, cx: x + w / 2, cy: y + h / 2, hw: w / 2, hh: h / 2, ang: a, cos: Math.cos(a * D2R), sin: Math.sin(a * D2R), vx: 0, vy: 0, m, alive: true, id: id++ };
      this.boxes.push(b);
      return b;
    };
    for (const w of lv.w) {
      if (Array.isArray(w)) addBox('wall', w[0], w[1], w[2], w[3]);
      else {
        const kind              = w.br ? 'brick' : w.rb ? 'rubber' : w.dr ? 'door' : w.gl ? 'glass' : w.ow ? 'oneway' : w.rot ? 'paddle'
          : w.ic ? 'ice' : w.sg ? 'sponge' : w.gu ? 'glue' : w.lz ? 'laser' : w.cr ? 'crumble' : w.hp ? 'hpblock' : w.cg !== undefined ? 'gate' : 'wall';
        const b = addBox(kind, w.x, w.y, w.w, w.h, w.a || 0, w.m);
        if (w.rot) { b.rot = w.rot; b.a0 = w.a || 0; }
        if (w.bl) b.bl = w.bl;
        if (w.hp) { b.hp = b.hp0 = w.hp; b.hitCd = 0; }
        if (w.cg !== undefined) b.col = w.cg;
      }
    }
    // hoop
    this.hoop.bx = this.hoop.x = lv.h[0];
    this.hoop.by = this.hoop.y = lv.h[1];
    this.circs.push({ kind: 'rim', x: 0, y: 0, r: RIM_R, alive: true, id: id++, side: -1, vx: 0, vy: 0 });
    this.circs.push({ kind: 'rim', x: 0, y: 0, r: RIM_R, alive: true, id: id++, side: 1, vx: 0, vy: 0 });
    // the shooter itself: the ball can come back and bonk it (one hit, then it is knocked out of the way)
    this.circs.push({ kind: 'blob', x: lv.p[0], y: lv.p[1] - 0.65, r: 0.62, alive: true, id: id++, vx: 0, vy: 0 });
    const hb = lv.hb === undefined ? lv.f : lv.hb;
    if (hb) {
      const b = addBox('board', lv.h[0] + hb * (RIM_HALF + 0.25) - 0.12, lv.h[1] - 2.0, 0.24, 2.5, 0, lv.hm);
      b.attached = -2;
    }
    for (const o of lv.o || []) {
      if (o.t === 'spring') {
        const a = o.a || 0; // 0 = up; rotate the box about its centre
        const b = addBox('spring', o.x - 0.65, o.y - 0.25, 1.3, 0.5, a);
        b.sv = o.v || SPRING_V;
      } else if (o.t === 'vac') {
        this.zones.push({ kind: 'vac', cx: o.x + o.w / 2, cy: o.y + o.h / 2, hw: o.w / 2, hh: o.h / 2, cos: 1, sin: 0, fx: 0, fy: 0, id: id++ });
      } else if (o.t === 'balloon') {
        const c       = { kind: 'balloon', x: o.x, y: o.y, r: 0.6, alive: true, id: id++, vx: 0, vy: 0 };
        if (o.crate) {
          const b = addBox('crate', o.x - 0.55, o.y + 1.35, 1.1, 1.1);
          b.attached = c.id;
          c.crate = b.id;
        }
        this.circs.push(c);
      } else if (o.t === 'bomb') {
        this.circs.push({ kind: 'bomb', x: o.x, y: o.y, r: 0.55, alive: true, id: id++, vx: 0, vy: 0 });
      } else if (o.t === 'magnet') {
        this.circs.push({ kind: 'magnet', x: o.x, y: o.y, r: 0.55, alive: true, id: id++, vx: 0, vy: 0 });
      } else if (o.t === 'belt') {
        const b = addBox('belt', o.x, o.y, o.w, 0.6, o.a || 0);
        b.dir = o.d;
      } else if (o.t === 'portal') {
        const r = o.a * D2R;
        this.portals.push({ x: o.x, y: o.y, dx: Math.cos(r), dy: Math.sin(r), c: o.c, id: id++, ang: o.a });
      } else if (o.t === 'fan') {
        const r = o.a * D2R;
        const dx = Math.cos(r), dy = Math.sin(r);
        const wid = o.wid || 2;
        addBox('fanbody', o.x - 0.35, o.y - 0.75, 0.7, 1.5, o.a);
        const f = o.f || FAN_F;
        this.zones.push({ kind: 'fan', cx: o.x + dx * (0.4 + o.len / 2), cy: o.y + dy * (0.4 + o.len / 2), hw: o.len / 2, hh: wid / 2, cos: dx, sin: dy, fx: dx * f, fy: dy * f, id: id++ });
      } else if (o.t === 'water' || o.t === 'anti') {
        this.zones.push({ kind: o.t, cx: o.x + o.w / 2, cy: o.y + o.h / 2, hw: o.w / 2, hh: o.h / 2, cos: 1, sin: 0, fx: 0, fy: 0, id: id++ });
      } else if (o.t === 'button') {
        { const bw = o.w || 1.2; addBox('button', o.x - bw / 2, o.y - 0.2, bw, 0.4, o.a || 0); }
      } else if (o.t === 'bumper') {
        this.circs.push({ kind: 'bumper', x: o.x, y: o.y, r: 0.55, alive: true, id: id++, vx: 0, vy: 0 });
      } else if (o.t === 'bubble') {
        this.circs.push({ kind: 'bubble', x: o.x, y: o.y, r: 0.6, alive: true, id: id++, vx: 0, vy: 0 });
      } else if (o.t === 'hole' || o.t === 'white') {
        this.circs.push({ kind: o.t, x: o.x, y: o.y, r: o.t === 'hole' ? 0.35 : 0.5, alive: true, id: id++, vx: 0, vy: 0, pr: o.r || (o.t === 'hole' ? HOLE_R : WHITE_R), k: o.k || (o.t === 'hole' ? HOLE_K : WHITE_K) });
      } else if (o.t === 'ring' || o.t === 'arrow' || o.t === 'flip') {
        this.circs.push({ kind: o.t, x: o.x, y: o.y, r: 0.7, alive: true, id: id++, vx: 0, vy: 0, k: o.t === 'ring' ? o.k : undefined, a: o.a });
      } else if (o.t === 'paint') {
        this.circs.push({ kind: 'paint', x: o.x, y: o.y, r: 0.6, alive: true, id: id++, vx: 0, vy: 0, a: o.c });
      } else if (o.t === 'vortex') {
        this.circs.push({ kind: 'vortex', x: o.x, y: o.y, r: 0.3, alive: true, id: id++, vx: 0, vy: 0, pr: o.r || VORTEX_R, k: o.k || VORTEX_K, a: o.d || 1 });
      } else if (o.t === 'pend') {
        this.circs.push({ kind: 'pend', x: o.x, y: o.y + o.len, r: 0.7, alive: true, id: id++, vx: 0, vy: 0, px: o.x, py: o.y, len: o.len, amp: o.amp, per: o.per, ph: o.ph || 0 });
      } else if (o.t === 'warp') {
        const r = o.a * D2R;
        this.warps.push({ ax: o.x, ay: o.y, bx: o.x2, by: o.y2, len: o.len, cos: Math.cos(r), sin: Math.sin(r), ang: o.a, id: id++ });
      } else if (o.t === 'gz') {
        const r = o.a * D2R;
        this.zones.push({ kind: 'gz', cx: o.x + o.w / 2, cy: o.y + o.h / 2, hw: o.w / 2, hh: o.h / 2, cos: 1, sin: 0, fx: Math.cos(r) * G * o.m, fy: Math.sin(r) * G * o.m, m: o.m, ga: o.a, id: id++ });
      } else if (o.t === 'cannon') {
        const r = o.a * D2R;
        this.cannons.push({ x: o.x, y: o.y, dx: Math.cos(r), dy: Math.sin(r), v: o.v || CANNON_V, ang: o.a, id: id++ });
      }
    }
    this.placeRim();
    this.reset();
  }

  placeRim() {
    for (const c of this.circs) if (c.kind === 'rim') { c.x = this.hoop.x + c.side  * RIM_HALF; c.y = this.hoop.y; c.vx = this.hoop.vx; c.vy = this.hoop.vy; }
  }

  reset() {
    const [x, y] = launchPoint(this.lv);
    this.bx = x; this.by = y; this.vx = 0; this.vy = 0;
    this.state = 'aim';
    this.t = 0;
    this.moveKinematics(0);
  }

  launch(power        ) {
    const [vx, vy] = launchVel(this.lv, power);
    this.vx = vx; this.vy = vy;
    this.state = 'fly';
    for (const s of this.stars) s.got = false; this.starsGot = 0;
    this.t = 0; this.stall = 0; this.ax = this.bx; this.ay = this.by; this.blobArmed = false; this.blobBumpT = -1; this.wasAbove = false; this.portalLock = -1; this.portalCd = 0;
    this.hold = -1; this.holdT = 0; this.cannonCd = 0; this.cannonLast = -1; this.bubbled = false; this.bubbleT = 0; this.wasWet = false;
    this.gsign = 1; this.inside.clear(); this.ballCol = -1;
  }

  /** blinking walls/lasers are solid only during the "on" part of their cycle (clock starts at the shot) */
  blinkOn(b     , t = this.t) {
    if (!b.bl) return true;
    const [per, on, ph] = b.bl;
    const k = (((t + ph) % per) + per) % per;
    return k < per * on;
  }

  pressButton(b     ) {
    if (!b.alive || b.falling) return;
    b.falling = true; // reuse flag: pressed
    this.touched.add('button');
    this.events.push({ type: 'button', x: b.cx, y: b.cy, id: b.id });
    for (const d of this.boxes) if (d.kind === 'door' && d.alive) { d.alive = false; this.events.push({ type: 'crate', x: d.cx, y: d.cy, id: d.id }); }
  }

  moveKinematics(t        ) {
    for (const b of this.boxes) {
      if (!b.m) continue;
      const [ox, oy, vx, vy] = pathOff(b.m, t);
      b.cx = b.bx + ox; b.cy = b.by + oy; b.vx = vx; b.vy = vy;
    }
    for (const b of this.boxes) {
      if (!b.rot) continue;
      b.ang = b.a0  + b.rot * t;
      b.cos = Math.cos(b.ang * D2R); b.sin = Math.sin(b.ang * D2R);
    }
    for (const c of this.circs) {
      if (c.kind !== 'pend') continue;
      const w = (2 * Math.PI) / c.per ;
      const th = c.amp  * D2R * Math.sin(w * t + c.ph );
      const dth = c.amp  * D2R * w * Math.cos(w * t + c.ph );
      c.x = c.px  + Math.sin(th) * c.len ; c.y = c.py  + Math.cos(th) * c.len ;
      c.vx = Math.cos(th) * c.len  * dth; c.vy = -Math.sin(th) * c.len  * dth;
    }
    const [ox, oy, vx, vy] = pathOff(this.lv.hm, t);
    this.hoop.x = this.hoop.bx + ox; this.hoop.y = this.hoop.by + oy; this.hoop.vx = vx; this.hoop.vy = vy;
    this.placeRim();
  }

  inZone(z      , x        , y        ) {
    const dx = x - z.cx, dy = y - z.cy;
    const lx = dx * z.cos + dy * z.sin, ly = -dx * z.sin + dy * z.cos;
    return Math.abs(lx) <= z.hw && Math.abs(ly) <= z.hh;
  }

  explode(c      , cn                   ) {
    if (!c.alive) return;
    c.alive = false;
    this.events.push({ type: 'bomb', x: c.x, y: c.y, id: c.id });
    this.touched.add('bomb');
    const dx = this.bx - c.x, dy = this.by - c.y;
    const d = Math.hypot(dx, dy);
    if (d < BOMB_R && this.state === 'fly') {
      // blast is biased upward ("bomb jump") so it can be used as a launcher
      const k = 16 * (1 - d / BOMB_R) + 6;
      let nx = cn ? cn[0] : (d > 1e-4 ? dx / d : 0), ny = (cn ? cn[1] : (d > 1e-4 ? dy / d : -1)) - 2;
      const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      if (this.vy > 0) this.vy *= 0.3;
      this.vx += nx * k; this.vy += ny * k;
    }
    for (const b of this.boxes) {
      if (!b.alive || (b.kind !== 'brick' && b.kind !== 'crate' && b.kind !== 'glass')) continue;
      const ex = Math.abs(b.hw * b.cos) + Math.abs(b.hh * b.sin), ey = Math.abs(b.hw * b.sin) + Math.abs(b.hh * b.cos);
      const qx = Math.max(b.cx - ex, Math.min(b.cx + ex, c.x)), qy = Math.max(b.cy - ey, Math.min(b.cy + ey, c.y));
      if (Math.hypot(qx - c.x, qy - c.y) < BOMB_R) { b.alive = false; this.events.push({ type: 'crate', x: b.cx, y: b.cy, id: b.id }); }
    }
    for (const o of this.circs) if (o.alive && (o.kind === 'bomb' || o.kind === 'balloon') && Math.hypot(o.x - c.x, o.y - c.y) < BOMB_R) {
      if (o.kind === 'bomb') this.pendingBombs.push(o.id); else this.popBalloon(o);
    }
  }

  popBalloon(c      ) {
    c.alive = false;
    this.events.push({ type: 'pop', x: c.x, y: c.y, id: c.id });
    this.touched.add('balloon');
    if (c.crate !== undefined) {
      const b = this.boxes.find(q => q.id === c.crate);
      if (b && b.alive) { b.falling = true; b.attached = undefined; }
    }
  }

  stepCrates() {
    for (const b of this.boxes) {
      if (b.kind !== 'crate' || !b.falling || !b.alive) continue;
      b.vy += G * DT;
      b.cy += b.vy * DT;
      if (b.cy > 22) { b.alive = false; continue; }
      for (const o of this.boxes) {
        if (o === b || !o.alive || o.kind === 'board') continue;
        if (o.kind === 'crate' && o.falling) continue;
        // AABB of o
        const ex = Math.abs(o.hw * o.cos) + Math.abs(o.hh * o.sin);
        const ey = Math.abs(o.hw * o.sin) + Math.abs(o.hh * o.cos);
        if (Math.abs(b.cx - o.cx) < b.hw + ex - 0.05 && Math.abs(b.cy - o.cy) < b.hh + ey && b.cy < o.cy) {
          b.cy = o.cy - ey - b.hh; b.vy = 0; b.falling = false;
          this.events.push({ type: 'bounce', x: b.cx, y: b.cy + b.hh, s: 6 });
          break;
        }
      }
      b.bx = b.cx; b.by = b.cy;
    }
    for (const b of this.boxes) if (b.kind === 'crate' && !b.falling) b.vy = 0;
  }

  step() {
    this.events.length = 0;
    if (this.state === 'aim') return;
    this.t += DT;
    this.moveKinematics(this.t);
    this.stepCrates();
    while (this.pendingBombs.length) {
      const id = this.pendingBombs.shift();
      const c = this.circs.find(q => q.id === id);
      if (c) this.explode(c);
    }
    const scored = this.state === 'score';
    // cannon: hold the ball inside the barrel, then fire
    if (this.cannonCd > 0) this.cannonCd -= DT;
    if (this.hold >= 0) {
      const cn = this.cannons[this.hold];
      this.holdT += DT;
      this.bx = cn.x; this.by = cn.y; this.vx = 0; this.vy = 0;
      if (this.holdT >= CANNON_HOLD) {
        this.bx = cn.x + cn.dx * 0.9; this.by = cn.y + cn.dy * 0.9;
        this.vx = cn.dx * cn.v; this.vy = cn.dy * cn.v;
        this.events.push({ type: 'cannon', x: cn.x, y: cn.y, id: cn.id });
        this.cannonLast = this.hold; this.cannonCd = 0.35; this.hold = -1; this.ax = this.bx; this.ay = this.by; this.stall = 0;
      }
      return;
    }
    if (this.state === 'fly') {
      for (let i = 0; i < this.cannons.length; i++) {
        const cn = this.cannons[i];
        if (i === this.cannonLast && this.cannonCd > 0) continue;
        if (Math.hypot(this.bx - cn.x, this.by - cn.y) < 0.9) {
          this.hold = i; this.holdT = 0; this.bubbled = false;
          this.touched.add('cannon');
          this.events.push({ type: 'load', x: cn.x, y: cn.y, id: cn.id });
          return;
        }
      }
    }
    // forces
    let gx = 0, gy = G * this.gsign;
    let wet = false;
    for (const z of this.zones) {
      if (!this.inZone(z, this.bx, this.by)) continue;
      if (z.kind === 'gz') { gx = z.fx; gy = z.fy; this.touched.add(z.m  < 0.6 ? 'moon' : z.m  > 1.5 ? 'heavy' : 'gz'); break; }
      if (z.kind === 'vac') { gx = 0; gy = 0; this.touched.add('vac'); break; }
      if (z.kind === 'anti') { gx = 0; gy = -G; this.touched.add('anti'); break; }
      if (z.kind === 'water') { gy = G * 0.3; wet = true; this.touched.add('water'); break; }
    }
    if (wet) { const k = Math.exp(-3.2 * DT); this.vx *= k; this.vy *= k; }
    if (wet !== this.wasWet) { this.wasWet = wet; if (Math.hypot(this.vx, this.vy) > 2) this.events.push({ type: 'splash', x: this.bx, y: this.by }); }
    if (this.bubbled) {
      this.bubbleT += DT;
      gx = 0; gy = 0;
      this.vx *= Math.exp(-0.8 * DT);
      this.vy += (-BUBBLE_UP - this.vy) * Math.min(1, 6 * DT);
      if (this.bubbleT >= BUBBLE_T) this.popBubble();
    }
    for (const z of this.zones) {
      if (z.kind === 'fan' && this.inZone(z, this.bx, this.by)) { gx += z.fx; gy += z.fy; this.touched.add('fan'); }
    }
    for (const c of this.circs) {
      if (c.kind === 'vortex') {
        // swirl: tangential push plus a little inward pull, both fading to zero at the rim
        const dx = c.x - this.bx, dy = c.y - this.by, d = Math.hypot(dx, dy);
        if (d < c.pr  && d > 0.15) {
          const f = 1 - d / c.pr , ux = dx / d, uy = dy / d, s = c.a ;
          gx += (-uy * s) * c.k  * f + ux * c.k  * 0.35 * f;
          gy += (ux * s) * c.k  * f + uy * c.k  * 0.35 * f;
          this.touched.add('vortex');
        }
        continue;
      }
      if (c.kind === 'hole' || c.kind === 'white') {
        if (!c.alive) continue;
        const dx = c.x - this.bx, dy = c.y - this.by, d = Math.hypot(dx, dy);
        if (d < c.pr  && d > 0.2) {
          const k = c.k  * (1 - d / c.pr ) * (c.kind === 'hole' ? 1 : -1);
          gx += (dx / d) * k; gy += (dy / d) * k; this.touched.add(c.kind);
        }
        continue;
      }
      if (c.kind !== 'magnet') continue;
      const dx = c.x - this.bx, dy = c.y - this.by, d = Math.hypot(dx, dy);
      if (d < MAG_R && d > 0.3) { const k = MAG_K * (1 - d / MAG_R); gx += (dx / d) * k; gy += (dy / d) * k; this.touched.add('magnet'); }
    }
    this.vx += gx * DT; this.vy += gy * DT;
    if (scored) { this.vx *= 0.96; if (this.vy > 4) this.vy *= 0.95; }
    const py = this.by, px0 = this.bx;
    this.bx += this.vx * DT; this.by += this.vy * DT;
    // warp planes: crossing one plane of a pair puts the ball at the same spot on the other, velocity untouched
    for (const w of this.warps) {
      const nx = -w.sin, ny = w.cos;
      let done = false;
      for (const [fx, fy, tx, ty] of [[w.ax, w.ay, w.bx, w.by], [w.bx, w.by, w.ax, w.ay]]) {
        const d0 = (px0 - fx) * nx + (py - fy) * ny, d1 = (this.bx - fx) * nx + (this.by - fy) * ny;
        if ((d0 < 0) === (d1 < 0)) continue;
        const along = (this.bx - fx) * w.cos + (this.by - fy) * w.sin;
        if (Math.abs(along) > w.len / 2) continue;
        const ox = tx + along * w.cos + d1 * nx, oy = ty + along * w.sin + d1 * ny;
        this.events.push({ type: 'warp', x: this.bx, y: this.by, x2: ox, y2: oy, id: w.id });
        this.bx = ox; this.by = oy;
        this.ax = this.bx; this.ay = this.by;
        this.touched.add('warp');
        done = true; break;
      }
      if (done) break;
    }

    // collisions
    if (!this.blobArmed) { const bc = this.circs.find(c => c.kind === 'blob'); if (!bc || Math.hypot(this.bx - bc.x, this.by - bc.y) > bc.r + BALL_R + 0.25) this.blobArmed = true; }
    this.hitThisStep = false;
    for (let it = 0; it < 2; it++) {
      for (const b of this.boxes) if (b.alive) this.collideBox(b);
      for (const c of this.circs) if (c.alive) this.collideCirc(c);
    }
    if (this.bubbled && this.hitThisStep) this.popBubble();
    if (this.state !== 'fly' && this.state !== 'score') return;
    // sensor circles: speed rings, redirect arrows, gravity-flip orbs (trigger once on entry)
    for (const c of this.circs) {
      if (!c.alive || (c.kind !== 'ring' && c.kind !== 'arrow' && c.kind !== 'flip' && c.kind !== 'paint')) continue;
      const inn = Math.hypot(this.bx - c.x, this.by - c.y) < c.r + BALL_R * 0.5;
      if (inn && !this.inside.has(c.id)) {
        this.inside.add(c.id);
        if (c.kind === 'paint') { if (this.ballCol !== c.a) { this.ballCol = c.a ; this.events.push({ type: 'paint', x: c.x, y: c.y, id: c.id, s: c.a }); } continue; }
        if (c.kind === 'ring' && c.a !== undefined) { const r = c.a * D2R; this.vx += Math.cos(r) * BOOST_V; this.vy += Math.sin(r) * BOOST_V; this.touched.add('boost'); }
        else if (c.kind === 'ring') { this.vx *= c.k ; this.vy *= c.k ; this.touched.add(c.k  > 1 ? 'boost' : 'slow'); }
        else if (c.kind === 'arrow') { const sp = Math.max(5, Math.hypot(this.vx, this.vy)), r = c.a  * D2R; this.vx = Math.cos(r) * sp; this.vy = Math.sin(r) * sp; this.touched.add('arrow'); }
        else { c.alive = false; this.gsign *= -1; this.touched.add('flip'); }
        this.events.push({ type: c.kind, x: c.x, y: c.y, id: c.id });
      } else if (!inn) this.inside.delete(c.id);
    }

    // portals
    if (this.portalCd > 0) this.portalCd -= DT;
    if (this.portalLock >= 0) {
      const p = this.portals[this.portalLock];
      if (Math.hypot(this.bx - p.x, this.by - p.y) > 0.9 && this.portalCd <= 0) this.portalLock = -1;
    }
    for (let i = 0; i < this.portals.length; i++) {
      const p = this.portals[i];
      if (i === this.portalLock || this.portalCd > 0) continue;
      if (Math.hypot(this.bx - p.x, this.by - p.y) < 0.6) {
        const j = this.portals.findIndex((q, k) => k !== i && q.c === p.c);
        if (j < 0) continue;
        const q = this.portals[j];
        const sp = Math.hypot(this.vx, this.vy);
        this.events.push({ type: 'portal', x: p.x, y: p.y, x2: q.x, y2: q.y, id: p.id });
        this.touched.add('portal');
        this.bx = q.x + q.dx * 0.2; this.by = q.y + q.dy * 0.2;
        this.vx = q.dx * sp; this.vy = q.dy * sp;
        this.portalLock = j; this.portalCd = 0.2;
        break;
      }
    }

    if (this.state === 'fly') {
      const h = this.hoop;
      for (const s of this.stars) {
        if (s.got || Math.hypot(this.bx - s.x, this.by - s.y) > STAR_R) continue;
        s.got = true; this.starsGot++;
        this.events.push({ type: 'star', x: s.x, y: s.y, id: s.id });
      }
      const rel = this.bx - h.x;
      if (py < h.y - 0.05) this.wasAbove = true;
      if (this.wasAbove && py <= h.y && this.by > h.y && Math.abs(rel) < RIM_HALF - 0.1 && this.vy > h.vy) {
        this.state = 'score';
        this.events.push({ type: 'score', x: h.x, y: h.y });
        return;
      }
      if (this.bx < -2 || this.bx > 34 || this.by > 20 || this.by < -30) { this.miss(); return; }
      if (Math.hypot(this.bx - this.ax, this.by - this.ay) > SLOW_DIST) { this.ax = this.bx; this.ay = this.by; this.stall = 0; }
      else if (++this.stall > SLOW_FRAMES) { this.miss(); return; }
    }
  }

  popBubble() {
    if (!this.bubbled) return;
    this.bubbled = false;
    this.events.push({ type: 'bubblepop', x: this.bx, y: this.by });
  }

  miss() {
    this.state = 'miss';
    this.events.push({ type: 'miss', x: this.bx, y: this.by });
  }

  resolve(nx        , ny        , pen        , cvx        , cvy        , e        , fr        ) {
    this.bx += nx * pen; this.by += ny * pen;
    this.hitThisStep = true;
    let rvx = this.vx - cvx, rvy = this.vy - cvy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const ee = -vn < 1.5 ? 0 : e;
    rvx -= (1 + ee) * vn * nx; rvy -= (1 + ee) * vn * ny;
    const tn = rvx * nx + rvy * ny;
    const tx = rvx - tn * nx, ty = rvy - tn * ny;
    rvx = tn * nx + tx * (1 - fr); rvy = tn * ny + ty * (1 - fr);
    this.vx = rvx + cvx; this.vy = rvy + cvy;
    return -vn;
  }

  collideBox(b     ) {
    const dx = this.bx - b.cx, dy = this.by - b.cy;
    const lx = dx * b.cos + dy * b.sin, ly = -dx * b.sin + dy * b.cos;
    const qx = Math.max(-b.hw, Math.min(b.hw, lx)), qy = Math.max(-b.hh, Math.min(b.hh, ly));
    let nlx        , nly        , pen        ;
    if (qx === lx && qy === ly) {
      const px = b.hw - Math.abs(lx), pyy = b.hh - Math.abs(ly);
      if (px < pyy) { nlx = Math.sign(lx) || 1; nly = 0; pen = px + BALL_R; } else { nlx = 0; nly = Math.sign(ly) || -1; pen = pyy + BALL_R; }
    } else {
      const ddx = lx - qx, ddy = ly - qy, d = Math.hypot(ddx, ddy);
      if (d >= BALL_R) { if (b.kind === 'laser' && d < BALL_R + 1.0) this.touched.add('nearlaser'); return; }
      nlx = ddx / d; nly = ddy / d; pen = BALL_R - d;
    }
    const nx = nlx * b.cos - nly * b.sin, ny = nlx * b.sin + nly * b.cos;
    if (b.bl && !this.blinkOn(b)) { this.touched.add('blinkpass'); return; }
    if (b.kind === 'gate' && b.col === this.ballCol) { this.touched.add('paint'); return; } // same colour: pass straight through
    if (b.kind === 'laser') {
      if (this.state === 'fly') { this.touched.add('laser'); this.events.push({ type: 'zap', x: this.bx, y: this.by, id: b.id }); this.miss(); }
      return;
    }
    if (b.kind === 'ice' || b.kind === 'sponge') {
      const s = this.resolve(nx, ny, pen, 0, 0, b.kind === 'ice' ? 0.35 : 0.06, b.kind === 'ice' ? 0 : 0.25);
      if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s: b.kind === 'ice' ? s : s * 0.3, id: b.id });
      this.touched.add(b.kind);
      return;
    }
    if (b.kind === 'glue') {
      this.bx += nx * pen; this.by += ny * pen;
      this.hitThisStep = true;
      if (Math.hypot(this.vx, this.vy) > 1) this.events.push({ type: 'glue', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, id: b.id });
      this.vx = 0; this.vy = 0;
      this.touched.add('glue');
      return;
    }
    if (b.kind === 'crumble' || b.kind === 'hpblock') {
      const s = this.resolve(nx, ny, pen, b.vx, b.vy, 0.6, 0.015);
      if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s });
      if (s > 1) {
        if (b.kind === 'crumble') { b.alive = false; this.touched.add('crumble'); this.events.push({ type: 'crumble', x: b.cx, y: b.cy, id: b.id }); }
        else if (this.t >= (b.hitCd || 0)) {
          b.hitCd = this.t + 0.12; b.hp = (b.hp || 1) - 1; this.touched.add('hp');
          if (b.hp <= 0) { b.alive = false; this.events.push({ type: 'crumble', x: b.cx, y: b.cy, id: b.id }); }
          else this.events.push({ type: 'hit', x: b.cx, y: b.cy, id: b.id });
        }
      }
      return;
    }
    if (b.kind === 'oneway') {
      // solid only from the local-up side, and only while moving into it (only a landing counts as using it)
      const ux = b.sin, uy = -b.cos;
      if (ly > 0 || nx * ux + ny * uy < 0.5 || this.vx * ux + this.vy * uy > 0.5) return;
      this.resolve(nx, ny, pen, 0, 0, 0.5, 0.015);
      this.touched.add('oneway');
      return;
    }
    if (b.kind === 'glass') {
      const vn = this.vx * nx + this.vy * ny;
      if (-vn >= GLASS_V) {
        b.alive = false;
        this.vx *= 0.72; this.vy *= 0.72;
        this.touched.add('glass');
        this.events.push({ type: 'glass', x: b.cx, y: b.cy, id: b.id });
        return;
      }
      const s = this.resolve(nx, ny, pen, 0, 0, 0.6, 0.015);
      if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s });
      this.touched.add('glass');
      return;
    }
    if (b.kind === 'rubber') {
      const s = this.resolve(nx, ny, pen, 0, 0, 1, 0);
      // rubber is a trampoline: it returns MORE bounce than it received
      const vn = this.vx * nx + this.vy * ny;
      const want = Math.min(24, Math.max(8, s * 1.25));
      if (s > 0.5 && vn < want) { this.vx += nx * (want - vn); this.vy += ny * (want - vn); }
      if (s > 0.5) this.events.push({ type: 'bumper', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s: 1, id: b.id });
      this.touched.add('rubber');
      return;
    }
    if (b.kind === 'button') {
      // touch switch: brushing it opens the doors, the ball keeps going (no bounce)
      this.pressButton(b);
      return;
    }
    if (b.kind === 'paddle') {
      const w = b.rot  * D2R;
      const px = this.bx - nx * BALL_R - b.cx, pyy = this.by - ny * BALL_R - b.cy;
      const s = this.resolve(nx, ny, pen, -w * pyy, w * px, 0.55, 0.02);
      if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s });
      this.touched.add('paddle');
      return;
    }
    if (b.kind === 'spring') {
      // spring face normal = local up
      const sx = b.sin, sy = -b.cos;
      if (nx * sx + ny * sy > 0.5) {
        this.bx += nx * pen; this.by += ny * pen;
        const vt = this.vx * b.cos + this.vy * b.sin;
        this.vx = b.cos * vt * 0.9 + sx * b.sv ; this.vy = b.sin * vt * 0.9 + sy * b.sv ;
        this.events.push({ type: 'spring', x: b.cx, y: b.cy, id: b.id });
        this.touched.add('spring');
        return;
      }
    }
    if (b.kind === 'belt') {
      const ux = b.sin, uy = -b.cos; // belt up
      const face = nx * ux + ny * uy > 0 ? 1 : -1;
      this.resolve(nx, ny, pen, 0, 0, 0.3, 0);
      const target = b.dir  * BELT_V * face;
      const vt = this.vx * b.cos + this.vy * b.sin;
      const nv = vt + (target - vt) * 0.2;
      this.vx += (nv - vt) * b.cos; this.vy += (nv - vt) * b.sin;
      this.touched.add('belt');
      if (Math.random() < 0) this.events.push({ type: 'belt', x: this.bx, y: this.by });
      return;
    }
    const e = b.kind === 'crate' ? 0.4 : 0.6;
    const s = this.resolve(nx, ny, pen, b.vx, b.vy, e, 0.015);
    if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s });
    if (b.m) this.touched.add('move');
  }

  collideCirc(c      ) {
    const dx = this.bx - c.x, dy = this.by - c.y, d = Math.hypot(dx, dy);
    const rr = c.r + BALL_R;
    if (d >= rr || d < 1e-6) return;
    const nx = dx / d, ny = dy / d, pen = rr - d;
    if (c.kind === 'blob') {
      if (!this.blobArmed) return;
      const ivx = this.vx, ivy = this.vy;
      const s = this.resolve(nx, ny, pen, 0, 0, 0.45, 0.02);
      if (s < BLOB_KO_V) {
        // a slow roll / light tap just bumps off the shooter: no knockout, the shot goes on
        if (s > 1.5 && this.t - this.blobBumpT > 0.25) { this.blobBumpT = this.t; this.events.push({ type: 'blobbump', x: c.x, y: c.y, s, id: c.id }); }
        return;
      }
      c.alive = false;
      this.events.push({ type: 'blobhit', x: c.x, y: c.y, s, id: c.id, x2: ivx, y2: ivy });
      if (this.state === 'fly') this.miss(); // hitting yourself = this shot fails
      return;
    }
    if (c.kind === 'balloon') {
      // pop: the ball punches through, loses 30% speed and gets nudged away from the balloon centre
      this.vx = this.vx * 0.7 + nx * 1.5; this.vy = this.vy * 0.7 + ny * 1.5;
      this.popBalloon(c);
      return;
    }
    if (c.kind === 'bomb') {
      this.explode(c, [nx, ny]);
      return;
    }
    if (c.kind === 'hole') {
      if (this.state === 'fly') { this.events.push({ type: 'eaten', x: c.x, y: c.y, id: c.id }); this.miss(); }
      return;
    }
    if (c.kind === 'ring' || c.kind === 'arrow' || c.kind === 'flip' || c.kind === 'paint' || c.kind === 'vortex') return; // sensors / force fields
    if (c.kind === 'white' || c.kind === 'pend') {
      const s = this.resolve(nx, ny, pen, c.vx, c.vy, 0.8, 0.02);
      if (s > 2) this.events.push({ type: c.kind === 'white' ? 'white' : 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s, id: c.id });
      if (c.kind === 'pend') this.touched.add('pend');
      return;
    }
    if (c.kind === 'bubble') {
      c.alive = false;
      this.bubbled = true; this.bubbleT = 0;
      this.bx = c.x; this.by = c.y;
      this.vx *= 0.5; this.vy = Math.min(this.vy * 0.2, 0);
      this.touched.add('bubble');
      this.events.push({ type: 'bubble', x: c.x, y: c.y, id: c.id });
      return;
    }
    if (c.kind === 'bumper') {
      this.bx += nx * pen; this.by += ny * pen;
      this.hitThisStep = true;
      const vt = -this.vx * ny + this.vy * nx;
      this.vx = nx * BUMP_V + -ny * vt * 0.4; this.vy = ny * BUMP_V + nx * vt * 0.4;
      this.touched.add('bumper');
      this.events.push({ type: 'bumper', x: c.x, y: c.y, id: c.id });
      return;
    }
    const e = c.kind === 'magnet' ? 0.3 : 0.55;
    const s = this.resolve(nx, ny, pen, c.vx, c.vy, e, 0.02);
    if (s > 2) this.events.push({ type: 'bounce', x: this.bx - nx * BALL_R, y: this.by - ny * BALL_R, s: s * (c.kind === 'rim' ? 1.3 : 1) });
  }
}

/** Run a whole shot headlessly; returns outcome and (optionally) the path. */
export function simulate(lv          , power        , path           )                                                       {
  const s = new Sim(lv);
  s.launch(power);
  let n = 0;
  while (s.state === 'fly' && n < 1200) {
    s.step(); n++;
    if (path && n % 3 === 0) path.push(s.bx, s.by);
  }
  return { ok: s.state === 'score', touched: s.touched, stars: s.starsGot };
}
