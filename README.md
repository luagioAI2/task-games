# 爆汁瓜瓜罐 · melonjar

扒自 `https://r7y9bq7hrp.mkplay.zone/v/12/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `melonjar` |
| 商城名 | 爆汁瓜瓜罐 |
| 版本 | 0.0.0（改完再定，与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://r7y9bq7hrp.mkplay.zone/v/12/index.html |
| 扒取日期 | 2026-10-26 |
| 入口模块 | `./game.js` |
| 原始镜像 | `_originals/2026-10-26/`（不入 git） |
| 经济形态 | **待定**（A 币+券 / B 只花积分 / C 纯玩，见 `docs/game-onboarding.md` §4.2） |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'melonjar'` |
| 商城截图 | `shots/*.png` → `public/store/melonjar/*.webp` |

## 现在能跑吗

```bash
node server.js <port>        # 或任意静态服务（⚠️ 不能用 python -m http.server：
                             # 这台机器上它把 .js 回成 text/plain，模块被浏览器拒绝）
```

改造前的自检：页面能开、**控制台 0 个 404**、核心玩法点得动。

## 还差什么（照 `docs/game-onboarding.md` 的清单走）

- [ ] 资源压缩（`compress-assets.py`）+ 引用侧同步改后缀
- [ ] 插件化五件事（根节点 / host.storage / alive 守卫 / forceContextLoss / scopeCss）
- [ ] 经济改造（选 A/B/C），删掉所有「送币 / 看广告 / 签到」入口
- [ ] `scripts/build-plugin.mjs` + `scripts/check-plugin.mjs`
- [ ] 宿主三处登记（index.json / localGames.ts / storefront.ts）
- [ ] 截图 + 文案 + 五层验收
