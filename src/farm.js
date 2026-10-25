// Farm engine: state, deterministic dice, market, quota gate, actions.
// Pure logic, no rendering. Every outcome comes from hashRandom(seed) — never Math.random (spec §12.4).
import {
  CROPS, ANIMALS, cropById, animalById, PER_YIELD, MS_PER_FARM_MIN, FARM_DAY_MIN, HUNGRY_FARM_MIN,
  PRICE_FLOOR, PRICE_DAILY_SWING, SELL_IMPACT_PER_UNIT, PLOT_UNLOCK, ITEM_PRICE, RANCH_CAP, POND_CAP,
  capCrop, capAnimal, farmLevel, speciesCap,              
  BASK_MIN, BASK_BOOST_MIN, BASK_BOOST_FED_MIN, BASK_COOLDOWN_MIN, BASK_SPOTS, FED_HAPPY_MIN,
  DRY_MIN, PEST_RATE, PEST_SLOT_MIN, PEST_PLANT_P, WEATHER_RAIN_P, WEATHER_CLOUD_P, POOP_RATE, POOP_SPEED,
} from "./data/catalog.js";
import { Wallet } from "./wallet.js";

export const SAVE_VERSION = 1;
const SALT = "kqf";

                         
                                                                                        
                                                               
                                                                                                                                  
                                                                     
  
                                                                 
                      
                                                                               
                                                                                            
                                      
                                                                   
  
                                                                              
                                                                                                   
// 事件类日志（农场事件面板只显示这些）；操作类（加积分/卖出/领养/喂食）不进面板
const LOG_EVENTS = new Set([
  "log.weather_good", "log.pest", "log.disease", "log.weather_bad", "log.wither", "log.cropDied",
  "log.animalWither", "log.warded", "log.levelup", "log.rain", "log.dry", "log.pestNow",
  "log.sick", "log.died", "log.bugCaught", "log.recovered", "log.balloon", "log.disinfect", "log.fishingCatch", "log.fishingFail",
  "log.poop", "log.poopClean", "log.treebuy",
]);
                         
                                                                               
                                                                                      
                                                                                               
                                                              
                                                              
                                        
  
// 神圣梧桐规则：L6、一次性 20000 🪙，v53 起渲染在池塘右侧河岸 (668,1856)（world.ts WUTONG_SPOT 常量，不进存档），不占地块；三阶段分界（农场分钟）0/480/1440。
export const WUTONG_COST = 1000; // v55：20000→1000（种子栏最高档，纯观赏神树，无产出 buff）
export const WUTONG_LEVEL = 6;
export const WUTONG_STAGE_MIN = [0, 480, 1440];
export const wutongStage = (ageMs        ) => { const m = ageMs / MS_PER_FARM_MIN; return m >= WUTONG_STAGE_MIN[2] ? 2 : m >= WUTONG_STAGE_MIN[1] ? 1 : 0; };

export function newFarm(now        )            {
  return {
    v: SAVE_VERSION, points: 0, harvest: 0,
    plots: PLOT_UNLOCK.map(p => ({ unlocked: p === 0, crop: null })),
    animals: [], bag: { fertilizer: 3 }, quotas: [], totalHarvests: 0, nextId: 1,
    pressure: {}, log: [], logSeenAt: now, onboard: 0, createdAt: now,
  };
}

export function parseSave(d         )                   {
  if (!d || typeof d !== "object") return null;
  const s = d             ;
  if (s.v !== SAVE_VERSION) return null;
  if (typeof s.points !== "number" || !Array.isArray(s.plots) || s.plots.length !== 12 || !Array.isArray(s.animals)) return null;
  for (const p of s.plots) {
    const cs = p.crop;
    if (cs) {
      if (cs.dryLeft == null) cs.dryLeft = DRY_MIN * MS_PER_FARM_MIN;
      if (cs.pestCheckedUntil == null) cs.pestCheckedUntil = cs.plantedAt;
      cs.pest = !!cs.pest;
    }
  }
  return s;
}

// ---------- deterministic randomness ----------
export function hashRandom(str        )         {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
  return ((h >>> 0) % 1000000) / 1000000;
}

;                                                                   
export const TIERS                                                          = [
  { kind: "wither", p: 0.01, lo: 0, hi: 0 },
  { kind: "weather_good", p: 0.10, lo: 1.10, hi: 1.20 },
  { kind: "pest", p: 0.15, lo: 0.70, hi: 0.80 },
  { kind: "disease", p: 0.06, lo: 0.55, hi: 0.65 },
  { kind: "weather_bad", p: 0.04, lo: 0.45, hi: 0.55 },
  { kind: "none", p: 0.64, lo: 0.92, hi: 0.92 },
];
export function pickTier(seed        )                                   {
  const r = hashRandom(seed);
  let acc = 0;
  for (const t of TIERS) {
    acc += t.p;
    if (r < acc) return { kind: t.kind, mult: t.lo + (t.hi - t.lo) * hashRandom(seed + "|m") };
  }
  return { kind: "none", mult: 0.92 };
}

