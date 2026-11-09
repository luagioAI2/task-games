// 入口与主循环：固定步长推进世界；拖动 / 滚轮 / 方向键滚动镜头，轻点（没拖动）才算点击；事件 → 音效 / 飘字；
// 教学向导；回来时结算离线收益；每 5 秒自动存档。
// 启动顺序：挂好画布 + 显示加载画面 → __gpReady → 按真实进度加载角色贴图 → 建世界 → __gpPlayable。
//
// ## 这个文件是**外壳**，两种形态共用
//
// | | 独立网页（`game.js`） | 插件（`plugin.js`） |
// | --- | --- | --- |
// | 挂到哪 | `document.body` 里的 `#mng-root` | `mount(container)` 给的那块 |
// | 资源 | `./` + 相对路径 | `ctx.assetUrl()` |
// | 存档 | `localStorage` | `host.storage` |
// | 收费 | 不传（不收费） | `plugin.js` 里扣完再进来 |
//
// 所以这里**没有** `if (isPlugin)` 分支 —— 差别全部通过 `start(opts)` 注入。
// （那种分支会随版本漂移，而且两种形态永远只有一种被跑到。）
//
// ## 从原版删掉的东西（接进小任务农场时拆的）
//
// 1. **内购**：`gp.pay` 皮肤商店、用平台硬币招募投资人、启动补发 `deliverPending()`。
//    宿主没有任何接口能让插件发起支付 —— 留着只会是「点了必然失败」的按钮。
//    皮肤改成**按累计收入解锁**（见 `src/data/skins.js`），投资人只留免费的重开矿场那条路。
// 2. **全服排行榜 + 登录云同步**：`submitRank()` / `openRank()` / `src/rank.js` / `LEADERBOARD.json`。
//    那要联网，插件里只会转圈。
// 3. **试玩模式**（设置里连点 5 下头像）：它靠 `save.qa` 关掉云存档，宿主里没有云存档可关；
//    而「给一大笔钱」在真 App 里等于一个作弊入口。
// 4. **首次进入的语言条**：宿主有自己的语言设置，游戏里再来一条会和孩子刚选的打架。
import * as PIXI from '../lib/pixi.min.js';
import { loadSoundSystem } from '@makeplay/sound';
import * as W from './sim/world.js';
import * as E from './sim/economy.js';
import { View, HOUSE_DOOR, rowTop } from './render/view.js';
import { Guide } from './guide.js';
import { skinById, SKINS } from './data/skins.js';
import { UI, setUiRoot } from './ui.js';
import { SoundBoard } from './audio.js';
import { Save, noStore } from './save.js';
import { CONFIG } from './config.js';
import { mountDom, unmountDom, applyDomTexts, setLoading } from './dom.js';
import { applyTokens } from '../ui-tokens.js';
import { LAYERS, SHAFTS_PER_LAYER } from './data/layers.js';
import { fmt, fmtClock } from './format.js';
import { ROW, SURF } from './art/backdrop.js';
import { CRATE_X, T_BOT } from './art/rock.js';
import { loadSprites, setAssetUrl } from './art/sprites.js';
import { t, setLang, detectLang, onLang } from '../i18n.js';

