# Prize Park（本地离线版）· 抓奖乐园

原站：`https://jadsm6ugtx.mkplay.zone/v/1/index.html`（MakePlay 上的 3D 抓娃娃机游戏，原名 *Claw & Collect*）

已完整扒到本地，断网也能跑。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `prizepark`（⚠️ 目录名是 `prize-park-local`，不是 id） |
| 商城名 | 抓奖乐园 |
| 版本 | 1.6.2（`plugin.js` 的 `manifest.version`，与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://jadsm6ugtx.mkplay.zone/v/1/index.html |
| 扒取日期 | 2026-10-22 |
| 原始镜像 | `_originals/`（未改造的原图与原引擎，**不入 git**） |
| 经济形态 | 积分 →（买）娃娃机币 → 玩 → 奖品 → 兑换券。**没有一条回边** |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'prizepark'` |
| 商城截图 | `shots/ui-*.png` → `public/store/prizepark/{1..4}.webp`（`scripts/build-store-shots.py`） |
| 打包 | `node scripts/build-plugin.mjs` → `dist-plugin/prizepark.plugin.mjs` |
| 假宿主测试 | `node scripts/plugin-test.cjs 4392` |

接进宿主的完整流程见 `kid-quest-farm-2d/docs/game-onboarding.md`。

## 怎么运行

双击 **`start.bat`**，浏览器会自动打开 `http://127.0.0.1:8080/index.html`。

> 必须走本地 http 服务，不能直接双击 `index.html`——游戏用的是 ES Module，`file://` 协议会被浏览器的 CORS 策略拦掉。

手动启动也行：

```bash
node server.js          # 推荐，零依赖
# 或
python -m http.server 8080
```

端口被占用时 `server.js` 会自动往后找空端口。

## 自己手测一遍（5 分钟）

自动脚本验的是「断言过的那些点」，**观感只能人眼看**。完整的一条路：

| # | 做什么 | 应该看到 |
| --- | --- | --- |
| 1 | 打开首页 | **直接就是机台列表**（没有标题页）：顶栏 PRIZE PARK / 🪙 积分 / 🧸 币 / ⚙️，底部一排「背包 / 排行」（**只有两格**，回收已并入背包） |
| 2 | 点一台机器 | 进机台。顶栏「← 返回 / 机台名 / 🧸 0 ＋」，第二行左边「1次：1 娃娃机币」、右边「正面 / 侧面 / 店员」三颗小胶囊。**画面左右顶满**，右侧不该再有一竖列按钮；底部除了 PLAY 还有「背包 / 排行」 |
| 3 | 点顶栏那颗 🧸（或 PLAY，0 币时） | 都会弹买币面板。0 币时 PLAY 按钮写的是「买娃娃机币 🧸 0」，**不是灰的** |
| 4 | 买 5 个 | 🧸 5 / 🪙 25 |
| 5 | 点 PLAY | 扣 1 币 → 决定横向位置 → 再点落下抓 |
| 6 | 抓没抓到都正常（概率） | 想直接看后面：F12 控制台先 `__debug.enter('big-bear')` 再 `__debug.forceGet(0)` |
| 7 | 点底部「背包」 | 顶上一条**组合**（5 张卡，可横滑），下面是有货的娃娃（**有货的排最前**），没抓到的显示 ??? |
| 8 | 点有货的娃娃 | 弹出卖出面板：稀有度 / 每个 🎟️ 2 / 取消 · 卖 1 个 · 全部卖掉 |
| 9 | 卖掉 | **兑换券增加、🧸 币一分不动**、格子变回 ???、顶部换成「还没有娃娃」 |
| 10 | 凑齐一个组合 | 例：三只抱枕都抓到 → 「抱枕三兄弟」卡变成粉色「一起兑换」；点开写「基础 6 + 加成 1」→ 一起换到手 **🎟️ 7**（单卖只有 6） |
| 11 | F5 刷新 | 币和积分**都还在**（三本账：save / coin / points） |
| 12 | 回头确认 | 首页**没有**签到、**没有**跳蚤市场、**没有**回收按钮，也没有「金币+1000」的调试按钮 |

想在手机比例下看：F12 → `Ctrl+Shift+M` → 选 430×932。
`server.js` 只绑 `127.0.0.1`，**手机连不上**；要真机试就把 `server.js` 里
`server.listen(port, "127.0.0.1", …)` 的绑定地址改成 `0.0.0.0`。

