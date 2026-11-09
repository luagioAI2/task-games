// Typhoon weather drawn over the cross-section: darkened sky tint, drifting storm clouds, slanted rain,
// flying debris, lightning flashes. Screen-space; driven by one "intensity" value 0..1.
import * as PIXI from "pixi.js";

                                                               
                                                                                       

const STORM_NAVY = 0x22303d;

export class Weather {
  /** behind the building (sky tint + far clouds) */
           back = new PIXI.Container();
  /** over the building (rain, debris, near clouds, flash) */
           front = new PIXI.Container();
          tint = new PIXI.Graphics();
          rain = new PIXI.Graphics();
          flash = new PIXI.Graphics();
  /** a light navy veil over the building too, so the scene reads as storm-dark rather than pale */
          veil = new PIXI.Graphics();
          clouds                = [];
          drops         = [];
          flyers          = [];
          debrisTex                ;
          flashT = 0;
          boltIn = 4;
          vw = 390;         vh = 844;
  /** smoothed 0..1 */
  level = 0;
          target = 0;
  /** fires when a lightning bolt lands (the host plays thunder + shake) */
  onBolt                      = null;

  constructor(cloud              , debris                ) {
    this.debrisTex = debris;
    this.back.addChild(this.tint);
    for (let k = 0; k < 4; k++) {
      const sp = new PIXI.Sprite(cloud);
      sp.anchor.set(0.5);
      sp.alpha = 0;
      (k < 2 ? this.back : this.front).addChild(sp);
      this.clouds.push(sp);
    }
    this.front.addChild(this.veil, this.rain, this.flash);
    for (let k = 0; k < 110; k++) this.drops.push({ x: Math.random(), y: Math.random(), len: 10 + Math.random() * 14, v: 0.9 + Math.random() * 0.5 });
    this.back.visible = this.front.visible = false;
  }
  setViewport(w        , h        ) { this.vw = w; this.vh = h; }
  /** 0 calm · ~0.35 forecast (darker sky, wind) · 1 the passage itself */
  setTarget(v        ) { this.target = v; }
  get active() { return this.level > 0.02; }

  update(dt        ) {
    this.level += (this.target - this.level) * (1 - Math.exp(-1.2 * dt));
    if (this.level < 0.005 && this.target === 0) { this.level = 0; this.back.visible = this.front.visible = false; this.clearFlyers(); return; }
    this.back.visible = this.front.visible = true;
    const L = this.level, W = this.vw, H = this.vh;
    const storm = Math.max(0, (L - 0.35) / 0.65);   // 0 during the forecast, 1 at full passage

    this.tint.clear().rect(0, 0, W, H).fill({ color: STORM_NAVY, alpha: 0.55 * L });
    this.veil.clear().rect(0, 0, W, H).fill({ color: STORM_NAVY, alpha: 0.22 * storm });

    // clouds: two far (behind the building), two near (over the sky above it), all drifting with the wind
    const t = performance.now() / 1000;
    this.clouds.forEach((c, k) => {
      const far = k < 2;
      const scale = (far ? 0.75 : 1.05) * Math.max(W, 390) / c.texture.width * 1.3;
      c.scale.set(scale);
      const speed = (far ? 18 : 34) * (0.4 + L);
      const span = W + c.width;
      c.x = ((t * speed + k * span * 0.47) % span) - c.width / 2;
      c.y = (far ? 0.12 : 0.03) * H + k * 26;
      c.alpha = Math.min(1, L * (far ? 1.2 : 1.6)) * (far ? 0.85 : 0.95);
    });

    // rain: slanted strokes, denser as the storm peaks
    this.rain.clear();
    const n = Math.floor(this.drops.length * Math.min(1, 0.15 + storm));
    const slant = 0.38;
    for (let k = 0; k < n; k++) {
      const d = this.drops[k];
      d.y += d.v * dt * (1.2 + storm);
      d.x += d.v * dt * slant * 0.9;
      if (d.y > 1.05) { d.y -= 1.1; d.x = Math.random(); }
      if (d.x > 1.05) d.x -= 1.1;
      const x = d.x * W, y = d.y * H;
      this.rain.moveTo(x, y).lineTo(x - d.len * slant, y - d.len);
    }
    if (n) this.rain.stroke({ width: 1.6, color: 0xd9e6f0, alpha: 0.55 * Math.min(1, L * 1.4) });

    // flying debris
    if (storm > 0.2 && this.flyers.length < 7 && Math.random() < dt * 2.2 * storm) this.spawnFlyer();
    for (let k = this.flyers.length - 1; k >= 0; k--) {
      const f = this.flyers[k];
      f.life -= dt;
      f.sp.x += f.vx * dt; f.sp.y += f.vy * dt;
      f.vy += Math.sin(t * 3 + k) * 40 * dt;
      f.sp.rotation += f.spin * dt;
      if (f.life <= 0 || f.sp.x > W + 60) { f.sp.destroy(); this.flyers.splice(k, 1); }
    }

    // lightning: rare white flash + callback for thunder
    if (storm > 0.6) {
      this.boltIn -= dt;
      if (this.boltIn <= 0) { this.boltIn = 5 + Math.random() * 7; this.flashT = 0.35; this.onBolt?.(); }
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.clear();
    if (this.flashT > 0) this.flash.rect(0, 0, W, H).fill({ color: 0xffffff, alpha: Math.min(0.28, this.flashT * 1.2) });
  }

          spawnFlyer() {
    const sp = new PIXI.Sprite(this.debrisTex[Math.floor(Math.random() * this.debrisTex.length)]);
    sp.anchor.set(0.5);
    sp.scale.set((18 + Math.random() * 14) / sp.texture.width);
    sp.x = -40; sp.y = Math.random() * this.vh * 0.8;
    this.front.addChildAt(sp, 0);
    this.flyers.push({ sp, vx: 260 + Math.random() * 180, vy: -30 + Math.random() * 60, spin: (Math.random() - 0.5) * 9, life: 4 });
  }
          clearFlyers() { for (const f of this.flyers) f.sp.destroy(); this.flyers = []; }
}
