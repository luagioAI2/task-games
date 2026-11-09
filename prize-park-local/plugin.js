/**
 * plugin.js —— 宿主的 v2 插件入口（kid-quest-farm-2d 的 `GameBundle` 契约）。
 *
 * 宿主的加载方式：把这一整份包 `import()` 进来（blob: URL），
 * 读 `manifest` 校验，然后调 `mount(container, host)` 拿 unmount。
 *
 * 因为是 blob: URL，**不能有任何相对路径的 import**，也不能有裸模块说明符
 * —— 所以必须先用 `scripts/build-plugin.mjs` 打成单文件（three / rapier / sound 全部内联）。
 * 资源（assets / sound.pack）不打进去，走 `assetBase` 前缀，本地和 CDN 都能用。
 */

import { createGame } from './game.js'
import { loadSaveFromHost } from './gp-bridge.js'
import { loadWalletFromHost, COIN, PLAY_COST, MAX_BUY, VOUCHER_PER_COIN } from './wallet.js'
import { MAX_RECYCLE } from './recycle.js'
import { comboMaxPerPrize } from './combos.js'

/**
 * 清单。宿主的 `loader.ts` 会逐字段校验形状，形状不对直接当加载失败（不猜不兜底）。
 *
 * ## `economy` 的三个数不是随便填的
 *
 * 宿主的硬不变量是 **expectedPayout < playCost**（spec §5.4）：
 * 一局期望产出 ≥ 一局成本，就是印钞机。宿主内置娃娃机
 * `domain/clawEconomy.ts` 钉的是 `E ≤ 0.8`（留 20% 边际），这里跟着它。
 *
 * 实际算账（见 `recycle.js` 头注释）：
 *   平均回收价 ≈ 2.4 币（3 星机台单独看是 5 币）
 *   ⇒ 保本抓取率 = 1 / 2.4 ≈ 41%（只玩 3 星机台时是 20%）
 * 实际抓取率远低于这个数，所以 0.6 是**保守申报**，不是乐观估计。
 *
 * ⚠️ `capPerPrize` 必须 ≥ `recycle.js` 的 `MAX_RECYCLE`，否则玩家会遇到
 * 「价目表写着 5 币、结算只给 3 币」——而且不报错。
 *
 * ⚠️ `coin.emoji` **不能**用 🪙 / 🎟️ / 💎（那是积分 / 兑换券 / 钻石），
 * 也不能用 🕹️（内置娃娃机已经占了）。四个币会同屏出现在钱包行里，
 * 图标重了就看不出在扣哪一个 —— `currency.ts` 记过这次事故。
 */
export const manifest = {
  id: 'prizepark',
  name: '抓奖乐园',
  /*
   * ★ 图标用 🎁 而不是 🧸：🧸 是它的**币**（`wallet.js` 的 COIN.emoji），
   * 导航格和钱包行会同屏，两个都画 🧸 就分不清哪个是游戏、哪个是钱。
   */
  emoji: '🎁',
  /*
   * ★ 不能叫「娃娃机」也不能叫「抓娃娃」：那是 `claw3d` 的名字（同市场里另一款），
   * 两格同名时家长分不清在调哪个、扣哪个的币。
   * 「抓奖乐园」4 字进不了导航格（上限 3 字），所以格上用「抓奖」。
   */
  tabLabel: '抓奖',
  version: '1.6.2',
  /*
   * 4 = 宿主有 `mintVoucher`（娃娃 → 兑换券，不经过币）。
   * 3 的宿主上 `host.mintVoucher` 是 undefined → TypeError，
   * 症状是「卖娃娃点了没反应」——所以宁可让老宿主直接拒绝加载。
   */
  minHostApi: 4,
  coin: { id: 'prizepark', name: COIN.name, emoji: COIN.emoji },
  economy: {
    playCost: PLAY_COST,   // 一局 1 娃娃机币
    /*
     * 一局期望产出 **0.75 张兑换券**（< playCost）。
     *
     * 2026-10-23 起娃娃直接发券、不再产币，所以这个数就是「一局能刷出多少券」。
     * 0.6 是**基础**（按稀有度 1 / 2 / 5 的回收价算），组合加成会把它整体抬高：
     * 每个娃娃最终都会被卖掉，所以
     *     实际期望 = 基础 0.6 × (1 + 最高加成率 25%) = 0.75
     * 宿主按 `expectedPayout ≤ 0.8 × playCost` 和 `× voucherPerCoin < playCost` 双把关。
     * **加新组合之前先回 `combos.js` 重算这一格**，别凭感觉写。
     */
    expectedPayout: 0.75,
    /*
     * 单件最高能换多少券 —— 组合会让单件折合价**高于**单个回收价
     * （`legend2`：2 件共 12 张 ⇒ 每件 6），所以不能再用 `MAX_RECYCLE`（5）。
     * 用 `comboMaxPerPrize()` 算出来，加了组合自动跟上；写死的话
     * 家长看到的「单件最高」会比实际能拿到的少。
     */
    capPerPrize: Math.max(MAX_RECYCLE, comboMaxPerPrize()),
    /*
     * 1 个币 = 1 张兑换券。和内置娃娃机同口径（那边 1 币 ≡ 1 券）。
     *
     * 宿主会验 `expectedPayout × voucherPerCoin < playCost`：
     *   0.6 × 1 = 0.6 < 1 ✓（一局期望换出 0.6 张券，成本 1 积分）
     * 这条是「坐着玩能不能刷积分」的防线，**别调大**。
     */
    voucherPerCoin: VOUCHER_PER_COIN,
  },
}

