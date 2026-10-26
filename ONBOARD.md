# 接入进度 · 挖矿少女（minergirl）

- 地址：https://udf38ynwyj.mkplay.zone/v/13/index.html
- 原站自称：**深渊矿业公司 / Abyss Mining Co.**（`saveKey: abyss-mine:v2`）
- 商城名：**挖矿少女** · 底栏 `挖矿`
- 经济：**B 只花积分** · 进场 15（`mount()` 里扣一次 + 10 分钟宽限，同 anthill）
- 拆改：删内购（`gp.pay` 皮肤商店 / 用硬币招募投资人）、删全服排行榜与登录云同步；
  **皮肤保留，改成按矿场进度解锁**
- 当前：步骤 1 🔄（正在抓镜像）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | 🔄 | `failed` 为空；`find -size 0` 为空；资源张数与玩法对得上 |
| 2 | 立工程 | ⬜ | `index.html` 重写；首次提交；`smoke.mjs` 四条全绿 |
| 3 | 压资源 | ⬜ | 前后 KB + 最差 PSNR；**压完重看截图**（scale 是否除设计稿常数） |
| 4 | 改造（去内购/排行/云存档 + 经济） | ⬜ | `gp.pay` / 排行榜 / 登录 计数归零；`?qa` 假钱包删除 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `npm run check:registry` 四处一致 |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归（sugar 或 prizepark） |
| 9 | 提交 | ⬜ | `git status` 干净 |

## 侦察结论（开工前偷看的结果，省得抓完才发现是另一个站）

- 结构：`index.html` 只有 `#app` + `./game.js` → `./src/main.js`（`#app` 被 `src/dom.js` 注入界面）
- 引擎：**PixiJS**（`../lib/pixi.min.js`，站内自带；importmap 里那堆 three/phaser/rapier 是 MakePlay 的通用表，实际没用）
- 已带宿主协议钩子：`window.__gpReady` / `window.__gpPlayable` —— 说明原作者就是按本宿主的
  「加载中 / 可玩」两个阶段写的，插件化应该比扒来的站薄
- 存档：`src/save.js`，`CONFIG.saveKey = 'abyss-mine:v2'`，每 5 秒自动存档
- 玩法：矿道（`data/layers.js` 的 `LAYERS` / `SHAFTS_PER_LAYER`）→ 矿工 → 电梯 → 仓库 → 卖矿
  → 升级 / 开新矿道 / 炸岩障 → 雇管理员自动化 → 重开矿场（prestige）换投资人
- 三种语言：`i18n.js`（zh / en / ja，31898 字）
- 要拆的三块：
  1. `src/data/skins.js` —— 皮肤商店，`coins: 8` 走 `gp.pay`（真钱），`pending()` 补发
  2. `src/rank.js` + `LEADERBOARD.json` —— 全服排行榜（`RANK_MAX` 必须与远端 `maxRaw` 一致）
  3. `i18n` 里的 `rank.guest`「登录后就能上榜，进度也会同步到云端」→ 登录 / 云存档

## 下次从这继续

步骤 1：`node <skill>/scripts/scrape.mjs <url> task-games/minergirl/_originals/2026-10-26 --proxy http://127.0.0.1:7897 --browse --wait 9000`

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`；沙箱自带的 `HTTP_PROXY`（62xxx）对这个站 exit 56。
- Node 22 的 `fetch` 不读 `HTTPS_PROXY`；且 `fetch` 与 `ProxyAgent` **必须从同一个包取**
  （宿主 `node_modules/undici` v8 vs Node 内置 v6，混用报 `invalid onRequestStart method`，
  症状是 `fetch failed`，看着像站点挂了）。
- 常用端口 4180/4190/4391 常年被别的项目占着；起服务后先验「服务的到底是不是我的构建」。
