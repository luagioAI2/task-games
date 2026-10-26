# 接入进度 · 爆汁瓜瓜罐（melonjar）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://r7y9bq7hrp.mkplay.zone/v/12/index.html`
- 商城名：爆汁瓜瓜罐（5 字，底栏也用这个）· id `melonjar`
- 形态：PixiJS + Rapier2D，西瓜合成罐（落果堆叠），3 语（zh/en/ja）
- 经济：**B 型 / `chill`** —— 每开一局 **8 积分**，不产出任何宿主资源
- 开始：2026-10-26 12:50
- 当前：步骤 1–9 全部完成（2026-10-27 收尾：补跑 lint / 单测 / 两档 e2e，提交源码）

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | **40 个文件 / 24 MB / 0 个 0 字节**；见「抓取实录」 |
| 2 | 立工程（scaffold） | ✅ | 提交 `1055d07`（`chore: 从镜像立起工程`），工程根 = `task-games/melonjar` |
| 3 | 压资源 | ✅ | 24 张图 **14.10 MB → 402 KB（−97%）**，最差 PSNR **30.39 dB**；`assets/` 里只剩 webp（26 个文件 / 2.8 MB） |
| 4 | 改造：去内购 / 排行；定经济 | ✅ | `grep -c "gp\.pay" game.js` = **0**（只剩注释里一句）；复活 / 摇一摇改花宝石；`#shop-btn` / `#rank-btn` / `#board-screen` 已删 |
| 5 | 打包 | ✅ | `dist-plugin/melonjar.plugin.mjs` **5852 KB**，裸说明符 0 · 动态 import 0 · 五引擎全内联 |
| 6 | 落库（四处登记） | ✅ | `npm run check:registry` → **四处一致**（接这款时是 7 款，2026-10-27 复核为 **9 款**：本地包 9 · 哈希 9 · 商城 9 · PLAN 9 行） |
| 7 | 商城详情（文案 + 4 张图） | ✅ | `public/store/melonjar/1..4.webp`（22/29/19/21 KB）；文案见 `storefront.ts` |
| 8 | 五层验收 | ✅ | 静态 ✅ / 假宿主挂载 ✅ / `lint` exit 0 + `npm test` **774/774** / `e2e-melonjar` **手机 + 平板全绿** / 截图走查 ✅（实测值见下） |
| 9 | 提交（两个仓库） | ✅ | 宿主 `338ea7b`（含 minergirl）；本仓库 `webp 转换 + game.js 改造` 一条（见「资源改 webp」一节） |

## 侦察结论（步骤 0）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| 内购 | `gp.pay.purchase` **2 处**（复活 4 币 / 摇一摇 2 币）+ `pending()` / `ack()` 启动补发 | **整块删**；两项便利改花**宝石**（12 / 25），宝石只能靠玩挣 |
| 排行榜 | `submitScoreOnce()` → `gp.player.submitScore`；`topScores(10)`；`#board-screen` | 删函数 + 删面板 + 删按钮 |
| 云存档 | `gp.player.saves` 19 处（`__sys_meta` / `__sys_best` / 自动存档） | 保留形状，`installGp()` 装成本地实现（落 `host.storage`） |
| 每日 | `dailyKey()` + `seedFrom()` + `mulberry32`，按日期播种的挑战局（有 streak），不产出 | **保留**（不联网也能玩） |
| 分享 / 登录 | `gp.share.image()` / `gp.player.requestLogin()` | `share` 缺席 ⇒ 按钮自己 `hidden`；登录按钮同样隐藏 |
| 广告 / 抽卡 / 签到 / 兑换码 / 联机 | 无 | — |
| 语言 | 3 语 | 保留 |

> ⚠️ 侦察时记的「宝石包」是误读：`CONSUMABLES` 只有 `shake` / `revive` 两项，
> 没有第三个商品。以 `grep -n "purchase("` 的实际命中为准。

## 抓取实录（步骤 1，2026-10-26）

- `--browse` 一遍只拿到 27 个文件，其中 **6 张水果图是 0 字节**（f02–f06、f11），
  而且 **f07–f10 连文件都不存在** —— 只查「文件在不在」会全绿。
  原因：`fruitUrl(l) = assets/fruits/f${pad2(l)}.png` 是模板字符串拼的（来源 ③），
  首屏只加载 f01，其余要合出来才请求。
