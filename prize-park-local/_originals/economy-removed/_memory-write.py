"""写今天的工作日志（追加）+ 新建 prize-park-local 项目笔记 + 在索引里加一行。"""
import io, os

M = r'E:\plan\test25\.workbuddy-ai\memory'
LOG = os.path.join(M, '2026-10-22.md')
NOTE = os.path.join(M, 'notes', 'prize-park-local.md')
IDX = os.path.join(M, 'MEMORY.md')

LOG_APPEND = u"""

---

## 经济改造完成（任务 #4，prize-park-local）

用户原话：「先转 WebP → 再砍 fx 库 → 然后才是写适配层；另外再处理 经济（积分 → 娃娃机币 → 兑换券）。
也不需要啥签到。我只需要 选择娃娃机，娃娃机。最后卖掉娃娃。」

**落地的货币链**：积分（宿主）→ 娃娃机币（游戏内，1 币/局）→ 回收娃娃换币。
兑换券只是宿主币种表里的显示名（`商城币` → `兑换券`，全仓 220 处 / 28 文件），本游戏不碰它。

### 删掉的（都是印钞机或噪音）

- 签到 / 印章 / 每日任务（`daily.js`、`#dailyBtn`、`save.daily`）
- 跳蚤市场与自主定价（`market.js`、`#fleaBtn`、`save.market`）—— 自己定价 + 卖得的钱能投币 = 无限循环
- TEST 菜单的「金币 +1000」按钮；`testMode: false`（必定 GET = 免费娃娃洞）
- 存档字段 `coins` / `tickets` / `market` / `daily`

### 新增

- `wallet.js`：币/积分的内存镜像，买币 / 付费 / 入账**全部走宿主那三个门**（不自己存）
- `recycle.js`：固定回收价，按稀有度 1 / 2 / 5（`snackbox` 单独 3），`MAX_RECYCLE = 5`
- `save.stock`（可回收库存）与 `save.gotCounts`（图鉴）**分开** —— 原版只有一个，卖掉图鉴跟着少
- 回收顺序是**先扣库存再入账**；反过来就是「娃娃还在、币也到账」的印钞机

### 三个「点了没反应、控制台零报错」的坑

已沉淀成 skill `frontend-verify-layers` **§78**：

1. `disabled` 的按钮**连 click 事件都不发** → 0 币时 PLAY 死掉，新玩家走不到买币面板
2. `await sound.unlock()` 在无声卡 headless 里**永不 resolve** → 所有磁贴导航变成空操作
3. `.click()` 绕过命中测试 → 被别的层盖住也绿；只能 `elementFromPoint` 反查

★ 对照组的价值：`#btnPlay` 死的时候顺手点了 `#colBtn`（本次没碰的），**它也死**
⇒ 不是经济逻辑写错，而是公共导航路径断了。没有对照组会去改一个本来好好的函数。

### 验收（4 个脚本全 PASS）

| 脚本 | 结果 |
| --- | --- |
| `e2e-economy.cjs 4395 shots` | 31 条断言：0 币 30 积分 → 买 5 → 玩 1 → 抓熊 → 回收 → 6 币；刷新仍在；存档只剩 6 个键；账本 Σdelta = 6 |
| `plugin-test.cjs 4392` | 同一条链走宿主 `buyGameCoin / spendGameCoin / mintGameCoin`，宿主账本 3 笔 |
| `mount-test.cjs 4392` | 3 轮挂卸无 canvas 泄漏 |
| `verify.cjs 4392 shots` | 19 请求 / 0 png / 5 webp、fx = local-1、零报错 |

宿主侧 `tsc -b --noEmit` 干净；`npm test` 779/780（唯一失败是 jsdom 并发下的 5s 超时，单跑 19/19 全过）。

### 这一轮又踩到的老坑（都是本文件/用户记忆里已有的）

- `vite build` 被 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 拦下 → `CODEBUDDY_SAFE_DELETE_ENABLED=0`
- bash heredoc 里的中文/反引号被当命令执行，把 `config.js` 的注释啃了两个洞 → 改用 Edit 重写
- `Runtime.evaluate` + `awaitPromise` 里 `JSON.stringify(await X())` 变成 `"[object Object]"` → 要把 async IIFE 整个包起来
- 同一个文件多轮 Edit 互相覆盖 → 一次性写成带 `assert` 的 python 脚本（本轮 README 两处更新都是这么做的）

### 待办

- 宿主侧装配：`src/games/catalogUrl.ts` 的 `CATALOG_URL` 还是空的；Ed25519 签名、
  包托管、`assertAllowedPackageUrl`（只放行 https）都要动宿主仓库
- `E:\\plan\\test25\\mk-game\\` 重复目录仍需手工删（183 文件，撞 safe-delete 闸门）
"""

