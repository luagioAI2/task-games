// 少女战记 — boot, layout and wiring.
import * as PIXI from 'pixi.js';
import { mountDisplay } from '@makeplay/display';
import { fxScreen, resetFx } from './fx.js';
import { loadSoundSystem } from '@makeplay/sound';
import { core, W, loadMany, setMusic, resetCore } from './core.js';
import { setStore, loadSave, save } from './state.js';
import { setLang, pickLang, t, FONT } from './i18n.js';
import { initUI, layoutUI, showHome, refresh, setChargePlay, destroyUI, currentBattle } from './ui.js';
import { CHARS, GEM_ICON, charArt, localizeAssets } from './data.js';
import { setAssetBase } from './src/assets.js';
import { makeLocalStore } from './src/host.js';

/**
 * 启动。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，
 * 差别全部通过 `opts` 注入 —— 所以这个文件里没有任何 `if (isPlugin)` 分支
 * （那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `index.html` | 插件 |
 * | --- | --- | --- |
 * | 容器 | 不传（`#app`） | `mountTo` |
 * | 资源 | 不传（相对文档） | `assetBase`（`/games/moestrike/`） |
 * | 存档 | 不传（localStorage） | `store`（`host.storage`） |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * @returns {Promise<() => Promise<void>>} 卸载函数。**必须能在「刚建好就被调用」时安全执行**。
 */
