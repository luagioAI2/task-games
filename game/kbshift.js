// コンビニ接客シフト — a hands-on mini-game drawn entirely on the Pixi canvas.
// One customer at a time walks up to the register: scan their items (tap), answer 温め / 袋 to match
// their bubble, then hand back the right change (or take a card). Fast & correct = tip + combo,
// slow or wrong = they storm out. Difficulty ramps through the shift with a rush at the end.
// Takings go to cash only (never the ranked cumulative rent). The store's level, stock and price
// policy from the management sheet shape the shift.
import * as PIXI from "pixi.js";
import { fontStack, getLang, t } from "../i18n.js";
import { KB_MARKUP, kbSellPrice, kbUnit,                   } from "./konbini.js";

export const SHIFT_SEC = 75;
const RUSH_SEC = 15;
/** a sold item earns this many idle-sale prices — playing beats leaving the store alone */
const PLAY_MULT = 5;
/** item art index → shop-floor yen (register display; multiples of 10 so change is makeable) */
const ITEM_YEN = [130, 480, 150, 280, 120, 160, 190, 220];
/** unlock order by store level: Lv1 has 4 kinds, every level adds one */
const ITEM_ORDER = [0, 2, 5, 4, 3, 1, 7, 6];
const HEATABLE = new Set([0, 1]);
/** patience multiplier by price policy (cheap → relaxed customers, premium → impatient) */
const PRICE_PATIENCE = [1.25, 1.0, 0.8];
const MONEY = [1000, 500, 100, 50, 10];

const INK = 0x22303d, CREAM = 0xfbf3dc, PAPER = 0xfffaf0, CORAL = 0xef8354, CORAL_D = 0xc9623a;
const SAND = 0xf1db9e, LEAF = 0x729b60, GOLD = 0xf2b33d, DANGER = 0xe8604c, SKY = 0x357ca5, SLATE = 0x344657, MUTED = 0x6b7785;

                             
                                      
                     
                                                                
                                               
                        
                          
               
                        
                                    
                                                             
                                                                
                         
                 
                    
 

                                                                                                

                    
              
               
                  
                           
                          
                
               
                
                   
                      
                
                                           
                
 

                                                                                                                                                                              

                                                                                                              

const ease = (x        ) => 1 - Math.pow(1 - x, 3);

export class KonbiniShift {
           root = new PIXI.Container();
  active = false;
          bg             ;
          bgDim = new PIXI.Graphics();
          counter             ;
          custLayer = new PIXI.Container();
          itemLayer = new PIXI.Container();
          top = new PIXI.Container();
          panel = new PIXI.Container();
          fxLayer = new PIXI.Container();
          overlay = new PIXI.Container();
          tweens          = [];
          floats                                               = [];
          W = 390; H = 844;
          col = { x: 0, w: 390 };
          counterY = 420;
          panelY = 540;
          phase        = "intro";
          elapsed = 0;
          gapT = 0;
          cust                  = null;
          custSprite                     = null;
          bubble = new PIXI.Container();
          patienceBar = new PIXI.Graphics();
          custN = 0;
          given = 0;
          scanned = 0;
          stats = { served: 0, angry: 0, combo: 0, bestCombo: 0, sales: 0, tips: 0, stockOut: 0 };
          prevBest = 0;
          newBest = false;
          rushShown = false;
          hud                                                                                                               ;
          regText                   = null;
          giveText                   = null;
          items                = [];
          lastFont = "";

          tex                              ;
          hooks            ;
  constructor(tex                              , hooks            ) {
    this.tex = tex;
    this.hooks = hooks;
    this.bg = new PIXI.Sprite(tex.kb_shop_bg);
    this.counter = new PIXI.Sprite(tex.kb_counter);
    this.counter.anchor.set(0.5, 0);
    this.root.addChild(this.bg, this.bgDim, this.custLayer, this.counter, this.panel, this.itemLayer, this.top, this.fxLayer, this.overlay);
    this.root.visible = false;
    this.root.eventMode = "static";
  }

