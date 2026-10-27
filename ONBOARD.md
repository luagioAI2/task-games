# 接入进度 · 旋转灯泡（sweetspin）

- 地址：https://wgcmeua7be.mkplay.zone/v/4/index.html
- 原版名：Sweet Spin（`GAME_TITLE`）
- 商城名：旋转灯泡 · 底栏 旋转灯泡（4 字）
- 经济：**C（纯玩）** · `playCost: 10` · `expectedPayout: 0` · **收费点 = 进一关**
- 当前：**已接完**（宿主 `farm-2d`，游戏仓库 `fea7916`）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | Canvas 2D（`@makeplay/display` 的 `mountDisplay` + `attachCanvas`，**不是 Pixi**）；`game.js` 48 KB + `levels.js`（确定性六边形关卡生成器，**100 关**）+ `i18n.js`（zh/en/ja）；`sound.manifest.json`；**内购** `gp.pay.purchase`（1 平台币 = 5 次提示）⇒ 整块删；**在线排行榜** `gp.player.topScores` ⇒ 整块删；存档走 `gp.player.saves` ⇒ 改 `host.storage` |
| 1 | 抓镜像 | ✅ | 18 个文件 / 6.65 MB；`failed` 只剩 `sound.manifest.js` 探测 404；**流式音频靠 `fetch-audio.mjs` 补齐 2/2**（`sound.pack` 24,786 B、`assets/bgm.m4a` 961,757 B 逐字节对上清单）；`find -size 0` 只剩 favicon |
| 2 | 立工程 | ✅ | `index.html` 改成 `import { start }` 再 `start({})`；`src/host.js`（宿主 storage / localStorage 同一接口） |
| 3 | 压资源 | ✅ | 7 张 PNG 6.38 MB → 240 KB（−96%），**尺寸不变**（没有 UV 锁定窗口）；删原 PNG + 只给内购用的 `coin.*` ⇒ `assets/` **7 个文件 / 1.2 MB** |
| 4 | 改造（插件化 + 删内购/排行 + 经济） | ✅ | `grep "payAvailable\|openShop\|lbOpen\|submitTotal\|gp.player"` **0 命中**；`game.js` 全体包进 `start(opts)`（1018 → 919 行）；提示改成纯游戏内资源（3 / +1 / 上限 9）；只读调试桥 `__sweetspin` |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===` · **106 KB**（gzip 33 KB）· 裸说明符 0 · 动态 import 0 · `check-plugin` 全 ✓（4 条提示见下） |
| 6 | 落库 | ✅ | `check:registry` → **四处登记一致（清单 / 哈希 / 商城 / 截图源）**，14 款 |
| 7 | 商城详情 | ✅ | `public/store/sweetspin/1..4.webp`（27.3 / 21.6 / 22.8 / 20.6 KB）+ `GameIcon.tsx` 的 `Sweetspin`；14 款详情走查全过、图都解码了 |
| 8 | 五层验收 | ✅ | `check-plugin` ✓ · `lint` ✓ · `vitest 774/774` · `mount-test` 40 项 ✓ · **e2e phone 39s + tablet 43s 全过** · `ropeland` 老款回归全过 |
| 9 | 提交 | ✅ | 两个仓库 `git status` 干净 |
| 9b | 推送宿主 | ✅ | `ls-remote` == 本地 HEAD（`farm-2d`） |

## 这一款和别的不一样的三件事

### 1. 收费点 = 「进一关」，同一关重玩不再收

`startLevel(n)` 里过 `chargePlay()`，判据是 `n !== paidLevel`：

| 动作 | 扣不扣 |
| --- | --- |
| 进 tab（挂载） | **不扣** |
| 关卡盘点一个没打过的格子 / 点「下一关」 | **扣 10** |
| 同一关点「再玩一次」 | 不扣（这一关在本局已经买过） |

所以**没有宽限期**（`plugin.js` 里没有 `paidAt`），e2e 第 ④ 段的断言方向和 corgi 相反：
余额 0 时插件**照常挂载**、关卡盘正常画、0 扣；点关卡格才弹「积分不够」。

### 2. 整屏 canvas，e2e 没有选择器可点

只读调试桥 `window.__sweetspin`：

```js
{ ready, state(), buttons(), startLevel(n) }
```

`state().tiles[i]` 给 `{ x, y, q, r, kind, powered, need }` ——
**`need` 是「这一格还要顺时针转几下」**，e2e / 截图脚本靠它打通关卡，
不用在测试里复制 `levels.js` 的关卡数据。`buttons()` 返回带 `label` 的几何
（关卡格 `L1`…`L20`、`hint`、`replay`、`next`、`settings`、`lang:zh`…）。

**卸载必须删掉它**（`if (window.__sweetspin === debugBridge) delete …`）。

### 3. 关卡是确定性生成的 ⇒ 测试可以「算解」

`generateLevel(n)` 由 n 播种，每格的目标角度就是它的 `mask`。
`mount-test` 直接 `import('/levels.js')` 算出「每格转几下」再**按坐标真点** ——
走的是孩子点击那条路径，不是调一个 `solve()` 作弊。

## 环境坑

- `mkplay.zone` 直连 000 ⇒ 必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 给 node 传路径要用 `E:/plan/...`；`/e/plan/...` 会被解析成 `\e\plan\...`。
- **`/tmp` 写不进去**（`curl -o /tmp/x` 报 exit 23「Failure writing output」）⇒ 临时文件放仓库内。
- `scaffold.mjs` 的 `--dir` 没给时会按「cwd + id」建目录 ⇒ **从 `task-games/` 里跑会多一层
  `task-games/task-games/<id>/`**。补救：把内容 `mv` 回来再 `rmdir`（别 `rm -rf`）。

## 坑（都是这次真踩到的）

### 1. ★★ 删「排行榜」那块时，把 `burst()` 一起删了

`burst`（撒纸屑）写在排行榜段落末尾，但 `computePower`（点亮灯泡）、`useHint`、
过关面板都在调它。**构建期不报错**，只有第一次点亮灯泡时抛
`ReferenceError: burst is not defined` —— 表现是「点了几格之后画面不动了」。
⇒ `_strip.py` 里显式把 `burst` 和 `iconTrophy` 一起救回来。

### 2. ★★ 包裹成 `start()` 时把「贴图加载 → 切关卡盘」那一段丢了

原版 `// ---------- boot ----------` 段落里有 `Promise.all(...IMG_SRC...)`，
整段替换成新的 boot 后，游戏永远停在「加载中 0%」——**颜色数从 626 掉到 100**，
而 `canvas 1` / `0 个 404` / `0 个 pageerror` 全绿。
⇒ 判据：**截图颜色种类数**（加载页只有 100 种，关卡盘 600+）。

