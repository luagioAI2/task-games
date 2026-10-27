# 接入进度 · 方块填空（blockfit）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://da22ty94rk.mkplay.zone/v/4/index.html`
- 商城名：方块填空（4 字，底栏也用这个）· id `blockfit`
- 形态：PixiJS v8 纯 2D，多联骨牌拼满矩形（15 道主线 + 105 道随机池），3 语（ja 主 / en / zh）
- 经济：**C 型 / `chill`** —— 每开一局 **10 积分**，不产出任何宿主资源
- 开始：2026-10-27 09:50
- 当前：步骤 0–7 完成，待 8（五层验收）与 9（提交）

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | 无内购/抽卡/签到/任务/兑换码；在线榜 + 分享要拆（见「侦察结论」） |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | **18 个文件 / 8.07 MB / 0 个 0 字节**；BGM sha256 与清单**逐位一致** |
| 2 | 立工程（scaffold） | ✅ | `index.html` 43871 → 583 B；首次提交 `c1e7d4e` |
| 3 | 压资源 | ✅ | 5 张图 **3.85 MB → 298 KB（−92%）**；不透明区最差 PSNR **35.13 dB**；原图只在 `_originals/` 留底 |
| 4 | 改造（去在线榜/分享 + 插件化 + 经济） | ✅ | `grep -c "gpShare\|captureShare\|submitScore\|topScores"` = **0**；`gp.` 只剩 2 处（都在适配层） |
| 5 | 打包 | ✅ | `dist-plugin/blockfit.plugin.mjs` **4268 KB**，裸说明符 0 · 动态 import 0 · 三引擎全内联 |
| 6 | 落库（四处登记） | ✅ | `check:registry` → 本地包 **10** · 哈希 **10** · 商城 **10** · PLAN **10** |
| 7 | 商城详情（文案 + 4 张图） | ✅ | `public/store/blockfit/1..4.webp`（23.6 / 18.1 / 21.7 / 15.4 KB） |
| 8 | 五层验收 | 🔄 | 静态 ✅ · 假宿主 **32 条全绿** · lint/单测/两档 e2e 见下 |
| 9 | 提交（两个仓库） | ⬜ | 两边 `git status` 干净 |

## 侦察结论（步骤 0，2026-10-27）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| 内购 / 抽卡 / 签到 / 每日任务 / 兑换码 / 联机 | **全部没有**（`grep gacha\|shop\|loginBonus\|mission\|redeem` 0 命中） | 不用拆 |
| 在线排行榜 | `gp.player.topScores(10)` + `submitScore()`，`rankTab === "online"` 分支 | **删**（页签、else 分支、结算提交块） |
| 本机排行榜 | 最多 8 个玩家档案，按最佳用时排序，纯本地 | **保留**（一家人轮流刷成绩，是这个游戏的价值） |
| 分享 | `gp.share.snap/image`（`captureShare` / `addShareRow` / 结局页 / 挑战结算页 4 处） | **删**（宿主里没有分享目标） |
| 云存档 | `gp.player.saves.latestSync` / `putLatest` / `ready` | 换 `host.storage`（键 `save`） |
| 登录 | `gp.player.ready → user.locale` 只用来定语言 | 删，语言取存档（默认 **zh**） |
| 广告 | 无 | — |
| 引擎 | 纯 PixiJS v8（PIXI 72 处，THREE/Rapier/Phaser 0 处）+ `@makeplay/sound` + `@makeplay/fx` | 内联进包 |
| 资源 | 5 张 PNG 字面量 + `sound.manifest.json`（13 条音效）+ `sound.pack` + `bgm-think.m4a` | 抓全后压 webp |
| 玩法 | 15 道主线（第 1 道解锁，其余按上一道通关解锁）+ 105 道随机池计时挑战；每题 3 枚印章（通关 / 无提示 / 基准步数），共 45 | 收费点 = 点题卡「开始」/「计时挑战·开始」 |

## 改造清单（步骤 4）

一次性补丁脚本 `scripts/_patch.py`（**29 个锚点各断言命中 1 次**才写盘）：

| 改动 | 落点 | 为什么 |
| --- | --- | --- |
| `gp` 适配层 | `src/host.js` 的 `installGp(store)` | 原版 6 处 `gp.*`，逐处改会让两种形态分叉；`share` / `pay` **故意不提供** |
| `boot()` → `export async function start(opts)` | `game.js` | 独立网页与插件调**同一个函数**，差别全走 `opts`（`assetBase` / `store` / `chargePlay`） |
| 卸载函数 | `start()` 返回 | Pixi `destroy({texture:false})` / 摘 window 监听 / 删 `__gp*` 钩子 / `tweens.length=0` |
| `A(p)` 资源前缀 | 5 处 `PIXI.Assets.load` + 音频清单 | `blob:` 模块里相对路径以 blob: 为基准 ⇒ 全 404 |
| 开局收费 | `gate()` + `startMain` / `startTa` | 两个入口共用一个闸门，不会漏 |
| 在线榜 / 分享 / 登录 | 整块删 | 宿主里没有账号、没有分享目标 |

### 顺手修的三个原版问题（都会在真机上看得见）

