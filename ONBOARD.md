# 接入进度 · 偷偷投篮（hoopsneak）

- 地址：https://hdqcg224dd.mkplay.zone/v/13/index.html
- 原名：**Sneaky Hoops in Class**（课堂偷投篮：按住蓄力、松手投篮）
- 内容量：**40 本笔记本 × 5 关 = 200 关**，每本换一种机关（真空区 / 气球 / 炸弹 / 传送门 / 重力翻转 …… 共 40 种）
- 商城名：偷偷投篮 · 底栏「偷偷投篮」（4 字）
- 经济：**C 型纯玩** · `expectedPayout: 0` · `kind: 'chill'` · 票价 10 积分/关
- 引擎：PixiJS（**1280×720 设计空间**）+ `@makeplay/{display,fx,sound}`
- 资源：**零图片**（全部 Pixi Graphics 手绘）+ 1 首 bgm（967 KB）+ `sound.pack`（159 KB）+ 字体 1.1 MB
- 产物：`dist-plugin/hoopsneak.plugin.mjs` **4322.0 KB** · `sha256 80e377474e3e…`

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 17 个文件 5.44 MB；6 个模块 + pixi/display/fx/sound + 字体；`sound.pack` 与 bgm 按清单单独补抓（哈希对上） |
| 2 | 立工程 | ✅ | `index.html` 重写（importmap 只留 pixi/fx/sound/display）；`.gitattributes` 已 `eol=lf`；首次提交 `e145b07` |
| 3 | 压资源 | ✅ | **无可压**：唯一两张是 woff2 与 m4a，本来就是压缩格式（`assets/manifest.json` 2 条 sha256） |
| 4 | 改造 | ✅ | `_patch.mjs` 19 处（game.js 18 + i18n.js 1），每处断言命中 1 次；去排行榜 / 去 `gp.*` / `start(opts)` / `AB` / `enterLevel` 收费点 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===` · 裸说明符 0 · 动态 import 0 · 朝向 both · 排行榜已拆 |
| 6 | 落库 | ✅ | `check:registry` → 本地包 20 款 · 哈希 20 条 · 商城 20 条 · 截图 PLAN 20 行，0 条不一致 |
| 7 | 商城详情 | ✅ | 4 张图（标题 / 球在半空 / 新元素卡 / 第 5 本笔记本）；`capture-store-detail` 20/20 全过 |
| 8 | 五层验收 | ✅ | `lint` 0 · `test` 774 过 · `build` 过 · e2e phone + tablet 全过 · `e2e-guardshift` 回归全过 |
| 9 | 提交推送 | ✅ | 游戏仓 `1228c95` · 宿主 `29ed33d` · 已推 `origin farm-2d`，`ls-remote` == HEAD |

## 三个设计判断（已定案）

1. **横屏设计空间塞进竖屏容器** → 用 `mountDisplay({ host: mountRoot, orientation: 'both' })`。
   `'landscape'` 会往 `document.body` 插「请旋转屏幕」遮罩盖住**整个 App**（不是只盖游戏区）。
   改完画面是竖屏里的一条横向带（390 宽手机上 390×219），上下是同源纸面背景。
   **这是正确的取舍**：投手贴左边缘、篮筐贴右边缘，裁哪边都是裁玩法。
   ⇒ 已把这一条写进宿主 `docs/game-onboarding.md` 的 §4.1b。
2. **收费点** → 新增 `enterLevel(i, intro)` 包一层，只有它扣分：标题「开始」、选关圆钮、
   结算「下一关」都走它；**HUD「重新开始」直接调 `startLevel`，不经过收费**。
   判据来自 e2e ⑥：进关 100 → 90，点 HUD 重试 90 → 90 且 `shots` 清零。
3. **排行榜** → 整块拆掉（原版是 `position:fixed` DOM 浮层 + `player.submitScore` 联网 + 「登录上榜」）。
   `leaderboard.js` 留成离线壳：`totalStars` / `keepBestStars` 原样，`syncStars()` 返回 `{offline:true}`，
   `leaderboardOpen()` 恒 `false`。i18n 里 39 行 `ranking*` / `starTotal` 一起删干净
   —— **留着会触发打包闸门**（闸门查的是「包里还有没有 submitScore / 登录上榜」）。

## 下次从这继续

**已经上完了**（游戏仓 `1228c95` / 宿主 `29ed33d`，已推 `origin farm-2d`）。
要改的话照常：改源码 → `build-plugin` → `install-to-host` → 宿主 `build` → e2e → 两边各自提交。

推送注意：这个 worktree 的 `origin/farm-2d` 本地一直显示 `gone`（`refs/remotes` 写不进去的
老坑，`git ls-remote` 查是好的），**别看 `git branch -vv` 判断远端有没有这个分支**。

## 环境坑（本款新踩的）

- 抓站必须 `--proxy http://127.0.0.1:7897`（这台机器直连 mkplay.zone 是 000）。
- `node` 传 MSYS 风格 `/c/...` 会解析成 `E:\c\...` ⇒ 脚本路径写 `C:/Users/...`。
- `scaffold.mjs` 的 `--dir` 是**相对当前目录**拼 `task-games/<id>` ⇒ 在 `task-games/` 里跑必须给
  `--dir .`（否则立出 `task-games/task-games/<id>`，本次已踩，手工搬回来了）。
- ★ **静态服务里 `normalize('/')` 在 Windows 上返回 `\`** ⇒ 写 `p === '/'` 判根目录会 404，
  而症状是「整个页面白屏、桥不存在」，看着像模块坏了。判据写 `/^[\\/]$/`。
- ★ **静态服务的 MIME 表要带 `.mjs`**：漏了会返回 `application/octet-stream`，
  浏览器报「Failed to load module script … Strict MIME type checking」，同样表现成白屏。
- ★★ **headless 下「按住 600ms 再松手」蓄不到力**：蓄力是「1.4 秒**游戏时间**满格」，
  而 headless 时钟慢约 7× ⇒ 墙钟 650ms ≈ 游戏内 0.09 秒 ⇒ `power≈0.06`，球垂直落地。
  截图/走查要确定力度就用桥的 `beginCharge()` + `setPower(p)` + `release()`。
- ★★ **`sim.bx/by` 是 32×18 的网格单位，不是 1280×720 设计像素**。
  拿设计像素当阈值（`ball.x > 620`）永远不成立，而失败是**静默的**（只是「没等到」）。
- ★ **教学卡会吃掉第一次按下**：每本笔记本第一关 `phase === 'tutorial'`，那层 `dim` 是
  `eventMode:'static'` + `stopPropagation` ⇒ 点一下只关卡片、不蓄力。
  e2e 里症状是 `shots=0 / phase=aim`，看着像「按键没接上」。先判 `phase` 再点掉。
- ★ **选关页未解锁的圆钮不画数字**（画挂锁、也没有 `eventMode`）⇒ 桥的 `buttons()` 只读得到
  「1」。断言写成「1~5 都在」会永远红。
- ★ **`storefront.ts` 才是商城列表的数据源**，不是 `public/games/index.json`：
  `GameStore.tsx` 是 `STOREFRONT.map(...)` + `LOCAL_GAMES.find(...)`。少写一处 ⇒ 列表里根本没有这一行
  ⇒ 安装按钮点不到 ⇒ e2e ② 开始全红（而 `check:registry` 照样绿）。
- `npm run build` 偶尔在 `prepare-out-dir` 报一次错（有 `vite preview` 正开着 `dist/` 时）。
  重跑就好；判据是结尾有没有 `built in`。
