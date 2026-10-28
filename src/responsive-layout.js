/**
 * responsive-layout.js —— 那套「紧凑 / 短屏 / 窄屏 / 竖屏」的排版开关。
 *
 * ## 插件里改了三处（每一处不改都会静默错位）
 *
 * 1. **量的是容器，不是视口**。原来 `w/h` 取 `visualViewport` / `innerWidth`，
 *    原版是整页应用所以两者相等。插件里容器比视口**矮一整个顶栏 + 底栏** ——
 *    继续用视口值的话：`--window-h` 会写大，`compact`/`portrait` 判错，
 *    而症状是「手机上预览面板被底栏压住」这种，报错为零。
 * 2. **属性写在挂载根上**（`root.dataset`），不是 `document.body`。
 *    `tiny-layout.css` 那 40 多条 `body[data-compact][data-studio-tab=…]` 规则
 *    已经跟着改成 `#dd-app[data-…]`（见 `scripts/gen-styles.mjs`）。
 * 3. **`dispose()`**：4 个 ResizeObserver + 4 个全局监听，卸载后全得摘掉。
 *    漏掉的话，切走再切回来每份都还活着，`layout()` 会拿**已卸载的节点**
 *    去量尺寸（`getBoundingClientRect()` 全 0）并把 `--header-h` 写成 `0px`。
 */
export function mountResponsiveLayout({app,root,onResize}){
 let queued=false;const $=id=>document.getElementById(id),measure=document.createElement('canvas').getContext('2d');
 function fit(el,max){if(!el||!el.dataset.fullText)return;const s=getComputedStyle(el);measure.font=s.font;const full=el.dataset.fullText;el.title=full;let chars=Array.from(full);while(chars.length&&measure.measureText(chars.join('')+'…').width>max)chars.pop();el.textContent=measure.measureText(full).width<=max?full:chars.join('')+'…';}
 function layout(){
  queued=false;
  // ★ 容器尺寸优先；量不到（还没布局）才退回视口
  const box=root.getBoundingClientRect(),vv=window.visualViewport;
  const w=Math.round(box.width)||Math.round(vv?.width||innerWidth);
  const h=Math.round(box.height)||Math.round(vv?.height||innerHeight);
  root.style.setProperty('--window-h',h+'px');root.style.setProperty('--window-w',w+'px');
  const compact=h>w||(w<1000&&h<540)||w<760;
  root.dataset.compact=String(compact);
  root.dataset.short=String(h<560);
  root.dataset.narrow=String(w<760);
  root.dataset.portrait=String(h>w);
  const header=root.querySelector('.topbar').getBoundingClientRect();
  root.style.setProperty('--header-h',header.height+'px');
  onResize();
  const top=root.querySelector('.race-top'),score=root.querySelector('.score-strip'),stand=$('leaderboard'),controls=root.querySelector('.race-controls');
  if(!$('race-screen').hidden){const topH=top.getBoundingClientRect().height;score.style.top=(topH+20)+'px';stand.style.top=(h>w?topH+score.getBoundingClientRect().height+28:topH+20)+'px';const smallGrid=h>w||h<380;const bound=smallGrid?Math.max(40,(stand.clientWidth-58)/2):Math.max(80,Math.min(w*.26,310)-44);stand.querySelectorAll('span').forEach(el=>fit(el,Math.min(bound,el.clientWidth)-6));fit($('race-name'),Math.max(40,root.querySelector('.race-heading').clientWidth-6));const available=controls.getBoundingClientRect().top-stand.getBoundingClientRect().top-8;stand.style.maxHeight=Math.max(40,available)+'px';}
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(layout);}
 const observer=new ResizeObserver(schedule);for(const el of [app,$('drawing-tutorial'),root.querySelector('.race-top'),root.querySelector('.race-controls')])observer.observe(el);
 const onWinResize=schedule;
 window.addEventListener('resize',onWinResize);window.visualViewport?.addEventListener('resize',onWinResize);
 const onFocus=schedule;document.addEventListener('focusin',onFocus);document.addEventListener('focusout',onFocus);
 schedule();
 return {schedule,dispose(){
  try{observer.disconnect();}catch{}
  window.removeEventListener('resize',onWinResize);window.visualViewport?.removeEventListener('resize',onWinResize);
  document.removeEventListener('focusin',onFocus);document.removeEventListener('focusout',onFocus);
 }};
}
