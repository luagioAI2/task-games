// スクリーンUI（DOM）— 積んでミーヤ
// 世界の壁画プレートをCSSの「ザグ板」で再現する。色トークンはUI_CONTRACT.md §1 と一致。
import { scopeCss } from "./src/scope-css.js";
import { assetUrl as A } from "./src/asset.js";

// ★ 图标也走 assetBase（插件在 blob: 里跑，相对路径会 404）
//   `A()` 必须在**调用时**才求值 —— 模块顶层那会儿 `setAssetBase()` 还没跑。
const ICONS = {
  trophy: "assets/lib/kenney-game-icons/icons/leaderboardsComplex.webp",
  pause: "assets/lib/kenney-game-icons/icons/pause.webp",
  audioOn: "assets/lib/kenney-game-icons/icons/audioOn.webp",
  audioOff: "assets/lib/kenney-game-icons/icons/audioOff.webp",
  close: "assets/lib/kenney-game-icons/icons/buttonX.webp",
};
const icon = (k) => A(ICONS[k]);

                          
               
                
               
                
                
                 
                     
                   
                  
 

                        
               
                        
                               
                          
                          
                          
                         
                   
                        
                         
                            
                                  
                                        
                      
                         
 

let api       ;
let root                ;
let uiMode                                                     = "title";
let lastCombo = 0;

export function uiCanDrop() {
  return uiMode === "game";
}

