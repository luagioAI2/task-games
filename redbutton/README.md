# 别按红按钮 · redbutton

扒自 `https://w6de7fjfv2.mkplay.zone/v/8/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `redbutton` |
| 商城名 / 底栏 | 别按红按钮（5 字，底栏上限） |
| 版本 | `1.0.0`（唯一真相是 `plugin.js` 的 `manifest.version`） |
| 扒取来源 | https://w6de7fjfv2.mkplay.zone/v/8/index.html |
| 扒取日期 | 2026-10-27（镜像目录名） |
| 入口模块 | `./game.js` → `start(opts)`（独立网页与插件同一个函数） |
| 原始镜像 | `_originals/2026-10-27/`（不入 git） |
| 经济形态 | **C 纯玩**：进场 10 积分，`expectedPayout: 0`，`kind: 'chill'` |
| 收费点 | 这一档的**第一下真实按键**（`pressManual()`）；10 分钟内切回来不重复收，`paidAt` 写存档 |
| 包体 | 单文件 1091 KB（pixi + display + sound + break_infinity 全内联） |
| 资源 | `assets/` 10 个文件 1.6 MB（8 张 webp + 1 svg + 1 段 m4a）+ `sound.pack` + `sound.manifest.json` |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'redbutton'` |
| 商城截图 | `screenshots/store-1..4.png` → `public/store/redbutton/*.webp`（**源图必须入库**） |

## 常用命令

```bash
node scripts/build-plugin.mjs        # 打单文件 ESM → dist-plugin/
node scripts/check-plugin.mjs        # （在宿主仓）静态校验：裸说明符 / 动态 import / manifest
node scripts/install-to-host.mjs     # 拷进宿主 + 改 index.json + 重算哈希
node scripts/install-to-host.mjs --check
node scripts/capture.mjs             # 重拍 4 张商城图（390×844 @2x）
node scripts/_probe.mjs 40           # 走查：按 40 下 + 逐个页签截图（不入库）
```

独立网页：任意静态服务起在本目录（**不能用 `python -m http.server`**，它把 `.js` 回成
`text/plain`，模块被浏览器拒绝）。

## 改造记录

| 原版机制 | 拆法 |
| --- | --- |
| 内购商店（`gp.pay.available` → `shopOn`） | `shopOn` 恒 `false`，商店按钮与面板不渲染 |
| 排行榜 + 登录（`submitScore` / `topScores` / `requestLogin`） | 摘掉 `#lbBtn` 与整个榜单弹层，`submitBest()` 留空 |
| 云存档（`saves.latestSync` / `putLatest`） | 换成插件注入的 `store` 适配层（`host.storage`） |
| 平台字体（`gp.fonts.use` + 源站 404 的 woff2） | 删掉，用系统字体栈 |
| 幸运转盘「每 4 小时 1 次免费」 | `free` 恒 `false`，面板只剩「按 100 次得 1 张券」 |
| 银行复利 / 花园生长 / 研究点（离线也在长） | **保留** —— 是奖励离线，不是惩罚 |

其它必要改造：

- **样式作用域**：`scopeCss(CSS + FX_CSS, '#rb-root')`。原版那份 CSS 里全是 `.hud` / `.pill`
  / `.tabs` / `.sheet` 这种通用类名，不收会把宿主的顶栏底栏一起改样（未分层样式胜过 Tailwind 的 `@layer`）。
- **资源基址 `AB`**：插件跑在 `blob:` 里，相对路径按**宿主页面**解析 ⇒ 全 404。
  判据是 `import.meta.url`：`http:` 开头 = 独立网页（用同级目录），`blob:` = 插件（用 `<宿主>/games/redbutton/`）。
- **不写宿主的地基**：`document.title` / `documentElement.lang` / `documentElement.style.fontSize` 一律不碰。
- **默认中文**：原版默认 `en`（作者注释写着 "user request: English by default"），宿主是中文儿童 App。
- **`mountDisplay({ orientation: 'both', host: hostRoot })`**：`portrait` 会把「请旋转屏幕」插到
  `document.body` 盖住整个宿主；不给 `host` 它会量整个视口。
- **模块顶层不碰 `window`**：`audio.js` 的 `pointerdown` / `keydown` / `pagehide` 三行包进
  `if (typeof window !== 'undefined')`（`check-plugin.mjs` 在 Node 里真 `import()` 一次）。
- **`initSound()` 幂等**：切走再切回不要重复建音频上下文（每次挂载新建会耗尽上限）。
