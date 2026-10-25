// World rendering: scrolling 3-section farm map, plots, animals, pond creatures, overlays.
import * as PIXI from "./vendor/pixi.min.mjs";
import { CROPS, ANIMALS, cropById, animalById, ITEM_TEX, MS_PER_FARM_MIN, BASK_MIN, FARM_DAY_MIN } from "./data/catalog.js";
                                              
import { hashRandom, wutongStage } from "./farm.js";
import { MythFx } from "./mythfx.js";
import { t, fmtDur } from "./i18n.js";

export const WORLD_W = 750;
const K = WORLD_W / 1024;
export const RANCH_H = Math.round(960 * K);
export const FIELD_H = 860;
export const POND_H = Math.round(994 * K);
export const RIVER_TOP = RANCH_H + FIELD_H;
export const RIVER_H = Math.round(320 * K);
const CREEK_TOP = RIVER_TOP + Math.round((400 - 330) * K);
const CREEK_BOT = RIVER_TOP + Math.round((610 - 330) * K);
const PEBBLES                             = [[120, CREEK_BOT - 8, 1.2], [305, CREEK_TOP + 44, 0.9], [468, CREEK_BOT - 18, 1.4], [628, CREEK_TOP + 60, 0.8], [228, CREEK_BOT - 30, 0.7]];
                                                                                                                                
                                                                                                     
const W750 = 750; // flow texture period
export const WORLD_H = RANCH_H + FIELD_H + RIVER_H + POND_H;
export const FIELD_TOP = RANCH_H;
export const POND_TOP = RANCH_H + FIELD_H + RIVER_H;
// pond water ellipse (world)
export const POND = { cx: 373, cy: POND_TOP + 337, rx: 293, ry: 194 };
// v51 玉龙湖湾起居带（河湾水面 CREEK 区内）与桥洞区（过桥下潜隐形）；神兽猫岸边作息点；梧桐落点
// v53：玉龙只待河道中央深水带（河宽 1605~1777，中线≈1685；上下各离岸 ≥60px），x 止于 510（再往右是梧桐树冠）；桥洞带 322~462 只穿行不停留
const YU_BAND = { y0: 1670, y1: 1700, x0: 60, x1: 510, bridgeX0: 322, bridgeX1: 462 };
const YU_HOME = { x: 200, y: 1685 };
const YU_QUICK = typeof location !== "undefined" && new URLSearchParams(location.search).has("yuquick"); // v53 试玩：玉龙作息时长 ÷8（不进存档）
const yq = (sec        ) => YU_QUICK ? sec / 8 : sec;
const YU_SWIM = typeof location !== "undefined" && new URLSearchParams(location.search).has("yuswim"); // v53 试玩：玉龙只来回游（不跃塘），用来看过桥与水痕 // 栖眠：桥左侧最宽最深的一段（x 130~270）
const MC_WILLOW = { x: 155, y: 1922 };
const MC_PEER = { x: 520, y: 1895 };
const MC_PATROL = { y0: 1490, y1: 1520, x0: 150, x1: 620 };
export const WUTONG_SPOT = { x: 668, y: 1856 }; // v53：改到池塘右侧河岸（与左侧柳树隔塘相望），不与任何地块重叠；纯渲染常量，不进存档
const WUTONG_H = [96, 170, 220]; // 梧桐三阶段显示高（右岸空位宽 ≤220：x 530~750 完整显示） // 梧桐三阶段显示高（约束 ≤560）
// sunbathing spots (rock island first, then the wooden dock) — world coords, turtle feet line
export const BASK_SPOT_POS = [{ x: 538, y: POND_TOP + 282 }, { x: 507, y: POND_TOP + 462 }, { x: 582, y: POND_TOP + 515 }];
// 狗狗巡逻路线（牧场下方土路边）、北极熊打盹点（冰屋前）、冰块装饰
const DOG_LANE = [{ x: 150, y: 666 }, { x: 375, y: 676 }, { x: 604, y: 662 }];
const DOG_TEST_SPEED = Math.max(1, Math.min(60, Number(new URLSearchParams((typeof location !== "undefined" ? location : { search: "" }).search).get("dogfast") || "1") || 1)); // v50：试驾专用狗速倍率（无参数=1）
export const BEAR_NAP = { x: 636, y: 448 };
const ROCK = { x: 538, y: POND_TOP + 268 };
export const RANCH_AREA = { x0: 92, x1: 660, y0: 318, y1: 548 };
// 鸡舍门口与干饭/饮水点：从 ranch 背景图实测换算（1024 纹理 ×K → 世界坐标）。
// 鸡舍门洞 tex≈(283,415)→(207,304)；鸡鸭夜里围着门口睡，站位错开 2 层不重叠
export const COOP_DOOR = { x: 207, y: 304 };
const COOP_SPOTS                             = [
  { x: 160, y: 342 }, { x: 207, y: 346 }, { x: 254, y: 340 }, // 前排
  { x: 181, y: 370 }, { x: 236, y: 374 },                      // 后排
];
// 左侧两个食槽 / 两个蓝色水盆（x,y=动物落脚点，wx,wy=盆面水波点）
const FEED_POINTS                             = [{ x: 124, y: 500 }, { x: 222, y: 532 }];
const DRINK_POINTS                                                     = [{ x: 112, y: 552, wx: 100, wy: 531 }, { x: 548, y: 570, wx: 562, wy: 556 }];
export const PLOT_W = 186, PLOT_H = 128;
export const plotCenter = (i        ) => ({ x: 375 + ((i % 3) - 1) * 206, y: FIELD_TOP + 190 + Math.floor(i / 3) * 152 });

export const FONT = '"PingFang SC","Hiragino Sans GB","Hiragino Kaku Gothic ProN","Microsoft YaHei","Noto Sans CJK SC","Noto Sans CJK JP",system-ui,sans-serif';
const INK = 0x4a3222, CREAM = 0xfff6e0, BORDER = 0xb07a45, GREEN = 0x6dbb3c, GLOW = 0xffe066, COIN = 0xf7c531;

                                               
                                                                                               
                                                                                                        

function label(size        , fill = 0xffffff, stroke = INK) {
  return new PIXI.Text({ text: "", style: { fontFamily: FONT, fontSize: size, fontWeight: "800", fill, stroke: { color: stroke, width: Math.max(3, size / 5), join: "round" }, align: "center" } });
}
function setText(tx           , s        ) { if (tx.text !== s) tx.text = s; }

;                                                                                      

/** 确定性 mulberry32：天气粒子全部用它取随机（项目硬规定：新代码零 Math.random）。种子由 hashRandom(`wxseed|${farmDay}`) 派生。 */
const mulberry32 = (seed        ) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

class PlotView {
  root = new PIXI.Container();
  soil             ; crop             ; glow = new PIXI.Graphics(); bar = new PIXI.Graphics();
  hint = new PIXI.Graphics(); lock = new PIXI.Container(); price           ; text = label(28);
  star = new PIXI.Graphics(); cropScale = 1; lastStage = -1; lastKey = "";
  barWpx = -1; // v49：生长条重建缓存（-1=未画；0=已清空；>0=像素宽）
  cropWrap = new PIXI.Container(); need = label(30);
  bugs = new PIXI.Container(); bugRoots                   = []; bugSegs                    = []; // 长虫时趴在作物上蠕动的绿毛虫（统一一种）
  // 土壤干湿 tint 平滑过渡（约 0.5s 收敛）：干渴浅黄 ↔ 正常深润的渐变，替代原来瞬间切色
  soilTintR = 255; soilTintG = 255; soilTintB = 255; soilTintWant = 0xffffff;
  wetFrom = -1; // 浇水落土时刻（view.time 秒）；之后 WET_HOLD 秒保持湿深色，再缓回常色
  wetness(now        ) { return this.wetFrom >= 0 && now >= this.wetFrom && now < this.wetFrom + 6 ? 1 : 0; }
  i        ;
  constructor(i        , tex     ) {
    this.i = i;
    const c = plotCenter(i);
    this.root.position.set(c.x, c.y);
    this.soil = new PIXI.Sprite(tex["sprites/plot"]);
    this.soil.anchor.set(0.5); this.soil.width = PLOT_W; this.soil.height = PLOT_H;
    this.glow.ellipse(0, 0, PLOT_W * 0.52, PLOT_H * 0.5).fill({ color: GLOW, alpha: 0.55 });
    this.glow.blendMode = "add"; this.glow.visible = false;
    this.hint.roundRect(-PLOT_W / 2 + 4, -PLOT_H / 2 + 4, PLOT_W - 8, PLOT_H - 8, 18).stroke({ width: 5, color: 0xffffff, alpha: 0.95 });
    this.hint.visible = false;
    this.crop = new PIXI.Sprite(PIXI.Texture.EMPTY); this.crop.anchor.set(0.5, 1);
    this.cropWrap.position.set(0, PLOT_H * 0.28);
    this.cropWrap.addChild(this.crop);
    // 2~3 只绿毛虫：长虫时在作物上蠕动（统一绿色毛虫一种，无其它颜色/样式变体）
    for (let k = 0; k < 3; k++) {
      const root = new PIXI.Container();
      const sh = new PIXI.Graphics();
      sh.ellipse(0, 6.6, 16, 3.4).fill({ color: 0x000000, alpha: 0.2 }); // 影子衬出虫身
      root.addChild(sh);
      const body = 0x7ac74f, rim = 0x3d7a26;
      const segs                  = [];
      for (let s = 0; s < 3; s++) {
        const g = new PIXI.Graphics();
        const r = 6.4 - s * 0.9;
        g.circle(0, 0, r).fill(body).stroke({ width: 1.6, color: rim });
        g.circle(-r * 0.25, -r * 0.3, r * 0.34).fill({ color: 0xa5e07a, alpha: 0.85 }); // 节面高光
        g.moveTo(-2.2, r * 0.8).lineTo(-3.6, r * 0.8 + 4.2).stroke({ width: 1.5, color: rim }); // 小脚
        g.moveTo(2.2, r * 0.8).lineTo(3.6, r * 0.8 + 4.2).stroke({ width: 1.5, color: rim });
        g.x = -11 + s * 9;
        segs.push(g); root.addChild(g);
      }
      const head = new PIXI.Graphics();
      head.circle(0, -1, 5.4).fill(0x8fd45f).stroke({ width: 1.6, color: rim });
      head.circle(1.8, -2.6, 1.5).fill(0xffffff); head.circle(2.2, -2.6, 0.75).fill(0x223311); // 眼睛
      head.moveTo(0.5, -6).quadraticCurveTo(0, -10, -3.5, -11.5).stroke({ width: 1.4, color: rim }); // 触角
      head.moveTo(3.5, -5.6).quadraticCurveTo(4.5, -10, 8, -10.5).stroke({ width: 1.4, color: rim });
      head.circle(-3.7, -11.6, 1).fill(rim); head.circle(8.2, -10.6, 1).fill(rim);
      head.x = 15;
      segs.push(head); root.addChild(head);
      root.scale.set(1.35);
      this.bugRoots.push(root); this.bugSegs.push(segs);
      this.bugs.addChild(root);
    }
    this.bugs.visible = false;
    // star twinkle for ripe state
    this.star.star(0, 0, 4, 11, 4).fill({ color: 0xffffff }); this.star.visible = false;
    // lock badge
    const padlock = new PIXI.Graphics();
    padlock.roundRect(-14, -30, 28, 24, 6).stroke({ width: 6, color: 0x9aa0a6 });
    padlock.roundRect(-22, -14, 44, 34, 8).fill({ color: 0xb8bec4 }).stroke({ width: 3, color: 0x5d6166 });
    padlock.circle(0, 0, 5).fill({ color: 0x5d6166 }); padlock.rect(-2, 0, 4, 10).fill({ color: 0x5d6166 });
    padlock.position.set(0, -12);
    const pill = new PIXI.Graphics(); pill.roundRect(-48, 22, 96, 32, 16).fill({ color: 0xfff1b8 }).stroke({ width: 3, color: 0xc99a2e });
    const coin = new PIXI.Sprite(tex["items/i28"]); coin.anchor.set(0.5); coin.width = coin.height = 26; coin.position.set(-28, 38);
    this.price = label(25, INK, 0xfff1b8); this.price.anchor.set(0, 0.5); this.price.position.set(-12, 38);
    this.lock.addChild(padlock, pill, coin, this.price);
    this.text.anchor.set(0.5); this.text.position.set(0, PLOT_H / 2 - 6);
    this.need.anchor.set(0.5); this.need.position.set(PLOT_W / 2 - 26, -PLOT_H / 2 + 6); this.need.visible = false;
    this.root.addChild(this.glow, this.soil, this.hint, this.cropWrap, this.bugs, this.star, this.bar, this.lock, this.text, this.need);
  }
  /** 每帧土壤 tint 向目标色缓动（~0.5s 收敛；dt 已 clamp，先天防大跳帧） */
  applySoilTint(dt        ) {
    const tr = (this.soilTintWant >> 16) & 255, tg = (this.soilTintWant >> 8) & 255, tb = this.soilTintWant & 255;
    if (this.soilTintR === tr && this.soilTintG === tg && this.soilTintB === tb) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 7);
    this.soilTintR += (tr - this.soilTintR) * k;
    this.soilTintG += (tg - this.soilTintG) * k;
    this.soilTintB += (tb - this.soilTintB) * k;
    this.soil.tint = (Math.round(this.soilTintR) << 16) | (Math.round(this.soilTintG) << 8) | Math.round(this.soilTintB);
  }
}

export class AnimalView {
  root = new PIXI.Container(); body                                   ; bubble = new PIXI.Container();
  diveT = -1; nextDive = 0;
  remainT = -1; remainY0 = 0; remainBub = 0;
  status = label(30, 0xffffff, 0xffffff); anim                             = null;
  x        ; y        ; tx        ; ty        ; wait = 0; speed        ; face = 1; phase = Math.random() * 10;
  faceS = 1; turnCd = 0; pendingFace = 0;
  baseScale = 1; isBaby = true; hop = 0; bubbleIcon             ; zone                  ;
  an        ; view           ;
  bodyKey = ""; spot = -1; onSpot = false; nibble = 0; food              = null;
  sleepUntil = 0; displayUntil = 0; napUntil = 0; onNap = false; nextNap = 0; nextDisplay = 0; dogTrips = 0;
  dogPath                                    = null; dogStep = 0; // v50 长途巡游路点
  glowFx                       = null; // v50：神兽猫脚下永久金辉（成年后显现）
  // v52 神物特效：符文圈/脉动光晕（神兽猫）+ 粒子发射计时（全部 eventMode none）
  rune                     = null; runeWrap                        = null; pulse                     = null;
  fxAcc = 0; fxAcc2 = 0; fxAcc3 = 0; fxFlashT = 0; fxWasAsleep = false; fxWasMoving = false;
  // —— 统一作息（纯表现层）：白天醒30~60s/睡90~180s（幼崽×1.35），夜里全员随夜晚阈值入睡 ——
  resting = false; restNight = false; restAt = 0; restWakeAt = 0; wakeGrace = 0; sleepCycle = 0;
  homeSpot = -1; graze                                                                                    = null; grazeAt = 0; grazeT = 0;
  zzzAcc = 0; sipAcc = 0; asleep = false; homing = false;
  // 鱼跃出水面：leapT >= 0 期间覆盖位置/姿态（抛物线 + 切线旋转），游走与下潜暂停
  leapT = -1; leapDur = 1; leapX0 = 0; leapY0 = 0; leapX1 = 0; leapY1 = 0; leapPeak = 0;
  sun = new PIXI.Container(); sunRays = new PIXI.Graphics(); ring = new PIXI.Graphics(); ripple = new PIXI.Graphics();
  bearNaps = 0; // v50：北极熊午睡计数（确定性排程种子用）
  // v51：玉龙河湾作息 / 神兽猫岸边作息（确定性 mulberry32 排程，零 Math.random）
  yuPhase                            = "sleep"; yuPhaseT = 0; yuTrip = 0; yuLaps = 0; yuA = 0; yuA0 = 0; yuNextLeap = 0; yuLapT = 0;
  mcPhase                               = "patrol"; mcTrip = 0; mcArrived = false; mcPath                                    = null; mcStep = 0;
  mcRngTicket = 0;
  ringL = -1; // v49：乌龟晒太阳倒计时圆环重建缓存（-1=未画；0=已清空；>0=进度档）
  constructor(an        , view           ) {
    this.an = an; this.view = view;
    const d = animalById(an.kind); this.zone = d.zone;
    const p = an.kind === "dog" ? DOG_LANE[0] : view.randomSpot(this.zone); // v50：狗出生在门外土路（从开始就沿设计路径，不穿栅栏角）
    this.x = p.x; this.y = p.y; this.tx = p.x; this.ty = p.y;
    if (an.kind === "yulong") { // v51：玉龙出生在河湾（成年后的起居带；幼崽期在塘里戏水）
      this.x = 110 + ((an.uid * 97) % 170); this.y = YU_HOME.y - 8 + ((an.uid * 53) % 16); // v53：出生在桥左深水段（不在桥洞下）
      this.tx = this.x; this.ty = this.y;
    }
    if (an.kind === "mythcat") { this.x = MC_WILLOW.x + 24; this.y = MC_WILLOW.y + 6; this.tx = this.x; this.ty = this.y; } // v51：神兽猫生在柳树下
    this.speed = d.zone === "pond" ? (an.kind === "turtle" ? 14 : 20) : d.id === "chicken" || d.id === "duck" ? 30 : 22;
    if (an.kind === "polarbear") this.nextNap = view.time + 2 + Math.random() * 3; // 出生就在冰块旁入睡
    this.restAt = view.time + 8 + ((an.uid * 41) % 40);  // 初始睡眠窗口错开（确定性：按 uid）
    this.grazeAt = view.time + 20 + ((an.uid * 53) % 90);
    this.body = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.root.addChild(this.body);
    const bg = new PIXI.Graphics();
    bg.circle(0, 0, 30).fill({ color: 0xffffff }).stroke({ width: 3, color: BORDER });
    bg.poly([-8, 26, 8, 26, 0, 40]).fill({ color: 0xffffff });
    this.bubbleIcon = new PIXI.Sprite(view.tex[`items/i${String(ITEM_TEX[d.item]).padStart(2, "0")}`]);
    this.bubbleIcon.anchor.set(0.5); this.bubbleIcon.width = this.bubbleIcon.height = 40;
    this.bubble.addChild(bg, this.bubbleIcon); this.bubble.visible = false;
    this.status.anchor.set(0.5); this.status.visible = false;
    if (an.kind === "turtle") {
      // runtime state overlays: sun rays while basking, water ripple while swimming
      for (let r = 0; r < 12; r++) {
        const a = r / 12 * Math.PI * 2, a2 = a + 0.13;
        this.sunRays.poly([Math.cos(a) * 36, Math.sin(a) * 36, Math.cos(a - 0.13) * 96, Math.sin(a - 0.13) * 96, Math.cos(a2) * 96, Math.sin(a2) * 96]);
      }
      this.sunRays.fill({ color: 0xffe066, alpha: 0.7 });
      const glow = new PIXI.Graphics().circle(0, 0, 60).fill({ color: 0xfff1b8, alpha: 0.55 });
      this.sun.addChild(glow, this.sunRays); this.sun.visible = false;
      this.ripple.ellipse(0, 0, 40, 11).stroke({ width: 3, color: 0xffffff, alpha: 0.7 }).ellipse(0, 0, 54, 15).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
      this.ripple.visible = false;
      this.root.addChild(this.ripple, this.sun);
    }
    this.root.addChild(this.bubble, this.status, this.ring);
    this.refreshBody(true);
  }
  ghost                     = null; ghostAlpha = 1; xfade = 0; poseH = 0; sleepK = 0;
  height() { return animalById(this.an.kind).height * (this.isBaby ? 0.62 : 1); }
  /** 当前姿态的可见高度（睡姿更矮）：状态气泡 / Zzz / 点击上沿都跟它走 */
  topH() { return this.poseH || this.height(); }
  refreshBody(force = false) {
    const info = this.view.farm.animalInfo(this.an);
    const baby = !info.mature && !animalById(this.an.kind).noBaby;
    const kind = this.an.kind;
    const nibbleAnim = this.view.anims[kind + "-nibble"];
    const t = this.view.time;
    const sleepKey = kind === "dog" && (t < this.sleepUntil || this.asleep) ? "dogsleep"
      : kind === "polarbear" && ((t < this.napUntil && this.onNap) || this.asleep) ? "bearsleep"
      : this.asleep && SLEEP_POSE[kind] && !(kind === "turtle" && this.onSpot) ? "sleep"
      : null; // bears sleep at any age (newborn naps by the ice pile)；统一作息入睡 → 睡姿图（成年/幼体共用）
    const deadPond = this.zone === "pond" && this.an.dead;
    const remainsKey = deadPond ? (kind === "turtle" ? "turtleshell" : "fishbone") : null;
    const key = remainsKey ?? (sleepKey ?? (baby ? "baby" : this.nibble > 0 && nibbleAnim ? "nibble"
      : this.onSpot && kind === "turtle" ? "bask"
      : kind === "peacock" && t < this.displayUntil ? "spread"
      : "adult"));
    if (!force && key === this.bodyKey) return;
    const SLEEPY = (k        ) => k === "sleep" || k === "dogsleep" || k === "bearsleep";
    const crossfade = !force && this.bodyKey !== "" && (SLEEPY(key) || SLEEPY(this.bodyKey)) && !this.an.dead;
    this.bodyKey = key; this.isBaby = baby;
    if (this.ghost) { this.ghost.destroy(); this.ghost = null; }
    if (crossfade) { this.ghost = this.body; this.ghostAlpha = this.body.alpha; this.xfade = XFADE; } // 入睡/醒来：旧姿态淡出、新姿态淡入（0.4s）
    else { this.root.removeChild(this.body); this.body.destroy(); this.xfade = 0; }
    const anim = key === "nibble" ? nibbleAnim : key === "adult" ? this.view.anims[kind] : undefined;
    if (anim) {
      const a = new PIXI.AnimatedSprite(anim.frames); a.animationSpeed = anim.fps / 60;
      a.anchor.set(0.5, this.zone === "pond" && kind !== "turtle" ? 0.5 : anim.anchorY);
      if (key === "nibble") { a.loop = false; a.onComplete = () => { this.nibble = 0; }; }
      a.play(); this.anim = a; this.body = a;
    } else {
      this.anim = null;
      const BODY_TEX                         = { bask: "animals/turtle-bask", spread: "animals/peacock-spread", dogsleep: "animals/dog-sleep", bearsleep: "animals/polarbear-sleep", fishbone: "sprites/fishbone", turtleshell: "sprites/turtleshell" };
      this.body = new PIXI.Sprite(this.view.tex[key === "sleep" ? `animals/${kind}-sleep` : baby && !SLEEPY(key) ? `babies/${kind}` : (BODY_TEX[key] ?? `animals/${kind}`)]);
      this.body.anchor.set(0.5, this.zone === "pond" && kind !== "turtle" ? 0.5 : 1);
    }
    const h = this.height() * (key === "bask" ? 0.95 : key === "spread" ? 1.3 : key === "dogsleep" || key === "bearsleep" ? 0.6 : key === "sleep" ? SLEEP_POSE[kind] : key === "fishbone" || key === "turtleshell" ? 0.55 : 1);
    const texH = anim ? anim.frames[0].height * 0.82 : this.body.texture.height;
    this.baseScale = h / texH;
    this.body.scale.set(this.baseScale);
    const under = this.zone === "pond" && !baby && key !== "fishbone" && key !== "turtleshell" && kind !== "turtle";
    this.body.tint = under ? 0xbfe0f2 : 0xffffff;
    this.body.alpha = under ? 0.86 : 1;
    this.root.addChildAt(this.body, this.sun.parent ? this.root.getChildIndex(this.sun) + 1 : 0);
    this.poseH = h;
    this.bubble.position.set(0, -h - 34);
    this.status.position.set(0, -h - 10);
  }
}

