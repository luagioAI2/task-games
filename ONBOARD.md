# 接入进度 · 一分钟卡组（deckrush）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://k65swyemts.mkplay.zone/v/3/index.html`
- 商城名：一分钟卡组（5 字）· id `deckrush` · 底栏「一分钟卡组」
- 形态：PixiJS v8（canvas 战斗）+ **DOM 界面层**（`ui.js`，标题 / 设置 / 成就 / 图鉴都是真 DOM）
- 玩法：60 秒抽卡构筑卡组（gacha 三选一）→ 6 关卡牌战斗（能量 / 格挡 / 敌人意图）→ 通关回血进下一关
- 经济：**C 型 / `chill`** —— 每开一局 **10 积分**，不产出任何宿主资源
- 开始：2026-10-27 11:10
- 当前：**已接入完成**（2026-10-27 收工）。两款仓库都已提交，`git status` 干净。

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | 零 `gp.pay` / 零内购 / 零签到 / 零联机；要拆的只有在线榜 + 分享 + 平台成就 + 云存档（见「侦察结论」） |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | 63 个文件；`failed` 只剩 3 条确认过的 404（`${fontUrl}` 模板串、`sound.manifest.js`、站上字体）；**0 个 0 字节文件** |
| 2 | 立工程（scaffold） | ✅ | commit `a23617d`；`index.html` 重写（**11:55 又改了一次**：加 `start()` 调用，见「事故」） |
| 3 | 压资源 | ✅ | 站上本来就是 webp（47 张 1.03 MB）；**只做体检**：`find -size 0` 为空、字面量 14 条全在 |
| 4 | 改造（去在线榜/分享 + 插件化 + 经济） | ✅ | `_patch.py` 26 个锚点各命中 1 次；`submitScore`/`onShare`/`captureShare`/`shareBlob`/`player.ready` 全 0 |
| 5 | 打包 | ✅ | `dist-plugin/deckrush.plugin.mjs` 4230 KB；裸说明符 0 · 动态 import 0 · 四个引擎全内联 |
| 6 | 落库（五处登记） | ✅ | `install-to-host.mjs` → 11 款；`localGames.ts` 里 `deckrush v1.0.0 50f4b49e5c9e…` |
| 7 | 商城详情（文案 + 4 张图） | ✅ | `tint: berry` / `chill` / 4 张 shots 各配说明；`PLAN` 一行；出图 `1.webp 28.2 / 2.webp 47.4 / 3.webp 50.5 / 4.webp 23.3 KB`；**4 张全部人工看过**（第一版 2/4 张不对，见「事故」） |
| 8 | 五层验收 | ✅ | ① 静态 ✅（3 条提示，逐条确认无问题）② `lint` 0 · `test` **774/774** · `build` 成功 ③ 假宿主 **30/30** ④ e2e 手机 390×844 **全绿** + 平板 672×966 **全绿**（容器高 == 父容器 966）⑤ 详情页 11 款走查全绿，deckrush 图标/图/说明看过 |
| 9 | 提交（两个仓库） | ✅ | 游戏库 `14409b0`（35 个文件）· 宿主 `9155c6e`（73 个文件）· 两边 `git status` 空 · 提交后重跑 `check:registry` 仍「四处登记一致」· 库里的 blob 字节与磁盘逐字节相同 |

## 侦察结论（步骤 0，2026-10-27）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| 内购 / 抽卡（真钱）/ 签到 / 每日任务 / 兑换码 / 联机 | **全部没有**（`shop`/`IAP`/`purchase`/`loginBonus`/`mission`/`ranking`/`versus`/`redeem` 全 0 命中） | 不用拆 |
| 「gacha」 | 是**玩法**（构筑阶段抽卡三选一），不花任何货币，纯游戏内 | 保留 |
| 在线排行榜 | `gp.player.submitScore(stage*1000 + …)`，`gp_pi_submitScore()` 一处，best-effort try/catch | **删**（宿主没有榜单） |
| 平台成就 | `gp.player.achievements.unlock/list`（8 个成就） | **改本地**：`host.storage` 里存已解锁集合，否则成就页永远是空的 |
| 分享 | `gp.share.snap` → `captureShare()` / `shareBlob` | **删** |
| 云存档 | `gp.player.saves.latestSync` / `putLatest` / `clearLatest` / `get("__sys_best")` / `put` | 换 `host.storage`（键 `run` / `best` / `ach`） |
| 登录 | `await gp.player.ready` + `user.locale` 定语言 | 删；语言取存档，默认 **zh** |
| 字体 | `gp.fonts.url("google-fonts-apache/luckiest-guy/…ttf")`（站上 404） | 直连 static.makeplay.ai，失败回落系统字体（原代码已有 `.catch(() => NUM = JP)`） |
| 引擎 | 纯 PixiJS v8 + `@makeplay/display` / `fx` / `sound` | 内联进包 |
| 资源 | 14 张 **webp**（bg 4 / cards 5 / tutorial 2 / hero / icons / dragon）1.03 MB | 本来就压过，压资源这步只做体检 |
| 存档粒度 | 一局 = 构筑 + 6 关战斗，中途可 `继续`（`hasResume`） | 收费点 = 标题屏点「开始」（`onStart(true)`），**点「继续」不收费** |

## 改造清单（步骤 4）

