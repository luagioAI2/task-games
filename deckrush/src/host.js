/**
 * 宿主适配层 —— 把原版对平台全局 `gp` 的依赖换成本地实现。
 *
 * ## 原版用了 `gp` 的哪些东西（13 处，全在这）
 *
 * | 接口 | 原版用途 | 这里 |
 * | --- | --- | --- |
 * | `player.saves.latestSync` / `putLatest` / `clearLatest` | 一局的中途自动存档 | 落 `host.storage`，键 `run` |
 * | `player.saves.get/put('__sys_best')` | 最高关卡 / 最少回合 | 落 `host.storage`，键 `best` |
 * | `player.achievements.unlock` / `list` | 8 个成就 | 落 `host.storage`，键 `ach`（本地集合） |
 * | `player.submitScore` | 在线排行榜 | **删掉调用点**，这里不提供 |
 * | `share.snap` / `share.image` | 结算页「分享成绩」 | **删掉调用点**，这里不提供 |
 * | `fonts.url` | 平台字体 CDN | 换成包内 `assets/fonts/*.ttf` |
 * | `player.ready` / `user.locale` | 等平台登录、定语言 | 删；语言取存档，默认 `zh` |
 *
 * ★★ **成就必须本地化**，不能只是「平台没有就不显示」：原版 `list()` 缺席时
 * 成就页会渲染 8 个**全灰**的图标，孩子打穿了也一个都不亮 —— 静默失效，没人报错。
 *
 * ★★ **模块顶层不许碰 `window` / `document`**（`check-plugin.mjs` 在 Node 里真 `import()`）。
 */

const DELETED = Symbol('deleted')

const K_RUN = 'run'
const K_BEST = 'best'
const K_ACH = 'ach'
const K_LANG = 'lang'

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
          console.warn('[deckrush] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/** 独立网页用的同接口 store（localStorage），否则「改完在浏览器里试」每次都是新档 */
export function makeLocalStore(prefix = 'deckrush:') {
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
 * `saves.putLatest` 原版存的是**字符串**（`readSave()` 里 `JSON.parse(raw)`），
 * 而 `saves.get/put` 存的是**对象**（`readBest()` 直接读 `.turns`）——
 * 两个口径不一样，别统一成一种。
 */
export function installGp(store) {
  const saves = {
    get latestSync() {
      const v = store.get(K_RUN)
      return typeof v === 'string' ? v : null
    },
    putLatest(snap) {
      // ★ 必须返回 Promise：原版调用点是
      //   `g?.player?.saves?.putLatest(...).then((ok) => …)`
      //   —— 可选链**只挡 nullish**，方法存在就一定会调，然后对返回值 `.then`。
      //   返回 `undefined` ⇒ 在 `save()` 里抛 `Cannot read properties of undefined (reading 'then')`
      //   ⇒ 「回标题 / 暂停 / 结算」这些会顺手存一下的动作全部崩掉。
      if (typeof snap === 'string') store.set(K_RUN, snap)
      return Promise.resolve(true)
    },
    clearLatest() {
      store.remove(K_RUN)
    },
    get(name) {
      return name === '__sys_best' ? store.get(K_BEST) : store.get(name)
    },
    put(name, json) {
      const key = name === '__sys_best' ? K_BEST : name
      try {
        store.set(key, typeof json === 'string' ? JSON.parse(json) : json)
      } catch {
        store.set(key, null)
      }
    },
  }

  const achievements = {
    unlock(key) {
      const list = Array.isArray(store.get(K_ACH)) ? store.get(K_ACH) : []
      if (!list.includes(key)) store.set(K_ACH, [...list, key])
      return Promise.resolve({ ok: true })
    },
    list() {
      const list = Array.isArray(store.get(K_ACH)) ? store.get(K_ACH) : []
      return Promise.resolve(list.map((key) => ({ key, unlocked: true })))
    },
  }

  globalThis.gp = { player: { saves, achievements, user: null } }
  return globalThis.gp
}

/** 语言偏好（原版靠平台 locale，这里存本地） */
export const langKey = K_LANG
