// Battle scene: 4-heroine pinball fight rendered in pixi.
import * as PIXI from 'pixi.js';
import { core, W, loadMany, texNow, toStage, eid, setMusic } from './core.js';
import {
  CHAR_BY_ID, EL_COLOR, GEM_ICON, MONS, STAGES, AREA_BG, elemMult, stageScale, charArt,
  TIER_COMBO, TIER_STRIKE, ENERGY_MAX, ENERGY_HIT, ENERGY_ALLY,
} from './data.js';
                                                          
import { save, stats, tierOf } from './state.js';
import { t, FONT } from './i18n.js';
import { monsterShape, circleVsShape, shapeMaxR } from './shape.js';
import { fxScreen, initFx, fxUpdate, play, applyShake, clearFx } from './fx.js';

                                                                                             
                                                                                      

const ALLY_R = 34;

/**
 * 素材的**原始**宽度。
 *
 * ★★ 为什么需要这个常量：这游戏有三处把「显示尺寸」写成了「纹理宽度的比例」，
 *   而分母是**写死的设计常数**（430 / 560 / 1024）。2026-10-26 把 1024² 的立绘
 *   压到 768²、怪物压到 320² 之后，`sprite.scale` 不变而纹理变小 ⇒
 *   **画面里的怪物缩小了 3.2 倍**，而且一个错都不报 —— 只有看截图才发现
 *   （第一版 store 截图里，两只小怪小得像两个点）。
 *
 *   判据：`scale × texture.width` 才是在屏幕上的宽度。
 *   所以凡是「按 1024 宽的素材设计」的地方，都要乘 `ART_W / 实际宽度` 把它补回来。
 */
const ART_W = 1024;
/** `scaleFor1024` 是「素材 1024 宽时该用的 scale」，这里按实际纹理宽度换算。 */
const artScale = (sprite, scaleFor1024) => scaleFor1024 * (ART_W / Math.max(1, sprite.texture.width));
const MAX_SPEED = 4400;
const HUD_H = 196;

                
                                                                                        
                                                                                      
                                                                                                   
 
                 
                                                                                                        
                                                                                                                
                                                                                         
 
                                                                                                                                                    
                                                                                                                   

function txt(s        , size        , fill                  = 0xffffff, stroke = 0x8a5fb8, sw = 4) {
  const tx = new PIXI.Text({ text: s, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: '800', stroke: { color: stroke, width: sw, join: 'round' }, align: 'center' } });
  tx.anchor.set(0.5);
  return tx;
}

export class Battle {
  scene = new PIXI.Container();
  bg = new PIXI.Sprite();
  bgMask = new PIXI.Graphics();
  sceneMask = new PIXI.Graphics();
  frame = new PIXI.Graphics();
  enemyLayer = new PIXI.Container();
  allyLayer = new PIXI.Container();
  fxLayer = new PIXI.Container();
  hud = new PIXI.Container();
  topHud = new PIXI.Container();
  aimG = new PIXI.Graphics();
  allies         = [];
  enemies          = [];
  tweens             = [];
  homings           = [];
  timers                                       = [];
  phase                                                  = 'intro';
  paused = false;
  cut      = null;
  cur = 0; turn = 1; wave = 0;
  hp = 0; maxHp = 0; hpShown = 0;
  shotT = 0; shotHits = 0; boost = 1; armed = false; strikeShot = false;
  aiming = false; aimStart = { x: 0, y: 0 }; aimVec = { x: 0, y: 0 };
  drops                          = { fire: 0, water: 0, wood: 0, light: 0, dark: 0 };
  time = 0;
  stage = STAGES[0];
  scaleS = { hp: 1, atk: 1 };
  hintText = (() => { const x = txt('', 20, 0xffffff, 0x9b77c9, 4); x.style.wordWrap = true; x.style.wordWrapWidth = W - 60; x.style.breakWords = true; return x; })();
  turnText = txt('3', 30, 0xffffff, 0x8a5fb8, 5);
  turnLbl = txt(t('turn'), 13, 0xffffff, 0x8a5fb8, 3);
  waveText = txt('', 15, 0xffffff, 0x8a5fb8, 4);
  bossBar = new PIXI.Graphics();
  bossBarBox = new PIXI.Container();
  pauseBtn = new PIXI.Container();
  hpBarG = new PIXI.Graphics();
  hpText = txt('', 17, 0xffffff, 0xd06a9a, 4);
  cards                                                                                                                                  = [];
  hooks             ;
  tickFn = (tk             ) => {
    // FX owns hit-stop: it hands back a time scale that gameplay dt is multiplied by (FX itself gets real dt)
    const real = Math.min(tk.deltaMS / 1000, 1 / 30);
    const scale = fxUpdate(real);
    this.update(real * scale);
    applyShake(this.scene, 1.6);
  };
  downFn = (e              ) => this.onDown(e);
  moveFn = (e              ) => this.onMove(e);
  upFn = (e              ) => this.onUp(e);
  relayoutFn = () => this.layout();
  bossActive = false;
  destroyed = false;

  constructor(hooks             ) { this.hooks = hooks; }

  get fb() { return core.H - HUD_H; } // field bottom

  static assetsFor(stageN        )           {
    const st = STAGES[stageN - 1];
    const urls = [st.bg, ...Object.values(GEM_ICON)];
    for (const id of save.team) urls.push(charArt(id, tierOf(id)));
    for (const w of st.waves) for (const m of w) urls.push(MONS[m].tex);
    return urls;
  }

  async start(stageN        ) {
    this.stage = STAGES[stageN - 1];
    this.scaleS = stageScale(stageN);
    core.root.addChild(this.scene, this.sceneMask);
    this.scene.mask = this.sceneMask;
    this.scene.addChild(this.bg, this.bgMask, this.frame, this.enemyLayer, this.allyLayer, this.aimG, this.fxLayer, this.topHud, this.hud);
    this.bg.texture = texNow(this.stage.bg);
    this.bg.mask = this.bgMask;
    this.buildAllies();
    this.buildHud();
    this.layout();
    core.relayoutHooks.push(this.relayoutFn);
    const cv = core.app.canvas;
    cv.addEventListener('pointerdown', this.downFn);
    window.addEventListener('pointermove', this.moveFn);
    window.addEventListener('pointerup', this.upFn);
    window.addEventListener('pointercancel', this.upFn);
    core.app.ticker.add(this.tickFn);
    void initFx(core.app, this.scene, ALLY_R * 2).then(() => {
      if (this.destroyed) return;
      play('holy-spawn', { pos: { x: W / 2, y: this.fb * 0.45 } });
    });
    setMusic('battle');
    this.spawnWave(0);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearFx();
    core.app.ticker.remove(this.tickFn);
    core.app.canvas.removeEventListener('pointerdown', this.downFn);
    window.removeEventListener('pointermove', this.moveFn);
    window.removeEventListener('pointerup', this.upFn);
    window.removeEventListener('pointercancel', this.upFn);
    core.relayoutHooks = core.relayoutHooks.filter(f => f !== this.relayoutFn);
    this.scene.mask = null;
    this.scene.destroy({ children: true });
    this.sceneMask.destroy();
  }

