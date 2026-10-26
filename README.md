# 蚂蚁搬家 · anthill

扒自 `https://zetwsserdm.mkplay.zone/v/7/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `anthill` |
| 商城名 | 蚂蚁搬家 |
| 版本 | 1.0.0（与 `public/games/index.json` 一致） |
| 扒取来源 | https://zetwsserdm.mkplay.zone/v/7/index.html |
| 扒取日期 | 2026-10-26 |
| 入口模块 | `./game.js`（`start(opts)`，独立网页与插件同一个函数） |
| 原始镜像 | `_originals/2026-10-26/`（不入 git） |
| 经济形态 | **B 型 · 只花积分**（一次进场 15 积分，不发行币、不发券，10 分钟内回来不重复收） |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'anthill'`（分类 `chill`） |
| 商城截图 | `shots/0*.png` → `public/store/anthill/*.webp` |

## 现在能跑吗

```bash
node server.js <port>        # 或任意静态服务（⚠️ 不能用 python -m http.server：
                             # 这台机器上它把 .js 回成 text/plain，模块被浏览器拒绝）
```

**一键自检**（2026-10-26 已通过）：`0 个 4xx/5xx`、`0 个 pageerror`、首屏直接进世界 1「花园草地」。

⚠️ 主画面是 **three.js 画进 canvas** 的，`document.body.innerText` 里只有 UI 那几个字。
判「画出来了」只能数截图颜色（`scripts/lib/png-colors.mjs`，<20 判空白）。
点按钮可以按 DOM 选器，但**要派发 `pointerdown`**（游戏监听的是 pointerdown，`click` 静默无反应）。

## 这游戏是什么

three.js 的**放置 / 经营**：点食物 → 蚂蚁排着队往洞里搬 → 攒金币升三种属性
（速度 / 工蚁 / 力量）→ 搬空一片草地换下一个世界（一共五个）。

| | |
| --- | --- |
| 金币 | **游戏自己的存档**里一个数字，和宿主账本无关 |
| 离线收益 | **保留**：回来时按离线时长 × 速率 × 0.4 结算，上限 4 小时 |
| 特殊蚂蚁 | 兵蚁（跑得快）/ 大力蚁（一趟搬三份）/ 金蚁（卖得贵），商店里用金币买 |

## 做完了什么（2026-10-26）

- [x] 资源：19 个文件 / 1.7 MB + `sound.pack` 35 KB；`assets/manifest.json` 由
      `scripts/make-asset-manifest.mjs` 生成（宿主 `check-plugin` 逐条校验 sha256）
- [x] 插件化五件事：根节点由 `mountTo` 传入 / 存档走 `host.storage`（`src/host.js`）/
      rAF 与定时器带 `alive` 守卫 / **3D 所以要 `forceContextLoss()`** / 样式经
      `scope-css.js` 收进一个随机根类名（`anthill-xxxxxx`）
- [x] 经济：**B 型**，一次进场 15 积分（`PLAY_COST`）。删掉的是
      **内购面板**（`renderCoins` / `buyCoins` / `COIN_PACK`，原版「1 平台金币 = 1000 游戏币」）
      和**排行榜 + 登录上榜**（`submitProgress` / `openRank` / `rankBtn`，要联网，插件里只会转圈）。
      钱不够时改成一句 `notEnough()` 提示
- [x] **收费点在「进场」而不是「点开始」**：这作没有「一局」，进来就是接着玩。
      所以「一局」定义成「一次进场」，`paidAt` 记在**存档**里、10 分钟内回来不重复收。
      ⚠️ 写内存变量的话，卸载后（= 切走）就没了 —— 宽限期会静默失效
- [x] `scripts/build-plugin.mjs`（单文件 ESM，`three` + `@makeplay/fx` 已内联，
      4209.5 KB / gzip 2.05 MB）+ 宿主 `scripts/check-plugin.mjs`
