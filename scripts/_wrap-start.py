#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 game.js 的模块体整个包进 `export async function start(opts)`。

一次性脚本（`scripts/_*` 不进 git）。跑完用 `node --check` + 冒烟截图验收。

为什么不是手改：文件 1900 行、全部是模块顶层语句（`const app = new PIXI.Application()`
和两处 `await` 都在顶层）。逐行手改必错，机械包裹 + 断言更可靠。
"""
import io
import re
import sys

PATH = 'game.js'

DOC = '''
/**
 * 尖叫鸡 · 游戏本体
 *
 * ## 为什么整个文件是一个函数
 *
 * 原版是「一个网页」：模块顶层直接 `new PIXI.Application()`、`await` 贴图、挂监听、
 * 建标题页。插件形态下这套不成立 —— 宿主只 `import()` 一次这个模块，然后
 * **反复调用 `mount()`**（切 tab / StrictMode 双挂载）。模块顶层的状态会跨挂载泄漏：
 * 第二个 `new PIXI.Application()` 挂在已经 destroy 的 canvas 旁边、
 * 监听器翻倍（一次滑动走两步）、存档是上一次的内存快照。
 *
 * 所以：**一次挂载 = 一次 `start()` 调用**，所有状态都是这次调用的局部变量。
 * 返回值是卸载函数，宿主会 `await` 它。
 *
 * ## 两种形态的差别全部从 `opts` 注入
 *
 * | | `index.html` | `plugin.js` |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl()` |
 * | 音频 | 不传（默认 `./sound.manifest.json`） | `manifestUrl` + `baseUrl`（清单在**包根**） |
 * | 存档 | 不传（`localStorage`） | `host.storage` → `makeHostStore()` |
 * | 容器 | 不传（`#app`） | `mount(container)` 给的那个 |
 * | 进关收费 | 不传（不收费） | `chargePlay()` |
 * | 页面标题 | 改 `document.title` | **不改**（那是宿主的） |
 *
 * 于是这里没有任何 `if (isPlugin)` 分支 —— 那种分支会随版本漂移，
 * 而且两种形态的测试永远只有一种被跑到。
 */

'''

PROLOGUE = '''  // ---------- 形态注入 ----------
  const mountTo = opts.mountTo || document.getElementById('app') || document.body;
  const isPlugin = !!opts.mountTo;
  /** 包内相对路径 → 可加载的绝对地址（插件里是 `<包根>/assets/…`） */
  const asset = typeof opts.asset === 'function' ? opts.asset : (p) => p;
  /** 包根（带尾斜杠），`sound-1.js` 的 `baseUrl` 用 */
  const assetBase = typeof opts.assetBase === 'string' ? opts.assetBase : '';
  const store = opts.store || makeLocalStore();
  const chargePlay = typeof opts.chargePlay === 'function' ? opts.chargePlay : async () => true;

  // 插件形态下不许动宿主的 <html lang> / <title>
  setDocumentSideEffects(!isPlugin);

  // ---------- 卸载守卫 ----------
  // 所有异步回调（ticker / setTimeout / 字体 / 音频 / 贴图）都先看 `alive`。
  let alive = true;
  /** 进关扣款进行中（防连点扣两次） */
  let charging = false;
  /** 本次挂载挂上的全局监听，卸载时逐个摘 */
  const listeners = [];
  const on = (t, f, o) => { t.addEventListener(f, o); listeners.push([t, f, o]); };
  /** 本次挂载起的定时器，卸载时清掉（`win()` 里那串 1.1 秒的庆祝动画） */
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };

  // 宿主的页面标题 / 语言标记：只有插件形态才需要还原
  const prevLang = document.documentElement.lang;
  const prevTitle = document.title;
  if (!isPlugin) { try { document.title = displayTitle(); } catch (e) { /* ignore */ } }
'''


def main():
    src = io.open(PATH, encoding='utf-8', newline='').read()
    assert 'export async function start' not in src, '已经包过了，别重复跑'

    lines = src.split('\n')
    # 头部 = 最后一条 import 所在行（含）之前
    last_import = max(i for i, l in enumerate(lines) if l.startswith('import '))
    head = lines[: last_import + 1]
    body = lines[last_import + 1:]
    # 去掉结尾的空行（文件以换行收尾 ⇒ split 会多出一个 ''）
    while body and body[-1] == '':
        body.pop()

    # 断言：头部之后不能再有 import / export
    for l in body:
        assert not l.startswith('import '), 'body 里还有 import：' + l
        assert not re.match(r'^export\s', l), 'body 里还有 export：' + l

    # 缩进：非空行 +2 空格（文件里没有跨行模板字符串，已断言过）
    ind = []
    for l in body:
        ind.append(('  ' + l) if l.strip() else l)

    out = '\n'.join(head) + '\n' + DOC + 'export async function start(opts = {}) {\n' + PROLOGUE + '\n'.join(ind) + '\n}\n'

    # 结尾要恰好两个 }：unmount 的收尾 + start 的收尾
    tail = out.rstrip('\n').split('\n')[-2:]
    assert tail[-1].strip() == '}' and tail[-2].strip() == '}', '文件末尾不是两个收尾：%r' % (tail,)

    io.open(PATH, 'w', encoding='utf-8', newline='').write(out)
    print('包裹完成：%d 行 → %d 行' % (len(lines), out.count('\n') + 1))


main()