          get font() { return fontStack(getLang()); }
          text(s        , size        , color = INK, weight = "800", wrap = 0, align                              = "left") {
    const tx = new PIXI.Text({ text: s, style: { fontFamily: this.font, fontSize: size, fontWeight: weight       , fill: color, wordWrap: wrap > 0, wordWrapWidth: wrap || 100, breakWords: true, align, lineHeight: Math.round(size * 1.3), padding: 4 } });
    return tx;
  }
  /** shrink a text until it fits w */
          fit(tx           , w        ) {
    let n = 0;
    while (tx.width > w && n++ < 12) tx.style.fontSize = Math.max(9, (tx.style.fontSize          ) - 1);
    return tx;
  }
          panelBox(w        , h        , fill = CREAM, r = 16) {
    const g = new PIXI.Graphics();
    g.roundRect(0, 4, w, h, r).fill({ color: INK, alpha: 0.28 });
    g.roundRect(0, 0, w, h, r).fill(fill).stroke({ color: INK, width: 3 });
    return g;
  }
          button(label        , w        , h        , fill        , onTap            , size = 17, sub         )      {
    const c = new PIXI.Container()       ;
    const g = new PIXI.Graphics();
    const draw = (on         , pressed         ) => {
      g.clear();
      const f = on ? fill : 0xd9d2c0;
      if (!pressed) g.roundRect(0, 4, w, h, 14).fill({ color: INK, alpha: 0.3 });
      g.roundRect(0, pressed ? 3 : 0, w, h, 14).fill(f).stroke({ color: INK, width: 3 });
    };
    const lt = this.text(label, size, fill === CORAL || fill === SKY || fill === LEAF || fill === DANGER ? PAPER : INK, "800");
    lt.anchor.set(0.5);
    const st = sub ? this.text(sub, Math.round(size * 0.72), fill === CORAL || fill === SKY || fill === LEAF ? PAPER : INK, "700") : null;
    const place = (dy        ) => {
      lt.position.set(w / 2, (st ? h / 2 - size * 0.38 : h / 2) + dy);
      if (st) { st.anchor.set(0.5); st.position.set(w / 2, h / 2 + size * 0.55 + dy); }
    };
    this.fit(lt, w - 12);
    c.addChild(g, lt);
    if (st) { this.fit(st, w - 12); c.addChild(st); }
    c.enabled = true;
    draw(true, false); place(0);
    c.eventMode = "static";
    c.cursor = "pointer";
    c.hitArea = new PIXI.Rectangle(0, 0, w, h + 4);
    c.on("pointerdown", () => { if (c.enabled) { draw(true, true); place(3); } });
    const up = () => { draw(c.enabled, false); place(0); };
    c.on("pointerup", up); c.on("pointerupoutside", up);
    c.on("pointertap", () => { if (c.enabled) onTap(); });
    c.setOn = (on) => { c.enabled = on; c.alpha = on ? 1 : 0.7; draw(on, false); place(0); c.cursor = on ? "pointer" : "default"; };
    c.setLabel = (s) => { lt.text = s; lt.style.fontSize = size; this.fit(lt, w - 12); };
    return c;
  }
          tween(o                , to                                                    , d        , done             ) {
    this.tweens = this.tweens.filter((tw) => tw.o !== o);
    this.tweens.push({ o, x0: o.x, y0: o.y, x1: to.x ?? o.x, y1: to.y ?? o.y, a0: o.alpha, a1: to.a ?? o.alpha, s0: o.scale.x, s1: to.s ?? o.scale.x, d, t: 0, done });
  }
          float(s        , x        , y        , color        , size = 22) {
    const tx = this.text(s, size, color, "900");
    tx.style.stroke = { color: PAPER, width: 5 };
    tx.anchor.set(0.5);
    tx.position.set(x, y);
    this.fxLayer.addChild(tx);
    this.floats.push({ o: tx, life: 1.1, vy: -46 });
  }

  // ------------------------------------------------------------------ lifecycle

  open(w        , h        ) {
    const k = this.hooks.konbini();
    if (!k) return;
    this.active = true;
    k.onShift = true;
    this.root.visible = true;
    this.phase = "intro";
    this.elapsed = 0; this.custN = 0; this.cust = null;
    this.stats = { served: 0, angry: 0, combo: 0, bestCombo: 0, sales: 0, tips: 0, stockOut: 0 };
    this.prevBest = k.best || 0;
    this.newBest = false; this.rushShown = false;
    this.clearCustomer();
    this.resize(w, h);
    this.hooks.music("kb");
  }
  close() {
    const k = this.hooks.konbini();
    if (k) k.onShift = false;
    this.active = false;
    this.root.visible = false;
    this.clearCustomer();
    this.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.hooks.music("main");
    this.hooks.save();
    this.hooks.onExit();
  }

  resize(w        , h        ) {
    this.W = w; this.H = h;
    const cw = Math.min(w, 520);
    this.col = { x: Math.round((w - cw) / 2), w: cw };
    // background covers the whole window; side bars outside the play column are dimmed store
    const tb = this.bg.texture;
    const sc = Math.max(w / tb.width, h / tb.height);
    this.bg.scale.set(sc);
    this.bg.position.set((w - tb.width * sc) / 2, Math.min(0, (h - tb.height * sc) * 0.35));
    this.bgDim.clear();
    if (this.col.x > 0) {
      this.bgDim.rect(0, 0, this.col.x, h).fill({ color: INK, alpha: 0.32 });
      this.bgDim.rect(this.col.x + cw, 0, w - this.col.x - cw, h).fill({ color: INK, alpha: 0.32 });
    }
    // vertical bands: top HUD (0..64) | customer | counter | control panel (≥ 250 px)
    const panelH = Math.max(250, Math.min(300, h * 0.34));
    this.panelY = Math.round(h - panelH - 10);
    const ct = this.counter.texture;
    const cs = (cw * 1.04) / ct.width;
    this.counter.scale.set(cs);
    const surface = ct.height * cs * 0.35;
    // the counter's front panel tucks under the control panel
    this.counterY = Math.round(this.panelY - Math.min(ct.height * cs - surface, 120) * 0.62);
    this.counter.position.set(w / 2, this.counterY - surface);
    this.buildTop();
    this.layoutCustomer();
    this.layoutItems();
    this.buildPanel();
    if (this.phase === "intro") this.showIntro();
    else if (this.phase === "results") this.showResults();
  }

  // ------------------------------------------------------------------ top HUD

          buildTop() {
    this.top.removeChildren().forEach((c) => c.destroy({ children: true }));
    const { x, w } = this.col;
    const bar = this.panelBox(w - 20, 56, CREAM, 14);
    bar.position.set(x + 10, 8);
    this.top.addChild(bar);
    const timeBar = new PIXI.Graphics();
    timeBar.position.set(x + 22, 46);
    const time = this.text("", 14, INK, "800");
    time.position.set(x + 22, 16);
    const sales = this.text("", 15, CORAL_D, "900");
    sales.anchor.set(0.5, 0);
    sales.position.set(x + w / 2 - 4, 15);
    const combo = this.text("", 13, SKY, "900");
    combo.anchor.set(1, 0);
    combo.position.set(x + w - 76, 17);
    const stock = this.text("", 11, MUTED, "800");
    stock.anchor.set(1, 0);
    stock.position.set(x + w - 76, 34);
    const quit = this.button("✕", 48, 44, SAND, () => this.endShift(true), 18);
    quit.position.set(x + w - 66, 14);
    this.top.addChild(timeBar, time, sales, combo, stock, quit);
    this.hud = { timeBar, time, sales, combo, stock, quit };
    this.updateTop();
  }
          updateTop() {
    const k = this.hooks.konbini();
    const left = Math.max(0, SHIFT_SEC - this.elapsed);
    const { w } = this.col;
    const bw = w - 120;
    const g = this.hud.timeBar;
    g.clear();
    g.roundRect(0, 0, bw, 10, 5).fill(0xe7dcc0).stroke({ color: INK, width: 2 });
    const f = left / SHIFT_SEC;
    if (f > 0) g.roundRect(1, 1, Math.max(4, (bw - 2) * f), 8, 4).fill(left <= RUSH_SEC ? DANGER : LEAF);
    const ts = t("ks.time", { n: Math.ceil(left) });
    if (this.hud.time.text !== ts) this.hud.time.text = ts;
    const ss = "¥" + this.hooks.fmt(this.stats.sales + this.stats.tips);
    if (this.hud.sales.text !== ss) this.hud.sales.text = ss;
    const cs = this.stats.combo >= 2 ? t("ks.comboShort", { n: this.stats.combo }) : "";
    if (this.hud.combo.text !== cs) this.hud.combo.text = cs;
    const st = t("ks.stock", { n: Math.floor(k?.stock ?? 0) });
    if (this.hud.stock.text !== st) this.hud.stock.text = st;
    this.hud.stock.style.fill = (k?.stock ?? 0) < 6 ? DANGER : MUTED;
    this.hud.quit.visible = this.phase !== "results" && this.phase !== "intro";
  }