### 控制台里能用的钩子

```js
__debug.coins               // 当前娃娃机币（钱包镜像，不是直接读存储）
__debug.points              // 当前积分
__debug.stock               // 手里能卖的：{ bear: 1 }
__debug.phase               // ready / idle_x / catchgo / ...
__debug.screen              // 当前在哪个屏：list / play / collection / sell / rank
__debug.enter('big-bear')   // 直接进机台（免点两下）
__debug.forceGet(0)         // 直接判 0 号奖品到手，跳过抓取动画
```

### 插件模式（在宿主的契约下再走一遍）

`_plugin-test.html` 是个**假宿主**：100 积分 / 0 币，币和积分记在它的账本里
（不是 localStorage），走的是 `host.buyGameCoin / spendGameCoin / redeemGameCoin /
mintVoucher` 四个门（`mintGameCoin` 只留给老存档迁移，正常玩法里不再被调用）。

```bash
# 另起一个静态服务（和独立运行互不影响）
node server.js 4392       # 端口是第一个参数（不传才读 PORT / 8080）
# 打开 http://127.0.0.1:4392/_plugin-test.html
```

玩一遍（买币 → 抓一只 → 回收 → 把剩的币换券）之后在控制台敲 `__t.ledger()`，应该看到
`{ points: 95, coins: 0, rows: 3, vouchers: 6 }`。

- `rows: 3` 是**币账本**的三笔：买 5、玩扣 1、剩 4 换券 —— 加起来 0，余额是算出来的
- `vouchers: 6` = 回收娃娃发的 2 + 4 个币换的 4。**娃娃那一份完全不经过币账本**
- `points: 95` 只减了买币的 5 —— 币不能换回积分，券也不能

## 目录结构

```
index.html            入口页（重写过的 importmap + 平台垫片注入）
main.js               独立运行入口（造一个 localStorage 宿主，喂给 createGame）
plugin.js             插件入口：manifest + mount（宿主 v3 契约，mount 是 async）
gp-bridge.js          window.gp → 宿主 HostApi 的桥（存档快照 + 防抖落盘）
game.js               游戏主逻辑（工厂函数 createGame，其余原封不动）
config.js             机台、奖品、物理参数
fx.js                 自写粒子系统（替换 3.25 MB 的 @makeplay/fx，17 KB）
i18n.js               多语言文案
wallet.js             钱包：币/积分的内存镜像 + 买币 / 付费 / 回收发券（全部走宿主 API）
recycle.js            回收价表（按稀有度 1 / 2 / 5，snackbox 单独 3）
combos.js             组合表（5 组）+ 基础价 / 加成 / 单件上限的计算
sound.manifest.json   音频清单（16 个音频资产）
sound.pack            音频数据包（2.2 MB，AAC）
assets/               41 张 WebP 美术资源 + manifest.json（5.0 MB）
engines/              three.js r1xx、OrbitControls、Rapier3D 物理引擎（3.5 MB）
runtime/sound-1.js    音频系统（121 KB）
dist-plugin/          打包产物：prizepark.plugin.mjs（3.24 MB / gzip 1.08 MB）
scripts/              资源转换 / 质量审计 / 回归验证 / 特效 A/B / 打包
_fx-probe.html        特效 A/B 探针页（?lib=orig|mine，配 scripts/fx-ab.cjs 用）
_mount-test.html      挂载/卸载循环测试页（配 scripts/mount-test.cjs）
_plugin-test.html     插件包 blob 加载测试页（配 scripts/plugin-test.cjs）
_originals/           原件归档：41 张 PNG（65 MB）+ 原 fx 库（3.2 MB）+ 改造前的
                      daily.js / market.js / game.pre-economy.js.bak，确认不要后可整目录删
shots/                验证截图（临时，可删）
```

**运行时真正需要的文件合计 11.1 MB**（改造前 73 MB）。

## 资源：PNG → WebP

`assets/` 从 **65 MB 压到 5.0 MB（12.7×，砍掉 92%）**，画面肉眼看不出差别。

```bash
python scripts/convert-webp.py --dry-run   # 先看体积，不写文件
python scripts/convert-webp.py             # 真转（只写 webp，不动原图）
python scripts/check-quality.py --verify   # 量 PSNR + 尺寸审计
node  scripts/verify.cjs 4392 shots        # 起服务后跑浏览器回归
```