  // ---------- setup ----------
  buildAllies() {
    this.maxHp = 0;
    save.team.forEach((id, idx) => {
      const def = CHAR_BY_ID[id];
      const st = stats(id);
      const tier = tierOf(id);
      this.maxHp += st.hp;
      const view = new PIXI.Container();
      const glow = new PIXI.Graphics();
      view.addChild(glow);
      const back = new PIXI.Graphics().circle(0, 0, ALLY_R).fill({ color: EL_COLOR[def.el], alpha: 0.55 });
      const sp = new PIXI.Sprite(texNow(charArt(id, tier)));
      sp.anchor.set(0.5, 0.35);
      sp.scale.set(artScale(sp, (ALLY_R * 2) / 430));
      const mask = new PIXI.Graphics().circle(0, 0, ALLY_R - 2).fill(0xffffff);
      sp.mask = mask;
      const ring = new PIXI.Graphics().circle(0, 0, ALLY_R).stroke({ width: tier === 2 ? 5 : 4, color: tier === 2 ? 0xffd86b : EL_COLOR[def.el] })
        .circle(0, 0, ALLY_R + 2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
      const gloss = new PIXI.Graphics().ellipse(-ALLY_R * 0.38, -ALLY_R * 0.5, ALLY_R * 0.42, ALLY_R * 0.2).fill({ color: 0xffffff, alpha: 0.45 });
      gloss.rotation = -0.5;
      const mark = new PIXI.Graphics();
      view.addChild(back, sp, mask, ring, gloss, mark);
      this.allyLayer.sortableChildren = true;
      this.allyLayer.addChild(view);
      this.allies.push({
        def, idx, tier, x: 0, y: 0, vx: 0, vy: 0, atk: st.atk, spd: st.spd,
        en: 0, enRate: st.energyRate, comboUsed: false, view, glow, face: sp, mark, spinV: 0,
      });
    });
    this.hp = this.hpShown = this.maxHp;
    const fb = this.fb;
    const pos = [[115, fb - 95], [215, fb - 165], [325, fb - 95], [425, fb - 165]];
    this.allies.forEach((a, i) => { a.x = pos[i][0]; a.y = pos[i][1]; });
  }

  buildHud() {
    // top: turn box, wave, pause, boss bar
    const box = new PIXI.Graphics().roundRect(0, 0, 72, 62, 16).fill({ color: 0xb79be0, alpha: 0.82 }).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    box.position.set(12, 12);
    this.turnLbl.position.set(48, 26);
    this.turnText.position.set(48, 52);
    this.waveText.anchor.set(0, 0.5);
    this.waveText.position.set(14, 90);
    this.topHud.addChild(box, this.turnLbl, this.turnText, this.waveText);
    const pb = new PIXI.Graphics().circle(0, 0, 25).fill({ color: 0xb79be0, alpha: 0.82 }).stroke({ width: 3, color: 0xffffff })
      .roundRect(-8, -10, 5, 20, 2).fill(0xffffff).roundRect(3, -10, 5, 20, 2).fill(0xffffff);
    this.pauseBtn.addChild(pb);
    this.topHud.addChild(this.pauseBtn);
    const moon = txt('☾', 22, 0xffe08a, 0x8a5fb8, 3);
    moon.position.set(-150, 0);
    this.bossBarBox.addChild(this.bossBar, moon);
    this.bossBarBox.visible = false;
    this.topHud.addChild(this.bossBarBox);
    this.hintText.visible = false;
    this.topHud.addChild(this.hintText);
  }

  layout() {
    const H = core.H, fb = this.fb;
    const bt = this.bg.texture;
    const s = Math.max(W / bt.width, fb / bt.height) * 1.02;
    this.bg.scale.set(s);
    this.bg.anchor.set(0.5);
    this.bg.position.set(W / 2, fb / 2);
    this.bgMask.clear().rect(0, 0, W, fb).fill(0xffffff);
    this.sceneMask.clear().rect(0, 0, W, H).fill(0xffffff);
    this.frame.clear()
      .roundRect(4, 4, W - 8, fb - 6, 18).stroke({ width: 6, color: 0xffffff, alpha: 0.55 })
      .roundRect(9, 9, W - 18, fb - 16, 14).stroke({ width: 2, color: 0xd9c4ff, alpha: 0.8 });
    this.pauseBtn.position.set(W - 42, 42);
    this.bossBarBox.position.set(W / 2 + 10, 34);
    this.hintText.position.set(W / 2, fb - 26);
    for (const a of this.allies) { a.x = Math.min(Math.max(a.x, 16 + ALLY_R), W - 16 - ALLY_R); a.y = Math.min(a.y, fb - 12 - ALLY_R); }
    // bottom hud
    this.hud.removeChildren().forEach(c => c.destroy({ children: true }));
    this.cards = [];
    this.hpBarG = new PIXI.Graphics();
    this.hpText = txt('', 17, 0xffffff, 0xd06a9a, 4);
    const panel = new PIXI.Graphics()
      .roundRect(0, fb, W, H - fb + 20, 22).fill({ color: 0xfbeef8, alpha: 0.93 })
      .roundRect(0, fb, W, 4, 2).fill({ color: 0xe6c8f0, alpha: 1 });
    const heart = txt('♥', 30, 0xff7fb0, 0xffffff, 3);
    heart.position.set(30, fb + 24);
    this.hud.addChild(panel, this.hpBarG, heart, this.hpText);
    this.hpText.anchor.set(1, 0.5);
    this.hpText.position.set(W - 26, fb + 24);
    const gap = 8, cw = (W - 28 - gap * 3) / 4, ch = H - fb - 58, cy = fb + 46;
    this.allies.forEach((a, i) => {
      const x = 14 + i * (cw + gap);
      const c = new PIXI.Container();
      c.position.set(x, cy);
      const bg = new PIXI.Graphics();
      const sp = new PIXI.Sprite(texNow(charArt(a.def.id, a.tier)));
      sp.anchor.set(0.5, 0.3);
      sp.scale.set(artScale(sp, (cw - 8) / 560));
      sp.position.set(cw / 2, 4 + (ch - 36) * 0.5);
      const mask = new PIXI.Graphics().roundRect(4, 4, cw - 8, ch - 36, 12).fill(0xffffff);
      sp.mask = mask;
      const gem = new PIXI.Sprite(texNow(GEM_ICON[a.def.el]));
      gem.anchor.set(0.5);
      gem.scale.set(30 / 204);
      gem.position.set(18, 20);
      const lbl = txt('', 13, 0xffffff, 0x7d6aa8, 3);
      lbl.position.set(cw / 2, ch - 25);
      const bar = new PIXI.Graphics();
      c.addChild(bg, sp, mask, gem, lbl, bar);
      this.hud.addChild(c);
      this.cards.push({ c, bg, bar, lbl, x, y: cy, w: cw, h: ch });
    });
    this.drawHud();
  }

  drawHud() {
    const fb = this.fb;
    const bx = 52, bw = W - 52 - 140, by = fb + 13;
    const f = Math.max(0, this.hpShown / this.maxHp);
    this.hpBarG.clear()
      .roundRect(bx, by, bw + 120, 22, 11).fill({ color: 0xffffff, alpha: 0.9 }).stroke({ width: 2, color: 0xe2b5d6 })
      .roundRect(bx + 3, by + 3, Math.max(0, (bw + 114) * f), 16, 8).fill(f > 0.3 ? 0xff8fc0 : 0xff6a7a);
    this.hpText.text = `${Math.ceil(Math.max(0, this.hp))} / ${this.maxHp}`;
    this.cards.forEach((cd, i) => {
      const a = this.allies[i];
      const isCur = i === this.cur && this.phase !== 'over';
      const ready = a.en >= ENERGY_MAX;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      cd.c.y = cd.y - (isCur ? 6 : 0);
      const col = EL_COLOR[a.def.el];
      cd.bg.clear().roundRect(0, 0, cd.w, cd.h, 14).fill({ color: 0xffffff, alpha: 0.95 })
        .roundRect(0, 0, cd.w, cd.h, 14).fill({ color: col, alpha: 0.22 })
        .roundRect(0, 0, cd.w, cd.h, 14).stroke({ width: isCur ? 4 : 2.5, color: ready ? 0xffd25a : (isCur ? 0xb48cff : 0xe6d6f2), alpha: ready ? 0.6 + 0.4 * pulse : 1 });
      if (this.armed && isCur) cd.bg.roundRect(-3, -3, cd.w + 6, cd.h + 6, 16).stroke({ width: 3, color: 0xfff1a8, alpha: pulse });
      const fill = Math.min(1, a.en / ENERGY_MAX);
      const bw = cd.w - 16;
      cd.bar.clear().roundRect(8, cd.h - 14, bw, 9, 4.5).fill({ color: 0xe9e2f5 })
        .roundRect(8, cd.h - 14, Math.max(4, bw * fill), 9, 4.5).fill(ready ? 0xffc94d : 0x7fb4ff);
      cd.lbl.text = this.armed && isCur ? t('armed') : ready ? t('ready') : `${Math.floor(fill * 100)}%`;
      cd.lbl.style.fill = ready ? 0xfff3b0 : 0xffffff;
    });
    this.turnText.text = String(this.turn);
    this.waveText.text = t('wave', { n: this.wave + 1, m: this.stage.waves.length });
    const boss = this.enemies.find(e => e.def.boss && !e.dead);
    this.bossBarBox.visible = !!boss;
    if (boss) {
      const bf = boss.hp / boss.maxHp;
      this.bossBar.clear().roundRect(-135, -13, 300, 26, 13).fill({ color: 0x4b3a6e, alpha: 0.65 }).stroke({ width: 2.5, color: 0xffffff, alpha: 0.85 })
        .roundRect(-130, -8, 290 * bf, 16, 8).fill(0xc4a2ff);
    }
  }

  // ---------- waves ----------
  spawnWave(w        ) {
    this.wave = w;
    for (const e of this.enemies) e.view.destroy({ children: true });
    this.enemies = [];
    const list = this.stage.waves[w];
    const hasBoss = list.some(id => MONS[id].boss);
    const top = 120;
    let slots            ;
    if (hasBoss) slots = [[270, top + 120], [95, top + 330], [445, top + 330]];
    else if (list.length === 2) slots = [[165, top + 130], [375, top + 130]];
    else if (list.length === 3) slots = [[130, top + 100], [410, top + 100], [270, top + 290]];
    else slots = [[125, top + 80], [415, top + 80], [175, top + 300], [365, top + 300]];
    list.forEach((id, i) => {
      const def = MONS[id];
      const sc = this.scaleS;
      const view = new PIXI.Container();
      const sprite = new PIXI.Sprite(texNow(def.tex));
      sprite.anchor.set(0.5);
      const baseScale = artScale(sprite, (def.r * (def.boss ? 3.2 : 3.4)) / ART_W);
      sprite.scale.set(baseScale);
      const shadow = new PIXI.Graphics().ellipse(0, def.r * 0.85, def.r * 0.8, def.r * 0.18).fill({ color: 0x7a5aa8, alpha: 0.18 });
      const hpBar = new PIXI.Graphics();
      const cntBg = new PIXI.Graphics();
      const cnt = txt('', 16, 0xffffff, 0x3a4a9a, 3);
      view.addChild(shadow, sprite, hpBar, cntBg, cnt);
      const [x, y] = slots[i];
      view.position.set(x, y);
      view.scale.set(0.01);
      this.enemyLayer.addChild(view);
      const turns = Math.max(1, def.turns - 1) + (i % 2); // faster attack countdown (user request)
      const shape = monsterShape(def.tex, sprite.texture, baseScale, def.r);
      const e        = {
        def, x, y, r: def.r, hp: Math.round(def.hp * sc.hp), maxHp: Math.round(def.hp * sc.hp), atk: Math.round(def.atk * sc.atk),
        counter: turns, hitCd: 0, dead: false, view, sprite, hpBar, cnt, cntBg, bump: 0, baseScale, shape, shapeR: shapeMaxR(shape),
      };
      this.enemies.push(e);
      this.drawEnemy(e);
    });
    this.phase = 'intro';
    if (hasBoss) { this.bossActive = true; setMusic('boss'); }
    this.banner(hasBoss ? t('bossBanner') : t('waveBanner', { n: w + 1 }), hasBoss ? 0xffd0f0 : 0xffffff);
    let k = 0;
    const grow = () => {
      k += 1;
      for (const e of this.enemies) e.view.scale.set(Math.min(1, k / 12) * (1 + 0.15 * Math.sin(Math.min(1, k / 12) * Math.PI)));
      if (k < 12) this.after(1 / 60, grow);
    };
    this.after(0.5, grow);
    this.after(1.3, () => this.beginTurn());
  }

  drawEnemy(e       ) {
    const r = e.r, bw = r * 1.6, by = r * 0.98;
    const f = Math.max(0, e.hp / e.maxHp);
    e.hpBar.clear().roundRect(-bw / 2, by, bw, 10, 5).fill({ color: 0x5b4880, alpha: 0.75 }).stroke({ width: 1.5, color: 0xffffff })
      .roundRect(-bw / 2 + 2, by + 2, (bw - 4) * f, 6, 3).fill(0xff86b8);
    const cx = -r * 0.82, cy = -r * 0.72;
    const danger = e.counter <= 1;
    e.cntBg.clear().circle(cx, cy, 14).fill(danger ? 0xff6f91 : 0x6c8ef5).stroke({ width: 2.5, color: 0xffffff })
      .circle(cx + 15, cy + 2, 6).fill(EL_COLOR[e.def.el]).stroke({ width: 1.5, color: 0xffffff });
    e.cnt.text = String(e.counter);
    e.cnt.position.set(cx, cy);
  }

  // ---------- turn flow ----------
  beginTurn() {
    if (this.phase === 'over') return;
    for (let i = 0; i < 4; i++) {
      const a = this.allies[(this.cur + i) % 4];
      if (a) { this.cur = (this.cur + i) % 4; break; }
    }
    this.phase = 'aim';
    const a = this.allies[this.cur];
    // strike shot fires automatically on this heroine's next shot once charged
    this.armed = a.en >= ENERGY_MAX;
    if (this.armed) this.hint(t('strikeReady'));
    else if (this.turn <= 2) this.hint(t('dragHint'));
    else if (this.turn <= 4) this.hint(t('energyHint'));
    else this.hint(t('yourTurn', { name: t('name_' + a.def.id) }));
  }

  hint(s        ) {
    this.hintText.text = s;
    this.hintText.visible = true;
    this.hintText.alpha = 1;
  }

  launch(dx        , dy        , power        ) {
    const a = this.allies[this.cur];
    const len = Math.hypot(dx, dy) || 1;
    this.boost = 1;
    this.strikeShot = this.armed;
    if (this.armed) this.fireStrike(a);
    const sp = Math.min(MAX_SPEED, (1150 + 2150 * power) * a.spd * (this.boost > 1 ? 1.3 : 1));
    a.vx = (dx / len) * sp;
    a.vy = (dy / len) * sp;
    this.phase = 'moving';
    this.shotT = 0;
    this.shotHits = 0;
    for (const o of this.allies) o.comboUsed = false;
    this.hintText.visible = false;
    void core.sound?.playCue('sfx.launch', { eventId: eid('launch') });
  }

  fireStrike(a      ) {
    const m = TIER_STRIKE[a.tier];
    a.en = 0;
    this.armed = false;
    void core.sound?.playCue('sfx.strike', { eventId: eid('strike') });
    this.showCutIn(a);
    if (a.def.strike === 'meteor') {
      this.enemies.filter(e => !e.dead).forEach((e, i) => {
        for (let k = 0; k < 3; k++) {
          this.after(0.12 * i + 0.15 * k, () => {
            if (e.dead || this.destroyed) return;
            this.meteorFx(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r * 0.6, a.def.el);
            this.damage(e, a.atk * 1.1 * m, a.def.el, true);
          });
        }
      });
    } else if (a.def.strike === 'boost') {
      this.boost = 2.3 * m;
    } else {
      this.heal(this.maxHp * 0.3 * m);
    }
  }

  endShot() {
    this.phase = 'resolve';
    const a = this.allies[this.cur];
    a.vx = a.vy = 0;
    this.after(0.35, () => this.resolveTurn());
  }

  async resolveTurn() {
    if (this.phase === 'over' || this.destroyed) return;
    const alive = this.enemies.filter(e => !e.dead);
    if (alive.length === 0) {
      this.turn++;
      this.cur = (this.cur + 1) % 4;
      if (this.wave + 1 >= this.stage.waves.length) { this.finish(true); return; }
      this.spawnWave(this.wave + 1);
      return;
    }
    // enemy turn
    for (const e of alive) {
      e.counter--;
      this.drawEnemy(e);
    }
    const attackers = alive.filter(e => e.counter <= 0);
    for (const e of attackers) {
      await this.wait(0.3);
      if (this.destroyed || this.phase === 'over') return;
      this.enemyAttack(e);
      e.counter = Math.max(1, e.def.turns - 1) + (Math.random() < 0.3 ? 1 : 0);
      this.drawEnemy(e);
      if (this.hp <= 0) { await this.wait(0.6); this.finish(false); return; }
    }
    if (attackers.length) await this.wait(0.4);
    if (this.destroyed) return;
    this.turn++;
    this.cur = (this.cur + 1) % 4;
    this.beginTurn();
  }

  /** Strike energy: the shooter gains it by hitting monsters and touching teammates (not during her own strike shot). */
  gainEnergy(a      , amt        ) {
    if (this.strikeShot || a.en >= ENERGY_MAX) return;
    a.en = Math.min(ENERGY_MAX, a.en + amt * a.enRate);
    if (a.en >= ENERGY_MAX) {
      this.energyFullTag(a);
      play('level-up', { pos: { x: a.x, y: a.y } });
      void core.sound?.playCue('sfx.heal', { eventId: eid('enfull') });
    }
  }

  /** Energy full: a one-time tag pops above that heroine's card in the bottom party panel. */
  energyFullTag(a      ) {
    const cd = this.cards[this.allies.indexOf(a)];
    if (!cd) return;
    const tag = txt(t('energyFull'), 17, 0xfff1a8, 0xb0702a, 5);
    if (tag.width > cd.w + 30) tag.scale.set((cd.w + 30) / tag.width);
    const cx = Math.min(W - tag.width / 2 - 4, Math.max(tag.width / 2 + 4, cd.x + cd.w / 2));
    tag.position.set(cx, cd.y + 10);
    this.hud.addChild(tag);
    this.tweens.push({ o: tag, vx: 0, vy: -38, life: 1.6, max: 1.6, spin: 0, grav: 0, fade: true, grow: 0 });
    for (let k = 0; k < 8; k++) {
      const s = new PIXI.Graphics().star(0, 0, 4, 7, 2.5).fill(0xfff3b0);
      s.position.set(cd.x + Math.random() * cd.w, cd.y + Math.random() * cd.h * 0.6);
      this.hud.addChild(s);
      this.tweens.push({ o: s, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 60, life: 0.8, max: 0.8, spin: 4, grav: 0, fade: true, grow: 0 });
    }
  }

  /** Strike Shot fired: portrait cut-in on a tilted band (non-blocking). */
  showCutIn(a      , full = false) {
    if (this.cut) { this.cut.c.destroy({ children: true }); this.cut = null; }
    const col = EL_COLOR[a.def.el];
    const c = new PIXI.Container();
    const HH = 112, TILT = 22;
    const pts = [-20, -HH + TILT, W + 20, -HH - TILT, W + 20, HH - TILT, -20, HH + TILT];
    const band = new PIXI.Graphics()
      .poly(pts).fill({ color: 0x241a44, alpha: 0.82 })
      .poly(pts).fill({ color: col, alpha: 0.3 })
      .moveTo(-20, -HH + TILT).lineTo(W + 20, -HH - TILT).stroke({ width: 6, color: 0xffe08a })
      .moveTo(-20, HH + TILT).lineTo(W + 20, HH - TILT).stroke({ width: 6, color: 0xffe08a })
      .moveTo(-20, -HH + TILT + 9).lineTo(W + 20, -HH - TILT + 9).stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
      .moveTo(-20, HH + TILT - 9).lineTo(W + 20, HH - TILT - 9).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    const mask = new PIXI.Graphics().poly(pts).fill(0xffffff);
    const sp = new PIXI.Sprite(texNow(charArt(a.def.id, a.tier)));
    const s = 520 / Math.max(1, sp.texture.width);
    sp.anchor.set(0.5, 0);
    sp.scale.set(s);
    sp.y = -HH - TILT - sp.texture.height * s * 0.04;
    sp.mask = mask;
    const t1 = txt(full ? t('energyFull') : t('strike'), 26, 0xffe9a0, 0x7a4fc0, 6);
    t1.position.set(W - 140, -26);
    const t2 = txt(t('strike_' + a.def.strike), 32, 0xffffff, 0x7a4fc0, 6);
    t2.position.set(W - 140, 16);
    for (const tx of [t1, t2]) if (tx.width > 250) tx.scale.set(250 / tx.width);
    c.addChild(band, sp, mask, t1, t2);
    c.position.set(0, this.fb * 0.45);
    this.scene.addChildAt(c, this.scene.getChildIndex(this.topHud));
    this.cut = { c, sp, t: 0, tx: [t1, t2] };
    this.stepCut(0);
  }
  stepCut(dt        ) {
    const cu = this.cut;
    if (!cu) return;
    cu.t += dt;
    const LIFE = 1.5;
    if (cu.t >= LIFE) { cu.c.destroy({ children: true }); this.cut = null; return; }
    const inP = Math.min(1, cu.t / 0.22), e = 1 - (1 - inP) ** 3;
    cu.c.scale.y = 0.15 + 0.85 * e;
    cu.c.alpha = Math.min(1, (LIFE - cu.t) / 0.25);
    cu.sp.x = -170 + 310 * e + cu.t * 14;
    for (const tx of cu.tx) tx.alpha = Math.min(1, Math.max(0, (cu.t - 0.12) / 0.15));
  }

  enemyAttack(e       ) {
    e.bump = 1;
    const dmg = Math.round(e.atk * (0.9 + Math.random() * 0.2));
    this.hp = Math.max(0, this.hp - dmg);
    play('damage-flash', { power: e.def.boss ? 1.3 : 0.8 });
    void core.sound?.playCue('sfx.enemyAtk', { eventId: eid('eatk') });
    // projectile streak toward the party panel
    const g = new PIXI.Graphics()
      .moveTo(e.x, e.y).lineTo(W / 2, this.fb + 20).stroke({ width: e.def.boss ? 16 : 8, color: 0xff7aa8, alpha: 0.7 })
      .moveTo(e.x, e.y).lineTo(W / 2, this.fb + 20).stroke({ width: e.def.boss ? 6 : 3, color: 0xffffff, alpha: 0.9 });
    this.addFx(g, 0, 0, 0.35, 0, 0, true);
    this.redFlash();
    const n = txt(`-${dmg}`, 26, 0xff5f7e, 0xffffff, 5);
    n.position.set(W / 2, this.fb + 8);
    this.addFx(n, 0, -60, 0.9, 0, 0, true);
  }

  finish(win         ) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.drawHud();
    if (win) {
      this.banner(t('victory'), 0xfff2a8, 1.4);
      // victory bonus so every heroine gets materials early: +1 of each element, +2 for each team member's element (+1 more on boss stages)
      for (const k of Object.keys(this.drops)) this.drops[k] += 1;
      for (const a of this.allies) this.drops[a.def.el] += this.stage.boss ? 3 : 2;
    }
    void (win ? core.sound?.playCue('jingle.win', { eventId: eid('win') }) : core.sound?.playCue('jingle.lose', { eventId: eid('lose') }));
    this.after(1.3, () => this.hooks.onEnd({ win, stage: this.stage.n, drops: this.drops, turns: this.turn }));
  }