  // ------------------------------------------------------------------ overlays

          clearOverlay() { this.overlay.removeChildren().forEach((c) => c.destroy({ children: true })); }
          dim() {
    const d = new PIXI.Graphics();
    d.rect(0, 0, this.W, this.H).fill({ color: INK, alpha: 0.55 });
    d.eventMode = "static";
    this.overlay.addChild(d);
  }
          showIntro() {
    this.clearOverlay();
    this.dim();
    const k = this.hooks.konbini();
    const cw = Math.min(this.col.w - 28, 400);
    const x = (this.W - cw) / 2;
    const inner = cw - 32;
    const parts                   = [];
    const title = this.text(t("ks.introT"), 24, CORAL_D, "900"); parts.push(title);
    for (const key of ["ks.intro1", "ks.intro2", "ks.intro3", "ks.intro4"]) parts.push(this.text(t(key), 14, INK, "700", inner));
    const lvl = this.text(t("ks.introLv", { lv: k?.lv ?? 1, n: Math.min(ITEM_ORDER.length, 3 + (k?.lv ?? 1)) }), 12.5, MUTED, "700", inner); parts.push(lvl);
    if ((k?.stock ?? 0) < 1) parts.push(this.text(t("ks.noStock"), 13.5, DANGER, "800", inner));
    else if (this.prevBest > 0) parts.push(this.text(t("ks.bestNow", { n: this.hooks.fmt(this.prevBest) }), 13, SKY, "800", inner));
    let y = 18;
    const lay                             = [];
    for (const p of parts) { lay.push([p, y]); y += p.height + 8; }
    y += 6;
    const noStock = (k?.stock ?? 0) < 1;
    const bh = 54;
    const start = this.button(noStock ? t("ks.restockStart") : t("ks.start"), inner, bh, CORAL, () => {
      if (noStock) { this.hooks.onRestock(); if ((this.hooks.konbini()?.stock ?? 0) < 1) return; }
      this.hooks.cue("kb.door"); this.hooks.buzz("select"); this.clearOverlay(); this.phase = "gap"; this.gapT = 0.5; this.buildPanel(); this.updateTop();
    }, 19);
    const back = this.button(t("ks.back"), inner, 50, SAND, () => { this.hooks.cue("ui.tap"); this.close(); }, 16);
    const h = y + bh + 10 + 50 + 18;
    const card = this.panelBox(cw, h, PAPER, 18);
    const cy = Math.max(70, (this.H - h) / 2);
    card.position.set(x, cy);
    this.overlay.addChild(card);
    for (const [p, py] of lay) { p.position.set(x + 16, cy + py); this.overlay.addChild(p); }
    start.position.set(x + 16, cy + y); back.position.set(x + 16, cy + y + bh + 10);
    this.overlay.addChild(start, back);
  }

  // ------------------------------------------------------------------ customers