// 收获时还带着没捉的虫：换一套偏坏的权重（经济的总量节奏不变，只让坏档更容易出现）
export const PEST_TIERS                                                          = [
  { kind: "wither", p: 0.12, lo: 0, hi: 0 },
  { kind: "weather_good", p: 0.02, lo: 1.10, hi: 1.20 },
  { kind: "pest", p: 0.40, lo: 0.70, hi: 0.80 },
  { kind: "disease", p: 0.18, lo: 0.55, hi: 0.65 },
  { kind: "weather_bad", p: 0.10, lo: 0.45, hi: 0.55 },
  { kind: "none", p: 0.18, lo: 0.92, hi: 0.92 },
];
export function pickTierPest(seed        )                                   {
  const r = hashRandom(seed);
  let acc = 0;
  for (const t of PEST_TIERS) {
    acc += t.p;
    if (r < acc) return { kind: t.kind, mult: t.lo + (t.hi - t.lo) * hashRandom(seed + "|m") };
  }
  return { kind: "none", mult: 0.92 };
}

/** 季节加成按真实日历判定，刻意不在 UI 上提示 */
export function seasonBonus(ms        )         {
  const d = new Date(ms); const m = d.getMonth() + 1, day = d.getDate(), w = d.getDay();
  if (m === 6 && day === 1) return 1.8;
  if (m === 1 && day === 1) return 1.6;
  if (m === 5 && day === 1) return 1.5;
  if (m === 10 && day <= 2) return 1.6;
  if (m === 10 && day === 3) return 1.5;
  if (w === 0 || w === 6) return 1.35;
  if (w === 5) return 1.12;
  return 1;
}
const yieldOf = (mult        , bonus        ) => Math.min(PER_YIELD, Math.max(0, Math.round(PER_YIELD * mult * bonus)));

// ---------- market ----------
export const farmDay = (ms        ) => Math.floor(ms / MS_PER_FARM_MIN / FARM_DAY_MIN);
export function dayPrice(item        , day        )         {
  const base = ITEM_PRICE[item];
  const phase = hashRandom(item) * Math.PI * 2;
  const drift = Math.sin((day / 90) * Math.PI * 2 + phase) * 0.06;
  const noise = hashRandom(`${day}|${item}`) * 2 - 1;
  const p = base * (1 + drift) + noise * base * PRICE_DAILY_SWING;
  return Math.max(base * PRICE_FLOOR, Math.min(base, p));
}

// ---------- engine ----------
;                      
                      
                                                                     
                                                                                                                                              
                                                                                                     
                                     
                                        
                                      
                                  
                                    
                                    
                       
                                                                 
                                     
                                                          
                                                                                                                   
                                                                      
                                                                                                      
                                                
                                                    
                                                                                           
                                                                                                                              

export class Farm {
  s           ;
  timeOffset = 0;
  selectedSeed                = null;
          listeners                             = [];
  /**
   * 积分钱包。**所有花钱的动作都必须过它**（见 `src/wallet.js`）——
   * `s.points` 只是它写回来的显示镜像，不能直接加减。
   *
   * @param {object} state
   * @param {object|null} [host] 宿主 HostApi；null = 独立网页
   */
  constructor(state           , host = null) { this.s = state; this.wallet = new Wallet(host, state); }

  now() { return Date.now() + this.timeOffset; }
  on(fn                        ) { this.listeners.push(fn); }
  emit(e           ) { for (const l of this.listeners) l(e); }
          changed() { this.emit({ type: "change" }); }
  logEvent(k        , p                                  ) { this.log(k, p); }
          log(k        , p                                  ) {
    this.s.log.unshift({ t: this.now(), k, p, ev: LOG_EVENTS.has(k) });
    if (this.s.log.length > 80) this.s.log.length = 80;
  }
  get level() { return farmLevel(this.s.totalHarvests); }

  // ----- 积分：只有「花」，没有「加」 -----
  //
  // 原版这里有个 `addPoints()` —— HUD 上的「＋」按钮凭空打钱，捉虫 / 气球 /
  // 消毒再撒一点。接进宿主后**整条删掉**：宿主的 `HostApi` 里没有任何一扇门
  // 能往积分账本写正数（见 `src/economy.js` 顶部那张表）。积分只来自
  // 任务 / 打卡 / 家长手动调整，游戏**只能花**。
  //
  // 所有花钱的动作统一走 `pay()` —— 够不够、怎么扣、宿主拒绝怎么办，
  // 全在 `src/wallet.js` 里，这里不碰 `s.points`。
  pay(cost        , memo        , needKey = "toast.needPoints") {
    if (this.wallet.spend(cost, memo)) return true;
    this.emit({ type: "toast", k: needKey, p: { n: cost } });
    return false;
  }

  // ----- plots -----
  // ----- weather / water / pests -----
  farmDay(now = this.now()) { return Math.floor(now / (FARM_DAY_MIN * MS_PER_FARM_MIN)); }
  weather(now = this.now())                           {
    const r = hashRandom(`weather|${this.farmDay(now)}`);
    return r < WEATHER_RAIN_P ? "rain" : r < WEATHER_RAIN_P + WEATHER_CLOUD_P ? "cloud" : "sun";
  }
  /** { thirsty, pest } for a growing crop (both false otherwise) */
  plotNeeds(cs                  , now = this.now())                                      {
    if (!cs || cs.dead || cs.old || now >= cs.readyAt) return { thirsty: false, pest: false };
    return { thirsty: this.weather(now) !== "rain" && (cs.dryLeft ?? 0) <= 0, pest: !!cs.pest };
  }
  water(i        ) {
    const cs = this.s.plots[i]?.crop;
    if (!cs || cs.dead || cs.old || this.now() >= cs.readyAt) return false;
    cs.dryLeft = DRY_MIN * MS_PER_FARM_MIN; cs.dryNotified = false;
    this.emit({ type: "watered", plot: i }); this.changed();
    return true;
  }
  catchPest(i        ) {
    const cs = this.s.plots[i]?.crop;
    if (!cs || !cs.pest) return false;
    const now = this.now();
    // 捉虫小奖励：1~2 袋神奇肥料（确定性摇号）。
    // ⚠️ 原来是 2~5 🪙 —— 积分不能再由游戏发（见上面 `pay()` 的注释）。
    //    改发肥料：它是游戏里真实有用、又不进账本的资源，奖励感不丢。
    const bonus = 1 + Math.floor(hashRandom(`bugbonus|${i}|${cs.plantedAt}|${cs.pestAt ?? 0}`) * 2);
    cs.pest = false; cs.pestAt = null; cs.pestCheckedUntil = now; cs.lastTickAt = now;
    this.s.bag.fertilizer = (this.s.bag.fertilizer ?? 0) + bonus;
    this.log("log.bugCaught", { n: bonus });
    this.emit({ type: "bugCaught", plot: i, bonus }); this.changed();
    return true;
  }

