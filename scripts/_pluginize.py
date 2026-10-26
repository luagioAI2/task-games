#!/usr/bin/env python3
"""一次性改造脚本：把 anthill 的整页脚本改成可挂载/卸载的插件入口。

为什么用脚本而不是编辑器里点几下：同一个文件要改 20 多处，
手动 Edit 容易互相覆盖（而且工具会报成功）。这里每一条替换都带断言，
锚点找不到就整体退出、不写文件 —— 免得改到一半留下半成品。
"""
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / 'game.js'
I18N = ROOT / 'i18n.js'


def patch(text, pairs):
    for i, (old, new, cnt) in enumerate(pairs):
        n = text.count(old)
        if n != cnt:
            print(f'✗ 第 {i + 1} 条锚点命中 {n} 次（期望 {cnt}）：{old[:70]!r}')
            sys.exit(2)
        text = text.replace(old, new)
    return text


def cut(text, start, end):
    i = text.index(start)
    j = text.index(end, i)
    return text[:i] + text[j:]


src = GAME.read_text(encoding='utf-8')
orig_len = len(src)

# ---------- 1) 包成 start(opts)，把「资源 / 存档 / 容器」变成注入项 ----------
src = patch(src, [
    (
        "import { createBiteMask, eatTo, biteSpot, isAlive, surfaceAt,               } from './world/bites.js';\n",
        "import { createBiteMask, eatTo, biteSpot, isAlive, surfaceAt,               } from './world/bites.js';\n"
        "import { scopeCss } from './scope-css.js';\n"
        "\n"
        "/**\n"
        " * 游戏入口。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，\n"
        " * 差别全部通过 `opts` 注入 —— 所以这里没有任何 `if (isPlugin)` 分支：\n"
        " *\n"
        " * | | `index.html` | `plugin.js` |\n"
        " * | --- | --- | --- |\n"
        " * | 资源 | 不传（相对文档） | `ctx.assetUrl()` |\n"
        " * | 音频 | 不传（`./`） | `ctx.assetBase`（manifest 里是 `assets/…` / `sound.pack`，相对站点根） |\n"
        " * | 存档 | 不传（平台存档 / 内存） | `host.storage` → `makeHostStore()` |\n"
        " * | 容器 | 不传（`#app`） | `mount(container)` 给的那个 |\n"
        " * | 开局收费 | 不传（不收费） | `chargePlay()` |\n"
        " */\n"
        "export async function start(opts = {}) {\n"
        "  const mountTo = opts.mountTo ?? null;\n"
        "  const store = opts.store ?? null;\n"
        "  /** 资源解析：插件里走 `ctx.assetUrl`（相对 `assets/`），网页里原样 */\n"
        "  const A = typeof opts.asset === 'function' ? opts.asset : (rel) => rel;\n"
        "  /** 音频清单里的 url 是相对**站点根**的（`assets/audio/…`、`sound.pack`） */\n"
        "  const assetRoot = typeof opts.assetRoot === 'string' && opts.assetRoot ? opts.assetRoot : './';\n"
        "  /** 样式作用域的根类名（随机，防止两份挂载互相干扰） */\n"
        "  const scope = 'anthill-' + Math.random().toString(36).slice(2, 8);\n"
        "  let alive = true;\n"
        "\n"
        "  // ---- 开局收费（只有插件形态会传）----\n"
        "  const paid = opts.chargePlay ? await opts.chargePlay() : true;\n"
        "  if (!paid) {\n"
        "    const gate = document.createElement('div');\n"
        "    gate.style.cssText =\n"
        "      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;'\n"
        "      + 'gap:10px;padding:24px;text-align:center;background:#fbf3e4;color:#4a3550;'\n"
        "      + \"font:900 16px/1.5 system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif\";\n"
        "    gate.innerHTML = '<div style=\"font-size:20px\">积分不够啦</div>'\n"
        "      + '<div style=\"font-weight:800;color:#7a6070\">去做个任务攒点积分，再回来喂蚂蚁</div>';\n"
        "    const box = mountTo || document.getElementById('app') || document.body;\n"
        "    box.appendChild(gate);\n"
        "    return function unmountGate() { gate.remove(); };\n"
        "  }\n",
        1,
    ),
])

