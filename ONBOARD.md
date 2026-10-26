# 接入进度 · 爆汁瓜瓜罐（melonjar）

> 这个文件是**断点续做**用的。每一步做完立刻改状态，别攒到最后一起写。
> 下次开工：先读「下次从这继续」，再按表格里第一个 ⬜ / 🔄 往下做。
> 判据不写「做了」，写**能验的东西**（数字 / 文件名 / 命令输出）。

- 地址：`https://r7y9bq7hrp.mkplay.zone/v/12/index.html`
- 商城名：爆汁瓜瓜罐（5 字）· 底栏 `瓜瓜罐`
- 形态：PixiJS + Rapier2D，西瓜合成罐（落果堆叠），3 语（zh/en/ja）
- 开始：2026-10-26 12:50
- 当前：步骤 2 待做

## 步骤表

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像（静态 + `--browse`） | ✅ | **40 个文件 / 24 MB / 0 个 0 字节**（`_scrape-report.json` 不计）；见下方「抓取实录」 |
| 2 | 立工程（scaffold） | ⬜ | `index.html` 重写、`.gitignore` / `.gitattributes` / `README`、首次提交 |
| 3 | 压资源 | ⬜ | 压缩前后总 KB + 最差 PSNR；**压完必须重看截图**（缩放按实际纹理宽） |
| 4 | 改造：去内购 / 排行 / 云存档；定经济 | ⬜ | `gp.pay` / `submitScore` / `topScores` / `gp.player.saves` 计数归零 |
| 5 | 打包 | ⬜ | `dist-plugin/melonjar.plugin.mjs` + `=== 打包校验通过 ===` |
| 6 | 落库（四处登记） | ⬜ | `npm run check:registry` 四处一致（7 款） |
| 7 | 商城详情（文案 + 4 张图） | ⬜ | `public/store/melonjar/1..4.webp`；**逐张自己看** |
| 8 | 五层验收 | ⬜ | 静态 7 款回归 · lint · 单测 · e2e 手机 + 平板 · 截图走查 |
| 9 | 提交（两个仓库） | ⬜ | `git status` 干净 |

## 侦察结论（步骤 0，已做完）

| 项 | 情况 | 处理 |
| --- | --- | --- |
| 内购 | `gp.pay.purchase` **3 处**：复活（`REVIVE_ITEM`）、摇一摇（`SHAKE_ITEM`）、宝石包；另有 `gp.pay.pending()` / `ack()` 补发 | 整块删，改成游戏内宝石 |
| 排行榜 | `submitScoreOnce()` → `gp.player.submitScore`；`topScores(10)`；`#board-screen` 面板 | 删函数 + 删面板 + 删按钮 |
| 云存档 | `gp.player` 34 处 | 换 `host.storage` |
| 每日 | `dailyKey()` + `seedFrom()` + `mulberry32`，是**按日期播种的挑战局**（有 streak），不产出资源 | **保留**（不联网也能玩） |
| 广告 / 抽卡 / 签到 / 兑换码 / 联机 | 无 | — |
| 语言 | 3 语 | 保留 |

## 抓取实录（步骤 1，2026-10-26）

- `--browse` 一遍只拿到 27 个文件，其中 **6 张水果图是 0 字节**（f02–f06、f11），
  而且 **f07–f10 连文件都不存在** —— 只查「文件在不在」会全绿。
  原因：`fruitUrl(l) = assets/fruits/f${pad2(l)}.png` 是模板字符串拼的（来源 ③），
  首屏只加载 f01，其余要合出来才请求。
- 按可预测路径直抓，补齐 **f01–f11 共 11 档**（f07–f10 那 4 张连 0 字节都没有，只能按 id 全量请求）。
- `sound.manifest.json` 被静态扫成了 `sound.manifest.js`（404）⇒ 直接请求拿到 8073 B；
  按里面的 `url` 补了 `sound.pack`（69 KB）和 BGM mp3（2,365,141 B）。
  ★ **mp3 的 sha256 与清单里的 `sha256` 逐位一致** —— 这条可以当「音频抓全了」的硬判据。
- 成就图标 `assets/achievements/${key}.png` 同样是模板拼的，按 i18n 里 8 个 key 补齐
  （每张 1.1–1.3 MB，压缩空间很大）。
- 最终：**40 文件 / 24 MB / 0 个 0 字节**。

## 下次从这继续

步骤 2：`node <skill>/scripts/scaffold.mjs melonjar "爆汁瓜瓜罐" <项目>/_originals/2026-10-26 --source <地址>`，
然后把步骤 2 改成 ✅ 并写首次提交的 sha。

### 本机特有：抓取必须走代理

```bash
node <skill>/scripts/scrape.mjs <地址> <项目>/_originals/<日期> --proxy http://127.0.0.1:7897 --browse --wait 9000
```

`mkplay.zone` 直连是 000，Node 的 `fetch` 不读 `HTTPS_PROXY`；沙箱自带的代理（62xxx）对这个站 exit 56。
