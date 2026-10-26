// 入口与主循环：固定步长推进世界；拖动 / 滚轮 / 方向键滚动镜头，轻点（没拖动）才算点击；事件 → 音效 / 飘字；
// 教学向导；回来时结算离线收益；每 5 秒自动存档。?qa 暴露调试接口（不读写存档）。
// 启动顺序：挂好画布 + 显示加载画面 → __gpReady → 按真实进度加载角色贴图 → 建世界 → __gpPlayable。
import * as PIXI from '../lib/pixi.min.js';
import { loadSoundSystem } from '@makeplay/sound';
import * as W from './sim/world.js';
import * as E from './sim/economy.js';
import { View, HOUSE_DOOR, rowTop } from './render/view.js';
import { Guide } from './guide.js';
import { skinById, skinByPayId, SKINS } from './data/skins.js';
import { UI } from './ui.js';
import { SoundBoard } from './audio.js';
import { Save } from './save.js';
import { CONFIG } from './config.js';
import { mountDom, applyDomTexts, setLoading, langStrip } from './dom.js';
import { applyTokens } from '../ui-tokens.js';
import { LAYERS, SHAFTS_PER_LAYER } from './data/layers.js';
import { fmt, fmtClock } from './format.js';
import { ROW, SURF } from './art/backdrop.js';
import { CRATE_X, T_BOT } from './art/rock.js';
import { loadSprites } from './art/sprites.js';
import { t, setLang, getLang, detectLang, onLang, LANGS, LANG_LABEL } from '../i18n.js';

const params = new URLSearchParams(location.search);
const QA = params.has('qa');

// —— 声音：唯一的运行时；解锁只在真实手势里 ——
let sound = null;
const audio = new SoundBoard();
function unlockSound() {
  if (!sound || audio.unlocked) return;
  sound.unlock().then(() => { audio.onUnlocked(); return sound.preload('gameplay'); }).catch(() => {});
}
window.addEventListener('pointerdown', () => unlockSound(), { capture: true });
window.addEventListener('keydown', () => unlockSound(), { capture: true });

import { rankScore } from './rank.js';

