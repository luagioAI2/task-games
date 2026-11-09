/**
 * 宿主适配层 —— 把原版对平台全局 `gp` 的依赖，换成宿主（或 localStorage）提供的能力。
 *
 * ## 为什么用「适配层」而不是改每个调用点
 *
 * 原版 `game.js` 里有 6 处 `gp.*`：`player.saves`（3）、`player.submitScore`（1）、
 * `player.topScores`（1）、`share`（1）。逐处改成 `host.xxx` 会让「独立网页」和「插件」
 * 变成两套代码（那种分支会随版本漂移，而且永远只有一种被跑到）。
 *
 * 所以：**保留 `gp` 这个形状**，在启动时把它装成本地实现 —— 存档落到宿主 `storage`，
 * 在线榜与分享**故意不提供**（调用点已整块删除，这里不提供是第二道保险）。
 *
 * ## 两条硬规矩
 *
 * ★★ **模块顶层不许碰 `window` / `document`**：宿主 `check-plugin.mjs` 会在 Node 里
 *   真 `import()` 这个包，顶层碰浏览器全局直接抛。
 *
 * ★★ **`preload()` 必须在 `start()` 读存档之前 await 完**，否则 `latestSync` 永远是 null，
 *   症状是「进度从来没被恢复过」，而且不报错。
 */

const DELETED = Symbol('deleted')

/** 自动存档（`saves.latestSync` / `putLatest`）在宿主里的键名 */
const LATEST = 'save'

/**
 * 把**异步**的 `host.storage` 包成**同步**的 `get/set`。
 * 挂载时 `preload()` 一次读进内存，之后读走内存、写走内存并标脏，卸载时 `flush()`。
 *
 * @param {{ list(): Promise<Record<string, unknown>>, set(k: string, v: unknown): Promise<void> }} storage
 */
export function makeStore(storage) {
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
          console.warn('[blockfit] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/**
 * 独立网页（`index.html`）用的同接口 store，落到 localStorage。
 * 没有它，「改完在浏览器里试一下」每次都是新档，调不了后面的解锁与印章。
 */
export function makeLocalStore(prefix = 'blockfit:') {
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

/**
 * 把 `globalThis.gp` 装成本地实现。
 *
 * 覆盖到的接口（就是原版真正用到的那几个）：
 * - `player.saves.latestSync` / `putLatest()` —— 整份存档（同步读、同步写）
 * - `player.ready` / `player.user` —— 立即就绪、无账号
 *
 * **故意不提供** `share` / `pay`：
 * - `share` 缺席时，原版每一处分享入口都会自己隐藏（`if (!gpShare || …) return`）。
 *   改造后分享按钮已整块删除，这里不提供是第二道保险。
 * - `pay` 原版就没有（这款游戏一分钱都不收），不提供即「永远买不到」。
 *
 * `submitScore` / `topScores` 保留成**空实现**：在线榜 UI 已删，但结算路径里
 * 万一还留着一处无条件调用，不兜就会在每局结束时抛一次未捕获异常。
 *
 * @param {ReturnType<typeof makeStore>} store
 */
export function installGp(store) {
  const saves = {
    /** 同步读最近一次自动存档（原版在启动时同步读，所以这里也必须是同步的） */
    get latestSync() {
      return store.get(LATEST) ?? null
    },
    putLatest(snap) {
      store.set(LATEST, snap)
    },
  }

  globalThis.gp = {
    player: {
      saves,
      user: null,
      ready: Promise.resolve({ user: null }),
      /** 在线榜已删；兜一层，避免残留调用抛未捕获异常 */
      submitScore() { return Promise.resolve({ ok: true, needLogin: false }) },
      topScores() { return Promise.resolve([]) },
    },
  }

  return globalThis.gp
}