/** 打包脚本会核对这两个数 —— 写成常量而不是字面量，就是为了让它们只有一个来源 */
export const ECONOMY_CHECK = { maxBuy: MAX_BUY, playCost: PLAY_COST }

/**
 * 挂载。返回 unmount —— 宿主切页时会调它。
 *
 * ## 返回值可以是 Promise（HOST_API 3 起）
 *
 * 这个游戏必须 `await createGame(...)`（纹理、物理 wasm 都要等），
 * 所以 `mount` 是 async 的。旧契约要求同步返回卸载函数，宿主拿到 Promise
 * 就当成「没有卸载函数」—— `destroy()` 永远不跑，WebGL context 和 4 个
 * setInterval 全留着。现在宿主 `mountBundle` 会 await，所以这是合法形态。
 *
 * 代价是：**卸载函数落地之前容器是空的**。孩子秒切 tab 时宿主会在
 * Promise 落地的同一拍调 unmount，所以 `destroy()` 必须能在「刚建好」时安全执行。
 *
 * 顺序不能换：
 *   1. 先读存档（宿主 storage 是异步的，而游戏求值时**同步**就要读 latestSync）
 *   2. 再读币/积分余额（同理，`refreshTexts` 在 boot 段同步读 `wallet.coins`）
 *   3. 再造一个干净的根节点塞进容器（游戏会往里 insertAdjacentHTML）
 *   4. 最后才 createGame
 *
 * @param {HTMLElement} container 宿主给的容器（宽度由宿主管，插件只管往里画）
 * @param {object} host 宿主的 HostApi
 * @param {{assetBase?:string, assetUrl?:(r:string)=>string, locale?:string}} [ctx]
 *        宿主给的挂载上下文。**资源路径只能从这里拿** —— 插件在 blob: 模块里跑，
 *        相对路径会以 blob: 为基准解析，必然 404。
 */
export async function mount(container, host, ctx = {}) {
  if (!container) throw new Error('mount: 需要一个容器元素')
  if (!host) throw new Error('mount: 需要 host API')

  /*
   * 资源根：优先用 `assetUrl()`（宿主负责处理 blob/file/CDN 的差别）；
   * 没有就退回 `assetBase` 前缀。
   *
   * ⚠️ 两个都没有时**不要**以为「相对路径能work」—— 会以 blob: 为基准，
   * 全 404，而报错是一堆 "could not load texture"，看着像打包坏了。
   */
  const assetBase = typeof ctx.assetUrl === 'function' ? '' : (ctx.assetBase ?? '')
  const resolveAsset = (rel) =>
    typeof ctx.assetUrl === 'function' ? ctx.assetUrl(rel) : assetBase + String(rel).replace(/^\.\//, '')

  const save = await loadSaveFromHost(host)
  const wallet = await loadWalletFromHost(host, save)

  const root = document.createElement('div')
  root.className = 'pp-root'
  root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden'
  container.replaceChildren(root)

  let game
  try {
    game = await createGame({
      container: root,
      host,
      save,
      wallet,
      assetBase,
      resolveAsset,
      // 汇率是**展示用**：真正发多少券由宿主按 manifest 算（插件传不进去）。
      voucherPerCoin: VOUCHER_PER_COIN,
    })
  } catch (e) {
    // 起不来就把容器还原干净，别给宿主留半截 DOM
    try { container.replaceChildren() } catch { /* */ }
    throw e
  }

  let done = false
  return async function unmount() {
    if (done) return
    done = true
    try { await game.destroy() } finally {
      try { container.replaceChildren() } catch { /* */ }
    }
  }
}
