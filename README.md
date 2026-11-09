# task-games · 小任务农场的游戏接入工程

每款游戏一个子目录，各自是「扒取 → 改造 → 打包成插件」的完整工程：

- `plugin.js` —— 宿主插件入口（manifest + mount）
- `src/` / `assets/` —— 游戏本体与资源
- `scripts/build-plugin.mjs` —— 打 `dist-plugin/<id>.plugin.mjs`（单文件 ESM）
- `ONBOARD.md` —— **接入进度与决策的事实来源**（名字 / 经济 / 已砍功能 / 验收记录）
- `README.md` —— 怎么跑

## 目录

| 目录 | 商城 id | 来源 | 备注 |
| --- | --- | --- | --- |
| `anthill/` | `anthill` | https://zetwsserdm.mkplay.zone/v/7/index.html | — |
| `blockfit/` | `blockfit` | https://da22ty94rk.mkplay.zone/v/4/index.html | — |
| `cellguard/` | `cellguard` | https://26qsd8yjaz.mkplay.zone/v/2/index.html | — |
| `claw-machine/` | `claw3d` | （本地工程） | 商城 id 为 `claw3d` |
| `cloudfarm/` | `cloudfarm` | https://xd6q6wqxhc.mkplay.zone/v/4/ | — |
| `corgi/` | `corgi` | https://hw9mzzjpe2.mkplay.zone/v/1/index.html | — |
| `deckrush/` | `deckrush` | https://k65swyemts.mkplay.zone/v/3/index.html | — |
| `doodlederby/` | `doodlederby` | https://vvb96grafh.mkplay.zone/v/6/index.html | — |
| `fall2048/` | `fall2048` | https://vp8stka3kk.mkplay.zone/v/29/index.html | — |
| `farmlord/` | `farmlord` | https://bh34uhqxcb.mkplay.zone/v/9/index.html | — |
| `guardshift/` | `guardshift` | https://689vk93zbm.mkplay.zone/v/25/index.html | — |
| `hoopsneak/` | `hoopsneak` | https://hdqcg224dd.mkplay.zone/v/13/index.html | — |
| `inudoku/` | `inudoku` | https://d337snrctr.mkplay.zone/v/29/index.html | — |
| `melonjar/` | `melonjar` | https://r7y9bq7hrp.mkplay.zone/v/12/index.html | — |
| `minergirl/` | `minergirl` | https://udf38ynwyj.mkplay.zone/v/13/index.html | — |
| `moestrike/` | `moestrike` | https://xr6jeq6sar.mkplay.zone/v/6/index.html | — |
| `prize-park-local/` | `prizepark` | https://jadsm6ugtx.mkplay.zone/v/1/index.html | 商城 id 为 `prizepark` |
| `redbutton/` | `redbutton` | https://w6de7fjfv2.mkplay.zone/v/8/index.html | — |
| `renttower/` | `renttower` | https://zqd3x2kwy3.mkplay.zone/v/27/index.html | — |
| `ropeland/` | `ropeland` | https://zsdau6qcgc.mkplay.zone/v/2/index.html | — |
| `screamchick/` | `screamchick` | https://xruzbtmnsf.mkplay.zone/v/7/index.html | — |
| `stackmeow/` | `stackmeow` | https://dx38epea4f.mkplay.zone/v/4/index.html | — |
| `sugar/` | `sugar` | https://29zwsj55ar.mkplay.zone/v/14/index.html | — |
| `sweetspin/` | `sweetspin` | https://wgcmeua7be.mkplay.zone/v/4/index.html | — |

## 发一版到线上

```bash
cd <游戏目录>
node scripts/build-plugin.mjs          # 出 dist-plugin/<id>.plugin.mjs

# 登记进后台 + 上传包 + 挂上心愿商城（用 publish-game-to-backend skill 里的脚本）
node C:/Users/admin/.workbuddy-ai/skills/publish-game-to-backend/scripts/publish-game.mjs \
  --project E:/plan/test25/task-games/<游戏目录> \
  --api http://127.0.0.1:8091 --key <AdminSignKey>
```

上架有三处独立状态（都绿才算真的上架）：`game.status = available`、
`wish_item.archived = 0`、`game_release.active = 1`，外加盲盒池成员。

## 约定

- **原版镜像不入库**：`_originals/` 在 `.gitignore` 里，需要时按 `ONBOARD.md` 里的地址重抓。
- **不提交构建产物**：`dist/`、`dist-plugin/`、`node_modules/`。
- 改过资源必须重跑 `scripts/make-asset-manifest.mjs`，否则宿主校验会报「哈希对不上」。
- 每款游戏的历史是**按子树并入**本仓库的：`git log <并入提交>^2` 能看到它原来的提交；
  注意 `git log -- <目录>` **看不到**（那些提交里文件还在仓库根，路径不匹配）。
