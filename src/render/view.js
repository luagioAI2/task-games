// 渲染器：深渊剖面世界（设计单位，宽 640 居中，纵向滚动）。只读模拟状态，不改它。
// 背景全部是矢量绘制（见 art/backdrop.js），只有道具和人物是原画。
// 层次：虚空背景 → 漂浮微粒 → 岩层行 → 地表（小镇、仓库、绞盘站栈桥）→ 绳索与缆车吊斗 → 矿箱 / 工人 → 木牌、管理员、技能按钮 → 碎石火花 / 飘字。
import { Container, Sprite, Graphics, Texture, Text } from '../../lib/pixi.min.js';
import { RES } from '../art/kit.js';
import { layerBackdrop, surfaceBackdrop, town, TOWN_H, TOWN_WT, TOWN_W, BG, LBG, ROW, SURF, CLIFF_X, VOID_X0, LAYER_H, SURF_X0, SURF_Y0, VOID_BOTTOM } from '../art/backdrop.js';
import { rowTexture, X0, T_BOT, CRATE_X, MINE_X } from '../art/rock.js';
import { minerSet, operatorArt, carterArt, managerArt, ghostArt, mgrFace, frameAt, MANAGERS } from '../art/chars.js';
const MANAGERS_KEY = (mi) => MANAGERS[mi % MANAGERS.length].key;
import { oreKind } from '../art/ore.js';
import { t as tr } from '../../i18n.js';
import * as P from '../art/props.js';
import { LAYERS, SHAFT_COUNT, SHAFTS_PER_LAYER, layerOf } from '../data/layers.js';
import * as E from '../sim/economy.js';
import * as W from '../sim/world.js';
import { fmt, fmtClock } from '../format.js';

const texCache = new Map();
const tex = (c) => { let t = texCache.get(c); if (!t) { t = Texture.from(c); texCache.set(c, t); } return t; };
export const DESIGN_W = 640;
// 地表布局：左边绞盘站（高脚小屋）→ 井口里的缆车吊斗 → 门架 → 站台矿堆 → 铁轨 → 仓库（门在 HOUSE_DOOR）
export const BASKET_X = 214, DECK_Y = SURF - 6, PULLEY_Y = DECK_Y - P.PULLEY_DY, STATION_X = 300, HOUSE_X = 454, HOUSE_DOOR = 562;
const GAP_L = BASKET_X - P.GW / 2 - 2, GAP_R = BASKET_X + P.GW / 2 + 2;
// 升级牌位置（贴着各自的设施）：矿道 = 矿壁右侧、与坑道同高；电梯 = 绞盘小屋正面；仓库 = 屋脊上方的招牌位
export const SHAFT_BOARD = [548, 82], ELEV_BOARD = [100, DECK_Y - 40], HOUSE_BOARD = [530, SURF - 172];
// 管理员站位（脚底）：矿道在洞口，电梯在崖边地面，仓库在门右边
export const MGR_X = 350, ELEV_MGR = [382, SURF - 6], HOUSE_MGR = [600, SURF - 6];
// 吊斗顶边：yf = 0 停在栈桥井口（底贴桥面），yf = i + 1 停在第 i 条矿道的码头旁（底贴码头）
const basketTop = (yf) => { const dock = DECK_Y - P.GH, s0 = SURF + T_BOT - P.GH; return yf <= 1 ? dock + (s0 - dock) * yf : s0 + (yf - 1) * ROW; };
export const rowTop = (i) => SURF + i * ROW;
const FONT = '"Baloo 2", "PingFang SC", "Hiragino Sans", "Microsoft YaHei", "Yu Gothic", "Noto Sans CJK SC", "Noto Sans JP", sans-serif';
const ANCH = (sp, a) => sp.anchor.set(a?.x ?? 0.5, a?.y ?? 1);
const label = (size, color = '#ffffff', stroke = '#3a2418') => new Text({ text: '', style: { fontFamily: FONT, fontSize: size, fontWeight: '800', fill: color, stroke: { color: stroke, width: Math.max(3, size / 5) }, align: 'center' }, resolution: 2 });
// 动作节奏：挖矿动画比原始速度快 2.6 倍（一镐约 0.6 秒），走路 1.3 倍
const MINE_SPEED = 2.6, WALK_SPEED = 1.3;
const CHIP = { coal: [0x2a2e36, 0x8c97aa], gold: [0xf2b632, 0xfff0a0], diamond: [0x7ae0ff, 0xffffff], ink: [0x1a1240, 0x7fe8ff] };
// 6 位管理员各自的跳法（设计单位 / 弧度）：hop 反拍弹起高度、sq 落拍压扁、sway 左右摇摆、nod 落拍点头
// 绫（怀表，冷静小幅度）· 小蜜（活力蹦跳）· 雪见（以点头为主）· 栗子（摇摆）· 樱（蹦得最高）· 灯（提着灯笼慢慢晃）
const GROOVE = [
  { hop: 3, sq: 0.06, sway: 0.045, nod: 0.04 },
  { hop: 5.5, sq: 0.09, sway: 0.04, nod: 0.03 },
  { hop: 2.2, sq: 0.05, sway: 0.025, nod: 0.08 },
  { hop: 4.5, sq: 0.08, sway: 0.065, nod: 0.03 },
  { hop: 6.5, sq: 0.1, sway: 0.05, nod: 0.04 },
  { hop: 2.8, sq: 0.05, sway: 0.075, nod: 0.02 },
  { hop: 1.6, sq: 0.04, sway: 0.055, nod: 0.07 },   // 紫苑（御姐）：幅度最小，靠点头和摆扇子压拍
];
const NOTE_COL = ['#ffe066', '#ffb0d0', '#9ae0ff', '#b8ff8a'];

export class View {
  constructor(app) {
    this.app = app;
    this.root = new Container(); this.world = new Container(); this.root.addChild(this.world);
    this.cam = { y: 0, vy: 0, target: null };
    this.floats = []; this.time = 0; this.hits = []; this.chips = [];
    const C = () => new Container();
    this.bgL = C(); this.moteG = new Graphics(); this.rowsL = C(); this.surfL = C(); this.ropeG = new Graphics(); this.actorsL = C(); this.signsL = C(); this.fxL = C();
    this.moteG.blendMode = 'add';
    this.chipG = new Graphics();
    this.world.addChild(this.bgL, this.moteG, this.rowsL, this.surfL, this.ropeG, this.actorsL, this.chipG, this.signsL, this.fxL);
    this.buildStatic();
    this.shaftV = [];
  }

