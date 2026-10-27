# 接入进度 · 堆呀堆（stackmeow）

- 地址：https://dx38epea4f.mkplay.zone/v/4/index.html
- 商城名：堆呀堆 · 底栏 堆呀堆
- 经济：C（纯玩，不发券）· 票价 10（每局「开始」收一次）
- 原版名：積んでミーヤ / Stack It, Ya!（一键叠积木，PixiJS）
- 当前：步骤 1 抓镜像 🔄

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | 🔄 | `failed` 为空；资源张数与玩法对得上 |
| 2 | 立工程 | ⬜ | `index.html` 重写；首次提交 |
| 3 | 压资源 | ⬜ | 前后 KB + 最差 PSNR；**压完重看截图** |
| 4 | 改造（去内购/排行/云存档 + 经济） | ⬜ | 敏感 API 计数归零 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交 | ⬜ | `git status` 干净 |
| 9b | 推送宿主 | ⬜ | `ls-remote` 的 SHA == 本地 HEAD |

## 下次从这继续

步骤 1：`node ~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs <url> _originals/2026-10-28 --browse`

## 环境坑

- 这台机器上 `mkplay.zone` **直连可用**（2026-10-28 实测 fetch 200）；直连失败再走 `--proxy http://127.0.0.1:7897`。
- 端口从 4390+ / 5390+ 挑，别用 4180 / 4190 / 5190。
