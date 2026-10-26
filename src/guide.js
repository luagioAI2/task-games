// 教学引导：向导葵在游玩中顺着玩家的操作一步步带路，不弹窗、不暂停。
// · 教程 10 步：每步一句话 + 场景里一只点按的小手指着该点的东西（不在画面里时，屏幕边缘出现“这边”提示条，
//   新一步开始时如果目标在画面外、玩家又没在拖动镜头，镜头会自己滑过去）；完成一步时葵夸一句 + 叮的一声。
// · 指向是“活的”：只指向此刻真正需要点的东西（矿工睡着才指矿工、电梯空闲才指电梯…），第 6 步会指向流水线上正在偷懒的那一环。
// · 教程之后是情境小提示：玩家停手几秒、没开面板时才冒出来，每条只出现一次，十来秒后自动收起，两条之间至少隔 25 秒。
// · 气泡可点：正在逐字显示时点一下直接显示全文；显示完再点就收成小头像（有新话时头像上亮红点），设置里也能关掉提示。
import * as W from './sim/world.js';
import * as E from './sim/economy.js';
import { t } from '../i18n.js';

const allSleep = (s) => !!s && s.unlocked && s.miners.length > 0 && s.miners.every((m) => m.ph === 'sleep');
const houseSleep = (h) => h.workers.length > 0 && h.workers.every((w) => w.ph === 'sleep');
// 第 6 步“多跑几趟”：指向流水线上此刻停着的那一环
function idleLink(st) {
  if (!st.shafts[0].mgr && allSleep(st.shafts[0])) return { k: 'miner', i: 0 };
  if (!st.elev.mgr && st.elev.ph === 'idle' && st.shafts.some((s) => s.crate > 0)) return { k: 'basket' };
  if (!st.house.mgr && houseSleep(st.house) && st.elev.top > 0) return { k: 'house' };
  return null;
}
function trainable(st) {
  for (const [k, i] of [['elev', 0], ['house', 0], ...st.shafts.map((x) => ['shaft', x.i])]) if (W.trainInfo(st, k, i)?.ready) return [k, i];
  return null;
}
const canBuyNext = (st) => { const n = W.nextLockedShaft(st); return !!n && n.i >= 2 && W.barrierAhead(st) === null && st.cash >= E.SHAFTS[n.i].buy; };

export const STEPS = [
  { done: (s) => s.shafts[0].unlocked, at: () => ({ k: 'newShaft' }) },
  { done: (s) => s.shafts[0].crate > 0 || s.elev.load > 0 || s.elev.top > 0 || s.lifetime > 0, at: (s) => (allSleep(s.shafts[0]) ? { k: 'miner', i: 0 } : null) },
  { done: (s) => s.elev.top > 0 || s.lifetime > 0, at: (s) => (s.elev.ph === 'idle' ? { k: 'basket' } : null) },
  { done: (s) => s.lifetime > 0, at: (s) => (houseSleep(s.house) ? { k: 'house' } : null) },
  { done: (s) => s.shafts[0].level > 1, at: () => ({ k: 'board', what: 'shaft', i: 0 }) },
  { done: (s) => s.cash >= 100 || s.shafts[0].mgr > 0, at: idleLink },
  { done: (s) => s.shafts[0].mgr > 0, at: () => ({ k: 'hire', what: 'shaft', i: 0 }) },
  { done: (s) => [s.elev, s.house, ...s.shafts].some((o) => o.boostT > 0 || o.cdT > 0), at: () => ({ k: 'skill', what: 'shaft', i: 0 }) },
  { done: (s) => s.elev.mgr > 0 && s.house.mgr > 0, at: (s) => (!s.elev.mgr ? { k: 'hire', what: 'elev', i: 0 } : { k: 'hire', what: 'house', i: 0 }) },
  { done: (s) => s.shafts[1].unlocked, at: () => ({ k: 'newShaft' }) },
];

