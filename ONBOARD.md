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
| 包 | 4.30 MB 单文件（资源 8.07 MB 另放） |
| 提交 | 游戏仓 `467e8ee`（改造）+ 本文件那一条；宿主仓见末尾 |

## 九步进度

| # | 步骤 | 状态 | 判据 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 5 个模块 + 58 张 webp + 10 套走路图集 + 5 首音乐 + `sound.pack`（模板串路径靠补抓，见下） |
| 2 | 立工程 | ✅ | `index.html` 重写、`* text=auto eol=lf`、首次提交 |
| 3 | 压资源 | ✅ | webp 5.37 MB → 2.28 MB（42%），尺寸一像素没动 |
| 4 | 改造 | ✅ | 见下「改造清单」；`node --check` 三个文件全绿 |
| 5 | 打包 | ✅ | 4.30 MB · 0 裸说明符 / 0 动态 import · `check-plugin` 通过（2 条提示均为预期） |
| 6 | 登记 | ✅ | `check:registry` **19 款**四处一致（清单 / 哈希 / 商城 / 截图源）+ `GameIcon` ART |
| 7 | 商城页 | ✅ | 4 张图（标题 / 战斗 / 图鉴 / 卡组）+ `capture-store-detail` 19 款全绿 |
| 8 | 验收 | ✅ | phone + tablet e2e 全绿；`e2e-cellguard` 回归绿；`lint` 干净；`npm test` 774/774 |
| 9 | 提交推送 | ✅ | 游戏仓 `467e8ee`；宿主仓推 `farm-2d`，`ls-remote` 对 SHA |

## 改造清单

| 钩子 | 位置 | 处理 |
| --- | --- | --- |
| 「登录后可保存游戏进度」+ 登录按钮 | `ui.js` 的 `guestRow` 分支 | 整块删（`window.gp.player.requestLogin`） |
| `gp.player.ready` / `gp.player.user` | `game.js` 尾部 | 换成 `opts.store` 适配层 |
| `document.title = "Guardshift"` | `ui.js` `mountUI` | 删（会改宿主标题） |
| `document.documentElement.lang = "zh"` | `i18n.js` `setLang` | 删（宿主 `<html lang>` 是它的地基） |
| 字体从 `static.makeplay.ai` 拉 | `game.js` | 删（2.18 MB 远程依赖，系统字体兜底） |
| `.ui{position:fixed}` 等 5 处 | `ui.js` CSS | 改 `absolute` |
| 卡牌拖拽幽灵 / 单位拖拽幽灵 | `ui.js` / `game.js` | `document.body` + `fixed` → 容器内 `absolute` + 减容器左上角 |
| 音频清单 `./sound.manifest.json` | `game.js` | 改 `AB + "sound.manifest.json"`（否则打到宿主根，拿 404 HTML 当 JSON） |
| 首次安装不落盘 | `game.js` `ft()` | 无存档时**放开写**（原版 `ee=!1` 是为「没登录别覆盖云端」，插件里等于永存不了档） |

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
5. **`mountUI` 的 root 参数漏了会静默失效**：`scopeCss(css)` 少了第二个参数时前缀拼成字面量
   `undefined` ⇒ 样式一条都不匹配，页面**零报错**、UI 全裸在画布底下（看不见）。
   判据：`grep` 产物里有没有 `,".gs")`。
6. **`ui.js` 在模块顶层 `document.createElement`** ⇒ `check-plugin` 在 Node 里真 `import()` 时
   `document is not defined`。改成 `ensureDom()` 延迟建。
7. **调试桥要能「贴着路放兵」**：`act.route()` 返回路径格（`"c,r"`），截图/e2e 靠它找合法格，
   别写死像素（棋盘随容器缩放）。放兵走 `sim.place()` 而不是 `tapCell()` —— 后者在非法格上会弹
   「不能放在这里」，截图里那条红字正好在画面正中，看着像「一进去就报错」。
8. **返回键是纯图标**（`.btn.icon` + `aria-label="返回"`，`innerText` 是空串）⇒ 自动化里按文字找会
   点空，而失败会让后面整段（图鉴、再开一局）全部错位，看起来像「图鉴点不开」。
9. **关卡列表不适合当商城图**：整屏「未解锁」。改用「伙伴图鉴」（14 防守 + 12 进攻，带类型标签）。

## 常用命令

```bash
# 改造（只在**原始镜像**上跑一次；HEAD 已经是改造后的版本，git checkout 回不去）
cp _originals/2026-10-28/{game,ui,i18n}.js . && node scripts/_patch.mjs

node scripts/build-plugin.mjs            # 打包 + 静态校验
node scripts/install-to-host.mjs         # 装进宿主（含 assets / sound.pack / 清单）
node scripts/install-to-host.mjs --check # 只比对字节
node scripts/capture.mjs                 # 4 张商城图 → screenshots/

cd ../../kid-quest-farm-2d
npm run build && CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
node scripts/e2e-guardshift.mjs http://127.0.0.1:4393/ phone
node scripts/e2e-guardshift.mjs http://127.0.0.1:4393/ tablet
```
