# 接入进度 · 细胞守卫（cellguard）

- 地址：https://26qsd8yjaz.mkplay.zone/v/2/index.html
- 商城名：细胞守卫 · 底栏 细胞守卫（4 字）
- 经济：C（纯玩，不发券）· 票价 10（每局「开始战斗」收一次）
- 原版名：Cell, Not Today!（原创轻度塔防肉鸽；美术全程序绘制，**0 张图片资源**）
- 当前：**九步全绿**，已上架（包 300 KB / 0 个外部请求 / 0 个 404）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | 静态 4 文件 0.38 MB（`game.js` / `i18n.js` / `saves.js` / `index.html`），`failed` 空；**无 assets/**（美术全程序绘制，`kn = []` 音频列表为空）；`--browse` 只多出 MakePlay 运行时脚本 + 0 字节 favicon |
| 2 | 立工程 | ✅ | `index.html` 重写（`start({container})`）；`.gitattributes` 钉 `eol=lf` |
| 3 | 压资源 | ✅ | **跳过**：无图片 / 无音频（别跑 `compress-assets.py`） |
| 4 | 改造 | ✅ | 体力 / 每日任务 / 签到 / 挂机宝箱 / 每日福利 / 登录云存档 全部拆掉，e2e 逐条断言「页面上没有」 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===`（0 裸说明符 / 0 动态 import / 游戏本体已内联）· 300 KB |
| 6 | 落库 | ✅ | `check:registry` 四处一致（17 款） |
| 7 | 商城详情 | ✅ | 4 张图 + 逐张自己看；`capture-store-detail` 全绿 |
| 8 | 五层验收 | ✅ | phone + tablet 两档 e2e 全绿；`e2e-stackmeow` 回归绿；`lint` 干净；`npm test` 774/774 |
| 9 | 提交 | ✅ | 游戏仓 `e8d898c`；宿主仓 `cd71648`（`git status` 干净） |
| 9b | 推送宿主 | ✅ | 推的是 **`farm-2d`** 分支（`b1faa64..cd71648`），`ls-remote` 的 SHA == 本地 HEAD |

## 要拆的东西（扒完扫出来的）

| 原版机制 | 为什么拆 | 拆法 |
| --- | --- | --- |
| 体力 30/30 + 恢复 + 买体力 | 「不上线就亏」的钩子；开局闸门 | 顶栏 chip / 开始按钮的 ×5 / 商店「体力×N」/ `Ea()` 闸门 |
| 每日任务 | 每日重置的送币 | 首页左侧按钮 + `Wi()` 弹层 |
| 七日签到 | 连续登录奖励 | 首页左侧按钮 + `Bi()` 弹层 |
| 挂机宝箱 | 离线收益（攒满 8 小时） | 首页右侧按钮 + `ms()` 弹层 |
| 每日福利（免费补给/免费金币） | 每日免费送 | 商店第一块面板 |
| 登录 / 云存档文案 | 宿主没有 gp 账号 | `SaveStatus` 里的登录行 |
| 钻石买钥匙 / 开箱 | 钻石是游戏内产出，**没有真钱入口** | 保留（闭环，等价于抓娃娃） |

## 这一款踩到的坑

1. **`document.documentElement.style.fontSize` 是宿主的地基**：原版靠改 `<html>` 字号做全局缩放，
   照搬会把宿主的顶栏底栏（Tailwind 全是 `rem`）一起放大。⇒ 637 处 `rem` 全换成
   `calc(var(--u) * n)`，`--u` 只写在插件根上。
2. **CRLF 会让所有补丁锚点静默失配**：git 按 `core.autocrlf` 检出成 CRLF 后，
   以 LF 写的锚点全部「命中 0 次」，看着像源码变了。⇒ `.gitattributes` 钉 `* text=auto eol=lf`。
3. ★★ **平板：按钮看得见、点不到**。舞台只有「宽 × 1.6」高（原版按手机 2.25 倍设计），
   首页内容比内容区高 8%，「开始战斗」被挤到 tabbar 底下，中心点命中的是中间那颗
   抬起来的「战斗」（比 tabbar 顶高 7px）。**`el.click()` 不走命中测试 ⇒ 照样绿**，
   只有 `elementFromPoint` 那条断言抓得到。⇒ `fitScale()` 按溢出比例缩 `--u`。
4. ★ **`fitScale()` 不能在挂载时算一次**：「切走再切回」是先恢复对局、首页还没渲染，
   挂载那一刻 `querySelector('.menu.tab-home')` 是 null ⇒ 用 MutationObserver 补算
   （节流 200ms，卸载时 `disconnect()` + `cancelAnimationFrame`）。
5. **`liveBattle.killed` 不是 `.kills`**：调试桥字段名写错只会得到 `undefined`，
   而 e2e 里「进度在推进」那条断言会红 —— 别去怀疑游戏没跑。
6. **装完包要重建宿主再跑 e2e**：`install-to-host` 只更新 `public/games/`，
   `vite preview` 服务的是 `dist/`，不重建就是拿旧包在测（症状：新加的桥字段恒 `undefined`）。

## 环境坑

- `mkplay.zone` 直连可用（2026-10-28 实测）。
- 端口从 4390+ / 5390+ 挑，别用 4180 / 4190 / 5190。
- 本作 **DOM（preact）+ canvas** 双栈：界面是 DOM，战斗是 canvas ⇒ `innerText` 有内容，但仍要看截图。
- 按钮是**真 `<button>`**，监听 `onClick`（preact）⇒ e2e 里 `el.click()` 可用；
  但**每颗按钮仍要验一条 `elementFromPoint`**（`click()` 不覆盖「被盖住」）。
