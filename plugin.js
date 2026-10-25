/**
 * 甜点魔法学院 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入：
 *
 * | | `index.html` | 本文件 |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl()` |
 * | 存档 | 不传（`localStorage`） | `host.storage` → `makeHostStore()` |
 * | 容器 | `<div id="app">` | `mount(container)` 给的那个 |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * 所以 `game.js` 里没有任何 `if (isPlugin)` 分支 —— 那种分支会随版本漂移，
 * 而且两种形态的测试永远只有一种被跑到。
 *
 * ## 经济：B 型 —— 只花积分，不产出
 *
 * ```
 *   积分 ──开局门票──▶ 一局游戏 ──▶ 什么都没有
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | ⭐ 进化经验 | **游戏自己的存档** | 玩出来的，跟 App 的账本无关 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`，`voucherPerCoin` 不写）。
 *    这游戏原本就没有商城 / 内购 / 看广告，也没有「攒够 N 个换什么」的出口，
 *    硬塞一个「玩完发券」等于凭空给它加一条产出线。
 * 2. **没有游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    消除类游戏加一层「积分 → 币 → 开局」只会多一次点击，
 *    而且币只进不出的话余额会越堆越多，看着像个没做完的系统。
 * 3. **收费点在「开局」，不在「每层」**。`开始游戏` 和 `关卡选择` 进战斗时
 *    收一次；打通一层自动进下一层**不再收** —— 那是奖励，不该再拦一道。
 *
 * 于是「玩」这件事在 App 里是**纯消耗**：孩子想玩，就得先有积分；
 * 有积分就得先做任务。这正好是产品的目的，而不是让孩子泡在游戏里。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外三款对齐，免得将来加能力要重装）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

/** 一次开局的票价（积分）。 */
const PLAY_COST = 20

export const manifest = {
  id: 'sugar',
  name: '甜点魔法学院',
  emoji: '🍮',
  // 底栏格子只有约 3 个字宽。取「甜点」，和「农场」「抓娃娃」不撞。
  tabLabel: '甜点',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调，
  //    币余额恒为 0。这个名字只在设置页那句「期望产出 0 ⭐」里出现。
  //    游戏里那个真的会被攒起来的「进化经验」存在游戏自己的存档里，不是宿主账本。
  coin: {
    id: 'sugar-exp',
    name: '进化经验',
    emoji: '⭐',
  },

  economy: {
    /** 一次开局的积分成本 */
    playCost: PLAY_COST,
    /** 一局结束**不发任何券**。见文件头第 1 条。 */
    expectedPayout: 0,
    /** 本作没有「单件产出」，占位为 1（闸门要求 ≥ 1） */
    capPerPrize: 1,
    // `voucherPerCoin` 故意不写 = 不开放「币 → 券」兑换。
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
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ 盒子退回内容高度，
  //    底部多一条空白带，且所有「canvas 高度 == 容器高度」的断言照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  const prevOverflow = container.style.overflow
  const prevTouch = container.style.touchAction
  const prevSelect = container.style.userSelect
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  // 拖珠是核心操作：不禁掉浏览器手势的话，竖滑会被当成滚动页面
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  // ---- 样式作用域 ----
  // 独立网页的 `html,body,#app{...}` 在插件形态下**不能**注入（那会改宿主的页面）。
  // 这里只补一条真正需要的：canvas 默认是 inline，底部会多出几像素基线间隙。
  const scope = 'sugar-' + Math.random().toString(36).slice(2, 8)
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
  // ★ 必须 **await 完** 再 start()：`start()` 里「读存档决定初始状态」的
  //   那几句（语言 / 成长存档 / 音频偏好）跑在注入之后，但它们读的是这份缓存。
  //   不 await 的话读到的永远是空 Map，症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[sugar] 读存档失败，按新档开始', e)
  }

  // ---- 开局收费 ----
  let paid = 0
  const chargePlay = async () => {
    // 先看余额只是为了省一次事务 + 给出更快的反馈；
    // **真正的守卫在 spendPoints 里**（读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `开局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
      const ok = await host.spendPoints(PLAY_COST, '甜点魔法学院 · 开局')
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `开局要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
    } catch (e) {
      // 扣款失败不能放行（否则就是「白玩」），但也不该让整局崩掉
      console.error('[sugar] 开局扣分失败', e)
      host.pushToast?.({ kind: 'warn', title: '扣分失败', detail: '稍后再试一次' })
      return false
    }
    paid++
    host.tone?.('coin')
    return true
  }

  let unmountGame = null
  try {
    unmountGame = await start({
      mountTo: container,
      asset: assetUrl,
      store,
      chargePlay,
    })
  } catch (e) {
    // 挂载失败也要把容器还原，否则宿主看到的是一块被改过的空白
    console.error('[sugar] mount 失败', e)
    try {
      styleEl.remove()
    } catch {
      /* 已摘 */
    }
    container.classList.remove(scope)
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = prevOverflow
    container.style.touchAction = prevTouch
    container.style.userSelect = prevSelect
    throw e
  }

  return async function unmount() {
    try {
      await unmountGame?.()
    } catch (e) {
      console.warn('[sugar] 卸载出错', e)
    }
    // 存档最后落盘：`LS` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[sugar] 存档落盘失败', e)
    }
    try {
      styleEl.remove()
    } catch {
      /* 已摘 */
    }
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
