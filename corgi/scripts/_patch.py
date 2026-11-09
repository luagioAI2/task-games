#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性改造脚本：把 corgi 的整页脚本改成可挂载/卸载的插件入口。

为什么用脚本而不是编辑器里点几下：同一个文件要改 13 处，
手动 Edit 容易互相覆盖（而且工具会报成功）。这里每一条替换都带**命中次数断言**，
锚点找不到就整体退出、不写文件 —— 免得改到一半留下半成品。

    python scripts/_patch.py            # 真改（先备份到 _src-backup/）
    python scripts/_patch.py --check    # 只报告每条锚点命中几次，不写
"""
import io
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game.js'
BAK = ROOT / '_src-backup'

CHECK = '--check' in sys.argv


def patch(text, pairs):
    for i, (old, new, cnt) in enumerate(pairs):
        n = text.count(old)
        if n != cnt:
            print(f'✗ 第 {i + 1} 条锚点命中 {n} 次（期望 {cnt}）')
            print(f'   {old[:100]!r}')
            sys.exit(2)
        text = text.replace(old, new)
        print(f'  ✓ {i + 1:2d}. 命中 {cnt} 次：{old.splitlines()[0][:64]}')
    return text


src = GAME.read_text(encoding='utf-8')
orig_len = len(src)

# ★ 行尾必须原样保留。`read_text` 会把 CRLF 统一成 LF，写回就变成**整文件重写**
#   （`git diff --stat` 显示每一行都改了，review 时什么也看不出来）。
#   抓下来的原文件是 CRLF，所以这里记住它，写回时用同样的。
_RAW = GAME.read_bytes()
EOL = '\r\n' if _RAW.count(b'\r\n') else '\n'
print(f'原文件行尾：{"CRLF" if EOL == chr(13) + chr(10) else "LF"}（{len(_RAW)} 字节）')

# ============ 1) 顶部：注入项 + 导入 ============
src = patch(src, [
    (
        "import { I18N, LANGS } from './i18n.js';\n",
        "import { I18N, LANGS } from './i18n.js';\n"
        "import { setAssetRoot, assetUrl, assetRoot } from './src/asset.js';\n"
        "import { installGp, makeLocalStore } from './src/host.js';\n"
        "\n"
        "/* ============ 插件注入项（独立网页全是默认值） ============ */\n"
        "// 容器尺寸。null = 用 window（网页形态）。插件里按 `mount(container)` 那个盒子量，\n"
        "// 否则 canvas 会按整屏算比例、再被 FIT 缩进容器 ⇒ 平板下上下各留一大条黑边。\n"
        "let VIEW = null;\n"
        "// 插件里不碰宿主的 `document.title` / `<html lang>`。\n"
        "let IS_PLUGIN = false;\n"
        "// `loadSoundSystem()` 的参数。null = 用默认的 `./sound.manifest.json`（网页形态）。\n"
        "let SOUND_OPTS = null;\n"
        "// 背景模糊层（原版在 index.html 里；插件里由 start() 现建）。\n"
        "let BGFILL = null;\n"
        "// 挂到 window/document 上的监听。原版全是匿名函数 ⇒ 卸载摘不掉 ⇒ 二次挂载会叠加。\n"
        "let UNBINDS = [];\n"
        "function on(target, type, fn, opts) {\n"
        "  target.addEventListener(type, fn, opts);\n"
        "  UNBINDS.push(() => { try { target.removeEventListener(type, fn, opts); } catch (e) { /* */ } });\n"
        "}\n",
        1,
    ),
    # 尺寸：按容器量
    (
        "function calcSize() {\n"
        "  const asp = window.innerWidth / Math.max(1, window.innerHeight);\n",
        "function calcSize() {\n"
        "  const vw = VIEW ? VIEW.w : window.innerWidth, vh = VIEW ? VIEW.h : window.innerHeight;\n"
        "  const asp = vw / Math.max(1, vh);\n",
        1,
    ),
    # 音频：清单在包根，必须显式给 manifestUrl + baseUrl
    (
        "function startSound() { if (!soundP) soundP = loadSoundSystem().then(",
        "function startSound() { if (!soundP) soundP = loadSoundSystem(SOUND_OPTS || undefined).then(",
        1,
    ),
    # 资源路径 ×2
    (
        "    const L = this.load; L.setPath('assets/');",
        "    const L = this.load; L.setPath(assetUrl('assets/'));",
        1,
    ),
    (
        "      L.setPath('assets/');",
        "      L.setPath(assetUrl('assets/'));",
        1,
    ),
    # 标题：插件里别改宿主的标签页标题
    (
        "    document.title = tr('title');",
        "    if (!IS_PLUGIN) document.title = tr('title');",
        2,
    ),
    (
        "    document.documentElement.lang = LANGS.find((x) => x.id === l).htmlLang;",
        "    if (!IS_PLUGIN) document.documentElement.lang = LANGS.find((x) => x.id === l).htmlLang;",
        1,
    ),
    # 背景模糊层：改用可注入的引用
    (
        "    const f = document.getElementById('bgfill'); if (f) f.style.backgroundImage = "
        "`url(assets/${SCENE_BG[this.sceneIdx()]}.jpg)`;",
        "    const f = BGFILL || document.getElementById('bgfill');\n"
        "    if (f) f.style.backgroundImage = `url(${assetUrl(`assets/${SCENE_BG[this.sceneIdx()]}.jpg`)})`;",
        1,
    ),
    # 监听改成可摘的
    (
        "    window.addEventListener('keydown', () => unlockAudio());\n"
        "    window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });\n"
        "    document.addEventListener('visibilitychange', () => this.onVis());\n"
        "    window.addEventListener('pagehide', () => this.saveNow());\n",
        "    on(window, 'keydown', () => unlockAudio());\n"
        "    on(window, 'pointerdown', () => unlockAudio(), { capture: true });\n"
        "    on(document, 'visibilitychange', () => this.onVis());\n"
        "    on(window, 'pagehide', () => this.saveNow());\n",
        1,
    ),
    (
        "    window.addEventListener('resize', () => { clearTimeout(this.rt); "
        "this.rt = setTimeout(() => this.onResize(), 200); });",
        "    on(window, 'resize', () => { clearTimeout(this.rt); "
        "this.rt = setTimeout(() => this.onResize(), 200); });",
        1,
    ),
])

# ============ 2) 尾部：启动块 → start(opts) ============
BOOT_OLD = """/* ============ 启动 ============ */
const [W0, H0] = calcSize(); W = W0;
const q = new URLSearchParams(location.search);
document.documentElement.lang = LANGS.find((x) => x.id === lang).htmlLang;
new Phaser.Game({
  type: q.get('playtest') && q.get('canvas') === '1' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game', width: W0, height: H0, transparent: false,
  backgroundColor: '#cdbcf0',
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 3 },
  scene: [Main],
});
"""

BOOT_NEW = """/* ============ 启动 ============ */
/**
 * 游戏入口。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，
 * 差别全部通过 `opts` 注入 —— 所以玩法代码里没有 `if (isPlugin)` 分支
 * （那种分支会随版本漂移，而且两种形态永远只有一种被跑到）。
 *
 * | | `index.html` | `plugin.js` |
 * | --- | --- | --- |
 * | 资源 | 不传（相对文档） | `ctx.assetUrl('')` |
 * | 音频 | 不传（默认 `./sound.manifest.json`） | `manifestUrl` + `baseUrl`（清单在**包根**） |
 * | 存档 | 不传（localStorage） | `host.storage` → `makeHostStore()` |
 * | 容器 | 不传（`#game`） | `mount(container)` 给的那个 |
 * | 开局收费 | 不传（不收费） | `chargePlay()` |
 *
 * 返回值是**卸载函数**。宿主会 `await` 它，而且它必须能在「刚建好就被调用」时安全执行
 * （孩子秒切 tab）。
 */
