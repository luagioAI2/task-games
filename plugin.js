/**
 * 云边小农场 · 插件入口（宿主 kid-quest-farm-2d，HOST_API 4）
 *
 * ## 这个文件和 `main.js` 的关系
 *
 * 两者都只是**外壳**，游戏本体是 `src/game.js` 的 `start()`：
 *
 * | | main.js（独立网页） | plugin.js（本文件） |
 * | --- | --- | --- |
 * | 资源 | `assets/<rel>` 相对文档 | `ctx.assetUrl(rel)` |
 * | 存档 | `localStorage` | `host.storage` |
 * | 容器 | `<div id="app">` | `mount(container)` 给的 |
 *
 * ## 经济设计：两个币种，各走各的门
 *
 * | 概念 | 落在哪 | 谁能让它变多 |
 * | --- | --- | --- |
 * | 🪙 积分 | App 的 `db.ledger` | **只有 App**（任务 / 打卡 / 家长手动调整） |
 * | 🎟️ 兑换券 | App 的 `db.harvestLedger` | 本游戏**卖出**时 `host.mintVoucher` |
 *
 * 游戏里看到的那枚 🪙 就是 App 的积分：
 *   · 买种子 / 开地 / 领动物 / 钓鱼 → `host.spendPoints()`（宿主记一笔负数）
 *   · 原版那个「＋」按钮**已删** —— 没有任何 HostApi 能往积分账本写正数
 *   · 卖出农产品 → `host.mintVoucher()`（唯一出口，和内置农场同一个口径）
 *
 * ```
 *   积分 ──买种子──▶ 长出来 ──收──▶ 卖出 ──▶ 兑换券
 * ```
 *
 * 这是个**单向**闭环：积分只出不进，券只进不出（券买不了种子）。
 * 所以「种一茬赚 1.6 倍」那种玩具口径必须重算 —— 见 `src/data/catalog.js` 顶部。
 *
 * ## 宿主闸门在哪
 *
 * `domain/pluginEconomy.ts` 验两条：
 *   · `expectedPayout ≤ 0.8 × playCost`（一局不能有正期望）
 *   · `expectedPayout × voucherPerCoin < playCost`（`voucherPerCoin = 0` ⇒ 跳过）
 *
 * 申报口径是**比率**：一局花约 10 积分，卖出约 6.7 张券（0.67）。
 * 逐项算「满产卖出 / 成本」落在 0.40~0.67（最坏是鸡 / 鱼 0.667，见 `scripts/check-economy-table.mjs`），
 * 再乘天气与虫害的期望折损（≈0.87）⇒ 实际期望约 0.4~0.55。
 * 取 6.7 是**贴着最坏那一项**申报，不是取平均 —— 按平均值申报等于漏报，漏报的那一刻闸门就失效了。
 */

/** 宿主 API 版本。4 = 有 `mintVoucher`（收成 → 兑换券，不经过币）。 */
const NEED_HOST_API = 4

// ⚠️ 必须**静态** import：插件在 `blob:` 模块里跑，动态 `import('./x.js')`
//    会以 blob: 为基准解析 ⇒ 加载不到（打包器也会因此拆出第二个文件）。
import * as gameMod from './src/game.js'
import { Store, hostBackend } from './src/store.js'

