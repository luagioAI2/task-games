# 接入进度 · 尖叫鸡（screamchick）

- 地址：https://xruzbtmnsf.mkplay.zone/v/7/index.html
- 商城名：尖叫鸡 · 底栏 尖叫鸡（3 字）
- 经济：**C（纯玩）** · 进场/每关票价 **待定（初定 8）**
- 当前：步骤 1 进行中

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 0 | 侦察 | ✅ | PixiJS + `game.js` 单入口 + `levels.js`（**50 关**）+ `i18n.js`（zh/en/ja）；有 `sound.manifest.json`；**内购**：`window.gp.pay` 卖「三星通行证」1 平台币/关 ⇒ 必须整块删 |
| 1 | 抓镜像 | ⬜ | `failed` 为空；`find -size 0` 为空 |
| 2 | 立工程 | ⬜ | `index.html` 重写；首次提交 |
| 3 | 压资源 | ⬜ | 前后 KB；**压完重看截图** |
| 4 | 改造（插件化 + 删内购 + 经济） | ⬜ | `gp.pay` 计数 0；`mount/unmount` 可重入 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交 | ⬜ | `git status` 干净 |
| 9b | 推送宿主 | ⬜ | `ls-remote` 的 SHA == 本地 HEAD（**不是**看 `git status` 的 `[gone]`） |

## 下次从这继续

从步骤 1 跑抓取（**必须 `--proxy http://127.0.0.1:7897`**）：

```bash
cd /e/plan/test25/task-games
node ~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs \
  https://xruzbtmnsf.mkplay.zone/v/7/index.html screamchick/_originals/2026-10-27 \
  --proxy http://127.0.0.1:7897
```

## 环境坑

- `mkplay.zone` 直连 000 ⇒ 必须 `--proxy http://127.0.0.1:7897`（Node 22 的 `fetch` 不读 `HTTPS_PROXY`）。
- 给 node 传路径要用 `E:/plan/...`（Windows 形式）；`/e/plan/...` 会被解析成 `\e\plan\...`。
- heredoc 里带 `${}` / `\s` 会被 bash 吃掉 ⇒ 脚本一律用 Write 工具落盘再跑。