export async function start(opts = {}) {
  const mountTo = opts.mountTo ?? null;
  const store = opts.store ?? null;
  const chargePlay = typeof opts.chargePlay === 'function' ? opts.chargePlay : null;
  /** 随机根类名：样式只在这个作用域里生效（见 `scope-css.js` 里的事故说明） */
  const scope = 'moestrike-' + Math.random().toString(36).slice(2, 8);
  let alive = true;

  // ---- 资源根 ----
  // 插件在 `blob:` 模块里跑，`assets/…` 会以 blob: 为基准 ⇒ 全 404。
  setAssetBase(opts.assetBase ?? '');

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 loadSave()：不 await 读到的是空 Map，
  //   症状是「进度从来没被恢复过」而且不报错。
  const storeImpl = store ?? makeLocalStore();
  if (!store) {
    try { await storeImpl.preload(); } catch (e) { console.warn('[moestrike] 读存档失败，按新档开始', e); }
  }
  setStore(storeImpl);
  loadSave();

  // ---- 运行时重置 ----
  // `core.root` / `core.backdrop` 是模块级的，上一次卸载时被 destroy 了；
  // 不换新的就是「第二次挂载什么都画不出来，且一个错都不报」。
  resetCore();
  // `fxScreen` / `fx` 也是模块级的，而且 `fxScreen` 挂在 app.stage 上会被
  // `app.destroy({children:true})` 连坐销毁 —— 必须一起换新。
  resetFx();

  // ---- 容器 ----
  // ★★ 判据用 **computed style**，不是 inline：宿主给的是 `<div class="absolute inset-0">`，
  //    `position:absolute` 写在**类**里，`style.position` 读出来是空串 ⇒ 误判「没定位」
  //    ⇒ 补 `relative`，而 inline 胜过类 ⇒ `inset-0` 的 `bottom` 失效 ⇒ 盒子退回内容高度
  //    （平板实测 966 → 600），而「canvas 高度 == 容器高度」的断言照样绿。
  const host = mountTo || document.getElementById('app') || document.body;
  const patchedPos = getComputedStyle(host).position === 'static';
  const prevStyle = { position: host.style.position, overflow: host.style.overflow };
  if (patchedPos) host.style.position = 'relative';
  host.style.overflow = 'hidden';

  const app = new PIXI.Application();
  core.app = app;

  const backSprite = new PIXI.Sprite();
  const backTint = new PIXI.Graphics();
  let backUrl = '';

  /**
   * ★ 布局的唯一依据是**宿主容器**，不是 `window`。
   *
   * `mountDisplay` 的 `onResize` 报的是 window 尺寸（那套运行时本来是给独立网页写的），
   * 而插件里容器只有 698 高（顶栏和底栏被宿主拿走了）。照 window 排版 ⇒
   * `core.H` 算成 1168、整层 UI 往下溢出 146px，「冒险」按钮落到容器外：
   * **看得见、点不到、一个错都不报**（真 App 的 e2e 就是这么红的，
   * 而单看截图、单数颜色、单验 canvas 铺满 —— 三条全绿）。
   */
  const hostBox = () => {
    const r = host.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };

  function relayout(width, height) {
    const h = Math.min(Math.max((W * height) / width, 960), 1200);
    core.H = h;
    core.scale = Math.min(width / W, height / h);
    core.offX = (width - W * core.scale) / 2;
    core.offY = (height - h * core.scale) / 2;
    core.root.scale.set(core.scale);
    core.root.position.set(core.offX, core.offY);
    const tx = backSprite.texture;
    if (tx && tx.width > 1) {
      const s = Math.max(width / tx.width, height / tx.height);
      backSprite.scale.set(s);
      backSprite.position.set(width / 2, height / 2);
    }
    // dim everything outside the portrait stage so it reads as a framed play area in wide windows
    const sw = W * core.scale, sh = h * core.scale;
    backTint.clear().rect(0, 0, width, height).fill({ color: 0xf2e6ff, alpha: 0.12 });
    if (core.offX > 0.5) backTint.rect(0, 0, core.offX, height).fill({ color: 0x1c1436, alpha: 0.62 }).rect(core.offX + sw, 0, width - core.offX - sw, height).fill({ color: 0x1c1436, alpha: 0.62 });
    if (core.offY > 0.5) backTint.rect(0, 0, width, core.offY).fill({ color: 0x1c1436, alpha: 0.62 }).rect(0, core.offY + sh, width, height - core.offY - sh).fill({ color: 0x1c1436, alpha: 0.62 });
    layoutUI();
    for (const f of core.relayoutHooks) f();
  }

  async function setBackdrop(url) {
    if (backUrl === url) return;
    backUrl = url;
    const tx = await PIXI.Assets.load(url).catch(() => null);
    if (!tx || backUrl !== url || !alive) return;
    backSprite.texture = tx;
    const b = hostBox();
    relayout(b.w, b.h);
  }

  // loading screen painted in pixi before assets arrive
  const loadLayer = new PIXI.Container();
  const loadBar = new PIXI.Graphics();
  const loadStar = new PIXI.Graphics().star(0, 0, 5, 30, 13).fill(0xffe08a).stroke({ width: 3, color: 0xffffff });
  let loadP = 0;
  function drawLoading() {
    const H = core.H;
    loadBar.clear()
      .rect(0, 0, W, H).fill(0xe9dcff)
      .roundRect(90, H * 0.62, W - 180, 18, 9).fill(0xffffff)
      .roundRect(93, H * 0.62 + 3, (W - 186) * loadP, 12, 6).fill(0xf48ab8);
    loadStar.position.set(W / 2, H * 0.5);
  }

  function onFirstGesture() {
    const s = core.sound;
    if (!s || core.unlocked) return;
    void s.unlock().then(() => {
      core.unlocked = true;
      setMusic(core.music);
    });
  }

  let display = null;
  let spin = null;
  let placeLoad = null;

  /* ======================= boot ======================= */
  setLang(save.lang || pickLang(navigator.language));
  await app.init({ resizeTo: host, autoDensity: true, antialias: true, background: 0xe9dcff });
  if (!alive) {
    // 孩子在 `app.init` 的这几百毫秒里切走了 —— 直接拆掉，别把画布留在宿主里
    try { app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false }); } catch { /* ignore */ }
    if (patchedPos) host.style.position = prevStyle.position;
    host.style.overflow = prevStyle.overflow;
    return async () => {};
  }
  host.appendChild(app.canvas);
  // ★ onResize 的参数（window 尺寸）**不能直接用** —— 见 `hostBox` 的注释。
  display = mountDisplay({ orientation: 'portrait', onResize: () => { const b = hostBox(); relayout(b.w, b.h); } });
  /**
   * 容器尺寸会**在没有 window resize 的情况下**变：宿主切 tab、底栏高度变、
   * 平板换布局都算。只听 window 会漏掉这些，UI 就停在旧尺寸上（不报错）。
   */
  const ro = new ResizeObserver(() => {
    if (!alive) return;
    const b = hostBox();
    relayout(b.w, b.h);
  });
  ro.observe(host);
  display.attachPixi(app);
  backSprite.anchor.set(0.5);
  app.stage.addChild(core.backdrop, core.root, fxScreen);
  core.backdrop.addChild(backSprite, backTint);

  const title = new PIXI.Text({ text: t('title'), style: { fontFamily: FONT, fontSize: 46, fontStyle: 'italic', fontWeight: '900', fill: 0xffffff, stroke: { color: 0xb48ce0, width: 6 } } });
  title.anchor.set(0.5);
  const lt = new PIXI.Text({ text: t('loading'), style: { fontFamily: FONT, fontSize: 20, fontWeight: '800', fill: 0x8a6fc0 } });
  lt.anchor.set(0.5);
  loadLayer.addChild(loadBar, loadStar, title, lt);
  core.root.addChild(loadLayer);

  // 元素图标与角色立绘的路径要在第一次 DOM 渲染之前就换成宿主绝对路径
  localizeAssets();
  initUI(url => { void setBackdrop(url); }, { host, scope });
  setChargePlay(chargePlay);
  { const b = hostBox(); relayout(b.w, b.h); }

  placeLoad = () => { drawLoading(); title.position.set(W / 2, core.H * 0.3); lt.position.set(W / 2, core.H * 0.62 + 44); };
  placeLoad();
  core.relayoutHooks.push(placeLoad);
  spin = (tk) => { loadStar.rotation += tk.deltaMS / 400; loadStar.scale.set(1 + 0.1 * Math.sin(performance.now() / 200)); };
  app.ticker.add(spin);
  app.render();
  window.__gpReady = true;

  window.addEventListener('pointerdown', onFirstGesture);
  window.addEventListener('keydown', onFirstGesture);

  // 音频清单与音频包都是**相对站点根**的 ⇒ baseUrl 取 assetBase
  const assetBase = opts.assetBase || '';
  const soundP = loadSoundSystem({ manifestUrl: assetBase + 'sound.manifest.json', baseUrl: assetBase })
    .then(s => {
      core.sound = s;
      if (save.muted) core.sound.settings.setMuted(true);
    })
    .catch(() => { /* game stays playable without audio */ });
  const urls = ['assets/bg/home.webp', ...Object.values(GEM_ICON), ...save.team.map(id => charArt(id, save.tiers[id] || 0))];
  await loadMany(urls, p => { loadP = p; if (alive) drawLoading(); });
  await Promise.race([soundP, new Promise(r => setTimeout(r, 4000))]);
  if (!alive) return destroy;

  app.ticker.remove(spin);
  spin = null;
  core.relayoutHooks = core.relayoutHooks.filter(f => f !== placeLoad);
  loadLayer.destroy({ children: true });
  await setBackdrop('assets/bg/home.webp');
  if (!alive) return destroy;
  showHome();
  window.__gpPlayable = true;
  // warm up the rest of the roster art in the background
  void loadMany(CHARS.map(c => charArt(c.id, 0)));

  /* ======================= destroy ======================= */
  /**
   * 卸载。宿主会在切 tab 时调它，所以**每一步都要单独 try**：
   * 一个 try 包住全部，前面那步抛了后面就全不执行（症状是「切回来黑屏」）。
   *
   * ★ PixiJS 的坑和 three 不同：这里没有 `forceContextLoss()`，
   *   但 `app.destroy()` 的第二个参数**不能**把 `texture` 也销毁 ——
   *   `core.js` 的 `texCache` 是模块级的，纹理被销毁之后第二次挂载
   *   拿到的是一堆已销毁的 Texture，画面全白**且不报错**。
   */
  async function destroy() {
    alive = false;
    try { ro.disconnect(); } catch { /* ignore */ }
    try { destroyUI(); } catch (e) { console.warn('[moestrike] 摘 UI 失败', e); }
    try { if (spin) app.ticker.remove(spin); } catch { /* ignore */ }
    try { core.sound?.dispose?.(); } catch { /* ignore */ }
    core.sound = null;
    core.unlocked = false;
    try {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    } catch { /* ignore */ }
    try { display?.dispose?.(); } catch { /* ignore */ }
    display = null;
    try {
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    } catch (e) { console.warn('[moestrike] 销毁 app 失败', e); }
    core.app = null;
    if (patchedPos) host.style.position = prevStyle.position;
    host.style.overflow = prevStyle.overflow;
    // 调试钩子必须摘干净：留着 `__gpPlayable` 会让下一次挂载「等它就绪」的判据立刻假通过
    try { delete window.__mgs; } catch { /* ignore */ }
    try { delete window.__gpReady; } catch { /* ignore */ }
    try { delete window.__gpPlayable; } catch { /* ignore */ }
  }

  // 调试钩子（e2e / 假宿主用）。
  // `battle` 走 getter：战斗对象每局都换，存快照会永远拿到第一局那个（甚至 null）。
  // 它的用途见 `ui.js` 的 `currentBattle()` 注释（一场要 6 分钟，e2e 跑不起）。
  window.__mgs = {
    save, core,
    get battle() { return currentBattle(); },
  };

  return destroy;
}
