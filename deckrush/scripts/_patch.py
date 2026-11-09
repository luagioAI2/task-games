# -*- coding: utf-8 -*-
"""deckrush 插件化改造（一次性补丁）。

每个锚点**必须恰好命中 1 次**才写盘 —— 否则中止，绝不静默跳过。
（理由：手改 30 多处时，漏一处不会报错，只会在真机上表现为「没反应」。）

```bash
python scripts/_patch.py --check   # 只打印命中情况
python scripts/_patch.py           # 真写
```
"""
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK = '--check' in sys.argv
files = {}
hits_log = []


def load(name):
    if name not in files:
        files[name] = io.open(os.path.join(ROOT, name), encoding='utf-8').read()
    return files[name]


def sub(name, old, new, label=''):
    src = load(name)
    n = src.count(old)
    hits_log.append((name, label or old[:50], n))
    if n != 1:
        print('FAIL %s 命中 %d 次：%r' % (name, n, label or old[:70]))
        sys.exit(1)
    files[name] = src.replace(old, new, 1)


def cut(name, start, end, label):
    """删掉 [start, end] 这段（end 取 start 之后第一次出现）"""
    src = load(name)
    i = src.find(start)
    if i < 0 or src.count(start) != 1:
        print('FAIL %s 起点命中 %d 次：%s' % (name, src.count(start), label))
        sys.exit(1)
    j = src.find(end, i)
    if j < 0:
        print('FAIL %s 找不到终点：%s' % (name, label))
        sys.exit(1)
    hits_log.append((name, label, 1))
    files[name] = src[:i] + src[j + len(end):]


# ============================================================ i18n.js
sub('i18n.js',
    'export function onLangChange(fn            ) { listeners.push(fn); }',
    '''/**
 * 订阅语言变化。**返回退订函数** —— 插件会反复挂载 / 卸载，
 * 不退订的话旧闭包会一直挂在 listeners 里，切语言时去重画一个已经 destroy 的场景。
 */
export function onLangChange(fn            ) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}''', 'onLangChange 返回退订')

# ============================================================ ui.js
sub('ui.js',
    'import { LANGS, LANG_NAMES, t, setLang, lang, onLangChange, cardName, cardText, enemyName, tagName } from "./i18n.js";',
    'import { LANGS, LANG_NAMES, t, setLang, lang, onLangChange, cardName, cardText, enemyName, tagName } from "./i18n.js";\n'
    'import { assetUrl as A } from "./src/asset.js";', 'ui.js 引入 A')

# ① 整层 UI 从「贴视口」改成「贴容器」
sub('ui.js', '.mp-ui { position: fixed; inset: 0;', '.mp-ui { position: absolute; inset: 0;', 'mp-ui 定位')
sub('ui.js', '.mp-toasts { position: fixed; left: 0; right: 0;', '.mp-toasts { position: absolute; left: 0; right: 0;', 'toasts 定位')

# ② 所有 DOM 图片走 A()
sub('ui.js', 'img.src = art.srcs[0];', 'img.src = A(art.srcs[0]);', '教程图（单张）')
sub('ui.js', 'img.src = src;', 'img.src = A(src);', '教程图（三联）')
sub('ui.js', 'img.src = "assets/cards/" + id + ".webp";',
    'img.src = A("assets/cards/" + id + ".webp");', '图鉴卡图')
sub('ui.js', 'img.src = r.icon;', 'img.src = A(r.icon);', '成就图标')

# ③ 结算页的「分享」按钮（宿主没有分享目标）
sub('ui.js',
    '''  const share = btn(t("share"), "primary", () => { void host.onShare().then((m) => toast(m)); });
  acts.appendChild(share);
''', '', '删分享按钮')

# ④ mountUi 返回卸载函数（否则每次挂载多一个 <style> + 一个语言监听）
sub('ui.js',
    '''  onLangChange(() => render());
  render();
}''',
    '''  const offLang = onLangChange(() => render());
  render();
  /** 卸载：摘语言监听 / <style> / 两层根节点。不返回这个，第二次挂载就会有两份 UI 一起 render。 */
  return () => {
    try { offLang(); } catch { /* ignore */ }
    try { style.remove(); } catch { /* ignore */ }
    try { root?.remove(); } catch { /* ignore */ }
    try { toasts.remove(); } catch { /* ignore */ }
    root = null;
  };
}''', 'mountUi 返回卸载')

