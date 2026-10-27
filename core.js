import { newFx, fixFx, fxGlobal, fxClickMult, fxCpsMult, fxLuck, fxChest } from './features.js';
                                             
import { Decimal, ZERO, dec, okDec, num } from './decimal.js';
                                                  
// Economy definitions + pure game logic (no rendering).

export const SPECIES = 48;
export const GRADES = 4;
export const SETS = 12;
export const GRADE_COLORS = ['#9AA5B8', '#3B8BEB', '#A35BF0', '#FFB800'];
export const GRADE_VAL = [1, 3, 8, 20];
export const BOND_MULT = [2, 3, 5, 10];

// bonus type per set (index = set)
                                                                                                                             
export const SET_BONUS              = ['click', 'cps', 'chest', 'crit', 'chestCoins', 'click', 'cps', 'offline', 'luck', 'gems', 'critMult', 'all'];
// per grade-point value of each bonus type (percent or absolute)
export const BONUS_PER                            = {
  click: 5, cps: 5, chest: 0.25, crit: 0.25, chestCoins: 10, offline: 3, luck: 3, gems: 5, critMult: 0.25, all: 3,
};
export function setOf(species        ) { return Math.floor(species / 4); }
export function itemBonusValue(species        , grade        ) {
  return BONUS_PER[SET_BONUS[setOf(species)]] * GRADE_VAL[grade];
}

;                                                                 
export const GENS           = [
  // tiers ~60x apart in cost but only ~12x in output: each new tier needs far more orders of magnitude
  { id: 'robot', base: 1, cost: 50 },
  { id: 'printer', base: 12, cost: 4000 },
  { id: 'factory', base: 150, cost: 4e5 },
  { id: 'mine', base: 1900, cost: 5e7 },
  { id: 'station', base: 2.4e4, cost: 8e9 },
  { id: 'quantum', base: 3e5, cost: 1.5e12 },
  { id: 'divine', base: 3.8e6, cost: 3e14 },
  { id: 'galaxy', base: 4.8e7, cost: 7e16 },
  { id: 'multiverse', base: 6e8, cost: 2e19 },
  { id: 'infinity', base: 7.5e9, cost: 6e21 },
];
// milestones: every 10 machines of a kind (or 10 Finger Power levels) multiply that output x3
export const MILESTONE = 10, MILESTONE_X = 3;
export const genUnit = (g        , n        ) => Decimal.pow(MILESTONE_X, Math.floor(n / MILESTONE)).mul(g.base);
export const clickBaseOf = (p        ) => Decimal.pow(MILESTONE_X, Math.floor(p / MILESTONE)).mul(1 + p);

                                                                                
export const UPS          = [
  { id: 'power', cost: 10, growth: 1.34, max: 9999 },
  { id: 'sniff', cost: 150, growth: 2.2, max: 30 },
  { id: 'cap', cost: 500, growth: 5, max: 9 },
  { id: 'quality', cost: 3000, growth: 3, max: 25 },
];

                                                                                                                              
export const SKILLS             = [
  { id: 'm1', max: 10, cost: 1, branch: 0, row: 0 },
  { id: 'm2', max: 10, cost: 2, req: 'm1', branch: 0, row: 1 },
  { id: 'm4', max: 8, cost: 4, req: 'm1', branch: 0, row: 2 },
  { id: 'm3', max: 10, cost: 2, req: 'm2', branch: 0, row: 3 },
  { id: 'm5', max: 10, cost: 4, req: 'm4', branch: 0, row: 4 },
  { id: 'm6', max: 5, cost: 8, req: 'm3', reqLv: 3, branch: 0, row: 5 },
  { id: 'i1', max: 10, cost: 1, branch: 1, row: 0 },
  { id: 'i2', max: 8, cost: 2, req: 'i1', branch: 1, row: 1 },
  { id: 'i4', max: 10, cost: 4, req: 'i1', branch: 1, row: 2 },
  { id: 'i3', max: 11, cost: 2, req: 'i2', branch: 1, row: 3 },
  { id: 'i5', max: 8, cost: 4, req: 'i1', reqLv: 3, branch: 1, row: 4 },
  { id: 'i6', max: 5, cost: 8, req: 'i3', reqLv: 3, branch: 1, row: 5 },
  { id: 'l1', max: 10, cost: 1, branch: 2, row: 0 },
  { id: 'l2', max: 10, cost: 2, req: 'l1', branch: 2, row: 1 },
  { id: 'l3', max: 8, cost: 2, req: 'l1', branch: 2, row: 2 },
  { id: 'l4', max: 10, cost: 4, req: 'l2', branch: 2, row: 3 },
  { id: 'l5', max: 5, cost: 4, req: 'l2', reqLv: 3, branch: 2, row: 4 },
  { id: 'l6', max: 8, cost: 8, req: 'l3', branch: 2, row: 5 },
];

