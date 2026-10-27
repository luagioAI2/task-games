// Guided tutorial overlay: a dim layer with a spotlight ring around the current target and a coach bubble.
// It never blocks input — the player performs the real action on the real UI; main.ts decides when a step is done.
import { C } from "../ui-tokens.js";
import { NATIVE, ORDER, getLang, t,           } from "../i18n.js";

                                                                                 
                           
                                                                               
              
                   
                
               
                     
                                                                
                    
                                                                             
                      
                     
 

let CSS_DONE = false;
function installCss() {
  if (CSS_DONE) return;
  CSS_DONE = true;
  const st = document.createElement("style");
  st.textContent = `
.tut-layer{position:absolute;inset:0;pointer-events:none}
.tut-layer :where(button){font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.tut-dim{position:absolute;inset:0;background:rgba(24,32,42,.42)}
.tut-ring{position:absolute;border:3px solid ${C.accent};border-radius:14px;box-shadow:0 0 0 9999px rgba(24,32,42,.42);
  transition:left .18s ease-out,top .18s ease-out,width .18s ease-out,height .18s ease-out}
.tut-ring::after{content:"";position:absolute;inset:-7px;border:3px solid ${C.gold};border-radius:18px;animation:tutPulse 1.3s ease-out infinite}
.tut-bubble{position:absolute;pointer-events:auto;background:${C.paper};border:3px solid ${C.outline};border-radius:16px;
  padding:11px 12px 12px;box-shadow:0 6px 0 rgba(34,48,61,.35);color:${C.text};box-sizing:border-box;max-width:calc(100% - 24px)}
.tut-bubble .tp{font-size:11px;font-weight:800;color:${C.muted};letter-spacing:.03em}
.tut-bubble .tt{font-size:17px;font-weight:800;margin:2px 0 4px;color:${C.text}}
.tut-bubble .tb{font-size:13.5px;line-height:1.5;color:${C.text}}
.tut-bubble .tl{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.tut-bubble .tf{display:flex;gap:8px;margin-top:10px}
@keyframes tutPulse{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.12)}}
@media (prefers-reduced-motion: reduce){.tut-ring::after{animation:none}}
`;
  document.head.appendChild(st);
}

export class TutorialOverlay {
          layer             ;
          dim             ;
          ring             ;
          bubble             ;
          progressEl             ;
          titleEl             ;
          bodyEl             ;
          langRow             ;
          nextBtn                   ;
          skipBtn                   ;
          key = "";
          shown = false;
          last                  = null;

  constructor(host             , onNext            , onSkip            , onLang                   ) {
    installCss();
    this.layer = document.createElement("div");
    this.layer.className = "tut-layer";
    this.layer.style.display = "none";
    this.dim = document.createElement("div");
    this.dim.className = "tut-dim";
    this.ring = document.createElement("div");
    this.ring.className = "tut-ring";
    this.bubble = document.createElement("div");
    this.bubble.className = "tut-bubble";
    this.bubble.setAttribute("role", "dialog");
    this.bubble.setAttribute("aria-live", "polite");
    this.progressEl = document.createElement("div");
    this.progressEl.className = "tp";
    this.titleEl = document.createElement("div");
    this.titleEl.className = "tt";
    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "tb";
    this.langRow = document.createElement("div");
    this.langRow.className = "tl";
    for (const k of ORDER) {
      const b = document.createElement("button");
      b.className = "langbtn";
      b.dataset.k = k;
      b.textContent = NATIVE[k];
      b.addEventListener("click", () => onLang(k));
      this.langRow.appendChild(b);
    }
    const foot = document.createElement("div");
    foot.className = "tf";
    this.skipBtn = document.createElement("button");
    this.skipBtn.className = "btn";
    this.skipBtn.style.cssText = "flex:0 0 auto;min-width:88px";
    this.skipBtn.dataset.tut = "skip";
    this.skipBtn.addEventListener("click", onSkip);
    this.nextBtn = document.createElement("button");
    this.nextBtn.className = "btn primary";
    this.nextBtn.style.cssText = "flex:1 1 0;min-width:0";
    this.nextBtn.dataset.tut = "next";
    this.nextBtn.addEventListener("click", onNext);
    foot.append(this.skipBtn, this.nextBtn);
    this.bubble.append(this.progressEl, this.titleEl, this.bodyEl, this.langRow, foot);
    this.layer.append(this.dim, this.ring, this.bubble);
    host.appendChild(this.layer);
  }

  get element() { return this.layer; }
  get visible() { return this.shown; }

  hide() {
    if (!this.shown) return;
    this.shown = false;
    this.layer.style.display = "none";
  }

  show(f          , vw        , vh        ) {
    if (!this.shown) { this.shown = true; this.layer.style.display = ""; }
    this.last = f;
    // measure the live overlay, not the caller's cached screen size (a resize can land between frames)
    vw = this.layer.clientWidth || vw;
    vh = this.layer.clientHeight || vh;
    const lang = getLang();
    const key = `${f.key}|${lang}|${f.next ?? ""}`;
    if (key !== this.key) {
      this.key = key;
      this.progressEl.textContent = f.progress;
      this.titleEl.textContent = f.title;
      this.bodyEl.textContent = f.body;
      this.skipBtn.innerHTML = `<span class="lbl">${t("tut.skip")}</span>`;
      this.nextBtn.style.display = f.next ? "" : "none";
      if (f.next) this.nextBtn.innerHTML = `<span class="lbl">${f.next}</span>`;
      this.langRow.style.display = f.showLangs ? "" : "none";
      for (const b of Array.from(this.langRow.querySelectorAll("button"))                       ) {
        const on = b.dataset.k === lang;
        b.className = "langbtn" + (on ? " on" : "");
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }

    // spotlight
    const tg = f.target;
    if (tg) {
      const pad = 6;
      this.dim.style.display = "none";
      this.ring.style.display = "";
      this.ring.style.left = `${tg.left - pad}px`;
      this.ring.style.top = `${tg.top - pad}px`;
      this.ring.style.width = `${tg.right - tg.left + pad * 2}px`;
      this.ring.style.height = `${tg.bottom - tg.top + pad * 2}px`;
    } else {
      this.dim.style.display = "";
      this.ring.style.display = "none";
    }

    // bubble placement: never over the target, never over the open sheet
    const av = f.avoid;
    const sidePanel = !!av && av.top < 140 && av.left > vw * 0.4;
    const w = sidePanel ? Math.max(200, Math.min(340, av .left - 20)) : Math.min(340, vw - 24);
    this.bubble.style.width = `${w}px`;
    const h = this.bubble.offsetHeight;
    let left        , top        ;
    if (sidePanel) {
      left = 10;
      top = tg ? (tg.top + tg.bottom) / 2 - h / 2 : vh / 2 - h / 2;
    } else {
      const cx = tg ? (tg.left + tg.right) / 2 : vw / 2;
      left = Math.max(12, Math.min(vw - w - 12, cx - w / 2));
      if (av) top = av.top - 14 - h;
      else if (!tg) top = vh * 0.42 - h / 2;
      else if ((tg.top + tg.bottom) / 2 > vh * 0.5) top = tg.top - 18 - h;
      else top = tg.bottom + 18;
    }
    top = Math.max(8, Math.min(vh - h - 8, top));
    this.bubble.style.left = `${Math.round(left)}px`;
    this.bubble.style.top = `${Math.round(top)}px`;
  }
}