          clearCustomer() {
    this.custLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.itemLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.tweens = [];
    this.items = [];
    this.custSprite = null;
    this.bubble = new PIXI.Container();
    this.patienceBar = new PIXI.Graphics();
  }
          spawn() {
    const k = this.hooks.konbini();
    if (!k) return;
    const p = Math.min(1, this.elapsed / SHIFT_SEC);
    const rush = SHIFT_SEC - this.elapsed <= RUSH_SEC;
    const n0 = this.custN++;
    const kinds = ITEM_ORDER.slice(0, Math.min(ITEM_ORDER.length, 3 + k.lv));
    let count = n0 < 2 ? 1 + (Math.random() < 0.5 ? 1 : 0) : 1 + Math.floor(Math.random() * (1.6 + p * 3.6));
    count = Math.min(6, count);
    const avail = Math.floor(k.stock);
    const res = this.hooks.residents();
    const fromRes = res.length > 0 && Math.random() < 0.65;
    const pick = fromRes ? res[Math.floor(Math.random() * res.length)] : null;
    const all = this.hooks.tenantTex();
    const tex = pick ? pick.tex : all[Math.floor(Math.random() * all.length)];
    const items           = [];
    for (let i = 0; i < Math.min(count, avail); i++) items.push(kinds[Math.floor(Math.random() * kinds.length)]);
    const hasHeat = items.some((i) => HEATABLE.has(i));
    const total = items.reduce((a, i) => a + Math.max(10, Math.round((ITEM_YEN[i] * KB_MARKUP[k.price]) / 10) * 10), 0);
    const card = n0 >= 3 && Math.random() < 0.14;
    let paid = total;
    if (!card) {
      const r = Math.random();
      if (n0 < 2) paid = Math.ceil(total / 1000) * 1000 === total ? total + 1000 : Math.ceil(total / 1000) * 1000;
      else if (r < 0.18) paid = total;
      else if (r < 0.32 && total < 500) paid = 500;
      else if (r < 0.5 && p > 0.35) paid = Math.ceil((total + 1) / 5000) * 5000;
      else paid = Math.ceil((total + 1) / 1000) * 1000;
      if (paid < total) paid = Math.ceil(total / 1000) * 1000;
    }
    const base = (20 - 8 * p) * PRICE_PATIENCE[k.price] * (rush ? 0.85 : 1) + items.length * 1.6 + (hasHeat ? 2 : 0) + (paid !== total ? 3 : 0);
    const greets = ["c.hi0", "c.hi1", "c.hi2", "c.hi3"];
    this.cust = {
      tex, room: pick ? pick.room : 0, items,
      wantHeat: hasHeat ? Math.random() < 0.6 : null,
      wantBag: n0 >= 1 ? Math.random() < 0.55 : null,
      card, paid, total,
      patience: base, maxPatience: base,
      greet: t(rush ? "c.hurry" : greets[Math.floor(Math.random() * greets.length)]),
      mood: "ok", moodT: 0,
    };
    this.scanned = 0; this.given = 0;
    this.clearCustomer();
    const sp = new PIXI.Sprite(this.bust(tex) ?? this.bust(all[0]));
    sp.anchor.set(0.5, 1);
    this.custSprite = sp;
    this.custLayer.addChild(sp, this.bubble);
    this.layoutCustomer();
    const tx = sp.x;
    sp.x = this.col.x - 80; sp.alpha = 0.2;
    this.tween(sp, { x: tx, a: 1 }, 0.45);
    this.hooks.cue("kb.door");
    if (items.length === 0) {
      // shelves are empty → they look around and leave
      this.stats.stockOut++;
      this.phase = "walkin";
      this.say(t("c.noStock"), "angry");
      setTimeout(() => this.customerLeaves(false, true), 900);
      return;
    }
    this.phase = "walkin";
    this.drawBubble();
    setTimeout(() => { if (this.cust && this.phase === "walkin") { this.layoutItems(true); this.phase = "scan"; this.buildPanel(); } }, 420);
    this.buildPanel();
  }