  unlockPrice(i        ) { return PLOT_UNLOCK[i] ?? 1200; }
  unlockPlot(i        ) {
    const p = this.s.plots[i]; if (!p || p.unlocked) return false;
    const cost = this.unlockPrice(i);
    if (!this.pay(cost, `开垦第 ${i + 1} 块地`)) return false;
    p.unlocked = true;
    this.emit({ type: "unlocked", plot: i }); this.changed();
    return true;
  }

  canPlant(id        )                            {
    const c = cropById(id);
    if (c.level > this.level.level) return "level";
    if (!this.wallet.canAfford(c.seed)) return "points";
    return "ok";
  }
  plant(i        , id        ) {
    const p = this.s.plots[i]; if (!p || !p.unlocked || p.crop) return false;
    const c = cropById(id);
    const why = this.canPlant(id);
    if (why === "level") { this.emit({ type: "toast", k: "toast.needLevel", p: { n: c.level } }); return false; }
    if (why === "points") { this.emit({ type: "toast", k: "toast.needPoints", p: { n: c.seed } }); return false; }
    if (!this.pay(c.seed, `买种子 · ${c.id}`)) return false;
    const now = this.now();
    const q = this.s.nextId++;
    this.s.quotas.push({ id: q, item: c.item, cap: capCrop(c), earned: 0 });
    // 中期生虫预定：22% 概率在生长期 35%~70% 处必来一只虫（确定性摇号；雨天不会真的触发，见 tick）
    const growMs = c.growMin * MS_PER_FARM_MIN;
    const pestPlanAt = hashRandom(`pest0|${i}|${now}`) < PEST_PLANT_P
      ? now + Math.round(growMs * (0.35 + hashRandom(`pest0f|${i}|${now}`) * 0.35))
      : null;
    p.crop = { id, plantedAt: now, stageStart: now, readyAt: now + growMs, harvested: 0, q,
      dryLeft: DRY_MIN * MS_PER_FARM_MIN, dryNotified: false, pestCheckedUntil: now, pestPlanAt };
    this.emit({ type: "planted", plot: i }); this.changed();
    return true;
  }

  /** 0..3: 0 seed, 1 sprout, 2 growing, 3 mature */
  stage(cs           , now = this.now())                                                    {
    if (now >= cs.readyAt) return { stage: 3, progress: 1, left: 0 };
    const total = Math.max(1, cs.readyAt - cs.stageStart);
    const progress = Math.max(0, Math.min(1, (now - cs.stageStart) / total));
    const regrow = cs.harvested > 0;
    const stage = regrow ? 2 : progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
    return { stage, progress, left: cs.readyAt - now };
  }

  fertilize(i        ) {
    const p = this.s.plots[i]; const cs = p?.crop; if (!cs || cs.dead || cs.old) return false;
    const now = this.now();
    if (now >= cs.readyAt) return false;
    if ((this.s.bag.fertilizer ?? 0) <= 0) { this.emit({ type: "toast", k: "toast.noFertilizer" }); return false; }
    this.s.bag.fertilizer--;
    cs.readyAt = Math.round(now + (cs.readyAt - now) * 0.5);
    this.emit({ type: "fertilized", plot: i }); this.changed();
    return true;
  }

  clearPlot(i        ) {
    const p = this.s.plots[i]; const cs = p?.crop; if (!cs || !(cs.dead || cs.old)) return false;
    p.crop = null; // 剩余额度留在 quotas 里 = 结转（quotaCarry）
    this.emit({ type: "cleared", plot: i }); this.changed();
    return true;
  }

