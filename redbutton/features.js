// Six extra incremental systems (top button row): Achievements, Lucky Wheel, Bank, Garden, Expedition, Lab.
// Pure data + helpers here; side effects that touch the scene (chests, frenzy, sound) live in game.ts.
                                                
import { Decimal, ZERO, dec, num } from './decimal.js';

                          
                                                               
                                                                        
                                                                                                  
                                                      
                                              
                                   
                                                                              
                  
                                                        
                                                                                 
 

export function newFx()          {
  return {
    ach: [], wheelTok: 1, wheelProg: 0, wheelFree: 0, spins: 0,
    bank: ZERO, bankLv: 0, bankT: Date.now(), plots: 0, garden: [], shroom: 0, harvests: 0,
    exp: [0, 0, 0], expDone: 0, rp: 0, lab: {}, labT: Date.now(), bankP: ZERO,
  };
}
export function fixFx(f     )          {
  const n = newFx();
  if (!f || typeof f !== 'object') return n;
  const o = Object.assign(n, f)           ;
  if (!Array.isArray(o.ach)) o.ach = [];
  if (!Array.isArray(o.garden)) o.garden = [];
  if (!Array.isArray(o.exp) || o.exp.length !== 3) o.exp = [0, 0, 0];
  if (!o.lab || typeof o.lab !== 'object') o.lab = {};
  o.bank = dec(f.bank, 0); o.bankP = dec(f.bankP, 0);
  for (const k of ['wheelTok', 'wheelProg', 'wheelFree', 'spins', 'bankLv', 'bankT', 'plots', 'shroom', 'harvests', 'expDone', 'rp', 'labT']         ) {
    if (typeof o[k] !== 'number' || !isFinite(o[k])) (o       )[k] = (n       )[k];
  }
  return o;
}

// ---------------- feature order / unlocks ----------------
export const FX_IDS = ['ach', 'wheel', 'bank', 'garden', 'exp', 'lab']         ;
                                         
export const FX_ICON                       = { ach: 5, wheel: 2, bank: 0, garden: 1, exp: 4, lab: 3 };
export function fxUnlocked(s       , d         , id      ) {
  switch (id) {
    case 'ach': return s.clicks >= 50 || s.rebirths > 0;
    case 'wheel': return s.clicks >= 300 || s.rebirths > 0;
    case 'bank': return s.lifeCoins.gte(5e4);
    case 'garden': return s.level >= 6;
    case 'exp': return d.collected >= 8;
    case 'lab': return s.level >= 10;
  }
}
// requirement shown on a locked button: [i18n key, value]
export const FX_REQ                                 = {
  ach: ['req_clicks', 50], wheel: ['req_clicks', 300], bank: ['req_life', 5e4],
  garden: ['req_level', 6], exp: ['req_collected', 8], lab: ['req_level', 10],
};

// ---------------- achievements ----------------
                                                                                                                                           
                                                                  
const ACH_RAW                        = [
  ['clicks', [100, 1000, 10000, 100000, 1000000]],
  ['life', [1e3, 1e6, 1e9, 1e12, 1e15, 1e18, 1e24]],
  ['opened', [10, 100, 1000, 10000]],
  ['collected', [12, 48, 96, 144, 192]],
  ['level', [10, 25, 50, 100]],
  ['rebirths', [1, 5, 20, 50]],
  ['pulls', [10, 100, 500]],
  ['skins', [3, 7, 13]],
  ['harvests', [10, 100, 1000]],
  ['exp', [5, 50, 300]],
  ['spins', [10, 100, 500]],
];
export const ACHS           = [];
for (const [stat, vs] of ACH_RAW) vs.forEach((v, tier) => ACHS.push({ stat, v, tier }));
export function achStat(s       , d         , k         )         {
  const f = s.fx;
  switch (k) {
    case 'clicks': return s.clicks; case 'life': return num(s.lifeCoins); case 'opened': return s.opened;
    case 'collected': return d.collected; case 'rebirths': return s.rebirths; case 'pulls': return s.pulls;
    case 'level': return s.level; case 'skins': return d.skinCount; case 'harvests': return f.harvests;
    case 'exp': return f.expDone; case 'spins': return f.spins;
  }
}
export const achGems = (a        ) => 10 + 15 * a.tier;
export const ACH_BONUS = 0.02; // +2% all income per claimed achievement

// ---------------- lucky wheel ----------------
// prize kinds: coins(sec) / gems / chest(tier) / frenzy / jackpot
                                                                                                                         
