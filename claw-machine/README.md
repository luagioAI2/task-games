# 爪爪乐 · PAW PLAY（宿主里的名字：抓娃娃）

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `claw3d`（⚠️ 目录名是 `claw-machine`，不是 id） |
| 商城名 | 抓娃娃（`tabLabel` 也是这三个字） |
| 版本 | 1.0.1（`src/plugin/index.ts` 的 manifest，与宿主 `public/games/index.json` 必须一致） |
| 来源 | **自研**（three + Rapier），不是扒的 |
| 经济形态 | 积分 → 币 → 玩一局；抓到当场 `mintVoucher` 发券 |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'claw3d'` |
| 商城截图 | `shots/smoke-*.png` → `public/store/claw3d/*.webp`（`npm run smoke` 拍的是当前构建） |
| 打包 / 部署 | `npm run plugin` / `npm run plugin:deploy` |

A mobile-first 3D claw machine in the browser, styled after current Chinese mall Gen-2 cabinets (white glossy body, bright accent, LED rims, circular PRIZE OUT). **Play: https://hejuntt1014.github.io/claw-machine/**

![idle](screenshots/1-idle.png)

- **Look:** procedural Gen-2 cabinet — white clearcoat body, pink/yellow/cyan accent themes (chip on the HUD), aluminium frame, breathing LED edge strips, backlit “爪爪乐 / PAW PLAY” lightbox, cute geometric backboard with an original blob mascot (not a licensed IP), circular illuminated 取物口, caster wheels. Soft glass UI cards replace the old retro LED board.
- **Physics:** Rapier3D (WASM, `-compat` build — wasm inlined). Pendulum claw, motorized prongs, random grip, chute → pickup window, take-out animation.
- **Desktop & mobile:** portrait deck / landscape side columns, keyboard + mouse + touch + gamepad, theme chips, fullscreen, safe-area insets.
- **One cabinet, no neighbours.** The row of neighbouring machines was removed with the move to a single set of camera positions — they physically blocked the side view (gaps of only 0.14 between cabinets). See [机位](#机位cameras).

## Two ways to run it

This repo ships **the same engine** in two forms. `src/app.ts` is the game;
the two entries only differ in where the money and the save file live.

| | 独立网页（`src/main.ts`） | 宿主插件（`src/plugin/index.ts`） |
| --- | --- | --- |
| 根节点 | `document.body` | 容器里的 `.claw-root` |
| 存档 | `localStorage` | `host.storage`（`gameKv`，自动带游戏 id 前缀） |
| 币 | 本地一个数，用完可「领取 10 币」 | 宿主账本：**积分买币**，只进不出 |
| 奖品 | 只记进背包 | `host.mintVoucher()` 当场发兑换券 |
| 样式 | 整页（`style.css` 原样） | `scopeCss()` 加 `.claw-root` 前缀后注入 |
| 卸载 | 不需要（关页面就没了） | **必须真收干净**：rAF / 监听 / WebGL / rapier world |

插件版的目标宿主是 `kid-quest-farm-2d`（`GameBundle` 契约 v4，`minHostApi: 4`）。

## File map

```
src/app.ts          引擎本体 —— createClawApp(root, kv, wallet) → { destroy }
src/main.ts         独立版入口（localStorage 存档 + 免费领币）
src/plugin/index.ts 插件入口 —— manifest + mount/unmount + 钱包适配
src/plugin/html.ts  自动生成：<body> 的 DOM 字符串（别手改）
src/plugin/css.ts   自动生成：style.css 字符串（别手改）
src/plugin/scope-css.ts  给每个选择器加根前缀
src/physics.ts      Rapier 物理 + 吊爪状态机（无渲染，可无头跑）
src/models.ts       机台建模 + 材质表（**懒建，每次挂载换一套**）
src/plush.ts        娃娃建模（毛发壳层 + 顶点变形）
src/textures.ts     程序化贴图（canvas 画的，没有图片资源）
src/audio.ts        WebAudio 合成音效（没有音频资源）
```

## 为什么插件必须打单文件

宿主用 `blob:` URL `import()` 插件，那个模块里：

- **相对 import 会以 `blob:` 为基准解析** ⇒ 404；
- **裸说明符（`from "three"`）没有 import map** ⇒ 解析不了；
- **动态 `import()` 会拆出第二个 chunk**，宿主只拿到一个 URL ⇒ 拿不到。

所以 `scripts/build-plugin.mjs` 把 three、rapier（wasm 内联）、DOM 字符串、
样式字符串全塞进一个 `.mjs`（约 5 MB / gzip 1.8 MB）。

## Commands

```
npm install
npm run dev
npm run build      # 独立版；base /claw-machine/，VITE_BASE=./ for other hosts
npm test           # 无头物理模拟（test/sim.ts）—— 不需要浏览器

npm run smoke        # 独立版冒烟（要先 build + vite preview）
node scripts/probe-fit.mjs http://localhost:4394/claw-machine/   # 取景占用率（3 视口 × 2 机位）
npm run plugin       # 打单文件插件包 → dist-plugin/claw3d.plugin.mjs
npm run plugin:check # 只自检已有产物
npm run plugin:deploy# 打包 + 拷进 ../kid-quest-farm-2d + 重算 sha256
```

部署之后在宿主那边：

```
cd ../kid-quest-farm-2d
npm run lint && npm run build
npx vite preview --port 4396 --strictPort
node scripts/e2e-plugin-claw3d.mjs http://127.0.0.1:4396/
```

## 机位（cameras）

只有**一台**机器、**两个**机位，胶囊按钮切（`#views`，就在顶栏下面一行；宽屏挂右上角）。
`V` 键切换，`1` / `2` 直接选。取奖窗那个蹲下视角（`goDoor`）不算机位，回来时回到原机位。

| 机位 | 方位角 | 看到什么 |
| --- | --- | --- |
| 正面 `front` | `0` | 灯箱招牌 + 取物口 + 娃娃堆，玩起来的主视角 |
| 侧面 `side` | `1.40 rad`（≈80°） | 从右侧看柜体厚度、吊爪吊绳、投递轨道，像站在机器旁边 |

改这里之前值得知道的四件事（都是踩出来的）：

1. **机台宽度是量出来的，不是写死的。** `models.ts` 的 `machineExtent()` 对**静态**几何求包围盒，
   `app.ts` 的 `frameOf()` / `fitDist()` 按它算距离。原来写死 `halfWide: 0.72 / halfNarrow: 0.62`，
   比真机（`hx 0.582` + 台面深度 `hz 0.70`）小 ⇒ 机台溢出画面（实测 `hFill 1.543`）。
   ⚠️ 包围盒**必须排除** `hub` / `cable` / `prongs` —— 它们每帧在动，算进去会让相机每帧推拉。
2. **`OrbitControls` 会静默把方位角夹回去。** `minAzimuthAngle` / `maxAzimuthAngle` 原来写死 ±1.0，
   而侧面是 1.40 ⇒ 按下按钮只转到 57° 就不动了，**看起来像按钮没生效**。
   现在 `AZ_LIMIT` 由 `CAM_SPEC` 推出来。`smoke.mjs` 用 `atan2(x, z)` 钉住这条。
3. **`camera.far` 太小会裁成一块白。** 曾经是 `30`，取景距离算到 16.7 之后相机落在 z≈18，
   机台整个被远平面切掉，截图里只剩一个小白块 —— 而 `Vector3.project()` 给出的坐标**完全正常**，
   所以「投影对不对」说明不了「画面对不对」。现在是 `60`。
4. **画质自动降档要避开启动那几秒。** 判定窗口原来从 `playStart` 起 1.5 秒就开始采样，
   正好压在着色器编译上 ⇒ 每次都掉到「低」。现在 `+4s` 才开始、窗口 4 秒。

验收：`node scripts/probe-fit.mjs <url>` 量机台在画面里的宽/高占用和四条边距；
`npm run smoke` 里的 `framing()` 对两个机位断言「机台完整在可视区内、高度占满 > 0.5」。
插件版在真宿主里的取景见 `kid-quest-farm-2d/scripts/_shoot-cam.mjs`（宿主 TabBar 在插件外面，插件自己量不到）。

## UI / hints
- One toast at a time, top-centre under the HUD (icon + title + detail), 200 ms fade/slide: 投币成功 · 请先投币 · 剩余 5 秒 · 抓住了！· 差一点 / 滑掉了 / 没抓住 (classified from what the claw actually carried)
- Persistent state chip above the drop button (投币开始游戏 / 对准娃娃 / 下爪中… spinner)
- First-run 3-step guide (skippable, remembered; replay from 设置), out-of-coins sheet, settings popover (配色 · 画质 · 声音), win card with live 3D turntable of the prize, collection grid

## Performance
`node test/perf.mjs` (headless SwiftShader): mobile 中画质 653 → 512 draw calls, 2.34M → 1.06M triangles; desktop 高画质 790 → 544 calls, 3.61M → 1.57M triangles; JS heap 62 → 47 MB.
