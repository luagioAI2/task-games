// Cross-section building view: floors stacked as slabs, four room cells per floor around a stair bay.
// Up to 100 floors: the building scrolls vertically, floors are built lazily when they first come into view,
// and only on-screen floors are updated each frame.
import * as PIXI from "pixi.js";
import { BUILDING_W, FULL_W, FLOOR_H, INSETS, LIFT, LIFT_X, LOBBY_Y, M, BAY_X, buildingHeight, colX, floorTop, levelY, SECOND_X, TOWER_FLOORS, towerX, towerFloorTop, spanW, spanMidX } from "./layout.js";
import { BASEMENT, MAX_FLOORS, MAX_LV, ROOMS_PER_FLOOR, SAT_MAX, TENANT_TYPES } from "./data.js";
                                          
                                           
import { LoungePlayer,                } from "./lounge.js";
import { Weather } from "./weather.js";
import { Raid } from "./raid.js";
import { Robber } from "./robber.js";
import { Elevator, LAMP_ON, drawLanding, drawShaftSlice,           } from "./elevator.js";

export const PAL = {
  ink: 0x22303d, slate: 0x344657, slateLight: 0x4c6178, sand: 0xf1db9e, cream: 0xfbf3dc,
  paper: 0xfffaf0, coral: 0xef8354, coralDark: 0xc9623a, sky: 0x357ca5, leaf: 0x729b60,
  gold: 0xf2b33d, lamp: 0xffd98a, heart: 0xe8604c, road: 0x8d99a6, curb: 0xc9c4b6,
}         ;

let FONT = "system-ui,sans-serif";
export function setCanvasFont(f        ) { FONT = f; }

const FIXTURE_TEX                         = {
  2: "fx_aircon", 3: "fx_bath", 4: "fx_kitchen", 5: "fx_dryer",
  6: "fx_tv", 7: "fx_shelf", 9: "fx_chandelier", 10: "fx_rug",
};
/** Members walking together (couple, family); everyone else is a single walker. */
const WALK_KEY                           = {
  couple: ["walk-couple-a", "walk-couple-b"],
  family: ["walk-family-a", "walk-family-b"],
};
const SINGLE_WALK                         = Object.fromEntries(TENANT_TYPES.map((t) => [t.kind, "walk-" + t.kind]));
const walkKeys = (kind        )           => WALK_KEY[kind] ?? (SINGLE_WALK[kind] ? [SINGLE_WALK[kind]] : []);
/** Opening activity per tenant type — couples and families go out together, students like the roof. */
const OUTING_CHANCE                         = {
  student: 0.55, gamer: 0.3, retiree: 0.45, office: 0.4, artist: 0.5, family: 0.35,
  couple: 0.35, chef: 0.45, athlete: 0.55, doctor: 0.3, celebrity: 0.25, ceo: 0.3,
};
const TENANT_TEX                         = Object.fromEntries(
  TENANT_TYPES.map((t) => [t.kind, `tenant_${t.kind}`]),
);
const PAIR_KINDS = new Set(["couple", "family"]);
// fixture centre + height as fractions of the room cell
const FIX_POS                                                      = {
  2: { x: 0.25, y: 0.15, h: 0.12 },  // wall AC, upper-left
  3: { x: 0.25, y: 0.76, h: 0.30 },  // unit bath, lower-left
  4: { x: 0.76, y: 0.70, h: 0.40 },  // system kitchen, right
  5: { x: 0.76, y: 0.11, h: 0.12 },  // ceiling dryer, upper-right
  6: { x: 0.17, y: 0.45, h: 0.20 },  // wall TV, left wall
  7: { x: 0.78, y: 0.34, h: 0.22 },  // shelf + plant, right wall
  9: { x: 0.52, y: 0.15, h: 0.17 },  // chandelier replaces the bulb
  10: { x: 0.5, y: 0.905, h: 0.12 }, // rug under the furniture
};
const ROOM_INNER = { x: 0, y: M.slab, w: M.roomW, h: M.roomH };
/** Smallest scale before the building scrolls instead of shrinking further (rooms stay ≥ ~53px wide). */
const MIN_SCALE = 0.6;
/** Extra top inset while scrolling: the HUD's floor-navigation row sits there. */
const NAV_ROW = 54;
const SKY_LOW = 0xbde1f3, SKY_HIGH = 0x8ec4e6;

                    
                    
                                                                                                     
                                           
                                                                                                
                                                                                                                                
                                                                                  
                                                                                           
                                                                                
                                                             
                                                                                 
                
                                                                                           
                                                                              
                                                                                                                           
                                                                                                
                 
 

/** One resident walking outside their room. `room` is where they return to. */
           
                                                      
                                                                                          
                                              
                  
                  
                                                                                                            
                                                                                             
                                                                                    
              
 
                                                                                                                    
/** Where a walker stands to wait for the car: just inside the building's left wall. */
const LANDING_X = 9;