三条规则，改脚本前务必看：

1. **5 张图的尺寸绝对不能改**：`chute-art`、`figure-box-sheet`、`cake-plate-box-sheet`、
   `cake-parfait-box-sheet`、`noctis-box-sheet`。`game.js` 里用**像素坐标**算 UV 窗口
   （`chuteWin()` 写死 `/1672`、`/941`；`BOX_SHEETS[*].W/H` 是 1536/1024、1223/1286），
   缩放它们会让箱子印花错位、出货口花纹对不上，**而且不会报任何错**。
2. 其余图长边压到 1024，保持宽高比。
3. **质量地板 34 dB**（白底合成后量 PSNR）。不够就自动升 q 重编；升到顶还不够就
   **退回原尺寸**（`pop-sweets` 就是这么处理的：1672×941 q88，386 KB）。

> ⚠️ 量 PSNR 时不能直接比 RGBA：alpha=0 处的 RGB 是无意义值，编码后会被改写，
> 直接比会得到 `maxErr=255 / PSNR≈16dB` 的**假阴性**，看着像压坏了，其实肉眼完全不可见。
> 必须先合成到白底再比。第一版就是被这个坑误导过。

`_originals/assets-png/` 是原件，留着方便随时回退或换参数重转。**确认不要了可以直接删**，
删了之后 `check-quality.py` 会退回按 `assets/*.png` 找源（找不到就报错）。

## 特效：3.25 MB 的 fx 库 → 17 KB 自写

原库 `@makeplay/fx` 带 52 个预设、2D/3D 双前端、bloom 后处理、成本预算器、播放节流器、
flipbook 加载器……而这个游戏只用 **4 个预设**，且只传 `{pos, power}`。所以自己写了一个
接口**逐字兼容**的替代品，`game.js` 除 import 路径外一行没改。

| | 原库 | 自写 fx.js |
| --- | --- | --- |
| 体积 | 3.25 MB | 17 KB |
| 首次加载请求数 | 55 | 19 |
| 预设 | 52 | 4（`light-hit` / `land-dust` / `teleport-light` / `legendary-reward`） |

参数不是编的：`count / speed / lifetime / size / spreadDeg / drag / gravity / sizeCurve /
alphaCurve / impulse` 全部照抄原库的 v4 预设定义。只有 `sizeMul` / `velMul` 两个系数是按
**实测像素**反推的 —— 原库的 size/speed 换算到世界坐标不是统一比例（4 个预设各差 2~8 倍），
所以只能按预设各自标定。

### 怎么验的（重要：别凭印象说「差不多」）

`_fx-probe.html` 是一个只有参照物（0.6 宽的小熊 = `referenceSpan`）的空场景，
`?lib=orig` 加载原库、`?lib=mine` 加载 `fx.js`。`scripts/fx-ab.cjs` 用 **固定步进**
（`__probe.step(1/60)`）推进动画，在 15% / 40% / 75% 三个时刻截图。

> 必须固定步进：headless 里真实时钟不可靠（首帧就要 ~1s、rAF 被节流），
> 靠 `sleep` 截到的帧每次都不一样，A/B 就没意义了。

```bash
node scripts/fx-ab.cjs 4392 orig shots/fx    # 基线（原库已归档到 _originals/，探针仍能加载）
node scripts/fx-ab.cjs 4392 mine shots/fx    # 自写实现
# 再拼对比图：shots/fx/_cmp-<preset>.png，左 orig 右 mine
```

对着基准图调了 5 轮。**结论与差异**：

- `light-hit` / `legendary-reward`：几乎一致（方块状闪光、散开范围、暗金色、中心暖雾）。
- `land-dust`：一致（青色软云、密度、扩散速度）。原版是 `cone` 向上飘，改成了 `sphere`
  —— 原版其实是围着落点四周散、重心不动的。
- `teleport-light`：**有意做得更干净**。原版那圈环是带噪声的毛边（像手绘），
  用两个正弦模拟出来要么是花瓣、要么是十七边形，都更难看，所以改成干净的单环 + 内层填充光。
  如果以后要还原毛边，得给环加一张噪声贴图，不是调参数能解决的。

## 作为插件接进 kid-quest-farm-2d（v3 契约）

`game.js` 已经从「模块求值即自执行」改成**工厂函数**：

