# 接入进度 · 收租公寓（renttower）

- 地址：https://zqd3x2kwy3.mkplay.zone/v/27/index.html
- 原版名：**値上げで満室**（日式公寓经营 / 放置养成，PixiJS 2D 横截面）
- 商城名：**收租公寓** · 底栏 `收租公寓`（4 字，与「云边小农场」「柯基屁屁」不撞）
- 经济：**C 纯玩** · `playCost: 10` / `expectedPayout: 0` / `kind: 'chill'`
- 收费点：**`mount()` 进场扣一次 + 10 分钟宽限**（放置经营没有「一局」这个动作）
  ⇒ `paidAt` **必须写存档**（`host.storage`），写内存变量的话切走 = 卸载 = 静默失效
- 当前：**步骤 1 完成**（镜像 327 个资源 / 16.97 MB），步骤 2 进行中

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 327 个资源 / 16.97 MB；`find -size 0` 只剩 favicon；JS 474 KB（21 个模块） |
| 2 | 立工程 | 🔄 | `index.html` 重写 + 首次提交已完成；smoke 待跑 |
| 3 | 压资源 | ⬜ | 前后 KB；**压完重看截图** |
| 4 | 改造（去内购/排行 + 经济 + 插件化） | ⬜ | `gp.pay` / `gp.player` 计数归零 |
| 5 | 打包 | ⬜ | `=== 打包校验通过 ===` |
| 6 | 落库 | ⬜ | `check:registry` 四处一致 |
| 7 | 商城详情 | ⬜ | 4 张图 + 逐张自己看 |
| 8 | 五层验收 | ⬜ | 两档 e2e + 老款回归 |
| 9 | 提交 | ⬜ | `git status` 干净 |
| 9b | 推送宿主 | ⬜ | `ls-remote` 的 SHA == 本地 HEAD |

## 这款和前面几款不一样的地方

1. **`boot()` 已经是 async 函数**，模块体只有一句 `void boot()` ⇒ 插件化不用把整个模块体
   包进 `start()`（尖叫鸡/旋转灯泡那种「整文件缩进」的活省了），改成
   `export async function start(opts)` 调 `boot(opts)` 并返回卸载函数即可。
2. **`window.__debug` 调试桥是原版自带的**（不是我们加的），已经暴露了 money / rooms / konbini /
   shift / storm / raid / scoreState 等只读快照 ⇒ e2e 直接读它，不用另建桥。
3. **21 个模块 / 474 KB**（main 71 + ui 100 + view 74 + tenants 65 + sim 47 + kbshift 42 + …），
   是这批里最大的一款；改的时候按模块边界走，别在一个文件里做大手术。
4. **资源在站点根 `assets/`，不在 `game/assets/`**：`PIXI.Assets.load("assets/x.webp")` 按
   **document base** 解析。`scrape.mjs` 把 JS 里的字面量按「相对模块」解析 ⇒ 39 个 404 +
   238 个 0 字节 webp（`--browse` 把 404 体写成了 .webp）。⇒ 用 `mirror-assets.py` 重抓。
5. **walk-\*/lounge-\* 是运行时拼出来的目录**（来源 ③），必须读 manifest 再抓 pages。

## 下次从这继续

步骤 2 收尾：`smoke.mjs task-games/renttower --wait 15000 --shot`（判据 0 个 404 / 0 pageerror /
颜色 ≥ 20），然后进步骤 3 压资源。

## 环境坑（这台机器）

- `mkplay.zone` 必须 `--proxy http://127.0.0.1:7897`；沙箱自带代理对这个站 exit 56。
- **node 不认 `/c/...`**：传 `C:/Users/...` 的 Windows 绝对路径，否则解析成 `E:\c\...`（MODULE_NOT_FOUND）。
- `/tmp` 不可写 ⇒ 中间产物放仓库内（`task-games/_peek15/`）。
