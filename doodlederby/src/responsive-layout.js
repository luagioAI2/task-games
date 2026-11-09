/**
 * responsive-layout.js —— 那套「紧凑 / 短屏 / 窄屏 / 竖屏」的排版开关。
 *
 * ## 插件里改了三处（每一处不改都会静默错位）
 *
 * 1. **量的是宿主给的容器，不是视口、也不是自己**。原来 `w/h` 取 `visualViewport` /
 *    `innerWidth`，原版是整页应用所以两者相等。插件里容器比视口**矮一整个顶栏 + 底栏**。
 *    ★ 但也不能退回去量 `root` —— `#dd-app` 的高度**正是这个函数写进去的**
 *    （`height:var(--window-h,100dvh)`），量它自己是循环，会永远停在 `100dvh`。
 *    症状：挂载根比容器高 146px，底部的「03 送它去比赛」被裁掉，手指点不到，
 *    而 `.click()` 照样能点 ⇒ 只测点击的 e2e 全绿。
 * 2. **属性写在挂载根上**（`root.dataset`），不是 `document.body`。
 *    `tiny-layout.css` 那 40 多条 `body[data-compact][data-studio-tab=…]` 规则
 *    已经跟着改成 `#dd-app[data-…]`（见 `scripts/gen-styles.mjs`）。
 * 3. **`dispose()`**：4 个 ResizeObserver + 4 个全局监听，卸载后全得摘掉。
 *    漏掉的话，切走再切回来每份都还活着，`layout()` 会拿**已卸载的节点**
 *    去量尺寸（`getBoundingClientRect()` 全 0）并把 `--header-h` 写成 `0px`。
 */
export function mountResponsiveLayout({app,root,host,onResize}){
 let queued=false;const $=id=>document.getElementById(id),measure=document.createElement('canvas').getContext('2d');
 function fit(el,max){if(!el||!el.dataset.fullText)return;const s=getComputedStyle(el);measure.font=s.font;const full=el.dataset.fullText;el.title=full;let chars=Array.from(full);while(chars.length&&measure.measureText(chars.join('')+'…').width>max)chars.pop();el.textContent=measure.measureText(full).width<=max?full:chars.join('')+'…';}
 function layout(){
  queued=false;
  /*
   * ★★ 量**宿主给的容器**，不能量 `root` 自己。
   *
   * `#dd-app` 的 CSS 是 `height:var(--window-h,100dvh);width:var(--window-w,100vw)` ——
   * 也就是说**它的高度由这个函数写进去的变量决定**。量它自己是循环：
   * 第一次读到 `100dvh`（手机 844），写回 `--window-h:844px`，以后永远 844。
   * 在宿主里容器只有 698（视口减掉顶栏 + 底栏）⇒ 挂载根比容器高 146px ⇒
   * **「03 送它去比赛」被裁在容器外面**，手指根本点不到（`.click()` 能点，
   * 所以只测「点了有没有反应」的 e2e 会全绿）。真机症状：参赛页下面什么都没有。
   */
  const frame=host&&host.isConnected?host:root;
  const box=frame.getBoundingClientRect(),vv=window.visualViewport;
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
 const observer=new ResizeObserver(schedule);for(const el of [host??app,$('drawing-tutorial'),root.querySelector('.race-top'),root.querySelector('.race-controls')]){if(el)observer.observe(el)}
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
