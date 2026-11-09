// Persistent progress (cloud autosave) + derived character stats.
import { CHARS, CHAR_BY_ID, ELEMENTS, TIER_STAT, TIER_ENERGY, tierCost } from './data.js';
                                                  
                                      

                       
       
                                           
                                
                                
                 
              
                  
                                             
                                                                       
 

function fresh()       {
  return {
    v: 1, cleared: 0, sv: 2, owned: [],
    tiers: Object.fromEntries(CHARS.map(c => [c.id, 0])),
    gems: { fire: 0, water: 0, wood: 0, light: 0, dark: 0 },
    prism: 0,
    team: ['mira', 'shizuku', 'hina', 'wakaba'],
  };
}

export let save       = fresh();

/**
 * 存档后端。插件里是 `host.storage`（`src/host.js` 的 makeHostStore），
 * 独立网页里是 localStorage 版。**必须在 `loadSave()` 之前注入。**
 */
let store = null;
export function setStore(s) { store = s; }

export function loadSave() {
  try {
    // ★ 原来这里是 `window.gp.player.saves.latestSync`（平台云存档）。
    //   换成注入的 store：读的是 `preload()` 之后的内存缓存，同步、不 await。
    const d = store ? store.get('save') : null;
    if (d && d.v === 1) {
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
    }
  } catch { save = fresh(); }
}

export function persist() {
  // 只写内存 + 标脏，真正的落盘在 unmount 的 `store.flush()` 里。
  try { store?.set('save', save); } catch { /* 落盘失败不该打断游戏 */ }
}

export function isUnlocked(c         ) { return save.cleared >= c.unlockAfter || (save.owned || []).includes(c.id); }
// 付费解锁（grantHero / grantHeroes）随 `purchase.js` 一起删掉了：
// 锁着的角色现在**只能靠通关解锁**（`unlockAfter`）。
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