- 按可预测路径直抓，补齐 **f01–f11 共 11 档**。
- `sound.manifest.json` 被静态扫成了 `sound.manifest.js`（404）⇒ 直接请求拿到 8073 B；
  按里面的 `url` 补了 `sound.pack`（69 KB）和 BGM mp3（2,365,141 B）。
  ★ **mp3 的 sha256 与清单里的 `sha256` 逐位一致** —— 这条可以当「音频抓全了」的硬判据。
- 成就图标 `assets/achievements/${key}.png` 同样是模板拼的，按 i18n 里 8 个 key 补齐。
- 最终：**40 文件 / 24 MB / 0 个 0 字节**。

## 改造清单（步骤 4）

| 改动 | 落点 | 为什么 |
| --- | --- | --- |
| `gp` 适配层 | `src/host.js` 的 `installGp(store)` | 原版 54 处 `gp.*`，逐处改成 `host.*` 容易漏，而且两种形态会分叉 |
| 开局收费 | `game.js` 的 `gate()` / `payForRun()` | 三个开局动作（开始 / 再来一局 / 每日挑战）都过它，一处收费 |
| 资源根 `A()` | `ASSET` + `A(p)` | `blob:` 模块里相对路径以**文档**为基准 ⇒ 全 404，而 404 的正文是 HTML，报错长得像 JSON 解析错 |
| CSS 作用域化 | `scope-css.js`（从 moestrike 抄，根选择器改 `#ui-root`） | 这份样式里全是 `.btn` / `.chip` / `.panel` / `[hidden]`，直接进 `head` 会盖掉宿主 Tailwind |
| 尺寸按容器 | `--cw` / `--ch` 由 `relayout()` 写 | 原版用 `vw` / `vh`；宿主里容器 ≠ 视口，面板会顶到顶栏底栏上 |
| 成就本地化 | `ACHV_TARGET` 表 + `list()` | 原版 `target` 由平台下发，本地实现没有它就永远是 0/0 且永不亮 |

## 资源改 webp（2026-10-27 收尾时补的记录）

24 张 PNG **14.10 MB → 402 KB（−97%）**，最差 PSNR **30.39 dB**。`assets/` 现在 26 个文件 /
2.8 MB，**一个 `.png` 都不剩**（`find assets -name "*.png" | wc -l` = 0），宿主那边同样是 24 个 webp / 0 个 png。

三处必须同时改，漏一处就是「一片 404，而报错长得像打包坏了」：

1. `game.js` 里的引用（`.png` → `.webp`）—— 判据 `grep -c "\.png" game.js` = **0**；
2. `assets/manifest.json` 重跑 `scripts/make-asset-manifest.mjs`（26 条哈希）；
3. `dist-plugin/assets/` 与宿主的 `public/games/melonjar/assets/`（靠 `install-to-host` 或重新打包）。

⚠️ 中间态备份 `_game.bak.js`（86598 字节，HEAD 是 84965、当前 87973）与两个探针脚本
`_probe.mjs` / `_emoji.mjs` 留在了磁盘上但**没有入库** —— `.gitignore` 加了 `_*.mjs` / `_*.js`。
**没有删它们**：仓库干净靠规则，不靠删文件；真要清理由人决定。

### 第 8 步的实测值（2026-10-27 补跑）

| 环节 | 手机 390×844 | 平板 1024×768 |
| --- | --- | --- |
| 几何 | 容器高 == 父容器（698/698）· canvas 铺满 390×698 · 容器中心没被底栏盖住 | 同 |
| 标题屏 | 292 色 | 同 |
| 开一局 | 积分 **150 → 142**（−8）· 兑换券 0 不动 · 游戏币余额 0 | 同 |
| 对局画面 | 671 色 | 679 色 |
| 切走 | `__gpPlayable` / `__gpReady` 全摘 · `<style>` 摘掉 · canvas 0 · `gameKv` 有 melonjar 行 | 同 |
| 切回 | 重新挂载本身不扣分（142→142）· 画面 292 色 · canvas 仍 1 | 画面 459 色 |
| 第二局 | **再扣 8**（142 → 134）—— 按局收，没有宽限 | 同 |
| 异常 | 0 个 console.error | 同 |

