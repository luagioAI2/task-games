# -*- coding: utf-8 -*-
"""
README 对齐「娃娃只能换兑换券，不能变回币」这条规则。

锚点式改写：每个锚点必须恰好命中 1 次，命中 0 次或多次都直接中止
（否则很容易改错位置，或者以为改了其实没改）。
"""
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"

text = README.read_text(encoding="utf-8")
edits = []


def rep(label, old, new):
    edits.append((label, old, new))


# ---- 1. 手测第 7、8 步：回收的标价单位是券 ----
rep(
    "手测#7 回收标价",
    '| 7 | 切到「回收」 | 卡片写「每个回收 🧸 2」；点开有 取消 / 卖 1 个 / 全部卖掉 |',
    '| 7 | 切到「回收」 | 卡片写「每个回收 🎟️ 2」；点开有 取消 / 卖 1 个 / 全部卖掉 |',
)

rep(
    "手测#8 卖掉结果",
    '| 8 | 卖掉 | 币增加、卡片消失、出现空态文案 |',
    '| 8 | 卖掉 | **兑换券增加、🧸 币一分不动**、卡片消失、出现空态文案 |',
)

# ---- 2. 假宿主那几个门 ----
rep(
    "假宿主的门",
    "（不是 localStorage），走的是 `host.buyGameCoin / spendGameCoin / mintGameCoin /\n"
    "redeemGameCoin` 四个门。",
    "（不是 localStorage），走的是 `host.buyGameCoin / spendGameCoin / redeemGameCoin /\n"
    "mintVoucher` 四个门（`mintGameCoin` 只留给老存档迁移，正常玩法里不再被调用）。",
)

rep(
    "假宿主账本样例",
    "玩一遍（买币 → 抓一只 → 回收 → 换券）之后在控制台敲 `__t.ledger()`，应该看到\n"
    "`{ points: 95, coins: 0, rows: 4, vouchers: 6 }` —— 4 笔 delta 加起来正好等于余额，\n"
    "券是宿主按 manifest 的汇率发的。这就是「余额是算出来的」+「币不能换回积分」的证据。",
    "玩一遍（买币 → 抓一只 → 回收 → 把剩的币换券）之后在控制台敲 `__t.ledger()`，应该看到\n"
    "`{ points: 95, coins: 0, rows: 3, vouchers: 6 }`。\n"
    "\n"
    "- `rows: 3` 是**币账本**的三笔：买 5、玩扣 1、剩 4 换券 —— 加起来 0，余额是算出来的\n"
    "- `vouchers: 6` = 回收娃娃发的 2 + 4 个币换的 4。**娃娃那一份完全不经过币账本**\n"
    "- `points: 95` 只减了买币的 5 —— 币不能换回积分，券也不能",
)

# ---- 3. 目录结构里 wallet 的职责 ----
rep(
    "wallet 职责",
    "wallet.js             钱包：币/积分的内存镜像 + 买币/付费/入账（全部走宿主 API）",
    "wallet.js             钱包：币/积分的内存镜像 + 买币 / 付费 / 回收发券（全部走宿主 API）",
)

# ---- 4. 契约表：补 v4 的 mintVoucher ----
rep(
    "契约小节标题",
    "### v3（`HOST_API = 3`）改了三处，这个包都用到了",
    "### 契约里这个包用到的门（v3 → v4）",
)

rep(
    "契约表加一行",
    "| `host.redeemGameCoin(count, memo)` | 回收页那颗「换成兑换券」按钮；汇率由宿主按 manifest 的 `voucherPerCoin` 算，插件传不进去 |",
    "| `host.redeemGameCoin(count, memo)` | 回收页那颗「换成兑换券」按钮；汇率由宿主按 manifest 的 `voucherPerCoin` 算，插件传不进去 |\n"
    "| `host.mintVoucher(count, memo)` | **v4 加的门**（2026-10-23）。回收娃娃**直接发券**，一个事务写完；\n"
    "不再「先给币、再拿币换券」两跳（详见下面经济一节） |",
)

