// Pure economy / state machine. No DOM, no renderer — everything here is testable and saveable.
import {
  APPLICANT_FIRST, BASEMENT, BASEMENT_MAX, basementFacilityYen, basementPct, basementSatMult, APPLICANT_LIFETIME, applicantInterval, applicantMax, floorCost, floorRep, isMilestone, satDecayMult,
  BOOST_MULT, DELEGATE_COST, DELEGATE_RATIO, MAX_FLOORS, MAX_LV,
  OFFLINE_CAP_SEC, OFFLINE_MIN_SEC, PREMIUM_CHANCE, PREMIUM_MULT, RENT, REP_MAX, REP_MOVEIN,
  REP_MOVEOUT, ROOMS_PER_FLOOR, SAT_DECAY, SAT_MAX, START_MONEY, TALK_COOLDOWN, TALK_GAIN,
  TENANT_TYPES, UPGRADE_COST, UPGRADE_REP, repBonus, tenantType,                 
} from "./data.js";
import {
  FORECAST_SEC, STORM_INCOME, STORM_SEC, deserializeStorm, newStorm, repairCost, serializeStorm, shutterCost, stormGap,
  strikeCount,                 
} from "./storm.js";
import {
  SUSPECT_SEC, REWARD_SEC, REP_REPORT, REP_IGNORED, REP_FLED, WARN_REFORM, crimeGap, deserializeCrime, serializeCrime,
  newCrime, CRIMES,                 
} from "./crime.js";
import { newQuake, nextQuakeGap, serializeQuake, deserializeQuake,                 } from "./quake.js"
import { newRobbery, nextRobberyGap, serializeRobbery, deserializeRobbery, lootFor, ROB_SNEAK_SEC, ROB_LOOT_SEC,               } from "./robbery.js"
export { repairCost, shutterCost } from "./storm.js";
import { fallbackProfile } from "./tenants.js";
import { KB_SAT, konbiniTick, newKonbini, serializeKonbini, deserializeKonbini,                                 } from "./konbini.js";

                           
                   
                   
               
                  
              
                
                 
                                                                                                     
                 
                                                                                                                   
                   
                                                                
                   
 
                                                                                                                                                                                                                      
                                                                                             

                            
            
                
                
              
                
                 
                          
                   
                    
                           
                  
                                                                 
                                                                        
                   
                     
                    
                   
                     
                     
                    
                                                                           
              
                                                                                     
                   
                                                                      
                 
                      
                    
                    
                
                    
                                                                                                     
                         
                                                                                                   
                                                                                                          
                 
                                                                                                 
                   
                                                                                                         
                     
                                                                                                       
                   
                                                
                 
 

/** pinned cash while お金無限 is on: large enough that no price dents it, small enough to stay finite in any math */
export const INF_MONEY = 1e30;
/** ruleVersion-6 hard cap of the ranked cumulative rent (¥9999京) */
export const SCORE_CAP = 9999 * 1e16;
export const moneyInfinite = (s           ) => !!(s.infBuy || s.infCheat);
/** re-pin cash (and, for the cheat only, the ranked total) — spending never reduces unlimited money */
export function pinInfinite(s           ) {
  if (moneyInfinite(s)) s.money = INF_MONEY;
  if (s.infCheat) s.total = Math.max(s.total, SCORE_CAP);
}

;                     
                                                  
                                                               
                                    
                                                   
                     
                                    
                    
                                   
                    
                        
                        
                          
                                    
                                         
                                     
                                    
                                   
                                                     
                                                                  
                                                                    
                         
                                      
                                    
                                                  
                                                     
                                  
                                    
                                                
                          
            

export const SAVE_VERSION = 2;

export function newGame(now        )            {
  const rooms         = [];
  for (let i = 0; i < ROOMS_PER_FLOOR; i++) rooms.push({ lv: 1, occupant: null });
  const first = fallbackProfile("student", 0);
  rooms[0].occupant = {
    kind: "student", premium: false, name: first.name, comment: first.comment,
    sat: SAT_MAX, since: now, talkAt: 0, factor: 1, pending: false,
  };
  return {
    v: SAVE_VERSION, money: START_MONEY, total: 0, rep: 0, rooms, floors: 1,
    applicants: [], appTimer: 0, nextAppId: 1, firstApplicantAt: now + APPLICANT_FIRST,
    lounge: false, basement: 0, taBestMs: 0, boostUntil: 0, delegate: false, lastSeen: now, pendingSec: 0,
    nextRoomNo: 2, hintDone: false, tut: 0, tutGift: false, fullAt: 0, delivered: [], storm: newStorm(), quake: newQuake(), crime: newCrime(), rob: newRobbery(),
  };
}

export const roomCount = (s           ) => s.rooms.length;
export const roomNo = (s           , i        ) => i + 1;
export const floorOf = (i        ) => Math.floor(i / ROOMS_PER_FLOOR) + 1;
export const colOf = (i        ) => i % ROOMS_PER_FLOOR;
export const maxRooms = (s            ) => maxFloorsOf(s) * ROOMS_PER_FLOOR;
/** Floors per tower; the second tower (2棟目) holds floors TOWER_CAP+1 .. 2×TOWER_CAP. */
export const TOWER_CAP = MAX_FLOORS;
export const maxFloorsOf = (s            ) => (s?.twin ? TOWER_CAP * 2 : MAX_FLOORS);
/** 1 = first tower, 2 = second tower */
export const towerOfRoom = (i        ) => (i >= TOWER_CAP * ROOMS_PER_FLOOR ? 2 : 1);
/** floors standing in the second tower (0 before it exists) */
export const twinFloors = (s           ) => (s.twin ? Math.max(0, s.floors - TOWER_CAP) : 0);
/** rooms where incidents (crime raids / burglaries) can happen: the first tower only — the squad and
 *  the burglar use the first tower's elevator */
const incidentRoom = (i        ) => i < TOWER_CAP * ROOMS_PER_FLOOR;

/** The room's asking price at ×1.00 — the reference every rent decision is measured against. */
export function baseRentYen(s           , i        )         {
  const o = s.rooms[i]?.occupant;
  if (!o) return 0;
  const t = tenantType(o.kind);
  return RENT[s.rooms[i].lv] * t.mult * (o.premium ? PREMIUM_MULT : 1);
}
export function roomRent(s           , i        )         {
  const o = s.rooms[i].occupant;
  if (!o) return 0;
  const yen = o.rentYen ?? baseRentYen(s, i) * (o.factor || 1);
  return s.rooms[i].damaged ? yen * 0.5 : yen;
}

