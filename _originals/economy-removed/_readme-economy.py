"""把 README 更新到经济改造之后的真实状态。一次性脚本，跑完归档。"""
import io, sys

P = 'README.md'
src = io.open(P, encoding='utf-8').read()
n0 = len(src)

def one(old, new):
    global src
    c = src.count(old)
    assert c == 1, 'ABORT: 锚点出现 %d 次: %r' % (c, old[:60])
    src = src.replace(old, new, 1)

# ---------- 1. 三个 → 四个验证脚本 ----------
one("### 三个验证脚本（都能单独跑）\n\n```bash\nnode scripts/verify.cjs     4392 shots    # 独立运行：加载 / 资源 / 特效 / 进机台\nnode scripts/mount-test.cjs 4392          # 挂载→卸载→再挂载 ×3 轮，查 WebGL context 泄漏\nnode scripts/plugin-test.cjs 4392         # 照宿主 loader 的方式 blob import 单文件包\n```",
    "### 四个验证脚本（都能单独跑）\n\n```bash\nnode scripts/verify.cjs       4392 shots    # 独立运行：加载 / 资源 / 特效 / 进机台\nnode scripts/mount-test.cjs   4392          # 挂载→卸载→再挂载 ×3 轮，查 WebGL context 泄漏\nnode scripts/plugin-test.cjs  4392          # 照宿主 loader 的方式 blob import 单文件包（含经济链）\nnode scripts/e2e-economy.cjs  4395 shots    # 整条经济链 + 四个「必须不存在」的东西\n```")

# ---------- 2. 经济章节，插在「相对原站做了哪些改动」之前 ----------
ECON = u"""## 经济：积分 → 娃娃机币 → 回收

三档货币各管一段，**不互相偷换**：

| 货币 | 归谁 | 从哪来 | 到哪去 |
| --- | --- | --- | --- |
| 积分 🪙 | 宿主（农场） | 农场干活 | 买娃娃机币 |
| 娃娃机币 🧸 | 娃娃机 | 积分换 / 回收娃娃 | 玩一局（1 币） |
| 兑换券 🎟️ | 宿主（农场） | 农场 | 与本游戏无关，只共用宿主的币种表 |

### 三条铁律

1. **余额永远是流水算出来的**，不存 `balance` 字段 —— 同一个事实存两份必然走散。
   宿主的 `db.ts` 和本地的 `main.js` 都只有 `Σ(delta)`。
2. **只有三个门能改余额**：`mintGameCoin`（只收正数）、`spendGameCoin`（唯一合法负数）、
   `buyGameCoin`（扣积分 + 记币，在**一个** Dexie 嵌套事务里写完）。
   游戏侧不允许直接碰存储；宿主把 `__` 前缀的键留给自用，`storage.get/set` 撞上会抛。
3. **`expectedPayout < playCost` 是硬不变量**，宿主校验 `E ≤ 0.8`。
   插件声明 `economy: { playCost: 1, expectedPayout: 0.6, capPerPrize: 5 }`。
   回收价按稀有度定死 1 / 2 / 5（`recycle.js`，`snackbox` 单独 3）：
   最坏情况（只玩 3 星台、均价 5）保本捕获率 = 1/5 = 20%，实际远低于此
   —— 所以 `0.6` 是个保守**声明**，不是精确测算值。

### 卖掉娃娃：为什么没有跳蚤市场了

原版是自己定价挂单，卖得的钱能直接投下一局。两条都是印钞机：
玩家把价挂到天上；或者「卖得的钱 ≥ 玩一局的钱」就形成无限循环。
改成**固定回收价**之后，卖娃娃只能换回**娃娃机币**（换不到积分），
且回收价上限 5 远小于单局 1 的期望产出上限（0.6），闭环里没有正反馈。

### 四类必须不存在的东西（e2e 逐条断言）

- 签到 / 印章 / 每日任务（`#dailyBtn`、`save.daily`、`daily.js` 全删）
- 跳蚤市场与自主定价（`#fleaBtn`、`save.market`、`market.js` 全删）
- 用「销售额」付游玩费
- TEST 菜单里的「金币 +1000」调试按钮（`testMode: false`，必定 GET 也关了
  —— 经济一旦是真的，必定 GET 就是免费娃娃洞）

### 三个「点了没反应、控制台零报错」的坑

这一轮全踩了一遍，症状完全一样：**页面不崩、不报错、就是没反应**。

1. **`disabled` 的按钮连 `click` 事件都不发。** 0 币时把 PLAY 设成 `disabled`，
   新玩家永远走不到买币面板 —— 死路。改法：按钮始终 enabled，文案换成「买娃娃机币」。
2. **`await sound.unlock()` 在无声卡的 headless 里永不 resolve。** 它写在 `show(el)` 之前，
   整个导航变成空操作，`screen` 停在 `title`、零报错。改法：`audioWarmup()` 只管发、不 await。
3. **`el.click()` 绕过命中测试。** 被别的层盖住的按钮，测试里照样「点得动」。
   判「有没有被盖住」只能用 `document.elementFromPoint(中心点)` 反查 ——
   `e2e-economy.cjs` 里的 `hit()` 就是干这个的。

### 存盘：`stock` 与 `gotCounts` 为什么分开

`gotCounts` 是「历史上抓到过几个」（图鉴用），`stock` 是「现在手里还有几个」（可回收）。
原版只有一个 `gotCounts`，卖掉之后图鉴跟着少一个。
老档升级时按 `gotCounts` 回填 `stock` —— 宁可多给几个，也不要让人以为娃娃丢了。

"""
one("## 相对原站做了哪些改动", ECON + "## 相对原站做了哪些改动")

