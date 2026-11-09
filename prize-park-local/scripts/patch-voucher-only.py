"""插件侧：娃娃只能换兑换券，不能变回娃娃机币。

用法：python scripts/patch-voucher-only.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
edits = []


def rep(path, old, new, note):
    edits.append((ROOT / path, old, new, note))


# ── 1. wallet.js：earn() → redeemPrize() ─────────────────────────
rep(
    "wallet.js",
    """ * ## 三扇门（和宿主 HostApi 一一对应）
 *
 * ```
 *   积分 ──buyGameCoin──▶ 娃娃机币 ──spendGameCoin──▶ 一局游玩
 *                              ▲
 *                              └──mintGameCoin── 回收娃娃
 * ```
 *
 * `mintGameCoin` 只进不出（宿主侧 `delta <= 0` 直接 return），所以
 * 「卖掉娃娃再退回去」这条路根本不存在 —— 想改币只能改回收价。
 */""",
    """ * ## 三扇门（和宿主 HostApi 一一对应）
 *
 * ```
 *   积分 ──buyGameCoin──▶ 娃娃机币 ──spendGameCoin──▶ 一局游玩
 *                              │
 *                              └──redeemGameCoin──▶ 兑换券（没用完的币）
 *
 *   娃娃 ──mintVoucher──▶ 兑换券        ← 回收娃娃，**不经过币**
 * ```
 *
 * ## ★ 币只有一个来源：买。娃娃不产币（2026-10-23 改）
 *
 * 原来是「娃娃 → 币」，于是币有了第二个来源，而币能直接开局
 * ⇒ **抓娃娃本身能续玩**，那条「坐着玩就能刷」的回路又接回来了。
 * 现在币是**入场券**（用积分买），券是**战利品**（抓来的），两者不互通。
 *
 * `mintGameCoin` 仍然保留在钱包里给「旧存档迁移」用（`loadWalletFromHost`），
 * 但**没有任何游戏内动作会调它** —— 别再把 `earn()` 加回来。
 */""",
    "wallet.js 头注释",
)

rep(
    "wallet.js",
    """    /**
     * 进账（回收娃娃）。走 `mintGameCoin` —— 宿主侧只接受正数，
     * 所以这里也**没有**「负数进账」这条路（想扣就调 `pay`）。
     */
    async earn(amount, memo = '回收娃娃') {
      const n = clamp(amount)
      if (n <= 0) return false
      return serial(async () => {
        try {
          await host.mintGameCoin(n, memo)
        } catch (e) {
          console.warn('[pp] 铸币失败', e)
          await resync()
          return false
        }
        _coins += n
        onChange()
        return true
      })
    },""",
    """    /**
     * 回收娃娃 → **直接发兑换券**（走 `host.mintVoucher`，不经过币）。
     *
     * 返回**宿主实际发出的券数**（`> 0` 才算成功）—— 不要在界面里自己乘，
     * 那样插件算的和宿主发的一不一致，玩家看到的就是假数。
     *
     * ⚠️ 这条路径**不碰 `_coins`**：娃娃不产币。币的入口只有 `buy()`。
     */
    async redeemPrize(amount, memo = '回收娃娃') {
      const n = clamp(amount)
      if (n <= 0) return 0
      let got = 0
      const ok = await serial(async () => {
        try {
          got = await host.mintVoucher(n, memo)
        } catch (e) {
          console.warn('[pp] 发兑换券失败', e)
          await resync()
          return false
        }
        return true
      })
      if (!ok) return 0
      onChange()
      return typeof got === 'number' && got > 0 ? got : 0
    },""",
    "wallet.js redeemPrize",
)

# ── 2. recycle.js：单位改成兑换券 ────────────────────────────────
rep(
    "recycle.js",
    """/**
 * recycle.js —— 回收价（卖掉娃娃能换多少个**娃娃机币**）。""",
    """/**
 * recycle.js —— 回收价（卖掉娃娃能换多少张**兑换券**）。
 *
 * ⚠️ 2026-10-23 起单位是**兑换券**，不是娃娃机币。原来「娃娃 → 币」，
 * 而币能直接开局 ⇒ 抓娃娃本身能续玩（「坐着玩就能刷」那条回路）。
 * 现在币只能用积分买，娃娃直接发券，两者不互通。""",
    "recycle.js 头注释单位",
)

rep(
    "recycle.js",
    """/**
 * 按稀有度的回收价（娃娃机币/个）。""",
    """/**
 * 按稀有度的回收价（兑换券/个）。""",
    "recycle.js 价目表注释",
)

rep(
    "recycle.js",
    """ * 特例。`snackbox` 的 rarity 是 1，但它是一整盒（10 个）零食，
 * 按 1 币回收等于把一盒糖当一颗糖卖。""",
    """ * 特例。`snackbox` 的 rarity 是 1，但它是一整盒（10 个）零食，
 * 按 1 张券回收等于把一盒糖当一颗糖卖。""",
    "recycle.js snackbox 注释",
)

# ── 3. game.js：卖娃娃走 redeemPrize，界面单位改 🎟️ ─────────────
rep(
    "game.js",
    """  const ok = await wallet.earn(gain, `回收 ${prizeName(id)} ×${qty}`);
  sellSig = "";
  if (alive) { refreshTexts(); buildRecycle(); }
  return ok;""",
    """  // 娃娃 → **兑换券**，不经过币（币是买来的入场券，娃娃不该产币）。
  // 返回值是宿主实际发出的券数，界面显示这个数，不自己乘。
  const got = await wallet.redeemPrize(gain, `回收 ${prizeName(id)} ×${qty}`);
  sellSig = "";
  if (alive) { refreshTexts(); buildRecycle(); }
  return got;""",
    "game.js sellStock",
)

rep(
    "game.js",
    """    cell.innerHTML = `<div class="ico">${prizeImg(r.id, 64)}</div><div>${prizeName(r.id)}</div>` +
      `<div style="color:#8b84a3;font-size:12px">×${r.n}</div>` +
      `<div style="color:${hex(PALETTE.pink)};font-size:14px;font-weight:900">${COIN.emoji} ${r.each}</div>`;""",
    """    cell.innerHTML = `<div class="ico">${prizeImg(r.id, 64)}</div><div>${prizeName(r.id)}</div>` +
      `<div style="color:#8b84a3;font-size:12px">×${r.n}</div>` +
      `<div style="color:${hex(PALETTE.pink)};font-size:14px;font-weight:900">${VOUCHER.emoji} ${r.each}</div>`;""",
    "game.js 回收格子单位",
)

rep(
    "game.js",
    """    <div class="dim">${T("recycleEach")} ${COIN.emoji} <b>${each}</b> · ${T("owned")} ×${have}</div>
    <div class="calc"><div class="tot"><span>${T("sellTotal")} ×${have}</span><span>${COIN.emoji} ${each * have}</span></div></div>
    <div class="row"><button class="pill" id="rcCancel">${T("cancel")}</button><button class="pill pink" id="rcOne">${T("sellOne")} · ${COIN.emoji}${each}</button></div>
    <button class="pill mint" id="rcAll" style="width:100%">${T("sellAll")} ×${have} · ${COIN.emoji}${each * have}</button>`;""",
    """    <div class="dim">${T("recycleEach")} ${VOUCHER.emoji} <b>${each}</b> · ${T("owned")} ×${have}</div>
    <div class="calc"><div class="tot"><span>${T("sellTotal")} ×${have}</span><span>${VOUCHER.emoji} ${each * have}</span></div></div>
    <div class="row"><button class="pill" id="rcCancel">${T("cancel")}</button><button class="pill pink" id="rcOne">${T("sellOne")} · ${VOUCHER.emoji}${each}</button></div>
    <button class="pill mint" id="rcAll" style="width:100%">${T("sellAll")} ×${have} · ${VOUCHER.emoji}${each * have}</button>`;""",
    "game.js 回收弹层单位",
)

rep(
    "game.js",
    """    sh.innerHTML = `<h3 style="font-size:26px">✓ ${T("recycled")}</h3><div style="font-size:34px;font-weight:900;color:${hex(PALETTE.pink)}">${COIN.emoji} +${each * n}</div>`;""",
    """    // 显示**宿主实际发出的券数**（`got`），不是自己乘出来的 `each * n` ——
    // 两边算法一旦不一致，玩家看到的就是假数。
    sh.innerHTML = `<h3 style="font-size:26px">✓ ${T("recycled")}</h3><div style="font-size:34px;font-weight:900;color:${hex(PALETTE.pink)}">${VOUCHER.emoji} +${got}</div>`;""",
    "game.js 回收成功页",
)

rep(
    "game.js",
    """    const ok = await sellStock(id, n);
    if (!ok) { toast(T("recycleFail")); $("sellModal").classList.add("hidden"); return; }""",
    """    const got = await sellStock(id, n);
    if (!(got > 0)) { toast(T("recycleFail")); $("sellModal").classList.add("hidden"); return; }""",
    "game.js 回收失败判据",
)

rep(
    "game.js",
    """/**
 * 真的卖。返回 `false` = 没卖成。
 *
 * ⚠️ 顺序固定：**先扣库存，再进账**。""",
    """/**
 * 真的卖。返回**宿主实际发出的兑换券数**（`0` = 没卖成）。
 *
 * ⚠️ 顺序固定：**先扣库存，再发券**。""",
    "game.js sellStock 注释",
)

# ── 4. game.js：兑换券的口径常量 ─────────────────────────────────
rep(
    "game.js",
    """import { recycleValue } from "./recycle.js";""",
    """import { recycleValue } from "./recycle.js";

/**
 * 兑换券的显示口径。emoji 必须和宿主 `currency.ts` 的 `coupon` 一致（🎟️）——
 * 币 🧸 / 积分 🪙 / 兑换券 🎟️ 四个同屏，图标重了就看不出在发哪一个。
 */