export const manifest = {
  id: 'cloudfarm',
  name: '云边小农场',
  emoji: '🌾',
  // 底栏格子只有约 3 个字宽，用「农场」（和内置的四季农场不冲突 —— 那个 id 是 farm，名字不同）
  tabLabel: '农场',
  // 1.1.1 = v59 数值补丁（两只 L6 永久神兽的 times 365 → 22 / 19）
  // 1.1.2 = v59.1 钓鱼（产出表搬进 catalog 的 FISHING；fish 2 → 4，L1~4 从 0.21 拉到 0.425）
  // 1.1.3 = 卡片文案跟着数值走（「永久存活 · ∞ 次」→「共 N 次 / 还能产 N 次」，领养卡的「最多收回」不再写 ∞）
  // 1.1.4 = 平板适配（`colWidth` 分横竖屏：横屏按「一个分区装得下」定上限，1024×768 从 46% → 65%）
  // 1.1.5 = 平板横屏适配（两侧从「模糊放大的世界」改成奶油舞台 + 底栏搬到左侧竖排，
  //         顺带关掉那层全屏 BlurFilter；`layout()` 返回 wide/gut 给世界层）
  // 1.1.6 = 1.1.5 的收尾（竖栏在留白里居中、宽度收到 112 以内；舞台暖光调淡一档）
  // 1.1.7 = 宽屏右侧也立起来：顶栏那两枚「日志 / 设置」搬到右侧留白竖排（跟左栏同宽同居中）
  // 1.1.8 = 右侧那两枚补上「日志 / 设置」两个字，跟左栏同一种长相（图标 + 两个字）
  // 1.1.9 = 撤掉「10× 加速」：`MS_PER_FARM_MIN` 6000 → 60000（1 农场分钟 = 1 现实分钟），
  //         新手引导的「小萝卜 12 秒就熟」跟着改成 2 分钟。那个 6000 是为了跑测试调的，
  //         留在正式包里等于所有作物都快 10 倍 —— 小萝卜 12 秒就熟，跟 App 自带农场（2 分钟）差一个量级
  version: '1.1.9',
  minHostApi: NEED_HOST_API,

  // ⚠️ 宿主也认这个字段（`GameManifestV2.coin` 必填），但本作**不发行游戏币** ——
  //    `mintGameCoin` / `spendGameCoin` 一次都没调。币余额会一直是 0。
  //    名字写「兑换券」是为了让设置页里那句「🌾 麦穗币」不至于骗人……但它就是
  //    一个占位声明。真要改语义得等宿主允许 `coin` 可选。
  coin: {
    id: 'cloudfarm-harvest',
    name: '麦穗',
    emoji: '🌾',
  },

  economy: {
    // 一局（种两三茬早中期作物）花掉的积分
    playCost: 10,
    // 一局卖出的券。见文件头推法：最坏一项 0.667×成本，申报 6.7（不是取平均）
    expectedPayout: 6.7,
    // 单次结算上限 = `src/economy.js` 的 MAX_VOUCHERS_PER_PAY
    capPerPrize: 2000,
    /*
     * `0` = **不开放「币 → 券」兑换**。
     *
     * 本作不发行游戏币（不调 `mintGameCoin` / `spendGameCoin`），币余额恒为 0，
     * 所以 `host.redeemGameCoin()` 永远返回 0 —— 写 1 只是给它一个「看起来能用」
     * 的汇率，实际换不出任何东西，反而让家长在设置页看到一行假的兑换说明。
     *
     * 券的唯一来源是 `mintVoucher`（卖出农产品的时候）。宿主 `pluginEconomy.ts`
     * 对 `rate === 0` 会跳过第 4 条不变量，这是它明确允许的形态。
     */
    voucherPerCoin: 0,
  },
}

/**
 * 挂载。
 *
 * ⚠️ 契约要点（宿主 `plugin.ts`）：
 *   · 返回值可以是 `Unmount` 或 `Promise<Unmount>`，宿主 `await` 它；
 *   · `unmount` **必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）；
 *   · 所有资源走 `ctx.assetUrl()` —— 相对路径在 `blob:` 模块里以 blob: 为基准 ⇒ 全 404。
 */