// ---------- workshop robots (coins), divine perks (DP), button skins ----------
                                                                                 
export const BOTS           = [
  { id: 'tap', cost: 5000, growth: 5, max: 20 },
  { id: 'opener', cost: 5e4, growth: 5.5, max: 20 },
  { id: 'merger', cost: 5e8, growth: 1, max: 1 },
  { id: 'miner', cost: 1e8, growth: 8, max: 10 },
];
// Permanent talent tree (paid with Divine Power, never reset). branch -1 = shared root.
                                                                                                                
export const PERKS            = [
  { id: 'origin', cost: 2, growth: 1.7, max: 5, branch: -1 },
  // branch 0: Hand of God (clicking)
  { id: 'midas', cost: 2, growth: 1.8, max: 10, req: 'origin', branch: 0 },
  { id: 'critgod', cost: 5, growth: 2.0, max: 5, req: 'midas', branch: 0 },
  { id: 'godtouch', cost: 10, growth: 2.0, max: 5, req: 'critgod', branch: 0 },
  { id: 'combogod', cost: 6, growth: 1.9, max: 4, req: 'midas', branch: 0 },
  // branch 1: Fortune (chests & loot)
  { id: 'aura', cost: 2, growth: 1.8, max: 10, req: 'origin', branch: 1 },
  { id: 'magnet', cost: 8, growth: 2.0, max: 3, req: 'aura', branch: 1 },
  { id: 'lucky', cost: 4, growth: 1.9, max: 5, req: 'aura', branch: 1 },
  { id: 'treasure', cost: 8, growth: 2.0, max: 5, req: 'lucky', branch: 1 },
  // branch 2: Eternity (rebirth & idle)
  { id: 'head', cost: 4, growth: 1.9, max: 5, req: 'origin', branch: 2 },
  { id: 'keep', cost: 6, growth: 2.0, max: 5, req: 'head', branch: 2 },
  { id: 'echo', cost: 12, growth: 2.0, max: 5, req: 'keep', branch: 2 },
  { id: 'warp', cost: 5, growth: 1.8, max: 5, req: 'head', branch: 2 },
];
export function perkState(s       , id        )                                   {
  const p = PERKS.find(x => x.id === id) ;
  const l = perk(s, id);
  if (l >= p.max) return 'full';
  if (l === 0 && p.req && perk(s, p.req) === 0) return 'lock';
  return s.dp.gte(perkCost(s, p)) ? 'can' : 'poor';
}
;                                                                                                                                      
;                                                                                                                      
export const SKINS            = [
  { base: '#B81E2A', top: '#EF3340', top2: '#F4474F', pat: 'none', acc: '#ffffff', req: 'none', v: 0 },
  { base: '#1E9468', top: '#2FC48D', top2: '#45D39F', pat: 'none', acc: '#ffffff', req: 'clicks', v: 500 },
  { base: '#1C63C4', top: '#2F8BFF', top2: '#4C9CFF', pat: 'ring', acc: '#BFE0FF', req: 'opened', v: 25 },
  { base: '#6436C9', top: '#8B5CF6', top2: '#9C73F7', pat: 'none', acc: '#ffffff', req: 'level', v: 10 },
  { base: '#D99A00', top: '#FFC928', top2: '#FFD24F', pat: 'dots', acc: '#FF8A3D', req: 'clicks', v: 3000 },
  { base: '#D1407A', top: '#FF6FA8', top2: '#FF85B6', pat: 'rings', acc: '#ffffff', req: 'collected', v: 30 },
  { base: '#8A5426', top: '#C7834A', top2: '#D2945E', pat: 'chips', acc: '#4A2A12', req: 'gens', v: 50 },
  { base: '#2E8B3E', top: '#FF4D5E', top2: '#FF5F6E', pat: 'seeds', acc: '#1A1A1A', req: 'bonds', v: 1 },
  { base: '#0E1733', top: '#22305E', top2: '#2B3B70', pat: 'stars', acc: '#FFE36E', req: 'rebirths', v: 1 },
  { base: '#B87A00', top: '#FFC928', top2: '#FFE07A', pat: 'shine', acc: '#FFF6C8', req: 'life', v: 1e9 },
  { base: '#5B3FBF', top: '#FF5A5A', top2: '#FFFFFF', pat: 'rainbow', acc: '#ffffff', req: 'pulls', v: 100 },
  { base: '#1B0B3A', top: '#4B1D8F', top2: '#5E2BAA', pat: 'cosmic', acc: '#9CF6FF', req: 'rebirths', v: 5 },
  { base: '#5DB8D6', top: '#BFF3FF', top2: '#E3FBFF', pat: 'gem', acc: '#7FD8F0', req: 'collected', v: 150 },
  { base: '#7A0B2E', top: '#FF2E63', top2: '#FF4F7B', pat: 'neon', acc: '#FFE36E', req: 'shop', v: 1 },
];
export const bot = (s       , id        ) => s.bots[id] || 0;
export const perk = (s       , id        ) => s.perks[id] || 0;
export function botCost(s       , b        ) { return Decimal.pow(b.growth, bot(s, b.id)).mul(b.cost); }
export function perkCost(s       , p         ) { return Math.ceil(p.cost * Math.pow(p.growth, perk(s, p.id))); }
export function skinStat(s       , d         , r         )         {
  switch (r) {
    case 'clicks': return s.clicks; case 'opened': return s.opened; case 'level': return s.level;
    case 'collected': return d.collected; case 'gens': return GENS.reduce((a, g) => a + (s.gens[g.id] || 0), 0);
    case 'bonds': return d.bonds.filter(x => x > 0).length; case 'rebirths': return s.rebirths;
    case 'life': return num(s.lifeCoins); case 'pulls': return s.pulls; case 'shop': return s.shop.skin || 0; default: return 1;
  }
}
export function skinCount(s       ) { let n = 0; for (let i = 0; i < SKINS.length; i++) if (s.skins & (1 << i)) n++; return n; }

