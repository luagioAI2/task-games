# 接入进度 · 别按红按钮（redbutton）

- 地址：https://w6de7fjfv2.mkplay.zone/v/8/index.html
- 商城名：别按红按钮 · 底栏 别按红按钮（5 字，正好上限）
- 原版名：`Don't Press the Red Button`（作者刻意三语都用英文标题，我们改成中文）
- 经济：C（纯玩，不发券）· 票价 10
- **收费点：这一档的第一下按键**（`pressManual()`；点击与空格都走它）→ 10 分钟宽限，`paidAt` 写存档
- 栈：PixiJS 8（`pixi.js`）+ `@makeplay/display` + `@makeplay/sound` + DOM 界面层（`ui.js` 拼 HTML）+ 大数库 `break_infinity`
- 当前：**九步全绿**，已进商城（第十八款）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 22 个站点文件 1.1 MB + `_ext` 7 个；`--browse` 第二遍才过（源站间歇性 `code=000`） |
| 2 | 立工程 | ✅ | `index.html` 改成 `start({container})`；`git 2b16ec3` |
| 3 | 压资源 | ✅ | 8 张 webp 694 → 645 KB（同尺寸重编码，跳过 1 张「压了不更小」）；m4a 960 KB 与 stackmeow 同档，不动 |
| 4 | 改造 | ✅ | `window.gp` 4 个文件全 0 命中；`document.title` / `documentElement.lang` 都不写 |
| 5 | 打包 | ✅ | 1091 KB 单文件 · 0 裸说明符 / 0 动态 import · `check-plugin` 通过（4 条提示都是预期） |
| 6 | 落库 | ✅ | `check:registry` 18 款四处一致 |
| 7 | 商城详情 | ✅ | 4 张图 + 逐张自己看（第 2 张必须「最后一按下立刻截」）+ 图标 4× 看过 |
| 8 | 五层验收 | ✅ | e2e phone + tablet 全绿 · `e2e-cellguard` 回归绿 · `capture-store-detail` 18 款全绿 |
| 9 | 提交 | ✅ | 游戏仓 `86a4f6a`；宿主仓见下 |
| 9b | 推送宿主 | ✅ | 推的是 worktree 那条分支 **`farm-2d`**；判据 `ls-remote origin refs/heads/farm-2d` == `rev-parse HEAD` |

## 玩法（决定收费点）

按红色大按钮 → 出金币；金币买升级 / 抽扭蛋收集 12 只萌宠 × 皮肤；集齐解锁「萌宠探险」；
另有六个增量系统（成就 / 幸运转盘 / 金币银行 / 魔法花园 / 萌宠探险 / 研究所）+ 转生。

**没有「一局」这个概念** —— 进来的核心动作就是按那颗按钮。
⇒ 把「一局」定义成「一次进场的第一下」：扣费写在 `pressManual()`，
收过就不再收；10 分钟宽限期靠**存档里的 `paidAt`**（写内存变量等于切走就失效）。

## 拆掉的东西

| 原版机制 | 为什么拆 | 拆法 |
| --- | --- | --- |
| 内购商店（`gp.pay.available` → `shopOn`） | 真钱买宝石，宿主里没有支付通道 | `shopOn` 恒 `false`，商店按钮与面板不渲染 |
| 排行榜 + 登录（`submitScore` / `topScores` / `requestLogin`） | 没有后端，留着就是一屏「加载中」 | 摘掉 `#lbBtn` 与整个榜单弹层，`submitBest()` 留空 |
| 云存档（`saves.latestSync` / `putLatest`） | 宿主用 `host.storage` | 换成插件注入的 `store` 适配层 |
| 平台字体（`gp.fonts.use`） | 宿主没有这个 API，源站那份 woff2 也 404 | 删掉，用系统字体栈 |
| 幸运转盘「每 4 小时 1 次免费」 | 「不上线就亏」的钩子 | `free` 恒 `false`，只剩「每按 100 次得 1 张券」 |
| 银行复利 / 花园生长 / 研究点（离线也在长） | 是**奖励离线**，不是惩罚 | **保留** |

## 六个坑（都真踩过）

1. **`.gitattributes` 只写 `text=auto`** ⇒ Windows checkout 出 CRLF ⇒ `scripts/_patch.mjs` 的
   LF 锚点每处「命中 0 次」，看着像源码对不上。必须 `* text=auto eol=lf`。
   ➜ 另：`grep -c $'\r'` 在这个 shell 里会把模式吃成空串、数成**总行数**，判据要用「字节 13 的个数」。
2. **包成 `start()` 后 `const host` 撞名**：原版模块体里本来有一句
   `const host = document.getElementById('app')`，和 `start()` 里的 `const host = opts.container`
   同域 ⇒ `SyntaxError: Identifier 'host' has already been declared`，而报错指向源码第 99 行，
   看着像原版代码坏了。外层改名 `mountContainer`。
3. **`saveApi` 忘了声明**：模块体包进函数后，`saveApi = opts.store` 变成隐式全局 ⇒ 严格模式直接
   `ReferenceError`。要在 `start()` 里 `let saveApi`。
4. **资源基址不能用写死的路径**：`AB` 按 `import.meta.url` 区分 —— `http:` 开头是独立网页
   （同级目录），`blob:` 是插件（`<宿主>/games/redbutton/`）。写死任一边，另一边全 404。
5. **面板按钮听 `pointerdown` + `window.pointerup`**（`ui.js` 的 `downEl` / `end()`）⇒
   `el.click()` **完全没反应且不报错**（症状：「点了 6 次，等级还是 Lv0」）。
   Puppeteer 要用 `page.click()`（真鼠标），e2e 里点 canvas 用 `page.mouse.click(cx, cy)`。
6. **`capture-store-detail` 的「图解码出来了」是随机红的**：固定 `wait(600)` 等懒加载 webp，
   整轮里会随机挑两三款红（anthill / moestrike / melonjar / redbutton 轮流）。
   已改成 `loading='eager'` + `await im.decode()` + 轮询 `naturalWidth`。

## 环境坑

- **源站间歇性 `UND_ERR_CONNECT_TIMEOUT` / `code=000`**（CloudFront）：`index.html` 能通时
  `game.js` 也可能 000。`scrape.mjs` 自带 4 次退避，但 `--browse` 那遍仍会整轮抛
  `TypeError: fetch failed` ⇒ **直接重跑（脚本幂等，已抓的会跳过）**，实测第 2 次就过。
- 直连可用，不需要 `--proxy 7897`。
- 端口从 4390+ / 5390+ 挑，别用 4180 / 4190 / 5190。4393 上常驻一个 preview，
  **先比对 `dist/assets/index-*.js` 的名字**确认服务的是自己的构建。
