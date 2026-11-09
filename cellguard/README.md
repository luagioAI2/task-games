# 细胞守卫 · cellguard

扒自 `https://26qsd8yjaz.mkplay.zone/v/2/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `cellguard` |
| 商城名 | 细胞守卫 |
| 版本 | `1.0.0`（改完包必须升，且与宿主 `public/games/index.json` 一致） |
| 扒取来源 | https://26qsd8yjaz.mkplay.zone/v/2/index.html |
| 扒取日期 | 2026-10-28 |
| 入口模块 | `./game.js` → `start(opts)` |
| 插件入口 | `plugin.js`（manifest + mount + 开局收费） |
| 原始镜像 | `_originals/2026-10-28/`（不入 git） |
| 经济形态 | **C 纯玩**：一局 10 积分，`expectedPayout: 0`，不发券、不发行宿主币 |
| 收费点 | 点「开始战斗」→ `game.js` 的 `i()` 里 `await chargePlay()`；「继续战斗」不收费 |
| 体积 | 299 KB 单文件（无资源：美术程序绘制，音频列表为空） |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'cellguard'` |
| 商城截图 | `screenshots/store-1..4.png` → `public/store/cellguard/*.webp` |

## 现在能跑吗

```bash
node server.js <port>        # 或任意静态服务（⚠️ 不能用 python -m http.server：
                             # 这台机器上它把 .js 回成 text/plain，模块被浏览器拒绝）
```

改造前的自检：页面能开、**控制台 0 个 404**、核心玩法点得动。

## 常用命令

```bash
node scripts/build-plugin.mjs      # → dist-plugin/cellguard.plugin.mjs（单文件 ESM）
node scripts/install-to-host.mjs   # 拷进宿主 + 改 index.json + 重算 localGames.ts
node scripts/capture.mjs           # 重拍 screenshots/store-1..4.png（对当前构建）
node scripts/_probe.mjs            # 逐屏走查（临时图进 shots/probe/，不入库）
```

⚠️ 独立网页（`index.html`）和插件调的是**同一个** `start(opts)`；改了 `game.js`
两处都会变。但独立网页用内存存档（不碰 localStorage），插件里走 `host.storage`。

## 改造记录（2026-10-28）

原版是「手游化」的：体力 / 每日任务 / 七日签到 / 挂机宝箱 / 每日免费福利 /
登录云同步。这些是把手游留在孩子手机上的钩子，和这个 App 的目的（用游戏换任务）
相反，**整条拆掉**（拆法逐条记在 `ONBOARD.md`）。保留的是游戏本体：
关卡、三选一词条、武器与英雄养成、商店（只花游戏内的钻石）。

美术全部是**程序化绘制**（图标是 SVG data URL、战斗是 canvas），
音频列表 `kn` 是空数组 ⇒ 整包一个文件、没有 `assets/`。
