# 接入进度 · 下落的2048（fall2048）

- 地址：https://vp8stka3kk.mkplay.zone/v/29/index.html
- 商城名：下落的2048 · 底栏 2048
- 经济：B 只花积分、不产出兑换券 · 票价 1（`playCost: 1` / `expectedPayout: 0` / `voucherPerCoin: 0` / `capPerPrize: 1`）
- 当前：步骤 9 待提交（1~8 全部做完，远程链路 22/0 通过）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | `_scrape-report.json`：22 文件 4.21 MB；`failed` 2 条均已定性（`sound.manifest.js` 用不到、`OpenHuninn.woff2` 故意不加载）；运行时补下 4 个音频（`sound.pack` + 3 条 `.m4a`） |
| 2 | 立工程 | ✅ | `index.html` 重写（去 importmap、`lang=zh`）；`.gitattributes` = `* text=auto eol=lf`；首次提交 `79fc3e7` |
| 3 | 压资源 | ✅（跳过） | 原包只有 22 个文件、最大两个是 2.08 MB 字体（不加载）和 1.62 MB rapier（引擎，不能动）⇒ 没有可压的图；`dist-plugin` 合计 4.8 MB，其中 2.4 MB 是三条 BGM |
| 4 | 改造（去内购/排行/云存档 + 经济） | ✅ | `gp.pay` 0 处、`gp.fonts` 0 处；`submitScore` / `openProfile` 只剩 1 处且都在 `window.gp?.pay?.available` 或 `profileAvailable===true` 守卫里；排行榜改读 `a.myScores`（本地成绩），文案改「我的成绩 / マイ記録 / My scores」 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===`；入口 2040.4 KB；资源 4800.0 KB；裸说明符 0；动态 import 0；补丁锚点 5 条（`__fall2048Dead` / `__fall2048Teardown` / `function ie0(` / `__fall2048SoundManifest` / `__fall2048Asset`）；**构建前先 `make-asset-manifest.mjs --check`**，清单过期直接 exit 1 |
| 6 | 落库 | ✅ | `public/games/index.json` v1.0.3 + `localGames.ts` 哈希 `605aa926d1bb…` + `storefront.ts` + `build-store-shots.py` PLAN 四处一致；后端 `game` / `wish_item` / 盲盒池 24 款；`game_release` 活跃 = `1.0.3` |
| 7 | 商城详情 | ✅ | `public/store/fall2048/1~4.webp`（31.9 / 29.0 / 23.8 / 32.3 KB），源图 `screenshots/store-1~4*.png` 由 `scripts/store-shots.mjs` 现拍 |
| 8 | 五层验收 | ✅ | 本地真宿主探针 42/0；远程 LAN+HTTPS 探针 22/0（下载→设当前→挂载→扣 1 分→play→`sound.pack`→退出停循环）；`tsc` / `lint` / vitest 见步骤 9 |
| 9 | 提交 | 🔄 | 两个仓库都有未提交改动：本工程 `M game.js i18n.js index.html` + `?? assets/audio gp-shim.js plugin.js screenshots scripts sound.pack`；宿主 `M index.json build-store-shots.py GameIcon.tsx localGames.ts storefront.ts` + `?? public/games/fall2048 public/store/fall2048` |
| 9b | 推送宿主 | ⬜ | 推的是宿主 worktree 的 `online` 分支；判据 = `git ls-remote --heads origin` 的 SHA == 本地 HEAD |

## 决策（别重问）

| 问题 | 决定 |
| --- | --- |
| 商城名 | 下落的2048（底栏 `2048`） |
| 门票 | 只花积分、不产出兑换券（`playCost: 1`，`expectedPayout: 0`） |
| 扭蛋 | **留** —— 花的是游戏内金币，皮肤的唯一来源，和 App 积分不通 |
| 排行榜 | 改成本地成绩（`a.myScores`），标题改「我的成绩 / マイ記録 / My scores」 |
| 字体 | **不加载** `OpenHuninn.woff2`（2.08 MB ≈ 整包 40%），`gp-shim` 故意不提供 `fonts.use` |
| 存档 | 走 `host.storage`（本地优先，宿主统一存档接口） |
| 重置说明 | 1.0.2 修过一次：原文写「排行榜最高分保存在服务器上」—— 排行榜早就本地化了，那是假话。实际行为是 `sn()` 先 push 一份快照进 `a.history`（最多 10 份，设置里能翻到）⇒ 文案改成「最好成绩会先存进『重置前的记录』」 |
| 资源清单 | 1.0.3 补的 `assets/manifest.json`（其余 21 款都有，只它和 `redbutton` 没有）。**改了资源必须重跑** `node scripts/make-asset-manifest.mjs`，否则打包会直接失败 |

## 三个「只能这样」的改动

1. **`window.__fall2048Asset`**：原版画金币是 `new Image().src="assets/ui/icon_coin_selected.svg"`，
   相对**文档**解析。插件挂在 `/` 下 ⇒ 变成 `/assets/ui/...`：本地预览拿到 SPA 兜底的 index.html
   （200 但解码失败）、线上直接 404，**两种都不报错**，症状只是「金币变成一个纯色圆」。
   ⇒ `plugin.js` 把 `ctx.assetUrl` 挂到 `window.__fall2048Asset`，`game.js` 改走它。
2. **`sound.pack` 是懒加载**：解锁只拉起流式 `.m4a`，包里 60 条音效要等**第一次真播音效**才下载。
   ⇒ 探针必须先真掉一块再断言，否则恒红。
3. **`ie()` → `ie0()` 扣分闸**：`charge()` 在线上会走 `/api/wallet/spend` + 整轮 `refresh()`，
   几秒才回来。⇒ 探针等 `balance === before-1`，不能睡固定时间。

## 下次从这继续

步骤 9：`cd task-games/fall2048` 提交 → `cd kid-quest-farm-online` 提交 → 跑
`node scripts/check-game-registry.mjs --check` / `npx tsc -b --noEmit` / `npm run lint` / `npx vitest run`。

## 环境坑

- 抓镜像必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`，直连 `mkplay.zone` 是 000）。
- 后端发布用 `8091`（`8090` 已停，避免两个 SQLite 写者）；`--key` 取 `tf-platform-api/configs/config.yaml` 的
  `ServiceSettings.AdminSignKey`，缺了会直接报「缺 --key」。
- 自签证书：Node `fetch`/`undici` 会拒，探针里 `NODE_TLS_REJECT_UNAUTHORIZED=0`。
- 商店截图固定 `390×844` DPR2；对局图**必须先热身一局再重开**，否则一次性「获得称号！」提示压在井口。
- E 盘常年接近满 ⇒ 构建/zip 输出走 `C:/tmp/`。