- [x] 宿主四处登记：`index.json` / `localGames.ts` / `storefront.ts`（`kind: 'chill'`）/
      `build-store-shots.py` 的 `PLAN`；`npm run check:registry` 绿（5 款）
- [x] 截图 4 张（世界 1 / 商店 / 设置 / 世界 2 野餐垫）+ 文案 + 五层验收

## 脚本

| 脚本 | 干什么 |
| --- | --- |
| `scripts/build-plugin.mjs` | 打包成 `dist-plugin/anthill.plugin.mjs`（别名 `three` / `three/addons/` / `@makeplay/*`） |
| `scripts/mount-test.mjs` | **假宿主**挂载：资源走没走 `assetUrl` / 扣分闸门 / 10 分钟宽限 / 卸载（含 WebGL 上下文）/ 挂第三次 |
| `scripts/capture.mjs` | 独立网页走查截图 → `shots/`（商城图源），每张都数颜色 |
| `scripts/make-asset-manifest.mjs` | 重算 `assets/manifest.json`（改资源后必跑；`--check` 只比对） |
| `scripts/install-to-host.mjs` | 拷包 + 资源进宿主 `public/games/anthill/`，重算 `localGames.ts` |
| `scripts/lib/png-colors.mjs` | 数 PNG 颜色种类（**不能**用 `drawImage(glCanvas)` 采样，见文件头） |
| `scripts/_pluginize.py` | 一次性改造脚本：把原版 `game.js` 包成 `start(opts)`（留档） |

端口：假宿主 `4403`。

## 验收结果（五层 + 两档）

| 层 | 命令 | 结果 |
| --- | --- | --- |
| 1 静态 | `check-plugin.mjs dist-plugin/anthill.plugin.mjs --assets dist-plugin/assets` | 通过（4 条提示，见下） |
| 2 类型 + 单测 | `npm run lint` · `npm test`（在宿主里跑） | tsc 0 错；774 条全绿 |
| 3 假宿主 | `node scripts/mount-test.mjs` | 30 条全绿（0×404、扣 15、宽限不重扣、上下文释放、挂第三次、颜色 513） |
| 4 真 App | `node scripts/e2e-anthill.mjs <url> phone\|tablet` | 两档全绿（见下） |
| 5 商城详情 | `node scripts/capture-store-detail.mjs <url>` | 通过，4 张图逐张看过、和 caption 对得上 |

真 App 那层验的是「假宿主永远绿」的那几条：

- 进场就扣 15（150 → 135），**券和游戏币一分不动**；
- **容器高 == 父容器高**（手机 698 / 平板 966）、canvas 铺满、中心点没被底栏盖住；
- 游戏区域**颜色 548 种**（手机）/ 552 种（平板）—— 不是空白；
- 切走后 `__ant` / `__gpReady` / `__gpPlayable` 全消失、canvas 归零、存档落盘；
- 切回来**不再扣分**（宽限期跨了一次卸载 + 挂载）、**画面还在**（557 种颜色 ——
  这条抓的是「只 dispose 不 forceContextLoss，切几次后 WebGL 上下文耗尽、全黑且不报错」）、
  语言设置被记住（`host.storage` 真的读回来了）。

`check-plugin` 的 4 条提示都是**已知且无害**的：

- `voucherPerCoin` 缺省 —— B 型的定义，本来就不开放兑换；
- `document.head` —— 只有 `game.js` 那一条带随机根类名的样式注入；
- `document.body` —— 全在 **three.js 内部**（`WebGLRenderer` 建 canvas、`CSS2DRenderer` 的
  `textContent` 容器），本作的 UI 层是挂**容器**里的（`mount-test` 有一条专门验这个）；
- ~~没有 `assets/manifest.json`~~ —— 已补上（见上）。

## 一个已知的小毛病

日文下顶栏「次のワールド」在 390 宽的机器上会被截成「次のワー…」。
中文 / 英文不截。属于原版的文案宽度问题，不影响玩法，暂不改。
