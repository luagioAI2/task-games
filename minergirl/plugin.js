/**
 * 挖矿少女 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * 原站是 MakePlay 上的《深渊矿业公司 / Abyss Mining Co.》（`saveKey: abyss-mine:v2`），
 * 一款 PixiJS 的放置挖矿经营：矿道 → 矿工 → 电梯 → 仓库 → 卖矿 → 升级 / 开新矿道
 * → 雇管理员自动化 → 重开矿场（prestige）换投资人。
 *
 * ## 这个文件只管「外壳」
 *
 * 游戏本体是 `src/main.js` 的 `start(opts)`。独立网页（`game.js`）和这里调的是
 * **同一个函数**，差别全部通过 `opts` 注入 —— 所以 `main.js` 里没有任何
 * `if (isPlugin)` 分支（那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `game.js` | 本文件 |
 * | --- | --- | --- |
 * | 资源 | `./` + 相对路径 | `ctx.assetUrl()` |
 * | 存档 | `localStorage` | `host.storage` → `makeHostStore()` |
 * | 容器 | `document.body` | `mount(container)` 给的那个 |
 * | 振动 | `navigator.vibrate` | `host.haptic` |
 * | 收费 | 不传（不收费） | 进来之前扣一次 |
 *
 * ## 经济：B 型 —— 只花积分，不产出
 *
 * ```
 *   积分 ──进场 15──▶ 玩（现金 / 矿道 / 管理员 / 皮肤全在游戏存档里）
 * ```
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长调整） |
 * | 💵 现金 | **游戏自己的存档** | 卖矿挣的，和宿主账本无关 |
 *
 * 三条设计判断：
 *
 * 1. **不发兑换券**（`expectedPayout: 0`，`voucherPerCoin` 不写）。
 *    这游戏没有「攒够 N 个换什么」的出口；硬加一条产出线等于凭空造一个经济，
 *    而且它一局能挣到 $1e12 —— 折算成券会把 App 的券直接打穿。
 * 2. **没有宿主游戏币**（不调 `mintGameCoin` / `spendGameCoin`）。
 *    现金是存档里的一个数字，不是宿主账本 —— 和蚂蚁搬家的 💰 同理。
 * 3. **原版的内购整个拆掉了**：皮肤商店（`gp.pay`，8 平台币一套）、用硬币招募投资人、
 *    启动补发 `deliverPending()`。宿主没有任何通道能让插件发起支付，留着只会是
 *    点了必然失败的按钮。**替代方案**：
 *      · 皮肤 → **按累计收入解锁**（14 套，$1K → $3T 的阶梯，见 `src/data/skins.js`）
 *      · 投资人 → 只保留免费那条路（累计收入够了就重开矿场）
 *    同理删掉的还有**全服排行榜 + 登录云同步**（要联网，插件里只会转圈）。
 *
 * ## 收费点为什么在「进场」，而且有 10 分钟宽限
 *
 * 这是款**放置**游戏，没有「开始一局」这个动作：进来就是接着挖。所以「一局」只能
 * 定义成「一次进场」。但孩子切到任务页做个任务再切回来，不该再收一次 ——
 * 所以 `paidAt` 记在**存档**里，10 分钟内回来不重复收。
 *
 * ⚠️ `paidAt` 必须写存档、不能写内存变量：切走 = 卸载，内存就没了，
 *    而「切走再回来」恰好是一次卸载 + 一次挂载 ⇒ 宽限会静默失效（每次都扣）。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（本作没用到，但和另外七款对齐）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import { start } from './src/main.js'
import { makeHostStore } from './src/host.js'
// ⚠️ 生成物：`scripts/build-plugin.mjs` 从 `styles.css` 生成，别手改。
//    内联进包是为了少一次网络请求，也让样式受 bundle 的 sha256 保护。
import CSS_TEXT from './src/styles-inline.js'

/** 一次进场的票价（积分）。 */
const PLAY_COST = 15

/** 付过之后多久内再进来不重复收（毫秒）。 */
const GRACE_MS = 10 * 60 * 1000

export const manifest = {
  id: 'minergirl',
  name: '挖矿少女',
  emoji: '⛏️',
  // 底栏格子约 5 个字宽（2026-10-26 起从 3 放宽）。「挖矿」两个字最稳，也不会和商城名对不上。
  tabLabel: '挖矿',
  // 1.0.1：加载页第四版（去掉「深渊矿业公司」小字 + 整体从暗改暖 + 平板裁切修复）。
  // ⚠️ 改了包就必须升这里 —— 宿主只比 `installed.version === g.version` 判断要不要更新，
  //    不升的话界面说「已是最新」，用户装到的还是旧画面，而且零报错。
  version: '1.0.1',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主把 `coin` 当**必填**（`describeManifestProblem` 会拒），但本作
  //    **不发行宿主游戏币** —— `mintGameCoin` / `spendGameCoin` 一次都没调。
  //    游戏里那个 `$` 现金是存档里的一个数字，不是宿主账本。
  //    ★ 不能用 🪙 / 🎟️ / 💎 / 🕹️（宿主已占），也别和蚂蚁搬家的 💰 撞。
  coin: {
    id: 'mng-cash',
    name: '现金',
    emoji: '💵',
  },

  economy: {
    /** 一次进场的积分成本 */
    playCost: PLAY_COST,
    /** 不产出任何宿主资源。见文件头第 1 条。 */
    expectedPayout: 0,
    /** 本作没有「单件产出」，占位为 1（闸门要求 ≥ 1） */
    capPerPrize: 1,
    // `voucherPerCoin` 故意不写 = 不开放「币 → 券」兑换。
  },

  /** 完全不产出宿主资源 ⇒ 说明文案不能写「花积分换币」。 */
  kind: 'chill',
}