class Game {
  constructor(app, audio, save) {
    Object.assign(this, { app, audio, save });
    // 旧经济的存档（econ < 3）在这里被换算到新的 T 量级；换算后的累计收入就是这位玩家在新榜单上的成绩
    const migrated = !!save.data.world && save.data.world.econ !== W.ECON;
    this.state = W.deserialize(save.data.world);
    if (params.has('fresh')) this.state = W.newState();
    // 硬币买来的投资人永远保留（旧存档搬到新经济时也不会被压掉）
    this.state.investors = Math.max(this.state.investors, save.data.paidInv || 0);
    this.view = new View(app); app.stage.addChild(this.view.root); this.measureInsets();
    this.view.skins = save.data.skins || {};   // 已装备的皮肤（皮肤商店）
    this.ui = new UI(this);
    this.guide = new Guide(this);
    this.frames = { n: 0, sum: 0, max: 0, slow: 0, t0: performance.now() };
    // 老玩家第一次打开新版：立刻存一次档，并在 3 秒后把换算好的成绩交到新榜单（旧榜单由平台归档，不能直接换算）
    this.acc = 0; this.saveT = 0; this.rankT = migrated ? 3 : 20; this.rankSent = 0; this.rankBusy = null; this.insetT = 0;
    if (migrated) this.persist();
    this.audio.haptics = save.data.haptics !== false;
    this.view.cam.y = 0;
    app.ticker.add((tk) => {
      try { this.frame(Math.min(0.25, tk.deltaMS / 1000)); }
      catch (e) { this.fail(e); }
    });
    // 保底：万一 Pixi 一直没从宿主元素量出尺寸（面板刚挂载 / 尺寸还是 0），
    // 就主动按窗口尺寸重设一次渲染器并重算视图——否则整个画面会是空的。
    this.watchdog = setInterval(() => {
      if (this.view.ready) { clearInterval(this.watchdog); this.watchdog = null; return; }
      try { app.renderer.resize(window.innerWidth || 1, window.innerHeight || 1); } catch { /* 忽略 */ }
      this.measureInsets();
    }, 700);
    const onResize = () => { this.measureInsets(); setTimeout(() => this.measureInsets(), 120); };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
  }
  // HUD 盖住的上 / 下边（CSS 像素）：顶部是现金 + 深度牌的底边，底部是竖屏操作栏的高度（横屏时没有）
  measureInsets() {
    const v = this.view, h = window.innerHeight || 1;
    this.els ??= { top: null, dock: null };
    const el = (k, sel) => (this.els[k] && this.els[k].isConnected ? this.els[k] : (this.els[k] = document.querySelector(sel)));
    const top = el('top', '.hud-left'), dock = el('dock', '.hud-dock');
    const t = top ? Math.max(0, top.getBoundingClientRect().bottom + 6) : 84;
    const dr = dock && dock.offsetParent !== null ? dock.getBoundingClientRect() : null;
    const bb = dr && dr.height > 0 ? Math.max(0, h - dr.top) : 0;
    // 量出来的值变了、画布尺寸变了、或者视图还没算出来（0×0 的启动瞬间）都要重算
    const sizeChanged = v.appW !== v.app.screen.width || v.appH !== v.app.screen.height;
    if (!sizeChanged && v.ready && Math.abs(t - (v.insetTpx ?? -1)) < 1 && Math.abs(bb - (v.insetBpx ?? -1)) < 1) return;
    v.insetTpx = t; v.insetBpx = bb; v.resize();
  }
  toggleHaptics() { this.save.data.haptics = this.save.data.haptics === false; this.audio.haptics = this.save.data.haptics; this.persist(); if (this.audio.haptics) this.audio.buzz(12); }
  focusStage() { document.getElementById('app')?.focus({ preventScroll: true }); }
  toggleSound() { this.save.data.sound = !this.save.data.sound; this.audio.setSfx(this.save.data.sound); this.persist(); }
  toggleMusic() { this.save.data.music = !this.save.data.music; this.audio.setMusic(this.save.data.music); this.persist(); }
  setLanguage(l) { this.save.data.lang = l; setLang(l); this.persist(); }
  // 全服排行榜：提交累计收入。只在分数比上次提交的高时才提交；平台只保留每人最高分。
  // 时机：开局 20 秒后、之后每 3 分钟检查一次、打开排行榜时、投资人重开 / 硬币招募时、开新矿道 / 炸岩障时。
  submitRank() {
    const P = window.gp?.player, score = rankScore(this.state.lifetime);
    if (QA || this.sandbox || !P?.submitScore || score <= 0) return Promise.resolve(null);   // 试玩模式的钱不上榜
    if (score <= this.rankSent && this.rankLast) return Promise.resolve(this.rankLast);
    if (this.rankBusy) return this.rankBusy;
    this.rankBusy = P.submitScore(score).then((r) => { if (r && r.best != null) { this.rankSent = score; this.rankLast = r; } return r; }).catch(() => null).finally(() => { this.rankBusy = null; });
    return this.rankBusy;
  }
  // 试玩模式（设置里连点左上角头像 5 下打开）：给一大笔钱、打通到第 7 条矿道，方便体验后期。
  // 一旦打开就不再存档、不提交排行榜、不能用硬币购买；刷新页面就回到自己原本的进度（云端存档没被动过）。
  startSandbox() {
    const st = this.state;
    if (!this.sandbox) {
      this.sandbox = true; this.save.qa = true;   // 之后 save.write() 不再写云端
      const tag = document.createElement('div'); tag.className = 'sandbox-tag'; tag.textContent = t('sandbox.tag'); document.body.appendChild(tag);
    }
    st.cash += 5e12;
    for (let i = 0; i <= 6; i++) { const s = st.shafts[i]; if (!s.unlocked) { s.unlocked = true; s.level = Math.max(s.level, 40); } if (!s.mgr) s.mgr = 1; }
    st.barriers[3] = true; st.barriers[6] = true;
    if (!st.elev.mgr) st.elev.mgr = 1; if (!st.house.mgr) st.house.mgr = 1;
    st.elev.level = Math.max(st.elev.level, 60); st.house.level = Math.max(st.house.level, 60);
    this.audio.play('unlock'); this.ui.close(); this.ui.toast(t('sandbox.on'));
  }
  persist() { this.save.data.world = W.serialize(this.state); this.save.data.lastSeen = Date.now(); this.save.write(); }
  resetGame() { this.save.clear(); this.state = W.newState({ investors: this.save.data.paidInv || 0 }); this.view.cam.y = 0; this.view.skins = this.save.data.skins || {}; this.persist(); }
  // —— 商城：一次点击只发一次 purchase（进行中禁用按钮），不加自己的超时；成功后先发放并存档，再 ack
  async buyInvestor() {
    return this.buyItem({ itemId: E.SHOP.investorItem, title: t('shop.itemTitle'), desc: t('shop.itemDesc', { p: E.INVESTOR.bonus * 100 }), price: E.SHOP.investorCoins });
  }
  async buySkin(id) {
    const S = skinById(id); if (!S) return;
    // 注意：平台的 itemId 只允许 [A-Za-z0-9_.-]，皮肤 id 里的 @ 会让订单直接被判为 bad_request，所以用 S.pay
    return this.buyItem({ itemId: S.pay, title: t(S.name), desc: t(S.desc), price: S.coins });
  }
  async buyItem(o) {
    const pay = window.gp?.pay; if (!pay?.available || this.buying) return;
    if (this.sandbox) { this.audio.play('deny'); this.ui.toast(t('sandbox.noPay')); return; }   // 试玩模式不存档，真买了会丢，所以不让买
    this.buying = true; this.ui.refresh();
    let r = null;
    try { r = await pay.purchase({ itemId: o.itemId, title: o.title, desc: o.desc, price: o.price }); }
    catch { r = { ok: false, error: 'offline' }; }
    this.buying = false;
    if (r?.ok) this.grantPurchase(r.purchaseId, o.itemId, true);
    else {
      const e = r?.error;
      // declined = 玩家自己取消；insufficient / need_login = 平台弹窗已经给过引导；这几种都不再多说
      const msg = e === 'pending' ? 'shop.err.pending' : e === 'busy' ? 'shop.err.busy' : e === 'rate_limited' ? 'shop.err.later'
        : e === 'disabled' || e === 'offline' ? 'shop.err.off' : e === 'self_purchase' ? 'shop.err.self'
        : e === 'declined' || e === 'insufficient' || e === 'need_login' ? null : 'shop.err.fail';
      if (msg) this.ui.toast(t(msg));
    }
    this.ui.refresh();
    if (r?.ok) this.ui.doneFx(this.ui.shopBuy);
  }
  // 发放一笔购买（按 purchaseId 去重，和世界进度写在同一次存档里），然后 ack。返回这次是否真的新发了
  grantPurchase(purchaseId, itemId, loud) {
    const d = this.save.data; d.paidIds ??= [];
    let fresh = false;
    if (!d.paidIds.includes(purchaseId)) {
      if (itemId === E.SHOP.investorItem) {
        this.state.investors += 1; d.paidInv = (d.paidInv || 0) + 1;
        if (loud) { this.audio.play('hire'); this.ui.toast(t('shop.got', { p: Math.round(this.state.investors * E.INVESTOR.bonus * 100) })); if (this.ui.open?.type === 'shop') this.ui.panelFloat('+1', 'tier'); }
      } else if (skinByPayId(itemId)) {
        const S = skinByPayId(itemId);
        d.ownedSkins ??= []; if (!d.ownedSkins.includes(S.id)) d.ownedSkins.push(S.id);
        this.equipSkin(S.id, loud);
      } else {
        d.paidIds.push(purchaseId);
        try { void window.gp?.pay?.ack(purchaseId); } catch { /* 下次 pending() 还会出现 */ }
        return false;   // 不是本游戏认识的商品
      }
      d.paidIds.push(purchaseId); if (d.paidIds.length > 500) d.paidIds.splice(0, d.paidIds.length - 500);
      this.persist(); fresh = true;
      if (itemId === E.SHOP.investorItem) this.submitRank();   // 投资人变多了，榜上的进度也要跟上
    }
    try { void window.gp?.pay?.ack(purchaseId); } catch { /* 平台会重试，丢了下次 pending() 里还会出现 */ }
    return fresh;
  }
  // 穿上皮肤；skinId 为空 = 脱下来换回默认造型（extra 是管理员的 key）
  equipSkin(skinId, loud, mgrKey) {
    const d = this.save.data; d.skins ??= {};
    const S = skinId ? skinById(skinId) : null;
    if (S) { d.ownedSkins ??= []; if (!d.ownedSkins.includes(S.id)) d.ownedSkins.push(S.id); d.skins[S.mgr] = S.id; }
    else if (mgrKey) delete d.skins[mgrKey];
    this.view.skins = d.skins; this.persist();
    if (loud) { this.audio.play('hire'); this.ui.toast(t(S ? 'skin.on' : 'skin.off', { name: S ? t(S.name) : '' })); }
  }
  // 启动时补发“已付款但还没到账”的购买（比如上次付完款就关了页面）。查询失败就等下次启动，绝不当成空列表
  async deliverPending() {
    const pay = window.gp?.pay; if (!pay?.available || typeof pay.pending !== 'function') return;
    let r = null; try { r = await pay.pending(); } catch { return; }
    if (!r?.ok || !Array.isArray(r.items)) return;
    let n = 0;
    // 补发：投资人和皮肤都算（grantPurchase 按 purchaseId 去重）
    for (const it of r.items) if ((it?.itemId === E.SHOP.investorItem || skinByPayId(it?.itemId)) && this.grantPurchase(it.purchaseId, it.itemId, false)) n++;
    if (n > 0) { this.ui.toast(t('shop.restored2', { n })); this.ui.refresh(); }
  }
  prestige() { const n = W.investorsClaimable(this.state), ns = W.prestige(this.state); if (!ns) return; this.state = ns; this.view.cam.y = 0; this.audio.play('layer'); this.ui.toast(t('toast.prestige', { n })); this.persist(); this.submitRank(); }

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
    if ((this.rankT -= dt) <= 0) { this.rankT = 180; this.submitRank(); }
    // 帧耗时统计：滑块拖动时如果画面卡顿，指针事件会被排到帧后，感觉就是"点了要等一下"。
    // 这里只累加几次减法；?qa 下用 __dbg.frameMs() 读，?nofx 下砍掉最耗时的画布装饰做对比。
    const f = this.frames; f.n++; f.sum += now - f.t0; f.max = Math.max(f.max, now - f.t0); f.t0 = now; if (now - f.t0 > 24) f.slow++;
  }

  // 帧里只要有一处报错，整个世界都会不画（而 HUD 还在），现场很难判断。
  // 这里只报第一次：把错误写到屏幕上（?qa 看 __dbg.err()），并且本帧之后不再刷屏。
  fail(e) {
    if (this.err) return; this.err = e;
    console.error('frame error', e);
    const el = document.getElementById('boot-error');
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
      a.play('unlock'); this.view.floatText(420, rowTop(i) + 60, t('float.barrier'), '#ffe08a'); this.persist(); this.submitRank();
      return;
    }
    if (h.kind === 'newShaft') {
      const i = W.buyShaft(st);
      if (i === null) { a.play('deny'); this.ui.toast(t('toast.short', { c: '$' + fmt(E.SHAFTS[W.nextLockedShaft(st).i].buy - st.cash) })); return; }
      a.play('unlock'); this.view.floatText(370, rowTop(i) + 60, t('float.newShaft', { n: i + 1 }), '#ffe08a'); this.submitRank();
      const li = i / SHAFTS_PER_LAYER;
      if (i % SHAFTS_PER_LAYER === 0 && i > 0 && !this.save.data.layers.includes(li)) { this.save.data.layers.push(li); a.play('layer'); this.ui.openLayer(li); }
      this.view.focusShaft(Math.min(i + 1, E.SHAFT_COUNT - 1), st); this.persist();
    }
  }
  onUpgrade(what, i) { this.persist(); this.view.upgradeFx(what, i); }
  // 打倒一只晶簇魔物：第一次有提示；累计收入变了，存档并检查一次排行榜
  onHire(what, i) { this.persist(); this.view.upgradeFx(what, i); }
  toggleGuide() { this.save.data.guideOff = !this.save.data.guideOff; this.persist(); }
}