# ---------- 2) 存档：优先走 host.storage ----------
src = patch(src, [
    (
        "    const d = window.gp?.player?.saves?.latestSync;\n"
        "    const info = window.gp?.player?.saves?.latestInfo;\n"
        "    if (!d || info?.legacy || typeof d !== 'object' || d.v !== 1) return false;\n",
        "    // 插件形态读 `host.storage`（已 await 过的内存缓存）；网页形态读平台存档\n"
        "    const d = store ? store.get('save') : window.gp?.player?.saves?.latestSync;\n"
        "    if (!d || typeof d !== 'object' || d.v !== 1) return false;\n",
        1,
    ),
    (
        "  window.gp?.player?.saves?.putLatest({ ...S });\n  dirty = false;\n",
        "  if (store) store.set('save', { ...S });\n"
        "  else window.gp?.player?.saves?.putLatest({ ...S });\n"
        "  dirty = false;\n",
        1,
    ),
])

# ---------- 3) 容器由外部传入 ----------
src = patch(src, [
    (
        "const host = document.getElementById('app') ;\n",
        "// ★ 容器由外部传入（插件形态）。定位上下文由 `plugin.js` 负责补 ——\n"
        "//   这里**不碰** `host.style.position`：宿主给的是 `absolute inset-0` 写在**类**里，\n"
        "//   补 inline `relative` 会盖掉它，盒子退回内容高度（且所有高度断言照样绿）。\n"
        "const host = mountTo || document.getElementById('app') || document.body;\n",
        1,
    ),
])

# ---------- 4) 样式作用域 + 把「整页 fixed」改成「容器内 absolute」 ----------
src = patch(src, [
    ("#ui{position:fixed;inset:0;", "#ui{position:absolute;inset:0;", 1),
    ("styleEl.textContent = css;", "styleEl.textContent = scopeCss(css, '.' + scope);", 1),
    (
        "#loader .lt{text-shadow:0 2px 0 #a0503e}\n`;",
        "#loader .lt{text-shadow:0 2px 0 #a0503e}\n"
        ".toast{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(74,53,80,.88);color:#fff;font-weight:900;font-size:16px;padding:10px 18px;border-radius:16px;opacity:0;transition:opacity .18s;pointer-events:none}\n"
        ".toast.on{opacity:1}\n`;",
        1,
    ),
])

# ---------- 5) 资源走 assetUrl ----------
src = patch(src, [
    ("  cash: 'assets/ui/icon_cash.png', ant: 'assets/ui/icon_ant.png', speed: 'assets/ui/icon_speed.png', strength: 'assets/ui/icon_strength.png',",
     "  cash: A('assets/ui/icon_cash.png'), ant: A('assets/ui/icon_ant.png'), speed: A('assets/ui/icon_speed.png'), strength: A('assets/ui/icon_strength.png'),", 1),
    ("  shop: 'assets/ui/icon_shop.png', trophy: 'assets/ui/icon_trophy.png', world: 'assets/ui/icon_world.png', gear: 'assets/ui/icon_gear.png',",
     "  shop: A('assets/ui/icon_shop.png'), trophy: A('assets/ui/icon_trophy.png'), world: A('assets/ui/icon_world.png'), gear: A('assets/ui/icon_gear.png'),", 1),
    ("  coin: 'assets/ui/icon_coin.svg',", "  coin: A('assets/ui/icon_coin.svg'),", 1),
    ("  soldier: 'assets/ui/ant_soldier.png', strong: 'assets/ui/ant_strong.png', golden: 'assets/ui/ant_golden.png',",
     "  soldier: A('assets/ui/ant_soldier.png'), strong: A('assets/ui/ant_strong.png'), golden: A('assets/ui/ant_golden.png'),", 1),
    ("  const glbEntries = Object.entries(GLB_URLS)                        ;",
     "  // GLB 的路径也相对 `assets/`，同样要过 A()\n"
     "  const glbEntries = Object.entries(GLB_URLS).map(([k, u]) => [k, A(u)]);", 1),
    ("  const snd = loadSoundSystem({ manifestUrl: './sound.manifest.json' })",
     "  // 清单里 `assets/audio/…` 与 `sound.pack` 都是**相对站点根**的 ⇒ baseUrl 取 assetRoot\n"
     "  const snd = loadSoundSystem({ manifestUrl: assetRoot + 'assets/sound.manifest.json', baseUrl: assetRoot })", 1),
])

# ---------- 6) UI 挂进容器（不是 body）+ $ 只在游戏自己的子树里找 ----------
src = patch(src, [
    (
        "const ui = document.createElement('div');\nui.id = 'ui';\n",
        "// 游戏 UI 挂在**容器里**，不是 document.body（否则会盖住宿主的底栏和弹层）\n"
        "const rootEl = document.createElement('div');\n"
        "rootEl.className = scope;\n"
        "rootEl.style.cssText = 'position:absolute;inset:0;overflow:hidden';\n"
        "host.appendChild(rootEl);\n"
        "const ui = document.createElement('div');\nui.id = 'ui';\n",
        1,
    ),
    ("document.body.appendChild(ui);\n", "rootEl.appendChild(ui);\n", 1),
    (
        "const $ = (id        ) => document.getElementById(id) ;",
        "// ★ 只在游戏自己的子树里找：`#money` / `#panel` / `#loader` 这些 id 太通用，\n"
        "//   用 document.getElementById 会抓到宿主里同名元素（或抓到上一次挂载残留的那份）。\n"
        "const $ = (id) => ui.querySelector('#' + id);",
        1,
    ),
])