const css = `
.uirt{--bg:#23203c;--surface:#f6ecd8;--text:#f6ecd8;--muted:#8d8d85;--accent:#ff3b6b;--strong:#ffd23f;--calm:#2ec4b6;--rank:#7b2fbf;--ink:#14110f;--danger:#ff4130;--success:#35d07f;
 position:absolute;inset:0;pointer-events:none;font-family:'MpFontDisplay','SmileySans',system-ui,-apple-system,sans-serif;
 user-select:none;-webkit-user-select:none;z-index:30;overflow:hidden}
.uirt *{box-sizing:border-box}
.uirt button{font-family:inherit;pointer-events:auto;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.uirt button:focus-visible{outline:3px solid var(--strong);outline-offset:2px}

/* ---- ザグ板（タグプレート） ---- */
.plate{display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text);
 border:4px solid var(--ink);padding:6px 14px;min-width:84px;text-align:center;
 box-shadow:4px 4px 0 0 rgba(20,17,15,.55);
 clip-path:polygon(0 12%,6% 0,94% 4%,100% 0,98% 88%,94% 100%,6% 96%,0 100%,2% 14%)}
.plate label{font-size:12px;font-weight:700;letter-spacing:.08em;opacity:.92;text-shadow:1px 1px 0 var(--ink)}
.plate b{font-size:26px;font-weight:900;line-height:1.05;text-shadow:2px 2px 0 var(--ink)}
.plate.score{background:var(--accent);transform:rotate(-2.5deg)}
.plate.level{background:var(--calm);transform:rotate(1.6deg)}
.plate.best{background:var(--rank);transform:rotate(-1.4deg)}
.plate.score,.plate.level,.plate.best{color:var(--text)}

/* ---- HUD ---- */
.hud{position:absolute;inset:0;display:none}
.hud.on{display:block}
.hud .top{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:0;right:0;display:flex;justify-content:center;gap:10px;align-items:flex-start;padding:0 12px}
.combo-badge{position:absolute;top:calc(env(safe-area-inset-top,0px) + 64px);left:0;right:0;margin:0 auto;width:max-content;
 background:var(--strong);color:var(--ink);font-weight:900;font-size:18px;padding:4px 14px;border:4px solid var(--ink);
 transform:rotate(2deg);box-shadow:3px 3px 0 0 rgba(20,17,15,.55);display:none}
.combo-badge.on{display:block}
.hint{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);left:0;right:0;text-align:center;
 color:var(--text);font-size:15px;font-weight:700;text-shadow:2px 2px 0 var(--ink);pointer-events:none;
 animation:hintPulse 1.6s ease-in-out infinite}
@keyframes hintPulse{0%,100%{opacity:.55}50%{opacity:1}}
.cornerbtn{position:absolute;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);width:52px;height:52px;
 display:flex;align-items:center;justify-content:center;background:var(--rank);border:4px solid var(--ink);
 box-shadow:3px 3px 0 0 rgba(20,17,15,.55);border-radius:14px;transition:transform .06s ease,filter .06s ease}
.cornerbtn.left{left:18px}
.cornerbtn.right{right:18px}
.cornerbtn:active{transform:scale(.88);filter:brightness(.75)}
.cornerbtn img{width:30px;height:30px;object-fit:contain}

/* ---- 全面オーバーレイ ---- */
.veil{position:absolute;inset:0;background:rgba(35,32,60,.72);display:none}
.veil.on{display:block}
.screen{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:space-between;
 padding:calc(env(safe-area-inset-top,0px) + 24px) 20px calc(env(safe-area-inset-bottom,0px) + 28px)}
.screen.on{display:flex}
 .screen .mid{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%}

.title-logo{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:6vh}
.title-plate{background:var(--strong);color:var(--ink);font-weight:900;border:5px solid var(--ink);
 padding:10px 26px;transform:rotate(-3deg);box-shadow:6px 6px 0 0 var(--danger);
 clip-path:polygon(0 14%,5% 0,96% 2%,100% 12%,97% 88%,94% 100%,4% 98%,0 86%)}
.title-plate span{font-size:clamp(30px,9vw,48px);letter-spacing:.04em;display:block;text-shadow:3px 3px 0 var(--text)}
.title-tag{background:var(--accent);color:var(--text);font-size:13px;font-weight:700;padding:4px 14px;border:3px solid var(--ink);
 transform:rotate(2deg);box-shadow:3px 3px 0 0 rgba(20,17,15,.55)}

.btn{display:block;width:min(78vw,320px);min-height:56px;color:var(--text);font-size:20px;font-weight:900;
 border:4px solid var(--ink);box-shadow:5px 5px 0 0 rgba(20,17,15,.55);margin:0 auto;
 padding:12px;transition:transform .06s ease,filter .06s ease;
 clip-path:polygon(0 16%,3% 0,97% 4%,100% 20%,98% 84%,96% 100%,3% 96%,0 80%)}
.btn:active{transform:scale(.94);filter:brightness(.8)}
.btn.accent{background:var(--accent);transform:rotate(-1.2deg)}
.btn.accent:active{transform:scale(.94) rotate(-1.2deg)}
.btn.calm{background:var(--calm);transform:rotate(1.4deg)}
.btn.calm:active{transform:scale(.94) rotate(1.4deg)}
.btn.rank{background:var(--rank)}
.btn.light{background:var(--surface);color:var(--ink);text-shadow:none}
.btn.danger{background:var(--danger)}
.btnrow{display:flex;flex-direction:column;gap:14px;width:100%;align-items:center}

.langrow{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.langbtn{background:var(--bg);color:var(--text);border:3px solid var(--ink);min-width:96px;min-height:48px;
 padding:8px 10px;font-size:15px;font-weight:800;box-shadow:3px 3px 0 0 rgba(20,17,15,.5)}
.langbtn.active{background:var(--ink);color:var(--strong);border-color:var(--strong);text-shadow:none;box-shadow:3px 3px 0 0 rgba(20,17,15,.5)}
.langbtn:active{transform:scale(.92)}

/* ---- 結果 ---- */
.go-plate{background:var(--danger);color:var(--text);font-size:30px;font-weight:900;padding:8px 30px;border:5px solid var(--ink);
 transform:rotate(-2.6deg);box-shadow:5px 5px 0 0 rgba(20,17,15,.55)}
.score-big{background:var(--rank);color:var(--text);min-width:170px;text-align:center;padding:12px 30px;border:5px solid var(--ink);
 transform:rotate(1.8deg);box-shadow:6px 6px 0 0 rgba(20,17,15,.55)}
.score-big label{display:block;font-size:13px;letter-spacing:.1em;opacity:.95}
.score-big b{font-size:56px;font-weight:900;line-height:1;text-shadow:3px 3px 0 var(--ink)}
.best-line{background:var(--surface);color:var(--ink);font-weight:800;font-size:16px;padding:8px 18px;border:4px solid var(--ink);
 transform:rotate(-1.4deg);box-shadow:4px 4px 0 0 rgba(20,17,15,.5)}
.newbest-badge{background:var(--success);color:var(--ink);font-weight:900;font-size:17px;padding:6px 20px;border:4px solid var(--ink);
 transform:rotate(2.2deg) scale(1);box-shadow:4px 4px 0 0 rgba(20,17,15,.55);animation:popIn .45s cubic-bezier(.2,1.6,.4,1)}
@keyframes popIn{from{transform:rotate(2.2deg) scale(.2);opacity:0}to{transform:rotate(2.2deg) scale(1);opacity:1}}

/* ---- ランキング ---- */
.rank-wrap{flex:1;width:100%;max-width:440px;display:flex;flex-direction:column;gap:12px;min-height:0}
.rank-head{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:440px}
.rank-title{background:var(--rank);color:var(--text);font-size:22px;font-weight:900;padding:8px 24px;border:4px solid var(--ink);
 transform:rotate(-1.6deg);box-shadow:4px 4px 0 0 rgba(20,17,15,.55)}
.rank-close{width:52px;height:52px;background:var(--danger);border:4px solid var(--ink);border-radius:14px;
 display:flex;align-items:center;justify-content:center;box-shadow:3px 3px 0 0 rgba(20,17,15,.55)}
.rank-close:active{transform:scale(.88);filter:brightness(.75)}
.rank-close img{width:26px;height:26px}
.rank-list{background:var(--surface);border:5px solid var(--ink);box-shadow:7px 7px 0 0 rgba(20,17,15,.5);
 overflow-y:auto;flex:1;min-height:0;padding:8px}
.rank-list button.row{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:6px 10px;text-align:left;
 background:transparent;border-radius:10px;color:var(--ink);transition:background .1s ease}
button.row:active{background:rgba(123,47,191,.18)}
.row .nn{flex:1;font-size:15px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button.row .nn{cursor:pointer}
.row.me{background:var(--rank);color:var(--text)}
.row.me .nn,.row.me .sc,.row.me .rk{color:var(--text);text-shadow:1px 1px 0 var(--ink)}
.rk{width:34px;font-weight:900;font-size:16px;color:var(--ink)}
.av{width:36px;height:36px;border-radius:8px;border:2px solid var(--ink);background:#ddd;flex:none;object-fit:cover}
.sc{font-weight:900;font-size:18px;color:var(--ink)}
.mutual{font-size:11px;font-weight:800;background:var(--calm);color:var(--ink);border:2px solid var(--ink);padding:1px 6px;border-radius:6px}
.rank-empty{color:#4a4637;text-align:center;padding:26px 10px;font-size:14px;font-weight:700}

/* ---- ポーズ ---- */
.pause-plate{background:var(--calm);color:var(--text);font-size:28px;font-weight:900;padding:8px 34px;border:5px solid var(--ink);
 transform:rotate(-2deg);box-shadow:5px 5px 0 0 rgba(20,17,15,.55);text-shadow:2px 2px 0 var(--ink)}

/* ---- レベルアップ帯 ---- */
.lvclip{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.lvbanner{position:absolute;top:38%;left:-175%;width:160%;height:74px;display:flex;align-items:center;
 background:var(--strong);border-top:5px solid var(--ink);border-bottom:5px solid var(--ink);
 transform:rotate(-4deg);pointer-events:none;transition:none;transform-origin:50% 50%;visibility:hidden}
.lvbanner .tx{width:100%;text-align:center;font-size:34px;font-weight:900;color:var(--ink);letter-spacing:.06em;text-shadow:none}
.lvbanner.run{visibility:visible;animation:bandRun 1.5s cubic-bezier(.16,.8,.28,1) forwards}
@keyframes bandRun{0%{left:-175%}22%{left:-30%}78%{left:-30%}100%{left:130%}}

@media (max-height:520px){
 .screen{padding:8px 16px 12px;gap:4px;justify-content:flex-start}
 .screen>.mid{gap:8px;margin-top:8px}
 .title-logo{gap:2px;margin-top:1vh}
 .title-plate{padding:5px 16px}
 .title-plate span{font-size:clamp(22px,6.5vw,32px)}
 .title-tag{font-size:11px;padding:2px 10px}
 .btnrow{gap:8px}
 .btn{min-height:48px;padding:6px;font-size:15px}
 .langrow{margin-top:6px}
 .langbtn{min-height:48px;	padding:4px 8px;font-size:13px;min-width:84px}
 .go-plate{font-size:20px;padding:4px 20px}
 .score-big{padding:6px 20px;margin-top:6px}
 .score-big b{font-size:36px}
 .best-line{font-size:13px;padding:4px 12px}
 .newbest-badge{font-size:14px;padding:3px 12px}
 .pause-plate{font-size:20px;padding:5px 22px}
 .rank-title{font-size:16px;padding:5px 16px}
 .rank-head{margin-top:2px}
}
@media (prefers-reduced-motion: reduce){
 .hint,.lvbanner.run,.newbest-badge{animation:none !important}
}
`;