  /** Harvest a ripe plot. mode store → bag; sell → today's price straight to 🌾. */
  harvest(i        , mode                  ) {
    const p = this.s.plots[i]; const cs = p?.crop; if (!cs || cs.dead || cs.old) return null;
    const now = this.now(); if (now < cs.readyAt) return null;
    const c = cropById(cs.id);
    const seed = `${i}|${cs.id}|${cs.harvested}|${cs.plantedAt}|${SALT}`;
    const tier = cs.pest ? pickTierPest(seed) : pickTier(seed);
    const amount = tier.kind === "wither" ? 0 : yieldOf(tier.mult, seasonBonus(now));
    cs.harvested++;
    this.bumpHarvests();
    let died = false;
    if (tier.kind === "wither") {
      if (c.perennial && hashRandom(seed + "|die") < 0.45) died = true;
      this.log(died ? "log.cropDied" : "log.wither", { c: c.id });
    } else this.logTier(tier.kind, tier.mult, c.id);
    let earned = 0;
    if (amount > 0) {
      this.s.bag[c.item] = (this.s.bag[c.item] ?? 0) + amount;
      if (mode === "sell") earned = this.sellInternal(c.item, amount).earned;
    }
    if (died) { cs.dead = true; }
    else if (cs.harvested >= c.times) {
      if (c.perennial) cs.old = true; else p.crop = null;
    } else {
      cs.stageStart = now; cs.readyAt = now + c.regrowMin * MS_PER_FARM_MIN; cs.ripeSeen = false;
      cs.pest = false; cs.pestAt = null; cs.pestPlanAt = null; cs.pestCheckedUntil = now; cs.lastTickAt = now; cs.dryLeft = DRY_MIN * MS_PER_FARM_MIN; // 重新长：新一轮随机事件
    }
    this.emit({ type: "harvested", plot: i, item: c.item, amount, kind: tier.kind, mode, earned });
    this.changed();
    return { amount, kind: tier.kind, earned };
  }

          logTier(kind          , mult        , who        ) {
    if (kind === "none") return;
    this.log("log." + kind, { c: who, pct: Math.round(mult * 100) });
  }
          bumpHarvests() {
    const before = this.level.level;
    this.s.totalHarvests++;
    const after = this.level.level;
    if (after > before) {
      this.s.bag.fertilizer = (this.s.bag.fertilizer ?? 0) + 1;
      const unlocked = [...CROPS.filter(c => c.level === after).map(c => c.id), ...ANIMALS.filter(a => a.level === after).map(a => a.id)];
      this.log("log.levelup", { n: after });
      this.emit({ type: "levelup", level: after, unlocked });
    }
  }

  // ----- animals & pond -----
  zoneCount(zone                  ) { return this.s.animals.filter(a => !a.dead && animalById(a.kind).zone === zone).length; }
  zoneCap(zone                  ) { return zone === "ranch" ? RANCH_CAP : POND_CAP; }
  /** v53 同种上限：牧场目录里田园犬（dog）及其后的动物、以及永久神物（玉龙）同一时间 1 只；其余每种 3 只。 */
  speciesCap(id        ) { return speciesCap(id); }
  /** 同种在场数：仍在名单里且未离世（含幼体；气球被戳破/鱼骨气泡清理/告别后移出名单即释放名额） */
  speciesCount(id        ) { return this.s.animals.filter(a => a.kind === id && !a.dead).length; }
  canAdopt(id        )                                                 {
    const a = animalById(id);
    if (a.level > this.level.level) return "level";
    if (this.speciesCount(id) >= speciesCap(id)) return "species";
    if (this.zoneCount(a.zone) >= this.zoneCap(a.zone)) return "full";
    if (!this.wallet.canAfford(a.cost)) return "points";
    return "ok";
  }
  removeRemains(uid        ) {
    const an = this.animal(uid);
    if (!an || animalById(an.kind).zone !== "pond" || an.dead) return false;
    const info = this.animalInfo(an);
    if (!(info.spent || info.mood === "deceased")) return false;
    this.s.animals = this.s.animals.filter(a => a.uid !== uid);
    this.log("log.fishClear", { c: an.kind });
    this.changed();
    return true;
  }

  adoptFree(id        )                {
    const a = animalById(id);
    if (this.zoneCount(a.zone) >= this.zoneCap(a.zone) || this.speciesCount(id) >= speciesCap(id)) return null;
    const now = this.now();
    const q = this.s.nextId++;
    this.s.quotas.push({ id: q, item: a.item, cap: capAnimal(a), earned: 0 });
    const an         = { uid: this.s.nextId++, kind: id, bornAt: now, rounds: 0, lastFedAt: now, pausedMs: 0, sickSince: null, sickChecked: 0, dead: false, q, poopSince: null, poopChecked: 0 };
    this.s.animals.push(an);
    this.log("log.fishingCatch", { c: id });
    this.emit({ type: "adopted", uid: an.uid }); this.changed();
    return an;
  }
  adopt(id        ) {
    const a = animalById(id); const why = this.canAdopt(id);
    if (why === "level") { this.emit({ type: "toast", k: "toast.needLevel", p: { n: a.level } }); return null; }
    if (why === "species") { this.emit({ type: "toast", k: "toast.speciesCap", p: { c: id, n: speciesCap(id) } }); return null; }
    if (why === "full") { this.emit({ type: "toast", k: a.zone === "ranch" ? "toast.ranchFull" : "toast.pondFull" }); return null; }
    if (why === "points") { this.emit({ type: "toast", k: "toast.needPoints", p: { n: a.cost } }); return null; }
    if (!this.pay(a.cost, `领养 · ${a.id}`)) return null;
    const now = this.now();
    const q = this.s.nextId++;
    this.s.quotas.push({ id: q, item: a.item, cap: capAnimal(a), earned: 0 });
    const an         = { uid: this.s.nextId++, kind: id, bornAt: now, rounds: 0, lastFedAt: now, pausedMs: 0, sickSince: null, sickChecked: 0, dead: false, q, poopSince: null, poopChecked: 0 };
    this.s.animals.push(an);
    this.log("log.adopt", { c: id });
    this.emit({ type: "adopted", uid: an.uid }); this.changed();
    return an;
  }
  animal(uid        ) { return this.s.animals.find(a => a.uid === uid); }

