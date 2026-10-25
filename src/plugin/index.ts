/**
 * 抓娃娃 · 宿主插件入口（kid-quest-farm-2d 的 `GameBundle` 契约 v4）。
 *
 * 宿主怎么用它：把这一整份包 `import()` 进来（`blob:` URL），读 `manifest`
 * 校验形状与经济闸门，然后 `mount(container, host, ctx)` 拿卸载函数。
 *
 * ## 因为是 `blob:` 模块，有三条硬约束
 *
 *   1. **不能有相对路径的 import** —— 会被解析成 `blob:…/./x.ts`，必然 404；
 *   2. **不能有裸说明符**（`from "three"`）—— blob 里没有 import map；
 *   3. **不能有动态 import** —— 打包器会拆出第二个 chunk，宿主只拿到一个 URL。
 *
 * 所以整份包必须先打成**单文件**（`scripts/build-plugin.mjs`）：three、rapier
 * （wasm 内联成 base64）、DOM 字符串、样式字符串，全在一个 `.mjs` 里。
 *
 * ## 这个文件和独立版的区别，只有四行
 *
 * | | 独立版（`src/main.ts`） | 这里 |
 * | --- | --- | --- |
 * | 根节点 | `document.body` | 容器里的 `.claw-root` |
 * | 存档 | `localStorage` | `host.storage`（`gameKv` 表，自动带游戏 id 前缀） |
 * | 币 | 本地一个数，可免费领 | 宿主账本：积分买币、只进不出 |
 * | 奖品 | 只进背包 | `host.mintVoucher()` 当场发兑换券 |
 *
 * 游戏本体一行没改 —— 它是 `src/app.ts` 里的 `createClawApp()`。
 */

import type { GameManifestV2, HostApi, MountContext, Unmount } from '../../../../kid-quest-farm-2d/src/games/plugin.ts'
import { createClawApp, type ClawKv, type ClawWallet } from '../app.ts'
import { HTML } from './html.ts'
import { CSS_RAW } from './css.ts'
import { scopeCss } from './scope-css.ts'

/* ============================ 经济参数 ============================ */

/** 多少积分买 1 个币。和抓奖乐园、以及当年那台内置娃娃机同口径（1:1）。 */
const POINTS_PER_COIN = 1
/** 一次最多买几个（防手滑连点买空积分） */
const MAX_BUY = 20
/** 一局几个币。必须和 `economy.playCost` 一致。 */
const PLAY_COST = 1
/** 一次「换币」按钮买几个 */
const BUY_PER_TAP = 5
/** 抓到一件奖品发几张兑换券 */
const VOUCHERS_PER_PRIZE = 1

/**
 * 清单。宿主 `loader.ts` 会逐字段校验，`check-plugin.mjs` 还会验经济闸门。
 *
 * ## `economy` 这三个数不是随便填的
 *
 * 宿主的不变量是 `expectedPayout ≤ 0.8 × playCost`，且
 * `expectedPayout × voucherPerCoin < playCost`。这台机器的账是：
 *
 * ```
 *   1 积分 ──▶ 1 币 ──▶ 一局（30 秒，下爪一次）
 *                         └─ 抓住 → 1 张兑换券（≡ 1 积分）
 * ```
 *
 * 所以只要**每局最多出 1 张券**，最坏情况（100% 抓住）也就是
 * 「1 积分进、1 积分出」—— 不亏不赚，不会变成印钞机。
 *
 * 申报 0.7 是**保守估计**。有一个实测参照：`test/sim.ts` 那个
 * 「完美瞄准的机器人」（每局都把爪子精确移到目标正上方再下爪）12 局抓中 5 局
 * —— **约 42%**。真人只会更低。所以 0.7 是**申报上限**，不是预期值：
 * 家长看到的是「最多一局出 0.7 张券」，实际比这少。
 *
 * ⚠️ 将来若要加「稀有娃娃多给券」，**必须**同步改 `expectedPayout`
 *   和 `capPerPrize`，否则家长看到的账就是假的。
 *
 * ## `coin.emoji` 不能撞
 *
 * 🪙（积分）/ 🎟️（兑换券）/ 💎（钻石）/ 🕹️（当年内置那台，已移除但别再捡回来）
 * 都被占过；抓奖乐园的**币**用 🧸。四个币会同屏出现在钱包行里，图标重了
 * 就看不出在扣哪一个 —— `currency.ts` 记过这次事故。
 */
