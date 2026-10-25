"""记录 2026-10-25 第二轮：游戏市场列表摊到设置页。"""
import io, os

M = r'E:\plan\test25\.workbuddy-ai\memory'
LOG = os.path.join(M, '2026-10-25.md')
NOTE = os.path.join(M, 'notes', 'plugin-host.md')

io.open(LOG, 'a', encoding='utf-8', newline='\n').write(u"""

## 游戏市场列表摊到设置页 + 按玩法性质分类（`62807fc`）

用户：「为啥还要点进入游戏市场，直接在游戏页展示不行吗。装上就能在底部那个游戏
按钮里玩。每一款都写了它是让孩子练什么的。在这展示列表就行了吧。做下分类（主要
依据 有些是孩子知识智力（积分--游戏币--兑换卷），有些是偏游戏玩的（消耗积分））」

★ **我一开始理解错了**：以为要把「底部第 2 格」改成游戏列表，还问了两个结构问题。
用户回：「我说的是 设置里 游戏页 的游戏市场」。教训：**先确认「游戏页」指哪一屏**
（底部导航那一格 vs 设置里的 tab），别自己脑补成结构改动。

### 落地的

- 去掉「进入游戏市场」按钮 + Portal 全屏列表 ⇒ 列表直接摊在卡里，按分类分组
- 每款带「练什么」（`learn` 全文，不折叠）+ 适龄/时长/体积 + 看截图 + 安装
- 弹层只留详情（截图 + 关于）；详情页去掉「← 返回」（列表就在页面上）
- 分类按**玩法性质** `think` / `play`，不是按「有没有产出」—— 三款都会产出券，
  按产出分的话「纯玩」是空的。分类是判断，数字是真数字，两者不混
- 顺序跟 `storefront.ts` 的书写顺序走，不跟 `LOCAL_GAMES`（那是打包清单）

### 走查脚本踩的坑

设置页的「游戏」tab 有**家长密码闸门**，全新 profile 里要点 4 个 0 + 确定。
`capture.mjs` 不用点，是因为它的流程走到那里时闸门恰好是开的 ——
自己写临时脚本时会被这一下卡住（症状：body 里全是数字键盘，`[data-local-row]` 是 0）。

### 验证

`npm run lint` 干净 / `npm test` 769 passed (36 files) /
`e2e-plugin-local.mjs` 全过（装→玩→卸载→刷新仍在）/ `capture.mjs` 38 张 0 报错。
新增 `storefront.test.ts`：包↔介绍双向反查，防「新加一款包市场里静默少一款」。
""")

s = io.open(NOTE, encoding='utf-8').read()
assert '设置 → 游戏' in s, 'ABORT: 笔记结构变了，先看看再追加'
if '## 设置 → 游戏 那一页的结构' in s:
    print('note 已有该节，跳过')
else:
    s = s.rstrip('\n') + u"""

## 设置 → 游戏 那一页的结构（2026-10-25 起）

- 「游戏市场」卡里**直接摊着列表**（不再有「进入游戏市场」按钮 + 弹层）
- 按**玩法性质**分两组：`think`（动脑 · 有产出）/ `play`（纯玩 · 图个乐），
  数据在 `src/games/storefront.ts` 的 `kind`；**空分类不渲染**
- 每款：图标（点开详情）+ 名字/版本 + 一句话 + 适龄/时长/体积 +
  「练什么」（`learn` 全文）+ 看截图 + 安装
- 弹层只剩详情（截图可放大 + 关于）；锚点 `data-store-detail` / `data-store-close`
- 顺序跟 `storefront.ts` 的书写顺序，不跟 `LOCAL_GAMES`（后者是打包清单）
- `storefront.test.ts` 双向反查（包 ↔ 介绍）+ 分类合法 + 「练什么」非空

⚠️ **家长闸门**：设置页的「游戏」tab 要过 PIN（默认 0000）。
自己写走查/截图脚本时会被这一下卡住，症状是 `[data-local-row]` 数出 0、
body 里全是数字键盘。`capture.mjs` 不用点是因为它的流程里闸门恰好开着。
"""
    io.open(NOTE, 'w', encoding='utf-8', newline='\n').write(s)
    print('note OK', len(s.encode('utf-8')))
