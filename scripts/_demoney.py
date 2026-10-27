#!/usr/bin/env python3
"""去商业化 + 插件化（一次性脚本，改完就不再需要）。

原版（値上げで満室）有三处平台面：
  1. `gp.player.saves` 存档 —— 换成宿主 storage / localStorage（src/host.js）
  2. `gp.pay.*` 内购商城（7 个商品，其中「お金無限」是作弊）
  3. `gp.player.*` 在线排行榜（提交分数 / 好友榜 / 资料页 / 在线状态）

做法：**删调用点**，不是塞一个假的 `gp`。留个空壳会让人以为平台面还在，
而且 `check-plugin` 的敏感 API 计数就永远归零不了。

删完之后：
  · コンビニ / 2棟目 / スカイラウンジ / 災害パック 进场即解锁
  · お金無限 + 時短ブースト 是作弊 / 消耗品，删掉
  · 排行榜整块删掉（连底栏奖杯按钮、菜单里的商店入口）

每个替换都断言命中次数；命中 0 次 = 锚点漂了，直接中止（别让它「静默少改一处」）。
"""
import re
import sys

M = 'game/main.js'
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


def subn(s, pat, rep, name, want, flags=0):
    new, n = re.subn(pat, rep, s, flags=flags)
    if n != want:
        sys.exit(f'✗ {name}: 命中 {n} 次（期望 {want}）')
    print(f'  ✓ {name} ×{n}')
    return new


s = read(M)

# ---- 1) 导入与容器
s = sub1(s, r'^import \{ fallbackProfile, requestProfile \} from "\./tenants\.js";$',
         'import { fallbackProfile, requestProfile } from "./tenants.js";\n'
         'import { makeLocalStore, makeSaveApi } from "../src/host.js";',
         'import host store', re.M)

s = sub1(s, r'^const appEl = document\.getElementById\("app"\) ;$',
         '/** 容器由 `start(opts)` 注入；独立网页退回 `#app`。 */\nlet appEl = null;',
         'appEl', re.M)

# ---- 2) boot 签名
s = sub1(s, r'async function boot\(\) \{\n  setLang\(pickLang\(navigator\.language\)\);',
         'async function boot(opts = {}) {\n'
         '  appEl = opts.mountTo || document.getElementById("app") || document.body;\n'
         '  setLang(pickLang(opts.locale || navigator.language));',
         'boot(opts)')

# ---- 3) 存档
s = sub1(s, r'  // ---- autosave boot read: three outcomes\n'
            r'  const S = gp\.player\.saves;\n'
            r'  await gp\.player\.ready\.catch\(\(\) => null\);',
         '  // ---- autosave boot read: three outcomes\n'
         '  // 存档：插件走 host.storage，独立网页走 localStorage（形状和 gp.player.saves 一致）\n'
         '  const S = makeSaveApi(opts.store || makeLocalStore("renttower:"));',
         'save adapter')

s = sub1(s, r'if \(latest \|\| \(S\.lastError && gp\.player\.user\)\) saveBlocked = true;',
         'if (latest || S.lastError) saveBlocked = true;',
         'saveBlocked')

# ---- 4) 内购内容：进场即解锁
s = sub1(s, r'  settleOffline\(state, nowSec\(\)\);',
         '  settleOffline(state, nowSec());\n'
         '  // 原版这四个是内购商品；插件不卖东西 ⇒ 进场即解锁\n'
         '  // （お金無限 / 時短ブースト 是作弊与消耗品，直接删掉，不在这里解锁）\n'
         '  unlockKonbini(state);\n'
         '  unlockTwin(state);\n'
         '  buyLounge(state);\n'
         '  state.quake.dlc = true;',
         'grant content')

# ---- 5) 不再改宿主页标题
s = subn(s, r'\n[ ]*document\.title = t\("title"\);', '', 'document.title', 2)

# ---- 6) UI 钩子：去掉商店 / 排行榜
s = sub1(s, r'\n    openRanking: \(\) => \{ void sound\?\.playCue\("ui\.tap", \{ eventId: eid\("tap"\) \}\); void openRanking\(\); \},', '', 'hook openRanking')
s = sub1(s, r'\n    // \?playtest=1 only: the sandbox has no gp\.pay.*?\n    openShop: \(\) => \{.*?\},', '', 'hook openShop')
s = sub1(s, r'\n    shopAvailable: \(\) => gp\.pay\.available \|\| PLAYTEST,', '', 'hook shopAvailable')
s = sub1(s, r'\n    openRow: \(row\) => openRow\(row\),', '', 'hook openRow')
s = sub1(s, r'\n    buyItem: \(id\) => void buyItem\(id\),', '', 'hook buyItem')
s = subn(s, r'ui\.openMenu\(state, \{ bgm: bgmVol, sfx: sfxVol \}, muted, gp\.pay\.available, DELEGATE_COST\);',
         'ui.openMenu(state, { bgm: bgmVol, sfx: sfxVol }, muted, DELEGATE_COST);', 'openMenu 调用', 2)

