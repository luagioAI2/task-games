// Platform-coin heroine unlock (gp.pay): the buy dialog, the startup settle pass and the price.
import { t, lang, nameAll } from './i18n.js';
import { grantHero, grantHeroes, grantPrism, isUnlocked, persist, save } from './state.js';

export const HERO_PRICE = 5;
const ITEM_PREFIX = 'hero_';
const heroId = itemId => itemId.startsWith(ITEM_PREFIX) ? itemId.slice(ITEM_PREFIX.length) : null;
const pay = () => window.gp?.pay;

export function canBuy() { return !!pay()?.available; }

/** The server is the only ledger: deliver anything paid for before the page closed, then ack. */
export async function settlePurchases() {
  const p = pay();
  if (!p?.available) return 0;
  const r = await p.pending().catch(() => null);
  if (!r || !r.ok) return 0; // query failed — retry next launch, NOT "empty list"
  const ids = [];
  let n = 0;
  for (const it of r.items || []) {
    const id = heroId(it.itemId || '');
    if (id) ids.push(id);
    const pack = PRISM_PACKS.find(k => PRISM_PREFIX + k.coins === it.itemId);
    if (pack && grantPrism(pack.coins * PRISM_PER_COIN, it.purchaseId)) n++;
    p.ack(it.purchaseId); // fire and forget
  }
  return grantHeroes(ids) + n;
}

/** Locked-heroine card: one tap buys the heroine with platform coins. */
export function showHeroShop(id, after) {
  const p = pay();
  const closeModal = () => { m?.remove(); after?.(); };
  const m = document.createElement('div');
  m.className = 'modal';
  const box = document.createElement('div');
  box.className = 'panel pop';
  box.innerHTML = `<b style="font-size:24px">${t('buyTitle')}</b><div class="sub" style="font-size:13px">${t('name_' + id)}</div>`;
  const note = document.createElement('div');
  note.className = 'sub'; note.style.fontSize = '13px';
  note.textContent = t('buyTitle');
  m.appendChild(box);

  const msg = (s, good) => {
    note.textContent = s;
    note.style.color = good ? '#3f9d5a' : '#c2508a';
  };

  const buy = document.createElement('button');
  buy.className = 'btn gold';
  buy.style.width = '100%';
  buy.innerHTML = `<span class="price"><img src="assets/ui/icon_coin_selected.svg" alt="" aria-hidden="true">${HERO_PRICE} ${t('buyPrice')}</span><span>${t('buy')}</span>`;
  buy.setAttribute('aria-label', `${t('buy')} ${t('name_' + id)} ${HERO_PRICE} ${t('buyPrice')}`);
  buy.onclick = async () => {
    if (!p?.available) return;
    buy.disabled = true;
    const names = nameAll(id);
    const r = await p.purchase({ itemId: ITEM_PREFIX + id, title: names[lang] || names.zh, titles: names, price: HERO_PRICE }).catch(() => null);
    buy.disabled = false;
    if (!r) return;
    if (r.ok) {
      grantHero(id); persist(); p.ack(r.purchaseId);
      msg(t('buyOk', { n: r.balance ?? 0 }), true);
      setTimeout(closeModal, 900);
      return;
    }
    if (r.error === 'insufficient') msg(t('buyNo'));
    else if (r.error === 'busy') msg(t('buyBusy'));
    else if (r.error === 'pending') msg(t('buyFail'));
    else if (r.error === 'declined' || r.error === 'need_login') { /* the host dialog already covered it */ }
    else if (r.error === 'bad_request') console.error('gp.pay bad call', r);
    else msg(t('buyFail'));
  };

  const close = document.createElement('button');
  close.className = 'btn blue';
  close.textContent = t('close');
  close.onclick = closeModal;

  box.appendChild(note);
  box.appendChild(buy);
  box.appendChild(close);
  document.getElementById('ui').appendChild(m);
}

