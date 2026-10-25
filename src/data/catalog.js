// Single data table for crops / animals / pond creatures / items.
// Numbers follow farm-game-spec §4.1 / §5.1 / §5.2 + GAME_DESIGN §2 (pond). All prices integers (B1).
//
// ★ v58 两个币种（接进宿主后）：
//   `seed` / `cost` = **积分**（App 的账本，游戏只能花，见 src/wallet.js）
//   `price`         = **兑换券**（只有卖出才发，见 src/economy.js）
//   两者不是同一个单位，但 1 券 ≈ 1 积分（兑换商城按 1:1 抵扣），所以下面这个
//   比率就是「花掉的积分能换回多少券」：
//     PROFIT_RATIO = 满产卖出(券) / 成本(积分) ≈ 0.5
//   原版是 0.6（1.6×，玩具口径）。1:1 搬进宿主就是印钞机，也过不了宿主的
//   `checkPluginEconomy`（expectedPayout ≤ 0.8 × playCost）。
//   ⚠️ `PROFIT_RATIO` 只是**口径说明**，不是旋钮 —— 价格全在下面的字面量里，改它不会改任何东西。
//      要调数值就改 `seed` / `cost` / `price` / `times`，然后跑 `node scripts/check-economy-table.mjs`
//      （逐项校验 0.40~0.67，并校验申报值覆盖最坏一项），最后同步 plugin.js 的 `economy` 申报。
//      按基础值申报等于漏报，漏报的那一刻闸门就失效了。
export const PROFIT_RATIO = 0.53;
export const PER_YIELD = 4;               // 单次产量恒为 4（经济文档 §5.6 硬约束）
export const MS_PER_FARM_MIN = 6000;      // 10× 加速：1 农场分钟 = 6 现实秒
export const FARM_DAY_MIN = 1440;
export const HUNGRY_FARM_MIN = 12 * 60;
export const PRICE_FLOOR = 0.55;
export const PRICE_DAILY_SWING = 0.22;
export const SELL_IMPACT_PER_UNIT = 0.006;
export const RANCH_CAP = 10;
export const POND_CAP = 8;
// 乌龟晒太阳（农场分钟）：只提前产出时间，不改产量/次数/闸门
export const BASK_MIN = 20;
export const BASK_BOOST_MIN = 30;
export const BASK_BOOST_FED_MIN = 45;
export const BASK_COOLDOWN_MIN = 360;
export const BASK_SPOTS = 3;
export const FED_HAPPY_MIN = 6 * 60;
export const PLOT_UNLOCK = [0, 0, 0, 0, 40, 70, 120, 200, 320, 500, 700, 1000]; // v55：最高一块 1200→1000，与「所有购买 ≤1000」一致

                       
                                                                              
                                                                               
  

// tex = index in crops sheets (m00..m14 mature, g00..g14 growing)
export const CROPS            = [
  { id: "radish", level: 1, growMin: 2, regrowMin: 0, seed: 8, times: 1, price: 1, item: "radish", tex: 0 },
  { id: "carrot", level: 1, growMin: 3, regrowMin: 0, seed: 10, times: 1, price: 1, item: "carrot", tex: 1 },
  { id: "rose", level: 1, growMin: 4, regrowMin: 3, seed: 25, times: 2, price: 2, item: "rose", tex: 2 },
  { id: "strawberry", level: 2, growMin: 5, regrowMin: 4, seed: 35, times: 2, price: 2, item: "strawberry", tex: 3 },
  { id: "corn", level: 2, growMin: 6, regrowMin: 4, seed: 40, times: 2, price: 3, item: "corn", tex: 4 },
  { id: "cotton", level: 2, growMin: 8, regrowMin: 6, seed: 60, times: 2, price: 4, item: "cotton", tex: 5 },
  { id: "tomato", level: 3, growMin: 10, regrowMin: 7, seed: 105, times: 3, price: 5, item: "tomato", tex: 6 },
  { id: "pumpkin", level: 3, growMin: 12, regrowMin: 8, seed: 135, times: 3, price: 6, item: "pumpkin", tex: 7 },
  { id: "watermelon", level: 4, growMin: 14, regrowMin: 10, seed: 165, times: 3, price: 7, item: "watermelon", tex: 8 },
  { id: "apple", level: 4, growMin: 16, regrowMin: 11, seed: 240, times: 4, price: 8, item: "apple", perennial: true, tex: 9 },
  { id: "pineapple", level: 5, growMin: 18, regrowMin: 13, seed: 280, times: 4, price: 9, item: "pineapple", tex: 10 },
  { id: "plum", level: 5, growMin: 20, regrowMin: 14, seed: 375, times: 5, price: 10, item: "plum", perennial: true, tex: 11 },
  { id: "lemon", level: 5, growMin: 22, regrowMin: 15, seed: 425, times: 5, price: 11, item: "lemonade", perennial: true, tex: 12 },
  { id: "sunflower", level: 5, growMin: 24, regrowMin: 17, seed: 615, times: 6, price: 14, item: "sunflower", tex: 13 },
  { id: "magicbean", level: 6, growMin: 26, regrowMin: 18, seed: 690, times: 6, price: 15, item: "magicbean", tex: 14 },
];

                                                         
                         
                                                                                     
                                                                                     
                                                                           
                                                              
                                                             
                                                   
                      
  