  /** tenant art is a seated full figure: the shopper shows only head + torso above the counter */
          busts                               = {};
          bust(key        )               {
    if (this.busts[key]) return this.busts[key];
    const base = this.tex[key] ?? this.tex.tenant_student;
    const f = base.frame;
    const tx = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(f.x, f.y, f.width, Math.round(f.height * 0.5)) });
    this.busts[key] = tx;
    return tx;
  }
          layoutCustomer() {
    const sp = this.custSprite;
    if (!sp) return;
    const { x, w } = this.col;
    const s = Math.min((w * 0.5) / sp.texture.width, (this.counterY - 100) / (sp.texture.height * 0.88));
    sp.scale.set(s);
    // the lower edge of the crop hides behind the counter
    sp.position.set(x + w * 0.29, this.counterY + sp.texture.height * s * 0.12);
    this.drawBubble();
  }
          say(s        , mood                  ) {
    if (!this.cust) return;
    this.cust.greet = s;
    this.cust.mood = mood;
    this.cust.moodT = 1.2;
    this.drawBubble();
  }
          drawBubble() {
    const c = this.cust, sp = this.custSprite;
    if (!c || !sp) return;
    this.bubble.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const { x, w } = this.col;
    const bx = Math.round(x + w * 0.52), bw = Math.round(w * 0.46);
    const top = 78;
    const lines                     = [[c.greet, INK]];
    if (c.mood === "ok" || c.mood === "wrong") {
      if (c.wantHeat !== null) lines.push([t(c.wantHeat ? "c.heatY" : "c.heatN"), c.wantHeat ? CORAL_D : SLATE]);
      if (c.wantBag !== null) lines.push([t(c.wantBag ? "c.bagY" : "c.bagN"), c.wantBag ? LEAF : SLATE]);
      if (c.card) lines.push([t("c.card"), SKY]);
    }
    const tags              = [];
    let y = 12;
    if (c.room > 0) {
      const r = this.text(t("c.resident", { n: c.room }), 11, MUTED, "800");
      this.fit(r, bw - 20); r.position.set(12, y); tags.push(r); y += r.height + 2;
    }
    lines.forEach(([s, col], i) => {
      const tx = this.text(s, i === 0 ? 15 : 14, c.mood === "angry" && i === 0 ? DANGER : col, i === 0 ? "800" : "900", bw - 22);
      tx.position.set(12, y); tags.push(tx); y += tx.height + 3;
    });
    y += 4;
    const barY = y;
    y += 14;
    const g = new PIXI.Graphics();
    g.roundRect(0, 4, bw, y, 14).fill({ color: INK, alpha: 0.25 });
    g.roundRect(0, 0, bw, y, 14).fill(c.mood === "angry" ? 0xfbe0d6 : c.mood === "happy" ? 0xe6f1dc : PAPER).stroke({ color: INK, width: 3 });
    // tail toward the customer's face
    g.poly([0, 24, -14, 34, 0, 40]).fill(PAPER).stroke({ color: INK, width: 3 });
    g.rect(-1, 26, 4, 12).fill(c.mood === "angry" ? 0xfbe0d6 : c.mood === "happy" ? 0xe6f1dc : PAPER);
    this.bubble.addChild(g, ...tags);
    this.patienceBar = new PIXI.Graphics();
    this.patienceBar.position.set(12, barY);
    this.bubble.addChild(this.patienceBar);
    this.bubble.position.set(bx, top);
    this.drawPatience();
  }
          drawPatience() {
    const c = this.cust;
    if (!c) return;
    const bw = Math.round(this.col.w * 0.46) - 24;
    const f = Math.max(0, c.patience / c.maxPatience);
    const g = this.patienceBar;
    g.clear();
    g.roundRect(0, 0, bw, 9, 4).fill(0xe7dcc0).stroke({ color: INK, width: 1.5 });
    g.roundRect(1, 1, Math.max(3, (bw - 2) * f), 7, 3).fill(f > 0.5 ? LEAF : f > 0.25 ? GOLD : DANGER);
  }

  /** items sit on the counter top in a row; tap each to scan */
          layoutItems(drop = false) {
    const c = this.cust;
    if (!c || this.phase === "results") return;
    if (drop) {
      this.itemLayer.removeChildren().forEach((ch) => ch.destroy({ children: true }));
      this.items = c.items.map((ix) => {
        const sp = new PIXI.Sprite(this.tex["kb_item_" + ix]);
        sp.anchor.set(0.5, 0.85);
        sp.eventMode = "static";
        sp.cursor = "pointer";
        sp.on("pointertap", () => this.scan(sp));
        this.itemLayer.addChild(sp);
        return sp;
      });
    }
    const n = this.items.length;
    if (!n) return;
    const { x, w } = this.col;
    // items lie on the counter mat inside the control panel: big, thumb-reachable tap targets
    const left = x + 26, right = x + w - 26;
    const perRow = n <= 3 ? n : Math.ceil(n / 2);
    const rows = Math.ceil(n / perRow);
    const slot = (right - left) / Math.max(perRow, 3);
    const avail = this.H - 10 - (this.panelY + 100);
    const size = Math.min(96, slot * 0.92, avail / rows - 6);
    this.items.forEach((sp, i) => {
      if ((sp       ).scannedDone) return;
      const s = size / 220;
      sp.hitArea = new PIXI.Rectangle(-110, -187, 220, 220);
      const r = Math.floor(i / perRow), c = i % perRow;
      const rowN = Math.min(perRow, n - r * perRow);
      const x0 = (left + right) / 2 - (slot * rowN) / 2;
      const tx = x0 + slot * (c + 0.5), ty = this.panelY + 100 + (r + 0.85) * (size + 6);
      if (drop) { sp.scale.set(s * 0.6); sp.position.set(tx, ty - 50); sp.alpha = 0; this.tween(sp, { y: ty, a: 1, s }, 0.28 + i * 0.05); }
      else { sp.scale.set(s); sp.position.set(tx, ty); }
    });
  }
          scan(sp             ) {
    const c = this.cust;
    if (!c || this.phase !== "scan" || (sp       ).scannedDone) return;
    (sp       ).scannedDone = true;
    sp.eventMode = "none";
    this.scanned++;
    this.hooks.cue("kb.scan");
    const { x, w } = this.col;
    this.float(t("ks.beep"), sp.x, sp.y - 50, SKY, 16);
    this.tween(sp, { x: x + w * 0.7, y: this.counterY - 20, a: 0, s: sp.scale.x * 0.5 }, 0.3);
    this.updateRegister();
    if (this.scanned >= c.items.length) setTimeout(() => this.nextStep("scan"), 260);
  }
          nextStep(from       ) {
    const c = this.cust;
    if (!c || this.phase === "results" || this.phase === "leave") return;
    const order          = ["scan", "heat", "bag", "pay"];
    let i = order.indexOf(from) + 1;
    while (i < order.length) {
      const ph = order[i];
      if (ph === "heat" && c.wantHeat === null) { i++; continue; }
      if (ph === "bag" && c.wantBag === null) { i++; continue; }
      break;
    }
    this.phase = order[i] ?? "pay";
    this.given = 0;
    this.buildPanel();
  }
          answer(q                , yes         ) {
    const c = this.cust;
    if (!c || this.phase !== q) return;
    const want = q === "heat" ? c.wantHeat : c.wantBag;
    if (want === yes) {
      this.hooks.cue(q === "heat" && yes ? "kb.micro" : q === "bag" && yes ? "kb.bag" : "ui.tap");
      this.nextStep(q);
    } else this.mistake();
  }
          mistake() {
    const c = this.cust;
    if (!c) return;
    this.hooks.cue("kb.wrong");
    this.hooks.buzz("warning");
    c.patience -= c.maxPatience * 0.28;
    if (this.stats.combo >= 2) this.float(t("ks.comboLost"), this.col.x + this.col.w / 2, this.counterY - 40, DANGER, 18);
    this.stats.combo = 0;
    this.say(t("c.wrong"), "wrong");
    if (this.custSprite) { const sx = this.custSprite.x; this.custSprite.x = sx + 8; this.tween(this.custSprite, { x: sx }, 0.25); }
    if (c.patience <= 0) this.customerLeaves(false);
  }
          give(v        ) {
    if (this.phase !== "pay" || !this.cust) return;
    this.given += v;
    this.hooks.cue("kb.scan");
    this.updateRegister();
  }
          confirmChange() {
    const c = this.cust;
    if (!c || this.phase !== "pay") return;
    if (c.card || this.given === c.paid - c.total) this.customerLeaves(true);
    else { this.given = 0; this.updateRegister(); this.mistake(); }
  }

          customerLeaves(happy         , silent = false) {
    const c = this.cust, sp = this.custSprite;
    if (!c || this.phase === "leave") return;
    this.phase = "leave";
    const k = this.hooks.konbini();
    const cx = this.col.x + this.col.w / 2;
    if (happy && k) {
      const unit = kbUnit(this.hooks.baseRate());
      const sell = kbSellPrice(k, unit);
      const earned = c.items.reduce((a, i) => a + sell * PLAY_MULT * (ITEM_YEN[i] / 200), 0);
      const pf = Math.max(0, c.patience / c.maxPatience);
      this.stats.combo++;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      const tip = pf > 0.25 ? earned * (0.08 + 0.32 * pf) * (1 + 0.15 * (k.lv - 1)) * (1 + Math.min(10, this.stats.combo - 1) * 0.08) * (SHIFT_SEC - this.elapsed <= RUSH_SEC ? 1.5 : 1) : 0;
      k.stock = Math.max(0, k.stock - c.items.length);
      k.sales += earned + tip;
      k.sold += c.items.length;
      this.stats.sales += earned;
      this.stats.tips += tip;
      this.stats.served++;
      this.hooks.earn(earned + tip);
      this.hooks.cue("kb.register");
      setTimeout(() => this.hooks.cue("kb.happy"), 180);
      this.hooks.buzz("success");
      this.say(t("c.thanks"), "happy");
      this.float("+¥" + this.hooks.fmt(earned), cx, this.counterY - 30, CORAL_D, 24);
      if (tip > 0) setTimeout(() => this.float(t("ks.tip", { n: this.hooks.fmt(tip) }), cx, this.counterY - 4, GOLD, 18), 160);
      if (this.stats.combo >= 2) setTimeout(() => this.float(t("ks.combo", { n: this.stats.combo }), cx, this.counterY - 70, SKY, 26 + Math.min(10, this.stats.combo)), 260);
      for (let i = 0; i < 3; i++) setTimeout(() => this.float("♥", this.col.x + this.col.w * (0.22 + 0.08 * i), this.counterY - 200 - i * 12, DANGER, 22), i * 110);
      if (this.stats.served % 3 === 0) this.hooks.save();
    } else {
      this.stats.angry++;
      if (this.stats.combo >= 2 && !silent) this.float(t("ks.comboLost"), cx, this.counterY - 40, DANGER, 18);
      this.stats.combo = 0;
      if (!silent) this.say(t("c.angry"), "angry");
      this.hooks.cue("kb.angry");
      if (!silent) this.hooks.buzz("warning");
      this.float(t("ks.angryPop"), this.col.x + this.col.w * 0.3, this.counterY - 220, DANGER, 22);
    }
    // the remaining counter items go back to the shelf / into the bag
    for (const it of this.items) if (!(it       ).scannedDone) this.tween(it, { a: 0, y: it.y - 20 }, 0.25);
    this.buildPanel();
    if (sp) setTimeout(() => {
      if (!this.active || this.custSprite !== sp) return;
      this.tween(sp, { x: happy ? this.col.x + this.col.w + 90 : this.col.x - 90, a: 0 }, happy ? 0.5 : 0.35, () => {
        if (this.custSprite !== sp) return;
        this.cust = null;
        this.clearCustomer();
        if (this.phase === "leave") { this.phase = "gap"; this.gapT = SHIFT_SEC - this.elapsed <= RUSH_SEC ? 0.25 : 0.55; this.buildPanel(); }
      });
    }, happy ? 650 : 750);
  }

  // ------------------------------------------------------------------ control panel

          updateRegister() {
    const c = this.cust;
    if (!this.regText || !c) return;
    const k = this.hooks.konbini();
    const sub = c.items.slice(0, this.scanned).reduce((a, i) => a + Math.max(10, Math.round((ITEM_YEN[i] * KB_MARKUP[k?.price ?? 1]) / 10) * 10), 0);
    const showTotal = this.phase === "scan" || this.phase === "walkin" ? sub : c.total;
    let s = `${t("ks.total")} ¥${showTotal.toLocaleString()}`;
    if (this.phase === "pay" && !c.card) s += `   ${t("ks.paid")} ¥${c.paid.toLocaleString()}`;
    this.regText.text = s;
    this.fit(this.regText, this.col.w - 64);
    if (this.giveText) this.giveText.text = `${t("ks.giving")}  ¥${this.given.toLocaleString()}`;
  }
          buildPanel() {
    this.panel.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    this.regText = null; this.giveText = null;
    if (this.phase === "results" || this.phase === "intro") return;
    const { x, w } = this.col;
    const px = x + 10, pw = w - 20, ph = this.H - this.panelY - 8;
    const box = this.panelBox(pw, ph, CREAM, 18);
    box.position.set(px, this.panelY);
    this.panel.addChild(box);
    // register screen
    const scr = new PIXI.Graphics();
    scr.roundRect(0, 0, pw - 24, 40, 10).fill(SLATE).stroke({ color: INK, width: 2.5 });
    scr.position.set(px + 12, this.panelY + 12);
    const reg = this.text("", 17, 0x9ff0b8, "900");
    reg.anchor.set(0, 0.5);
    reg.position.set(px + 26, this.panelY + 32);
    this.panel.addChild(scr, reg);
    this.regText = reg;
    let y = this.panelY + 64;
    const inner = pw - 24;
    const c = this.cust;
    const hint = (s        , color = MUTED) => {
      const tx = this.text(s, 15, color, "800", inner, "center");
      tx.anchor.set(0.5, 0);
      tx.position.set(px + pw / 2, y + 8);
      this.panel.addChild(tx);
    };
    if (!c || this.phase === "gap" || this.phase === "leave" || this.phase === "walkin") {
      hint(this.phase === "leave" && c?.mood === "happy" ? t("ks.thanksLine") : t("ks.next"));
      if (c) this.updateRegister(); else reg.text = t("ks.welcome");
      return;
    }
    if (this.phase === "scan") hint(t("ks.scanHint"), SKY);
    else if (this.phase === "heat" || this.phase === "bag") {
      const q = this.text(t(this.phase === "heat" ? "ks.qHeat" : "ks.qBag"), 19, INK, "900", inner, "center");
      q.anchor.set(0.5, 0); q.position.set(px + pw / 2, y + 2);
      this.panel.addChild(q);
      y += q.height + 14;
      const bw = (inner - 12) / 2, bh = Math.max(56, Math.min(72, this.H - y - 40));
      const ph0 = this.phase;
      const yes = this.button(t("ks.yes"), bw, bh, LEAF, () => this.answer(ph0, true), 20);
      const no = this.button(t("ks.no"), bw, bh, SAND, () => this.answer(ph0, false), 20);
      yes.position.set(px + 12, y); no.position.set(px + 24 + bw, y);
      this.panel.addChild(yes, no);
    } else if (this.phase === "pay") {
      if (c.card) {
        hint(t("ks.cardHint"), SKY);
        const b = this.button(t("ks.card"), inner, 64, SKY, () => { this.hooks.cue("kb.scan"); this.confirmChange(); }, 19);
        b.position.set(px + 12, y + 46);
        this.panel.addChild(b);
      } else {
        const gv = this.text("", 16, INK, "900");
        gv.position.set(px + 14, y);
        this.panel.addChild(gv);
        this.giveText = gv;
        y += 28;
        const n = MONEY.length, gap = 6;
        const bw = (inner - gap * (n - 1)) / n;
        const bh = Math.max(52, Math.min(64, (this.H - y - 90)));
        MONEY.forEach((v, i) => {
          const b = this.moneyButton(v, bw, bh);
          b.position.set(px + 12 + i * (bw + gap), y);
          this.panel.addChild(b);
        });
        y += bh + 10;
        const cw2 = (inner - 10) * 0.36;
        const clr = this.button(t("ks.clear"), cw2, 52, SAND, () => { this.given = 0; this.hooks.cue("ui.tap"); this.updateRegister(); }, 15);
        const ok = this.button(t("ks.give"), inner - 10 - cw2, 52, CORAL, () => this.confirmChange(), 17);
        clr.position.set(px + 12, y); ok.position.set(px + 22 + cw2, y);
        this.panel.addChild(clr, ok);
      }
    }
    this.updateRegister();
  }
  /** a coin / bill tile: bills are rectangles, coins circles in their metal colour */
          moneyButton(v        , w        , h        )                 {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    const draw = (pressed         ) => {
      g.clear();
      const dy = pressed ? 3 : 0;
      if (!pressed) g.roundRect(0, 4, w, h, 12).fill({ color: INK, alpha: 0.28 });
      g.roundRect(0, dy, w, h, 12).fill(PAPER).stroke({ color: INK, width: 2.5 });
      const cx = w / 2, cy = h * 0.42 + dy;
      if (v >= 1000) g.roundRect(cx - w * 0.36, cy - h * 0.2, w * 0.72, h * 0.4, 4).fill(0xb9d7a8).stroke({ color: INK, width: 2 });
      else {
        const r = Math.min(w, h) * (v === 500 ? 0.27 : v === 100 ? 0.24 : v === 50 ? 0.22 : 0.21);
        const col = v === 500 ? 0xe3c46a : v === 10 ? 0xc98a5a : 0xcfd6dc;
        g.circle(cx, cy, r).fill(col).stroke({ color: INK, width: 2 });
        if (v === 50) g.circle(cx, cy, r * 0.28).fill(PAPER).stroke({ color: INK, width: 1.5 });
      }
      lt.y = h * 0.42 + dy; vt.y = h - 4 + dy;
    };
    const lt = this.text(String(v), Math.min(13, w * 0.24), INK, "900");
    lt.anchor.set(0.5); lt.x = w / 2;
    const vt = this.text("¥" + v.toLocaleString(), Math.min(12, w * 0.2), SLATE, "800");
    vt.anchor.set(0.5, 1); vt.x = w / 2;
    this.fit(vt, w - 6);
    lt.visible = false; // the value label under the token is enough
    c.addChild(g, lt, vt);
    draw(false);
    c.eventMode = "static"; c.cursor = "pointer";
    c.hitArea = new PIXI.Rectangle(0, 0, w, h + 4);
    c.on("pointerdown", () => draw(true));
    c.on("pointerup", () => draw(false)); c.on("pointerupoutside", () => draw(false));
    c.on("pointertap", () => this.give(v));
    (c       ).__money = v;
    return c;
  }

  // ------------------------------------------------------------------ results

          endShift(early = false) {
    if (this.phase === "results" || this.phase === "intro") return;
    this.phase = "results";
    this.clearCustomer();
    this.cust = null;
    const k = this.hooks.konbini();
    const takings = this.stats.sales + this.stats.tips;
    if (k) {
      k.shifts = (k.shifts || 0) + 1;
      this.newBest = takings > 0 && takings > (k.best || 0);
      if (this.newBest) k.best = takings;
    }
    this.hooks.cue("kb.end");
    this.hooks.buzz("success");
    if (!early || this.stats.served > 0) this.hooks.moment("level-clear", Math.round(takings));
    if (this.newBest) this.hooks.moment("new-best", Math.round(takings));
    this.hooks.save();
    this.buildPanel();
    this.updateTop();
    this.showResults();
  }
          stars() {
    const s = this.stats, tot = s.served + s.angry;
    if (s.served === 0) return 0;
    const r = s.served / Math.max(1, tot);
    return r >= 0.9 && s.served >= 12 ? 3 : r >= 0.7 && s.served >= 6 ? 2 : 1;
  }
          showResults() {
    this.clearOverlay();
    this.dim();
    const cw = Math.min(this.col.w - 28, 400);
    const x = (this.W - cw) / 2;
    const inner = cw - 32;
    const s = this.stats;
    const title = this.text(t("ks.endT"), 25, CORAL_D, "900");
    title.anchor.set(0.5, 0);
    const rows                             = [
      [t("ks.served"), t("ks.persons", { n: s.served }), INK],
      [t("ks.angryN"), t("ks.persons", { n: s.angry }), s.angry ? DANGER : INK],
      [t("ks.comboBest"), String(s.bestCombo), SKY],
      [t("ks.salesN"), "¥" + this.hooks.fmt(s.sales), INK],
      [t("ks.tips"), "¥" + this.hooks.fmt(s.tips), 0xa07a1c],
      [t("ks.totalN"), "¥" + this.hooks.fmt(s.sales + s.tips), CORAL_D],
    ];
    const k = this.hooks.konbini();
    let y = 16;
    const items                                     = [];
    items.push([title, cw / 2, y]); y += title.height + 6;
    const starG = new PIXI.Graphics();
    const st = this.stars();
    for (let i = 0; i < 3; i++) this.star(starG, cw / 2 + (i - 1) * 46, 20, 18, i < st ? GOLD : 0xd9d2c0);
    items.push([starG, 0, y]); y += 46;
    for (const [a, b, col] of rows) {
      const la = this.text(a, 14, MUTED, "800"); const lb = this.text(b, 16, col, "900");
      this.fit(la, inner * 0.55); this.fit(lb, inner * 0.45);
      lb.anchor.set(1, 0);
      items.push([la, 16, y]); items.push([lb, cw - 16, y]);
      y += 26;
    }
    y += 4;
    const best = this.text(this.newBest ? t("ks.newBest") : t("ks.bestNow", { n: this.hooks.fmt(k?.best || 0) }), this.newBest ? 18 : 13, this.newBest ? CORAL : SKY, "900", inner, "center");
    best.anchor.set(0.5, 0);
    items.push([best, cw / 2, y]); y += best.height + 6;
    const note = this.text(t("ks.cashNote"), 11.5, MUTED, "700", inner, "center");
    note.anchor.set(0.5, 0);
    items.push([note, cw / 2, y]); y += note.height + 12;
    const again = this.button(t("ks.again"), inner, 54, CORAL, () => {
      this.hooks.cue("ui.tap");
      this.open(this.W, this.H);
    }, 18);
    const back = this.button(t("ks.back"), inner, 50, SAND, () => { this.hooks.cue("ui.tap"); this.close(); }, 16);
    const h = y + 54 + 10 + 50 + 18;
    const cy = Math.max(12, (this.H - h) / 2);
    const card = this.panelBox(cw, h, PAPER, 18);
    card.position.set(x, cy);
    this.overlay.addChild(card);
    for (const [o, ox, oy] of items) { o.position.set(x + ox, cy + oy); this.overlay.addChild(o); }
    again.position.set(x + 16, cy + y); back.position.set(x + 16, cy + y + 64);
    this.overlay.addChild(again, back);
    if (this.newBest) { (best       ).__pulse = true; this.pulse = best; } else this.pulse = null;
  }
          pulse                        = null;
          star(g               , cx        , cy        , r        , col        ) {
    const pts           = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.poly(pts).fill(col).stroke({ color: INK, width: 2.5 });
  }

  // ------------------------------------------------------------------ frame

  update(dt        ) {
    if (!this.active) return;
    if (this.font !== this.lastFont) { this.lastFont = this.font; }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const f = ease(Math.min(1, tw.t / tw.d));
      if (tw.o.destroyed) { this.tweens.splice(i, 1); continue; }
      tw.o.position.set(tw.x0 + (tw.x1 - tw.x0) * f, tw.y0 + (tw.y1 - tw.y0) * f);
      tw.o.alpha = tw.a0 + (tw.a1 - tw.a0) * f;
      tw.o.scale.set(tw.s0 + (tw.s1 - tw.s0) * f);
      if (tw.t >= tw.d) { this.tweens.splice(i, 1); tw.done?.(); }
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt; f.o.y += f.vy * dt; f.o.alpha = Math.min(1, f.life * 2.2);
      if (f.life <= 0) { f.o.destroy(); this.floats.splice(i, 1); }
    }
    if (this.pulse && !this.pulse.destroyed) this.pulse.scale.set(1 + Math.sin(performance.now() / 160) * 0.05);
    if (this.phase === "intro" || this.phase === "results") return;
    this.elapsed += dt;
    const left = SHIFT_SEC - this.elapsed;
    if (left <= RUSH_SEC && !this.rushShown) {
      this.rushShown = true;
      this.float(t("ks.rush"), this.col.x + this.col.w / 2, this.H * 0.3, DANGER, 30);
      this.hooks.cue("kb.door");
      this.hooks.buzz("impact");
    }
    const c = this.cust;
    if (c && (this.phase === "scan" || this.phase === "heat" || this.phase === "bag" || this.phase === "pay")) {
      c.patience -= dt;
      this.drawPatience();
      if (c.patience <= 0) this.customerLeaves(false);
      // nervous jiggle when the bar is red
      if (this.custSprite && c.patience / c.maxPatience < 0.25) this.custSprite.rotation = Math.sin(performance.now() / 60) * 0.02;
    }
    if (c && c.moodT > 0) {
      c.moodT -= dt;
      if (c.moodT <= 0 && (c.mood === "wrong") && this.phase !== "leave") { c.mood = "ok"; c.greet = t("c.hi1"); this.drawBubble(); }
    }
    if (this.phase === "gap") {
      this.gapT -= dt;
      if (left <= 0) { this.endShift(); return; }
      if (this.gapT <= 0) this.spawn();
    }
    if (left <= 0 && this.phase !== "leave" && this.phase !== "gap") {
      // the customer at the till when the shift ends still gets served if they were mid-payment
      if (!c || this.phase === "walkin") this.endShift();
      else if (left < -8) this.endShift();
    }
    this.updateTop();
  }

  /** test bridge: what the player is asked right now */
  snapshot() {
    const c = this.cust;
    return {
      active: this.active, phase: this.phase, elapsed: Math.round(this.elapsed * 10) / 10,
      cust: c ? { items: c.items.length, scanned: this.scanned, wantHeat: c.wantHeat, wantBag: c.wantBag, card: c.card, total: c.total, paid: c.paid, change: c.paid - c.total, patience: Math.round(c.patience * 10) / 10, given: this.given } : null,
      itemPos: this.items.filter((s) => !(s       ).scannedDone && !s.destroyed).map((s) => ({ x: Math.round(s.x), y: Math.round(s.y - 40) })),
      stats: { ...this.stats }, newBest: this.newBest,
    };
  }
}
