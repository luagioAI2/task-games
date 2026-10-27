// Economy tables — numbers are taken verbatim from GAME_DESIGN.md §2.

export const MAX_LV = 10;
/** ¥/sec per room by fixture level (index = lv). */
export const RENT = [0, 2, 7, 26, 95, 360, 1200, 4000, 13000, 42000, 140000];
/** Cost to renovate INTO this level (index = target lv). */
export const UPGRADE_COST = [0, 0, 180, 1600, 14000, 120000, 900000, 5000000, 28000000, 150000000, 800000000];
/** Reputation gained by renovating INTO this level. */
export const UPGRADE_REP = [0, 0, 8, 25, 90, 320, 120, 150, 180, 210, 250];
/** i18n key of the fixture each level adds (index = lv). */
export const FIXTURE_KEY = ["", "fx.basic", "fx.aircon", "fx.bath", "fx.kitchen", "fx.dryer", "fx.tv", "fx.shelf", "fx.luxury", "fx.chandelier", "fx.rug"];

                        
                                                                                                                   
                                                                                              
                                                                                                                                                  
                                                                                                         
                                                                                                                                 
                                                                                       
/** Sorted low → high by tier: the applicant roll weights later entries higher. */
export const TENANT_TYPES               = [
  { kind: "student", lv: 1, rep: 0, mult: 1.0 },
  { kind: "freeter", lv: 1, rep: 0, mult: 1.05 },
  { kind: "gamer", lv: 1, rep: 0, mult: 1.1 },
  { kind: "cosplayer", lv: 1, rep: 5, mult: 1.1 },
  { kind: "manga", lv: 1, rep: 10, mult: 1.2 },
  { kind: "novelist", lv: 1, rep: 10, mult: 1.2 },
  { kind: "poet", lv: 1, rep: 12, mult: 1.2 },
  { kind: "delivery", lv: 1, rep: 15, mult: 1.15 },
  { kind: "retiree", lv: 1, rep: 20, mult: 1.15 },
  { kind: "monk", lv: 1, rep: 30, mult: 1.25 },
  { kind: "office", lv: 2, rep: 60, mult: 1.3 },
  { kind: "hairdresser", lv: 2, rep: 50, mult: 1.3 },
  { kind: "driver", lv: 2, rep: 70, mult: 1.3 },
  { kind: "teacher", lv: 2, rep: 80, mult: 1.35 },
  { kind: "artist", lv: 2, rep: 100, mult: 1.4 },
  { kind: "miko", lv: 2, rep: 90, mult: 1.4 },
  { kind: "nurse", lv: 2, rep: 110, mult: 1.45 },
  { kind: "reporter", lv: 2, rep: 130, mult: 1.5 },
  { kind: "family", lv: 3, rep: 150, mult: 1.6 },
  { kind: "dancer", lv: 3, rep: 160, mult: 1.65 },
  { kind: "constable", lv: 3, rep: 180, mult: 1.65 },
  { kind: "baker", lv: 3, rep: 190, mult: 1.7 },
  { kind: "couple", lv: 3, rep: 200, mult: 1.7 },
  { kind: "photographer", lv: 3, rep: 210, mult: 1.75 },
  { kind: "singer", lv: 3, rep: 230, mult: 1.85 },
  { kind: "model", lv: 3, rep: 250, mult: 1.9 },
  { kind: "sommelier", lv: 3, rep: 280, mult: 1.95 },
  { kind: "chef", lv: 3, rep: 250, mult: 1.8 },
  { kind: "carpenter", lv: 3, rep: 310, mult: 2.05 },
  { kind: "comedian", lv: 3, rep: 300, mult: 2.0 },
  { kind: "lawyer", lv: 4, rep: 420, mult: 2.15 },
  { kind: "athlete", lv: 4, rep: 400, mult: 2.1 },
  { kind: "pilot", lv: 4, rep: 430, mult: 2.2 },
  { kind: "doctor", lv: 4, rep: 450, mult: 2.2 },
  { kind: "vet", lv: 4, rep: 500, mult: 2.3 },
  { kind: "violinist", lv: 4, rep: 480, mult: 2.3 },
  { kind: "captain", lv: 4, rep: 520, mult: 2.4 },
  { kind: "architect", lv: 4, rep: 550, mult: 2.5 },
  { kind: "jeweler", lv: 4, rep: 580, mult: 2.6 },
  { kind: "celebrity", lv: 5, rep: 750, mult: 3.0 },
  { kind: "racer", lv: 5, rep: 700, mult: 2.8 },
  { kind: "seiyuu", lv: 5, rep: 720, mult: 2.9 },
  { kind: "director", lv: 5, rep: 780, mult: 3.1 },
  { kind: "dev", lv: 6, rep: 800, mult: 3.2 },
  { kind: "astronaut", lv: 6, rep: 800, mult: 3.3 },
  { kind: "baseballer", lv: 6, rep: 820, mult: 3.4 },
  { kind: "hotelier", lv: 7, rep: 850, mult: 3.6 },
  { kind: "ceo", lv: 8, rep: 900, mult: 4.0 },
  { kind: "tycoon", lv: 8, rep: 950, mult: 4.5 },
  { kind: "judge", lv: 8, rep: 990, mult: 4.8 },
];
export function tenantType(kind            )             {
  return TENANT_TYPES.find((x) => x.kind === kind) ?? TENANT_TYPES[0];
}
export const PREMIUM_MULT = 1.5;
export const PREMIUM_CHANCE = 0.15;

