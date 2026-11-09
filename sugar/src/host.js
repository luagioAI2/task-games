/**
 * 宿主注入点 —— 这个游戏**唯一**知道「自己在哪跑」的地方。
 *
 * ## 为什么要有这一层
 *
 * 同一个 `game.js` 要在两种形态下跑：
 *
 * | | 独立网页（`index.html`） | 插件（宿主 `kid-quest-farm-2d`） |
 * | --- | --- | --- |
 * | 资源 | `assets/x.png` 相对文档 | 必须问宿主 `ctx.assetUrl()` |
 * | 存档 | `localStorage` | `host.storage`（**异步**，键自动带 `<gameId>:` 前缀） |
 * | 容器 | `<div id="app">` | `mount(container)` 给的那个 |
 *
 * 两种形态的差别**只在这里**。业务代码（`game.js` / `audio.js` / `board.js`）
 * 一行 `if (isPlugin)` 都不该有 —— 那种分支会随版本漂移，而且没法单测。
 *
 * ## 两个必须绕开的坑
 *
 * ★★ **模块顶层不许碰 `window` / `document` / `localStorage`**。
 *   宿主的 `scripts/check-plugin.mjs` 会在 **Node 里真 `import()`** 这个包，
 *   顶层碰浏览器全局会直接抛。
 *
 * ★★ **凡是「读存档决定初始状态」的代码，都不能留在模块顶层**。
 *   模块顶层在 `installHost()` **之前**求值，那时 `_store` 还是空的 ——
 *   读到的永远是「第一次玩」。症状是「设置/进度从来没被恢复过」，
 *   而且不报错（`try/catch` 一吞就彻底看不出来）。
 *   所以 `game.js` 里这些初始化都被挪进了 `start()`：
 *   语言（`LANG`）、成长存档（`growthState`）、音频偏好（`audio.reloadPrefs()`）。
 *
 * ## `LS` 为什么是同步的
 *
 * `host.storage.get/set` 返回 Promise，而 `localStorage` 是同步 API，
 * 业务代码里有 30 多处同步读写。所以这里做一层**内存缓存 + 异步回写**：
 * 挂载时 `preload()` 一次性把整份存档读进 Map，之后读走内存、写走内存并
 * 标记脏键，卸载时 `flush()` 一次性落盘。
 */

/** 资源地址解析。独立网页 = 原样返回；插件 = `ctx.assetUrl`。 */
let _asset = (rel) => rel

/** 存档后端。`null` = 还没注入（走 `localStorage` 兜底）。 */
let _store = null

/**
 * 装宿主。**必须在任何业务初始化之前调**（`start()` 的第一行）。
 *
 * @param {{ asset?: (rel: string) => string, store?: object | null }} opts
 */
export function installHost(opts = {}) {
  if (typeof opts.asset === 'function') _asset = opts.asset
  if (opts.store) _store = opts.store
}

/** 还原成独立网页形态。卸载时调，避免第二次挂载用到上一个宿主的闭包。 */
export function uninstallHost() {
  _asset = (rel) => rel
  _store = null
}

/**
 * 拼资源地址。
 *
 * 入参一律写**包内相对路径**（`assets/xxx.png`），不要自己拼前缀 ——
 * 插件在 `blob:` 模块里跑，任何相对路径都会以 `blob:` 为基准解析 ⇒ 404。
 */
export const asset = (rel) => _asset(rel)

/* ------------------------------------------------------------------ */
/* 同步存档                                                            */
/* ------------------------------------------------------------------ */

/** 独立网页 / 无 localStorage 环境（Node 单测）下的兜底 */
const memory = new Map()

const nativeLS = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // 某些隐私模式下访问 localStorage 会抛
    return null
  }
}

/**
 * `localStorage` 的同步替身。业务代码里把 `localStorage` 换成 `LS` 即可，
 * 其余一个字都不用改。
 */
export const LS = {
  getItem(key) {
    if (_store) return _store.getItem(key)
    const ls = nativeLS()
    if (ls) {
      try {
        return ls.getItem(key)
      } catch {
        /* 落到内存 */
      }
    }
    return memory.has(key) ? memory.get(key) : null
  },

  setItem(key, value) {
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
        /* 配额满 / 隐私模式 ⇒ 落到内存 */
      }
    }
    memory.set(key, v)
  },

  removeItem(key) {
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
        /* 落到内存 */
      }
    }
    memory.delete(key)
  },
}

/**
 * 把宿主那份**异步** `host.storage` 包成 `LS` 需要的**同步**接口。
 *
 * `preload()` 必须在 `installHost()` 之前 await 完 —— 否则 `start()` 里
 * 那些「读存档决定初始状态」的语句读到的还是空 Map（见文件头第二个坑）。
 *
 * 写操作**立即改内存、延迟落盘**：`localStorage` 的调用点遍布交互路径，
 * 每次 `await` 都会把「按一下按钮」拆成两帧。
 *
 * @param {{ get<T>(k: string): Promise<T | undefined>, set(k: string, v: unknown): Promise<void>, list(): Promise<Record<string, unknown>> }} storage
 */
export function makeHostStore(storage) {
  /** @type {Map<string, string>} */
  const cache = new Map()
  /** @type {Set<string>} 待落盘的键；`DELETED` 是删除标记 */
  const dirty = new Set()
  const DELETED = Symbol('deleted')
  /** @type {Map<string, string | symbol>} */
  const pending = new Map()

  return {
    async preload() {
      const all = await storage.list()
      for (const [k, v] of Object.entries(all)) {
        // 存进去什么就取什么：我们只写字符串，但别假设别人没写过对象
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

    /** 把所有脏键落盘。卸载时 await 它。失败只 warn —— 丢一次进度不该拦住宿主切 tab。 */
    async flush() {
      const keys = [...dirty]
      dirty.clear()
      const jobs = keys.map(async (k) => {
        const v = pending.get(k)
        pending.delete(k)
        try {
          await storage.set(k, v === DELETED ? null : v)
        } catch (e) {
          console.warn('[sugar] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}
