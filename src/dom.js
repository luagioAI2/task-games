// 界面结构：注入到**宿主给的根元素**里（插件）或 `document.body` 里的 `#mng-root`（独立网页）。
// 所有可见文字都经 i18n 的 t()；切换语言时 applyDomTexts() 重新填一遍。
//
// ⚠️ 这里**不许**再出现 `document.getElementById('app')` / `document.querySelector('.cash')`：
//    插件挂载时页面里还有宿主的几十个 `.card` / `.cash` 之类，按 document 查会拿到宿主的节点
//    （症状是「游戏 HUD 显示的是宿主的数字」或者「改了没反应」）。一律走 `q()` / `qa()`，
//    它们只在 `ROOT` 里找。
import { t } from '../i18n.js';
import { loadStyles } from './scoped-css.js';

/** 根选择器（CSS 作用域也用它）。 */
export const ROOT_SEL = '#mng-root';

let ROOT = null;
/** 根元素。没挂载时是 null。 */
export const rootEl = () => ROOT;
const q = (s) => (ROOT ? ROOT.querySelector(s) : null);
const qa = (s) => (ROOT ? ROOT.querySelectorAll(s) : []);

const ICON = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-.1-2.8 2-1.6-2-3.5-2.4.9-2.3-1.4L15.4 2h-4l-.4 2.5-2.3 1.4-2.4-.9-2 3.5 2 1.6-.1 2.8-2 1.6 2 3.5 2.4-.9 2.3 1.4.4 2.5h4l.4-2.5 2.3-1.4 2.4.9 2-3.5Z"/></svg>',
  // 商城：带条纹遮阳棚的小店铺
  inv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16l2 6.2a3.2 3.2 0 0 1-5.2 2.4 3.3 3.3 0 0 1-4.8 0 3.3 3.3 0 0 1-4.8 0A3.2 3.2 0 0 1 2 9.2Zm3.1 1.8-1 4h2.6l.5-4Zm4.1 0-.3 4h2.2l-.3-4Zm4.6 0 .5 4h2.6l-1-4ZM4 13.6a5 5 0 0 0 1.8.3V19h5v-4.5h2.4V19h5v-5.1a5 5 0 0 0 1.8-.3V21H4Z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 4 14h5v5h6v-5h5Z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19 20 10h-5V5H9v5H4Z"/></svg>',
};

