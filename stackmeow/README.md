# 堆呀堆 · stackmeow

扒自 `https://dx38epea4f.mkplay.zone/v/4/index.html`（原版 `積んでミーヤ / Stack It, Ya!`），
改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `stackmeow` |
| 商城名 | 堆呀堆（底栏同名，3 字） |
| 版本 | `1.0.0`（唯一真相是 `plugin.js` 的 `manifest.version`，与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://dx38epea4f.mkplay.zone/v/4/index.html |
| 扒取日期 | 2026-10-28 |
| 入口模块 | `./game.js` 的 `start(opts)`（独立网页 `index.html` 和插件 `plugin.js` 调同一个函数） |
| 原始镜像 | `_originals/2026-10-28/`（不入 git） |
| 经济形态 | **C 纯玩**：积分 →「开一局 10 分」→ 最高分（只在游戏存档里）。不设币、不发券 |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'stackmeow'` |
| 商城截图 | `screenshots/store-1..4.png` → `public/store/stackmeow/1..4.webp`（PLAN 在 `build-store-shots.py`） |

包大小：**4.05 MB**（pixi + makeplay 的 fx/sound/display 全内联），资源 0.43 MB + 音频 1.05 MB + 字体 1.15 MB。

## 目录

```
game.js            玩法本体（PixiJS，一局 = 一整座塔）
ui.js              DOM 界面层（标题 / 结算 / 暂停 / HUD），样式过 scopeCss 收进 .uirt
i18n.js            ja / zh / en 三套文案
src/asset.js       资源前缀（插件在 blob: 里跑，相对路径会 404）
src/host.js        宿主适配层：store + installGp（把原版对平台 `gp` 的依赖换成本地）
src/scope-css.js   把全局样式收进根选择器（否则会改写宿主的 Tailwind 工具类）
plugin.js          插件外壳（manifest + mount/unmount + 开局扣分）
engines/ runtime/  引擎与 makeplay 运行时（本地化，不走 CDN）
assets/            12 张 webp + 1 首 m4a + 字体 + 资源清单
sound.pack         音效包（清单里 packs.main.url 指向它）
scripts/           build-plugin / install-to-host / make-asset-manifest / capture
```

## 跑起来

```bash
node scripts/capture.mjs 4411     # 起静态服务 + 真 Chrome，顺带拍 4 张商城截图
```

⚠️ 不能用 `python -m http.server`：这台机器上它把 `.js` 回成 `text/plain`，模块被浏览器拒绝。
⚠️ 判据是「canvas ≥ 1 **且** 截图颜色种类 ≥ 20」，不是 `innerText`（界面文字是 DOM，但画面是 canvas）。

## 改造清单（已完成）

- [x] 资源压缩：12 张 PNG 5.05 MB → webp 434 KB（−92%，尺寸一个像素没动，PSNR 30~36 dB）
- [x] 插件化：根节点外部传入 / `host.storage` / 监听集中注册 + `destroy()` 全摘 / `mountDisplay` 传 `host` / `scopeCss`
- [x] 经济：C 型，收费点在 `beginRun()`（标题「开始」/ 结算「再来一次」/ 暂停「重新开始」都走它，「继续」不收费）
- [x] 删掉原版的**在线排行榜**（要 MakePlay 账号，宿主里没有）与平台字体 CDN（改包内 woff2）
- [x] `scripts/build-plugin.mjs` → `check-plugin.mjs` 全绿
- [x] 宿主三处登记（index.json / localGames.ts / storefront.ts）+ 截图 PLAN
- [x] 五层验收（见 `ONBOARD.md` 的判据列）

## 已知取舍

- **不发兑换券**：这款的产出就是分数，没有「攒够 N 个换什么」的出口，硬加一条产出线等于凭空造经济。
- **不设宿主游戏币**：`manifest.coin` 只是闸门要求必填的占位，`mintGameCoin` / `spendGameCoin` 一次都没调。
- **`mountDisplay` 传 `orientation: "both"`**：原版是 `portrait`，横屏时会往 `document.body` 插一张
  fixed 全屏「请旋转屏幕」—— 在插件里等于盖住宿主的顶栏和底栏。容器本身是竖的，游戏自己按
  `Math.min(w/720, h/1280)` 缩放，不依赖这个声明。
