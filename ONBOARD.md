# 接入进度 · 挖矿少女（minergirl）

- 地址：https://udf38ynwyj.mkplay.zone/v/13/index.html
- 原站自称：**深渊矿业公司 / Abyss Mining Co.**（`saveKey: abyss-mine:v2`）
- 商城名：**挖矿少女** · 底栏 `挖矿` · 图标 ⛏️ · 币 💵 现金（只在游戏存档里）
- 经济：**B 只花积分** · 进场 15（`mount()` 里扣一次 + 10 分钟宽限，同 anthill）
- 拆改：删内购（`gp.pay` 皮肤商店 / 用硬币招募投资人）、删全服排行榜与登录云同步；
  **皮肤保留，改成按累计收入解锁**
- 当前：**步骤 1–8 全部完成**，只差提交（步骤 9）

| # | 步骤 | 状态 | 判据 / 产物 |
| --- | --- | --- | --- |
| 1 | 抓镜像 | ✅ | `failed` 空；`find -size 0` 空；190 个资源 / 13.3 MB |
| 2 | 立工程 | ✅ | `index.html` 重写；`smoke.mjs` 8 条全绿（889 色） |
| 3 | 压资源 | ✅ **决定不压** | 见下「尺寸决定」 |
| 4 | 改造（去内购/排行/云存档 + 经济） | ✅ | `window.gp` / `rank` / `sandbox` 计数归零；皮肤改阶梯 |
| 5 | 打包 | ✅ | `=== 打包校验通过 ===`（1125 KB · 406 条规则 0 漏网） |
| 6 | 落库 | ✅ | `check:registry` 四处一致（8 款）+ `--self-test` 8 类变异全红 |
| 7 | 商城详情 | ✅ | 4 张图逐张看过；`public/store/minergirl/1..4.webp` |
| 8 | 五层验收 | ✅ | `mount-test` 33/33 · `e2e-minergirl` phone+tablet 全绿 · prizepark 老款回归全绿 |
| 9 | 提交 | ⬜ | `git status` 干净（宿主工作区现有 11 项改动，见末尾） |

## 尺寸决定：**不重新压图**（2026-10-26）

`assets/` 一共 13.3 MB / 190 个文件（精灵 7.89 MB / 156 个、音频 3.33 MB、环境 2.04 MB）。
和已经上架的几款比：

| 游戏 | 资源体积 |
| --- | --- |
| 云边小农场 | ~15 MB |
| 少女战记 | ~14 MB |
| **挖矿少女** | **13.3 MB** |
| 抓奖乐园 | ~11 MB |
| 爆汁瓜瓜罐 | 8.6 MB |
| 蚂蚁搬家 | 6.0 MB |

它**不是最大的那一档**，而且原站已经把图做成 webp。本机没有 `ffmpeg`，190 张 webp 重编码
要另装编码器 —— 收益（最多省几 MB）不抵风险（`im.save()` 中途被杀会截断成 0 字节，
下一轮直接 `UnidentifiedImageError`，见记忆里的原子写规则）。所以**跳过**这一步，
也就没有「压完重看截图」这道检查（精灵缩放用的是**实际纹理宽**，见 `artScale`）。

## 尺寸以外的实测数字

- 包：`dist-plugin/minergirl.plugin.mjs` **1125 KB**（gzip 0.29 MB），pixi + sound 都内联
- 样式：`styles.css` 49 KB **内联进包**（`src/styles-inline.js` 是生成物，gitignore）
- 皮肤：14 套，门槛 $1K → $3T（`src/data/skins.js` 的 `need`，只改这张表）
- 画布：`#stage` 里 1 个 WebGL，另有 2 个 2D 画布（`.g-face` 引导头像、`.c-icon` 面板图标）
  ⇒ **断言不能写「容器里只有 1 个 canvas」**，要指到 `#stage canvas`

## 这次踩到并修掉的

1. **升级按钮的价格没带 `$`**（`src/ui.js` 两处：建按钮 + 每 0.2 秒覆盖的那次）。
   截图里是「持有 $1.00M」旁边挂一个「7.86」。两处都要改 —— 只改建按钮那次，
   0.2 秒后就被覆盖回去了（第一次改完重拍，图上还是 7.86）。
2. **语言混排**：`mountDom()` 里先填了一遍文案（模块默认日语），`setLang()` 在之后才跑
   ⇒ 静态标签是日文、动态是中文。`start()` 里 `setLang` 之后**再填一次**。
3. **`onLang` 没有退订**：每次挂载都留一个闭包，持有上一次（已置空）的 `game`
   ⇒ 第二次挂载报 `Cannot read properties of null (reading 'ui')`。改成返回 unsubscribe。
4. **`document.body` 提示是误报**：`check-plugin` 报「包里引用了 document.body」，
   实际来自内联的 **pixi**（`_hookDiv` 的移动端触摸钩子），不是我们的代码。
5. **`check-plugin` 的「样式必须收进根选择器」原来只能靠人工**。这次把它做成了**打包期审计**
   （`build-plugin.mjs` 第 ② 步）：`buildCss()` 的输出逐条扫，每条选择器都必须以
   `#mng-root` 开头。判据 406 条规则 / 0 漏网 / 21 个 keyframes 都带 `mng-` /
   0 处 `url(assets/…)` 没换绝对地址。**反向验证**：同一段扫描跑未作用域化的原样式表
   ⇒ 415 条漏网，所以它不是恒真。

## 下次从这继续

步骤 9：宿主工作区现在有 11 项改动 —— 4 个已跟踪文件 + 4 个未跟踪目录 + 2 个新 e2e 脚本。
⚠️ 其中 **melonjar（爆汁瓜瓜罐）那次接入从来没提交过**（`HEAD` 里没有它），
所以一次提交会把两款游戏一起带上；要分开就先只 stage `melonjar` 相关路径。

## 环境坑

- **`mkplay.zone` 直连 000**，必须 `--proxy http://127.0.0.1:7897`；沙箱自带的 `HTTP_PROXY`（62xxx）对这个站 exit 56。
- Node 22 的 `fetch` 不读 `HTTPS_PROXY`；且 `fetch` 与 `ProxyAgent` **必须从同一个包取**
  （宿主 `node_modules/undici` v8 vs Node 内置 v6，混用报 `invalid onRequestStart method`，
  症状是 `fetch failed`，看着像站点挂了）。
- 常用端口 4180/4190/4391 常年被别的项目占着；起服务后先验「服务的到底是不是我的构建」。
- `node /tmp/x.mjs` 会被解析成 `E:\tmp\x.mjs`（MSYS 不转换）⇒ 临时脚本写在仓库里再删。
- `npx vite preview ... &` 在非交互 shell 里活不过那一次工具调用 ⇒ 要 `run_in_background`。