;                       
            
                                                                                           
                                              
                                        
                                                                                            
                                         
                                                         
                                                
                                                              
                                  
                   
                      
                                                              
                                                              
                                                                                                      
                                                                                           
              
 

export function newState()        {
  return {
    v: 1, coins: ZERO, runCoins: ZERO, lifeCoins: ZERO, gems: 0, dp: ZERO, rebirths: 0,
    level: 1, xp: 0, sp: 0, ups: {}, gens: {}, skills: {},
    inv: new Array(SPECIES * GRADES).fill(0), seen: new Array(SPECIES).fill(0), chests: [],
    clicks: 0, opened: 0, pulls: 0, pity: 0, tabs: [], lastSeen: Date.now(), firstChest: false,
    bots: {}, perks: {}, dpTotal: ZERO, skin: 0, skins: 1, fx: newFx(), momT: 0, shop: {}, paid: [],
  };
}

// ---------- number safety ----------
// Coin-scale values are Decimals (no upper limit). Small counters stay plain numbers and must stay finite:
// JSON.stringify writes Infinity/NaN as null, which once made a late-game save unreadable.
export const NUM_CAP = 1e300;
export function fin(x     , fb = 0)         {
  if (typeof x !== 'number' || x !== x) return fb;
  if (x > NUM_CAP) return NUM_CAP;
  if (x < -NUM_CAP) return -NUM_CAP;
  return x;
}
// Decimal fields of State / FxState (serialized as strings like "1.23e+5678")
export const DEC_KEYS = ['coins', 'runCoins', 'lifeCoins', 'dp', 'dpTotal']         ;
const COIN_KEYS = ['coins', 'runCoins', 'lifeCoins'];
// walk the whole state: plain numbers stay finite, broken Decimals reset to 0, null/NaN fall back
export function sanitize(o     , depth = 0)      {
  if (!o || typeof o !== 'object' || depth > 6) return o;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > NUM_CAP) o[k] = v === v ? fin(v) : 0; }
    else if (v instanceof Decimal) { if (!okDec(v) || v.mantissa < 0) o[k] = ZERO; }
    else if (v === null && Array.isArray(o)) o[k] = 0;
    else if (v && typeof v === 'object') sanitize(v, depth + 1);
  }
  return o;
}
export function parseSave(d     )               {
  if (!d || typeof d !== 'object' || d.v !== 1) return null;
  // salvage: a coin field that is null in a save that has other progress overflowed in an older version
  // (Infinity → null): restore it to a large value instead of discarding the whole save.
  const progressed = (d.rebirths | 0) > 0 || (d.level | 0) > 1 || (d.clicks | 0) > 0;
  for (const k of COIN_KEYS) d[k] = d[k] === null && progressed ? new Decimal(NUM_CAP) : dec(d[k], 0);
  d.dp = dec(d.dp, 0);
  d.dpTotal = d.dpTotal === undefined ? d.dp : dec(d.dpTotal, d.dp);
  for (const rec of ['ups', 'gens', 'skills', 'bots', 'perks', 'shop']) {
    const r = d[rec]; if (r && typeof r === 'object') for (const k of Object.keys(r)) if (typeof r[k] !== 'number' || !Number.isFinite(r[k])) r[k] = 0;
  }
  const fx = d.fx; delete d.fx;
  sanitize(d);
  const s = newState();
  Object.assign(s, d);
  if (!Array.isArray(s.inv) || s.inv.length !== SPECIES * GRADES) s.inv = new Array(SPECIES * GRADES).fill(0);
  if (!Array.isArray(s.seen) || s.seen.length !== SPECIES) s.seen = new Array(SPECIES).fill(0);
  if (!Array.isArray(s.chests)) s.chests = [];
  if (!s.bots || typeof s.bots !== 'object') s.bots = {};
  if (!s.perks || typeof s.perks !== 'object') s.perks = {};
  if (typeof s.skins !== 'number') s.skins = 1;
  if (typeof s.momT !== 'number') s.momT = 0;
  if (!s.shop || typeof s.shop !== 'object') s.shop = {};
  if (!Array.isArray(s.paid)) s.paid = [];
  if (!(s.skins & (1 << (s.skin | 0)))) s.skin = 0;
  s.fx = fixFx(fx);
  sanitize(s.fx);
  return s;
}

