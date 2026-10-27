// Police raid choreography (GAME_DESIGN §4d). Presentation only: the sim decides who is arrested;
// this plays van → squad → stairs/elevator → breach → escort → van away, then calls onDone.
// Non-violent by design: shields, a door being forced, smoke — no weapons, no injuries.
import * as PIXI from "pixi.js";
import { SECOND_X, BUILDING_W, FLOOR_H, LIFT, LIFT_X, LOBBY_Y, M, BAY_X, colX, levelY } from "./layout.js";
                                                    
                                           

const LANDING_X = 9;
const RAID_GIVE_UP = 140;
const INK = 0x22303d, RED = 0xe8604c, BLUE = 0x357ca5, PAPER = 0xfffaf0, GOLD = 0xf2b33d;

                                                                                                                                                      
                                                                                                                    

                           
                                  
                 
                 
                                                                                           
                   
              
                                                           
                               
                  
                                                                                          
                             
                                                                         
                        
 

export class Raid {
           room        ;
           layer = new PIXI.Container();
  phase        = "drive";
          host          ;
          van                ;
          lights               ;
          vanX        ;
          units         = [];
          suspect              = null;
          t = 0;
          wait = 0;
          ride              = null;
          bubble                ;
          cuffs               ;
          homeLevel        ;
          doorX        ;
          useLift         ;
          parkX        ;
  /** red/blue wash over the facade while the van is parked, fading in and out */
          wash = new PIXI.Graphics();
          washK = 0;
          callout                ;
          calloutT = -1;
          chips                                                                                                   = [];
          sirenOn = false;

  constructor(room        , vanTex              , host          , bubbleText        , font        , calloutText        ) {
    this.room = room;
    this.host = host;
    this.homeLevel = Math.floor((room % 2000) / 4) + 1;
    this.doorX = (Math.floor(room / 2000) ? SECOND_X : 0) + colX(room % 4) + M.roomW / 2;
    this.useLift = this.homeLevel > 1;
    this.parkX = BUILDING_W / 2 + 30;

    // van: sprite + flashing light bar
    this.van = new PIXI.Container();
    const sp = new PIXI.Sprite(vanTex);
    const vh = 46;
    sp.anchor.set(0.5, 1);
    sp.scale.set(vh / vanTex.height);
    this.lights = new PIXI.Graphics();
    this.van.addChild(sp, this.lights);
    this.vanX = -host.halfView - 120;
    this.van.position.set(this.vanX, -1);

    this.layer.addChild(this.van);

    // speech bubble "確保！" and the handcuff badge over the suspect
    this.bubble = new PIXI.Container();
    const txt = new PIXI.Text({ text: bubbleText, style: { fontFamily: font, fontSize: 13, fontWeight: "800", fill: INK } });
    txt.anchor.set(0.5);
    const g = new PIXI.Graphics();
    const w = Math.max(48, txt.width + 16);
    g.roundRect(-w / 2, -13, w, 26, 9).fill(PAPER).stroke({ width: 2, color: INK });
    g.moveTo(-6, 12).lineTo(0, 20).lineTo(6, 12).fill(PAPER);
    this.bubble.addChild(g, txt);
    this.bubble.visible = false;
    this.cuffs = new PIXI.Graphics();
    this.cuffs.circle(-5, 0, 4.5).stroke({ width: 2.2, color: INK }).circle(5, 0, 4.5).stroke({ width: 2.2, color: INK });
    this.cuffs.moveTo(-0.5, 0).lineTo(0.5, 0).stroke({ width: 2, color: INK });
    this.cuffs.visible = false;
    this.layer.addChild(this.bubble, this.cuffs);
    this.layer.addChildAt(this.wash, 0);
    // "突入！" callout — bigger and bolder than the arrest bubble
    this.callout = new PIXI.Container();
    const ct = new PIXI.Text({ text: calloutText, style: { fontFamily: font, fontSize: 18, fontWeight: "900", fill: PAPER, padding: 4 } });
    ct.anchor.set(0.5);
    const cg = new PIXI.Graphics();
    const cw = Math.max(70, ct.width + 22);
    cg.roundRect(-cw / 2, -16, cw, 32, 8).fill(RED).stroke({ width: 2.5, color: INK });
    this.callout.addChild(cg, ct);
    this.callout.visible = false;
    this.layer.addChild(this.callout);
  }