| 改动 | 落点 | 为什么 |
| --- | --- | --- |
| `gp` 适配层 | `src/host.js` 的 `installGp(store)` | 6 类调用散在 game.js，逐处改会让两种形态分叉 |
| 模块顶层 `await` → `export async function start(opts)` | `game.js` | 顶层 await 的模块无法二次挂载 |
| 卸载函数 | `start()` 返回 | `app.destroy({texture:false})` + `display.dispose()` + 摘 window 监听 + 删 `__dbg`/`__gpPlayable`/`__gpReady` + 还原 `<html lang>` |
| 开局收费 | `uiHost.onStart(fresh)` | 「继续」是接着上一局，不该再收一次 |
| 在线榜 / 分享 | 整块删 | 宿主里没有账号、没有分享目标 |
| 资源路径 | `src/asset.js` 的 `A()` | 插件是 `blob:` 模块，相对路径以 blob 为基准 ⇒ 全 404 |

## 事故（都是这一轮真踩的，改之前先看）

| 症状 | 真因 |
| --- | --- |
| 独立网页**全白、canvas 0、一个错都不报** | `game.js` 改成 `export async function start()` 后模块体不再自执行，而 `index.html` 还挂着 `<script src="./game.js">` ⇒ 什么都没跑。入口必须改成 `start({container})` |
| 按钮看得见、点不到，控制台干净 | `mountDisplay({...})` 没给 `host` ⇒ 它量的是 `#app`/`document.body`（整个视口），canvas 比容器大，超出部分在容器外 |
| 整局没有音乐，且 0 个 404 报错 | ① 清单路径写的 `./sound.manifest.json` ⇒ blob 下解析失败；② 三首音乐是**流式变体**（`variants[*].url`），静态扫和 `--browse` 都抓不到 ⇒ 要按清单里的 `bytes` 补抓 |
| 一按「回标题 / 暂停 / 结算」就抛 `Cannot read properties of undefined (reading 'then')` | `save()` 里是 `putLatest(...).then(...)`；可选链**只挡 nullish**，方法存在就会调 ⇒ 我们那个 `putLatest` 返回了 `undefined`。**必须返回 Promise** |
| 切走后按键盘报一堆 null | `window.addEventListener("keydown", (e) => …)` 是**匿名**的，卸载摘不掉。改成具名 + `removeEventListener` |
| 切回来「已就绪」但画面是旧的 | 卸载只摘了 `__gpPlayable`，`__gpReady` 还留着 ⇒ 第二次挂载的等待条件立刻为真 |
| 详情页截图：中间那张牌被一团白光糊住 | 抽卡会放 `magic-area-pulse`（fx，**不是 tween**）。只等 `tweens === 0` 不够，要再等一段 |
| 详情页截图：手牌三张叠在一起还在飞 | 只等 `hand.length >= 3` —— 状态位在**动画开始**时就变了。判据要 `snap().tweens === 0` |
| 详情页截图：战斗画面上压着「自动补充了 10 张基础牌」 | 用了 `finishBuild(true)`（超时强制）。要**先抽满 10 张**再 `finishBuild(false)` |
| 战斗中点「卡牌图鉴」不换屏 | 战斗 UI 优先级更高，`uiModel.screen` 被覆盖。图鉴那张要在**标题屏**拍 |
| `check:registry` 报「源图没进 git」 | 不是被 ignore，是截图**还没 `git add`**（它查的是 `git ls-files`） |

## 下次从这继续

**本款已收工。** 只有改动本款时才需要重跑下面这套（顺序别换：先 build 再起服务，
否则 e2e 验的是旧构建）。

```bash
cd /e/plan/test25/task-games/deckrush
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs     # 改过源码就得重打
node scripts/mount-test.mjs --port 4412                            # 假宿主 30 条

cd ../../kid-quest-farm-2d
CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4394 --strictPort   # 必须后台跑
node scripts/e2e-deckrush.mjs http://127.0.0.1:4394/ phone
node scripts/e2e-deckrush.mjs http://127.0.0.1:4394/ tablet
npm run check:registry
```

> 起完服务先确认「服务的是不是我的构建」：`curl` 拿到的 `dist/assets/index-*.js`
> 文件名要和 `ls dist/assets` 一致。端口被别人占着时 `--strictPort` 绑不上，
> 但 `curl` 照样 200 —— 整套 e2e 会跑在**别人的 App** 上。

**接下一款新游戏**：不要从头摸索，照抄这四份（都是本款踩完坑的终版）：

| 抄哪份 | 干什么 |
| --- | --- |
| `scripts/build-plugin.mjs` | 引擎别名 + 裸说明符/动态 import/导出检查，改 `GAME_ID` 和引擎清单即可 |
| `scripts/mount-test.mjs` | 假宿主 8 组断言（含跨挂载持久化、CSS 作用域） |
| `scripts/capture.mjs` | 4 张商城图 + `waitIdle` 等动画收尾 |
| `plugin.js` | manifest / 容器定位补丁 / `ctx.assetUrl('')` / 收费点 |

流程与判据在 `kid-quest-farm-2d/docs/game-onboarding.md`；自动化在 skill
`scrape-game-into-farm`。

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- ★ **给 node 传路径要用 `E:/plan/...`（Windows 形式）**：`/e/plan/...` 会被解析成 `\e\plan\...`
  （落在当前盘根），脚本不报错、文件凭空消失。这次已经踩过一遍。
- 端口：假宿主 **4412** / 出图 **4413** / e2e **4394**；4390+ 与 5390+ 先 `netstat`。
- 拍图与 e2e 都跑在 headless 上，**游戏时钟比墙上时钟慢约 7×** ⇒ 一律轮询状态，不写固定 sleep。