// v55 数值重整（tools/econ-v55.py 生成并自检）：所有购买 ≤1000；按解锁顺序 成本↑ 总收益↑ 时长↑ 每分钟净利↑。
// v58 接进宿主后改币种：`cost` / `seed` 是**积分**（App 账本，只能花），`price` 是**兑换券**（卖出才发）。
//      满产卖出 ≈ 0.5×成本 —— 原版是 1.6×，那是「玩具」口径；1:1 搬进宿主就是印钞机（1 券 ≈ 1 积分），
//      也过不了 `checkPluginEconomy`（expectedPayout ≤ 0.8×playCost）。换算见 tools 里的推法。
// v59 补齐两只 L6 永久神兽（2026-10-24）：v58 只把 `price` 除了 3，`times` 还是玩具时代的 365
//      ⇒ 满产 365×4×6 = 8760 张 / 365×4×7 = 10220 张券，1000 积分能换回 8.8~10.2 倍，
//      是全表唯一的漏报项（其余 31 项都在 0.40~0.67）。改成 22 / 19 轮（528 / 532 张 ≈ 0.53×成本）。
//      判据：`node scripts/check-economy-table.mjs` —— 逐项算比率，任何一项出带就红。
export const ANIMALS              = [
  { id: "chicken", zone: "ranch", level: 1, matureMin: 15, cost: 30, intervalMin: 60, times: 5, price: 1, item: "egg", fragility: 0.3, height: 80 },
  { id: "duck", zone: "ranch", level: 2, matureMin: 20, cost: 50, intervalMin: 80, times: 5, price: 1, item: "feather", fragility: 0.5, height: 82 },
  { id: "sheep", zone: "ranch", level: 2, matureMin: 25, cost: 75, intervalMin: 100, times: 6, price: 2, item: "wool", fragility: 0.7, height: 92 },
  { id: "pig", zone: "ranch", level: 3, matureMin: 30, cost: 105, intervalMin: 120, times: 6, price: 2, item: "truffle", fragility: 1.0, height: 88 },
  { id: "dog", zone: "ranch", level: 3, matureMin: 35, cost: 135, intervalMin: 150, times: 6, price: 3, item: "bone", fragility: 0.5, height: 92, ward: { kinds: ["pest", "disease"], p: 0.6 } },
  { id: "cow", zone: "ranch", level: 4, matureMin: 45, cost: 220, intervalMin: 180, times: 8, price: 4, item: "milk", fragility: 1.2, height: 116 },
  { id: "polarbear", zone: "ranch", level: 4, matureMin: 50, cost: 280, intervalMin: 210, times: 8, price: 5, item: "ice", fragility: 0.6, height: 108, ward: { kinds: ["weather_bad", "disease"], p: 0.7 } },
  { id: "giraffe", zone: "ranch", level: 5, matureMin: 60, cost: 360, intervalMin: 240, times: 8, price: 6, item: "leaf", fragility: 0.6, height: 150, noBaby: true, ward: { kinds: ["pest", "disease", "weather_bad"], p: 0.4 } },
  { id: "peacock", zone: "ranch", level: 5, matureMin: 70, cost: 625, intervalMin: 300, times: 10, price: 8, item: "tailfeather", fragility: 0.9, height: 100 },
  { id: "ostrich", zone: "ranch", level: 5, matureMin: 90, cost: 825, intervalMin: 360, times: 10, price: 11, item: "ostrichegg", fragility: 1.1, height: 155 },
  // 神兽猫：永久存活（fragility 0 + permanent），光环全场抵御 75%。v55：1000 🪙。
  // v59：每 480 农场分产 4 个 × 6 券，共 22 轮 = 528 张券（0.53×成本）。产出跑完后**不离场**，
  //       继续当光环 / 摆件 —— 这才是「永久」的含义，不是「永远产券」。别再回到 365 轮（见文件头 v59）。
  { id: "mythcat", zone: "ranch", level: 6, matureMin: 120, cost: 1000, intervalMin: 480, times: 22, price: 6, item: "mythgem", fragility: 0, height: 112, ward: { kinds: ["pest", "disease", "weather_bad"], p: 0.75 }, permanent: true },
  { id: "fish", zone: "pond", level: 1, matureMin: 15, cost: 30, intervalMin: 60, times: 5, price: 1, item: "fishmeat", fragility: 0.4, height: 56 },
  { id: "loach", zone: "pond", level: 2, matureMin: 18, cost: 50, intervalMin: 75, times: 5, price: 1, item: "bait", fragility: 0.2, height: 50 },
  { id: "turtle", zone: "pond", level: 2, matureMin: 25, cost: 90, intervalMin: 100, times: 6, price: 2, item: "turtleegg", fragility: 0.2, height: 76 },
  { id: "koi", zone: "pond", level: 3, matureMin: 30, cost: 120, intervalMin: 120, times: 6, price: 3, item: "pearl", fragility: 0.8, height: 58 },
  { id: "grasscarp", zone: "pond", level: 3, matureMin: 35, cost: 150, intervalMin: 150, times: 6, price: 3, item: "fishball", fragility: 0.5, height: 62 },
  { id: "mandarinfish", zone: "pond", level: 4, matureMin: 50, cost: 320, intervalMin: 200, times: 8, price: 5, item: "fillet", fragility: 0.9, height: 60 },
  { id: "sturgeon", zone: "pond", level: 5, matureMin: 70, cost: 625, intervalMin: 260, times: 10, price: 8, item: "caviar", fragility: 1.0, height: 72 },
  // 玉龙（v51）：河栖龙鱼——7 成时间伏在河湾里睡觉，醒时游几步；每 3~6 现实分钟大弧跃入池塘绕游 1.5~3 圈后跃回河里。
  // 永久活体资产（同神兽猫口径：不 spent、不变气球/残骸、不病死，卡片显示 ∞）。v55：1000 🪙。
  // v59：19 轮 × 4 个 × 7 券 = 532 张券（0.53×成本）—— 和神兽猫同价同回收，差别只在单价 / 轮数。
  { id: "yulong", zone: "pond", level: 6, matureMin: 120, cost: 1000, intervalMin: 480, times: 19, price: 7, item: "dracopearl", fragility: 0, height: 96, permanent: true },
];