export const RENT_MIN = 0.6, RENT_MAX = 1.4;
/** How finely a room's price can be typed: ¥0.1 for pocket-change rooms, ¥1,000 for penthouses. */
export function rentStep(base        )         {
  return base >= 100000 ? 1000 : base >= 10000 ? 100 : base >= 1000 ? 10 : base >= 100 ? 1 : 0.1;
}
export function rentRange(s           , i        )                                             {
  const base = baseRentYen(s, i);
  return { min: base * RENT_MIN, max: base * RENT_MAX, base };
}
/** Round a typed price to the room's step, then clamp it into the allowed band. */
export function clampRent(s           , i        , yen        )         {
  const { min, max, base } = rentRange(s, i);
  if (!base) return 0;
  const step = rentStep(base);
  const snapped = Math.round(yen / step) * step;
  const clamped = Math.max(min, Math.min(max, snapped));
  return Math.round(clamped * 100) / 100;
}
/** The rent a room can fairly support — what tenants compare the landlord's price against. */
export function fairRent(s           , i        )         {
  const room = s.rooms[i];
  const o = room.occupant;
  if (!o) return 1;
  const surplus = Math.max(0, room.lv - tenantType(o.kind).lv);
  const floorBonus = Math.min(0.05, floorOf(i) * 0.0025);
  return 1 + 0.04 * surplus + (o.premium ? 0.06 : 0) + floorBonus;
}
/** The fair price in ¥/sec for this room right now. */
export function fairRentYen(s           , i        )         {
  return baseRentYen(s, i) * fairRent(s, i);
}
/** Tenant reaction to the current price: >0 they feel overcharged, <0 the room is a bargain (relative). */
export function rentPressure(s           , i        )         {
  const fair = fairRentYen(s, i);
  return fair > 0 ? roomRent(s, i) / fair - 1 : 0;
}
/** −1 cheap · 0 fair · 1 expensive (for the sheet's three-step indicator). */
export function rentVerdict(s           , i        )         {
  const p = rentPressure(s, i);
  return p > 0.08 ? 1 : p < -0.08 ? -1 : 0;
}
/** Landlord action: set room i's price in ¥/sec (snapped to the room's step and clamped to ×0.6–×1.4). */
export function setRentYen(s           , i        , yen        , out             = [])          {
  const o = s.rooms[i]?.occupant;
  if (!o || !isFinite(yen)) return false;
  const next = clampRent(s, i, yen);
  if (Math.abs(next - roomRent(s, i)) < 0.0001) return false;
  o.rentYen = next;
  o.factor = baseRentYen(s, i) ? next / baseRentYen(s, i) : 1;
  out.push({ type: "rent", room: i, factor: o.factor, yen: next });
  return true;
}

export function boostActive(s           , now        )          {
  return s.boostUntil > now;
}

/** Total ¥/sec, before the reputation bonus. */
export function baseRate(s           )         {
  let sum = 0;
  for (let i = 0; i < s.rooms.length; i++) sum += roomRent(s, i);
  return sum;
}
/** 1000プレイ記念 (user request 2026-10-23): rent ×1.25 until 2026-11-07 00:00 JST. Rent only — not konbini sales. */
export const EVENT_END_MS = Date.UTC(2026, 10, 6, 15, 0, 0);
export const EVENT_MULT = 1.25;
/** creator debug preview: null = follow the calendar, true/false = force (session only, never saved) */
export let eventOverride                 = null;
export function setEventOverride(v                ) { eventOverride = v; }
export function eventActive(nowMs         = Date.now())          {
  return eventOverride ?? nowMs < EVENT_END_MS;
}
export const eventMult = () => (eventActive() ? EVENT_MULT : 1);
export function incomePerSec(s           , now        )         {
  const b = baseRate(s) * eventMult() * (1 + repBonus(s.rep)) * (1 + basementPct(s.basement)) * (s.storm?.phase === "storm" ? STORM_INCOME : 1) + basementFacilityYen(s.basement);
  return boostActive(s, now) ? b * BOOST_MULT : b;
}
export function boostLeftSec(s           , now        )         {
  return Math.max(0, Math.ceil(s.boostUntil - now));
}

/** Fixtures from lv 2..lv, i.e. what the room shows on its walls. */
export function fixtureLevels(lv        )           {
  const out           = [];
  for (let l = 2; l <= lv; l++) out.push(l);
  return out;
}
export function upgradeCost(lv        )         {
  return lv >= MAX_LV ? 0 : UPGRADE_COST[lv + 1];
}
export function nextFixtureLv(lv        )         {
  return lv >= MAX_LV ? 0 : lv + 1;
}

export function occupiedCount(s           )         {
  let n = 0;
  for (const r of s.rooms) if (r.occupant) n++;
  return n;
}
export function applicantsFor(s           , i        )           {
  const room = s.rooms[i];
  const out           = [];
  for (let k = 0; k < s.applicants.length; k++) {
    const a = s.applicants[k];
    const t = tenantType(a.kind);
    if (t.lv <= room.lv && t.rep <= s.rep) out.push(k);
  }
  return out;
}

function addRep(s           , amount        , out            ) {
  const before = s.rep;
  s.rep = Math.max(0, Math.min(REP_MAX, s.rep + amount));
  if (s.rep !== before) out.push({ type: "rep", amount: s.rep - before });
}

// ---------------------------------------------------------------- actions

export function renovate(s           , i        , now        , out             = [])          {
  const room = s.rooms[i];
  if (!room || room.lv >= MAX_LV) return false;
  const cost = upgradeCost(room.lv);
  if (s.money < cost) return false;
  s.money -= cost;
  room.lv += 1;
  if (room.occupant) {
    room.occupant.sat = SAT_MAX;
    room.occupant.talkAt = Math.max(room.occupant.talkAt, now);
    // keep the landlord's markup: the typed price scales with the new asking rent
    if (room.occupant.rentYen !== undefined) room.occupant.rentYen = clampRent(s, i, baseRentYen(s, i) * (room.occupant.factor || 1));
  }
  addRep(s, UPGRADE_REP[room.lv], out);
  out.push({ type: "renovate", room: i, lv: room.lv });
  return true;
}