```js
const game = await createGame({ container, host, save, assetBase, resolveAsset, voucherPerCoin })
await game.destroy()
```

`plugin.js` 是宿主要的那层壳，导出 `manifest` + `mount(container, host, ctx)`。

### 契约里这个包用到的门（v3 → v4）

| 变化 | 这个包怎么用 |
| --- | --- |
| `mount` 可以返回 `Promise<Unmount>` | `mount` 是 async 的（要 await 纹理 + Rapier wasm），宿主会 `await` 它 |
| `ctx = { assetBase, assetUrl(rel), locale }` | 资源一律走 `ctx.assetUrl('assets/x.webp')`，**不自己拼相对路径**（blob 模块会以 `blob:` 为基准解析 ⇒ 全 404） |
| `host.redeemGameCoin(count, memo)` | 回收页那颗「换成兑换券」按钮；汇率由宿主按 manifest 的 `voucherPerCoin` 算，插件传不进去 |
| `host.mintVoucher(count, memo)` | **v4 加的门**（2026-10-23）。回收娃娃**直接发券**，一个事务写完；
不再「先给币、再拿币换券」两跳（详见下面经济一节） |

> ⚠️ **`mount` 返回 Promise 曾经是个真 bug**：旧契约要求同步返回卸载函数，
> 宿主拿到 Promise 就 `typeof !== 'function'` → warn + 返回空函数 ⇒ `destroy()` 永远不跑
> （WebGL context / Rapier world / 4 个 interval 全留着）。当时的假宿主测试
> 自己 `await mount()`，所以**全绿**。现在宿主 `mountBundle` 两种都收，
> 而 `_plugin-test.html` 也改成和宿主**逐字一样**的写法（`typeof r === 'function' ? r : await r`）。
> 真 App 侧的判据在 `kid-quest-farm-2d/scripts/e2e-plugin-local.mjs`：
> 切走之后 `window.__debug` 必须消失（它只在挂载期间存在，`destroy()` 里会删掉）。

### 为什么改成工厂（而不是保留自执行 + 外面包一层）

ESM 模块**只求值一次**。卸载后再 `import()` 拿到的还是同一份闭包 —— 第二次挂载必然
拿到已经 `dispose` 掉的 renderer、停掉的 rAF。只有工厂才能每次挂载给一份全新状态。

改动只有 4 处，其余 3000 行没动：

1. 根节点由外部传入（原来 `document.getElementById("app")`），CSS 里的 `#app` → `.pp-root`
2. `gp` 由 `makeGp(host)` 提供，**函数内声明遮蔽全局** ⇒ 9 处 `gp.player.*` 调用点不用改
3. rAF 循环加 `alive` 守卫；4 个模块级 `setInterval` 统一登记、`destroy` 时清掉
4. 末尾 `return { destroy }`

> **`latestSync` 必须是同步 getter，这是这层最关键的约束。**
> 游戏在模块求值阶段就同步读它（`loadSave()`），而宿主 storage 是 async。
> 解法不是「包一层 Promise」，而是**创建游戏之前先把存档读出来当快照**传进去
> （`plugin.js` 里 `await loadSaveFromHost(host)` 在 `createGame` 之前）。

### 打包

```bash
node scripts/build-plugin.mjs      # → dist-plugin/prizepark.plugin.mjs
```

用宿主那份 vite 8.3（rolldown），把 three / rapier / sound / fx **全部内联**成单文件：

| | 大小 |
| --- | --- |
| 单文件 ESM | 3.27 MB（gzip 1.09 MB） |
| 裸模块说明符 | 0 |
| 动态 import | 0 |
| 资源（另发） | assets 5.2 MB + sound.pack 2.2 MB |

两个坑：
- `minify: 'esbuild'` 会失败 —— 宿主没装 esbuild（vite 8 把它变成可选依赖），要用 `'oxc'`
- alias **必须用数组且更具体的前面**：对象形式做的是前缀字符串替换，
  `three` 写在 `three/addons` 前面会把 `three/addons/x` 替成 `engines/three.module.js/addons/x`

资源不打进包，走 `assetBase` 前缀（本地部署给同源绝对地址，远程下载给 CDN 前缀）。
不给的话相对路径会以 `blob:` 为基准解析 ⇒ 全部 404，报错是一堆 "could not load texture"，
看着像打包坏了。