export const REP_MAX = 1000;
export const REP_MOVEIN = 15;
export const REP_MOVEOUT = -60;
export const repBonus = (rep        ) => rep / 2000; // ×(1 + rep/2000), max +50%

export const ROOMS_PER_FLOOR = 4;
export const MAX_FLOORS = 500;
/** Floor n (1-based) build cost + reputation needed. Floor 1 exists at start; 6+ grow geometrically. */
const FLOOR_COST_EARLY = [0, 0, 8000, 90000, 900000, 6000000];
const FLOOR_REP_EARLY = [0, 0, 0, 150, 400, 700];
export function floorCost(n        )         {
  return n <= 5 ? FLOOR_COST_EARLY[n] : Math.round(6000000 * Math.pow(1.13, n - 5));
}
export function floorRep(n        )         {
  return n <= 5 ? FLOOR_REP_EARLY[n] : Math.min(1000, 700 + (n - 5) * 6);
}
/** Full-house celebrations fire at these floor counts. */
export const isMilestone = (floors        ) => floors === 5 || (floors >= 10 && floors % 10 === 0);

/** Better-equipped rooms keep tenants happy longer: each level above the tenant's minimum slows decay by 30%. */
export function satDecayMult(roomLv        , tenantLv        )         {
  return Math.max(0, 1 - 0.3 * (roomLv - tenantLv));
}

export const SAT_MAX = 100;
export const SAT_DECAY = 1 / 8; // per second, online only
export const TALK_GAIN = 30;
export const TALK_COOLDOWN = 60; // seconds

export const OFFLINE_CAP_SEC = 2 * 60 * 60;
export const OFFLINE_MIN_SEC = 10;

export const START_MONEY = 150;

export const APPLICANT_MAX = 3;
/** Bigger buildings draw a bigger queue, and arrivals speed up with the number of vacancies. */
export const applicantMax = (floors        ) => Math.min(8, APPLICANT_MAX + Math.floor((floors - 1) / 8));
export const applicantInterval = (vacancies        ) => Math.max(2.5, APPLICANT_INTERVAL / (1 + Math.min(vacancies, 40) / 6));
export const APPLICANT_INTERVAL = 16; // seconds between arrivals
export const APPLICANT_FIRST = 40; // first arrival if the player hasn't renovated yet
export const APPLICANT_LIFETIME = 150; // seconds before an unplaced applicant gives up

export const DELEGATE_COST = 250000;
export const DELEGATE_RATIO = 3;

export const BOOST_SEC = 30 * 60;
export const BOOST_MULT = 2;
/** Underground tiers unlocked once the tower is complete at MAX_FLOORS (2026-11-25 user request).
 *  Each adds a themed floor below street level and a permanent % bonus to rent income. */
/** sat spare decay slowdown (1 = no change) and facility rent ¥/sec per tier (2026-11-25 user: 地下施設の収益や評判効果) */
export const BASEMENT = [
  { tex: "basement_parking", cost: 1e8, pct: 0.03, satMult: 1, facility: 0 },      // 地下駐車場
  { tex: "basement_storage", cost: 1e9, pct: 0.03, satMult: 1, facility: 0 },      // 地下倉庫
  { tex: "basement_gym", cost: 1e11, pct: 0.05, satMult: 0.75, facility: 0 },      // 地下ジム
  { tex: "basement_sento", cost: 1e13, pct: 0.05, satMult: 0.95, facility: 5e4 },  // 地下銭湯
  { tex: "basement_shopping", cost: 5e14, pct: 0.08, satMult: 1, facility: 5e5 },  // 地下商店街
]         ;
export const BASEMENT_MAX = BASEMENT.length;
export const basementPct = (n        ) => BASEMENT.slice(0, Math.max(0, Math.min(n, BASEMENT_MAX))).reduce((a, t) => a + t.pct, 0);
/** Flat facility income ¥/sec across dug tiers (bath + shops). */
export const basementFacilityYen = (n        ) => BASEMENT.slice(0, Math.max(0, Math.min(n, BASEMENT_MAX))).reduce((a, t) => a + t.facility, 0);
/** 評判効果: tenant satisfaction decay multiplier across dug tiers (gym/bath keep residents happier). */
export const basementSatMult = (n        ) => BASEMENT.slice(0, Math.max(0, Math.min(n, BASEMENT_MAX))).reduce((a, t) => a * t.satMult, 1);

export const SHOP = {
  lounge: { itemId: "sky_lounge", price: 20 },
  boost: { itemId: "rush_boost", price: 12 },
  quake: { itemId: "quake_dlc", price: 15 },
  /** コンビニ (2026 user request: sold for 50 coins; never spawns before it is bought) */
  konbini: { itemId: "konbini_store", price: 50 },
  /** 2棟目 (user request: buyable once the first tower stands at 500 floors, 50 coins) */
  twin: { itemId: "second_tower", price: 50 },
  /** コンビニ＋2棟目 set (user request: one bundle, 50 → 15 coins replaces the two cards; the old itemIds above stay
   *  deliverable for pending() purchases). Buyable any time: the store opens at once, the 2nd tower rises at 500 floors. */
  set: { itemId: "konbini_twin_set", price: 15 },
  /** お金無限 (user request: 50 coins). Cash only — the ranked cumulative rent keeps counting real rent alone. */
  infMoney: { itemId: "infinite_money", price: 50 },
}         ;
