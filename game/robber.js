// Burglar scene (GAME_DESIGN §4f). Presentation only: the sim owns robbery state.
// One masked burglar sneaks: street → lobby → elevator/stairs → door, pries, then either
// flees with the loot or the squad catches him (agents live in Raid).
import * as PIXI from "pixi.js";
import { SECOND_X, BUILDING_W, LIFT, LIFT_X, LOBBY_Y, M, BAY_X, colX, levelY } from "./layout.js";
                                                    
                                           

                             
                                  
                 
                 
                     
 

export class Robber {
           room        ;
           layer = new PIXI.Container();
  phase                                                                                  = "street";
          sp             ;
          x        ;         y        ;         dir = 1;
          ft = 0;
          host            ;
          ride              = null;
          homeLevel        ;
          doorX        ;
          useLift         ;
          t = 0;
          waitT = 0;

  constructor(room        , host            ) {
    this.room = room;
    this.host = host;
    this.homeLevel = Math.floor((room % 2000) / 4) + 1;
    this.doorX = (Math.floor(room / 2000) ? SECOND_X : 0) + colX(room % 4) + M.roomW / 2;
    this.useLift = this.homeLevel > 1;
    const pack = host.packs["walk-burglar"];
    this.sp = new PIXI.Sprite(pack ? pack.frames[0] : PIXI.Texture.WHITE);
    if (pack) this.sp.anchor.set(0.5, pack.anchorY);
    this.layer.addChild(this.sp);
    this.x = -LIFT.w - 40;
    this.y = -1;
  }

          yAt(level        ) { return levelY(level, this.host.floors); }

          move(tx        , ty        , speed        , dt        )          {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    const len = speed * dt;
    if (d <= len) { this.x = tx; this.y = ty; return true; }
    this.x += (dx / d) * len; this.y += (dy / d) * len;
    if (Math.abs(dx) > 0.5) this.dir = dx > 0 ? 1 : -1;
    this.ft += dt;
    return false;
  }

  update(dt        ) {
    this.t += dt;
    if (this.t > 75 && this.phase !== "done") { this.phase = "done"; }
    const h = this.host;
    switch (this.phase) {
      case "street": if (this.move(BUILDING_W / 2 - 60, LOBBY_Y, 52, dt)) this.phase = "lobby"; break;
      case "lobby": {
        const tx = this.useLift ? LIFT_X + 10 : BAY_X + M.gap / 2;
        if (this.move(tx, LOBBY_Y, 52, dt)) {
          if (this.useLift) { this.ride = h.lift.request(0, this.homeLevel, 0); this.phase = "wait"; }
          else this.phase = "out";
        }
        break;
      }
      case "wait":
        if (this.ride) {
          if (this.ride.phase === "board") { if (this.move(LIFT_X, this.yAt(0), 46, dt)) { this.ride.phase = "ride"; this.phase = "ride"; } }
          else if (h.lift.lostRide(this.ride)) this.ride = h.lift.request(0, this.homeLevel, 0);
        }
        break;
      case "ride": {
        const r = this.ride ;
        if (r.phase === "ride") { this.x = LIFT_X; this.y = h.lift.y; }
        else if (r.phase === "exit" || r.phase === "done") { this.ride = null; this.phase = "out"; }
        break;
      }
      case "out": {
        const home = this.yAt(this.homeLevel);
        if (Math.abs(this.y - home) > 0.5) { this.move(this.x, home, 46, dt); break; }
        if (this.move(this.doorX - 20, home, 46, dt)) { this.phase = "door"; this.waitT = 0.4; }
        break;
      }
      case "door":
        this.waitT -= dt;
        if (this.waitT <= 0) { this.host.onPryStart(); this.phase = "pry"; }
        break;
      default:
        break;
    }
    const pack = h.packs["walk-burglar"];
    if (pack) {
      const riding = this.phase === "ride" && this.ride && this.ride.phase === "ride";
      const moving = this.phase !== "door" && this.phase !== "pry" && !riding;
      this.sp.texture = pack.frames[moving ? Math.floor(this.ft * pack.fps) % pack.count : 0];
      const sc = ((M.roomH * 0.6) * pack.heightK) / this.sp.texture.height;
      this.sp.scale.set(sc * this.dir, sc);
    }
    const py = this.phase === "pry" ? this.yAt(this.homeLevel) - M.roomH * 0.18 : this.y;
    this.sp.position.set(this.x, py);
    this.sp.scale.y = this.phase === "pry" ? Math.abs(this.sp.scale.y) * 0.92 : Math.abs(this.sp.scale.y);
  }

  get prying() { return this.phase === "pry"; }
  get onDoor() { return this.phase === "door" || this.phase === "pry"; }
  get pos() { return { x: this.x, y: this.phase === "pry" ? this.yAt(this.homeLevel) - M.roomH * 0.18 : this.y }; }
  get done() { return this.phase === "done" || this.phase === "flee"; }
  runAway() { if (this.phase !== "done") this.phase = "flee"; }
  destroy() {
    if (this.ride && this.ride.phase !== "done") this.host.lift.cancel(this.ride);
    this.layer.destroy({ children: true });
  }
}
