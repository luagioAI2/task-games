#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一次性改造脚本（留档，说明当时怎么改的）：把「少女战记」从平台游戏改成
`kid-quest-farm-2d` 的插件。

改的是四件事（对应 docs/game-onboarding.md §4）：

1. **删内购**：`purchase.js` 整文件（女主角 5 平台币解锁 + 无色水晶三档礼包 +
   启动时 `settlePurchases()` 补发）。宿主没有付款通道，留着就是一个必然失败的按钮。
2. **换存档层**：`state.js` 原来走 `window.gp.player.saves`（云存档），
   改成 `setStore()` 注入的 store（插件里是 `host.storage`，独立网页里是 localStorage）。
3. **删排行榜 + 登录**：`showRanking` / `submitClear` / `seedScore` / `packScore`
   + 主界面的「排行榜」按钮。要联网，插件里只会转圈。
4. **无色水晶改成通关掉落**：删掉商店之后它没有来源，而 `canAfford()` 靠它补
   元素水晶的缺口 —— 不改的话 `save.prism` 永远是 0，升级面板会一直显示「补不上」。

外加插件化的前置改动：
- `uiRoot` 从「模块顶层 `document.createElement`」改成「`initUI()` 里建」——
  模块顶层碰 `document` 会让宿主 `check-plugin.mjs` 在 Node 里 `import()` 时直接抛；
  而且模块级 DOM 节点在第二次挂载时还指着已经被移除的那个。
- `initUI` 接受宿主容器与作用域类名，样式经 `scopeCss` 收进根类名。

★ 这个脚本**幂等**：`replace()` 不命中就不动（只报一次），可以重复跑。
★ 每一处都断言「改完之后目标字符串还在不在」，避免 `replace` 静默 0 次。
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


def sub(name, text, old, new, label):
    """精确替换一次。命中 0 次 = 报错（说明锚点已经变了），命中 >1 次也报错。"""
    n = text.count(old)
    if n == 1:
        print('  ok   %-42s %s' % (label, name))
        return text.replace(old, new)
    if n == 0 and new in text:
        print('  skip %-42s %s（已经改过）' % (label, name))
        return text
    fails.append('%s / %s：命中 %d 次' % (name, label, n))
    print('  FAIL %-42s %s（命中 %d 次）' % (label, name, n))
    return text


# ============================================================ state.js
s = read('state.js')

s = sub('state.js', s,
        "export let save       = fresh();",
        "export let save       = fresh();\n\n"
        "/**\n"
        " * 存档后端。插件里是 `host.storage`（`src/host.js` 的 makeHostStore），\n"
        " * 独立网页里是 localStorage 版。**必须在 `loadSave()` 之前注入。**\n"
        " */\n"
        "let store = null;\n"
        "export function setStore(s) { store = s; }",
        '注入 store')

s = sub('state.js', s,
        """export function loadSave() {
  try {
    const s = window.gp?.player?.saves;
    const info = s?.latestInfo;
    const d = s?.latestSync;
    if (d && !(info && info.legacy) && d.v === 1) {""",
        """export function loadSave() {
  try {
    // ★ 原来这里是 `window.gp.player.saves.latestSync`（平台云存档）。
    //   换成注入的 store：读的是 `preload()` 之后的内存缓存，同步、不 await。
    const d = store ? store.get('save') : null;
    if (d && d.v === 1) {""",
        'loadSave 换 store')

s = sub('state.js', s,
        """export function persist() {
  try { window.gp?.player?.saves?.putLatest(save); } catch { /* host keeps retrying */ }
}""",
        """export function persist() {
  // 只写内存 + 标脏，真正的落盘在 unmount 的 `store.flush()` 里。
  try { store?.set('save', save); } catch { /* 落盘失败不该打断游戏 */ }
}""",
        'persist 换 store')

# 付费相关的字段与函数（purchase.js 删掉之后没人用了）
s = sub('state.js', s,
        "    prism: 0, paid: [],",
        "    prism: 0,",
        '去掉 paid[]')