export function moveIn(s           , i        , appIndex        , now        , out             = [])                  {
  const room = s.rooms[i];
  const a = s.applicants[appIndex];
  if (!room || room.occupant || !a || room.damaged) return null;
  const t = tenantType(a.kind);
  if (t.lv > room.lv || t.rep > s.rep) return null;
  const profile = fallbackProfile(a.kind, i + a.id);
  const occ           = {
    kind: a.kind, premium: a.premium, name: profile.name, comment: profile.comment,
    sat: SAT_MAX, since: now, talkAt: now, factor: 1, pending: true,
  };
  room.occupant = occ;
  s.applicants.splice(appIndex, 1);
  addRep(s, REP_MOVEIN, out);
  out.push({ type: "movein", room: i });
  return occ;
}

export function talk(s           , i        , now        , out             = [])          {
  const o = s.rooms[i]?.occupant;
  if (!o || now < o.talkAt) return false;
  o.sat = Math.min(SAT_MAX, o.sat + TALK_GAIN);
  o.talkAt = now + TALK_COOLDOWN;
  return true;
}

export function canTalk(s           , i        , now        )          {
  const o = s.rooms[i]?.occupant;
  return !!o && now >= o.talkAt;
}
export function talkWait(s           , i        , now        )         {
  const o = s.rooms[i]?.occupant;
  return o ? Math.max(0, Math.ceil(o.talkAt - now)) : 0;
}

export function buildCost(s           )         {
  if (s.floors >= maxFloorsOf(s)) return 0;
  return floorCost(s.floors >= TOWER_CAP ? s.floors + 1 - TOWER_CAP : s.floors + 1);
}
export function buildRepNeed(s           )         {
  if (s.floors >= maxFloorsOf(s)) return 0;
  return floorRep(s.floors >= TOWER_CAP ? s.floors + 1 - TOWER_CAP : s.floors + 1);
}
/** Satisfaction lost per second in room i (0 = this room is comfortable enough that the tenant never tires of it). */
export function satDecayRate(s           , i        )         {
  const o = s.rooms[i]?.occupant;
  if (!o) return 0;
  const base = SAT_DECAY * satDecayMult(s.rooms[i].lv, tenantType(o.kind).lv);
  const p = rentPressure(s, i);
  // overcharging: +50% decay per 10% over fair, and even a comfortable room starts to wear thin
  if (p > 0.001) return Math.max(base, SAT_DECAY * 0.4) * (1 + 5 * p);
  // a bargain slows decay; 20%+ under fair turns it into slow recovery (negative rate)
  if (p < -0.001) return p <= -0.2 ? -SAT_DECAY * 0.5 * Math.min(1, (-p - 0.15) / 0.25) : base * (1 + 2.5 * p);
  return base;
}
/** Dig the next underground tier (only once the tower is full). */
export function digBasement(s           , out             = [])          {
  if (s.floors < MAX_FLOORS || s.basement >= BASEMENT_MAX) return false;
  const tier = BASEMENT[s.basement];
  if (s.money < tier.cost) return false;
  s.money -= tier.cost;
  s.basement += 1;
  addRep(s, 10, out);
  out.push({ type: "dig", level: s.basement });
  return true;
}

export function canBuild(s           )          {
  return s.floors < maxFloorsOf(s) && s.money >= buildCost(s) && s.rep >= buildRepNeed(s);
}
/** Debug/creator: jump straight to n floors (vacant Lv1 rooms). */
export function setFloors(s           , n        )          {
  if (n <= s.floors || n > maxFloorsOf(s)) return false;
  while (s.floors < n) {
    s.floors += 1;
    for (let k = 0; k < ROOMS_PER_FLOOR; k++) s.rooms.push({ lv: 1, occupant: null });
  }
  return true;
}

/** Debug/creator: jump to n floors WITH residents in every new room (user request 2026-10-31:
 *  the 500F cheat button should spawn tenants along with the floors). */
export function setFloorsWithTenants(s           , n        )          {
  if (!setFloors(s, n)) return false;
  const repGate = Math.max(s.rep, 200);
  let roster = TENANT_TYPES.filter((t) => t.rep <= repGate);
  if (!roster.length) roster = TENANT_TYPES.slice(0, 12);
  for (let i = 0; i < s.rooms.length; i++) {
    const r = s.rooms[i];
    if (!r || r.occupant || r.damaged) continue;
    const t = roster[Math.floor(Math.random() * roster.length)];
    r.lv = Math.max(1, Math.min(MAX_LV, t.lv + Math.floor(Math.random() * 2)));
    const p = fallbackProfile(t.kind, i * 7 + 1);
    r.occupant = {
      kind: t.kind, premium: Math.random() < 0.1,
      name: p.name, comment: p.comment,
      sat: 60 + Math.floor(Math.random() * 40), since: 0, talkAt: 0, factor: 1, pending: false,
    };
  }
  return true;
}

export function addFloor(s           , out             = [])          {
  if (!canBuild(s)) return false;
  s.money -= buildCost(s);
  s.floors += 1;
  for (let k = 0; k < ROOMS_PER_FLOOR; k++) s.rooms.push({ lv: 1, occupant: null });
  out.push({ type: "build", floor: s.floors });
  ensureTwinStart(s);
  return true;
}

/** Shop delivery (or the creator's debug unlock): the 2nd tower. Granted whenever it was paid for;
 *  it rises (1 floor, vacant) as soon as the first tower stands at 500 floors. Idempotent. */
export function unlockTwin(s           )          {
  if (s.twin) return false;
  s.twin = true;
  ensureTwinStart(s);
  return true;
}
/** the second tower always has at least its first floor once the first tower is complete */
export function ensureTwinStart(s           )          {
  if (!s.twin || s.floors !== TOWER_CAP || s.rooms.length !== TOWER_CAP * ROOMS_PER_FLOOR) return false;
  s.floors += 1;
  for (let k = 0; k < ROOMS_PER_FLOOR; k++) s.rooms.push({ lv: 1, occupant: null });
  return true;
}

/** Shop delivery (or the creator's debug unlock): the store opens in the lobby. Idempotent. */
export function unlockKonbini(s           )          {
  if (s.konbini) return false;
  s.konbini = newKonbini();
  return true;
}