  // —— 一次性的静态场景 ——
  buildStatic() {
    const surf = new Sprite(tex(surfaceBackdrop())); surf.position.set(SURF_X0, SURF_Y0); surf.scale.set(1 / BG); this.bgL.addChild(surf);
    this.layerS = [];   // 各层远景在快进入视野时才拼好
    const bottom = new Graphics().rect(VOID_X0, SURF + LAYERS.length * LAYER_H - 1, 2200, 2000).fill({ color: parseInt(VOID_BOTTOM.slice(1), 16) }); this.bgL.addChild(bottom);
    this.motes = Array.from({ length: 60 }, (_, k) => ({ x: VOID_X0 + Math.random() * (CLIFF_X - VOID_X0), y: Math.random(), s: Math.random(), k }));
    this.townS = new Sprite(tex(town(1))); this.townS.scale.set(1 / LBG); this.surfL.addChild(this.townS);
    this.placeTown(1);
    this.house = new Sprite(tex(P.warehouse(1))); this.house.position.set(HOUSE_X, SURF - 4 - P.HOUSE_H()); this.house.scale.set(1 / RES); this.surfL.addChild(this.house);
    const gs = new Sprite(tex(P.groundStrip(690))); gs.position.set(CLIFF_X - 8, SURF - 17); gs.scale.set(1 / RES); this.surfL.addChild(gs);
    const rail = new Sprite(tex(P.rail(HOUSE_DOOR - STATION_X - 40))); rail.position.set(STATION_X + 30, SURF - 14); rail.scale.set(1 / RES); this.surfL.addChild(rail);
    this.pierS = new Sprite(tex(P.pier(BASKET_X, GAP_L, GAP_R, 1))); this.pierS.position.set(P.PIER_X0, DECK_Y - P.PIER_TOP); this.pierS.scale.set(1 / RES); this.surfL.addChild(this.pierS);
    this.tiers = {};   // 各设施的造型档次（换了才重建贴图）
    this.pile = new Sprite(); this.pile.position.set(STATION_X - 20, DECK_Y - 42); this.pile.scale.set(1 / RES); this.surfL.addChild(this.pile);
    this.pileText = label(15); this.pileText.anchor.set(0.5, 1); this.pileText.position.set(STATION_X + 16, DECK_Y - 40); this.surfL.addChild(this.pileText);
    // 缆车吊斗：升降员站在斗里（只露出上半身），矿堆和斗身盖在她前面
    this.basket = new Sprite(); this.basket.anchor.set(0.5, 0); this.basket.scale.set(1 / RES);
    this.op = new Sprite(operatorArt().tex); this.op.anchor.set(0.5, 1); this.op.scale.set(operatorArt().scale);
    this.basketText = label(15, '#ffffff', '#2a1608'); this.basketText.anchor.set(0.5, 0.5);
    this.actorsL.addChild(this.op, this.basket, this.basketText);
    this.carters = [];
    this.elevBoard = this.makeBoard(ELEV_BOARD[0], ELEV_BOARD[1]);
    this.houseBoard = this.makeBoard(HOUSE_BOARD[0], HOUSE_BOARD[1]);
    this.elevMgr = this.makeMgr(ELEV_MGR[0], ELEV_MGR[1]);
    this.houseMgr = this.makeMgr(HOUSE_MGR[0], HOUSE_MGR[1]);
    this.houseText = label(15); this.houseText.anchor.set(0.5, 1); this.surfL.addChild(this.houseText);
    // 新矿道 / 岩障木牌
    this.newBoard = new Container(); const nb = new Sprite(tex(P.board(190, 56, 'gold'))); nb.scale.set(1 / RES); nb.anchor.set(0.5, 0.5); this.newBoard.addChild(nb);
    this.newText = label(17, '#4a2a10', '#fff3c0'); this.newText.anchor.set(0.5); this.newText.position.set(0, -2); this.newBoard.addChild(this.newText);
    this.signsL.addChild(this.newBoard);
    // 岩障：手绘乱石堆，盖在下一条矿道的位置上（炸开前）
    this.rubble = new Sprite(tex(P.barrier(680))); this.rubble.position.set(CLIFF_X - 12, 0); this.rubble.scale.set(1 / RES); this.surfL.addChild(this.rubble);
    this.rubble.visible = false;
    this.zzzE = label(13, '#ffffff', '#3a3a6a'); this.zzzE.anchor.set(0.5, 1); this.zzzH = label(13, '#ffffff', '#3a3a6a'); this.zzzH.anchor.set(0.5, 1);
    this.fxL.addChild(this.zzzE, this.zzzH);
  }
  // 升级牌：藏青底 + 金边的圆角牌，左边一个箭头圆徽（钱够时变绿并轻轻跳动），右边「Lv N」
  makeBoard(x, y) {
    const c = new Container(); c.position.set(x, y); c.home = [x, y];
    const g = new Graphics(); c.addChild(g); c.g = g;
    const t = label(15, '#ffffff', '#141c3a'); t.anchor.set(0, 0.5); t.position.set(-12, -1); c.addChild(t); c.t = t;
    c.can = null; this.signsL.addChild(c); return c;
  }
  drawBoard(c, can) {
    if (c.can === can) return; c.can = can;
    const g = c.g; g.clear();
    g.roundRect(-46, -15, 92, 34, 11).fill({ color: 0x000000, alpha: 0.28 });
    g.roundRect(-46, -18, 92, 34, 11).fill({ color: can ? 0x26356b : 0x3a3f58 }).stroke({ width: 2.5, color: can ? 0xf2c95c : 0xa8a49a });
    g.roundRect(-42, -15, 84, 10, 6).fill({ color: 0xffffff, alpha: 0.1 });
    g.circle(-29, -1, 12).fill({ color: can ? 0x3fae4a : 0x6c7184 }).stroke({ width: 2, color: 0xffffff });
    g.poly([-29, -9, -37, 0, -32, 0, -32, 6, -26, 6, -26, 0, -21, 0]).fill({ color: 0xffffff });
  }
  // 管理员位：管理员（或空位人影）+ 头顶技能按钮 + 文字（雇佣价 / 技能倒计时）
  makeMgr(x, y) {
    const c = new Container(); c.position.set(x, y);
    const aura = new Graphics(); aura.circle(0, -30, 32).fill({ color: 0xffe066, alpha: 0.32 }).circle(0, -30, 21).fill({ color: 0xfff2a0, alpha: 0.32 }); aura.visible = false; c.addChild(aura); c.aura = aura;
    const d = new Sprite(); d.anchor.set(0.5, 1); c.addChild(d); c.d = d;
    const btn = new Graphics(); btn.position.set(0, -74); c.addChild(btn); c.btn = btn;
    const t = label(12, '#ffffff', '#1a2244'); t.anchor.set(0.5, 1); t.position.set(0, -90); c.addChild(t); c.t = t;
    const up = label(14, '#7aff7a', '#1e4a1e'); up.text = '▲'; up.anchor.set(0.5); up.position.set(19, -52); c.addChild(up); c.up = up;
    c.mode = 'idle'; c.t0 = 0; c.nextG = 2 + Math.random() * 4; c.lastMgr = null;
    this.signsL.addChild(c); return c;
  }

  // 每条矿道的可变部分（懒创建）
  shaftView(i) {
    if (this.shaftV[i]) return this.shaftV[i];
    const top = rowTop(i), c = new Container();
    const row = new Sprite(); row.position.set(X0, top); row.scale.set(1 / RES); this.rowsL.addChild(row);
    const crate = new Sprite(); crate.anchor.set(0.5, 1); crate.position.set(CRATE_X - 26, top + T_BOT + 2); crate.scale.set(1 / RES);
    const ctext = label(14); ctext.anchor.set(0.5, 1); ctext.position.set(CRATE_X - 26, top + T_BOT - 42);
    const miners = new Container();
    c.addChild(crate, miners, ctext); this.actorsL.addChild(c);
    const board = this.makeBoard(SHAFT_BOARD[0], top + SHAFT_BOARD[1]);
    const mgr = this.makeMgr(MGR_X, top + T_BOT - 2);
    const num = label(13, '#fff3c0', '#2a1a10'); num.anchor.set(0.5, 1); num.position.set(SHAFT_BOARD[0], top + SHAFT_BOARD[1] - 22); this.signsL.addChild(num); num.text = `#${i + 1}`;
    const zzz = label(13, '#ffffff', '#3a3a6a'); zzz.anchor.set(0.5, 1); c.addChild(zzz);
    return (this.shaftV[i] = { row, crate, ctext, miners, board, mgr, num, zzz, mvs: [] });
  }