function el(tag        , cls         , html         )              {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createUI(a       ) {
  api = a;
  let disposed = false;
  let gameOverTimer = 0;
  try {
    const g      = globalThis       ;
    if (g.gp?.fonts?.use) {
      g.gp.fonts.use({ display: "smiley-sans/SmileySans-Oblique.woff2" });
    } else {
      // `src/host.js` 只给了 `fonts.url`（指向包内 assets/fonts/）⇒ 走这条分支：
      // 字体随包离线加载，不依赖 static.makeplay.ai。
      const fontUrl = g.gp?.fonts?.url?.("smiley-sans/SmileySans-Oblique.woff2") ?? A("assets/fonts/smiley-sans/SmileySans-Oblique.woff2");
      const f = new FontFace("SmileySans", `url("${fontUrl}")`);
      void f.load().then(() => document.fonts.add(f)).catch(() => { /* 回落到系统字体 */ });
    }
  } catch { /* システムスタックにフォールバック */ }
  // ★ 根节点由外部传入（插件给的是宿主容器）。写死 `#app` 的话插件里拿到 null。
  const host = api.container ?? document.getElementById("app");
  const style = document.createElement("style");
  // ★★ 必须收进根选择器：这份样式表里有 `.btn` / `.screen` / `.hud` / `.plate`
  //    这类通用类名，裸挂在 `document.head` 上会**把宿主自己的界面改掉**，
  //    而且切走不卸载就永久留着（未分层样式胜过 Tailwind 的 @layer utilities）。
  style.textContent = scopeCss(css, ".uirt");
  document.head.appendChild(style);

  root = document.createElement("div");
  root.className = "uirt";
  host.appendChild(root);

  // ---------- HUD ----------
  const hud = el("div", "hud")                  ;
  hud.innerHTML = `
    <div class="top">
      <div class="plate score"><label data-t="score"></label><b id="hudScore">0</b></div>
      <div class="plate level"><label data-t="level"></label><b id="hudLevel">1</b></div>
      <div class="plate best"><label data-t="best"></label><b id="hudBest">0</b></div>
    </div>
    <div class="combo-badge" id="comboBadge"></div>
    <div class="hint" id="hint" data-t="tapHint"></div>
  `;
  root.appendChild(hud);

  const btnPause = el("button", "cornerbtn left")                     ;
  btnPause.innerHTML = `<img src="${icon("pause")}" alt="">`;
  btnPause.setAttribute("aria-label", "pause");
  btnPause.addEventListener("pointerdown", ev => { ev.stopPropagation(); api.playTap(); api.pauseGame(); show("pause"); });
  hud.appendChild(btnPause);

  const btnSound = el("button", "cornerbtn right")                     ;
  const soundImg = document.createElement("img");
  soundImg.src = icon("audioOn");
  btnSound.appendChild(soundImg);
  btnSound.setAttribute("aria-label", "sound");
  btnSound.addEventListener("pointerdown", ev => {
    ev.stopPropagation();
    const muted = api.toggleMute();
    soundImg.src = muted ? icon("audioOff") : icon("audioOn");
    api.playTap();
  });
  hud.appendChild(btnSound);

  const hintEl = hud.querySelector("#hint")               ;
  const comboBadge = hud.querySelector("#comboBadge")               ;

  // ---------- 全面ヴェイル ----------
  const veil = el("div", "veil");
  root.appendChild(veil);

  // ---------- レベルアップ帯 ----------
  const lvclip = el("div", "lvclip")                  ;
  const banner = el("div", "lvbanner", `<div class="tx"></div>`);
  lvclip.appendChild(banner);
  root.appendChild(lvclip);

  // ---------- Title ----------
  const title = el("div", "screen title")                  ;
  title.innerHTML = `
    <div class="title-logo">
      <div class="title-plate"><span data-t="title"></span></div>
      <div class="title-tag" data-t="blurb"></div>
    </div>
    <div class="mid">
      <div class="btnrow" id="titleBtns"></div>
    </div>
    <div class="langrow" data-langrow></div>
  `;
  root.appendChild(title);

  // ---------- Results ----------
  const results = el("div", "screen results")                  ;
  results.innerHTML = `
    <div class="go-plate" data-t="gameOver"></div>
    <div class="mid">
      <div id="newBestBadge" style="display:none" class="newbest-badge" data-t="newBest"></div>
      <div class="score-big"><label data-t="score"></label><b id="resScore">0</b></div>
      <div class="best-line"><span data-t="best"></span>: <b id="resBest">0</b></div>
      <div class="btnrow">
        <button class="btn accent" data-act="restart" data-t="restart"></button>
        <button class="btn light" data-act="home" data-t="home"></button>
      </div>
    </div>
    <div class="langrow" data-langrow></div>
  `;
  root.appendChild(results);

  // ---------- Pause ----------
  const pause = el("div", "screen pause")                  ;
  pause.innerHTML = `
    <div class="pause-plate" data-t="pause"></div>
    <div class="mid">
      <div class="btnrow">
        <button class="btn calm" data-act="resume" data-t="resume"></button>
        <button class="btn accent" data-act="restart" data-t="restart"></button>
        <button class="btn light" id="btnMuteRow"></button>
        <button class="btn light" data-act="home" data-t="home"></button>
      </div>
    </div>
    <div class="langrow" data-langrow></div>
  `;
  root.appendChild(pause);

  const muteRow = pause.querySelector("#btnMuteRow")                     ;

  // ★ 排行榜整块删掉了：原版的 `topScores` / `openProfile` 走的是 MakePlay 的账号体系，
  //   宿主里没有账号、没有云存档 ⇒ 留着就是「点了必然空列表」的按钮。
  const screens                              = { title, results, pause };

  function show(name                               ) {
    for (const k of Object.keys(screens)) screens[k].classList.remove("on");
    veil.classList.toggle("on", name !== "game" && name !== "title");
    hud.classList.toggle("on", name === "game");
    banner.classList.remove("run");
    if (name === "game") {
      uiMode = "game";
      return;
    }
    (screens       )[name].classList.add("on");
    uiMode = name       ;
    if (name === "title") buildTitleButtons();
    if (name === "pause") refreshMuteRow();
  }

  // 言語切替ボタン（ネイティブ名で直接選択）
  function buildLangRows() {
    const langs                     = [["ja", "日本語"], ["zh", "中文"], ["en", "English"]];
    root.querySelectorAll("[data-langrow]").forEach(row => {
      const cont = row               ;
      cont.innerHTML = "";
      for (const [k, name] of langs) {
        const b = el("button", "langbtn", name)                     ;
        b.setAttribute("aria-label", `language: ${name}`);
        b.setAttribute("aria-pressed", api.langKey() === k ? "true" : "false");
        if (api.langKey() === k) b.classList.add("active");
        b.addEventListener("pointerdown", ev => {
          ev.stopPropagation();
          api.playTap();
          api.setLang(k);
          refreshTexts();
          buildLangRows();
          buildTitleButtons();
          refreshMuteRow();
        });
        cont.appendChild(b);
      }
    });
  }

  function refreshTexts() {
    const T = api.T();
    root.querySelectorAll("[data-t]").forEach(n => {
      const k = (n               ).dataset.t          ;
      if (T[k]) (n               ).textContent = T[k];
    });
    updateHud();
  }

  /**
   * 开局按钮 —— 先等收费闸门（`api.startNewRun` / `api.restartRun` 返回 false 就停在原界面）。
   * ★ 不能「先 show("game") 再扣分」：扣不到的时候玩家已经站在游戏里了。
   */
  const beginAndShow = async (fn) => {
    const ok = await fn();
    if (ok === false) return;
    show("game");
    updateHud();
  };

  function buildTitleButtons() {
    const cont = title.querySelector("#titleBtns")               ;
    cont.innerHTML = "";
    const T = api.T();
    const st = api.getState();
    if (st.hasResume) {
      const b = makeBtn(T.continueRun, "btn calm");
      b.addEventListener("pointerdown", ev => { ev.stopPropagation(); api.playTap(); api.continueRun(); show("game"); updateHud(); });
      cont.appendChild(b);
      const b2 = makeBtn(T.play, "btn accent");
      b2.addEventListener("pointerdown", ev => { ev.stopPropagation(); api.playTap(); void beginAndShow(api.startNewRun); });
      cont.appendChild(b2);
    } else {
      const b = makeBtn(T.play, "btn accent");
      b.addEventListener("pointerdown", ev => { ev.stopPropagation(); api.playTap(); void beginAndShow(api.startNewRun); });
      cont.appendChild(b);
    }
  }
  function makeBtn(label        , cls        ) {
    const b = el("button", cls, label)                     ;
    return b;
  }

  function refreshMuteRow() {
    const T = api.T();
    const st = api.getState();
    muteRow.textContent = `${T.sound}: ${st.muted ? "✕" : "♪"}`;
  }
  muteRow.addEventListener("pointerdown", ev => {
    ev.stopPropagation();
    const muted = api.toggleMute();
    soundImg.src = muted ? icon("audioOff") : icon("audioOn");
    api.playTap();
    refreshMuteRow();
  });

  // 結果画面ボタン
  results.querySelectorAll("[data-act]").forEach(n => {
    const b = n                     ;
    const act = b.dataset.act ;
    b.addEventListener("pointerdown", ev => {
      ev.stopPropagation();
      api.playTap();
      if (act === "restart") { void beginAndShow(api.restartRun); }
      if (act === "home") { api.home(); show("title"); }
    });
  });
  // ポーズ画面ボタン
  pause.querySelectorAll("[data-act]").forEach(n => {
    const b = n                     ;
    const act = b.dataset.act ;
    b.addEventListener("pointerdown", ev => {
      ev.stopPropagation();
      api.playTap();
      if (act === "resume") { api.resumeGame(); show("game"); }
      if (act === "restart") { void beginAndShow(api.restartRun); }
      if (act === "home") { api.home(); show("title"); }
    });
  });

  function updateHud() {
    const st = api.getState();
    (hud.querySelector("#hudScore")               ).textContent = String(st.score);
    (hud.querySelector("#hudLevel")               ).textContent = String(st.level);
    (hud.querySelector("#hudBest")               ).textContent = String(st.best);
    comboBadge.textContent = `×${st.combo}`;
    comboBadge.classList.toggle("on", st.combo >= 2);
    lastCombo = st.combo;
    hintEl.style.display = st.stacked === 0 ? "" : "none";
  }

  // 外部フック
  const hooks = {
    showTitle() { show("title"); },
    showGame() { show("game"); updateHud(); },
    onScore() { updateHud(); },
    onLevelUp(level        ) {
      const T = api.T();
      banner.querySelector(".tx") .textContent = `${T.levelUp} Lv.${level}`;
      banner.classList.remove("run");
      void banner.offsetWidth; // 再トリガー
      banner.classList.add("run");
      updateHud();
    },
    onGameOver(isNewBest         ) {
      const st = api.getState();
      (results.querySelector("#resScore")               ).textContent = String(st.score);
      (results.querySelector("#resBest")               ).textContent = String(st.best);
      (results.querySelector("#newBestBadge")               ).style.display = isNewBest ? "" : "none";
      // ★ 这个 750ms 是「让玩家看完塔倒」的延时。卸载后它还会响一次，
      //   那时 `fx` / `app` 已经销毁 ⇒ 必须记住 timer 并在 destroy 里清掉。
      gameOverTimer = setTimeout(() => {
        gameOverTimer = 0;
        if (disposed) return;
        if (api.getState().mode === 2) { show("results"); if (isNewBest) api.fxConfetti(); }
      }, 750);
    },
    uiMode: () => uiMode,
    /** 卸载：摘掉 head 里的样式表与容器里的 DOM，否则宿主的 `.btn` 会一直被这份样式影响 */
    destroy() {
      disposed = true;
      if (gameOverTimer) { clearTimeout(gameOverTimer); gameOverTimer = 0; }
      try { style.remove(); } catch { /* 已被移除 */ }
      try { root.remove(); } catch { /* 已被移除 */ }
    },
  };

  buildLangRows();
  refreshTexts();
  updateHud();
  return hooks;
}
