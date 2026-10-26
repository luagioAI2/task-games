# 挖矿少女 · minergirl

扒自 `https://udf38ynwyj.mkplay.zone/v/13/index.html`（原站自称 **深渊矿业公司 / Abyss Mining Co.**），
改造后作为 `kid-quest-farm-2d` 的插件运行。

## 接入信息

| 项 | 值 |
| --- | --- |
| 插件 id | `minergirl` |
| 商城名 | 挖矿少女 |
| 版本 | 1.0.0（与宿主 `public/games/index.json` 一致） |
| 扒取来源 | https://udf38ynwyj.mkplay.zone/v/13/index.html |
| 扒取日期 | 2026-10-26 |
| 入口模块 | 独立网页 `./game.js` · 插件 `plugin.js` |
| 原始镜像 | `_originals/2026-10-26/`（不入 git） |
| 经济形态 | **B 只花积分**：进场 15（10 分钟宽限），不设币、不发券 |
| 宿主清单 | `kid-quest-farm-2d/public/games/index.json` → 自动生成 `src/games/localGames.ts` |
| 商城详情 | `kid-quest-farm-2d/src/games/storefront.ts` → `id: 'minergirl'` |
| 商城截图 | `shots/01-mine|02-level|03-shop|04-skins.png` → `public/store/minergirl/*.webp` |

## 跑起来

```bash
# 独立网页（调试用）
node server.js 4411          # ⚠️ 不能用 python -m http.server：这台机器上它把 .js 回成
                             # text/plain，模块被浏览器拒绝

# 插件（打成一个 ESM 包 + 铺资源）
node scripts/build-plugin.mjs

# 三层自检
node scripts/smoke.mjs        # 独立网页：8 条
node scripts/mount-test.mjs   # 假宿主：33 条（遮挡 / 收费 / 宽限 / 存档 / 平板）
node scripts/capture.mjs      # 商城详情页那 4 张图的源图
```

宿主那边：

```bash
cd ../../kid-quest-farm-2d
node scripts/check-game-registry.mjs     # 四处登记一致
node scripts/check-plugin.mjs public/games/minergirl/minergirl.plugin.mjs --assets public/games/minergirl/assets
python scripts/build-store-shots.py
npm run lint && npm test
node scripts/e2e-minergirl.mjs http://127.0.0.1:4393/ phone
```

## 改造清单（都做完了）

- [x] 资源：**没压**（13.3 MB，比已上架的几款小，理由见 `ONBOARD.md`）
- [x] 插件化五件事：根节点 `#mng-root` / `host.storage`（preload+flush）/ `alive` 守卫 /
      `app.destroy({removeView:true},{texture:false})` / `scoped-css.js` 作用域化
- [x] 经济：B 型，删掉所有内购（`gp.pay`）、排行榜、登录云同步、`?qa` 假钱包
- [x] 皮肤：14 套，按**累计收入**解锁（$1K → $3T），只换外观
- [x] `scripts/build-plugin.mjs`（含样式作用域审计）+ `make-asset-manifest.mjs`
- [x] 宿主四处登记（index.json / localGames.ts / storefront.ts / build-store-shots.py 的 PLAN）
- [x] 截图 + 文案 + 五层验收

## 目录里值得知道的几件事

| 文件 | 为什么在这 |
| --- | --- |
| `src/scoped-css.js` | 49 KB 整页样式收进 `#mng-root`；`fixed→absolute`、`vw/vh→容器变量`、keyframes 加 `mng-` 前缀 |
| `src/host.js` | 宿主 `storage` 是 async 的，游戏要 sync ⇒ 内存缓存 + `preload()` / `flush()` |
| `src/styles-inline.js` | **生成物**（`build-plugin.mjs` 从 `styles.css` 写），样式内联进包，少一次请求也受哈希保护 |
| `src/data/skins.js` | 皮肤阶梯表。**改门槛只改这张表**，别在 `ui.js` 里写数字 |
| `plugin.js` | 只做外壳：进场收费 + 宽限、把 `host.storage` 和 `ctx.assetUrl` 注入 `start()` |
| `ONBOARD.md` | 接入进度、尺寸决定、这次踩到的坑 |
