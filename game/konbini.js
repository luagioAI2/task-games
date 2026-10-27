// コンビニ (convenience store) — a shop-unlocked (50 coins) facility in the lobby that the landlord runs.
// Absent (undefined) until bought: nothing about it exists in the world, the UI or the save before that.
// Residents shop there: customers/sec ∝ occupied rooms (up to the store's throughput) × price demand × level;
// each sale uses one stock item. Item value follows the building's rent income so it matters at every stage.
// Profit goes to cash only — never to the ranked cumulative rent (`total`).

export const KONBINI_MAX_LV = 5;
/** price policy: 0 = 安い (cheap), 1 = ふつう, 2 = 高い (premium) */
export const KB_MARKUP = [0.8, 1.0, 1.4]         ;
export const KB_DEMAND = [1.4, 1.0, 0.65]         ;
/** resident satisfaction decay multiplier from the price policy (cheap store keeps people happier) */
export const KB_SAT = [0.9, 1.0, 1.1]         ;
/** wholesale cost per item = unit × this */
export const KB_COST = 0.5;
/** auto-order pays a delivery surcharge */
export const KB_AUTO_FEE = 1.15;
/** customers per occupied room per second, and the counter's throughput at Lv1 (customers/sec) */
const VISIT = 0.03;
const THROUGHPUT = 0.25;

                               
             
                
                   
                
                                                               
                
               
                                                           
               
                                                                                       
               
                                                   
                 
                                                                                
                    
 

export function newKonbini()               {
  return { lv: 1, stock: 60, price: 1, auto: false, sales: 0, sold: 0, rate: 0, best: 0, shifts: 0 };
}

export const kbCap = (k              ) => 60 + (k.lv - 1) * 60;
const lvMult = (k              ) => 1 + 0.35 * (k.lv - 1);

/** ¥ value of one item at the normal price: half a second of the building's rent (never below ¥20). */
export function kbUnit(baseRate        , _occupied = 0)         {
  return Math.max(20, baseRate * 0.5);
}
export const kbSellPrice = (k              , unit        ) => unit * KB_MARKUP[k.price];
/** customers per second right now */
export function kbCustomers(k              , occupied        )         {
  return Math.min(occupied * VISIT, THROUGHPUT) * KB_DEMAND[k.price] * lvMult(k);
}
export function kbRestockCost(k              , unit        , auto = false)         {
  return Math.max(0, kbCap(k) - Math.floor(k.stock)) * unit * KB_COST * (auto ? KB_AUTO_FEE : 1);
}
export function kbUpgradeCost(k              , baseRate        )         {
  if (k.lv >= KONBINI_MAX_LV) return 0;
  return Math.max(20000 * k.lv * k.lv, baseRate * 120 * k.lv);
}

;                                                                            

/** One tick: sell to residents, maybe auto-order. Returns cash earned this tick. */
export function konbiniTick(k              , dt        , baseRate        , occupied        , money        , out           )                                    {
  const unit = kbUnit(baseRate, occupied);
  let earned = 0, spent = 0;
  if (k.onShift) return { earned: 0, spent: 0 };
  if (k.stock > 0 && occupied > 0) {
    const n = Math.min(k.stock, kbCustomers(k, occupied) * dt);
    k.stock -= n;
    earned = n * kbSellPrice(k, unit);
    k.sales += earned;
    k.sold += n;
    if (k.stock <= 1e-6) { k.stock = 0; if (!k.auto) out.push({ type: "kbEmpty" }); }
  }
  if (k.auto && k.stock < kbCap(k) * 0.15) {
    const cost = kbRestockCost(k, unit, true);
    if (cost > 0 && money + earned >= cost) { k.stock = kbCap(k); spent = cost; out.push({ type: "kbAuto", cost }); }
  }
  const inst = dt > 0 ? (earned - n0(spent)) / dt : 0;
  k.rate += (inst - k.rate) * Math.min(1, dt / 8);
  return { earned, spent };
}
// auto-order cost is an investment in stock, not a running loss: the profit rate ignores it
const n0 = (_        ) => 0;

export function serializeKonbini(k                          ) {
  if (!k) return undefined;
  return { lv: k.lv, st: Math.round(k.stock * 10) / 10, p: k.price, a: k.auto ? 1 : 0, sa: Math.round(k.sales), so: Math.round(k.sold), bs: Math.round(k.best), sh: k.shifts };
}
export function deserializeKonbini(d     )                           {
  if (!d || typeof d !== "object") return undefined;
  const k = newKonbini();
  k.lv = Math.max(1, Math.min(KONBINI_MAX_LV, Math.floor(Number(d.lv) || 1)));
  k.stock = Math.max(0, Math.min(kbCap(k), Number(d.st) || 0));
  k.price = d.p === 0 || d.p === 2 ? d.p : 1;
  k.auto = !!d.a;
  k.sales = Math.max(0, Number(d.sa) || 0);
  k.sold = Math.max(0, Number(d.so) || 0);
  k.best = Math.max(0, Number(d.bs) || 0);
  k.shifts = Math.max(0, Math.floor(Number(d.sh) || 0));
  return k;
}