export function buyLounge(s           )          {
  if (s.lounge) return false;
  s.lounge = true;
  return true;
}
export function activateBoost(s           , now        ) {
  const from = Math.max(s.boostUntil, now);
  s.boostUntil = from + 30 * 60;
}

// ---------------------------------------------------------------- time

export function settleOffline(s           , now        ) {
  const away = now - s.lastSeen;
  if (away > 1) s.pendingSec = Math.min(OFFLINE_CAP_SEC, s.pendingSec + away);
  s.lastSeen = now;
}
export function pendingAmount(s           )         {
  return s.pendingSec < OFFLINE_MIN_SEC ? 0 : s.pendingSec * baseRate(s) * eventMult() * (1 + repBonus(s.rep));
}
export function claimOffline(s           )         {
  const amount = pendingAmount(s);
  if (amount <= 0) return 0;
  s.money += amount;
  s.total += amount;
  s.pendingSec = 0;
  return amount;
}

const rng = () => Math.random();

function rollApplicant(s           , now        )            {
  const pool = TENANT_TYPES.filter((t) => t.rep <= s.rep && t.lv <= Math.max(1, highestLv(s)));
  // weight toward the best reachable tier so upgrades pay off visibly
  // gentle tilt toward the best reachable tier, but every unlocked type keeps showing up
  const weights = pool.map((_, k) => 1 + k * 0.5);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let pick = pool[0] ?? TENANT_TYPES[0];
  for (let k = 0; k < pool.length; k++) { r -= weights[k]; if (r <= 0) { pick = pool[k]; break; } }
  const premium = s.nextAppId > 3 && rng() < PREMIUM_CHANCE;
  return { kind: pick.kind, premium, bornAt: now, id: s.nextAppId++ };
}
export function highestLv(s           )         {
  let m = 1;
  for (const r of s.rooms) if (r.lv > m) m = r.lv;
  return m;
}
/** Reputation of the best tenant type currently reachable. */
export function bestTenant(s           )             {
  let best = TENANT_TYPES[0];
  for (const t of TENANT_TYPES) if (t.rep <= s.rep && t.lv <= highestLv(s)) best = t;
  return best.kind;
}

function spawnIfPossible(s           , now        , force         ) {
  if (s.applicants.length >= applicantMax(s.floors)) return;
  if (!force) {
    const vacancies = vacantSorted(s);
    if (!vacancies.length) return;
  }
  s.applicants.push(rollApplicant(s, now));
}
function vacantSorted(s           )           {
  const out           = [];
  for (let i = 0; i < s.rooms.length; i++) if (!s.rooms[i].occupant && !s.rooms[i].damaged) out.push(i);
  return out;
}

// ---------------------------------------------------------------- typhoon (GAME_DESIGN §4c)

export const isShut = (s           , i        ) => s.storm.phase !== "calm" && s.storm.shut.includes(i);
export const damagedCount = (s           ) => s.rooms.reduce((n, r) => n + (r.damaged ? 1 : 0), 0);
export function canShutter(s           , i        ) {
  return s.storm.phase === "forecast" && !!s.rooms[i] && !s.rooms[i].damaged && !s.storm.shut.includes(i);
}
export function closeShutter(s           , i        , out             = [])          {
  if (!canShutter(s, i)) return false;
  const cost = shutterCost(s.rooms[i].lv);
  if (s.money < cost) return false;
  s.money -= cost;
  s.storm.shut.push(i);
  out.push({ type: "shutter", room: i });
  return true;
}
/** Rooms worth shuttering (occupied first), and the price to shutter them all. */
export function shutterPlan(s           )                                    {
  const rooms           = [];
  let cost = 0;
  for (let i = 0; i < s.rooms.length; i++) if (canShutter(s, i) && s.rooms[i].occupant) { rooms.push(i); cost += shutterCost(s.rooms[i].lv); }
  return { rooms, cost };
}
export function repair(s           , i        , out             = [])          {
  const room = s.rooms[i];
  if (!room || !room.damaged) return false;
  const cost = repairCost(room.lv);
  if (s.money < cost) return false;
  s.money -= cost;
  room.damaged = false;
  addRep(s, 5, out);
  out.push({ type: "repair", room: i });
  return true;
}
export function repairPlan(s           )                                    {
  const rooms           = [];
  let cost = 0;
  for (let i = 0; i < s.rooms.length; i++) if (s.rooms[i].damaged) { rooms.push(i); cost += repairCost(s.rooms[i].lv); }
  return { rooms, cost };
}
/** Typhoons only form once the player is past the tutorial and has a couple of tenants to protect. */
const stormEligible = (s           ) => s.tut === -1 && occupiedCount(s) >= 2;

/** Earthquake (DLC) or the admin missile: damages a band of rooms. */
/** Blast a room: the tenant flees and every fixture level is lost; only the ruined shell remains to rebuild. */
function obliterate(st           , i        , cause                                = "quake") {
  st.rooms[i].occupant = null;
  st.rooms[i].lv = 1;
  st.rooms[i].damaged = true;
  st.rooms[i].cause = cause;
}
/** admin: blow up exactly one room (missiles hit single rooms, never a band) */
export function obliterateOne(s           , i        , cause           )          {
  if (!s.rooms[i]) return false;
  s.rooms[i].occupant = null;
  s.rooms[i].lv = 1;
  s.rooms[i].damaged = true;
  s.rooms[i].cause = cause;
  return true;
}

/** Earthquakes collapse: the victim floor AND every floor above it goes down (GAME_DESIGN §4e). */
export function quakeStrike(s           , out            )           {
  if (s.twin && s.floors > TOWER_CAP) return quakeStrikeTwin(s, out);
  // collapse starts in the upper 30%–80% of big towers so a random quake cannot wipe the whole building;
  // in small buildings anything above the lobby can go
  const min = s.floors > 4 ? Math.floor(s.floors * 0.3) : (s.floors > 1 ? 1 : 0);
  const max = s.floors > 4 ? Math.max(min, Math.ceil(s.floors * 0.8)) : s.floors - 1;
  const f0 = min + Math.floor(Math.random() * Math.max(1, max - min + 1));
  // the floors above the collapse are GONE — the building shrinks to f0 (GAME_DESIGN §4e, 2026-10-23)
  const first = f0 * ROOMS_PER_FLOOR;
  const hit           = [];
  for (let i = first; i < s.rooms.length; i++) hit.push(i);
  s.rooms.splice(first);
  s.floors = f0;
  // anything pointing at removed rooms is cleaned up
  if (s.crime.room >= first) { s.crime.phase = "quiet"; s.crime.room = -1; s.crime.reported = false; }
  if (s.storm.shut.some((i) => i >= first)) s.storm.shut = s.storm.shut.filter((i) => i < first);
  addRep(s, -20, out);
  if (!hit.length) return [];
  out.push({ type: "quake", rooms: hit.slice(0, 24), band: f0 + 1, count: hit.length });
  return hit;
}

