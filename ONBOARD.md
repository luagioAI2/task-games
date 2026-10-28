# 接入进度 · 画马赛跑（doodlederby）

- 地址：https://vvb96grafh.mkplay.zone/v/6/index.html
- 原名：**Doodle Derby**（`一场不太正经的运动会`）—— 手绘一匹马 → 变成 3D 马 → 踩节奏赛跑
- 商城名：画马赛跑 · 底栏「画马赛跑」（4 字）
- 经济：**C 型纯玩** · `expectedPayout: 0` · `kind: 'chill'` · 票价 10 积分/一场
- 引擎：three.js（3D 画室 + 赛道）+ `@makeplay/{sound,fx}`；DOM 界面层（`index.html` 里只有一个 `#app`，全部标记由 `src/ui.js` 的 `app.innerHTML` 生成）
- 资源：镜像 45 个文件 / 4.79 MB。**零贴图**（马、赛道、树全是 three 几何体），只有 3 张 Kenney 图标（48 KB）+ 1 条 m4a 音乐（977 KB）+ `sound.pack`（153 KB）
- 当前：步骤 1–4 完成，正在打包

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 45 文件 / 4.79 MB；`sound.pack` + `doodle-percussion.m4a` 用 `fetch-audio.mjs` 补抓（静态扫和 `--browse` 都收不到）；`find -size 0` 只有 favicon |
| 2 | 立工程 | ✅ | `index.html` 重写为 `import { start }`；`.gitattributes` 写 `* text=auto eol=lf`；首次提交 |
| 3 | 压资源 | ✅ | **无可压**：3 张 48 KB 图标 + 1 条已是 aac 的 m4a + 1 个 pack。压了只会更糊/更慢 |
| 4 | 改造 | ✅ | 联网四处归零；`scripts/_patch.mjs` 32 条锚点唯一；`gen-styles.mjs` 7 份 CSS 收进 `#dd-app` |
| 5 | 打包 | ✅ | `4317.9 KB` · 0 裸说明符 / 0 动态 import · `=== 打包校验通过 ===`；宿主 `check-plugin.mjs` = 通过（1 条提示：chill 不开放兑换） |
| 6 | 落库 | ✅ | `check:registry` 四处一致 **21 款**（本地包 / 哈希清单 / 商城条目 / 截图 PLAN） |
| 7 | 商城详情 | ✅ | 4 张图 + **逐张自己看过**（CSS 那次回归就是靠看图才发现的） |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交推送 | ⬜ | `ls-remote origin refs/heads/farm-2d` == HEAD |

## 要拆的联网面（§0.5 报价）

| 功能 | 实现 | 处理 |
| --- | --- | --- |
| 世界排行榜 | `src/world-board.js` + `archive.board()` / `archive.upload()` | 入口按钮藏掉，模块保留但不打开 |
| 录像库（回放对手） | `src/archive-client.js`，`archive.sample()` / `enter()` | 恒离线 ⇒ 对手全是电脑选手（原版本来就有 bot 补位） |
| 名字三语翻译 | `gp.ai.chat`（`custom-name.js` / `nameRoller`） | 不翻译，用本地名；**`randomNames()` 与 `NAME_TABLE` 是纯本地的**，随机名字照常可用 |
| 云存档 | `gp.player.saves.latestSync` / `putLatest()` | ★ **这是唯一存档通道** ⇒ 必须接到 `host.storage`，否则一个字节都不落盘 |
| 登录 | `gp.player.requestLogin()` | 离线分支已自带（`platform.js` 的 `playerBridge()` 会造一个 offline bridge） |

**没有**内购 / 抽卡 / 体力 / 签到 / 每日任务 / 兑换码 —— 要拆的全是「联网附加功能」，不碰核心玩法。

## 收费点（初判）

「03 送它去比赛」= 一场比赛 = 一局 ⇒ 在开赛那一刻扣 10 积分。
画马 / 3D 预览 / 起名 / 选赛制 全免费（那是这款游戏的核心乐趣，不能收）。

## 环境坑

- 抓站必须 `--proxy http://127.0.0.1:7897`（直连 mkplay.zone 是 000）。
- `node` 传 MSYS 风格 `/c/...` 会解析成 `E:\c\...` ⇒ 脚本路径写 `C:/Users/...`。
- `scaffold.mjs` 的 `--dir` 是**相对当前目录**拼 ⇒ 在 `task-games/` 里跑必须给 `--dir .`。
- 这台机器端口常被占（4180/4190/5190/4391/4394）⇒ 预览从 **4390+ / 5390+** 里挑没被占的。

## 踩过的坑（改造阶段，按发现顺序）

| 症状 | 原因 | 修法 |
| --- | --- | --- |
| 整套 CSS 一条都不生效，**零报错**、pageerror 0、smoke 颜色数 356 照样绿 | `<style>` 在 `createUI(app)` **之前**挂进挂载根，而它里面是 `app.innerHTML = …`，把 style 冲掉了 | style 只建不挂，**`createUI(app)` 之后**再 `appendChild`；`_patch.mjs` 里加了一条顺序断言 |
| 竖屏紧凑布局塌成 `35px 35px 280px` | `body[data-compact][data-studio-tab=…]` 整串正则只吞了第一个属性 ⇒ 变成 `#dd-app[a][b] #dd-app .x`（要求嵌套两层） | `gen-styles.mjs` **逐选择器**重写；`scopeCss` 认 `root + '['`；`auditSelectors` 把 `#dd-app #dd-app` 判失败 |
| `url('./assets/…')` 404、图标静默不见 | CSS 内联后相对路径按**文档**解析，不是按包 | 生成期改写成 `url('__AB__assets/…')`，运行时 `SCOPED_CSS.replaceAll('__AB__',AB)` |
| 存档一个字都不落盘、界面只显示「保存失败」 | `gp.player.saves.putLatest` 是**唯一**存档通道，离线桩恒 `false` | 改接 `host.storage`；standalone 退回 `localStorage` |
| `world-board.js` 抛 `ReferenceError: gp is not defined` | 它用的是**裸全局** `gp`（原先靠 `platform.js` 往 window 上写） | 改成 `import { gp } from './platform.js'` |
| ★★ 参赛页底部的「03 送它去比赛」**被裁掉**，手指点不到，而 e2e 全绿 | 布局函数量的是**自己的挂载根**，而挂载根高度正是它写进去的 `--window-h`（`height:var(--window-h,100dvh)`）⇒ 循环，永远停在 `100dvh`(844)，容器只有 698 | `mountResponsiveLayout({host:mountContainer})`，量宿主给的容器；e2e 加 `elementFromPoint` 判据 |
| 清单里版本写成 `"none"` | `/version:\s*["']/` 命中了 three 的 `colorSpaceConversion: "none"`（「con**Version**」里含 version） | 先定位 `id:"doodlederby"`，再从它后面找 version |
