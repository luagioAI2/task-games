# 接入进度 · 堆呀堆（stackmeow）

- 地址：https://dx38epea4f.mkplay.zone/v/4/index.html
- 商城名：堆呀堆 · 底栏 堆呀堆（3 字）
- 经济：C（纯玩，不发券）· 票价 10（每局「开始」收一次）
- 原版名：積んでミーヤ / Stack It, Ya!（一键叠积木，PixiJS + DOM 界面）
- 当前：✅ 完成（九步全绿，宿主已推送）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | `failed` 只剩 4 条探测 404（`sound.manifest.js` / `${fontUrl}` / `assets/blocks/index.js` 是扫描误报；字体改从 `static.makeplay.ai` 取到包内）；**静态 20 + browse 25**，另补 `sound.pack`（68989 B，声明 68537，容差内）与流式音乐 `assets/audio/bgm_main.m4a`（979606 B 逐字节相等） |
| 2 | 立工程 | ✅ | `index.html` 重写（44216 → 1038 B），入口改 `import { start }`；首次提交在 |
| 3 | 压资源 | ✅ | 12 张 PNG 5.05 MB → webp 434 KB（−92%）；**尺寸全部不变**（`Image.open` 前后一致）；PSNR 30.1~35.7 dB（100×100 图标 99 dB = 无损）；压完重看截图 |
| 4 | 改造 | ✅ | `grep` 敏感 API：`topScores`/`openProfile` 入口已删、`submitScore` 只留本地兜底、`fonts.use` 故意不提供；`document.title` / `documentElement.lang` 写入已删；`PIXI.Assets` 不销毁纹理 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===`；4.05 MB；裸说明符 0 / 动态 import 0；四引擎全内联；`check-plugin` 通过（2 条提示：`document.head` 是我们自己的 `<style>`（已 scopeCss 到 `.uirt`）、`document.body` 全在 Pixi 内部） |
| 6 | 落库 | ✅ | `install-to-host` 装好；`index.json` 追加一条 v1.0.0；`make-local-catalog` 重算（`localGames.ts` 里 stackmeow sha256 `6749bb8c90d1…`） |
| 7 | 商城详情 | ✅ | `storefront.ts` 加了 `berry` / `chill`；`build-store-shots.py` 的 PLAN 加一行；4 张图逐张看过（对局 / 标题 / 结算 / 暂停，数字互相对得上：24 分 / 最佳 28） |
| 8 | 五层验收 | ✅ | ① `check-plugin` ✅ ② `npm run lint` ✅ + `npm test` **774 条全绿**（补了 `GameIcon.tsx` 的 Stackmeow 一支） ③ 独立网页探针 0×404 / 字体 `loaded` ✅ ④ `e2e-stackmeow` **phone + tablet 全绿** ⑤ `capture-store-detail` 16 款逐款过 + 老款回归 `e2e-sweetspin` phone 全绿 |
| 9 | 提交 | ✅ | 工程 `1daed3b`（`git status` 干净）+ 宿主 `07063a7` / `b1faa64` |
| 9b | 推送宿主 | ✅ | `ls-remote` = `b1faa6429b8a…` == 本地 `HEAD`（单条 6.7 MB，直连 + HTTP/1.1 一次过） |

## 下次从这继续

已完成。要改这款：`cd task-games/stackmeow` → 改源码 → `node scripts/build-plugin.mjs` →
`node scripts/install-to-host.mjs` → 宿主 `npm run check:registry` + `npm run build` +
`node scripts/e2e-stackmeow.mjs <url> phone|tablet`。**记得升 `plugin.js` 的 `manifest.version`**。

## 环境坑

- 这台机器上 `mkplay.zone` **直连可用**（2026-10-28 实测 fetch 200）；直连失败再走 `--proxy http://127.0.0.1:7897`。
- 端口从 4390+ / 5390+ 挑，别用 4180 / 4190 / 5190。
- ★ `capture.mjs` 要跑 **4 分钟以上**（两局 + 等浮动文字散去），默认 120s 超时会 SIGTERM 且**无输出**。
- ★ `smoke.mjs` / `capture.mjs` / `_probe.mjs` 用 `C:/Users/...` 或项目内相对路径，别用 `/c/...`（node 会解析成 `E:\c\…`）。
- ★ 本作的按钮全听 **`pointerdown`**：e2e 里 `el.click()` **静默无反应**，而 `found` / `hittable` 照样 true。