class Game {
  constructor(app, audio, save, root) {
    Object.assign(this, { app, audio, save, root });
    this.state = W.deserialize(save.data.world);
    this.view = new View(app); app.stage.addChild(this.view.root); this.measureInsets();
    this.view.skins = save.data.skins || {};   // 穿着的皮肤（解锁状态按累计收入现算，见 data/skins.js）
    this.ui = new UI(this);
    this.guide = new Guide(this);
    this.frames = { n: 0, sum: 0, max: 0, slow: 0, t0: performance.now() };
    this.acc = 0; this.saveT = 0; this.insetT = 0;
    this.audio.haptics = save.data.haptics !== false;
    this.view.cam.y = 0;
    app.ticker.add((tk) => {
      try { this.frame(Math.min(0.25, tk.deltaMS / 1000)); }
      catch (e) { this.fail(e); }
    });
    // 保底：万一 Pixi 一直没从宿主元素量出尺寸（面板刚挂载 / 尺寸还是 0），
    // 就主动按**容器**尺寸重设一次渲染器并重算视图 —— 否则整个画面会是空的。
    // ⚠️ 原来这里用的是 `window.innerWidth/innerHeight`。宿主里容器 ≠ 视口
    //    （上面有顶栏、下面有底栏），按视口设会把画布撑到比容器大 ⇒ 只看到左上角一块。
    this.watchdog = setInterval(() => {
      if (this.view.ready) { clearInterval(this.watchdog); this.watchdog = null; return; }
      const b = this.box();
      try { app.renderer.resize(b.w, b.h); } catch { /* 忽略 */ }
      this.measureInsets();
    }, 700);
  }
  /** 容器的尺寸（CSS 像素）。插件里容器 ≠ 视口，所有「铺满」都得按这个算。 */
  box() {
    const r = this.root?.getBoundingClientRect?.();
    return { w: Math.max(1, Math.round(r?.width || 0)), h: Math.max(1, Math.round(r?.height || 0)), top: r?.top || 0, bottom: r?.bottom || 0 };
  }
  // HUD 盖住的上 / 下边（CSS 像素）：顶部是现金 + 深度牌的底边，底部是竖屏操作栏的高度（横屏时没有）
  measureInsets() {
    const v = this.view, b = this.box(), h = b.h;
    this.els ??= { top: null, dock: null };
    const el = (k, sel) => (this.els[k] && this.els[k].isConnected ? this.els[k] : (this.els[k] = this.root.querySelector(sel)));
    const top = el('top', '.hud-left'), dock = el('dock', '.hud-dock');
    // ⚠️ `getBoundingClientRect()` 是**视口坐标**，容器不一定从 0 开始（宿主有顶栏）。
    //    不减去 `b.top` 的话，平板上 inset 会大出一个顶栏的高度 ⇒ 世界被往下压一截，
    //    而「画布尺寸 == 容器尺寸」的断言照样绿（那条断言根本不看这个数）。
    const t = top ? Math.max(0, top.getBoundingClientRect().bottom - b.top + 6) : 84;
    const dr = dock && dock.offsetParent !== null ? dock.getBoundingClientRect() : null;
    const bb = dr && dr.height > 0 ? Math.max(0, b.bottom - dr.top) : 0;
    // 量出来的值变了、画布尺寸变了、或者视图还没算出来（0×0 的启动瞬间）都要重算
    const sizeChanged = v.appW !== v.app.screen.width || v.appH !== v.app.screen.height;
    if (!sizeChanged && v.ready && Math.abs(t - (v.insetTpx ?? -1)) < 1 && Math.abs(bb - (v.insetBpx ?? -1)) < 1) return;
    v.insetTpx = t; v.insetBpx = bb; v.resize();
  }
  toggleHaptics() { this.save.data.haptics = this.save.data.haptics === false; this.audio.haptics = this.save.data.haptics; this.persist(); if (this.audio.haptics) this.audio.buzz(12); }
  focusStage() { this.root?.querySelector('#app')?.focus({ preventScroll: true }); }
  toggleSound() { this.save.data.sound = !this.save.data.sound; this.audio.setSfx(this.save.data.sound); this.persist(); }
  toggleMusic() { this.save.data.music = !this.save.data.music; this.audio.setMusic(this.save.data.music); this.persist(); }
  setLanguage(l) { this.save.data.lang = l; setLang(l); this.persist(); }
  persist() { this.save.data.world = W.serialize(this.state); this.save.data.lastSeen = Date.now(); this.save.write(); }
  resetGame() { this.save.clear(); this.state = W.newState(); this.view.cam.y = 0; this.view.skins = this.save.data.skins || {}; this.persist(); }
  // 穿上皮肤；skinId 为空 = 脱下来换回默认造型（extra 是管理员的 key）
  // 解锁门槛在 UI 层把关（`skinUnlocked`），这里只负责记下来。
  equipSkin(skinId, loud, mgrKey) {
    const d = this.save.data; d.skins ??= {};
    const S = skinId ? skinById(skinId) : null;
    if (S) d.skins[S.mgr] = S.id;
    else if (mgrKey) delete d.skins[mgrKey];
    this.view.skins = d.skins; this.persist();
    if (loud) { this.audio.play('hire'); this.ui.toast(t(S ? 'skin.on' : 'skin.off', { name: S ? t(S.name) : '' })); }
  }
  prestige() { const n = W.investorsClaimable(this.state), ns = W.prestige(this.state); if (!ns) return; this.state = ns; this.view.cam.y = 0; this.audio.play('layer'); this.ui.toast(t('toast.prestige', { n })); this.persist(); }