  /** Building-local y for an officer standing at level L. */
          y(level        ) { return levelY(level, this.host.floors); }

          spawnSquad() {
    const pack = this.host.walks["walk-swat"];
    for (let k = 0; k < 3; k++) {
      const sp = new PIXI.Sprite(pack ? pack.frames[0] : PIXI.Texture.WHITE);
      if (pack) sp.anchor.set(0.5, pack.anchorY);
      this.layer.addChildAt(sp, 1);
      this.units.push({ sp, x: this.vanX + 10 - k * 10, y: -1, dir: 1, ft: k * 0.2, keys: ["walk-swat"] });
    }
  }

  /** Moves every unit toward its slot (x spacing behind the leader); returns true when all arrived. */
          march(targetX        , targetY        , speed        , dt        , spacing = 12)          {
    let all = true;
    this.units.forEach((u, k) => {
      const tx = targetX - (u.suspect ? 0 : k * spacing * Math.sign(targetX - u.x || 1));
      const dx = tx - u.x, dy = targetY - u.y;
      const d = Math.hypot(dx, dy);
      const len = speed * dt;
      if (d <= len) { u.x = tx; u.y = targetY; } else { u.x += (dx / d) * len; u.y += (dy / d) * len; all = false; }
      if (Math.abs(dx) > 0.5) u.dir = dx > 0 ? 1 : -1;
      if (d > 0.01) u.ft += dt;
    });
    return all;
  }