### 3. ★★ 关卡盘的六边形按钮矩形互相重叠 ⇒ 点「左上角」会点到邻格

命中检测是「从后往前取第一个」，矩形 `1.8s × 1.6s` 在六边形网格上必然重叠。
症状是**点了没反应、还停在关卡盘**，不报错。
⇒ 一律点**中心**（`box.x + b.x + b.w/2`）。`mount-test` 一开始就是点中心的，所以只有
`capture.mjs` 红；e2e 也按中心点。

### 4. ★ 「转一半」那张截图和「开局」几乎一样

管道没接通时**一盏灯都不亮**，所以「转一半」拍出来只是管道角度不同、灯泡全灭。
⇒ 改成拍「**差最后 3 下**」：灯泡亮了一片、右下还灭一盏，才是这一款的爽点。

### 5. 包根目录的文件要两处都铺

`asset('sound.manifest.json')` 取的是**包根**的文件，不在 `assets/` 里。
`build-plugin.mjs` 往 `dist-plugin/` 铺一份，`install-to-host.mjs` 的 `ROOT_FILES` 同步列出。

## `check-plugin` 的 4 条提示（都确认过，不是问题）

1. `voucherPerCoin` 缺省 —— C 型，本来就不换券。
2. `有 assets/ 但没有 manifest.json` —— 已补（`scripts/make-asset-manifest.mjs`，**改资源要重跑**）。
3. `document.head` —— 注入一条 `.${scope} canvas{display:block}`，选择器收在根类名下。
4. `document.body` —— `@makeplay/display` 内部（rotate 遮罩 + `#app` 兜底），不是我们自己 Portal。