// 假钱包（仅 ?qa / ?mockpay）：让 gp.pay 看起来可用，购买立刻成功并返回一个唯一 purchaseId；ack/pending 都记在内存里。
// 正式发布时不会走这里（QA 为假、也没有 mockpay 参数），所以真玩家看到的仍是平台自己的支付弹窗。
function mockPay() {
  let seq = 0; const acked = new Set(), pending = [];
  window.gp = {
    ...(window.gp || {}),
    pay: {
      available: true,
      // 和平台一样地校一下：itemId 只允许 [A-Za-z0-9_.-]，价格必须是正整数硬币。不合格直接 bad_request，免得在预览里把 bug 藏起来
      async purchase(o) {
        if (!/^[A-Za-z0-9_.-]{1,64}$/.test(String(o?.itemId ?? '')) || !Number.isInteger(o?.price) || o.price < 1) return { ok: false, error: 'bad_request' };
        const id = `mock-${Date.now()}-${++seq}`; pending.push({ purchaseId: id, itemId: o.itemId }); return { ok: true, purchaseId: id };
      },
      async ack(id) { acked.add(id); const i = pending.findIndex((p) => p.purchaseId === id); if (i >= 0) pending.splice(i, 1); return { ok: true }; },
      async pending() { return { ok: true, items: pending.filter((p) => !acked.has(p.purchaseId)) }; },
    },
  };
}