// v53 同种上限：牧场目录中田园犬（dog）及排在它后面的动物、以及永久神物（玉龙）同一时间只能养 1 只；其余每种最多 3 只。
const RANCH_ORDER = ANIMALS.filter(a => a.zone === "ranch").map(a => a.id);
export const speciesCap = (id        ) => {
  const a = ANIMALS.find(x => x.id === id);
  if (!a) return 3;
  if (a.permanent) return 1;
  if (a.zone === "ranch" && RANCH_ORDER.indexOf(id) >= RANCH_ORDER.indexOf("dog")) return 1;
  return 3;
};

// Item icon index in the items sheet (i00..i37)
export const ITEM_TEX                         = {
  radish: 0, carrot: 1, rose: 2, strawberry: 3, corn: 4, cotton: 5,
  tomato: 6, pumpkin: 7, watermelon: 8, apple: 9, pineapple: 10, plum: 11,
  lemonade: 12, sunflower: 13, magicbean: 14, egg: 15, feather: 16, wool: 17,
  truffle: 18, milk: 19, bone: 20, ice: 21, leaf: 22, fishmeat: 23,
  turtleegg: 24, pearl: 25, fertilizer: 26, seedbag: 27, coin: 28, harvest: 29,
  tailfeather: 30, ostrichegg: 31, bait: 32, fishball: 33, fillet: 34, caviar: 35, mythgem: 36, dracopearl: 37,
};