/** Two towers: one of them shakes. The 2nd tower loses its upper floors (keeps its 1st floor);
 *  the 1st tower cannot shrink (the 2nd tower's floors are numbered after its 500) — its upper floors
 *  are wrecked to empty shells instead, rebuilt with 再建. */
function quakeStrikeTwin(s           , out            )           {
  const t2 = s.floors - TOWER_CAP;
  const hitSecond = t2 > 1 && Math.random() < 0.5;
  const hit           = [];
  let band        ;
  if (hitSecond) {
    const min = t2 > 4 ? Math.floor(t2 * 0.3) : 1;
    const max = t2 > 4 ? Math.max(min, Math.ceil(t2 * 0.8)) : t2 - 1;
    const f0 = Math.max(1, min + Math.floor(Math.random() * Math.max(1, max - min + 1)));
    const first = (TOWER_CAP + f0) * ROOMS_PER_FLOOR;
    for (let i = first; i < s.rooms.length; i++) hit.push(i);
    s.rooms.splice(first);
    s.floors = TOWER_CAP + f0;
    if (s.crime.room >= first) { s.crime.phase = "quiet"; s.crime.room = -1; s.crime.reported = false; }
    if (s.storm.shut.some((i) => i >= first)) s.storm.shut = s.storm.shut.filter((i) => i < first);
    band = TOWER_CAP + f0 + 1;
  } else {
    // a band of the upper part of the 1st tower is wrecked (at most 40 floors so a quake stays survivable)
    const f0 = Math.floor(TOWER_CAP * (0.3 + Math.random() * 0.5));
    const f1 = Math.min(TOWER_CAP, f0 + 40);
    for (let f = f0; f < f1; f++) for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
      const i = f * ROOMS_PER_FLOOR + c;
      if (!s.rooms[i] || s.rooms[i].damaged) continue;
      obliterate(s, i, "quake");
      hit.push(i);
    }
    if (s.crime.phase !== "quiet" && s.crime.room >= f0 * ROOMS_PER_FLOOR && s.crime.room < f1 * ROOMS_PER_FLOOR) { s.crime.phase = "quiet"; s.crime.room = -1; s.crime.reported = false; }
    band = f0 + 1;
  }
  addRep(s, -20, out);
  if (!hit.length) return [];
  out.push({ type: "quake", rooms: hit.slice(0, 24), band, count: hit.length });
  return hit;
}

function quakeTick(s           , dt        , out            ) {
  // earthquakes rumble for a couple of seconds BEFORE the collapse (2026-10-23 user request)
  if (s.quake.warnIn > 0) {
    s.quake.warnIn -= dt;
    if (s.quake.warnIn <= 0) {
      s.quake.warnIn = 0;
      quakeStrike(s, out);
      s.quake.quakeIn = nextQuakeGap();
    }
    return;
  }
  if (!s.quake.dlc || s.tut !== -1 || occupiedCount(s) < 3 || s.storm.phase !== "calm" || s.crime.phase !== "quiet") return;
  s.quake.quakeIn -= dt;
  if (s.quake.quakeIn <= 0) {
    s.quake.warnIn = 1.6 + Math.random() * 0.9;
    out.push({ type: "quakeWarn" });
  }
}

function strike(s           , out            ) {
  // a band of floors takes the hit: 3 floors, wider in a tall building
  const band = Math.min(s.floors, 3 + Math.floor(s.floors / 10));
  const f0 = Math.floor(Math.random() * Math.max(1, s.floors - band + 1));
  const pool           = [];
  for (let f = f0; f < f0 + band; f++) for (let c = 0; c < ROOMS_PER_FLOOR; c++) {
    const i = f * ROOMS_PER_FLOOR + c;
    const r = s.rooms[i];
    if (r && !r.damaged && !s.storm.shut.includes(i)) pool.push(i);
  }
  if (!pool.length) return;
  // tenants' rooms are the ones that matter to the player — they are hit first
  const occ = pool.filter((i) => s.rooms[i].occupant);
  const pickFrom = occ.length ? occ : pool;
  const i = pickFrom[Math.floor(Math.random() * pickFrom.length)];
  obliterate(s, i, "storm");
  addRep(s, -10, out);
  out.push({ type: "strike", room: i });
}

// ---------------------------------------------------------------- incidents & raids (GAME_DESIGN §4d)

/** the max time a raid may take before the sim completes it on its own (the view normally finishes first) */
export const RAID_MAX_SEC = 150;
const crimeEligible = (s           ) => s.tut < 0 && s.storm.phase === "calm" && occupiedCount(s) >= 3;