  update(dt        ) {
    this.t += dt;
    // never hang: a lost elevator ride or an unreachable spot ends the scene (the sim still settles the arrest)
    if (this.t > RAID_GIVE_UP && this.phase !== "done") {
      if (this.ride && this.ride.phase !== "done") this.host.lift.cancel(this.ride);
      this.ride = null;
      this.phase = "done";
      if (this.sirenOn) { this.sirenOn = false; this.host.onSiren(false); }
    }
    // the car left without us (its 8s door timeout): ask again
    if (this.ride && (this.ride.phase === "board" || this.ride.phase === "wait") && this.host.lift.lostRide(this.ride)) {
      const r = this.ride;
      this.ride = this.host.lift.request(r.from, r.to, this.t);
    }
    const h = this.host;
    const lobby = LOBBY_Y;
    const home = this.y(this.homeLevel);
    // flashing light bar: red / blue alternate
    const on = Math.floor(this.t * 6) % 2 === 0;
    this.lights.clear()
      .roundRect(-14, -46, 12, 5, 2).fill(on ? RED : 0x6b2f27)
      .roundRect(2, -46, 12, 5, 2).fill(on ? 0x22405a : BLUE);
    if (this.phase !== "done") this.lights.circle(on ? -8 : 8, -44, 9).fill({ color: on ? RED : BLUE, alpha: 0.28 });

    switch (this.phase) {
      case "drive": {
        // ease into the parking spot in front of the lobby
        const d = this.parkX - this.vanX;
        this.vanX += Math.sign(d) * Math.min(Math.abs(d), Math.max(30, Math.abs(d) * 2.2) * dt);
        if (Math.abs(d) < 0.8) { this.vanX = this.parkX; this.phase = "unload"; this.wait = 0.5; }
        if (!this.sirenOn && Math.abs(d) < 160) { this.sirenOn = true; h.onSiren(true); }
        break;
      }
      case "unload":
        this.wait -= dt;
        if (this.wait <= 0) { this.spawnSquad(); h.onRadio(); this.phase = "approach"; }
        break;
      case "approach": {
        // walk in through the lobby to the landing (lift) or the stair bay (one floor)
        const tx = this.useLift ? LANDING_X + 30 : BAY_X + M.gap / 2;
        if (this.march(tx, lobby, 42, dt)) {
          if (this.useLift) { this.ride = h.lift.request(0, this.homeLevel, h.now); this.phase = "ride"; }
          else this.phase = "toDoor";
        }
        break;
      }
      case "ride": case "rideBack": {
        const r = this.ride ;
        const fromY = this.phase === "ride" ? lobby : home;
        const toY = this.phase === "ride" ? home : lobby;
        if (r.phase === "wait") this.march(LANDING_X + 30, fromY, 40, dt, 10);
        else if (r.phase === "board") { if (this.march(LIFT_X, fromY, 40, dt, 4)) r.phase = "ride"; }
        else if (r.phase === "ride") this.units.forEach((u, k) => { u.x = LIFT_X + (k - 1) * 5; u.y = h.lift.y; u.dir = 1; });
        else if (r.phase === "exit") {
          if (this.march(LANDING_X + 30, toY, 40, dt, 10)) { r.phase = "done"; this.ride = null; this.phase = this.phase === "ride" ? "toDoor" : "toVan"; }
        } else { this.ride = null; this.phase = this.phase === "ride" ? "toDoor" : "toVan"; }
        break;
      }
      case "toDoor": {
        // one-floor hop: climb the stair bay first, then go along the corridor to the door
        const atFloor = Math.abs(this.units[0].y - home) < 0.5;
        if (!atFloor) { this.march(BAY_X + M.gap / 2, home, 40, dt, 8); break; }
        if (this.march(this.doorX - 26, home, 40, dt, 13)) { this.phase = "stack"; this.wait = 1.2; h.onRadio(); }
        break;
      }
      case "stack":
        // lined up at the door, shields forward
        this.units.forEach((u) => { u.dir = 1; });
        this.wait -= dt;
        if (this.wait <= 0) {
          this.phase = "breach"; this.wait = 0.35; h.onBreach(this.room);
          this.calloutT = 0;
          this.spawnChips(this.doorX, home - M.roomH * 0.45);
        }
        break;
      case "breach":
        this.wait -= dt;
        if (this.march(this.doorX + 6, home, 90, dt, 9) && this.wait <= 0) {
          this.phase = "inside"; this.wait = 1.6;
          this.bubble.visible = true;
        }
        break;
      case "inside":
        this.wait -= dt;
        this.bubble.position.set(this.doorX, home - M.roomH * 0.86);
        if (this.wait <= 0) {
          this.bubble.visible = false;
          this.addSuspect(home);
          this.phase = "escort";
        }
        break;
      case "escort": {
        // squad flanks the suspect and heads for the lift / stairs
        if (this.useLift) {
          if (this.march(LANDING_X + 30, home, 32, dt, 11)) { this.ride = h.lift.request(this.homeLevel, 0, h.now); this.phase = "rideBack"; }
        } else {
          const atLobby = Math.abs(this.units[0].y - lobby) < 0.5;
          if (Math.abs(this.units[0].x - (BAY_X + M.gap / 2)) > 1 && !atLobby) this.march(BAY_X + M.gap / 2, home, 32, dt, 11);
          else if (this.march(BAY_X + M.gap / 2, lobby, 32, dt, 8)) this.phase = "toVan";
        }
        break;
      }
      case "toVan":
        if (this.march(this.vanX, -1, 40, dt, 10)) {
          for (const u of this.units) u.sp.visible = false;
          this.cuffs.visible = false;
          this.phase = "leave";
        }
        break;
      case "leave":
        if (this.sirenOn && this.vanX - this.parkX > 120) { this.sirenOn = false; h.onSiren(false); }
        this.vanX += Math.min(260, 40 + (this.vanX - this.parkX) * 2.6) * dt;
        if (this.vanX > BUILDING_W + h.halfView + 140) this.phase = "done";
        break;
    }
    this.van.position.set(this.vanX, -1);
    // red/blue light sweeping over the facade while the van is on scene
    const parked = this.phase !== "drive" && this.phase !== "leave" && this.phase !== "done";
    this.washK += ((parked ? 1 : 0) - this.washK) * (1 - Math.exp(-3 * dt));
    this.wash.clear();
    if (this.washK > 0.02) {
      const top = levelY(Math.min(h.floors, this.homeLevel + 2), h.floors) - M.roomH;
      const sweep = (Math.sin(this.t * 5) + 1) / 2;
      this.wash.rect(-LIFT.w, top, BUILDING_W + LIFT.w, -top).fill({ color: on ? RED : BLUE, alpha: 0.1 * this.washK });
      this.wash.ellipse(this.vanX - 40 + sweep * 80, -10, 120, 60).fill({ color: on ? RED : BLUE, alpha: 0.16 * this.washK });
    }

    // "突入！" pops in with an overshoot, holds, then fades
    if (this.calloutT >= 0) {
      this.calloutT += dt;
      const ct = this.calloutT;
      this.callout.visible = ct < 1.3;
      const k = ct < 0.18 ? 0.4 + (ct / 0.18) * 0.8 : ct < 0.3 ? 1.2 - ((ct - 0.18) / 0.12) * 0.2 : 1;
      this.callout.scale.set(k);
      this.callout.alpha = ct > 1 ? 1 - (ct - 1) / 0.3 : 1;
      this.callout.position.set(this.doorX, home - M.roomH - 6);
      if (ct >= 1.3) this.calloutT = -1;
    }

    // splinters from the door, with gravity
    for (let k = this.chips.length - 1; k >= 0; k--) {
      const c = this.chips[k];
      c.life -= dt;
      c.vy += 320 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.g.position.set(c.x, c.y);
      c.g.rotation += c.spin * dt;
      c.g.alpha = Math.max(0, Math.min(1, c.life * 2));
      if (c.life <= 0 || c.y > home + 4) { c.g.destroy(); this.chips.splice(k, 1); }
    }

    // walk-cycle frames
    const H = M.roomH * 0.6;
    for (const u of this.units) {
      const pack = this.host.walks[u.keys[0]];
      if (!pack) continue;
      const moving = this.phase !== "stack" && this.phase !== "inside" && !(this.ride && this.ride.phase === "ride");
      u.sp.texture = pack.frames[moving ? Math.floor(u.ft * pack.fps) % pack.count : 0];
      const sc = (H * pack.heightK) / u.sp.texture.height;
      u.sp.scale.set(sc * u.dir, sc);
      u.sp.position.set(u.x, u.y);
    }
    if (this.suspect && this.cuffs.visible) this.cuffs.position.set(this.suspect.x, this.suspect.y - H - 9);
  }

