# 接入进度 · 别按红按钮（redbutton）

- 地址：https://w6de7fjfv2.mkplay.zone/v/8/index.html
- 商城名：别按红按钮 · 底栏 别按红按钮（5 字，上限）
- 原版名：`Don't Press the Red Button`（作者刻意三语都用英文标题）
- 经济：C（纯玩，不发券）· 票价 10（**放置类没有「一局」⇒ `mount()` 进场收一次 + 10 分钟宽限**）
- 栈：PixiJS 8（`pixi.js`）+ `@makeplay/display` + DOM 界面层（`ui.js` 拼 HTML）+ 大数库 `break_infinity` / `decimal.js`
- 当前：步骤 1 完成，准备立工程

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 22 个站点文件 1.1 MB + `_ext` 7 个（pixi.min.mjs / display-1.js / sound-1.js / 字体）；`failed` 只剩 4 条**非资源**（`$%7Burl%7D`、`$%7BITEM_SHEETS[sh]%7D` 是模板串残留，`SmileySans-Oblique.woff2` 与 `sound.manifest.js` 在源站就 404）；零字节只有 favicon.ico |
| 2 | 立工程 | ⬜ | `index.html` 重写；首次提交 |
| 3 | 压资源 | ⬜ | 8 张 webp 共 0.68 MB —— 站点本来就发 webp ⇒ 只做**同尺寸重编码**，尺寸一个像素都不许动 |
| 4 | 改造（去内购/排行/登录 + 经济） | ⬜ | `window.gp` 的 6 类用法全部切断 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交 | ⬜ | `git status` 干净 |
| 9b | 推送宿主 | ⬜ | 推的是 worktree 那条分支 **`farm-2d`**（`push origin main` 会打印 `Everything up-to-date` 而没推这条）；判据 `ls-remote origin refs/heads/farm-2d` == `rev-parse HEAD` |

## 玩法（决定收费点）

按红色大按钮 → 出金币；金币买升级 / 抽扭蛋（胶囊机）收集 12 只萌宠 × 皮肤；
集齐解锁「萌宠探险」；另有六个增量系统（成就 / 幸运转盘 / 金币银行 / 魔法花园 /
萌宠探险 / 研究所）+ 转生（rebirth）。**没有「一局」这个概念** —— 进来就是一直按。

⇒ 收费点 = `mount()` 进场一次 + 10 分钟宽限（`paidAt` 必须写存档）。

## 要拆的东西（扫出来的，`window.gp` 是总闸）

| 原版机制 | 为什么拆 | 拆法 |
| --- | --- | --- |
| **内购商店**（`gp.pay.available` → `shopOn`，`purchaseId` / `settlePurchases`） | 真钱买宝石，宿主里没有支付通道 | `shopOn` 恒 `false`，商店按钮与面板不渲染 |
| **排行榜 + 登录**（`gp.player.submitScore` / `topScores` / `requestLogin` / `lb_login`） | 没有后端，留着就是一屏「加载中」 | 摘掉 `#lbBtn` 与整个榜单弹层 |
| **云存档**（`gp.player.saves.latestSync` / `putLatest`） | 宿主用 `host.storage` | 换成插件自己的存档适配层 |
| **平台字体**（`gp.fonts.use`） | 宿主没有这个 API，字体在源站也 404 | 删掉，用系统字体 |
| 幸运转盘「每 4 小时 1 次免费」 | 「不上线就亏」的钩子 | 删掉免费计时，保留「每按 100 次得 1 张券」 |
| 银行复利 / 花园生长 / 研究点（离线也在长） | 是**奖励离线**，不是惩罚 | **保留**（放置类的乐趣就在这） |

## 下次从这继续

步骤 2：`node <skill>/scripts/scaffold.mjs redbutton "别按红按钮" task-games/redbutton/_originals/2026-10-28 --source <url>`

## 环境坑

- **源站间歇性 `UND_ERR_CONNECT_TIMEOUT` / `code=000`**（CloudFront）：`index.html` 能通时
  `game.js` 也可能 000。`scrape.mjs` 自带 4 次退避，但 `--browse` 那遍仍会整轮抛
  `TypeError: fetch failed` ⇒ **直接重跑（脚本幂等，已抓的会跳过）**，实测第 2 次就过。
- 直连可用，不需要 `--proxy 7897`。
- 端口从 4390+ / 5390+ 挑，别用 4180 / 4190 / 5190。