async function boot() {
  await mountDom();
  applyTokens();
  const save = new Save(QA);
  // ?qa 时装一个假的平台钱包（不发真订单），方便在预览里试战斗和皮肤商店；?mockpay 给真人试用
  if (QA || params.has('mockpay')) mockPay();
  // 语言：玩家选过就用选过的，否则按系统语言（认不出来就日语）；第一次进来在 HUD 里挂一行小切换
  const firstRun = !save.data.langPicked;
  setLang(save.data.lang || detectLang(window.gp?.player?.user?.locale || navigator.language));
  applyDomTexts();
  audio.sfx = save.data.sound !== false; audio.music = save.data.music !== false;
  // ① 引擎 + 画布
  const stageEl = document.getElementById('stage');
  const app = new PIXI.Application();
  await app.init({ resizeTo: stageEl, background: '#1b2340', antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true, preference: 'webgl' });
  stageEl.appendChild(app.canvas);
  // #stage 是 #app 里铺满的固定盒子。预览面板换尺寸时不一定有 window resize，
  // 所以同时盯着这个盒子本身（resizeTo 管 Pixi 那侧，这里保证游戏视图跟着重算）。
  let game = null;
  if (typeof ResizeObserver !== 'undefined') {
    let raf = 0;
    new ResizeObserver(() => {
      // 舞台尺寸一变就让渲染器立刻跟上（resizeTo 只听 window resize，预览面板 / 旋转时可能慢一拍），然后重算视图
      try { app.resize(); } catch { /* 忽略 */ }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => game?.measureInsets());
    }).observe(stageEl);
  }
  // ② 加载画面已显示（DOM 覆盖层，升降篮跟着真实加载进度下降）→ ③ ready
  window.__gpReady = true;
  // 加载时小提示轮换（和进度无关，所以画面里一直有东西在动）
  let tipN = 0; const tipEl = document.querySelector('.ld-tip');
  const tipT = setInterval(() => { if (!tipEl) return; tipN++; tipEl.textContent = t('boot.tip' + (tipN % 3)); tipEl.classList.remove('pop'); void tipEl.offsetWidth; tipEl.classList.add('pop'); }, 3600);
  // ④ 慢活：字体、角色贴图、声音
  loadSoundSystem({ manifestUrl: './sound.manifest.json' }).then((s) => { sound = s; audio.attach(s); window.addEventListener('pagehide', () => { void s.dispose(); }, { once: true }); }).catch((e) => console.warn('sound unavailable', e));
  await document.fonts?.load('800 20px "Baloo 2"').catch(() => {});
  await loadSprites((p) => setLoading(p));
  game = new Game(app, audio, save);
  onLang(() => { applyDomTexts(); game.ui.relabel(); });

  // —— 输入：拖动滚动 / 轻点 ——
  let down = null;
  stageEl.addEventListener('pointerdown', (e) => {
    game.guide.activity();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    unlockSound(); game.focusStage();
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, lastY: e.clientY, t: performance.now(), t0: performance.now(), drag: false, vy: 0, slop: e.pointerType === 'mouse' ? 6 : 14 };
    game.view.cam.vy = 0; game.view.cam.target = null;
    try { stageEl.setPointerCapture(e.pointerId); } catch { /* 部分环境不支持 */ }
    // 按下的一瞬间就给反馈：手指下的东西可以点时，它先往下一沉（松手才真正触发）
    const r = stageEl.getBoundingClientRect(); game.view.pressAt(game.view.hitAt(e.clientX - r.left, e.clientY - r.top));
  });
  stageEl.addEventListener('pointermove', (e) => {
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
  stageEl.addEventListener('pointerup', (e) => end(e, false));
  stageEl.addEventListener('pointercancel', (e) => end(e, true));
  stageEl.addEventListener('wheel', (e) => { e.preventDefault(); game.guide.activity(); game.view.scrollBy(e.deltaY * 0.8 / game.view.scale, game.state); }, { passive: false });
  stageEl.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    unlockSound();
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    const v = game.view;
    if (e.code === 'ArrowUp' || e.code === 'PageUp') { e.preventDefault(); v.scrollTo(v.cam.y - (e.code === 'PageUp' ? v.viewH * 0.8 : ROW), game.state); }
    if (e.code === 'ArrowDown' || e.code === 'PageDown') { e.preventDefault(); v.scrollTo(v.cam.y + (e.code === 'PageDown' ? v.viewH * 0.8 : ROW), game.state); }
    if (e.code === 'Home') v.scrollTo(0, game.state);
    if (e.code === 'Escape' && !game.ui.panel.hidden) game.ui.close();
  });
  const away = () => game.persist();
  document.addEventListener('visibilitychange', () => { if (document.hidden) away(); else checkOffline(); });
  window.addEventListener('pagehide', away);

  // —— 离线收益 ——
  function checkOffline() {
    const last = save.data.lastSeen; if (!last) return;
    const awayS = (Date.now() - last) / 1000; if (awayS < 60) return;
    const info = W.offlineIncome(game.state, awayS); save.data.lastSeen = Date.now();
    if (!game.ui.panel.hidden && game.ui.open?.type === 'offline') return;
    game.ui.openOffline({ ...info, away: awayS }, () => { W.collectOffline(game.state, info.cash); game.persist(); });
  }
  checkOffline();
  if (!save.data.lastSeen) game.persist();

  const ld = document.getElementById('loading'); clearInterval(tipT); ld.classList.add('done'); setTimeout(() => { ld.hidden = true; }, 450);
  window.__gpPlayable = true;
  // 补发上次付了款却没来得及到账的购买（平台握手完成后再查，不卡启动）
  if (!QA) Promise.resolve(window.gp?.player?.ready).catch(() => {}).then(() => game.deliverPending());
  // 首次进入：深度牌下面挂一行小语言切换（不弹窗、不挡画面），第一次点世界或选过语言后收起
  let stripOn = false;
  const strip = langStrip({
    langs: LANGS, label: LANG_LABEL,
    onPick: (l) => { game.setLanguage(l); closeStrip(900); },   // 手动选择优先，且不写玩法存档
  });
  const closeStrip = (delay = 0) => {
    if (!stripOn) return; stripOn = false;
    game.save.data.langPicked = true; game.persist();
    setTimeout(() => strip.hide(), delay);
  };
  strip.set(getLang());
  if (firstRun) { stripOn = true; strip.show(); }
  stageEl.addEventListener('pointerdown', () => closeStrip(0));
  if (QA) {
    window.__debug = {
      game, W, E, get state() { return game.state; },
      cash: (n) => { game.state.cash += n; },
      run: (sec) => { const n = Math.round(sec / W.DT); for (let i = 0; i < n; i++) game.handle(W.step(game.state, W.DT)); },
      setup: (o = {}) => { const s = game.state, k = o.shafts ?? 3, m = o.mgr ?? 1; for (let i = 0; i < k; i++) { Object.assign(s.shafts[i], { unlocked: true, level: o.level ?? 20, mgr: m }); if (E.BARRIERS[i]) s.barriers[i] = true; } Object.assign(s.elev, { level: o.level ?? 20, mgr: m }); Object.assign(s.house, { level: o.level ?? 20, mgr: m }); game.save.data.tut = o.tut ?? 99; game.save.data.tips = o.tips ?? { train: true, barrier: true }; s.cash = o.cash ?? 1e6; },
      scroll: (y) => { game.view.cam.y = y; game.view.cam.target = null; },
      tap: (kind, what, i) => game.tap({ kind, what, i }),
      lang: (l) => game.setLanguage(l),
      // 战斗 / 皮肤调试
      skins: () => { game.save.data.ownedSkins = SKINS.map((s) => s.id); game.save.data.skins = {}; game.persist(); game.ui.shopTab = 'skins'; return game.save.data.ownedSkins; },
      wear: (id) => { game.equipSkin(id, true); return game.save.data.skins; },
    };
  }
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('boot-error');
  if (el) { el.hidden = false; el.textContent = t('boot.error', { m: e.message }); }
  const ld = document.getElementById('loading'); if (ld) ld.hidden = true;   // 启动失败时让出画面，错误信息才看得见
});
