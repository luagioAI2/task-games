# 接入进度 · 柯基屁屁（corgi）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://hw9mzzjpe2.mkplay.zone/v/1/index.html`
- 站上标题：`Duang Duang 柯基屁屁`
- 商城名：**柯基屁屁**（4 字）· id `corgi` · 底栏「柯基屁屁」
- 形态：Phaser 3.90（UMD，**懒加载**，见「事故 1」）+ `@makeplay/sound`，`<script type="module" src="game.js">`
- 玩法：**养成**（撸狗 / 投喂 / 换装 / 羁绊值 `bond` / 零食 `snack` / 舞台 `stage` / 选美转生）
- 经济：**C 型 / `chill`** —— `mount()` 收一次 10 积分 + 10 分钟宽限，`paidAt` 写存档；
  `expectedPayout: 0`、不写 `voucherPerCoin`（一分产出都没有）
- 开始：2026-10-27 15:40 · 完成：2026-10-27 17:0x
- 当前：**步骤 9 提交**

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | 零内购/抽卡/排行榜/联机/兑换码/联网；平台面只有 `saves` + `fonts` + `locale` + `ready`（10 处）；资源是**运行时拼路径**（type ③） |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | 219 个文件 11.2 MB；`failed` 14 条**全是静态扫把 `costume/…` 解析到页面根**的假失败（逐条核对本地都有）；权威清单 `assetDefs()` **205 项 0 缺失**；0 个 0 字节文件；补抓 `sound.pack` / `audio/bgm.m4a` / `bg-title-p.jpg` |
| 2 | 立工程（scaffold） | ✅ | `index.html` 重写（43986 → 1126 字节）；`phaser.min.js` 本地化到 `engines/`；smoke 0 个 4xx / 0 pageerror / 3515 种颜色 |
| 3 | 压资源 | ✅ | **跳过压缩**：205 张里 199 张站上就是 webp（4.42 MB），只有 6 张 jpg 背景；只做体检（`find -size 0` 为空、205 项清单全在） |
| 4 | 改造（插件化 + 经济） | ✅ | `_patch.py` 11 条锚点各命中 1 次；`plugin.js` 216 行（mount / 收费 / 存档 / 卸载）；**另外两处手改见「改造清单」**：Phaser 懒加载、`detectLang` 加守卫 |
| 5 | 打包 | ✅ | `dist-plugin/corgi.plugin.mjs` **1894 KB**；裸说明符 0 · 动态 import 0 · Phaser + sound 都内联；`check-plugin` 通过（3 条提示：`document.head` / `document.body` 是 Phaser 内部） |
| 6 | 落库（五处登记） | ✅ | 本地包 **12 款** / 哈希 12 条 / 商城 12 条 / PLAN 12 行（`check:registry` 绿）；`install-to-host --check` 通过；宿主 `public/games/corgi/` = 包 + assets 207 + `sound.pack` + `sound.manifest.json` + `fonts/` 3 |
| 7 | 商城详情（文案 + 4 张图） | ✅ | `public/store/corgi/` 4 张 webp（41 / 27 / 29 / 30 KB）；`capture-store-detail` **12 款全绿**；4 张图 + 图标放大**都自己看过** |
| 8 | 五层验收 | ✅ | ①`check-plugin` 通过 ②`lint` 0 错 · 单测 **774** 全绿 ③假宿主 **39/39** ④e2e **phone 64/64 · tablet 64/64** ⑤详情页走查 12 款 |
| 9 | 提交（两个仓库） | 🔄 | corgi 已提交；宿主待提交（两边 `git status` 要空） |

## 侦察结论（步骤 0，2026-10-27 15:40）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| `gp.*` 平台调用 | **10 处，全部在 4 个面上**：`player.saves`（8）、`player.user.locale`（1）、`player.ready`（1）、`fonts.use/url`（2） | 写一层 `installGp` |
| `submitScore` / `share` / `achievements` / `pay` | **一处都没有** | 不用拆 |
| 内购 / 真钱抽卡 / 每日任务 / 兑换码 / 联机 / 联网 | **全 0**：`fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` 全 0，`https?://` 字面量全 0 | 不用拆 |
| `localStorage` | **0 处**（存档只走 `gp.player.saves`） | 适配层直接映射到 `host.storage` |
| 签到（`ck`，7 天连签） | **是游戏内玩法**，发游戏内爱心，不碰宿主资源 | 保留 |
| 每日任务（`tk`，5 选 3） | 同上，游戏内 | 保留 |
| `cloud` / `ad` 关键词 | 假命中：`cloud` 是代码画的云朵纹理，`ad` 是别的单词里的子串 | 忽略 |
| 存档模型 | **槽位制**（不是单个 blob）：`getLatest()` / `putLatest(s)` / `list(100)` / `get(id)` / `create(d,name)` / `update(id,d)`，设置存 `__sys_settings` 槽 | 适配层要**完整实现 6 个方法** |
| 引擎 | **Phaser 3.90.0（UMD，全局脚本）** + `@makeplay/sound` | Phaser 改成**懒加载**（事故 1） |
| 资源路径 | **运行时拼**（type ③）：`setPath('assets/')` + `assetDefs()` 逐条拼；标题背景 `bg-title-${W<H?'p':'l'}.jpg` | `setPath` 换成注入的 base |
| 音频 | 清单 12 条：`music.bgm` 是 **stream**（`assets/audio/bgm.m4a`，947 KB，**不在包里**）+ 11 条打包进 `sound.pack`（90,689 B payload） | 两个文件都补抓了；`loadSoundSystem()` 默认 `./sound.manifest.json` ⇒ **必须显式传 manifestUrl** |
| 收费点 | 养成/放置，没有「一局」 | `mount()` 收一次 + 10 分钟宽限，`paidAt` 写存档 |
| 要拆的 | **只有** `Made with MakePlay` 水印 div + 3 个 `data-mp-*` 注入脚本（scaffold 会剥） | 其余全留 |

