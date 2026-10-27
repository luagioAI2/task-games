# 接入进度 · 收租公寓（renttower）

- 地址：https://zqd3x2kwy3.mkplay.zone/v/27/index.html
- 原版名：**値上げで満室**（日式公寓经营 / 放置养成，PixiJS 2D 横截面）
- 商城名：**收租公寓** · 底栏 `收租公寓`（4 字，与「云边小农场」「柯基屁屁」不撞）
- 经济：**C 纯玩** · `playCost: 10` / `expectedPayout: 0` / `kind: 'chill'`
- 收费点：**`mount()` 进场扣一次 + 10 分钟宽限**（放置经营没有「一局」这个动作）
  ⇒ `paidAt` **必须写存档**（`host.storage`），写内存变量的话切走 = 卸载 = 静默失效
- 当前：**全部完成**（15 款落库、两档 e2e 全绿、宿主已推送 `826e18f`）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 327 个资源 / 16.97 MB；`find -size 0` 只剩 favicon；JS 474 KB（21 个模块） |
| 2 | 立工程 | ✅ | `index.html` 重写 + 首次提交；smoke 786 色 / 0×404 / 0 pageerror |
| 3 | 压资源 | ✅ | webp 239 张 11.99 MB → 6.88 MB（q85，尺寸不变，`assets` 17 MB → 13 MB）；压完重看截图 |
| 4 | 改造（去内购/排行 + 经济 + 插件化） | ✅ | `gp.pay` / `gp.player` 计数归零；关掉「1000 次游玩纪念」运营活动 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===` 4.38 MB（gzip 2.15 MB）；mount-test 33 项全绿 |
| 6 | 落库 | ✅ | `check:registry` 四处一致（15 款 / 15 条 / 15 条 / 15 行） |
| 7 | 商城详情 | ✅ | 4 张图（`capture.mjs`）+ 逐张自己看 |
| 8 | 五层验收 | ✅ | lint ✓ / vitest 774 ✓ / e2e phone 50s + tablet 66s ✓ / 老款（sweetspin）✓ / 详情 15 款走查 ✓ |
| 9 | 提交 | ✅ | 工程仓库 `325cc1c`；宿主 `49008a1` `68ae694` `f52fa3b` `826e18f`（拆 4 条，见下） |
| 9b | 推送宿主 | ✅ | `ls-remote` == 本地 HEAD `826e18f` |

## 这款和前面几款不一样的地方

1. **`boot()` 已经是 async 函数**，模块体只有一句 `void boot()` ⇒ 插件化不用把整个模块体
   包进 `start()`（尖叫鸡/旋转灯泡那种「整文件缩进」的活省了），改成
   `export async function start(opts)` 调 `boot(opts)` 并返回卸载函数即可。
2. **`window.__debug` 调试桥是原版自带的**（不是我们加的），已经暴露了 money / rooms / konbini /
   shift / storm / raid / scoreState 等只读快照 ⇒ e2e 直接读它，不用另建桥。
   **只有收银界面例外**：那是 Pixi 画的全屏场景，按钮没有 DOM ⇒ 补了一条只读
   `__debug.shiftButtons()`（遍历 `KonbiniShift.btnList`，`getGlobalPosition()` + `hitArea`）。
3. **21 个模块 / 474 KB**（main 71 + ui 100 + view 74 + tenants 65 + sim 47 + kbshift 42 + …），
   是这批里最大的一款；改的时候按模块边界走，别在一个文件里做大手术。
4. **资源在站点根 `assets/`，不在 `game/assets/`**：`PIXI.Assets.load("assets/x.webp")` 按
   **document base** 解析。`scrape.mjs` 把 JS 里的字面量按「相对模块」解析 ⇒ 39 个 404 +
   238 个 0 字节 webp（`--browse` 把 404 体写成了 .webp）。⇒ 用 `mirror-assets.py` 重抓。
5. **walk-\*/lounge-\* 是运行时拼出来的目录**（来源 ③），必须读 manifest 再抓 pages。
6. **资源本来就全是 webp**（站点直接发 webp）⇒ skill 里的 `compress-assets.py` 只认
   png/jpg，扫一遍一个都不匹配；这一款另写了 `scripts/compress-webp.py`（同尺寸重编码 + 原子写）。
7. **`PIXI.Assets.get()` 按 src 取**：`assetUrl()` 加了前缀之后，`load` 用 `{src, alias}` 登记、
   `get` 也必须用 **alias** —— 否则拿到 `undefined`，`new Sprite(undefined)` 静默变白块，
   直到某处读 `tex.width` 才抛（症状是「插件崩了」，其实只是图没了）。
8. **`app.destroy(true,{children:true})` 只销毁 Pixi 对象**，canvas / 四层 UI / 加载页还挂在容器里
   ⇒ `destroy()` 末尾必须 `appEl.replaceChildren()`。

## 改了什么（相对原站）

| 原站 | 现在 |
| --- | --- |
| 内购商城 7 个商品（`gp.pay`） | 4 个内容包（便利店 / 2 栋目 / 空中花园 / 灾害包）**进场即解锁**；2 个作弊/加速道具删掉 |
| 在线排行榜（提交分数 / 好友榜 / 资料页 / 在线状态） | 整段删掉（连按钮 + i18n） |
| 「1000 次游玩纪念」限时活动（租金 ×1.25 / 弹窗 / 金横幅） | `setEventOverride(false)` 关掉（我们这边没有「游玩次数」，且到期会掉 20% 收益） |
| `gp.player.saves` 存档 | `makeSaveApi(store)` 适配 `host.storage`（`putLatest` **必须返回 Promise**） |
| `document.title` / `<html lang>` | `setDocumentSideEffects(!opts.mountTo)` 关掉 |

## 下次从这继续

步骤 8 收尾：

```bash
CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build && npx vite preview --port 4395 --strictPort
node scripts/e2e-renttower.mjs http://127.0.0.1:4395/ phone
node scripts/e2e-renttower.mjs http://127.0.0.1:4395/ tablet
node scripts/e2e-sweetspin.mjs http://127.0.0.1:4395/ phone    # 老款回归（换一款就行）
```

## 环境坑（这台机器）

- `mkplay.zone` 必须 `--proxy http://127.0.0.1:7897`；沙箱自带代理对这个站 exit 56。
- **node 不认 `/c/...`**：传 `C:/Users/...` 的 Windows 绝对路径，否则解析成 `E:\c\...`（MODULE_NOT_FOUND）。
- `/tmp` 不可写 ⇒ 中间产物放仓库内（`task-games/_peek15/`）。
- **bash 的 `python -c "…\s…"` 里 `\s` 会被吃成 `/s`** ⇒ 带正则的一次性脚本写成文件再跑（`scripts/_i18n-check.py`）。
- **webp 重编码用 `method=6` 会撞工具超时**（239 张 > 120 秒，被 SIGTERM 且一行日志都没有）⇒ `method=4`。

