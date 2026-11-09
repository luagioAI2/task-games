// In-room motion for seated tenants: an idle loop per tenant type, plus occasional one-shot gestures
// (stretch overhead, doze off and jerk awake) that play and return to the loop.
import * as PIXI from "pixi.js";
import { assetUrl } from "../src/asset.js";

                             
                         
              
                
                                                                                                                   
                 
                                                             
                                   
                                                 
               
 
                                                                   

const KINDS = ["student", "gamer", "retiree", "office", "artist", "family", "couple", "chef", "athlete", "doctor", "celebrity", "ceo"];
/** per kind: idle pack, then gesture packs (the couple shares the family's loop — two-person gestures cannot be animated) */
const PACKS                           = {
  student: ["student-idle", "student-overhead-stretch", "student-doze-off"],
  gamer: ["gamer-idle", "gamer-overhead-stretch", "gamer-doze-nod"],
  retiree: ["retiree-idle", "retiree-stretch-overhead", "retiree-doze-head-nod"],
  office: ["office-idle"],
  artist: ["artist-idle", "artist-overhead-stretch", "artist-doze-nod"],
  family: ["family-idle"],
  couple: [],
  chef: ["chef-idle", "chef-overhead-stretch", "chef-nod-off"],
  athlete: ["athlete-idle", "athlete-overhead-stretch", "athlete-doze-and-jerk"],
  doctor: ["doctor-idle", "doctor-stretch-overhead", "doctor-doze-off"],
  celebrity: ["celebrity-idle", "celebrity-overhead-stretch", "celebrity-doze-off"],
  ceo: ["ceo-idle", "ceo-overhead-stretch", "ceo-doze-off"],
};

async function loadClip(dir        )                                                           {
  const base = assetUrl(`assets/lounge-${dir}/`);
  const m = await (await fetch(base + "manifest.json")).json();
  const pages                 = await Promise.all(m.pages.map((p        ) => PIXI.Assets.load              (base + p)));
  const perPage = m.frame.cols * m.frame.rows;
  const frames                 = [];
  for (let k = 0; k < m.frame.count; k++) {
    const src = pages[Math.floor(k / perPage)].source;
    const c = k % perPage;
    frames.push(new PIXI.Texture({
      source: src,
      frame: new PIXI.Rectangle((c % m.frame.cols) * m.frame.w, Math.floor(c / m.frame.cols) * m.frame.h, m.frame.w, m.frame.h),
    }));
  }
  return { frames, fps: m.fps, loop: m.kind === "loop", matchK: 1, anchorX: m.anchor.x, anchorY: m.anchor.y, figH: m.figure?.h ?? m.frame.h * 0.9, nativeK: m.nativeK ?? 1, cellH: m.frame.h };
}

/** Loads every kind's clips; kinds whose packs fail keep the static token (returned map lacks them). */
export async function loadLounge()                                     {
  const out                            = {};
  await Promise.all(KINDS.map(async (kind) => {
    const dirs = PACKS[kind].length ? PACKS[kind] : PACKS.family;
    try {
      const clips = await Promise.all(dirs.map(loadClip));
      const idle = clips[0];
      // match every clip to the idle's on-screen size: a frame pixel is (nativeK) source pixels
      for (const c of clips) c.matchK = c.nativeK / idle.nativeK;
      out[kind] = { idle, extras: clips.slice(1) };
    } catch (e) {
      console.warn("lounge pack missing", kind, e);
    }
  }));
  return out;
}

/** Drives one seated tenant: idle loop, and now and then a one-shot gesture. */
export class LoungePlayer {
           sp             ;
          clip            ;
          t = 0;
          wait        ;
  /** idle figure height in texture px (what the wanted on-screen height divides by) */
           figH        ;
          set           ;
  constructor(set           , seed        ) {
    this.set = set;
    this.clip = set.idle;
    this.sp = new PIXI.Sprite(set.idle.frames[0]);
    this.sp.anchor.set(set.idle.anchorX, set.idle.anchorY);
    this.figH = set.idle.figH;
    this.t = (seed * 0.37) % 1;
    this.wait = 6 + ((seed * 7.13) % 14);
  }
  get gesturing() { return this.clip !== this.set.idle; }
  /** Probe: start a gesture now. */
  gesture(k = 0)          {
    if (!this.set.extras.length) return false;
    this.play(this.set.extras[k % this.set.extras.length]);
    return true;
  }
          play(c            ) {
    this.clip = c;
    this.t = 0;
    this.sp.anchor.set(c.anchorX, c.anchorY);
  }
  /** `scale` = the scale that draws the idle clip at the wanted height. */
  update(dt        , scale        , allowGesture         ) {
    this.t += dt;
    const c = this.clip;
    let fi = Math.floor(this.t * c.fps);
    if (fi >= c.frames.length) {
      if (c.loop) fi %= c.frames.length;
      else { this.play(this.set.idle); fi = 0; this.wait = 8 + Math.random() * 12; }
    }
    if (!this.gesturing && allowGesture && this.set.extras.length) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.play(this.set.extras[Math.floor(Math.random() * this.set.extras.length)]);
        fi = 0;
      }
    }
    this.sp.texture = this.clip.frames[fi];
    const k = scale * this.clip.matchK;
    this.sp.scale.set(k, k);
  }
}