| 症状 | 真因 | 修法 |
| --- | --- | --- |
| 中文界面下大标题还是日文「四角にハマる」 | 标题是写死的字符串，没跟 `lang` 走 | `TITLE = {ja, en, zh}` 三语 |
| 窄屏（390）里「步数」被「提示」按钮压住，只剩半个「步」字 | HUD 按更宽的屏设计：`W-96-118` 算到 166，而标签+步数排到 ~215 | 窄屏按钮 108/96 → 84/72；步数改右对齐贴着「提示」；窄屏标签只写「第1」 |
| 过关面板底部空 28px | 分享按钮那一行删掉后没改面板高度 | `mkPanel(W, 330)` → `302` |
| `SoundRuntimeError` 以未捕获 rejection 炸出来 | 程序化开局没有用户手势 ⇒ `playCue()` reject，`void` 吃不掉 rejection | `safePlay()` 兜住 + `ensureAudio()` 整段 try/catch，`audioOn` **成功之后**才置位 |

### 加的两处体验改动（不是 bug）

- **自动建一个玩家档案**（名字取 `T.me`：我 / わたし / Me）。
  原版第一次点「选择题目」会弹一个 DOM 输入框让你起名字 —— 对 6 岁孩子是一道键盘门槛，
  而且那个输入框 `position:fixed` 盖住整屏，在宿主里长得和 App 不像。「玩家」页仍可改名 / 加人。
- **`__debug.select()`**：截图与 e2e 用，直接进选题目录（原版只能点按钮）。

## 验收实录

### 第 1 层 静态

```
node scripts/check-plugin.mjs ../task-games/blockfit/dist-plugin/blockfit.plugin.mjs \
  --assets ../task-games/blockfit/assets
→ 通过（3 条提示）
```
三条提示都是**预期内的**：
1. `voucherPerCoin 缺省` —— C 型游戏，本来就不开放兑换。
2. `没有 assets/manifest.json` —— 已补（`node scripts/make-asset-manifest.mjs`，6 个文件 / 1412 KB）。
3. `包里引用了 document.body` —— 那是**起名字的输入框**，全屏模态，按项目约定就该 Portal 到 body
   （外壳 `anim-fade` 是隐式层叠上下文，`z-index` 再高也压不住）。

### 第 3 层 假宿主（`node scripts/mount-test.mjs`，32 条全绿）

| 段 | 判据 | 实测 |
| --- | --- | --- |
| ① 挂载 | canvas 1 个 · 容器高 == **父容器**高 · canvas == 容器 · 0 个 404 | 724 == 724 · 390×724 · 0 |
| ② 余额 5 | 0 次扣款 · 不进对局 · 弹「积分不够」 | spend +0 · scene=title |
| ③ 余额 100 | **恰好扣 10** · 进对局 · 棋盘有 4 块拼片 | spend +1 · 90 · scene=play |
| ④ 对局中卸载 | 容器清空 · `__gpPlayable` / `__gpReady` / `__debug` / `__app` 全摘 · 0 pageerror | 全过 |
| ⑤ 再挂再开 | **再扣 10**（无宽限期，设计如此） | spend +1 · 90 |
| ⑥ 存档落盘 | 通关拿 3 枚印章 → 卸载 → 重挂读回 | `[3,0,0]` → `[3,0,0]` |
| ⑦ 挂第三次 | canvas 仍 1 个 · 仍可玩 | 1 · true |

★ ⑥ 第一次写成读 `save.stamps` 得 `[0,0,0]`，看着像没落盘 —— **印章在 `profiles[i].stamps`**，
顶层的 `stamps` 是「有档案之前」的老档遗留字段。

### 截图走查（`node scripts/capture.mjs`）

4 张图逐张看过：
1. `01-title.png` 标题：牛皮纸格子底 + 彩纸拼片 + 中文大标题。
2. `02-play.png` 对局：棋盘填了一半、托盘里还剩两块、撤销/旋转/翻面在下方 —— 一眼看出玩法。
3. `03-select.png` 题目列表：15 张卡，第 1 题三枚红印章、第 2 题解锁、3–15 是「？？？」。
4. `04-clear.png` 过关结算：三枚印章 + 「步数 4/6 提示 0」+ 下一题/再挑战/题目列表。

★ 第 4 张第一次拍出来是**三枚全透明的空面板**：印章是 `alpha 0→1` 的补间，
headless 比墙上时钟慢约 7×，等 0.5 秒不够（改成 9 秒）。

## 下次从这继续

```bash
cd /e/plan/test25/kid-quest-farm-2d
npm run lint && npm test && npm run build
node scripts/check-plugin.mjs ../task-games/blockfit/dist-plugin/blockfit.plugin.mjs --assets ../task-games/blockfit/assets
# e2e 两档（端口从 4390+ 挑，先 netstat）
node scripts/e2e-plugin-local.mjs http://127.0.0.1:<port> phone
node scripts/e2e-plugin-local.mjs http://127.0.0.1:<port> tablet
```

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 沙箱自带代理（`HTTP_PROXY` 的 62xxx）允许清单不同，对这个站 exit 56 —— 别拿它判死。
- 常用端口 4180/4190/5190 常年被占；本工程默认端口：假宿主 **4410** / 拍图 **4411** / smoke **4399**。
- `--browse` 会把 `favicon.ico` 抓成 **0 字节**，`find -size 0` 必须为空 ⇒ 抓到后删掉。