### 五个验证脚本（都能单独跑）

```bash
node scripts/verify.cjs       4392 shots    # 独立运行：加载 / 资源 / 特效 / 进机台
node scripts/mount-test.cjs   4392          # 挂载→卸载→再挂载 ×3 轮，查 WebGL context 泄漏
node scripts/plugin-test.cjs  4392          # 照宿主 loader 的方式 blob import 单文件包（含经济链）
node scripts/e2e-economy.cjs  4395 shots    # 整条经济链 + 六个「必须不存在」的东西
node scripts/probe-play-ui.mjs 4398         # 机台页布局（竖屏 + 横屏，含遮挡探针）
```

`probe-play-ui.mjs` 是唯一能量「布局」的那个：jsdom 不做布局（`getBoundingClientRect` 全 0），
而 `.click()` 又绕过命中测试 —— 「右侧那一列压没压住画面」「动作条在不在娃娃界面」
只能真浏览器 + `elementFromPoint` + 几何断言。判据都是**四段不重叠** + 画面右侧取点是 `CANVAS`。

`mount-test` 抓到过一个真 bug：`destroy()` 之后 4 个 `setInterval` 还在跑，
回调里 `$("...")` 拿到 null 再 `.textContent` 抛错。单跑整页时永远发现不了（页面一关就没了）。

## 经济：积分 → 币 →（玩）→ 奖品 → 兑换券

三档货币 + 奖品各管一段，**不互相偷换**：

| 货币 | 归谁 | 从哪来 | 到哪去 |
| --- | --- | --- | --- |
| 积分 🪙 | 宿主（农场） | 农场干活 | 买娃娃机币（**唯一出口**） |
| 娃娃机币 🧸 | 娃娃机 | **只有买**（`buyGameCoin`） | 玩一局（1 币）；剩下的可换券 |
| 奖品 🧸🎁 | 娃娃机 | 抓到手 | 回收 → 兑换券 |
| 兑换券 🎟️ | 宿主（农场） | 回收奖品（`mintVoucher`）/ 余额换券 | 回农场花，**与本游戏无关** |

**这是一条单向道：积分 → 币 → 玩 → 奖品 → 券。没有一条边是往回的。**
特别是「奖品 → 币」这条边**必须不存在** —— 币能开一局，奖品要是能变回币，
抓娃娃就等于免费续玩，回收价再低也拦不住（回收价 1 也行，只要 100% 抓到就是永动机）。

### 三条铁律

1. **余额永远是流水算出来的**，不存 `balance` 字段 —— 同一个事实存两份必然走散。
   宿主的 `db.ts` 和本地的 `main.js` 都只有 `Σ(delta)`。
2. **只有四个门能改余额**：`buyGameCoin`（扣积分 + 记币，**一个** Dexie 嵌套事务）、
   `spendGameCoin`（唯一合法负数）、`mintVoucher`（奖品 → 兑换券，一个 `postHarvest`，
   **完全不碰币账本**）、`mintGameCoin`（只收正数，**现在只给老存档迁移用**）。
   游戏侧不允许直接碰存储；宿主把 `__` 前缀的键留给自用，`storage.get/set` 撞上会抛。
   ⚠️ 别拿 `mintGameCoin` + `redeemGameCoin` 拼一个「发券」出来：那是两笔事务，
   中间宿主崩了会**真的留下一笔币**（下一局就能用），而且币账本里多出 `+2 / -2` 的噪声。
3. **`expectedPayout < playCost` 是硬不变量**，宿主校验 `E ≤ 0.8`。
   插件声明 `economy: { playCost: 1, expectedPayout: 0.75, capPerPrize: 6 }`。
   回收价按稀有度定死 1 / 2 / 5（`recycle.js`，`snackbox` 单独 3）：
   最坏情况（只玩 3 星台、均价 5）保本捕获率 = 1/5 = 20%，实际远低于此
   —— 所以基础 `0.6` 是个保守**声明**，不是精确测算值。

### 组合：凑齐一套，一起兑换多给一点

5 组（`combos.js`），每样**各 1 个**，兑换时**一次性消耗**：