/** 积分不够时摆在容器里的一块提示（不依赖游戏样式，纯 inline）。 */
function denyScreen(container, title, detail) {
  const box = document.createElement('div')
  box.dataset.mngDeny = ''
  box.style.cssText =
    'position:absolute;inset:0;display:grid;place-items:center;padding:24px;' +
    'background:#0b0d12;color:#f6e7c8;font:600 15px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif;text-align:center'
  box.innerHTML =
    `<div><div style="font-size:44px;line-height:1">⛏️</div>` +
    `<p style="margin:14px 0 6px;font-size:18px;font-weight:800">${title}</p>` +
    `<p style="margin:0;opacity:.75">${detail}</p></div>`
  container.appendChild(box)
  return box
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
  // 容器必须是定位上下文：游戏根 `#mng-root` 是 `position:absolute; inset:0`。
  //
  // ★★ 判据用 **computed style**，不能用 inline style：
  //    宿主给的是 `<div class="absolute inset-0">`，`position:absolute` 写在**类**里，
  //    `container.style.position` 读出来是空字符串。按 inline 判断会误以为「没定位」
  //    ⇒ 补 `relative`，而 inline **胜过**类 ⇒ 盒子退回内容高度，
  //    平板下游戏只占上半屏，而「canvas 高度 == 容器高度」的断言照样绿。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prev = {
    position: container.style.position,
    overflow: container.style.overflow,
    touchAction: container.style.touchAction,
    userSelect: container.style.userSelect,
  }
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'
  container.style.touchAction = 'none'
  container.style.userSelect = 'none'

  const restore = () => {
    if (patchedPos) container.style.position = prev.position
    container.style.overflow = prev.overflow
    container.style.touchAction = prev.touchAction
    container.style.userSelect = prev.userSelect
  }

  // ---- 资源 ----
  // 清单里的路径是**相对包目录**的（`assets/sprites/…` / `sound.pack` / `styles.css`），
  // 所以直接交给 `assetUrl()` 拼。★ 不要自己拼 `assetBase` —— 契约说得很明确。
  const assetUrl =
    typeof ctx.assetUrl === 'function'
      ? (rel) => ctx.assetUrl(rel)
      : (rel) => String(ctx.assetBase || '') + rel

  // ---- 存档 ----
  // ★ 必须 **await 完** 再 start()：`start()` 里「读存档决定初始状态」的那几句
  //   （世界 / 语言 / 上次在线）读的是这份缓存。不 await 的话读到的永远是空 Map，
  //   症状是「进度从来没被恢复过」，而且**不报错**。
  const store = makeHostStore(host.storage)
  try {
    await store.preload()
  } catch (e) {
    console.warn('[minergirl] 读存档失败，按新档开始', e)
  }

  // ---- 进场收费（10 分钟宽限，见文件头）----
  const last = Number(store.get('paidAt')) || 0
  if (Date.now() - last >= GRACE_MS) {
    const deny = (title, detail) => {
      host.pushToast?.({ kind: 'warn', title, detail })
      return false
    }
    let ok = false
    try {
      // 先看余额只是为了省一次事务 + 更快的反馈；**真正的守卫在 spendPoints 里**
      // （读余额和扣款在同一个事务）。
      if (typeof host.balance === 'function' && host.balance() < PLAY_COST) {
        ok = deny('积分不够啦', `进矿场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      } else {
        ok = await host.spendPoints(PLAY_COST, '挖矿少女 · 进场')
        if (!ok) deny('积分不够啦', `进矿场要 ${PLAY_COST} 积分 —— 去做个任务攒一点吧`)
      }
    } catch (e) {
      // 扣款失败不能放行（否则就是白玩），但也不该让整块界面崩掉
      console.error('[minergirl] 进场扣分失败', e)
      deny('扣分失败', '稍后再试一次')
    }
    if (!ok) {
      // 不进游戏：容器里摆一块说明，返回的 unmount 只把它摘掉。
      // 不抛异常 —— 抛了宿主会当成「插件坏了」，而这里其实是正常的余额不足。
      const box = denyScreen(container, '积分不够啦', `进矿场要 ${PLAY_COST} 积分，去做个任务攒一点吧`)
      return async function unmountDenied() {
        try { box.remove() } catch { /* 忽略 */ }
        restore()
      }
    }
    store.set('paidAt', Date.now())
    host.tone?.('coin')
  }

  let destroyGame = null
  try {
    destroyGame = await start({
      mountTo: container,
      assetUrl,
      cssText: CSS_TEXT,
      store,
      haptic: (p) => { try { host.haptic?.(p) } catch { /* 无马达 */ } },
      locale: ctx.locale || null,
      // 宿主里语言是 App 定的；`safeArea: false` 因为顶栏/底栏已经让过位了
      safeArea: false,
      onReady() {
        host.pushToast?.({
          kind: 'info',
          title: '挖矿少女',
          detail: '点矿道挖矿，攒够钱开新矿道；皮肤按累计收入解锁',
        })
      },
    })
  } catch (e) {
    console.error('[minergirl] mount 失败', e)
    restore()
    throw e
  }

  return async function unmount() {
    try {
      await destroyGame?.()
    } catch (e) {
      console.warn('[minergirl] 卸载出错', e)
    }
    // 存档最后落盘：`store` 是内存缓存 + 延迟写，这里不 flush 就丢进度
    try {
      await store.flush()
    } catch (e) {
      console.warn('[minergirl] 存档落盘失败', e)
    }
    restore()
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
