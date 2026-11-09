/**
 * world-board.js —— 「世界排行榜」弹层。
 *
 * ## 插件里的处理：**留着代码，藏掉入口**
 *
 * 它要三样在离线 App 里不成立的东西：登录（`gp.player.user`）、服务端房间
 * （`archive.board()` 走 `gp.room`）、以及把玩家画的马和名字传上去。
 * 所以 `archive` 换成了恒离线的 `createOfflineArchive`，入口按钮在
 * `game.js` 里 `hidden=true` —— 用户看不到一个点进去只会报错的按钮。
 *
 * ## 改了什么
 *
 * 1. **裸全局 `gp` → `import { gp }`**。原版这文件里 `gp.player.user` /
 *    `gp.player.requestLogin()` 用的是**没 import 的全局**，靠 `platform.js`
 *    偷偷写 `window.gp` 兜着。插件里不许留全局，所以改成显式导入。
 * 2. **`dispose()`**。原来挂了一个**捕获阶段**的 `window` keydown（还带
 *    `stopImmediatePropagation`）和一个 `ResizeObserver`，卸载后全都还活着 ——
 *    症状是「切走以后按 Esc 还会被这个已经看不见的弹层吃掉」。
 */
import { uniqueBoardRows } from './board-rows.js';
import { getLanguage } from './i18n.js';
import { encodeActions } from './replay-codec.js';
import { gp } from './platform.js';

export const scoreRace=(distance,time)=>Number.isFinite(distance)&&Number.isFinite(time)&&distance>0&&time>0?Math.max(1,Math.floor(distance/time*1000)):0;

export function createWorldBoard({t,onOpen,onClose,archive,getMode,legacyNames}){
 const $=id=>document.getElementById(id),overlay=$('world-board-overlay'),rows=$('world-board-rows');
 let boardMode='classic',loadSerial=0;
 let entries=[],status='',busy=false,opener=null,submission=null;const submitted=new WeakSet();
 const timeout=async task=>{let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),10000);})]);}finally{clearTimeout(timer);}};
 const scroller=$('world-board-scroll');
 function updateVisibleRows(){if(overlay.hidden)return;const clip=scroller.getBoundingClientRect();for(const row of rows.children){const r=row.getBoundingClientRect();row.style.visibility=r.bottom>clip.top&&r.top<clip.bottom&&r.top>=0&&r.bottom<=innerHeight?'visible':'hidden';}}
 const onScroll=updateVisibleRows;
 scroller.addEventListener('scroll',onScroll,{passive:true});
 const ro=new ResizeObserver(updateVisibleRows);ro.observe(scroller);
 function refreshTexts(){
  for(const m of ['classic','chaos'])$('board-'+m).setAttribute('aria-pressed',m===boardMode);
  $('world-board-status').textContent=status?t(status):'';$('world-board-refresh').disabled=busy;
  $('world-board-guest').hidden=$('world-board-login').hidden=!!gp.player.user;
  rows.replaceChildren(...entries.map((entry,i)=>{const row=document.createElement('li');row.classList.toggle('is-me',!!entry.isMe);const rank=document.createElement('b'),name=document.createElement('span'),score=document.createElement('strong');rank.textContent=String(i+1).padStart(2,'0');name.textContent=(legacyNames.display(entry.name,entry.names,getLanguage())||t('worldPlayer'))+(entry.isMe?' · '+t('you'):'');name.title=entry.name;score.textContent=String(Math.round(entry.score));name.title=[entry.name,entry.player].filter(Boolean).join(' · ');row.append(rank,name,score);return row;}));
  updateVisibleRows();
  $('world-submit').textContent=submission?submission.key==='worldSent'?t('worldSent',submission)+(submission.rank?' · '+t('worldRank',submission):''):t(submission.key):'';
 }
 async function load(){const serial=++loadSerial;busy=true;status='worldLoading';entries=[];scroller.scrollTop=0;refreshTexts();try{const result=await archive.board(boardMode);if(serial!==loadSerial)return;if(!result.ok)throw Error('Unavailable');entries=uniqueBoardRows(result.rows);for(const entry of entries)legacyNames.request(entry.name,entry.names);status=entries.length?'':'worldEmpty';}catch{if(serial!==loadSerial)return;entries=[];status='worldError';}finally{if(serial===loadSerial){busy=false;refreshTexts();}}}
 for(const m of ['classic','chaos'])$('board-'+m).onclick=()=>{boardMode=m;void load();};
 function close(){if(overlay.hidden)return;overlay.hidden=true;onClose();opener?.focus();}
 function open(event){boardMode=getMode();opener=event?.currentTarget||document.activeElement;onOpen();overlay.hidden=false;$('world-board-close').focus();void load();}
 for(const id of ['world-board-open','world-board-result'])$(id).onclick=open;
 $('world-board-close').onclick=close;$('world-board-refresh').onclick=()=>void load();$('world-board-login').onclick=()=>gp.player.requestLogin();
 const onOverlayDown=e=>{e.stopPropagation();if(e.target===overlay)close();};
 overlay.addEventListener('pointerdown',onOverlayDown);
 /* ★ 捕获阶段 + `stopImmediatePropagation`：弹层打开时要**独占**键盘，否则 Space
    会同时触发赛道的跳跃。必须能摘掉（`dispose`）。 */
 function onKey(e){if(overlay.hidden)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){const list=[...overlay.querySelectorAll('button')].filter(b=>!b.hidden&&!b.disabled);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 window.addEventListener('keydown',onKey,true);
 async function submit(race){if(submitted.has(race)||!race.finished)return;submitted.add(race);const entry={key:race.archiveRun?'worldSending':'archivePractice'};submission=entry;refreshTexts();if(!race.archiveRun)return;const result=await archive.upload({m:race.mode,d:race.drawing,n:race.horseName,l:race.horseNames,r:[1,encodeActions(race.inputs)]});if(result.ok)Object.assign(entry,{key:'worldSent',...result});else entry.key=result.error==='full'?'archiveFull':'worldOffline';refreshTexts();}
 return {submit,refreshTexts,get isOpen(){return !overlay.hidden;},inspect:()=>({open:!overlay.hidden,status,busy,entries:entries.map(e=>({...e})),submission:submission?{...submission}:null}),dispose(){window.removeEventListener('keydown',onKey,true);scroller.removeEventListener('scroll',onScroll);try{ro.disconnect();}catch{}}};
}