s = sub('state.js', s,
        "      if (typeof save.prism !== 'number' || !(save.prism >= 0)) save.prism = 0;\n"
        "      if (!Array.isArray(save.paid)) save.paid = [];",
        "      if (typeof save.prism !== 'number' || !(save.prism >= 0)) save.prism = 0;",
        '去掉 paid 校验')

s = sub('state.js', s,
        """/** Heroine bought with platform coins — granted by grantHero() on a successful purchase / startup settle. */
export function grantHero(id        )       {
  if (isUnlocked(CHAR_BY_ID[id])) return false;
  if (!save.owned.includes(id)) save.owned.push(id);
  persist();
  return true;
}
export function grantHeroes(ids          ) { let n = 0; for (const id of ids) if (CHAR_BY_ID[id] && grantHero(id)) n++; return n; }
""",
        "// 付费解锁（grantHero / grantHeroes）随 `purchase.js` 一起删掉了：\n"
        "// 锁着的角色现在**只能靠通关解锁**（`unlockAfter`）。\n",
        '删 grantHero*')

s = sub('state.js', s,
        """/** Colorless crystals bought with platform coins; purchaseId dedupes a delivery seen twice. */
export function grantPrism(n        , purchaseId        )          {
  if (purchaseId && save.paid.includes(purchaseId)) return false;
  save.prism = (save.prism || 0) + n;
  if (purchaseId) { save.paid.push(purchaseId); if (save.paid.length > 60) save.paid.splice(0, save.paid.length - 60); }
  persist();
  return true;
}

""",
        "",
        '删 grantPrism')

write('state.js', s)

# ============================================================ ui.js
u = read('ui.js')

u = sub('ui.js', u,
        "import { showHeroShop, canBuy, showPrismShop } from './purchase.js';",
        "import { scopeCss } from './scope-css.js';",
        '换 import')

u = sub('ui.js', u,
        "export const uiRoot = document.createElement('div');\n"
        "let screen             = () => {};\n"
        "let battle                = null;\n"
        "let setBackdrop                        = () => {};",
        "/*\n"
        " * ★ 原来这里是 `export const uiRoot = document.createElement('div')` —— **模块顶层碰 DOM**。\n"
        " *   两个后果：① 宿主 `check-plugin.mjs` 在 Node 里真 `import()` 这个包时直接抛；\n"
        " *   ② 模块级节点在第二次挂载时还指着上一次已经被移除的那个（切走再切回 = 白屏）。\n"
        " *   所以改成 `initUI()` 里建、`destroyUI()` 里清。\n"
        " */\n"
        "export let uiRoot = null;\n"
        "let styleEl = null;\n"
        "let screen             = () => {};\n"
        "let battle                = null;\n"
        "let setBackdrop                        = () => {};\n"
        "\n"
        "/** 开局收费回调：由 `game.js` 的 `start(opts)` 注入；独立网页里是 null（不收费）。 */\n"
        "let chargePlay = null;\n"
        "export function setChargePlay(fn) { chargePlay = fn; }",
        'uiRoot 延迟创建 + chargePlay')

u = sub('ui.js', u,
        """export function initUI(backdrop                       ) {
  setBackdrop = backdrop;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  uiRoot.id = 'ui';
  document.getElementById('app') .appendChild(uiRoot);
}""",
        """/**
 * 建 UI 层。
 *
 * @param backdrop 背景图切换回调
 * @param opts.host  宿主给的容器（不传 = 独立网页，挂 `#app`）
 * @param opts.scope 作用域类名（随机，如 `moestrike-a1b2c3`）
 *
 * ★ 样式必须经 `scopeCss` 收进根类名：这份 CSS 里有 `.grid` / `.btn` / `.panel` /
 *   `.modal` 这种通用类名，直接注入会盖掉宿主的 Tailwind 工具类
 *   （未分层样式胜过 `@layer utilities`）—— 症状是**宿主**坏了，不是游戏坏了。
 */
export function initUI(backdrop, opts = {}) {
  setBackdrop = backdrop;
  screen = showHome;
  battle = null;
  const scope = opts.scope || 'moestrike';
  const host = opts.host || document.getElementById('app') || document.body;
  // 作用域容器：`#ui` 要**在它里面**，否则 `.scope #ui{…}` 一条都不匹配
  let wrap = host.querySelector(':scope > .' + scope);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = scope;
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    host.appendChild(wrap);
  }
  styleEl = document.createElement('style');
  styleEl.textContent = scopeCss(CSS, '.' + scope);
  document.head.appendChild(styleEl);
  uiRoot = document.createElement('div');
  uiRoot.id = 'ui';
  wrap.appendChild(uiRoot);
}

/** 卸载：停掉战斗、摘样式、摘节点。**每一步单独 try** —— 前面抛了后面就不执行了。 */
export function destroyUI() {
  try { battle?.destroy(); } catch { /* ignore */ }
  battle = null;
  screen = () => {};
  setBackdrop = () => {};
  chargePlay = null;
  try { styleEl?.remove(); } catch { /* ignore */ }
  styleEl = null;
  try { uiRoot?.remove(); } catch { /* ignore */ }
  uiRoot = null;
}""",
        'initUI/destroyUI')