export class BalloonView {
  root = new PIXI.Container();
  bg = new PIXI.Graphics();
  body             ;
  uid        ; kind        ; zone                   = "ranch"; ph = Math.random() * 9;
  x        ; y        ; baseY        ; vx = 11 + Math.random() * 10;
  constructor(an        , view           ) {
    this.uid = an.uid; this.kind = an.kind;
    this.zone = animalById(an.kind).zone;
    if (this.zone === "pond") {
      this.x = POND.cx - 150 + ((an.uid * 173) % 300);
      this.baseY = POND.cy - 95 + ((an.uid * 97) % 110);
    } else {
      this.x = 120 + ((an.uid * 173) % 510);
      this.baseY = 375 + ((an.uid * 97) % 170);
    }
    this.y = this.baseY;
    const d = animalById(this.kind);
    const COLORS = [0xff9f9f, 0xffd28a, 0xb7e07b, 0x9fd6ff, 0xd9b3f5, 0xffc0dc, 0x8fe8d8];
    const col = COLORS[this.uid % COLORS.length];
    const R = Math.max(44, d.height * 0.62);
    this.bg.circle(0, -R * 0.1, R).fill({ color: col, alpha: 0.5 }).stroke({ width: 3, color: 0x8a5a34, alpha: 0.75 });
    this.bg.circle(-R * 0.34, -R * 0.38, R * 0.2).fill({ color: 0xffffff, alpha: 0.55 });
    // 系线与领结
    this.bg.poly([-3, R * 0.85, 3, R * 0.85, 0, R * 0.98]).fill({ color: col, alpha: 0.7 });
    this.bg.moveTo(0, R * 0.98).quadraticCurveTo(2.6, R * 1.25, -2.4, R * 1.55).stroke({ width: 2, color: 0x8a5a34, alpha: 0.65 });
    const tex = view.tex["animals/" + this.kind];
    this.body = new PIXI.Sprite(tex);
    this.body.anchor.set(0.5, 1);
    const bh = R * 0.96;
    const bs = bh / tex.height;
    this.body.scale.set(bs);
    this.body.y = R * 0.62;
    this.root.addChild(this.bg, this.body);
  }
}

const WATER_CAN_S = 1.4; // 水壶图形缩放（壶嘴喷口坐标同步乘）
                
                                                                                             
                                                              
                                                                       
                                                                           
                                                  
  
export class WorldView {
  world = new PIXI.Container();
  backdrop = new PIXI.Container();
  plotsLayer = new PIXI.Container();
  ranchLayer = new PIXI.Container();
  pondLayer = new PIXI.Container();
  dogLayer = new PIXI.Container(); // v50：狗全场巡游专用层（不被分区裁剪，位置在牧场/田地/桥/塘岸都可见）
  wutongLayer = new PIXI.Container(); // v51：神圣梧桐专用层（河之上、田之下；金葵余烬浮空）
          wutongSpr                = [];         wutongStageV = -2;
  myth = new MythFx(300); // v54：梧桐火收敛后池子 420→300 // v52：神物特效粒子池（神兽猫/玉龙/梧桐共用；世界坐标；普通/add 两子层分批；eventMode none）
          wuHalo                = [];         wuFlameAcc = 0;         wuFeatherT = 6;         wuPillarT = 14;
  wutongEmbers = new PIXI.Container(); // 余烬单独一层放在田地之上：从树冠飘出、越过地块（eventMode none，不挡点击）
          embers                                                                        = [];
  floatLayer = new PIXI.Container();
  fxLayer = new PIXI.Container();
  plots             = [];
  animals = new Map                    ();
  clouds                = []; willow              ;
  riverLayer = new PIXI.Container();
  flow                    ;
  waterMesh                        = null;
  waterBuf                                                = null;
  waterBase                      = null; bridge                     = null; bridgeTop                     = null;
  yuFx = new MythFx(160); // v53：玉龙水中特效（桥面之下）
  yuAir = new PIXI.Container(); // v53：玉龙跃起时临时挂到桥面之上
  pebbles                = []; minnows           = [];
  dragonfly              ; dfTouches = 0;
          df = { x: 120, vx: 74, baseY: 0, dipT: 0, touchDone: false, alone: 0 };
  ripples                                                 = [];
  bobber                        = null; bobberPulse = 0;
  germs                                                 = [];
  poops                                                     = []; // 粑粑堆（脚边小坨 + 苍蝇绕圈）
  nightSky = new PIXI.Container(); nightStars                  = []; nightness = 0;
  hour = 12; // 当前农场小时（含 ?tod 预览），update 里写入；作息判定用
  debugSleep                            = "auto"; // 事件调试：强制全部睡 / 全部醒（纯表现层，不进存档）
  dogTestSpeed = DOG_TEST_SPEED; // v50：试驾专用（?dogfast=N 时加速狗的巡游路线验证；默认 1）
          zzzPool                                                                     = [];
  // —— 浇水效果（纯表现层）：水壶弹入→倾斜 35°→蓝色水滴弧形浇灌→水花→土壤湿润闪光 ——
  // 仅 farm "watered" 事件（玩家手动浇水）触发；雨天 tick 自动回水不发事件、不触发。确定性：mulberry32 播种自 地块+farmDay+次数，零 Math.random。
          waterFx            = [];
          waterFxPool            = []; // 对象池：特效节点用完隐藏回池，不反复创建/销毁
          waterSeq = 0;
  waterFxCount = 0; // 已启动浇水特效总次数（playtest 断言用）
  get waterFxActive() { return this.waterFx.length; }
  debugHour                = null; // ?tod=小时 预览固定时刻（0~24），调试用
  debugWx                                  = null; // ?wx=rain|cloud|sun 预览固定天气；只影响表现层，不改模拟、不进存档
  // —— 天气表现层：wxLayer 屏幕锁定（滤镜/雨丝/阳光微尘），wxWater 世界坐标（水面涟漪/土上水花）——
  wxLayer = new PIXI.Container(); wxWater = new PIXI.Container();
          rainC = new PIXI.Container();         moteC = new PIXI.Container();
          tintSun = new PIXI.Graphics();         tintCloud = new PIXI.Graphics();         tintRain = new PIXI.Graphics();
          wxW = { sun: 1, cloud: 0, rain: 0 }; // 天气权重，换天 1~2s 平滑过渡；初始默认晴，载入后淡向真实天气
          wxDay = -1;         wxRng               = () => 0.5;
          wxBandH = 1200;         wxInit = false;
          wxRipAcc = 0;         wxSplAcc = 0;
          rainDrops                                                                                   = [];
          wxRipples                                                             = [];
          wxSplash                                                 = [];
          sunMotes                                                                                             = [];
          cloudFx                                                                                 = [];
  // —— 池塘清澈层次：水下荷叶茎秆、缓慢漂移+呼吸的波光带（椭圆蒙版），低频自然涟漪 ——
          pondFx = new PIXI.Container();
          pondGlints                                                                                      = [];
          pondRings                                                                       = [];
          pondRingAcc = 2.4;         pondRng = mulberry32(0x5eed5);
  // 鱼跃：水花小点池 + 排程（确定性：mulberry32 按 farmDay+次数 派生种子，零 Math.random）
          pondDrops                                                                         = [];
          leapRng = mulberry32(0x1eaf);
          pondLeapNext = 28;         minnowLeapNext = 20;
          leapCount = 0;         minnowLeapCount = 0;         dbgLeapAt = 0;
  /** 已启动的池塘/小河跳跃总次数（含 debug 强制）；playtest snapshot 用来断言行为。 */
  pondLeapsStarted = 0; minnowLeapsStarted = 0;
  // v49 性能：game.ts 的 ticker 实时写入（FPS 指数平滑 + 上一帧 DrawCall 计数），调试面板与 playtest snapshot 读取
  perf = { fps: 0, dc: 0 };
  fps() { return { fps: Math.round(this.perf.fps), dc: this.perf.dc }; }
  /** v49 性能：分区可见性（屏幕上下 260 世界px 边带 ≈ 用户说的 200 屏px 外保险区）。update() 每帧重算，updateWx/动物/粒子共用。 */
          zoneVis = { ranch: true, field: true, creek: true, pond: true }
          wy0 = 0;         wy1 = 1200;
  onLeapSplash                                            = null; // game.ts 接 sfx.splash（3s 最小间隔）
  balloons = new Map                     ();
  ranchOrPondLayer(zone                  ) { return zone === "pond" ? this.pondLayer : this.ranchLayer; }
  sinkBubbles                                                                            = [];
  leaps = 0;
          rippleCd = 0.4;
          leaves                                                                                                            = [];
          leafCd = 1.2;
  motions           = [];
  anims                          = {};
  scale = 1; viewW = 390; viewH = 844; colX = 0;
  scrollY = FIELD_TOP - 40; vel = 0; dragging = false;
  bottomInset = 0; topInset = 0;
  time = 0;

  farm      ; tex     ;
  onAte                                   = null;
  onBaskArrive                                   = null;
  constructor(farm      , tex     , animSheets                                                   , renderer                ) {
    this.farm = farm; this.tex = tex;
    for (const [k, v] of Object.entries(animSheets)) {
      const f = v.m.frame; const frames                 = []; const per = f.cols * f.rows;
      for (let n = 0; n < f.count; n++) {
        const page = Math.floor(n / per), m = n % per;
        const col = m % f.cols, row = Math.floor(m / f.cols);
        frames.push(new PIXI.Texture({ source: v.pages[page].source, frame: new PIXI.Rectangle(col * f.w, row * f.h, f.w, f.h) }));
      }
      this.anims[k] = { frames, fps: v.m.fps, anchorY: v.m.anchor.y, impact: v.m.events?.impact_frame ?? null };
    }
    const mkBg = (into                ) => {
      const ranch = new PIXI.Sprite(new PIXI.Texture({ source: tex["bg/ranch"].source, frame: new PIXI.Rectangle(0, 0, 1024, 960) }));
      ranch.scale.set(K);
      const fieldTex = new PIXI.Texture({ source: tex["bg/field"].source, frame: new PIXI.Rectangle(0, 50, 1024, 915) });
      const field = new PIXI.NineSliceSprite({ texture: fieldTex, leftWidth: 140, rightWidth: 140, topHeight: 150, bottomHeight: 185 });
      field.width = 1024; field.height = FIELD_H / K;
      const fieldWrap = new PIXI.Container(); fieldWrap.addChild(field); fieldWrap.scale.set(K); fieldWrap.y = FIELD_TOP;
      const river = new PIXI.Sprite(new PIXI.Texture({ source: tex["bg/river"].source, frame: new PIXI.Rectangle(0, 0, 1024, 320) }));
      river.scale.set(K); river.y = RIVER_TOP;
      const pond = new PIXI.Sprite(new PIXI.Texture({ source: tex["bg/pond"].source, frame: new PIXI.Rectangle(0, 30, 1024, 994) }));
      pond.scale.set(K); pond.y = POND_TOP;
      into.addChild(ranch, fieldWrap, river, pond);
    };
    // flowing creek: streak texture generated once from code, tiled across the creek band, scrolled downstream
    const bgLayer = new PIXI.Container();
    mkBg(bgLayer);
    {
      const idx = bgLayer.children.findIndex(c => (c               ).texture?.source === tex["bg/river"].source && c.y === RIVER_TOP);
      const mesh = new PIXI.MeshPlane({ texture: new PIXI.Texture({ source: tex["bg/river"].source, frame: new PIXI.Rectangle(0, 0, 1024, 320) }), verticesX: 40, verticesY: 9 });
      mesh.scale.set(K); mesh.y = RIVER_TOP;
      bgLayer.removeChildAt(idx); bgLayer.addChildAt(mesh, idx);
      this.waterMesh = mesh;
      const buf = mesh.geometry.getAttribute("aPosition").buffer                                                     ;
      this.waterBuf = buf; this.waterBase = new Float32Array(buf.data.length); this.waterBase.set(buf.data);
      {
        const cs = document.createElement("canvas"); cs.width = 256; cs.height = 256;
        const x2 = cs.getContext("2d") ;
        x2.fillStyle = "#808080"; x2.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 46; k++) {
          const rx = Math.random() * 256, ry = 76 + Math.random() * 92, r = 9 + Math.random() * 26;
          const rr = 96 + Math.floor(Math.random() * 64), gg = 96 + Math.floor(Math.random() * 64);
          const grd = x2.createRadialGradient(rx, ry, 0, rx, ry, r);
          grd.addColorStop(0, "rgba(" + rr + "," + gg + ",128,0.6)");
          grd.addColorStop(1, "rgba(128,128,128,0)");
          x2.fillStyle = grd; x2.beginPath(); x2.arc(rx, ry, r, 0, Math.PI * 2); x2.fill();
        }
        const dpSprite = new PIXI.Sprite(PIXI.Texture.from(cs));
        dpSprite.renderable = false; bgLayer.addChild(dpSprite);
        dpSprite.position.set(0, RIVER_TOP); dpSprite.width = WORLD_W; dpSprite.height = RIVER_H;
        mesh.filters = [new PIXI.DisplacementFilter({ sprite: dpSprite, scale: 14 })];
      }
    }
    if (renderer) {
      const H = CREEK_BOT - CREEK_TOP;
      const streaks = new PIXI.Graphics();
      const W = (x        , y        , len        , w        , col        , al        ) => {
        for (const dx of [0, -W750]) streaks.moveTo(x + dx, y)
          .bezierCurveTo(x + dx + len * 0.36, y - 8, x + dx + len * 0.62, y + 8, x + dx + len, y + 1)
          .stroke({ width: w, color: col, alpha: al, cap: "round" });
      };
      // bright current lines — bold enough to read on the turquoise water
      const rows                                                                 = [];
      for (let r = 0; r < 5; r++) rows.push({ y: (r + 0.5) * H / 5 + (r % 2 ? 5 : -5), n: 4, len: 96 + (r % 3) * 26, w: 4 + (r % 2), al: 0.5 + (r % 3) * 0.12 });
      for (let ri = 0; ri < rows.length; ri++) {
        const { y, n, len, w, al } = rows[ri];
        for (let k = 0; k < n; k++) {
          W(k * 187 + ((ri * 61) % 83), y, len, w, 0xffffff, al);
          if (k % 2 === 0) W(k * 187 + ((ri * 61) % 83) + 62, y + 6, len * 0.6, 3, 0xd6f2ff, al * 0.8);
        }
      }
      // darker undertow lines: the current shows by contrast, not just highlights
      for (let ri = 0; ri < 4; ri++) {
        const y = (ri + 0.8) * H / 4;
        for (let k = 0; k < 4; k++) W(k * 205 + ((ri * 47) % 71), y, 110, 5, 0x1f6e94, 0.30);
      }
      // bright glints racing with the current
      for (let k = 0; k < 26; k++) {
        const x = (k * 131 + 37) % 750, y = (k * 53 + 19) % H;
        for (const dx of [0, -W750]) streaks
          .circle(x + dx, y, 2.2).fill({ color: 0xffffff, alpha: 0.55 })
          .circle(x + dx + 9, y + 3, 1.4).fill({ color: 0xd6f2ff, alpha: 0.5 });
      }
      const rt = renderer.generateTexture({ target: streaks, frame: new PIXI.Rectangle(0, 0, 750, H) });
      streaks.destroy();
      const f = new PIXI.TilingSprite({ texture: rt, width: WORLD_W, height: H });
      f.position.set(0, CREEK_TOP); f.alpha = 0.55;
      bgLayer.addChild(f);
      this.flow = f;
      // riverbed decorations: pebble clusters + tiny submerged minnows ("clear enough to see the bottom")
      for (const [px, py, sc] of PEBBLES) {
        const p = new PIXI.Sprite(tex["sprites/pebbles"]);
        p.anchor.set(0.5, 1); p.position.set(px, py);
        p.height = 34 * sc; p.width = 34 * sc * (tex["sprites/pebbles"].width / tex["sprites/pebbles"].height);
        p.alpha = 0.62;
        bgLayer.addChild(p); this.pebbles.push(p);
      }
      const deckTex = new PIXI.Texture({ source: tex["bg/river"].source, frame: new PIXI.Rectangle(470, 58, 134, 262) });
      this.bridge = new PIXI.Sprite(deckTex);
      this.bridge.scale.set(K); this.bridge.position.set(470 * K, RIVER_TOP + 58 * K);
      bgLayer.addChild(this.bridge);
      // v53：桥面盖板（水面像素已抠透明）——放在玉龙/河中特效之上，玉龙游到桥位时从桥下穿过
      this.bridgeTop = new PIXI.Sprite(tex["sprites/bridge-deck"]);
      this.bridgeTop.scale.set(K); this.bridgeTop.position.set(470 * K, RIVER_TOP + 40 * K); this.bridgeTop.eventMode = "none";
      for (let k = 0; k < 3; k++) {
        const m = new PIXI.AnimatedSprite(this.anims["fish"].frames);
        m.animationSpeed = 0.5; m.anchor.set(0.5, 0.5);
        m.height = 20; m.width = 20 * (this.anims["fish"].frames[0].width / this.anims["fish"].frames[0].height) * 0.82;
        m.tint = 0x9fcfe8; m.alpha = 0.6; m.play();
        const fs2         = { g: m, x: 80 + Math.random() * 590, y: CREEK_TOP + 25 + Math.random() * (CREEK_BOT - CREEK_TOP - 50),
          face: Math.random() < 0.5 ? -1 : 1, faceS: 0, wait: 0, vx: 0, ph: Math.random() * 9,
          leapT: -1, leapDur: 0.6, leapX0: 0, leapY0: 0, leapX1: 0, leapPeak: 40 };
        fs2.faceS = fs2.face;
        bgLayer.addChild(m); this.minnows.push(fs2);
      }
    }