function crimeTick(s           , dt        , out            ) {
  const c = s.crime;
  if (c.phase === "quiet") {
    if (!crimeEligible(s)) return;
    c.timer -= dt;
    if (c.timer > 0) return;
    const pool           = [];
    for (let i = 0; i < s.rooms.length; i++) if (s.rooms[i].occupant && !s.rooms[i].damaged && incidentRoom(i)) pool.push(i);
    if (!pool.length) { c.timer = 30; return; }
    c.room = pool[Math.floor(Math.random() * pool.length)];
    c.crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    c.since = s.rooms[c.room].occupant .since;
    c.reported = false;
    c.phase = "suspect";
    c.timer = SUSPECT_SEC;
    out.push({ type: "crime", room: c.room });
    return;
  }
  // the suspect moved out some other way: nothing left to do
  const o = s.rooms[c.room]?.occupant;
  if (!o || o.since !== c.since) { clearCrime(s, out); return; }
  if (c.phase === "suspect") {
    if (s.delegate) { reportCrime(s, out); return; }
    c.timer -= dt;
    if (c.timer <= 0) startRaid(s, false, out);
  } else {
    c.timer -= dt;
    if (c.timer <= 0) finishRaid(s, out);
  }
}
function clearCrime(s           , out            ) {
  const c = s.crime;
  c.phase = "quiet";
  c.timer = crimeGap(false);
  c.room = -1;
  out.push({ type: "crimeClear" });
}
function startRaid(s           , reported         , out            ) {
  const c = s.crime;
  c.phase = "raid";
  c.reported = reported;
  c.timer = RAID_MAX_SEC;
  out.push({ type: "raid", room: c.room, reported });
}
/** Landlord calls the police: the squad is dispatched, a reward follows the arrest. */
export function reportCrime(s           , out             = [])          {
  if (s.crime.phase !== "suspect") return false;
  startRaid(s, true, out);
  return true;
}
/** Landlord has a word with the tenant: most reform, some flee. */
export function warnTenant(s           , out             = [], roll = Math.random())                           {
  const c = s.crime;
  if (c.phase !== "suspect") return null;
  const i = c.room;
  const o = s.rooms[i].occupant ;
  if (roll < WARN_REFORM) {
    o.sat = Math.max(1, o.sat - 15);
    out.push({ type: "reform", room: i });
    clearCrime(s, out);
    return "reform";
  }
  s.rooms[i].occupant = null;
  addRep(s, REP_FLED, out);
  out.push({ type: "fled", room: i, name: o.name });
  clearCrime(s, out);
  return "fled";
}
/** The squad has the suspect: the room is vacated, the door is broken (damage), the reward is paid. */
export function finishRaid(s           , out             = [])          {
  const c = s.crime;
  if (c.phase !== "raid") return false;
  const i = c.room;
  const room = s.rooms[i];
  const o = room?.occupant;
  let reward = 0;
  if (o) {
    if (c.reported) {
      reward = roomRent(s, i) * REWARD_SEC;
      s.money += reward;
      s.total += reward;
    }
    room.occupant = null;
    room.damaged = true;
    addRep(s, c.reported ? REP_REPORT : REP_IGNORED, out);
    out.push({ type: "arrest", room: i, name: o.name, reward });
  }
  clearCrime(s, out);
  return true;
}
export const crimeRoom = (s           ) => (s.crime.phase === "quiet" ? -1 : s.crime.room);

function stormTick(s           , dt        , out            ) {
  const st = s.storm;
  if (st.phase === "calm") {
    if (!stormEligible(s) || s.crime.phase !== "quiet") return;
    st.timer -= dt;
    if (st.timer <= 0) {
      st.phase = "forecast";
      st.timer = FORECAST_SEC;
      st.shut = [];
      out.push({ type: "forecast" });
    }
  } else if (st.phase === "forecast") {
    st.timer -= dt;
    if (st.timer <= 0) {
      st.phase = "storm";
      st.timer = STORM_SEC;
      st.strikesLeft = strikeCount(s.floors);
      st.strikeIn = 6 + Math.random() * 4;
      out.push({ type: "stormStart" });
    }
  } else {
    st.timer -= dt;
    if (st.strikesLeft > 0) {
      st.strikeIn -= dt;
      if (st.strikeIn <= 0) {
        strike(s, out);
        st.strikesLeft--;
        // spread the remaining strikes over the remaining passage
        st.strikeIn = st.strikesLeft > 0 ? Math.max(2, (st.timer - 4) / st.strikesLeft) * (0.6 + Math.random() * 0.8) : 0;
      }
    }
    if (st.timer <= 0) {
      st.phase = "calm";
      st.timer = stormGap();
      st.shut = [];
      st.strikesLeft = 0;
      st.count++;
      out.push({ type: "stormEnd", damaged: damagedCount(s) });
    }
  }
}

/** Advance the world by dt seconds of real time. `online` false = do not decay satisfaction. */
export function tick(s           , dt        , now        , online         , out             = []) {
  pinInfinite(s);
  const rate = incomePerSec(s, now);
  s.money += rate * dt;
  s.total += rate * dt;
  s.lastSeen = now;
  // コンビニ: residents shop while the game is open; profit is cash only (never the ranked cumulative rent)
  if (s.konbini && online) {
    const r = konbiniTick(s.konbini, dt, baseRate(s), occupiedCount(s), s.money, out             );
    s.money += r.earned - r.spent;
  }

  if (online) {
    for (let i = 0; i < s.rooms.length; i++) {
      const o = s.rooms[i].occupant;
      if (!o) continue;
      // basement amenities (gym / public bath) slow every tenant's satisfaction decay
      o.sat = Math.min(SAT_MAX, o.sat - satDecayRate(s, i) * basementSatMult(s.basement) * (s.konbini ? KB_SAT[s.konbini.price] : 1) * dt);
      if (o.sat <= 0) {
        s.rooms[i].occupant = null;
        addRep(s, REP_MOVEOUT, out);
        out.push({ type: "moveout", room: i, name: o.name });
      }
    }
  }

  // applicants arrive while there is a vacancy; the first one comes early once the player has renovated
  let vacancies = 0;
  for (const r of s.rooms) if (!r.occupant) vacancies++;
  if (vacancies > 0 && s.applicants.length < applicantMax(s.floors)) {
    if (s.rep > 0 && s.firstApplicantAt > now + 4) s.firstApplicantAt = now + 4;
    if (now >= s.firstApplicantAt) {
      s.appTimer += dt;
      const first = s.applicants.length === 0 && s.nextAppId === 1;
      if (first || s.appTimer >= applicantInterval(vacancies)) {
        s.appTimer = 0;
        const before = s.applicants.length;
        spawnIfPossible(s, now, false);
        if (s.applicants.length > before) out.push({ type: "apply" });
      }
    }
  }
  for (let k = s.applicants.length - 1; k >= 0; k--) {
    if (now - s.applicants[k].bornAt > APPLICANT_LIFETIME) s.applicants.splice(k, 1);
  }

  if (online) stormTick(s, dt, out);
  if (online) quakeTick(s, dt, out);
  if (online) robberyTick(s, dt, out);
  if (online) crimeTick(s, dt, out);
  if (s.delegate) delegateTick(s, dt, now, out);

  if (s.boostUntil > 0 && s.boostUntil <= now) { s.boostUntil = 0; out.push({ type: "boostEnd" }); }

  if (s.floors > s.fullAt && isMilestone(s.floors) && occupiedCount(s) === s.rooms.length) {
    s.fullAt = s.floors;
    out.push({ type: "full" });
  }
}

