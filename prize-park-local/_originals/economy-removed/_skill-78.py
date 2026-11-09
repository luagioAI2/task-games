"""给 frontend-verify-layers 补 §78（点了没反应、零报错）+ triggers 三行。一次性脚本。"""
import io

SEC = u"""
## §78 ★★ 处理器根本没跑：三种「点了没反应、控制台零报错」

### 症状

E2E 里点 `#btnPlay`：页面不跳、不弹、不报错，`screen` 还是原来的值。
控制台干净得让人怀疑测试没连上。看起来像「新写的点击逻辑没接上」，
实际上**监听器压根没被调用**。

### 第一步：先点一个**跟本次改动无关**的按钮当对照组

这是「对照组分开『真的不在』和『判据匹配不上』」在**交互**上的版本：

```js
await click('#btnPlay')          // 本次改的
const a = await screenOf()
await click('#colBtn')           // 早就存在、本次没碰的
const b = await screenOf()
// a、b 都没变 → 问题在公共路径（外壳 / 导航 / 音频预热），不在你的改动里
```

实测就是靠这一步救的场：`#btnPlay` 死，`#colBtn` 也死 ⇒ 不是经济逻辑写错了，
而是**所有磁贴的点击都跑不到 `show(el)`**。没有对照组会去改一个本来没问题的函数。

### 形态 1：`disabled` 的按钮**连 `click` 事件都不发**

```js
btn.disabled = !canPay            // ✗ 没钱时按钮是死的
```

而「没钱 → 引导去买币」恰恰是唯一出路 ⇒ **新玩家第一次点就死路**，零报错。
更阴的是：老玩家（有钱）测不出这个问题。

改法：**始终 `enabled`，文案换成引导语**（「买娃娃机币 🧸 0」）。
要表达语义用 `aria-disabled="true"` —— 它**不吞事件**，只是给读屏器的。

> 判据：**凡是「条件不满足时，点击本应引导用户去满足条件」的按钮，一律不许 `disabled`。**
> 只有「点了也没有任何合理后果」的按钮才配 disabled（例如提交中的防重）。

### 形态 2：`await` 一个**永不 resolve** 的 Promise，后面整段不执行

```js
tile.onclick = async () => {
  await sound.unlock()      // ✗ 无声卡的 headless / 部分真机首启：永不 resolve
  show(el)                  //    永远到不了
}
```

症状与形态 1 完全一样（点了没反应、零报错），但**所有按钮都中招**，
所以对照组一定是「全死」。真机上表现为「第一次点没反应，再点一次就好了」
（第一次的 unlock 已经把音频上下文唤醒了）。

改法：**解锁 / 预热 / 请求权限这类操作一律 fire-and-forget**，不许挡在导航前面：

```js
function audioWarmup(preload) {
  if (!sound) return
  try {
    if (preload) void Promise.resolve(sound.preload(preload)).catch(() => {})
    void Promise.resolve(sound.unlock()).catch(() => {})
  } catch { /* 没有音频设备就静默 */ }
}
```

> 判据：**`await` 只用在「结果决定下一步走哪条路」的地方。**
> 「让它开始跑」类调用用 `void`，否则等于把功能挂在一个可能永远不来的事件上。

### 形态 3：`.click()` 绕过命中测试

被全屏遮罩盖住的按钮，脚本里照样点得到 ⇒ 全绿但用户点不动。见**形态 H**。

### 顺带：`async` 处理器 + `await` 会撑开一个「守卫窗口」

同一个 `startPlay` 因为要扣钱从同步变 `async`，`phase` 会在 `ready` 上多停一两帧，
**双击就扣两次钱**。要两把锁：

```js
if (paying) return                 // 调用处的标志
paying = true
try { paid = await wallet.pay(...) } finally { paying = false }
```

```js
async function serial(fn) {        // 钱包内部：同时只允许一笔变更在飞
  if (busy) return false
  busy = true
  try { return await fn() } finally { busy = false }
}
```

### 交付前自检

- [ ] 每个「点了没反应」的现场，都点过一个**无关按钮**做对照了吗？
- [ ] 所有「条件不满足 → 引导用户去满足」的按钮，都**没有** disabled 吗？
- [ ] 所有 `await` 后面都跟着「用它返回值决定分支」的代码吗？（否则改 `void`）
- [ ] 改成 `async` 的处理器，都有防重入标志吗？

---
"""

P = 'references/silent-failures.md'
src = io.open(P, encoding='utf-8').read()
assert src.count('## §78') == 0, 'ABORT: §78 已存在'
src = src.rstrip('\n') + '\n' + SEC
io.open(P, 'w', encoding='utf-8', newline='\n').write(src)
print('silent-failures OK')

ROWS = u"""| 点了没反应、控制台零报错、页面原地不动 | §78 | `silent-failures.md` |
| 新玩家第一次点就被卡死（按钮是灰的，走不下去） | §78 | `silent-failures.md` |
| 音频解锁 / 权限请求 / 预热 `await` 挡在导航前面 → 所有点击变空操作 | §78 | `silent-failures.md` |
"""
P2 = 'references/triggers.md'
t = io.open(P2, encoding='utf-8').read()
anchor = u"| 要证明新加的 `absolute` 装饰没影响布局 → **摘掉再量一次比差** | §77 | `silent-failures.md` |\n"
assert t.count(anchor) == 1, 'ABORT: triggers 锚点 %d 次' % t.count(anchor)
t = t.replace(anchor, anchor + ROWS, 1)
io.open(P2, 'w', encoding='utf-8', newline='\n').write(t)
print('triggers OK')