const clamp01 = (v        ) => Math.max(0, Math.min(1, v));
function lerpColor(a        , b        , k        ) {
  const ch = (s        ) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export class BuildingView {
  /** Screen-space backdrop (sky, city, street) — never scaled with the building. */
           backdrop = new PIXI.Container();
  /** The building itself, in building-local units. */
           root = new PIXI.Container();
  /** FX world: same local basis as the rooms. */
           fxWorld = new PIXI.Container();

          tex                              ;
          walks                          ;
          motions                           ;
  /** storm overlay reads this to silence gestures and hide the street */
          storming = false;
          raid              = null;
          alertLayer = new PIXI.Container();
          alertMark                                          = null;
  /** hooks the host game wires for raid feedback */
  onBreach                         = () => {};
  onRadio             = () => {};
  /** raid wants the siren loop on/off while the van is on scene */
  onSiren                        = () => {};
  onRaidDone                         = () => {};
          shutRooms = new Set        ();
           weather         ;
          renderer               ;
  /** Residents currently outside their rooms (drawn above the floors, inside the building local space). */
          walkers           = [];
  /** underground tiers below the street (filled by syncBasement) */
           basementC = new PIXI.Container();
          builtBasement = -1;
          walkLayer = new PIXI.Container();
  /** the building's single elevator (presentation only) */
           lift          ;
          lobbyLamp = new PIXI.Graphics();
          roofLamp = new PIXI.Graphics();
          lampOn = { lobby: false, roof: false };
          activityTimer = 6;
  /** Probe switch: false stops new outings from being scheduled automatically. */
  autoOutings = true;
          bg             ;
          sky = new PIXI.Graphics();
          street = new PIXI.Graphics();
          base = new PIXI.Container();
          floorsLayer = new PIXI.Container();
          roofC = new PIXI.Container();
  /** null = not built yet (built the first time it scrolls into view) */
          floors                       = [];
          pendingSlide = -1;
          lounge                     = null;
          ghost = new PIXI.Graphics();
          ghostFor = -1;
          vacantText = "募集中";
          signTex                      = null;
          ctx                                       = {};
          pipCtx                         = [];
          t = 0;
          rubble                                                                            = [];
  /** debris flies out of a collapsing room (world coords) */
  rubbleBurst(i        , n = 6) {
    const keys = ["debris_plank", "debris_tile", "debris_leaf"];
    const f2 = Math.floor(i / ROOMS_PER_FLOOR);
    const x = towerX(f2) + colX(Math.floor(i % ROOMS_PER_FLOOR)) + M.roomW / 2;
    const y = towerFloorTop(f2) + M.slab + M.roomH * 0.5;
    for (let k = 0; k < n; k++) {
      const tex = this.tex[keys[k % keys.length]];
      if (!tex) continue;
      const bubbly = new PIXI.Sprite(tex);
      bubbly.anchor.set(0.5);
      bubbly.scale.set((M.roomW * 0.18) / tex.width);
      bubbly.x = x + (Math.random() - 0.5) * M.roomW * 0.7;
      bubbly.y = y + (Math.random() - 0.5) * M.roomH * 0.5;
      this.fxWorld.addChild(bubbly);
      this.rubble.push({ sp: bubbly, vx: (Math.random() - 0.5) * 220, vy: -(60 + Math.random() * 240), spin: (Math.random() - 0.5) * 12, life: 1.4 + Math.random() * 0.5 });
    }
    while (this.rubble.length > 80) { this.rubble[0].sp.destroy(); this.rubble.shift(); }
  }
  /** probe: how much rubble is currently airborne */
  rubbleCount() { return this.rubble.length; }
          scaleK = 0;
          sink = 0;
          vw = 390;
          vh = 669;
          camMin = 0;
          sel = -1;
  /** extra upward shift so a selected room near the ground stays above the bottom sheet */
          pan = 0;
          panTarget = 0;
          sheetH = 0;
          sideInset = 0;
          selKey = "";
  // ---- camera: cam 0 = ground at the bottom, 1 = roof at the top; over = overflow in screen px
          cam = 0;
          camGoal                = null;
          camVel = 0;
          over = 0;
          dragging = false;
          scrolling = false;
          topInset         = INSETS.top;
  // ---- 2棟目: 0 = both towers side by side, 1 / 2 = zoomed onto that tower
          twinMode            = 1;
          pivotX = -1;
  /** Which part of the lot the camera frames (only matters once the 2nd tower stands). */
  setTwinMode(m           ) { if (m !== this.twinMode) { this.twinMode = m; this.selKey = ""; } }
  get twinView() { return this.twinMode; }
          topFloorsSeen = -1;
          twins                        = null;
          visLo = 0;
          wantTop = false;
          wantReveal = -1;
          evictTick = 0;
          visHi = 0;

  constructor(tex                              , walks                          , renderer               , lounge                            = {}) {
    this.motions = lounge;
    this.weather = new Weather(tex.typhoon_cloud, [tex.debris_plank, tex.debris_tile, tex.debris_leaf]);
    this.tex = tex;
    this.walks = walks;
    this.renderer = renderer;
    this.bg = new PIXI.Sprite(tex.bg_city);
    this.bg.anchor.set(0.5, 1);
    this.backdrop.addChild(this.sky, this.bg, this.street, this.weather.back);

    const { y, w, h } = ROOM_INNER;
    // static per-room drawings are shared contexts — 400 rooms must not mean 400 copies of each shape
    this.ctx.lamp = new PIXI.GraphicsContext().rect(0, y, w, h).fill({ color: PAL.lamp, alpha: 0.13 })
      .circle(w / 2, y + h * 0.13, 16).fill({ color: 0xfff1c4, alpha: 0.38 });
    const heat = new PIXI.GraphicsContext();
    for (let k = 0; k < 5; k++) heat.rect(6 + k * ((w - 12) / 5), y + h - 5, (w - 12) / 5 - 4, 2.5).fill(PAL.coral);
    this.ctx.heat = heat;
    this.ctx.flash = new PIXI.GraphicsContext().rect(0, y, w, h).fill(0xffffff);
    // storm shutters: slatted steel panel over the room front, drawn once and shared
    const sh = new PIXI.GraphicsContext().rect(2, y + 2, w - 4, h - 4).fill(PAL.slateLight).stroke({ width: 2, color: PAL.ink });
    for (let sy = y + 9; sy < y + h - 4; sy += 7) sh.moveTo(4, sy).lineTo(w - 4, sy);
    sh.stroke({ width: 1.2, color: PAL.slate });
    sh.rect(w / 2 - 7, y + h - 12, 14, 4).fill(PAL.sand).stroke({ width: 1, color: PAL.ink });
    this.ctx.shutter = sh;
    this.ctx.frame = new PIXI.GraphicsContext().rect(0, y, w, h).stroke({ width: 1.5, color: PAL.ink, alpha: 0.9 });
    this.ctx.gold = new PIXI.GraphicsContext().rect(1.5, y + 1.5, w - 3, h - 3).stroke({ width: 3, color: PAL.gold })
      .rect(4, y + 4, w - 8, h - 8).stroke({ width: 1, color: PAL.gold, alpha: 0.7 });
    this.ctx.glow = new PIXI.GraphicsContext().circle(w - 12, y + 11, 11).fill(PAL.heart);
    for (let lv = 0; lv <= MAX_LV; lv++) {
      const g = new PIXI.GraphicsContext();
      for (let k = 0; k < MAX_LV; k++) {
        const px = 8 + (k % 5) * 8, py = y + 8 + Math.floor(k / 5) * 8;
        g.circle(px, py, 3).fill(k < lv ? PAL.gold : 0xffffff).stroke({ width: 1.3, color: PAL.ink });
      }
      this.pipCtx.push(g);
    }
    this.makeSignTexture();

    this.lift = new Elevator(FONT);
    // tower at street level: the lobby landing
    const lobbyShaft = new PIXI.Graphics();
    drawShaftSlice(lobbyShaft, -M.sidewalk - M.lobby, M.lobby);
    drawLanding(lobbyShaft, -M.sidewalk);
    this.lobbyLamp.circle(-LIFT.w / 2, -M.sidewalk - LIFT.carH - 9, 2.6).fill(LAMP_ON);
    this.lobbyLamp.visible = false;
    const walk = new PIXI.Graphics();
    walk.rect(-LIFT.w - 8, -M.sidewalk, FULL_W + 16, M.sidewalk).fill(PAL.curb).stroke({ width: 2, color: PAL.ink });
    const lobby = new PIXI.Sprite(tex.lobby);
    lobby.x = 0; lobby.y = -M.sidewalk - M.lobby; lobby.width = BUILDING_W; lobby.height = M.lobby;
    const lobbyEdge = new PIXI.Graphics();
    lobbyEdge.rect(0, -M.sidewalk - M.lobby, BUILDING_W, M.lobby).stroke({ width: 2, color: PAL.ink });
    this.base.addChild(lobbyShaft, this.lobbyLamp, lobby, lobbyEdge, walk);

    const roof = new PIXI.Sprite(tex.roof);
    roof.anchor.set(0, 1);
    roof.width = BUILDING_W + 6; roof.height = M.roof;
    roof.x = -3; roof.y = 2;
    // machine room on top of the shaft + the roof landing
    const machine = new PIXI.Graphics();
    // the lift penthouse: tall enough to house the car when it stops at the roof
    machine.rect(-LIFT.w, -LIFT.carH - 14, LIFT.w + 2, LIFT.carH + 16).fill(PAL.slate).stroke({ width: 2, color: PAL.ink });
    machine.rect(-LIFT.w + 6, -LIFT.carH - 10, LIFT.w - 12, 4).fill(PAL.slateLight);
    machine.rect(-LIFT.w - 3, -LIFT.carH - 17, LIFT.w + 8, 4).fill(PAL.cream).stroke({ width: 1.5, color: PAL.ink });
    drawLanding(machine, 0);
    this.roofLamp.circle(-LIFT.w / 2, -LIFT.carH - 9, 2.6).fill(LAMP_ON);
    this.roofLamp.visible = false;
    this.roofC.addChild(roof, machine, this.roofLamp);

    this.root.addChild(this.basementC, this.ghost, this.base, this.floorsLayer, this.roofC, this.lift.back, this.walkLayer, this.lift.front, this.alertLayer, this.fxWorld);
    this.root.pivot.x = (BUILDING_W + LIFT.w) / 2 - LIFT.w;
  }

  // ---------------------------------------------------------------- vacancy sign (one shared texture)

          makeSignTexture() {
    const c = new PIXI.Container();
    const txt = new PIXI.Text({ text: this.vacantText, style: { fontFamily: FONT, fontSize: 14, fontWeight: "700", fill: PAL.ink, padding: 4 } });
    txt.anchor.set(0.5);
    const bw = Math.max(52, txt.width + 16), bh = 26;
    const board = new PIXI.Graphics();
    board.moveTo(-bw * 0.3, -bh / 2).lineTo(0, -bh / 2 - 9).lineTo(bw * 0.3, -bh / 2).stroke({ width: 1.5, color: PAL.ink });
    board.circle(0, -bh / 2 - 9, 2).fill(PAL.ink);
    board.roundRect(-bw / 2, -bh / 2, bw, bh, 4).fill(PAL.paper).stroke({ width: 2, color: PAL.ink });
    c.addChild(board, txt);
    const old = this.signTex;
    this.signTex = this.renderer.generateTexture({ target: c, resolution: 3, antialias: true });
    // the board's centre must land on the sprite anchor: record where (0,0) sits inside the bounds
    const b = c.getLocalBounds();
    this.signAnchor = { x: -b.x / b.width, y: -b.y / b.height };
    c.destroy({ children: true });
    for (const f of this.floors) if (f) for (const rv of f.rooms) {
      rv.signSp.texture = this.signTex;
      rv.signSp.anchor.set(this.signAnchor.x, this.signAnchor.y);
    }
    if (old) old.destroy(true);
  }
          signAnchor = { x: 0.5, y: 0.5 };

  setVacantLabel(text        , font        ) {
    this.vacantText = text;
    FONT = font;
    this.lift.setFont(font);
    this.makeSignTexture();
  }

  // ---------------------------------------------------------------- structure

  /** Track the floor count. `animateNew` slides the newest floor in and scrolls up to it. */
  sync(s           , animateNew = false) {
    while (this.floors.length < s.floors) this.floors.push(null);
    while (this.floors.length > s.floors) this.floors.pop()?.root.destroy({ children: true });
    if (animateNew) {
      this.sink = 1;
      this.pendingSlide = s.floors - 1;
      const top = this.floors[s.floors - 1];
      if (top) top.slide = 1;
      // the next frame knows whether the taller building scrolls; ask for the top unconditionally
      // (2nd tower: bring its newest floor into view instead — tower 1 may be far taller)
      if (s.floors > TOWER_FLOORS) this.wantReveal = (s.floors - 1) * ROOMS_PER_FLOOR;
      else this.wantTop = true;
    }
  }

  /** Probe: screen-pixel edges of the building span (left tower edge / right wall). */
  frameInfo(floors        ) {
    const sc = this.scaleK || 1;
    return { rootX: this.root.x, sc, pivotX: this.root.pivot.x, left: this.root.x + (-LIFT.w - this.root.pivot.x) * sc, right: this.root.x + (BUILDING_W - this.root.pivot.x) * sc, vw: this.vw };
  }

          buildFloor(f        )            {
    const root = new PIXI.Container();
    root.x = towerX(f);
    root.y = towerFloorTop(f);
    // stair / elevator bay slice (between column 1 and 2) — drawn behind the slab
    const stair = new PIXI.Sprite(this.tex.stair_core);
    stair.x = BAY_X; stair.y = M.slab; stair.width = M.gap; stair.height = M.roomH;
    const walls = new PIXI.Graphics();
    drawShaftSlice(walls, M.slab, M.roomH);
    walls.rect(0, M.slab, M.side, M.roomH).fill(PAL.slate).stroke({ width: 2, color: PAL.ink });
    drawLanding(walls, FLOOR_H);
    walls.rect(BUILDING_W - M.side, M.slab, M.side, M.roomH).fill(PAL.slate).stroke({ width: 2, color: PAL.ink });
    walls.rect(BAY_X, M.slab, M.gap, M.roomH).stroke({ width: 1.5, color: PAL.ink });
    walls.rect(BAY_X, M.slab + M.roomH * 0.66, M.gap, M.roomH * 0.34).fill(PAL.slateLight).stroke({ width: 1.5, color: PAL.ink });
    root.addChild(stair, walls);
    const rooms             = [];
    for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
      const rv = this.buildRoom();
      rv.c.x = colX(c);
      root.addChild(rv.c);
      rooms.push(rv);
    }
    const slab = new PIXI.Graphics();
    slab.rect(-LIFT.w - 4, 0, FULL_W + 8, M.slab).fill(PAL.slate).stroke({ width: 2, color: PAL.ink });
    slab.rect(-LIFT.w - 4, 0, FULL_W + 8, 2.5).fill(PAL.slateLight);
    root.addChild(slab);
    // floor number on the slab every 5 floors — orientation in a tall building
    const lf = f % TOWER_FLOORS;
    if ((lf + 1) % 5 === 0 || lf === 0) {
      const tag = new PIXI.Text({ text: `${lf + 1}F`, style: { fontFamily: FONT, fontSize: 9, fontWeight: "800", fill: PAL.paper, padding: 2 } });
      tag.anchor.set(0, 0.5);
      tag.position.set(-LIFT.w + 2, M.slab / 2 + 0.5);
      root.addChild(tag);
    }
    for (const rv of rooms) root.addChild(rv.select);
    const lamp = new PIXI.Graphics();
    lamp.circle(-LIFT.w / 2, FLOOR_H - LIFT.carH - 9, 2.6).fill(LAMP_ON);
    lamp.visible = false;
    root.addChild(lamp);
    const fv            = { root, rooms, slide: f === this.pendingSlide ? 1 : 0, lamp, lampOn: false };
    if (f === this.pendingSlide) this.pendingSlide = -1;
    return fv;
  }

          buildRoom()           {
    const { y, w, h } = ROOM_INNER;
    const c = new PIXI.Container();
    const bg = new PIXI.Sprite(this.tex.room_base);
    bg.y = y; bg.width = w; bg.height = h;
    const dim = new PIXI.Sprite(this.tex.room_base_dim);
    dim.y = y; dim.width = w; dim.height = h;
    const lux = new PIXI.Sprite(this.tex.room_lux);
    lux.y = y; lux.width = w; lux.height = h; lux.visible = false;
    const luxDim = new PIXI.Sprite(this.tex.room_lux_dim);
    luxDim.y = y; luxDim.width = w; luxDim.height = h; luxDim.visible = false;
    const frameGold = new PIXI.Graphics(this.ctx.gold);
    frameGold.visible = false;
    const lamp = new PIXI.Graphics(this.ctx.lamp);
    const heat = new PIXI.Graphics(this.ctx.heat);
    heat.visible = false;
    const fixLayer = new PIXI.Container();
    const sign = new PIXI.Container();
    const signSp = new PIXI.Sprite(this.signTex ?? PIXI.Texture.EMPTY);
    signSp.anchor.set(this.signAnchor.x, this.signAnchor.y);
    signSp.scale.set(1 / 3 * 3); // generated at 3× resolution; the texture reports logical size
    sign.addChild(signSp);
    sign.position.set(w / 2, y + h * 0.42);
    const pips = new PIXI.Graphics(this.pipCtx[1]);
    const satGlow = new PIXI.Graphics(this.ctx.glow);
    satGlow.visible = false;
    const sat = new PIXI.Graphics();
    const flash = new PIXI.Graphics(this.ctx.flash);
    flash.alpha = 0;
    const frame = new PIXI.Graphics(this.ctx.frame);
    const damage = new PIXI.Container();
    const stain = new PIXI.Sprite(this.tex.fx_stain);
    stain.anchor.set(0.5);
    stain.position.set(w * 0.7, y + h * 0.36);
    stain.scale.set((h * 0.5) / this.tex.fx_stain.height);
    stain.alpha = 0.85;
    const breach = new PIXI.Sprite(this.tex.fx_breach);
    breach.anchor.set(0.5);
    breach.position.set(w * 0.3, y + h * 0.38);
    breach.scale.set((h * 0.5) / this.tex.fx_breach.height);
    const scorch = new PIXI.Sprite(this.tex.fx_scorch);
    scorch.anchor.set(0.5);
    scorch.position.set(w * 0.3, y + h * 0.38);
    scorch.scale.set((h * 0.62) / this.tex.fx_scorch.height);
    const board = new PIXI.Sprite(this.tex.fx_board);
    board.anchor.set(0.5);
    board.position.set(w * 0.3, y + h * 0.38);
    board.scale.set((h * 0.42) / this.tex.fx_board.height);
    board.rotation = -0.08;
    damage.addChild(stain, breach, scorch, board);
    damage.visible = false;
    const shutter = new PIXI.Graphics(this.ctx.shutter);
    shutter.visible = false;
    c.addChild(bg, dim, lux, luxDim, lamp, heat, fixLayer, sign, damage, shutter, flash, frame, frameGold, pips, satGlow, sat);
    const select = new PIXI.Graphics();
    return {
      c, bg, dim, lux, luxDim, frameGold, lamp, heat, fixLayer, fixtures: new Map(), person: null, personBase: 1, personKind: "", lounge: null, tvGlow: null,
      homeX: 0.5, homeXTo: 0.5, homeYOff: 0, homeYOffTo: 0, nextMoveAt: 4 + Math.random() * 20,
      sign, signSp, pips, pipLv: 1, sat, satGlow, satKey: -1, select, selDrawn: false, flash,
      cheer: 0,
      bob: Math.random() * 6.28, pop: 0, fresh: true, damage, shutter, dmgT: 1, dmgCause: "storm", breach, scorch,
    };
  }

  // ---------------------------------------------------------------- camera

  /** Typhoon phase from the sim: 0 calm, 1 forecast, 2 passage. Also which rooms have shutters down. */
  setStorm(phase                               , shut          ) {
    this.weather.setTarget(phase === "storm" ? 1 : phase === "forecast" ? 0.35 : 0);
    this.storming = phase === "storm";
    if (shut.length !== this.shutRooms.size || shut.some((i) => !this.shutRooms.has(i))) this.shutRooms = new Set(shut);
  }
  /** A suspected tenant: red "!" over the room, bobbing. Pass -1 to clear. */
          alertFor = -1;
  setAlert(room        ) {
    if (room === this.alertFor) return;
    this.alertFor = room;
    if (this.alertMark) { this.alertMark.c.destroy({ children: true }); this.alertMark = null; }
    if (room < 0) return;
    const f = Math.floor(room / ROOMS_PER_FLOOR);
    const top = towerFloorTop(f) + M.slab;
    const c = new PIXI.Container();
    c.position.set(towerX(f) + colX(room % ROOMS_PER_FLOOR) + M.roomW / 2, top + 12);
    const g = new PIXI.Graphics();
    g.moveTo(0, -9).lineTo(8, 7).lineTo(-8, 7).fill(PAL.heart).stroke({ width: 2, color: PAL.ink });
    const txt = new PIXI.Text({ text: "!", style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: PAL.paper, padding: 2 } });
    txt.anchor.set(0.5, 0.75);
    c.addChild(g, txt);
    this.alertLayer.addChild(c);
    this.alertMark = { c, t: 0 };
  }

  /** Start the police raid animation for room i (the sim has already switched to the raid phase). */
  startRaid(s           , room        , bubbleText        , calloutText        , suspectKeys           ) {
    this.raid?.destroy();
    this.cancelVisit();
    const o = s.rooms[room]?.occupant;
    const keys = suspectKeys ?? (o ? walkKeys(o.kind) : []);
    const halfView = (this.vw / Math.max(0.2, this.scaleK)) / 2;
    this.raid = new Raid(room, this.tex.police_van, {
      walks: this.walks, lift: this.lift, floors: s.floors, halfView, now: this.t,
      onBreach: (r) => this.onBreach(r), onRadio: () => this.onRadio(), onSiren: (on) => this.onSiren(on),
      suspectKeys: keys,
    }, bubbleText, FONT, calloutText);
    this.root.addChildAt(this.raid.layer, this.root.getChildIndex(this.alertLayer) + 1);
  }
  get raidActive() { return !!this.raid; }
  get raidPhase() { return this.raid ? this.raid.phase : "none"; }
  get raidArrested() { return !!this.raid?.arrested; }
  // ---------- burglary scene: masked burglar walks in from the street, pries, flees or gets arrested
          robber                = null;
  onRobberyPry             = () => {};
  onRobberyHiveTxt         = "";
  /** typhoon incident sim started a robbery: build the scene for room i */
  startRobbery(s           , room        ) {
    this.robber?.destroy();
    this.robber = new Robber(room, { packs: this.walks, lift: this.lift, floors: s.floors, onPryStart: () => this.onRobberyPry() });
    this.root.addChildAt(this.robber.layer, this.root.getChildIndex(this.alertLayer));
  }
  /** sim switched to the loot phase: no-op visually (scene already has the door-pry stage) */
  get robberyPrying() { return this.robber?.prying ?? false; }
  get robberyRoom() { return this.robber?.room ?? -1; }
  /** ends the scene: caught by the squad (the raid covers the arrest), or got away */
  endRobbery(caught         ) {
    if (caught) { this.robber?.destroy(); this.robber = null; }
    else this.robber?.runAway();
  }
          updateRobber(dt        ) {
    const rb = this.robber;
    if (!rb) return;
    rb.update(dt);
    if (rb.done) { rb.destroy(); this.robber = null; }
  }
          updateRaid(dt        ) {
    const r = this.raid;
    if (!r) return;
    r.update(dt);
    if (r.done) {
      const room = r.room;
      r.destroy();
      this.raid = null;
      this.onRaidDone(room);
    }
  }
  setSheetHeight(px        ) { this.sheetH = px; }
  /** Wide window: shift the building off-centre so a right-side panel never covers it. */
  setSideInset(px        ) { this.sideInset = px; }
  setSelection(i        ) { this.sel = i; }
  get scale() { return this.scaleK; }
  /** True when the building is taller than the screen and scrolls. */
  get isScrolling() { return this.scrolling; }
  get camera() { return this.cam; }
  /** 1-based floor numbers currently on screen. */
          visBase = 0;
  /** visible floor band, numbered within the framed tower (2nd tower: its own 1F..) */
  get visibleFloors()                   { return [this.visLo + 1 - this.visBase, this.visHi + 1 - this.visBase]; }
  get visibleTower()        { return this.visBase ? 2 : 1; }
  get topInsetPx() { return this.topInset; }

  /** Finger/mouse drag: dy in screen px, positive = content follows the finger downward (shows higher floors). */
  dragBy(dy        ) {
    if (!this.scrolling || this.over <= 0) return;
    this.dragging = true;
    this.camGoal = null;
    this.camVel = 0;
    this.cam = Math.max(this.camMin, Math.min(1, this.cam + dy / this.over));
  }
  /** Release with the finger's speed (px/s) for a short fling. */
  release(vPxPerSec        ) {
    this.dragging = false;
    if (this.over > 0) this.camVel = Math.max(-3, Math.min(3, vPxPerSec / this.over));
  }
  /** Wheel / keyboard: animated scroll by dy screen px. */
  scrollBy(dy        ) {
    if (!this.scrolling || this.over <= 0) return;
    this.dragging = false;
    this.camVel = 0;
    this.camGoal = Math.max(this.camMin, Math.min(1, (this.camGoal ?? this.cam) + dy / this.over));
  }
  /** A new touch stops any fling or animated scroll in progress. */
  cancelScrollAnim() { this.camVel = 0; this.camGoal = null; }
  scrollToTop() { if (this.scrolling) { this.dragging = false; this.camGoal = 1; this.camVel = 0; } }

          syncBasement(s           ) {
    const n = s.basement;
    if (n === this.builtBasement) return;
    this.builtBasement = n;
    this.basementC.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (n <= 0) return;
    const soil = new PIXI.Graphics();
    soil.rect(-LIFT.w - 4, 0, FULL_W + 8, n * FLOOR_H).fill(0x2f2620);
    this.basementC.addChild(soil);
    for (let bidx = 0; bidx < n; bidx++) {
      const sp = new PIXI.Sprite(this.tex[BASEMENT[bidx].tex] ?? PIXI.Texture.EMPTY);
      sp.x = -LIFT.w; sp.y = bidx * FLOOR_H;
      sp.width = FULL_W; sp.height = FLOOR_H + 1;
      this.basementC.addChild(sp);
      const cap = new PIXI.Graphics();
      cap.rect(-LIFT.w - 4, (bidx + 1) * FLOOR_H - 2, FULL_W + 8, 3).fill(0x1c1512);
      this.basementC.addChild(cap);
      const tag = new PIXI.Graphics();
      tag.roundRect(-LIFT.w + 2, bidx * FLOOR_H + 6, 26, 13, 3).fill(PAL.slate).stroke({ width: 1.5, color: PAL.ink });
      this.basementC.addChild(tag);
    }
  }

  /** Resize: screen size + weather viewport. */
  setViewport(w        , h        ) { this.vw = w; this.vh = h; this.weather.setViewport(w, h); }
  /** Dive to the underground tiers (no-op without a basement). */
  scrollToBasement() { if (this.camMin < 0) { this.dragging = false; this.camGoal = this.camMin; this.camVel = 0; } }
  scrollToBottom() { this.wantTop = false; this.wantReveal = -1; if (!this.scrolling && this.camMin >= 0) return; this.dragging = false; this.camGoal = 0; this.camVel = 0; }
  /** Probe hook: jump the camera without animation. */
  setCamera(v        ) { this.cam = clamp01(v); this.camGoal = null; this.camVel = 0; }
  /** Animate the camera so room i sits mid-screen if it is not already comfortably visible. */
  revealRoom(i        ) {
    const ti = Math.floor(i / ROOMS_PER_FLOOR) >= TOWER_FLOORS ? 2 : 1;
    if (this.twinMode !== 0 && this.twinMode !== ti) this.setTwinMode(ti);
    if (!this.scrolling || this.over <= 0) return;
    const y = this.roomScreen(i).y;
    if (y > this.topInset + 40 && y < this.vh - 140) return;
    const mid = (this.topInset + this.vh - 120) / 2;
    this.dragging = false;
    this.camVel = 0;
    this.camGoal = clamp01(this.cam + (mid - y) / this.over);
  }

  /** Once per selection: move the camera so the chosen room sits in the clear band above the sheet. */
          focusSelection(sc        , groundY        ) {
    const key = `${this.sel}:${Math.round(this.sheetH)}`;
    if (key === this.selKey) return;
    this.selKey = key;
    this.panTarget = 0;
    if (this.sel < 0 || this.sheetH <= 0) return;
    const f = Math.floor(this.sel / ROOMS_PER_FLOOR);
    const topL = towerFloorTop(f) + M.slab, botL = towerFloorTop(f) + FLOOR_H;
    const limit = this.vh - this.sheetH - 12;
    const yAt = (cam        , l        ) => groundY + cam * this.over + l * sc;
    if (yAt(this.cam, botL) <= limit && yAt(this.cam, topL) >= this.topInset) return;
    const mid = (this.topInset + limit) / 2;
    const need = mid - yAt(0, (topL + botL) / 2); // px the building must move down from cam 0
    let residual = need;
    if (this.over > 0) {
      const c = clamp01(need / this.over);
      this.camGoal = c;
      residual = need - c * this.over;
    }
    this.panTarget = Math.max(0, -residual);
  }

  // ---------------------------------------------------------------- frame

  update(s           , dt        ) {
    this.t += dt;
    const t = this.t;
    const ease = (rate        ) => 1 - Math.exp(-rate * dt);

    // a quake removes floors: wipe anything above the new top or its sprites stay floating
    if (s.floors < this.topFloorsSeen) {
      for (let f = s.floors; f < this.floors.length; f++) {
        const fv = this.floors[f];
        if (fv) { fv.root.destroy({ children: true }); this.floors[f] = null         ; }
      }
      this.roofC.y = floorTop(Math.min(s.floors, TOWER_FLOORS) - 1);
    }
    this.topFloorsSeen = s.floors;
    this.syncTwins(s);

    // fit to width; shrink to fit height only down to MIN_SCALE, then scroll
    const availW = Math.max(220, this.vw - INSETS.side * 2 - this.sideInset);
    const twin = s.floors > TOWER_FLOORS;
    const mode = twin ? this.twinMode : 1;
    // horizontal framing: one tower (lift column + building) or the whole lot
    const spanX = mode === 0 ? spanW(s.floors) : FULL_W;
    const midX = mode === 0 ? spanMidX(s.floors) : (mode === 2 ? SECOND_X : 0) + spanMidX(1);
    const fitW = Math.min(1.25, availW / spanX);
    const growing = s.floors < (this.maxFloors || MAX_FLOORS);
    const h1 = buildingHeight(Math.min(s.floors, TOWER_FLOORS)) + (!twin && growing ? FLOOR_H * 0.6 : 0);
    const h2 = twin ? buildingHeight(s.floors - TOWER_FLOORS) + (growing ? FLOOR_H * 0.6 : 0) : 0;
    const bh = mode === 2 ? h2 : Math.max(h1, h2);
    const fitH = (this.vh - INSETS.top - INSETS.bottom) / bh;
    const target = Math.min(fitW, Math.max(fitH, Math.min(MIN_SCALE, fitW)));
    this.scaleK = this.scaleK === 0 ? target : this.scaleK + (target - this.scaleK) * ease(5);
    const sc = this.scaleK;
    this.scrolling = bh * target > this.vh - INSETS.top - INSETS.bottom + 1;
    this.topInset = this.scrolling ? INSETS.top + NAV_ROW : INSETS.top;
    this.syncBasement(s);
    const groundY = this.vh - INSETS.bottom;
    this.over = Math.max(0, bh * sc - (groundY - this.topInset));
    {
      const digPx = s.basement * FLOOR_H * sc;
      this.camMin = this.over > 0 ? -Math.max(0, digPx - 6) / this.over : 0;
      if (this.cam < this.camMin) { this.cam = this.camMin; if (this.camGoal !== null && this.camGoal < this.camMin) this.camGoal = this.camMin; }
    }
    if (!this.scrolling) { this.cam = 0; this.camGoal = null; this.camVel = 0; this.wantTop = false; }
    else if (this.wantTop) { this.wantTop = false; this.camGoal = 1; this.camVel = 0; }
    if (this.wantReveal >= 0) { const i = this.wantReveal; this.wantReveal = -1; this.revealRoom(i); }

    this.focusSelection(sc, groundY);
    if (!this.dragging) {
      if (this.camGoal !== null) {
        this.cam += (this.camGoal - this.cam) * ease(7);
        if (Math.abs(this.camGoal - this.cam) < 0.0005) { this.cam = this.camGoal; this.camGoal = null; }
      } else if (Math.abs(this.camVel) > 1e-4) {
        this.cam = Math.max(this.camMin, Math.min(1, this.cam + this.camVel * dt));
        this.camVel *= Math.exp(-4 * dt);
        if (this.cam <= this.camMin + 1e-4 || this.cam >= 1) this.camVel = 0;
      }
    }
    this.pan += (this.panTarget - this.pan) * ease(9);
    this.sink = Math.max(0, this.sink - dt * 2.2);
    const sinkPx = Math.sin(this.sink * Math.PI) * 4;
    const lift = this.cam * this.over;

    this.root.scale.set(sc);
    this.pivotX = this.pivotX < 0 ? midX : this.pivotX + (midX - this.pivotX) * ease(7);
    if (Math.abs(this.pivotX - midX) < 0.05) this.pivotX = midX;
    this.root.pivot.x = this.pivotX;
    // root.pivot.x is exactly the span centre (177): root.x is where the building centre lands —
    // put it at screen centre so the tower-to-wall span is symmetric (was offset by the twin-mansion edit)
    this.root.x = (this.vw - this.sideInset) / 2;
    this.root.y = groundY - this.pan + lift + sinkPx;

    // ---- backdrop: sky deepens with altitude, clouds drift slower than the building (parallax)
    const gy = groundY - this.pan + lift;
    const altitude = Math.min(1, lift / 2400);
    this.sky.clear();
    this.sky.rect(0, 0, this.vw, this.vh).fill(lerpColor(SKY_LOW, SKY_HIGH, altitude));
    let sd = 987654321;
    const rnd = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    const band = this.vh + 240;
    for (let k = 0; k < 8; k++) {
      const cx = rnd() * this.vw, cs = 24 + rnd() * 30;
      const cy = ((rnd() * band + lift * 0.25) % band) - 120;
      this.sky.ellipse(cx, cy, cs * 1.5, cs * 0.62).fill({ color: 0xffffff, alpha: 0.85 });
      this.sky.ellipse(cx + cs * 0.7, cy - cs * 0.24, cs * 0.85, cs * 0.45).fill({ color: 0xffffff, alpha: 0.85 });
      this.sky.ellipse(cx - cs * 0.75, cy + cs * 0.1, cs * 0.7, cs * 0.36).fill({ color: 0xffffff, alpha: 0.7 });
    }
    const span = Math.max(this.vw * 1.45, 560);
    const bgK = span / this.tex.bg_city.width;
    this.bg.visible = gy - this.tex.bg_city.height * bgK < this.vh;
    this.bg.setSize(span, this.tex.bg_city.height * bgK);
    this.bg.position.set(this.vw / 2, gy + 4);
    this.street.clear();
    if (gy < this.vh + 10) {
      this.street.rect(0, gy, this.vw, Math.max(0, this.vh - gy) + 40).fill(PAL.road);
      this.street.rect(0, gy, this.vw, 7).fill(PAL.curb);
      this.street.moveTo(0, gy).lineTo(this.vw, gy).stroke({ width: 2, color: PAL.ink });
      for (let x = -20; x < this.vw; x += 60) this.street.rect(x, gy + 34, 30, 4).fill({ color: 0xf6f1e4, alpha: 0.7 });
    }

    // ---- visible floors (one floor of margin either side)
    const lyTop = (-FLOOR_H * sc - this.root.y) / sc;
    const lyBot = (this.vh + FLOOR_H * sc - this.root.y) / sc;
    let lo = s.floors, hi = -1;
    const tband = [[s.floors, -1], [s.floors, -1]];
    const lxL = (-this.root.x) / sc + this.root.pivot.x - FULL_W, lxR = (this.vw - this.root.x) / sc + this.root.pivot.x + LIFT.w;
    const towerOn = [0 < lxR && BUILDING_W > lxL, SECOND_X < lxR && SECOND_X + BUILDING_W > lxL];
    const focusT = s.floors > TOWER_FLOORS && this.twinMode === 2 ? 1 : 0;
    for (let f = 0; f < s.floors; f++) {
      const top = towerFloorTop(f), bot = top + FLOOR_H;
      const ti = f >= TOWER_FLOORS ? 1 : 0;
      const vis = top < lyBot && bot > lyTop && towerOn[ti];
      let fv = this.floors[f];
      if (vis) {
        if (!fv) {
          fv = this.buildFloor(f);
          this.floors[f] = fv;
          this.floorsLayer.addChild(fv.root);
        }
        fv.root.visible = true;
        if (fv.slide > 0) fv.slide = Math.max(0, fv.slide - dt * 1.8);
        const sl = fv.slide * fv.slide;
        fv.root.y = top - sl * 120;
        fv.root.alpha = 1 - sl;
        for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
          const i = f * ROOMS_PER_FLOOR + c;
          if (i < s.rooms.length) this.updateRoom(s, fv.rooms[c], i, t, dt);
        }
        // "on screen" for the HUD range = inside the clear band, not the culling margin
        const sTop = this.root.y + top * sc, sBot = this.root.y + bot * sc;
        if (sBot > this.topInset && sTop < groundY) {
          tband[ti][0] = Math.min(tband[ti][0], f); tband[ti][1] = Math.max(tband[ti][1], f);
          if (ti === focusT) { lo = Math.min(lo, f); hi = Math.max(hi, f); }
        }
      } else if (fv) fv.root.visible = false;
    }
    if (++this.evictTick % 30 === 0) {
      for (let f = 0; f < this.floors.length; f++) {
        const fv = this.floors[f];
        const b = tband[f >= TOWER_FLOORS ? 1 : 0];
        const mid = b[1] >= 0 ? (b[0] + b[1]) / 2 : -1000;
        if (fv && !fv.root.visible && Math.abs(f - mid) > 14) { fv.root.destroy({ children: true }); this.floors[f] = null; }
      }
    }
    this.visLo = hi >= 0 ? lo : 0;
    this.visHi = hi >= 0 ? hi : 0;
    this.visBase = focusT ? TOWER_FLOORS : 0;
    const top1 = Math.min(s.floors, TOWER_FLOORS) - 1;
    const topFv = this.floors[top1];
    this.roofC.y = topFv ? topFv.root.y : floorTop(top1);
    if (this.twinRoof) {
      const fv2 = this.floors[s.floors - 1];
      this.twinRoof.y = twin && fv2 ? fv2.root.y : towerFloorTop(s.floors - 1);
    }
    this.base.visible = gy - (M.lobby + M.sidewalk) * sc < this.vh + 20;
    this.drawGhost(s.floors, this.maxFloors || MAX_FLOORS);
    // the idle car parks around the middle of what the player is looking at
    this.lift.parkLevel = hi >= 0 ? Math.round((lo + hi) / 2) + 1 : 0;
    this.updateResidents(s, dt);
    // rubble falls with gravity and fades
    for (let k = this.rubble.length - 1; k >= 0; k--) {
      const r = this.rubble[k];
      r.vy += 520 * dt;
      r.sp.x += r.vx * dt;
      r.sp.y += r.vy * dt;
      r.sp.rotation += r.spin * dt;
      r.life -= dt;
      r.sp.alpha = Math.max(0, Math.min(1, r.life * 3));
      if (r.life <= 0) { r.sp.destroy(); this.rubble.splice(k, 1); }
    }
    this.updateRaid(dt);
    this.updateRobber(dt);
    // the red "!" follows the sim: shown while a tenant is suspected (also right after a reload)
    this.setAlert(s.crime.phase === "suspect" ? s.crime.room : -1);
    if (this.alertMark) {
      this.alertMark.t += dt;
      this.alertMark.c.y = towerFloorTop(Math.floor(this.alertFor / ROOMS_PER_FLOOR)) + M.slab + 12 + Math.sin(this.alertMark.t * 4) * 2;
    }
    this.weather.update(dt);
    for (let f = Math.max(0, lo - 1); f <= Math.min(s.floors - 1, hi + 1); f++) {
      const fv = this.floors[f];
      if (!fv) continue;
      const on = this.lift.waitingAt(f + 1) || this.lift.headingTo === f + 1;
      if (on !== fv.lampOn) { fv.lampOn = on; fv.lamp.visible = on; }
    }
    const lobbyOn = this.lift.waitingAt(0) || this.lift.headingTo === 0;
    if (lobbyOn !== this.lampOn.lobby) { this.lampOn.lobby = lobbyOn; this.lobbyLamp.visible = lobbyOn; }
    const roofOn = this.lift.waitingAt(s.floors + 1) || this.lift.headingTo === s.floors + 1;
    if (roofOn !== this.lampOn.roof) { this.lampOn.roof = roofOn; this.roofLamp.visible = roofOn; }
  }

  // ---------------------------------------------------------------- residents out and about

          isAway(i        ) { return this.walkers.some((w) => w.room === i); }
  /** "roof" | "out" while the resident of room i is outside, else null (sheet status). */
  activityOf(i        )                        {
    const w = this.walkers.find((x) => x.room === i);
    return w ? w.dest : null;
  }
  /** Probe hook: positions of every walker in building-local units. */
  walkerInfo() {
    return this.walkers.map((w) => ({
      room: w.room, kind: w.kind, dest: w.dest, x: Math.round(w.x), y: Math.round(w.y),
      visible: w.sprites[0].visible, steps: w.steps.length, riding: w.riding, members: w.sprites.length,
      ride: (w.steps[0] && w.steps[0].t === "lift" && w.steps[0].ride) ? w.steps[0].ride.phase : null,
    }));
  }

  /** Probe: visible walk sprites right now. */
  visibleWalkerSprites() { let n = 0; for (const w of this.walkers) for (const sp of w.sprites) if (sp.visible && sp.alpha > 0.05) n++; return n; }
  /** Probe: walk-layer children (leak detector). */
  walkLayerChildren() { return this.walkLayer.children.length; }
  /** Basement visit: one resident at a time rides the elevator down, enjoys a tier, comes back. */
          visit                                                                                                                                                                                       = null;
          visitTimer = 22;

  /** where the visitor stands per dug tier (x in the 426-wide strip, y set per tier) */
          static          VISIT_X = [78, 215, 128, 195, 168];
  /** Sprite target height for the basement visitor (kept constant across walk frames) */
          static          VISIT_H = 46;

  /** Probe hook: run the resident simulation forward without rendering a frame per step. */
  fastForwardResidents(s           , sec        ) {
    for (let k = 0; k < sec / 0.05; k++) this.updateResidents(s, 0.05);
  }

          updateResidents(s           , dt        ) {
    this.lift.update(dt, Math.min(s.floors, TOWER_FLOORS), this.t);
    // residents whose tenancy ended while out simply never come back
    for (let k = this.walkers.length - 1; k >= 0; k--) {
      const w = this.walkers[k];
      const o = s.rooms[w.room]?.occupant;
      if (!o || o !== w.occ) this.dropWalker(k);
    }
    this.activityTimer -= dt;
    // 2026-10-23 user request: resident outings are disabled entirely — walkers were being
    // read as "people inside vacant rooms". Residents never leave their rooms;
    // startOuting() now always refuses. The raid squad has its own choreography elsewhere.
    // (this.walkers stays empty: any straggler from an older build was dropped above)

    // 2026-11-25 user request: residents visiting the basement amenities.
    // ONE visitor at a time, elevator + stair fade only — no walking along room rows
    // (that read as "someone inside a vacant room" before and stays out of this motion).
    this.visitTimer -= dt;
    if (!this.visit && this.visitTimer <= 0) {
      this.visitTimer = 34 + Math.random() * 26;
      if (s.basement > 0 && !this.storming && !this.raid && !this.robber) this.startVisit(s);
    }
    if (this.visit && !this.stepVisit(s, dt)) this.cancelVisit();
  }

  /** Outings are disabled entirely (user request); kept only so old callers fail cleanly. */
  startOuting(_s         , _i        , _dest                )          {
    return false;
  }

          dropWalker(k        ) {
    const w = this.walkers[k];
    for (const st of w.steps) if (st.t === "lift" && st.ride && st.ride.phase !== "done") this.lift.cancel(st.ride);
    for (const sp of w.sprites) sp.destroy();
    this.walkers.splice(k, 1);
  }
  /** Restart / new game: everyone is home. */
  resetResidents() {
    while (this.walkers.length) this.dropWalker(this.walkers.length - 1);
    this.lift.reset();
    this.activityTimer = 6;
    this.cancelVisit();
  }

  /** Probe: is a resident visiting the basement right now, and where in the sequence. */
  visitPhase() { return this.visit ? { phase: this.visit.phase, room: this.visit.roomIdx, tier: this.visit.tier, x: Math.round(this.visit.x), y: Math.round(this.visit.y) } : null; }
  /** Probe: force a visit right now (picks a visible resident in the lower floors). */
  startVisitNow(s           )          { this.visitTimer = 0; return this.startVisit(s); }

          cancelVisit() {
    if (!this.visit) return;
    if (this.visit.ride && this.visit.ride.phase !== "done") this.lift.cancel(this.visit.ride);
    this.visit.sp.destroy();
    this.visit = null;
  }

  /** Pick one visible low-floor resident and start the basement trip. */
          startVisit(s           , pickRoom = -1)          {
    if (this.visit || s.basement <= 0) return false;
    const cand           = [];
    for (let i = 0; i < s.rooms.length; i++) {
      const o = s.rooms[i].occupant;
      if (!o) continue;
      const level = Math.floor(i / ROOMS_PER_FLOOR) + 1;
      if (level > 50) continue; // a cross-500-floor elevator ride reads painfully slow
      const key = walkKeys(o.kind)[0];
      if (!key || !this.walks[key]) continue;
      const f = level - 1;
      if (f < this.visLo || f > this.visHi) continue;
      cand.push(i);
    }
    const roomIdx = pickRoom >= 0 ? (cand.includes(pickRoom) ? pickRoom : -1) : (cand.length ? cand[Math.floor(Math.random() * cand.length)] : -1);
    if (roomIdx < 0) return false;
    const o = s.rooms[roomIdx].occupant ;
    const pack = this.walks[walkKeys(o.kind)[0]];
    const sp = new PIXI.Sprite(pack.frames[0]);
    sp.anchor.set(0.5, Math.min(0.97, Math.max(0.8, pack.anchorY ?? 1)));
    // 46 units tall, recomputed against the CURRENT frame's height (walk frames differ slightly)
    const baseK = BuildingView.VISIT_H / Math.max(24, sp.texture.height);
    sp.scale.x = baseK;
    sp.scale.y = baseK;
    const level = Math.floor(roomIdx / ROOMS_PER_FLOOR) + 1;
    const y0 = levelY(level, Math.min(s.floors, TOWER_FLOORS));
    this.visit = { sp, pack, roomIdx, level, tier: Math.floor(Math.random() * s.basement), phase: "door", t: 0, age: 0, x: LIFT_X, y: y0, ft: Math.random() * 20, ride: null };
    sp.position.set(LIFT_X, y0);
    this.walkLayer.addChild(sp);
    return true;
  }

  /** One per-frame step of the basement visit choreography; false = finished. */
          stepVisit(s           , dt        )          {
    const v = this.visit ;
    v.t += dt;
    v.age += dt;
    // no visit may stall (a lost elevator ticket left a resident frozen at their door once)
    if (v.age > 45) return true;
    const frame = (moving         ) => {
      v.ft += dt * v.pack.fps * (moving ? 0.55 : 0.1);
      v.sp.texture = v.pack.frames[Math.floor(v.ft) % v.pack.count];
      // current-frame normalization, keeps the facing sign
      const sgn = Math.sign(v.sp.scale.x) || 1;
      const k2 = BuildingView.VISIT_H / Math.max(24, v.sp.texture.height);
      v.sp.scale.x = sgn * k2;
      v.sp.scale.y = k2;
    };
    const face = (sign        ) => { v.sp.scale.x = Math.abs(v.sp.scale.x) * (sign >= 0 ? 1 : -1); };
    const moveTo = (tx        , ty        , speed        ) => {
      frame(true);
      const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy), st = speed * dt;
      if (dx > 1) face(1); else if (dx < -1) face(-1);
      if (d <= st) { v.x = tx; v.y = ty; v.sp.position.set(tx, ty); return true; }
      v.x += (dx / d) * st; v.y += (dy / d) * st;
      v.sp.position.set(v.x, v.y);
      return false;
    };
    const steps = 0;
    if (steps) { /* placate grammarians */ }
    switch (v.phase) {
      case "door":
        frame(false);
        v.sp.alpha = Math.min(1, v.t / 0.3);
        if (v.t >= 0.55) { v.ride = this.lift.request(v.level, 0, this.t); v.phase = "wait"; v.t = 0; }
        break;
      case "wait":
        frame(false);
        if (!v.ride) return false;
        if (v.ride.phase === "board") { v.phase = "board"; v.t = 0; }
        else if (this.lift.lostRide(v.ride)) v.ride = this.lift.request(v.level, 0, this.t);
        break;
      case "board":
        frame(true);
        // slip sideways into the car at THIS floor (do not slide to street level — that looked like a ghost falling)
        if (moveTo(LIFT_X, v.y, 30) || v.t > 1.2) { v.ride .phase = "ride"; v.phase = "ride"; v.sp.visible = false; }
        break;
      case "ride":
        frame(false);
        if (!v.ride) return false;
        if (v.ride.phase === "ride") { v.x = LIFT_X; v.y = this.lift.y; v.sp.position.set(v.x, v.y); }
        else if (v.ride.phase === "exit" || v.ride.phase === "done") { v.phase = "toStairs"; v.sp.visible = true; v.x = LIFT_X; v.y = LOBBY_Y; v.sp.position.set(v.x, v.y); }
        break;
      case "toStairs":
        if (moveTo(BAY_X + M.gap / 2, LOBBY_Y, 70)) { v.phase = "descend"; v.t = 0; }
        break;
      case "descend":
        frame(false);
        v.sp.alpha = Math.max(0, 1 - v.t / 0.55);
        v.sp.y += 10 * dt;
        v.sp.rotation = Math.sin(this.t * 10) * 0.05;
        if (v.t >= 0.55) {
          v.x = BuildingView.VISIT_X[Math.min(4, v.tier)];
          v.y = v.tier * FLOOR_H + FLOOR_H - 8;
          v.sp.position.set(v.x, v.y);
          v.sp.rotation = 0;
          v.sp.alpha = 0;
          v.phase = "amuse"; v.t = 0;
        }
        break;
      case "amuse": {
        frame(false);
        const baseY = v.tier * FLOOR_H + FLOOR_H - 8;
        v.sp.y = baseY - Math.abs(Math.sin(this.t * 1.7 + v.roomIdx)) * 2.2; // gentle bounce on the strip
        v.sp.alpha = Math.min(1, Math.min(v.t / 0.4, (6.4 - v.t) * 2));
        if (v.t >= 6.4) { v.phase = "backstairs"; v.t = 0; v.sp.alpha = 0; v.x = BAY_X + M.gap / 2; v.y = LOBBY_Y; v.sp.position.set(v.x, v.y); }
        break;
      }
      case "backstairs":
        frame(false);
        v.sp.alpha = Math.min(1, v.t / 0.4);
        if (v.t >= 0.6) v.phase = "toLift";
        break;
      case "toLift":
        if (moveTo(LIFT_X, LOBBY_Y, 70)) { v.ride = this.lift.request(0, v.level, this.t); v.phase = "waitUp"; v.t = 0; }
        break;
      case "waitUp":
        frame(false);
        if (!v.ride) return false;
        if (v.ride.phase === "board") { moveTo(LIFT_X, LOBBY_Y, 30); v.ride.phase = "ride"; v.phase = "rideUp"; v.sp.visible = false; }
        else if (this.lift.lostRide(v.ride)) v.ride = this.lift.request(0, v.level, this.t);
        break;
      case "rideUp":
        frame(false);
        if (!v.ride) return false;
        if (v.ride.phase === "ride") { v.x = LIFT_X; v.y = this.lift.y; v.sp.position.set(v.x, v.y); }
        else if (v.ride.phase === "exit" || v.ride.phase === "done") { v.phase = "home"; v.t = 0; v.sp.visible = true; v.y = levelY(v.level, Math.min(s.floors, TOWER_FLOORS)); v.sp.position.set(LIFT_X, v.y); }
        break;
      case "home":
        frame(false);
        v.sp.alpha = Math.max(0, 1 - v.t / 0.3);
        if (v.t >= 0.32) return false;
        break;
      default:
        return false;
    }
    return true;
  }

  /** Probe hook: run the resident simulation forward without rendering a frame per step. */

  /** Once the first mansion is full, show the second one on its lot: lobby + roof slab. */
          twinRoof                        = null;
  /** max floors the building may reach (500, or 1000 once the 2nd tower is bought) — set by the host */
  maxFloors = 0;
          syncTwins(s           ) {
    const need = s.floors > TOWER_FLOORS;
    if (!need && this.twins) { this.twins.destroy({ children: true }); this.twins = null; this.twinRoof = null; }
    if (need && !this.twins) {
      const c = new PIXI.Container();
      const X = SECOND_X;
      // own lobby + lift column + sidewalk on the second lot
      const shaft2 = new PIXI.Graphics();
      drawShaftSlice(shaft2, -M.sidewalk - M.lobby, M.lobby);
      drawLanding(shaft2, -M.sidewalk);
      shaft2.x = X;
      const lobby2 = new PIXI.Sprite(this.tex.lobby);
      lobby2.x = X; lobby2.y = -M.sidewalk - M.lobby; lobby2.width = BUILDING_W; lobby2.height = M.lobby;
      const edge2 = new PIXI.Graphics();
      edge2.rect(X, -M.sidewalk - M.lobby, BUILDING_W, M.lobby).stroke({ width: 2, color: PAL.ink });
      const walk2 = new PIXI.Graphics();
      walk2.rect(BUILDING_W + 8, -M.sidewalk, X + BUILDING_W - BUILDING_W, M.sidewalk).fill(PAL.curb).stroke({ width: 2, color: PAL.ink });
      // "2" plate on the lobby so the two towers read apart at a glance
      const plate = new PIXI.Graphics();
      plate.roundRect(X + 6, -M.sidewalk - M.lobby + 6, 22, 16, 4).fill(PAL.paper).stroke({ width: 2, color: PAL.ink });
      const pt = new PIXI.Text({ text: "2", style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: PAL.ink, padding: 2 } });
      pt.anchor.set(0.5); pt.position.set(X + 17, -M.sidewalk - M.lobby + 14);
      // own roof + lift penthouse for the second tower
      const roof2 = new PIXI.Sprite(this.tex.roof);
      roof2.anchor.set(0, 1);
      roof2.width = BUILDING_W + 6; roof2.height = M.roof;
      roof2.x = X - 3; roof2.y = 2;
      const machine2 = new PIXI.Graphics();
      machine2.rect(X - LIFT.w, -LIFT.carH - 14, LIFT.w + 2, LIFT.carH + 16).fill(PAL.slate).stroke({ width: 2, color: PAL.ink });
      machine2.rect(X - LIFT.w + 6, -LIFT.carH - 10, LIFT.w - 12, 4).fill(PAL.slateLight);
      machine2.rect(X - LIFT.w - 3, -LIFT.carH - 17, LIFT.w + 8, 4).fill(PAL.cream).stroke({ width: 1.5, color: PAL.ink });
      const roof2C = new PIXI.Container();
      roof2C.y = towerFloorTop(s.floors - 1);
      roof2C.addChild(roof2, machine2);
      c.addChild(walk2, shaft2, lobby2, edge2, plate, pt);
      this.base.addChild(c);
      // the roof sits above the floors (same layer as the 1st tower's roof)
      this.roofC.parent?.addChildAt(roof2C, this.roofC.parent.getChildIndex(this.roofC));
      this.twins = c;
      this.twinRoof = roof2C;
    }
  }

  /** Dashed outline of the next floor to build — shows where the building grows. */
          drawGhost(floors        , max        ) {
    const g = this.ghost;
    if (this.ghostFor === floors * 10000 + max) return;
    this.ghostFor = floors * 10000 + max;
    g.clear();
    if (floors >= max) return;
    const tgi = towerX(floors);
    const top = towerFloorTop(floors) - M.roof - 6;
    const dash = (x0        , y0        , x1        , y1        ) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 9);
      for (let k = 0; k < n; k += 2) {
        const a = k / n, b = Math.min(1, (k + 1) / n);
        g.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      }
    };
    for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
      const x = tgi + colX(c), y = top + M.slab, w = M.roomW, h = M.roomH;
      dash(x, y, x + w, y); dash(x + w, y, x + w, y + h); dash(x + w, y + h, x, y + h); dash(x, y + h, x, y);
    }
    g.stroke({ width: 2, color: PAL.slate, alpha: 0.45 });
  }

          updateRoom(s           , rv          , i        , t        , dt        ) {
    const room = s.rooms[i], o = room.occupant;
    const { y, w, h } = ROOM_INNER;
    const lux = room.lv >= 8;
    rv.bg.visible = !lux && !!o;
    rv.dim.visible = !lux && !o;
    rv.lux.visible = lux && !!o;
    rv.luxDim.visible = lux && !o;
    rv.frameGold.visible = room.lv >= MAX_LV;
    rv.lamp.visible = !!o;
    rv.lamp.alpha = (0.85 + 0.15 * Math.sin(t * 1.6 + i)) * (this.isAway(i) ? 0.45 : 1);
    rv.sign.visible = !o;
    if (!o) {
      rv.sign.y = y + h * 0.42 + Math.sin(t * 2.3 + i * 1.7) * 2.2;
      rv.sign.rotation = Math.sin(t * 1.9 + i) * 0.04;
    }
    rv.heat.visible = room.lv >= 5;
    // typhoon: damage overlay pops in (shake + scale), closed shutters slide over the front
    if (room.damaged && !rv.damage.visible) {
      rv.damage.visible = true; rv.dmgT = rv.fresh ? 1 : 0;
      rv.dmgCause = room.cause ?? "storm";
      const scorched = rv.dmgCause === "missile";
      rv.breach.visible = !scorched; rv.scorch.visible = scorched;
    }
    else if (!room.damaged && rv.damage.visible) rv.damage.visible = false;
    if (rv.damage.visible && rv.dmgT < 1) {
      rv.dmgT = Math.min(1, rv.dmgT + dt * 2.5);
      const k = backOut(rv.dmgT);
      rv.damage.scale.set(k);
      rv.damage.pivot.set(w / 2, y + h / 2);
      rv.damage.position.set(w / 2 + Math.sin(rv.dmgT * 40) * 3 * (1 - rv.dmgT), y + h / 2);
    }
    rv.shutter.visible = this.shutRooms.has(i);

    // fixtures appear one per level (Lv8 is the interior swap above); new ones pop in with an overshoot
    for (let lv = 2; lv <= room.lv; lv++) {
      if (rv.fixtures.has(lv) || !FIXTURE_TEX[lv]) continue;
      const p = FIX_POS[lv], tex = this.tex[FIXTURE_TEX[lv]];
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.x = w * p.x; sp.y = y + h * p.y;
      const base = (h * p.h) / tex.height;
      // floors built while scrolling show their fixtures already in place, no pop
      rv.fixtures.set(lv, { sp, base, t: this.t < 0.5 || rv.fresh ? 1 : 0 });
      rv.fixLayer.addChild(sp);

      if (lv === 6) {
        const glow = new PIXI.Graphics().rect(0, 0, 1, 1).fill(0xbfe6ff);
        glow.pivot.set(0.5, 0.5);
        glow.blendMode = "add";
        glow.position.set(sp.x, sp.y);
        glow.width = sp.width * 0.72; glow.height = sp.height * 0.5;
        rv.tvGlow = glow;
        rv.fixLayer.addChild(glow);
      }
    }
    for (const [lv, fx] of rv.fixtures) {
      if (lv > room.lv) { fx.sp.destroy(); rv.fixtures.delete(lv); continue; }
      if (fx.t < 1) {
        fx.t = Math.min(1, fx.t + dt * 3.2);
        fx.sp.scale.set(fx.base * backOut(fx.t));
      } else if (fx.sp.scale.x !== fx.base) fx.sp.scale.set(fx.base);
      if (lv === 6) rv.tvGlow .alpha = 0.10 + 0.06 * Math.sin(this.t * 7 + i * 0.8) + (rv.homeX < 0.42 ? 0.10 : 0);
    }

    // tenant token with breathing
    if (rv.person && (!o || rv.personKind !== o.kind)) {
      rv.person.destroy(); rv.person = null; rv.lounge = null; rv.personKind = "";
    }
    if (o && !rv.person) {
      const want = h * (PAIR_KINDS.has(o.kind) ? 0.5 : 0.56);
      const set = this.motions[o.kind];
      let sp             ;
      if (set) {
        // animated tenant: idle loop + occasional stretch / doze gestures
        rv.lounge = new LoungePlayer(set, i);
        sp = rv.lounge.sp;
        rv.personBase = want / rv.lounge.figH;
      } else {
        const tex = this.tex[TENANT_TEX[o.kind]] ?? this.tex.tenant_student;
        sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5, 1);
        rv.personBase = want / tex.height;
      }
      sp.x = w * rv.homeX; sp.y = y + h - 5 + rv.homeYOff * h;
      rv.c.addChildAt(sp, rv.c.getChildIndex(rv.sign));
      rv.person = sp;
      rv.personKind = o.kind;
      rv.pop = rv.fresh ? 1 : 0;
    }
    if (rv.person) {
      rv.pop = Math.min(1, rv.pop + dt * 3);
      const k = rv.pop >= 1 ? 1 : backOut(rv.pop);
      if (rv.lounge) {
        // the clip carries its own breathing; no gestures while the tenant is out or a storm rages
        rv.lounge.update(dt, rv.personBase * k, !this.isAway(i) && !this.storming);
      } else {
        const breathe = 1 + 0.022 * Math.sin(t * 1.9 + rv.bob);
        rv.person.scale.set(rv.personBase * k, rv.personBase * k * breathe);
      }
      // in-room activity spots: desk ↔ TV ↔ bed, drifted to over time (outings are disabled)
      rv.nextMoveAt -= dt; this.movePicks++;
      if (rv.nextMoveAt <= 0) {
        rv.nextMoveAt = 16 + Math.random() * 36;
        const spots = [{ x: 0.5, yOff: 0 }];
        if (room.lv >= 6) spots.push({ x: 0.34, yOff: 0 });
        const rest = spots.filter((p) => Math.abs(p.x - rv.homeXTo) > 0.01 || Math.abs(p.yOff - rv.homeYOffTo) > 0.01);
        const nx = rest.length ? rest[Math.floor(Math.random() * rest.length)] : spots[0];
        rv.homeXTo = nx.x; rv.homeYOffTo = nx.yOff;
      }
      const eas = 1 - Math.exp(-1.7 * dt);
      rv.homeX += (rv.homeXTo - rv.homeX) * eas;
      rv.homeYOff += (rv.homeYOffTo - rv.homeYOff) * eas;
      rv.person.x = w * rv.homeX;
      rv.person.y = y + h - 5 + rv.homeYOff * h - (rv.homeYOff < -0.08 ? 0 : rv.cheer * 6);
      // away: the seat stays empty; fade so leaving/returning is not a pop
      const target = this.isAway(i) || (this.raidArrested && this.raid?.room === i) || (this.visit && this.visit.roomIdx === i) ? 0 : 1;
      rv.person.alpha += (target - rv.person.alpha) * (1 - Math.exp(-8 * dt));
    }

    // fixture-level pips (top-left): two rows of five, one shared drawing per level
    if (rv.pipLv !== room.lv) { rv.pips.context = this.pipCtx[room.lv]; rv.pipLv = room.lv; }

    // satisfaction ring (top-right): redrawn only when its 2.5% step changes
    if (o) {
      const a = Math.max(0, Math.min(1, o.sat / SAT_MAX));
      if (rv.cheer > 0) rv.cheer = Math.max(0, rv.cheer - dt * 1.1);
      rv.satGlow.visible = o.sat < 40 || rv.cheer > 0.02;
      if (rv.satGlow.visible) rv.satGlow.alpha = 0.18 + 0.14 * Math.sin(t * 5 + i);
      const key = Math.round(a * 40);
      if (key !== rv.satKey) {
        rv.satKey = key;
        const cx = w - 12, cy = y + 11;
        rv.sat.clear();
        rv.sat.circle(cx, cy, 7).fill(PAL.paper).stroke({ width: 1.4, color: PAL.ink });
        if (key > 0) {
          const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * (key / 40);
          rv.sat.moveTo(cx + 5 * Math.cos(a0), cy + 5 * Math.sin(a0)).arc(cx, cy, 5, a0, a1).stroke({ width: 3, color: a > 0.45 ? PAL.leaf : a > 0.22 ? PAL.gold : PAL.heart });
        }
      }
    } else if (rv.satKey !== -1) {
      rv.satKey = -1;
      rv.sat.clear();
      rv.satGlow.visible = false;
    }

    if (this.sel === i) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 5);
      rv.select.clear();
      rv.select.roundRect(rv.c.x - 3, y - 3, w + 6, h + 6, 5).stroke({ width: 4, color: PAL.gold, alpha: pulse });
      rv.selDrawn = true;
    } else if (rv.selDrawn) { rv.select.clear(); rv.selDrawn = false; }
    if (rv.flash.alpha > 0) rv.flash.alpha = Math.max(0, rv.flash.alpha - dt * 2.5);
    rv.fresh = false;
  }

  /** Fixture sprites currently drawn per room (probe hook; -1 = floor not built yet). */
  fixtureCounts()           {
    const out           = [];
    for (const f of this.floors) for (let c = 0; c < ROOMS_PER_FLOOR; c++) out.push(f ? f.rooms[c].fixtures.size : -1);
    return out;
  }
  /** Probe: how many seated tenants are mid-gesture (stretch / doze) right now. */
  gesturingCount()         {
    let n = 0;
    for (const fv of this.floors) if (fv) for (const rv of fv.rooms) if (rv.lounge?.gesturing) n++;
    return n;
  }
  /** Probe: force a gesture on room i (returns false when the tenant is static or away). */
  forceGesture(i        )          {
    const rv = this.roomView(i);
    return !!rv?.lounge?.gesture(0);
  }

  /** Probe hook: which tenant sprite room i is drawing (null = none / floor not built). */
  /** 満足度回復の演出: person hop + gold pip flash (hearts are DOM-side via ui.floatText). */
  celebrateRoom(i        ) { const rv = this.roomView(i); if (rv) rv.cheer = 1; }
  personKindDrawn(i        )                {
    const f = Math.floor(i / ROOMS_PER_FLOOR);
    if (f >= 0 && !this.floors[f]) this.buildFloor(f);
    const rv = this.roomView(i);
    if (!rv?.person) return null;
    return rv.personKind || "?";
  }
  /** Probe: the current in-room spot of the person in room i (to = drifting target). */
          movePicks = 0;
  get movePicksCount() { return this.movePicks; }
  /** Probe: fast-forward the in-room activity clocks of all rooms by sec seconds. */
  ffSpots(sec        ) { for (const f of this.floors) if (f) for (const rv of f.rooms) rv.nextMoveAt -= sec; }
  personSpot(i        ) {
    const rv = this.roomView(i);
    if (!rv) return null;
    return { x: +rv.homeX.toFixed(2), yOff: +rv.homeYOff.toFixed(2), to: +rv.homeXTo.toFixed(2), toYOff: +rv.homeYOffTo.toFixed(2), clock: +rv.nextMoveAt.toFixed(1), hasPerson: !!rv.person, lv: Math.max(0, ...[...rv.fixtures.keys()]) };
  }
  /** Probe hook: how many floors currently have display objects. */
  builtFloors() { return this.floors.filter((f) => f).length; }
  visibleBuiltFloors() { return this.floors.filter((f) => f && f.root.visible).length; }

  flashRoom(i        ) {
    const rv = this.roomView(i);
    if (rv) { rv.flash.alpha = 0.7; rv.pop = Math.min(rv.pop, 0.55); }
  }
          roomView(i        ) { return this.floors[Math.floor(i / ROOMS_PER_FLOOR)]?.rooms[i % ROOMS_PER_FLOOR]; }

  /** Room centre in FX-world (building-local) coordinates. */
  roomLocal(i        )                           {
    const f = Math.floor(i / ROOMS_PER_FLOOR), c = i % ROOMS_PER_FLOOR;
    return { x: towerX(f) + colX(c) + M.roomW / 2, y: towerFloorTop(f) + M.slab + M.roomH / 2 };
  }
  /** Room centre in screen coordinates. */
  roomScreen(i        )                           {
    const p = this.roomLocal(i);
    return { x: this.root.x + (p.x - this.root.pivot.x) * this.scaleK, y: this.root.y + p.y * this.scaleK };
  }
  /** Room cell rect in screen coordinates (tutorial spotlight). */
  roomScreenRect(i        ) {
    const c = this.roomScreen(i);
    const w = M.roomW * this.scaleK, h = M.roomH * this.scaleK;
    return { left: c.x - w / 2, top: c.y - h / 2, right: c.x + w / 2, bottom: c.y + h / 2 };
  }
  /** Which room is under this screen point, or -1 (rooms hidden behind the HUD bands don't count). */
  roomAt(sx        , sy        , rooms        )         {
    if (sy < this.topInset - 4) return -1;
    const lx = (sx - this.root.x) / this.scaleK + this.root.pivot.x;
    const ly = (sy - this.root.y) / this.scaleK;
    // floor from y directly — no scan over 400 rooms
    const lf = Math.floor((-ly - M.sidewalk - M.lobby) / FLOOR_H);
    // which tower: the 2nd one stands at SECOND_X (its lift column starts LIFT.w left of it)
    const t2 = rooms > TOWER_FLOORS * ROOMS_PER_FLOOR && lx >= SECOND_X - LIFT.w;
    if (lf < 0 || lf >= TOWER_FLOORS) return -1;
    const f = lf + (t2 ? TOWER_FLOORS : 0);
    if (f >= Math.ceil(rooms / ROOMS_PER_FLOOR)) return -1;
    for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
      const i = f * ROOMS_PER_FLOOR + c;
      if (i >= rooms) break;
      const x0 = towerX(f) + colX(c) - 2, y0 = towerFloorTop(f) + M.slab - 2;
      if (lx >= x0 && lx <= x0 + M.roomW + 4 && ly >= y0 && ly <= y0 + M.roomH + 4) return i;
    }
    return -1;
  }
  /** Bottom of the newest floor (local) — where build dust lands. */
  topFloorLocal(floors        )                           {
    return { x: towerX(floors - 1) + BUILDING_W / 2, y: towerFloorTop(floors - 1) + FLOOR_H };
  }
  roofLocal(floors        )                           {
    return { x: towerX(floors - 1) + BUILDING_W / 2, y: towerFloorTop(floors - 1) };
  }
  /** Lobby centre of tower 1 or 2 (local) — unlock celebration. */
  lobbyLocal(tower       )                           {
    return { x: (tower === 2 ? SECOND_X : 0) + BUILDING_W / 2, y: -M.sidewalk - M.lobby / 2 };
  }

  // ---------------------------------------------------------------- コンビニ (exists only once bought)
          kb                                                                                                                          = null;
          static          KB_X = Math.round(BUILDING_W * 0.635);
  /** Build / remove the lobby store. `label` is the localized store name drawn on its sign. */
  setKonbini(on         , label = "") {
    if (!on) { if (this.kb) { this.kb.c.destroy({ children: true }); this.kb = null; } return; }
    if (this.kb) { if (label && this.kb.label.text !== label) this.kb.label.text = label; return; }
    const x0 = BuildingView.KB_X, w = BUILDING_W - x0, top = -M.sidewalk - M.lobby, h = M.lobby;
    const c = new PIXI.Container();
    const sp = new PIXI.Sprite(this.tex.konbini);
    sp.x = x0; sp.y = top; sp.width = w; sp.height = h;
    const edge = new PIXI.Graphics().rect(x0, top, w, h).stroke({ width: 2, color: PAL.ink });
    // signboard above the shop front (text drawn in code, never baked into the art)
    const lab = new PIXI.Text({ text: label, style: { fontFamily: FONT, fontSize: 10, fontWeight: "800", fill: PAL.paper, padding: 2 } });
    lab.anchor.set(0.5);
    lab.resolution = 3;
    const sign = new PIXI.Graphics().roundRect(x0 + w / 2 - 34, top + 3, 68, 15, 4).fill(0x2f8f5b).stroke({ width: 1.5, color: PAL.ink });
    lab.position.set(x0 + w / 2, top + 10.5);
    // stock gauge along the bottom of the shop front
    const bar = new PIXI.Graphics();
    const badge = new PIXI.Container();
    const bg = new PIXI.Graphics().circle(0, 0, 8).fill(PAL.heart).stroke({ width: 1.5, color: PAL.ink });
    const ex = new PIXI.Text({ text: "!", style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: PAL.paper, padding: 2 } });
    ex.anchor.set(0.5); ex.resolution = 3;
    badge.addChild(bg, ex);
    badge.position.set(x0 + w - 11, top + 11);
    badge.visible = false;
    c.addChild(sp, edge, sign, lab, bar, badge);
    this.base.addChild(c);
    this.kb = { c, bar, badge, label: lab, frac: -1, empty: false };
    // pop-in when it first opens
    c.alpha = 0;
    this.kbFade = 1;
  }
          kbFade = 0;
  /** Per-frame: stock gauge + empty badge (cheap — redraws only when the gauge moves a pixel). */
  updateKonbini(stockFrac        , dt        ) {
    const k = this.kb;
    if (!k) return;
    if (this.kbFade > 0) { this.kbFade = Math.max(0, this.kbFade - dt * 2); k.c.alpha = 1 - this.kbFade; }
    const f = Math.round(Math.max(0, Math.min(1, stockFrac)) * 60) / 60;
    if (f !== k.frac) {
      k.frac = f;
      const x0 = BuildingView.KB_X + 6, w = BUILDING_W - BuildingView.KB_X - 12, y = -M.sidewalk - 7;
      k.bar.clear().roundRect(x0, y, w, 4, 2).fill({ color: PAL.ink, alpha: 0.35 });
      if (f > 0) k.bar.roundRect(x0, y, Math.max(3, w * f), 4, 2).fill(f < 0.15 ? PAL.heart : PAL.leaf);
    }
    const empty = stockFrac <= 0;
    k.badge.visible = empty && Math.floor(this.t * 2) % 2 === 0;
  }
  /** Is the screen point on the store front? */
  konbiniAt(sx        , sy        )          {
    if (!this.kb || !this.base.visible || sy < this.topInset - 4) return false;
    const lx = (sx - this.root.x) / this.scaleK + this.root.pivot.x;
    const ly = (sy - this.root.y) / this.scaleK;
    return lx >= BuildingView.KB_X && lx <= BUILDING_W && ly >= -M.sidewalk - M.lobby - 4 && ly <= 2;
  }
  /** Store centre (screen) — float text / fx anchor. */
  konbiniScreen()                           {
    const lx = (BuildingView.KB_X + BUILDING_W) / 2, ly = -M.sidewalk - M.lobby / 2;
    return { x: this.root.x + (lx - this.root.pivot.x) * this.scaleK, y: this.root.y + ly * this.scaleK };
  }
  konbiniLocal()                           {
    return { x: (BuildingView.KB_X + BUILDING_W) / 2, y: -M.sidewalk - M.lobby / 2 };
  }
  get hasKonbini() { return !!this.kb; }

  setLounge(on         ) {
    if (!on) {
      if (this.lounge) { this.lounge.destroy(); this.lounge = null; }
      return;
    }
    if (this.lounge) return;
    const tex = this.tex.sky_lounge;
    const loungeSp = new PIXI.Sprite(tex);
    loungeSp.anchor.set(0.5, 1);
    const wpx = BUILDING_W * 0.42;
    loungeSp.scale.set(wpx / tex.width);
    loungeSp.x = BUILDING_W * 0.56; loungeSp.y = -4;
    this.roofC.addChild(loungeSp);
    this.lounge = loungeSp;
  }
}

function backOut(x        ) {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