# ============================================================ game.js
sub('game.js',
    'import { mountUi, updateUi, setCardFacts, toast, groupDeck, resetTutorial } from "./ui.js";',
    '''import { mountUi, updateUi, setCardFacts, toast, groupDeck, resetTutorial } from "./ui.js";
import { setAssetBase, assetUrl as A } from "./src/asset.js";
import { makeLocalStore, installGp, langKey } from "./src/host.js";

/**
 * 入口 —— 独立网页和插件调**同一个函数**，差别全走 `opts`：
 *
 * | opts | 谁传 | 干什么 |
 * | --- | --- | --- |
 * | `container` | 插件 | 挂载根节点（默认 `#app`）；`mountDisplay` 也认这个 |
 * | `assetBase` | 插件 | `ctx.assetUrl('')`；`blob:` 里相对路径会全部 404 |
 * | `store` | 插件 | 宿主 `storage` 适配出来的同步 store |
 * | `chargePlay` | 插件 | 开局扣积分；返回 false 就不进对局 |
 *
 * 返回**卸载函数**：摘监听 / 销毁 Pixi / 清容器 / 删调试钩子。
 */
export async function start(opts = {}) {''', 'game.js 包成 start()')

sub('game.js',
    '''const host = document.getElementById("app") ;
const app = new PIXI.Application();''',
    '''// 根节点：插件传自己的容器，独立网页用 #app
const container = opts.container ?? document.getElementById("app");
const host = container;
setAssetBase(opts.assetBase ?? "");

// 存档：宿主 storage（或 localStorage）。★ 必须在下面 readSave() 之前 preload 完
const store = opts.store ?? makeLocalStore();
try { await store.preload(); } catch (e) { console.warn("存档读不出来，按新档开始", e); }
installGp(store);

/** 开局收费（插件传进来；独立网页没有，等价于永远允许） */
const chargePlay = typeof opts.chargePlay === "function" ? opts.chargePlay : null;

const app = new PIXI.Application();''', '根节点 + store + 收费钩子')

sub('game.js',
    '''  const fontUrl = (window       ).gp?.fonts?.url?.("google-fonts-apache/luckiest-guy/LuckiestGuy-Regular.ttf")
    ?? "https://static.makeplay.ai/fonts/v1/google-fonts-apache/luckiest-guy/LuckiestGuy-Regular.ttf";''',
    '''  // 字体在包内（`assets/fonts/`）：平台的 fonts.url 在宿主里不存在，直连 CDN 在离线/内网会挂。
  // 加载失败会走下面的 .catch 回落系统字体，所以这只是「数字字体」的锦上添花。
  const fontUrl = A("assets/fonts/LuckiestGuy-Regular.ttf");''', '字体走本地')

sub('game.js',
    'const loaded = await PIXI.Assets.load(keys.map((k) => ({ alias: k, src: urls[k] })), (p) => { loadFrac = p; });',
    'const loaded = await PIXI.Assets.load(keys.map((k) => ({ alias: k, src: A(urls[k]) })), (p) => { loadFrac = p; });',
    '资源加 A() 前缀')

sub('game.js',
    'return { key, name, desc, icon: `assets/achievements/${key}.webp`, unlocked: done.has(key) };',
    'return { key, name, desc, icon: A(`assets/achievements/${key}.webp`), unlocked: done.has(key) };',
    '成就图标加 A()')

# 在线榜：删调用 + 删函数
sub('game.js', '  void gp_pi_submitScore(stage * 1000 + Math.max(0, 999 - run.turns));\n', '', '删榜单调用')
cut('game.js', 'async function gp_pi_submitScore(', '\n}\n', '删榜单函数')

# 分享：先删 onShare 方法，再删 captureShare，最后删 showResult 里的调用
cut('game.js', '  async onShare() {', '\n  },\n', '删 onShare')
cut('game.js', 'let shareBlob              = null;', '\n}\n', '删 captureShare')
sub('game.js', '  syncUi();\n  captureShare();\n}', '  syncUi();\n}', '删结算页分享调用')

# 启动：平台登录/语言 → 本地偏好
sub('game.js',
    '''await (window       ).gp?.player?.ready;
{
  const g = (window       ).gp;
  if (g?.player?.user?.locale && !isManualLang()) setLang(pickLang(g.player.user.locale));
}''',
    '''// 语言：平台登录已删，取本地偏好（宿主是中文 App，默认 zh）。
// `setLang(k, true)` 的第二个参数把 _manual 置真，切语言时才会写回存档。
setLang(store.get(langKey) ?? "zh", true);
onLangChange(() => { if (isManualLang()) store.set(langKey, lang()); });''', '语言取存档')

