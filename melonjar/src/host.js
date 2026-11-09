/**
 * 宿主适配层 —— 把原版对平台全局 `gp` 的依赖，换成宿主（或 localStorage）提供的能力。
 *
 * ## 为什么用「适配层」而不是改 54 个调用点
 *
 * 原版 `game.js` 里有 54 处 `gp.*`：`gp.player.saves`（19）、`gp.player.achievements`（9）、
 * `gp.pay.*`（约 15）、`gp.player.submitScore/topScores/user/requestLogin`、`gp.share`、`gp.fonts`。
 * 逐处改成 `host.xxx` 既容易漏、又会让「独立网页」和「插件」变成两套代码
 * （那种分支会随版本漂移，而且永远只有一种被跑到）。
 *
 * 所以：**保留 `gp` 这个形状**，在启动时把它装成一个本地实现 ——
 * 存档落到宿主 `storage`，成就与字体变成空实现，`pay` / `share` **故意不提供**。
 *
 * ## 两条硬规矩
 *
 * ★★ **模块顶层不许碰 `window` / `document`**：宿主 `check-plugin.mjs` 会在 Node 里
 *   真 `import()` 这个包，顶层碰浏览器全局直接抛。
 *
 * ★★ **`preload()` 必须在 `start()` 之前 await 完**，否则读到的永远是空 Map，
 *   症状是「进度从来没被恢复过」，而且不报错。
 */

const DELETED = Symbol('deleted')

/** 存档在宿主里的键名（整份对象一个键，宿主自己序列化） */
const RECORDS = 'records'
/** 自动存档（`saves.latestSync` / `putLatest`）单独一个键 */
const LATEST = 'latest'

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
          console.warn('[melonjar] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/**
 * 独立网页（`index.html`）用的同接口 store，落到 localStorage。
 * 没有它「改完在浏览器里试一下」每次都是新档，调不了后面的升级与成就。
 */
export function makeLocalStore(prefix = 'melonjar:') {
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

/** 成就进度存在宿主里的键名 */
const ACHV = 'achv'

/**
 * 成就的达成线。
 *
 * ★ 原版这个 `target` 是**平台**发回来的（`list()` 里带 `target`），本地实现必须自己有一份，
 *   否则成就面板里「合成 500 次」这类会永远显示 0/0 且永不亮。
 *   只有进度型（`merges500` / `daily7`）需要 > 1，其余是「发生过就解锁」。
 */
const ACHV_TARGET = {
  first_watermelon: 1,
  double_watermelon: 1,
  chain5: 1,
  score10k: 1,
  score50k: 1,
  merges500: 500,
  daily7: 7,
  revive_used: 1,
}

/**
 * 把 `globalThis.gp` 装成本地实现。
 *
 * 覆盖到的接口（就是原版真正用到的那几个）：
 * - `player.saves.list/get/create/update` —— 命名记录（`__sys_meta` / `__sys_best`）
 * - `player.saves.latestSync` / `putLatest()` —— 对局自动存档（同步读、同步写）
 * - `player.achievements.progress/unlock/list` —— **落到本地存档**（见 ACHV_TARGET）
 * - `player.ready` / `player.user` —— 立即就绪、无账号
 * - `fonts.use` —— 空实现（字体由 `setupFont()` 本地加载）
 *
 * **故意不提供** `pay` / `share`：
 * - `pay` 缺席时，原版每一处都是 `!gp.pay?.available` / `if (!gp.pay?.available) return`。
 *   改造后**购买点已全部删除**（复活 / 摇一摇改花宝石，见 `game.js` 顶部注释），
 *   这里不提供 `pay` 是第二道保险：万一以后又冒出一处调用，它也不会真的扣款。
 * - `share` 缺席时分享按钮保持 `hidden`。
 *
 * @param {ReturnType<typeof makeStore>} store
 */
export function installGp(store) {
  const readAll = () => store.get(RECORDS) ?? {}
  const writeAll = (m) => store.set(RECORDS, m)

  const saves = {
    /** 同步读最近一次自动存档（原版在启动时同步读，所以这里也必须是同步的） */
    get latestSync() {
      return store.get(LATEST) ?? null
    },
    putLatest(snap) {
      store.set(LATEST, snap)
    },
    async list() {
      return Object.keys(readAll()).map((name) => ({ id: name, name }))
    },
    async get(id) {
      const m = readAll()
      return id in m ? { id, name: id, data: m[id] } : null
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
      return { id: name ?? id }
    },
  }

  // ---- 成就（本地） ----
  const readAchv = () => store.get(ACHV) ?? {}
  const writeAchv = (m) => store.set(ACHV, m)
  const touch = (key, fn) => {
    const m = readAchv()
    const cur = m[key] ?? { unlocked: false, progress: 0 }
    const next = fn({ ...cur })
    m[key] = next
    writeAchv(m)
    return next
  }

  globalThis.gp = {
    player: {
      saves,
      user: null,
      ready: Promise.resolve({ user: null }),
      /**
       * 排行榜：入口已隐藏（`#rank-btn` / `#rank-btn2` 带 `hidden`），
       * 这里再兜一层 —— 结算时 `submitScoreOnce()` 是**无条件**调的，
       * 不兜就会在每局结束时抛一次未捕获异常。
       */
      submitScore() { return Promise.resolve({ ok: true, needLogin: false }) },
      topScores() { return Promise.resolve([]) },
      requestLogin() { /* 插件里没有账号体系 */ },
      achievements: {
        /** 进度型成就：记最大值，够线就解锁 */
        progress(key, value) {
          const v = Number(value) || 0
          const target = ACHV_TARGET[key] ?? 1
          touch(key, (cur) => ({
            progress: Math.max(cur.progress, v),
            unlocked: cur.unlocked || Math.max(cur.progress, v) >= target,
          }))
        },
        /** 「发生过」型成就 */
        unlock(key) {
          touch(key, (cur) => ({
            progress: Math.max(cur.progress, ACHV_TARGET[key] ?? 1),
            unlocked: true,
          }))
        },
        /** 面板读的就是这个；形状要和原版一致：{ key, unlocked, progress, target } */
        async list() {
          const m = readAchv()
          return Object.keys(ACHV_TARGET).map((key) => ({
            key,
            unlocked: m[key]?.unlocked === true,
            progress: m[key]?.progress ?? 0,
            target: ACHV_TARGET[key],
          }))
        },
      },
    },
    fonts: { use() { /* 字体本地加载，见 setupFont() */ } },
  }

  return globalThis.gp
}
