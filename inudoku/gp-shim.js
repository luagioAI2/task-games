/**
 * 犬独 · `window.gp` 的本地替身。
 *
 * ## 为什么需要它
 *
 * 原版是 MakePlay 平台上的游戏，开局第一行就摸 `gp.player.saves.latestSync`
 * ——没有 `window.gp` 直接 TypeError，整屏空白。原版用到平台的五样东西：
 *
 * | 平台能力 | 原版怎么用 | 这里怎么办 |
 * | --- | --- | --- |
 * | `player.saves.*` | 自动存档 + 一个手动槽位 | 落到 `host.storage`（App 的统一本地存档） |
 * | `player.achievements.*` | 12 项成就 | 本地算 + 本地存 |
 * | `player.ready` / `requestLogin` | 拿昵称、语言 | 直接给 `{user:null}` |
 * | `share` | 结算页分享截图 | `{available:false}` ⇒ 那个按钮不出现 |
 * | `pay` | **真钱**买命 / 买皮肤 / 买 BGM | **不给** ⇒ 所有购买入口自动消失 |
 * | `fonts` | 从 CDN 拉 2 MB 中文字体 | 返回空串 ⇒ 走系统字体（`ui-rounded` 回落） |
 *
 * ## 为什么不给 `pay`
 *
 * 原版每一处购买都写着 `if (!gp?.pay?.available) return`，所以**不给 pay
 * 就等于把内购整块摘掉**，不用改玩法代码。摘掉之后：
 *   · 买命（`buyLife`）那一行 `canBuyLife()` 恒 false ⇒ 不渲染；
 *   · 皮肤 / BGM 的价格标签 `skinsBuyable()` 恒 false ⇒ 不渲染；
 *   · 那 8 只狗和 4 首曲子的解锁改由「通关数」驱动（见 `scripts/patch-game.mjs` 的 `__grant`）。
 *
 * ## `latestSync` 为什么必须是**同步**的
 *
 * 原版 `let t=Ye(gp.player.saves.latestSync)||de()` 在**模块顶层**执行，
 * 没有 await 的机会。所以挂载顺序必须是：
 *
 * ```
 *   await storage.get('save:latest')  →  装 window.gp（latestSync 已就位）  →  boot()
 * ```
 *
 * 顺序反了不会报错，只会**每次都从新存档开始**——这个坑很难从症状反推。
 */

/** 存档键。宿主会按 `<gameId>:` 加前缀，插件这边只写自己的键。 */
const LATEST_KEY = 'save:latest'
const SLOT_KEY = 'save:slot'
const ACH_KEY = 'ach'

/** 手动槽位的固定 id / 名字（原版按 `name==="slot1"` 找） */
const SLOT_ID = 'slot1'

/**
 * 12 项成就。
 *
 * `target` 有值 = 靠 `progress(key, n)` 累计解锁；没有 = 靠 `unlock(key)` 直接给。
 * `hidden` = 没解锁时连名字都不显示（原版只有「秘密的猫」是这样）。
 */
const ACH_DEFS = [
  { key: 'first_clear', target: null, name: { zh: '初次通关', ja: 'はじめてのクリア', en: 'First clear' } },
  { key: 'no_mistake', target: null, name: { zh: '零失误通关', ja: 'ミスなしクリア', en: 'Flawless' } },
  { key: 'nohint_clear', target: null, name: { zh: '一次提示都没用', ja: 'ヒントなしクリア', en: 'No hints' } },
  { key: 'sizes_9', target: 9, name: { zh: '九种尺寸都通关', ja: '9 種類の盤面', en: 'Nine sizes' } },
  { key: 'clear_12x12', target: null, name: { zh: '通关 12×12', ja: '12×12 クリア', en: '12×12 clear' } },
  { key: 'all_cleared', target: 36, name: { zh: '主线 36 关全通', ja: '全ステージ制覇', en: 'All levels' } },
  { key: 'skin_first', target: null, name: { zh: '解锁第一只狗狗', ja: 'はじめての着せ替え', en: 'First dog' } },
  { key: 'secret_cat', target: null, hidden: true, name: { zh: '秘密的猫', ja: 'ひみつのねこ', en: 'Secret cat' } },
  { key: 'adv_first_clear', target: null, name: { zh: '进阶首胜', ja: '上級はじめてクリア', en: 'First advanced' } },
  { key: 'adv_double_all', target: 8, name: { zh: '「双子」全通', ja: 'ダブル全制覇', en: 'Double all' } },
  { key: 'adv_bone_all', target: 8, name: { zh: '「骨头」全通', ja: 'ボーン全制覇', en: 'Bone all' } },
  { key: 'adv_all_16', target: 16, name: { zh: '进阶 16 题全通', ja: '上級全制覇', en: 'Advanced all' } },
]

/** 把 `<html>` 上的纸纹地址设成绝对地址（ui.js 的 CSS 里用的是 `var(--inudoku-paper)`） */
export function installAssetCss(assetUrl) {
  const el = document.documentElement
  el.style.setProperty('--inudoku-paper', `url("${assetUrl('assets/paper.webp')}")`)
}

/**
 * 装一个 `window.gp`。
 *
 * @param {object} o
 * @param {{get:Function,set:Function,list:Function}} o.storage 宿主的 `host.storage`
 * @param {string} [o.locale] 宿主语言（`zh` / `ja` / `en`）
 * @returns {Promise<{remove:() => void, flush:() => void}>} 卸载 / 立即落盘
 */