export async function mount(container, host, ctx = {}) {

  // 容器必须是定位上下文：游戏的 UI 层用 position:absolute 铺满容器。
  //
  // ★★ 判据必须用 **computed style**，不能用 inline style（2026-10-24 踩的）：
  //    宿主给的是 `<div class="absolute inset-0">` —— `position:absolute` 在**类**里，
  //    `container.style.position` 读出来是**空字符串**。按 inline 判断会认为
  //    「没定位」⇒ 覆盖成 `relative`，而 inline 胜不过…… 不，inline **胜过**类，
  //    于是这个盒子从「绝对定位铺满」变成「普通流里的相对定位」：
  //      · `inset-0` 的 `bottom:0` 对 relative **不生效**（只有 top 生效）
  //      · 高度退回**内容高度**（= canvas 高度）⇒ 平板上量到 966 的盒子变成 600，
  //        底部多出一条空白带，而**所有断言照样绿**（canvas 高度 == 容器高度，
  //        因为容器就是被 canvas 撑出来的）。只有看截图才发现。
  //    ⇒ 只当**计算值**是 static 时才补 relative，而且卸载时要还原成"没改过"。
  const patchedPos = getComputedStyle(container).position === 'static'
  const prevPos = container.style.position
  if (patchedPos) container.style.position = 'relative'
  container.style.overflow = 'hidden'

  // ---- 资源 ----
  // `assetUrl` 是宿主给的唯一正确拼法。它知道资源在 /games/<id>/ 还是 CDN。
  // ⚠️ 不在这里写 `globalThis.__cfAsset` —— `game.start()` 收到 `assetUrl`
  //    参数后会自己设，并在卸载时还原。两处都写会互相覆盖。
  const assetUrl = typeof ctx.assetUrl === 'function'
    ? (rel) => ctx.assetUrl(rel)
    : (rel) => String(ctx.assetBase || '') + rel
  // ⚠️ 这里**不设** `globalThis.__cfFontBase`。
  //   `src/ui.js` 里注册字体的那段是**模块求值期**的 IIFE，而 `mount()` 在模块
  //   求值之后才跑 —— 在这里赋值永远是"晚一步"，设了也白设（且 `assets/fonts/`
  //   目前根本没随包发布，`assets/` 下没有 fonts 目录）。留着它只会让人以为
  //   本地字体生效了。
  //   将来真要随包发字体：① build 脚本把 woff2 拷进 `assets/fonts/`；
  //   ② 把 ui.js 那段改成 `installUi()` 里惰性注册，URL 用 `asset("fonts/…")`
  //   （已走 `__cfAsset`，不需要这个 hook）。

  // ---- 触感 ----
  globalThis.__cfHaptic = () => { try { host.haptic?.() } catch { /* 无马达 */ } }

  // ---- 存档 ----
  const store = new Store(hostBackend(host), ctx.locale || null)

  let unmountGame = null
  let ready = false

  try {
    unmountGame = await gameMod.start({
      mountTo: container,
      store,
      host,          // ★ 经济桥用它调 host.mintVoucher（见 src/economy.js）
      haptic: () => { try { host.haptic?.() } catch { /* 无马达 */ } },
      locale: ctx.locale || null,
      assetUrl,
      onReady() {
        ready = true
        // 宿主的顶栏有余额显示；这里只在开局提示一次玩法，避免每次切 tab 都弹
        host.pushToast?.({
          kind: 'info',
          title: '云边小农场',
          detail: '用积分买种子，种出来卖成兑换券',
        })
      },
    })
  } catch (e) {
    console.error('[cloudfarm] mount 失败', e)
    throw e
  }

  // ---- 卸载 ----
  return async function unmount() {
    try { await unmountGame?.() } catch (e) { console.warn('[cloudfarm] 卸载出错', e) }
    // 只还原**我们改过的那一项**（`patchedPos`）；宿主自己的定位（哪怕是类给的）
    // 一律不碰 —— 置成 '' 会把宿主的 inline 定位擦掉。
    if (patchedPos) container.style.position = prevPos
    container.style.overflow = ''
    // 注意：不碰 `__cfFontBase`（我们从来没设过它，见上面的注释）。
    // 谁设的谁还原 —— 这里置 null 会把宿主/别的插件设的值擦掉。
  }
}

/** 默认导出 = bundle 形状（宿主两种都收：`mod.default ?? mod`）。 */
export default { manifest, mount }
