# 接入进度 · 旋转灯泡（sweetspin）

- 地址：https://wgcmeua7be.mkplay.zone/v/4/index.html
- 原版名：Sweet Spin（`GAME_TITLE`）
- 商城名：旋转灯泡 · 底栏 旋转灯泡（4 字）
- 经济：**C（纯玩）** · `playCost: 10` · `expectedPayout: 0` · **收费点 = 进一关**
- 当前：步骤 1 抓镜像（进行中）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | Canvas 2D（`@makeplay/display` 的 `mountDisplay` + `attachCanvas`，**不是 Pixi**）；`game.js` 48 KB + `levels.js`（确定性六边形关卡生成器，**100 关**）+ `i18n.js`（zh/en/ja）；`sound.manifest.json`；**内购** `gp.pay.purchase`（1 平台币 = 5 次提示）⇒ 整块删；**在线排行榜** `gp.player.topScores` ⇒ 整块删；存档走 `gp.player.saves` ⇒ 改 `host.storage` |
| 1 | 抓镜像 | 🔄 | `failed` 为空；`find -size 0` 为空；流式音频按清单核字节 |
| 2 | 立工程 | ⬜ | `index.html` 重写；`game.js` 顶层 `await` 改成 `start(opts)` |
| 3 | 压资源 | ⬜ | 前后 KB + 最差 PSNR；**压完重看截图** |
| 4 | 改造（去内购/排行 + 经济） | ⬜ | `grep "gp.pay\|topScores"` 归零；提示改成游戏内资源（开局 3 / 首次通关 +1 / 上限 9） |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致（14 款） |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | e2e phone + tablet + 老款回归 |
| 9 | 提交 | ⬜ | `git status` 干净 |
| 9b | 推送宿主 | ⬜ | `ls-remote` 的 SHA == 本地 HEAD |

## 下次从这继续
步骤 1：`node "C:/Users/admin/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs" https://wgcmeua7be.mkplay.zone/v/4/index.html E:/plan/test25/task-games/sweetspin/_originals/2026-10-27 --proxy http://127.0.0.1:7897 --browse --wait 9000`

## 环境坑
- `mkplay.zone` 直连 000 ⇒ 必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 给 node 传路径用 `E:/plan/...`；`/e/plan/...` 会被解析成 `\e\plan\...`。
- `/tmp` 在这台机器上写不进去 ⇒ 临时文件一律放仓库内（`task-games/_peek14`）。
- 预览端口从 **4390+** 挑（4391/4393/4396 已被别的款用过，先 `netstat`）。

## 决策记录
- 商城名用户选定「旋转灯泡」（备选：糖果管道 / 甜蜜旋转 / 六角点灯）。
- 经济 C 纯玩、每关 10 分：和 `blockfit` / `screamchick` 一致 —— 星星是「三星/关」的评级，
  硬做成产出会把它变成刷分工具。
