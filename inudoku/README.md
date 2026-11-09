# 犬独 · inudoku

一个「每行、每列、每块同色区域各放一只狗，且狗不能相邻」的放狗数独。
扒自 `https://d337snrctr.mkplay.zone/v/29/index.html`（原版标题 `犬独 ～INUDOKU～`），
改造后作为 `kid-quest-farm-online` 的插件运行。

**接入进度与决策看 [`ONBOARD.md`](./ONBOARD.md)** —— 那个文件才是事实来源，本文件只讲怎么跑。

## 一句话玩法

36 关主线从 4×4 长到 12×12；通关后还有「双子」和「骨头」两章共 16 道进阶题
（前者一个区域放两只，后者格子上的数字表示周围八格里该有几只）。
放错扣一颗心，三颗心用完这关从头再来。

## 目录

| 路径 | 是什么 |
| --- | --- |
| `game.js` `ui.js` `levels.js` `advanced.js` `dogs.js` `bgm.js` `i18n.js` `puzzle.js` | 原版代码（压缩过）。**改动全部由 `scripts/patch-game.mjs` 重放**，不要手改 |
| `gp-shim.js` | 把原版的 MakePlay 平台接口（`window.gp`）换成宿主实现：存档走 `host.storage`、成就本地记、**不给 `pay`** |
| `css-scope.js` | 把原版注入的全局 CSS 收进 `[data-inudoku-root]`，否则会改掉整个 App 的字体和 CSS 变量 |
| `standalone.js` | 独立网页入口（调试 / 截图 / 冒烟用） |
| `plugin.js` | 宿主插件入口：`manifest` + `mount` |
| `assets/` | 已压成 WebP 的资源；`assets/manifest.json` 是给宿主校验的哈希清单 |
| `sound.pack` `sound.manifest.json` | 音效包（首次真播音效才下载） |
| `screenshots/` | 商城源图（`scripts/store-shots.mjs` 现拍） |
| `scripts/` | 补丁重放 / 打包 / 自检 / 截图 |
| `_originals/` | 原始镜像，不入 git |

## 怎么跑

```bash
# 独立网页（调试用）—— 需要 http 服务，不能 file://
node server.js 4471        # 或任意静态服务
```

⚠️ 别用 `python -m http.server`：这台机器上它把 `.js` 回成 `text/plain`，模块会被浏览器拒绝。

```bash
# 改完原版代码后：重放补丁（幂等，锚点对不上会报错退出）
node scripts/patch-game.mjs

# 自检
node scripts/play-check.mjs          # 开局扣分 / 存档 / 不重复扣分 / 落子 / 控制台
node scripts/store-shots.mjs         # 重拍 screenshots/store-1~4.png

# 打包（会先校验 assets/manifest.json 是否过期）
node scripts/build-plugin.mjs
```

## 经济

只花积分，不产出兑换券：

```
积分 ──新开一关扣 1──▶ 玩 ──▶ 什么都不发
```

- 已付费 / 已通关的关卡重进**免费**
- 同一关失败重来（`retry`）**免费**
- 进阶题**不额外收**
- 原版买命、买皮肤、买 BGM 三条内购路径全部摘掉；8 只狗耳朵皮肤和 4 首 BGM 改成
  **通关解锁**（每 5 关一只狗、每 4 关一首曲子）

## 打包约束（宿主 `blob:` 加载）

- 0 个裸模块说明符、0 个动态 import
- 顶层导出 `manifest` / `mount`，默认导出 `{ manifest, mount }`
- 资源一律走 `ctx.assetUrl()`；根节点由 `mount(container)` 给
- 卸载要能「刚建好就被调用」也不炸
