# 轮班守卫（guardshift）· 上架台账

| 项 | 值 |
| --- | --- |
| 源站 | `https://689vk93zbm.mkplay.zone/v/25/index.html` |
| 原名 | Guardshift（看清路线，布下陷阱与士兵） |
| id | `guardshift` |
| 商城名 | 轮班守卫 |
| 底栏 | 轮班守卫（4 字） |
| 经济 | **C 型纯玩**（`expectedPayout: 0` · `kind: 'chill'`） |
| 票价 | 10 积分 / 一局（= 一次「出阵」，重试同一关不再收） |
| 引擎 | Pixi + `@makeplay/{display,fx,sound}` |

## 九步进度

| # | 步骤 | 状态 | 判据 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 源码 5 个模块 + 58 张 webp + 10 套走路图集 + 5 首音乐 + `sound.pack` |
| 2 | 立工程 | ✅ | `index.html` 重写、`eol=lf`、首次提交 |
| 3 | 压资源 | ✅ | webp 5.37 MB → 2.28 MB（42%），尺寸一像素没动 |
| 4 | 改造 | ⬜ | 见下「要拆的东西」 |
| 5 | 打包 | ⬜ | 0 裸说明符 / 0 动态 import |
| 6 | 登记 | ⬜ | 五处（含 `GameIcon.tsx` 的 ART） |
| 7 | 商城页 | ⬜ | 4 张截图 + 详情页走查 |
| 8 | 验收 | ⬜ | phone + tablet e2e |
| 9 | 提交推送 | ⬜ | 游戏仓 + 宿主仓 `farm-2d`，`ls-remote` 对 SHA |

## 要拆的东西

| 钩子 | 位置 | 处理 |
| --- | --- | --- |
| 「登录后可保存游戏进度」+ 登录按钮 | `ui.js` 的 `guestRow` 分支 | 整块删（`window.gp.player.requestLogin`） |
| `gp.player.ready` / `gp.player.user` | `game.js` 尾部 | 换成存档适配层 |
| `document.title = "Guardshift"` | `ui.js` `mountUI` | 删（会改宿主标题） |
| 字体从 `static.makeplay.ai` 拉 | `game.js` | 删（2.18 MB 远程依赖，系统字体兜底） |
| `.ui{position:fixed}` 等 5 处 | `ui.js` CSS | 改 `absolute`（`.dragGhost` 保留 fixed） |

**没有**抽卡 / 内购 / 体力 / 日常 / 签到 / 排行榜 —— 这一款很干净。
游戏内货币是「金币」（关卡内）+「钻石」（永久强化），只活在存档里，不换积分。

## 这一款的新形状（写下来给下一款参考）

1. **资源路径全是模板串**：`assets/board/def-${e}-${s}.webp`、`fetch(\`${dir}/manifest.json\`)`、
   `assets/ui/orb-${c}.webp`。静态抓取器**一个都收不到**（它只会跟 `"assets/..."` 字面量），
   而页面**照样能跑**（只是图全空）⇒ 判据必须是「0 个 404」而不是「画面出来了」。
2. **音频清单不在 `assets/`**：`sound.manifest.json` + `sound.pack` 在**包根目录**
   （假宿主把 `dist-plugin/` 当站点根 ⇒ 根文件看不见，这条坑上次踩过）。
3. `sound.pack` 的 `payloadBytes`(90173) ≠ 文件字节(91120)：差的是 14 字节头 + 32 字节盐 +
   901 字节加密索引。**不要拿文件字节去比 payloadBytes**。
4. 走路图集是 `manifest.json` + N 张分页，帧几何写在清单里 ⇒ 压缩只能换编码参数，**不能缩放**。
