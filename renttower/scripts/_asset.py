#!/usr/bin/env python3
"""资源根前缀 + 文档副作用 + 入口。插件在 `blob:` 模块里跑，相对路径的基准是那个 blob。"""
import re
import sys

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


# ============================================================ i18n.js
s = read('i18n.js')
s = sub1(s, r'export function setLang\(k      \)       \{\n  current = k;\n  T = LANGS\[k\];\n  document\.documentElement\.lang = k;\n\}',
         'let documentSideEffects = true;\n'
         '/** 独立网页要写 `<html lang>`；插件里**绝不能**动宿主页面的属性。 */\n'
         'export function setDocumentSideEffects(on        ) {\n'
         '  documentSideEffects = !!on;\n'
         '}\n'
         'export function setLang(k      )       {\n'
         '  current = k;\n'
         '  T = LANGS[k];\n'
         '  if (documentSideEffects) document.documentElement.lang = k;\n'
         '}',
         'setLang 副作用开关')
write('i18n.js', s)

# ============================================================ art.js
s = read('game/art.js')
s = sub1(s, r'^import \{ TENANT_TYPES \} from "\./data\.js";$',
         'import { TENANT_TYPES } from "./data.js";\nimport { assetUrl } from "../src/asset.js";',
         'art import', re.M)
s = sub1(s, r'await PIXI\.Assets\.load\(TEX_PATHS\.map\(\(p\) => \(\{ src: p,',
         'await PIXI.Assets.load(TEX_PATHS.map((p) => ({ src: assetUrl(p),',
         'art load')
write('game/art.js', s)

# ============================================================ walks.js
s = read('game/walks.js')
s = sub1(s, r'^import \{ TENANT_TYPES \} from "\./data\.js";$',
         'import { TENANT_TYPES } from "./data.js";\nimport { assetUrl } from "../src/asset.js";',
         'walks import', re.M)
s = sub1(s, r'      const base = `assets/\$\{d\}`;',
         '      const base = assetUrl(`assets/${d}`);', 'walks base')
write('game/walks.js', s)

# ============================================================ lounge.js
s = read('game/lounge.js')
s = sub1(s, r'^import \* as PIXI from "pixi\.js";$',
         'import * as PIXI from "pixi.js";\nimport { assetUrl } from "../src/asset.js";',
         'lounge import', re.M)
s = sub1(s, r'  const base = `assets/lounge-\$\{dir\}/`;',
         '  const base = assetUrl(`assets/lounge-${dir}/`);', 'lounge base')
write('game/lounge.js', s)

# ============================================================ ui.js
s = read('game/ui.js')
s = sub1(s, r'^import \{ scopeCss \} from "\.\./scope-css\.js";$',
         'import { scopeCss } from "../scope-css.js";\nimport { assetUrl } from "../src/asset.js";',
         'ui import', re.M)
s = sub1(s, r"  coin: '<img class=\"mp-coin\" src=\"assets/coin\.webp\" alt=\"\">',\n"
            r"  /\*\* official platform coin — every platform-coin price \*/\n"
            r"  pcoin: '<img class=\"mp-pcoin\" src=\"assets/ui/icon_coin_selected\.svg\" alt=\"\">',",
         '  // 函数而不是常量：模块求值那一刻 `assetUrl()` 还没有根（插件在 start() 里才设）\n'
         '  coin: () => `<img class="mp-coin" src="${assetUrl("assets/coin.webp")}" alt="">`,',
         'ui coin')
s = re.subn(r'\$\{SVG\.coin\}', '${SVG.coin()}', s)
if s[1] != 3:
    sys.exit(f'✗ SVG.coin 调用点：{s[1]} 次')
print('  ✓ SVG.coin() ×2')
s = s[0]
s = sub1(s, r'const TENANT_IMG                         = Object\.fromEntries\(TENANT_TYPES\.map\(\(t\) => \[t\.kind, `assets/tenant_\$\{t\.kind\}\.webp`\]\)\);',
         'const TENANT_IMG                         = Object.fromEntries(TENANT_TYPES.map((t) => [t.kind, `assets/tenant_${t.kind}.webp`]));\n'
         '/** 运行时才拼前缀（见 src/asset.js） */\n'
         'const tenantImg = (k        ) => assetUrl(TENANT_IMG[k]);',
         'ui tenantImg')
s = sub1(s, r'const FIX_IMG                         = \{', 'const FIX_IMG                         = {', 'ui FIX_IMG 占位')
s = re.subn(r'src="\$\{TENANT_IMG\[([^\]]+)\]\}"', r'src="${tenantImg(\1)}"', s)
s = s[0]
s = sub1(s, r'<img src="\$\{FIX_IMG\[next\]\}"', '<img src="${assetUrl(FIX_IMG[next])}"', 'ui FIX_IMG 使用点')
write('game/ui.js', s)

# ============================================================ main.js
s = read('game/main.js')
s = sub1(s, r'import \{ fontStack, getLang, pickLang, setLang, t, *\} from "\.\./i18n\.js";',
         'import { fontStack, getLang, pickLang, setDocumentSideEffects, setLang, t } from "../i18n.js";',
         'main i18n import')
s = sub1(s, r'import \{ makeLocalStore, makeSaveApi \} from "\.\./src/host\.js";',
         'import { makeLocalStore, makeSaveApi } from "../src/host.js";\n'
         'import { assetRoot, assetUrl, setAssetRoot } from "../src/asset.js";',
         'main asset import')
s = sub1(s, r'  appEl = opts\.mountTo \|\| document\.getElementById\("app"\) \|\| document\.body;\n  let alive = true;',
         '  appEl = opts.mountTo || document.getElementById("app") || document.body;\n'
         '  let alive = true;\n'
         '  // 资源前缀：独立网页是空串，插件是 `<包根>/`（见 src/asset.js）\n'
         '  setAssetRoot(opts.assetBase || "");\n'
         '  // 插件里不要改宿主的 `<html lang>` / 页面标题\n'
         '  setDocumentSideEffects(!opts.mountTo);\n'
         '  appEl.classList.add("mp-root");',
         'main asset root')
s = sub1(s, r'  try \{ sound = \(await loadSoundSystem\(\{ manifestUrl: "\./sound\.manifest\.json" \}\)\)',
         '  try { sound = (await loadSoundSystem(assetRoot() ? { manifestUrl: assetUrl("sound.manifest.json"), baseUrl: assetRoot() } : { manifestUrl: "./sound.manifest.json" }))',
         'sound manifest')
s = sub1(s, r'    if \(window\.__debug === api\) delete window\.__debug;',
         '    try { appEl.classList.remove("mp-root"); } catch { /* ignore */ }\n'
         '    if (window.__debug === api) delete window.__debug;',
         'destroy 摘 mp-root')
write('game/main.js', s)
print('  全部改完')
