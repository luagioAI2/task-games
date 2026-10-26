// DOM 界面：顶部现金 / 闲置收入、深度指示、镜头按钮、向导气泡、提示条；
// 面板：升级（数值行 + ×1/×10/×50/MAX）、管理员（雇佣 / 等级与培训 / 技能）、投资人、设置（含语言切换）、离线收益、新深层。
import * as E from './sim/economy.js';
import * as W from './sim/world.js';
import { LAYERS, SHAFTS_PER_LAYER } from './data/layers.js';
import { fmt, fmtSec, fmtTime, fmtClock } from './format.js';
import { portrait, guidePortrait, minerPortrait, mgrFace, mgrName, mgrJob, mgrTitled, mgrShafts, MANAGERS, faceCard, managerArt } from './art/chars.js';
import { SKINS, skinById, SKIN_ROLES, skinsByRole, skinsFor } from './data/skins.js';
import * as P from './art/props.js';
import { t, LANGS, LANG_LABEL, getLang } from '../i18n.js';

const MGR_INDEX = (key) => Math.max(0, MANAGERS.findIndex((m) => m.key === key));
// 皮肤页的管理员小头像（data URL，按管理员缓存；就是面板里用的圆形头像卡）
const FACE = {};
const faceSrc = (mgr) => (FACE[mgr] ??= faceCard(mgr, MANAGERS[MGR_INDEX(mgr)].bg).toDataURL());

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MGR_FACE = mgrFace;
const place = (what) => t('place.' + what);
const layerName = (li) => t(`L${li}.name`);
const SHOP_PRICE = E.SHOP.investorCoins;
// 榜单分数就是累计收入（美元整数），直接按游戏里的金额格式显示
const rankText = (score) => '$' + fmt(Math.max(0, Number(score) || 0));

