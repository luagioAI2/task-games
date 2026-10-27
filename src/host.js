/**
 * 宿主适配层 —— 把原版对平台全局 `gp` 的依赖换成本地实现。
 *
 * ## 原版用了 `gp` 的哪些东西（全在这）
 *
 * | 接口 | 原版用途 | 这里 |
 * | --- | --- | --- |
 * | `player.saves.latestSync` / `putLatest()` | 中途自动存档（每落一块存一次） | 落 `host.storage`，键 `run` |
 * | `player.saves.list/get/create/update/delete` | 命名记录（`__sys_best` 存最高分与静音） | 落 `host.storage`，键 `recs` |
 * | `player.submitScore` / `topScores` / `openProfile` | **在线排行榜** | 入口已删；这里兜一层空实现，防未捕获异常 |
 * | `player.ready` | 等平台登录、取 locale | 立即就绪、无账号（语言由玩家在界面上选） |
 * | `fonts.use` | 平台字体（注册成 `MpFontDisplay`） | **故意不提供** ⇒ `ui.js` 走 FontFace 分支 |
 * | `fonts.url` | 平台字体 CDN | 指向包内 `assets/fonts/…woff2`（离线可用） |
 *
 * ★★ `saves.get()` 必须返回**裸数据对象**（原版是
 * `const data = await saves.get(row.id); data.best`），不是 `{id, data}` 包一层 ——
 * 包了以后 `typeof data.best === "number"` 恒为 false，症状是「最高分每次都是 0」，
 * 而且**一个错都不报**。
 *
 * ★★ `putLatest()` 必须返回 Promise：原版调用点是 `void putLatest(...)` 还好，
 * 但 `writeBestMeta()` 里是 `saves.list().then(...)` —— 凡是被 `.then()` 的方法
 * 返回 `undefined` 就会抛 `Cannot read properties of undefined (reading 'then')`。
 *
 * ★★ **模块顶层不许碰 `window` / `document`**（`check-plugin.mjs` 在 Node 里真 `import()`）。
 */

const DELETED = Symbol('deleted')

const K_RUN = 'run'
const K_RECS = 'recs'
const K_BEST = '__sys_best'

/** 异步 `host.storage` → 同步 `get/set`（挂载时 preload 一次，之后读内存、卸载时 flush） */
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
          console.warn('[stackmeow] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/** 独立网页用的同接口 store（localStorage），否则「改完在浏览器里试」每次都是新档 */
export function makeLocalStore(prefix = 'stackmeow:') {
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
    async flush() { /* localStorage 同步写，没有待落盘的东西 */ },
  }
}

/**
 * 把 `globalThis.gp` 装成本地实现。
 *
 * @param {ReturnType<typeof makeStore>} store
 * @param {string} [assetBase] 包根（以 `/` 结尾），给字体用
 */
export function installGp(store, assetBase = '') {
  const readAll = () => store.get(K_RECS) ?? {}
  const writeAll = (m) => store.set(K_RECS, m)

  const saves = {
    /** 同步读最近一次自动存档（原版启动时同步读，所以这里也必须同步） */
    get latestSync() {
      return store.get(K_RUN) ?? null
    },
    putLatest(snap) {
      store.set(K_RUN, snap)
      return Promise.resolve(true)
    },
    clearLatest() {
      store.remove(K_RUN)
      return Promise.resolve(true)
    },
    async list() {
      return Object.keys(readAll()).map((name) => ({ id: name, name }))
    },
    /** ★ 裸数据，不包 `{id, data}` —— 见文件头 */
    async get(id) {
      const m = readAll()
      return id in m ? m[id] : null
    },
    async create(data, name) {
      const m = readAll()
      m[name] = data
      writeAll(m)
      return { id: name, name }
    },
    async update(id, data, name) {
      const m = readAll()
      m[name ?? id] = data
      writeAll(m)
      return { id: name ?? id, name: name ?? id }
    },
    async delete(id) {
      const m = readAll()
      delete m[id]
      writeAll(m)
      return { ok: true }
    },
  }

  globalThis.gp = {
    player: {
      saves,
      user: null,
      ready: Promise.resolve({ user: null }),
      /** 排行榜入口已删；这里兜一层，防「结算时无条件调一次」抛未捕获异常 */
      submitScore() { return Promise.resolve({ ok: true, best: null }) },
      topScores() { return Promise.resolve([]) },
      openProfile() { /* 插件里没有账号体系 */ },
    },
    fonts: {
      /** 只给 url，不给 use ⇒ `ui.js` 走 `new FontFace(...)` 分支，字体随包离线加载 */
      url(rel) {
        return `${assetBase}assets/fonts/${rel}`
      },
    },
  }

  return globalThis.gp
}

export const bestKey = K_BEST