# ---------- 7) 删掉平台内购（金币兑换）与排行榜 ----------
src = cut(src, "function renderCoins() {", "function renderModal() {")
src = cut(src, "// ======================= leaderboard =======================", "$('setBtn').addEventListener(")

src = patch(src, [
    (
        "function buyUp(k       ) {\n  const lv = S.lv[k];\n  if (lv >= UPS[k].max) return false;\n  const cost = upCost(k, lv);\n  if (S.money < cost) { openCoins(); return false; } // not enough cash -> coin exchange\n",
        "function buyUp(k       ) {\n  const lv = S.lv[k];\n  if (lv >= UPS[k].max) return false;\n  const cost = upCost(k, lv);\n  if (S.money < cost) { notEnough(); return false; } // 钱不够：提示一句，不再弹「买金币」\n",
        1,
    ),
    (
        "    if (!buyUp(k)) { stop(); return; } // short on cash: openCoins() already opened the exchange, no repeat-buy\n",
        "    if (!buyUp(k)) { stop(); return; } // 钱不够：notEnough() 已经提示过，别再连点\n",
        1,
    ),
    (
        "    if (S.money < cost) { openCoins(); return; } // not enough cash -> coin exchange\n",
        "    if (S.money < cost) { notEnough(); return; }\n",
        1,
    ),
    # modal 分支
    (
        "  if (modalKind === 'shop') {\n    renderShop();\n  } else if (modalKind === 'coins') {\n    renderCoins();\n  } else if (modalKind === 'rank') {\n    p.innerHTML = renderRank();\n  } else if (modalKind === 'settings') {\n",
        "  if (modalKind === 'shop') {\n    renderShop();\n  } else if (modalKind === 'settings') {\n",
        1,
    ),
    (
        "  if (!tg) { if (e.target === $('modal') && (modalKind === 'shop' || modalKind === 'coins' || modalKind === 'settings' || modalKind === 'rank')) closeModal(); return; }\n",
        "  if (!tg) { if (e.target === $('modal') && (modalKind === 'shop' || modalKind === 'settings')) closeModal(); return; }\n",
        1,
    ),
    ("  if (d.login) { try { window.gp?.player?.requestLogin(); } catch { /* ignore */ } return; }\n", "", 1),
    ("  if (d.coin) { void buyCoins(); return; }\n", "", 1),
    (
        "$('shopBtn').addEventListener('pointerdown', () => { unlockAudio(); coinMsg = ''; openModal('shop'); });\n$('rankBtn').addEventListener('pointerdown', () => { unlockAudio(); openRank(); });\n",
        "$('shopBtn').addEventListener('pointerdown', () => { unlockAudio(); openModal('shop'); });\n",
        1,
    ),
    ("  $('rankLbl').textContent = t('rank');\n", "", 1),
    (
        '  <button class="side" id="rankBtn"><img src="${IMG.trophy}" alt=""><span id="rankLbl"></span></button>\n',
        "",
        1,
    ),
    ("  void submitProgress();\n", "", 1),
    (
        "// boot sync only for signed-in players (a guest submit would trigger a login prompt at launch)\nwindow.gp?.player?.ready.then(() => { if (window.gp?.player?.user) return submitProgress(); }).catch(() => { /* offline */ });\n",
        "",
        1,
    ),
])

# ---------- 8) notEnough()：原来那两处会弹「买金币」，现在只提示一句 ----------
src = patch(src, [
    (
        "// ---- modals ----\n",
        "// 钱不够的提示（原来这里会弹「金币兑换」内购面板）\n"
        "let toastTm = 0;\n"
        "function notEnough() {\n"
        "  let el = ui.querySelector('.toast');\n"
        "  if (!el) { el = document.createElement('div'); el.className = 'toast'; ui.appendChild(el); }\n"
        "  el.textContent = t('noCash');\n"
        "  el.classList.add('on');\n"
        "  clearTimeout(toastTm);\n"
        "  toastTm = setTimeout(() => el.classList.remove('on'), 1400);\n"
        "}\n"
        "\n// ---- modals ----\n",
        1,
    ),
])

