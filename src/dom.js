// 界面结构：由脚本注入 #app（MakePlay 的 index.html 是平台模板，只有 <div id="app">），并加载 styles.css。
// 所有可见文字都经 i18n 的 t()；切换语言时 applyDomTexts() 重新填一遍。
import { t } from '../i18n.js';

const ICON = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 4.9-.1-2.8 2-1.6-2-3.5-2.4.9-2.3-1.4L15.4 2h-4l-.4 2.5-2.3 1.4-2.4-.9-2 3.5 2 1.6-.1 2.8-2 1.6 2 3.5 2.4-.9 2.3 1.4.4 2.5h4l.4-2.5 2.3-1.4 2.4.9 2-3.5Z"/></svg>',
  // 商城：带条纹遮阳棚的小店铺
  inv: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16l2 6.2a3.2 3.2 0 0 1-5.2 2.4 3.3 3.3 0 0 1-4.8 0 3.3 3.3 0 0 1-4.8 0A3.2 3.2 0 0 1 2 9.2Zm3.1 1.8-1 4h2.6l.5-4Zm4.1 0-.3 4h2.2l-.3-4Zm4.6 0 .5 4h2.6l-1-4ZM4 13.6a5 5 0 0 0 1.8.3V19h5v-4.5h2.4V19h5v-5.1a5 5 0 0 0 1.8-.3V21H4Z"/></svg>',
  rank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V5h4Zm0 4H5v1a3 3 0 0 0 2 2.8Zm10 0v3.8A3 3 0 0 0 19 8V7Z"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 4 14h5v5h6v-5h5Z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19 20 10h-5V5H9v5H4Z"/></svg>',
};

const markup = () => `
  <div id="stage"></div>
  <div id="hud">
    <div class="hud-top">
      <div class="hud-left">
        <div class="hud-cash"><i class="coin" aria-hidden="true"></i><div class="cash-txt"><b class="cash">0</b><small class="rate"></small></div></div>
        <div class="hud-depth"><i class="d-mark" aria-hidden="true"></i><b class="d-name"></b><small class="d-depth"></small></div>
        <div class="hud-lang" role="group" data-aria="aria.lang" hidden></div>
      </div>
      <div class="hud-btns">
        <button class="ibtn" data-act="shop" data-aria="aria.investors" type="button">${ICON.inv}<span class="ib-l" data-t="dock.inv"></span><span class="badge" hidden>!</span></button>
        <button class="ibtn" data-act="rank" data-aria="aria.rank" type="button">${ICON.rank}<span class="ib-l" data-t="dock.rank"></span></button>
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
  for (const el of document.querySelectorAll('[data-aria]')) el.setAttribute('aria-label', t(el.dataset.aria));
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  const gn = document.querySelector('.g-name'); if (gn) gn.textContent = t('guide.name');
  document.title = 'ABYSS MINE';
}
// 加载进度：升降篮沿绳下降、矿车沿轨道前进、底部显示百分比（画法在 styles.css 的 .ld-shaft 里）
export function setLoading(p) {
  const v = Math.max(0, Math.min(1, p)), pct = Math.round(v * 100);
  const root = document.querySelector('#loading');
  if (root) root.style.setProperty('--p', String(v));
  const n = document.querySelector('.ld-pct'); if (n) n.textContent = pct + '%';
}

// 首次进入时挂在深度牌下面的一行小语言切换（母语名平铺，一点就切，不挡画面）。
// 玩家第一次点世界或选过语言后收起；之后在设置里切。返回 { set, show, hide }。
export function langStrip({ langs, label, onPick }) {
  const el = document.querySelector('.hud-lang'); el.textContent = '';
  const btns = new Map();
  const set = (l) => { for (const [k, b] of btns) { const on = k === l; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
  for (const l of langs) {
    const b = document.createElement('button');
    b.type = 'button'; b.lang = { ja: 'ja', zh: 'zh-CN', en: 'en' }[l] || l; b.textContent = label[l] || l;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => { onPick(l); set(l); });
    el.appendChild(b); btns.set(l, b);
  }
  return { set, show: () => { el.hidden = false; }, hide: () => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 260); } };
}

export function mountDom() {
  let app = document.getElementById('app');
  if (!app) { app = document.createElement('div'); app.id = 'app'; document.body.appendChild(app); }
  app.tabIndex = 0;
  if (!document.getElementById('stage')) app.insertAdjacentHTML('beforeend', markup());
  applyDomTexts();
  if (document.querySelector('link[data-game-css]')) return Promise.resolve();
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('../styles.css', import.meta.url).href; link.dataset.gameCss = '';
  const done = new Promise((res) => { link.onload = res; link.onerror = res; setTimeout(res, 4000); });
  document.head.appendChild(link);
  return done;
}