export const cropById = (id        ) => CROPS.find(c => c.id === id) ;
export const animalById = (id        ) => ANIMALS.find(a => a.id === id) ;

/** 所有可卖产出物 → 基准（= 硬顶）整数单价 */
export const ITEM_PRICE                         = {};
export const ITEM_SOURCES                         = {};
for (const c of CROPS) { ITEM_PRICE[c.item] = c.price; ITEM_SOURCES[c.item] = c.id; }
for (const a of ANIMALS) { ITEM_PRICE[a.item] = a.price; ITEM_SOURCES[a.item] = a.id; }
export const SELLABLE = Object.keys(ITEM_PRICE);

/**
 * 溪边钓鱼 —— **概率表也是经济数据**，所以放在这里，不写在 game.js 里。
 *
 * 理由：它是「积分 → 券」的另一条路（下竿花积分、钓上来的东西卖券），
 * 必须和目录项一起过 `scripts/check-economy-table.mjs` 的带（0.40~0.67）。
 * 写死在 `rollCatch()` 里的话，闸门只能靠脆的正则去解析 —— 改一次表就静默失效。
 *
 * v59.1 调整：`fish` 从 2 个改 4 个。原来 L1~4 的期望只有 **0.21 券/积分**
 * （85% 只钓到 fishmeat×2 = 2 券 / 8 积分），比目录里最差的一项还差一半，
 * 也就是「等级越低越亏」。改完：L1~4 = **0.425**、L5+ = **0.525**（都进带）。
 */
export const FISHING = {
  /** 下竿一次花多少积分 */
  cost: 8,
  /**
   * 摇号档位：`r`（0~1 的确定性哈希）按 `below` 升序取第一个命中，都不中 ⇒ `fallback`。
   * 带 `minLevel` 的档位在等级不够时**退回 fallback**（低等级钓不到稀有的）。
   */
  rolls: [
    { below: 0.15, catch: "fail" },
    { below: 0.2, catch: "turtle", minLevel: 7 },
    { below: 0.4, catch: "koi", minLevel: 5 },
  ],
  fallback: "fish",
  /** 每档钓上来的东西（item 必须在 ITEM_PRICE 里，否则卖不出价 = 静默白送） */
  catch: {
    fish: { item: "fishmeat", n: 4 },
    koi: { item: "fishmeat", n: 8 },
    turtle: { item: "turtleegg", n: 2 },
  },
};

export const fullYieldCrop = (c         ) => c.times * PER_YIELD;
export const fullYieldAnimal = (a           ) => a.times * PER_YIELD;
export const capCrop = (c         ) => fullYieldCrop(c) * c.price;
export const capAnimal = (a           ) => fullYieldAnimal(a) * a.price;

/** farmLevel: 5, 7, 10, 15, 22 … ×1.45 */
export function farmLevel(totalHarvests        )                                                {
  let level = 1, need = 5, left = totalHarvests;
  while (left >= need && level < 99) { left -= need; level++; need = Math.round(need * 1.45); }
  return { level, into: left, need };
}
// 随机事件层（天气/浇水/虫害）— 全部确定性摇号（AGENTS 规则）
export const DRY_MIN = 30;          // 浇水后湿润期（农场分钟），干了生长完全停止
export const PEST_RATE = 0.09;
export const PEST_SLOT_MIN = 10;       // 生长期每农场小时来虫概率
export const PEST_PLANT_P = 0.22;      // 播种时预定的"中期生虫"概率（生长期 35%~70% 处必来一只，短作物也能见到虫）
export const WEATHER_RAIN_P = 0.18;
export const WEATHER_CLOUD_P = 0.12;
// 粑粑：牧场动物每个农场天各 roll 一次（POOP_RATE×体质系数，极低）；有粑粑期间生产/成长速度降为 POOP_SPEED，点它或卡片一键清理
export const POOP_RATE = 0.05;
export const POOP_SPEED = 0.35;