export const manifest: GameManifestV2 = {
  id: 'claw3d',
  name: '抓娃娃',
  emoji: '🧸',
  tabLabel: '抓娃娃',
  version: '1.0.1',
  /*
   * 4 = 宿主有 `mintVoucher`（抓到奖品直接发券，不经过币）。
   * 在 3 的宿主上 `host.mintVoucher` 是 undefined → TypeError，
   * 症状是「抓到了但没进账」—— 宁可让老宿主直接拒绝加载。
   */
  minHostApi: 4,
  coin: { id: 'claw3d', name: '爪爪币', emoji: '🐾' },
  economy: {
    playCost: PLAY_COST,
    expectedPayout: 0.7,
    capPerPrize: VOUCHERS_PER_PRIZE,
    voucherPerCoin: 1,
  },
}

/* ============================ 钱包 ============================ */

const clamp = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0))

/**
 * 把宿主的四扇门包成游戏要的同步语义。
 *
 * 和抓奖乐园 `wallet.js` 同一个套路，理由也一样：`refreshUI()` 在游戏里
 * 被同步调了几十次，全部改成 `await` 会牵动几十个调用点，而每一处都是
 * 一个独立的机会去写错「await 期间玩家又点了一次」。
 *
 * 所以：**挂载前读成快照**（同步语义完整保留）+ **每次变动 await 成功才改内存**
 * （守卫留在宿主的事务里，不挪到外面）。
 */
function makeWallet(host: HostApi, initial: { coins: number; points: number }): ClawWallet {
  let coins = clamp(initial.coins)
  let points = clamp(initial.points)

  /**
   * 同一时刻只允许一笔变动在飞。
   *
   * 不是为了性能，是为了正确性：`insertCoin()` 里 `await pay()` 之后才把
   * 状态改掉，中间有 1~2 帧；连点两下就会两次都通过那句 `state === 'idle'`
   * —— 付两次钱只玩一局（或者反过来）。
   */
  let busy = false

  async function serial(fn: () => Promise<boolean>): Promise<boolean> {
    if (busy) return false
    busy = true
    try { return await fn() } finally { busy = false }
  }

  /**
   * 和宿主对一次账。
   *
   * 什么时候用：宿主那边返回 false（说明我们内存里以为够、账本上不够，
   * 比如另一个标签页花掉了）。这时候**不能**相信内存，也不能自己补一笔，
   * 只能重读账本；读失败就保持原值（宁可显示旧余额，也不要显示 0 让人以为钱没了）。
   */
  async function resync() {
    try {
      const [c, p] = await Promise.all([
        host.gameCoinBalance(),
        Promise.resolve(typeof host.balance === 'function' ? host.balance() : points),
      ])
      if (typeof c === 'number' && Number.isFinite(c)) coins = clamp(c)
      if (typeof p === 'number' && Number.isFinite(p)) points = clamp(p)
    } catch (e) {
      console.warn('[claw] 钱包对账失败，保持内存余额', e)
    }
  }

  async function buy(count: number) {
    const n = clamp(count)
    if (n <= 0 || n > MAX_BUY) return false
    return serial(async () => {
      const cost = n * POINTS_PER_COIN
      if (points < cost) return false
      try {
        // ★ 走 `buyGameCoin`：扣积分和记币在**同一个事务**里。
        //   拆成 spendPoints + mintGameCoin 就是「积分扣了、币没到」，孩子白丢积分且不报错。
        const ok = await host.buyGameCoin(n, POINTS_PER_COIN, `买 ${n} 个爪爪币`)
        if (!ok) { await resync(); return false }
      } catch (e) {
        console.warn('[claw] 买币失败', e)
        await resync()
        return false
      }
      coins += n
      points -= cost
      return true
    })
  }

  return {
    get coins() { return coins },
    get points() { return points },

    async pay(cost) {
      const n = clamp(cost)
      if (n <= 0) return true
      return serial(async () => {
        if (coins < n) return false
        try {
          const ok = await host.spendGameCoin(n, '玩一局抓娃娃')
          if (!ok) { await resync(); return false }
        } catch (e) {
          console.warn('[claw] 扣币失败', e)
          await resync()
          return false
        }
        coins -= n
        return true
      })
    },

    /**
     * 抓到奖品 → **直接发兑换券**，不经过币。
     *
     * ⚠️ 绝不能写成「先 mint 币、再 redeem 成券」：那是两个事务，
     *   中间崩一下就是「币还在」，而币能开局 ⇒ 抓娃娃自己就能续玩，
     *   「坐着玩就能刷」那条回路又接回来了。
     *
     * 返回宿主**实际**发了几张（0 = 没发）—— 界面不要自己乘，
     * 插件算的和宿主发的不一致时，玩家看到的就是假数。
     */
    async award(_prizeTypeId, prizeName) {
      try {
        return await host.mintVoucher(VOUCHERS_PER_PRIZE, `抓到「${prizeName}」`)
      } catch (e) {
        console.warn('[claw] 发兑换券失败', e)
        return 0
      }
    },

    recharge: {
      label: `换 ${BUY_PER_TAP} 个币`,
      hint: `币用完啦。用积分换币：${POINTS_PER_COIN} 积分 = 1 个${manifest.coin.name}`,
      run: () => buy(BUY_PER_TAP),
    },
  }
}

