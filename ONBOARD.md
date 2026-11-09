# 接入进度 · 犬独（inudoku）

- 地址：https://d337snrctr.mkplay.zone/v/29/index.html
- 商城名：犬独 · 底栏 `犬独`（原版标题 `犬独 ～INUDOKU～`）
- 经济：B 只花积分、不产出兑换券 · 票价 1（`playCost: 1` / `expectedPayout: 0` / `voucherPerCoin: 0` / `capPerPrize: 1`）
- 当前：**1.0.1 已上架**（后端 release#51 / 心愿商城在架 / 盲盒池 25 款），五层验收全绿

> ⚠️ 和 `fall2048` **同一个 `/v/29/` 路径但是两款游戏**（那是「下落的2048」）。
> 别按路径判断，按 `ui.js` 里的 `document.title` 认。

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | `_peek-d337/_originals/2026-11-09`：48 文件 17 MB。`_scrape-report.json` 里 11 条 failed **全是静态扫描猜出来的假 404**（8 条 `assets/<breed>-ear/manifest.js`，实际是 `.json`）⇒ 补抓 8 个 `manifest.json` + `sound.manifest.json`（10272 B）+ `sound.pack`（3853622 B），0 个 0 字节文件 |
| 2 | 立工程 | ✅ | `scaffold.mjs` 立起；`index.html` 重写（去 importmap、`lang=zh`、`viewport-fit=cover`，51930 → 624 B）；`.gitattributes` = `* text=auto eol=lf`；首次提交 `2c68aec` |
| 3 | 压资源 | ✅ | PNG 全转 WebP（`compress-assets.py` 中途被 SIGTERM，改用 Pillow 脚本补齐，`poodle.webp` 曾经 0 字节已重转）；`assets/` 1.8 M / 40 文件；`assets/manifest.json` = 32 文件 1694 KB |
| 4 | 改造 | ✅ | `gp.pay` **整块不给**（买命 / 买皮肤 / 买 BGM 三条内购路径一起断）；`share.available=false`；`fonts.url()` 返回 `''`（不拉 CDN 字体）；自带 CSS 走 `scopeCss` 收进 `[data-inudoku-root]`；皮肤/BGM 改成**通关解锁**（`__grant()`：每 5 关一只狗、每 4 关一首曲子） |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===`；入口 4241.9 KB；资源 9722.6 KB；裸说明符 0；动态 import 0；补丁锚点 8 条（`boot(` / `window.__inudokuDisplay` / `__addW(` / `__inudokuTeardown` / `__inudokuCharge` / `function __grant(` / `window.__inudokuRoot` / `window.__inudokuAsset`）；构建前先 `make-asset-manifest.mjs --check`，清单过期直接 exit 1 |
| 6 | 落库 | ✅ | 本地四处一致（`index.json` v1.0.1 / `localGames.ts` 哈希 `e363ea80e44f…` / `storefront.ts` / `build-store-shots.py` PLAN）；后端 `game.status=available points=300` / `wish_item.archived=0` / 盲盒池 25 款 / `game_release` 活跃 = 1.0.1（release#51） |
| 7 | 商城详情 | ✅ | `public/store/inudoku/1~4.webp`（17.4 / 24.8 / 17.8 / 15.5 KB），源图 `screenshots/store-1~4*.png` 由 `scripts/store-shots.mjs` 现拍（已进 git） |
| 8 | 五层验收 | ✅ | 独立页：`smoke.mjs` 通过（canvas 1 · 颜色 401 种 · 4xx 0 · pageerror 0）、`play-check.mjs` 14/0、`check-plugin.mjs` 通过（3 条提示）；远程 LAN+HTTPS 探针 `_probe-inudoku-remote.mjs` **23/0**；`check-remote-package.mjs` 全过（32 条资源哈希）；`tsc` / `vitest` 见步骤 9 |
| 9 | 提交 | ✅ | 本工程 `2c68aec` → `a846e4a`（1.0.0）→ `acd82aa`（1.0.1 卸载修 RO）；宿主 `9a6e98e`（清单 / 哈希 / 商城 / 图标 / 截图 PLAN）；探针 `scripts/_probe-inudoku-remote.mjs` 按项目惯例不入 git（`scripts/_*` 被 ignore） |

## 决策（别重问）

| 问题 | 决定 |
| --- | --- |
| 商城名 | 犬独 |
| 门票 | 只花积分、不产出兑换券（`playCost: 1`，`expectedPayout: 0`） |
| 游戏内商店 | 皮肤和 BGM **留**（改成通关解锁），**买命砍掉** |
| 存档 | 走 `host.storage`（本地优先，宿主统一存档接口） |
| 内购 | 整块不给 `gp.pay` —— 原版 `gp.pay.purchase({itemId:"life1"})` 卖复活、卖皮肤、卖 BGM，给了 `pay` 就等于把三条真钱路径一起搬进来 |
| 分享 | 不给（`share.available = false`），原版是平台分享图 |
| 字体 | 不拉 CDN（`fonts.url()` 返回空串） |

## 内容量（文案口径要对齐）

| 项 | 实际数量 | 说明 |
| --- | --- | --- |
| 主线 | 36 关 | `levels.js`，4×4 起、12×12 止 |
| 进阶 | **16 题**（不是 18） | `advanced.js` 两章 `double` / `bone`，各 8 题。决策时说的是「36 关 + 18 道进阶」，实际是 16 ⇒ 所有文案统一写 16 |
| 皮肤 | 8 只 | `dogs.js`，柴犬免费，其余通关解锁 |
| BGM | 4 首 | `bgm.js`，第一首免费 |
| 成就 | 12 项 | `gp-shim.js` 本地定义 |

## 版本记录

| 版本 | 改了什么 | 为什么 |
| --- | --- | --- |
| 1.0.0 | 首版接入 | —— |
| 1.0.1 | teardown 里先断 `onResize` 回调、再 `display.dispose()`、最后 `p.destroy()` | 退出游戏后再拖窗口/转屏，宿主页抛 `Cannot read properties of null (reading 'screen')`（Pixi `renderer` 已为 null，RO 还活着） |

## 三个「只能这样」的改动

1. **`gp.player.saves.latestSync` 必须同步可读**：原版 `game.js` 在**模块顶层**就读它（决定标题页显示
   `start` / `new` / `continue`）。⇒ 插件 `mount()` 里 `await installGpShim(...)` **之后**才 `await boot()`，
   `gp-shim` 在 `install` 时同步把 `save:latest` 读出来塞进 `latestSync`。
   写盘走 300 ms 防抖（一次落子一事务会把 IndexedDB 打爆）。
2. **CSS 必须 scope**：`ui.js` 用 `document.head.appendChild(<style>)` 注入，里面有 `:root` / `body` /
   `.status` / `.badge` / `.controls` / `.message` 这类**通用选择器**，而且排在宿主样式之后 ⇒ 一进游戏整个
   App 的字体、字色、CSS 变量全变，退出也不还原。⇒ `css-scope.js` 把普通选择器加 `[data-inudoku-root]`
   前缀，`:root`/`html`/`body` 直接映射成根节点，`@keyframes`/`@font-face` 原样保留。
3. **扣分闸挂在「开一局」而不是「点一下」**：`qe()`（标题页「关卡 N」）和 `rn()`（棋盘上 `play`）两条入口
   都要 `await __payFor(level)`，判据是存档里的 `paid: ["lv:0", …]`：
   · 已付费的关卡重进**免费**；· 已通关的重玩**免费**；· 同一关失败 `retry` **免费**（一局三次命用完再收钱，
   孩子只会关掉游戏）；· 进阶题**不额外收**。
   ⚠️ 第一版只改了 `qe()`，`play-check.mjs` 立刻报 `0 → 0`（标题页那个「关卡 N」走的是 `play`）。

## 下次从这继续

1. 想再验一遍远端链路：`cd kid-quest-farm-online && node scripts/_probe-inudoku-remote.mjs`
   （默认打 `https://192.168.101.12:4443`，用 `PROBE_ORIGIN` / `PROBE_OUT` 覆盖）。
2. 改过游戏包 ⇒ 升版本 → `node scripts/build-plugin.mjs` → 同步 `public/games/inudoku`
   → `node scripts/make-local-catalog.mjs` → `npm run check:registry` → 发布。
3. 后台/心愿侧若有改动：`--verify-only` 一条命令就能核对三处状态。

## 环境坑

- 抓镜像：这台机器对 `d337snrctr.mkplay.zone` **代理反而不通、直连 Node `fetch` 能过**（和
  `mkplay.zone` 其它子域相反）⇒ 先直连试，失败再挂 `127.0.0.1:7897`。
- `sizes_9.webp` 直连 `UND_ERR_CONNECT_TIMEOUT`，挂 `https_proxy` 才下来 —— 同一站点不同文件也可能不一样。
- 语法自检别写 `/tmp/_g.mjs`（bash 的 `/tmp` 与 node 的不是一个目录，报 `E:\tmp\_g.mjs` 找不到）⇒ 放工程内 `.tmpcheck/`。
- `ui.js` 里 `getElementById("app")` 有 **3 处**，不是 1 处。
- 商店截图：① 每放一只狗前都要点一次 `[data-action="dog"]`（原版放对一只就自动切回笔记模式）；
  ② 第 1 关是 4×4 四只狗，放满 4 只就过关弹结算 ⇒ **只放 3 只**；
  ③ 对局页没有 home 按钮，要先 `[data-action="settings"]` 再 `[data-action="home"]`。
- `check-plugin.mjs` 仍会提示 `document.body` —— 来源是打包进来的 `pixi.min.mjs`（引擎内部量尺寸 /
  无障碍钩子），插件自己的 DOM 全在 `[data-inudoku-root]` 下，属已知无害项。
- E 盘常年接近满 ⇒ zip 输出走 `C:/tmp/`。
