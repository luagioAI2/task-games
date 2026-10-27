# 接入进度 · 尖叫鸡（screamchick）

- 地址：https://xruzbtmnsf.mkplay.zone/v/7/index.html
- 商城名：尖叫鸡 · 底栏 尖叫鸡（3 字）
- 经济：**C（纯玩）** · `playCost: 10` · `expectedPayout: 0` · **收费点 = 进一关**
- 当前：步骤 9 完成（等推送宿主）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | PixiJS + `game.js` 单入口 + `levels.js`（**50 关**）+ `i18n.js`（zh/en/ja）；有 `sound.manifest.json`；**内购**：`window.gp.pay` 卖「三星通行证」1 平台币/关 ⇒ 必须整块删 |
| 1 | 抓镜像 | ✅ | 静态 2 个假失败（`sound.manifest.js` / `open-huninn/...woff2`），`--browse` 补到 `sound.manifest.json` + `OpenHuninn.woff2`；**流式音频两条靠 `fetch-audio.mjs` 补齐**（见坑 1） |
| 2 | 立工程 | ✅ | `index.html` 改成 `import { start }` 再 `start({})`；`src/host.js`（宿主 store / localStorage store） |
| 3 | 压资源 | ✅ | `23 张：6.60 MB → 964 KB（−86%）`；PSNR 合成到白底后最差 **33.8 dB**（`donut`），删掉原 PNG + 没人用的 `coin.webp`；`assets/` **4.0 MB / 24 文件** |
| 4 | 改造（插件化 + 删内购 + 经济） | ✅ | `grep window.gp` **0 命中**；整块商店删干净（`PASS_PRICE` / `buyPass` / `openShop` / `tickets` / `paid` / `bought`）；`game.js` 全体包进 `start(opts)`（1931 行） |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===` · 968.5 KB · 裸说明符 0 · 动态 import 0 · `check-plugin` 全 ✓（3 条提示见下） |
| 6 | 落库 | ✅ | `check:registry` → **四处登记一致（清单 / 哈希 / 商城 / 截图源）**，13 款 |
| 7 | 商城详情 | ✅ | `public/store/screamchick/1..4.webp`（24.9 / 21.1 / 19.0 / 20.2 KB）+ `GameIcon.tsx` 的 `Screamchick`；13 款详情走查全过、图都解码了 |
| 8 | 五层验收 | ✅ | `check-plugin` ✓ · `lint` ✓ · `vitest 774/774` · `mount-test` 40 项 ✓ · **e2e phone + tablet 全过** · `prizepark` 老款回归全过 |
| 9 | 提交 | ✅ | 两个仓库 `git status` 干净 |
| 9b | 推送宿主 | ⬜ | `ls-remote` 的 SHA == 本地 HEAD（**不是**看 `git status` 的 `[gone]`） |

## 这一款和别的不一样的三件事

### 1. 收费点 = 「进一关」，所以**没有宽限期**

`startLevel()` 里 `await chargePlay()`，`loadLevel()` 自己**不扣** ⇒
「下一关」「重玩」都不再收钱，也不需要 corgi/anthill 那套 `paidAt` + 10 分钟宽限。

★★ 挂载本身**一分不扣**。所以 e2e 第 ④ 段的断言方向和 corgi **相反**：
余额 0 时插件**照常挂载**、标题屏正常画出来、0 扣；点「开始」才弹「积分不够」。

### 2. 整屏是 canvas，e2e 没有选择器可点

加了一条只读调试桥 `window.__screamchick`：

```js
{ ready, state(), move(d), restart, startLevel, buttons() }
```

`buttons()` 走 `overlay`，收集 `eventMode === 'static'` 且带 `PIXI.Text` 的节点，
返回**设计空间**坐标。`mountDisplay` 把 renderer `resize` 到容器的 CSS 尺寸 ⇒
设计坐标 == 容器内 CSS 像素（scale 1、无 letterbox），所以 `page.mouse.click(box.x + b.x, …)`
在 phone / tablet 上都对。

**卸载必须删掉它**（`if (window.__screamchick === debugBridge) delete …`），
否则第二次挂载的「已就绪」判据会被上一次留下的对象骗过去。

### 3. 滑动手势只认 `pointerdown` + `pointermove`

`app.canvas` 上 `pointerdown` 记起点，`window` 上 `pointermove` 超过 **24 CSS px**
才判方向（左右取 dx、上下取 dy），`pointerup` 才轮到「点空地」。派 `click` 是**静默无反应**的。

## 环境坑

- `mkplay.zone` 直连 000 ⇒ 必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 给 node 传路径要用 `E:/plan/...`（Windows 形式）；`/e/plan/...` 会被解析成 `\e\plan\...`。
- heredoc 里带 `${}` / `\s` 会被 bash 吃掉 ⇒ 脚本一律用 Write 工具落盘再跑。

## 坑（都是这次真踩到的）

### 1. ★★ 第四类漏抓：流式音频，`0 个 404` 也证明不了「齐了」

`sound.manifest.json` 里 `music.main` 是**流式**的（`assets/audio/bgm.m4a` 952,770 B），
标题屏根本不请求它；`sound.pack`（96,546 B）也是进场景才加载。
静态扫和 `--browse` 都收不到，症状是**整局没音乐且零 404**。

⇒ `scripts/fetch-audio.mjs`：按清单逐条核字节（pack 容差 ±8192 认容器头，流式逐字节），
结果 `2/2 条就位`。

### 2. ★★ headless 比墙上时钟慢约 7 倍，补间延迟要按游戏秒算

过关面板三颗星的补间是 `delay 0.25 / 0.47 / 0.69` **游戏秒**。
`settle(3800)` 只亮 1 颗、`settle(7000)` 还是 1 颗，**`settle(14000)` 才三颗全亮**。
颜色种类判据抓不到过渡态（每次都 ≥20），只有人看截图才发现。

### 3. ★ 包根目录的文件要两处都铺

游戏用 `asset('sound.manifest.json')` 取音频清单，而 `assetBase` 指向**包根**。
`build-plugin.mjs` 只铺 `assets/` 时：假宿主 404，真宿主的安装脚本去拷一个不存在的源文件
⇒ `ENOENT`，看着像磁盘坏了。

⇒ `build-plugin.mjs` 末尾加 `for (const f of ['sound.pack', 'sound.manifest.json'])`；
`install-to-host.mjs` 的 `ROOT_FILES` 同步列出。

### 4. 字体不在 `fonts/`，在 `assets/fonts/`

第一版 `FontFace` 指向 `fonts/OpenHuninn.woff2`（包根），文件却在 `assets/fonts/`
⇒ smoke 报 `4xx/5xx 1: 404 /fonts/OpenHuninn.woff2`。改成 `asset('assets/fonts/OpenHuninn.woff2')` 后 0 个 4xx。

### 5. 打包偶发一次 `Rolldown` 报错，重跑即过

第一次 `build-plugin` 在 `buildEnvironment` 抛错（只有栈没有可用信息），
**原样重跑就过**，连跑两次都稳定 ⇒ 当成偶发，别去改配置。

## `check-plugin` 的 3 条提示（都确认过，不是问题）

1. `voucherPerCoin` 缺省 —— C 型，本来就不换券。
2. `document.head` —— 注入一条 `.${scope} canvas{display:block}`，选择器收在根类名下。
3. `document.body` —— Pixi 内部引用（`app` 挂载前的尺寸探测），不是我们自己 Portal。