  /** v51 神圣梧桐：L6、20000 🪙、永久一颗，v53 起显示在池塘右侧河岸（不占地块）。 */
  canBuyWutong()                                     {
    if (this.s.wutong) return "done";
    if (this.level.level < WUTONG_LEVEL) return "level";
    if (!this.wallet.canAfford(WUTONG_COST)) return "points";
    return "ok";
  }
  buyWutong()          {
    const why = this.canBuyWutong();
    if (why === "done") return true;
    if (why === "level") { this.emit({ type: "toast", k: "toast.needLevel", p: { n: WUTONG_LEVEL } }); return false; }
    if (why === "points") { this.emit({ type: "toast", k: "toast.needPoints", p: { n: WUTONG_COST } }); return false; }
    if (!this.pay(WUTONG_COST, "神圣梧桐")) return false;
    this.s.wutong = { plantedAt: this.now() };
    this.log("log.treebuy", {});
    this.emit({ type: "treebuy" }); this.changed();
    return true;
  }

  /** effective (unpaused) elapsed ms since born */
          effAge(an        , now        ) {
    const sickPause = an.sickSince != null ? now - an.sickSince : 0;
    const poopSlow = an.poopSince != null ? (now - an.poopSince) * (1 - POOP_SPEED) : 0; // 有粑粑：生产/成长减速
    return now - an.bornAt - an.pausedMs - sickPause - poopSlow;
  }
  animalInfo(an        , now = this.now()) {
    const d = animalById(an.kind);
    // 神兽光环（v50）：活着且已成熟的神兽猫在场时，其它同伴生产间隔 ×0.95（产出提速 5%，祝福型加法 buff）
    const aura = d.id !== "mythcat" && this.s.animals.some(a2 =>
      a2.kind === "mythcat" && !a2.dead && this.effAge(a2, now) >= animalById("mythcat").matureMin * MS_PER_FARM_MIN);
    const matureMs = d.matureMin * MS_PER_FARM_MIN, intMs = d.intervalMin * MS_PER_FARM_MIN * (aura ? 0.95 : 1);
    const age = this.effAge(an, now);
    const mature = age >= matureMs;
    const produced = mature ? Math.min(d.times, Math.floor((age - matureMs) / intMs)) : 0;
    const ready = Math.max(0, produced - an.rounds);
    const spent = !d.permanent && an.rounds >= d.times;
    const nextAt = mature && !spent ? matureMs + (produced + 1) * intMs - age : matureMs - age;
    const hungry = now - an.lastFedAt > HUNGRY_FARM_MIN * MS_PER_FARM_MIN;
    let mood                                                                                            ;
    if (an.dead) mood = "deceased";
    else if (an.sickSince != null) mood = "sick";
    else if (an.poopSince != null) mood = "poop";
    else if (an.baskUntil != null && now < an.baskUntil) mood = "basking";
    else if (spent) mood = "spent";
    else if (hungry) mood = "hungry";
    else if (an.rounds >= d.times - 1 && d.times > 1) mood = "old";
    else if (now - an.lastFedAt < FED_HAPPY_MIN * MS_PER_FARM_MIN) mood = "happy";
    else mood = "normal";
    const growP = Math.min(1, age / matureMs);
    const cycleP = mature && !spent ? 1 - Math.max(0, nextAt) / intMs : 0;
    return { def: d, mature, ready: an.dead ? 0 : ready, spent, nextAt: Math.max(0, nextAt), mood, growP, cycleP };
  }

  collect(uid        ) {
    const an = this.animal(uid); if (!an || an.dead) return null;
    const info = this.animalInfo(an); if (info.ready <= 0) return null;
    const d = info.def; const now = this.now(); const bonus = seasonBonus(now);
    let total = 0; let worst           = "none"; let worstMult = 9; let warded                    ;
    for (let k = 0; k < info.ready; k++) {
      const seed = `${an.uid}|${an.kind}|${an.rounds}|${SALT}`;
      let tier = pickTier(seed);
      if (d.ward && (d.ward.kinds            ).includes(tier.kind) && hashRandom(seed + "|ward") < d.ward.p) {
        warded = tier.kind; tier = { kind: "none", mult: 0.92 };
      }
      const amt = tier.kind === "wither" ? 0 : yieldOf(tier.mult, bonus);
      total += amt; an.rounds++;
      this.bumpHarvests();
      if (tier.kind !== "none" && (tier.kind === "weather_good" ? worstMult === 9 : tier.mult < worstMult)) { worst = tier.kind; worstMult = tier.mult; }
      if (tier.kind === "wither") this.log("log.animalWither", { c: an.kind });
      else this.logTier(tier.kind, tier.mult, an.kind);
    }
    if (warded) this.log("log.warded", { c: an.kind, k: warded });
    if (total > 0) this.s.bag[d.item] = (this.s.bag[d.item] ?? 0) + total;
    this.emit({ type: "collected", uid, item: d.item, amount: total, kind: worst, warded });
    this.changed();
    return { amount: total, kind: worst, warded };
  }

