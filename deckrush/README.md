# 一分钟卡组 · deckrush

扒自 `https://k65swyemts.mkplay.zone/v/3/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `deckrush` |
| 商城名 | 一分钟卡组 |
| 版本 | 1.0.0（与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://k65swyemts.mkplay.zone/v/3/index.html |
| 扒取日期 | 2026-10-27 |
| 入口模块 | `./game.js` 的 `start(opts)`（独立网页由 `index.html` 调，插件由 `plugin.js` 调） |
| 原始镜像 | `_originals/2026-10-27/`（不入 git） |
| 经济形态 | **C 纯玩**：每开一局 10 积分，`expectedPayout: 0`、不发券、无宿主币，`kind: 'chill'` |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'deckrush'` |
| 商城截图 | `shots/01-title.png` … `04-cards.png` → `public/store/deckrush/1..4.webp` |

## 现在能跑吗

```bash
node "~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/smoke.mjs" "E:/plan/test25/task-games/deckrush" --shot
# 或任意静态服务（⚠️ 不能用 python -m http.server：这台机器上它把 .js 回成 text/plain）
```

判据：0 个非 favicon 的 4xx/5xx、0 个 pageerror、截图颜色种类 ≥ 20。

## 常用命令

```bash
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs   # 打包
node scripts/make-asset-manifest.mjs                            # 改了资源就要重跑
node scripts/mount-test.mjs --port 4412                         # 假宿主（第 3 层）
node scripts/capture.mjs                                        # 拍商城 4 张图
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/install-to-host.mjs  # 拷进宿主 + 重算哈希
cd ../../kid-quest-farm-2d && npm run check:registry            # 四处登记对齐
```

## 改造记录

- 插件化补丁在 `scripts/_patch.py`（26 个锚点，已执行；每个锚点必须恰好命中 1 次）。
- 补抓脚本 `scripts/fetch-missing.mjs`：0 字节资源 + `sound.manifest.json` 里列出的
  音频变体（音乐是流式的，静态扫和 `--browse` 都拿不到），按清单里的 `bytes` 逐字节核对。
- 细节与踩过的坑见 `ONBOARD.md` 的「事故」一节。