/* ============================ 样式 ============================ */

/**
 * 补丁：把整页定位改回容器内定位。
 *
 * 原样式里 `#app` / `#hud` / `.modal` / `#win` / `#start` 都是
 * `position: fixed` —— 独立版那是"铺满浏览器窗口"，插件里会**盖住整个宿主**
 * （连底部 TabBar 一起），而且 `z-index` 抬多高都没用，因为它压根不在同一个
 * 层叠上下文里。
 *
 * 这几条必须**排在 scoped CSS 之后**：选择器特异度一样，靠后者胜。
 */
const PLUGIN_LAYOUT = `
.claw-root, .claw-root *, .claw-root *::before, .claw-root *::after { box-sizing: border-box; }
.claw-root #app, .claw-root #c, .claw-root #hud,
.claw-root .modal, .claw-root #win, .claw-root #start { position: absolute; }
`

/* ============================ mount ============================ */

/**
 * 挂载。**必须在容器里画完再返回** —— 卸载函数落地之前容器是空的，
 * 宿主那边看到的就是一块白（它不会画加载态）。
 *
 * @param container 宿主给的容器（尺寸由宿主管，插件只管往里画）
 * @param host      宿主的 HostApi，插件唯一能碰外面的口子
 * @param _ctx      资源根 / 语言。这台机器没有外部资源（贴图全是代码画的），用不上
 */
export async function mount(container: HTMLElement, host: HostApi, _ctx?: MountContext): Promise<Unmount> {
  if (!container) throw new Error('mount: 需要一个容器元素')
  if (!host) throw new Error('mount: 需要 host API')

  /*
   * 顺序不能换：**先读余额，再建根节点，最后 createClawApp**。
   *
   * 游戏在 `createClawApp` 里会同步读 `wallet.coins`（`refreshUI()` 在 boot 段
   * 直接调用），所以余额必须在进去之前就准备好。
   */
  let coins = 0
  let points = 0
  try { coins = await host.gameCoinBalance() } catch (e) { console.warn('[claw] 读币余额失败，按 0 开局', e) }
  try { points = typeof host.balance === 'function' ? host.balance() : 0 } catch (e) { console.warn('[claw] 读积分失败', e) }

  const wallet = makeWallet(host, { coins, points })

  /**
   * 存档。键统一加 `prefs:` 前缀 —— 宿主已经按游戏 id 分过命名空间了，
   * 这层前缀只是让 `gameKv` 里一眼看得出哪些是设置、哪些是别的。
   */
  const kv: ClawKv = {
    async get(k) {
      const v = await host.storage.get<string>('prefs:' + k)
      return typeof v === 'string' ? v : undefined
    },
    async set(k, v) {
      await host.storage.set('prefs:' + k, v)
    },
  }

  const root = document.createElement('div')
  // `intro` 是开场页状态（HUD 先藏起来）；原 `index.html` 是写在 `<body class="intro">` 上的
  root.className = 'claw-root intro'
  root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden'
  container.replaceChildren(root)

  // 样式放进 root 里：容器一被 `replaceChildren()` 清掉，样式跟着走，不会留在宿主页面上
  const style = document.createElement('style')
  style.dataset.claw3d = '1'
  style.textContent = scopeCss(CSS_RAW, '.claw-root') + PLUGIN_LAYOUT
  root.appendChild(style)

  // 开场页那句「新玩家赠送 10 币」在插件里是假的 —— 币要用积分买
  const app = await (async () => {
    try {
      return await createClawApp({
        root,
        html: HTML,
        kv,
        wallet,
        standalone: false,
        debug: true,
        patch: (r) => {
          const offer = r.querySelector('#offerTxt')
          if (offer) offer.textContent = `${PLAY_COST} 币 1 局 · 用积分换币`
        },
      })
    } catch (e) {
      // 起不来就把容器还原干净，别给宿主留半截 DOM（半截 DOM 会让下一次挂载量错尺寸）
      try { container.replaceChildren() } catch { /* 已经没了 */ }
      throw e
    }
  })()

  let done = false
  return async function unmount() {
    if (done) return
    done = true
    try {
      await app.destroy()
    } finally {
      try { container.replaceChildren() } catch { /* 已经没了 */ }
    }
  }
}