export const WHEEL               = [
  { k: 'coins', v: 300, w: 20, color: '#FFC928' },
  { k: 'gems', v: 5, w: 18, color: '#8B5CF6' },
  { k: 'chest', v: 1, w: 15, color: '#9AA5B8' },
  { k: 'coins', v: 1800, w: 12, color: '#FF8A3D' },
  { k: 'frenzy', v: 20, w: 10, color: '#FF3B47' },
  { k: 'gems', v: 20, w: 10, color: '#2F8BFF' },
  { k: 'chest', v: 2, w: 8, color: '#2FC48D' },
  { k: 'jackpot', v: 7200, w: 4, color: '#17264A' },
];
export const WHEEL_PER = 100;          // manual presses per token
export const WHEEL_MAX = 10;
export const WHEEL_FREE_MS = 4 * 3600e3;

// ---------------- bank ----------------
export const bankRate = (f         ) => 0.01 + 0.002 * f.bankLv;          // per minute
// vault limit: about 1 h of output, +1 h per vault level (max ~11 h at Lv10; was ×2 per level, up to ~1000 h)
export const bankCap = (f         , d         ) => Decimal.max(1e5, d.cps.mul(3600).add(d.clickValue.mul(1200))).mul(1 + f.bankLv);
export const bankUpCost = (f         ) => Math.ceil(15 * Math.pow(2, f.bankLv));
export const BANK_MAX = 10;

// ---------------- garden ----------------
                                                                                 
export const CROPS            = [
  { min: 3, costKind: 'coins', img: 3 },      // coin flower
  { min: 20, costKind: 'coins', img: 4 },     // gem berry
  { min: 60, costKind: 'gems', img: 5 },      // chest sprout
  { min: 240, costKind: 'gems', img: 6 },     // rainbow mushroom
];
// price of a seed: coins (Decimal) for crops 0/1, gems for crops 2/3 (also as Decimal; read with num())
export function cropCost(i        , d         )          {
  if (i === 0) return Decimal.max(50, d.cps.mul(20).add(d.clickValue.mul(20)).ceil());
  if (i === 1) return Decimal.max(500, d.cps.mul(120).add(d.clickValue.mul(60)).ceil());
  if (i === 2) return new Decimal(5);
  return new Decimal(20);
}
// coin flower harvest (big number)
export function cropCoins(d         )          { return Decimal.max(1000, d.cps.mul(150).add(d.clickValue.mul(75))); }
// gem berry harvest (gems) / other crops (1)
export function cropReward(i        , d         ) {
  if (i === 1) return Math.max(3, Math.round(4 * d.gemMult));
  return 1;
}
export const plotCount = (f         ) => 2 + f.plots;
export const PLOT_MAX = 6;
export const plotCost = (f         ) => Math.ceil(15 * Math.pow(2, f.plots));
export const SHROOM_MAX = 200;
export const SHROOM_BONUS = 0.01;

// ---------------- expedition ----------------
                                                     
export const EXPS           = [{ min: 15, need: 8 }, { min: 60, need: 24 }, { min: 360, need: 60 }];
export const expTeam = (d         ) => 1 + d.collected / 48;

// ---------------- lab ----------------
                                                                                                 
export const LABS           = [
  { id: 'click', base: 40, growth: 1.6, max: 999 },
  { id: 'cps', base: 40, growth: 1.6, max: 999 },
  { id: 'loot', base: 60, growth: 1.5, max: 50 },
  { id: 'speed', base: 10, growth: 2, max: 10, gems: true },
];
export const labLv = (f         , id        ) => f.lab[id] || 0;
export const labCost = (f         , l        ) => Math.ceil(l.base * Math.pow(l.growth, labLv(f, l.id)));
export const rpRate = (s       ) => (1 + 0.5 * labLv(s.fx, 'speed')) * (1 + s.level / 20);

// ---------------- derived multipliers (consumed by core.derive) ----------------
export function fxGlobal(f         ) { return (1 + ACH_BONUS * f.ach.length) * (1 + SHROOM_BONUS * f.shroom); }
export const fxClickMult = (f         ) => Math.pow(1.2, labLv(f, 'click'));
export const fxCpsMult = (f         ) => Math.pow(1.2, labLv(f, 'cps'));
export const fxLuck = (f         ) => 0.04 * labLv(f, 'loot');
export const fxChest = (f         ) => 0.003 * labLv(f, 'loot');

// time-based accrual (works offline because it uses wall-clock timestamps)
export function accrue(s       , d         , now        ) {
  const f = s.fx;
  // bank: compound interest up to the vault cap (max 24h catch-up)
  const bm = Math.min(24 * 60, Math.max(0, (now - f.bankT) / 60000));
  f.bankT = now;
  if (f.bank.gt(0) && bm > 0) {
    const cap = bankCap(f, d);
    if (f.bank.lt(cap)) f.bank = Decimal.min(cap, f.bank.mul(Math.pow(1 + bankRate(f), bm)));
  }
  // lab research points (catch-up capped by offline hours)
  const ls = Math.min(Math.min(48, d.offlineHours) * 3600, Math.max(0, (now - f.labT) / 1000));
  f.labT = now;
  if (fxUnlocked(s, d, 'lab')) f.rp += rpRate(s) * ls;
}
