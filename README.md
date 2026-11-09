# 下落的2048 · fall2048

扒自 `https://vp8stka3kk.mkplay.zone/v/29/index.html`，改造后作为 App 的插件运行（直挂 DOM + canvas，不是 iframe）。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `fall2048` |
| 商城名 | 下落的2048（底栏 `2048`） |
| 版本 | **1.0.1**（与宿主 `public/games/index.json` 一致） |
| 扒取来源 | https://vp8stka3kk.mkplay.zone/v/29/index.html |
| 扒取日期 | 2026-11-09 |
| 入口模块 | `game.js`（`boot({})`）→ 打包成 `dist-plugin/fall2048.plugin.mjs` |
| 原始镜像 | `_originals/2026-11-09/`（不入 git） |
| 经济形态 | **B 只花积分、不产出兑换券**：`playCost: 1` / `expectedPayout: 0` / `voucherPerCoin: 0` |
| 宿主清单 | `kid-quest-farm-online/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-online/src/games/storefront.ts` → `id: 'fall2048'` |
| 商城截图 | `screenshots/store-1~4*.png` → `public/store/fall2048/*.webp` |

进度与决策都在 **`ONBOARD.md`**（那个文件才是说明书，这份 README 只讲「这是什么」）。

## 怎么跑

```bash
# 1) 单独看游戏本体（会自己拉一份本地 gp-shim，存档只在内存里）
node scripts/store-shots.mjs          # 顺便把 4 张商城截图重拍一遍

# 2) 打插件包（产物在 dist-plugin/，会被宿主拷走）
node scripts/build-plugin.mjs
```

⚠️ **不能用 `python -m http.server`**：这台机器上它把 `.js` 回成 `text/plain`，模块被浏览器拒绝。

## 结构

| 文件 | 作用 |
| --- | --- |
| `game.js` / `core.js` / `i18n.js` / … | 原版（只做了**最小改造**，见下） |
| `gp-shim.js` | 替掉 MakePlay 的 `window.gp`：存档走 `host.storage`，`pay` / `fonts` / 排行榜故意不提供 |
| `plugin.js` | 插件入口：`manifest` + `mount`，负责扣分闸、资源绝对地址、卸载三件套 |
| `scripts/build-plugin.mjs` | 打包 + **补丁锚点校验**（锚点少了直接失败，避免「改了但没生效」） |
| `scripts/store-shots.mjs` | 用真 Chrome 拍 4 张商城截图（首屏 / 对局 / 扭蛋 / 升级商店） |

## 改造清单（都做完了）

- [x] 插件化五件事（根节点 / `host.storage` / 主循环闸 / teardown / 卸载删全局）
- [x] 去掉内购续关（`pay` 不提供 ⇒ 原版 `if(!window.gp?.pay?.available)return` 自动短路）
- [x] 排行榜改本地成绩（`a.myScores`），文案改「我的成绩 / マイ記録 / My scores」
- [x] 不加载 2.08 MB 的 `OpenHuninn.woff2`（`fonts.use` 不提供）
- [x] 开局扣 1 积分（`ie()` → `ie0()` 闸）
- [x] 宿主三处登记 + 后端发布（`game` / `wish_item` / 盲盒池 / `game_release` 1.0.1）
- [x] 截图 + 文案 + 五层验收（本地 42/0、远程 22/0）

## 三个坑（改之前先读）

1. **写死的相对资源路径**：原版画金币是 `new Image().src="assets/ui/icon_coin_selected.svg"`，
   相对**文档**解析 ⇒ 插件挂在 `/` 下就变成 `/assets/ui/...`（本地 200 但解码失败、线上 404，
   **都不报错**）。已改走 `window.__fall2048Asset`（= `ctx.assetUrl`）。
2. **`sound.pack` 懒加载**：解锁只拉起流式 `.m4a`；包里 60 条音效要等**第一次真播音效**才下载。
3. **扣分是异步的**：线上 `host.spendPoints()` 会走 `/api/wallet/spend` + 整轮 `refresh()`，
   几秒才回来 ⇒ 断言要等余额变化，别睡固定时间。