export async function installGpShim({ storage, locale = 'zh' } = {}) {
  const prev = window.gp

  /* ---------------- 存档 ---------------- */
  const latest = await storage.get(LATEST_KEY)
  let achState = (await storage.get(ACH_KEY)) || { unlocked: [], progress: {} }
  if (!Array.isArray(achState.unlocked)) achState.unlocked = []
  if (!achState.progress || typeof achState.progress !== 'object') achState.progress = {}

  /**
   * 写盘去抖。
   *
   * 原版每次落子都会 `putLatest()`（`x()` 里就调 `Ge()`），一局下来几十次。
   * 直写 IndexedDB 也能跑，但**每一笔都开一个事务**会明显拖慢 Pixi 的帧
   * —— 表现是「摆子的时候手一顿一顿的」。这里攒 300 ms 写一次。
   */
  let pending = null
  let timer = 0
  const flushSave = () => {
    if (timer) {
      clearTimeout(timer)
      timer = 0
    }
    if (pending === null) return
    const v = pending
    pending = null
    storage.set(LATEST_KEY, v).catch(() => {})
  }
  const queueSave = (str) => {
    pending = str
    if (!timer) timer = setTimeout(flushSave, 300)
  }

  /* ---------------- 成就 ---------------- */
  const unlocked = new Set(achState.unlocked)
  /** `list()` 只建一次数组：ui.js 会把结果缓存住，**改原地**才能让计数跟着变 */
  let items = null
  const persistAch = () => {
    storage.set(ACH_KEY, { unlocked: [...unlocked], progress: { ...achState.progress } }).catch(() => {})
  }
  const syncAch = () => {
    if (!items) return
    for (const it of items) it.unlocked = unlocked.has(it.key)
  }
  const grant = (key) => {
    if (unlocked.has(key)) return false
    unlocked.add(key)
    achState.unlocked = [...unlocked]
    syncAch()
    persistAch()
    return true
  }
  const achievements = {
    /** ui.js 期望：`[{key, name, unlocked, hidden}]` */
    async list() {
      if (!items) {
        items = ACH_DEFS.map((d) => ({
          key: d.key,
          name: d.name[locale] || d.name.zh,
          hidden: !!d.hidden,
          unlocked: unlocked.has(d.key),
        }))
      }
      return items
    },
    unlock(key) {
      grant(key)
    },
    /** 累计型：`progress('all_cleared', 12)`，到 target 自动解锁 */
    progress(key, n) {
      const def = ACH_DEFS.find((d) => d.key === key)
      if (!def || def.target == null) return
      const v = Math.max(0, Math.min(def.target, Number(n) || 0))
      achState.progress[key] = v
      if (v >= def.target) grant(key)
      else persistAch()
    },
  }

  /* ---------------- 手动槽位 ---------------- */
  const slotRecord = async () => {
    const rec = await storage.get(SLOT_KEY)
    return rec && typeof rec === 'object' ? rec : null
  }

  const shim = {
    /** 我们自己的：宿主语言，game.js 里被改写成 `gp.__locale` */
    __locale: locale,
    player: {
      ready: Promise.resolve({ user: null }),
      requestLogin() {},
      saves: {
        /** ★ 必须是同步值 —— 原版在模块顶层读它 */
        latestSync: typeof latest === 'string' ? latest : null,
        async putLatest(str) {
          if (typeof str !== 'string') return false
          queueSave(str)
          return true
        },
        async list() {
          const rec = await slotRecord()
          return rec ? [{ id: SLOT_ID, kind: 'manual', name: SLOT_ID, head: rec.head, at: rec.head?.at }] : []
        },
        async get(id) {
          const rec = await slotRecord()
          if (!rec || id !== SLOT_ID) return null
          return { id: SLOT_ID, kind: 'manual', name: SLOT_ID, data: rec }
        },
        async create(data, name) {
          if (await slotRecord()) return false
          await storage.set(SLOT_KEY, data)
          return { id: SLOT_ID, name }
        },
        async update(id, data, name) {
          if (id !== SLOT_ID) return false
          await storage.set(SLOT_KEY, data)
          return { id: SLOT_ID, name }
        },
      },
      achievements,
    },
    /** 没有分享面板 —— 结算页那个「分享」按钮因此不出现（`share?.available` 判据） */
    share: { available: false, async image() {}, async snap() { return null } },
    /** 字体：原版缺省会去 `static.makeplay.ai` 拉 2 MB，这里给空串让它走系统字体 */
    fonts: { url: () => '' },
    /* 故意不给 `pay`：内购整块摘掉，见文件头 */
  }

  window.gp = shim

  return {
    /**
     * 卸载：先把没写完的存档落地，再把 `window.gp` 还原。
     *
     * ★ 顺序不能反。孩子点了「退出游戏」立刻走人时，最后一笔落子还在
     * 300 ms 的去抖窗口里 —— 先还原再 flush 也写得出去（闭包还在），
     * 但先 flush 更不容易被后面的清理打乱。
     */
    remove() {
      flushSave()
      if (window.gp === shim) window.gp = prev
    },
    /** 立刻落盘（探针 / 截图脚本想在关页前读存档时用） */
    flush: flushSave,
  }
}