let delegateTimer = 0;

/** robberies progress online-only (crime raids and storms pause them) */
function robberyTick(s           , dt        , out            ) {
  const r = s.rob;
  if (r.phase === "quiet") {
    if (s.tut !== -1 || occupiedCount(s) < 2 || s.storm.phase !== "calm" || s.crime.phase !== "quiet") return;
    r.timer -= dt;
    if (r.timer <= 0) {
      const cand           = [];
      for (let i = 0; i < s.rooms.length; i++) if (s.rooms[i].occupant && !s.rooms[i].damaged && incidentRoom(i)) cand.push(i);
      if (!cand.length) { r.timer = 30; return; }
      r.room = cand[Math.floor(Math.random() * cand.length)];
      r.loot = lootFor(s.money, s.rooms[r.room].lv);
      r.reported = false;
      r.phase = "sneak";
      r.timer = ROB_SNEAK_SEC;
      out.push({ type: "robStart", room: r.room });
    }
  } else if (r.phase === "sneak") {
    r.timer -= dt;
    if (r.timer <= 0) { r.phase = "loot"; r.timer = ROB_LOOT_SEC; out.push({ type: "robPry", room: r.room }); }
  } else if (r.phase === "loot") {
    r.timer -= dt;
    if (r.timer <= 0) {
      r.phase = "quiet"; r.timer = nextRobberyGap();
      s.money = Math.max(0, s.money - r.loot);
      addRep(s, -25, out);
      const o = s.rooms[r.room]?.occupant;
      if (o) o.sat = Math.max(0, o.sat - 15);
      s.rooms[r.room].lv = 1;
      s.rooms[r.room].damaged = true;
      out.push({ type: "robbed", room: r.room, loot: r.loot });
      r.room = -1; r.loot = 0;
    }
  }
}
export function reportRobbery(s           )          {
  const r = s.rob;
  if ((r.phase !== "sneak" && r.phase !== "loot") || r.room < 0 || r.reported) return false;
  r.reported = true;
  r.phase = "squad";
  return true;
}
export function finishRobbery(s           , out             = []) {
  const r = s.rob;
  if (r.phase !== "squad") return;
  s.money += Math.round(r.loot * 1.2);
  addRep(s, 30, out);
  out.push({ type: "robCaught", room: r.room, loot: r.loot });
  r.phase = "quiet"; r.timer = nextRobberyGap(); r.reported = false; r.room = -1; r.loot = 0;
}
function settleRobberyOnLoad(s           ) {
  const r = s.rob;
  if (r.phase === "quiet") return;
  if (r.phase === "squad") { s.money += Math.round(r.loot * 1.2); s.rep = Math.min(1000, s.rep + 30); }
  else {
    s.money = Math.max(0, s.money - r.loot);
    s.rep = Math.max(0, s.rep - 25);
    if (r.room >= 0 && s.rooms[r.room]) { s.rooms[r.room].lv = 1; s.rooms[r.room].damaged = true; }
  }
  r.phase = "quiet"; r.timer = nextRobberyGap(); r.reported = false; r.room = -1; r.loot = 0;
}
function delegateTick(s           , dt        , now        , out            ) {
  delegateTimer += dt;
  if (delegateTimer < 0.25) return;
  delegateTimer = 0;
  let best = -1;
  let bestLv = MAX_LV + 1;
  for (let i = 0; i < s.rooms.length; i++) {
    const lv = s.rooms[i].lv;
    if (lv >= MAX_LV) continue;
    if (s.money >= upgradeCost(lv) * DELEGATE_RATIO && lv < bestLv) { best = i; bestLv = lv; }
  }
  if (best >= 0) renovate(s, best, now, out);
  // the managing agent closes shutters for occupied rooms, then repairs storm damage it can afford comfortably
  if (s.storm.phase === "forecast") {
    for (const i of shutterPlan(s).rooms) { if (s.money < shutterCost(s.rooms[i].lv) * DELEGATE_RATIO) break; closeShutter(s, i, out); }
  } else if (s.storm.phase === "calm") {
    for (const i of repairPlan(s).rooms) { if (s.money >= repairCost(s.rooms[i].lv) * DELEGATE_RATIO) { repair(s, i, out); break; } }
  }
  // seat the highest-tier waiting applicant into the best vacant room that fits them
  for (let k = s.applicants.length - 1; k >= 0; k--) {
    const need = tenantType(s.applicants[k].kind);
    if (need.rep > s.rep) continue;
    let room = -1;
    for (let i = 0; i < s.rooms.length; i++) {
      const r = s.rooms[i];
      if (!r.occupant && r.lv >= need.lv && (room < 0 || r.lv > s.rooms[room].lv)) room = i;
    }
    if (room >= 0) { moveIn(s, room, k, now, out); break; }
  }
  // say hello to the unhappiest tenant who is ready for it
  let low = -1;
  for (let i = 0; i < s.rooms.length; i++) {
    const o = s.rooms[i].occupant;
    if (o && o.sat < 50 && now >= o.talkAt && (low < 0 || o.sat < s.rooms[low].occupant .sat)) low = i;
  }
  if (low >= 0) talk(s, low, now, out);
}

// ---------------------------------------------------------------- serialization

export function serialize(s           )         {
  return JSON.stringify({
    v: SAVE_VERSION,
    money: Math.round(s.money * 100) / 100, total: Math.round(s.total * 100) / 100,
    rep: s.rep, floors: s.floors, lounge: s.lounge, bm: s.basement, taBest: Math.round(s.taBestMs), boostUntil: s.boostUntil,
    delegate: s.delegate, lastSeen: s.lastSeen, pendingSec: s.pendingSec,
    nextAppId: s.nextAppId, hintDone: s.hintDone, tut: s.tut, tutGift: s.tutGift, fullAt: s.fullAt, delivered: s.delivered,
    storm: serializeStorm(s.storm), quake: serializeQuake(s.quake),
    crime: serializeCrime(s.crime),
    kb: serializeKonbini(s.konbini),
    ...(s.twin ? { tw: 1 } : {}),
    ...(s.infBuy ? { ib: 1 } : {}),
    ...(s.infCheat ? { ic: 1, ip: s.infPrev ?? 0 } : {}),
    ...(s.ev1k ? { e1: 1 } : {}),
    // indices of storm-damaged rooms (kept out of the per-room arrays so older readers still parse them)
    dmg: s.rooms.map((r, i) => (r.damaged ? i : -1)).filter((i) => i >= 0),
    applicants: s.applicants.map((a) => ({ k: a.kind, p: a.premium, b: a.bornAt, i: a.id })),
    // room = [lv] or [lv, kind, premium, name, comment, sat, talkAt, pending, factor×100, rentYen×10 (0 = asking price)]
    rooms: s.rooms.map((r) => {
      const o = r.occupant;
      return o ? [r.lv, o.kind, o.premium ? 1 : 0, o.name, "", Math.round(o.sat), Math.round(o.talkAt), o.pending ? 1 : 0, Math.round((o.factor || 1) * 100), Math.round((o.rentYen ?? 0) * 10)] : [r.lv];
    }),
  });
}