  feed(uid        ) {
    const an = this.animal(uid); if (!an || an.dead) return false;
    const d = animalById(an.kind);
    if (d.zone === "ranch" && (this.s.bag.egg ?? 0) > 0 && an.kind !== "chicken") this.s.bag.egg--;
    an.lastFedAt = this.now();
    this.heal(an);
    this.emit({ type: "fed", uid }); this.changed();
    return true;
  }
  // ----- turtle sunbathing -----
  isBasking(an        , now = this.now()) { return an.baskUntil != null && now < an.baskUntil; }
  baskingCount(now = this.now()) { return this.s.animals.filter(a => !a.dead && this.isBasking(a, now)).length; }
  /** ms until this turtle may bask again (0 = now) */
  baskCooldown(an        , now = this.now()) {
    if (an.baskAt == null) return 0;
    return Math.max(0, an.baskAt + BASK_COOLDOWN_MIN * MS_PER_FARM_MIN - now);
  }
  /** boost (ms) a bask started now would give */
  baskBoost(an        , now = this.now()) {
    const info = this.animalInfo(an, now);
    if (an.dead || info.spent || info.ready > 0) return 0;
    const fed = now - an.lastFedAt < FED_HAPPY_MIN * MS_PER_FARM_MIN;
    return Math.min(info.nextAt, (fed ? BASK_BOOST_FED_MIN : BASK_BOOST_MIN) * MS_PER_FARM_MIN);
  }
  canBask(uid        )                                                {
    const an = this.animal(uid); if (!an || an.dead || an.kind !== "turtle") return "no";
    const now = this.now();
    if (this.isBasking(an, now)) return "basking";
    if (this.baskCooldown(an, now) > 0) return "cooldown";
    if (this.baskingCount(now) >= BASK_SPOTS) return "full";
    return "ok";
  }
  bask(uid        ) {
    const why = this.canBask(uid);
    if (why === "full") { this.emit({ type: "toast", k: "toast.baskFull" }); return false; }
    if (why !== "ok") return false;
    const an = this.animal(uid) ; const now = this.now();
    this.heal(an);
    const boost = this.baskBoost(an, now);
    an.pausedMs -= boost; // advances effective age → next egg (or growing up) comes sooner; yield/gate untouched
    an.baskAt = now; an.baskUntil = now + BASK_MIN * MS_PER_FARM_MIN;
    this.log(boost > 0 ? "log.bask" : "log.baskJust", { c: an.kind, m: Math.round(boost / MS_PER_FARM_MIN) });
    this.emit({ type: "bask", uid, boost }); this.changed();
    return true;
  }

  pet(uid        ) {
    const an = this.animal(uid); if (!an || an.dead) return false;
    this.heal(an);
    this.emit({ type: "petted", uid }); this.changed();
    return true;
  }
          heal(an        ) {
    if (an.sickSince == null) return;
    an.pausedMs += this.now() - an.sickSince; an.sickSince = null;
    this.log("log.recovered", { c: an.kind });
    this.emit({ type: "healed", uid: an.uid });
  }
  // 牧场景观：产完且没有可收的动物变成气球，点破掉 1~2 袋神奇肥料。
  //
  // ⚠️ 原来是掉「1..(产出收益-成本)/2 积分」—— 积分不能再由游戏发。
  //    这里改成肥料：数量有界（1~2），不碰任何账本，奖励感还在。
  /** 这只能不能戳气球（0 = 不能，1 = 能）。数值本身不再用。 */
  balloonMax(uid        ) {
    const an = this.animal(uid); if (!an || an.dead) return 0;
    const info = this.animalInfo(an);
    if (!info.spent || info.ready > 0) return 0;
    return 1;
  }
  popBalloon(uid        )                                          {
    if (this.balloonMax(uid) <= 0) return null;
    const an = this.animal(uid) ;
    const amount = 1 + Math.floor(hashRandom(`balloon|${uid}|${an.bornAt}`) * 2);
    this.s.animals = this.s.animals.filter(a => a.uid !== uid);
    this.s.bag.fertilizer = (this.s.bag.fertilizer ?? 0) + amount;
    this.log("log.balloon", { c: an.kind, n: amount });
    this.emit({ type: "balloon", uid, amount });
    this.changed();
    return { amount, kind: an.kind };
  }

  // 牧场病毒 → 消毒：立即治好生病的动物，掉 1~2 袋神奇肥料（确定性摇号）
  disinfect(uid        )         {
    const an = this.animal(uid);
    if (!an || an.dead || an.sickSince == null) return 0;
    const bonus = 1 + Math.floor(hashRandom(`disbonus|${uid}|${an.sickSince}`) * 2);
    an.pausedMs += this.now() - an.sickSince; an.sickSince = null;
    this.s.bag.fertilizer = (this.s.bag.fertilizer ?? 0) + bonus;
    this.log("log.disinfect", { c: an.kind, n: bonus });
    this.emit({ type: "healed", uid, bonus });
    this.changed();
    return bonus;
  }

  // 清理粑粑：恢复正常速度（拉粑粑期间的减速时间并入 pausedMs，总进度不变）
  cleanPoop(uid        ) {
    const an = this.animal(uid);
    if (!an || an.dead || an.poopSince == null) return false;
    an.pausedMs += Math.round((this.now() - an.poopSince) * (1 - POOP_SPEED));
    an.poopSince = null;
    this.log("log.poopClean", { c: an.kind });
    this.emit({ type: "poopClean", uid });
    this.changed();
    return true;
  }