  // ---------- combat ----------
  damage(e       , base        , el         , quiet = false) {
    if (e.dead) return;
    const mult = elemMult(el, e.def.el);
    const dmg = Math.round(base * mult * (0.95 + Math.random() * 0.1));
    e.hp -= dmg;
    e.bump = Math.max(e.bump, 0.6);
    const col = mult > 1 ? 0xfff07a : mult < 1 ? 0xc9d6ff : 0xffffff;
    const n = txt(String(dmg), mult > 1 ? 24 : 19, col, mult > 1 ? 0xff6aa0 : 0x8a5fb8, 4);
    n.position.set(e.x + (Math.random() - 0.5) * e.r, e.y - e.r * 0.3);
    this.addFx(n, (Math.random() - 0.5) * 30, -70, 0.7, 0, 0, true);
    if (!quiet) play('light-hit', { pos: { x: e.x, y: e.y }, power: 0.9 });
    if (e.hp <= 0) this.kill(e);
    else this.drawEnemy(e);
    this.drawHud();
  }

  kill(e       ) {
    e.dead = true;
    e.hp = 0;
    this.drops[e.def.el] += e.def.boss ? 4 : 1;
    void core.sound?.playCue('sfx.kill', { eventId: eid('kill') });
    play('death-burst', { pos: { x: e.x, y: e.y }, power: e.def.boss ? 1.6 : 1 });
    // gem pickup flying to the panel
    const gem = new PIXI.Sprite(texNow(GEM_ICON[e.def.el]));
    gem.anchor.set(0.5);
    gem.scale.set(34 / 204);
    gem.position.set(e.x, e.y);
    this.addFx(gem, 0, -90, 1.0, 3, 160, true);
    const v = e.view;
    let k = 0;
    const pop = () => {
      k++;
      if (v.destroyed) return;
      v.scale.set(1 + k * 0.04);
      v.alpha = 1 - k / 14;
      if (k < 14) this.after(1 / 60, pop); else v.visible = false;
    };
    pop();
    if (e.def.boss) { this.bossActive = false; }
  }