# ---- 7) 排行榜整块
s = sub1(s, r'\n  gp\.player\.ready\.then\(\(\{ user \}\) => \{\n.*?\n  \}\)\.catch\(\(\) => \{\}\);\n', '\n', 'gp.player.ready')

s = sub1(s, r'  /\*\* packed rent-first board defined in LEADERBOARD\.json.*?\n  \}\n\n  async function share\(\)',
         '  async function share()', 'submitScore/openRanking/openRow', re.S)

# ---- 8) 内购：商品表 / 交付 / 购买 / 待补发
s = sub1(s, r'\n  // ---- shop: deliver on ok.*?\n  const ITEMS.*?\n  \];\n', '\n', 'ITEMS', re.S)
s = sub1(s, r'  function deliver\(itemId.{0,20}, purchaseId.{0,20}\) \{.*?\n  \}\n  let buying = false;\n',
         '', 'deliver', re.S)
s = sub1(s, r'  async function buyItem\(itemId.{0,20}\) \{.*?\n  \}\n  async function pendingPurchases\(\) \{.*?\n  \}\n\n', '', 'buyItem/pendingPurchases', re.S)

# ---- 9) 在线状态（排行榜详情页用）
s = sub1(s, r'  // ---- public status for the leaderboard details page \(ids \+ numbers only\)\n.*?\n  \}\n\n', '', 'publishStatus', re.S)
s = sub1(s, r'\n    publishStatus\(\);', '', 'publishStatus 调用')

# ---- 10) 调试面板里的分数提交（排行榜没了，只留 toast）
s = subn(s, r'void submitScore\(\)\.then\(\(ok2\) => ui\.toast\(ok2 \? m1 : t\("dbg\.scorePending"\)\)\)\.catch\(\(\) => \{\}\);',
         'ui.toast(m1);', 'debug submitScore → toast', 3)
s = subn(s, r'\n        void submitScore\(\);', '', 'build hook submitScore', 1)
s = sub1(s, r'  void pendingPurchases\(\);\n  void submitScore\(\);\n  publishStatus\(\);', '', 'boot tail')

# ---- 11) 调试探针：deliver(...) 换成直接调用
s = sub1(s, r'    /\*\* probe: run the exact purchase-delivery code for the quake DLC \(pay API is unavailable in playtest\) \*/\n'
            r'    grantDlc: \(\) => \{ deliver\(SHOP\.quake\.itemId, "probe" \+ Date\.now\(\)\); \},\n'
            r'    /\*\* probe: run the exact shop-delivery path for the コンビニ \*/\n'
            r'    grantKonbini: \(\) => \{ deliver\(SHOP\.konbini\.itemId, "probe-kb" \+ Date\.now\(\)\); \},\n'
            r'    /\*\* probe: run the exact shop-delivery path for the コンビニ＋2棟目 set \*/\n'
            r'    grantInf: \(\) => \{ deliver\(SHOP\.infMoney\.itemId, "probe-inf" \+ Date\.now\(\)\); \},\n',
         '    /** probe: 災害パック（原内购商品，现在进场就有） */\n'
         '    grantDlc: () => { state.quake.dlc = true; ui.setAdminPanel(state); },\n',
         'probe grantDlc/grantKonbini/grantInf')
s = sub1(s, r'\n    grantSet: \(\) => \{ deliver\(SHOP\.set\.itemId, "probe-set" \+ Date\.now\(\)\); \},', '', 'probe grantSet')

# ---- 12) 调试「お金無限」不再提交分数
s = sub1(s, r'        lastSubmitted = -1;\n        void sound\?\.playCue\("fanfare\.full", \{ eventId: eid\("infC"\) \}\);\n'
            r'        buzz\("success"\);\n        const m1 = t\("dbg\.infOn"\);\n        ui\.toast\(m1\);\n',
         '        void sound?.playCue("fanfare.full", { eventId: eid("infC") });\n'
         '        buzz("success");\n'
         '        ui.toast(t("dbg.infOn"));\n',
         'debugInfMoney')
s = sub1(s, r'        if \(!state\.infBuy\) state\.money = Math\.min\(state\.infPrev \?\? 0, SCORE_CAP\);',
         '        state.money = Math.min(state.infPrev ?? 0, SCORE_CAP);',
         'debugInfMoney off')

# ---- 13) 重开一局不再保留「已购」标记
s = sub1(s, r"      const hadKb = !!state\.konbini, hadTwin = !!state\.twin, hadInf = !!state\.infBuy, paid = state\.delivered\.slice\(\);\n"
            r"      state = newGame\(nowSec\(\)\);\n"
            r"      // the コンビニ was bought with platform coins: starting over keeps the store \(fresh Lv1\) and the delivery ledger\n"
            r"      state\.delivered = paid;\n"
            r"      if \(hadKb\) unlockKonbini\(state\);\n"
            r"      view\.setKonbini\(!!state\.konbini, t\(\"kb\.name\"\)\);\n"
            r"      if \(hadInf\) \{ state\.infBuy = true; pinInfinite\(state\); \}   // paid お金無限 stays\n"
            r"      if \(hadTwin\) unlockTwin\(state\);   // paid: held until the new tower 1 reaches 500 floors\n",
            "      state = newGame(nowSec());\n"
            "      // 内容本来就不卖：重开一局照样全都有（便利店回 Lv1，2棟目照旧等 500 层）\n"
            "      unlockKonbini(state);\n"
            "      unlockTwin(state);\n"
            "      buyLounge(state);\n"
            "      state.quake.dlc = true;\n"
            "      view.setKonbini(!!state.konbini, t(\"kb.name\"));\n",
            'startOver')