u = sub('ui.js', u,
        "function clear() { uiRoot.innerHTML = ''; }",
        "function clear() { if (uiRoot) uiRoot.innerHTML = ''; }",
        'clear 防空')

u = sub('ui.js', u,
        """  const pr = h('div', 'gem prism', `<img src="assets/ui-gem/prism.png">${save.prism || 0}${canBuy() ? '<b class="plus">+</b>' : ''}`);
  if (canBuy()) { pr.setAttribute('role', 'button'); pr.setAttribute('aria-label', t('prismShop')); tap(pr, () => showPrismShop(() => screen())); }
  g.appendChild(pr);""",
        """  // 无色水晶现在是**通关掉落**（见 onBattleEnd），没有商店入口了 —— 只读显示。
  g.appendChild(h('div', 'gem prism', `<img src="assets/ui-gem/prism.png">${save.prism || 0}`));""",
        'gemBar 去掉商店入口')

u = sub('ui.js', u,
        "  btns.appendChild(tap(h('button', 'btn violet', t('characters')), () => showChars()));\n"
        "  btns.appendChild(tap(h('button', 'btn gold', t('ranking')), showRanking));",
        "  btns.appendChild(tap(h('button', 'btn violet', t('characters')), () => showChars()));",
        '主界面去掉排行榜按钮')

# 排行榜整块（从注释到 settings 注释之间）
start = u.find('// ---------- ranking ----------')
end = u.find('// ---------- settings ----------')
if start != -1 and end != -1 and start < end:
    u = u[:start] + u[end:]
    print('  ok   %-42s ui.js' % '删排行榜整块')
else:
    fails.append('ui.js / 删排行榜整块：找不到边界')
    print('  FAIL %-42s ui.js' % '删排行榜整块')

u = sub('ui.js', u,
        """    const buyable = !un && canBuy();
    if (!un) card.appendChild(h('div', 'lk', buyable
      ? `🔒<br>${t('unlockAt', { n: c.unlockAfter })}<span class="buy"><img src="assets/ui/icon_coin_selected.svg">5</span>`
      : `🔒<br>${t('unlockAt', { n: c.unlockAfter })}`));
    if (!un && buyable) tap(card, () => showHeroShop(c.id, showChars));
    else if (!un) card.appendChild(h('div', 'lk', ''));""",
        """    // 付费解锁那条路已删：锁着的角色**只能靠通关解锁**（unlockAt）。
    if (!un) card.appendChild(h('div', 'lk', `🔒<br>${t('unlockAt', { n: c.unlockAfter })}`));""",
        '角色卡去掉付费入口')

u = sub('ui.js', u,
        """      if (!enough && canBuy()) { pr.appendChild(tap(h('span', 'plus-btn', '+'), () => showPrismShop(() => screen()))); }
""",
        "",
        '升级面板去掉水晶商店入口')

