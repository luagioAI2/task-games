#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
插件化改造（第二阶段）：资源路径、运行时重置、DOM 资源字面量。

三件事：

1. **`data.js` 的 `charArt()` 与元素图标过 `A()`**：插件在 `blob:` 模块里跑，
   相对路径以 `blob:` 为基准 ⇒ 全 404。`A()` 是幂等的（见 `src/assets.js`）。
2. **`core.js` 的贴图加载过 `A()`**，并加 `resetCore()` —— `core.root` /
   `core.backdrop` 是模块级的 PIXI 容器，第一次卸载时被 `app.destroy()` 一起销毁了，
   第二次挂载必须换新的，否则画不出来而且不报错。
3. **`ui.js` 里 `<img src="assets/…">` 过 `A()`**（DOM 的 src 相对的是**文档**，
   不是模块，所以插件里会请求宿主的 `/assets/…`）。

★ 幂等：`replace()` 不命中就跳过，可以重复跑。
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []


def read(name):
    with io.open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()


def write(name, text):
    with io.open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def sub(name, text, old, new, label, count=1):
    n = text.count(old)
    if n == count:
        print('  ok   %-46s %s（%d 处）' % (label, name, n))
        return text.replace(old, new)
    if n == 0 and new in text:
        print('  skip %-46s %s（已经改过）' % (label, name))
        return text
    fails.append('%s / %s：命中 %d 次（期望 %d）' % (name, label, n, count))
    print('  FAIL %-46s %s（命中 %d，期望 %d）' % (label, name, n, count))
    return text


# ============================================================ data.js
d = read('data.js')
d = sub('data.js', d,
        "export function charArt(id        , tier        )         { return `assets/chara/${id}_${tier > 0 ? 1 : 0}.webp`; }",
        "export function charArt(id        , tier        )         { return A(`assets/chara/${id}_${tier > 0 ? 1 : 0}.webp`); }",
        'charArt 过 A()')

# 在文件开头插 import（data.js 的第一行是注释）
if "from './src/assets.js'" not in d:
    head = "// Static game data: elements, characters, monsters, stages (100 stages, 20 areas, 10 heroines).\n"
    assert d.startswith(head), 'data.js 第一行不是预期的注释'
    d = head + "import { A } from './src/assets.js';\n" + d[len(head):]
    print('  ok   %-46s %s' % ('插 A import', 'data.js'))

# 元素图标也要过 A()：它们既被 loadMany 当贴图加载，又被塞进 <img src>
if 'export function localizeAssets' not in d:
    d = d.rstrip('\n') + """

/**
 * 把 `GEM_ICON` 里的路径换成宿主绝对路径。**挂载时调一次**，之后 DOM 里直接可用。
 * `A()` 幂等，所以重复挂载不会越拼越长。
 */
export function localizeAssets() {
  for (const k in GEM_ICON) GEM_ICON[k] = A(GEM_ICON[k]);
}
"""
    print('  ok   %-46s %s' % ('加 localizeAssets', 'data.js'))
write('data.js', d)

# ============================================================ core.js
c = read('core.js')
c = sub('core.js', c,
        "import * as PIXI from 'pixi.js';",
        "import * as PIXI from 'pixi.js';\nimport { A } from './src/assets.js';",
        '插 A import')

c = sub('core.js', c,
        """const texCache = new Map                               ();
export function loadTex(url        )                        {
  let p = texCache.get(url);
  if (!p) {
    p = PIXI.Assets.load              (url).catch(() => PIXI.Texture.WHITE);
    texCache.set(url, p);
  }
  return p;
}""",
        """const texCache = new Map                               ();
export function loadTex(url        )                        {
  // ★ 过 A()：插件里 `assets/…` 相对的是 `blob:`，不过就是全 404
  const key = A(url);
  let p = texCache.get(key);
  if (!p) {
    p = PIXI.Assets.load              (key).catch(() => PIXI.Texture.WHITE);
    texCache.set(key, p);
  }
  return p;
}""",
        'loadTex 过 A()')

c = sub('core.js', c,
        """export function texNow(url        )               {
  const t = PIXI.Assets.get              (url);
  return t || PIXI.Texture.WHITE;
}""",
        """export function texNow(url        )               {
  const t = PIXI.Assets.get              (A(url));
  return t || PIXI.Texture.WHITE;
}""",
        'texNow 过 A()')

c = c.rstrip('\n') + """

/**
 * 每次挂载前重置运行时状态。
 *
 * ★ `core.root` / `core.backdrop` 是**模块级**的 PIXI 容器。第一次卸载时
 *   `app.destroy()` 把它们一起销毁了（`destroy({children:true})`），
 *   第二次挂载如果继续用同一对对象，画面**什么都画不出来，而且一个错都不报**。
 */
export function resetCore() {
  core.app = null;
  core.root = new PIXI.Container();
  core.backdrop = new PIXI.Container();
  core.H = 960;
  core.scale = 1;
  core.offX = 0;
  core.offY = 0;
  core.sound = null;
  core.unlocked = false;
  core.music = 'home';
  core.relayoutHooks = [];
}
"""
print('  ok   %-46s %s' % ('加 resetCore', 'core.js'))
write('core.js', c)

# ============================================================ ui.js
u = read('ui.js')
u = sub('ui.js', u,
        "import { scopeCss } from './scope-css.js';",
        "import { scopeCss } from './scope-css.js';\nimport { A } from './src/assets.js';",
        '插 A import')

# DOM 的 <img src> 相对的是**文档**，插件里必须换成宿主绝对路径
u = sub('ui.js', u,
        '<img src="assets/ui-gem/prism.png">',
        '<img src="${A(\'assets/ui-gem/prism.png\')}">',
        'prism 图标过 A()',
        count=u.count('<img src="assets/ui-gem/prism.png">'))
write('ui.js', u)

print()
if fails:
    print('✗ %d 处没改成功：' % len(fails))
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('✓ 全部改完')