# ---- 5. 经济一节的标题与货币表 ----
rep(
    "经济标题",
    "## 经济：积分 → 娃娃机币 → 回收",
    "## 经济：积分 → 币 →（玩）→ 奖品 → 兑换券",
)

rep(
    "货币表",
    "| 积分 🪙 | 宿主（农场） | 农场干活 | 买娃娃机币 |\n"
    "| 娃娃机币 🧸 | 娃娃机 | 积分换 / 回收娃娃 | 玩一局（1 币） |\n"
    "| 兑换券 🎟️ | 宿主（农场） | 农场 | 与本游戏无关，只共用宿主的币种表 |",
    "| 积分 🪙 | 宿主（农场） | 农场干活 | 买娃娃机币（**唯一出口**） |\n"
    "| 娃娃机币 🧸 | 娃娃机 | **只有买**（`buyGameCoin`） | 玩一局（1 币）；剩下的可换券 |\n"
    "| 奖品 🧸🎁 | 娃娃机 | 抓到手 | 回收 → 兑换券 |\n"
    "| 兑换券 🎟️ | 宿主（农场） | 回收奖品（`mintVoucher`）/ 余额换券 | 回农场花，**与本游戏无关** |\n"
    "\n"
    "**这是一条单向道：积分 → 币 → 玩 → 奖品 → 券。没有一条边是往回的。**\n"
    "特别是「奖品 → 币」这条边**必须不存在** —— 币能开一局，奖品要是能变回币，\n"
    "抓娃娃就等于免费续玩，回收价再低也拦不住（回收价 1 也行，只要 100% 抓到就是永动机）。",
)

# ---- 6. 铁律第 2 条：三个门 → 四个门 ----
rep(
    "铁律2",
    "2. **只有三个门能改余额**：`mintGameCoin`（只收正数）、`spendGameCoin`（唯一合法负数）、\n"
    "   `buyGameCoin`（扣积分 + 记币，在**一个** Dexie 嵌套事务里写完）。\n"
    "   游戏侧不允许直接碰存储；宿主把 `__` 前缀的键留给自用，`storage.get/set` 撞上会抛。",
    "2. **只有四个门能改余额**：`buyGameCoin`（扣积分 + 记币，**一个** Dexie 嵌套事务）、\n"
    "   `spendGameCoin`（唯一合法负数）、`mintVoucher`（奖品 → 兑换券，一个 `postHarvest`，\n"
    "   **完全不碰币账本**）、`mintGameCoin`（只收正数，**现在只给老存档迁移用**）。\n"
    "   游戏侧不允许直接碰存储；宿主把 `__` 前缀的键留给自用，`storage.get/set` 撞上会抛。\n"
    "   ⚠️ 别拿 `mintGameCoin` + `redeemGameCoin` 拼一个「发券」出来：那是两笔事务，\n"
    "   中间宿主崩了会**真的留下一笔币**（下一局就能用），而且币账本里多出 `+2 / -2` 的噪声。",
)

# ---- 7. 卖掉娃娃那一节 ----
rep(
    "卖娃娃结论",
    "改成**固定回收价**之后，卖娃娃只能换回**娃娃机币**（换不到积分），\n"
    "且回收价上限 5 远小于单局 1 的期望产出上限（0.6），闭环里没有正反馈。",
    "改成**固定回收价**之后，卖娃娃只能换回**兑换券**（换不到积分，**更换不到娃娃机币**），\n"
    "券只能在农场花 —— 闭环到这儿就断了，卖娃娃不可能给你续一局。\n"
    "回收价上限 5 相对单局 1 的期望产出（0.6）本来就够安全，但**方向**比大小更重要：\n"
    "只要出口是币，价格迟早会被调到能续玩。",
)