  // 画面还没量出尺寸（0×0）时不要算缩放：否则 scale 会是 0、偏移 NaN，整个世界都会画不出来。
  // 拿到尺寸前的每一帧都算是“未就绪”，帧循环会一直重试 measureInsets。
  // 小镇贴着崖顶：右边缘对齐原来的村落，底边坐在地面草皮后面
  placeTown(tier) {
    const h = TOWN_H(tier), w = TOWN_WT(tier);
    this.townS.position.set(372 + TOWN_W - w, SURF - h + 4);
  }
  get ready() { return this.scale > 0 && Number.isFinite(this.ox) && Number.isFinite(this.viewH); }
  resize() {
    const w = this.app.screen.width, h = this.app.screen.height;
    this.appW = w; this.appH = h;
    if (!(w > 0) || !(h > 0)) { this.scale = 0; this.ox = 0; this.viewH = 0; return; }
    this.scale = Math.max(0.05, h > w ? Math.min(w / DESIGN_W, 1.4) : Math.min(h / 600, w / DESIGN_W, 1.8));
    this.ox = (w / this.scale - DESIGN_W) / 2;
    this.viewH = h / this.scale;
    this.uiK = Math.max(1, Math.min(1.7, 0.85 / this.scale));   // 世界缩得越小，木牌和文字越放大，保证在手机上看得清
    this.insetT = Math.max(0, this.insetTpx ?? 84) / this.scale;   // 顶部 HUD 盖住的世界高度
    this.insetB = Math.max(0, this.insetBpx ?? 0) / this.scale;    // 底部操作栏盖住的世界高度（竖屏）
  }
  maxCam(state) { const open = state.shafts.filter((s) => s.unlocked).length; return Math.max(0, SURF + Math.min(SHAFT_COUNT, open + 1) * ROW + 60 + (this.insetB ?? 0) - this.viewH); }
  scrollBy(dy, state) { this.cam.y = Math.max(-40, Math.min(this.maxCam(state) + 40, this.cam.y + dy)); this.cam.target = null; if (!this.dragging) this.cam.vy = 0; this.userScrollT = this.time; }
  scrollTo(y, state) { this.cam.target = Math.max(0, Math.min(this.maxCam(state), y)); this.cam.vy = 0; }
  focusShaft(i, state) { this.scrollTo(rowTop(i) - (this.viewH - (this.insetB ?? 0)) * 0.4, state); }
  // —— 教学引导用 ——
  sinceUserScroll() { return this.time - (this.userScrollT ?? -99); }
  // 世界 y 是否在画面里（扣掉顶部 HUD 和底部向导气泡占的地方）
  onScreen(y) { return y > this.cam.y + this.insetT && y < this.cam.y + this.viewH - this.insetB - 150 / this.scale; }
  mgrOf(what, i) { return what === 'shaft' ? this.shaftV[i]?.mgr : what === 'elev' ? this.elevMgr : this.houseMgr; }
  // 引导锚点 → 世界坐标（该点的东西的中心）；东西当前不在场时返回 null
  anchor(a) {
    const k = this.uiK;
    switch (a?.k) {
      case 'newShaft': return this.newBoard.visible ? [this.newBoard.x, this.newBoard.y] : null;
      case 'miner': return [CRATE_X + 80, rowTop(a.i) + T_BOT - 24];
      case 'basket': return [this.basket.x, this.basket.y + P.GH * 0.62];
      case 'house': return [HOUSE_DOOR - 30, SURF - 46];
      case 'board': { const b = a.what === 'shaft' ? this.shaftV[a.i]?.board : a.what === 'elev' ? this.elevBoard : this.houseBoard; return b?.visible !== false && b ? [b.x - 29 * k, b.y - 1 * k] : null; }
      case 'mgr': { const m = this.mgrOf(a.what, a.i); return m?.visible ? [m.x, m.y - 30 * k] : null; }
      case 'hire': { const m = this.mgrOf(a.what, a.i); return m?.visible ? [m.x + m.btn.x * k, m.y - 84 * k] : null; }
      case 'skill': { const m = this.mgrOf(a.what, a.i); return m?.visible ? [m.x + m.btn.x * k, m.y - 74 * k] : null; }
      default: return null;
    }
  }