  heal(amount        ) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const n = txt(`+${Math.round(this.hp - before)}`, 24, 0x8ff0b8, 0x3f9a6c, 4);
    n.position.set(W / 2, this.fb + 8);
    this.addFx(n, 0, -60, 0.9, 0, 0, true);
    for (const a of this.allies) play('heal-pulse', { pos: { x: a.x, y: a.y }, power: 0.7 });
    void core.sound?.playCue('sfx.heal', { eventId: eid('heal') });
  }

  triggerCombo(src      ) {
    src.comboUsed = true;
    src.spinV = 16;
    const m = TIER_COMBO[src.tier];
    const atk = src.atk * m;
    const el = src.def.el;
    const col = EL_COLOR[el];
    void core.sound?.playCue('sfx.combo', { eventId: eid('combo') });
    const nm = txt(t('combo_' + src.def.combo), 16, 0xffffff, col, 4);
    nm.position.set(src.x, src.y - ALLY_R - 14);
    this.addFx(nm, 0, -30, 0.9, 0, 0, true);
    const fb = this.fb;
    const beam = (horizontal         , width        ) => {
      const g = new PIXI.Graphics();
      if (horizontal) g.rect(0, src.y - width / 2, W, width).fill({ color: col, alpha: 0.55 }).rect(0, src.y - width / 6, W, width / 3).fill({ color: 0xffffff, alpha: 0.95 });
      else g.rect(src.x - width / 2, 0, width, fb).fill({ color: col, alpha: 0.55 }).rect(src.x - width / 6, 0, width / 3, fb).fill({ color: 0xffffff, alpha: 0.95 });
      this.addFx(g, 0, 0, 0.45, 0, 0, true);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = horizontal ? Math.abs(e.y - src.y) : Math.abs(e.x - src.x);
        if (d < e.r + width / 2) this.damage(e, atk * 0.75, el);
      }
    };
    switch (src.def.combo) {
      case 'laser': beam(true, 34 * (0.8 + 0.2 * m)); break;
      case 'cross': beam(true, 26); beam(false, 26); break;
      case 'blast': {
        const R = 150 + 28 * src.tier;
        const g = new PIXI.Graphics().circle(0, 0, R).fill({ color: col, alpha: 0.4 }).circle(0, 0, R * 0.6).fill({ color: 0xffffff, alpha: 0.6 });
        g.position.set(src.x, src.y);
        g.scale.set(0.3);
        this.addFx(g, 0, 0, 0.45, 0, 0, true, 2.2);
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - src.x, e.y - src.y) < R + e.r) this.damage(e, atk * 1.0, el);
        break;
      }
      case 'homing': {
        const targets = this.enemies.filter(e => !e.dead);
        if (!targets.length) break;
        for (let i = 0; i < 5; i++) {
          const tg = targets[i % targets.length];
          const g = new PIXI.Graphics().star(0, 0, 5, 9, 4).fill(0xffffff).stroke({ width: 2, color: col });
          const ang = (i / 5) * Math.PI * 2;
          g.position.set(src.x + Math.cos(ang) * 20, src.y + Math.sin(ang) * 20);
          this.fxLayer.addChild(g);
          this.homings.push({ o: g, x: g.x, y: g.y, target: tg, speed: 260, dmg: atk * 0.32, el });
        }
        break;
      }
      case 'heal': this.heal(this.maxHp * 0.04 * m); break;
    }
  }

  // ---------- tweens (floating text / gem fly-ins; hit feedback lives in @makeplay/fx) ----------
  addFx(o                , vx        , vy        , life        , spin        , grav        , fade         , grow = 0) {
    this.fxLayer.addChild(o);
    this.tweens.push({ o, vx, vy, life, max: life, spin, grav, fade, grow });
  }
  meteorFx(x        , y        , el         ) {
    const g = new PIXI.Graphics().star(0, 0, 5, 22, 10).fill(0xfff6c4).stroke({ width: 3, color: EL_COLOR[el] });
    g.position.set(x, y);
    this.addFx(g, 0, 0, 0.4, 6, 0, true, 1.5);
    play('fire-burst', { pos: { x, y }, power: 1.2 });
  }
  banner(s        , color        , life = 1.1) {
    const b = txt(s, 44, color, 0xa078d8, 7);
    b.position.set(W / 2, this.fb * 0.42);
    b.scale.set(0.6);
    this.addFx(b, 0, -12, life, 0, 0, true, 0.6);
  }
  redFlash() {
    play('damage-flash', { power: 1 });
  }
  after(sec        , fn            ) { this.timers.push({ t: sec, fn }); }
  wait(sec        ) { return new Promise      (res => this.after(sec, res)); }

  // ---------- input ----------
  onDown(e              ) {
    if (this.paused || this.destroyed) return;
    const p = toStage(e);
    if (Math.hypot(p.x - (W - 42), p.y - 42) < 34) { void core.sound?.playCue('ui.tap', { eventId: eid('tap') }); this.hooks.onPause(); return; }
    if (p.y > this.fb) return; // portrait cards are display-only: strikes auto-fire
    if (this.phase !== 'aim') return;
    this.aiming = true;
    this.aimStart = p;
    this.aimVec = { x: 0, y: 0 };
  }
  onMove(e              ) {
    if (!this.aiming || this.paused) return;
    const p = toStage(e);
    this.aimVec = { x: this.aimStart.x - p.x, y: this.aimStart.y - p.y };
  }
  onUp(e              ) {
    if (!this.aiming) return;
    this.aiming = false;
    this.aimG.clear();
    if (this.phase !== 'aim' || this.paused) return;
    const p = toStage(e);
    const dx = this.aimStart.x - p.x, dy = this.aimStart.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 22) return;
    this.launch(dx, dy, Math.min(1, len / 170));
  }

  // ---------- simulation ----------
  update(dt        ) {
    if (this.paused || this.destroyed) return;
    this.time += dt;
    // timers
    const due = this.timers.filter(tm => (tm.t -= dt) <= 0);
    if (due.length) { this.timers = this.timers.filter(tm => tm.t > 0); for (const tm of due) tm.fn(); }
    if (this.destroyed) return;
    if (this.phase === 'moving') this.stepBall(dt);
    this.stepCut(dt);
    // homing stars
    for (let i = this.homings.length - 1; i >= 0; i--) {
      const h = this.homings[i];
      h.speed += 900 * dt;
      const tx = h.target.x, ty = h.target.y;
      const d = Math.hypot(tx - h.x, ty - h.y);
      if (d < h.target.r * 0.6 || h.target.dead) {
        if (!h.target.dead) this.damage(h.target, h.dmg, h.el);
        h.o.destroy();
        this.homings.splice(i, 1);
        continue;
      }
      h.x += ((tx - h.x) / d) * h.speed * dt;
      h.y += ((ty - h.y) / d) * h.speed * dt;
      h.o.position.set(h.x, h.y);
      h.o.rotation += dt * 10;
    }
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const p = this.tweens[i];
      p.life -= dt;
      if (p.life <= 0 || p.o.destroyed) { if (!p.o.destroyed) p.o.destroy(); this.tweens.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.o.x += p.vx * dt; p.o.y += p.vy * dt;
      p.o.rotation += p.spin * dt;
      if (p.grow) p.o.scale.set(p.o.scale.x + p.grow * dt);
      if (p.fade) p.o.alpha = Math.min(1, (p.life / p.max) * 2.2);
    }
    // enemies idle bob + hit bump
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.bump = Math.max(0, e.bump - dt * 4);
      const bob = Math.sin(this.time * 2.2 + e.x * 0.05) * 3;
      e.sprite.y = bob;
      e.sprite.scale.set(e.baseScale * (1 + e.bump * 0.12), e.baseScale * (1 - e.bump * 0.08));
      e.sprite.tint = e.bump > 0.3 ? 0xffd0e0 : 0xffffff;
    }
    // allies
    this.allies.forEach((a, i) => {
      a.view.position.set(a.x, a.y);
      const isCur = i === this.cur && (this.phase === 'aim' || this.phase === 'moving');
      const moving = isCur && this.phase === 'moving';
      const ready = a.en >= ENERGY_MAX && this.phase !== 'over';
      const armedNow = isCur && this.armed;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      const col = EL_COLOR[a.def.el];
      // rolling portrait: spins with the shot and simply coasts to a stop at whatever angle it lands
      if (moving) a.spinV = (a.vx >= 0 ? 1 : -1) * Math.min(18, 4 + Math.hypot(a.vx, a.vy) / 170);
      else a.spinV *= Math.exp(-5 * dt);
      if (Math.abs(a.spinV) > 0.05) a.face.rotation = (a.face.rotation + a.spinV * dt) % (Math.PI * 2);
      else a.spinV = 0;
      a.view.zIndex = isCur ? 2 : ready ? 1 : 0;
      a.view.scale.set(isCur && !moving ? 1.14 + 0.06 * pulse : 1);
      const g = a.glow;
      g.clear();
      if (ready) {
        // strike shot charged: golden aura with orbiting stars; much bigger once armed
        const R2 = ALLY_R + (armedNow ? 22 : 10) + pulse * (armedNow ? 9 : 4);
        g.circle(0, 0, R2).fill({ color: 0xffd25a, alpha: armedNow ? 0.55 : 0.3 });
        g.circle(0, 0, R2).stroke({ width: armedNow ? 6 : 3, color: 0xffe9a0, alpha: 0.95 });
        if (armedNow) g.circle(0, 0, R2 + 12 + pulse * 10).stroke({ width: 4, color: 0xffffff, alpha: 0.75 - 0.5 * pulse });
        const n = armedNow ? 10 : 5;
        for (let k = 0; k < n; k++) {
          const ang = this.time * (armedNow ? 3.2 : 1.6) + (k / n) * Math.PI * 2;
          g.star(Math.cos(ang) * (R2 + 3), Math.sin(ang) * (R2 + 3), 4, armedNow ? 11 : 6, armedNow ? 4 : 2.2).fill(0xfff8d0);
        }
        if (Math.random() < dt * (armedNow ? 30 : 4)) {
          const s = new PIXI.Graphics().star(0, 0, 4, armedNow ? 9 : 6, armedNow ? 3 : 2).fill(armedNow ? 0xffffff : 0xffe08a);
          const ang = Math.random() * Math.PI * 2;
          s.position.set(a.x + Math.cos(ang) * ALLY_R, a.y + Math.sin(ang) * ALLY_R);
          this.addFx(s, Math.cos(ang) * (armedNow ? 120 : 30), Math.sin(ang) * (armedNow ? 120 : 30) - 50, 0.6, 6, 0, true);
        }
      }
      if (isCur) {
        const pr = ALLY_R + 8 + pulse * 5;
        g.circle(0, 0, pr).fill({ color: 0xffffff, alpha: 0.4 })
          .circle(0, 0, pr).stroke({ width: 5, color: armedNow ? 0xffd25a : 0xffffff, alpha: 0.98 })
          .circle(0, 0, pr + 6).stroke({ width: 3, color: col, alpha: 0.9 });
      }
      if (a.tier === 2) g.circle(0, 0, ALLY_R + 4).stroke({ width: 2, color: 0xffe08a, alpha: 0.5 + 0.3 * Math.sin(this.time * 3 + i) });
      // bouncing pointer above the heroine whose turn it is
      a.mark.clear();
      if (isCur && !moving) {
        const by = -ALLY_R - 24 - Math.abs(Math.sin(this.time * 5)) * 10;
        a.mark.poly([-14, by - 16, 14, by - 16, 0, by + 6]).fill(armedNow ? 0xffd25a : 0xffffff).stroke({ width: 3.5, color: col });
      }
    });
    // trail while moving
    if (this.phase === 'moving') {
      const a = this.allies[this.cur];
      if (Math.random() < 0.8) {
        const g = new PIXI.Graphics().circle(0, 0, 4 + Math.random() * 5).fill({ color: Math.random() < 0.5 ? 0xffffff : EL_COLOR[a.def.el], alpha: 0.8 });
        g.position.set(a.x + (Math.random() - 0.5) * 16, a.y + (Math.random() - 0.5) * 16);
        this.addFx(g, 0, 0, 0.35, 0, 0, true, -1.5);
      }
    }
    this.drawAim();
    if (this.hintText.visible) this.hintText.alpha = 0.75 + 0.25 * Math.sin(this.time * 4);
    // hp easing
    this.hpShown += (this.hp - this.hpShown) * Math.min(1, dt * 6);
    applyShake(this.scene, 1);
    this.drawHud();
  }

  drawAim() {
    const g = this.aimG;
    g.clear();
    if (!this.aiming || this.phase !== 'aim') return;
    const a = this.allies[this.cur];
    const len = Math.hypot(this.aimVec.x, this.aimVec.y);
    if (len < 8) return;
    const pw = Math.min(1, len / 170);
    const ux = this.aimVec.x / len, uy = this.aimVec.y / len;
    const L = 70 + 190 * pw;
    for (let d = ALLY_R + 8; d < L; d += 16) {
      const k = d / L;
      g.circle(a.x + ux * d, a.y + uy * d, 5.5 - k * 2).fill({ color: 0xffffff, alpha: 0.95 - k * 0.4 });
    }
    const tx = a.x + ux * L, ty = a.y + uy * L;
    const px = -uy, py = ux;
    g.poly([tx + ux * 16, ty + uy * 16, tx + px * 11, ty + py * 11, tx - px * 11, ty - py * 11]).fill({ color: this.armed ? 0xffd25a : 0xffffff }).stroke({ width: 2.5, color: EL_COLOR[a.def.el] });
    g.circle(a.x, a.y, ALLY_R + 12).stroke({ width: 4, color: EL_COLOR[a.def.el], alpha: 0.35 + pw * 0.5 });
  }

  stepBall(dt        ) {
    const a = this.allies[this.cur];
    this.shotT += dt;
    let speed = Math.hypot(a.vx, a.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 6));
    const h = dt / steps;
    const L = 12 + ALLY_R, R = W - 12 - ALLY_R, T = 12 + ALLY_R, B = this.fb - 10 - ALLY_R;
    for (const e of this.enemies) e.hitCd = Math.max(0, e.hitCd - dt);
    for (let s = 0; s < steps; s++) {
      a.x += a.vx * h; a.y += a.vy * h;
      let wall = false;
      if (a.x < L) { a.x = L; a.vx = Math.abs(a.vx); wall = true; }
      if (a.x > R) { a.x = R; a.vx = -Math.abs(a.vx); wall = true; }
      if (a.y < T) { a.y = T; a.vy = Math.abs(a.vy); wall = true; }
      if (a.y > B) { a.y = B; a.vy = -Math.abs(a.vy); wall = true; }
      if (wall) { a.vx *= 0.96; a.vy *= 0.96; void core.sound?.playCue('sfx.wall', { eventId: eid('wall') }); play('land-dust', { pos: { x: a.x, y: a.y }, power: 0.5 }); }
      for (const e of this.enemies) {
        if (e.dead) continue;
        // collide against the monster's traced silhouette (sprite bob included)
        const oy = e.sprite.y;
        const hit = circleVsShape(e.shape, e.shapeR, a.x - e.x, a.y - (e.y + oy), ALLY_R);
        if (!hit) continue;
        const nx = hit.nx, ny = hit.ny;
        if (a.def.shot === 'bounce') {
          a.x = e.x + hit.px; a.y = e.y + oy + hit.py;
          const vn = a.vx * nx + a.vy * ny;
          if (vn < 0) {
            a.vx -= 2 * vn * nx; a.vy -= 2 * vn * ny;
          }
        }
        if (e.hitCd <= 0) {
          e.hitCd = a.def.shot === 'bounce' ? 0.08 : 0.12;
          this.shotHits++;
          void core.sound?.playCue('sfx.hit', { eventId: eid('hit'), pitchSemitones: Math.min(this.shotHits, 14) * 0.5 });
          this.gainEnergy(a, ENERGY_HIT);
          this.damage(e, a.atk * (a.def.shot === 'pierce' ? 0.9 : 1) * this.boost, a.def.el);
          if (this.phase !== 'moving') return;
        }
      }
      for (const o of this.allies) {
        if (o === a || o.comboUsed) continue;
        if (Math.hypot(a.x - o.x, a.y - o.y) < ALLY_R * 2) { this.gainEnergy(a, ENERGY_ALLY); this.triggerCombo(o); }
      }
    }
    // friction: gentle exponential + linear, stronger after a while or when the wave is cleared
    const allDead = this.enemies.every(e => e.dead);
    const lin = 100 + (this.shotT > 5 ? 550 : 0) + (allDead ? 500 : 0);
    speed = Math.hypot(a.vx, a.vy);
    const ns = Math.max(0, speed * Math.exp(-0.4 * dt) - lin * dt);
    if (ns < 35) { this.endShot(); return; }
    a.vx *= ns / speed; a.vy *= ns / speed;
  }
}
