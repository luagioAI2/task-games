/**
 * 存档适配：把「宿主那份异步 storage」和「浏览器 localStorage」都包成**同步**接口。
 *
 * ## 为什么要同步接口
 *
 * 原版游戏在模块顶层同步读一次存档（`const save = {...}; 读存档覆盖字段`），
 * 然后**到处**同步调 `persist()`。改成 `await` 会把「按一下按钮」拆成两帧，
 * 而且 `persist()` 的调用点遍布交互路径（滑动、过关、切语言…）。
 *
 * 所以：`getItem` / `setItem` 走**内存缓存**（同步），真正落盘在 `flush()` 里
 * （卸载时 `await` 一次）。
 *
 * ## `preload()` 必须在 `start()` 之前 await 完
 *
 * 否则 `start()` 里「读存档决定初始状态」那几句读到的是空缓存，
 * 症状是**进度从来没被恢复过**，而且不报错。
 */

/**
 * 宿主 `host.storage` → 同步接口。
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
      await Promise.all(
        keys.map(async (k) => {
          const v = pending.get(k)
          pending.delete(k)
          try {
            await storage.set(k, v === DELETED ? null : v)
          } catch (e) {
            console.warn('[sweetspin] 存档落盘失败', k, e)
          }
        }),
      )
    },
  }
}

/**
 * 独立网页（`index.html`）用：直接读写 `localStorage`，接口和上面一模一样，
 * 这样 `game.js` 里没有 `if (isPlugin)` 分支 —— 那种分支会随版本漂移，
 * 而且两种形态的测试永远只有一种被跑到。
 *
 * `localStorage` 不可用时（隐私模式 / file:// 某些情况）退化成纯内存，游戏照玩，只是不留档。
 */
export function makeLocalStore(prefix = 'sweetspin:') {
  /** @type {Map<string, string>} */
  const memory = new Map()
  const ls = (() => {
    try {
      const t = '__ss_probe__'
      window.localStorage.setItem(t, '1')
      window.localStorage.removeItem(t)
      return window.localStorage
    } catch {
      return null
    }
  })()

  return {
    async preload() {
      /* 同步可读，不用预热 */
    },
    getItem(key) {
      if (ls) {
        try {
          return ls.getItem(prefix + key)
        } catch {
          /* 落到内存 */
        }
      }
      return memory.has(key) ? memory.get(key) : null
    },
    setItem(key, value) {
      const v = String(value)
      memory.set(key, v)
      if (ls) {
        try {
          ls.setItem(prefix + key, v)
        } catch {
          /* 配额满了就只留内存 */
        }
      }
    },
    removeItem(key) {
      memory.delete(key)
      if (ls) {
        try {
          ls.removeItem(prefix + key)
        } catch {
          /* ignore */
        }
      }
    },
    async flush() {
      /* 已经同步写过了 */
    },
  }
}