  /** The tenant walks out between the officers (falls back to an officer-only escort without a walk pack). */
          addSuspect(home        ) {
    const keys = this.host.suspectKeys;
    const pack = keys.length ? this.host.walks[keys[0]] : null;
    if (!pack) return;
    const sp = new PIXI.Sprite(pack.frames[0]);
    sp.anchor.set(0.5, pack.anchorY);
    this.layer.addChildAt(sp, 1);
    const s       = { sp, x: this.doorX, y: home, dir: -1, ft: 0, keys: [keys[0]], suspect: true };
    // the suspect goes second in the line
    this.units.splice(1, 0, s);
    this.suspect = s;
    this.cuffs.visible = true;
  }

          spawnChips(x        , y        ) {
    for (let k = 0; k < 9; k++) {
      const g = new PIXI.Graphics();
      const w = 3 + Math.random() * 5, hgt = 1.5 + Math.random() * 2;
      g.rect(-w / 2, -hgt / 2, w, hgt).fill(k % 3 === 0 ? 0xc89a5e : 0xe0b77a).stroke({ width: 1, color: INK });
      this.layer.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 70 + Math.random() * 90;
      this.chips.push({ g, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: (Math.random() - 0.5) * 18, life: 0.9 + Math.random() * 0.4 });
    }
  }

  get done() { return this.phase === "done"; }
  /** True once the squad has the suspect — the room shows empty from then on. */
  get arrested() { return this.suspect !== null || this.phase === "toVan" || this.phase === "leave" || this.phase === "done"; }
  get squadVisible() { return this.units.length > 0 && this.units[0].sp.visible; }

  destroy() {
    if (this.sirenOn) { this.sirenOn = false; this.host.onSiren(false); }
    if (this.ride && this.ride.phase !== "done") this.host.lift.cancel(this.ride);
    this.layer.destroy({ children: true });
  }
}

export const RAID_FLOOR_H = FLOOR_H;
export const RAID_LIFT_W = LIFT.w;
