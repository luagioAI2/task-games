/**
 * 存档适配 —— 把**异步**的 `host.storage` 包成**同步**的 `get/set`。
 *
 * ## 为什么需要这一层
 *
 * 原版 `state.js` 走的是平台云存档：`window.gp.player.saves.latestSync` 读、
 * `putLatest(save)` 写。换成宿主之后有两件事变了：
 *
 * 1. `host.storage` 是**异步**的，而 `loadSave()` / `persist()` 在十几处同步调用
 *    （决定初始队伍、语言、关卡进度……）。全改成 `await` 会把启动流程拆成十几帧，
 *    而且**漏一处就读到 `undefined`，表现为「进度没恢复」，不报错**。
 * 2. 平台存档是「整份对象」，宿主是「键值对」。这里把它收成 `save` 一个键，
 *    对象原样存（宿主自己序列化）。
 *
 * 所以：挂载时 `preload()` 一次性读进内存，之后读走内存、写走内存并标脏，
 * 卸载时 `flush()` 一次落盘。
 *
 * ## 两条硬规矩
 *
 * ★★ **模块顶层不许碰 `window` / `document`**：宿主 `check-plugin.mjs` 会在 Node 里
 *   真 `import()` 这个包，顶层碰浏览器全局直接抛。
 *
 * ★★ **`preload()` 必须在 `loadSave()` 之前 await 完**。写在后面等于没等 ——
 *   读到的永远是空 Map，症状是「进度从来没被恢复过」。
 */

const DELETED = Symbol('deleted')

/** @param {{ list(): Promise<Record<string, unknown>>, set(k: string, v: unknown): Promise<void> }} storage */
export function makeHostStore(storage) {
  const cache = new Map()
  const pending = new Map()

  return {
    async preload() {
      const all = await storage.list()
      for (const [k, v] of Object.entries(all)) cache.set(k, v)
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
          console.warn('[moestrike] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/**
 * 独立网页（`index.html`）用的同接口 store，落到 localStorage。
 * 没有它的话「改完在浏览器里试一下」每次都是新档，调不了后面的关卡。
 */
export function makeLocalStore(prefix = 'moestrike:') {
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
      try { localStorage.removeItem(prefix + key) } catch { /* ignore */ }
    },
    async flush() { /* localStorage 是同步写的，没有待落盘的东西 */ },
  }
}
