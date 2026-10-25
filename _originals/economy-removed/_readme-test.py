"""README 补一节「自己手测一遍」。一次性脚本。"""
import io

P = 'README.md'
src = io.open(P, encoding='utf-8').read()
n0 = len(src)

ANCHOR = u"端口被占用时 `server.js` 会自动往后找空端口。\n"
assert src.count(ANCHOR) == 1, 'ABORT: 锚点 %d 次' % src.count(ANCHOR)

SEC = ANCHOR + u"""
## 自己手测一遍（5 分钟）

自动脚本验的是「断言过的那些点」，**观感只能人眼看**。完整的一条路：

| # | 做什么 | 应该看到 |
| --- | --- | --- |
| 1 | 打开首页 | 3D 街机厅，底部 5 个 Tab：首页 / 游玩 / 收藏 / 回收 / 排行 |
| 2 | 点「游玩」→ 选一台机器 | 进机台，左上角 🧸 0 / 🪙 30 |
| 3 | 点 PLAY（0 币时） | 按钮写的是「买娃娃机币 🧸 0」，**不是灰的**；点开买币面板 |
| 4 | 买 5 个 | 🧸 5 / 🪙 25 |
| 5 | 点 PLAY | 扣 1 币 → 决定横向位置 → 再点落下抓 |
| 6 | 抓没抓到都正常（概率） | 想直接看后面：F12 控制台敲 `__debug.forceGet(0)` |
| 7 | 切到「回收」 | 卡片写「每个回收 🧸 2」；点开有 取消 / 卖 1 个 / 全部卖掉 |
| 8 | 卖掉 | 币增加、卡片消失、出现空态文案 |
| 9 | F5 刷新 | 币和积分**都还在**（三本账：save / coin / points） |
| 10 | 回头确认 | 首页**没有**签到、**没有**跳蚤市场，也没有「金币+1000」的调试按钮 |

想在手机比例下看：F12 → `Ctrl+Shift+M` → 选 430×932。
`server.js` 只绑 `127.0.0.1`，**手机连不上**；要真机试就把 `server.js` 里
`server.listen(port, "127.0.0.1", …)` 的绑定地址改成 `0.0.0.0`。

### 控制台里能用的钩子

```js
__debug.coins               // 当前娃娃机币（钱包镜像，不是直接读存储）
__debug.points              // 当前积分
__debug.stock               // 手里能卖的：{ bear: 1 }
__debug.phase               // ready / idle_x / catchgo / ...
__debug.screen              // 当前在哪个屏：title / list / play / sell
__debug.enter('big-bear')   // 直接进机台（免点两下）
__debug.forceGet(0)         // 直接判 0 号奖品到手，跳过抓取动画
```

### 插件模式（在宿主的契约下再走一遍）

`_plugin-test.html` 是个**假宿主**：100 积分 / 0 币，币和积分记在它的账本里
（不是 localStorage），走的是 `host.buyGameCoin / spendGameCoin / mintGameCoin` 三个门。

```bash
# 另起一个静态服务（和独立运行互不影响）
node server.js            # 记下端口，假设 8080
# 打开 http://127.0.0.1:8080/_plugin-test.html
```

玩一遍之后在控制台敲 `__t.ledger()`，应该看到 `{ points: 95, coins: 6, rows: 3 }`
—— 3 笔 delta 加起来正好等于余额，这就是「余额是算出来的」的证据。
"""

src = src.replace(ANCHOR, SEC, 1)
io.open(P, 'w', encoding='utf-8', newline='\n').write(src)
print('OK %d -> %d bytes' % (n0, len(src)))
