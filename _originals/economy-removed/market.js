// Flea-market simulation: prize market prices, popularity, fictional buyers, listings, likes, sales.
// Pure logic + a save-able state; UI lives in game.ts. Time is wall-clock ms so waiting works across sessions.
import { PRIZE_META } from "./config.js";

export const MARKET = {
  feeRate: 0.10,          // 10% sale fee
  demoTarget: 14,         // open demo listings kept on the market board
  demoSoldLingerMs: 150000, // SOLD demo cards stay visible this long before being replaced
  buyerIntervalMs: 6000,  // a fictional buyer browses every ~6s (randomised)
  driftIntervalMs: 60 * 60 * 1000, // price drift every hour
  scarcityBoost: 1.6,     // multiplier while a prize's machine is empty
  newPopularityDays: 2,   // freshly released prizes stay hot this long
}         ;

                                                                                                                                         
                                                                                                                                                                                                                                                                                                
                                                                                                                                                          
                                                                                                                                                                                         

// base yen values per prize (rarity-scaled); tweak here
const BASE_PRICE                         = { bear: 600, pillow_pig: 720, pillow_rabbit: 720, pillow_dog: 720, figure: 1150, noctis: 1250, sweet_chips: 180, sweet_choco: 220, sweet_gummy: 150, sweet_cookie: 240, snackbox: 900, mascot_bear: 380, mascot_rabbit: 380, mascot_cat: 380, mascot_dog: 380, mascot_chick: 380, mascot_panda: 380 };
const BUYER_NAMES = ["mofu_lover", "figure_hunter", "yuki_0322", "prize_collector", "kuma_kuma", "star_mage_fan", "arcade_taro", "pastel_days", "ren.ren", "nuinui"];

export function newMarketState(now        )              {
  const prices                              = {};
  for (const id of Object.keys(PRIZE_META)) prices[id] = { base: BASE_PRICE[id] ?? 1000, price: BASE_PRICE[id] ?? 1000, prevPrice: BASE_PRICE[id] ?? 1000, popularity: 3 + Math.min(2, PRIZE_META[id].rarity - 1), releasedAt: now, scarce: false };
  return { prices, listings: [], demo: [], proceeds: 0, lastDriftAt: now, nextBuyerAt: now + MARKET.buyerIntervalMs, seq: 1 };
}
export function ensurePrices(ms             , now        ) {
  for (const id of Object.keys(PRIZE_META)) if (!ms.prices[id]) ms.prices[id] = { base: BASE_PRICE[id] ?? 1000, price: BASE_PRICE[id] ?? 1000, prevPrice: BASE_PRICE[id] ?? 1000, popularity: 3, releasedAt: now, scarce: false };
}

// market range shown to the player: ±10% around current price, rounded to 10 yen
export function priceRange(pm             )                   { return [round10(pm.price * 0.9), round10(pm.price * 1.1)]; }
export function suggestedPrice(pm             )         { return round10(pm.price * 1.0); }
export const round10 = (v        ) => Math.max(10, Math.round(v / 10) * 10);
export function trend(pm             )                         { const r = pm.price / pm.prevPrice; return r > 1.03 ? "up" : r < 0.97 ? "down" : "flat"; }

// effective popularity 1..5 incl. novelty & scarcity
export function popularity(pm             , now        )         {
  let p = pm.popularity;
  if (now - pm.releasedAt < MARKET.newPopularityDays * 86400000) p += 1;
  if (pm.scarce) p += 1;
  return Math.max(1, Math.min(5, Math.round(p)));
}

// Sale probability per buyer visit as a function of price ratio (listing / market) and popularity.
// This is what makes cheap = "likely to be picked when a buyer shows up", not "instantly sold".
export function saleChance(ratio        , pop        , likes        , recentlyCut         )         {
  let c        ;
  if (ratio <= 0.6) c = 0.85; else if (ratio <= 0.8) c = 0.6; else if (ratio <= 0.95) c = 0.35; else if (ratio <= 1.05) c = 0.2; else if (ratio <= 1.2) c = 0.08; else if (ratio <= 1.5) c = 0.025; else c = 0.006;
  c *= 0.6 + pop * 0.16;              // popular prizes sell even a bit above market
  c *= 1 + Math.min(0.5, likes * 0.04); // watchers convert
  if (recentlyCut) c *= 1.8;          // "値下げされました" nudges watchers
  return Math.min(0.95, c);
}
export function likeChance(ratio        , pop        )         {
  const base = ratio <= 0.8 ? 0.25 : ratio <= 1.1 ? 0.45 : ratio <= 1.4 ? 0.3 : 0.1;
  return base * (0.5 + pop * 0.12);
}

;                                                                        

