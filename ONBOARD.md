# 接入进度 · 柯基屁屁（corgi）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://hw9mzzjpe2.mkplay.zone/v/1/index.html`
- 站上标题：`Duang Duang 柯基屁屁`
- 商城名：**柯基屁屁**（4 字）· id `corgi` · 底栏「柯基屁屁」
- 形态：Phaser（`https://makeplay.ai/engines/phaser.min.js`）+ `@makeplay/sound`，`<script type="module" src="game.js">`
- 玩法：**养成**（撸狗 / 投喂 / 换装 / 羁绊值 `bond` / 零食 `snack` / 舞台 `stage`）
- 经济：**B 型 / 养成** —— `mount()` 收一次门票 + 10 分钟宽限，`paidAt` 必须写存档
  - 暂定 `kind: 'chill'` + `expectedPayout: 0`（不产出宿主资源）→ 抓完确认
- 开始：2026-10-27 15:40
- 当前：**步骤 2 立工程中**

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | 零内购/抽卡/排行榜/联机/兑换码/联网；平台面只有 `saves` + `fonts` + `locale` + `ready`（8 处）；资源是**运行时拼路径**（type ③） |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | 219 个文件 11.2 MB；`failed` 14 条**全是静态扫把 `costume/…` 解析到页面根**的假失败（逐条核对本地都有）；权威清单 `assetDefs()` **205 项 0 缺失**；0 个 0 字节文件；补抓 `sound.pack` / `audio/bgm.m4a` / `bg-title-p.jpg` |
| 2 | 立工程（scaffold） | ⬜ | `npm run build` 出 `built in`；smoke 0 个 4xx |
| 3 | 压资源 | ⬜ | 体积前后对比；`find -size 0` 为空 |
| 4 | 改造（插件化 + 经济） | ⬜ | `_patch.py` 锚点各命中 1 次；改完立刻 grep |
| 5 | 打包 | ⬜ | 裸说明符 0 · 动态 import 0 |
| 6 | 落库（五处登记） | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情（文案 + 4 张图） | ⬜ | 4 张**人工看过** |
| 8 | 五层验收 | ⬜ | 静态 / lint+test+build / 假宿主 / e2e 手机+平板 / 详情页走查 |
| 9 | 提交（两个仓库） | ⬜ | 两边 `git status` 空 |

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
| 存档模型 | **槽位制**（不是单个 blob）：`getLatest()` / `putLatest(s)` / `list(100)` / `get(id)` / `create(d,name)` / `update(id,d)`，设置存 `__sys_settings` 槽 | 适配层要**完整实现 6 个方法**，见「改造清单」 |
| 引擎 | **Phaser 3.90.0（UMD，全局脚本）** + `@makeplay/sound` | Phaser 要改成挂 `globalThis`，见「事故」 |
| 资源路径 | **运行时拼**（type ③）：`setPath('assets/')` + `assetDefs()` 逐条拼；标题背景 `bg-title-${W<H?'p':'l'}.jpg` | `setPath` 要换成注入的 base |
| 音频 | 清单 12 条：`music.bgm` 是 **stream**（`assets/audio/bgm.m4a`，947 KB，**不在包里**）+ 11 条打包进 `sound.pack`（90,689 B payload） | 两个文件都补抓了；`loadSoundSystem()` 默认 `./sound.manifest.json` ⇒ **必须显式传 manifestUrl** |
| 收费点 | 养成/放置，没有「一局」 | `mount()` 收一次 + 10 分钟宽限，`paidAt` 写存档 |
| 要拆的 | **只有** `Made with MakePlay` 水印 div + 3 个 `data-mp-*` 注入脚本（scaffold 会剥） | 其余全留 |

## 改造清单（步骤 4）

（待侦察完成后填）

## 事故

（这一轮真踩的往这里加）

## 下次从这继续

**下一步 = 步骤 1：抓镜像。** 站点直连 000，必须带代理：

```bash
cd /e/plan/test25/task-games/corgi
node ~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs \
  https://hw9mzzjpe2.mkplay.zone/v/1/index.html \
  _originals/2026-10-27 --proxy http://127.0.0.1:7897 --browse
```

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- ★ **给 node 传路径要用 `E:/plan/...`（Windows 形式）**：`/e/plan/...` 会被解析成 `\e\plan\...`。
- 端口：假宿主 **4422** / 出图 **4423** / e2e **4396**；4390+ 与 5390+ 先 `netstat`。