// 底栏按钮：商城（投资人 / 皮肤）、设置。
// ⚠️ 原来还有第三个「排行」（全服排行榜 + 登录云同步），接进宿主时整块删掉了 ——
//    那要联网，插件里只会转圈。删的是**按钮**，不是把它藏起来：藏起来还会被
//    guide.js 的 `hud: 'rank'` 找到并高亮一个看不见的东西。
const markup = () => `
  <div id="stage"></div>
  <div id="hud">
    <div class="hud-top">
      <div class="hud-left">
        <div class="hud-cash"><i class="coin" aria-hidden="true"></i><div class="cash-txt"><b class="cash">0</b><small class="rate"></small></div></div>
        <div class="hud-depth"><i class="d-mark" aria-hidden="true"></i><b class="d-name"></b><small class="d-depth"></small></div>
      </div>
      <div class="hud-btns">
        <button class="ibtn" data-act="shop" data-aria="aria.investors" type="button">${ICON.inv}<span class="ib-l" data-t="dock.inv"></span><span class="badge" hidden>!</span></button>
        <button class="ibtn" data-act="settings" data-aria="aria.settings" type="button">${ICON.gear}<span class="ib-l" data-t="dock.set"></span></button>
      </div>
    </div>
    <div class="hud-dock" aria-hidden="true"></div>
    <div class="hud-cam">
      <button class="ibtn" data-act="camUp" data-aria="aria.camUp" type="button">${ICON.up}<span class="ib-l" data-t="dock.up"></span></button>
      <button class="ibtn" data-act="camDown" data-aria="aria.camDown" type="button">${ICON.down}<span class="ib-l" data-t="dock.down"></span></button>
    </div>
    <div class="hud-toast" hidden></div>
    <div class="guide" hidden><button class="g-facebtn" type="button" data-aria="aria.guide"><canvas class="g-face" width="192" height="192" aria-hidden="true"></canvas><i class="g-new" aria-hidden="true"></i></button><div class="g-bubble" role="button" tabindex="0" aria-live="polite"><b class="g-name"></b><span class="g-step"></span><p class="g-text"><span class="g-on"></span><span class="g-ghost" aria-hidden="true"></span></p></div></div>
  </div>
  <section id="panel" class="overlay" hidden role="dialog" aria-modal="true">
    <div class="card">
      <div class="c-band" aria-hidden="true"></div>
      <i class="c-grip" aria-hidden="true"></i>
      <button class="close" data-act="close" data-aria="aria.close" type="button">×</button>
      <div class="c-head"><canvas class="c-icon" width="192" height="192" aria-hidden="true"></canvas><div><h2 class="c-title"></h2><p class="c-sub"></p></div></div>
      <div class="c-body"></div>
      <div class="c-foot"></div>
    </div>
  </section>
  <div id="loading">
    <div class="ld-box">
      <div class="ld-title">ABYSS MINE</div>
      <div class="ld-sub" data-t="boot.sub"></div>
      <!-- 竖井：两侧岩层，中间一根吊绳吊着升降篮，篮子随加载进度下降；绞盘轮一直在转，碎石一直在落 -->
      <div class="ld-shaft" aria-hidden="true">
        <i class="ld-wall l"></i><i class="ld-wall r"></i>
        <div class="ld-rope"></div>
        <div class="ld-cage"><i class="ld-basket"></i><i class="ld-ore"></i><i class="ld-glow"></i></div>
        <i class="ld-dust d1"></i><i class="ld-dust d2"></i><i class="ld-dust d3"></i><i class="ld-dust d4"></i><i class="ld-dust d5"></i>
        <div class="ld-wheel"><i></i></div>
      </div>
      <div class="ld-rail"><i></i><span class="ld-cart"></span></div>
      <p class="ld-text"><span class="ld-pct">0%</span><span class="ld-msg" data-t="boot.loading"></span></p>
      <p class="ld-tip" data-t="boot.tip0"></p>
    </div>
  </div>
  <div id="boot-error" hidden></div>`;

export function applyDomTexts() {
  for (const el of qa('[data-aria]')) el.setAttribute('aria-label', t(el.dataset.aria));
  for (const el of qa('[data-t]')) el.textContent = t(el.dataset.t);
  const gn = q('.g-name'); if (gn) gn.textContent = t('guide.name');
}
// 加载进度：升降篮沿绳下降、矿车沿轨道前进、底部显示百分比（画法在 styles.css 的 .ld-shaft 里）
export function setLoading(p) {
  const v = Math.max(0, Math.min(1, p)), pct = Math.round(v * 100);
  const root = q('#loading');
  if (root) root.style.setProperty('--p', String(v));
  const n = q('.ld-pct'); if (n) n.textContent = pct + '%';
}

/**
 * 建界面 + 装样式。
 *
 * @param {HTMLElement} root  宿主容器里的那块（插件）或 `document.body` 里的 `#mng-root`
 * @param {{ cssUrl: string, cssText?: string, assetUrl?: (rel: string) => string, safeArea?: boolean }} opts
 */
export async function mountDom(root, opts) {
  ROOT = root;
  root.textContent = '';
  const app = document.createElement('div');
  app.id = 'app';
  app.tabIndex = 0;          // 键盘（方向键 / Esc）要在它上面才收得到
  app.insertAdjacentHTML('beforeend', markup());
  root.appendChild(app);
  applyDomTexts();
  await loadStyles(opts.cssUrl, { root: ROOT_SEL, assetUrl: opts.assetUrl, safeArea: opts.safeArea, cssText: opts.cssText });
}

/** 卸载：把根清空 + 让模块变量回到「没挂载」。 */
export function unmountDom() {
  if (ROOT) ROOT.textContent = '';
  ROOT = null;
}