// ---------- colorless (prism) crystals: 1 coin = 20 ----------
export const PRISM_PER_COIN = 20;
const PRISM_PREFIX = 'prism_';
export const PRISM_PACKS = [{ coins: 1 }, { coins: 5 }, { coins: 10 }];
const PRISM_TITLES = n => ({ zh: `无色水晶 ×${n}`, en: `Prism Crystal ×${n}`, ja: `無色クリスタル ×${n}` });

/** Prism crystal shop: three packs, each one tap = one platform purchase. */
export function showPrismShop(after) {
  const p = pay();
  const m = document.createElement('div');
  m.className = 'modal';
  const closeModal = () => { m.remove(); after?.(); };
  const box = document.createElement('div');
  box.className = 'panel pop';
  box.innerHTML = `<img src="assets/ui-gem/prism.png" alt="" style="width:72px;height:72px;display:block;margin:0 auto"><b style="font-size:24px">${t('prismShop')}</b><div class="sub" style="font-size:13px;text-shadow:none;color:#8a6fc0">${t('prismDesc')}</div><div class="sub" style="font-size:13px;text-shadow:none;color:#8a6fc0">${t('prismHint')}</div>`;
  const have = document.createElement('div');
  have.style.cssText = 'font-weight:900;font-size:18px;margin:6px 0;display:flex;align-items:center;justify-content:center;gap:4px';
  const paintHave = () => { have.innerHTML = `<img src="assets/ui-gem/prism.png" alt="" style="width:28px;height:28px">${save.prism || 0}`; };
  paintHave();
  box.appendChild(have);
  const note = document.createElement('div');
  note.className = 'sub'; note.style.cssText = 'font-size:13px;min-height:18px;text-shadow:none;color:#8a6fc0';
  const msg = (s, good) => { note.textContent = s; note.style.color = good ? '#3f9d5a' : '#c2508a'; };
  const btns = [];
  for (const pack of PRISM_PACKS) {
    const amount = pack.coins * PRISM_PER_COIN;
    const b = document.createElement('button');
    b.className = 'btn gold';
    b.style.cssText = 'width:100%;margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:20px';
    b.innerHTML = `<span class="price"><img src="assets/ui-gem/prism.png" alt="">×${amount}</span><span class="price"><img src="assets/ui/icon_coin_selected.svg" alt="" aria-hidden="true">${pack.coins}</span>`;
    b.setAttribute('aria-label', `${t('prismBuy')} ${t('prism')} ×${amount}, ${pack.coins} ${t('buyPrice')}`);
    b.onclick = async () => {
      if (!p?.available || btns.some(x => x.disabled)) return;
      btns.forEach(x => { x.disabled = true; });
      const titles = PRISM_TITLES(amount);
      const r = await p.purchase({ itemId: PRISM_PREFIX + pack.coins, title: titles[lang] || titles.zh, titles, desc: t('prismDesc'), price: pack.coins }).catch(() => null);
      btns.forEach(x => { x.disabled = false; });
      if (!r) return;
      if (r.ok) {
        grantPrism(amount, r.purchaseId); p.ack(r.purchaseId);
        paintHave(); msg(t('prismOk', { n: amount }), true);
        return;
      }
      if (r.error === 'insufficient') msg(t('buyNo'));
      else if (r.error === 'busy') msg(t('buyBusy'));
      else if (r.error === 'declined' || r.error === 'need_login') { /* host dialog covered it */ }
      else if (r.error === 'bad_request') console.error('gp.pay bad call', r);
      else msg(t('buyFail'));
    };
    btns.push(b);
    box.appendChild(b);
  }
  box.appendChild(note);
  const close = document.createElement('button');
  close.className = 'btn blue';
  close.style.cssText = 'width:100%;margin-top:8px';
  close.textContent = t('close');
  close.onclick = closeModal;
  box.appendChild(close);
  m.appendChild(box);
  document.getElementById('ui').appendChild(m);
}
