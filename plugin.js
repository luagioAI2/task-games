/**
 * 旋转灯泡 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game.js` 的 `start(opts)`。独立网页（`index.html`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入（见 `game.js` 顶部那张表）。
 *
 * ## 经济：C 型 —— 纯玩，不产出
 *
 * ```
 *   积分 ──进一关 10 分──▶ 一关（把灯泡全点亮）──▶ 星星（游戏存档里，换不成任何东西）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💡 提示 | **游戏自己的存档** | 开局 3 次；首次通关 +1，上限 9 |
 * | ⭐ 星星 | **游戏自己的存档** | 玩出来的（按步数给 1~3 颗），跟 App 的账本无关 |
 *
 * 三条判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`）。星星是「三星/关」的评级，
 *    硬接一条产出线会把它变成刷分工具（挑最简单的关反复刷）。
 * 2. **没有游戏币**。一关一次扣款，中间再加一层「积分 → 币 → 门票」只会多一次点击。
 * 3. **收费点在「进一关」**：关卡盘点格子、「下一关」都收；同一关点「再玩一次」不收
 *    （这一关在本局已经买过）。挂载本身一分不扣 —— 所以不需要 corgi/anthill 那套
 *    `paidAt` + 10 分钟宽限。
 *
 * ## 原版里删掉的东西（见 `scripts/_strip.py`）
 *
 * - **提示内购**：`window.gp.pay.purchase` 卖「5 次提示 = 1 平台金币」。
 *   宿主没有支付能力，孩子也没有平台币。提示本身保留（纯游戏内资源）。
 * - **在线排行榜**：`window.gp.player.topScores` + 头像 + 登录。
 *   要账号、要服务端，宿主两样都没有；留着就是一个「点了必然失败」的按钮。
 *   结算面板那一行改成「总星星 n」。
 * - **`window.__gpReady` / `window.__gpPlayable`**：平台就绪标记，宿主不看，
 *   留着反而会让第二次挂载的「已就绪」判据立刻为真。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用，但和其余几款对齐）。 */
const NEED_HOST_API = 4

/** 进一关的票价（积分）。 */
const PLAY_COST = 10

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

export const manifest = {
  id: 'sweetspin',
  name: '旋转灯泡',
  emoji: '💡',
  // 底栏一格约 5 个字宽；「旋转灯泡」4 个字，和「农场」「抓娃娃」「尖叫鸡」不撞。
  tabLabel: '旋转灯泡',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作不发行游戏币 ——
  // `mintGameCoin` / `spendGameCoin` 一次都没调，币余额恒为 0。
  // 这个名字只出现在设置页那句「期望产出 0」里。
  coin: {
    id: 'sweetspin-bulb',
    name: '灯泡',
    emoji: '💡',
  },

  economy: {
    /** 进一关的积分成本 */
    playCost: PLAY_COST,
    /** 一关打完**不发任何券**。见文件头第 1 条。 */
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
  // 容器必须是定位上下文：游戏按容器尺寸排版，canvas 铺满它。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ 盒子退回内容高度（平板实测 966 → 600），
  //    底部多一条空白带，而所有「canvas 高度 == 容器高度」的断言照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  const prevOverflow = container.style.overflow
  const prevTouch = container.style.touchAction
  const prevSelect = container.style.userSelect
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  // 点格子是核心操作：不禁掉浏览器手势的话，拖动会被当成滚动页面
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  // ---- 样式作用域 ----
  // 独立网页的 `html,body,#app{...}` 在插件形态下**不能**注入（那会改宿主的页面）。
  // 这里只补一条真正需要的：canvas 默认是 inline，底部会多出几像素基线间隙。
  const scope = 'sweetspin-' + Math.random().toString(36).slice(2, 8)
  container.classList.add(scope)
  const styleEl = document.createElement('style')
  styleEl.textContent = `.${scope} canvas{display:block}`
  document.head.appendChild(styleEl)

  // ---- 资源 ----
  const assetUrl =
    typeof ctx.assetUrl === 'function' ? (rel) => ctx.assetUrl(rel) : (rel) => String(ctx.assetBase || '') + rel

  // ---- 存档 ----
  // ★ 必须 **await 完** 再 start()：`start()` 里「读存档决定初始状态」的那几句
  //   跑在注入之后，但它们读的是这份缓存。不 await 的话读到的永远是空 Map，
  //   症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[sweetspin] 读存档失败，按新档开始', e)
  }

  // ---- 进关收费 ----
  const chargePlay = async () => {
    // 先看余额只是为了省一次事务 + 给出更快的反馈；
    // **真正的守卫在 spendPoints 里**（读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `进一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
      const ok = await host.spendPoints(PLAY_COST, '旋转灯泡 · 进关')
      if (!ok) {
        host.pushToast?.({
          kind: 'warn',
          title: '积分不够啦',
          detail: `进一关要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`,
        })
        return false
      }
    } catch (e) {
      // 扣款失败不能放行（否则就是「白玩」），但也不该让整局崩掉
      console.error('[sweetspin] 进关扣分失败', e)
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
      asset: assetUrl,
      assetBase: typeof ctx.assetBase === 'string' ? ctx.assetBase : '',
      store,
      chargePlay,
      locale: ctx.locale,
    })
  } catch (e) {
    // 挂载失败也要把容器还原，否则宿主看到的是一块被改过的空白
    console.error('[sweetspin] mount 失败', e)
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
      console.warn('[sweetspin] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[sweetspin] 存档落盘失败', e)
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
