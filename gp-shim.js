/**
 * 下落的2048 · `window.gp` 的本地替代
 *
 * ## 为什么需要它
 *
 * 原版跑在 MakePlay 的宿主里，`boot()` 一进来就抓 `window.gp`：
 *
 * ```js
 * export async function boot(V = {}) {
 *   const _ = !!V.highlight, D = _ ? null : window.gp
 *   ...
 * }
 * ```
 *
 * 整份代码对 `D` 的用法**全是可选链**（`D?.player?.saves`、`D?.share?.available`），
 * 所以 `window.gp` 为 `undefined` 时游戏照样能跑 —— 只是没有存档、没有名字、
 * 没有排行榜、没有内购。这正好给了我们一个**极小的改造面**：
 * 不用改玩法代码，只补一个壳。
 *
 * ## 补什么 / 不补什么
 *
 * | 能力 | 处理 | 理由 |
 * | --- | --- | --- |
 * | `player.saves.*` | **补**，落到宿主 `storage` | 本地存档（孩子换设备前只有本机） |
 * | `player.user` | **补**，只给 `{ name, locale }` | 名字给首页打招呼；`locale` 决定语言 |
 * | `player.ready` | **补**，立即 resolve | 原版 `await D.player.ready` |
 * | `player.topScores` | 返回 `[]` | 排行榜改成只读本地成绩，见 `game.js` 的 `Vl()` 补丁 |
 * | `player.submitScore` | 不提供 | 没有服务端，交上去也没人看 |
 * | `player.status` | 不提供 | 那是「给别人看的日榜/周榜」，本地用不上 |
 * | `player.profileAvailable` | `false` | 关掉点头像进个人页 |
 * | `share.available` | `false` | 分享按钮自动隐藏（原版就判这个） |
 * | `fonts.use` | **不提供** | 见下面「为什么故意不加载字体」 |
 * | `pay.*` | **不提供** | 见下面「内购是怎么自动消失的」 |
 *
 * ## 内购是怎么自动消失的
 *
 * 续关那段代码自己带门：
 *
 * ```js
 * if (!window.gp?.pay?.available) return
 * ```
 *
 * 我们**不提供 `pay`** ⇒ 真钱续关永远走不到；而它前面还有一条
 * `if ((a.freeCont || 0) > 0)` 的免费续关，所以孩子仍然有一次免费续关的机会。
 * **没有改一行付费代码，内购就没了** —— 这比事后去删按钮安全得多。
 *
 * ## 为什么故意不加载字体
 *
 * 原版只有在 `D.fonts.use` 存在时才去拉 `OpenHuninn.woff2`（2.08 MB）。
 * 实测不加载时的系统回退（PingFang / 微软雅黑 / Noto Sans CJK）已经很圆润，
 * 而 2 MB 相当于整个包的 40%。所以**不实现 `fonts.use`**，省下这 2 MB。
 *
 * ## 存档为什么不用 localStorage
 *
 * 宿主给的是 `host.storage`（底层是 Dexie 的 `gameKv`，在线版还会同步到服务端）。
 * 用 `localStorage` 的话：① 换设备就丢；② 和 App 的备份/导入体系是两套账。
 */

/** 存档在宿主 `storage` 里的键前缀。宿主的键空间本来就按 gameId 隔离过一遍。 */
const SAVE_PREFIX = 'save:'
/** 「最近一局」指针 —— 和普通存档放同一个前缀下，靠精确键名排除 */
const LATEST_KEY = 'save:latest'
/** 最多留几局运行中存档（原版只会用到最新那一局，留几份是防止指针被覆盖后无法回退） */
const KEEP_RUNS = 3

/**
 * 造一个 `window.gp`。
 *
 * @param {object} o
 * @param {{get:Function,set:Function,list:Function}} o.storage 宿主 `host.storage`
 * @param {string} [o.locale] 宿主语言（`zh` / `en` / `ja`）
 * @param {string} [o.playerName] 首页打招呼用的名字
 */