宿主侧 `lint` exit 0、`npm test` **774/774**、`check:registry` 四处一致（9 款）。

## 本机踩到的坑（都验证过）

1. ★★ **`playCue` 是 async，没解锁时返回的是被 reject 的 Promise** —— `try/catch` 抓不到，
   症状是每次点击一条**未捕获 rejection**（画面完全正常，只有控制台红）。
   判据：`pageerror` 计数。修法：`p.catch(() => {})`。
2. ★★ **`assets/` 里混着压缩前的原图 PNG**（15 MB，24 张），`build-plugin` 整目录复制
   ⇒ 包从 8.6 MB 涨到 23 MB，而游戏里一个 `.png` 都不引用。判据：`grep -c "\.png" game.js` = 0。
3. ★★ **`node scripts/build-plugin.mjs | tail -2` 会吃掉退出码** —— 打包崩了也照样往下跑，
   拿旧 bundle 拍图，图全是旧的。判据：看输出里有没有 `=== 打包校验通过 ===`。
4. ★ **emoji 字形**：摇一摇按钮原来是 `🫙`（Unicode 14，2021），Android 11 及更早没有 ⇒ 空心方框。
   改成**内联 SVG**（罐子 + 两侧抖动弧），与语言无关。headless 里本机根本没有 emoji 字体，
   所以「截图里是方框」不能当判据 —— 只能按 Unicode 版本判断。
5. ★ **给假宿主播种存档必须排在 `unmount()` 之后**：卸载时 `store.flush()` 会把上一局
   写出来的 `achv` 写回存储，先播种就被盖掉（症状：图里还是全未解锁）。

## 下次从这继续

九步全完，不用再动。要改它：

```bash
cd E:/plan/test25/task-games/melonjar
# 改 game.js / src
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs   # 判据：输出有「=== 打包校验通过 ===」
node scripts/mount-test.mjs                                     # 假宿主，先过这一关
# 改了行为就升 plugin.js 里的 manifest.version
node scripts/install-to-host.mjs                                # 拷包 + 改清单 + 重算哈希
# 只改介绍 → storefront.ts + build-store-shots.py 的 PLAN，然后
cd ../../kid-quest-farm-2d && npm run check:registry && npm run lint && npm test
node scripts/e2e-melonjar.mjs <url> phone && node scripts/e2e-melonjar.mjs <url> tablet
```

**改资源**还要多做一步：`scripts/make-asset-manifest.mjs` 重跑，否则宿主校验报「哈希对不上」，
而人第一反应会去查打包 / 网络。
⚠️ 跑 e2e 前先确认 `npm run build` 输出里有 `built in`，否则验的是旧 bundle。
⚠️ 两个重活 e2e 别并行跑（互相饿死）。

**步骤 9**：两个仓库分别提交。宿主是 worktree ⇒ `git commit -F` 要给 **Windows 路径**。

### 本机特有：抓取必须走代理

```bash
node <skill>/scripts/scrape.mjs <地址> <项目>/_originals/<日期> --proxy http://127.0.0.1:7897 --browse --wait 9000
```

`mkplay.zone` 直连是 000，Node 的 `fetch` 不读 `HTTPS_PROXY`；沙箱自带的代理（62xxx）对这个站 exit 56。

### 源站有没有更新？（2026-10-27 02:16 查过：没有）

有人再拿 `https://r7y9bq7hrp.mkplay.zone/v/12/index.html` 来问「扒一下接进商城」时，
先跑这一条再决定要不要重扒 —— **这款已经接完并验过了**：

```bash
curl -sS -x http://127.0.0.1:7897 -o _originals/_live/index.html \
  "https://r7y9bq7hrp.mkplay.zone/v/12/index.html"
md5sum _originals/2026-10-26/index.html _originals/_live/index.html
```

实测两份 **md5 都是 `d90e724d58f61695fc79fcc693c6779a`**（44707 字节，逐字节相同）
⇒ 站点从 10-26 到现在一个字节都没变，没有可搬的东西。
查完把 `_originals/_live/` 删掉，别让它混进以后 `diff -rq _originals/<日期>` 的对比里。

⚠️ `curl` 是 Windows 程序，`-o /tmp/x` 会写到 **bash 看不见的地方**（`stat` 报不存在）。
一律下到工作区内的路径。
