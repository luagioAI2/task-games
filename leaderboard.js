import { t } from './i18n.js';

export function totalStars(stars                   )         {
  return stars.slice(0, 200).reduce((n, s) => n + (Number.isFinite(s) ? Math.max(0, Math.min(3, Math.floor(s))) : 0), 0);
}
export function keepBestStars(stars          , level        , earned        ) {
  stars[level] = Math.max(stars[level] || 0, Math.max(0, Math.min(3, Math.floor(earned))));
  return totalStars(stars);
}
const submitted = new Map                ();
const pending = new Map                                 ();
function bounded   (promise            )             {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 6000);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}
export async function syncStars(stars                   )                          {
  const player = window.gp?.player;
  if (!player) return { offline: true };
  try { await bounded(player.ready); } catch { return { offline: true }; }
  const id = player.user?.id;
  if (!id) return { needLogin: true };
  const total = totalStars(stars);
  if (total === 0) return {};
  if ((submitted.get(id) ?? -1) >= total) return { best: submitted.get(id) };
  const prior = pending.get(id);
  if (prior) { await prior; return syncStars(stars); }
  const job = (async ()                          => {
    try {
      const result = await bounded(player.submitScore(total));
      if (typeof result.best === 'number' && !result.offline && !result.needLogin) submitted.set(id, Math.max(total, result.best));
      return result;
    } catch { return { offline: true }; }
  })();
  pending.set(id, job);
  try { return await job; } finally { pending.delete(id); }
}

let veil                        = null;
let returnFocus                     = null;
export function leaderboardOpen() { return veil !== null; }
export function closeLeaderboard() {
  veil?.remove(); veil = null;
  if (boilTimer) { clearInterval(boilTimer); boilTimer = 0; }
  roughs.length = 0;
  returnFocus?.focus(); returnFocus = null;
}

