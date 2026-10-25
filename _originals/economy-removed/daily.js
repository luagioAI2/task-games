// Daily system: visit stamps (non-consecutive), 3 random missions, 1 challenge. Resets at JST 00:00. Pure logic; UI in game.ts.
export const jstDayKey = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);

                                                          
export const STAMP_REWARDS           = [{ coins: 50 }, { coins: 50 }, { tickets: 1 }, { coins: 70 }, { coins: 80 }, { tickets: 1 }, { tickets: 2 }];
export const ALL_CLEAR_BONUS = 100;

                                                                                                     
                                                                                          
export const MISSION_POOL               = [
  { id: "play1", kind: "play", goal: 1, reward: 30 },
  { id: "play3", kind: "play", goal: 3, reward: 50 },
  { id: "grab1", kind: "play_grab", goal: 1, reward: 30 },
  { id: "bridge1", kind: "play_bridge", goal: 1, reward: 30 },
  { id: "list1", kind: "list", goal: 1, reward: 30 },
  { id: "reprice1", kind: "reprice", goal: 1, reward: 30 },
  { id: "get1", kind: "get", goal: 1, reward: 60 },
  { id: "ticket1", kind: "ticket", goal: 1, reward: 30 },
];
                                                                                                              
                                                                                   
                             
                                                                                                      
                                                
                                                                                                                         
 

function seeded(seedStr        ) { let h = 2166136261; for (const c of seedStr) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

export function rollDay(day        , machines                                                                    )                                                              {
  const rng = seeded(day);
  const playable = machines.filter(m => m.playable);
  const pool = MISSION_POOL.filter(m => (m.kind !== "play_bridge" || playable.some(x => x.kind === "bridge")) && (m.kind !== "play_grab" || playable.some(x => x.kind === "grab")));
  const easy = pool.filter(m => m.kind !== "get");
  const picks               = [];
  const src = [...easy];
  while (picks.length < 2 && src.length) picks.push(src.splice(Math.floor(rng() * src.length), 1)[0]);
  const rest = pool.filter(m => !picks.includes(m));
  picks.push(rest[Math.floor(rng() * rest.length)]);
  const missions = picks.map(m => ({ ...m, progress: 0, claimed: false }));
  const target = playable[Math.floor(rng() * playable.length)];
  const types                 = [
    { type: "get_within", machineId: target.id, n: target.kind === "bridge" ? 5 : target.kind === "takoyaki" ? 8 : 3, reward: 150 },
    { type: "play_n", machineId: target.id, n: 3, reward: 80 },
  ];
  const c = types[rng() < 0.65 ? 0 : 1];
  return { missions, challenge: { ...c, started: false, playsUsed: 0, done: "none", claimed: false } };
}

export function newDaily(day        , machines                               )             {
  return { day, stampIndex: 0, stampClaimedDay: "", allClearClaimed: false, ...rollDay(day, machines) };
}
// roll a new day while keeping stamps/tickets
export function refreshDaily(d            , day        , machines                               )          {
  if (d.day === day) return false;
  Object.assign(d, { day, allClearClaimed: false, ...rollDay(day, machines) });
  return true;
}
export const stampAvailable = (d            , day        ) => d.stampClaimedDay !== day;
export function claimStamp(d            , day        )                {
  if (!stampAvailable(d, day)) return null;
  const r = STAMP_REWARDS[d.stampIndex]; d.stampClaimedDay = day; d.stampIndex = (d.stampIndex + 1) % 7;
  return r;
}
export function onEvent(d            , kind           , machineKind         ) {
  for (const m of d.missions) {
    if (m.claimed) continue;
    if (m.kind === kind || (kind === "play" && m.kind === "play_grab" && machineKind === "grab") || (kind === "play" && m.kind === "play_bridge" && machineKind === "bridge")) m.progress = Math.min(m.goal, m.progress + 1);
  }
}