| 组合 | 组成 | 基础 | 加成 | 一起换 |
| --- | --- | --- | --- | --- |
| 抱枕三兄弟 | 小猪 + 兔子 + 小狗 | 6 | +1 | **7** |
| 蛋糕双拼 | 蛋糕套 + 芭菲套 | 4 | +1 | **5** |
| 熊熊一对 | BIG小熊 + 小熊吉祥物 | 4 | +1 | **5** |
| 限定双雄 | 手办 + 诺克提斯 | 10 | +2 | **12** |
| 吉祥物全家福 | 6 只吉祥物 | 12 | +2 | **14** |

⚠️ **加成会抬高「一局期望产出」，这是唯一会让它上涨的地方。**
每个娃娃最终都会被卖掉，所以 `实际期望 = 基础 × (1 + 最高加成率)`。
现在最高是 +25%（4 → 5）⇒ `0.6 × 1.25 = 0.75`，仍 ≤ 0.8。
**加新组合之前先算这一格**，别凭感觉写 —— 超过 0.8 宿主会直接拒绝安装。

`capPerPrize` 也因此从 5 提到 **6**：`限定双雄` 是 2 件共 12 张，折合每件 6。
这个数用 `comboMaxPerPrize()` 算出来，加了组合自动跟上（写死就会比实际能拿到的少）。

同一只娃娃可以同时属于两个组合（`mascot_bear` 在「熊熊一对」和「吉祥物全家福」里），
兑换时按需消耗 —— **玩家的取舍就发生在这里**，这是设计的一部分。

### 卖掉娃娃：为什么没有跳蚤市场了

原版是自己定价挂单，卖得的钱能直接投下一局。两条都是印钞机：
玩家把价挂到天上；或者「卖得的钱 ≥ 玩一局的钱」就形成无限循环。
改成**固定回收价**之后，卖娃娃只能换回**兑换券**（换不到积分，**更换不到娃娃机币**），
券只能在农场花 —— 闭环到这儿就断了，卖娃娃不可能给你续一局。
单件上限 6（组合折合价）相对单局 1 的期望产出（0.75）本来就够安全，
但**方向**比大小更重要：只要出口是币，价格迟早会被调到能续玩。

### 六类必须不存在的东西（e2e 逐条断言）

- 签到 / 印章 / 每日任务（`#dailyBtn`、`save.daily`、`daily.js` 全删）
- 跳蚤市场与自主定价（`#fleaBtn`、`save.market`、`market.js` 全删）
- 用「销售额」付游玩费
- **奖品变回娃娃机币**（`wallet.earn()` 已整个删掉；e2e 断言卖完娃娃后币**一分没变**）
- **单独的「回收」入口**（`#sellBtn` 与 `#sell` 屏已删，DOM 里数到 0；
  卖娃娃只能从背包里点有货的格子进）
- TEST 菜单里的「金币 +1000」调试按钮（`testMode: false`，必定 GET 也关了
  —— 经济一旦是真的，必定 GET 就是免费娃娃洞）

### 网格行高：`min-height` 会把行钉死（v1.6.1 修的）

背包格子给「有货」的娃娃多了一行「🎟 N」，结果那一行掉到格子外面去了。

量出来的数：格子 **104px**（正好等于 `min-height`），内容 **128.5px**，
`scrollHeight 115 / clientHeight 102`。而且因为 `.cell` 是 `flex;justify-content:center`，
多出来的 24px **上下各分一半** —— 所以截图上看只是「贴边、有点挤」，
实际上上下各溢出了 20px，图片顶上也被削掉一截。

- **行高 `auto` 不等于「按内容长」**：格子是 grid item，被 `stretch` 到行高，
  而行的 auto 尺寸被 item 的 `min-height` 钉住了 → 内容再多也撑不开。
- 试了三种写法（同一个页面里改完立刻重量的）：
  | 写法 | 格子高 | 内容 | 结果 |
  | --- | --- | --- | --- |
  | 原样（`auto` 行） | 104 | 115 | 溢出 |
  | `grid-auto-rows:max-content` | 147 | 145 | **刚好装下** ✅ |
  | `grid-auto-rows:minmax(104px,max-content)` | 104 | 115 | 还是溢出（**别这么写**） |
  | `align-items:start` | 147 | 145 | 装下了，但同一行高矮不齐 |
- 结论：`.grid{grid-auto-rows:max-content}`。锁着的格子内容矮，靠 `min-height` 保持 104；
  有货的那一行自然长到 147，2 行名字的（蛋糕）长到 165。