# ---- 8. 已验证：两条经济链的读数 ----
rep(
    "已验证·独立链",
    "  买 5 个（币 0→5、积分 30→25）→ 玩一局（币 5→4，阶段进入 `idle_x`）→ 抓到小熊\n"
    "  （`stock.bear=1`）→ 回收（币 4→6、库存归零、`soldCount=1`）→ 刷新页面 6 币 / 25 积分仍在。",
    "  买 5 个（币 0→5、积分 30→25）→ 玩一局（币 5→4，阶段进入 `idle_x`）→ 抓到小熊\n"
    "  （`stock.bear=1`）→ 回收（**币 4→4 一分没动**、券 0→2、库存归零、`soldCount=1`）→\n"
    "  刷新页面 4 币 / 25 积分 / 2 券仍在。",
)

rep(
    "已验证·插件链",
    "- **插件模式下同一条链**（`plugin-test.cjs` 1b）：走的是 `host.buyGameCoin` /\n"
    "  `host.spendGameCoin` / `host.mintGameCoin`，宿主账本 3 笔 delta 合计 6 —— 证明插件\n"
    "  用的是宿主的门，不是自己另存一份",
    "- **插件模式下同一条链**（`plugin-test.cjs` 1b）：走的是 `host.buyGameCoin` /\n"
    "  `host.spendGameCoin` / `host.redeemGameCoin` / `host.mintVoucher`，宿主币账本 3 笔\n"
    "  delta 合计 **0**、券账本 6 —— 证明插件用的是宿主的门（不是自己另存一份），\n"
    "  且**卖娃娃没有凭空多出币**",
)

# ---- 9. 注意：第四个 localStorage 键 ----
rep(
    "localStorage 键",
    "- 存档在浏览器 localStorage 里，清缓存会丢。想重置就删掉这三个键：\n"
    "  `prizepark.save.v1`（进度）、`prizepark.coin.v1`（娃娃机币流水）、`prizepark.points.v1`（积分流水）。\n"
    "  币和积分存的是**流水**不是余额，删掉任意一个都等于清零对应货币。",
    "- 存档在浏览器 localStorage 里，清缓存会丢。想重置就删掉这四个键：\n"
    "  `prizepark.save.v1`（进度）、`prizepark.coin.v1`（娃娃机币流水）、\n"
    "  `prizepark.points.v1`（积分流水）、`prizepark.voucher.v1`（兑换券流水）。\n"
    "  三种货币存的都是**流水**不是余额，删掉任意一个都等于清零对应货币。",
)

# ---- 10. 改动清单补一条 ----
rep(
    "改动清单第 9 条",
    "8. **重做经济**：删掉签到 / 印章 / 每日任务与整个跳蚤市场，换成 积分 → 娃娃机币 → 固定价回收\n"
    "   （`wallet.js` / `recycle.js`）。存档里 `coins` / `tickets` / `market` / `daily` 四个字段全部移除，\n"
    "   新增 `stock`（可回收库存）。玩法收拢成三步：选机台 → 玩 → 卖娃娃。",
    "8. **重做经济**：删掉签到 / 印章 / 每日任务与整个跳蚤市场，换成 积分 → 娃娃机币 → 固定价回收\n"
    "   （`wallet.js` / `recycle.js`）。存档里 `coins` / `tickets` / `market` / `daily` 四个字段全部移除，\n"
    "   新增 `stock`（可回收库存）。玩法收拢成三步：选机台 → 玩 → 卖娃娃。\n"
    "9. **回收出口从「币」改成「兑换券」**（2026-10-23）：娃娃只能换券，不能变回币。\n"
    "   插件侧走 `host.mintVoucher`（宿主 `HOST_API` 3 → 4），独立运行侧在 `main.js` 里\n"
    "   多记一本 `prizepark.voucher.v1`。`wallet.earn()` 整个删掉 —— 钱包从此**没有加币的口子**。",
)

fail = False
for label, old, new in edits:
    n = text.count(old)
    if n != 1:
        print(f"[FAIL] {label}: 锚点命中 {n} 次（需要 1 次）")
        fail = True
        continue
    text = text.replace(old, new)
    print(f"[ok] {label}")

if fail:
    print("\n有锚点没命中，**文件未写入**。")
    sys.exit(1)

README.write_text(text, encoding="utf-8")
print(f"\n已写入 {README}（{len(text)} 字符）")
