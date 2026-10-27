# 接入进度 · 方块填空（blockfit）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://da22ty94rk.mkplay.zone/v/4/index.html`
- 商城名：方块填空（4 字，底栏也用这个）· id `blockfit`
- 形态：PixiJS v8 纯 2D，多联骨牌拼满矩形（15 道主线 + 随机计时挑战），3 语（ja 主 / en / zh）
- 经济：**C 型 / `chill`** —— 每开一局 **10 积分**，不产出任何宿主资源
- 开始：2026-10-27 09:50
- 当前：步骤 0 侦察完成，待抓镜像

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | 见「侦察结论」：无内购/抽卡/签到/任务/兑换码；在线榜 + 分享要拆 |
| 1 | 抓镜像（静态 + `--browse`） | ⬜ | `failed` 为空；`find -size 0` 为空 |
| 2 | 立工程（scaffold） | ⬜ | `index.html` 重写；首次提交 |
| 3 | 压资源 | ⬜ | 前后 KB + 最差 PSNR；**压完重看截图** |
| 4 | 改造：去在线榜/分享 + 插件化 + 经济 | ⬜ | `grep -c "gp\.player\|gp\.share"` = 0 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库（四处登记） | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情（文案 + 4 张图） | ⬜ | `public/store/blockfit/1..4.webp` |
| 8 | 五层验收 | ⬜ | 静态 / lint+单测 / 假宿主 / 两档 e2e / 截图走查 |
| 9 | 提交（两个仓库） | ⬜ | 两边 `git status` 干净 |

## 侦察结论（步骤 0，2026-10-27）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| 内购 / 抽卡 / 签到 / 每日任务 / 兑换码 / 联机 | **全部没有**（`grep gacha\|shop\|loginBonus\|mission\|redeem` 0 命中） | 不用拆 |
| 在线排行榜 | `gp.player.topScores(10)` + `submitScore()`，`rankTab === "online"` 分支 | **删**（`buildRanking` 的 else 分支 + `showTaResult` 的提交块 + 在线页签） |
| 本机排行榜 | 最多 8 个玩家档案，按最佳用时排序，纯本地 | **保留**（一家人轮流刷成绩，是这个游戏的价值） |
| 分享 | `gp.share.snap/image`（`captureShare` / `addShareRow` / 结局页 / 挑战结算页 4 处） | **删**（宿主里没有分享目标） |
| 云存档 | `gp.player.saves.latestSync` / `putLatest` / `ready`（3 处） | 换 `host.storage`（键 `save`） |
| 登录 | `gp.player.ready → user.locale` 只用来定语言 | 删，语言取宿主/存档 |
| 广告 | 无 | — |
| 语言 | ja 主 / en / zh | 保留，默认 zh |
| 引擎 | 纯 PixiJS v8（PIXI 72 处，THREE/Rapier/Phaser 0 处）+ `@makeplay/sound` + `@makeplay/fx` | 内联进包 |
| 资源 | 5 张 PNG 字面量 + `sound.manifest.json` + `sound.pack` | 抓全后压 webp |
| 玩法 | 15 道主线（第 1 道解锁，其余按上一道通关解锁）+ 随机池计时挑战；每题 3 枚印章（通关 / 无提示 / 基准步数），共 45 | 收费点 = 点题卡「开始」/「计时挑战·开始」 |

## 经济决策

- **C 型**：一分券都不产出（`expectedPayout: 0`、`voucherPerCoin: 0`），`kind: 'chill'`。
- **票价 10 积分**：一局是一道题（几分钟），和 `moestrike` / `cloudfarm` 同档；
  `melonjar` 8（快节奏）、`anthill` / `minergirl` 15（放置类进场）、`ropeland` / `sugar` 20。
- **收费点在「开始一局」**：`startMain(i)` 与 `startTa()` 各扣一次。
  第 1 题**不是教学局**（教学是内嵌提示文字 `tutDrag/tutRotate/tutFlip`，不是独立免费关）
  ⇒ 首局也要扣，e2e 可以直接断言「点第 1 题 → 积分 -10」。

## 下次从这继续

跑步骤 1：

```bash
cd /e/plan/test25
node "C:/Users/admin/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs" \
  https://da22ty94rk.mkplay.zone/v/4/index.html \
  task-games/blockfit/_originals/2026-10-27 \
  --proxy http://127.0.0.1:7897 --browse --wait 9000
```

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 沙箱自带代理（`HTTP_PROXY` 的 62xxx）允许清单不同，对这个站 exit 56 —— 别拿它判死。
- 常用端口 4180/4190/5190 常年被占，预览端口从 4390+ 挑，起完先验「服务的是不是我的构建」。
