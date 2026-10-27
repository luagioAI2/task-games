// Tenant incidents and police raids (GAME_DESIGN §4d). Pure state — the view only animates the raid.
export const CRIMES = ["gambling", "fakes", "pets", "casino", "party", "sublet"]         ;
                                            

                                                      
                             
                    
                                                                                      
                
               
               
                                                                                                        
                    
                                                                                
                
 

export const SUSPECT_SEC = 90;
export const REWARD_SEC = 300;
export const REP_REPORT = 40;
export const REP_IGNORED = -40;
export const REP_FLED = -20;
export const WARN_REFORM = 0.6;
export const crimeGap = (first         ) => (first ? 360 : 720 + Math.random() * 600);

export const newCrime = ()             => ({ phase: "quiet", timer: crimeGap(true), room: -1, crime: "party", reported: false, since: 0 });

export function serializeCrime(c            ) {
  return { p: c.phase, t: Math.round(c.timer), r: c.room, c: c.crime, rep: c.reported ? 1 : 0, s: Math.round(c.since * 1000) / 1000 };
}
export function deserializeCrime(d     )             {
  if (!d || typeof d !== "object") return newCrime();
  const phase             = d.p === "suspect" || d.p === "raid" ? d.p : "quiet";
  return {
    phase,
    timer: typeof d.t === "number" ? d.t : crimeGap(true),
    room: typeof d.r === "number" ? d.r : -1,
    crime: (CRIMES                     ).includes(d.c) ? d.c : "party",
    reported: !!d.rep,
    since: typeof d.s === "number" ? d.s : 0,
  };
}
