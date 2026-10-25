# 甜点魔法学院 · sugar

扒自 `https://29zwsj55ar.mkplay.zone/v/14/index.html`，改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `sugar` |
| 商城名 | 甜点魔法学院 |
| 版本 | 0.0.0（改完再定，与宿主 `public/games/index.json` 必须一致） |
| 扒取来源 | https://29zwsj55ar.mkplay.zone/v/14/index.html |
| 扒取日期 | 2026-10-25 |
| 入口模块 | `./game.js` |
| 原始镜像 | `_originals/2026-10-25/`（不入 git） |
| 经济形态 | **待定**（A 币+券 / B 只花积分 / C 纯玩，见 `docs/game-onboarding.md` §4.2） |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'sugar'` |
| 商城截图 | `shots/*.png` → `public/store/sugar/*.webp` |

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

## 还差什么（照 `docs/game-onboarding.md` 的清单走）

- [ ] 资源压缩（`compress-assets.py`）+ 引用侧同步改后缀
- [ ] 插件化五件事（根节点 / host.storage / alive 守卫 / forceContextLoss / scopeCss）
- [ ] 经济改造（选 A/B/C），删掉所有「送币 / 看广告 / 签到」入口
- [ ] `scripts/build-plugin.mjs` + `scripts/check-plugin.mjs`
- [ ] 宿主三处登记（index.json / localGames.ts / storefront.ts）
- [ ] 截图 + 文案 + 五层验收
