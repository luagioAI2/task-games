// Panel HTML for the six top-row systems. Pure rendering — actions go through data-a="fx" data-id=<verb> data-v=<arg>.
import { t } from './i18n.js';
import { fmt, fmtTime } from './fmt.js';
const dur = (sec        ) => fmtTime(sec, v => t('hours', { v }), v => t('minutes', { v }));
const clock = (sec        ) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60; const p = (n        ) => String(n).padStart(2, '0'); return h ? h + ':' + p(m) + ':' + p(x) : m + ':' + p(x); };
                                                
import { num } from './decimal.js';
import {
  ACHS, achStat, achGems, ACH_BONUS, WHEEL, WHEEL_PER, WHEEL_MAX, bankRate, bankCap, bankUpCost, BANK_MAX,
  CROPS, cropCost, cropReward, plotCount, PLOT_MAX, plotCost, SHROOM_BONUS, EXPS, expTeam, LABS, labLv, labCost, rpRate,
} from './features.js';
                                          

export function fxIcon(i        ) {
  const r = i >> 2, c = i & 3;
  return `background-image:url(assets/sheets/fx-icons-c.webp);background-size:400% 200%;background-position:${c * 33.333}% ${r * 100}%`;
}
export function gardenImg(i        ) {
  const r = i >> 2, c = i & 3;
  return `background-image:url(assets/sheets/fx-garden-c.webp);background-size:400% 200%;background-position:${c * 33.333}% ${r * 100}%`;
}

export const FX_CSS = `
.fxrow{display:flex;justify-content:space-between;gap:0;pointer-events:none;max-width:400px;align-self:center;width:100%}
.fxb{position:relative;width:48px;height:48px;border-radius:16px;border:none;background:#fff;box-shadow:0 3px 0 #C9D9D1;pointer-events:auto;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center}
.fxb .spr{width:38px;height:38px}
.fxb.lock .spr{filter:grayscale(1) opacity(.3)}
.fxb.lock::after{content:"";position:absolute;width:14px;height:12px;right:4px;bottom:5px;border-radius:3px;background:#9AA5B8}
.fxb.lock::before{content:"";position:absolute;width:8px;height:9px;right:6px;bottom:14px;border:2.5px solid #9AA5B8;border-bottom:none;border-radius:6px 6px 0 0}
.fxb.on{background:#17264A;box-shadow:0 3px 0 #0B1430}
.fxb .dot{position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:#FF3B47;border:2px solid #fff}
.fxb.pop{animation:pop .6s}
.fxhead{font-size:13px;color:#5B6B8C;margin:0 0 8px;line-height:1.35}
.bar2{height:12px;border-radius:6px;background:#E3EEF0;overflow:hidden;margin-top:4px}
.bar2 i{display:block;height:100%;background:#2FC48D;border-radius:6px}
.bigstat{background:#17264A;color:#fff;border-radius:16px;padding:12px;text-align:center;margin-bottom:10px}
.bigstat .v{font-size:30px;font-weight:900;line-height:1.1}
.bigstat .l{font-size:12px;opacity:.75}
.btnrow{display:flex;gap:8px;margin-bottom:10px}
.btnrow .btn{flex:1;min-width:0}
.plots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.plot{background:#C7834A;border-radius:16px;padding:6px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:118px;cursor:pointer;box-shadow:inset 0 -6px 0 #8A5426;color:#fff;text-align:center}
.plot .spr{width:62px;height:62px}
.plot .n{font-size:12px;font-weight:900;line-height:1.1}
.plot .tm{font-size:12px;font-weight:900;background:rgba(0,0,0,.25);border-radius:8px;padding:1px 6px}
.plot.ready{box-shadow:inset 0 -6px 0 #8A5426,0 0 0 3px #FFC928}
.plot.ready .tm{background:#FFC928;color:#17264A}
.plot.add{background:#E3EEF0;box-shadow:inset 0 0 0 3px #C9D3DC;color:#17264A;justify-content:center}
.seedgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.seed{background:#F2F7F5;border-radius:14px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:2px;border:3px solid transparent;cursor:pointer;text-align:center;min-height:48px}
.seed.off{opacity:.45}
.seed .spr{width:56px;height:56px}
.seed .n{font-weight:900;font-size:14px}
.seed .d{font-size:11px;color:#5B6B8C;line-height:1.2}
.seed .c{font-size:12px;font-weight:900;color:#17264A}
.exp{background:#fff;border-radius:16px;padding:10px;margin-bottom:8px;box-shadow:0 2px 0 #DCE9E3}
.exp .top{display:flex;align-items:center;gap:8px}
.exp .top .spr{width:44px;height:44px}
.exp .nm{font-weight:900;font-size:16px}
.exp .ds{font-size:12px;color:#5B6B8C}
.exp .team{display:flex;gap:2px;margin-top:6px}
.exp .team .spr{width:30px;height:30px}
.wheelbox{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:10px}
.wheel{position:relative;width:min(70vw,230px);height:min(70vw,230px)}
.wheel .disc{position:absolute;inset:0;border-radius:50%;border:6px solid #17264A;box-shadow:0 5px 0 rgba(23,38,74,.25)}
.wheel .disc .lab{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px}
.wheel .pin{position:absolute;left:50%;top:-12px;margin-left:-13px;width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:24px solid #FF3B47;z-index:2;filter:drop-shadow(0 2px 0 rgba(0,0,0,.25))}
.wheel .hubc{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;background:#fff;border:5px solid #17264A}
.achrow{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:8px 10px;margin-bottom:6px;box-shadow:0 2px 0 #DCE9E3}
.achrow.done{opacity:.55}
.gi{display:inline-block;width:15px;height:15px;vertical-align:-3px;margin-left:2px;background:url(assets/sheets/icons-c.webp) 33.333% 100%/400% 200% no-repeat}
.gi.c{background-position:100% 100%}
.achrow .info{flex:1;min-width:0}
.achrow .nm{font-weight:900;font-size:14px;line-height:1.2}
.achrow .medal{width:30px;height:30px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px}
`;

