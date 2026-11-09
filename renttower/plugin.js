/**
 * 收租公寓 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * 原版是 MakePlay 上的日式公寓经营「値上げで満室」：接手一栋老公寓 →
 * 装修房间提高租金 → 招租客 → 加盖楼层 → 便利店 / 空中休息区 / 第二栋。
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `game/main.js` 的 `start(opts)`。独立网页（`index.html`）和这里
 * 调的是**同一个函数**，差别全部通过 `opts` 注入 —— 所以 `game/` 里没有
 * `if (isPlugin)` 的玩法分支（那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `index.html` | 本文件 |
 * | --- | --- | --- |
 * | 容器 | `#app` | `mount(container)` 给的那个 |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl('')` → `setAssetRoot()` |
 * | 音频 | `./sound.manifest.json` | 包根的 `sound.manifest.json` + `baseUrl` |
 * | 存档 | localStorage | `host.storage` → `makeHostStore()` |
 * | 收费 | 不传（不收费） | `chargePlay()` |
 *
 * ## 经济：C 型 / `chill` —— 纯玩，一分产出都没有
 *
 * ```
 *   积分 ──进场门票──▶ 盖楼 / 装修 / 招租 / 便利店小游戏（租金只活在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💴 租金 | **游戏自己的存档** | 房间租金 × 入住人数，跟宿主账本无关 |
 *
 * 三条判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`，`voucherPerCoin` 不写）。
 *    租金是指数增长的经营数字，硬接一条「租金 → 券」的产出线等于凭空造一个经济，
 *    而且它涨得比票价快得多。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。`coin` 只是占位。
 * 3. **原版要拆的东西有两块**（比尖叫鸡重、比云边小农场轻）：
 *    ① 内购商城（`gp.pay`，7 个商品，其中「お金無限」是作弊）；
 *    ② 在线排行榜（`gp.player` 提交分数 / 好友榜 / 资料页 / 在线状态）。
 *    租客简介走 `gp.ai`，但原版就有 `fallbackProfile()` 兜底 —— 插件里
 *    `window.gp` 不存在 ⇒ 直接走本地名字池，**不用改**。
 *
 * ## 收费点为什么在「进场」，而且有 10 分钟宽限
 *
 * 这是**放置经营**：没有「开始一局」这个动作，进来就是接着玩。
 * 所以「一局」只能定义成「一次进场」。但孩子切去做个任务再切回来不该再收一次
 * —— 所以 `paidAt` 记在**存档**里，10 分钟内回来不重复收。
 *
 * ★ `paidAt` 必须写存档、不能写内存变量：切走 = 卸载，内存当场没了，
 *   宽限期会**静默失效**（不报错，只是每次都扣）。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外十四款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './game.js'
import { makeHostStore } from './src/host.js'

/** 一次进场的票价（积分）。 */
const PLAY_COST = 10

/** 付过之后多久内再进来不重复收（毫秒）。 */
const GRACE_MS = 10 * 60 * 1000

/** 存档里记「上次付钱」的那个键。 */
const PAID_KEY = 'paidAt'

export const manifest = {
  id: 'renttower',
  name: '收租公寓',
  emoji: '🏢',
  // 底栏一格约 5 个字宽；「收租公寓」4 个字，和「农场」「抓娃娃」「尖叫鸡」不撞。
  tabLabel: '收租公寓',
  version: '1.0.0',
  minHostApi: NEED_HOST_API,

  // 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作不发行游戏币 ——
  // `mintGameCoin` / `spendGameCoin` 一次都没调，币余额恒为 0。
  // 这个名字只出现在设置页那句「期望产出 0」里。
  // ★ emoji 不能用 🪙 / 🎟️ / 💎 / 🕹️（宿主已占，`check-plugin` 的 TAKEN 表会拒）。
  coin: {
    id: 'renttower-yen',
    name: '租金',
    emoji: '💴',
  },

  economy: {
    /** 一次进场的积分成本 */
    playCost: PLAY_COST,
    /** 进场**不发任何券**。见文件头第 1 条。 */
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
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ `inset-0` 的 bottom 失效，
  //    盒子退回内容高度（平板实测 966 → 600），而「canvas 高度 == 容器高度」照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  const prevOverflow = container.style.overflow
  const prevTouch = container.style.touchAction
  const prevSelect = container.style.userSelect
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  // 拖动是核心操作（上下滚动整栋楼）：不禁掉浏览器手势的话会被当成滚页面
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  // ---- 样式 ----
  // 独立网页的 `html,body,#app{...}` 在插件形态下**不能**注入（那会改宿主的页面）。
  // 这里只补一条真正需要的：canvas 默认是 inline，底部会多出几像素基线间隙。
  const scope = 'renttower-' + Math.random().toString(36).slice(2, 8)
  container.classList.add(scope)
  const styleEl = document.createElement('style')
  styleEl.textContent = `.${scope} canvas{display:block}`
  document.head.appendChild(styleEl)

  // ---- 资源 ----
  // `ctx.assetUrl('')` 恰好返回带尾斜杠的**包根**：图片在 `assets/` 下、
  // 音频清单在包根，两者都从这一个根拼出来（见 src/asset.js）。
  const assetBase =
    typeof ctx.assetUrl === 'function'
      ? ctx.assetUrl('')
      : typeof ctx.assetBase === 'string'
        ? ctx.assetBase
        : ''

  // ---- 存档 ----
  // ★ 必须 **await 完 preload** 再 start()：`start()` 里「读存档决定初始状态」
  //   那几句读的就是这份缓存。不 await 的话读到的永远是空 Map，
  //   症状是「进度从来没被恢复过」且不报错。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[renttower] 读存档失败，按新档开始', e)
  }

  // ---- 进场收费（10 分钟宽限，见文件头）----
  const chargePlay = async () => {
    const last = Number(store.getItem(PAID_KEY)) || 0
    if (Date.now() - last < GRACE_MS) return true

    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
    // （读余额和扣款在同一个事务）。
    try {
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        return deny('积分不够啦', `进场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
      const ok = await host.spendPoints(PLAY_COST, '收租公寓 · 进场')
      if (!ok) return deny('积分不够啦', `进场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[renttower] 进场扣分失败', e)
      return deny('扣分失败', '稍后再试一次')
    }
    store.setItem(PAID_KEY, String(Date.now()))
    host.tone?.('coin')
    return true
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      mountTo: container,
      assetBase,
      store,
      chargePlay,
      locale: ctx.locale,
    })
  } catch (e) {
    // 挂载失败也要把容器还原，否则宿主看到的是一块被改过的空白
    console.error('[renttower] mount 失败', e)
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
      await destroyGame?.()
    } catch (e) {
      console.warn('[renttower] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[renttower] 存档落盘失败', e)
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