// ── hand-drawn outlines for DOM: each element gets an SVG with 3 jittered variants that boil at ~8 fps ──
const SVG = 'http://www.w3.org/2000/svg';
                                                                                         
                                                                                                                                            
const roughs          = [];
let boilTimer = 0, boilFrame = 0;
function rng(seed        ) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function wobblyRect(w        , h        , amp        , r              ) {
  const pts                     = [];
  const side = (x1        , y1        , x2        , y2        ) => {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / 22));
    for (let i = 0; i < n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t + (r() - 0.5) * amp * 2, y1 + (y2 - y1) * t + (r() - 0.5) * amp * 2]); }
  };
  side(0, 0, w, 0); side(w, 0, w, h); side(w, h, 0, h); side(0, h, 0, 0);
  pts.push([pts[0][0] + (r() - 0.5) * amp * 2, pts[0][1] + (r() - 0.5) * amp]);
  return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
}
function drawRough(R       ) {
  const { el, svg, o } = R;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h || (w === R.w && h === R.h)) return;
  R.w = w; R.h = h;
  const pad = 10;
  svg.setAttribute('viewBox', `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`);
  svg.style.left = svg.style.top = `${-pad}px`;
  svg.style.width = `${w + pad * 2}px`; svg.style.height = `${h + pad * 2}px`;
  svg.replaceChildren();
  for (let v = 0; v < 3; v++) {
    const r = rng(o.seed * 977 + v * 131);
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'rv'); g.style.display = v === boilFrame % 3 ? '' : 'none';
    const path = (d        , attrs                        ) => { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); for (const k in attrs) p.setAttribute(k, attrs[k]); g.append(p); return p; };
    if (o.shadow) path(wobblyRect(w, h, o.amp, r), { fill: o.ink, transform: 'translate(6 7)', opacity: '0.85' });
    path(wobblyRect(w, h, o.amp * 0.6, r), { fill: o.fill });
    if (o.lines) {
      let d = '';
      for (let y = 34; y < h - 6; y += 30) d += `M6 ${(y + (r() - 0.5) * 1.5).toFixed(1)} L${w - 6} ${(y + (r() - 0.5) * 1.5).toFixed(1)} `;
      path(d, { stroke: '#aac4e4', 'stroke-width': '1.6', fill: 'none' });
      path(`M28 4 L${(28 + (r() - 0.5) * 2).toFixed(1)} ${h - 4}`, { stroke: '#e58b8b', 'stroke-width': '1.8', fill: 'none' });
    }
    path(wobblyRect(w, h, o.amp, r), { fill: 'none', stroke: o.ink, 'stroke-width': String(o.width), 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(o.dash ? { 'stroke-dasharray': '9 6' } : {}) });
    svg.append(g);
  }
}
let roughSeed = 1;
function rough(el             , o                     = {}) {
  const svg = document.createElementNS(SVG, 'svg')                 ;
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'rough');
  el.classList.add('roughed');
  el.prepend(svg);
  const R        = { el, svg, o: { fill: '#fffdf6', ink: '#1f2a44', width: 2.6, amp: 1.6, seed: roughSeed++, ...o }, w: 0, h: 0 };
  roughs.push(R);
  drawRough(R);
  return el;
}
function boilTick() {
  boilFrame++;
  for (const R of roughs) {
    drawRough(R);
    const gs = R.svg.children;
    for (let i = 0; i < gs.length; i++) (gs[i]               ).style.display = i === boilFrame % 3 ? '' : 'none';
  }
}
let styled = false;
function styles() {
  if (styled) return; styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .star-board-veil{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:#1f2a44cc;padding:16px;box-sizing:border-box;color:#1f2a44}
  .roughed{position:relative;isolation:isolate;background:transparent!important;border-color:transparent!important;box-shadow:none!important}
  .rough{position:absolute;pointer-events:none;z-index:-1;overflow:visible}
  .star-board{width:min(680px,100%);max-height:calc(100dvh - 32px);box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:20px 24px 20px 44px;transform:rotate(-0.6deg)}
  .star-board h2,.star-board p{margin:0}.star-board h2{font-size:clamp(23px,4vw,34px);line-height:1.2;transform:rotate(-1.5deg)}.star-board p{font-size:16px;line-height:1.35}
  .star-board-head,.star-board-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}.star-board-summary{padding:8px 12px;font-size:18px;font-weight:bold;transform:rotate(0.8deg)}
  .star-board button{font:inherit;font-size:16px;color:#1f2a44;background:transparent;border:0;min-width:48px;min-height:48px;padding:6px 14px;cursor:pointer;flex-shrink:0}.star-board button:active{transform:translateY(2px) rotate(-1deg)}.star-board button:disabled{opacity:.45;cursor:default}.star-board button:focus-visible{outline:3px dashed #3b6fd8;outline-offset:4px}
  .star-board-list{min-height:60px;flex:1;overflow:auto;overscroll-behavior:contain;padding:4px 6px}.star-row{display:grid;grid-template-columns:44px minmax(0,1fr) 100px;gap:10px;align-items:center;min-height:48px;font-size:18px;padding:2px 8px;box-sizing:border-box;margin:2px 0}.star-rank{font-weight:bold}.star-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.star-score{text-align:right;font-weight:bold}.star-page{display:flex;gap:8px;align-items:center}.star-board-status{min-height:22px}
  @media(max-height:500px){.star-board{padding:10px 18px;gap:6px}.star-board h2{font-size:24px}.star-board-summary{font-size:16px;padding:5px 10px}.star-row{min-height:36px;font-size:16px}.star-board-rule{display:none}}
  @media(orientation:portrait){.star-board-veil{display:none}}
  `;
  document.head.append(s);
}

export function openLeaderboard(stars                   , font        , click            ) {
  if (veil) return;
  styles(); returnFocus = document.activeElement               ;
  const outer = document.createElement('div'); outer.className = 'star-board-veil'; veil = outer;
  const panel = document.createElement('section'); panel.className = 'star-board'; panel.style.fontFamily = font;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'star-board-title');
  outer.append(panel); document.body.append(outer);
  rough(panel, { shadow: true, lines: true, width: 3.2, amp: 2.2 });
  if (!boilTimer) boilTimer = window.setInterval(boilTick, 125);
  const node = (tag        , text        , cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; };
  const button = (text        , action            , fill = '#fffdf6') => { const b = document.createElement('button'); b.textContent = text; b.onclick = () => { click(); action(); }; rough(b, { fill, shadow: false, width: 2.6, amp: 1.4 }); return b; };
  const head = node('div', '', 'star-board-head');
  const title = node('h2', t('ranking')); title.id = 'star-board-title';
  const close = button(t('back'), closeLeaderboard); close.dataset.action = 'board-close';
  head.append(title, close); panel.append(head);
  panel.append(rough(node('div', t('starTotal', { n: totalStars(stars) }), 'star-board-summary'), { fill: '#ffd166', width: 2.4, amp: 1.4 }));
  panel.append(node('p', t('rankingRule'), 'star-board-rule'));
  const list = node('div', '', 'star-board-list'); list.setAttribute('data-mp-scroll', ''); list.setAttribute('aria-live', 'polite'); panel.append(list);
  const status = node('p', t('rankingLoading'), 'star-board-status'); status.setAttribute('role', 'status'); panel.append(status);
  const foot = node('div', '', 'star-board-foot'); panel.append(foot);
  const refresh = button(t('rankingRefresh'), () => void load()); refresh.dataset.action = 'board-refresh';
  const login = button(t('rankingLogin'), () => window.gp?.player.requestLogin()); login.dataset.action = 'board-login';
  const pages = node('div', '', 'star-page');
  let page = 0, rows                     = [], loading = false;
  const pageText = node('span', '1 / 1');
  const previous = button('‹', () => { page--; render(); }); previous.setAttribute('aria-label', t('rankingPrevious'));
  const next = button('›', () => { page++; render(); }); next.setAttribute('aria-label', t('rankingNext'));
  pages.append(previous, pageText, next); foot.append(refresh, login, pages);
  function render() {
    list.replaceChildren();
    for (let i = roughs.length - 1; i >= 0; i--) if (!roughs[i].el.isConnected) roughs.splice(i, 1);
    const maxPage = Math.max(1, Math.ceil(rows.length / 5)); page = Math.max(0, Math.min(page, maxPage - 1));
    pageText.textContent = `${page + 1} / ${maxPage}`; previous.disabled = page === 0; next.disabled = page === maxPage - 1;
    if (!rows.length && !loading) list.append(node('p', t('rankingEmpty')));
    rows.slice(page * 5, page * 5 + 5).forEach((entry, i) => {
      const row = node('div', '', 'star-row'); row.dataset.me = String(entry.isMe);
      const name = node('span', entry.name + (entry.isMe ? ` (${t('rankingYou')})` : ''), 'star-name'); name.title = name.textContent ;
      row.append(node('span', String(page * 5 + i + 1), 'star-rank'), name, node('span', t('starCount', { n: entry.score }), 'star-score')); list.append(row);
      rough(row, entry.isMe ? { fill: '#ffd166', dash: true, width: 2.4, amp: 1.2 } : { fill: 'rgba(255,253,246,0.6)', ink: '#7d8aa6', width: 1.6, amp: 1 });
    });
  }
  async function load() {
    if (loading || veil !== outer) return;
    loading = true; refresh.disabled = true; login.hidden = true; status.textContent = t('rankingLoading');
    try {
      const result = await syncStars(stars);
      const player = window.gp?.player;
      if (!player) throw new Error('unavailable');
      const entries = await bounded(player.topScores(10));
      if (veil !== outer) return;
      rows = entries.filter(e => Number.isFinite(e.score)).sort((a, b) => b.score - a.score).slice(0, 10);
      status.textContent = result.needLogin ? t('rankingGuest') : result.offline ? t('rankingPending') : t('rankingRule');
      login.hidden = !result.needLogin;
      outer.dataset.state = 'ready';
    } catch {
      if (veil !== outer) return;
      rows = []; status.textContent = t('rankingOffline'); outer.dataset.state = 'error';
    } finally {
      loading = false;
      if (veil === outer) { refresh.disabled = false; render(); }
    }
  }
  outer.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeLeaderboard(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const buttons = Array.from(panel.querySelectorAll('button')).filter(b => !b.disabled && !b.hidden);
      const index = buttons.indexOf(document.activeElement                     );
      buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  });
  close.focus(); render(); void load();
  requestAnimationFrame(boilTick); setTimeout(boilTick, 30);
}