sub('game.js',
    '''mountUi(host, uiModel, uiHost, { safeTop: dispSafe.safeTop ?? 0, safeBottom: dispSafe.safeBottom ?? 0 });
scheduleLangRebuild();
document.title = t("title");''',
    '''const disposeUi = mountUi(host, uiModel, uiHost, { safeTop: dispSafe.safeTop ?? 0, safeBottom: dispSafe.safeBottom ?? 0 });
const offLangRebuild = scheduleLangRebuild();
// 插件里不许改宿主的标题
if (!opts.container) document.title = t("title");''', '保存卸载句柄')

sub('game.js',
    '''function scheduleLangRebuild() {
  onLangChange(() => {''',
    '''function scheduleLangRebuild() {
  return onLangChange(() => {''', 'scheduleLangRebuild 返回退订')

# 开局收费
sub('game.js',
    '''  onStart(fresh         ) {
    void unlockAudio();''',
    '''  async onStart(fresh         ) {
    // 「继续」是接着上一局，不该再收一次；只有开新局才收费
    if (fresh && chargePlay && (await chargePlay()) === false) return;
    void unlockAudio();''', '开局收费闸门')

# 具名监听（卸载时按身份摘）
sub('game.js',
    '''window.addEventListener("pointerdown", () => { void unlockAudio(); });
window.addEventListener("keydown", () => { void unlockAudio(); });
window.addEventListener("pagehide", () => { save(); void sound.dispose(); }, { once: true });''',
    '''const onGesture = () => { void unlockAudio(); };
const onHide = () => { save(); void sound.dispose(); };
window.addEventListener("pointerdown", onGesture);
window.addEventListener("keydown", onGesture);
window.addEventListener("pagehide", onHide, { once: true });''', '具名监听')

# ★ 跑完第一版才发现漏的两处（补在这里，保证「从干净镜像重跑」也能得到同一份结果）
#   ① `mountDisplay` 不给 host ⇒ 它量 `#app` / `document.body` ⇒ 插件里 canvas 比容器大，
#      超出的部分点不到（按钮看得见、点不动，控制台干净）
#   ② 声音清单是相对路径 ⇒ blob: 模块里 404 ⇒ 整局没有音乐，且**一个错都不报**
sub('game.js',
    'const display = mountDisplay({\n  orientation: "both",\n',
    'const display = mountDisplay({\n  orientation: "both",\n  host: container,\n', 'display 量容器')
sub('game.js',
    'loadSoundSystem({ manifestUrl: "./sound.manifest.json" })',
    'loadSoundSystem({ manifestUrl: A("sound.manifest.json") })', '声音清单走 A()')

# 结尾：返回卸载函数 + 收掉 start()
src = load('game.js')
if not src.rstrip().endswith('};'):
    print('FAIL game.js 结尾不是 __dbg 的 };')
    sys.exit(1)
files['game.js'] = src.rstrip() + '''

  // ---------- 卸载 ----------
  // 独立网页用不到（页面自己会走 pagehide）；插件每次切走都调它。
  return () => {
    try { window.removeEventListener("pointerdown", onGesture); } catch { /* ignore */ }
    try { window.removeEventListener("keydown", onGesture); } catch { /* ignore */ }
    try { window.removeEventListener("pagehide", onHide); } catch { /* ignore */ }
    try { offLangRebuild?.(); } catch { /* ignore */ }
    try { disposeUi?.(); } catch { /* ignore */ }
    try { display.dispose(); } catch { /* ignore */ }
    try { void sound?.dispose?.(); } catch { /* ignore */ }
    // ★ Pixi 用 texture:false：模块级/资源缓存里的纹理留给下一次挂载，
    //   销毁了会让第二次挂载白屏而且零报错。
    try { app.destroy({ children: true, texture: false, baseTexture: false }); } catch { /* ignore */ }
    try { container.replaceChildren(); } catch { /* ignore */ }
    try { delete window.__dbg; delete window.__gpPlayable; } catch { /* ignore */ }
    try { void store.flush(); } catch { /* ignore */ }
    tweens.length = 0;
    run = null;
    wv = null;
    bv = null;
  };
}
'''
hits_log.append(('game.js', '返回卸载函数 + 闭合 start', 1))

if CHECK:
    for f, label, n in hits_log:
        print('  %-10s %-40s %d' % (f, label, n))
    print('\n检查通过：%d 个锚点各命中 1 次（未写盘）' % len(hits_log))
    sys.exit(0)

for name, text in files.items():
    io.open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='').write(text)
    print('写盘 %s（%d 字节）' % (name, len(text.encode('utf-8'))))
print('完成：%d 处改动' % len(hits_log))