## 改造清单（步骤 4）

除了 `_patch.py` 那 11 条锚点（插件化 + 经济 + 去水印），**手改了两处**，都在 `game.js`：

| 改哪 | 为什么 | 判据 |
| --- | --- | --- |
| 顶部 `import './engines/phaser.min.js'` → `import { ensurePhaser } from './engines/phaser-lazy.js'`；`class Main` 包进 `defineMain()`；`start()` 里 `ensurePhaser()` + `defineMain()` | 宿主 `check-plugin.mjs` 在 **Node** 里真 `import()` 这个包，而 Phaser 的 UMD 求值就读 `window` ⇒ 报 `window is not defined` | `node -e "import('…corgi.plugin.mjs')"` 成功、`check-plugin` 无硬错误 |
| `detectLang()` 里 `window.gp…` / `navigator.language` 加 `typeof` 守卫 | 它在**模块顶层**被调用（`let lang = … detectLang()`），同一个 Node import 也会炸 | 同上（这一处是修完上一处之后暴露出来的第二条） |
| 新增 `scripts/make-phaser-lazy.mjs` | 从 `engines/phaser.min.js` 生成 `engines/phaser-lazy.js`（派生物，换引擎版本可重跑） | `--check` 通过 |
| 新增 `scripts/make-asset-manifest.mjs` / `scripts/install-to-host.mjs` | 这一款起工程时**没带**这两个脚本（前面几款都有） | `install-to-host --check` 通过 |

经济参数：`PLAY_COST = 10` / `GRACE_MS = 10min` / `expectedPayout: 0` / 不开放兑换。

## 事故

**1. Phaser 是 UMD，模块顶层求值就碰 `window` ⇒ `check-plugin` 硬错误（2026-10-27）**

```
✗ 包执行失败（import() 抛）  window is not defined
    at … device/index.js: navigator.standalone && (…, window.cordova !== void 0 && …)
```

另外十一款用的都是 ES 模块引擎（pixi / three / rapier），顶层不碰 `window`，
所以只有这一款会红 —— **看着像插件坏了，其实是 UMD 的求值时机**。

修法：`engines/phaser-lazy.js` 把整段 UMD 包进一个函数，`ensurePhaser()` 调用时才求值；
`class Main extends Phaser.Scene` 也必须挪进 `defineMain()`（`extends` 的基类在**类定义那一刻**就要取）。
修完**又冒出第二条**：`let lang = settings.lang || detectLang()` 也是模块顶层，`detectLang` 读 `window.gp`。
两条都要治 —— 只修第一条会以为「还是没修好」。

**2. 这一款起工程时缺 `install-to-host.mjs` / `make-asset-manifest.mjs`**

`build-plugin.mjs` 的注释里写着「发布走 `scripts/install-to-host.mjs`」，但那个文件不存在。
照 `task-games/deckrush/` 的同名脚本抄一份，**包根上多两样**：

```
assets/  · 图片 205 张 + audio/bgm.m4a
sound.manifest.json / sound.pack   ← 裸文件名，音频运行时按清单请求
fonts/   · 正文圆体 + 两个标题字体（fonts.url(id) → assetUrl('fonts/<id>')）
```

只拷 `assets/` 的症状：假宿主（把 `dist-plugin/` 当站点根）全绿，真宿主 404，
而 404 的 HTML 被当 JSON 解析 ⇒ 报 `… is not valid JSON` ⇒ 整个 mount 失败。
`--check` 里 assets / 包根文件 / fonts 三样都逐字节比过。

**3. 调试桥是**有条件的**：`__MAKEPLAY_PLAYTEST__` 只在 `?playtest` 时挂**

`create()` 里 `if (new URLSearchParams(location.search).has('playtest')) this.installBridge();`。
e2e 不带这个参数时 `snapshot()` 恒为 `null`，症状是「读不到 mode」而不是「游戏没起来」。
插件跑在 `blob:` 模块里，`location` 仍是**宿主页面**的 ⇒ 参数加在 App 地址上即可
（`e2e-corgi.mjs` 自动补，不影响玩法：`canvas=1` 才切渲染器）。

**4. 「切回来应该还是 play」是**错的**判据**

`mode` 不进存档（`freshState()` 里没有它），每次挂载都从标题页进 —— 按设计。
进度的判据要换成**爱心**（点一下就能改、重挂载能读回）。照抄「接着玩」会把正确实现判成红的。

## 下次从这继续

**接入已经做完，只剩宿主仓库的提交。** 复查一把就够：

```bash
cd /e/plan/test25/task-games/corgi && node scripts/install-to-host.mjs --check
cd /e/plan/test25/kid-quest-farm-2d && npm run check:registry
```

要重新出包 / 重新落库时（顺序不能反）：

```bash
cd /e/plan/test25/task-games/corgi
node scripts/make-phaser-lazy.mjs && node scripts/make-asset-manifest.mjs
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/install-to-host.mjs
cd ../../kid-quest-farm-2d && npm run check:registry
```

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- ★ **给 node 传路径要用 `E:/plan/...`（Windows 形式）**：`/e/plan/...` 会被解析成 `\e\plan\...`。
- 端口：假宿主 **4422** / 出图 4423 / e2e **4396**（先 `netstat`；起完服务要验「服务的是不是我的构建」）。
- e2e 两条命令（两档都跑，**别并行**）：

```bash
CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4396 --strictPort
node scripts/e2e-corgi.mjs http://127.0.0.1:4396/ phone
node scripts/e2e-corgi.mjs http://127.0.0.1:4396/ tablet
```