  toWorld(px, py) { return { x: px / this.scale - this.ox, y: py / this.scale + this.cam.y }; }
  hitAt(px, py) { const p = this.toWorld(px, py); for (let k = this.hits.length - 1; k >= 0; k--) { const h = this.hits[k]; if (p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1) return h; } return null; }
  floatText(x, y, text, color = '#fff3a0') { const t = label(16, color); t.text = text; t.scale.set(this.uiK ?? 1); t.anchor.set(0.5, 1); t.position.set(x, y); this.fxL.addChild(t); this.floats.push({ t, life: 1.1, vy: -28 }); }
  // 触屏反馈：手指落下的地方扩散一圈白色涟漪（屏幕大小固定）；hit = 点中了可交互的东西时是金色
  tapFx(px, py, hit) {
    const p = this.toWorld(px, py), g = new Graphics(); g.position.set(p.x, p.y); this.fxL.addChild(g);
    (this.rings ??= []).push({ g, life: 0.45, col: hit ? 0xffe066 : 0xffffff });
  }
  // 升级成功：在升级牌的位置冒一圈金色光环 + 一点矿屑（设施在画面里才画）
  upgradeFx(what, i) {
    const p = this.anchor({ k: 'board', what, i });
    if (!p || !this.onScreen(p[1])) return;
    this.burst(p[0], p[1] + 8, what === 'shaft' ? 'coal' : 'gold');
    (this.rings ??= []).push({ g: (() => { const g = new Graphics(); g.position.set(p[0], p[1] + 8); this.fxL.addChild(g); return g; })(), life: 0.5, col: 0xffd050 });
    this.floatText(p[0], p[1] - 26, '+', '#ffe066');
  }
  // 镐子砸中矿脉：飞溅的矿屑 + 一闪的火花 + 一点尘土
  burst(x, y, kind) {
    const [c1, c2] = CHIP[kind] ?? CHIP.coal;
    for (let k = 0; k < 6; k++) { const a = -Math.PI * (0.15 + Math.random() * 0.75), v = 70 + Math.random() * 110; this.chips.push({ x, y, vx: Math.cos(a) * v * (Math.random() < 0.3 ? -0.6 : 1), vy: Math.sin(a) * v, life: 0.45 + Math.random() * 0.3, max: 0.75, s: 1.2 + Math.random() * 1.8, col: k % 2 ? c1 : c2, kind: 'chip' }); }
    for (let k = 0; k < 3; k++) this.chips.push({ x: x + (Math.random() - 0.5) * 8, y: y + 6, vx: (Math.random() - 0.3) * 30, vy: -10 - Math.random() * 16, life: 0.6, max: 0.6, s: 4 + Math.random() * 4, col: 0xc8b090, kind: 'dust' });
    this.chips.push({ x, y, vx: 0, vy: 0, life: 0.14, max: 0.14, s: 9, col: kind === 'diamond' ? 0xd8f8ff : 0xfff0b0, kind: 'spark' });
  }
  stepChips(dt) {
    const g = this.chipG; g.clear();
    this.chips = this.chips.filter((p) => {
      p.life -= dt; if (p.life <= 0) return false;
      const u = p.life / p.max;
      if (p.kind === 'chip') { p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.rect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s).fill({ color: p.col, alpha: Math.min(1, u * 2) }); }
      else if (p.kind === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; g.circle(p.x, p.y, p.s * (1.6 - u * 0.6)).fill({ color: p.col, alpha: 0.35 * u }); }
      else { const s = p.s * (1.3 - u * 0.3); g.poly([p.x, p.y - s, p.x + s * 0.22, p.y - s * 0.22, p.x + s, p.y, p.x + s * 0.22, p.y + s * 0.22, p.x, p.y + s, p.x - s * 0.22, p.y + s * 0.22, p.x - s, p.y, p.x - s * 0.22, p.y - s * 0.22]).fill({ color: p.col, alpha: u }); }
      return true;
    });
  }

  sync(state, dt) {
    this.time += dt; const t = this.time; this.dancers = [];
    if (!this.ready) return;   // 还没量出画布尺寸：这一帧什么都不画，等帧循环重新量过再来
    const maxY = this.maxCam(state);
    if (this.cam.target !== null) { this.cam.y += (this.cam.target - this.cam.y) * Math.min(1, dt * 6); if (Math.abs(this.cam.target - this.cam.y) < 0.5) this.cam.target = null; }
    else if (this.cam.vy) { this.cam.y += this.cam.vy * dt; this.cam.vy *= Math.pow(0.04, dt); if (Math.abs(this.cam.vy) < 5) this.cam.vy = 0; }
    if (!this.dragging) { if (this.cam.y < 0) this.cam.y += (0 - this.cam.y) * Math.min(1, dt * 10); if (this.cam.y > maxY) this.cam.y += (maxY - this.cam.y) * Math.min(1, dt * 10); }
    this.world.scale.set(this.scale); this.world.position.set(this.ox * this.scale, -this.cam.y * this.scale);
    const vy0 = this.cam.y - 40, vy1 = this.cam.y + this.viewH + 40;
    this.hits = [];

    for (let li = 0; li < LAYERS.length; li++) {
      const y0 = SURF + li * LAYER_H, near = y0 < vy1 + 300 && y0 + LAYER_H > vy0 - 300;
      if (near && !this.layerS[li]) { const sp = new Sprite(tex(layerBackdrop(li))); sp.position.set(VOID_X0, y0); sp.scale.set(1 / LBG); this.bgL.addChildAt(sp, 1); this.layerS[li] = sp; }
      if (this.layerS[li]) this.layerS[li].visible = near;
    }
    const g = this.moteG; g.clear();
    for (const m of this.motes) {
      const y = this.cam.y + ((m.y * this.viewH + t * (8 + m.s * 14) * (m.k % 2 ? -1 : 1)) % this.viewH + this.viewH) % this.viewH;
      const li = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((y - SURF) / LAYER_H))), col = parseInt((y < SURF ? '#ffffff' : LAYERS[li].mote).slice(1), 16);
      g.circle(m.x + Math.sin(t * 0.6 + m.k) * 10, y, 1.2 + m.s * 2).fill({ color: col, alpha: 0.35 + 0.35 * Math.sin(t * 2 + m.k) ** 2 });
    }

    // 矿道
    const next = W.nextLockedShaft(state), barrier = W.barrierAhead(state);
    for (let i = 0; i < SHAFT_COUNT; i++) {
      const s = state.shafts[i], top = rowTop(i), blocked = !!s.blocked;
      if (top + ROW < vy0 || top > vy1) { if (this.shaftV[i]) this.setShaftVisible(i, false); continue; }
      const V = this.shaftView(i), L = layerOf(i), li = Math.floor(i / SHAFTS_PER_LAYER), kind = oreKind(L.ore);
      this.setShaftVisible(i, true);
      V.row.texture = tex(rowTexture(li, i, s.unlocked ? false : i > 0 && state.shafts[i - 1].unlocked ? 'first' : true));
      const open = s.unlocked;
      V.crate.visible = V.ctext.visible = V.board.visible = V.mgr.visible = V.num.visible = open;
      V.zzz.visible = false;
      if (!open && i !== next.i) continue;   // 锁住的矿道整行不用逐帧摆位（岩壁贴图已经画好了）
      if (!open) { V.miners.removeChildren(); V.mvs = []; continue; }
      const st = W.shaftStatsOf(state, s);
      const fill = s.crate <= 0 ? 0 : s.crate < st.cap * 0.6 ? 1 : s.crate < st.cap * 2 ? 2 : s.crate < st.cap * 5 ? 3 : 4;
      V.crate.texture = tex(P.crate(L.ore, fill)); V.ctext.scale.set(this.uiK); V.num.scale.set(this.uiK);
      const ct = s.crate > 0 ? fmt(s.crate) : ''; if (V.ctext.text !== ct) V.ctext.text = ct;
      const K = minerSet(i), boost = s.boostT > 0 ? 2 : 1;
      while (V.mvs.length < s.miners.length) { const sp = new Sprite(); sp.lastF = -1; V.miners.addChild(sp); V.mvs.push(sp); }
      let anySleep = false;
      s.miners.forEach((m, k) => {
        const sp = V.mvs[k], x0 = CRATE_X + 4 + k * 5, x1 = MINE_X - 12 - k * 9, y = top + T_BOT - 2 - (k % 2) * 3, half = st.walk;
        let x = x0, a = K.walk, fr = a.frames[0], flip = 1, sc = a.scale, sx = 1, sy = 1, rot = 0, dy = 0;
        const a0 = m.ph === 'sleep';
        const step = (spd, off) => Math.floor(t * a.fps * spd + off) % a.frames.length;
        if (a0) {
          // 睡着：坐在管理员位右侧（下面的分支处理）
        } else if (blocked) {
          // 被魔物占据（下面的分支处理）
        } else if (m.ph === 'out') {
          const u = Math.max(0, Math.min(1, m.t / half)); x = x0 + (x1 - x0) * u;
          const f = step(WALK_SPEED * boost, k * 3); fr = a.frames[f]; rot = 0.07; dy = -Math.abs(Math.sin(t * 9 * boost + k)) * 2.2;
        } else if (m.ph === 'mine') {
          x = x1; a = K.mine; sc = a.scale;
          const f = step(MINE_SPEED * boost, k * 5), imp = a.impact ?? 6; fr = a.frames[f];
          if (f >= imp - 3 && f < imp) { sy = 1.06; sx = 0.95; }               // 抡起：拉长
          else if (f === imp || f === imp + 1) { sy = 0.9; sx = 1.1; }          // 砸下：压扁
          if (f === imp && sp.lastF !== imp) this.burst(x + 30, y - 22 - (k % 2) * 4, kind);
          sp.lastF = f;
        } else if (m.ph === 'back') {
          const u = Math.max(0, Math.min(1, m.t / half)); x = x1 + (x0 - x1) * u; a = K.carry; sc = a.scale; flip = -1;
          const f = step(WALK_SPEED * boost, k * 3); fr = a.frames[f]; rot = -0.1; dy = -Math.abs(Math.sin(t * 8 * boost + k)) * 3; sy = 1 - Math.abs(Math.sin(t * 8 * boost + k)) * 0.04;
        } else if (m.ph === 'drop') { x = x0; a = K.carry; sc = a.scale; fr = a.frames[0]; flip = -1; sy = 0.94; sx = 1.05; }
        if (a0) { a = null; fr = K.sleep.tex; sc = K.sleep.scale; sy = 1 + 0.03 * Math.sin(t * 2.2 + k); anySleep = true; x = x0 + 72 + k * 20; }
        // 被魔物占据（s.blocked）：矿工退到矿箱边缩着发抖（告诉玩家“这里停工了”）
        else if (blocked) { a = K.walk; fr = a.frames[0]; sc = a.scale; flip = -1; x = x0 - 8 + k * 14; sy = 0.93 + Math.sin(t * 14 + k * 2) * 0.02; sx = 1 - Math.sin(t * 14 + k * 2) * 0.015; }
        if (sp.texture !== fr) sp.texture = fr;
        ANCH(sp, a?.anchor); sp.position.set(x, y + dy); sp.scale.set(flip * sc * sx, sc * sy); sp.rotation = rot;
      });
      if (anySleep) { V.zzz.visible = true; V.zzz.text = 'z'.repeat(1 + Math.floor(t * 2) % 3).toUpperCase(); V.zzz.position.set(CRATE_X + 88, top + T_BOT - 34 - Math.sin(t * 3) * 3); }
      this.hits.push({ kind: 'shaft', i, x0: MGR_X + 16, x1: MINE_X + 40, y0: top + 44, y1: top + T_BOT + 10 });
      this.hits.push({ kind: 'shaft', i, x0: CRATE_X - 50, x1: MGR_X - 22, y0: top + 44, y1: top + T_BOT + 10 });
      this.syncBoard(V.board, this.lvText('shaft', s.level), this.canUp(state, 'shaft', i, s.level), { kind: 'level', what: 'shaft', i });
      V.num.x = V.board.x; V.num.y = V.board.y - 20 * this.uiK;
      this.syncMgr(V.mgr, s, state, { what: 'shaft', i }, mgrFace('shaft', i));
    }
    this.stepChips(dt);
    // 新矿道 / 岩障木牌
    if (next) {
      const top = rowTop(next.i), isBar = barrier !== null, c = isBar ? E.BARRIERS[barrier] : E.SHAFTS[next.i].buy, can = state.cash >= c;
      this.newBoard.visible = true; this.newBoard.position.set(420, top + 78); this.newBoard.alpha = can ? 1 : 0.85;
      const nt = `${tr(isBar ? 'board.barrier' : 'board.newShaft')}\n$${fmt(c)}`; if (this.newText.text !== nt) this.newText.text = nt;
      this.newBoard.scale.set(this.uiK * (can ? 1 + Math.sin(t * 5) * 0.03 : 1) * this.touchK({ kind: isBar ? 'barrier' : 'newShaft' }));
      this.rubble.visible = isBar; if (isBar) this.rubble.y = top;
      this.hits.push({ kind: isBar ? 'barrier' : 'newShaft', x0: 420 - 95 * this.uiK, x1: 420 + 95 * this.uiK, y0: top + 78 - 30 * this.uiK, y1: top + 78 + 30 * this.uiK });
    } else { this.newBoard.visible = false; this.rubble.visible = false; }

    // 缆车吊斗 + 绳：矿堆按装载量一层层堆高，从斗沿上冒出来
    const el = state.elev, by = basketTop(el.y), es = W.elevStatsOf(state);
    const bL = layerOf(Math.max(0, Math.round(el.y) - 1)), r = el.load / Math.max(1e-9, es.load);
    const bfill = el.load <= 0 ? 0 : Math.min(6, 1 + Math.floor(r * 6));
    const moving = el.ph === 'down' || el.ph === 'up', sway = moving ? Math.sin(t * 3.2) * 0.025 : 0;
    this.basket.texture = tex(P.basket(bL.ore, bfill, P.tierOf(el.level))); this.basket.position.set(BASKET_X, by); this.basket.rotation = sway;
    const eIdle = el.ph === 'idle' && !el.mgr;
    { const oa = operatorArt(eIdle); this.op.position.set(BASKET_X - 26 + sway * 60, by + 74 + (moving ? 0 : Math.sin(t * 2.4) * 0.8)); if (this.op.texture !== oa.tex) this.op.texture = oa.tex; this.op.scale.set(oa.scale); this.op.rotation = sway; }
    const btxt = el.load > 0 ? fmt(el.load) : ''; if (this.basketText.text !== btxt) this.basketText.text = btxt; this.basketText.position.set(BASKET_X + sway * 60, by + P.GH * 0.78);
    this.ropeG.clear().moveTo(BASKET_X, PULLEY_Y).lineTo(BASKET_X, by + 2).stroke({ width: 2.4, color: 0x3a2a1a });
    this.hits.push({ kind: 'elev', x0: BASKET_X - P.GW / 2 - 4, x1: BASKET_X + P.GW / 2 + 4, y0: by - 6, y1: by + P.GH + 4 });
    this.zzzE.visible = eIdle; if (eIdle) { this.zzzE.text = 'z'.repeat(1 + Math.floor(t * 2) % 3).toUpperCase(); this.zzzE.position.set(BASKET_X - 6, by + 22 - Math.sin(t * 3) * 3); this.zzzE.scale.set(this.uiK); }
    const tl = el.top <= 0 ? 0 : el.top < 0.5 * es.load ? 1 : el.top < 1 * es.load ? 2 : el.top < 2 * es.load ? 3 : el.top < 4 * es.load ? 4 : 5;
    this.pile.texture = tex(P.topPile(LAYERS[0].ore, tl));
    this.pileText.scale.set(this.uiK); this.basketText.scale.set(this.uiK); this.houseText.scale.set(this.uiK);
    // 造型档次：仓库跟仓库等级、绞盘站跟电梯等级，换了档次才重建贴图
    const th = P.tierOf(state.house.level), ts = P.tierOf(el.level);
    if (this.tiers.h !== th) { this.tiers.h = th; this.house.texture = tex(P.warehouse(state.house.level)); this.house.position.set(HOUSE_X, SURF - 4 - P.HOUSE_H()); }
    if (this.tiers.s !== ts) { this.tiers.s = ts; this.pierS.texture = tex(P.pier(BASKET_X, GAP_L, GAP_R, el.level)); }
    // 崖顶小镇只跟厂房（仓库）的档次走，和升降机无关（用户要求）
    const tt = th;
    if (this.tiers.town !== tt) { this.tiers.town = tt; this.townS.texture = tex(town(tt)); this.placeTown(tt); }
    const ptx = el.top > 0 ? fmt(el.top) : ''; if (this.pileText.text !== ptx) this.pileText.text = ptx;
    this.syncBoard(this.elevBoard, this.lvText('elev', el.level), this.canUp(state, 'elev', 0, el.level), { kind: 'level', what: 'elev', i: 0 });
    this.syncMgr(this.elevMgr, el, state, { what: 'elev', i: 0 }, mgrFace('elev'));

    // 推车员
    const H = state.house, hs = W.houseStatsOf(state), hb = H.boostT > 0 ? 2 : 1;
    const CA = carterArt();
    while (this.carters.length < H.workers.length) {
      const ct = new Container(); const cart = new Sprite(); cart.anchor.set(0.5, 1); cart.scale.set(1 / RES);
      const man = new Sprite(); ct.addChild(man, cart);
      const at = P.wheelAt(), wl = [];
      for (const q of at) { const sp = new Sprite(tex(P.wheel())); sp.anchor.set(0.5); sp.scale.set(1 / RES); sp.position.set(q.x - 25, q.y); ct.addChild(sp); wl.push(sp); }
      const sh = new Graphics(); sh.poly([0, 0, 15, -3, 15, 1, 0, 4]).fill({ color: 0x8a6238 }).stroke({ width: 1.2, color: 0x3a2412 });   // 打盹时插在车斗里的锹柄
      sh.position.set(12, -30); sh.visible = false; ct.addChild(sh); ct.shovel = sh;
      ct.cart = cart; ct.man = man; ct.wheels = wl; this.actorsL.addChild(ct); this.carters.push(ct);
    }
    let hIdle = false, cx = HOUSE_DOOR, cdir = -1;
    H.workers.forEach((w, k) => {
      const ct = this.carters[k], xa = HOUSE_DOOR - 20 - k * 14, xb = STATION_X + 40 + k * 10, half = hs.leg;
      let x = xa, dir = -1, mv = false;
      if (w.ph === 'go') { const u = Math.max(0, Math.min(1, w.t / half)); x = xa + (xb - xa) * u; mv = true; }
      else if (w.ph === 'load') { x = xb; }
      else if (w.ph === 'sell') { x = xa; dir = 1; }
      else if (w.ph === 'return') { const u = Math.max(0, Math.min(1, w.t / half)); x = xb + (xa - xb) * u; dir = 1; mv = true; }
      else if (w.ph === 'sleep') hIdle = !H.mgr;
      const fill = w.load <= 0 ? 0 : w.load < hs.load * 0.5 ? 1 : w.load < hs.load * 0.95 ? 2 : 3;
      ct.cart.texture = tex(P.cart(LAYERS[0].ore, fill));
      // 推车员的分阶段动作：走 = 大步推车循环，装车 = 铲矿，卸货 = 单臂欢呼，没活 = 靠车打盹
      const napping = w.ph === 'sleep' && !H.mgr, man = ct.man;
      let roll = 0, jolt = 0;
      if (napping) { man.texture = CA.sleep.tex; man.anchor.set(0.5, 1); man.scale.set(CA.sleep.scale, CA.sleep.scale * (1 + 0.03 * Math.sin(t * 2.2))); man.x = -16; man.rotation = 0; }
      else if (w.ph === 'load') {
        const a = CA.scoop, u = Math.min(0.999, w.t * a.fps / a.frames.length % 1);   // 跟着装车进度一遍遍铲
        man.texture = a.frames[Math.floor((w.t * a.fps * 1.5) % a.frames.length)]; ANCH(man, a.anchor); man.scale.set(a.scale); man.x = -30; man.rotation = 0;
      } else if (w.ph === 'sell') {
        const a = CA.dump; man.texture = a.frames[Math.min(a.frames.length - 1, Math.floor(w.t * a.fps * 1.6))]; ANCH(man, a.anchor); man.scale.set(a.scale); man.x = -22; man.rotation = 0; roll = w.t * 40;
      } else {
        const a = CA.walk; man.texture = mv ? frameAt(a, t, WALK_SPEED * hb, k * 4) : a.frames[0]; ANCH(man, a.anchor); man.scale.set(a.scale); man.x = -22; man.rotation = mv ? 0.05 : 0;
        if (mv) { roll = t * 7 * hb; jolt = Math.abs(Math.sin(t * 5.5 * hb)) * 1.4; }
      }
      ct.position.set(x, SURF - 8 - k * 2 - jolt); ct.scale.x = dir; ct.cart.x = 20; man.y = 0;
      // 车轮转起来（滚动的角度按位移算）
      for (const sp of ct.wheels) sp.rotation = roll * dir;
      ct.shovel.visible = napping;
      ct.cart.rotation = mv ? Math.sin(t * 5.5 * hb) * 0.012 : 0;   // 车斗随步幅轻晃
      for (const sp of ct.wheels) sp.visible = !napping;
      if (k === 0) { cx = x; cdir = dir; }
      const ht = w.load > 0 ? fmt(w.load) : ''; if (k === 0) { if (this.houseText.text !== ht) this.houseText.text = ht; this.houseText.position.set(x + dir * 20, SURF - 46); }
    });
    this.zzzH.visible = hIdle; if (hIdle) { this.zzzH.text = 'z'.repeat(1 + Math.floor(t * 2) % 3).toUpperCase(); this.zzzH.position.set(cx - 4, SURF - 52 - Math.sin(t * 3) * 3); this.zzzH.scale.set(this.uiK); }
    this.hits.push({ kind: 'house', x0: HOUSE_X - 10, x1: HOUSE_MGR[0] - 26, y0: SURF - 4 - P.HOUSE_H(), y1: SURF + 4 });
    this.hits.push({ kind: 'house', x0: cx - (cdir < 0 ? 60 : 30), x1: cx + (cdir < 0 ? 30 : 60), y0: SURF - 64, y1: SURF + 4 });
    this.syncBoard(this.houseBoard, this.lvText('house', H.level), this.canUp(state, 'house', 0, H.level), { kind: 'level', what: 'house', i: 0 });
    this.syncMgr(this.houseMgr, H, state, { what: 'house', i: 0 }, mgrFace('house'));

    // 飘字
    this.floats = this.floats.filter((f) => { f.life -= dt; f.t.y += f.vy * dt; f.t.alpha = Math.min(1, f.life * 2); if (f.life <= 0) { f.t.destroy(); return false; } return true; });
    this.drawGuide(t);   // 教学小手 / 画面外提示条
    this.musicNotes(dt);
    if (this.rings?.length) this.rings = this.rings.filter((r) => {
      r.life -= dt; if (r.life <= 0) { r.g.destroy(); return false; }
      const u = 1 - r.life / 0.45, k = 1 / this.scale, big = r.col === 0xffe066 ? 1.5 : 1;
      // 点中可交互的东西：金色双圈 + 中心一点闪光；点空处：白色单圈
      r.g.clear().circle(0, 0, (12 + 34 * u) * big * k).stroke({ width: (6 * (1 - u) + 1) * k, color: r.col, alpha: (1 - u) });
      if (big > 1) {
        r.g.circle(0, 0, (6 + 20 * u) * k).stroke({ width: (3 * (1 - u) + 0.6) * k, color: 0xffffff, alpha: 0.9 * (1 - u) });
        if (u < 0.35) r.g.circle(0, 0, (14 - 30 * u) * k).fill({ color: 0xfff6c0, alpha: 0.75 * (1 - u / 0.35) });
      }
      return true;
    });
  }
  setShaftVisible(i, on) { const V = this.shaftV[i]; if (!V) return; V.row.visible = on; V.miners.visible = on; if (!on) V.crate.visible = V.ctext.visible = V.zzz.visible = V.board.visible = V.mgr.visible = V.num.visible = false; }
  // 升级牌：文字 / 可升级状态 / 放大倍数；位置保持在可见区域内（窄屏上不会被屏幕边裁掉）
  // 升级牌文字：满级时写 MAX；能不能升（钱够且没满级）
  lvText(kind, L) { return L >= E.MAX_LEVEL[kind] ? 'MAX' : `Lv ${L}`; }
  canUp(state, kind, i, L) { return L < E.MAX_LEVEL[kind] && state.cash >= E.upCost(kind, i, L); }
  // 当前装备的皮肤（存档里 skins: { <管理员 key>: <皮肤 id> }）
  skinOf(mi) { const sk = this.skins, k = MANAGERS_KEY(mi); return (sk && sk[k]) || null; }
  syncBoard(b, text, can, hit) {
    if (b.t.text !== text) b.t.text = text;
    this.drawBoard(b, can);
    const k = this.uiK, w = 46 * k, h = 18 * k;
    b.x = this.clampX(b.home[0], w + 4);
    b.scale.set(k * (can ? 1 + Math.sin(this.time * 5 + b.home[0]) * 0.035 : 1) * this.touchK(hit));
    this.hits.push({ ...hit, x0: b.x - w - 6, x1: b.x + w + 6, y0: b.y - h - 8, y1: b.y + h + 6 });
  }
  // —— 世界里可点的东西（升级牌 / 管理员 / 技能按钮）的按压反馈 ——
  // 按住：缩到 0.9；松手触发：0.3 秒弹一下（超过原大小再回来）
  hitKey(h) { return h ? `${h.kind}|${h.what ?? ''}|${h.i ?? ''}` : ''; }
  pressAt(h) { this.pressed = h && (h.kind === 'level' || h.kind === 'mgr' || h.kind === 'skill' || h.kind === 'newShaft' || h.kind === 'barrier') ? this.hitKey(h) : null; }
  popAt(h) { if (h) (this.pops ??= new Map()).set(this.hitKey(h), this.time); }
  touchK(hit) {
    const key = this.hitKey(hit);
    let f = this.pressed === key ? 0.82 : 1;   // 按住：明显缩下去
    const t0 = this.pops?.get(key);
    // 松手：弹到约 1.3 倍再来回晃两下落定（0.42 秒）
    if (t0 != null) { const u = (this.time - t0) / 0.42; if (u >= 1) this.pops.delete(key); else f *= 1 + 0.32 * Math.sin(u * Math.PI * 2.2) * Math.exp(-u * 3.2); }
    return f;
  }
  // 把一个半宽为 hw 的东西收进当前可见的世界横向范围
  clampX(x, hw) { const lo = -this.ox + 6 + hw, hi = DESIGN_W + this.ox - 6 - hw; return lo > hi ? x : Math.max(lo, Math.min(hi, x)); }
  // 管理员的动作全部卡在配乐节拍上（b = 当前第几拍，整数 = 底鼓）：
  // 待机动画 2 拍走一遍；招牌动作只在小节第一拍起跳、正好做满一小节（4 拍）；刚雇佣 / 培训时从下一拍起欢呼 2 拍；
  // 技能生效期间欢呼跳跃每 2 拍一遍。返回 [动画, 帧, 模式]。
  mgrPose(m, o, mi, b, skin = null) {
    const art = managerArt(mi, skin), bi = Math.floor(b), bar = Math.floor(b / 4);
    const at = (a, u) => a.frames[Math.max(0, Math.min(a.frames.length - 1, Math.floor(u * a.frames.length)))];
    if (m.b0 != null && (b < m.b0 - 8 || (m.nextBar != null && m.nextBar > bar + 12))) { m.mode = 'idle'; m.b0 = null; m.nextBar = null; }   // 切歌时节拍时钟回到曲首
    if (m.lastMgr !== null && o.mgr > m.lastMgr) { m.mode = 'cheer'; m.b0 = Math.ceil(b); }
    m.lastMgr = o.mgr;
    if (o.boostT > 0) return [art.cheer, at(art.cheer, (((b % 2) + 2) % 2) / 2), 'boost'];
    if (m.mode === 'cheer' || m.mode === 'gesture') {
      const a = m.mode === 'gesture' ? art.gesture : art.cheer, u = (b - m.b0) / (m.mode === 'gesture' ? 4 : 2);
      if (u >= 0 && u < 1) return [a, at(a, u), m.mode];
      if (u >= 1) { m.mode = 'idle'; m.nextBar = bar + 2 + ((mi * 7 + bar) % 3); }
    }
    if (m.nextBar == null) m.nextBar = bar + 1 + (mi % 3);
    if (m.mode === 'idle' && bar >= m.nextBar && bi % 4 === 0 && b - bi < 0.25) { m.mode = 'gesture'; m.b0 = bi; return [art.gesture, art.gesture.frames[0], 'gesture']; }
    const a = art.idle; return [a, at(a, (((b + mi * 0.5) % 2) + 2) % 2 / 2), 'idle'];
  }
  // 管理员位：没雇时是白色人影 + “雇佣 $价”；雇了是管理员 + 头顶技能按钮（可用 / 生效倒计时 / 冷却倒计时）+ 可培训时的绿箭头
  syncMgr(m, o, state, hit, mi) {
    const k = this.uiK; m.visible = true; m.scale.set(k * this.touchK({ kind: 'mgr', what: hit.what, i: hit.i }));
    const { what, i } = hit, b = m.btn;
    const face = what === 'shaft' ? 1 : -1, tt = this.time;
    // 标签和按钮不出屏：窄屏上把它们往里挪
    const lw = (o.mgr ? 16 : 40) * k, sx = (this.clampX(m.x, lw) - m.x) / k; b.x = sx; m.t.x = sx;
    m.aura.visible = false; m.d.rotation = 0; m.d.y = 0;
    if (o.mgr) {
      const bt = this.beat ?? tt * 128 / 60, [a, fr, mode] = this.mgrPose(m, o, mi, bt, this.skinOf(mi));
      if (m.d.texture !== fr) m.d.texture = fr; m.d.alpha = 1; ANCH(m.d, a.anchor);
      // 踩点（動次打次）：底鼓落下时蹲一下（压扁），反拍弹起；第 2、4 拍（拍手）蹲得更狠；身体每拍左右摇摆一次 + 落拍时点头
      const G = GROOVE[mi % GROOVE.length], bi = Math.floor(bt), ph = bt - bi, kick = Math.exp(-ph * 9), lift = Math.sin(Math.PI * ph) ** 2;
      const clap = bi % 2 ? 1.35 : 1, amp = mode === 'gesture' ? 0.45 : mode === 'idle' ? 1 : 1.7, s = a.scale;
      m.d.y = -G.hop * lift * amp;
      m.d.scale.set(s * face * (1 + G.sq * 0.8 * kick * clap * amp), s * (1 - G.sq * kick * clap * amp + 0.03 * lift * amp));
      m.d.rotation = (G.sway * Math.sin(Math.PI * bt) + G.nod * kick * clap) * Math.min(1.3, amp) * face;
      if (mode === 'idle' || mode === 'boost') this.dancers.push(m);
      if (o.boostT > 0) { m.aura.visible = true; m.aura.alpha = 0.5 + 0.5 * kick; m.aura.scale.set(1 + 0.18 * kick); }
      const ready = o.boostT <= 0 && o.cdT <= 0, col = o.boostT > 0 ? 0xffd040 : ready ? 0xffc22a : 0x9aa0a8;
      const txt = o.boostT > 0 ? fmtClock(o.boostT) : o.cdT > 0 ? fmtClock(o.cdT) : '';
      // 技能按钮（圆形图标 + 倒计时）状态没变就不重画：重画 Graphics 是每帧的大头，手机上直接变成手感延迟
      const bkey = (ready ? 'r' : o.boostT > 0 ? 'b' : 'c') + '|' + txt;
      if (m.bkey !== bkey) {
        m.bkey = bkey;
        b.clear();
        b.roundRect(-13, -13, 26, 26, 6).fill({ color: col }).stroke({ width: 2.5, color: 0x5a3a10 });
        b.poly([2, -10, -6, 2, -1, 2, -3, 10, 6, -3, 1, -3, 4, -10]).fill({ color: ready || o.boostT > 0 ? 0xffffff : 0xe8e8e8 }).stroke({ width: 1.2, color: 0x5a3a10 });
      }
      const sk = this.touchK({ kind: 'skill', what: hit.what, i: hit.i });
      if (ready) b.scale.set(sk * (1 + 0.1 * Math.exp(-((((this.beat ?? 0) % 1) + 1) % 1) * 7))); else b.scale.set(sk);   // 技能按钮跟着鼓点跳 + 按压反馈
      if (m.t.text !== txt) m.t.text = txt;
      const ti = W.trainInfo(state, what, i); m.up.visible = !!(ti && ti.ready);
      const bx = m.x + sx * k;
      this.hits.push({ kind: 'mgr', what, i, x0: m.x - 22 * k, x1: m.x + 22 * k, y0: m.y - 58 * k, y1: m.y + 2 });
      this.hits.push({ kind: 'skill', what, i, x0: bx - 17 * k, x1: bx + 17 * k, y0: m.y - 91 * k, y1: m.y - 58 * k });
    } else {
      b.scale.set(1); m.bkey = null;
      const g = ghostArt(); m.d.texture = g.tex; m.d.anchor.set(0.5, 1); m.d.scale.set(g.scale * face, g.scale); m.d.alpha = 0.7 + 0.25 * Math.sin(tt * 2.4 + (hit.i ?? 0)); m.up.visible = false;   // 空位人影轻轻闪，提示可以雇人
      const c = E.managerCost(what, i), can = state.cash >= c, txt = tr('board.hire', { c: '$' + fmt(c) }); if (m.t.text !== txt) m.t.text = txt;
      const hw = Math.max(34, m.t.width / 2 + 8);
      b.clear();
      b.roundRect(-hw, -21, hw * 2, 22, 11).fill({ color: can ? 0x2f8a3a : 0x5a5868, alpha: 0.95 }).stroke({ width: 2, color: can ? 0xf2c95c : 0xd8d4cc });
      m.t.position.set(sx, -76);
      const bx = m.x + sx * k;
      this.hits.push({ kind: 'mgr', what, i, x0: bx - hw * k, x1: bx + hw * k, y0: m.y - 96 * k, y1: m.y - 56 * k });   // “雇佣 $价”标签和头
      this.hits.push({ kind: 'mgr', what, i, x0: m.x - 15 * k, x1: m.x + 15 * k, y0: m.y - 56 * k, y1: m.y + 2 });   // 身体（窄一点，旁边的矿工好点）
      return;
    }
    m.t.position.set(sx, -90);
  }
  // 跳舞的管理员头上冒音符：每小节第一拍轮流从一位画面里的管理员头上飘出一个 ♪，技能生效时每拍都冒
  musicNotes(dt) {
    const b = this.beat ?? this.time * 128 / 60, bi = Math.floor(b);
    this.notes ??= []; this.noteK ??= 0;
    if (this.lastBeat !== bi) {
      const prev = this.lastBeat; this.lastBeat = bi;
      const vis = this.dancers.filter((m) => this.onScreen(m.y - 40));
      if (prev != null && vis.length && this.notes.length < 10) {
        const hype = vis.filter((m) => m.aura.visible), pick = hype.length ? hype : bi % 4 === 0 ? vis : [];
        for (const m of pick.slice(0, 3)) {
          const k = this.uiK, n = label(15, NOTE_COL[this.noteK % NOTE_COL.length], '#2a1a3a'); n.text = this.noteK % 3 === 2 ? '♫' : '♪'; this.noteK++;
          n.anchor.set(0.5); n.scale.set(k); n.position.set(m.x + (8 + Math.random() * 10) * k * (this.noteK % 2 ? 1 : -1), m.y - 66 * k); this.fxL.addChild(n);
          this.notes.push({ n, x0: n.x, life: 1.3, ph: Math.random() * 6 });
        }
      }
    }
    this.notes = this.notes.filter((o) => {
      o.life -= dt; if (o.life <= 0) { o.n.destroy(); return false; }
      const u = 1 - o.life / 1.3; o.n.y -= dt * 26; o.n.x = o.x0 + Math.sin(u * 5 + o.ph) * 5; o.n.alpha = u < 0.15 ? u / 0.15 : Math.min(1, o.life / 0.5);
      return true;
    });
  }
  // —— 教学小手 ——
  // 目标在画面里：脚下一圈柔光 + 每次“点下去”时扩散的涟漪 + 一只戴白手套的手指有节奏地点按；
  // 目标在画面外：屏幕上 / 下边缘出现带箭头的「这边」提示条（可点，镜头滑过去）。手和提示条的屏幕大小固定。
  buildGuideFx() {
    const glow = new Graphics(), ripple = new Graphics(), hand = new Graphics();
    const S = [[-5, -1, 10, 27, 5], [4, 13, 9, 15, 4.5], [11, 16, 8, 14, 4], [-9, 18, 27, 25, 10], [-15, 24, 12, 8, 4], [-7, 41, 23, 9, 3]];
    for (const [x, y, w, h, r] of S) hand.roundRect(x - 2.6, y - 2.6, w + 5.2, h + 5.2, r + 2.6).fill({ color: 0x18224a });
    for (const [x, y, w, h, r] of S.slice(0, 5)) hand.roundRect(x, y, w, h, r).fill({ color: 0xffffff });
    hand.roundRect(-7, 41, 23, 9, 3).fill({ color: 0xd2463a });
    hand.roundRect(-3, 1.5, 4, 9, 2).fill({ color: 0xffffff }); hand.roundRect(-3.2, 2, 2.4, 7, 1.2).fill({ color: 0xdfe6f2 });
    hand.rotation = -0.55;
    const edge = new Container(), eg = new Graphics(), et = label(15, '#ffffff', '#5a3a10');
    et.anchor.set(0, 0.5); edge.addChild(eg, et); edge.g = eg; edge.t = et;
    this.fxL.addChild(glow, ripple, hand, edge);
    this.gfx = { glow, ripple, hand, edge };
  }
  drawGuide(t) {
    if (!this.gfx) this.buildGuideFx();
    const G = this.gfx, tg = this.guideTarget;
    G.glow.visible = G.ripple.visible = G.hand.visible = G.edge.visible = false;
    if (!tg) return;
    const [x, y] = tg, ks = 1 / this.scale * Math.max(0.9, Math.min(1.15, this.scale));
    if (this.onScreen(y)) {
      const P = 1.25, ph = (t % P) / P, d = 0.5 + 0.5 * Math.cos(ph * Math.PI * 2);   // d：1 = 抬起，0 = 按下
      G.glow.visible = G.ripple.visible = G.hand.visible = true;
      G.glow.clear().circle(x, y, 24 * ks).fill({ color: 0xffe066, alpha: 0.2 + 0.08 * Math.sin(t * 4) }).stroke({ width: 2.5 * ks, color: 0xffe066, alpha: 0.75 });
      G.ripple.clear();
      if (ph > 0.5) { const r = (ph - 0.5) / 0.5; G.ripple.circle(x, y, (16 + 30 * r) * ks).stroke({ width: 3 * ks * (1 - r) + 0.5, color: 0xffffff, alpha: 0.85 * (1 - r) }); }
      G.hand.position.set(x + (8 + 12 * d) * ks, y + (9 + 13 * d) * ks); G.hand.scale.set(ks * (1 - 0.07 * (1 - d)));
      return;
    }
    // 画面外：边缘提示条
    const up = y < this.cam.y + this.insetT, E = G.edge, k = 1 / this.scale;
    const lt = tr('guide.here'); if (E.t.text !== lt) E.t.text = lt;
    const w = E.t.width + 52, h = 38;
    E.g.clear().roundRect(-w / 2, -h / 2, w, h, 19).fill({ color: 0xf2c95c }).stroke({ width: 3, color: 0x5a3a10 });
    const ax = -w / 2 + 20; E.g.poly(up ? [ax, -9, ax - 9, 3, ax + 9, 3] : [ax, 9, ax - 9, -3, ax + 9, -3]).fill({ color: 0x5a3a10 });
    E.t.position.set(-w / 2 + 34, 0);
    const bob = Math.sin(t * 5) * 4 * (up ? -1 : 1);
    const ey = up ? this.cam.y + this.insetT + (16 + bob) * k : this.cam.y + this.viewH - this.insetB - (170 - bob) * k;
    const ex = this.clampX(x, (w / 2 + 6) * k);
    E.visible = true; E.scale.set(k); E.position.set(ex, ey);
    this.hits.push({ kind: 'guideGo', ty: y, x0: ex - (w / 2 + 8) * k, x1: ex + (w / 2 + 8) * k, y0: ey - (h / 2 + 10) * k, y1: ey + (h / 2 + 10) * k });
  }
}