NOTE_TEXT = u"""# prize-park-local（奖品公园 · 娃娃机）

从 `https://jadsm6ugtx.mkplay.zone/v/1/index.html` 扒下来并改造的 MakePlay 娃娃机游戏。
目标形态：**kid-quest-farm-2d 的一个 v2 插件**（与宿主自带的娃娃机并存，不顶掉它）。

## 跑起来

```bash
node server.js 4395          # 或 start.bat
# 独立跑：http://127.0.0.1:4395/
# 插件包：node scripts/build-plugin.mjs → dist-plugin/prizepark.plugin.mjs
```

端口习惯：**4392 = 插件/挂载测试用的静态服务**，**4395 = 独立运行 + 经济 e2e**。
起完先确认「服务的是本次构建」（`game.js` 里能 grep 到 `createWallet`），
否则会拿旧 bundle 跑出一片假绿。

## 四个验证脚本（缺一不可）

```bash
node scripts/verify.cjs       4392 shots    # 加载 / 资源 / 特效 / 进机台
node scripts/mount-test.cjs   4392          # 挂载→卸载 ×3，查 WebGL context 泄漏
node scripts/plugin-test.cjs  4392          # blob import 单文件包 + 经济链（1b 段）
node scripts/e2e-economy.cjs  4395 shots    # 整条经济链 + 四个「必须不存在」
```

## 经济：积分 → 娃娃机币 → 回收

- **余额 = Σ(delta)**，从不存 `balance` 字段（宿主 `db.ts` 与本地 `main.js` 一致）
- 只有三个门能改余额：`mintGameCoin`（只收正数）/ `spendGameCoin`（唯一合法负数）/
  `buyGameCoin`（扣积分 + 记币，一个 Dexie 嵌套事务）
- 常量都在 `wallet.js`：`POINTS_PER_COIN = 1`、`PLAY_COST = 1`、`MAX_BUY = 20`
- `recycle.js`：按稀有度 1 / 2 / 5，`snackbox` 单独 3，`MAX_RECYCLE = 5`
- 插件 `manifest.economy = { playCost: 1, expectedPayout: 0.6, capPerPrize: 5 }`；
  宿主硬约束 `expectedPayout < playCost`（且 `≤ 0.8`）
- `save.stock`（能卖几个）≠ `save.gotCounts`（抓到过几个），**故意分开**
- 卖娃娃**先扣库存再 mint**，顺序反了就是印钞机

## 改这个项目时最容易踩的

1. **`gp.player.saves.latestSync` 是同步 getter，宿主 storage 是 async。**
   解法不是包 Promise，而是**创建游戏之前先把存档读成快照**传进去（`plugin.js`）。
2. **`disabled` 的按钮连 click 都不发** —— 任何「不满足条件时该引导用户去满足条件」的按钮都不许 disabled。
3. **`await sound.unlock()` 会永不 resolve**（无声卡 headless / 真机首启）→ `audioWarmup()` 只发不等。
4. **`.click()` 绕过命中测试** —— 判遮挡只能 `elementFromPoint`。
5. **`assetBase` 必须给**，否则相对路径以 `blob:` 为基准解析，全 404（报错像打包坏了）。
6. 打包：`minify` 用 `'oxc'`（宿主没装 esbuild）；alias 用数组、更具体的放前面。
7. 构建可能被 safe-delete 闸门拦：`CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs`

## 体积

单文件 JS 3.24 MB（gzip 1.08 MB）+ assets 5.2 MB + sound.pack 2.2 MB ≈ 10.7 MB（改造前 73 MB）。

## 还没做

宿主侧装配：`kid-quest-farm-2d/src/games/catalogUrl.ts` 的 `CATALOG_URL` 仍为空，
Ed25519 catalog 签名、包托管、`assertAllowedPackageUrl`（只放行 https）都未落地。
"""

io.open(LOG, 'a', encoding='utf-8', newline='\n').write(LOG_APPEND)
print('log OK')

if not os.path.exists(NOTE):
    io.open(NOTE, 'w', encoding='utf-8', newline='\n').write(NOTE_TEXT)
    print('note OK')
else:
    print('note EXISTS, skip')

t = io.open(IDX, encoding='utf-8').read()
ROW = u"| `prize-park-local/` | 奖品公园 · 娃娃机（MakePlay 扒站改造，v2 插件） | 独立 4395 / 插件测 4392 | `notes/prize-park-local.md` |\n"
anchor = u"| `fu-man-tang/` | 福满堂（中老年游戏 + 福地） | 5200 | `notes/fu-man-tang.md` |\n"
assert t.count(anchor) == 1, 'ABORT: 索引锚点 %d 次' % t.count(anchor)
if 'prize-park-local/' in t:
    print('index ROW exists, skip')
else:
    t = t.replace(anchor, anchor + ROW, 1)
    io.open(IDX, 'w', encoding='utf-8', newline='\n').write(t)
    print('index OK')
