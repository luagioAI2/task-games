/**
 * 宿主适配层 —— 把原版对平台全局 `gp` 的依赖换成本地实现。
 *
 * ## 原版用了 `gp` 的什么（10 处，全在这）
 *
 * | 接口 | 原版用途 | 这里 |
 * | --- | --- | --- |
 * | `player.saves.getLatest()` | 启动读最近一次自动存档 | 槽位表里的 `auto` 槽 |
 * | `player.saves.putLatest(s)` | 自动存档（`saveNow()` / 切后台） | 同上，覆盖 |
 * | `player.saves.list(n)` / `get(id)` / `create(d,name)` / `update(id,d)` | 设置存 `__sys_settings` 这个 **manual 槽** | 同上 |
 * | `player.user.locale` | 定语言 | `ctx.locale`（宿主只有中文） |
 * | `player.ready` | 等平台登录 | 已 resolve 的 Promise |
 * | `fonts.use({display,…})` | 注册正文圆体 `MpFontDisplay` | 本地 `FontFace` |
 * | `fonts.url(id)` | 标题字体地址 | 包内 `fonts/<id>` |
 *
 * ★★ **存档是「槽位制」，不是单个 blob**。原版设置页把偏好存成一个
 *   `kind:'manual'`、`name:'__sys_settings'` 的**独立槽**，
 *   和自动存档分开（注释写着「不进自动存档、不用 localStorage」）。
 *   所以适配层必须真的实现 6 个方法 —— 只做一个 `putLatest` 的话，
 *   设置能存不能读，表现为「语言/音量每次重开都回到默认」，**不报错**。
 *
 * ★★ **`getLatest()` 返回的对象里 `data` 可能是字符串**（旧版 localStorage 影子存档），
 *   `bootRead()` 里先看 `latest.legacy` 再 `JSON.parse`。这里一律给对象，
 *   并**不**设 `legacy` —— 没有影子存档可迁移。
 *
 * ★★ **模块顶层不许碰 `window` / `document`**（`check-plugin.mjs` 在 Node 里真 `import()`）。
 */
import { assetUrl } from './asset.js'

const DELETED = Symbol('deleted')

/** 存档里放槽位表的键（整张表一个键，写入是原子的） */
const K_SLOTS = 'slots'
/** 自动存档槽的 `kind` */
const AUTO = 'auto'

let seq = 0
function newId() {
  seq += 1
  return `s${Date.now().toString(36)}${seq.toString(36)}`
}

/**
 * 异步 `host.storage` → 同步 `get/set`（挂载时 preload 一次，之后读内存、卸载时 flush）。
 * @param {{ list(): Promise<Record<string, unknown>>, set(k: string, v: unknown): Promise<void> }} storage
 */
export function makeHostStore(storage) {
  const cache = new Map()
  const pending = new Map()

  return {
    /** 一次性把整份存档读进内存。**在 start() 之前 await。** */
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
          console.warn('[corgi] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}

/** 独立网页用的同接口 store（localStorage），否则「改完在浏览器里试」每次都是新档 */
export function makeLocalStore(prefix = 'corgi:') {
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
      } catch {
        /* 隐私模式里 localStorage 会抛，按新档开始 */
      }
    },
    get(key) {
      return cache.has(key) ? cache.get(key) : undefined
    },
    set(key, value) {
      cache.set(key, value)
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value))
      } catch {
        /* 配额满就只留内存 */
      }
    },
    remove(key) {
      cache.delete(key)
      try {
        localStorage.removeItem(prefix + key)
      } catch {
        /* ignore */
      }
    },
    async flush() {
      /* localStorage 同步写，没有待落盘的东西 */
    },
  }
}

/** 读槽位表（永远是数组） */
function readSlots(store) {
  const v = store.get(K_SLOTS)
  return Array.isArray(v) ? v : []
}
function writeSlots(store, rows) {
  store.set(K_SLOTS, rows)
}

/**
 * 把 `globalThis.gp` 装成本地实现。
 *
 * @param {ReturnType<typeof makeHostStore>} store
 * @param {{ locale?: string }} [opts]
 */
export function installGp(store, opts = {}) {
  const saves = {
    /** 启动读档。`bootRead()` 只看 `{data}`；读不到返回 null = 新档。 */
    getLatest() {
      const rows = readSlots(store)
      let best = null
      for (const r of rows) if (r && r.kind === AUTO && (!best || (r.at || 0) > (best.at || 0))) best = r
      return best ? { data: best.data } : null
    },

    /** 自动存档：覆盖那个唯一的 auto 槽。**返回 undefined 是安全的** —— 原版调用点没 `.then`。 */
    putLatest(snap) {
      const rows = readSlots(store)
      const at = Date.now()
      const i = rows.findIndex((r) => r && r.kind === AUTO)
      if (i >= 0) rows[i] = { ...rows[i], data: snap, at }
      else rows.push({ id: newId(), kind: AUTO, name: 'auto', data: snap, at })
      writeSlots(store, rows)
      return true
    },

    /** 槽位列表。设置页只找 `kind:'manual' && name:'__sys_settings'`。 */
    list(limit = 100) {
      const rows = readSlots(store).slice().sort((a, b) => (b.at || 0) - (a.at || 0))
      return rows.slice(0, Math.max(1, limit | 0)).map((r) => ({ id: r.id, kind: r.kind, name: r.name }))
    },

    get(id) {
      const r = readSlots(store).find((x) => x && x.id === id)
      return r ? { id: r.id, data: r.data } : null
    },

    create(data, name) {
      const rows = readSlots(store)
      const row = { id: newId(), kind: 'manual', name: String(name ?? ''), data, at: Date.now() }
      rows.push(row)
      writeSlots(store, rows)
      return { id: row.id }
    },

    update(id, data) {
      const rows = readSlots(store)
      const i = rows.findIndex((x) => x && x.id === id)
      if (i < 0) return false
      rows[i] = { ...rows[i], data, at: Date.now() }
      writeSlots(store, rows)
      return true
    },

    /** `bootRead()` 会读它判「已登录但出错 ⇒ 不要覆盖云端」。这里永远没有错。 */
    lastError: null,
  }

  // ---- 字体 ----
  // 原版靠平台注入 `MpFontDisplay`（正文圆体）和标题字体。
  // 平台不在就必须自己注册，否则 `FONT` 常量里第一顺位永远落空，
  // 画面会静默退到系统字体 —— 字能看清，但整个观感全变了，而且零报错。
  const loaded = new Set()
  const fonts = {
    url(id) {
      return assetUrl('fonts/' + String(id).replace(/^\/+/, ''))
    },
    use(spec) {
      const id = spec && spec.display
      if (!id || loaded.has('MpFontDisplay')) return
      loaded.add('MpFontDisplay')
      try {
        if (typeof FontFace === 'undefined' || !document.fonts) return
        const f = new FontFace('MpFontDisplay', `url("${fonts.url(id)}")`)
        document.fonts.add(f)
        f.load().catch(() => {
          /* 字体拿不到就退系统字体，不拦启动 */
        })
      } catch {
        /* ignore */
      }
    },
  }

  const locale = typeof opts.locale === 'string' && opts.locale ? opts.locale : 'zh'
  globalThis.gp = {
    player: {
      saves,
      user: { locale },
      // `onCore()` 里是 `Promise.race([gp.player.ready, timeout])`。
      // 给一个**已 resolve 的 Promise**（不是 `undefined`）—— 后者靠 race 的
      // 非 thenable 分支也能立刻过，但那是隐式的，别依赖。
      ready: Promise.resolve(),
    },
    fonts,
  }
  return globalThis.gp
}