## 推送：18 MB 一次推不上去，要拆

实测这台机器上把这一款（包 4.4 MB + 资源 13 MB）**一次**推上去：

| 路线 | 结果 |
| --- | --- |
| 直连 + HTTP/1.1 + 大 postBuffer | 40 秒 `Recv failure: Connection was reset`（另一次是 21 秒连不上 443） |
| 走 7897 + HTTP/1.1 + 大 postBuffer | **12 分半后 HTTP 408**（`send-pack: unexpected disconnect`） |

⇒ 拆成 4 条提交分别推，每条 0.3 / 4.9 / 4.9 / 7.8 MB，单条 2.5~4 分钟，**全部一次过**：

```bash
49008a1  登记 / 文案 / 商城详情图        288 KB
68ae694  插件包 + sound.manifest + pack   4.9 MB
f52fa3b  assets/audio + assets/lib        4.9 MB
826e18f  assets/**/*.webp + manifest.json 7.8 MB
```

★ 拆提交要用 **`git reset --soft <已推送的 SHA>`**，别用 `HEAD~1`：
工具对 escalated 命令会执行两次，`HEAD~1` 跑两遍会一次退掉两条提交。
★★ 推送日志**不能当判据**：失败时末尾也可能打印 `Everything up-to-date`，
真正的判据是 `git ls-remote origin refs/heads/farm-2d` == `git rev-parse HEAD`。