# ---------- 3. 改动清单加一条 ----------
one("7. **换掉 fx 库**（3.25 MB → 17 KB），`game.js` 的 `import` 从 `@makeplay/fx` 改成 `./fx.js`。",
    "7. **换掉 fx 库**（3.25 MB → 17 KB），`game.js` 的 `import` 从 `@makeplay/fx` 改成 `./fx.js`。\n"
    "8. **重做经济**：删掉签到 / 印章 / 每日任务与整个跳蚤市场，换成 积分 → 娃娃机币 → 固定价回收\n"
    "   （`wallet.js` / `recycle.js`）。存档里 `coins` / `tickets` / `market` / `daily` 四个字段全部移除，\n"
    "   新增 `stock`（可回收库存）。玩法收拢成三步：选机台 → 玩 → 卖娃娃。")

# ---------- 4. 已验证：换掉过期的投币流程 ----------
one(u'- 投币流程正常：3000 → 2900 金币，进入"决定横向位置"阶段',
    u'- **经济链全通**（`e2e-economy.cjs`，31 条断言）：0 币 / 30 积分起步 → PLAY 弹出买币面板 →\n'
    u'  买 5 个（币 0→5、积分 30→25）→ 玩一局（币 5→4，阶段进入 `idle_x`）→ 抓到小熊\n'
    u'  （`stock.bear=1`）→ 回收（币 4→6、库存归零、`soldCount=1`）→ 刷新页面 6 币 / 25 积分仍在。\n'
    u'  存档只剩 `coinMigrated / firstGot / gotCounts / layouts / stock / v` 六个键\n'
    u'- **插件模式下同一条链**（`plugin-test.cjs` 1b）：走的是 `host.buyGameCoin` /\n'
    u'  `host.spendGameCoin` / `host.mintGameCoin`，宿主账本 3 笔 delta 合计 6 —— 证明插件\n'
    u'  用的是宿主的门，不是自己另存一份\n'
    u'- **回收面板可点**：`elementFromPoint` 反查 `#rcAll` 中心点，没有被别的层盖住')

# ---------- 5. 注意：三个 localStorage 键 ----------
one("- 存档在浏览器 localStorage 里，清缓存会丢。想重置就删掉 `prizepark.save.v1` 这个键。",
    "- 存档在浏览器 localStorage 里，清缓存会丢。想重置就删掉这三个键：\n"
    "  `prizepark.save.v1`（进度）、`prizepark.coin.v1`（娃娃机币流水）、`prizepark.points.v1`（积分流水）。\n"
    "  币和积分存的是**流水**不是余额，删掉任意一个都等于清零对应货币。")

io.open(P, 'w', encoding='utf-8', newline='\n').write(src)
print('OK %d -> %d bytes' % (n0, len(src)))
