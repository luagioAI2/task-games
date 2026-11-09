#!/usr/bin/env python3
"""ui.js / tutorial.js 的改造：去掉商店与排行榜入口，样式收进根选择器。

判据（跑完自己 grep）：
  · `hooks.openRanking` / `hooks.openShop` 0 次
  · `document.documentElement` 0 次
  · `scopeCss(` 各 1 次
"""
import re
import sys

U = 'game/ui.js'
T = 'game/tutorial.js'
S = re.DOTALL


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def sub1(s, pat, rep, name, flags=0):
    new, n = re.subn(pat, rep, s, flags=flags)
    if n != 1:
        sys.exit(f'✗ {name}: 命中 {n} 次（期望 1）')
    print(f'  ✓ {name}')
    return new


# ============================================================ ui.js
s = read(U)

# ---- 1) 导入 scopeCss
s = sub1(s, r'^import \{ [^\n]*\} from "\.\./i18n\.js";$',
         lambda m: m.group(0) + '\nimport { scopeCss } from "../scope-css.js";',
         'import scopeCss', re.M)

# ---- 2) 底栏：只留「盖楼」
s = sub1(s, r'    const rank = el\("button", "btn wide"\).*?\n    this\.rankBtn = rank;\n    this\.shopBtn = shop;\n',
         '    this.buildBtn = build;\n', 'rail', re.S)

# ---- 3) applyText 里那两行按钮文案
s = sub1(s, r'    this\.rankBtn\.querySelector\("\.lbl"\) \.textContent = t\("hud\.rank"\);\n'
            r'    this\.shopBtn\.querySelector\("\.lbl"\) \.textContent = t\("hud\.shop"\);\n'
            r'    this\.shopBtn\.setAttribute\("aria-label", t\("hud\.shop"\)\);\n', '', 'applyText buttons')

# ---- 4) 字体不再写到 documentElement（会改宿主的整页字体）
s = sub1(s, r'    document\.documentElement\.style\.fontFamily = f;',
         '    this.host.style.fontFamily = f;', 'font scope')

# ---- 5) 菜单里的商店入口
s = sub1(s, r'  openMenu\(s           , vols                              , muted         , shopAvailable         , delegateCost        \) \{',
         '  openMenu(s           , vols                              , muted         , delegateCost        ) {', 'openMenu 签名')
s = sub1(s, r'\n    if \(shopAvailable\) \{\n      const sh = el\("button", "btn wide"\).*?\n      b\.appendChild\(sh\);\n    \}\n', '', 'openMenu shop 行', re.S)

# ---- 6) 样式收进 `.mp-root`
s = sub1(s, r'function installCss\(\) \{\n  if \(CSS_DONE\) return;\n  CSS_DONE = true;\n  const f = document\.createElement\("style"\);\n  f\.id = "mp-ui";\n  f\.textContent = `',
         'function installCss(root = ".mp-root") {\n'
         '  if (CSS_DONE) return;\n'
         '  CSS_DONE = true;\n'
         '  const f = document.createElement("style");\n'
         '  f.id = "mp-ui";\n'
         '  f.textContent = scopeCss(`',
         'installCss 头')
s = sub1(s, r'`;\n  document\.head\.appendChild\(f\);\n\}',
         '`, root);\n  document.head.appendChild(f);\n}', 'installCss 尾')

write(U, s)
print('  ui.js 改完')

# ============================================================ tutorial.js
t = read(T)
t = sub1(t, r'^import \{ [^\n]*\} from "\.\./i18n\.js";$',
         lambda m: m.group(0) + '\nimport { scopeCss } from "../scope-css.js";',
         'tutorial import', re.M)
t = sub1(t, r'function installCss\(\) \{\n  if \(CSS_DONE\) return;\n  CSS_DONE = true;\n  const st = document\.createElement\("style"\);\n  st\.textContent = `',
         'function installCss(root = ".mp-root") {\n'
         '  if (CSS_DONE) return;\n'
         '  CSS_DONE = true;\n'
         '  const st = document.createElement("style");\n'
         '  st.textContent = scopeCss(`',
         'tutorial installCss 头')
t = sub1(t, r'`;\n  document\.head\.appendChild\(st\);\n\}',
         '`, root);\n  document.head.appendChild(st);\n}', 'tutorial installCss 尾')
write(T, t)
print('  tutorial.js 改完')