export const lvl = (s       , id        ) => s.ups[id] || 0;
export const gen = (s       , id        ) => s.gens[id] || 0;
export const sk = (s       , id        ) => s.skills[id] || 0;

// geometric series: price of buying n more starting at level l (base * r^l * (r^n - 1) / (r - 1))
function geoCost(base        , r        , l        , n        )          {
  if (n <= 0) return ZERO;
  return Decimal.pow(r, l).mul(base).mul(Decimal.pow(r, n).sub(1)).div(r - 1);
}
// how many more can `have` afford (exact, verified against geoCost)
export function geoAfford(have         , base        , r        , l        , cap = Infinity)         {
  const first = Decimal.pow(r, l).mul(base);
  if (have.lt(first)) return 0;
  const ratio = have.div(first).mul(r - 1).add(1);
  let n = Math.max(0, Math.floor(ratio.log10() / Math.log10(r)));
  if (!(n < cap)) n = cap;
  while (n > 0 && geoCost(base, r, l, n).gt(have)) n--;
  while (n < cap && geoCost(base, r, l, n + 1).lte(have)) n++;
  return n;
}
export function upCost(s       , d       , n = 1) {
  return geoCost(d.cost, d.growth, lvl(s, d.id), n);
}
export function upMaxAfford(s       , d       , cap        ) {
  return geoAfford(s.coins, d.cost, d.growth, lvl(s, d.id), cap);
}
export const GEN_GROWTH = 1.28;
export function genCost(s       , g        , n = 1) {
  return geoCost(g.cost, GEN_GROWTH, gen(s, g.id), n);
}
export function genMaxAfford(s       , g        ) {
  return geoAfford(s.coins, g.cost, GEN_GROWTH, gen(s, g.id), 1e6);
}

// ---------- derived stats (cached per frame by caller) ----------
;                         
                                   
                                                                             
                                                                                           
                                                           
                                                    
                                                             
                                                                                                                                                   
                    
 

export function bestGrade(s       , sp        ) {
  for (let g = GRADES - 1; g >= 0; g--) if (s.inv[sp * GRADES + g] > 0) return g;
  return -1;
}