  frame(dt) {
    const st = this.state;
    const now = performance.now();
    this.acc += dt; let n = 0;
    while (this.acc >= W.DT && n < 100) { this.handle(W.step(st, W.DT)); this.acc -= W.DT; n++; }
    if (n >= 100) this.acc = 0;
    this.audio.beat.tick(performance.now()); this.view.beat = this.audio.beat.beats();   // 管理员跟着配乐节拍跳舞
    this.view.sync(st, dt);
    this.ui.updateHud(st, W.idleIncome(st).income, dt);
    this.guide.update(dt);
    if ((this.insetT -= dt) <= 0 || !this.view.ready) { this.insetT = 1; this.measureInsets(); }   // 还没量出画布尺寸时每帧重试
    // 配乐跟着镜头所在的深层走
    const li = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((this.view.cam.y + this.view.viewH / 2 - SURF) / (SHAFTS_PER_LAYER * ROW))));
    this.audio.setLayer(li);
    if ((this.saveT += dt) >= CONFIG.autosave) { this.saveT = 0; this.persist(); }
    // 帧耗时统计：滑块拖动时如果画面卡顿，指针事件会被排到帧后，感觉就是"点了要等一下"。
    const f = this.frames; f.n++; f.sum += now - f.t0; f.max = Math.max(f.max, now - f.t0); f.t0 = now; if (now - f.t0 > 24) f.slow++;
  }

  // 帧里只要有一处报错，整个世界都会不画（而 HUD 还在），现场很难判断。
  // 这里只报第一次：把错误写到屏幕上（`__mng.err()` 也读得到），并且本帧之后不再刷屏。
  fail(e) {
    if (this.err) return; this.err = e;
    console.error('frame error', e);
    const el = this.root?.querySelector('#boot-error');
    if (el) { el.hidden = false; el.textContent = `${e?.message || e}`; }
  }
  frameMs() {
    const f = this.frames, n = Math.max(1, f.n), r = { avg: +(f.sum / n).toFixed(2), max: +f.max.toFixed(2), frames: f.n };
    this.frames = { n: 0, sum: 0, max: 0, slow: 0, t0: performance.now() }; return r;
  }

  handle(ev) {
    const v = this.view;
    for (const e of ev) {
      if (e.type === 'deposit') { const y = SURF + e.shaft * ROW + T_BOT - 36; if (y > v.cam.y && y < v.cam.y + v.viewH) { v.floatText(CRATE_X - 26, y, `+${fmt(e.amount)}`); this.audio.play('deposit'); } }
      else if (e.type === 'sell') { if (v.cam.y < SURF) { v.floatText(HOUSE_DOOR, SURF - 120, `+$${fmt(e.amount)}`, '#b8ff8a'); } this.audio.play('sell'); }
      else if (e.type === 'elevUp') this.audio.play('creak');
    }
  }

  tap(h) {
    const st = this.state, a = this.audio;
    if (!h) return;
    if (h.kind === 'guideGo') { a.play('click'); this.view.scrollTo(h.ty - this.view.viewH * 0.45, st); return; }
    if (h.kind === 'shaft' || h.kind === 'elev' || h.kind === 'house') { if (W.tap(st, h.kind, h.i)) a.play('tap'); else a.play('pick'); return; }
    if (h.kind === 'level') { a.play('click'); this.ui.openLevel(h.what, h.i); return; }
    if (h.kind === 'mgr') { a.play('click'); if (W.trainInfo(st, h.what, h.i)?.ready) this.save.data.tips.train = true; this.ui.openMgr(h.what, h.i); return; }
    if (h.kind === 'skill') {
      const o = h.what === 'shaft' ? st.shafts[h.i] : h.what === 'elev' ? st.elev : st.house;
      if (W.useBoost(st, h.what, h.i)) { a.play('boost'); this.ui.toast(t('toast.skill')); } else { a.play('deny'); this.ui.toast(o.boostT > 0 ? t('toast.skillOn', { t: fmtClock(o.boostT) }) : t('toast.skillCd', { t: fmtClock(o.cdT) })); }
      return;
    }
    if (h.kind === 'barrier') {
      this.save.data.tips.barrier = true;
      const i = W.barrierAhead(st);
      if (!W.clearBarrier(st)) { a.play('deny'); this.ui.toast(t('toast.barrierShort', { c: '$' + fmt(E.BARRIERS[i] - st.cash) })); return; }
      a.play('unlock'); this.view.floatText(420, rowTop(i) + 60, t('float.barrier'), '#ffe08a'); this.persist();
      return;
    }
    if (h.kind === 'newShaft') {
      const i = W.buyShaft(st);
      if (i === null) { a.play('deny'); this.ui.toast(t('toast.short', { c: '$' + fmt(E.SHAFTS[W.nextLockedShaft(st).i].buy - st.cash) })); return; }
      a.play('unlock'); this.view.floatText(370, rowTop(i) + 60, t('float.newShaft', { n: i + 1 }), '#ffe08a');
      const li = i / SHAFTS_PER_LAYER;
      if (i % SHAFTS_PER_LAYER === 0 && i > 0 && !this.save.data.layers.includes(li)) { this.save.data.layers.push(li); a.play('layer'); this.ui.openLayer(li); }
      this.view.focusShaft(Math.min(i + 1, E.SHAFT_COUNT - 1), st); this.persist();
    }
  }
  onUpgrade(what, i) { this.persist(); this.view.upgradeFx(what, i); }
  onHire(what, i) { this.persist(); this.view.upgradeFx(what, i); }
  toggleGuide() { this.save.data.guideOff = !this.save.data.guideOff; this.persist(); }
}

