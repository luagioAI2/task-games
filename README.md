# 甜点魔法学院 · sugar

扒自 `https://29zwsj55ar.mkplay.zone/v/14/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `sugar` |
| 商城名 | 甜点魔法学院 |
| 版本 | 1.0.0（与 `public/games/index.json` 一致） |
| 扒取来源 | https://29zwsj55ar.mkplay.zone/v/14/index.html |
| 扒取日期 | 2026-10-25 |
| 入口模块 | `./game.js` |
| 原始镜像 | `_originals/2026-10-25/`（不入 git） |
| 经济形态 | **B 型 · 只花积分**（开局 20 积分，不发行币、不发券） |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'sugar'`（分类 `chill`） |
| 商城截图 | `shots/0*.png` → `public/store/sugar/*.webp` |

## 现在能跑吗

```bash
node server.js <port>        # 或任意静态服务（⚠️ 不能用 python -m http.server：
                             # 这台机器上它把 .js 回成 text/plain，模块被浏览器拒绝）
```

**一键自检**（2026-10-25 已通过）：

```bash
node ~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/smoke.mjs . --wait 12000 --shot
```

| 项 | 结果 |
| --- | --- |
| 4xx/5xx（除 favicon） | 0 |
| pageerror | 0 |
| 首屏 | 选语言 → 「PUZZLE & PUDDINGS 大战」标题页 |
| 进玩法 | 点 (195,330) 中文 → 点 (195,540) 开始游戏 → 连点 (195,700) 过剧情 → 第 1 层棋盘 |

⚠️ 整屏 UI 全是 PixiJS 画进 canvas 的，`document.body.innerText` **恒为空**，
DOM 里也没有按钮 —— 只能按坐标点（`--tap x,y`），判「画出来了」只能看截图颜色数。

## 这游戏是什么

PixiJS 的**消除 + 自动战斗**：6×6 珠盘拖拽三消 → 给队伍充能 → 打掉敌人血条 →
拿 EXP 进化角色 → 过关进下一层（第 1 层「奶油操场」）。自带 EXP / 进化养成，
**没有商城、没有内购、没有看广告入口** —— 经济改造要做的只是「开局收门票」。

## 做完了什么（2026-10-26）

- [x] 资源压缩：66 个文件 / 2.5 MB（PNG → webp，`scripts/compress-assets.py`），
      `assets/manifest.json` 由 `scripts/make-asset-manifest.mjs` 生成，宿主逐条校验哈希
- [x] 插件化五件事：根节点由 `mountTo` 传入 / 存档走 `host.storage`（`src/host.js`）/
      rAF 与定时器带 alive 守卫 / 无 3D 所以不用 `forceContextLoss`（但 `unmount` 会
      `app.destroy(true)` 并**保留 Texture**，否则第二次挂载全白且不报错）/ 样式只注入一条
      带随机根类名的 `canvas{display:block}`
- [x] 经济：**B 型**，开局 20 积分（`PLAY_COST`），不发行币、不发券、
      原版也没有「送币 / 看广告 / 签到」入口要删
- [x] `scripts/build-plugin.mjs`（单文件 ESM，1.0 MB / gzip 0.25 MB）+ 宿主
      `scripts/check-plugin.mjs`
- [x] 宿主四处登记：`index.json` / `localGames.ts` / `storefront.ts`（新增 `chill` 分类）/
      `build-store-shots.py` 的 `PLAN`，`npm run check:registry --self-test` 绿
- [x] 截图 4 张（标题 / 角色进化 / 选关 / 棋盘）+ 文案 + 五层验收

## 脚本

| 脚本 | 干什么 |
| --- | --- |
| `scripts/build-plugin.mjs` | 打包成 `dist-plugin/sugar.plugin.mjs` |
| `scripts/mount-test.mjs` | **假宿主**挂载：资源走没走 `assetUrl` / 扣分闸门 / 卸载 / 挂第二次 |
| `scripts/capture.mjs` | 独立网页走查截图 → `shots/`（商城图源） |
| `scripts/compress-assets.py` | PNG → webp（`--keep-size` 给 UV 锁定的图） |
| `scripts/make-asset-manifest.mjs` | 重算 `assets/manifest.json`（改资源后必跑） |
| `scripts/install-to-host.mjs` | 拷包 + 资源进宿主 `public/games/sugar/`，重算 `localGames.ts` |
| `scripts/_patch-host.py` / `_patch-gate.py` / `_patch-remount.py` / `_diag.mjs` | 一次性改造脚本（留档，说明当时怎么改的） |

端口：假宿主 `4402`（`SUGAR_TEST_PORT`）。

## 验收结果（五层 + 两档）

| 层 | 命令 | 结果 |
| --- | --- | --- |
| 1 静态 | `check-plugin.mjs dist-plugin/sugar.plugin.mjs --assets assets` | 通过（3 条提示，见下） |
| 2 类型 + 单测 | `npm run lint` · `npm test` | tsc 0 错；774 条全绿 |
| 3 假宿主 | `node scripts/mount-test.mjs` | 22 条全绿（含 0×404、扣分 0/20、卸载摘干净、二次挂载） |
| 4 真 App | `node scripts/e2e-sugar.mjs <url> phone\|tablet` | 两档全绿（含容器高 == 父容器高、canvas 铺满、中心点没被底栏盖住） |
| 5 商城详情 | `capture-store-detail.mjs` | 两档全绿，4 张图逐张看过、和 caption 对得上 |

`check-plugin` 的 3 条提示都是**已知且无害**的：

- `voucherPerCoin` 缺省 —— B 型的定义，本来就不开放兑换；
- `document.head` —— 只有 `plugin.js` 那一条带随机根类名的 `canvas{display:block}`；
- `document.body` —— 6 处**全在 PixiJS 里**（触摸 hook / 无障碍 / devtools 的 `log` 下载），
  不是本作的弹层（本作没有 DOM 弹层，UI 全在 canvas 里）。

