"""测试跟着改：卖娃娃不再产币，改成发兑换券。

用法：python scripts/patch-voucher-tests.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
edits = []


def rep(path, old, new, note):
    edits.append((ROOT / path, old, new, note))


# ── 假宿主：把券数也返回出来，测试才断言得到 ──────────────────────
rep(
    "_plugin-test.html",
    """    const cells = document.querySelectorAll("#sellGrid .cell").length;
    if (!cells) return { stock, cells, coins: coinBalance() };""",
    """    const cells = document.querySelectorAll("#sellGrid .cell").length;
    if (!cells) return { stock, cells, coins: coinBalance(), vouchers: ledger.vouchers };""",
    "grabAndSell 空分支加 vouchers",
)

rep(
    "_plugin-test.html",
    """    return { stock, cells, coins: coinBalance(), after: { ...(window.__debug.stock || {}) } };""",
    """    return { stock, cells, coins: coinBalance(), vouchers: ledger.vouchers, after: { ...(window.__debug.stock || {}) } };""",
    "grabAndSell 正常分支加 vouchers",
)

# ── plugin-test：回收那三条断言 ─────────────────────────────────
rep(
    "scripts/plugin-test.cjs",
    """    // `host.buyGameCoin / spendGameCoin / mintGameCoin`。两条路**完全不同的代码**，""",
    """    // `host.buyGameCoin / spendGameCoin / mintVoucher`。两条路**完全不同的代码**，""",
    "plugin-test 注释",
)

rep(
    "scripts/plugin-test.cjs",
    """    ok(sold.coins === 6, '回收走 host.mintGameCoin：币 4→6（rarity 2）', { coins: sold.coins });
    const led1 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led1.rows === 3 && led1.coins === 6, '宿主账本 3 笔 delta、合计 6（余额是算出来的）', led1);""",
    """    // ★ 2026-10-23 起：娃娃**不产币**，直接发兑换券。
    //   币是「买来的入场券」，券是「抓来的战利品」—— 混起来抓娃娃就能续玩。
    ok(sold.coins === 4, '★ 卖娃娃**不动币**（4 还是 4）—— 娃娃不再产币', { coins: sold.coins });
    ok(sold.vouchers === 2, '★ 卖 1 只 rarity 2 的娃娃 → 直接发 2 张兑换券（host.mintVoucher）', { vouchers: sold.vouchers });
    const led1 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led1.rows === 2 && led1.coins === 4, '宿主币账本只剩 2 笔（买 + 玩）、合计 4', led1);""",
    "plugin-test 回收断言",
)

rep(
    "scripts/plugin-test.cjs",
    """    ok(rd.after.vouchers === 6, '兑换券到账 6 张（1 币 = 1 券）', rd);
    const led2 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led2.rows === 4 && led2.coins === 0 && led2.vouchers === 6,
      '账本多了一笔负数、券记在另一本账上', led2);""",
    """    ok(rd.after.vouchers === 6, '兑换券合计 6 张（娃娃发的 2 + 4 币换的 4）', rd);
    const led2 = JSON.parse(await evalv('JSON.stringify(window.__t.ledger())'));
    ok(led2.rows === 3 && led2.coins === 0 && led2.vouchers === 6,
      '币账本多一笔负数（3 笔）、券记在另一本账上', led2);""",
    "plugin-test 兑换断言",
)

# ── e2e-economy：卖娃娃那几条 + 落盘/刷新 ───────────────────────
rep(
    "scripts/e2e-economy.cjs",
    """ *   积分 →(买)→ 娃娃机币 →(玩)→ 一局 →(抓)→ 娃娃 →(回收)→ 娃娃机币""",
    """ *   积分 →(买)→ 娃娃机币 →(玩)→ 一局 →(抓)→ 娃娃 →(回收)→ **兑换券**（不回到币）""",
    "e2e 头注释",
)

rep(
    "scripts/e2e-economy.cjs",
    """    const b3 = JSON.parse(await ev('JSON.stringify({coins: __debug.coins, stock: __debug.stock, sold: __debug.save.soldCount})'));
    ok(b3.coins === 6, '卖 1 只熊：币 4→6（rarity 2 回收 2 币）', b3);""",
    """    const b3 = JSON.parse(await ev(`JSON.stringify({
      coins: __debug.coins, stock: __debug.stock, sold: __debug.save.soldCount,
      vouchers: JSON.parse(localStorage.getItem('prizepark.voucher.v1') || '[]').reduce((a, r) => a + r.delta, 0),
    })`));
    // ★ 2026-10-23 起：娃娃 → 兑换券，**不回到币**（币能开局，回币就是「抓娃娃能续玩」）
    ok(b3.coins === 4, '★ 卖 1 只熊不动币（4 还是 4）—— 娃娃不再产币', b3);
    ok(b3.vouchers === 2, '★ 卖 1 只熊 → 直接发 2 张兑换券（rarity 2）', b3);""",
    "e2e 卖娃娃断言",
)

rep(
    "scripts/e2e-economy.cjs",
    """    const ledger = JSON.parse(await ev(`localStorage.getItem('prizepark.coin.v1') || '[]'`));
    const sum = ledger.reduce((a, r) => a + r.delta, 0);
    ok(sum === 6, '币账本 delta 之和 = 6（余额是算出来的）', { rows: ledger.length, sum });""",
    """    const ledger = JSON.parse(await ev(`localStorage.getItem('prizepark.coin.v1') || '[]'`));
    const sum = ledger.reduce((a, r) => a + r.delta, 0);
    // 币只有两笔：买 5、玩一局 -1。卖娃娃不再往这本账上写。
    ok(ledger.length === 2 && sum === 4, '币账本只剩 2 笔（买 + 玩）、合计 4', { rows: ledger.length, sum });
    const vled = JSON.parse(await ev(`localStorage.getItem('prizepark.voucher.v1') || '[]'`));
    const vsum = vled.reduce((a, r) => a + r.delta, 0);
    ok(vsum === 2, '兑换券账本单独一本、合计 2', { rows: vled.length, sum: vsum });""",
    "e2e 落盘断言",
)

rep(
    "scripts/e2e-economy.cjs",
    """    const b4 = JSON.parse(await ev('JSON.stringify({coins: __debug.coins, points: __debug.points, stock: __debug.stock})'));
    ok(b4.coins === 6 && b4.points === 25, '刷新后余额一致（6 币 / 25 积分）', b4);""",
    """    const b4 = JSON.parse(await ev(`JSON.stringify({
      coins: __debug.coins, points: __debug.points, stock: __debug.stock,
      vouchers: JSON.parse(localStorage.getItem('prizepark.voucher.v1') || '[]').reduce((a, r) => a + r.delta, 0),
    })`));
    ok(b4.coins === 4 && b4.points === 25 && b4.vouchers === 2, '刷新后余额一致（4 币 / 25 积分 / 2 券）', b4);""",
    "e2e 刷新断言",
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
