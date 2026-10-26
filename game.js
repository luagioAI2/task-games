// Moe Girl Strike — boot, layout and wiring.
import * as PIXI from 'pixi.js';
import { mountDisplay } from '@makeplay/display';
import { fxScreen } from './fx.js';
import { loadSoundSystem } from '@makeplay/sound';
                                                           
import { core, W, loadMany, setMusic } from './core.js';
import { loadSave, save } from './state.js';
import { setLang, pickLang, t, FONT } from './i18n.js';
import { initUI, layoutUI, showHome, refresh, seedScore } from './ui.js';
import { settlePurchases } from './purchase.js';
import { CHARS, GEM_ICON, charArt } from './data.js';

const host = document.getElementById('app') ;
const app = new PIXI.Application();
core.app = app;

const backSprite = new PIXI.Sprite();
const backTint = new PIXI.Graphics();
let backUrl = '';

function relayout(width        , height        ) {
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

async function setBackdrop(url        ) {
  if (backUrl === url) return;
  backUrl = url;
  const tx = await PIXI.Assets.load              (url).catch(() => null);
  if (!tx || backUrl !== url) return;
  backSprite.texture = tx;
  relayout(app.screen.width, app.screen.height);
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

async function boot() {
  loadSave();
  setLang(save.lang || pickLang(window.gp?.player?.user?.locale || navigator.language));
  await app.init({ resizeTo: host, autoDensity: true, antialias: true, background: 0xe9dcff });
  host.appendChild(app.canvas);
  const display = mountDisplay({ orientation: 'portrait', onResize: ({ width, height }) => relayout(width, height) });
  display.attachPixi(app);
  backSprite.anchor.set(0.5);
  app.stage.addChild(core.backdrop, core.root, fxScreen);
  core.backdrop.addChild(backSprite, backTint);
  const title = new PIXI.Text({ text: 'Moe Girl Strike', style: { fontFamily: FONT, fontSize: 46, fontStyle: 'italic', fontWeight: '900', fill: 0xffffff, stroke: { color: 0xb48ce0, width: 6 } } });
  title.anchor.set(0.5);
  const lt = new PIXI.Text({ text: t('loading'), style: { fontFamily: FONT, fontSize: 20, fontWeight: '800', fill: 0x8a6fc0 } });
  lt.anchor.set(0.5);
  loadLayer.addChild(loadBar, loadStar, title, lt);
  core.root.addChild(loadLayer);
  initUI(url => { void setBackdrop(url); });
  relayout(app.screen.width, app.screen.height);
  const placeLoad = () => { drawLoading(); title.position.set(W / 2, core.H * 0.3); lt.position.set(W / 2, core.H * 0.62 + 44); };
  placeLoad();
  core.relayoutHooks.push(placeLoad);
  const spin = (tk             ) => { loadStar.rotation += tk.deltaMS / 400; loadStar.scale.set(1 + 0.1 * Math.sin(performance.now() / 200)); };
  app.ticker.add(spin);
  app.render();
  window.__gpReady = true;

  window.addEventListener('pointerdown', onFirstGesture);
  window.addEventListener('keydown', onFirstGesture);
  window.addEventListener('pagehide', () => { void core.sound?.dispose(); }, { once: true });

  const soundP = loadSoundSystem({ manifestUrl: './sound.manifest.json' })
    .then(s => {
      core.sound = s                    ;
      if (save.muted) core.sound.settings.setMuted(true);
    })
    .catch(() => { /* game stays playable without audio */ });
  const urls = ['assets/bg/home.webp', ...Object.values(GEM_ICON), ...save.team.map(id => charArt(id, save.tiers[id] || 0))];
  await loadMany(urls, p => { loadP = p; drawLoading(); });
  await Promise.race([soundP, new Promise(r => setTimeout(r, 4000))]);
  app.ticker.remove(spin);
  core.relayoutHooks = core.relayoutHooks.filter(f => f !== placeLoad);
  loadLayer.destroy({ children: true });
  await setBackdrop('assets/bg/home.webp');
  showHome();
  window.__gpPlayable = true;
  // warm up the rest of the roster art in the background
  void loadMany(CHARS.map(c => charArt(c.id, 0)));
  // paid-but-undelivered heroines arrive before anything else can be bought
  void settlePurchases().then(n => { if (n > 0) { showHome(); refresh(); } });
  void window.gp?.player?.ready?.then(({ user }) => {
    if (user) seedScore();
    if (!save.lang && user?.locale) { setLang(pickLang(user.locale)); refresh(); }
  });
}

void boot();