export async function start(opts = {}) {
  const container = opts.container || null;
  const store = opts.store || null;
  IS_PLUGIN = !!container;

  // ---- 资源根 ----
  // 插件里是 `<包根>/`；网页里空串 = 相对文档，和原版一模一样。
  // ★ 漏了这一句的症状：205 张图全 404，报一堆 `Texture key not found`，
  //   看着像打包坏了。
  setAssetRoot(typeof opts.assetBase === 'string' ? opts.assetBase : '');

  // ---- 音频 ----
  // 清单在**包根**（`sound.manifest.json`），不在 `assets/` 里；
  // 清单里的 `assets/audio/bgm.m4a` 与 `sound.pack` 都相对它解析。
  // `loadSoundSystem()` 的默认值是 `./sound.manifest.json` —— 相对**文档**，
  // 在 blob 模块里必然拿不到（症状：整局没音乐，且 0 个 404）。
  SOUND_OPTS = assetRoot() ? { manifestUrl: assetUrl('sound.manifest.json'), baseUrl: assetRoot() } : null;

  // ---- 存档 ----
  let st = store;
  if (!st) {
    st = makeLocalStore();
    try { await st.preload(); } catch (e) { console.warn('[corgi] 读本地存档失败', e); }
  }
  installGp(st, { locale: opts.locale });

  // ---- 语言 ----
  // 宿主只有中文。`lang` 在模块导入时已按 navigator 猜过一次（Android WebView
  // 会跟着系统走，孩子可能看到日文/英文），这里按宿主给的 locale 覆盖。
  if (opts.locale && !settings.lang) {
    const p = String(opts.locale).toLowerCase();
    lang = p.startsWith('ja') ? 'ja' : p.startsWith('en') ? 'en' : 'zh';
  }

  // ---- 开局收费（只有插件形态会传）----
  const paid = opts.chargePlay ? await opts.chargePlay() : true;
  if (!paid) {
    const gate = document.createElement('div');
    gate.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;'
      + 'gap:10px;padding:24px;text-align:center;background:#f6e9f7;color:#4a3550;'
      + "font:900 16px/1.5 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    gate.innerHTML = '<div style="font-size:20px">积分不够啦</div>'
      + '<div style="font-weight:800;color:#7a6070">去做个任务攒点积分，再回来撸柯基</div>';
    (container || document.body).appendChild(gate);
    return function unmountGate() { try { gate.remove(); } catch (e) { /* */ } };
  }

  // ---- 尺寸 ----
  const measure = () => {
    if (!container) { VIEW = null; return; }
    const r = container.getBoundingClientRect();
    VIEW = {
      w: Math.max(1, Math.round(r.width || container.clientWidth || 1)),
      h: Math.max(1, Math.round(r.height || container.clientHeight || 1)),
    };
  };
  measure();

  // ---- 挂载点 ----
  // Phaser 的 `parent` 要一个占满容器的元素。**自己建一个**，卸载时只删自己这个
  // （绝不 `container.innerHTML = ''` —— 那是宿主的 DOM）。
  let parentEl = 'game';
  let own = null;
  if (container) {
    own = document.createElement('div');
    own.style.cssText = 'position:absolute;inset:0;overflow:hidden';
    container.appendChild(own);
    parentEl = own;

    // 背景模糊层：原版写在 index.html 的 CSS 里，插件里没有这段 CSS。
    // 不建的话 FIT 留下的黑边是纯色，观感差一截。
    if (!document.getElementById('bgfill')) {
      const f = document.createElement('div');
      f.id = 'bgfill';
      f.style.cssText =
        'position:absolute;inset:-30px;pointer-events:none;'
        + `background:url(${assetUrl('assets/bg-garden.jpg')}) center/cover;`
        + 'filter:blur(7px) saturate(1.05);transform:scale(1.05)';
      own.appendChild(f);
    }
  }
  BGFILL = document.getElementById('bgfill');

  const [W0, H0] = calcSize(); W = W0;
  const q = new URLSearchParams(location.search);
  const prevLangAttr = document.documentElement.lang;
  if (!IS_PLUGIN) document.documentElement.lang = LANGS.find((x) => x.id === lang).htmlLang;

  // ★ 上一次挂载留下的调试钩子必须清掉：留着 `__gpReady` 会让下面的等待条件
  //   立刻为真 ⇒ 宿主以为「已就绪」，其实 canvas 还没建。
  try { window.__gpReady = false; } catch (e) { /* */ }

  const game = new Phaser.Game({
    type: q.get('playtest') && q.get('canvas') === '1' ? Phaser.CANVAS : Phaser.AUTO,
    parent: parentEl, width: W0, height: H0, transparent: false,
    backgroundColor: '#cdbcf0',
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    scene: [Main],
  });

  // 容器尺寸变化（转屏 / 平板分栏 / 宿主改布局）
  let ro = null;
  if (container && typeof ResizeObserver !== 'undefined') {
    let rt = 0;
    ro = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        measure();
        const sc = game.scene.getScene('Main');
        if (sc && sc.onResize) sc.onResize();
      }, 200);
    });
    ro.observe(container);
  }

  // 等场景真的建起来再返回：宿主可能立刻切走，`game.destroy()` 撞上半初始化的
  // 渲染器会抛在宿主那边（看着像「插件崩了」）。
  await new Promise((res) => {
    const t = setInterval(() => {
      if (window.__gpReady || game.isBooted === false) { clearInterval(t); res(); }
    }, 50);
    setTimeout(() => { clearInterval(t); res(); }, 15000);
  });

  return async function unmount() {
    try { if (ro) ro.disconnect(); } catch (e) { /* */ }
    try { game.destroy(true); } catch (e) { console.warn('[corgi] 销毁失败', e); }
    // 摘掉所有 window/document 监听（原版全是匿名函数，不摘就会在下次挂载时叠加）
    for (const fn of UNBINDS) { try { fn(); } catch (e) { /* */ } }
    UNBINDS = [];
    // 调试钩子一起摘
    try { delete window.__gpReady; } catch (e) { window.__gpReady = undefined; }
    try { delete window.__gpPlayable; } catch (e) { window.__gpPlayable = undefined; }
    // 音频系统是模块级的：只把引用放下，**不要** destroy（下次挂载还要用）
    sound = null; soundReady = false; soundP = null;
    if (!IS_PLUGIN) document.documentElement.lang = prevLangAttr;
    // 只删自己建的那个节点
    try { if (own && own.parentNode) own.parentNode.removeChild(own); } catch (e) { /* */ }
    own = null; BGFILL = null; VIEW = null; IS_PLUGIN = false; SOUND_OPTS = null;
  };
}
"""

src = patch(src, [(BOOT_OLD, BOOT_NEW, 1)])

# ============ 3) 写回 ============
if CHECK:
    print(f'\n--check：全部锚点命中，未写文件（原文 {orig_len} 字节 → 预计 {len(src)} 字节）')
    sys.exit(0)

BAK.mkdir(exist_ok=True)
backup = BAK / 'game.js.pre-patch'
if not backup.exists():
    shutil.copy2(GAME, backup)
    print(f'\n备份 → {backup.relative_to(ROOT)}')
GAME.write_text(src, encoding='utf-8', newline=EOL)
print(f'\n✓ 写完 game.js：{orig_len} → {len(src)} 字符（行尾保持 {"CRLF" if EOL != chr(10) else "LF"}）')