export class UI {
  constructor(game) {
    this.game = game; this.panel = $('#panel'); this.hud = $('#hud'); this.open = null; this.bulk = 1; this.toastT = 0;
    this.drawGuideFace();
    UI.wirePress();
    this.bindSheetDrag();
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.panel.addEventListener('click', (e) => { if (e.target === this.panel) this.close(); });
    $('[data-act=close]', this.panel).addEventListener('click', () => { game.audio.play('click'); this.close(); });
    for (const b of this.hud.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.hud.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      game.audio.play('click');
      const a = b.dataset.act;
      if (a === 'shop') this.openShop(); else if (a === 'settings') this.openSettings(); else if (a === 'rank') this.openRank();
      else if (a === 'camUp') game.view.scrollTo(game.view.cam.y - game.view.viewH * 0.8, game.state);
      else if (a === 'camDown') game.view.scrollTo(game.view.cam.y + game.view.viewH * 0.8, game.state);
    });
    // 向导气泡：逐字显示中点一下 → 直接出全文；显示完再点 → 收成小头像；点头像 → 展开
    const gEl = $('.guide'), bub = $('.g-bubble'), face = $('.g-facebtn');
    for (const el of [bub, face]) el.addEventListener('pointerdown', (e) => { e.stopPropagation(); game.guide?.activity(); });
    const tapBubble = () => {
      if (this._gN < (this._gFull?.length ?? 0)) { this._gN = this._gFull.length; this.paintGuideText(); return; }
      gEl.classList.add('min'); this._gMin = true;
    };
    bub.addEventListener('click', () => tapBubble());
    bub.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapBubble(); } });
    face.addEventListener('click', () => { const min = !gEl.classList.contains('min'); gEl.classList.toggle('min', min); this._gMin = min; gEl.classList.remove('new'); });
  }
  drawGuideFace() { const g = $('.g-face').getContext('2d'); g.clearRect(0, 0, 192, 192); g.drawImage(guidePortrait(), 0, 0, 192, 192); }
  // 语言切换后：HUD 缓存清掉、打开的面板重画
  relabel() {
    this._cash = this._rate = this._dn = null; this._mgrSig = this._invSig = null; this._gKey = null;
    const o = this.open; if (!o) return;
    if (o.type === 'level') this.renderLevel(o.what, o.i, false); else if (o.type === 'mgr') this.renderMgr(o.what, o.i, false);
    else if (o.type === 'shop') this.openShop(); else if (o.type === 'settings') this.openSettings();
    else if (o.type === 'layer') this.openLayer(o.li); else if (o.type === 'rank') this.openRank();
  }

  // —— HUD ——
  updateHud(state, idle, dt) {
    this.el ??= { cash: $('.cash'), rate: $('.rate'), dname: $('.d-name'), ddepth: $('.d-depth'), depth: $('.hud-depth'), inv: $('[data-act=shop]'), badge: $('.badge') };
    const E = this.el;
    const cash = fmt(state.cash); if (this._cash !== cash) { this._cash = cash; E.cash.textContent = `$${cash}`; }
    const rate = idle > 0 ? t('hud.rate', { v: '$' + fmt(idle) }) : t('hud.noRate'); if (this._rate !== rate) { this._rate = rate; E.rate.textContent = rate; }
    const v = this.game.view, y = v.cam.y + v.viewH * 0.5, li = Math.floor((y - 420) / (SHAFTS_PER_LAYER * 150)), L = Math.min(Math.max(li, 0), LAYERS.length - 1);
    const name = li < 0 ? t('hud.town') : t('hud.layer', { n: L + 1, name: layerName(L) }), depth = li < 0 ? t('hud.surface') : t(`L${L}.depth`);
    if (this._dn !== name + depth) { this._dn = name + depth; E.dname.textContent = name; E.ddepth.textContent = depth; E.depth.dataset.layer = li < 0 ? 'town' : String(L); }
    // 商城按钮：平台能购买时一直在；否则和以前一样，有投资人相关的东西才出现
    // 商城按钮从开局就一直显示（用户要求）
    if (E.inv.hidden) E.inv.hidden = false;
    const badge = W.investorsClaimable(state) > 0; if (this._badge !== badge) { this._badge = badge; E.badge.hidden = !badge; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('.hud-toast').hidden = true; }
    if (this.open && (this._refresh = (this._refresh ?? 0) - dt) <= 0) { this._refresh = 0.2; this.refresh(); }
  }
  toast(text) { const el = $('.hud-toast'); el.textContent = text; el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); this.toastT = 2.6; }
  // 向导气泡：msg = { kind: 'tut' | 'tip' | 'praise', text, step?, of? } 或 null。全文先占好位置（透明），再逐字显出，气泡大小不跳。
  guide(msg, dt = 0) {
    const g = $('.guide');
    if (!msg) { if (!g.hidden) g.hidden = true; return; }
    if (g.hidden) g.hidden = false;
    const key = msg.kind + '|' + msg.text;
    if (this._gKey !== key) {
      this._gKey = key; this._gFull = msg.text; this._gN = msg.kind === 'praise' ? msg.text.length : 0;
      g.dataset.kind = msg.kind;
      const st = $('.g-step', g); st.textContent = msg.kind === 'tut' ? t('guide.step', { n: msg.step, m: msg.of }) : msg.kind === 'tip' ? t('guide.tip') : ''; st.hidden = msg.kind === 'praise';
      g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop');
      // 教程新一步会自动展开；提示在收起状态下只在头像上亮红点
      if (msg.kind === 'tut' && this._gMin && this._gStep !== msg.step) { this._gMin = false; g.classList.remove('min'); }
      if (msg.kind === 'tut') this._gStep = msg.step;
      g.classList.toggle('new', !!this._gMin && msg.kind !== 'praise');
      this.paintGuideText();
    }
    if (this._gN < this._gFull.length) {
      this._gN = Math.min(this._gFull.length, this._gN + dt * 34);
      // 逐字显示不必每帧都写 DOM（写文本会触发布局）：约 30Hz 更新一次
      this._gAcc = (this._gAcc ?? 0) + dt; if (this._gAcc >= 1 / 30 || this._gN >= this._gFull.length) { this._gAcc = 0; this.paintGuideText(); }
    }
  }
  paintGuideText() {
    const n = Math.ceil(this._gN), full = this._gFull ?? '', on = full.slice(0, n), rest = full.slice(n);
    const a = $('.g-on'), b = $('.g-ghost');
    if (a.textContent !== on) a.textContent = on;
    if (b.textContent !== rest) b.textContent = rest;
  }
  // 提示里说到的 HUD 按钮（投资人 / 排行榜）一闪一闪
  guideHud(act) {
    if (this._gHud === act) return; this._gHud = act;
    for (const b of this.hud.querySelectorAll('.ibtn.hl')) b.classList.remove('hl');
    if (act) $(`[data-act=${act}]`)?.classList.add('hl');
  }

  // —— 面板通用 ——
  show(title, sub, icon, tone = 'indigo') {
    this.panel.querySelector('.c-tabs')?.remove();   // 页签只属于商城，其他面板一律清掉
    $('.card', this.panel).classList.remove('is-shop', 'is-skins');
    if (this.skRaf) { cancelAnimationFrame(this.skRaf); this.skRaf = null; }
    $('.c-title', this.panel).textContent = title; $('.c-sub', this.panel).textContent = sub ?? '';
    $('.card', this.panel).dataset.tone = tone;
    const ctx = $('.c-icon', this.panel).getContext('2d'); ctx.clearRect(0, 0, 192, 192);
    if (icon) { const s = Math.min(176 / icon.width, 176 / icon.height); ctx.drawImage(icon, 96 - icon.width * s / 2, 96 - icon.height * s / 2, icon.width * s, icon.height * s); }
    this.panel.hidden = false; this.hud.classList.add('under');
  }
  close() { if (this.skRaf) { cancelAnimationFrame(this.skRaf); this.skRaf = null; } this.panel.hidden = true; this.open = null; this.hud.classList.remove('under'); this.game.focusStage(); const c = $('.card', this.panel); c.style.transform = ''; c.classList.remove('drag', 'back'); }
  // 竖屏底部抽屉：按住顶部拖动条 / 标题往下拉，超过一定距离（或甩得够快）就关闭，否则弹回
  bindSheetDrag() {
    const card = $('.card', this.panel); let d = null;
    const sheet = () => matchMedia('(orientation: portrait) and (max-width: 640px)').matches;
    card.addEventListener('pointerdown', (e) => {
      if (!sheet() || e.button > 0 || !e.target.closest('.c-head, .c-grip, .c-band') || e.target.closest('button')) return;
      d = { id: e.pointerId, y: e.clientY, t: performance.now(), dy: 0 }; card.classList.add('drag');
      try { card.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    });
    card.addEventListener('pointermove', (e) => { if (!d || e.pointerId !== d.id) return; d.dy = Math.max(0, e.clientY - d.y); card.style.transform = `translateY(${d.dy}px)`; });
    const end = (e) => {
      if (!d || e.pointerId !== d.id) return;
      const v = d.dy / Math.max(1, performance.now() - d.t), dy = d.dy; d = null; card.classList.remove('drag');
      if (dy > 90 || (dy > 30 && v > 0.6)) { this.game.audio.play('click'); this.close(); return; }
      card.classList.add('back'); card.style.transform = ''; setTimeout(() => card.classList.remove('back'), 220);
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  holdHtml() { return esc(t('hold', { c: '\u0000' })).replace('\u0000', `<b>$${esc(fmt(this.game.state.cash))}</b>`); }
  hold() { const p = document.createElement('p'); p.className = 'hold'; p.innerHTML = this.holdHtml(); $('.c-foot', this.panel).appendChild(p); return p; }
  // “现金”提示行原地更新（不重建底栏，按钮才不会被换掉）
  syncHold() { const p = $('.c-foot .hold', this.panel); if (!p) return; const h = this.holdHtml(); if (p._h !== h) { p._h = h; p.innerHTML = h; } }
  refresh() { if (!this.open) return; const o = this.open; if (o.type === 'level') this.renderLevel(o.what, o.i, true); else if (o.type === 'mgr') this.renderMgr(o.what, o.i, true); else if (o.type === 'shop') this.openShop(true); }
  // 面板正中的升腾文字：升级 +3 Lv / 雇佣 管理员 / 换档 造型升级，往上升起并淡出
  // 等级条被升级点亮一下
  flashChip() { const c = $('.lvchip', this.panel); if (!c) return; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  panelFloat(text, kind = 'lv') {
    const card = $('.card', this.panel), el = document.createElement('div');
    el.className = 'pfloat ' + kind; el.textContent = text;
    el.addEventListener('animationend', () => el.remove()); card.appendChild(el);
  }
  // 按钮反馈（全局）：任何 <button> 按下时——指尖位置扩散一圈水波 + 按钮缩一下再弹回。
  // 挂在 document 上一次就够：HUD 图标、倍数切换、语言、设置、面板按钮（含之后新建的）都自动有。
  // 水波放在一个裁切层里，不会把角标之类的外溢元素裁掉。
  static wirePress() {
    if (UI._pressWired) return; UI._pressWired = true;
    document.addEventListener('pointerdown', (e) => {
      const b = e.target instanceof Element ? e.target.closest('button') : null;
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;   // 不可点的按钮在 click 时左右晃，不出水波
      UI.pressFx(b, e, 'press');
    }, { capture: true, passive: true });
    document.addEventListener('animationend', (e) => {
      const b = e.target;
      if (!(b instanceof HTMLButtonElement)) return;
      const cls = { btnpress: 'press', btndone: 'done', btnshake: 'shake' }[e.animationName];
      if (cls) b.classList.remove(cls);
    }, true);
  }
  static pressFx(b, e, cls = 'press') {
    const r = b.getBoundingClientRect(), x = (e?.clientX ?? r.left + r.width / 2) - r.left, y = (e?.clientY ?? r.top + r.height / 2) - r.top;
    let wrap = b.querySelector(':scope > .rip-wrap');
    if (!wrap) { wrap = document.createElement('span'); wrap.className = 'rip-wrap'; wrap.setAttribute('aria-hidden', 'true'); b.appendChild(wrap); }
    const sp = document.createElement('span'); sp.className = 'ripple'; sp.style.left = x + 'px'; sp.style.top = y + 'px';
    sp.addEventListener('animationend', () => sp.remove()); wrap.appendChild(sp);
    b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls);
    UI.ringFx(b, r);
  }
  // 按钮外一圈向外扩的光环：挂在 body 上（fixed），不会被按钮 / 面板的 overflow 裁掉
  static ringFx(b, r = b.getBoundingClientRect(), color) {
    if (UI.reduced()) return;
    const el = document.createElement('div'); el.className = 'fx-ring'; el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: getComputedStyle(b).borderRadius });
    el.style.setProperty('--ring', color || (b.classList.contains('alt') || b.closest('.bulk, .hud-lang') ? '#9ab4ff' : '#fff3a0'));
    el.addEventListener('animationend', () => el.remove()); document.body.appendChild(el);
  }
  // 成功时从按钮四周迸出一圈小星星
  static sparkFx(b, colors = ['#fff3a0', '#7aff7a', '#ffffff', '#f2c95c']) {
    if (UI.reduced() || !b?.isConnected) return;
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, n = 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, d = Math.max(r.width, r.height) * 0.55 + 18 + Math.random() * 26;
      const el = document.createElement('div'); el.className = 'fx-spark'; el.setAttribute('aria-hidden', 'true');
      el.style.left = cx + Math.cos(a) * r.width * 0.42 + 'px'; el.style.top = cy + Math.sin(a) * r.height * 0.42 + 'px';
      el.style.setProperty('--dx', Math.cos(a) * d * 0.6 + 'px'); el.style.setProperty('--dy', Math.sin(a) * d * 0.6 + 'px');
      el.style.setProperty('--c', colors[k % colors.length]); el.style.animationDelay = (Math.random() * 0.06).toFixed(3) + 's';
      el.addEventListener('animationend', () => el.remove()); document.body.appendChild(el);
    }
  }
  static reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
  pressFx(b, e, cls) { UI.pressFx(b, e, cls); }
  // 成功时：按钮亮一下弹起来 + 绿光扩散 + 绿色光环 + 一圈星星（可以重复触发）
  doneFx(b) {
    if (!b || !b.isConnected) return;
    b.classList.remove('done'); void b.offsetWidth; b.classList.add('done');
    UI.ringFx(b, undefined, '#7aff7a'); UI.sparkFx(b);
  }
  // 按钮结构：<span class="bl">主文字</span><small>副文字</small>（水波层之后加）。setBtn 只改文字 / 可用状态，
  // 按钮本身不换——面板实时刷新时手指正按着的那一下不会丢，动画也不会被打断。
  setBtn(b, label, sub, enabled) {
    if (!b) return;
    let l = b.querySelector(':scope > .bl'); if (!l) { l = document.createElement('span'); l.className = 'bl'; b.prepend(l); }
    if (label != null && l.textContent !== label) l.textContent = label;
    if (sub !== undefined) {
      let s = b.querySelector(':scope > small:not(.price)');
      if (sub) { if (!s) { s = document.createElement('small'); l.after(s); } if (s.textContent !== sub) s.textContent = sub; }
      else if (s) s.remove();
    }
    if (enabled != null) this.setEnabled(b, enabled);
  }
  // “软禁用”：看起来是灰的，但仍然接收点击——点了会晃一下 + “不行”的音效。
  // （真正的 disabled 按钮会把点击整个吞掉，玩家会觉得“点了没反应”。）
  setEnabled(b, on) { const v = String(!on); if (b.getAttribute('aria-disabled') !== v) b.setAttribute('aria-disabled', v); if (b.disabled) b.disabled = false; }
  isEnabled(b) { return b.getAttribute('aria-disabled') !== 'true'; }
  footButton(label, sub, enabled, fn, alt = false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (alt ? ' alt' : '');
    b.innerHTML = `<span class="bl">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}`; this.setEnabled(b, enabled);
    b.addEventListener('click', () => { if (!this.isEnabled(b)) { this.game.audio.play('deny'); this.denyFx(b); return; } fn(); }); $('.c-foot', this.panel).appendChild(b); return b;
  }

  // —— 升级面板（数值行：当前值 → 升级后）——
  openLevel(what, i) { this.open = { type: 'level', what, i }; this.renderLevel(what, i, false); }
  renderLevel(what, i, live) {
    const g = this.game, st = g.state, o = what === 'shaft' ? st.shafts[i] : what === 'elev' ? st.elev : st.house, lv = o.level;
    const n = this.bulk, { n: k, cost } = W.costOf(st, what, i, n === 'max' ? 'max' : n), L2 = lv + k, ps = (v) => t('lv.perSec', { v: fmt(v) });
    let rows, title, icon;
    if (what === 'shaft') {
      const a = W.shaftStatsOf(st, o), b = W.shaftStatsOf(st, o, L2), li = Math.min(LAYERS.length - 1, Math.floor(i / SHAFTS_PER_LAYER));
      title = t('lv.shaftTitle', { n: i + 1, ore: t(`L${li}.ore`) }); icon = minerPortrait(i);
      rows = [[t('lv.total'), ps(a.perSec), ps(b.perSec)], [t('lv.miners'), a.miners, b.miners], [t('lv.walk'), fmtSec(a.walk), ''], [t('lv.mineSpeed'), ps(a.speed), ps(b.speed)], [t('lv.cap'), fmt(a.cap), fmt(b.cap)]];
    } else if (what === 'elev') {
      const a = W.elevStatsOf(st), b = W.elevStatsOf(st, L2);
      title = t('lv.elev'); icon = P.basket(LAYERS[0].ore, 2, P.tierOf(o.level));
      rows = [[t('lv.transport'), ps(a.perSec), ps(b.perSec)], [t('lv.load'), fmt(a.load), fmt(b.load)], [t('lv.move'), fmtSec(a.move), ''], [t('lv.loadSpeed'), ps(a.loadSpeed), ps(b.loadSpeed)]];
    } else {
      const a = W.houseStatsOf(st), b = W.houseStatsOf(st, L2);
      title = t('lv.house'); icon = P.warehouse(o.level);
      rows = [[t('lv.transport'), ps(a.perSec), ps(b.perSec)], [t('lv.walk'), fmtSec(a.walk), ''], [t('lv.loadSpeed'), ps(a.loadSpeed), ps(b.loadSpeed)], [t('lv.load'), fmt(a.load), fmt(b.load)]];
    }
    const sub = t('lv.level', { n: lv }) + ` / ${E.MAX_LEVEL[what]}`, maxed = k < 1;
    if (!live) this.show(title, sub, icon); else { const cs = $('.c-sub', this.panel); if (cs.textContent !== sub) cs.textContent = sub; }
    const t1 = P.tierOf(o.level), t2 = P.tierOf(L2);
    // “造型会升级”的提示行始终占位（不跨档时只是看不见），切换 ×1/×10/MAX 时面板高度不再跳
    const tierHtml = what === 'shaft' ? '' : `<div class="lvchip tier"><span>${esc(t('lv.tier', { n: t1 }))}</span><i aria-hidden="true">➜</i><b>${esc(t('lv.tier', { n: t2 }))}</b></div>` + `<p class="note tierup${t2 > t1 ? '' : ' idle'}"${t2 > t1 ? '' : ' aria-hidden="true"'}>${esc(t('lv.tierUp'))}</p>`;
    // 结构只在打开面板 / 换了设施 / 换了语言时建一次；之后每 0.2 秒只原地改数字和按钮状态。
    // 以前是整块重建：手指按下时刚好赶上重建，这一下就“没反应”，动画也跟着旧按钮一起消失。
    const key = `${what}|${i}|${rows.length}|${getLang()}`;
    let D = this.lvDom;
    if (!live || !D || D.key !== key || !D.up.isConnected || !D.body.isConnected) {
      const body = $('.c-body', this.panel);
      body.innerHTML = `<div class="lv-tier"></div><div class="lvchip"><span class="lv-a"></span><i aria-hidden="true">➜</i><b class="lv-b"></b></div><table class="stats">${rows.map(() => '<tr><td></td><td class="v"></td><td class="n"></td></tr>').join('')}</table>
        <div class="bulk" role="group" aria-label="${esc(t('aria.bulk'))}">${[1, 10, 50, 'max'].map((v) => `<button type="button" data-bulk="${v}">${v === 'max' ? 'MAX' : '×' + v}</button>`).join('')}</div>`;
      for (const b of body.querySelectorAll('[data-bulk]')) b.addEventListener('click', () => { g.audio.play('click'); this.bulk = b.dataset.bulk === 'max' ? 'max' : Number(b.dataset.bulk); this.renderLevel(what, i, true); });
      $('.c-foot', this.panel).textContent = ''; this.hold();
      // 点击时再取当前的倍数 / 等级（不用建按钮时的旧值）
      const up = this.footButton(t('lv.upgrade', { n: k }), fmt(cost), st.cash >= cost, () => {
        const ob = what === 'shaft' ? st.shafts[i] : what === 'elev' ? st.elev : st.house, before = ob.level, beforeT = P.tierOf(before), bk = this.bulk;
        if (W.upgrade(st, what, i, bk === 'max' ? 'max' : bk)) {
          g.audio.play('upgrade'); g.onUpgrade(what, i); this.renderLevel(what, i, true);
          this.doneFx(up);
          this.panelFloat(t('lv.got', { n: ob.level - before }), 'lv'); this.flashChip();
          if (P.tierOf(ob.level) > beforeT) this.panelFloat(t('lv.tierUp'), 'tier');
        } else { g.audio.play('deny'); this.denyFx(up); }
      });
      D = this.lvDom = { key, body, up, tier: body.querySelector('.lv-tier'), a: body.querySelector('.lv-a'), b: body.querySelector('.lv-b'), rows: [...body.querySelectorAll('.stats tr')].map((tr) => [...tr.children]), bulk: [...body.querySelectorAll('[data-bulk]')] };
    }
    const setT = (el, s) => { s = String(s); if (el.textContent !== s) el.textContent = s; };
    if (D.tierHtml !== tierHtml) { D.tierHtml = tierHtml; D.tier.innerHTML = tierHtml; }
    setT(D.a, `Lv ${lv}`); setT(D.b, maxed ? 'MAX' : `Lv ${L2}`);
    rows.forEach(([a, b, c], r) => { const td = D.rows[r]; if (!td) return; setT(td[0], a); setT(td[1], b); setT(td[2], c === '' || maxed ? '' : '▲ ' + c); });
    for (const b of D.bulk) { const on = String(this.bulk) === b.dataset.bulk; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on)); }
    // 满级：按钮变成“已满级”（灰，点了只会晃）
    if (maxed) this.setBtn(D.up, t('lv.maxed'), '', false);
    else this.setBtn(D.up, t('lv.upgrade', { n: k }), fmt(cost), st.cash >= cost);
    this.syncHold();
  }
  // 钱不够时点不了的按钮：左右晃一下
  denyFx(b) { if (!b || !b.isConnected) return; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); UI.ringFx(b, undefined, '#ff6a5a'); setTimeout(() => b.classList.remove('shake'), 450); }

  // —— 管理员 ——
  openMgr(what, i) { this.open = { type: 'mgr', what, i }; this._mgrSig = null; this.renderMgr(what, i, false); }
  // 当前等级写累计效果，下一级只写新增的那一项
  effectText(what, lvl, onlyNew = false) {
    if (onlyNew) { const x = E.MGR_TIERS[what][lvl - 1]; return x.profit ? t('mgr.eff.profit', { n: x.profit }) : x.all ? t('mgr.eff.all', { n: x.all }) : t('mgr.eff.speed', { n: Math.round(x.speed * 100) }); }
    const e = E.mgrEffect(what, lvl), sp = t('mgr.eff.speed', { n: Math.round(e.speed * 100) }), j = t('mgr.eff.join');
    return what === 'shaft' ? t('mgr.eff.profit', { n: e.profit }) + j + sp : e.all > 1 ? t('mgr.eff.all', { n: e.all }) + j + sp : sp;
  }
  mgrCard(what, i, lvl, onlyNew = false) {
    return `<div class="mcard"><canvas class="m-face" width="192" height="192" data-face="${MGR_FACE(what, i)}"></canvas><div><b>${esc(t('mgr.card.level', { n: lvl }))}</b><small>${esc(t('mgr.card.effect', { e: this.effectText(what, lvl, onlyNew) }))}</small><small>${esc(t('mgr.card.skill', { s: E.SKILL.time, m: E.SKILL.cooldown / 60 }))}</small></div></div>`;
  }
  renderMgr(what, i, live) {
    const g = this.game, st = g.state, o = what === 'shaft' ? st.shafts[i] : what === 'elev' ? st.elev : st.house, mi = MGR_FACE(what, i);
    const tr0 = W.trainInfo(st, what, i);
    // 结构签名只看“能做什么”（雇没雇 / 能不能培训 / 培训到哪级）。钱够不够只切换按钮可用状态，不重建按钮
    const sig = `${o.mgr}|${tr0?.ready}|${tr0?.level}|${getLang()}`;
    const where = what === 'shaft' ? t('place.shaftN', { n: i + 1 }) : place(what);
    // 已雇佣时标题就是职务（「矿道管理员」），副标题写名字；未雇佣时标题是「雇佣管理员」，副标题写「职务 · 名字」
    if (!live) this.show(o.mgr ? t('mgr.name.' + what) : t('mgr.hireTitle'), t('mgr.sub', { name: o.mgr ? mgrName(mi) : mgrTitled(mi), where }), portrait(mi), 'vermilion');
    if (live && this._mgrSig === sig && (!this.mgrBtn || this.mgrBtn.isConnected)) {
      // 原地更新：雇佣 / 培训按钮是否可点、培训进度条、现金行、技能倒计时
      const cost = o.mgr ? (tr0?.ready ? tr0.cost : null) : E.managerCost(what, i);
      if (this.mgrBtn && cost != null) this.setBtn(this.mgrBtn, null, undefined, st.cash >= cost);
      const bar = $('.nextup .bar i', this.panel), num = $('.nextup .num', this.panel);
      if (bar && tr0) { const w = `${Math.min(100, tr0.have / tr0.need * 100).toFixed(1)}%`; if (bar.style.width !== w) bar.style.width = w; }
      if (num && tr0) { const s = `${tr0.have} / ${tr0.need}`; if (num.textContent !== s) num.textContent = s; }
      this.syncHold(); this.skillButton(o); return;
    }
    this._mgrSig = sig; this.mgrBtn = null;
    const body = $('.c-body', this.panel), foot = $('.c-foot', this.panel); foot.textContent = '';
    if (!o.mgr) {
      body.innerHTML = `<div class="mcard"><canvas class="m-face" width="192" height="192" data-face="${mi}"></canvas><div><b>${esc(t('mgr.name.' + what))}</b><small>${esc(t('mgr.do.' + what))}</small></div></div>
        <p class="note">${esc(t('mgr.intro'))}</p>`;
      this.hold();
      const c = E.managerCost(what, i);
      const hb = this.mgrBtn = this.footButton(t('mgr.hire'), `$${fmt(c)}`, st.cash >= c, () => {
        if (W.hire(st, what, i)) { g.audio.play('hire'); g.onHire(what, i); this._mgrSig = null; this.renderMgr(what, i, false); this.panelFloat(t('fx.hired'), 'tier'); this.doneFx(this.skillBtn); }
        else { g.audio.play('deny'); this.denyFx(hb); }
      });
    } else {
      const tr = tr0;
      let html = this.mgrCard(what, i, o.mgr);
      if (tr && tr.ready) html = `<div class="mpair">${html}<div class="arrow" aria-hidden="true">▼</div>${this.mgrCard(what, i, tr.level, true)}</div>`;
      else if (tr) html += `<div class="nextup"><b>${esc(t('mgr.next'))}</b><div class="bar"><i style="width:${Math.min(100, tr.have / tr.need * 100).toFixed(1)}%"></i></div><small>${esc(t('mgr.placeLevel', { place: place(what) }))} <span class="num">${tr.have} / ${tr.need}</span></small></div>`;
      else html += `<p class="note">${esc(t('mgr.max'))}</p>`;
      body.innerHTML = html;
      this.hold();
      if (tr && tr.ready) {
        const tb = this.mgrBtn = this.footButton(t('mgr.train'), `$${fmt(tr.cost)}`, st.cash >= tr.cost, () => {
          if (W.train(st, what, i)) { g.audio.play('upgrade'); g.onHire(what, i); this._mgrSig = null; this.renderMgr(what, i, false); this.panelFloat(t('fx.trained', { n: o.mgr }), 'lv'); }
          else { g.audio.play('deny'); this.denyFx(tb); }
        });
      }
      this.skillBtn = this.footButton(t('mgr.useSkill'), '', false, () => {
        if (W.useBoost(st, what, i)) { g.audio.play('boost'); this.skillButton(o); this.doneFx(this.skillBtn); this.panelFloat(t('fx.skill'), 'tier'); g.view.upgradeFx(what, i); }
      }, true);
      this.skillButton(o);
    }
    for (const c of body.querySelectorAll('.m-face')) c.getContext('2d').drawImage(portrait(Number(c.dataset.face)), 0, 0, 192, 192);
  }
  skillButton(o) {
    const b = this.skillBtn; if (!b || !b.isConnected) return;
    const txt = o.boostT > 0 ? t('toast.skillOn', { t: fmtClock(o.boostT) }) : o.cdT > 0 ? t('toast.skillCd', { t: fmtClock(o.cdT) }) : t('mgr.skillReady');
    this.setBtn(b, txt, undefined, !(o.boostT > 0 || o.cdT > 0));
  }

  // —— 商城（原投资人面板）——
  // 投资人两种拿法：① 平台硬币直接招募 1 位（立即生效、不用重开、可重复买，只在平台开放购买时显示）；
  // ② 照旧规则：累计收入够了就重开矿场，迎来 N 位。
  openShop(live = false) {
    const g = this.game, st = g.state, n = W.investorsClaimable(st), canPay = !!window.gp?.pay?.available;
    const tab = this.shopTab = (this.shopTab === 'skins' && (canPay || (g.save.data.ownedSkins ?? []).length)) ? 'skins' : 'inv';
    // 皮肤页：实时刷新只原地更新（使用中 / 已拥有 / 购买中），绝不重建，也绝不去改投资人的按钮文字
    if (tab === 'skins') {
      const sk = `${canPay}|${getLang()}`;
      if (live && this._skSig === sk && this.panel.querySelector('.sk-shop')) { this.skinSync(); return; }
      this._skSig = sk;
    } else this._skSig = null;
    const sig = `${tab}|${st.investors}|${n}|${canPay}|${getLang()}|${!!g.buying}`;
    // 投资人页：购买中 / 结束只原地改硬币按钮的文字和可用状态，不重建面板
    if (tab === 'inv' && live && this._invSig === sig) { if (this.shopBuy?.isConnected) this.setBtn(this.shopBuy, g.buying ? t('shop.buying') : t('shop.buy'), undefined, !g.buying); return; }
    this._invSig = tab === 'inv' ? sig : null; this.open = { type: 'shop' };
    const p = Math.round(st.investors * E.INVESTOR.bonus * 100);
    const sub = t('shop.sub', { n: st.investors, p });
    // 投资人人数写在投资人页的第一行（.shop-stat），标题栏只留「商城」，给页签腾地方
    if (!live) this.show(t('shop.title'), '', guidePortrait(), 'gold');
    // 页签：投资人 / 皮肤（平台不开放购买、也没已购皮肤时只显示投资人一页）
    const tabs = canPay || (g.save.data.ownedSkins ?? []).length
      ? `<div class="shop-tabs" role="tablist"><button type="button" role="tab" data-tab="inv" aria-selected="${tab === 'inv'}">${esc(t('shop.tabInv'))}</button><button type="button" role="tab" data-tab="skins" aria-selected="${tab === 'skins'}">${esc(t('shop.tabSkins'))}</button></div>`
      : '';
    // 页签单独占标题下面一行（以前塞在标题那一行里，被挤得很窄）
    this.panel.querySelector('.c-tabs')?.remove();
    if (tabs) $('.c-head', this.panel).insertAdjacentHTML('afterend', `<div class="c-tabs">${tabs}</div>`);
    // 商城面板：标题 / 页签 / 底部按钮固定，只有中间内容滚动（宽屏也一样，按钮永远看得见）
    const card = $('.card', this.panel); card.classList.add('is-shop'); card.classList.toggle('is-skins', tab === 'skins');
    this.bindTabs();
    if (tab === 'skins') { this.renderSkins(); return; }
    const need = Math.pow(Math.floor(Math.sqrt(st.lifetime / E.INVESTOR.unit) - Math.sqrt(st.runStart / E.INVESTOR.unit)) + 1 + Math.sqrt(st.runStart / E.INVESTOR.unit), 2) * E.INVESTOR.unit;
    // 两张介绍卡和底部两个按钮一一对应、左右并排：左 = 硬币招募，右 = 免费重开（平台不开放购买时只有右边一张，占整行）
    // 硬币一律用平台官方硬币图标（assets/ui/platform-coin.svg）
    const coin = () => `<img class="pcoin" src="assets/ui/platform-coin.svg" alt="" aria-hidden="true" draggable="false">`;
    const paid = canPay ? `<div class="shop-card paid"><span class="price-tag">${coin()}<b>${SHOP_PRICE}</b></span><b>${esc(t('shop.paidHead'))}</b><div class="big">${esc(t('inv.big', { n: 1 }))}</div><p class="note">${esc(t('shop.paidDesc'))}</p></div>` : '';
    const free = `<div class="shop-card free"><b>${esc(t('shop.freeHead'))}</b><div class="big${n > 0 ? '' : ' dim'}">${esc(n > 0 ? t('inv.big', { n }) : t('inv.none'))}</div><p class="note">${esc(t('inv.p2'))}</p><p class="mile">${esc(t('inv.mile', { a: '$' + fmt(st.lifetime), b: '$' + fmt(need) }))}</p></div>`;
    $('.c-body', this.panel).innerHTML = `<p class="shop-stat">${esc(sub)}</p><p class="shop-lead">${esc(t('inv.p1', { p: E.INVESTOR.bonus * 100 })).replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')}</p>
      <div class="shop-cols${canPay ? '' : ' one'}">${paid}${free}</div>`;
    $('.c-foot', this.panel).textContent = '';
    // 按钮不再是底部的两大条：各自放进对应的介绍卡底部（左 = 硬币招募，右 = 免费重开）
    const cards = this.panel.querySelectorAll('.shop-card');
    if (canPay) {
      const buy = this.shopBuy = this.footButton(g.buying ? t('shop.buying') : t('shop.buy'), '', !g.buying, () => g.buyInvestor());
      buy.classList.add('pay', 'in-card');
      const sm = document.createElement('small'); sm.className = 'price'; sm.innerHTML = `${coin()}<span>${esc(t('shop.price', { c: SHOP_PRICE }))}</span>`; buy.appendChild(sm);
      this.panel.querySelector('.shop-card.paid').appendChild(buy);
    }
    let armed = false;
    const b = this.footButton(n > 0 ? t('inv.go', { n }) : t('inv.cant'), n > 0 ? '' : t('inv.next', { b: '$' + fmt(need) }), n > 0, () => {
      if (!armed) { armed = true; this.setBtn(b, t('inv.confirm'), t('inv.confirmSub')); b.classList.add('warn'); this.denyFx(b); return; }
      g.prestige(); this.close();
    }, canPay);
    b.classList.add('in-card');
    (cards[cards.length - 1] || $('.c-foot', this.panel)).appendChild(b);
  }
  // 页签点击：切页只换内容，不关面板
  bindTabs() {
    for (const b of this.panel.querySelectorAll('[data-tab]')) b.addEventListener('click', () => {
      const v = b.dataset.tab; if (v === this.shopTab) return;
      this.game.audio.play('click'); UI.pressFx(b, null, 'press');
      this.shopTab = v; this._invSig = null; this.openShop();
    });
  }
  // —— 商城：皮肤（只换外观，不影响数值；同样用平台硬币买）——
  // 一屏装下、以图为主：① 大预览（自动轮播 待机→招牌动作→欢呼）+ 谁 / 哪套 + 一颗动作按钮
  //   ② 一排管理员头像（先选“谁”）③ 她的全部服装大图（标准制服 + 她自己的几套），角上只有状态角标。
  // 点头像只换下面那排服装；点服装只换选中项；实时刷新只原地更新（不重建，预览动画不会被打断）。
  renderSkins() {
    const g = this.game, body = $('.c-body', this.panel);
    if (!this.skinRow(this.skinSel)) { const w = (g.save.data.skins ?? {}); const k = MANAGERS.find((m) => w[m.key])?.key; this.skinSel = k ? w[k] : (SKINS[0]?.id ?? 'std:' + MANAGERS[0].key); }
    const people = MANAGERS.map((M, mi) => `<button type="button" class="sk-who-b" data-mgr="${M.key}" aria-pressed="false" aria-label="${esc(mgrTitled(mi))}"><img src="${faceSrc(M.key)}" alt="" draggable="false"><i class="sk-dot" aria-hidden="true"></i></button>`).join('');
    body.innerHTML = `<div class="sk-shop">
        <div class="sk-side">
          <div class="sk-frame"><canvas class="sk-cv" width="320" height="400" aria-hidden="true"></canvas></div>
          <div class="sk-cap"><span class="sk-who"></span><b class="sk-what"></b><div class="sk-do"></div></div>
        </div>
        <div class="sk-list"><div class="sk-people" role="group">${people}</div><div class="sk-tiles"></div></div>
      </div>`;
    for (const b of body.querySelectorAll('.sk-who-b')) b.addEventListener('click', () => {
      const mgr = b.dataset.mgr; if (this.skinRow(this.skinSel)?.mgr === mgr) return;
      g.audio.play('click');
      // 换人：默认选中她正穿着的那套
      this.skinSel = (g.save.data.skins ?? {})[mgr] || 'std:' + mgr;
      this.skinTiles(); this.skinSync(); this.paintSkinPreview();
    });
    // 动作按钮：只建一次（放在预览旁 .sk-do 里），之后由 skinSync() 原地改文字 / 样式 / 可用状态；底部栏空着（自动隐藏）
    const foot = $('.c-foot', this.panel); foot.textContent = '';
    this.skinBtn = this.shopBuy = this.footButton('', '', true, () => this.skinAct());
    this.skinBtn.classList.add('sk-act');
    body.querySelector('.sk-do').appendChild(this.skinBtn);
    this.skinTiles(); this.skinSync(); this.paintSkinPreview();
  }
  // 当前这位管理员的服装大图（换人时才重建这一小块）
  skinTiles() {
    const box = this.panel.querySelector('.sk-tiles'), r0 = this.skinRow(this.skinSel); if (!box || !r0) return;
    const items = [{ id: 'std:' + r0.mgr, S: null }, ...skinsFor(r0.mgr).map((S) => ({ id: S.id, S }))];
    box.innerHTML = items.map(({ id, S }) => `<button type="button" class="sk-tile" data-sel="${id}" aria-pressed="false" aria-label="${esc(S ? t(S.name) : t('skin.thumbDefault'))}"><canvas class="sk-tcv" width="160" height="200" aria-hidden="true"></canvas><span class="sk-pill"></span></button>`).join('');
    for (const tile of box.querySelectorAll('.sk-tile')) {
      const r = this.skinRow(tile.dataset.sel); if (r) this.drawOutfit(tile.querySelector('.sk-tcv'), r);
      tile.addEventListener('click', () => {
        if (tile.dataset.sel === this.skinSel) return;
        this.game.audio.play('click'); this.skinSel = tile.dataset.sel; this.skinSync(); this.paintSkinPreview();
      });
    }
  }
  // 'std:aya' = 绫的标准制服；其他 = 皮肤 id
  // 小图：这套衣服待机动画的第一帧，等比装进画布、脚踩底边
  drawOutfit(cv, r) {
    const a = managerArt(MGR_INDEX(r.mgr), r.S ? r.S.id : null).idle, fr = a?.frames[0];
    const src = fr?.source?.resource ?? fr?.source; if (!src) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, f = fr.frame;
    const k = Math.min((H * 0.96) / f.height, (W * 0.98) / f.width), dw = f.width * k, dh = f.height * k;
    ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, f.x, f.y, f.width, f.height, (W - dw) / 2, H - 2 - dh, dw, dh);
  }
  skinRow(id) {
    if (typeof id !== 'string') return null;
    if (id.startsWith('std:')) { const mgr = id.slice(4); return MANAGERS.some((m) => m.key === mgr) ? { id, mgr, S: null } : null; }
    const S = skinById(id); return S ? { id, mgr: S.mgr, S } : null;
  }
  skinState(id) {
    const r = this.skinRow(id); if (!r) return null;
    const d = this.game.save.data, worn = (d.skins ?? {})[r.mgr] || null;
    return { ...r, on: r.S ? worn === r.S.id : !worn, has: r.S ? (d.ownedSkins ?? []).includes(r.S.id) : true };
  }
  // 原地刷新：头像 / 服装的选中与状态、预览下的文字、动作按钮
  skinSync() {
    const g = this.game, canPay = !!window.gp?.pay?.available, d = g.save.data;
    const coin = '<img class="pcoin" src="assets/ui/platform-coin.svg" alt="" aria-hidden="true" draggable="false">';
    const s = this.skinState(this.skinSel); if (!s) return;
    // 头像：选中的那位高亮；还有没买的衣服的人带一个小金点
    for (const b of this.panel.querySelectorAll('.sk-who-b')) {
      const on = b.dataset.mgr === s.mgr; b.classList.toggle('sel', on);
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
      const more = skinsFor(b.dataset.mgr).some((S) => !(d.ownedSkins ?? []).includes(S.id));
      b.classList.toggle('more', more);
    }
    for (const row of this.panel.querySelectorAll('.sk-tile')) {
      const r = this.skinState(row.dataset.sel); if (!r) continue;
      const sel = r.id === this.skinSel;
      row.classList.toggle('sel', sel); row.classList.toggle('on', r.on);
      if (row.getAttribute('aria-pressed') !== String(sel)) row.setAttribute('aria-pressed', String(sel));
      // 角标只用最短的形式：使用中 / ✓（已拥有）/ 硬币 + 价格
      const html = r.on ? `<i class="p-on">${esc(t('skin.worn'))}</i>` : !r.S ? '' : r.has ? '<i class="p-has" aria-hidden="true">✓</i>' : `<i class="p-buy">${coin}<b>${r.S.coins}</b></i>`;
      const pill = row.querySelector('.sk-pill'); if (pill._h !== html) { pill._h = html; pill.innerHTML = html; }
    }
    const setT = (sel, v) => { const el = this.panel.querySelector(sel); if (el && el.textContent !== v) el.textContent = v; };
    setT('.sk-who', mgrTitled(MGR_INDEX(s.mgr)));
    setT('.sk-what', s.S ? t(s.S.name) : t('skin.thumbDefault'));
    const b = this.skinBtn; if (!b?.isConnected) return;
    let label, en = true, cls = '', price = 0;
    if (g.buying) { label = t('shop.buying'); en = false; cls = 'pay'; }
    else if (s.on) { label = t('skin.worn'); en = false; cls = 'on'; }
    else if (!s.S) { label = t('skin.equipDefault'); cls = 'alt'; }
    else if (s.has) { label = t('skin.wear'); }
    else { label = t('skin.buy'); en = canPay; cls = 'pay'; price = s.S.coins; }
    this.setBtn(b, label, '', en);
    for (const c of ['pay', 'on', 'alt']) b.classList.toggle(c, c === cls);
    // 价格：官方硬币图标 + 数字（不写“1 coins”这种字）
    let pr = b.querySelector(':scope > small.price');
    if (price) { if (!pr) { pr = document.createElement('small'); pr.className = 'price'; b.appendChild(pr); } const h = `${coin}<b>${price}</b>`; if (pr._h !== h) { pr._h = h; pr.innerHTML = h; } }
    else if (pr) pr.remove();
  }
  // 底部按钮：按“此刻”的选中项决定做什么（不用创建时的旧状态）
  skinAct() {
    const g = this.game, s = this.skinState(this.skinSel), b = this.skinBtn;
    if (!s || g.buying || s.on) return;
    if (!s.S) { g.equipSkin(null, true, s.mgr); this.doneFx(b); this.skinSync(); return; }
    if (s.has) { g.equipSkin(s.S.id, true); this.doneFx(b); this.skinSync(); return; }
    g.buySkin(s.S.id);   // 成功后 grantPurchase 会自动穿上，refresh → skinSync，buyItem 再在 shopBuy（就是这颗按钮）上放生效动效
  }
  // 预览：一张画布，自动轮播 待机 → 招牌动作 → 待机 → 欢呼。三段动画按同一比例画（不会忽大忽小），脚踩在底边上。
  paintSkinPreview() {
    const cv = this.panel.querySelector('.sk-cv'), s = this.skinRow(this.skinSel);
    if (this.skRaf) { cancelAnimationFrame(this.skRaf); this.skRaf = null; }
    if (!cv || !s) return;
    const art = managerArt(MGR_INDEX(s.mgr), s.S ? s.S.id : null);
    const W = cv.width, H = cv.height, ctx = cv.getContext('2d');
    const q = (a) => (a.srcH || 1) / (art.idle.srcH || 1);   // 这段动画的格子相对待机格子的源图比例
    let k = Infinity;
    for (const n of ['idle', 'gesture', 'cheer']) { const a = art[n], r = a?.frames[0]?.frame; if (r) k = Math.min(k, (H * 0.97) / (r.height * q(a))); }
    if (!isFinite(k)) return;
    const draw = (a, f) => {
      const fr = a.frames[f], src = fr?.source?.resource ?? fr?.source; ctx.clearRect(0, 0, W, H);
      if (!src) return;
      const r = fr.frame, dw = r.width * k * q(a), dh = r.height * k * q(a);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, r.x, r.y, r.width, r.height, W / 2 - (a.anchor?.x ?? 0.5) * dw, H - 3 - (a.anchor?.y ?? 0.97) * dh, dw, dh);
    };
    const SEQ = [['idle', 2.6], ['gesture', 0], ['idle', 1.8], ['cheer', 0]];
    let step = 0, t0 = performance.now();
    const tick = (now) => {
      if (!cv.isConnected || this.open?.type !== 'shop') { this.skRaf = null; return; }
      let [name, hold] = SEQ[step], a = art[name] ?? art.idle;
      if ((now - t0) / 1000 >= (hold || a.frames.length / a.fps)) { step = (step + 1) % SEQ.length; t0 = now; [name, hold] = SEQ[step]; a = art[name] ?? art.idle; }
      const el = (now - t0) / 1000, n = a.frames.length;
      draw(a, hold ? Math.floor(el * a.fps) % n : Math.min(n - 1, Math.floor(el * a.fps)));
      this.skRaf = requestAnimationFrame(tick);
    };
    draw(art.idle, 0);
    this.skRaf = requestAnimationFrame(tick);
  }
  // —— 设置 ——
  // —— 全服排行榜：按累计收入（平台榜单只存一个数：floor(1000·log10(1+累计收入))，这里还原成金额显示）——
  async openRank() {
    const g = this.game, token = {}; this._rankTok = token;
    this.open = { type: 'rank' };
    this.show(t('rank.title'), t('rank.sub'), guidePortrait(), 'gold');
    const body = $('.c-body', this.panel), foot = $('.c-foot', this.panel);
    const mine = `<p class="rk-mine">${esc(t('rank.mine', { v: '$' + fmt(g.state.lifetime) }))}</p>`;
    body.innerHTML = `${mine}<p class="note">${esc(t('rank.loading'))}</p>`;
    foot.textContent = '';
    const P = window.gp?.player;
    const sub = await g.submitRank();   // 先把自己的最新成绩交上去（只在比上次交的高时才真的提交）
    const top = P?.topScores ? await P.topScores(20).catch(() => null) : null;
    if (this._rankTok !== token || this.open?.type !== 'rank') return;
    const me = P?.user;
    let html = mine;
    if (sub && sub.best != null && sub.rank != null) html += `<p class="rk-best">${esc(t('rank.me', { v: rankText(sub.best), r: sub.rank }))}</p>`;
    if (!Array.isArray(top)) html += `<p class="note">${esc(t('rank.offline'))}</p>`;
    else if (!top.length) html += `<p class="note">${esc(t('rank.empty'))}</p>`;
    else html += `<ol class="rk-list">${top.map((e, k) => {
      const name = e.isMe ? (me?.name || e.name || t('rank.you')) : (e.name || t('rank.anon'));
      const init = esc(String(name).trim().charAt(0).toUpperCase() || '?');
      const av = e.avatar ? `<img class="rk-av" src="${esc(e.avatar)}" alt="" loading="lazy" data-init="${init}">` : `<i class="rk-av">${init}</i>`;
      const cls = [e.isMe ? 'me' : '', k < 3 ? `top${k + 1}` : ''].filter(Boolean).join(' ');
      return `<li class="${cls}"><b class="rk-n">${k + 1}</b>${av}<span class="rk-name">${esc(name)}${e.isMe ? ` <em>${esc(t('rank.you'))}</em>` : ''}</span><span class="rk-v num">${esc(rankText(e.score))}</span></li>`;
    }).join('')}</ol>`;
    if (!me && P) html += `<p class="note">${esc(t('rank.guest'))}</p>`;
    body.innerHTML = html;
    // 头像加载失败时换成首字母圆徽
    for (const img of body.querySelectorAll('img.rk-av')) img.addEventListener('error', () => { const i = document.createElement('i'); i.className = 'rk-av'; i.textContent = img.dataset.init || '?'; img.replaceWith(i); }, { once: true });
    foot.textContent = '';
    if (!me && P?.requestLogin) this.footButton(t('rank.login'), '', true, () => { g.audio.play('click'); P.requestLogin(); });
    this.footButton(t('rank.refresh'), '', true, () => { g.audio.play('click'); this.openRank(); }, !me);
  }
  openSettings() {
    const g = this.game; this.open = { type: 'settings' };
    this.show(t('set.title'), t('set.sub'), guidePortrait());
    // 隐藏开关：在设置里 2 秒内连点左上角葵的头像 5 下 → 试玩模式（不存档、不上榜）
    if (!this._sbWired) {
      this._sbWired = true; let n = 0, t0 = 0;
      $('.c-icon', this.panel).addEventListener('pointerdown', () => {
        if (this.open?.type !== 'settings') return;
        const now = performance.now(); if (now - t0 > 2000) n = 0; t0 = now;
        if (++n >= 5) { n = 0; this.game.startSandbox(); } else this.game.audio.play('tap');
      });
    }
    $('.c-body', this.panel).innerHTML = `<p class="note">${esc(t('set.body'))}</p>
      <div class="lang"><span>${esc(t('set.lang'))}</span><div class="seg" role="group">${LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${getLang() === l}">${esc(LANG_LABEL[l])}</button>`).join('')}</div></div>`;
    for (const b of this.panel.querySelectorAll('[data-lang]')) b.addEventListener('click', () => {
      const l = b.dataset.lang; g.audio.play('click'); g.setLanguage(l);
      // 切语言会重建整个面板，在新的那个按钮上补一次按下动画
      const nb = this.panel.querySelector(`[data-lang="${l}"]`); if (nb) UI.pressFx(nb, null, 'press');
    });
    $('.c-foot', this.panel).textContent = '';
    const row = document.createElement('div'); row.className = 'row2'; $('.c-foot', this.panel).appendChild(row);
    // 开关类按钮原地翻转文字和“关”样式（以前是重开整个面板，按钮一换动画就没了）
    const toggle = (b, on, onKey, offKey) => { this.setBtn(b, t(on ? onKey : offKey)); b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); };
    const sfx = this.footButton('', '', true, () => { g.toggleSound(); toggle(sfx, g.save.data.sound, 'set.sfxOn', 'set.sfxOff'); }, true);
    const mus = this.footButton('', '', true, () => { g.toggleMusic(); toggle(mus, g.save.data.music, 'set.musicOn', 'set.musicOff'); }, true);
    toggle(sfx, g.save.data.sound, 'set.sfxOn', 'set.sfxOff'); toggle(mus, g.save.data.music, 'set.musicOn', 'set.musicOff');
    row.append(sfx, mus);
    const gd = this.footButton('', '', true, () => { g.toggleGuide(); toggle(gd, !g.save.data.guideOff, 'set.guideOn', 'set.guideOff'); }, true);
    toggle(gd, !g.save.data.guideOff, 'set.guideOn', 'set.guideOff');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const row3 = document.createElement('div'); row3.className = 'row2'; $('.c-foot', this.panel).appendChild(row3);
      const hp = this.footButton('', '', true, () => { g.toggleHaptics(); toggle(hp, g.save.data.haptics !== false, 'set.hapticOn', 'set.hapticOff'); }, true);
      toggle(hp, g.save.data.haptics !== false, 'set.hapticOn', 'set.hapticOff'); row3.append(gd, hp);
    }
    let armed = false;
    const reset = this.footButton(t('set.reset'), '', true, () => { if (!armed) { armed = true; this.setBtn(reset, t('set.resetConfirm'), t('set.resetSub')); this.denyFx(reset); return; } g.resetGame(); this.close(); }, true);
    reset.classList.add('danger');
  }
  // —— 离线收益 ——
  openOffline(info, fn) {
    this.open = { type: 'offline' };
    this.show(t('off.title'), t('off.sub', { t: fmtTime(info.away) }), guidePortrait(), 'gold');
    const rule = `<p class="note">${esc(t('off.rule', { p: Math.round(W.OFFLINE_RATE * 100), h: W.OFFLINE_CAP_H }))}</p>`;
    const cap = info.capped ? `<p class="note tierup">${esc(t('off.capped', { h: W.OFFLINE_CAP_H }))}</p>` : '';
    $('.c-body', this.panel).innerHTML = info.cash > 0 ? `<p>${esc(t('off.p', { r: '$' + fmt(info.rate) }))}</p><div class="big">$${esc(fmt(info.cash))}</div>${cap}${rule}`
      : `<p class="note">${esc(t('off.none'))}</p>${rule}`;
    $('.c-foot', this.panel).textContent = '';
    this.footButton(info.cash > 0 ? t('off.take') : t('off.ok'), '', true, () => { fn(); this.close(); });
  }
  // —— 抵达新的深层 ——
  openLayer(li) {
    this.open = { type: 'layer', li };
    this.show(t('hud.layer', { n: li + 1, name: layerName(li) }), t(`L${li}.depth`), minerPortrait(li * SHAFTS_PER_LAYER), 'gold');
    $('.c-body', this.panel).innerHTML = `<p>${esc(t(`L${li}.desc`))}</p><p class="note">${esc(t('layer.ore', { ore: t(`L${li}.ore`) }))}</p>`;
    $('.c-foot', this.panel).textContent = '';
    this.footButton(t('layer.go'), '', true, () => this.close());
  }
}