const GEMI = '<i class="gi"></i>';
const COINI = '<i class="gi c"></i>';
const MEDAL = ['#C7834A', '#9AA5B8', '#FFB800', '#2F8BFF', '#8B5CF6', '#FF3B47', '#17264A'];
const chestIcon = (tier        ) => `background-image:url(assets/sheets/chests-c.webp);background-size:400% 200%;background-position:${tier * 33.333}% 0%`;

export function wheelPrizeLabel(i        ) {
  const p = WHEEL[i];
  if (p.k === 'coins') return t('wh_coins', { t: dur(p.v) });
  if (p.k === 'gems') return t('wh_gems', { v: p.v });
  if (p.k === 'chest') return t(p.v === 1 ? 'wh_chest1' : 'wh_chest2');
  if (p.k === 'frenzy') return t('wh_frenzy');
  return t('wh_jackpot');
}
export function wheelPrizeIcon(i        , iconStyle                       ) {
  const p = WHEEL[i];
  if (p.k === 'coins' || p.k === 'jackpot') return iconStyle(7);
  if (p.k === 'gems') return iconStyle(5);
  if (p.k === 'chest') return chestIcon(p.v);
  return iconStyle(1);
}
export function wheelHtml(iconStyle                       ) {
  const n = WHEEL.length, seg = 360 / n;
  const grad = WHEEL.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  const labs = WHEEL.map((_, i) => {
    const a = (i + 0.5) * seg;
    return `<div class="spr lab" style="${wheelPrizeIcon(i, iconStyle)};transform:rotate(${a}deg) translateY(-72%) translateY(-30px) rotate(${-a}deg)"></div>`;
  }).join('');
  return `<div class="wheel"><div class="pin"></div><div class="disc" id="wdisc" style="background:conic-gradient(${grad})">${labs}</div><div class="hubc"></div></div>`;
}