export const TIPS = [
  { id: 'train', when: (s) => !!trainable(s), at: (s) => { const x = trainable(s); return x ? { k: 'mgr', what: x[0], i: x[1] } : null; } },
  { id: 'barrier', when: (s) => W.barrierAhead(s) !== null, at: () => ({ k: 'newShaft' }) },
  { id: 'nap', when: (s, g) => g.napT > 12, at: (s) => { const x = s.shafts.find((v) => !v.mgr && allSleep(v)); return x ? { k: 'miner', i: x.i } : null; } },
  { id: 'deeper', when: canBuyNext, at: () => ({ k: 'newShaft' }) },
  { id: 'invest', when: (s) => W.investorsClaimable(s) > 0, hud: 'shop' },
  { id: 'rank', when: (s) => s.lifetime >= 2e4, hud: 'rank' },
];
const TIP = Object.fromEntries(TIPS.map((x) => [x.id, x]));

export class Guide {
  constructor(game) {
    this.g = game; this.idleT = 0; this.napT = 0; this.tip = null; this.tipT = 0; this.tipGap = 8;
    this.praiseT = 0; this.praiseText = ''; this.nice = 0; this.lastId = null; this.panT = 0; this.panned = true; this.lastTarget = null;
  }
  // 玩家任何一次点按 / 拖动：提示要等玩家停手才出现
  activity() { this.idleT = 0; }
  update(dt) {
    const g = this.g, d = g.save.data, st = g.state, ui = g.ui, v = g.view;
    d.tips ??= {};
    this.idleT += dt;
    // 教程推进（满足条件就进入下一步，可能一次跳过几步）
    let advanced = false;
    while (d.tut < STEPS.length && STEPS[d.tut].done(st)) { d.tut++; advanced = true; }
    if (advanced) { g.persist(); this.praise(); }
    // 有矿道没雇管理员、矿工全睡着的持续时间
    this.napT = d.tut >= STEPS.length && st.shafts.some((s) => !s.mgr && allSleep(s)) ? this.napT + dt : 0;

    if (d.guideOff) { ui.guide(null); ui.guideHud(null); v.guideTarget = null; return; }
    const panelOpen = !ui.panel.hidden;
    let msg = null, anchor = null, hud = null;
    if (this.praiseT > 0) { this.praiseT -= dt; msg = { kind: 'praise', text: this.praiseText, id: 'praise' + this.nice }; }
    else if (d.tut < STEPS.length) { msg = { kind: 'tut', text: t('tut.' + d.tut), step: d.tut + 1, of: STEPS.length, id: 'tut' + d.tut }; anchor = STEPS[d.tut].at(st); }
    else {
      if (this.tip) {
        this.tipT -= dt;
        if (this.tipT <= 0 || !TIP[this.tip].when(st, this)) { this.tip = null; this.tipGap = 25; }
      } else if ((this.tipGap -= dt) <= 0 && this.idleT > 3 && !panelOpen) {
        const T = TIPS.find((x) => !d.tips[x.id] && x.when(st, this));
        if (T) { this.tip = T.id; this.tipT = 12; d.tips[T.id] = true; g.persist(); }
      }
      if (this.tip) { const T = TIP[this.tip]; msg = { kind: 'tip', text: t('tip.' + T.id), id: 'tip' + T.id }; anchor = T.at ? T.at(st) : null; hud = T.hud ?? null; }
    }
    const show = !!msg && !panelOpen;
    ui.guide(show ? msg : null, dt);
    ui.guideHud(show ? hud : null);
    const target = show && anchor ? v.anchor(anchor) : null;
    v.guideTarget = target;
    if (target) this.lastTarget = target;
    // 新的一句话开始：目标在画面外、玩家这会儿没在动镜头 → 稍等一下，镜头自己滑过去
    if (show && msg.id !== this.lastId) { this.lastId = msg.id; this.panT = 0.8; this.panned = false; }
    if (target && !this.panned && (this.panT -= dt) <= 0) {
      this.panned = true;
      if (!v.onScreen(target[1]) && v.sinceUserScroll() > 2.5) v.scrollTo(target[1] - v.viewH * 0.45, st);
    }
  }
  praise() {
    this.nice++; this.praiseText = t('guide.nice' + (this.nice % 3)); this.praiseT = 1.6;
    this.g.audio.play('guide');
    const p = this.lastTarget; if (p) this.g.view.floatText(p[0], p[1] - 24, '✓ ' + this.praiseText, '#ffe08a');
  }
}
