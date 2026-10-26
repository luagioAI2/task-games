// Persistent progress (cloud autosave) + derived character stats.
import { CHARS, CHAR_BY_ID, ELEMENTS, TIER_STAT, TIER_ENERGY, tierCost } from './data.js';
                                                  
                                      

                       
       
                                           
                                
                                
                 
              
                  
                                             
                                                                       
 

function fresh()       {
  return {
    v: 1, cleared: 0, sv: 2, owned: [],
    tiers: Object.fromEntries(CHARS.map(c => [c.id, 0])),
    gems: { fire: 0, water: 0, wood: 0, light: 0, dark: 0 },
    prism: 0, paid: [],
    team: ['mira', 'shizuku', 'hina', 'wakaba'],
  };
}

export let save       = fresh();

export function loadSave() {
  try {
    const s = window.gp?.player?.saves;
    const info = s?.latestInfo;
    const d = s?.latestSync;
    if (d && !(info && info.legacy) && d.v === 1) {
      const f = fresh();
      save = {
        ...f, ...d,
        tiers: { ...f.tiers, ...(d.tiers || {}) },
        gems: { ...f.gems, ...(d.gems || {}) },
        team: Array.isArray(d.team) && d.team.length === 4 ? d.team.filter((id        ) => CHAR_BY_ID[id]) : f.team,
      };
      if (save.team.length !== 4) save.team = f.team;
      if (d.sv !== 2) {
        // earlier layout unlocked heroines at stages 2/4/6/8/10/12 — keep whoever was already earned
        const old                         = { karin: 2, shion: 4, akari: 6, amane: 8, kureha: 10, yoruka: 12 };
        save.owned = Object.keys(old).filter(id => save.cleared >= old[id]);
        save.sv = 2;
      }
      if (!Array.isArray(save.owned)) save.owned = [];
      if (typeof save.prism !== 'number' || !(save.prism >= 0)) save.prism = 0;
      if (!Array.isArray(save.paid)) save.paid = [];
    }
  } catch { save = fresh(); }
}

export function persist() {
  try { window.gp?.player?.saves?.putLatest(save); } catch { /* host keeps retrying */ }
}

export function isUnlocked(c         ) { return save.cleared >= c.unlockAfter || (save.owned || []).includes(c.id); }
/** Heroine bought with platform coins — granted by grantHero() on a successful purchase / startup settle. */
export function grantHero(id        )       {
  if (isUnlocked(CHAR_BY_ID[id])) return false;
  if (!save.owned.includes(id)) save.owned.push(id);
  persist();
  return true;
}
export function grantHeroes(ids          ) { let n = 0; for (const id of ids) if (CHAR_BY_ID[id] && grantHero(id)) n++; return n; }
export function tierOf(id        ) { return save.tiers[id] || 0; }

export function stats(id        ) {
  const c = CHAR_BY_ID[id];
  const t = tierOf(id);
  const m = TIER_STAT[t];
  return { hp: Math.round(c.hp * m), atk: Math.round(c.atk * m), spd: c.spd * (1 + 0.06 * t), energyRate: TIER_ENERGY[t] };
}

/** Crystals still missing after the player's own elemental crystals — colorless (prism) crystals cover them. */
export function shortfall(cost                                  ) {
  return ELEMENTS.reduce((n, e) => n + Math.max(0, (cost[e] || 0) - (save.gems[e] || 0)), 0);
}
export function canAfford(cost                                  ) {
  return shortfall(cost) <= (save.prism || 0);
}
/** Colorless crystals bought with platform coins; purchaseId dedupes a delivery seen twice. */
export function grantPrism(n        , purchaseId        )          {
  if (purchaseId && save.paid.includes(purchaseId)) return false;
  save.prism = (save.prism || 0) + n;
  if (purchaseId) { save.paid.push(purchaseId); if (save.paid.length > 60) save.paid.splice(0, save.paid.length - 60); }
  persist();
  return true;
}

export function tryUpgrade(id        )          {
  const c = CHAR_BY_ID[id];
  const tier = tierOf(id);
  const cost = tierCost(c, tier);
  if (!cost || !canAfford(cost)) return false;
  for (const e of ELEMENTS) {
    const need = cost[e] || 0, own = Math.min(save.gems[e] || 0, need);
    save.gems[e] -= own;
    save.prism -= need - own;
  }
  save.tiers[id] = tier + 1;
  persist();
  return true;
}
