// 局外成长、每日挑战的数据与纯函数。
// 持久化统一走 gp.player.saves 的 __sys_meta 槽(独立于 run 自动存档)。
// 这里只放"数据 + 纯计算",不碰 DOM / Pixi / 平台接口,便于单独验证。

// 宝石升级只留“局内数值成长”(靠玩挣);**便利型功能一律改走平台金币**,不白送。
                                                

                        
             
                  
              
                 
                 
                            
               
 

export const UPGRADES          = [
  { key: "warn", max: 3, cost: [40, 90, 180], i18n: "upWarn" },
  { key: "starter", max: 2, cost: [50, 120], i18n: "upStarter" },
  { key: "luck", max: 2, cost: [30, 70], i18n: "upLuck" },
];

                            
               
                            
                            
                                    
                                                                          
                                       
                       
 

/** 金币消耗品:便利功能要花钱买,不白送 */
                                           

                            
                 
                    
                
                 
               
                            
               
 

export const CONSUMABLES              = [
  { key: "shake", price: 2, pack: 1, i18n: "shopShake" },
  { key: "revive", price: 4, pack: 1, i18n: "shopRevive" },
];

export const consumDef = (key           )            =>
  CONSUMABLES.find((c) => c.key === key) ?? CONSUMABLES[0];

export const emptyMeta = ()            => ({
  gems: 0,
  up: { warn: 0, starter: 0, luck: 0 },
  consum: { shake: 0, revive: 0 },
  daily: { date: "", best: 0, streak: 0, lastDate: "" },
});

/** 读回存档时把任意脏数据收敛成合法状态 */
export function normalizeMeta(raw     )            {
  const m = emptyMeta();
  if (!raw || typeof raw !== "object") return m;
  if (Number.isFinite(raw.gems)) m.gems = Math.max(0, Math.floor(raw.gems));
  for (const u of UPGRADES) {
    const v = raw.up?.[u.key];
    if (Number.isFinite(v)) m.up[u.key] = Math.min(u.max, Math.max(0, Math.floor(v)));
  }
  const d = raw.daily;
  if (d && typeof d === "object") {
    m.daily = {
      date: typeof d.date === "string" ? d.date : "",
      best: Number.isFinite(d.best) ? Math.max(0, Math.floor(d.best)) : 0,
      streak: Number.isFinite(d.streak) ? Math.max(0, Math.floor(d.streak)) : 0,
      lastDate: typeof d.lastDate === "string" ? d.lastDate : "",
    };
  }
  for (const c of CONSUMABLES) {
    const v = raw.consum?.[c.key];
    if (Number.isFinite(v)) m.consum[c.key] = Math.min(99, Math.max(0, Math.floor(v)));
  }
  if (Number.isFinite(raw.totalMerges)) m.totalMerges = Math.max(0, Math.floor(raw.totalMerges));
  return m;
}

/** 本局应得的宝石:分数 + 合成数 + 最大果,再乘幸运加成 */
export function gemReward(score        , mergeCount        , biggest        , luckLevel        )         {
  const base = Math.floor(score / 400) + Math.floor(mergeCount / 25) + Math.max(0, biggest - 8) * 2;
  const mult = 1 + 0.3 * Math.min(2, Math.max(0, luckLevel));
  return Math.max(0, Math.round(base * mult));
}

/** 下一级升级价格;已满级返回 null */
export function nextCost(key       , level        )                {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def || level >= def.max) return null;
  return def.cost[level];
}

/** 本地日期键 YYYY-MM-DD(每日挑战以本地日为界) */
export function dailyKey(d       = new Date())         {
  const p = (n        ) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 由日期键派生当日种子(同一天所有玩家拿到同一副"牌局") */
export function seedFrom(s        )         {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 可复现的整数随机流 */
export function mulberry32(seed        )               {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
