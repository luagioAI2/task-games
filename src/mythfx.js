// v52：三只神物（神兽猫 / 玉龙 / 神圣梧桐）的炫酷特效系统——纯表现层。
// · 粒子全部池化（固定 240 个 Sprite，满了就跳过），世界坐标，add 混合，eventMode none（绝不挡点击）。
// · 随机只用 mulberry32（固定种子），零 Math.random。
// · 贴图在运行时用 canvas 一次画好（柔光点、四芒星、光环、火苗、羽状火光、光柱），不额外加载文件。
import * as PIXI from "./vendor/pixi.min.mjs";

const mulberry32 = (seed        ) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

                                                                                 
             
                                                                       
                                                                        
                                                               
                                                        
 
                           
                                                                                  
                                                                                                
                                                                                                 
 

function cv(w        , h        , draw                                       ) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d") );
  return PIXI.Texture.from(c);
}

export class MythFx {
  layer = new PIXI.Container();
  tex                              ;
          pool      = [];
  rng = mulberry32(0x3a7c51);
  active = 0;

  constructor(size = 240) {
    this.layer.eventMode = "none"; this.layer.interactiveChildren = false;
    this.tex = {
      glow: cv(64, 64, x => {
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.7)");
        g.addColorStop(0.6, "rgba(255,255,255,0.18)"); g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      }),
      star: cv(64, 64, x => {
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 10);
        g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        x.fillStyle = "rgba(255,255,255,0.95)";
        for (const [w, h] of [[3, 30], [30, 3]]         ) { x.beginPath(); x.ellipse(32, 32, w, h, 0, 0, 7); x.fill(); }
        x.fillStyle = "rgba(255,255,255,0.5)";
        for (const r of [Math.PI / 4, -Math.PI / 4]) { x.save(); x.translate(32, 32); x.rotate(r); x.beginPath(); x.ellipse(0, 0, 1.6, 16, 0, 0, 7); x.fill(); x.restore(); }
      }),
      ring: cv(128, 128, x => {
        x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 5; x.shadowColor = "white"; x.shadowBlur = 10;
        x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke();
        x.lineWidth = 2; x.globalAlpha = 0.5; x.beginPath(); x.arc(64, 64, 42, 0, 7); x.stroke();
      }),
      flame: cv(48, 96, x => {
        // 火苗：下圆上尖的泪滴，白芯 → 透明边（运行时 tint 橙红~金黄）
        const g = x.createRadialGradient(24, 70, 2, 24, 62, 40);
        g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.75)");
        g.addColorStop(0.75, "rgba(255,255,255,0.2)"); g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g;
        x.beginPath(); x.moveTo(24, 2);
        x.bezierCurveTo(34, 30, 46, 50, 44, 70); x.bezierCurveTo(42, 92, 6, 92, 4, 70);
        x.bezierCurveTo(2, 50, 14, 30, 24, 2); x.fill();
      }),
      feather: cv(160, 48, x => {
        // 凤羽火光：一道弯曲的长羽（头亮尾淡），沿弧线掠过
        const g = x.createLinearGradient(0, 0, 160, 0);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.6, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,1)");
        x.fillStyle = g;
        x.beginPath(); x.moveTo(0, 30); x.quadraticCurveTo(80, 2, 156, 22); x.quadraticCurveTo(160, 26, 154, 30); x.quadraticCurveTo(80, 44, 0, 30); x.fill();
        x.strokeStyle = "rgba(255,255,255,0.6)"; x.lineWidth = 1.2;
        for (let i = 1; i < 9; i++) { const px = i * 17; x.beginPath(); x.moveTo(px, 26); x.lineTo(px - 10, 40); x.stroke(); x.beginPath(); x.moveTo(px, 24); x.lineTo(px - 9, 10); x.stroke(); }
      }),
      pillar: cv(64, 256, x => {
        const g = x.createLinearGradient(0, 256, 0, 0);
        g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
        const h = x.createLinearGradient(0, 0, 64, 0);
        h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.5, "rgba(0,0,0,1)"); h.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g; x.fillRect(0, 0, 64, 256);
        x.globalCompositeOperation = "destination-in"; x.fillStyle = h; x.fillRect(0, 0, 64, 256);
      }),
      rune: cv(256, 256, x => {
        // 符文圈：内外双环 + 12 枚抽象符纹 + 放射短刻线（运行时压扁成地面椭圆并缓转）
        x.translate(128, 128); x.strokeStyle = "rgba(255,255,255,0.95)"; x.shadowColor = "white"; x.shadowBlur = 6;
        x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 118, 0, 7); x.stroke();
        x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 92, 0, 7); x.stroke();
        x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 70, 0, 7); x.stroke();
        for (let i = 0; i < 12; i++) {
          x.save(); x.rotate(i * Math.PI / 6); x.translate(0, -105); x.lineWidth = 2.4;
          x.beginPath();
          switch (i % 4) {
            case 0: x.moveTo(-6, -6); x.lineTo(0, 6); x.lineTo(6, -6); break;
            case 1: x.arc(0, 0, 5, 0, 7); x.moveTo(0, -8); x.lineTo(0, 8); break;
            case 2: x.moveTo(-6, 0); x.lineTo(6, 0); x.moveTo(-3, -6); x.lineTo(3, 6); break;
            default: x.moveTo(-5, 6); x.lineTo(0, -7); x.lineTo(5, 6); x.lineTo(-5, 6);
          }
          x.stroke(); x.restore();
          x.save(); x.rotate(i * Math.PI / 6 + Math.PI / 12); x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(0, -72); x.lineTo(0, -88); x.stroke(); x.restore();
        }
        // 内六芒
        x.lineWidth = 1.5; x.beginPath();
        for (let k = 0; k < 2; k++) for (let i = 0; i <= 3; i++) { const a = k * Math.PI / 3 + i * 2 * Math.PI / 3 - Math.PI / 2; const px = Math.cos(a) * 68, py = Math.sin(a) * 68; i ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }),
    };
    // 两个子层：普通混合在下、add 在上——同一层里不交错切换混合模式，保证合批（DC 不涨）
    const ln = new PIXI.Container(), la = new PIXI.Container();
    ln.eventMode = la.eventMode = "none"; this.layer.addChild(ln, la);
    for (let i = 0; i < size; i++) {
      const normal = i < Math.round(size * 0.5);
      const s = new PIXI.Sprite(this.tex.glow); s.anchor.set(0.5); s.blendMode = normal ? "normal" : "add"; s.eventMode = "none"; s.visible = false;
      (normal ? ln : la).addChild(s);
      this.pool.push({ s, on: false, normal, t: 0, dur: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, s0: 1, s1: 1, a0: 1, flat: 1, vr: 0, wob: 0, wobF: 0, ph: 0, fadeIn: 0.15 });
    }
  }

  /** 从池里领一个粒子；池满返回 false（静默跳过，不新建）。 */
  spawn(x        , y        , o           = {}) {
    let p               ;
    const wantN = !!o.normal;
    for (const q of this.pool) if (!q.on && q.normal === wantN) { p = q; break; }
    if (!p) return false;
    const key = o.tex ?? "glow";
    p.s.texture = this.tex[key];
    if (key === "pillar") p.s.anchor.set(0.5, 1); else if (key === "flame") p.s.anchor.set(0.5, 0.85); else p.s.anchor.set(0.5);
    p.on = true; p.t = 0; p.dur = o.dur ?? 1; p.x = x; p.y = y;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0; p.g = o.g ?? 0; p.drag = o.drag ?? 0;
    p.s0 = o.s0 ?? 0.3; p.s1 = o.s1 ?? p.s0; p.a0 = o.a ?? 1; p.flat = o.flat ?? 1; p.vr = o.vr ?? 0;
    p.wob = o.wob ?? 0; p.wobF = o.wobF ?? 3; p.ph = this.rng() * 6.28; p.fadeIn = o.fadeIn ?? 0.15;
    p.s.tint = o.tint ?? 0xffffff; p.s.rotation = o.rot ?? 0;
    p.s.visible = true; p.s.alpha = 0;
    this.place(p);
    return true;
  }
          place(p   ) {
    const k = Math.min(1, p.t / p.dur);
    const sc = p.s0 + (p.s1 - p.s0) * k;
    p.s.scale.set(sc, sc * p.flat);
    p.s.position.set(p.x + Math.sin(p.t * p.wobF + p.ph) * p.wob, p.y);
    const fi = p.fadeIn > 0 ? Math.min(1, k / p.fadeIn) : 1;
    p.s.alpha = p.a0 * fi * (1 - k) * (1 - k * 0.2);
  }
  update(dt        ) {
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.dur) { p.on = false; p.s.visible = false; continue; }
      n++;
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.s.rotation += p.vr * dt;
      this.place(p);
    }
    this.active = n;
  }

  // ——— 组合特效 ———
  /** 四芒星闪光 + 一圈金色光环（神兽猫醒来/驻足时） */
  flash(x        , y        , tint = 0xffe9a0) {
    this.spawn(x, y, { tex: "star", dur: 0.75, s0: 0.4, s1: 2.4, a: 0.9, tint: 0xffb21a, vr: 2.4, fadeIn: 0.1, normal: true });
    this.spawn(x, y, { tex: "star", dur: 0.7, s0: 0.3, s1: 2.6, a: 1, tint, vr: 2.4, fadeIn: 0.12 });
    this.spawn(x, y, { tex: "glow", dur: 0.55, s0: 0.8, s1: 3.2, a: 0.8, tint });
    this.spawn(x, y + 14, { tex: "ring", dur: 0.8, s0: 0.2, s1: 1.6, a: 0.85, tint, flat: 0.4, fadeIn: 0.05 });
  }
  /** 大水柱 + 光环 + 飞溅水珠（玉龙出水/入水，比普通鱼跃大得多） */
  bigSplash(x        , y        , entering = false) {
    const r = this.rng;
    this.spawn(x, y + 4, { tex: "pillar", dur: 0.9, s0: entering ? 0.9 : 1.3, s1: entering ? 1.3 : 1.7, a: 0.9, tint: 0xc8f6ff, flat: entering ? 0.9 : 1.25, fadeIn: 0.06 });
    this.spawn(x, y - 30, { tex: "glow", dur: 0.6, s0: 1.5, s1: 4.2, a: 0.7, tint: 0x8fe9ff });
    for (let i = 0; i < 3; i++) this.spawn(x, y, { tex: "ring", dur: 1.1 + i * 0.25, s0: 0.3 + i * 0.1, s1: 2.6 + i * 0.9, a: 0.95 - i * 0.2, tint: i ? 0x9ff0ff : 0xe8fdff, flat: 0.36, fadeIn: 0.04 });
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.9, sp = 260 + r() * 300;
      this.spawn(x + (r() - 0.5) * 30, y - 6, { tex: "glow", vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 820, dur: 0.8 + r() * 0.5, s0: 0.18 + r() * 0.16, s1: 0.1, a: 1, tint: r() < 0.5 ? 0xffffff : 0x9cefff, fadeIn: 0.02 });
    }
    if (entering) for (let i = 0; i < 6; i++) this.spawn(x + (r() - 0.5) * 90, y - 10, { tex: "star", dur: 0.7 + r() * 0.4, s0: 0.25, s1: 0.05, a: 1, tint: 0xd9fbff, vy: -40 - r() * 60, vr: 3 });
  }
}