  // ---- 事件调试按钮：事件表面板调用（全部确定性、不改存档）----
  /** 让第一块还在长的地立刻长虫（熟了的不再贴上虫子——那边点收不存在虫概念）；没有合适的地返回 false。 */
  debugPest()          {
    const cs = this.s.plots.find(p => p.crop && !p.crop.dead && !p.crop.old && !p.crop.pest && this.now() < p.crop.readyAt)?.crop;
    if (!cs) return false;
    cs.pest = true; cs.pestAt = this.now(); cs.pestCheckedUntil = this.now(); cs.lastTickAt = this.now();
    this.log("log.pestNow", { c: cs.id });
    this.changed();
    return true;
  }
  /** 让所有长着的地立刻口渴（不影响 pest / 判定路径）。 */
  debugDry()          {
    let n = 0;
    for (const p of this.s.plots) {
      const cs = p.crop;
      if (cs && !cs.dead && !cs.old && this.now() < cs.readyAt) { cs.dryLeft = 0; n++; }
    }
    if (n > 0) { const cs = this.s.plots.find(p => p.crop && (p.crop.dryLeft ?? 1) <= 0)?.crop; if (cs) this.log("log.dry", { c: cs.id }); this.changed(); }
    return n > 0;
  }
  /** 让第一只牧场动物立刻生病；没有可生病的返回 false。 */
  debugSick()          {
    const an = this.s.animals.find(a => !a.dead && animalById(a.kind).zone === "ranch" && a.sickSince == null);
    if (!an) return false;
    an.sickSince = this.now(); an.sickChecked = an.sickChecked ?? 0;
    this.log("log.sick", { c: an.kind });
    this.emit({ type: "sick", uid: an.uid });
    this.changed();
    return true;
  }
  /** 让所有牧场动物立刻拉粑粑。 */
  debugPoop()         {
    let n = 0; let firstKind = "";
    for (const a of this.s.animals) {
      if (!a.dead && animalById(a.kind).zone === "ranch" && a.poopSince == null) {
        a.poopSince = this.now(); a.poopChecked = a.poopChecked ?? 0; if (!firstKind) firstKind = a.kind; n++;
      }
    }
    if (n > 0) { this.log("log.poop", { c: firstKind }); this.changed(); }
    return n;
  }

  goodbye(uid        ) {
    const i = this.s.animals.findIndex(a => a.uid === uid); if (i < 0 || !this.s.animals[i].dead) return false;
    this.s.animals.splice(i, 1); this.changed(); return true;
  }