export function derive(s       )          {
  const bonus                            = { click: 0, cps: 0, chest: 0, crit: 0, chestCoins: 0, offline: 0, luck: 0, gems: 0, critMult: 0, all: 0 };
  for (let i = 0; i < SPECIES; i++) {
    const g = bestGrade(s, i);
    if (g >= 0) bonus[SET_BONUS[setOf(i)]] += itemBonusValue(i, g);
  }
  let setMult = 1; const bonds           = [];
  for (let st = 0; st < SETS; st++) {
    let mn = 9;
    for (let k = 0; k < 4; k++) mn = Math.min(mn, bestGrade(s, st * 4 + k));
    const m = mn >= 0 ? BOND_MULT[mn] : 0; bonds.push(m); if (m) setMult *= m;
  }
  let collected = 0;
  for (let i = 0; i < SPECIES; i++) for (let g = 0; g < GRADES; g++) if (s.seen[i] & (1 << g)) collected++;

  const skinN = skinCount(s);
  const global = permMult(s).mul(setMult * (1 + bonus.all / 100) * (1 + 0.05 * skinN) * (s.shop.golden ? GOLDEN_X : 1));
  let raw = ZERO;
  for (const g of GENS) { const n = gen(s, g.id); if (n > 0) raw = raw.add(genUnit(g, n).mul(n)); }
  const cpsMult = global.mul(fxCpsMult(s.fx)).mul(Math.pow(1.25, sk(s, 'i1')) * Math.pow(1.5, sk(s, 'i6')) * (1 + bonus.cps / 100));
  const cps = raw.mul(cpsMult);
  const p = lvl(s, 'power');
  const clickMult = global.mul(fxClickMult(s.fx)).mul((1 + perk(s, 'midas')) * Math.pow(1.25, sk(s, 'm1')) * (1 + bonus.click / 100));
  const clickValue = clickBaseOf(p).mul(clickMult).add(cps.mul(0.05 * sk(s, 'i4')));
  const luck = 1 + 0.15 * lvl(s, 'quality') + 0.15 * perk(s, 'aura') + 0.1 * sk(s, 'l2') + fxLuck(s.fx) + bonus.luck / 100;
  const tierW = [100, 12 * luck, 2 * Math.pow(luck, 1.5), 0.25 * luck * luck * (1 + 0.5 * sk(s, 'l5'))];
  const lv = s.level;
  return {
    bonus, setMult, bonds, global, clickValue, cps, cpsMult, clickMult,
    critChance: Math.min(0.75, 0.02 + 0.02 * sk(s, 'm2') + 0.03 * perk(s, 'godtouch') + bonus.crit / 100),
    critMult: 5 + 2 * sk(s, 'm3') + 3 * perk(s, 'critgod') + bonus.critMult,
    megaChance: 0.005 * sk(s, 'm6'),
    chestChance: Math.min(0.6, 0.04 + 0.01 * lvl(s, 'sniff') + 0.01 * sk(s, 'l1') + 0.02 * perk(s, 'lucky') + fxChest(s.fx) + bonus.chest / 100),
    cap: Math.min(12, 3 + lvl(s, 'cap') + perk(s, 'magnet')), tierW,
    gemMult: 1 + 0.25 * sk(s, 'l3') + 0.3 * perk(s, 'treasure') + bonus.gems / 100,
    // offline pays 1/10 of the old rate (base 2%, all bonuses ÷10) and stores at most 48 h; the shop's
    // Perpetual Machine removes the ÷10 and stores up to 7 days
    offlineRate: Math.min(2, 0.2 + 0.1 * sk(s, 'i2') + 0.1 * perk(s, 'warp') + bonus.offline / 100) * (s.shop.perpetual ? 1 : OFFLINE_CUT),
    offlineHours: s.shop.perpetual ? PERPETUAL_H : Math.min(OFFLINE_MAX_H, 2 + 2 * sk(s, 'i3') + 2 * perk(s, 'warp')),
    comboCap: 50 + 25 * sk(s, 'm4') + 50 * perk(s, 'combogod'),
    autoRate: sk(s, 'm5') + 0.5 * bot(s, 'tap'),
    autoOpen: Math.min(sk(s, 'i5') > 0 ? Math.max(3, 12 - sk(s, 'i5')) : 99, bot(s, 'opener') > 0 ? Math.max(0.8, 10 - 0.46 * bot(s, 'opener')) : 99) % 99,
    mergeBot: bot(s, 'merger') > 0, minerGems: bot(s, 'miner'), skinCount: skinN,
    gachaCost: Math.ceil(10 * (1 - 0.05 * sk(s, 'l6'))),
    xpNeed: Math.floor(25 * Math.pow(1.34, lv - 1)),
    collected,
  };
}

