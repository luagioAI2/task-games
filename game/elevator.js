// The building's elevator: one car in a shaft against the left wall, serving lobby, every floor and the roof.
// Presentation only — residents ride it on outings; it never touches the economy.
// A ride is a contract between a walker and the car:
//   wait  → (car arrives, doors open)        → board (walker steps in, then marks "ride")
//   ride  → (doors close, travel, doors open) → exit  (walker steps out, then marks "done")
import * as PIXI from "pixi.js";
import { FLOOR_H, LIFT, LIFT_X, levelY } from "./layout.js";

                                                                    
                                                                                   

const DOOR_SEC = 0.35;
const SEC_PER_FLOOR = 0.55;
const MAX_TRAVEL = 2.5;
const INK = 0x22303d, SLATE = 0x344657, SLATE_LIGHT = 0x4c6178, PAPER = 0xfffaf0, GOLD = 0xf2b33d, LAMP = 0xffd98a, SAND = 0xf1db9e, CORAL = 0xef8354;

export const levelLabel = (level        , floors        ) => (level <= 0 ? "L" : level > floors ? "R" : `${level}F`);

export class Elevator {
  /** car body + cabin light — drawn behind the riders */
           back = new PIXI.Container();
  /** sliding doors, frame and floor display — drawn in front of the riders */
           front = new PIXI.Container();

          body = new PIXI.Graphics();
          doors = new PIXI.Graphics();
          display           ;
          shownLabel = "";
          drawnDoor = -1;

  level = 0;
  y = levelY(0, 1);
  door = 0;
          state                                                   = "idle";
          mode                                = "park";
          queue         = [];
          current              = null;
          target = 0;
          fromY = 0;
          toY = 0;
          dur = 1;
          tt = 0;
          openFor = 0;
          idleFor = 0;
          floors = 1;
  /** level the car parks at while idle (the floor the player is looking at) */
  parkLevel = 0;

  constructor(font        ) {
    const w = LIFT.carW, h = LIFT.carH;
    this.body.roundRect(-w / 2, -h, w, h, 2).fill(0xfff6df).stroke({ width: 2, color: INK });
    this.body.rect(-w / 2, -h, w, 7).fill(CORAL).stroke({ width: 2, color: INK });
    this.body.rect(-w / 2 + 3, -h + 9, w - 6, 3).fill({ color: LAMP, alpha: 0.9 });
    this.body.rect(-w / 2 + 2, -4, w - 4, 2).fill(SLATE_LIGHT);
    this.back.addChild(this.body);
    this.display = new PIXI.Text({ text: "L", style: { fontFamily: font, fontSize: 9, fontWeight: "800", fill: GOLD, padding: 2 } });
    this.display.anchor.set(0.5, 1);
    const panel = new PIXI.Graphics();
    panel.roundRect(-11, -h - 12, 22, 11, 2).fill(INK);
    this.front.addChild(this.doors, panel, this.display);
    this.display.position.set(0, -h - 2);
    this.place();
  }

  setFont(font        ) { this.display.style.fontFamily = font; }

  /** Ask for a ride; the walker keeps the returned object and watches its phase. */
  request(from        , to        , now        )       {
    const r       = { from, to, phase: "wait", since: now };
    this.queue.push(r);
    return r;
  }
  /** The walker vanished (moved out, new game): forget the ride. */
  cancel(r      ) {
    const k = this.queue.indexOf(r);
    if (k >= 0) this.queue.splice(k, 1);
    if (this.current === r) {
      this.current = null;
      this.mode = "park";
      if (this.state === "open" || this.state === "opening") this.state = "closing";
    }
    r.phase = "done";
  }
  reset() {
    this.queue.length = 0;
    this.current = null;
    this.mode = "park";
    this.state = "idle";
    this.door = 0;
    this.level = 0;
    this.y = levelY(0, this.floors);
    this.place();
  }

  /** Lamp states for the landings: levels with someone waiting, and the level the car is heading to. */
  waitingAt(level        ) { return this.queue.some((r) => r.from === level); }
  get headingTo() { return this.state === "move" ? this.target : -1; }
  get busy() { return this.state !== "idle"; }
  /** probe hook */
  get phase() { return this.state; }
  get doorOpen() { return this.door; }
  get queued() { return this.queue.length; }
  /** a ride that is neither queued nor being served (the car timed out on it) */
  lostRide(r      ) { return r.phase !== "done" && this.current !== r && !this.queue.includes(r); }

