# 云边小农场 · cloudfarm

扒自 MakePlay 的农场游戏（`https://xd6q6wqxhc.mkplay.zone/v/4/`），改造后作为
`kid-quest-farm-2d` 的 v3 插件运行。**自己不在宿主仓库里**，宿主只吃 `dist-plugin/` 的产物。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `cloudfarm` |
| 商城名 | 云边小农场 |
| 版本 | 1.1.6（`plugin.js` 的 `manifest.version`，与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://xd6q6wqxhc.mkplay.zone/v/4/ |
| 扒取日期 | 2026-10-24（原始镜像在 `_originals/`，不入 git） |
| 经济形态 | **不设游戏币**：积分直接买种子 / 开地 / 领动物 / 钓鱼，收成卖出换兑换券 |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'cloudfarm'` |
| 商城截图 | `screenshots/{11-farm,13-animals,14-market,18-pond}.png` → `public/store/cloudfarm/*.webp` |
| 打包 | `node scripts/build-plugin.mjs` → `dist-plugin/cloudfarm.plugin.mjs`（约 4 MB） |

接进宿主的完整流程见 `kid-quest-farm-2d/docs/game-onboarding.md`。

## 跑起来

```bash
node scripts/serve.mjs 4398          # 独立网页 + 假宿主（**别用 python -m http.server**：
                                     # 这台机器上它把 .js 回成 text/plain，模块被浏览器拒绝）
node scripts/build-plugin.mjs        # → dist-plugin/cloudfarm.plugin.mjs
```

## 验收（顺序别颠倒）

| 脚本 | 验什么 |
| --- | --- |
| `node scripts/check-economy-table.mjs` | 数值闸门：逐项 `times × 4 × price ÷ cost` 必须在 0.40~0.67 |
| `node scripts/e2e-economy.mjs` | 假宿主：不偷发币 / 扣款落账本 / 卖出落 `harvestLedger` / 0 个 404 |
| `node scripts/check-rigs.mjs` | 4 个布置场景，且 `?rig=` 不扣钱 |
| `node scripts/check-fishing.mjs` | 5 竿：fishmeat 增量只有 0/4/8，`free` 不扣钱 |
| `node scripts/check-copy.mjs` | 卡面文案 ↔ 数值（永久动物写真实次数，不许 ∞） |
| `node scripts/check-css-scope.mjs` · `check-assets.mjs` | 样式作用域 / 资源清单哈希 |
| 宿主：`e2e-cloudfarm.mjs phone\|tablet` | 真宿主全链路 |

## 坑（都踩过，改之前先看）

1. `mount()` 里**别改容器定位**：宿主给的是写在**类**里的 `absolute inset-0`，
   用 `container.style.position` 判断会读成空串 ⇒ 补 `relative` ⇒ 盒子退回内容高度。
   判据用 `getComputedStyle(...).position === 'static'`。
2. `assetUrl(rel)` 的 `rel` **相对 `assets/`**。漏这层 ⇒ 404，而 `res.json()` 吃进
   `404 Not Found` 正文会抛 `Unexpected non-whitespace character after JSON at position 4`。
3. 模块顶层不许碰 `window` / `document`（`check-plugin.mjs` 在 Node 里真 `import()`）。
4. `src/ui.js` 的 CSS 是模板字符串 —— **注释里不能出现反引号**（会提前闭合字符串）。
5. 同版本不同字节 = 有人永远收不到更新：宿主只比 `installed.version === g.version`。
6. 改完数值要回头查「说法」：`times` 365 → 22 之后卡面还写「∞ 次产出」，四层验收全盖不到。
7. 宿主 `npm run build` 要带 `CODEBUDDY_SAFE_DELETE_ENABLED=0`（删除闸门，报错长得像 vite 崩了）。
