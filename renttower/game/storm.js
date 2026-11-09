// Typhoons: forecast → passage → aftermath. Pure state; no rendering here (GAME_DESIGN §4c).
import { RENT } from "./data.js";

                                                       
                             
                    
                                                                                               
                
                                                         
                      
                                      
                   
                                                                  
                 
                                                            
                
 

export const FORECAST_SEC = 90;
export const STORM_SEC = 40;
export const FIRST_STORM_SEC = 8 * 60;
export const stormGap = () => 20 * 60 + Math.random() * 15 * 60;

export function newStorm()             {
  return { phase: "calm", timer: FIRST_STORM_SEC, strikesLeft: 0, strikeIn: 0, shut: [], count: 0 };
}

/** Shutter price for one room: about 20 seconds of that room's level rent, at least ¥50. */
export const shutterCost = (lv        ) => Math.round(RENT[lv] * 20 + 50);
/** Repair price: about 90 seconds of that room's level rent. */
export const repairCost = (lv        ) => Math.round(RENT[lv] * 90 + 100);
/** Rooms hit in one passage. */
export const strikeCount = (floors        ) => Math.min(5, 1 + Math.floor(floors / 8));
/** Income multiplier while a storm rages (nobody goes out). */
export const STORM_INCOME = 0.5;

export function serializeStorm(st            ) {
  return { p: st.phase, t: Math.round(st.timer), sl: st.strikesLeft, si: Math.round(st.strikeIn * 10) / 10, sh: st.shut, c: st.count };
}
export function deserializeStorm(raw     )             {
  const st = newStorm();
  if (!raw || typeof raw !== "object") return st;
  if (raw.p === "calm" || raw.p === "forecast" || raw.p === "storm") st.phase = raw.p;
  if (typeof raw.t === "number" && raw.t >= 0) st.timer = raw.t;
  st.strikesLeft = Math.max(0, raw.sl | 0);
  st.strikeIn = typeof raw.si === "number" ? raw.si : 0;
  st.shut = Array.isArray(raw.sh) ? raw.sh.filter((n     ) => Number.isInteger(n) && n >= 0) : [];
  st.count = Math.max(0, raw.c | 0);
  return st;
}