- **判据要写成几何**：`最后一行的底边 ≤ 格子底边 − padding-bottom`，且
  `scrollHeight ≤ clientHeight`。只断「元素存在」或「文案对」，这条 bug 一条都抓不到
  —— jsdom 不做布局，`.click()` 也不管遮挡。

### 三个「点了没反应、控制台零报错」的坑

这一轮全踩了一遍，症状完全一样：**页面不崩、不报错、就是没反应**。

1. **`disabled` 的按钮连 `click` 事件都不发。** 0 币时把 PLAY 设成 `disabled`，
   新玩家永远走不到买币面板 —— 死路。改法：按钮始终 enabled，文案换成「买娃娃机币」。
2. **`await sound.unlock()` 在无声卡的 headless 里永不 resolve。** 它写在 `show(el)` 之前，
   整个导航变成空操作，`screen` 停在 `title`、零报错。改法：`audioWarmup()` 只管发、不 await。
3. **`el.click()` 绕过命中测试。** 被别的层盖住的按钮，测试里照样「点得动」。
   判「有没有被盖住」只能用 `document.elementFromPoint(中心点)` 反查 ——
   `e2e-economy.cjs` 里的 `hit()` 就是干这个的。

### 存盘：`stock` 与 `gotCounts` 为什么分开

`gotCounts` 是「历史上抓到过几个」（图鉴用），`stock` 是「现在手里还有几个」（背包里可卖的）。
原版只有一个 `gotCounts`，卖掉之后图鉴跟着少一个。
老档升级时按 `gotCounts` 回填 `stock` —— 宁可多给几个，也不要让人以为娃娃丢了。

## 相对原站做了哪些改动

1. **去掉了平台外壳**：原页头部塞了 MakePlay 的 `publish-*.js`、`scaffold-*.js` 和一大段页面截图上报脚本，全部删除。
2. **重写 importmap**：把 `https://makeplay.ai/engines/...`、`/runtime/...` 全部指向本地 `./engines/`、`./runtime/`。
3. **补了平台垫片**：原版依赖 `window.gp` 提供存档和排行榜，本地用 `localStorage` 实现了同名接口，所以进度、金币、收藏都能存下来。
4. **改了 rapier 的扩展名**：`.mjs` → `.js`，避免静态服务器返回 `text/plain` 导致模块加载失败。
5. **删掉了右下角 "Made with MakePlay" 水印**。
6. **美术资源转 WebP**（65 MB → 5.0 MB），`game.js` / `config.js` 里的 `.png` 后缀同步改成 `.webp`。
7. **换掉 fx 库**（3.25 MB → 17 KB），`game.js` 的 `import` 从 `@makeplay/fx` 改成 `./fx.js`。
8. **重做经济**：删掉签到 / 印章 / 每日任务与整个跳蚤市场，换成 积分 → 娃娃机币 → 固定价回收
   （`wallet.js` / `recycle.js`）。存档里 `coins` / `tickets` / `market` / `daily` 四个字段全部移除，
   新增 `stock`（可回收库存）。玩法收拢成三步：选机台 → 玩 → 卖娃娃。
9. **回收出口从「币」改成「兑换券」**（2026-10-23）：娃娃只能换券，不能变回币。
   插件侧走 `host.mintVoucher`（宿主 `HOST_API` 3 → 4），独立运行侧在 `main.js` 里
   多记一本 `prizepark.voucher.v1`。`wallet.earn()` 整个删掉 —— 钱包从此**没有加币的口子**。
10. **回收屏整个删掉，卖娃娃收进背包**（2026-10-23）：底部操作栏只剩「背包 / 排行」两格
    （`#sellBtn` 与整个 `#sell` 屏已删）。**售出面板本身留着**（`#sellModal`，里面还是
    `#rcOne` / `#rcAll`），只是入口从「回收」磁贴改成了**点背包里有货的格子**；
    没货的格子点了是看详情。顺带把背包改成「有货的排前面」，加了一行提示
    「点一下就能卖」，零食标签页的每一行也变成可点按钮（否则删掉回收屏，零食就再也卖不掉了）。
    新增 `combos.js`：5 组娃娃组合，凑齐可一起兑换并拿**加成**（详见上面「组合」一节）。
    加成会抬高期望产出，所以 `plugin.js` 的 `expectedPayout` 从 0.6 改成 **0.75**、
    `capPerPrize` 从 5 改成 **6**（都由 `comboMaxPerPrize()` 算出来，不写死）。
