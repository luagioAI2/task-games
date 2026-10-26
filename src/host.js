/**
 * Host bridge — the only file that knows where the game is running.
 *
 * The same `game.js` has to work in two shapes:
 *
 * | | standalone (`index.html`) | plugin (host: kid-quest-farm-2d) |
 * | --- | --- | --- |
 * | assets | `assets/x.webp` relative to the document | must ask the host (`ctx.assetUrl`) |
 * | saves  | `localStorage` (sync) | `host.storage` (**async**, key-prefixed per game) |
 * | mount  | `<div id="app">` | the `container` handed to `mount()` |
 *
 * `game.js` reads saves through `window.__ropelandStore` (see `platform.js`), which is
 * this file's sync shim. That keeps the game free of `if (isPlugin)` branches.
 *
 * ★ Two traps, both of which fail silently:
 *
 *   1. **No `window` / `document` at module top level.** The host's `check-plugin.mjs`
 *      really `import()`s the bundle in Node.
 *   2. **Nothing that reads the save may run at module top level.** It would evaluate
 *      before `installHost()`, so it always sees an empty store — "progress is never
 *      restored", with no error anywhere. `game.js` seeds `P` at import time for that
 *      reason; `mount()` installs the store first, then calls `start()`.
 */

/** Set by mount(); null keeps the standalone path. */
let _store = null

const memory = new Map()

const nativeLS = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // privacy mode can throw on access
    return null
  }
}

/** Sync shim installed on `window.__ropelandStore` for the duration of a mount. */
const bridge = {
  get(key) {
    if (_store) return _store.getItem(key)
    const ls = nativeLS()
    if (ls) {
      try {
        return ls.getItem(key)
      } catch {
        /* fall through to memory */
      }
    }
    return memory.has(key) ? memory.get(key) : null
  },
  set(key, value) {
    const v = String(value)
    if (_store) {
      _store.setItem(key, v)
      return
    }
    const ls = nativeLS()
    if (ls) {
      try {
        ls.setItem(key, v)
        return
      } catch {
        /* quota / privacy → memory */
      }
    }
    memory.set(key, v)
  },
  remove(key) {
    if (_store) {
      _store.removeItem(key)
      return
    }
    const ls = nativeLS()
    if (ls) {
      try {
        ls.removeItem(key)
        return
      } catch {
        /* fall through */
      }
    }
    memory.delete(key)
  },
}

/**
 * Install the host store and expose the sync bridge. Call before `start()`.
 *
 * @param {{ storage?: object | null }} opts
 * @returns {Promise<void>} resolves once the save has been read into memory
 */
export async function installHost(opts = {}) {
  const storage = opts.storage ?? null
  _store = storage ? makeHostStore(storage) : null
  if (_store) await _store.preload()
  try {
    globalThis.window.__ropelandStore = bridge
  } catch {
    /* Node (check-plugin.mjs import pass) — nothing to install */
  }
}

/** Persist everything still buffered, then drop the bridge. */
export async function uninstallHost() {
  try {
    if (_store) await _store.flush()
  } finally {
    _store = null
    try {
      if (globalThis.window.__ropelandStore === bridge) delete globalThis.window.__ropelandStore
    } catch {
      /* Node */
    }
  }
}

/**
 * Wrap the host's async `storage` as the sync get/set/remove the game expects.
 *
 * Writes hit memory immediately and land on disk in `flush()`. Flushing per keystroke
 * would put an `await` between "tap" and "frame" on every interaction path.
 *
 * @param {{ get<T>(k: string): Promise<T | undefined>, set(k: string, v: unknown): Promise<void>, list(): Promise<Record<string, unknown>> }} storage
 */
export function makeHostStore(storage) {
  const cache = new Map()
  const dirty = new Set()
  const DELETED = Symbol('deleted')
  const pending = new Map()

  return {
    async preload() {
      const all = await storage.list()
      for (const [k, v] of Object.entries(all)) {
        cache.set(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
    },

    getItem(key) {
      return cache.has(key) ? cache.get(key) : null
    },

    setItem(key, value) {
      const v = String(value)
      cache.set(key, v)
      pending.set(key, v)
      dirty.add(key)
    },

    removeItem(key) {
      cache.delete(key)
      pending.set(key, DELETED)
      dirty.add(key)
    },

    async flush() {
      const keys = [...dirty]
      dirty.clear()
      await Promise.all(
        keys.map(async (k) => {
          const v = pending.get(k)
          pending.delete(k)
          try {
            await storage.set(k, v === DELETED ? null : v)
          } catch (e) {
            // Losing one save should never block the host from switching tabs.
            console.warn('[ropeland] save flush failed', k, e)
          }
        }),
      )
    },
  }
}
