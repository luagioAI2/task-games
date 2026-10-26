/**
 * 宿主适配层 —— 存档后端。
 *
 * 原版 `src/save.js` 把整份进度塞进平台的 `gp.player.saves`（云端 KV，读
 * `latestSync` / 写 `putLatest`）。宿主没有「云存档」这个概念，但有一张按
 * 游戏隔离的表（`host.storage`，键自动加 `<gameId>:` 前缀）。
 *
 * ## 为什么要把**异步**包成**同步**
 *
 * `Save` 在构造函数里同步读（`this.data = ...` 之后整局都在同步改），
 * 而 `host.storage.get()` 是异步的。逐处改成 await 会污染 `Game` 的每一行
 * （`persist()` 在帧里被调，不能 await）。
 *
 * 所以：**挂载时 `preload()` 一次读进内存**，之后读走内存、写走内存并标脏，
 * 卸载时 `flush()`。这和 `melonjar` / `anthill` 是同一套做法。
 *
 * ★★ **`preload()` 必须在 `start()` 之前 await 完**，否则读到的永远是空 Map，
 *    症状是「进度从来没被恢复过」，而且**不报错**。
 * ★★ **模块顶层不许碰 `window` / `document`** —— `check-plugin.mjs` 会在 Node 里
 *    真 `import()` 这个包，顶层碰浏览器全局直接抛。
 */

const DELETED = Symbol('deleted')

/**
 * 把宿主的异步 `storage` 包成同步 `get/set/remove` + `preload/flush`。
 *
 * @param {{ list(): Promise<Record<string, unknown>>, set(k: string, v: unknown): Promise<void> }} storage
 */
export function makeHostStore(storage) {
  const cache = new Map()
  const pending = new Map()

  return {
    async preload() {
      const all = await storage.list()
      for (const [k, v] of Object.entries(all || {})) cache.set(k, v)
    },
    get(key) {
      return cache.has(key) ? cache.get(key) : undefined
    },
    set(key, value) {
      cache.set(key, value)
      pending.set(key, value)
    },
    remove(key) {
      cache.delete(key)
      pending.set(key, DELETED)
    },
    async flush() {
      const jobs = [...pending.keys()].map(async (k) => {
        const v = pending.get(k)
        pending.delete(k)
        try {
          await storage.set(k, v === DELETED ? null : v)
        } catch (e) {
          console.warn('[minergirl] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/**
 * 独立网页（`index.html`）用的同接口 store，落到 `localStorage`。
 *
 * 没有它「改完在浏览器里看一眼」每次都是新档 —— 后面的矿道、管理员、皮肤
 * 都调不到，而 `?qa` 那条调试入口只在 `?qa` 下存在。
 */
export function makeLocalStore(prefix = 'minergirl:') {
  const cache = new Map()
  return {
    async preload() {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith(prefix)) {
            const raw = localStorage.getItem(k)
            cache.set(k.slice(prefix.length), raw == null ? undefined : JSON.parse(raw))
          }
        }
      } catch { /* 隐私模式里 localStorage 会抛，按新档开始 */ }
    },
    get(key) {
      return cache.has(key) ? cache.get(key) : undefined
    },
    set(key, value) {
      cache.set(key, value)
      try { localStorage.setItem(prefix + key, JSON.stringify(value)) } catch { /* 配额满就只留内存 */ }
    },
    remove(key) {
      cache.delete(key)
      try { localStorage.removeItem(prefix + key) } catch { /* 忽略 */ }
    },
    async flush() { /* localStorage 是同步写的，没有待落盘的东西 */ },
  }
}