11. **修背包格子装不下「🎟 N」**（v1.6.1）：`.grid` 加 `grid-auto-rows:max-content`。
    之前行高被 `min-height:104px` 钉死，内容 128.5px 上下各溢出一半（详见上面「网格行高」）。
    顺手给探针补了一条几何断言 —— 这个 bug 之前**四层全绿**，只有截图看着有点怪。

## 已验证

- 首页 3D 街机厅正常渲染
- 进入机台后 three.js 场景 + Rapier 物理正常（玩偶受重力落定、可被抓取）
- **经济链全通**（`e2e-economy.cjs`，43 条断言）：0 币 / 30 积分起步 → PLAY 弹出买币面板 →
  买 5 个（币 0→5、积分 30→25）→ 玩一局（币 5→4，阶段进入 `idle_x`）→ 抓到小熊
  （`stock.bear=1`）→ **在背包里点有货的格子卖**（**币 4→4 一分没动**、券 0→2、库存归零、
  `soldCount=1`）→ 刷新页面 4 币 / 25 积分 / 2 券仍在。
  存档只剩 `coinMigrated / firstGot / gotCounts / layouts / stock / v` 六个键
- **插件模式下同一条链**（`plugin-test.cjs` 1b）：走的是 `host.buyGameCoin` /
  `host.spendGameCoin` / `host.redeemGameCoin` / `host.mintVoucher`，宿主币账本 3 笔
  delta 合计 **0**、券账本 6 —— 证明插件用的是宿主的门（不是自己另存一份），
  且**卖娃娃没有凭空多出币**
- **只有背包，没有回收屏**：`#sellBtn` 与 `#sell` 在 DOM 里**数为 0**；操作栏就两格
  （`e2e-economy.cjs` 第 1 节、`probe-play-ui.mjs`、宿主 `e2e-plugin-local.mjs` 三处各断一次）
- **背包版面不打架**（`probe-play-ui.mjs`，46 条断言）：组合条 5 张卡、条可横滑、
  组合条底 ≤ 格子区顶 ≤ 兑换条顶，格子区自己可滚；第一格是**有货的**；零食标签页 4 行
  全是 `<button>` 且带 `data-owned`
- **格子里的「🎟 N」没被裁掉**（同一条探针量几何）：这一行的底边不许越过格子的内容盒、
  格子也不许 `scrollHeight > clientHeight`。**这条是补的** —— 一开始没人发现，
  因为溢出被 `justify-content:center` **上下各分了一半**，截图上看像「贴边」，
  实际上下各溢出 20px（见下面「网格行高」）
- **组合兑换**（`plugin-test.cjs` 1d / `e2e-economy.cjs` 第 11 节 / 宿主 e2e ③c）：
  抱枕三兄弟 2+2+2 基础 6，加成 +1 → **7 张券**（单卖只有 6 张）；三件各扣 1、
  券 2→9、**币一分没动**；没凑齐时卡片**不置灰**（点了提示「还缺 N 种」而不是静默无反应）
- 音频包与 41 张图片全部本地加载，无外部请求
- **WebP 迁移后复验**：`__gpPlayable=true`、19 个请求里 **0 个 .png**、6 个 .webp 全部
  `200 + image/webp`、外部请求 0、控制台错误 0；小熊机（`prizes=3`）与桥机（box-sheet 贴图）
  各截一张图肉眼确认印花/海报无错位
- **换 fx 库后复验**：`__debug.fxDiag` 返回 `local-1`（证明加载的是自写实现，不是原库），
  进机器瞬间数到 `live=11 / quads=5`（证明 fx 在真实游戏里真被调用，不只是模块能加载），
  画面与小熊机截图与换库前一致

## 注意

- 原站是 MakePlay 的在线作品，代码和美术版权归原作者所有，这份本地副本仅供自己离线玩/研究，别拿去二次分发或商用。
- 排行榜是本地假的（只显示你自己的最好成绩），没有服务器。
- 存档在浏览器 localStorage 里，清缓存会丢。想重置就删掉这四个键：
  `prizepark.save.v1`（进度）、`prizepark.coin.v1`（娃娃机币流水）、
  `prizepark.points.v1`（积分流水）、`prizepark.voucher.v1`（兑换券流水）。
  三种货币存的都是**流水**不是余额，删掉任意一个都等于清零对应货币。
