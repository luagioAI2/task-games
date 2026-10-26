// Platform glue: progress autosave (gp.player.saves), MakePlay coin shop (gp.pay), leaderboard (gp.player).
                                                              

                           
       
               
                    
                   
               
                                                   
                        
                                                                                              
                                                     
                                          
                                                                               
                                                     
                                              
               
                       
                                                       
                                      
 

export const SHOP_ITEMS                                  = [
  { id: "skin_rainbow_wool", price: 12 },
  { id: "theme_snow_ranch", price: 20 },
];

export const UPGRADE_COST = {
  start: [20, 40, 80, 160], // level 0..4 → start sheep 1..5
  bell: [300], // 3 → 4 bells
  dog: [150, 150], // 0..2 rescues
};

function defaults()           {
  return {
    v: 1, best: 0, bestSheep: 0, bestMult: 1, wool: 0,
    up: { start: 0, bell: 0, dog: 0 },
    tutorialDone: false, recruitTaught: false, latency: 0,
    owned: {}, equipped: { skin: "", theme: "" },
    grants: [], recent: [], runs: 0, protectNext: false, below: 0, style: "paper",
  };
}

function gpx()      { return (window       ).gp; }

// ---- Local test fallback: ONLY when the host injected no gp.pay at all. Never charges anything. ----
export let simConfirmHook                                                                                        = null;
export function setSimConfirmHook(fn                                                                              ) { simConfirmHook = fn; }
const simPending                                                                      = [];
const SIM_PAY = {
  sim: true,
  available: true,
  async purchase(o     ) {
    const ok = simConfirmHook ? await simConfirmHook(o) : false;
    return ok ? { ok: true, purchaseId: "sim-" + Date.now() + "-" + Math.floor(Math.random() * 1e6), balance: 0 }
      : { ok: false, purchaseId: "", error: "declined" };
  },
  async pending() { return { ok: true, items: simPending.slice() }; },
  async ack(id        ) { const i = simPending.findIndex((p) => p.purchaseId === id); if (i >= 0) simPending.splice(i, 1); return { ok: true }; },
};
(window       ).__simPay = SIM_PAY;
export function payApi()      { return gpx()?.pay || SIM_PAY; }
export function isSimPay()          { return payApi() === SIM_PAY; }

function loadProgress()           {
  const d = defaults();
  try {
    const raw = gpx()?.player?.saves?.latestSync;
    if (raw && typeof raw === "object" && raw.v === 1) {
      return {
        ...d, ...raw,
        up: { ...d.up, ...(raw.up || {}) },
        owned: { ...(raw.owned || {}) },
        equipped: { ...d.equipped, ...(raw.equipped || {}) },
        grants: Array.isArray(raw.grants) ? raw.grants.slice(-300) : [],
        recent: Array.isArray(raw.recent) ? raw.recent.slice(-10) : [],
      };
    }
  } catch { /* fall through */ }
  return d;
}

export const P           = loadProgress();

export function saveProgress()                   {
  try {
    const s = gpx()?.player?.saves;
    if (!s?.putLatest) return Promise.resolve(false);
    return s.putLatest(JSON.parse(JSON.stringify(P))).then((r         ) => !!r, () => false);
  } catch { return Promise.resolve(false); }
}

// ---------- shop ----------
export function payAvailable()          {
  try { return !!payApi().available; } catch { return false; }
}

/** Deliver an item for a purchaseId exactly once. Returns true when newly granted. */
function grant(itemId        , purchaseId        )          {
  if (P.grants.includes(purchaseId)) return false;
  if (itemId !== "skin_rainbow_wool" && itemId !== "theme_snow_ranch") return false;
  P.grants.push(purchaseId);
  if (P.grants.length > 300) P.grants = P.grants.slice(-300);
  const already = !!P.owned[itemId];
  P.owned[itemId] = true;
  if (!already) {
    if (itemId === "skin_rainbow_wool") P.equipped.skin = "skin_rainbow_wool";
    if (itemId === "theme_snow_ranch") P.equipped.theme = "theme_snow_ranch";
  }
  return true;
}

/** Startup pass: pending() → grant (dedupe) → persist → ack. Returns newly granted item ids. */
export async function recoverPending()                    {
  const pay = payApi();
  if (!pay?.pending || !pay.available) return [];
  let res     ;
  try { res = await pay.pending(); } catch { return []; }
  if (!res || res.ok !== true || !Array.isArray(res.items)) return []; // query failed → retry next launch
  const got           = [];
  const toAck           = [];
  for (const it of res.items) {
    if (!it || !it.purchaseId) continue;
    if (grant(it.itemId, it.purchaseId)) got.push(it.itemId);
    if (P.grants.includes(it.purchaseId)) toAck.push(it.purchaseId);
  }
  if (toAck.length) {
    await saveProgress(); // persist dedupe record before ack
    for (const id of toAck) { try { void pay.ack(id); } catch { /* host retries */ } }
  }
  return got;
}

;                                                                                                                       

export async function buy(itemId        , title        , desc        )                     {
  const pay = payApi();
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!pay?.purchase || !item) return "unavailable";
  let r     ;
  try { r = await pay.purchase({ itemId, title, desc, price: item.price }); } catch { return "fail"; }
  if (r && r.ok === true && r.purchaseId) {
    grant(itemId, r.purchaseId);
    await saveProgress();
    try { void pay.ack(r.purchaseId); } catch { /* host retries */ }
    return "ok";
  }
  const e = r?.error;
  if (e === "pending") return "pending";
  if (e === "busy") return "busy";
  if (e === "declined") return "declined";
  if (e === "insufficient") return "insufficient";
  if (e === "need_login") return "need_login";
  if (e === "disabled" || e === "offline") return "unavailable";
  return "fail";
}

// ---------- leaderboard ----------
;                                                                                                                                          

export async function topScores()                          {
  const pl = gpx()?.player;
  if (!pl?.topScores) return null;
  try {
    const gp = gpx();
    const rows = await gp.player.topScores(10, { includeMutual: true });
    if (!Array.isArray(rows)) return null;
    return rows.map((r     , i        ) => ({
      name: String(r.name ?? ""), avatar: String(r.avatar ?? ""), score: Number(r.score) || 0,
      isMe: !!r.isMe, rank: r.rank ?? i + 1, mutual: r.mutual === true, userId: r.userId || null,
    }));
  } catch { return null; }
}

;                                                                                                
export async function submitScore(score        )                         {
  const pl = gpx()?.player;
  if (!pl?.submitScore) return { kind: "offline" };
  try {
    const gp = gpx(); void pl;
    const r = await gp.player.submitScore(Math.floor(score));
    if (r && r.needLogin) return { kind: "login" };
    if (r && typeof r.best === "number") return { kind: "ok", best: r.best, rank: r.rank };
    return { kind: "offline" };
  } catch { return { kind: "offline" }; }
}

export function weekIndex()         {
  return Math.floor(Date.now() / (7 * 86400000));
}