export function deserialize(raw     )                   {
  if (!raw) return null;
  let d = raw;
  if (typeof raw === "string") { try { d = JSON.parse(raw); } catch { return null; } }
  if (!d || typeof d !== "object") return null;
  const v = d.v ?? 1;
  if (v !== 1 && v !== SAVE_VERSION) return null;
  if (!Array.isArray(d.rooms) || typeof d.money !== "number" || !d.rooms.length) return null;
  const now = Date.now() / 1000;
  const s            = {
    v: SAVE_VERSION, money: d.money, total: d.total ?? d.money, rep: d.rep ?? 0,
    floors: d.floors ?? Math.ceil(d.rooms.length / ROOMS_PER_FLOOR),
    rooms: d.rooms.map((r     , i        ) => {
      // v1: {lv, o:{k,p,n,c,s,t,k2,pd}} · v2: [lv, kind, premium, name, comment, sat, talkAt, pending]
      const o = Array.isArray(r)
        ? (r.length > 1 ? { k: r[1], p: r[2], n: r[3], c: r[4], s: r[5], k2: r[6], pd: r[7], f: r[8], y: typeof r[9] === "number" ? r[9] / 10 : undefined } : null)
        : r.o || null;
      const lv = Array.isArray(r) ? r[0] : r.lv;
      return {
        lv: Math.min(MAX_LV, Math.max(1, lv | 0)),
        occupant: o && TENANT_TYPES.some((t) => t.kind === o.k) ? {
          kind: o.k              , premium: !!o.p, name: String(o.n ?? ""),
          comment: String(o.c ?? ""), sat: typeof o.s === "number" ? o.s : SAT_MAX, since: now + i * 1e-3,
          talkAt: o.k2 ?? 0, pending: !!o.pd, factor: typeof o.f === "number" ? Math.max(RENT_MIN, Math.min(RENT_MAX, o.f / 100)) : 1,
          rentYen: typeof o.y === "number" && o.y > 0 ? o.y : undefined,
        } : null,
      };
    }),
    applicants: (d.applicants ?? []).map((a     ) => ({ kind: a.k              , premium: !!a.p, bornAt: a.b ?? now, id: a.i ?? 0 })),
    appTimer: 0, nextAppId: d.nextAppId ?? 1,
    firstApplicantAt: 0,
    lounge: !!d.lounge, basement: Math.max(0, Math.min(BASEMENT_MAX, Math.floor((d       ).bm ?? 0))), taBestMs: typeof (d       ).taBest === "number" && (d       ).taBest > 0 ? (d       ).taBest : 0,
    boostUntil: d.boostUntil ?? 0, delegate: !!d.delegate,
    lastSeen: d.lastSeen ?? now, pendingSec: d.pendingSec ?? 0, nextRoomNo: 1,
    hintDone: !!d.hintDone,
    tut: 0, tutGift: !!d.tutGift,
    fullAt: typeof d.fullAt === "number" ? d.fullAt : d.fullFired ? 5 : 0,
    delivered: Array.isArray(d.delivered) ? d.delivered.map(String) : [],
    storm: deserializeStorm(d.storm),
    quake: deserializeQuake(d.quake),
    crime: deserializeCrime(d.crime), rob: deserializeRobbery(d.rob),
    konbini: deserializeKonbini(d.kb),
    ...(d.tw ? { twin: true } : {}),
    ...((d       ).ib ? { infBuy: true } : {}),
    ...((d       ).e1 ? { ev1k: true } : {}),
    ...((d       ).ic ? { infCheat: true, infPrev: Number((d       ).ip) || 0 } : {}),
  };
  // twin-mansion reverted (2026-11-24): saves written while it was live can hold 1000 floors — clamp them back
  if (s.rooms.length > maxRooms(s)) s.rooms.length = maxRooms(s);
  s.floors = Math.max(1, Math.min(maxFloorsOf(s), s.floors, Math.ceil(s.rooms.length / ROOMS_PER_FLOOR)));
  if (Array.isArray(d.dmg)) for (const i of d.dmg) if (s.rooms[i]) s.rooms[i].damaged = true;
  // an incident whose suspect is gone is void; a raid interrupted by a reload settles at once (one outcome, never twice)
  if (s.crime.phase !== "quiet" && !s.rooms[s.crime.room]?.occupant) s.crime = { ...newCrime(), timer: crimeGap(false) };
  if (s.crime.phase === "raid") finishRaid(s);
  settleRobberyOnLoad(s);
  // drop occupants whose room no longer fits, and applicants that expired while away
  for (let i = 0; i < s.rooms.length; i++) if (s.rooms[i].occupant && !s.rooms[i].lv) s.rooms[i].occupant = null;
  if (s.rooms.length > maxRooms(s)) s.rooms.length = maxRooms(s);
  ensureTwinStart(s);
  for (let i = 0; i < s.rooms.length; i++) {
    const o = s.rooms[i].occupant;
    if (o && o.rentYen !== undefined) { o.rentYen = clampRent(s, i, o.rentYen); o.factor = o.rentYen / (baseRentYen(s, i) || 1); }
  }
  // saves from before the tutorial existed: anyone who already played is done with it
  const played = !!d.hintDone || s.floors > 1 || s.rooms.some((r) => r.lv > 1);
  s.tut = typeof d.tut === "number" ? Math.max(-1, Math.min(8, Math.floor(d.tut))) : played ? -1 : 0;
  return s;
}

export { addRep };
