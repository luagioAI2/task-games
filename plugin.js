/**
 * 跳绳羊群 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入：
 *
 * | | `index.html` | 本文件 |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl()` |
 * | 存档 | 不传（`localStorage`） | `host.storage` → `window.__ropelandStore`（见 `src/host.js`） |
 * | 容器 | `<div id="app">` | `mount(container)` 给的那个 |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * 所以 `game.js` 里没有任何 `if (isPlugin)` 分支。
 *
 * ## 经济：B 型 —— 积分买门票，羊毛留着升级，**不产出兑换券**
 *
 * ```
 *   积分 ──每局门票──▶ 跑一局 ──▶ 羊毛（游戏币）
 *                                   │
 *                                   └──▶ 在牧场里买升级 / 外观（羊毛只出不进）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 🐑 羊毛 | 宿主账本的 `gameCoin`（`mintGameCoin`） | 在游戏里跑一局 |
 *
 * 四条设计判断：
 *
 * 1. **收费点在「开始跳绳」，不在 `mount()`**。这一作有明确的「一局」：
 *    三只铃铛掉光就结束、结算收羊毛。所以是**每局都收**，没有宽限。
 *    教程局和延迟校准局不收费（`startRun({tutorial|calib})` 里直接跳过）。
 * 2. **不发兑换券**（`voucherPerCoin: 0`）。羊毛的用处全在游戏里
 *    （升级 + 两个外观件），没有「攒够 N 个换真东西」的出口。硬开兑换
 *    等于给它加一条产出线，而且按闸门 `5 × 0.5 = 2.5 < 20` 其实过得去 ——
 *    是**产品判断**不是数学判断：这一作玩的是节奏，不是攒币。
 * 3. **申报 `expectedPayout: 5`**。原生公式是 `存活羊数 + 峰值羊数`，
 *    一局 60~120 秒、峰值 3~8，实测落点 5 左右。闸门上限 `0.8 × 20 = 16`。
 * 4. **羊毛写进宿主账本，不写游戏自己的存档**。升级的「已买等级」在游戏存档里，
 *    羊毛余额在宿主那边 —— 切走卸载不会把它弄丢（写内存变量就丢了）。
 */

/** 宿主 API 版本。本作只用到 1 的 `storage` / `spendPoints` / `mintGameCoin` / `pushToast` / `tone`。 */
const NEED_HOST_API = 1

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { installHost, uninstallHost } from './src/host.js'

/** 一局门票（积分）。一局 60~120 秒。 */
const PLAY_COST = 20

export const manifest = {
  id: 'ropeland',
  name: '跳绳羊群',
  emoji: '🐑',
  // 底栏格子约 5 个字宽。「跳绳羊」和商城名同源，又不和「农场」「抓娃娃」撞。
  tabLabel: '跳绳羊',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  coin: {
    id: 'ropeland-wool',
    name: '羊毛',
    emoji: '🐑',
  },

  economy: {
    playCost: PLAY_COST,
    /** 一局期望羊毛 = 存活羊数 + 峰值羊数，实测约 5 */
    expectedPayout: 5,
    /** 单件产出上限：一局峰值很少超过 30 */
    capPerPrize: 30,
    /** 0 = 不开放兑换。见文件头第 2 条。 */
    voucherPerCoin: 0,
  },
}

/**
 * 挂载。
 *
 * ⚠️ 契约要点（宿主 `plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主会 `await` 它；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 所有资源走 `ctx.assetUrl()` —— 相对路径在 `blob:` 模块里以 blob: 为基准 ⇒ 全 404。
 */
export async function mount(container, host, ctx = {}) {
  // 容器必须是定位上下文：游戏的 UI 层用 position:absolute 铺满容器。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ `inset-0` 的 bottom 失效，
  //    盒子退回内容高度（平板实测 966→600），而「canvas 高度 == 容器高度」照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  const prevOverflow = container.style.overflow
  const prevTouch = container.style.touchAction
  const prevSelect = container.style.userSelect
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  // 点按是核心操作：不禁掉浏览器手势的话，连点会被当成双击缩放
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  // ---- 样式作用域 ----
  // 独立网页的 `html,body,#app{...}` 在插件形态下**不能**注入（那会改宿主的页面）。
  // 这里只补一条真正需要的：canvas 是 inline 元素，底部会多出几像素基线间隙。
  const scope = 'ropeland-' + Math.random().toString(36).slice(2, 8)
  container.classList.add(scope)
  const styleEl = document.createElement('style')
  styleEl.textContent = `.${scope} canvas{display:block}`
  document.head.appendChild(styleEl)

  // ---- 资源 ----
  const assetUrl =
    typeof ctx.assetUrl === 'function'
      ? (rel) => ctx.assetUrl(rel)
      : (rel) => String(ctx.assetBase || '') + rel

  // ---- 存档 ----
  // ★ 必须 **await 完** 再 start()：`platform.js` 的 `P` 在模块顶层就读过一次
  //   （那时 store 还没装，读到的是空档）。`start()` 里要用装好的 store 重新对齐，
  //   所以这里只负责「先把缓存读进来」。
  //   不 await 的话读到的永远是空 Map，症状是「进度从来没被恢复过」且不报错。
  await installHost({ storage: host.storage })

  // ---- 门票 ----
  const chargePlay = async () => {
    // 先看余额只是为了省一次事务 + 给出更快的反馈；
    // **真正的守卫在 spendPoints 里**（读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `跳一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
      const ok = await host.spendPoints(PLAY_COST, '跳绳羊群 · 开局')
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `跳一局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
    } catch (e) {
      // 扣款失败不能放行（否则就是「白玩」），但也不该让整局崩掉
      console.error('[ropeland] 开局扣分失败', e)
      host.pushToast?.({ kind: 'warn', title: '扣分失败', detail: '稍后再试一次' })
      return false
    }
    host.tone?.('coin')
    return true
  }

  let unmountGame = null
  try {
    unmountGame = await start({
      mountTo: container,
      assetBase: typeof ctx.assetBase === 'string' ? ctx.assetBase : assetUrl(''),
      host,
      chargePlay,
    })
  } catch (e) {
    // 挂载失败也要把容器还原，否则宿主看到的是一块被改过的空白
    console.error('[ropeland] mount 失败', e)
    try { styleEl.remove() } catch { /* 已摘 */ }
    container.classList.remove(scope)
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = prevOverflow
    container.style.touchAction = prevTouch
    container.style.userSelect = prevSelect
    await uninstallHost().catch(() => {})
    throw e
  }

  return async function unmount() {
    try {
      // destroy() 里第一件事是 `alive = false`，并在最后 flush 存档
      await unmountGame?.()
    } catch (e) {
      console.warn('[ropeland] 卸载出错', e)
    }
    try { await uninstallHost() } catch (e) { console.warn('[ropeland] 存档落盘失败', e) }
    try { styleEl.remove() } catch { /* 已摘 */ }
    container.classList.remove(scope)
    // 只还原**我们改过的那几项**；宿主自己的 inline 值一律不碰
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = prevOverflow
    container.style.touchAction = prevTouch
    container.style.userSelect = prevSelect
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