export function fxPanel(id      , s       , d         , iconStyle                       , itemStyle                       , view                      ) {
  const f = s.fx; const now = Date.now();
  let h = `<div class="fxhead">${t('fx_' + id + '_d')}</div>`;
  if (id === 'ach') {
    h += `<div class="bigstat"><div class="v">+${Math.round(f.ach.length * ACH_BONUS * 100)}%</div><div class="l">${t('ach_bonus', { v: Math.round(f.ach.length * ACH_BONUS * 100), a: f.ach.length, b: ACHS.length })}</div></div>`;
    // claimable first, then in-progress, then claimed
    const order = ACHS.map((a, i) => ({ a, i, done: f.ach.includes(i), ok: achStat(s, d, a.stat) >= a.v }))
      .sort((x, y) => (Number(y.ok && !y.done) - Number(x.ok && !x.done)) || (Number(x.done) - Number(y.done)) || 0);
    let shown = 0;
    for (const o of order) {
      // hide far-future tiers: only the next unclaimed tier per stat (plus claimable ones)
      if (!o.done && !o.ok) {
        const prev = ACHS.findIndex((a, j) => a.stat === o.a.stat && a.tier === o.a.tier - 1);
        if (prev >= 0 && !f.ach.includes(prev) && achStat(s, d, ACHS[prev].stat) < ACHS[prev].v) continue;
      }
      if (o.done && shown > 40) continue;
      shown++;
      const cur = Math.min(achStat(s, d, o.a.stat), o.a.v);
      h += `<div class="achrow ${o.done ? 'done' : ''}"><div class="medal" style="background:${MEDAL[o.a.tier]}">${o.a.tier + 1}</div><div class="info"><div class="nm">${t('ach_' + o.a.stat, { v: fmt(o.a.v) })}</div>
        ${o.done ? '' : `<div class="bar2"><i style="width:${cur / o.a.v * 100}%"></i></div>`}</div>
        ${o.done ? `<button class="btn off">${t('ach_done')}</button>` : `<button class="btn ${o.ok ? '' : 'off'}" data-a="fx" data-id="claim" data-v="${o.i}">${t('ach_claim')}<small>+${achGems(o.a)}${GEMI}</small></button>`}</div>`;
    }
  } else if (id === 'wheel') {
    const free = f.wheelFree <= now;
    h += `<div class="wheelbox">${wheelHtml(iconStyle)}</div>`;
    h += `<div class="bigstat"><div class="v">${t('wh_tokens')} ${f.wheelTok}/${WHEEL_MAX}</div><div class="l">${t('wh_prog', { a: f.wheelProg, b: WHEEL_PER })} · ${free ? t('wh_freeNow') : t('wh_free', { t: clock((f.wheelFree - now) / 1000) })}</div></div>`;
    h += `<div class="btnrow">${free ? `<button class="btn" data-a="fx" data-id="spin" data-v="free" style="background:#2FC48D">${t('wh_spinFree')}</button>` : ''}<button class="btn ${f.wheelTok > 0 ? '' : 'off'}" data-a="fx" data-id="spin" data-v="tok">${t('wh_spin')}<small>1 ${t('wh_tokens')}</small></button></div>`;
  } else if (id === 'bank') {
    const cap = bankCap(f, d), full = f.bank.gte(cap) && f.bank.gt(0);
    h += `<div class="bigstat"><div class="l">${t('bk_bal')}</div><div class="v">${fmt(f.bank)}</div><div class="l">${t('bk_rate', { v: (bankRate(f) * 100).toFixed(1) })} · ${t('bk_cap')} ${fmt(cap)}</div>
      <div class="bar2" style="background:#2B3B70"><i style="width:${Math.min(100, num(f.bank.div(cap)) * 100)}%;background:#FFC928"></i></div>${full ? `<div class="l" style="color:#FFC928;opacity:1;margin-top:4px">${t('bk_full')}</div>` : ''}</div>`;
    h += `<div class="sec">${t('bk_dep')}</div><div class="btnrow">${[25, 50, 100].map(p => `<button class="btn ${s.coins.gte(1) ? '' : 'off'}" data-a="fx" data-id="dep" data-v="${p}">${p === 100 ? t('bk_dep_all') : p + '%'}</button>`).join('')}</div>`;
    h += `<div class="btnrow"><button class="btn blue ${f.bank.gt(0) ? '' : 'off'}" data-a="fx" data-id="wd">${t('bk_wd')}</button></div>`;
    h += `<div class="row"><div class="spr" style="${fxIcon(0)}"></div><div class="info"><div class="nm">${t('bk_up')}<b>${t('lv')}${f.bankLv}/${BANK_MAX}</b></div><div class="ds">${t('bk_up_d')}</div></div>
      ${f.bankLv >= BANK_MAX ? `<button class="btn off">${t('max')}</button>` : `<button class="btn ${s.gems >= bankUpCost(f) ? '' : 'off'}" data-a="fx" data-id="bankup">${bankUpCost(f)}<small>${GEMI}</small></button>`}</div>`;
    h += `<div class="fxhead" style="color:#FF3B47;font-weight:900;margin-top:6px">${t('bk_note')}</div>`;
  } else if (id === 'garden') {
    const n = plotCount(f);
    h += `<div class="bigstat" style="padding:8px"><div class="l" style="opacity:1;font-size:14px">${t('gd_shroom', { v: Math.round(f.shroom * SHROOM_BONUS * 100) })}</div></div>`;
    const anyReady = f.garden.some((p, i) => i < n && p && now >= p.t + CROPS[p.c].min * 60e3);
    if (anyReady) h += `<div class="btnrow"><button class="btn" data-a="fx" data-id="harvestAll" style="background:#2FC48D">${t('gd_all')}</button></div>`;
    h += `<div class="plots">`;
    for (let i = 0; i < n; i++) {
      const p = f.garden[i];
      if (!p) { h += `<div class="plot ${view.pickPlot === i ? 'ready' : ''}" data-a="fx" data-id="pick" data-v="${i}"><div class="spr" style="${gardenImg(0)};opacity:.35"></div><div class="n">${t('gd_empty')}</div><div class="tm">+</div></div>`; continue; }
      const c = CROPS[p.c], ms = c.min * 60e3, k = (now - p.t) / ms;
      const ready = k >= 1;
      const img = ready ? c.img : k < 0.25 ? 0 : k < 0.6 ? 1 : 2;
      h += `<div class="plot ${ready ? 'ready' : ''}" data-a="fx" data-id="harvest" data-v="${i}"><div class="spr" style="${gardenImg(img)}"></div><div class="n">${t('crop' + p.c)}</div><div class="tm">${ready ? t('gd_harvest') : clock((p.t + ms - now) / 1000)}</div></div>`;
    }
    if (n < PLOT_MAX) h += `<div class="plot add" data-a="fx" data-id="plot"><div class="spr" style="${gardenImg(7)};width:44px;height:44px"></div><div class="n">${t('gd_buy')}</div><div class="tm" style="background:#17264A;color:#fff">${plotCost(f)}${GEMI}</div></div>`;
    h += `</div>`;
    if (view.pickPlot >= 0 && view.pickPlot < n && !f.garden[view.pickPlot]) {
      h += `<div class="sec">${t('gd_pick')}</div><div class="seedgrid">`;
      CROPS.forEach((c, i) => {
        const cost = cropCost(i, d); const can = c.costKind === 'coins' ? s.coins.gte(cost) : s.gems >= num(cost);
        const desc = i === 1 ? t('crop1_d', { v: cropReward(1, d) }) : t('crop' + i + '_d');
        h += `<div class="seed ${can ? '' : 'off'}" data-a="fx" data-id="plant" data-v="${i}"><div class="spr" style="${gardenImg(c.img)}"></div><div class="n">${t('crop' + i)}</div><div class="d">${desc}</div><div class="c">${dur(c.min * 60)} · ${fmt(cost)}${c.costKind === 'gems' ? GEMI : COINI}</div></div>`;
      });
      h += `</div>`;
    }
  } else if (id === 'exp') {
    const team = expTeam(d);
    h += `<div class="bigstat" style="padding:8px"><div class="v" style="font-size:22px">${t('ex_team', { v: team.toFixed(2) })}</div></div>`;
    const owned           = []; for (let i = 0; i < 48; i++) if (s.seen[i]) owned.push(i);
    EXPS.forEach((e, i) => {
      const st = f.exp[i]; const ms = e.min * 60e3;
      const lockd = d.collected < e.need;
      const icon = [gardenImg(3), chestIcon(2), chestIcon(3)][i];
      let pets = '';
      if (st) { for (let k = 0; k < 3 && owned.length; k++) pets += `<div class="spr" style="${itemStyle(owned[(Math.floor(st / 1000) + k * 7) % owned.length])}"></div>`; }
      let btn        ;
      if (lockd) btn = `<button class="btn off">${t('ex_need', { v: e.need })}</button>`;
      else if (!st) btn = `<button class="btn" data-a="fx" data-id="send" data-v="${i}">${t('ex_send')}<small>${dur(e.min * 60)}</small></button>`;
      else if (now >= st + ms) btn = `<button class="btn" style="background:#2FC48D" data-a="fx" data-id="back" data-v="${i}">${t('ex_back')}</button>`;
      else btn = `<button class="btn off">${clock((st + ms - now) / 1000)}</button>`;
      h += `<div class="exp"><div class="top"><div class="spr" style="${icon}"></div><div class="info" style="flex:1;min-width:0"><div class="nm">${t('ex' + i)}</div><div class="ds">${t('ex_r' + i)}</div></div>${btn}</div>
        ${st ? `<div class="team">${pets}<div style="flex:1;margin-left:6px"><div class="ds">${t('ex_going')}</div><div class="bar2"><i style="width:${Math.min(100, (now - st) / ms * 100)}%"></i></div></div></div>` : ''}</div>`;
    });
  } else if (id === 'lab') {
    h += `<div class="bigstat"><div class="l">${t('lab_rp')}</div><div class="v">${fmt(f.rp)}</div><div class="l">${t('lab_rate', { v: fmt(rpRate(s)) })}</div></div>`;
    for (const l of LABS) {
      const lv = labLv(f, l.id), full = lv >= l.max, c = labCost(f, l);
      const have = l.gems ? s.gems : f.rp;
      const cur = l.id === 'click' || l.id === 'cps' ? ` · ×${fmt(Math.pow(1.15, lv))}` : '';
      h += `<div class="row"><div class="spr" style="${fxIcon(l.gems ? 3 : 6)}"></div><div class="info"><div class="nm">${t('lab_' + l.id)}<b>${t('lv')}${lv}${l.max < 999 ? '/' + l.max : ''}</b></div><div class="ds">${t('lab_' + l.id + '_d')}${cur}</div></div>
        ${full ? `<button class="btn off">${t('max')}</button>` : `<button class="btn ${l.gems ? '' : 'blue'} ${have >= c ? '' : 'off'}" data-a="fx" data-id="lab" data-v="${l.id}">${fmt(c)}<small>${l.gems ? GEMI : t('lab_rp')}</small></button>`}</div>`;
    }
  }
  return h;
}