  update(dt        , floors        , now        ) {
    this.floors = floors;
    if (this.level > floors + 1) { this.level = floors + 1; this.y = levelY(this.level, floors); }
    switch (this.state) {
      case "idle": {
        const next = this.pick(now);
        if (next) {
          this.current = next;
          this.queue.splice(this.queue.indexOf(next), 1);
          this.mode = "pickup";
          this.goTo(next.from);
          this.idleFor = 0;
        } else {
          // nothing to do for a while: drift to where the player is looking, so the car is seen
          this.idleFor += dt;
          if (this.idleFor > 3 && Math.abs(this.parkLevel - this.level) > 2) {
            this.mode = "park";
            this.goTo(Math.max(0, Math.min(floors + 1, this.parkLevel)), true);
            this.idleFor = 0;
          }
        }
        break;
      }
      case "move": {
        this.tt = Math.min(1, this.tt + dt / this.dur);
        const e = this.tt < 0.5 ? 2 * this.tt * this.tt : 1 - Math.pow(-2 * this.tt + 2, 2) / 2;
        this.y = this.fromY + (this.toY - this.fromY) * e;
        if (this.tt >= 1) {
          this.y = this.toY;
          this.level = this.target;
          this.state = this.mode === "park" ? "idle" : "opening";
        }
        break;
      }
      case "opening":
        this.door = Math.min(1, this.door + dt / DOOR_SEC);
        if (this.door >= 1) {
          this.state = "open";
          this.openFor = 0;
          const r = this.current;
          if (r && this.mode === "pickup" && r.phase === "wait") r.phase = "board";
          if (r && this.mode === "deliver" && r.phase === "ride") r.phase = "exit";
        }
        break;
      case "open": {
        this.openFor += dt;
        const r = this.current;
        const boarded = r && this.mode === "pickup" && r.phase === "ride";
        const left = !r || (this.mode === "deliver" && r.phase === "done");
        // a walker that never shows up (scrolled away & dropped) must not hold the car forever
        if (boarded || left || this.openFor > 8) this.state = "closing";
        break;
      }
      case "closing":
        this.door = Math.max(0, this.door - dt / DOOR_SEC);
        if (this.door <= 0) {
          const r = this.current;
          if (r && this.mode === "pickup" && r.phase === "ride") {
            this.mode = "deliver";
            this.goTo(r.to);
          } else {
            this.current = null;
            this.mode = "park";
            this.state = "idle";
          }
        }
        break;
    }
    this.place();
  }

  /** Oldest request once it has waited a while, otherwise the nearest one. */
          pick(now        )              {
    if (!this.queue.length) return null;
    let best = this.queue[0];
    if (now - best.since > 10) return best;
    for (const r of this.queue) if (Math.abs(r.from - this.level) < Math.abs(best.from - this.level)) best = r;
    return best;
  }
          goTo(level        , park = false) {
    this.target = level;
    if (level === this.level) {
      this.state = park ? "idle" : "opening";
      return;
    }
    this.fromY = this.y;
    this.toY = levelY(level, this.floors);
    const floorsAway = Math.abs(this.toY - this.fromY) / FLOOR_H;
    this.dur = Math.max(0.8, Math.min(MAX_TRAVEL, floorsAway * SEC_PER_FLOOR));
    this.tt = 0;
    this.state = "move";
  }

          place() {
    this.back.position.set(LIFT_X, this.y);
    this.front.position.set(LIFT_X, this.y);
    const shownLevel = this.state === "move"
      ? Math.round(this.level + (this.target - this.level) * this.tt)
      : this.level;
    const label = levelLabel(shownLevel, this.floors);
    if (label !== this.shownLabel) { this.shownLabel = label; this.display.text = label; }
    const d = Math.round(this.door * 20);
    if (d !== this.drawnDoor) {
      this.drawnDoor = d;
      const w = LIFT.carW, h = LIFT.carH;
      const half = (w - 4) / 2;
      const open = half * (d / 20);
      this.doors.clear();
      // two leaves slide apart from the centre line
      if (half - open > 0.5) {
        this.doors.rect(-w / 2 + 2, -h + 9, half - open, h - 13).fill(SAND).stroke({ width: 1.2, color: INK });
        this.doors.rect(open, -h + 9, half - open, h - 13).fill(SAND).stroke({ width: 1.2, color: INK });
        this.doors.rect(-w / 2 + 2 + (half - open) - 3, -h + 26, 1.5, 10).fill(PAPER);
      }
      this.doors.roundRect(-w / 2, -h, w, h, 2).stroke({ width: 2, color: INK });
    }
  }
}

/** One floor's slice of the shaft: walls, rails, the landing door and its call lamp. */
export function drawShaftSlice(g               , top        , height        ) {
  const x0 = -LIFT.w;
  g.rect(x0, top, LIFT.w, height).fill(SLATE_LIGHT).stroke({ width: 2, color: INK });
  g.moveTo(x0 + 4, top).lineTo(x0 + 4, top + height).stroke({ width: 1.5, color: SLATE });
  g.moveTo(-4, top).lineTo(-4, top + height).stroke({ width: 1.5, color: SLATE });
  // counterweight cables
  g.moveTo(x0 + LIFT.w * 0.5 - 3, top).lineTo(x0 + LIFT.w * 0.5 - 3, top + height).stroke({ width: 1, color: INK, alpha: 0.5 });
}
/** Landing-door frame on the building wall at the bottom of a slice, plus the lamp's housing. */
export function drawLanding(g               , floorY        ) {
  const h = LIFT.carH + 2;
  g.rect(-3, floorY - h, 5, h).fill(PAPER).stroke({ width: 1.2, color: INK });
  g.circle(-LIFT.w / 2, floorY - h - 7, 3.2).fill(SLATE_LIGHT).stroke({ width: 1, color: INK });
}
export const LAMP_ON = GOLD;
