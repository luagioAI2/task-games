// Progress persistence for 跳绳羊群.
//
// Standalone (index.html) this uses localStorage. Inside the host plugin the loader
// installs a bridge on `window.__ropelandStore` (see src/host.js) that routes every read
// and write through `host.storage`, which is namespaced per plugin. `P` is a plain object
// the game mutates freely; `saveProgress()` debounces the write.
//
// Everything to do with real money, platform login and leaderboards was removed when the
// game was onboarded — the host has no equivalent, and the plugin contract forbids it.

const KEY = "ropeland.progress.v1";

export const SHOP_ITEMS = [
  { id: "skin_rainbow_wool", price: 12 },
  { id: "theme_snow_ranch", price: 20 },
];

export const UPGRADE_COST = {
  start: [20, 40, 80, 160], // level 0..4 → start sheep 1..5
  bell: [300], // 3 → 4 bells
  dog: [150, 150], // 0..2 rescues
};

function defaults() {
  return {
    v: 1, best: 0, bestSheep: 0, bestMult: 1, wool: 0,
    up: { start: 0, bell: 0, dog: 0 },
    tutorialDone: false, recruitTaught: false, latency: 0,
    owned: {}, equipped: { skin: "", theme: "" },
    recent: [], runs: 0, protectNext: false, below: 0, style: "paper",
  };
}

/** @returns {{ get(s:string):string|null, set(s:string,v:string):void, remove(s:string):void, ready?:Promise<void> }|null} */
function bridge() {
  try { return (window).__ropelandStore || null; } catch { return null; }
}

function readRaw() {
  const b = bridge();
  try { return b ? b.get(KEY) : window.localStorage.getItem(KEY); } catch { return null; }
}

function writeRaw(json) {
  const b = bridge();
  try { if (b) b.set(KEY, json); else window.localStorage.setItem(KEY, json); } catch { /* full / denied */ }
}

function loadProgress() {
  const d = defaults();
  try {
    const raw = JSON.parse(readRaw() ?? "null");
    if (raw && typeof raw === "object" && raw.v === 1) {
      return {
        ...d, ...raw,
        up: { ...d.up, ...(raw.up || {}) },
        owned: { ...(raw.owned || {}) },
        equipped: { ...d.equipped, ...(raw.equipped || {}) },
        // `grants` belonged to the old paid-item flow; harmless if a save still carries it.
        recent: Array.isArray(raw.recent) ? raw.recent.slice(-10) : [],
      };
    }
  } catch { /* corrupt save → fresh defaults */ }
  return d;
}

export const P = loadProgress();

/**
 * Re-read the save into `P` **in place**.
 *
 * `P` is seeded at import time, which is before the host store is installed — inside the
 * plugin that means the module always starts from defaults. `start()` calls this once the
 * store is live. Merging in place (rather than reassigning) keeps every importer's
 * binding valid.
 */
export function reloadProgress() {
  const fresh = loadProgress();
  for (const k of Object.keys(P)) delete P[k];
  Object.assign(P, fresh);
}

let saveTimer = 0;
let pendingResolvers = [];

/** Flush pending writes immediately (unmount does this). */
export function flushProgress() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
  writeRaw(JSON.stringify(P));
  const rs = pendingResolvers; pendingResolvers = [];
  for (const r of rs) r(true);
}

export function saveProgress() {
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const rs = pendingResolvers; pendingResolvers = [];
      saveTimer = 0;
      writeRaw(JSON.stringify(P));
      for (const r of rs) r(true);
    }, 120);
  });
}

/** Monday-anchored week number. Only used to rotate the ranch's decorative "featured" sheep. */
export function weekIndex() {
  const t = new Date();
  const day = (t.getDay() + 6) % 7;
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - day).getTime();
  return Math.floor(monday / (7 * 86400000));
}