    mkBg(this.backdrop);
    this.backdrop.filters = [new PIXI.BlurFilter({ strength: 10, quality: 2, resolution: 0.5 })];
    this.backdrop.alpha = 0.75;
    for (let c = 0; c < 3; c++) {
      const cloud = new PIXI.Sprite(tex["sprites/cloud"]); cloud.anchor.set(0.5); cloud.scale.set(0.42 + c * 0.08);
      cloud.position.set(120 + c * 260, 40 + (c % 2) * 50); cloud.alpha = 0.92; this.clouds.push(cloud);
    }
    // 天气加云：多云/雨天浮出来的更大、更灰的云（晴天藏起），也加入 this.clouds 一起漂移
    for (let c = 0; c < 5; c++) {
      const cloud = new PIXI.Sprite(tex["sprites/cloud"]); cloud.anchor.set(0.5);
      cloud.scale.set(0.56 + (c % 3) * 0.1);
      cloud.position.set(90 + ((c * 197 + 130) % 620), 22 + ((c * 67 + 40) % 148));
      cloud.alpha = 0; cloud.eventMode = "none"; this.clouds.push(cloud);
    }
    // 云的当前颜色状态（逐帧向天气目标色插值）：前 3 朵白云小、原色；后 5 朵天气云大、起始于透明
    this.cloudFx = this.clouds.map((s, i) => ({ s, big: i >= 3, r: 255, g: 255, b: 255, a: i >= 3 ? 0 : 0.92 }));
    this.ranchLayer.sortableChildren = true; this.pondLayer.sortableChildren = true;
    // pile of ice blocks (replaces the igloo; clearly smaller than the left coop)
    const pile                             = [[594, 336, 58], [636, 348, 46], [613, 356, 36]];
    pile.forEach(([px, py, ph], k) => {
      const ice = new PIXI.Sprite(tex["sprites/iceblock"]);
      ice.anchor.set(0.5, 1); ice.position.set(px, py); ice.height = ph; ice.width = ph * (tex["sprites/iceblock"].width / tex["sprites/iceblock"].height);
      ice.zIndex = py + 4 + k * 0.5;
      this.ranchLayer.addChild(ice);
    });
    // ambience props (decoration only, no interaction)
    const crow = new PIXI.Sprite(tex["sprites/scarecrow"]); crow.anchor.set(0.5, 1);
    crow.height = 125; crow.width = 125 * (tex["sprites/scarecrow"].width / tex["sprites/scarecrow"].height);
    crow.position.set(645, 348); crow.zIndex = 348;
    this.ranchLayer.addChild(crow);
    this.willow = new PIXI.Sprite(tex["sprites/willow2"]);
    this.willow.anchor.set(0.5, 1); this.willow.position.set(155, POND_TOP + 125);
    this.willow.height = 215; this.willow.width = 215 * (tex["sprites/willow2"].width / tex["sprites/willow2"].height);
    this.pondLayer.addChild(this.willow);
    // dragonfly: cruises low above the creek, dips to kiss the water and ring a ripple
    this.dragonfly = new PIXI.Sprite(tex["sprites/dragonfly"]); this.dragonfly.anchor.set(0.5);
    this.df.baseY = (CREEK_TOP + CREEK_BOT) / 2 - 26;
    this.dragonfly.position.set(this.df.x, this.df.baseY);
    this.dragonfly.width = 34; this.dragonfly.height = 34 * (tex["sprites/dragonfly"].height / tex["sprites/dragonfly"].width);
    this.riverLayer.addChild(this.dragonfly);
    // 昼夜：整片夜色 + 牧场天空的星星月亮，白天隐藏，夜里慢慢降暗
    {
      const nr = new PIXI.Graphics(); nr.rect(0, 0, WORLD_W, WORLD_H).fill({ color: 0x14224f });
      this.nightSky.addChild(nr);
      for (let i = 0; i < 26; i++) {
        const s = new PIXI.Graphics();
        if (i % 6 === 0) { s.moveTo(0, -4).lineTo(0, 4).moveTo(-4, 0).lineTo(4, 0).stroke({ width: 1.4, color: 0xffffff }); }
        else s.circle(0, 0, i % 5 === 0 ? 2.4 : 1.5).fill({ color: 0xffffff });
        s.position.set(24 + ((i * 89) % (WORLD_W - 48)), 22 + ((i * 57) % 300));
        this.nightStars.push(s); this.nightSky.addChild(s);
      }
      const moon = new PIXI.Graphics();
      moon.circle(0, 0, 44).fill({ color: 0xffe9a8, alpha: 0.2 });
      moon.circle(0, 0, 27).fill({ color: 0xffe9a8 });
      moon.circle(11, -6, 22).fill({ color: 0x14224f }); // 咬掉一块变月牙
      moon.position.set(622, 106);
      this.nightSky.addChild(moon);
      this.nightSky.visible = false;
    }
    this.buildPondFx();
    this.buildWx();
    this.buildZzz();
    this.buildWutong();
    this.dogLayer.sortableChildren = true;
    this.yuAir.eventMode = "none"; this.yuAir.sortableChildren = true;
    this.world.addChild(bgLayer, this.riverLayer, ...this.clouds, this.plotsLayer, this.pondLayer, this.yuFx.layer, ...(this.bridgeTop ? [this.bridgeTop] : []), this.yuAir, this.wutongLayer, this.wutongEmbers, this.ranchLayer, this.dogLayer, this.myth.layer, this.nightSky, this.wxWater, this.wxLayer, this.fxLayer, this.floatLayer);
    for (let i = 0; i < 12; i++) { const p = new PlotView(i, tex); this.plots.push(p); this.plotsLayer.addChild(p.root); }
    this.syncAnimals();
  }

  /** v51：神圣梧桐——三阶段贴图挂底锚 WUTONG_SPOT（v53：池塘右侧河岸 668,1856，与柳树隔塘相望），整层 eventMode=none（绝不挡地块/垂钓点/桥）。 */
          buildWutong() {
    this.wutongLayer.eventMode = "none"; this.wutongEmbers.eventMode = "none"; this.wutongEmbers.interactiveChildren = false;
    for (let i = 0; i < 3; i++) {
      const sp = new PIXI.Sprite(this.tex[`sprites/wutong-${i}`]);
      sp.anchor.set(0.5, 1); sp.position.set(WUTONG_SPOT.x, WUTONG_SPOT.y); sp.eventMode = "none"; sp.visible = false;
      this.wutongSpr.push(sp); this.wutongLayer.addChild(sp);
    }
    const rng = mulberry32(0x5a5a5a); // 固定种子：每粒余烬基础参数恒定（零 Math.random）
    // v52：树冠外层暖色光晕（两层大柔光，脉动）放在余烬层底部
    for (let i = 0; i < 2; i++) {
      const h = new PIXI.Sprite(this.myth.tex.glow); h.anchor.set(0.5); h.blendMode = "add"; h.eventMode = "none"; h.visible = false;
      h.tint = i ? 0xffb030 : 0xff5a10; if (i === 0) h.blendMode = "normal"; // 外层：普通混合暖橙罩（亮叶上也看得见）；内层：add 金光
      this.wuHalo.push(h); this.wutongLayer.addChild(h);
    }
    for (let i = 0; i < 14; i++) { // v54：余烬 36→14（更稀疏、更慢、更暗）
      const g = new PIXI.Graphics();
      const e = 1.6 + rng() * 2.2;
      if (i % 2 === 0) g.circle(0, 0, e * 3).fill({ color: 0xff8a2c, alpha: 0.4 }); // 每三粒带一圈暖光晕
      g.poly([0, -e * 2.2, e, 0, 0, e * 2.2, -e, 0]).fill({ color: i % 2 ? 0xffcf6a : 0xffe9a8, alpha: 0.95 });
      g.blendMode = "add"; g.eventMode = "none"; g.visible = false;
      this.embers.push({ g, ph: rng(), x0: (rng() - 0.5) * 190, w: 6 + rng() * 30, vy: 26 + rng() * 22 });
      this.wutongEmbers.addChild(g);
    }
    this.syncWutong();
  }
  /** v51：按存档种植时间同步梧桐阶段（幼苗/花期/古树）；未种植时整层隐身。 */
  syncWutong() {
    const w = this.farm.s.wutong;
    const st = w ? wutongStage(Math.max(0, this.farm.now() - w.plantedAt)) : -1;
    if (st === this.wutongStageV) return;
    this.wutongStageV = st;
    this.wutongLayer.visible = st >= 0;
    this.wutongSpr.forEach((sp, i) => {
      sp.visible = i === st;
      if (i === st) { const tw = sp.texture.width / sp.texture.height; sp.height = WUTONG_H[i]; sp.width = WUTONG_H[i] * tw; }
    });
  }
  /** 梧桐浮空余烬：从树冠中上部缓升、轻摆、随阶段高度延展（花期起出现；未种时整层不可见）。 */
          updateWutong(dt = 0) {
    const st = this.wutongStageV;
    if (st < 0 || !this.wutongLayer.visible) {
      for (const e of this.embers) if (e.g.visible) e.g.visible = false;
      for (const h of this.wuHalo) if (h.visible) h.visible = false;
      return;
    }
    if (st === 0) { // v54：幼苗无余烬/光晕，只偶尔冒一点小火星
      for (const e of this.embers) if (e.g.visible) e.g.visible = false;
      for (const h of this.wuHalo) if (h.visible) h.visible = false;
    }
    const H = WUTONG_H[st], top = WUTONG_SPOT.y - H * 0.72;
    const ccx = WUTONG_SPOT.x, ccy = WUTONG_SPOT.y - H * 0.66, cr = H * (st === 2 ? 0.36 : 0.3); // 树冠中心/半径
    const night = 1 + this.nightness * 0.5;
    if (st > 0) for (const e of this.embers) {
      e.g.visible = true; e.g.scale.set(0.8);
      if (st < 2 && e.ph > 0.45) { if (e.g.visible) e.g.visible = false; continue; } // v54：花信阶段只留约一半余烬
      const per = 7 + e.ph * 5, k = (this.time / per + e.ph) % 1; // v54：上升更慢
      e.g.position.set(WUTONG_SPOT.x + e.x0 + Math.sin((k + e.ph) * 6.28) * e.w, top + H * 0.2 - k * H * 0.75);
      e.g.alpha = Math.min(0.75, Math.sin(k * Math.PI) * (st === 2 ? 0.6 : 0.4) * (0.7 + 0.3 * Math.sin(this.time * 5 + e.ph * 40)) * night);
      e.g.rotation = e.ph * 6.28 + this.time * (e.vy > 34 ? 1 : -1) * 0.4;
    }
    // 树冠暖光晕脉动（两层错相）
    if (st > 0) this.wuHalo.forEach((h, i) => {
      h.visible = true;
      const pul = Math.max(0, Math.sin(this.time * (i ? 0.7 : 0.45) + i * 1.7)) ** 2; // v54：慢呼吸、一半时间几乎熄灭
      const r = cr * (i ? 1.8 : 2.4) * (1 + 0.03 * pul) / 32;
      h.position.set(ccx, ccy + (i ? 0 : H * 0.05)); h.scale.set(r, r * 0.92);
      h.alpha = (i ? 0.2 : 0.1) * (st === 2 ? 1 : 0.5) * (0.25 + 0.75 * pul) * night;
    });
    const fx = this.myth, r = fx.rng;
    // 跃动火苗：沿树冠外缘（偏上半圈）生成，向上窜、左右摆、由大变小（橙红→金黄随机）
    this.wuFlameAcc += dt * (st === 2 ? 20 : st === 1 ? 4 : 1.2); // v54：火苗 60/30→14/3 个每秒，只在树冠边缘零星跳动
    while (this.wuFlameAcc >= 1) {
      this.wuFlameAcc -= 1;
      let fxp        , fyp        ;
      { const a = -Math.PI * (0.1 + r() * 0.8), rr = cr * (0.75 + r() * 0.3); fxp = ccx + Math.cos(a) * rr * 1.15; fyp = ccy + Math.sin(a) * rr * 0.9; } // v54：只在树冠上半圈边缘/缝隙零星冒
      const c = r(), tint = c < 0.3 ? 0xff4a1a : c < 0.6 ? 0xff7a22 : c < 0.85 ? 0xffa83a : 0xffd65a;
      const big = (st === 2 ? 0.6 : st === 1 ? 0.36 : 0.22) + r() * 0.22, vy = -32 - r() * 30, vx = (r() - 0.5) * 10, dur = 0.5 + r() * 0.4;
      fx.spawn(fxp, fyp, { tex: "flame", vy, vx, dur, s0: big, s1: 0.14, a: 0.6, tint: c < 0.5 ? 0xe8380c : 0xf2600f, wob: 4, wobF: 9, fadeIn: 0.12, normal: true }); // 外焰（普通混合：亮草地上也看得见橙红）
      fx.spawn(fxp, fyp + 2, { tex: "flame", vy, vx, dur, s0: big * 0.62, s1: 0.08, a: 0.8, tint, wob: 4, wobF: 9, fadeIn: 0.12 }); // 内焰（add 混合：金黄发亮）
      if (r() < 0.12) fx.spawn(fxp, fyp, { tex: "glow", vy: -40 - r() * 30, vx: (r() - 0.5) * 40, dur: 1.4 + r(), s0: 0.14, s1: 0.06, a: 1, tint: 0xffe08a, wob: 10, wobF: 3 });
    }
    if (st === 2) { // 古树：凤凰色羽状火光掠过 + 偶尔一束光柱
      this.wuFeatherT -= dt;
      if (this.wuFeatherT <= 0) {
        this.wuFeatherT = 22 + r() * 18; // v54：22~40s 偶发一次
        const dir = r() < 0.5 ? 1 : -1, y0 = ccy - cr * (0.2 + r() * 0.5);
        for (let i = 0; i < 2; i++) this.myth.spawn(ccx - dir * cr * 1.2 - dir * i * 26, y0 + i * 10, { tex: "feather", vx: dir * (230 + i * 10), vy: -40 - i * 6, dur: 1.3, s0: 0.95 - i * 0.12, s1: 1.25 - i * 0.12, a: 0.55 - i * 0.15, tint: i % 2 ? 0xffb030 : 0xff5a28, rot: dir > 0 ? -0.18 : Math.PI + 0.18, vr: dir * 0.18, fadeIn: 0.2 });
      }
      this.wuPillarT -= dt;
      if (this.wuPillarT <= 0) {
        this.wuPillarT = 45 + r() * 30; // v54：45~75s 偶发一束
        fx.spawn(ccx, WUTONG_SPOT.y - 10, { tex: "pillar", dur: 1.6, s0: 1.8, s1: 2.1, flat: H / 256 * 0.55, a: 0.3, tint: 0xffb44a, fadeIn: 0.3 });
        fx.spawn(ccx, ccy, { tex: "star", dur: 1.0, s0: 0.5, s1: 2.2, a: 0.55, tint: 0xffe3a0, vr: 1.2 });
      }
    }
  }

  /** 天气表现层构建：滤镜三条、双层雨丝（池化）、水面涟漪/土上水花（池化）、阳光微尘。全部 eventMode=none，绝不挡点击。 */
          buildWx() {
    const rng0 = mulberry32(0xc0ffee); // 建造期固定种子：池子里每颗粒子的基础参数恒定
    this.wxLayer.eventMode = "none"; this.wxWater.eventMode = "none";
    this.rainC.eventMode = "none"; this.moteC.eventMode = "none";
    const mkTint = (color        ) => { const g = new PIXI.Graphics(); g.eventMode = "none"; g.tint = color; this.wxLayer.addChild(g); return g; };
    this.tintSun = mkTint(0xffd36e); this.tintCloud = mkTint(0x93a0b4); this.tintRain = mkTint(0x2c4a72);
    this.wxResizeRects();
    // 雨丝贴图：一条头亮尾淡的软线（近层放大提亮，远层缩小放淡）
    const rc = document.createElement("canvas"); rc.width = 5; rc.height = 40;
    const rx = rc.getContext("2d") ;
    const grad = rx.createLinearGradient(0, 0, 0, 40);
    grad.addColorStop(0, "rgba(214,234,255,0)");
    grad.addColorStop(0.55, "rgba(219,238,255,0.52)");
    grad.addColorStop(0.92, "rgba(240,250,255,0.92)");
    grad.addColorStop(1, "rgba(240,250,255,0.3)");
    rx.fillStyle = grad; rx.fillRect(1.4, 0, 2.2, 40);
    const rainTex = PIXI.Texture.from(rc);
    const mkDrop = (far         , i        ) => {
      const s = new PIXI.Sprite(rainTex); s.anchor.set(0.5, 1); s.eventMode = "none";
      const vy = far ? 610 + (i % 9) * 17 + rng0() * 40 : 940 + (i % 7) * 26 + rng0() * 60;
      const slant = far ? 0.145 : 0.17; // 风向左斜
      const vx = -vy * slant;
      s.scale.set(far ? 0.72 : 1.14, far ? 0.78 : 1.16);
      s.rotation = Math.atan2(vx, vy);
      this.rainC.addChild(s);
      this.rainDrops.push({ s, x: rng0() * (WORLD_W + 160) - 80, y: rng0() * this.wxBandH, vx, vy, far });
    };
    for (let i = 0; i < 96; i++) mkDrop(true, i);  // 远层：小、淡、慢
    for (let i = 0; i < 72; i++) mkDrop(false, i); // 近层：大、亮、快
    this.wxLayer.addChild(this.rainC);
    // 阳光微尘贴图：柔光小点
    const mc = document.createElement("canvas"); mc.width = mc.height = 12;
    const mx = mc.getContext("2d") ;
    const mg = mx.createRadialGradient(6, 6, 0, 6, 6, 6);
    mg.addColorStop(0, "rgba(255,240,196,0.95)"); mg.addColorStop(0.4, "rgba(255,232,170,0.45)"); mg.addColorStop(1, "rgba(255,232,170,0)");
    mx.fillStyle = mg; mx.fillRect(0, 0, 12, 12);
    const moteTex = PIXI.Texture.from(mc);
    for (let i = 0; i < 14; i++) {
      const s = new PIXI.Sprite(moteTex); s.anchor.set(0.5); s.eventMode = "none";
      s.blendMode = "add"; s.tint = 0xffe6a8; s.scale.set(0.6 + rng0() * 0.8);
      this.moteC.addChild(s);
      this.sunMotes.push({ s, x: rng0() * WORLD_W, y: rng0() * this.wxBandH, vx: -10 + rng0() * 26, vy: -3 + rng0() * 12, ph: rng0() * 9, a0: 0.12 + rng0() * 0.2 });
    }
    this.wxLayer.addChild(this.moteC);
    // 池化涟漪（雨点打在小溪/水塘水面）
    for (let k = 0; k < 44; k++) {
      const g = new PIXI.Graphics(); g.eventMode = "none";
      g.ellipse(0, 0, 5, 2.1).stroke({ width: 1.6, color: 0xffffff });
      g.visible = false; this.wxWater.addChild(g);
      this.wxRipples.push({ g, t: -1, dur: 1, s0: 1 });
    }
    // 池化水花点（雨点打在地块/草地上）
    for (let k = 0; k < 26; k++) {
      const g = new PIXI.Graphics(); g.eventMode = "none";
      for (let a = 0; a < 3; a++) { const ang = a / 3 * Math.PI * 2 - Math.PI / 2; g.moveTo(Math.cos(ang) * 1.2, Math.sin(ang) * 1.2).lineTo(Math.cos(ang) * 4.6, Math.sin(ang) * 4.6); }
      g.stroke({ width: 1.4, color: 0xffffff, cap: "round" });
      g.visible = false; this.wxWater.addChild(g);
      this.wxSplash.push({ g, t: -1, dur: 1 });
    }
  }
  /** 池塘清澈感：茎秆把荷叶"种"进水里，波光带缓慢漂移呼吸，低频小涟漪（全部确定性，不挡点击）。 */
          buildPondFx() {
    this.pondFx.eventMode = "none"; this.pondFx.zIndex = 0.5; // 贴图荷叶之上、游鱼之下
    this.pondLayer.addChild(this.pondFx);
    // 荷叶簇在 pond 贴图里的位置（中心x, 底部y, 簇宽，世界坐标，贴图像素×K 换算）
    const PADS                             = [
      [497, POND_TOP + 238, 85], [174, POND_TOP + 459, 73], [238, POND_TOP + 480, 41],
      [552, POND_TOP + 270, 45], [174, POND_TOP + 261, 48], [228, POND_TOP + 229, 40],
      [598, POND_TOP + 329, 39], [409, POND_TOP + 504, 41], [609, POND_TOP + 300, 21], [561, POND_TOP + 236, 22],
    ];
    const stemG = new PIXI.Graphics(); stemG.eventMode = "none";
    for (const [cx, bot, w] of PADS) {
      stemG.ellipse(cx, bot - 1, w * 0.42, 6.5).fill({ color: 0x0f5044, alpha: 0.17 }); // 叶下软暗影：叶子坐进水里
      const n = w > 60 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const sx = cx + (k - (n - 1) / 2) * (w * 0.27);
        const len = 22 + ((k * 7 + Math.floor(cx)) % 13), bend = (k % 2 === 0 ? -1 : 1) * (5 + ((k * 3 + Math.floor(cx)) % 5));
        stemG.moveTo(sx, bot - 2)
          .bezierCurveTo(sx + bend * 0.4, bot + len * 0.4, sx + bend, bot + len * 0.75, sx + bend * 1.15, bot + len)
          .stroke({ width: 3.2, color: 0x27735f, alpha: 0.42, cap: "round" }); // 水下茎秆：水绿色半透明
      }
    }
    this.pondFx.addChild(stemG);
    // 波光带：椭圆蒙版裁进塘面，时间驱动的漂移+明暗呼吸（无随机）
    const mask = new PIXI.Graphics().ellipse(POND.cx, POND.cy, POND.rx * 0.96, POND.ry * 0.96).fill(0xffffff);
    this.pondFx.addChild(mask);
    const surface = new PIXI.Container(); surface.eventMode = "none"; surface.mask = mask;
    this.pondFx.addChild(surface);
    for (let i = 0; i < 3; i++) {
      const g = new PIXI.Graphics(); g.eventMode = "none";
      g.roundRect(-480, -9, 960, 17 + i * 7, 10).fill(0xf2fffb);
      g.rotation = -0.38; g.alpha = 0;
      surface.addChild(g);
      this.pondGlints.push({ g, x0: POND.cx - 320 + i * 250, y0: POND.cy - 82 + i * 88, spd: 9 + i * 4, ph: i * 2.63, a0: 0.055 + i * 0.03 });
    }
    // 低频自然涟漪 + 鱼跃波纹环（共池 10 只，晴天也有，确定性 LCG 位置；t=-1 闲置，-0.5<t<0 等待错帧启动）
    for (let k = 0; k < 10; k++) {
      const g = new PIXI.Graphics(); g.eventMode = "none";
      g.ellipse(0, 0, 7, 2.9).stroke({ width: 1.8, color: 0xeafcfa });
      g.visible = false; this.pondFx.addChild(g);
      this.pondRings.push({ g, t: -1, dur: 1, s: 1, a: 1 });
    }
    // 鱼跃水花小点（池化 14 粒，白色，抛物线溅落）
    for (let k = 0; k < 14; k++) {
      const g = new PIXI.Graphics(); g.eventMode = "none";
      g.circle(0, 0, 2.1 + (k % 3) * 0.7).fill({ color: 0xf4fffd });
      g.visible = false; this.pondFx.addChild(g);
      this.pondDrops.push({ g, t: -1, dur: 0.5, vx: 0, vy: 0 });
    }
  }
  /** 鱼跃水花：白色小点上溅 + n 圈椭圆波纹环扩散淡出（全部从池里领，满了就跳过，不挡点击）。 */
          splashAt(x        , y        , scale        , rings        ) {
    let launched = 0;
    for (const d of this.pondDrops) {
      if (d.t !== -1) continue;
      const r = this.leapRng;
      d.t = 0; d.dur = 0.45 + r() * 0.25;
      d.vx = (r() * 2 - 1) * 70 * scale;
      d.vy = -(95 + r() * 85) * scale;
      d.g.position.set(x + (r() * 2 - 1) * 8, y - 2);
      d.g.scale.set((0.7 + r() * 0.6) * scale);
      d.g.alpha = 0.95; d.g.visible = true;
      if (++launched >= 5) break;
    }
    for (let i = 0; i < rings; i++) {
      const slot = this.pondRings.find(rr => rr.t === -1);
      if (!slot) return;
      slot.g.position.set(x, y);
      slot.t = -0.09 * i; slot.dur = 1.15 + this.leapRng() * 0.45;
      slot.s = scale * (1 + i * 0.3); slot.a = 1.5;
      slot.g.visible = true;
    }
  }
          updatePondFx(dt        ) {
    const nn = this.nightness, tt = this.time;
    for (const s of this.pondGlints) {
      s.g.position.set(s.x0 + Math.sin(tt * s.spd / 40 + s.ph) * 95, s.y0 + Math.sin(tt * 0.31 + s.ph * 1.7) * 13);
      s.g.alpha = s.a0 * (0.55 + 0.45 * Math.sin(tt * 0.6 + s.ph)) * (1 - nn * 0.7);
    }
    this.pondRingAcc += dt;
    if (this.pondRingAcc >= 3.4) {
      this.pondRingAcc -= 3.4;
      const slot = this.pondRings.find(r => r.t === -1);
      if (slot) {
        const ang = this.pondRng() * Math.PI * 2, rr = Math.sqrt(this.pondRng()) * 0.76;
        slot.g.position.set(POND.cx + Math.cos(ang) * POND.rx * rr, POND.cy + Math.sin(ang) * POND.ry * rr);
        slot.t = 0; slot.dur = 2.4 + this.pondRng() * 0.8; slot.s = 1; slot.a = 1; slot.g.visible = true;
      }
    }
    for (const r of this.pondRings) {
      if (r.t === -1) continue;
      r.t += dt;
      if (r.t < 0) continue; // 错帧等待（鱼跃连发环）
      const k = r.t / r.dur;
      if (k >= 1) { r.t = -1; r.g.visible = false; continue; }
      r.g.scale.set((0.8 + k * 2.8) * r.s);
      r.g.alpha = (1 - k) * 0.5 * r.a * (1 - nn * 0.4);
    }
    // 水花小点：上溅后重力回落淡出
    for (const d of this.pondDrops) {
      if (d.t === -1) continue;
      d.t += dt; const k = d.t / d.dur;
      if (k >= 1) { d.t = -1; d.g.visible = false; continue; }
      d.vy += 460 * dt;
      d.g.x += d.vx * dt; d.g.y += d.vy * dt;
      d.g.alpha = 0.95 * (1 - k * k) * (1 - nn * 0.3);
    }
  }
  /** Zzz 粒子池：24 枚字母文本，睡着的动物轮流领取。 */
          buildZzz() {
    for (let i = 0; i < 24; i++) {
      const tx = label(15, 0xffffff, INK);
      tx.text = "Z"; tx.anchor.set(0.5); tx.visible = false; tx.eventMode = "none";
      this.fxLayer.addChild(tx);
      this.zzzPool.push({ t: tx, k: -1, dur: 1.15, x0: 0, y0: 0 });
    }
  }
          spawnZzz(x        , y        ) {
    const z = this.zzzPool.find(z2 => z2.k < 0);
    if (!z) return;
    z.k = 0.0001; z.x0 = x; z.y0 = y;
    z.t.position.set(x, y); z.t.alpha = 0; z.t.visible = true;
  }
  /** 睡着的鱼：偶尔冒一颗小气泡（复用下沉气泡池的更新逻辑） */
          spawnSleepBubble(x        , y        ) {
    if (this.sinkBubbles.length >= 26) return;
    const bg = new PIXI.Graphics();
    bg.circle(0, 0, 2.4).fill({ color: 0xeaf6ff, alpha: 0.8 }).circle(-0.7, -0.7, 1.1).fill({ color: 0xffffff, alpha: 0.9 });
    bg.position.set(x, y); bg.eventMode = "none";
    this.pondLayer.addChild(bg);
    this.sinkBubbles.push({ g: bg, t: 0, dur: 1.4, vy: 24, drift: 6 });
  }
  /** 水盆喝水小涟漪（蓝色水盆盆面；reused 涟漪池的扩散淡出更新） */
          basinRipple(x        , y        ) {
    if (this.ripples.length >= 9) return;
    const g = new PIXI.Graphics();
    g.ellipse(0, 0, 4, 1.8).stroke({ width: 1.6, color: 0xffffff, alpha: 0.85 });
    g.position.set(x, y); g.eventMode = "none"; g.zIndex = y + 2;
    this.ranchLayer.addChild(g);
    this.ripples.push({ g, t: 0, dur: 1.2 });
  }
  /** 与夜晚滤镜同一阈值：≥19.5 或 <5 视为夜里 */
  isNight() { const h = this.hour; return h >= 19.5 || h < 5; }
  /** ?dbg=leap：进场后 ~0.8s 强制一次鱼跃（优先池塘小鱼；池塘没有小鱼则让小河 minnow 跳）。 */
  forceLeap() { this.dbgLeapAt = this.time + 0.8; }
  /** ?dbg=leap,loop：调试期每 ~5s 游戏时间强制一次鱼跃（走游戏时间，TAB 冻结也准）。 */
  forceLeapLoop() { this._leapLoopPeriod = 5; this.forceLeap(); }
          _leapLoopPeriod = 0;
  // 只有小鱼阶段（isBaby）的池塘鱼会跃出水面；成年鱼不跳，乌龟永不跳。
          pickLeapFish(rng                       )                    {
    const cands = [...this.animals.values()].filter(v =>
      v.zone === "pond" && v.an.kind !== "turtle" && !v.an.dead && v.leapT < 0 &&
      v.isBaby && v.an.sickSince == null && !v.food && v.nibble <= 0 && !v.resting); // 睡着的小鱼不跃
    if (!cands.length) return null;
    const r = rng ?? this.leapRng;
    return cands[Math.floor(r() * cands.length)];
  }
          startPondLeap(v            , rng              ) {
    v.leapDur = 0.8 + rng() * 0.4;
    v.leapX0 = v.x; v.leapY0 = v.y;
    const dir = v.face >= 0 ? 1 : -1; // 顺游向起跳
    v.face = dir          ; v.faceS = dir; v.pendingFace = 0;
    let x1 = v.x + dir * (70 + rng() * 60), y1 = v.y + (rng() - 0.5) * 36;
    const nx = (x1 - POND.cx) / (POND.rx * 0.9), ny = (y1 - POND.cy) / (POND.ry * 0.9);
    const rr = Math.hypot(nx, ny);
    if (rr > 1) { x1 = POND.cx + (nx / rr) * POND.rx * 0.9; y1 = POND.cy + (ny / rr) * POND.ry * 0.9; } // 不出塘面
    v.leapX1 = x1; v.leapY1 = y1;
    v.leapPeak = Math.max(76, v.height() * 1.15) + rng() * 26;
    v.leapT = 0; v.wait = 0; v.diveT = -1; v.nextDive = this.time + 6 + rng() * 8;
    this.pondLeapsStarted++;
    this.splashAt(v.x, v.y, 0.9, 2); // 起跳：水花 + 2 圈波纹
    this.onLeapSplash?.(v.x, v.y);
  }
          startMinnowLeap(rng              ) {
    const cands = this.minnows.filter(m => m.leapT < 0);
    if (!cands.length) return;
    const mn = cands[Math.floor(rng() * cands.length)];
    const dir = mn.face >= 0 ? 1 : -1;
    mn.face = dir          ; mn.faceS = dir; mn.vx = 0;
    mn.leapDur = 0.55 + rng() * 0.2;
    mn.leapX0 = mn.x; mn.leapY0 = mn.y;
    mn.leapX1 = Math.max(50, Math.min(WORLD_W - 50, mn.x + dir * (30 + rng() * 34)));
    mn.leapPeak = 30 + rng() * 16;
    mn.leapT = 0;
    this.minnowLeapsStarted++;
    this.spawnRipple(mn.x, mn.y + 4, 7); // 起跳一小圈
    this.onLeapSplash?.(mn.x, mn.y);
  }
  /** 鱼跃排程：池塘小鱼每 25~50s 一条（按 farmDay+次数 派生种子；没有小鱼时 4s 后再探但不跳），小河 minnow 每 15~30s 一条。 */
          updateLeaps(dt        , now        ) {
    const day = this.farm.farmDay(now);
    if (this.dbgLeapAt > 0 && this.time >= this.dbgLeapAt) {
      this.dbgLeapAt = 0;
      const v = this.pickLeapFish(null);
      if (v) this.startPondLeap(v, this.leapRng); else this.startMinnowLeap(this.leapRng);
      if (this._leapLoopPeriod > 0) this.dbgLeapAt = this.time + this._leapLoopPeriod; // loop 模式：下一周期再跃
    }
    if (this.time >= this.pondLeapNext) {
      const rng = mulberry32(Math.floor(hashRandom(`leap|${day}|${this.leapCount}`) * 4294967296));
      this.leapCount++;
      const v = this.pickLeapFish(rng);
      if (v) { this.startPondLeap(v, rng); this.pondLeapNext = this.time + 25 + rng() * 25; }
      else this.pondLeapNext = this.time + 4; // 暂时没有可跳的小鱼：4s 后再看
    }
    if (this.time >= this.minnowLeapNext) {
      const rng = mulberry32(Math.floor(hashRandom(`mleap|${day}|${this.minnowLeapCount}`) * 4294967296));
      this.minnowLeapCount++;
      if (this.minnows.length) this.startMinnowLeap(rng);
      this.minnowLeapNext = this.time + 15 + rng() * 15;
    }
  }
          wxResizeRects() {
    for (const g of [this.tintSun, this.tintCloud, this.tintRain]) { g.clear(); g.rect(0, 0, WORLD_W, this.wxBandH).fill(0xffffff); }
  }
  /** 每帧：天气权重驱动滤镜透明度、云的变色增减、雨丝回收、涟漪/水花/微尘更新与重生（全程确定性 rng）。 */
          updateWx(dt        , now        ) {
    const day = this.farm.farmDay(now);
    if (day !== this.wxDay) { this.wxDay = day; this.wxRng = mulberry32(Math.floor(hashRandom(`wxseed|${day}`) * 4294967296)); }
    const wx = this.debugWx ?? this.farm.weather(now);
    const w = this.wxW, ease = Math.min(1, dt * 1.35);
    w.sun += ((wx === "sun" ? 1 : 0) - w.sun) * ease;
    w.cloud += ((wx === "cloud" ? 1 : 0) - w.cloud) * ease;
    w.rain += ((wx === "rain" ? 1 : 0) - w.rain) * ease;
    const rng = this.wxRng, nn = this.nightness, bandH = this.wxBandH;
    this.wxLayer.y = this.scrollY - 110; // 屏幕锁定：跟着滚动的可视窗走
    this.wxLayer.visible = w.sun + w.cloud + w.rain > 0.01;
    this.wxWater.visible = w.rain > 0.02;
    // v49：wxWater 是世界坐标层（涟漪/水花都画在小溪与水面位置），出屏即交给 renderer 跳过
    this.wxWater.renderable = w.rain > 0.02 && (this.zoneVis.creek || this.zoneVis.pond);
    if (!this.wxInit) { // 等 layout 定好 bandH，首帧把雨丝/微尘均匀撒开
      this.wxInit = true;
      for (const d of this.rainDrops) { d.x = rng() * (WORLD_W + 160) - 80; d.y = rng() * bandH; }
      for (const m of this.sunMotes) { m.x = rng() * WORLD_W; m.y = rng() * bandH; }
    }
    // 滤镜：晴暖金 / 多云轻灰 / 雨冷蓝（雨夜再暗一点；白天压到很轻，保证一眼仍是白天）
    this.tintSun.alpha = w.sun * 0.055 * (1 - nn);
    this.tintCloud.alpha = w.cloud * 0.045 * (1 - nn * 0.35);
    this.tintRain.alpha = w.rain * (0.085 + nn * 0.13);
    // 云：晴天雪白、多云浅灰更多、雨天灰黑成团
    const kC = Math.min(1, dt * 1.5), wSum = Math.max(0.001, w.sun + w.cloud + w.rain);
    const mix = (s0        , c0        , r0        ) => (w.sun * s0 + w.cloud * c0 + w.rain * r0) / wSum;
    for (const c of this.cloudFx) {
      const tr = c.big ? mix(255, 226, 152) : mix(255, 223, 160);
      const tg = c.big ? mix(255, 231, 160) : mix(255, 228, 168);
      const tb = c.big ? mix(255, 240, 172) : mix(255, 236, 182);
      const ta = c.big ? mix(0, 0.72, 0.9) : mix(0.92, 0.88, 0.95);
      c.r += (tr - c.r) * kC; c.g += (tg - c.g) * kC; c.b += (tb - c.b) * kC; c.a += (ta - c.a) * kC;
      c.s.tint = ((c.r & 0xff) << 16) | ((c.g & 0xff) << 8) | (c.b & 0xff);
      c.s.alpha = Math.max(0, Math.min(1, c.a));
      if (c.big) c.s.visible = c.a > 0.02;
    }
    // 雨丝：到底回收、被风吹出左边后卷回右侧（不带随机的小修正也走 rng）
    const raining = w.rain > 0.015;
    if (this.rainC.visible !== raining) this.rainC.visible = raining;
    if (raining) {
      const aF = (1 - nn * 0.28);
      for (const d of this.rainDrops) {
        d.y += d.vy * dt; d.x += d.vx * dt;
        if (d.y > bandH + 20) { d.y -= bandH + 60; d.x = rng() * (WORLD_W + 160) - 80; }
        if (d.x < -90) d.x += WORLD_W + 180;
        d.s.position.set(d.x, d.y); // 锚点在亮头（底部），头朝下落方向
        d.s.alpha = (d.far ? 0.36 : 0.74) * w.rain * aF;
      }
    }
    // 涟漪：雨打在小溪水面与水塘里，扩散淡出
    for (const r of this.wxRipples) {
      if (r.t < 0) continue;
      r.t += dt; const k = r.t / r.dur;
      if (k >= 1) { r.t = -1; r.g.visible = false; continue; }
      r.g.scale.set(r.s0 * (1 + k * 3.4));
      r.g.alpha = (1 - k) * 0.75;
    }
    for (const sp of this.wxSplash) {
      if (sp.t < 0) continue;
      sp.t += dt; const k = sp.t / sp.dur;
      if (k >= 1) { sp.t = -1; sp.g.visible = false; continue; }
      sp.g.scale.set(0.5 + k * 1.1);
      sp.g.alpha = (1 - k) * (1 - k) * 0.8;
    }
    if (w.rain > 0.02) {
      this.wxRipAcc += dt * 9 * w.rain;
      while (this.wxRipAcc >= 1) {
        this.wxRipAcc -= 1;
        const slot = this.wxRipples.find(r => r.t < 0);
        if (!slot) break;
        let x        , y        ;
        if (rng() < 0.55) { x = 30 + rng() * (WORLD_W - 60); y = CREEK_TOP + 10 + rng() * (CREEK_BOT - CREEK_TOP - 20); }
        else { const ang = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 0.82; x = POND.cx + Math.cos(ang) * POND.rx * rr; y = POND.cy + Math.sin(ang) * POND.ry * rr; }
        slot.t = 0; slot.dur = 0.75 + rng() * 0.5; slot.s0 = 0.55 + rng() * 0.75;
        slot.g.position.set(x, y); slot.g.visible = true;
      }
      this.wxSplAcc += dt * 6 * w.rain;
      while (this.wxSplAcc >= 1) {
        this.wxSplAcc -= 1;
        const slot = this.wxSplash.find(s => s.t < 0);
        if (!slot) break;
        let x        , y        ;
        if (rng() < 0.7) { const c = plotCenter(Math.floor(rng() * 12)); x = c.x + (rng() - 0.5) * PLOT_W * 0.9; y = c.y + (rng() - 0.6) * PLOT_H * 0.5; }
        else { x = 60 + rng() * (WORLD_W - 120); y = FIELD_TOP + 90 + rng() * (FIELD_H - 160); }
        slot.t = 0; slot.dur = 0.2 + rng() * 0.12; slot.g.position.set(x, y); slot.g.rotation = rng() * Math.PI * 2; slot.g.visible = true;
      }
    }
    // 阳光微尘：很轻很慢的金色飘点（夜里自动沒了）
    const motesOn = w.sun > 0.015 && nn < 0.98;
    if (this.moteC.visible !== motesOn) this.moteC.visible = motesOn;
    if (motesOn) {
      for (const m of this.sunMotes) {
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -20) m.x += WORLD_W + 40; else if (m.x > WORLD_W + 20) m.x -= WORLD_W + 40;
        if (m.y > bandH + 10) m.y -= bandH + 20; else if (m.y < -10) m.y += bandH + 20;
        m.s.position.set(m.x, m.y + Math.sin(this.time * 0.8 + m.ph) * 6);
        m.s.alpha = m.a0 * w.sun * (1 - nn) * (0.55 + 0.45 * Math.sin(this.time * 1.4 + m.ph * 2));
      }
    }
  }

  /** Fish wander target: mostly keep swimming the way they face, prefer LONG straight legs; turn around only near the bank. */
  swimTarget(v            ) {
    const keepGoing = v.turnCd > 0 || Math.random() < 0.8;
    let best                                  = null; let bestD = 0;
    for (let k = 0; k < 24; k++) {
      const p = this.randomSpot("pond");
      const dx = p.x - v.x, d = Math.hypot(dx, p.y - v.y);
      if (d < 260) continue;
      if (keepGoing && dx * v.face < d * 0.5) continue;
      if (d > bestD) { bestD = d; best = p; }
    }
    if (best) return best;
    v.turnCd = 0; // at the bank: turn around with a LONG crossing stroke, not a short hop
    let far                                  = null; let farD = 0;
    for (let k = 0; k < 16; k++) {
      const p = this.randomSpot("pond");
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d > farD) { farD = d; far = p; }
    }
    return far ;
  }

  /** 狗狗/北极熊的瞌睡叫醒（喂食/摸摸时调用） */
  wakeAnimal(uid        ) {
    const v = this.animals.get(uid); if (!v) return;
    v.sleepUntil = 0; v.napUntil = 0; v.onNap = false; v.nextNap = this.time + 120 + Math.random() * 180;
    // 统一作息：点睡着的动物会醒（惊醒小跳 + 一段不睡回去的宽限）
    v.resting = false; v.restNight = false; v.homeSpot = -1; v.graze = null; v.grazeT = 0;
    v.sleepCycle++; v.wakeGrace = this.time + 10; v.restAt = this.time + 30;
    v.refreshBody(true); v.hop = 0.45;
  }
  /** 孔雀开屏（手动或自动触发都走这里） */
  displayPeacock(uid        )          {
    const v = this.animals.get(uid); if (!v || v.an.kind !== "peacock" || v.isBaby || v.an.dead) return false;
    v.displayUntil = this.time + 7;
    v.nextDisplay = this.time + 210 + Math.random() * 210;
    v.refreshBody(true);
    this.onDisplay?.(v);
    return true;
  }
  displayState(uid        )                          {
    const v = this.animals.get(uid);
    return { displaying: !!v && this.time < v.displayUntil };
  }
  isSleeping(uid        )          {
    const v = this.animals.get(uid); return !!v && v.an.kind === "dog" && this.time < v.sleepUntil;
  }
  isNapping(uid        )          {
    const v = this.animals.get(uid); return !!v && v.an.kind === "polarbear" && this.time < v.napUntil;
  }
  onDisplay                                   = null;
  onSleep                                                    = null;

  randomSpot(zone                  ) {
    if (zone === "ranch") {
      const a = RANCH_AREA;
      return { x: a.x0 + Math.random() * (a.x1 - a.x0), y: a.y0 + Math.random() * (a.y1 - a.y0) };
    }
    const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.72;
    let x = POND.cx + Math.cos(ang) * POND.rx * r, y = POND.cy + Math.sin(ang) * POND.ry * r;
    if (Math.hypot(x - ROCK.x, (y - ROCK.y) * 1.4) < 80) { x -= 120; }
    return { x, y };
  }

  spawnRipple(x        , y        , r0 = 6) {
    const g = new PIXI.Graphics();
    g.ellipse(0, 0, r0, r0 * 0.42).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    g.position.set(x, Math.max(CREEK_TOP + 4, Math.min(CREEK_BOT - 4, y)));
    this.riverLayer.addChild(g);
    this.ripples.push({ g, t: 0, dur: 1.6 + Math.random() * 0.6 });
  }
  // catch moment: fish shadow leaps out of the water, arcs down, splashes back, fades away
  playCatch(x        , y        ) {
    const spr = new PIXI.Sprite(this.anims.fish.frames[0]);
    spr.anchor.set(0.5); spr.height = 34; spr.width = 34 * (spr.texture.width / spr.texture.height);
    spr.tint = 0x5b8fb5;
    const c = new PIXI.Container(); c.addChild(spr); c.position.set(x, y); c.zIndex = 9000;
    this.riverLayer.addChild(c);
    this.leaps += 1;
    let splashed = false;
    const y0 = y;
    this.motions.push({
      t: 0, dur: 1.1,
      step: (k        ) => {
        const rise = Math.sin(Math.PI * Math.min(1, k * 1.35)) * 78;  // out and back down
        c.position.set(x + k * 54, y0 - rise);
        spr.rotation = -0.5 + k * 2.6;
        if (!splashed && k > 0.72) { splashed = true; this.spawnRipple(c.x, y0 + 6, 24); this.spawnRipple(c.x, y0 + 6, 16); }
      },
      done: () => { c.destroy(); this.leaps -= 1; },
    });
  }

  showBobber(x        , y        ) {
    this.hideBobber();
    const c = new PIXI.Container();
    const f = new PIXI.Graphics();
    f.circle(0, 6, 7).fill(0xffffff).circle(0, 6, 7).stroke({ width: 2, color: 0x8a4a2a });
    f.moveTo(0 + 7 * Math.cos(Math.PI), 6 + 7 * Math.sin(Math.PI)).arc(0, 6, 7, Math.PI, 0).closePath().fill(0xe84c3d);
    f.circle(2, 3, 2.5).fill(0xffffff);
    f.moveTo(0, -16).lineTo(0, -2).stroke({ width: 1.6, color: 0x8a4a2a, alpha: 0.8 });
    c.addChild(f); c.position.set(x, y);
    this.riverLayer.addChild(c);
    this.bobber = c;
  }
  hideBobber() { if (this.bobber) { this.bobber.destroy(); this.bobber = null; } }

  layout(vw        , vh        , colW        , topInset        , bottomInset        ) {
    this.viewW = vw; this.viewH = vh; this.topInset = topInset; this.bottomInset = bottomInset;
    this.scale = colW / WORLD_W; this.colX = (vw - colW) / 2;
    this.wxBandH = this.viewH / this.scale + 240; this.wxResizeRects(); // 天气层按可视高度重铺遮罩
    this.world.scale.set(this.scale); this.world.x = this.colX;
    const wide = vw > colW + 2;
    this.backdrop.visible = wide;
    const sb = Math.max(vw / WORLD_W, vh / WORLD_H);
    this.backdrop.scale.set(sb); this.backdrop.x = (vw - WORLD_W * sb) / 2;
    this.clampScroll(true);
  }
  maxScroll() { return Math.max(0, WORLD_H - (this.viewH - this.bottomInset * 0.35) / this.scale); }
  clampScroll(hard = false) {
    const max = this.maxScroll();
    if (hard) this.scrollY = Math.max(0, Math.min(max, this.scrollY));
  }
  applyScroll() {
    this.world.y = -this.scrollY * this.scale;
    const frac = this.scrollY / Math.max(1, this.maxScroll());
    this.backdrop.y = -frac * Math.max(0, WORLD_H * this.backdrop.scale.y - this.viewH);
  }
  scrollTo(y        , ms = 400) {
    const from = this.scrollY, to = Math.max(0, Math.min(this.maxScroll(), y));
    this.vel = 0;
    this.motions.push({ t: 0, dur: ms / 1000, step: k => { const e = 1 - Math.pow(1 - k, 3); this.scrollY = from + (to - from) * e; } });
  }
  toWorld(sx        , sy        ) { return { x: (sx - this.colX) / this.scale, y: sy / this.scale + this.scrollY }; }
  toScreen(wx        , wy        ) { return { x: wx * this.scale + this.colX, y: (wy - this.scrollY) * this.scale }; }

  syncAnimals() {
    const live = new Set        ();
    for (const an of this.farm.s.animals) {
      live.add(an.uid);
      const infoB = this.farm.animalInfo(an);
      const isBalloon = !an.dead && infoB.spent && infoB.ready === 0;
      if (isBalloon) {
        const stale = this.animals.get(an.uid);
        if (stale) { stale.root.destroy({ children: true }); this.animals.delete(an.uid); }
        if (!this.balloons.has(an.uid)) {
          const b = new BalloonView(an, this);
          this.balloons.set(an.uid, b);
          this.ranchOrPondLayer(b.zone).addChild(b.root);
        }
        continue;
      }
      if (!this.animals.has(an.uid)) {
        const v = new AnimalView(an, this);
        this.animals.set(an.uid, v);
        (v.an.kind === "dog" ? this.dogLayer : v.zone === "ranch" ? this.ranchLayer : this.pondLayer).addChild(v.root);
      }
    }
    for (const [u, v] of [...this.animals]) if (!live.has(u)) { v.root.destroy({ children: true }); this.animals.delete(u); }
    for (const [u, b] of [...this.balloons]) if (!live.has(u)) { b.root.destroy({ children: true }); this.balloons.delete(u); }
    for (const [uid, b] of this.balloons) if (!live.has(uid)) { b.root.destroy({ children: true }); this.balloons.delete(uid); }
  }

  /** Tap hit-test in world coords. */
  hit(wx        , wy        )                                                                                                                                                                                                                                  {
    for (const b of this.balloons.values()) {
      const d = animalById(b.kind);
      const R = Math.max(44, d.height * 0.62);
      if (Math.hypot(wx - b.x, wy - b.y) < R + 14) return { type: "balloon", uid: b.uid };
    }
    let best                    = null; let bestY = -1;
    for (const v of this.animals.values()) {
      const h = v.height();
      const top = v.zone === "pond" && v.an.kind !== "turtle" ? v.y - h * 0.8 : v.y - Math.max(v.topH(), 40) - 10;
      const bot = v.zone === "pond" && v.an.kind !== "turtle" ? v.y + h * 0.8 : v.y + 8;
      const halfW = Math.max(36, h * 0.7);
      const inBody = wx > v.x - halfW && wx < v.x + halfW && wy > top && wy < bot;
      const inBubble = v.bubble.visible && Math.hypot(wx - v.x, wy - (v.y + v.bubble.y)) < 42;
      if ((inBody || inBubble) && v.y > bestY) { best = v; bestY = v.y; }
    }
    if (best) {
      const bi = this.farm.animalInfo(best.an);
      if (bi.spent && best.zone === "pond") return { type: "remains"         , uid: best.an.uid };
      return { type: "animal", uid: best.an.uid };
    }
    for (let i = 0; i < 12; i++) {
      const c = plotCenter(i);
      if (Math.abs(wx - c.x) < PLOT_W / 2 + 6 && wy > c.y - PLOT_H / 2 - 40 && wy < c.y + PLOT_H / 2 + 6) return { type: "plot", i };
    }
    if (wy > CREEK_TOP - 24 && wy < CREEK_BOT + 24 && !(wx > 274 && wx < 512)) {
      const cx = Math.max(48, Math.min(702, wx));
      return { type: "creek"         , x: cx, y: Math.max(CREEK_TOP + 4, Math.min(CREEK_BOT - 4, wy)) };
    }
    if (wy > 200 && wy < RANCH_H - 60) return { type: "zone", zone: "ranch" };
    const dx = (wx - POND.cx) / POND.rx, dy = (wy - POND.cy) / POND.ry;
    if (dx * dx + dy * dy < 1) return { type: "zone", zone: "pond" };
    return null;
  }

  bounce(obj                , base        , amt = 0.16, dur = 0.28) {
    this.motions.push({ t: 0, dur, step: k => { const s = 1 + Math.sin(k * Math.PI) * amt * (1 - k * 0.5); obj.scale.set(base * s, base / (1 + (s - 1) * 0.6)); }, done: () => obj.scale.set(base) });
  }
  pressPlot(i        ) {
    const r = this.plots[i].root;
    this.motions.push({ t: 0, dur: 0.14, step: k => r.scale.set(0.94 + 0.06 * k), done: () => r.scale.set(1) });
  }
  shakePlot(i        ) {
    const r = this.plots[i].root; const c = plotCenter(i);
    this.motions.push({ t: 0, dur: 0.4, step: k => { r.x = c.x + Math.sin(k * 40) * 6 * (1 - k); }, done: () => { r.x = c.x; } });
  }
  hopAnimal(uid        ) { const v = this.animals.get(uid); if (v) v.hop = 0.45; }
  /** Pond feeding: pellets land on the water in front of the creature; it swims over and eats them. */
  dropFood(uid        ) {
    const v = this.animals.get(uid); if (!v) return null;
    if (v.resting) { v.resting = false; v.restNight = false; v.wakeGrace = this.time + 6; v.restAt = this.time + 25; } // 喂食唤醒
    if (v.food) { v.food.g.destroy(); v.food = null; }
    const side = v.onSpot ? v.face : (v.x < POND.cx ? 1 : -1);
    let fx = v.x + side * (v.onSpot ? v.height() * 0.95 : 70 + Math.random() * 30), fy = v.y + (v.onSpot ? 6 : (Math.random() - 0.5) * 50);
    const dx = (fx - POND.cx) / POND.rx, dy = (fy - POND.cy) / POND.ry, r = Math.hypot(dx, dy);
    if (r > 0.82) { fx = POND.cx + dx / r * 0.82 * POND.rx; fy = POND.cy + dy / r * 0.82 * POND.ry; }
    const g = new PIXI.Graphics();
    const turtle = v.an.kind === "turtle";
    const dots = turtle ? [[-9, -2, 5], [2, 3, 5.5], [10, -3, 4.5], [-2, -7, 4], [6, 6, 4]] : [[-7, 0, 3.5], [0, 4, 3.5], [7, -2, 3], [2, -5, 3], [-4, 6, 3]];
    for (const [x, y, rr] of dots) g.circle(x, y, rr).fill({ color: turtle ? 0xe8794a : 0xb5793a }).stroke({ width: 1.5, color: INK });
    g.position.set(fx, fy); g.zIndex = fy - 30; g.alpha = 0; g.scale.set(0.4);
    this.pondLayer.addChild(g);
    this.motions.push({ t: 0, dur: 0.35, step: k => { g.alpha = Math.min(1, k * 2); g.scale.set(0.4 + 0.6 * k); g.y = fy - 30 * (1 - k); }, done: () => { g.y = fy; } });
    const off = turtle ? v.height() * 0.95 : v.height() * 0.75;
    v.food = { x: fx, y: fy, g, tx: fx - side * off, ty: fy - (turtle ? -4 : 0), side, t: 0 };
    v.wait = 0;
    if (v.an.kind === "yulong" && this.farm.animalInfo(v.an).mature && v.leapT < 0 && v.yuPhase !== "tour" && !this.yuUnderBridge(v)) this.yuStartLeap(v); // v51：河湾一跃入塘干饭
    return { x: fx, y: fy };
  }

  /** 浇水动画（~1.9s）：卡通小水壶从上方弹入→倾 35° 倒水→水滴弧线粒子+土壤水花→倒完 1s 土壤湿润闪光。 */
  playWater(i        ) {
    const c = plotCenter(i);
    for (let k = this.waterFx.length - 1; k >= 0; k--) {
      const w = this.waterFx[k];
      if (w.plot === i) { this.releaseWaterFx(k); } // 同一块地连浇：回收后重开
    }
    // 种子：地块编号 × 农场天数 × 累计次数（确定性，同事件序列可复现）
    const seed = (this.waterSeq * 2654435761 ^ i * 2246822519 ^ Math.floor(this.farm.farmDay(this.farm.now())) * 3266489917) >>> 0;
    const rng = mulberry32(seed || 0x5eedd);
    this.waterSeq++; this.waterFxCount++;
    const w = this.waterFxPool.pop() ?? this.buildWaterFx();
    w.plot = i; w.t = 0; w.rng = rng; w.spawnAcc = 0; w.drops.length = 0; w.splashes.length = 0;
    w.can.position.set(-30, -150); w.can.scale.set(0.5); w.can.alpha = 0; w.can.rotation = -0.5;
    w.dG.clear(); w.sG.clear();
    for (let n = 0; n < 4; n++) { w.glints[n][0] = (rng() - 0.5) * 104; w.glints[n][1] = (rng() - 0.5) * 44 + 4; }
    w.g.position.set(c.x, c.y); w.g.visible = true;
    this.plots[i].wetFrom = this.time + 0.68; // 第一滴水落土时开始变湿
    if (w.g.parent !== this.floatLayer) this.floatLayer.addChild(w.g);
    this.waterFx.push(w);
  }

  /** 新建一套浇水特效节点（只在池子空时调用；用完回池，不销毁）。 */
          buildWaterFx() {
    const g = new PIXI.Container(); g.eventMode = "none";
    const canWrap = new PIXI.Container(); canWrap.eventMode = "none";
    const can = new PIXI.Graphics(); can.eventMode = "none";
    const MINT = 0x7fd7c8, MINT_D = 0x4fb3a4, WHT = 0xffffff;
    can.roundRect(-19, -13, 36, 26, 9).fill(MINT).stroke({ width: 3, color: WHT });           // 壶身
    can.roundRect(-19, -13, 36, 26, 9).stroke({ width: 1.2, color: MINT_D, alpha: 0.65 });      // 内衬
    can.circle(0, -16, 5.5).fill(MINT_D).stroke({ width: 2.4, color: WHT });                    // 盖钮
    can.arc(-19, 1, 9, Math.PI * 0.5, Math.PI * 1.5).stroke({ width: 5, color: WHT });          // 把手（左）
    can.arc(-19, 1, 9, Math.PI * 0.5, Math.PI * 1.5).stroke({ width: 2.6, color: MINT });
    can.moveTo(11, -1).lineTo(31, 7).lineTo(31, 14.5).lineTo(10, 9).closePath();                // 壶嘴（右下）
    can.fill(MINT).stroke({ width: 3, color: WHT, join: "round" });
    can.ellipse(-6, -4, 6, 9).fill({ color: 0xbfe9e0, alpha: 0.9 });                            // 壶身高光
    can.circle(-7, 3, 1.6).fill(WHT); can.circle(-3, 7, 1.2).fill(WHT);
    can.scale.set(WATER_CAN_S); // 手机上约 25~30px 宽，看得清
    canWrap.addChild(can);
    const dG = new PIXI.Graphics(); dG.eventMode = "none";   // 水滴（每帧 clear+重画，数量封顶 26）
    const sG = new PIXI.Graphics(); sG.eventMode = "none";   // 水花 + 湿润闪光
    g.addChild(dG, sG, canWrap);
    const glints                     = [[0, 0], [0, 0], [0, 0], [0, 0]];
    return { plot: -1, g, can: canWrap, dG, sG, t: 0, dur: 1.9, rng: () => 0, spawnAcc: 0, drops: [], splashes: [], glints }           ;
  }

          releaseWaterFx(k        ) {
    const w = this.waterFx[k];
    w.g.visible = false; w.dG.clear(); w.sG.clear(); w.drops.length = 0; w.splashes.length = 0;
    this.waterFx.splice(k, 1);
    this.waterFxPool.push(w);
  }

          updateWaterFx(dt        ) {
    const T_SLIDE = 0.3, T_POUR_START = 0.6, T_POUR_END = 1.22, T_GONE = 1.55; // 0.6~1.22s 倒水段（对齐 sfx.watercan 起手后）
    const backOut = (x        ) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const smooth = (x        ) => x * x * (3 - 2 * x);
    for (let i = this.waterFx.length - 1; i >= 0; i--) {
      const w = this.waterFx[i];
      w.t += Math.min(dt, 0.1); const t = w.t; const can = w.can;
      if (t < T_SLIDE) {
        const k = backOut(Math.min(1, t / T_SLIDE));
        can.alpha = Math.min(1, t / 0.12);
        can.scale.set(0.5 + 0.5 * Math.min(1, t / 0.26));
        can.position.set(-30 + 4 * k, -150 + 52 * k);
        can.rotation = -0.5 + 0.35 * k;
      } else if (t < T_POUR_START) {
        const s = smooth(Math.min(1, (t - T_SLIDE) / 0.12));
        can.alpha = 1; can.scale.set(1);
        can.position.set(-26, -98);
        can.rotation = -0.15 + 0.77 * s; // 倾至 0.62rad ≈ 35°
      } else if (t < T_POUR_END) {
        can.position.set(-26, -98);
        can.rotation = 0.62 + Math.sin(t * 9) * 0.03; // 倒水轻抖
      } else if (t < T_GONE) {
        const e = 1 - Math.pow(1 - (t - T_POUR_END) / (T_GONE - T_POUR_END), 2);
        can.rotation = 0.62 * (1 - e);
        can.position.set(-26, -98 - 46 * e);
        can.scale.set(1 - 0.32 * e);
        can.alpha = 1 - e * e;
      } else { can.alpha = 0; }
      // 倒水期喷水：壶嘴（图形局部 (31,11)）喷出蓝色水滴，重力加速成弧线
      if (t >= T_POUR_START && t < T_POUR_END) {
        w.spawnAcc += dt;
        while (w.spawnAcc >= 0.03 && w.drops.length < 26) {
          w.spawnAcc -= 0.03;
          const rot = can.rotation;
          const ox = 31 * WATER_CAN_S, oy = 11 * WATER_CAN_S;
          const sx = can.x + ox * Math.cos(rot) - oy * Math.sin(rot);
          const sy = can.y + ox * Math.sin(rot) + oy * Math.cos(rot);
          const dir = 0.31 + rot + (w.rng() - 0.5) * 0.16; // 沿倾斜壶嘴方向 ±散布
          const sp = 55 + w.rng() * 65;
          w.drops.push({ x: sx, y: sy, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp * 0.8, r: 2 + w.rng() * 1.7 });
        }
      } else if (w.spawnAcc > 0.03) w.spawnAcc = 0.03;
      const landY = 0; // 落在土面中部
      for (let d = w.drops.length - 1; d >= 0; d--) {
        const p = w.drops[d];
        p.vy += 1150 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y >= landY) { w.splashes.push({ x: p.x, y: landY + 2, t: 0, dur: 0.26, ph: w.rng() * 7 }); w.drops.splice(d, 1); }
      }
      w.dG.clear();
      for (const p of w.drops) {
        w.dG.circle(p.x, p.y, p.r).fill({ color: 0x63c1ff, alpha: 0.92 });
        w.dG.circle(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.38).fill({ color: 0xd8f2ff, alpha: 0.8 });
      }
      for (let s = w.splashes.length - 1; s >= 0; s--) {
        const sp = w.splashes[s]; sp.t += dt;
        if (sp.t >= sp.dur) w.splashes.splice(s, 1);
      }
      w.sG.clear();
      for (const s of w.splashes) {
        const k = s.t / s.dur;
        w.sG.ellipse(s.x, s.y, 4 + k * 13, 1.8 + k * 3.4).stroke({ width: 1.6, color: 0x9adcff, alpha: (1 - k) * 0.85 });
        w.sG.circle(s.x + Math.cos(s.ph) * (3 + k * 12), s.y - 1.5 - Math.sin(k * Math.PI) * 4, 1.3).fill({ color: 0x9adcff, alpha: (1 - k) * 0.9 });
      }
      // 收尾：倒完 1s 内土壤湿润闪光（四角星分批明灭）
      if (t >= 1.05) {
        const sk = t - 1.05;
        for (let n = 0; n < w.glints.length; n++) {
          const pulse = Math.abs(Math.sin(sk * 4.4 + n * 1.7));
          const a = pulse * Math.max(0, 1 - sk / (w.dur - 1.05)) * 0.95;
          if (a <= 0.02) continue;
          const [gx, gy] = w.glints[n];
          w.sG.star(gx, gy, 4, 5.2 + pulse * 2, 2.1).fill({ color: 0xffffff, alpha: a });
        }
      }
      if (t >= w.dur) this.releaseWaterFx(i); // 回池复用
    }
  }

  floatText(wx        , wy        , text        , color = 0xffffff, icon         ) {
    const c = new PIXI.Container();
    const tx = label(30, color); tx.text = text; tx.anchor.set(icon ? 0 : 0.5, 0.5);
    if (icon) {
      const s = new PIXI.Sprite(this.tex[icon]); s.anchor.set(0.5); s.width = s.height = 40; s.x = -24;
      c.addChild(s); tx.x = 0;
    }
    c.addChild(tx); c.position.set(wx, wy); this.floatLayer.addChild(c);
    this.motions.push({ t: 0, dur: 1.4, step: k => { c.y = wy - 70 * (1 - Math.pow(1 - k, 2)); c.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; }, done: () => c.destroy({ children: true }) });
  }

  update(dt        , selecting         ) {
    this.time += dt;
    const now = this.farm.now();
    // v49 性能：分区可见性考量（用后一帧的 scrollY，260px 边带丢不丢帧都不影响结论）
    {
      const visH = (this.viewH / Math.max(0.01, this.scale)) || 1200;
      this.wy0 = this.scrollY - 260; this.wy1 = this.scrollY + visH + 260;
      const wy0 = this.wy0, wy1 = this.wy1, zv = this.zoneVis;
      zv.ranch = RANCH_H > wy0 && wy1 > 60;
      zv.field = FIELD_TOP + FIELD_H > wy0 && wy1 > FIELD_TOP;
      zv.creek = CREEK_BOT + 40 > wy0 && wy1 > CREEK_TOP - 80;
      zv.pond = POND_TOP + POND_H > wy0 && wy1 > POND_TOP - 40;
      if (this.ranchLayer.renderable !== zv.ranch) this.ranchLayer.renderable = zv.ranch;
      if (this.plotsLayer.renderable !== zv.field) this.plotsLayer.renderable = zv.field;
      if (this.riverLayer.renderable !== zv.creek) this.riverLayer.renderable = zv.creek;
      if (this.pondLayer.renderable !== zv.pond) this.pondLayer.renderable = zv.pond;
      const wuV = zv.creek || zv.pond;
      if (this.wutongLayer.renderable !== wuV) this.wutongLayer.renderable = wuV; if (this.wutongEmbers.renderable !== wuV) this.wutongEmbers.renderable = wuV;
    }
    // 昼夜：6.5~17 点白天，清晨/傍晚各一段过渡，夜里整景朦蓝 + 星星闪烁
    {
      const dayMs = FARM_DAY_MIN * MS_PER_FARM_MIN;
      const hd = this.debugHour ?? ((((now % dayMs) + dayMs) % dayMs) / dayMs) * 24;
      this.hour = hd; // 作息判定（夜晚：hd≥19.5 或 <5）
      const dayness = hd >= 6.5 && hd <= 17 ? 1 : hd > 5 && hd < 6.5 ? (hd - 5) / 1.5 : hd > 17 && hd < 19.5 ? 1 - (hd - 17) / 2.5 : 0;
      this.nightness = 1 - dayness;
      const show = this.nightness > 0.05;
      if (this.nightSky.visible !== show) this.nightSky.visible = show;
      if (show) {
        this.nightSky.alpha = 0.55 * this.nightness;
        for (let i = 0; i < this.nightStars.length; i++) this.nightStars[i].alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 1.8 + i * 1.71));
      }
    }
    this.updateWx(dt, now); // 天气表现：雨丝/涟漪/滤镜/云/阳光微尘（权重 1~2s 平滑过渡）
    if (this.zoneVis.pond) this.updatePondFx(dt); // 池塘：波光漂移 + 低频涟漪（v49：出屏不更）
    if (this.farm.s.wutong) this.syncWutong(); // 阶段随农场时钟推进（无变化时立即返回）
    if (this.zoneVis.creek || this.zoneVis.pond) this.updateWutong(dt); // 梧桐余烬（未种/屏外不更）
    this.myth.update(dt); this.yuFx.update(dt); // v52：神物特效粒子池推进（v53：玉龙水中特效单独一池，在桥面下）
    this.updateLeaps(dt, now); // 鱼跃出水面排程（池塘养鱼 + 小河 minnow）
    this.updateWaterFx(dt); // 浇水：水壶弹入/倾斜/水滴弧/水花/土壤闪光
    // Zzz 气泡粒子池：睡着动物头顶飘起的小字母，上飘+轻摆+淡出（池化，eventMode=none；v49：出屏不发不更）
    for (const z of this.zzzPool) {
      if (z.k < 0) continue;
      z.k += dt / z.dur;
      if (z.k >= 1) { z.k = -1; z.t.visible = false; continue; }
      const inY = z.y0 > this.wy0 && z.y0 < this.wy1;
      if (!inY) { if (z.t.renderable) z.t.renderable = false; continue; }
      if (!z.t.renderable) z.t.renderable = true;
      z.t.position.set(z.x0 + z.k * 10 + Math.sin(z.k * 5.2) * 6 * z.k, z.y0 - z.k * 40);
      z.t.alpha = z.k < 0.15 ? z.k / 0.15 : 1 - (z.k - 0.15) / 0.85 * 0.92;
      z.t.scale.set(0.7 + z.k * 0.55);
    }
    // motions (tweens)
    for (let i = this.motions.length - 1; i >= 0; i--) {
      const m = this.motions[i]; m.t += dt; const k = Math.min(1, m.t / m.dur); m.step(k);
      if (k >= 1) { this.motions.splice(i, 1); m.done?.(); }
    }
    // scroll inertia + edge spring
    if (!this.dragging) {
      this.scrollY += this.vel * dt; this.vel *= Math.exp(-4 * dt);
      if (Math.abs(this.vel) < 5) this.vel = 0;
      const max = this.maxScroll();
      if (this.scrollY < 0) { this.scrollY += (0 - this.scrollY) * Math.min(1, dt * 12); if (this.vel < 0) this.vel *= 0.5; }
      if (this.scrollY > max) { this.scrollY += (max - this.scrollY) * Math.min(1, dt * 12); if (this.vel > 0) this.vel *= 0.5; }
    }
    this.applyScroll();
    for (const c of this.clouds) { c.x += 12 * dt * (c.scale.x * 2); if (c.x > WORLD_W + 140) c.x = -140; }
    this.willow.rotation = Math.sin(this.time * 0.9) * 0.035; // gentle sway
    // plots
    // river ripple + falling/drifting leaves
    const W = WORLD_W;
    if (this.bobber) {
      this.bobber.y = CREEK_TOP + (CREEK_BOT - CREEK_TOP) / 2 + Math.sin(this.time * 5.2) * 4 + Math.sin(this.time * 2.1) * 2;
      this.bobberPulse -= dt;
      if (this.bobberPulse <= 0) { this.bobberPulse = 1.05; this.spawnRipple(this.bobber.x, this.bobber.y + 8, 10); }
    }
    for (let i = this.sinkBubbles.length - 1; i >= 0; i--) {
      const b = this.sinkBubbles[i];
      b.t += dt;
      const kk = b.t / b.dur;
      if (kk >= 1) { b.g.destroy(); this.sinkBubbles.splice(i, 1); continue; }
      b.g.y -= b.vy * dt;
      b.g.x += Math.sin((b.t + i) * 5) * b.drift * dt;
      b.g.alpha = 0.85 * (1 - kk * 0.9);
    }
    this.rippleCd -= dt;
    if (this.rippleCd <= 0 && this.ripples.length < 7) {
      this.rippleCd = 0.6 + Math.random() * 0.7;
      const g = new PIXI.Graphics();
      g.ellipse(0, 0, 6, 2.5).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
      g.position.set(30 + Math.random() * (W - 60), CREEK_TOP + 6 + Math.random() * (CREEK_BOT - CREEK_TOP - 12));
      this.riverLayer.addChild(g);
      this.ripples.push({ g, t: 0, dur: 1.6 + Math.random() * 0.6 });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]; r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.g.destroy(); this.ripples.splice(i, 1); continue; }
      r.g.scale.set(1 + k * 3.2);
      r.g.alpha = (1 - k) * 0.8;
    }
    // dragonfly flight + water-touch dip（v49：小溪出屏时整段跳过）
    if (this.zoneVis.creek) {
      const df = this.df;
      df.x += df.vx * dt;
      if (df.x > WORLD_W + 40) { df.x = WORLD_W + 39; df.vx = -Math.abs(df.vx); }
      if (df.x < -40) { df.x = -39; df.vx = Math.abs(df.vx); }
      // start a dip every ~7-12s while in view
      df.alone += dt;
      if (df.dipT === 0 && df.alone > 7 + Math.random() * 5 && df.x > 60 && df.x < WORLD_W - 60) {
        df.dipT = 2.2; df.touchDone = false; df.alone = 0;
      }
      let lift = 0;
      if (df.dipT > 0) {
        df.dipT -= dt;
        const k = 1 - df.dipT / 2.2;
        lift = -30 * Math.sin(Math.PI * Math.min(1, k)); // sink then rise
        if (!df.touchDone && k > 0.42 && k < 0.6) {
          df.touchDone = true;
          // water kiss → ripple ring at this spot
          if (this.ripples.length < 9) {
            const g = new PIXI.Graphics();
            g.ellipse(0, 0, 6, 2.5).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
            g.position.set(df.x, (CREEK_TOP + CREEK_BOT) / 2 - 4);
            this.riverLayer.addChild(g);
            this.ripples.push({ g, t: 0, dur: 2.0 });
            this.dfTouches++;
          }
        }
        if (df.dipT <= 0) df.dipT = 0;
      }
      const wobble = Math.sin(this.time * 3.4) * 5;
      this.dragonfly.position.set(df.x, df.baseY + wobble + lift);
      this.dragonfly.scale.x = (df.vx >= 0 ? 1 : -1) * Math.abs(this.dragonfly.scale.x);
    }
    if (this.flow) this.flow.tilePosition.x -= 48 * dt;
    if (this.zoneVis.creek && this.waterMesh && this.waterBuf && this.waterBase) {
      const t = this.time, d = this.waterBuf.data, b = this.waterBase;
      for (let i = 0; i < d.length; i += 2) {
        const bx = b[i], by = b[i + 1];
        const mid = Math.sin(Math.min(1, Math.max(0, by / 320)) * Math.PI);
        d[i] = bx + Math.sin(t * 1.15 + by * 0.26) * 1.7 * mid;
        d[i + 1] = by + Math.sin(t * 2.05 + bx * 0.045 + 1.7) * 2.4 * mid;
      }
      this.waterBuf.update();
    }
    if (this.zoneVis.creek) for (const mn of this.minnows) {
      if (mn.leapT >= 0) { // 小河小鱼跃：更快更小的弧，出水变亮，落水一小圈波纹
        mn.leapT += dt;
        const k = Math.min(1, mn.leapT / mn.leapDur);
        mn.x = mn.leapX0 + (mn.leapX1 - mn.leapX0) * k;
        const lift = Math.sin(Math.PI * k) * mn.leapPeak;
        const vx = (mn.leapX1 - mn.leapX0) / mn.leapDur;
        const vy = (-Math.cos(Math.PI * k) * Math.PI * mn.leapPeak) / mn.leapDur;
        const phi = Math.atan2(vy, vx === 0 ? mn.face * 0.0001 : vx);
        mn.g.rotation = mn.face === 1 ? phi : phi - Math.PI;
        mn.g.alpha = 1; mn.g.tint = 0xdff3ff;
        mn.g.position.set(mn.x, mn.leapY0 - lift);
        mn.g.scale.x = Math.abs(mn.g.scale.y) * mn.face;
        if (k >= 1) {
          mn.leapT = -1; mn.g.rotation = 0; mn.g.alpha = 0.6; mn.g.tint = 0x9fcfe8; mn.wait = 0.5;
          this.spawnRipple(mn.x, mn.leapY0 + 4, 9);
          this.onLeapSplash?.(mn.x, mn.leapY0);
        }
        continue;
      }
      if (mn.wait > 0) {
        mn.wait -= dt;
      } else if (Math.abs(mn.faceS - mn.face) > 0.04) {
        mn.faceS += Math.sign(mn.face - mn.faceS) * dt * 5; // turn while nearly still, like the pond fish
      } else {
        mn.faceS += Math.sign(mn.face - mn.faceS) * dt * 5;
        mn.vx = Math.max(-26, Math.min(26, mn.vx + mn.face * 120 * dt));
        mn.x += mn.vx * dt;
        mn.y += Math.sin(this.time * 1.6 + mn.ph) * 4 * dt;
        if (mn.x < 62 || mn.x > WORLD_W - 62) { mn.face = (mn.x < 62 ? 1 : -1)          ; mn.wait = 0.6 + Math.random() * 1.4; mn.vx = 0; }
        else if (Math.random() < dt / 6) { mn.face = -mn.face          ; mn.wait = 0.5 + Math.random() * 1.2; mn.vx = 0; }
      }
      mn.g.position.set(mn.x, mn.y);
      mn.g.scale.x = (mn.g.scale.y > 0 ? mn.g.scale.y : Math.abs(mn.g.scale.x)) * (Math.abs(mn.faceS) < 0.08 ? 0.08 * Math.sign(mn.faceS || mn.face) : mn.faceS);
    } // pattern drifts downstream (right, same as the leaves)
    this.leafCd -= dt;
    if (this.leafCd <= 0 && this.leaves.length < 4) {
      this.leafCd = 2.2 + Math.random() * 2.6;
      const g = new PIXI.Graphics();
      const col = [0x7fb648, 0xa9c23c, 0xd9a63a, 0xc9742c][Math.floor(Math.random() * 4)];
      g.ellipse(0, 0, 7 + Math.random() * 3, 3.5 + Math.random() * 1.2).fill({ color: col });
      g.moveTo(-6, 0).lineTo(6, 0).stroke({ width: 1, color: 0x4a3222, alpha: 0.5 });
      const x = 40 + Math.random() * (W - 80);
      g.position.set(x, CREEK_TOP - 60 - Math.random() * 30);
      g.angle = Math.random() * 360;
      this.riverLayer.addChild(g);
      this.leaves.push({ g, x, y: CREEK_TOP - 70, mode: "fall", vx: 0, t: 0, spin: (Math.random() - 0.5) * 3 });
    }
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const L = this.leaves[i]; L.t += dt;
      if (L.mode === "fall") {
        L.y += (26 + L.t * 12) * dt;
        L.x += Math.sin(L.t * 3) * 14 * dt;
        L.g.angle += L.spin * 40 * dt;
        if (L.y >= CREEK_TOP + 8) { L.mode = "drift"; L.t = 0; L.vx = 11 + Math.random() * 7; }
      } else {
        L.x += L.vx * dt;
        const bob = Math.sin(L.t * 2.4) * 2.2;
        L.y = CREEK_TOP + 8 + bob;
        L.g.angle += L.spin * 8 * dt;
        L.g.alpha = L.t > 20 ? Math.max(0, 1 - (L.t - 20) / 3) : 1;
      }
      L.g.position.set(L.x, L.y);
      if (L.x > W + 30 || L.t > 24) { L.g.destroy(); this.leaves.splice(i, 1); }
    }
    const lvl = this.farm.level.level;
    if (this.zoneVis.field) this.farm.s.plots.forEach((p, i) => { // v49：地块区出屏时跳过全部视觉更新
      const v = this.plots[i]; const cs = p.crop;
      v.lock.visible = !p.unlocked; v.soilTintWant = p.unlocked ? 0xffffff : 0x9c8f80;
      const wetK = p.unlocked ? v.wetness(this.time) : 0; // 浇水后湿润：先变深再慢慢晾回常色
      if (wetK > 0) v.soilTintWant = 0x9e8a7c;
      if (!p.unlocked) setText(v.price, String(this.farm.unlockPrice(i)));
      v.hint.visible = selecting && p.unlocked && !cs;
      if (v.hint.visible) v.hint.alpha = 0.45 + 0.45 * Math.sin(this.time * 5);
      v.glow.visible = false; v.star.visible = false;
      let wantBarW = 0; // v49：生长进度条只在像素宽度变化时重建（以前每帧 clear+重画 ×12）
      if (!cs) {
        v.crop.visible = false; v.lastStage = -1; v.need.visible = false; v.bugs.visible = false;
        setText(v.text, p.unlocked && selecting ? t("plot.empty") : "");
        if (v.barWpx !== 0) { v.bar.clear(); v.barWpx = 0; } // v49：收获后清条
        v.applySoilTint(dt); return;
      }
      const def = cropById(cs.id);
      v.crop.visible = true;
      let key        ; let texKey        ; let tint = 0xffffff;
      const st = this.farm.stage(cs, now);
      if (cs.dead) { texKey = `crops/g${pad(def.tex)}`; tint = 0x8a7a60; key = "dead"; setText(v.text, t("plot.dead")); }
      else if (cs.old) { texKey = `crops/g${pad(def.tex)}`; tint = 0xe0b070; key = "old"; setText(v.text, t("plot.old")); }
      else {
        texKey = st.stage === 0 ? "crops/m15" : st.stage === 1 ? "crops/g15" : st.stage === 2 ? `crops/g${pad(def.tex)}` : `crops/m${pad(def.tex)}`;
        key = "s" + st.stage;
        if (st.stage === 3) {
          setText(v.text, t("plot.ready"));
          v.glow.visible = true; v.glow.alpha = 0.55 + 0.35 * Math.sin(this.time * 4 + i);
          v.star.visible = true; v.star.alpha = Math.max(0, Math.sin(this.time * 3 + i * 1.7));
          v.star.position.set(40 + 12 * Math.sin(i), -48); v.star.rotation = this.time;
        } else {
          setText(v.text, fmtDur(st.left));
          wantBarW = Math.max(4, Math.round(128 * st.progress));
          const needs = this.farm.plotNeeds(cs, now);
          if (needs.thirsty && wetK <= 0) v.soilTintWant = 0xe6d2ad; // 干渴：土色发白变浅（平滑渐变过去）
          v.need.visible = needs.pest || needs.thirsty;
          if (v.need.visible) {
            setText(v.need, needs.pest ? "🐛" : "💧");
            v.need.y = -PLOT_H / 2 + 6 + Math.sin(this.time * 3 + i) * 4;
            v.need.rotation = needs.pest ? Math.sin(this.time * 5 + i) * 0.15 : 0;
          }
          // 长虫：2~3 只绿毛虫在作物上蠕动（分节波浪 + 触角轻晃）
          v.bugs.visible = needs.pest;
          if (needs.pest) {
            const n = 2 + (i % 2); // 每块地 2~3 只
            for (let k = 0; k < v.bugRoots.length; k++) {
              const b = v.bugRoots[k];
              b.visible = k < n;
              if (!b.visible) continue;
              const ph = this.time * (0.85 + k * 0.27) + k * 2.1 + i * 1.3;
              b.x = Math.sin(ph) * (PLOT_W * 0.30) + Math.sin(ph * 2.7) * 7;
              b.y = -PLOT_H * 0.30 - 20 - k * 9 + Math.cos(ph * 1.35) * 11;
              b.rotation = Math.sin(ph * 2.2) * 0.5;
              const segs = v.bugSegs[k];
              for (let s = 0; s < segs.length; s++) {
                const w = Math.sin(ph * 3.2 - s * 1.05);
                segs[s].y = w * 1.7;
                segs[s].scale.y = 1 + w * 0.14;
              }
            }
          }
        }
      }
      if (texKey !== v.lastKey) {
        v.crop.texture = this.tex[texKey];
        const targetH = st.stage === 0 && !cs.dead && !cs.old ? 46 : st.stage === 1 && !cs.dead && !cs.old ? 54 : 104;
        v.cropScale = targetH / v.crop.texture.height;
        v.crop.scale.set(v.cropScale);
        if (v.lastKey !== "") this.motions.push({ t: 0, dur: 0.28, step: k => { const s = k < 0.4 ? 0.8 + k / 0.4 * 0.3 : 1.1 - (k - 0.4) / 0.6 * 0.1; v.cropWrap.scale.set(s); }, done: () => v.cropWrap.scale.set(1) });
        v.lastKey = texKey;
      }
      v.crop.tint = tint;
      if (cs.dead || cs.old || st.stage === 3) { v.need.visible = false; v.bugs.visible = false; }
      if (st.stage === 3 && !cs.dead && !cs.old) { v.crop.rotation = 0; v.cropWrap.y = PLOT_H * 0.28 - 4 - 4 * Math.sin(this.time * 3 + i); }
      else { v.cropWrap.y = PLOT_H * 0.28; v.crop.rotation = cs.dead || cs.old ? 0 : Math.sin(this.time * Math.PI + i) * 0.05; }
      void key; void lvl;
      // v49：生长条像素宽变化才重建 Graphics（空/收获/成熟自动清空）
      if (wantBarW !== v.barWpx) {
        v.bar.clear(); v.barWpx = wantBarW;
        if (wantBarW > 0) {
          const bw = 130, bx = -bw / 2, by = PLOT_H / 2 - 40;
          v.bar.roundRect(bx, by, bw, 10, 5).fill({ color: CREAM }).stroke({ width: 2, color: BORDER });
          v.bar.roundRect(bx + 1, by + 1, wantBarW, 8, 4).fill({ color: GREEN });
        }
      }
      v.applySoilTint(dt); // 目标色本帧定好后再缓动（干→湿 ~0.5s 平滑）
    });
    // animals
    // 病气雾管理：生病中的动物头顶飘三格小绿团，治好就消失
    {
      const seen = new Set        ();
      for (const an of this.farm.s.animals) {
        if (an.sickSince == null || an.dead) continue;
        seen.add(an.uid);
        if (!this.germs.some(k => k.uid === an.uid)) {
          const g = new PIXI.Graphics();
          for (const [bx, by, r] of [[-13, -12, 5], [10, -20, 6], [-2, -3, 4]]         ) {
            g.circle(bx, by, r).fill({ color: 0x6fd36f, alpha: 0.8 }).stroke({ width: 2, color: 0x2c8a3e, alpha: 0.9 });
          }
          g.position.set(-999, -999);
          this.germs.push({ g, t: Math.random() * 9, uid: an.uid });
          this.floatLayer.addChild(g);
        }
        const g = this.germs.find(k => k.uid === an.uid) ;
        g.t += dt;
        const v = this.animals.get(an.uid);
        const bx = v ? v.x : this.randomSpot("ranch").x;
        const by = v ? v.y - v.height() - 16 : 200;
        const s = 0.92 + Math.sin(g.t * 5) * 0.1;
        g.g.position.set(bx + Math.sin(g.t * 1.1) * 7, by + Math.sin(g.t * 3) * 4);
        g.g.scale.set(s); g.g.alpha = 0.72 + Math.sin(g.t * 4) * 0.18;
      }
      for (let i = this.germs.length - 1; i >= 0; i--) {
        if (!seen.has(this.germs[i].uid)) { this.germs[i].g.destroy(); this.germs.splice(i, 1); }
      }
    }
    // 粑粑堆管理：牧场动物拉了粑粑就在脚边冒一小坨，两只苍蝇绕着飞、臭味往上飘，点它就清理
    {
      const seen = new Set        ();
      for (const an of this.farm.s.animals) {
        if (an.poopSince == null || an.dead || animalById(an.kind).zone !== "ranch") continue;
        seen.add(an.uid);
        let p = this.poops.find(k => k.uid === an.uid);
        if (!p) {
          const root = new PIXI.Container();
          const g = new PIXI.Graphics();
          g.ellipse(0, 0, 15, 8.5).fill(0x8a5a30).stroke({ width: 2, color: 0x5d3a1c });
          g.ellipse(-3, -7.5, 10.5, 6).fill(0x96642f).stroke({ width: 2, color: 0x5d3a1c });
          g.ellipse(1, -13.5, 6.6, 4.4).fill(0xa67336).stroke({ width: 1.6, color: 0x5d3a1c });
          g.circle(1.5, -17.5, 2.1).fill(0xa67336);
          g.ellipse(-5, -2.4, 4.5, 2).fill({ color: 0xc99a5e, alpha: 0.5 });
          const f1 = new PIXI.Graphics(); f1.circle(0, 0, 1.7).fill(0x333333);
          const f2 = new PIXI.Graphics(); f2.circle(0, 0, 1.4).fill(0x333333);
          const w1 = new PIXI.Graphics(); w1.ellipse(0, 0, 2.4, 4.6).fill({ color: 0x9ad36f, alpha: 0.5 });
          const w2 = new PIXI.Graphics(); w2.ellipse(0, 0, 2, 3.8).fill({ color: 0x9ad36f, alpha: 0.4 });
          root.addChild(g, f1, f2, w1, w2);
          p = { root, t: Math.random() * 9, uid: an.uid };
          this.poops.push(p);
          this.ranchLayer.addChild(root);
        }
        p.t += dt;
        const v = this.animals.get(an.uid);
        if (v) {
          const side = an.uid % 2 === 0 ? 34 : -34;
          p.root.position.set(v.x + side, v.y + 2);
          p.root.zIndex = v.y - 2;
        }
        const c = p.root.children                   ;
        c[1].position.set(Math.cos(p.t * 4.1) * 13, -14 + Math.sin(p.t * 6.3) * 5);
        c[2].position.set(Math.cos(p.t * 3.3 + 2) * 10, -6 + Math.sin(p.t * 5.1 + 1) * 4);
        const w1k = (p.t * 8) % 14;
        c[3].position.set(-2 + Math.sin(p.t * 1.3) * 3, -20 - w1k); c[3].alpha = 0.5 * (1 - w1k / 14);
        const w2k = (p.t * 8 + 7) % 14;
        c[4].position.set(3 + Math.sin(p.t * 1.7 + 1) * 3, -18 - w2k); c[4].alpha = 0.4 * (1 - w2k / 14);
      }
      for (let i = this.poops.length - 1; i >= 0; i--) {
        if (!seen.has(this.poops[i].uid)) { this.poops[i].root.destroy(); this.poops.splice(i, 1); }
      }
    }
    for (const b of this.balloons.values()) {
      b.ph += dt;
      b.x += b.vx * dt;
      if (b.x > WORLD_W - 70) { b.x = WORLD_W - 70; b.vx = -Math.abs(b.vx); }
      if (b.x < 70) { b.x = 70; b.vx = Math.abs(b.vx); }
      b.y = b.baseY + Math.sin(b.ph * 1.4) * 9;
      b.root.position.set(b.x, b.y);
      b.root.zIndex = b.y + 800; // 气球飘在动物上方
      b.body.rotation = Math.sin(b.ph * 1.1) * 0.06;
    }
    for (const v of this.animals.values()) {
      const onS = v.y > this.wy0 - 150 && v.y < this.wy1 + 150; // v49：屏外 150 世界px 之外的动物不更新视觉（位置模拟照常跑）
      if (v.root.visible !== onS) v.root.visible = onS;
      this.updateAnimal(v, dt, now, onS);
    }
  }

  /** 狗狗全场巡游（v50）：55% 短途=牧场门外土路三点；45% 长途=土路右端口 → 田地右侧条带(x≈700，距地块≥26px) 下行
   *  → 河岸土路(y≈1500，最后一行地下沿与河之间的草带) → 桥(393,1598)→(393,1794) → 沿塘东/南岸(y≈1880-1900，距水缘≥150px) 巡游
   *  → 驻足张望 → 原路返回。是一种确定性白动：路线/摇长短/停留全由 mulberry32 种子 dog|farmDay|trip(|step) 派生，零 Math.random。
   *  围栏底边在 y≈600、狗走的 662+ 土路本来就在门外，全程不穿栅栏；过桥 y 从 1595 一直走到 1795，中间不在水里停留。 */
  dogMove(v            , dt        )          {
    if (this.time < v.sleepUntil) return true; // 走累了蜷成一团睡（原地；不会在桥上睡）
    if (v.wait > 0) { v.wait -= dt; return true; } // 站住张望
    if (!v.dogPath || v.dogStep >= v.dogPath.length) {
      v.dogTrips++; v.dogStep = 0;
      const day = this.farm.farmDay(this.farm.now());
      const rng = mulberry32(Math.floor(hashRandom(`dog|${day}|${v.dogTrips}`) * 4294967296));
      if (rng() < 0.45) {
        const fwd                     = [[700, 676], [700, 740], [700, 1395], [700, 1498],
          [620, 1506], [505, 1508], [393, 1508], [393, 1545], [393, 1598], [393, 1700], [393, 1794],
          [438, 1854], [452, 1884], [550, 1892], [636, 1898]];
        const back                     = [[550, 1892], [452, 1884], [438, 1854], [393, 1794], [393, 1700], [393, 1598], [393, 1545],
          [505, 1508], [620, 1506], [700, 1498], [700, 1395], [700, 740]];
        v.dogPath = (rng() < 0.5 ? [...fwd, ...back] : [...fwd, ...fwd.slice(1, -1).reverse(), ...back.slice(0, 6)]).map(([x, y]) => ({ x, y }));
      } else {
        let best = 0, bd = 1e9;
        DOG_LANE.forEach((q, i) => { const dd = Math.hypot(q.x - v.x, q.y - v.y); if (dd < bd) { bd = dd; best = i; } });
        const order = rng() < 0.5 ? [0, 1, 2] : [2, 1, 0];
        v.dogPath = order.map(i => DOG_LANE[(best + i) % 3]).map(q => ({ x: q.x, y: q.y }));
      }
    }
    const cur = v.dogPath[v.dogStep];
    const dx = cur.x - v.x, dy = cur.y - v.y, d = Math.hypot(dx, dy);
    if (d < 3) {
      v.dogStep++;
      const day = this.farm.farmDay(this.farm.now());
      const rng2 = mulberry32(Math.floor(hashRandom(`dog|${day}|${v.dogTrips}|${v.dogStep}`) * 4294967296));
      const onBridge = v.x > 330 && v.x < 455 && v.y > 1580 && v.y < 1795; // 桥上不张望、不睡：一口气走过去
      if (onBridge) return true;
      if (v.dogStep >= v.dogPath.length && v.dogTrips % 5 === 0) { v.sleepUntil = this.time + 10 + rng2() * 8; return true; }
      v.wait = v.dogStep >= v.dogPath.length - 2 ? 2.4 + rng2() * 1.6 : 1.2 + rng2() * 2; // 塘岸终点多站一会
      return true;
    }
    v.face = dx > 0 ? 1 : -1;
    const sp = v.speed * 1.15 * this.dogTestSpeed; // ?dogfast=N：试驾专用加速（默认 1，正式运营不受影响）
    v.x += dx / d * Math.min(d, sp * dt); v.y += dy / d * Math.min(d, sp * dt);
    return true;
  }

  /** 北极熊偶尔走到冰屋前趴下睡一觉 */
  bearNap(v            , dt        )          {
    const t = this.time;
    if (t < v.napUntil) {
      if (!v.onNap) {
        const dx = BEAR_NAP.x - v.x, dy = BEAR_NAP.y - v.y, d = Math.hypot(dx, dy);
        if (d > 5) {
          v.face = dx > 0 ? 1 : -1;
          const sp = v.speed * 1.6;
          v.x += dx / d * Math.min(d, sp * dt); v.y += dy / d * Math.min(d, sp * dt);
          return true;
        }
        v.onNap = true;
      }
      return true; // 睡中：静止
    }
    if (v.onNap) { v.onNap = false; v.bearNaps++; const r1 = mulberry32(Math.floor(hashRandom(`bear|${this.farm.farmDay(this.farm.now())}|${v.an.uid}|${v.bearNaps}`) * 4294967296)); v.nextNap = t + 150 + r1() * 240; }
    if (v.nextNap === 0) v.nextNap = t + 40;
    if (t >= v.nextNap) { v.bearNaps++; const r2 = mulberry32(Math.floor(hashRandom(`bear|${this.farm.farmDay(this.farm.now())}|${v.an.uid}|${v.bearNaps}`) * 4294967296)); v.napUntil = t + 12 + r2() * 10; }
    return false;
  }

  /** v51 玉龙河湾作息（种子 yulong|日|uid|trip，零 Math.random）：
   *  ~7 成时间伏在河湾水面里悬停睡觉（睡姿/Zzz/小气泡由共用管线渲染），醒游 26~70s 左右左右巡航；
   *  每 3~6 现实分钟大弧跃入池塘（起点水花；落水水花由 leapT 管线收尾），绕塘巡游 1.5~3 圈，再大弧跃回河里续睡。
   *  过桥（x 330~455）时桥洞下潜隐形冲过去。喂食时若在河里则直接跃塘干饭（dropFood 触发）。 */
  yuRoutine(v            , dt        ) {
    if (v.leapT >= 0) return; // 跃中：抛物线+切线旋转由鱼跃管线接管
    const day = this.farm.farmDay(this.farm.now());
    if (!(v.yuNextLeap > 0) || !Number.isFinite(v.yuPhaseT)) { // 初登场/异常兜底：首次跃塘错开（9~25s 内），睡 40~120s（NaN/0 一律重整）
      const r0 = mulberry32(Math.floor(hashRandom(`yulong|${day}|${v.an.uid}|init`) * 4294967296));
      v.yuNextLeap = this.time + yq(9 + r0() * 16);
      v.yuPhaseT = this.time + yq(40 + r0() * 80);
      if (YU_SWIM) { v.yuPhase = "swim"; v.yuPhaseT = this.time + 1e6; v.yuNextLeap = this.time + 1e6; v.face = 1; }
    }
    if (v.yuPhase === "sleep") {
      const hx = YU_HOME.x - 70 + ((v.an.uid * 97) % 140); // 栖眠点：桥左侧最宽最深段 x 130~270
      v.x += (hx - v.x) * Math.min(1, dt * 0.35);
      const hy = Math.min(YU_BAND.y1, Math.max(YU_BAND.y0, YU_HOME.y + Math.sin(this.time * 0.5 + v.an.uid) * 6));
      v.y += (hy - v.y) * Math.min(1, dt * 0.4);
      if (!Number.isFinite(v.yuPhaseT) || this.time >= v.yuPhaseT) {
        v.yuPhase = "swim";
        const rng = mulberry32(Math.floor(hashRandom(`yulong|${day}|${v.an.uid}|${v.yuTrip}|s`) * 4294967296));
        v.yuPhaseT = this.time + yq(26 + rng() * 44); // 醒游 26~70s
        v.face = rng() < 0.5 ? 1 : -1;
      }
    } else if (v.yuPhase === "swim") {
      if (v.wait > 0) v.wait -= dt;
      else {
        const inHole = this.yuUnderBridge(v);
        v.x += v.face * v.speed * 1.25 * (inHole ? 1.6 : 1) * dt; // 桥下稍快穿过（被桥面盖住）
        if (v.x >= YU_BAND.x1 - 24) { v.face = -1; v.wait = 1 + (v.yuTrip % 3) * 0.8; }
        else if (v.x <= YU_BAND.x0 + 24) { v.face = 1; v.wait = 1 + (v.yuTrip % 5) * 0.6; }
      }
      v.y += ((YU_BAND.y0 + YU_BAND.y1) / 2 + Math.sin(this.time * 0.7 + v.an.uid) * 14 - v.y) * Math.min(1, dt * 0.5); // 只在深水中线 ±14 摆动
      if (this.time >= v.yuPhaseT && !this.yuUnderBridge(v)) { // 桥下不停、不跃：游出桥洞再说
        if (this.time >= v.yuNextLeap) this.yuStartLeap(v); // 见塘心切：跃！
        else { v.yuPhase = "sleep"; const r2 = mulberry32(Math.floor(hashRandom(`yulong|${day}|${v.an.uid}|${v.yuTrip}|z`) * 4294967296)); v.yuPhaseT = this.time + yq(60 + r2() * 120); } // 睡 60~180s ≈ 70%
      }
    } else { // tour：绕塘椭圆水上巡游 1.5~3 圈后起跃回河
      v.yuLapT += dt;
      v.yuA += 0.5 * dt; // 角速度
      const nx = POND.cx + Math.cos(v.yuA) * POND.rx * 0.66;
      const ny = (POND.cy + 26) + Math.sin(v.yuA) * POND.ry * 0.6;
      const dx = nx - v.x, dy = ny - v.y, d = Math.hypot(dx, dy) || 1;
      const sp = 66;
      v.x += dx / d * Math.min(d, sp * dt); v.y += dy / d * Math.min(d, sp * dt);
      if (Math.abs(dx) > 2.5) v.face = dx > 0 ? 1 : -1;
      if (v.yuA >= v.yuA0 + v.yuLaps * Math.PI * 2) this.yuStartLeap(v, true);
    }
  }

  /** 玉龙起跃：back=false 河→塘（接着绕塘巡游）；back=true 塘→河（随后回湾续睡，3~6 现实分钟后再来）。 */
  yuStartLeap(v            , back = false) {
    const day = this.farm.farmDay(this.farm.now());
    v.yuTrip++;
    const rng = mulberry32(Math.floor(hashRandom(`yulong|${day}|${v.an.uid}|${v.yuTrip}`) * 4294967296));
    v.leapDur = 1.7; v.leapPeak = 300;
    v.leapX0 = v.x; v.leapY0 = v.y;
    this.splashAt(v.x, v.y, 1.05, 2); this.onLeapSplash?.(v.x, v.y); // 起跳水花
    this.yuFx.bigSplash(v.x, v.y); // v52：大水柱 + 光环 + 水珠飞溅（v53：桥面之下）
    if (back) {
      // 回河落点：河道中央深水带、避开桥洞（桥左 100~290 或桥右 500~… 取靠近者）
      const lx = rng(); v.leapX1 = lx < 0.7 ? 100 + rng() * 190 : YU_BAND.bridgeX1 + 30 + rng() * (YU_BAND.x1 - YU_BAND.bridgeX1 - 50);
      v.leapY1 = YU_HOME.y - 8 + rng() * 16;
      v.face = v.leapX1 > v.x ? 1 : -1;
      v.leapT = 0;
      v.yuPhase = "sleep"; v.yuPhaseT = this.time + yq(50 + rng() * 130);   // 落河后先睡 50~180s
      v.yuNextLeap = this.time + yq(150 + rng() * 180);                    // 每 2.5~5.5 现实分钟来一次（若正睡着则顺延到本段醒游）
    } else {
      v.leapX1 = POND.cx - 60 + rng() * 120; v.leapY1 = POND.cy + 30 + rng() * 110;
      v.face = v.leapX1 > v.x ? 1 : -1;
      v.leapT = 0;
      v.yuPhase = "tour"; v.yuLaps = 1.5 + rng() * 1.5; v.yuLapT = 0;
      v.yuA0 = Math.atan2((v.leapY1 - (POND.cy + 26)) / (POND.ry * 0.6), (v.leapX1 - POND.cx) / (POND.rx * 0.66));
      v.yuA = v.yuA0;
    }
  }

  /** v52：神物常驻特效（只在屏内且成年存活时运行；粒子从共享池领取，满了就跳过）。
   *  神兽猫：脚下旋转符文圈 + 脉动光晕 + 环绕金色光点/小火焰 + 金色足迹拖尾 + 醒来/驻足闪光。
   *  玉龙：青蓝雾气水光环绕 + 游动发光水痕；河里沉睡时水面上方淡云雾 + 缓升光泡。 */
          mythAura(v            , dt        , on         , asleep         , moving         , px0        , py0        ) {
    let fx = this.myth; const r = fx.rng, t = this.time;
    if (v.an.kind === "mythcat") {
      if (!v.runeWrap) {
        const w = new PIXI.Container(); w.eventMode = "none"; w.interactiveChildren = false;
        const pulse = new PIXI.Sprite(fx.tex.glow); pulse.anchor.set(0.5); pulse.blendMode = "add"; pulse.tint = 0xffc83a;
        const rune = new PIXI.Sprite(fx.tex.rune); rune.anchor.set(0.5); rune.tint = 0xf0a400; // 普通混合的深金符文：亮草地上清晰
        const runeG = new PIXI.Sprite(fx.tex.rune); runeG.anchor.set(0.5); runeG.blendMode = "add"; runeG.tint = 0xfff0a0; rune.addChild(runeG); // 叠一层 add 高光
        w.addChild(pulse, rune); w.scale.set(1, 0.34); w.y = -4;
        v.root.addChildAt(w, 0); // 在本体之后：符文圈铺在脚下地面
        v.runeWrap = w; v.rune = rune; v.pulse = pulse;
      }
      v.runeWrap.visible = on;
      if (!on) return;
      const sc = v.isBaby ? 0.6 : 1;
      v.rune .rotation = t * 0.6; v.rune .scale.set(0.56 * sc); v.rune .alpha = 0.75 + 0.25 * Math.sin(t * 2.4);
      const pk = 0.5 + 0.5 * Math.sin(t * 2.4);
      v.pulse .scale.set((2.4 + 0.8 * pk) * sc); v.pulse .alpha = 0.3 + 0.35 * pk;
      if (this.nightness > 0.3) v.pulse .alpha *= 1.3;
      const h = v.topH();
      // 环绕金色光点 / 小火焰：沿身周椭圆生成，缓慢绕行上飘
      v.fxAcc += dt * 14;
      while (v.fxAcc >= 1) {
        v.fxAcc -= 1;
        const a = r() * 6.28, rx = 46 + r() * 16, ry = h * 0.42;
        const x = v.x + Math.cos(a) * rx, y = v.y - h * 0.45 + Math.sin(a) * ry;
        const tang = 40 * (r() < 0.5 ? 1 : -1);
        const nb = r() < 0.7; // 一半普通混合（深金，亮背景可见）一半 add（发光）
        if (r() < 0.3) fx.spawn(x, y, { tex: "flame", vx: -Math.sin(a) * tang * 0.6, vy: -30 - r() * 30, dur: 0.7 + r() * 0.5, s0: 0.3 + r() * 0.14, s1: 0.06, a: 0.95, tint: nb ? 0xff9a00 : 0xffdc6a, wob: 3, wobF: 8, normal: nb });
        else fx.spawn(x, y, { tex: r() < 0.45 ? "star" : "glow", vx: -Math.sin(a) * tang, vy: Math.cos(a) * tang * 0.35 - 18, dur: 1.2 + r() * 0.9, s0: 0.26 + r() * 0.2, s1: 0.06, a: 1, tint: nb ? 0xffa800 : 0xffe07a, vr: 2, fadeIn: 0.25, normal: nb });
      }
      // 走动：金色足迹 + 短拖尾
      if (moving) {
        v.fxAcc2 += Math.hypot(v.x - px0, v.y - py0);
        if (v.fxAcc2 >= 13) {
          v.fxAcc2 = 0;
          fx.spawn(v.x - v.face * 14, v.y - 2, { tex: "glow", dur: 1.2, s0: 0.42, s1: 0.32, a: 0.9, tint: 0xf5a800, flat: 0.4, fadeIn: 0.02, normal: true });
          fx.spawn(v.x - v.face * 14, v.y - 2, { tex: "star", dur: 0.8, s0: 0.3, s1: 0.1, a: 1, tint: 0xfff0a0, flat: 0.6 });
          fx.spawn(v.x - v.face * 20, v.y - h * 0.35, { tex: "glow", dur: 0.55, s0: 0.55, s1: 0.15, a: 0.6, tint: 0xffe48a, vy: -10 });
        }
      }
      // 醒来 / 刚停下 / 驻足时偶尔一道闪光
      v.fxFlashT -= dt;
      const woke = v.fxWasAsleep && !asleep, stopped = v.fxWasMoving && !moving && !asleep;
      if (woke || (stopped && v.fxFlashT < 3) || (!moving && !asleep && v.fxFlashT <= 0)) {
        fx.flash(v.x + v.face * 8, v.y - h * 0.62);
        v.fxFlashT = 5 + r() * 6;
      }
      v.fxWasAsleep = asleep; v.fxWasMoving = moving;
      return;
    }
    // —— 玉龙 ——
    if (!on) return;
    fx = this.yuFx; // v53：玉龙水中特效走桥面下那一池（游到桥位时一并被桥盖住）
    const h = v.height(), cy = v.y - h * 0.35, L = h * 1.1;
    v.fxAcc += dt * (asleep ? 5 : 11);
    while (v.fxAcc >= 1) { // 青蓝雾气 / 水光流转：绕身体旋转的柔光
      v.fxAcc -= 1;
      const a = r() * 6.28, rr = 0.6 + r() * 0.4;
      const x = v.x + Math.cos(a) * L * rr, y = cy + Math.sin(a) * h * 0.38 * rr;
      const tint = r() < 0.5 ? 0x5fe0ff : r() < 0.6 ? 0x8ff5ff : 0x3a9cff;
      fx.spawn(x, y, { tex: "glow", vx: -Math.sin(a) * 34, vy: Math.cos(a) * 12 - 6, dur: 1.2 + r() * 0.8, s0: 0.6 + r() * 0.5, s1: 1.1 + r() * 0.4, a: 0.6, tint, fadeIn: 0.35 });
      fx.spawn(x, y, { tex: "glow", vx: -Math.sin(a) * 30, vy: -10, dur: 1.5 + r() * 0.6, s0: 0.6 + r() * 0.4, s1: 1.2, a: r() < 0.5 ? 0.5 : 0.4, tint: r() < 0.55 ? 0xf2fdff : 0x2aa7e0, fadeIn: 0.3, normal: true }); // 白雾 / 深青水光（普通混合：亮水面上也看得见）
      if (r() < 0.35) fx.spawn(x, y, { tex: "star", vx: -Math.sin(a) * 40, vy: -14, dur: 0.8 + r() * 0.5, s0: 0.32, s1: 0.06, a: 1, tint: 0x1590d0, vr: 3, normal: true });
    }
    if (moving && !asleep) { // 游动发光水痕
      v.fxAcc2 += Math.hypot(v.x - px0, v.y - py0);
      if (v.fxAcc2 >= 10) {
        v.fxAcc2 = 0;
        const tx = v.x - v.face * L * 0.7;
        fx.spawn(tx, v.y - 2, { tex: "glow", dur: 1.6, s0: 0.7, s1: 1.4, a: 0.55, tint: 0xffffff, flat: 0.32, fadeIn: 0.05, normal: true });
        fx.spawn(tx, v.y - 2, { tex: "glow", dur: 1.2, s0: 0.5, s1: 1.0, a: 0.7, tint: 0x6fe6ff, flat: 0.32, fadeIn: 0.05 });
        if (r() < 0.35) fx.spawn(tx, v.y, { tex: "ring", dur: 1.3, s0: 0.2, s1: 0.75, a: 0.55, tint: 0xaef4ff, flat: 0.35, fadeIn: 0.05 });
      }
    }
    if (asleep) { // 河里沉睡：水面上方淡云雾 + 缓升光泡
      v.fxAcc3 += dt * 4.5;
      while (v.fxAcc3 >= 1) {
        v.fxAcc3 -= 1;
        if (r() < 0.45) fx.spawn(v.x + (r() - 0.5) * L * 1.6, v.y - h * 0.7 - r() * 30, { tex: "glow", vx: 6 + r() * 8, vy: -3, dur: 3 + r() * 1.5, s0: 1.4, s1: 2.4, a: 0.45, tint: 0xffffff, flat: 0.45, fadeIn: 0.4, normal: true }); // 淡云雾
        else { // 缓升光泡：青边白芯
          const bx = v.x + (r() - 0.5) * L * 1.2, vy = -22 - r() * 18, d = 2.2 + r(), sz = 0.2 + r() * 0.12;
          fx.spawn(bx, v.y - 6, { tex: "ring", vy, dur: d, s0: sz * 0.4, s1: sz * 0.5, a: 0.9, tint: 0x1a9ad6, fadeIn: 0.2, normal: true });
          fx.spawn(bx, v.y - 6, { tex: "glow", vy, dur: d, s0: sz, s1: sz * 0.7, a: 0.9, tint: 0xbff8ff, fadeIn: 0.2 });
        }
      }
    }
  }
  /** v53：玉龙是否在桥洞带（被桥面盖住的那一段） */
          yuUnderBridge(v            ) { return v.x > YU_BAND.bridgeX0 - 20 && v.x < YU_BAND.bridgeX1 + 20; }
  /** v52：玉龙跃在空中——身后甩出水珠与青光。 */
          yuLeapTrail(v            , dt        , lift        ) {
    v.fxAcc2 += dt * 40;
    const fx = this.myth, r = fx.rng, y = v.y - lift - v.height() * 0.3;
    while (v.fxAcc2 >= 1) {
      v.fxAcc2 -= 1;
      fx.spawn(v.x - v.face * 30 + (r() - 0.5) * 20, y + (r() - 0.5) * 24, { tex: "glow", vx: (r() - 0.5) * 60, vy: 20 + r() * 40, g: 500, dur: 0.6 + r() * 0.4, s0: 0.14 + r() * 0.1, s1: 0.06, a: 1, tint: r() < 0.5 ? 0xffffff : 0x9cefff });
      if (r() < 0.4) fx.spawn(v.x - v.face * 20, y, { tex: "glow", dur: 0.6, s0: 0.9, s1: 0.4, a: 0.45, tint: 0x5fdcff });
    }
  }

  /** v51 神兽猫岸边作息（种子 mythcat|日|uid|trip，零 Math.random）：
   *  柳树眠位 (155,1922)±30 团睡 60% · 河岸土路巡逻 (y≈1490-1520, x150~620) 25% · 塘南缘 (520,1895±10) 驻足窥塘 2~4s 15%。
   *  夜里下一趟必回柳树下睡；过塘/过河一律走桥（393,1796↔1558）与塘岸上沿 (y≈1906)，不趟水不贴塘面。 */
  mcRoutine(v            , dt        ) {
    const day = this.farm.farmDay(this.farm.now());
    if (v.mcPhase === "wsleep" && v.mcArrived) { // 睡定：计时推醒
      if (v.wait > 0) v.wait -= dt;
      else { v.mcPath = null; v.mcArrived = false; }
      return;
    }
    if (v.mcPhase === "peer" && v.mcArrived) {   // 窥塘：面向水面 2~4s
      if (v.wait > 0) v.wait -= dt;
      else { v.mcPath = null; v.mcArrived = false; }
      return;
    }
    if (v.wait > 0 && v.mcPhase === "patrol") { v.wait -= dt; return; }
    if (!v.mcPath) {
      v.mcTrip++;
      const rng = mulberry32(Math.floor(hashRandom(`mythcat|${day}|${v.an.uid}|${v.mcTrip}`) * 4294967296));
      const night = this.isNight();
      const r = night ? 0.1 : rng(); // 夜里：下一趟必回柳树下睡（与全场夜睡气息一致）
      v.mcStep = 0; v.mcArrived = false;
      // 去程：若现在河以南（塘岸/柳下，y>1580），去巡逻需走塘岸上沿 → 桥 → 河以北；回程反向
      const south = v.y > 1580;
      const BR_UP = [{ x: 393, y: 1906 }, { x: 393, y: 1796 }, { x: 393, y: 1598 }, { x: 393, y: 1558 }];
      const BR_DN = [...BR_UP].reverse();
      if (r < 0.6) { // 柳树眠
        v.mcPhase = "wsleep";
        const sx = MC_WILLOW.x + rng() * 60 - 30, sy = MC_WILLOW.y + rng() * 60 - 30;
        v.mcPath = [...(south ? [{ x: 393, y: 1906 }] : [{ x: 393, y: 1558 }, ...BR_DN, { x: 393, y: 1906 }]), { x: sx, y: sy }];
        const r3 = mulberry32(Math.floor(hashRandom(`mythcat|${day}|${v.an.uid}|${v.mcTrip}|dur`) * 4294967296));
        v.wait = 60 + r3() * 120; // 睡 60~180s（提前算好；mcArrived 后开始倒计时）
      } else if (r < 0.85) { // 河岸巡逻：去桥→过河→走土路来回→回桥→回塘岸
        v.mcPhase = "patrol";
        const xA = MC_PATROL.x0 + rng() * 110, xB = MC_PATROL.x1 - rng() * 110;
        const yA = MC_PATROL.y0 + rng() * (MC_PATROL.y1 - MC_PATROL.y0), yB = MC_PATROL.y0 + rng() * (MC_PATROL.y1 - MC_PATROL.y0);
        v.mcPath = [
          ...(south ? BR_UP : []),
          { x: xA, y: yA }, { x: xB, y: yB }, { x: xA + rng() * 60, y: yA },
          ...(south ? BR_DN : [{ x: 393, y: 1558 }, ...BR_DN]),
          { x: 393, y: 1906 },
        ];
      } else { // 塘南缘窥塘
        v.mcPhase = "peer";
        const px = MC_PEER.x + rng() * 24 - 12, py = MC_PEER.y + rng() * 20 - 10;
        v.mcPath = south ? [{ x: px, y: py }] : [{ x: 393, y: 1558 }, ...BR_DN, { x: 393, y: 1906 }, { x: px, y: py }];
        const r4 = mulberry32(Math.floor(hashRandom(`mythcat|${day}|${v.an.uid}|${v.mcTrip}|dur2`) * 4294967296));
        v.wait = 2 + r4() * 2;
      }
    }
    const cur = v.mcPath[v.mcStep];
    const dx = cur.x - v.x, dy = cur.y - v.y, d = Math.hypot(dx, dy);
    if (d < 4) {
      if (v.mcStep < v.mcPath.length - 1) {
        v.mcStep++;
        const onBridge = v.x > 330 && v.x < 460 && v.y > 1555 && v.y < 1908; // 桥上/塘岸上沿顺直走：只轻顿
        if (!onBridge) v.wait = 0.7 + mulberry32(Math.floor(hashRandom(`mythcat|${day}|${v.an.uid}|${v.mcTrip}|${v.mcStep}`) * 4294967296))() * 1.8;
        return;
      }
      if (v.mcPhase === "wsleep" || v.mcPhase === "peer") { // 到位：睡下/窥下（wait 已预排）
        v.mcArrived = true;
        if (v.mcPhase === "peer") v.face = (v.x > POND.cx ? -1 : 1)          ; // 面向塘心
        else v.face = (MC_WILLOW.x - 30 > v.x ? 1 : -1)          ;
        return;
      }
      v.mcPath = null; return; // 巡逻全程走毕
    }
    v.face = dx > 0 ? 1 : -1;
    const sp = v.speed * 1.05;
    v.x += dx / d * Math.min(d, sp * dt); v.y += dy / d * Math.min(d, sp * dt);
    if (v.mcPhase === "wsleep" || v.mcPhase === "peer") v.mcArrived = false; // 还在赶路
  }

  /** 作息排程（纯表现层；确定性种子 zzz|日|uid|轮次）。白天清醒 30~60s → 睡 90~180s（幼崽 ×1.35）；夜里（同夜晚滤镜阈值）全员入睡，鸡鸭先回鸡舍门口站位。 */
          updateSchedule(v            , night         , now        ) {
    const an = v.an;
    if (an.dead || this.farm.animalInfo(an, now).spent) { v.resting = false; v.graze = null; return; }
    if ((an.kind === "mythcat" || an.kind === "yulong") && this.farm.animalInfo(an, now).mature) { v.resting = false; v.graze = null; return; } // v51：各自的岸边/河湾作息接管
    if (an.sickSince != null) { v.graze = null; v.grazeT = 0; } // 生病：放弃本次干饭，原地休养
    const day = this.farm.farmDay(now);
    const rng = () => mulberry32(Math.floor(hashRandom(`zzz|${day}|${an.uid}|${v.sleepCycle}`) * 4294967296));
    if (this.debugSleep === "wake") {
      v.resting = false; v.restNight = false; v.homeSpot = -1; v.graze = null; v.grazeT = 0;
      v.wakeGrace = this.time + 2; v.restAt = this.time + 30 + rng()() * 30;
      return;
    }
    const forceSleep = night || this.debugSleep === "sleep";
    if (forceSleep) {
      if (this.time < v.wakeGrace) return; // 刚被点醒：宽限几秒再睡回去
      if (!v.resting) {
        v.resting = true; v.restNight = night; v.graze = null; v.grazeT = 0;
        if (night && v.zone === "ranch" && (an.kind === "chicken" || an.kind === "duck") && v.homeSpot < 0) {
          const used = new Set([...this.animals.values()].filter(o => o !== v && o.homeSpot >= 0).map(o => o.homeSpot));
          for (let k = 0; k < COOP_SPOTS.length; k++) {
            const s = (an.uid + k) % COOP_SPOTS.length;
            if (!used.has(s)) { v.homeSpot = s; break; }
          }
          if (v.homeSpot < 0) v.homeSpot = an.uid % COOP_SPOTS.length;
        }
      }
      return;
    }
    // 天亮 / debug 解除：夜睡清零，放掉鸡舍站位
    if (v.restNight) {
      v.restNight = false; v.resting = false; v.homeSpot = -1; v.sleepCycle++;
      const r = rng();
      v.restAt = this.time + 25 + r() * 30;
      v.grazeAt = Math.min(v.grazeAt, this.time + 20 + r() * 40);
    }
    if (v.resting && this.time >= v.restWakeAt) {
      v.resting = false; v.sleepCycle++;
      const r = rng();
      v.restAt = this.time + 30 + r() * 30;                       // 白天清醒 30~60s
      v.grazeAt = this.time + 10 + r() * 40;
    } else if (!v.resting && this.time >= v.restAt) {
      v.resting = true; v.graze = null; v.grazeT = 0; v.sleepCycle++;
      const r = rng();
      v.restWakeAt = this.time + (90 + r() * 90) * (v.isBaby ? 1.35 : 1); // 睡 90~180s（幼崽更久）
    }
    // 白天清醒时偶尔走去干饭/喝水（牧场动物；狗巡逻、北极熊打盹有自己的日常，不插队）
    if (!v.resting && v.zone === "ranch" && an.kind !== "dog" && an.kind !== "polarbear" &&
        !v.graze && this.time >= v.grazeAt && !v.food && an.sickSince == null) {
      const r = rng(); v.sleepCycle++;
      const drink = r() < 0.4;
      const spots                                                       = drink ? DRINK_POINTS : FEED_POINTS;
      const used = new Set([...this.animals.values()].filter(o => o !== v && o.graze).map(o => `${o.graze .x}|${o.graze .y}`));
      let pick                                                            = null;
      for (let k = 0; k < spots.length; k++) {
        const s = spots[(an.uid + k) % spots.length];
        if (!used.has(`${s.x}|${s.y}`)) { pick = s; break; }
      }
      if (pick) v.graze = { x: pick.x, y: pick.y, kind: drink ? "drink" : "feed", wx: pick.wx, wy: pick.wy };
      v.grazeAt = this.time + 60 + r() * 90; // 不管成行与否，60~150s 后再约
    }
  }

          updateAnimal(v            , dt        , now        , vis = true) {
    const px0 = v.x, py0 = v.y;
    const an = v.an; const info = this.farm.animalInfo(an, now);
    if (vis) v.refreshBody(); // v49：屏外跳过重绘制（贴图切换/呼吸/缩放），tick 逻辑照跑
    const alive = !an.dead, sick = an.sickSince != null;
    const basking = alive && this.farm.isBasking(an, now);
    // claim / release a sunbathing spot
    if (basking && v.spot < 0) {
      const used = new Set([...this.animals.values()].filter(o => o !== v && o.spot >= 0).map(o => o.spot));
      for (let k = 0; k < BASK_SPOT_POS.length; k++) if (!used.has(k)) { v.spot = k; break; }
      if (v.spot < 0) v.spot = 0;
      v.wait = 0;
    }
    if (!basking && v.spot >= 0) { v.spot = -1; v.onSpot = false; const p = this.randomSpot(v.zone); v.tx = p.x; v.ty = p.y; v.wait = 0; }
    // —— 统一作息：夜里全员入睡；鸡鸭夜里走回鸡舍门口站位；白天按清醒/睡眠窗口轮替 ——
    const night = this.isNight();
    this.updateSchedule(v, night, now);
    let homing = false, asleep = false;
    if (v.resting && alive) {
      if (v.restNight && v.homeSpot >= 0 && !sick) {
        const s = COOP_SPOTS[v.homeSpot];
        if (Math.hypot(s.x - v.x, s.y - v.y) > 4) homing = true; // 回巢途中：正常行走/转身
        else { v.face = (s.x > COOP_DOOR.x ? -1 : 1)          ; asleep = true; } // 到位：面向鸡舍入睡
      } else asleep = true;
    }
    if (alive && info.mature && an.kind === "mythcat") asleep = v.mcPhase === "wsleep" && v.mcArrived; // v51 岸边作息：只在柳树位睡定
    else if (alive && info.mature && an.kind === "yulong") asleep = v.yuPhase === "sleep";             // v51 河湾作息：栖眠段
    if (asleep !== v.asleep) this.onSleep?.(v, asleep); // 入睡/醒来瞬间交给表现层（很轻的一声呼噜，节流）
    v.homing = homing; v.asleep = asleep;
    let moving = false;
    const swimmer = v.zone === "pond" && an.kind !== "turtle";
    if (v.turnCd > 0) v.turnCd -= dt;
    const stepTo = (tx        , ty        , sp        , allowTurn = true) => {
      const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
      if (d < 3) { v.x = tx; v.y = ty; return true; }
      v.x += dx / d * Math.min(d, sp * dt); v.y += dy / d * Math.min(d, sp * dt); moving = true;
      if (allowTurn) {
        const nf = dx > 0 ? 1 : -1;
        if (nf !== v.face) {
          // instant face change only when travelling with intent (eating / heading to a spot / ranch walk);
          // idle wander legs never flip mid-swim — turning is done by pendingFace while nearly stopped
          if (!swimmer) { if (Math.abs(dx) > 2) v.face = nf; }
          else if (Math.abs(dx) > d * 0.45) { v.face = nf; v.turnCd = 5; }
        }
      }
      return false;
    };
    // remains: spent pond creatures sink to the pond floor and wait to be cleaned up
    const remains = v.zone === "pond" && an.dead;
    if (remains) {
      const fy = POND_TOP + 486 + (an.uid % 5) * 14;
      if (v.remainT < 0) { v.remainT = 0; v.remainY0 = v.y; v.remainBub = 0; }
      v.remainT += dt;
      const k = Math.min(1, v.remainT / 1.8);
      // 下沉冒泡串：每 ~0.15s 一个小气泡向上飘
      if (k < 1) {
        v.remainBub -= dt;
        if (v.remainBub <= 0 && this.sinkBubbles.length < 26) {
          v.remainBub = 0.13 + Math.random() * 0.06;
          const bg = new PIXI.Graphics();
          const r = 2 + Math.random() * 2.6;
          bg.circle(0, 0, r).fill({ color: 0xeaf6ff, alpha: 0.85 }).circle(-r * 0.3, -r * 0.3, r * 0.45).fill({ color: 0xffffff, alpha: 0.9 });
          bg.position.set(v.x + (Math.random() - 0.5) * 14, v.y - 6);
          this.pondLayer.addChild(bg);
          this.sinkBubbles.push({ g: bg, t: 0, dur: 1.2 + Math.random() * 0.7, vy: 26 + Math.random() * 26, drift: (Math.random() - 0.5) * 10 });
        }
      }
      const ease = 1 - (1 - k) * (1 - k);
      v.y = v.remainY0 + (fy - v.remainY0) * ease;
      v.x += (Math.max(150, Math.min(600, v.x)) - v.x) * Math.min(1, dt * 0.3);
      v.faceS += Math.sign(1 - v.faceS) * dt * 2;
      v.bubble.visible = false;
      v.status.visible = false;
      v.ripple.visible = false;
      if (vis) {
        v.refreshBody();
        v.body.alpha = 0.9 - ease * 0.2;
        v.body.rotation = (an.uid % 2 ? -1 : 1) * 0.18 * ease;
      }
      v.root.position.set(v.x, v.y);
      v.root.zIndex = v.y;
      return;
    }
    // 鱼跃出水面：leapT 覆盖位置与姿态（抛物线 + 切线旋转 + 顶点微放大），游走与下潜暂停，结束无缝接回
    if (v.leapT >= 0) {
      v.leapT += dt;
      const k = Math.min(1, v.leapT / v.leapDur);
      v.x = v.leapX0 + (v.leapX1 - v.leapX0) * k;
      v.y = v.leapY0 + (v.leapY1 - v.leapY0) * k;
      const lift = Math.sin(Math.PI * k) * v.leapPeak;
      const vx = (v.leapX1 - v.leapX0) / v.leapDur;
      const vy = (-Math.cos(Math.PI * k) * Math.PI * v.leapPeak) / v.leapDur;
      const phi = Math.atan2(vy, vx === 0 ? v.face * 0.0001 : vx); // 切线方向
      v.phase += dt;
      const grow = 1 + Math.sin(Math.PI * k) * 0.14;
      v.body.scale.set(v.baseScale * v.face * grow, v.baseScale * grow);
      v.body.rotation = v.face === 1 ? phi : phi - Math.PI;
      v.body.alpha = 1; v.body.tint = 0xffffff; // 出水：去水下蓝晕
      v.root.position.set(v.x, v.y - lift);
      if (an.kind === "yulong") { this.yuLeapTrail(v, dt, lift); if (v.root.parent !== this.yuAir) this.yuAir.addChild(v.root); } // v52：空中拖出水珠与青光；v53：离水那段挂到桥面之上
      v.root.zIndex = v.y + 900; // 跃出时浮在塘面一切之上
      v.bubble.visible = false; v.status.visible = false;
      if (k >= 1) {
        v.leapT = -1; v.tx = v.x; v.ty = v.y; v.wait = 0.7; v.body.rotation = 0;
        this.splashAt(v.x, v.y, 1.15, 3); // 落水：大水花 + 3 圈波纹
        if (an.kind === "yulong") { this.yuFx.bigSplash(v.x, v.y, true); this.pondLayer.addChild(v.root); } // v52：玉龙入水扩散光圈；v53：落水后回到桥面之下
        this.onLeapSplash?.(v.x, v.y);
      }
      return;
    }
    // 下潜:fish sink a little with dimmer alpha, then float back — reads as clear-deep water
    let diveLift = 0, diveK = 0;
    const pondFish = v.zone === "pond" && an.kind !== "turtle" && alive && !sick && !v.food && v.nibble <= 0 && !v.isBaby && !asleep;
    if (pondFish) {
      if (v.nextDive === 0) v.nextDive = this.time + 3 + Math.random() * 9;
      if (this.time >= v.nextDive && v.diveT < 0) v.diveT = 0;
      if (v.diveT >= 0) {
        v.diveT += dt;
        diveK = Math.sin(Math.PI * Math.min(1, v.diveT / 2.6));
        diveLift = diveK * 46;
        if (v.diveT >= 2.6) { v.diveT = -1; v.nextDive = this.time + 7 + Math.random() * 12; }
      }
    }
    const sp = v.speed * (v.isBaby ? 0.8 : 1);
    let specialMove = false;
    if (alive && !v.food && !sick && !homing && !v.graze && info.mature) {
      if (an.kind === "yulong") { this.yuRoutine(v, dt); specialMove = true; }       // v51 河湾作息（跃潭段由 leapT 抛物线接管）
      else if (an.kind === "mythcat") { this.mcRoutine(v, dt); specialMove = true; } // v51 岸边作息
    }
    if (alive && !v.food && !sick && !asleep && !homing && !v.graze) {
      const grown = this.farm.animalInfo(an, now).mature;
      if (grown && an.kind === "peacock") {
        if (v.nextDisplay === 0) v.nextDisplay = this.time + 30 + Math.random() * 150;
        if (this.time >= v.nextDisplay && this.time >= v.displayUntil) this.displayPeacock(an.uid);
        specialMove = this.time < v.displayUntil; // 开屏站定
      }
      if (grown && an.kind === "dog") specialMove = this.dogMove(v, dt);
      if (an.kind === "polarbear") specialMove = this.bearNap(v, dt) || specialMove; // 幼崽也睡：出生就趴在冰块旁
    }
    if (v.food && alive) {
      const fd = v.food; fd.t += dt;
      if (v.nibble <= 0) {
        const there = stepTo(fd.tx, fd.ty, Math.max(sp * 3, 55));
        if (there || fd.t > 8) {
          v.face = fd.side;
          const nib = this.anims[an.kind + "-nibble"];
          if (nib && !v.isBaby) v.nibble = 1; else v.hop = 0.45;
          const eatDelay = nib && !v.isBaby ? ((nib.impact ?? 6) + 1) / nib.fps : 0.15;
          const g = fd.g; v.food = null;
          this.motions.push({ t: 0, dur: eatDelay, step: () => {}, done: () => {
            this.motions.push({ t: 0, dur: 0.25, step: k => { g.scale.set(1 - k); g.alpha = 1 - k; }, done: () => g.destroy() });
            this.onAte?.(v);
          } });
        }
      }
    } else if (homing) {
      const s = COOP_SPOTS[v.homeSpot];
      stepTo(s.x, s.y, Math.max(sp * 1.2, 36)); // 排队走向鸡舍门口（正常行走/转身）
    } else if (asleep) {
      // 原地熟睡：不走动（呼吸/伏身/Zzz 在姿态段处理；鱼悬停、乌龟不动）
    } else if (v.graze && alive && !sick) {
      const g = v.graze;
      if (v.grazeT <= 0) {
        if (stepTo(g.x, g.y, Math.max(sp * 1.5, 40))) {
          v.grazeT = 3 + hashRandom(`grazedur|${this.farm.farmDay(now)}|${an.uid}|${v.sleepCycle}`) * 3; // 低头吃/喝 3~6s
          v.sipAcc = 0.35;
          if (g.kind === "drink") v.face = ((g.wx ?? g.x) > g.x ? 1 : -1)          ; // 面向水盆
        }
      } else {
        v.grazeT -= dt; // 干饭/喝水中（点头动作与水波在姿态段处理）
        if (v.grazeT <= 0) { v.graze = null; v.wait = 0.6; }
      }
    } else if (basking) {
      const p = BASK_SPOT_POS[v.spot];
      const was = v.onSpot;
      v.onSpot = v.nibble <= 0 && stepTo(p.x, p.y, Math.max(sp * 3, 55));
      if (v.onSpot) v.face = p.x > POND.cx ? -1 : 1;
      if (v.onSpot && !was && v.bodyKey !== "bask") this.onBaskArrive?.(v);
    } else if (alive && !sick && !specialMove && v.nibble <= 0) {
      if (v.wait > 0) {
        v.wait -= dt;
        // fish turn while idling at the end of a leg…
        if (swimmer && v.pendingFace !== 0 && v.wait <= 0.55) {
          v.face = (v.pendingFace > 0 ? 1 : -1)          ;
          v.pendingFace = 0;
          v.turnCd = 4;
        }
      } else if (swimmer && Math.abs(v.faceS - v.face) > 0.04) {
        // …and the smooth flip must fully finish BEFORE the fish pushes off again
        moving = false;
      } else if (stepTo(v.tx, v.ty, sp, !swimmer)) {
        if (swimmer) {
          v.wait = 0.9 + Math.random() * 1.8;
          const p = this.swimTarget(v); v.tx = p.x; v.ty = p.y;
          const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
          const nf = dx > 0 ? 1 : -1;
          v.pendingFace = (d > 140 && Math.abs(dx) > d * 0.45 && nf !== v.face) ? nf : 0;
        } else {
          v.wait = 1 + Math.random() * 3;
          const p = this.randomSpot(v.zone); v.tx = p.x; v.ty = p.y;
        }
      }
    }
    if (vis) v.refreshBody();
    // special movers (dogRun/bearNap) change position without stepTo — reflect that in `moving`
    if (!moving && (Math.abs(v.x - px0) + Math.abs(v.y - py0)) > 0.01) moving = true;
    // smooth turn: flip through a narrow sprite over ~0.4s instead of snapping
    v.faceS += Math.sign(v.face - v.faceS) * Math.min(Math.abs(v.face - v.faceS), dt * 5);
    if (v.anim && v.bodyKey !== "nibble") {
      if (vis) {
        if ((moving || swimmer) && !v.anim.playing) v.anim.play(); if (!moving && !swimmer && v.anim.playing) v.anim.gotoAndStop(0);
        v.anim.animationSpeed = ((this.anims[an.kind]?.fps ?? 12) / 60) * (swimmer ? 1 - v.sleepK * 0.9 : 1); // 睡着的鱼：尾巴几乎不动
      } else if (v.anim.playing) v.anim.gotoAndStop(0); // v49：屏外停帧，不要跑贴图推进
    }
    v.phase += dt;
    v.sleepK += ((asleep ? 1 : 0) - v.sleepK) * Math.min(1, dt / 0.4 * 2.2); // 入睡/醒来 ~0.4s 平滑
    let lift = 0;
    if (v.hop > 0) { v.hop = Math.max(0, v.hop - dt); lift = Math.sin((1 - v.hop / 0.45) * Math.PI) * 14; }
    if (vis) {
    const sx = v.baseScale * (Math.abs(v.faceS) < 0.08 ? 0.08 * Math.sign(v.faceS || v.face) : v.faceS); let sy = v.baseScale;
    if (an.kind === "peacock" && this.time < v.displayUntil) {
      // 开屏微颤
      sy *= 1 + Math.sin(this.time * 14) * 0.03;
      v.body.rotation = Math.sin(this.time * 7) * 0.02;
    }
    if (v.zone === "pond" && an.kind !== "turtle") {
      // mid-flip: body flattens (sx→0) and bulges vertically — reads as a smooth page-turn
      const flat = 1 - Math.min(1, Math.abs(v.faceS));
      sy *= 1 + flat * 0.16;
      lift += flat * 4;
      const sk = v.sleepK;
      // 睡着的鱼：悬停、微微下沉、头略朝下倾斜，晃动/摆尾都放慢放小
      v.body.rotation = Math.sin(v.phase * (asleep ? 0.9 : 2)) * 0.06 * (1 - sk * 0.6) + v.face * 0.13 * sk;
      lift += Math.sin(v.phase * (asleep ? 0.8 : 1.7)) * 2 - sk * 7;
      sy *= 1 + Math.sin(v.phase * 1.1) * 0.02 * sk; // 慢呼吸
      if (!v.anim) v.body.scale.set(sx * (1 + Math.sin(v.phase * (8 - sk * 6)) * 0.04 * (1 - sk * 0.85)), sy);
      else v.body.scale.set(sx, sy);
    } else {
      if (moving && !v.anim) lift += Math.abs(Math.sin(v.phase * 9)) * 5;
      if (!moving) sy *= 1 + Math.sin(v.phase * (v.bodyKey === "bask" ? 1.2 : 2.2)) * (v.bodyKey === "bask" ? 0.03 : 0.015);
      const posed = v.bodyKey === "sleep" || v.bodyKey === "dogsleep" || v.bodyKey === "bearsleep";
      if (asleep) sy *= (posed ? 1 : 0.94) * (1 + Math.sin(v.phase * 1.25) * 0.032); // 熟睡：睡姿图 + 慢呼吸（锚点在脚底，不悬空不下沉）
      if (sick) v.body.rotation = Math.sin(v.phase * 18) * 0.05;
      else if (v.graze && v.grazeT > 0) { const peck = Math.max(0, Math.sin(v.phase * 10)); v.body.rotation = v.face * (0.13 + peck * 0.08); lift -= peck * 4; } // 低头啄食/饮水
      else if (asleep) v.body.rotation = posed ? 0 : Math.sin(v.phase * 1.25) * 0.02;
      else v.body.rotation = 0;
      v.body.scale.set(sx, sy);
    }
    v.body.alpha = an.dead ? 0.55 : 1;
    v.body.tint = an.dead ? 0xbbbbbb : sick ? 0xd8f0b8 : 0xffffff;
    if (v.zone === "pond" && !an.dead && !info.spent && an.kind !== "turtle" && !v.isBaby) {
      v.body.tint = sick ? 0xd8f0b8 : 0xbfe0f2;
      v.body.alpha = 0.86 - diveK * 0.32;
    }
    if (v.xfade > 0) {
      v.xfade = Math.max(0, v.xfade - dt);
      const k = 1 - v.xfade / XFADE, e = k * k * (3 - 2 * k);
      const ba = v.body.alpha; v.body.alpha = ba * e;
      v.body.scale.y *= 0.9 + 0.1 * e; // 新姿态轻轻"铺开"
      if (v.ghost) {
        v.ghost.alpha = v.ghostAlpha * (1 - e);
        v.ghost.scale.x = Math.abs(v.ghost.scale.x) * Math.sign(v.body.scale.x || 1);
      if (v.xfade <= 0) { v.ghost.destroy(); v.ghost = null; }
      }
    }
    } // v49：vis 收尾
    v.root.position.set(v.x, v.y - lift + diveLift);
    v.root.zIndex = v.y;
    // 熟睡的视觉符号：头顶飘 Zzz（池化粒子）；鱼偶尔冒一颗小气泡；水盆喝水时点小涟漪
    if (vis && asleep) {
      v.zzzAcc += dt;
      if (v.zzzAcc >= 1.0 + (an.uid % 5) * 0.14) {
        v.zzzAcc = 0;
        this.spawnZzz(v.x + 10, v.y - v.topH() - (swimmer ? 26 : 18));
      }
      if (swimmer) {
        v.sipAcc -= dt;
        if (v.sipAcc <= 0) { v.sipAcc = 1.5 + (an.uid % 7) * 0.19; this.spawnSleepBubble(v.x + v.face * 12, v.y - v.height() * 0.34); }
      }
    }
    if (vis && v.graze && v.grazeT > 0 && v.graze.kind === "drink") {
      v.sipAcc -= dt;
      if (v.sipAcc <= 0) { v.sipAcc = 0.9; this.basinRipple(v.graze.wx ?? v.graze.x, v.graze.wy ?? v.graze.y); }
    }
    if (vis) { // v49：气泡/状态/乌龟块屏外不更
    v.bubble.visible = info.ready > 0;
    if (v.bubble.visible) v.bubble.y = -v.topH() - 40 + Math.sin(v.phase * 3) * 4;
    const mood = info.mood;
    const sleeping = (an.kind === "dog" && this.time < v.sleepUntil) || (an.kind === "polarbear" && this.time < v.napUntil && v.onNap) || asleep;
    let em = mood === "sick" ? "🤒" : mood === "poop" ? "💩" : mood === "spent" ? "🧺" : mood === "hungry" ? "😫" : mood === "deceased" ? "🕊️" : "";
    if (sleeping && !em) em = "💤"; // 💩/🤒/🧺 等重要状态优先，不被 💤 盖住（收获气泡本身已压过状态）
    v.status.visible = !!em && !v.bubble.visible; if (em) setText(v.status, em);
    // v50：神兽猫成年后脚下常驻金色光环（纯表现；与数据层的 5% 加速光环呼应）
    if (an.kind === "mythcat") {
      if (!v.glowFx) {
        v.glowFx = new PIXI.Graphics().ellipse(0, -7, 50, 14).fill({ color: 0xffd84a, alpha: 0.3 });
        v.glowFx.eventMode = "none"; v.glowFx.blendMode = "add"; v.glowFx.y = 0; v.root.addChild(v.glowFx); // 置顶 + add 混合：必不被阴影/本体遮住
        const halo = new PIXI.Graphics().ellipse(0, -7, 56, 17).stroke({ width: 3, color: 0xffedb3, alpha: 0.5 });
        halo.blendMode = "add"; v.glowFx.addChild(halo);
      }
      const glowOn = vis && info.mature && alive;
      v.glowFx.visible = glowOn;
      if (glowOn) {
        const k = 0.55 + 0.2 * Math.sin(v.phase * 1.6);
        v.glowFx.alpha = k; v.glowFx.scale.set(1 + 0.08 * Math.sin(v.phase * 1.6));
      }
    }
    if ((an.kind === "mythcat" || an.kind === "yulong") && v.leapT < 0) this.mythAura(v, dt, info.mature && alive, asleep, moving, px0, py0);
    if (an.kind === "turtle") {
      const sunny = basking && v.onSpot;
      v.sun.visible = sunny;
      if (sunny) { v.sun.y = -v.height() * 0.45; v.sunRays.rotation = this.time * 0.4; v.sun.alpha = 0.75 + 0.25 * Math.sin(this.time * 2); }
      v.ripple.visible = alive && !sunny;
      if (v.ripple.visible) { const k = 1 + 0.08 * Math.sin(v.phase * 2.5); v.ripple.scale.set(k * (v.isBaby ? 0.7 : 1)); v.ripple.y = -4; }
      // v49：晒太阳倒计时圆环只在进度档位变化时重建（以前每帧 clear+重画）
      const wantRing = basking && !v.bubble.visible ? Math.max(0, Math.round(((an.baskUntil ?? now) - now) / (BASK_MIN * MS_PER_FARM_MIN) * 48)) + 1 : 0;
      if (wantRing !== v.ringL) {
        v.ring.clear(); v.ringL = wantRing;
        if (wantRing > 0) {
          const left = Math.max(0, (an.baskUntil ?? now) - now) / (BASK_MIN * MS_PER_FARM_MIN);
          const ry = -v.height() - 34;
          v.ring.circle(0, ry, 22).fill({ color: 0xfff6e0 }).stroke({ width: 3, color: BORDER });
          if (left > 0.01) v.ring.moveTo(0, ry).lineTo(0, ry - 17).arc(0, ry, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left).closePath().fill({ color: COIN });
        }
      }
      if (basking && !v.bubble.visible) { v.status.visible = true; setText(v.status, "☀️"); v.status.y = -v.height() - 34; v.status.scale.set(0.7); }
      else { v.status.y = -v.topH() - 10; v.status.scale.set(1); }
    }
    }
  }
}

