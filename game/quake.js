// Earthquakes (DLC) + admin mode (bundled). Pure rules, built on the storm damage model (GAME_DESIGN §4e).
export const QUAKE_FIRST_SEC = 6 * 60;
export const QUAKE_GAP_MIN_SEC = 12 * 60;
export const QUAKE_GAP_RAND_SEC = 13 * 60;

                             
                                                                                      
                 
                                                                    
               
                                                 
                  
                                                                          
                   
 

export const newQuake = ()             => ({ dlc: false, quakeIn: QUAKE_FIRST_SEC, adminOn: false, warnIn: 0 });

export function serializeQuake(q            ) { return { d: q.dlc ? 1 : 0, t: Math.max(1, Math.round(q.quakeIn)), a: q.adminOn ? 1 : 0 }; }

export function deserializeQuake(raw     )             {
  const d             = newQuake();
  if (!raw || typeof raw !== "object") return d;
  d.dlc = !!raw.d;
  d.quakeIn = typeof raw.t === "number" && raw.t > 0 ? raw.t : QUAKE_FIRST_SEC;
  d.adminOn = !!raw.a;
  d.warnIn = 0;
  return d;
}

export const nextQuakeGap = () => QUAKE_GAP_MIN_SEC + Math.random() * QUAKE_GAP_RAND_SEC;