export function makeGpShim({ storage, locale = 'zh', playerName = '小客人' } = {}) {
  /** 原版读 `player.saves.lastError` 判断上一次写盘是否失败 —— 我们从不失败，所以恒 null */
  let lastError = null
  let seq = 0

  /** 读一份存档记录（含 `data`），读不到返回 `undefined` */
  async function readRecord(id) {
    if (!id) return undefined
    const v = await storage.get(SAVE_PREFIX + id)
    return v && typeof v === 'object' ? v : undefined
  }

  /** 把所有「运行中存档」按时间倒序排出来（不含 `save:latest` 指针本身） */
  async function listRuns(limit = 100) {
    const all = (await storage.list()) || {}
    const out = []
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(SAVE_PREFIX) || k === LATEST_KEY) continue
      if (!v || typeof v !== 'object') continue
      out.push({
        id: k.slice(SAVE_PREFIX.length),
        kind: typeof v.kind === 'string' ? v.kind : 'kv',
        name: typeof v.name === 'string' ? v.name : '',
        at: typeof v.at === 'number' ? v.at : 0,
      })
    }
    out.sort((a, b) => b.at - a.at)
    return out.slice(0, Math.max(1, limit | 0))
  }

  /** 只保留最近 N 局，其余置空（`storage` 没有 delete，置 null 等价于删） */
  async function prune() {
    const runs = await listRuns(1000)
    for (const r of runs.slice(KEEP_RUNS)) {
      try {
        await storage.set(SAVE_PREFIX + r.id, null)
      } catch {
        /* 清理失败不影响主流程 */
      }
    }
  }

  const saves = {
    get lastError() {
      return lastError
    },

    /**
     * 写「最近一局」。原版每次落子/合并都会调它。
     *
     * 返回 `true` = 落盘成功；原版只拿它决定要不要 `console.warn`。
     */
    async putLatest(data, kind = 'kv') {
      try {
        const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`
        await storage.set(SAVE_PREFIX + id, {
          kind,
          name: '',
          at: Date.now(),
          data,
        })
        await storage.set(LATEST_KEY, id)
        await prune()
        lastError = null
        return true
      } catch (e) {
        lastError = String((e && e.message) || e)
        return false
      }
    },

    /** 原版：`list(100)` 后找 `kind === 'manual' && name === '__sys_settings'` */
    list(limit = 100) {
      return listRuns(limit)
    },

    /** 原版：`get(id)` 之后读 `.data` */
    async get(id) {
      const rec = await readRecord(id)
      return rec ? { data: rec.data } : null
    },

    /**
     * 「最近一局」—— 开机时 `vs()` 用它决定首页那个按钮是「开奖」还是「继续」。
     *
     * 读的是 `save:latest` 指针；指针被 `clearLatest()` 置空时返回 `null`。
     */
    async getLatest() {
      const id = await storage.get(LATEST_KEY)
      if (typeof id !== 'string' || !id) return null
      const rec = await readRecord(id)
      return rec ? { data: rec.data } : null
    },

    /** 设置存档走 `create(data, name)`，返回 `{ id }` */
    async create(data, name = '') {
      const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`
      await storage.set(SAVE_PREFIX + id, {
        kind: 'manual',
        name,
        at: Date.now(),
        data,
      })
      return { id }
    },

    /** 设置存档走 `update(id, data, name)` */
    async update(id, data, name = '') {
      await storage.set(SAVE_PREFIX + id, {
        kind: 'manual',
        name,
        at: Date.now(),
        data,
      })
      return { id }
    },

    /** 丢掉「最近一局」（开新局、或续关失败时） */
    async clearLatest() {
      try {
        await storage.set(LATEST_KEY, null)
      } catch {
        /* 无所谓 */
      }
    },
  }

  const lang = String(locale || 'zh').toLowerCase()
  const user = {
    id: 'local',
    name: playerName,
    /** 原版用 `as(D?.player?.user?.locale)` 推语言 —— 这里把宿主语言原样给它 */
    locale: lang.startsWith('ja') ? 'ja-JP' : lang.startsWith('en') ? 'en-US' : 'zh-CN',
  }

  return {
    player: {
      /** 原版 `await D?.player?.ready`，拿它当「用户信息到了没有」 */
      ready: Promise.resolve(user),
      user,
      /** 关掉「点头像进个人页」 */
      profileAvailable: false,
      saves,
      /** 排行榜已改成本地成绩（见 game.js 的 `Vl()` 补丁），这里给空数组兜底 */
      async topScores() {
        return []
      },
    },
    /** 原版判 `D?.share?.available` 决定要不要画分享按钮 */
    share: { available: false },
  }
}

/**
 * 把 shim 装到 `window.gp` 上，返回卸载函数。
 *
 * 必须在 `boot()` **之前**调用 —— 原版在 `boot()` 的第一行就把 `window.gp`
 * 抓进局部变量 `D` 了，之后再装它看不到。
 */
export function installGpShim(opts) {
  const prev = window.gp
  const shim = makeGpShim(opts)
  window.gp = shim
  return () => {
    if (window.gp === shim) window.gp = prev
  }
}