export const OFFLINE_CUT = 0.1, OFFLINE_MAX_H = 48, PERPETUAL_H = 168;
// shop: Golden Touch multiplies all income by this; Divine Pact multiplies divine power from every rebirth
export const GOLDEN_X = 10, PACT_X = 3;

export function pickWeighted(w          ) {
  let sum = 0; for (const x of w) sum += x;
  let r = Math.random() * sum;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return w.length - 1;
}

export const CHEST_GRADE_W = [[85, 14, 1, 0], [55, 35, 9, 1], [20, 45, 28, 7], [0, 30, 45, 25]];
export const CHEST_ITEM_P = [0.5, 0.75, 1, 1];
export const CHEST_ITEMS = [1, 1, 1, 2];
export const CHEST_XP = [5, 15, 50, 200];

export function addCoins(s       , n               ) {
  const v = dec(n, 0);
  if (v.mantissa <= 0) return;
  s.coins = s.coins.add(v); s.runCoins = s.runCoins.add(v); s.lifeCoins = s.lifeCoins.add(v);
}
/** pay a Decimal price; false (nothing changes) when the price is invalid or unaffordable */
export function spend(s       , c         ) {
  if (!okDec(c) || c.mantissa < 0 || s.coins.lt(c)) return false;
  s.coins = s.coins.sub(c);
  if (s.coins.mantissa < 0) s.coins = ZERO;
  return true;
}

// returns true if item is new (species-grade never seen before)
export function addItem(s       , sp        , g        ) {
  s.inv[sp * GRADES + g]++;
  const isNew = !(s.seen[sp] & (1 << g));
  s.seen[sp] |= 1 << g;
  return isNew;
}

export function mergeAll(s       ) {
  let merges = 0, gems = 0;
  for (let sp = 0; sp < SPECIES; sp++) {
    for (let g = 0; g < GRADES - 1; g++) {
      const i = sp * GRADES + g;
      // keep 1 of each grade for display? no: merging consumes; best grade still counts
      while (s.inv[i] >= 3) { s.inv[i] -= 3; addItem(s, sp, g + 1); merges++; }
    }
    const li = sp * GRADES + 3;
    if (s.inv[li] > 1) { gems += (s.inv[li] - 1) * 25; s.inv[li] = 1; }
  }
  s.gems += gems;
  return { merges, gems };
}

// sqrt curve: the first rebirth is reachable early, and every extra 100x of this run's coins
// adds a big step of divine power — rebirthing early is never a trap.
export function rebirthGain(s       )          {
  if (s.runCoins.lt(2e6)) return ZERO;
  return Decimal.max(1, s.runCoins.div(2e6).sqrt().mul(1 + 0.2 * perk(s, 'echo')).floor()).mul(s.shop.pact ? PACT_X : 1);
}
// fresh-rebirth momentum: the run right after a rebirth is clearly faster, decaying over 30 min
export const MOM_SEC = 1800;
export function momentum(s       , now = Date.now()) {
  if (!s.momT || s.rebirths <= 0) return 1;
  const left = Math.max(0, 1 - (now - s.momT) / (MOM_SEC * 1000));
  return 1 + 0.5 * Math.min(s.rebirths, 10) * left;
}
// every permanent multiplier in one place: divine power, origin talent, trophies/mushrooms, momentum
export function permMult(s       , now = Date.now()) {
  return s.dpTotal.mul(0.1).add(1).mul((1 + 0.25 * perk(s, 'origin')) * fxGlobal(s.fx) * momentum(s, now));
}

export function doRebirth(s       ) {
  const g = rebirthGain(s);
  if (g.lte(0)) return ZERO;
  s.dp = s.dp.add(g); s.dpTotal = s.dpTotal.add(g); s.rebirths++;
  const keep = 0.1 * perk(s, 'keep');
  const gens                         = {};
  for (const k in s.gens) { const n = Math.floor(s.gens[k] * keep); if (n > 0) gens[k] = n; }
  const head = perk(s, 'head');
  s.momT = Date.now();
  s.coins = head > 0 ? new Decimal(5000 * Math.pow(20, head - 1)) : ZERO; s.runCoins = ZERO; s.ups = {}; s.gens = gens; s.chests = []; s.fx.bank = ZERO; s.fx.bankP = ZERO;
  return g;
}
