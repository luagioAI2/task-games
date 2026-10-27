// Robbery incidents (GAME_DESIGN §4f). A masked burglar sneaks in from the street, pries a door
// and steals cash unless the player reports him and the squad catches him. State only; the view
// animates the scene. Non-violent like the rest of the game: no weapons, no injuries.
export const ROB_FIRST_SEC = 8 * 60;
export const ROB_GAP_MIN_SEC = 15 * 60;
export const ROB_GAP_RAND_SEC = 10 * 60;
export const ROB_SNEAK_SEC = 26;      // street → door
export const ROB_LOOT_SEC = 18;       // at the door, gathering loot

                                                            
                           
                  
                                                                             
                
               
                                                             
               
                    
 

export const newRobbery = ()           => ({ phase: "quiet", timer: ROB_FIRST_SEC, room: -1, loot: 0, reported: false });
export const nextRobberyGap = () => ROB_GAP_MIN_SEC + Math.random() * ROB_GAP_RAND_SEC;

/** How much the burglar would take: 5% of cash on hand, capped, always something. */
export const lootFor = (money        , roomLv        ) =>
  Math.max(2000, Math.round(Math.min(money * 0.05, 2_000_000 + roomLv * 500_000)));

export function serializeRobbery(r          ) {
  return { p: r.phase === "quiet" ? 0 : r.phase === "sneak" ? 1 : r.phase === "loot" ? 2 : 3, t: Math.max(1, Math.round(r.timer)), r: r.room, l: r.loot, rep: r.reported ? 1 : 0 };
}
export function deserializeRobbery(raw         )           {
  const d = newRobbery();
  if (!raw || typeof raw !== "object") return d;
  const r = raw                                                                    ;
  d.phase = r.p === 1 ? "sneak" : r.p === 2 ? "loot" : r.p === 3 ? "squad" : "quiet";
  d.timer = typeof r.t === "number" && r.t > 0 ? r.t : d.timer;
  d.room = typeof r.r === "number" ? r.r : -1;
  d.loot = typeof r.l === "number" ? r.l : 0;
  d.reported = !!r.rep;
  return d;
}
