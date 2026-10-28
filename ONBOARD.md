# 接入进度 · 画马赛跑（doodlederby）

- 地址：https://vvb96grafh.mkplay.zone/v/6/index.html
- 原名：**Doodle Derby**（`一场不太正经的运动会`）—— 手绘一匹马 → 变成 3D 马 → 踩节奏赛跑
- 商城名：画马赛跑 · 底栏「画马赛跑」（4 字）
- 经济：**C 型纯玩** · `expectedPayout: 0` · `kind: 'chill'` · 票价 10 积分/一场
- 引擎：three.js（3D 画室 + 赛道）+ `@makeplay/{display,sound,fx}`；DOM 界面层（index.html 里一堆 id）
- 资源：待抓完统计
- 当前：步骤 1 抓镜像

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | 🔄 | `failed` 为空；`find -size 0` 为空 |
| 2 | 立工程 | ⬜ | `index.html` 重写；`.gitattributes` 写 `* text=auto eol=lf`；首次提交 |
| 3 | 压资源 | ⬜ | 前后 KB；压完重看截图 |
| 4 | 改造 | ⬜ | 联网四处归零（排行榜 / 录像库 / 名字翻译 / 云存档） |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致（21 款） |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交推送 | ⬜ | `ls-remote origin refs/heads/farm-2d` == HEAD |

## 要拆的联网面（§0.5 报价）

| 功能 | 实现 | 处理 |
| --- | --- | --- |
| 世界排行榜 | `src/world-board.js` + `archive.board()` / `archive.upload()` | 入口按钮藏掉，模块保留但不打开 |
| 录像库（回放对手） | `src/archive-client.js`，`archive.sample()` / `enter()` | 恒离线 ⇒ 对手全是电脑选手（原版本来就有 bot 补位） |
| 名字三语翻译 | `gp.ai.chat`（`custom-name.js` / `nameRoller`） | 不翻译，用本地名；**`randomNames()` 与 `NAME_TABLE` 是纯本地的**，随机名字照常可用 |
| 云存档 | `gp.player.saves.latestSync` / `putLatest()` | ★ **这是唯一存档通道** ⇒ 必须接到 `host.storage`，否则一个字节都不落盘 |
| 登录 | `gp.player.requestLogin()` | 离线分支已自带（`platform.js` 的 `playerBridge()` 会造一个 offline bridge） |

**没有**内购 / 抽卡 / 体力 / 签到 / 每日任务 / 兑换码 —— 要拆的全是「联网附加功能」，不碰核心玩法。

## 收费点（初判）

「03 送它去比赛」= 一场比赛 = 一局 ⇒ 在开赛那一刻扣 10 积分。
画马 / 3D 预览 / 起名 / 选赛制 全免费（那是这款游戏的核心乐趣，不能收）。

## 环境坑

- 抓站必须 `--proxy http://127.0.0.1:7897`（直连 mkplay.zone 是 000）。
- `node` 传 MSYS 风格 `/c/...` 会解析成 `E:\c\...` ⇒ 脚本路径写 `C:/Users/...`。
- `scaffold.mjs` 的 `--dir` 是**相对当前目录**拼 ⇒ 在 `task-games/` 里跑必须给 `--dir .`。
- 这台机器端口常被占（4180/4190/5190/4391/4394）⇒ 预览从 **4390+ / 5390+** 里挑没被占的。