  // ----- quota gate (闸门) + market -----
  remainingQuota(item        ) {
    return this.s.quotas.filter(q => q.item === item).reduce((a, q) => a + (q.cap - q.earned), 0);
  }
  priceNow(item        ) {
    const day = farmDay(this.now());
    const base = dayPrice(item, day);
    const pr = this.s.pressure[item];
    const units = pr && pr.day === day ? pr.units : 0;
    return Math.max(ITEM_PRICE[item] * PRICE_FLOOR, base * Math.pow(1 - SELL_IMPACT_PER_UNIT, units));
  }
  history(item        , days = 7) {
    const d = farmDay(this.now()); const out           = [];
    for (let k = days - 1; k >= 1; k--) out.push(dayPrice(item, d - k));
    out.push(this.priceNow(item));
    return out;
  }
  marketIndex() {
    const items = Object.keys(ITEM_PRICE);
    return 100 * items.reduce((a, it) => a + this.priceNow(it) / ITEM_PRICE[it], 0) / items.length;
  }
  marketIndexYesterday() {
    const d = farmDay(this.now()) - 1; const items = Object.keys(ITEM_PRICE);
    return 100 * items.reduce((a, it) => a + dayPrice(it, d) / ITEM_PRICE[it], 0) / items.length;
  }
  priceTag(item        )                              {
    const r = this.priceNow(item) / ITEM_PRICE[item];
    return r <= 0.85 ? "cheap" : r < 0.97 ? "normal" : "good";
  }
  quote(item        , n        ) { return Math.round(this.priceNow(item) * n); }
  maxSellable(item        , want        ) {
    const held = Math.min(want, this.s.bag[item] ?? 0);
    const room = this.remainingQuota(item);
    let lo = 0, hi = held;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.quote(item, mid) <= room) lo = mid; else hi = mid - 1; }
    return lo;
  }
  /**
   * 卖货。**`earned` 的单位是兑换券**（不是游戏积分）——
   * `quote()` = 市价 × 数量，四舍五入到整数张。
   *
   * 真正入账（`host.mintVoucher`）在 `game.js` 的 `sold` 事件里做：
   * 这一层是纯逻辑，不碰宿主、不 await。`s.harvest` 累计的是
   * 「这个农场一共卖出多少张券」，给 HUD 和探针看。
   */
          sellInternal(item        , want        ) {
    const n = this.maxSellable(item, want);
    if (n <= 0) return { count: 0, earned: 0 };
    let earned = this.quote(item, n);
    let left = earned;
    for (const q of this.s.quotas) {
      if (q.item !== item || left <= 0) continue;
      const take = Math.min(left, q.cap - q.earned); q.earned += take; left -= take;
    }
    this.s.quotas = this.s.quotas.filter(q => q.earned < q.cap);
    this.s.bag[item] -= n;
    this.s.harvest += earned;
    const day = farmDay(this.now());
    const pr = this.s.pressure[item];
    this.s.pressure[item] = { day, units: (pr && pr.day === day ? pr.units : 0) + n };
    this.log("log.sold", { c: item, n, e: earned });
    this.emit({ type: "sold", item, count: n, earned });
    return { count: n, earned };
  }
  sell(item        , want        ) {
    if (!(item in ITEM_PRICE)) return { count: 0, earned: 0 };
    const r = this.sellInternal(item, want);
    if (r.count === 0) this.emit({ type: "toast", k: (this.s.bag[item] ?? 0) > 0 ? "toast.quotaFull" : "toast.nothing" });
    this.changed();
    return r;
  }
  sellableCount() {
    return Object.keys(ITEM_PRICE).reduce((a, it) => a + ((this.s.bag[it] ?? 0) > 0 ? 1 : 0), 0);
  }

  // ----- time tick: ripeness, production, sickness (offline catch-up safe) -----
  tick() {
    const now = this.now(); let dirty = false;
    const day = this.farmDay(now);
    const weather = this.weather(now);
    if (this.s.weatherSeenDay !== day) {
      if (this.s.weatherSeenDay != null && weather === "rain") { this.log("log.rain"); this.emit({ type: "weather", kind: "rain" }); }
      this.s.weatherSeenDay = day; dirty = true;
    }
    this.s.plots.forEach((p, i) => {
      const cs = p.crop; if (!cs || cs.dead || cs.old) return;
      const growing = now < cs.readyAt;
      if (growing) {
        const last = cs.lastTickAt ?? cs.plantedAt;
        const dt = Math.min(now - last, 6 * 3600 * 1000);
        cs.lastTickAt = now;
        if (dt > 0) {
          if (weather === "rain") {
            cs.dryLeft = DRY_MIN * MS_PER_FARM_MIN; // 下雨天自动浇水，不干渴也不来虫
          } else if (cs.pest) {
            cs.readyAt += dt; // 有虫：生长完全暂停（仍要浇水就照浇）
            const wet = Math.min(cs.dryLeft ?? 0, dt); cs.dryLeft = (cs.dryLeft ?? 0) - wet;
          } else {
            const wet = Math.min(cs.dryLeft ?? 0, dt); cs.dryLeft = (cs.dryLeft ?? 0) - wet;
            const dry = dt - wet;
            if (dry > 0) {
              cs.readyAt += dry; // 干旱缺水：生长完全停止（和虫害一样），浇水后恢复
              if (!cs.dryNotified && (cs.dryLeft ?? 0) <= 0) { cs.dryNotified = true; this.log("log.dry", { c: cs.id }); this.emit({ type: "dryNow", plot: i }); dirty = true; }
            }
            if (!cs.pest && cs.pestPlanAt != null && now >= cs.pestPlanAt) {
              // 播种预定的中期生虫：与摇号完全同一套来虫流程（pest/pestAt/日志/事件）
              const at = cs.pestPlanAt; cs.pestPlanAt = null;
              cs.pest = true; cs.pestAt = at;
              this.log("log.pestNow", { c: cs.id });
              this.emit({ type: "pestNow", plot: i });
              dirty = true;
            }
            while (!cs.pest && (cs.pestCheckedUntil ?? now) + PEST_SLOT_MIN * MS_PER_FARM_MIN <= now) {
              const SLOT = PEST_SLOT_MIN * MS_PER_FARM_MIN;
            const slot = (cs.pestCheckedUntil ?? now) + SLOT;
              cs.pestCheckedUntil = slot;
              if (hashRandom(`pest|${i}|${cs.plantedAt}|${slot}`) < PEST_RATE) {
                cs.pest = true; cs.pestAt = slot;
                this.log("log.pestNow", { c: cs.id });
                this.emit({ type: "pestNow", plot: i });
                dirty = true;
                break;
              }
            }
          }
        }
      }
      if (now >= cs.readyAt && !cs.ripeSeen) { cs.ripeSeen = true; this.emit({ type: "ripe", plot: i }); dirty = true; }
    });
    const dayMs = FARM_DAY_MIN * MS_PER_FARM_MIN;
    for (const an of this.s.animals) {
      if (an.dead) continue;
      const d = animalById(an.kind);
      const daysPassed = Math.floor((now - an.bornAt) / dayMs);
      while (an.sickChecked < daysPassed) {
        an.sickChecked++;
        if (an.sickSince == null && hashRandom(`${an.uid}|sick|${an.sickChecked}`) < 0.02 * d.fragility) {
          an.sickSince = an.bornAt + an.sickChecked * dayMs;
          this.log("log.sick", { c: an.kind }); this.emit({ type: "sick", uid: an.uid }); dirty = true;
        }
      }
      // 粑粑判定：牧场动物每天 roll 一次（极低概率），拉了生产/成长变慢直到被清理
      if (an.poopChecked == null) an.poopChecked = daysPassed; // 老存档从当前天算，不补 roll
      while (an.poopChecked < daysPassed) {
        an.poopChecked++;
        if (d.zone === "ranch" && an.poopSince == null && hashRandom(`${an.uid}|poop|${an.poopChecked}`) < POOP_RATE * d.fragility) {
          an.poopSince = an.bornAt + an.poopChecked * dayMs;
          this.log("log.poop", { c: an.kind }); this.emit({ type: "poop", uid: an.uid }); dirty = true;
        }
      }
      if (an.sickSince != null && an.lastFedAt < an.sickSince && now - an.sickSince > HUNGRY_FARM_MIN * MS_PER_FARM_MIN) {
        if (hashRandom(`${an.uid}|death|${an.sickSince}`) < 0.3) {
          an.dead = true; this.log("log.died", { c: an.kind }); this.emit({ type: "died", uid: an.uid }); dirty = true;
        } else { an.lastFedAt = an.sickSince; } // survived this check; stays sick until fed/petted
      }
    }
    if (dirty) this.changed();
  }

  unreadLog() {
    const day = 24 * 3600 * 1000;
    return this.s.log.filter(l => l.t > this.s.logSeenAt && this.now() - l.t < day).length;
  }
}