u = sub('ui.js', u,
        """async function enterBattle(n        ) {
  clear();""",
        """async function enterBattle(n        ) {
  /*
   * ★ 开局收费：**一场战斗 10 积分**。
   *
   * 放在这里而不是「开始」按钮里，是因为进战斗有三条路（首次 / 下一关 / 重试），
   * 写在一处才不会漏掉一条。钱不够就回主页 —— 别让玩家进到一半被打断。
   */
  if (chargePlay) {
    const paid = await chargePlay();
    if (!paid) { showHome(); return; }
  }
  clear();""",
        'enterBattle 收费')

u = sub('ui.js', u,
        """  const firstClear = r.win && r.stage > save.cleared;
  let joined                = null;
  if (r.win) {
    for (const e of ELEMENTS) save.gems[e] += r.drops[e];""",
        """  const firstClear = r.win && r.stage > save.cleared;
  let joined                = null;
  // 无色水晶：删掉内购商店之后改成**通关掉落**（Boss 关 3 个、普通关 1 个）。
  // 不加这一步 `save.prism` 永远是 0，而升级面板会一直显示「缺口补不上」。
  const prismGain = r.win ? (STAGES[r.stage - 1].boss ? 3 : 1) : 0;
  if (r.win) {
    for (const e of ELEMENTS) save.gems[e] += r.drops[e];
    save.prism = (save.prism || 0) + prismGain;""",
        '通关掉落水晶')

u = sub('ui.js', u,
        """    p.appendChild(cs);
    if (firstClear) p.appendChild(h('div', 'sub', `${t('firstClear')} +3`));""",
        """    if (prismGain) cs.appendChild(h('span', '', `<img src="assets/ui-gem/prism.png">×${prismGain}`));
    p.appendChild(cs);
    if (firstClear) p.appendChild(h('div', 'sub', `${t('firstClear')} +3`));""",
        '结算显示水晶')

u = sub('ui.js', u,
        """    if (r.stage >= save.cleared) {
      const slot = h('div', '');
      p.appendChild(slot);
      void submitClear(r.stage, r.turns || 999, slot);
    }
""",
        "",
        '结算去掉提交分数')

write('ui.js', u)

# ============================================================ game.js
g = read('game.js')

g = sub('game.js', g,
        "import { settlePurchases } from './purchase.js';\n", "", '删 settlePurchases import')
g = sub('game.js', g,
        "import { initUI, layoutUI, showHome, refresh, seedScore } from './ui.js';",
        "import { initUI, layoutUI, showHome, refresh, setChargePlay } from './ui.js';",
        '改 ui import')

write('game.js', g)

# ============================================================ i18n.js
i = read('i18n.js')
i = sub('i18n.js', i,
        "  ranking: '排行榜', rankHint: '按最远通关关卡排名，同关卡用回合数少者优先', rankEmpty: '暂无记录', rankLoading: '读取中…',",
        "  title: '少女战记',",
        'zh: 排行榜文案 → 标题')
i = sub('i18n.js', i,
        "  ranking: 'Ranking', rankHint: 'Ranked by furthest stage cleared; fewer turns wins ties', rankEmpty: 'No records yet', rankLoading: 'Loading…',",
        "  title: 'Moe Girl Strike',",
        'en: 排行榜文案 → 标题')
i = sub('i18n.js', i,
        "  ranking: 'ランキング', rankHint: '最高クリアステージで順位決定、同じならターン数が少ない方が上位', rankEmpty: 'まだ記録がありません', rankLoading: '読み込み中…',",
        "  title: '少女ストライク',",
        'ja: 排行榜文案 → 标题')
write('i18n.js', i)

# 标题改用 t('title')：原来是写死的 'Moe Girl Strike'
u = read('ui.js')
u = sub('ui.js', u,
        "  const title = h('div', 'title', 'Moe Girl Strike');",
        "  const title = h('div', 'title', t('title'));",
        '主界面标题走 i18n')
write('ui.js', u)

g = read('game.js')
g = sub('game.js', g,
        "const title = new PIXI.Text({ text: 'Moe Girl Strike',",
        "const title = new PIXI.Text({ text: t('title'),",
        '加载页标题走 i18n')
write('game.js', g)

print()
if fails:
    print('✗ %d 处没改成功：' % len(fails))
    for f in fails:
        print('  -', f)
    sys.exit(1)
print('✓ 全部改完')