const VOUCHER = Object.freeze({ name: "兑换券", emoji: "🎟️" });""",
    "game.js VOUCHER 常量",
)

# ── 5. game.js：换成兑换券那条 bar 的空态文案 ────────────────────
rep(
    "game.js",
    """  zh: { tip: "币", rate: "币 = 1 张兑换券", btn: "换成兑换券", empty: "先去抓娃娃换几个币吧", ok: "兑换券 +{n}", fail: "没能换成兑换券" },""",
    """  zh: { tip: "币", rate: "币 = 1 张兑换券", btn: "换成兑换券", empty: "先用积分换几个币吧", ok: "兑换券 +{n}", fail: "没能换成兑换券" },""",
    "game.js 兑换 bar 空态",
)

rep(
    "game.js",
    """  ja: { tip: "コイン", rate: "枚でクーポン1枚", btn: "クーポンに交換", empty: "先にコインを集めよう", ok: "クーポン +{n}", fail: "交換できませんでした" },""",
    """  ja: { tip: "コイン", rate: "枚でクーポン1枚", btn: "クーポンに交換", empty: "ポイントでコインを買おう", ok: "クーポン +{n}", fail: "交換できませんでした" },""",
    "game.js 兑换 bar 空态 ja",
)

rep(
    "game.js",
    """  en: { tip: "coins", rate: "coins = 1 coupon", btn: "Convert to coupons", empty: "Collect some coins first", ok: "Coupons +{n}", fail: "Couldn't convert" },""",
    """  en: { tip: "coins", rate: "coins = 1 coupon", btn: "Convert to coupons", empty: "Buy some coins with points first", ok: "Coupons +{n}", fail: "Couldn't convert" },""",
    "game.js 兑换 bar 空态 en",
)

# ── 6. i18n：回收页副标题 ───────────────────────────────────────
rep(
    "i18n.js",
    """    sellSub: "把娃娃卖掉，换回娃娃机币",""",
    """    sellSub: "把娃娃卖掉，换成兑换券",""",
    "i18n sellSub zh",
)

rep(
    "i18n.js",
    """    sellSub: "景品を売ってコインにできます",""",
    """    sellSub: "景品を売ってクーポンにできます",""",
    "i18n sellSub ja",
)

rep(
    "i18n.js",
    """    sellSub: "Sell prizes to get coins back",""",
    """    sellSub: "Sell prizes for coupons",""",
    "i18n sellSub en",
)

# ── 7. plugin.js：契约版本 + 经济口径 ───────────────────────────
rep(
    "plugin.js",
    """  version: '1.4.0',""",
    """  version: '1.5.0',""",
    "plugin version 1.5.0",
)

rep(
    "plugin.js",
    """  /*
   * 3 = 宿主有 `redeemGameCoin`（币 → 兑换券）。
   * 2 的话这个包会在「换成兑换券」那里拿到 undefined → TypeError，
   * 而症状是「点了没反应」——所以宁可让老宿主直接拒绝加载。
   */
  minHostApi: 3,""",
    """  /*
   * 4 = 宿主有 `mintVoucher`（娃娃 → 兑换券，不经过币）。
   * 3 的宿主上 `host.mintVoucher` 是 undefined → TypeError，
   * 症状是「卖娃娃点了没反应」——所以宁可让老宿主直接拒绝加载。
   */
  minHostApi: 4,""",
    "plugin minHostApi 4",
)

rep(
    "plugin.js",
    """  economy: {
    playCost: PLAY_COST,   // 一局 1 娃娃机币
    expectedPayout: 0.6,   // 一局期望 0.6 币（< playCost）
    capPerPrize: MAX_RECYCLE, // 单件最多回收 5 币""",
    """  economy: {
    playCost: PLAY_COST,   // 一局 1 娃娃机币
    /*
     * 一局期望产出 **0.6 张兑换券**（< playCost）。
     * 2026-10-23 起娃娃直接发券、不再产币，所以这个数就是「一局能刷出多少券」——
     * 宿主按 `expectedPayout × voucherPerCoin < playCost` 把关（0.6 < 1 ✓）。
     */
    expectedPayout: 0.6,
    capPerPrize: MAX_RECYCLE, // 单件最多 5 张券""",
    "plugin economy 注释",
)

miss = []
for path, old, new, note in edits:
    s = path.read_text(encoding="utf-8")
    n = s.count(old)
    if n != 1:
        miss.append(f"{note}: 命中 {n} 次")
        continue
    path.write_text(s.replace(old, new, 1), encoding="utf-8")

if miss:
    print("✗ 有锚点没命中：")
    for m in miss:
        print("   " + m)
    sys.exit(1)

print(f"✓ {len(edits)} 处写入完成")