/**
 * 启动。返回 `destroy()`（宿主切走游戏时调）。
 *
 * @param {object} o
 * @param {HTMLElement} o.mountTo    根元素挂到哪（插件 = 宿主容器，独立网页 = body 里的壳）
 * @param {(rel: string) => string} o.assetUrl  资源地址拼法（**必须给**，见文件头）
 * @param {object} o.store           存档后端（`src/host.js` 的 makeHostStore / makeLocalStore）
 * @param {() => void} [o.haptic]    宿主振动（插件里接 `host.haptic`）
 * @param {string} [o.locale]        宿主语言（'zh' / 'en' / 'ja'）
 * @param {() => void} [o.onReady]   可玩了（宿主用它推一条开局提示）
 * @param {boolean} [o.qa]           预览模式：不落盘、暴露 `__mng` 调试入口
 * @param {boolean} [o.safeArea]     让 CSS 保留安全区（独立网页 true，宿主 false）
 * @param {string} [o.cssText]       内联的样式表（插件用；不给就 fetch `styles.css`）
 */
export async function start(o) {
  const { mountTo, assetUrl, haptic, locale, onReady } = o;
  const QA = !!o.qa;
  const store = o.store || noStore();

  // ---- 资源 ----
  setAssetUrl(assetUrl);

  // ---- 根元素 ----
  // ★★ 每次挂载都给**自己的一块**，清理时只 `root.remove()`。
  //    复用容器 + `replaceChildren()` 的话，StrictMode 的双挂载会让先回来的那次
  //    把后来那份清掉 ⇒「ready 是 true 但 DOM 不在容器里」。
  const root = document.createElement('div');
  root.id = 'mng-root';
  mountTo.appendChild(root);

  // 容器尺寸写进 CSS 变量：样式里的 `Nvw / Nvh` 全被换成了它们（见 scoped-css.js）
  const applyBox = () => {
    const r = root.getBoundingClientRect();
    root.style.setProperty('--mng-w', Math.max(1, Math.round(r.width)) + 'px');
    root.style.setProperty('--mng-h', Math.max(1, Math.round(r.height)) + 'px');
  };
  applyBox();

  const cleanups = [];
  const on = (tgt, type, fn, opt) => { tgt.addEventListener(type, fn, opt); cleanups.push(() => tgt.removeEventListener(type, fn, opt)); };

  let app = null, sound = null, game = null, ro = null, tipT = 0;
  let dead = false;

  try {
    await mountDom(root, { cssUrl: assetUrl('styles.css'), cssText: o.cssText, assetUrl, safeArea: !!o.safeArea });
    applyTokens(root);          // ⚠️ 必须给 root：默认写 `document.documentElement`，会和宿主的同名变量打架
    setUiRoot(root);

    const save = new Save(store);
    // 语言：宿主给什么用什么（`ctx.locale`）；玩家自己在设置里选过的优先
    setLang(save.data.lang || detectLang(locale || navigator.language));
    // ★★ `mountDom()` 里已经填过一遍文字了，但那时用的还是**模块默认语言（日语）** ——
    //    不在这里再填一遍，界面上就会出现「静态文字是日语、实时数字是中文」的混排
    //    （实测：`ショップ` / `設定` 旁边写着「雇齐管理员才有闲置收入」）。
    applyDomTexts();

    const audio = new SoundBoard();
    audio.sfx = save.data.sound !== false; audio.music = save.data.music !== false;
    // 振动：插件里走宿主（`host.haptic` 自己还要过 App 设置里的开关），独立网页用 navigator.vibrate。
    // `audio.haptics` 由 Game 构造函数按存档里的开关赋值，这里只换「怎么震」。
    if (typeof haptic === 'function') {
      audio.buzz = (p) => { if (audio.haptics && p) { try { haptic(p); } catch { /* 无马达 */ } } };
    }

    // ① 引擎 + 画布
    const stageEl = root.querySelector('#stage');
    app = new PIXI.Application();
    await app.init({ resizeTo: stageEl, background: '#1b2340', antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
    if (dead) { app.destroy({ removeView: true }, { children: true, texture: false, baseTexture: false }); app = null; return () => {}; }
    stageEl.appendChild(app.canvas);

    // `resizeTo` 只听 window resize；预览面板 / 旋转时容器变了但窗口没变。
    // 同时盯容器本身：先让渲染器跟上，再重算视图与 CSS 变量。
    if (typeof ResizeObserver !== 'undefined') {
      let raf = 0;
      ro = new ResizeObserver(() => {
        applyBox();
        try { app.resize(); } catch { /* 忽略 */ }
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!dead) game?.measureInsets(); });
      });
      ro.observe(root);
    }
    const onResize = () => { applyBox(); game?.measureInsets(); setTimeout(() => { if (!dead) game?.measureInsets(); }, 120); };
    on(window, 'resize', onResize);
    // visualViewport 的 resize 在软键盘弹出 / 手势条出现时比 window resize 更早也更准
    if (window.visualViewport) on(window.visualViewport, 'resize', onResize);

    // ② 加载画面已显示（DOM 覆盖层，升降篮跟着真实加载进度下降）→ ③ ready
    window.__gpReady = true;
    // 加载时小提示轮换（和进度无关，所以画面里一直有东西在动）
    let tipN = 0; const tipEl = root.querySelector('.ld-tip');
    tipT = setInterval(() => { if (!tipEl || dead) return; tipN++; tipEl.textContent = t('boot.tip' + (tipN % 3)); tipEl.classList.remove('pop'); void tipEl.offsetWidth; tipEl.classList.add('pop'); }, 3600);

    // ④ 慢活：字体、角色贴图、声音
    loadSoundSystem({ manifestUrl: assetUrl('sound.manifest.json') })
      .then((s) => { if (dead) { try { void s.dispose(); } catch { /* 忽略 */ } return; } sound = s; audio.attach(s); })
      .catch((e) => console.warn('sound unavailable', e));
    await document.fonts?.load('800 20px "Baloo 2"').catch(() => {});
    await loadSprites((p) => setLoading(p));
    if (dead) return () => {};

    game = new Game(app, audio, save, root);
    // 切语言 → 重填界面。★ 必须留一个退订函数：这个监听器闭包里抓着**这一局**的
    // `game`，卸载后 `game` 是 null，而下次挂载时 `setLang()` 会把老监听器也叫一遍
    // ⇒ `Cannot read properties of null (reading 'ui')`（实测过）。
    const offLang = onLang(() => { if (dead) return; applyDomTexts(); game?.ui?.relabel(); });
    cleanups.push(offLang);

    // —— 声音解锁：只在真实手势里 ——
    const unlockSound = () => {
      if (!sound || audio.unlocked) return;
      sound.unlock().then(() => { audio.onUnlocked(); return sound.preload('gameplay'); }).catch(() => {});
    };

    // —— 输入：拖动滚动 / 轻点 ——
    let down = null;
    on(stageEl, 'pointerdown', (e) => {
      game.guide.activity(); unlockSound();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      game.focusStage();
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, lastY: e.clientY, t: performance.now(), t0: performance.now(), drag: false, vy: 0, slop: e.pointerType === 'mouse' ? 6 : 14 };
      game.view.cam.vy = 0; game.view.cam.target = null;
      try { stageEl.setPointerCapture(e.pointerId); } catch { /* 部分环境不支持 */ }
      // 按下的一瞬间就给反馈：手指下的东西可以点时，它先往下一沉（松手才真正触发）
      const r = stageEl.getBoundingClientRect(); game.view.pressAt(game.view.hitAt(e.clientX - r.left, e.clientY - r.top));
    });
    on(stageEl, 'pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dy = e.clientY - down.lastY;
      // 触屏的手指天生会晃：按下后 14px 以内都算“点”（鼠标 6px），超过才算拖动
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > down.slop) { down.drag = true; game.view.dragging = true; game.view.pressAt(null); }
      if (down.drag) { game.view.scrollBy(-dy / game.view.scale, game.state); const now = performance.now(); down.vy = -dy / game.view.scale / Math.max(0.008, (now - down.t) / 1000); down.t = now; }
      down.lastY = e.clientY;
    });
    const end = (e, cancel) => {
      if (!down || e.pointerId !== down.id) return;
      game.view.pressAt(null);
      // 点击判定用按下时的位置（手指抬起时常常会滑开几像素）
      if (!down.drag && !cancel) { const r = stageEl.getBoundingClientRect(), px = down.x - r.left, py = down.y - r.top, h = game.view.hitAt(px, py); game.view.tapFx(px, py, !!h); game.view.popAt(h); game.tap(h); }
      else if (down.drag) game.view.cam.vy = Math.max(-3000, Math.min(3000, down.vy));
      game.view.dragging = false; down = null;
    };
    on(stageEl, 'pointerup', (e) => end(e, false));
    on(stageEl, 'pointercancel', (e) => end(e, true));
    on(stageEl, 'wheel', (e) => { e.preventDefault(); game.guide.activity(); game.view.scrollBy(e.deltaY * 0.8 / game.view.scale, game.state); }, { passive: false });
    on(stageEl, 'contextmenu', (e) => e.preventDefault());
    // 键盘挂在**根元素**上（不是 window）：宿主里还有别的输入框，
    // 全局抢方向键会让家长在设置页里打不了字。
    on(root, 'keydown', (e) => {
      unlockSound();
      if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
      const v = game.view;
      if (e.code === 'ArrowUp' || e.code === 'PageUp') { e.preventDefault(); v.scrollTo(v.cam.y - (e.code === 'PageUp' ? v.viewH * 0.8 : ROW), game.state); }
      if (e.code === 'ArrowDown' || e.code === 'PageDown') { e.preventDefault(); v.scrollTo(v.cam.y + (e.code === 'PageDown' ? v.viewH * 0.8 : ROW), game.state); }
      if (e.code === 'Home') v.scrollTo(0, game.state);
      if (e.code === 'Escape' && !game.ui.panel.hidden) game.ui.close();
    });

    // —— 离线收益 ——
    const checkOffline = () => {
      const last = save.data.lastSeen; if (!last) return;
      const awayS = (Date.now() - last) / 1000; if (awayS < 60) return;
      const info = W.offlineIncome(game.state, awayS); save.data.lastSeen = Date.now();
      if (!game.ui.panel.hidden && game.ui.open?.type === 'offline') return;
      game.ui.openOffline({ ...info, away: awayS }, () => { W.collectOffline(game.state, info.cash); game.persist(); });
    };
    on(document, 'visibilitychange', () => { if (document.hidden) game.persist(); else checkOffline(); });
    on(window, 'pagehide', () => game.persist());
    checkOffline();
    if (!save.data.lastSeen) game.persist();

    const ld = root.querySelector('#loading'); clearInterval(tipT); tipT = 0;
    ld.classList.add('done'); setTimeout(() => { if (ld) ld.hidden = true; }, 450);
    window.__gpPlayable = true;
    onReady?.();

    // 调试入口：e2e 要能走到中后期（矿道 / 管理员 / 皮肤），只读 + 少量便捷方法。
    // ★ 卸载时必须摘掉（按身份比较），否则下一次挂载会读到上一次的 `game` ⇒ 假通过。
    const dbg = {
      game, W, E, get state() { return game.state; },
      cash: (n) => { game.state.cash += n; },
      run: (sec) => { const n = Math.round(sec / W.DT); for (let i = 0; i < n; i++) game.handle(W.step(game.state, W.DT)); },
      setup: (q = {}) => {
        const s = game.state, k = q.shafts ?? 3, m = q.mgr ?? 1;
        for (let i = 0; i < k; i++) { Object.assign(s.shafts[i], { unlocked: true, level: q.level ?? 20, mgr: m }); if (E.BARRIERS[i]) s.barriers[i] = true; }
        Object.assign(s.elev, { level: q.level ?? 20, mgr: m }); Object.assign(s.house, { level: q.level ?? 20, mgr: m });
        game.save.data.tut = q.tut ?? 99; game.save.data.tips = q.tips ?? { train: true, barrier: true };
        s.cash = q.cash ?? 1e6; if (q.lifetime != null) s.lifetime = q.lifetime;
      },
      scroll: (y) => { game.view.cam.y = y; game.view.cam.target = null; },
      tap: (kind, what, i) => game.tap({ kind, what, i }),
      lang: (l) => game.setLanguage(l),
      skins: () => { game.save.data.skins = {}; game.persist(); game.ui.shopTab = 'skins'; return SKINS.map((s) => s.id); },
      wear: (id) => { game.equipSkin(id, true); return game.save.data.skins; },
      frameMs: () => game.frameMs(),
      err: () => game.err || null,
    };
    window.__mng = dbg;

    if (QA) {
      // ?fresh：临时开一局干净的（不落盘，因为 ?qa 用的是 noStore）
      if (new URLSearchParams(location.search).has('fresh')) { game.state = W.newState(); }
    }

    // ---- 卸载 ----
    return function destroy() {
      dead = true;
      if (tipT) { clearInterval(tipT); tipT = 0; }
      if (game?.watchdog) { clearInterval(game.watchdog); game.watchdog = null; }
      for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* 忽略 */ } }
      try { ro?.disconnect(); } catch { /* 忽略 */ }
      try { game?.ui?.destroy?.(); } catch { /* 忽略 */ }
      // ★★ `texture: false` 是**故意的**：`art/*` 与 `render/view.js` 的贴图缓存都是模块级的，
      //    销毁纹理后下一次挂载会拿到已销毁的 Texture ⇒ 白屏，而且**一个错都不报**。
      //    `removeView: true` 把 canvas 摘掉；stage 的子树照样要 destroy，否则容器切几次就漏一份。
      try { app?.destroy({ removeView: true }, { children: true, texture: false, baseTexture: false }); } catch { /* 忽略 */ }
      try { if (sound) void sound.dispose(); } catch { /* 忽略 */ }
      try { document.querySelectorAll('style[data-mng-css]').forEach((el) => el.remove()); } catch { /* 忽略 */ }
      try { if (window.__mng === dbg) delete window.__mng; } catch { /* 忽略 */ }
      try { if (window.__gpPlayable === true) delete window.__gpPlayable; } catch { /* 忽略 */ }
      try { if (window.__gpReady === true) delete window.__gpReady; } catch { /* 忽略 */ }
      unmountDom();
      try { root.remove(); } catch { /* 忽略 */ }
      app = null; sound = null; game = null;
      setAssetUrl(null);
    };
  } catch (e) {
    // 启动失败也要把根摘掉，否则容器里留着一块「加载中」永远不动
    dead = true;
    if (tipT) clearInterval(tipT);
    for (const fn of cleanups.splice(0)) { try { fn(); } catch { /* 忽略 */ } }
    try { ro?.disconnect(); } catch { /* 忽略 */ }
    try { app?.destroy({ removeView: true }, { children: true, texture: false, baseTexture: false }); } catch { /* 忽略 */ }
    try { document.querySelectorAll('style[data-mng-css]').forEach((el) => el.remove()); } catch { /* 忽略 */ }
    unmountDom();
    try { root.remove(); } catch { /* 忽略 */ }
    throw e;
  }
}