// Advance simulation to `now`. Returns events (sales/likes) that happened. Deterministic given rng.
export function tickMarket(ms             , now        , scarceIds             , rng               = Math.random)                {
  ensurePrices(ms, now);
  const events                = [];
  for (const id of Object.keys(ms.prices)) ms.prices[id].scarce = scarceIds.has(id);
  // hourly drift (catch up multiple steps if the player was away)
  let steps = 0;
  while (now - ms.lastDriftAt >= MARKET.driftIntervalMs && steps < 48) {
    ms.lastDriftAt += MARKET.driftIntervalMs; steps++;
    for (const pm of Object.values(ms.prices)) {
      pm.prevPrice = pm.price;
      const target = pm.base * (0.85 + pm.popularity * 0.06) * (pm.scarce ? MARKET.scarcityBoost : 1);
      const noise = (rng() - 0.5) * 0.16;
      pm.price = round10(pm.price + (target - pm.price) * 0.25 + pm.price * noise);
      pm.popularity = Math.max(1, Math.min(5, pm.popularity + (rng() - 0.55) * 0.4));
    }
  }
  // buyers browse at intervals; catch up at most 40 visits when returning after a long time
  let visits = 0;
  while (now >= ms.nextBuyerAt && visits < 40) {
    visits++;
    ms.nextBuyerAt += MARKET.buyerIntervalMs * (0.6 + rng() * 0.9);
    const open = ms.listings.filter(l => !l.sold);
    if (!open.length) continue;
    // one buyer: budget & taste
    const budgetFactor = 0.7 + rng() * 0.7;       // how much of market value they will pay
    const wantsRare = rng() < 0.5;
    const l = open[Math.floor(rng() * open.length)];
    const pm = ms.prices[l.prizeId]; const pop = popularity(pm, now);
    const ratio = l.price / pm.price;
    l.views++;
    const recentlyCut = now - l.lastCutAt < 120000 && l.lastCutAt > l.listedAt;
    const fits = ratio <= budgetFactor * 1.15 || (wantsRare && pop >= 4 && ratio <= budgetFactor * 1.4);
    if (fits && rng() < saleChance(ratio, pop, l.likes, recentlyCut)) {
      const fee = Math.round(l.price * MARKET.feeRate);
      l.sold = { at: now, price: l.price, fee, net: l.price - fee, buyer: BUYER_NAMES[Math.floor(rng() * BUYER_NAMES.length)] };
      events.push({ kind: "sold", listing: l });
    } else if (rng() < likeChance(ratio, pop)) { l.likes++; events.push({ kind: "like", listing: l }); }
  }
  if (ms.nextBuyerAt < now) ms.nextBuyerAt = now + MARKET.buyerIntervalMs * (0.6 + rng() * 0.9);
  return events;
}

export function listPrize(ms             , prizeId        , price        , now        )          {
  const l          = { id: `L${ms.seq++}`, prizeId, price: round10(price), likes: 0, listedAt: now, lastCutAt: now, views: 0 };
  ms.listings.unshift(l); return l;
}
export function repriceListing(l         , price        , now        ) { const p = round10(price); if (p < l.price) l.lastCutAt = now; l.price = p; }
export function collectSale(ms             , l         ) { if (l.sold && !l.collected) { l.collected = true; ms.proceeds += l.sold.net; } }
// proceeds pay for plays directly (no coin exchange): returns false when short
export function spendProceeds(ms             , yen        )          { if (ms.proceeds < yen) return false; ms.proceeds -= yen; return true; }

// ---- demo market: fictional sellers' listings so the board looks alive and teaches the going rate
const SELLERS = ["moco", "くまこ", "yuu", "Mii", "ぴの", "nana", "Rin", "うさまる", "sora", "ちょこ", "Kai", "momo", "tama", "ゆきんこ", "Luna", "ぽん"];
const PRICE_STEPS = [0.78, 0.86, 0.92, 0.97, 1.0, 1.04, 1.1, 1.18, 1.28];
function makeDemo(ms             , now        , rng              , ageMs = 0)              {
  const ids = Object.keys(ms.prices); const prizeId = ids[Math.floor(rng() * ids.length)];
  const k = PRICE_STEPS[Math.floor(rng() * PRICE_STEPS.length)];
  const price = round10(ms.prices[prizeId].price * k * (0.98 + rng() * 0.04));
  return { id: `D${ms.seq++}`, prizeId, price, likes: Math.floor(rng() * (k < 1 ? 16 : 7)), seller: SELLERS[Math.floor(rng() * SELLERS.length)], av: Math.floor(rng() * 8), listedAt: now - ageMs };
}
export function tickDemo(ms             , now        , rng               = Math.random) {
  if (!ms.demo) ms.demo = [];
  // seed a board with staggered ages on first visit
  if (!ms.demo.length) for (let i = 0; i < MARKET.demoTarget; i++) ms.demo.push(makeDemo(ms, now, rng, rng() * 40 * 60000));
  ms.demo = ms.demo.filter(d => !d.soldAt || now - d.soldAt < MARKET.demoSoldLingerMs);
  const open = ms.demo.filter(d => !d.soldAt);
  while (ms.demo.filter(d => !d.soldAt).length < MARKET.demoTarget) ms.demo.unshift(makeDemo(ms, now, rng));
  // one demo buyer pass: cheap listings sell first, likes drift up
  for (const d of open) {
    const ratio = d.price / ms.prices[d.prizeId].price;
    const ageMin = (now - d.listedAt) / 60000;
    const p = (ratio <= 0.85 ? 0.05 : ratio <= 1.0 ? 0.02 : ratio <= 1.12 ? 0.007 : 0.002) * Math.min(2, 0.5 + ageMin / 4);
    if (rng() < p) d.soldAt = now; else if (rng() < 0.03) d.likes++;
  }
  ms.demo.sort((a, b) => b.listedAt - a.listedAt);
}
export function releasePrize(ms             , prizeId        , now        ) { ensurePrices(ms, now); ms.prices[prizeId].releasedAt = now; }