# ---------- 9) 生命周期：alive 守卫 + 帧循环 + 销毁 ----------
src = patch(src, [
    ("function frame(now        ) {\n", "function frame(now        ) {\n  if (!alive) return;\n", 1),
    (
        "  if (!fx || !fx.render()) renderer.render(scene, camera);\n  requestAnimationFrame(frame);\n",
        "  if (!fx || !fx.render()) renderer.render(scene, camera);\n  if (alive) requestAnimationFrame(frame);\n",
        1,
    ),
    (
        "window.addEventListener('pagehide', () => { save(); void sound?.dispose(); }, { once: true });\n",
        "const onPagehide = () => { save(); void sound?.dispose(); };\n"
        "window.addEventListener('pagehide', onPagehide);\n",
        1,
    ),
    ("document.title = 'Ant Boss';\n", "", 1),
    (
        "const display = mountDisplay({\n  orientation: 'portrait',\n",
        "const display = mountDisplay({\n  host,\n  orientation: 'portrait',\n",
        1,
    ),
    (
        "last = performance.now();\nrequestAnimationFrame(frame);\n",
        "last = performance.now();\nif (alive) requestAnimationFrame(frame);\n",
        1,
    ),
])

# ---------- 10) 收尾：返回 destroy ----------
TAIL_ANCHOR = "window.__ant = { S, get items()"
i = src.index(TAIL_ANCHOR)
# `window.__ant = {...};` 是文件的最后一条语句，找到它的结尾 `};\n`
j = src.index("};\n", src.index("get canvas() { return renderer.domElement; }", i)) + 3
src = src[:j] + (
    "\n"
    "  // ======================= destroy =======================\n"
    "  /**\n"
    "   * 卸载。宿主会在切 tab 时调它，所以**每一步都要能单独失败**：\n"
    "   * 一个 try 包住全部，前面那步抛了后面就全不执行（症状是「切回来黑屏」）。\n"
    "   *\n"
    "   * ★ 3D 特有的那一步是 `forceContextLoss()`：只 `dispose()` 不释放上下文的话，\n"
    "   *   浏览器有 WebGL context 数量上限（通常 16），切几次之后**新建的上下文直接失败**，\n"
    "   *   画面全黑而且**不报错**。\n"
    "   */\n"
    "  return function destroy() {\n"
    "    alive = false;\n"
    "    try { save(); } catch (e) { console.warn('[anthill] 存档落盘失败', e); }\n"
    "    try { display?.dispose?.(); } catch { /* 已卸 */ }\n"
    "    try { window.removeEventListener('pagehide', onPagehide); } catch { /* 已卸 */ }\n"
    "    try { sound?.dispose?.(); } catch { /* 已卸 */ }\n"
    "    try { fx?.dispose?.(); } catch { /* 已卸 */ }\n"
    "    try { lensTree?.dispose?.(); } catch { /* 已卸 */ }\n"
    "    try { renderer.dispose(); } catch { /* 已卸 */ }\n"
    "    try { renderer.forceContextLoss?.(); } catch { /* 已卸 */ }\n"
    "    try { renderer.domElement.remove(); } catch { /* 已卸 */ }\n"
    "    try { ui.remove(); } catch { /* 已卸 */ }\n"
    "    try { rootEl.remove(); } catch { /* 已卸 */ }\n"
    "    try { styleEl.remove(); } catch { /* 已卸 */ }\n"
    "    // 调试钩子必须摘干净：留着 `__gpPlayable` 会让下一次挂载「等它就绪」的判据立刻假通过\n"
    "    try { delete window.__ant; } catch { /* ignore */ }\n"
    "    try { delete window.__gpReady; } catch { /* ignore */ }\n"
    "    try { delete window.__gpPlayable; } catch { /* ignore */ }\n"
    "  };\n"
    "}\n"
)

# ---------- 11) i18n：新增 noCash ----------
i18n = I18N.read_text(encoding='utf-8')
i18n = patch(i18n, [
    ("    coinUnavailable: '当前无法购买',\n", "    coinUnavailable: '当前无法购买',\n    noCash: '金币不够，先去搬点东西',\n", 1),
    ("    coinUnavailable: 'Purchases are unavailable here',\n",
     "    coinUnavailable: 'Purchases are unavailable here',\n    noCash: 'Not enough coins — haul some first',\n", 1),
    ("    coinUnavailable: 'ここでは購入できません',\n",
     "    coinUnavailable: 'ここでは購入できません',\n    noCash: 'コインが足りない。まず運ぼう',\n", 1),
])

GAME.write_text(src, encoding='utf-8')
I18N.write_text(i18n, encoding='utf-8')
print(f'✓ game.js {orig_len} → {len(src)} 字节')
print(f'✓ i18n.js 已加 noCash（zh / en / ja）')