/** 统一作息的睡姿图：animals/<id>-sleep.png，值 = 睡姿高度 / 站立高度（宽度与站姿相近、脚底同一基线） */
export const SLEEP_POSE                         = { chicken: 0.72, duck: 0.7, sheep: 0.66, pig: 0.75, cow: 0.58, giraffe: 0.6, peacock: 0.62, ostrich: 0.42, turtle: 0.9, mythcat: 0.55 };
const XFADE = 0.4;
export const pad = (n        ) => String(n).padStart(2, "0");
export const itemTexKey = (item        ) => `items/i${pad(ITEM_TEX[item])}`;
export const ALL_TEXTURES = [
  "bg/ranch.webp", "bg/field.webp", "bg/river.webp", "bg/pond.webp", "sprites/plot.webp", "sprites/cloud.webp", "sprites/dragonfly.webp", "sprites/pebbles.webp", "sprites/fishbone.webp", "sprites/turtleshell.webp",
  ...Array.from({ length: 16 }, (_, i) => `crops/m${pad(i)}.webp`),
  ...Array.from({ length: 16 }, (_, i) => `crops/g${pad(i)}.webp`),
  ...Array.from({ length: 38 }, (_, i) => `items/i${pad(i)}.webp`),
  ...ANIMALS.map(a => `animals/${a.id}.webp`), "animals/turtle-bask.webp", "animals/peacock-spread.webp", "animals/dog-sleep.webp", "animals/polarbear-sleep.webp", ...Object.keys(SLEEP_POSE).map(k => `animals/${k}-sleep.webp`), "sprites/iceblock.webp", "sprites/willow2.webp", "sprites/scarecrow.webp", "sprites/wutong-0.webp", "sprites/wutong-1.webp", "sprites/wutong-2.webp", "sprites/bridge-deck.webp",
  ...ANIMALS.filter(a => !a.noBaby).map(a => `babies/${a.id}.webp`),
];
export const ANIM_PACKS                         = { chicken: "chicken-walk", cow: "cow-walk", fish: "fish-swim", turtle: "turtle-walk", "turtle-nibble": "turtle-nibble", peacock: "peacock-walk", ostrich: "ostrich-walk", dog: "dog-run", sheep: "sheep-walk", pig: "pig-walk", mythcat: "mythcat-walk", yulong: "yulong-swim" };
void CROPS; void ROCK;