# ---- 14) 监听器 / 定时器登记（卸载要摘干净）
s = sub1(s, r'  window\.addEventListener\("pointerdown", \(\) => \{ void unlockAudio\(\); \}\);\n'
            r'  window\.addEventListener\("keydown", \(\) => \{ void unlockAudio\(\); \}\);',
         '  // 卸载要能摘干净：监听器 / 定时器一律过这两个小工具登记\n'
         '  const listeners = [];\n'
         '  const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); listeners.push([target, type, fn, opt]); };\n'
         '  const timers = new Set();\n'
         '  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };\n'
         '  on(window, "pointerdown", () => { void unlockAudio(); });\n'
         '  on(window, "keydown", () => { void unlockAudio(); });',
         'listeners/timers')

# `alive` 要在最早的位置声明（boot 一进来就为 true，destroy 置 false）
s = sub1(s, r'  appEl = opts\.mountTo \|\| document\.getElementById\("app"\) \|\| document\.body;\n',
         '  appEl = opts.mountTo || document.getElementById("app") || document.body;\n'
         '  let alive = true;\n',
         'alive')

s = sub1(s, r'  window\.addEventListener\("resize", \(\) => \{ ui\.onResize\(\); \}\);',
         '  on(window, "resize", () => { ui.onResize(); });', 'resize listener')
s = sub1(s, r'  document\.addEventListener\("visibilitychange", \(\) => \{\n    if \(document\.hidden\) save\(\);\n    else settleOffline\(state, nowSec\(\)\);\n  \}\);',
         '  on(document, "visibilitychange", () => {\n    if (!alive) return;\n    if (document.hidden) save();\n    else settleOffline(state, nowSec());\n  });',
         'visibilitychange')
s = sub1(s, r'  window\.addEventListener\("pagehide", \(\) => \{\n    save\(\);\n    void sound\?\.dispose\(\);\n  \}\);',
         '  on(window, "pagehide", () => {\n    if (!alive) return;\n    save();\n    void sound?.dispose();\n  });',
         'pagehide')
s = sub1(s, r'setTimeout\(\(\) => void sound\?\.playCue\("police\.barricade", \{ eventId: eid\("barricade"\) \}\), 400\);',
         'later(() => void sound?.playCue("police.barricade", { eventId: eid("barricade") }), 400);',
         'barricade timer')
s = sub1(s, r'    if \(state\.tut !== -1\) \{ setTimeout\(maybeEventPopup, 4000\); return; \}',
         '    if (state.tut !== -1) { later(maybeEventPopup, 4000); return; }',
         'event popup retry')
s = sub1(s, r'  setTimeout\(maybeEventPopup, 1200\);',
         '  later(maybeEventPopup, 1200);', 'event popup')

# ---- 15) 结尾：暴露 api / 返回卸载函数 / 导出 start
s = sub1(s, r'  // read-only probe hooks\n  window\.__debug = \{',
         '  // read-only probe hooks\n  const api = {', 'api 对象')

s = sub1(s, r'    save,\n  \};\n\}\n\nvoid boot\(\);\n',
         '''    save,
  };
  window.__debug = api;

  /**
   * 卸载。**必须能在「刚建好就被调用」时安全执行**（孩子秒切 tab）。
   * 可重复调用：`alive` 置 false 后所有定时器 / 帧回调都会提前返回。
   */
  function destroy() {
    if (!alive) return;
    alive = false;
    try { app.ticker?.stop(); } catch { /* already gone */ }
    for (const [t2, type, fn, opt] of listeners) {
      try { t2.removeEventListener(type, fn, opt); } catch { /* ignore */ }
    }
    listeners.length = 0;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    try { loading.done(); } catch { /* ignore */ }
    try { ui.destroy?.(); } catch { /* ignore */ }
    try { sound?.dispose?.(); } catch { /* ignore */ }
    try { app.destroy(true, { children: true }); } catch { /* ignore */ }
    if (window.__debug === api) delete window.__debug;
    delete window.__gpPlayable;
    delete window.__gpReady;
  }

  return { api, destroy };
}

/**
 * 插件 / 独立网页的**唯一**入口。
 *
 * 宿主（`plugin.js`）和 `index.html` 调的是同一个函数，差别全部通过 `opts` 注入：
 * `mountTo`（容器）/ `store`（存档）/ `asset`（资源前缀）/ `locale` / `chargePlay`。
 * 返回卸载函数 —— 宿主会 `await` 它。
 */
export async function start(opts = {}) {
  const { destroy } = await boot(opts);
  return destroy;
}
''',
         'boot 收尾 + start 导出')

write(M, s)
print('\nmain.js 改完')
