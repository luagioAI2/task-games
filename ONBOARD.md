# 接入进度 · ropeland（跳绳羊群）

## 决定（已定，不再改）

| 项 | 值 | 说明 |
| --- | --- | --- |
| 来源地址 | `https://zsdau6qcgc.mkplay.zone/v/2/index.html` | MakePlay 导出，竖屏 2D，PixiJS v8 + DOM UI |
| 插件 id | `ropeland` | 目录名 == id，全小写 ≤12 |
| 商城名 | 跳绳羊群 | 4 汉字（2–5） |
| tabLabel | 跳绳羊 | 3 字（≤5） |
| emoji | 🐑 | 不在黑名单（🪙🎟️💎🕹️） |
| tint | grass | |
| 经济形态 | **B**：积分 → 门票；游戏内「羊毛」只用于升级/外观，可换券 | 有明确「一局」（0 铃 = 结束） |
| 收费点 | **每局开始扣**（`newRun`/「开始跳绳」点下去那一刻） | 有「一局」这个动作，不是放置类 ⇒ 不走 `mount()` 进场扣费 |

## 待定数值（步骤 4 定稿）

| 项 | 值 | 依据 |
| --- | --- | --- |
| `playCost`（积分/局） | 待定 | 一局 ≈ 60–120 秒，看 `currentBpm()` 与 3 铃容错 |
| `expectedPayout`（羊毛/局） | 待定 | `woolGain = survivors + peakSheep`，需实测 |
| `voucherPerCoin` | 待定 | 源码 `platform.js` 原本直接用平台硬币买外观（真实货币），已拆 |
| `kind` | `play` | 会产出羊毛 → 券，非 chill |

## 进度

| # | 步骤 | 状态 | 判据 |
| --- | --- | --- | --- |
| 1 | 抓取镜像 | ✅ | `_originals/2026-10-26/` 39 文件 9.08 MB；`find -type f -size 0` **为空**；13 张 `sheet-*.webp` sha256 **全对**；`sound.pack` payload sha256 对（`MPSND1` XOR 解包后 121406 B） |
| 2 | 脚手架 | ✅ | `index.html`（634 B，importmap 指向本地 `engines/` `runtime/`）、`assets/ engines/ runtime/ game.js i18n.js platform.js sound.manifest.json sound.pack` 齐；`assets 5.2M / engines 780K / runtime 3.2M` |
| 3 | 冒烟 | ✅ | `shots/smoke-1.png` 标题页 1309 色、0 报错；`shots/smoke-2.png` 局内 2297 色 |
| 4 | 压资源 | 🔄 | 体积降幅；`bg/*.jpg` 与 sprites **不许缩尺寸**（`layoutBg` 按 `size=max(900,visH+20)` 铺、精灵用固定设计宽） |
| 5 | 去插件化 + 经济 | ⬜ | 0 处 `gp.` / `pay`；0 处排行榜/登录；外观商店改成游戏内币；每局扣费点唯一 |
| 6 | 打包插件 | ⬜ | `check-plugin.mjs` 全绿；产物 0 个裸说明符、0 个动态 import、有 `mount`/`manifest` |
| 7 | 宿主登记五处 | ⬜ | `npm run check:registry`（含 `--self-test`）；`GameIcon.test.tsx` 绿 |
| 8 | 商城详情页图 | ⬜ | ≥3 张，首图看懂玩法；每张有说明；来自当前构建 |
| 9 | 五层验收 | ⬜ | 手机 + 平板各跑一遍 `e2e-plugin-local.mjs`；整轮 0 个 404 |
| 10 | 提交 | ⬜ | 宿主仓库 + 游戏仓库各一条 |

## 本机环境坑（这次真踩到的）

1. **必须走代理**：`mkplay.zone` 直连 000，抓取一律 `--proxy http://127.0.0.1:7897`。Node 22 的 fetch **不认** `HTTPS_PROXY`，只能走参数。
2. **`--browse` 会把拿不到的写 0 字节**：12 张 `sheet-*.webp` 全 0。必须按各 anim `manifest.json` 的 `files[]` 逐张重下并**校验 size + sha256**。
3. **`scaffold.mjs` 的相对 `--dir` 是相对它自己的 CWD**（在 skill 的 `scripts/` 下），会把整个工程建到 `skills/.../scripts/task-games/ropeland` 并自带 git init。**必须给绝对 `--dir`**。（已删掉误建目录）
4. **`/tmp` 与 Python 看到的 `/tmp` 不是同一个地方**：curl 到 `/tmp/x` 看着成功、之后文件不存在。一律下到工作区内。

## 要拆掉的东西（`game.js` / `platform.js` 清单）

- `platform.js` 整个文件：`gp.player.saves` 存读档 → `host.storage`；`gp.pay.purchase` 真实货币购买 → 删；`topScores/submitScore` 排行榜 → 删；`weekIndex()` 本周特殊羊（时间闸门）→ 删。
- `game.js` 里的 `simModal` / `doBuy` / `buying` / `SHOP_ITEMS` 硬币商店 → 改成游戏内羊毛购买或直接删。
- `openBoard` / `lbHtml` / `openProfile` / `recoverPending` / 登录入口。
- `loadFonts` 里的 `https://static.makeplay.ai/...` 外链兜底 → 走 `ctx.assetUrl`。
- 模块顶层碰 `window` / `document`（`document.head.appendChild(css)`、`document.getElementById("app")`、`document.title`、4 个 `window.addEventListener`、`document.addEventListener("visibilitychange")`、`new PIXI.Application()`）→ 全搬进 `start(opts)`。
