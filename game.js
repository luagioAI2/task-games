import { AB } from './base.js';
import { SCOPED_CSS } from './src/styles.gen.js';
import { mountResponsiveLayout } from './src/responsive-layout.js';
import { createLegacyNameTranslator } from './src/legacy-name-translator.js';
import { compactHorseNames } from './src/horse-names.js';
import { createTutorial } from './src/tutorial.js';
import { gp } from './src/platform.js';
import { createOfflineArchive } from './src/offline-archive.js';
import { encodeDrawing, decodeDrawing } from './src/replay-codec.js';
import { DrawingBoard, COLORS, preset, sanitizeStrokes, drawingTraits, TRAIT_MAX } from './src/drawing.js';
import { World } from './src/scene.js';
import { Race, STEP } from './src/race.js';
import { DerbySound } from './src/audio.js';
import { mountLanguageMenu } from './src/language-menu.js';
import { createUI } from './src/ui.js';
import { LANGUAGES, t, setLanguage, getLanguage, localize } from './src/i18n.js';
import { NAME_TABLE, PRESET_NAMES, localizedName, randomNames } from './src/names.js';
import { compactDrawing, encodeSave, decodeSave } from './src/save.js';
import { TRAIT_KEYS, EMPHASIS } from './src/traits.js';
import { renderRadar } from './src/trait-ui.js';
import { createWorldBoard } from './src/world-board.js';
import { createNameRoller } from './src/ai-names.js';
import { CustomName } from './src/custom-name.js';

/**
 * 宿主入口。独立网页（`index.html`）和插件（`plugin.js`）调的是**同一个函数**，
 * 差别全部通过 `opts` 注入 —— 这里没有 `if (isPlugin)` 分支。
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container 挂载容器（宿主给的那一格 / 独立网页的 `#app`）
 * @param {{getLatest:()=>Promise<any>, putLatest:(s:string)=>Promise<any>}} [opts.store] 存档适配层
 * @param {()=>Promise<boolean>} [opts.chargePlay] 开赛收费；返回 `false` 表示余额不足、不要开
 * @returns {Promise<() => Promise<void>|void>} 卸载函数
 */
export async function start(opts = {}) {
const { container: mountContainer, chargePlay } = opts;
if (!mountContainer) throw new Error('doodlederby.start(): 缺少 opts.container');

/**
 * 存档适配层。
 *
 * 插件里由 `plugin.js` 传宿主的 `host.storage`；独立网页没有宿主，
 * 退回 `localStorage`（否则 `putLatest` 恒 false ⇒ 界面上常驻一行
 * 「同步暂未成功 · 将重试」，看着像坏了，其实只是没地方存）。
 *
 * ★ 两个方法**必须真的返回 Promise**：调用处有 `.then()`。写成同步返回
 *   会在存档时静默丢档（可选链只挡 nullish，挡不住「返回了 undefined」）。
 */
const store = opts.store ?? {
  getLatest: async () => { try { return localStorage.getItem('doodlederby.save'); } catch { return null; } },
  putLatest: async (text) => { try { localStorage.setItem('doodlederby.save', text); return true; } catch { return false; } },
};

/*
 * 挂载根：宿主容器里再套一层。
 *
 * 它同时是**定位上下文**（样式里那 7 处 `position:fixed` 已改成 `absolute`）
 * 与**样式作用域**（`#dd-app`，见 `scripts/gen-styles.mjs`）。
 * `isolation:isolate` 让它自己成为一个层叠上下文 —— 否则内部 `z-index:50` 的
 * 结算弹层会跑到宿主底栏上面去（`overflow:hidden` 只管裁切，不管层叠）。
 */
const mountRoot=document.createElement('div');
mountRoot.id='dd-app';
mountRoot.className='dd-root';
mountRoot.style.cssText='position:absolute;inset:0;overflow:hidden;isolation:isolate;';
mountContainer.appendChild(mountRoot);

/** 监听器 / 观察者登记表。原版全是裸 `addEventListener`，卸载后一条都不摘。 */
const offs=[];
const winOn=(type,fn,o)=>{window.addEventListener(type,fn,o);offs.push(()=>window.removeEventListener(type,fn,o));};
const docOn=(type,fn,o)=>{document.addEventListener(type,fn,o);offs.push(()=>document.removeEventListener(type,fn,o));};
const rootOn=(type,fn,o)=>{mountRoot.addEventListener(type,fn,o);offs.push(()=>mountRoot.removeEventListener(type,fn,o));};
const observers=[];
let rafId=0,dead=false;
const uiTokens={background:'#f5f2e9',text:'#263b2f',accent:'#e7663e',green:'#315f48',line:'#dddcd0'};
for(const [key,value] of Object.entries(uiTokens))mountRoot.style.setProperty('--doodle-'+key,value);
/*
 * 样式：七份 CSS 在**构建期**就收进 `#dd-app` 了（`scripts/gen-styles.mjs`）。
 *
 * ★ 不能再用 `<link>` 挂到 `document.head`：那份 CSS 的 `:root` 会改掉宿主整页的
 *   字体与配色、`*` / `button` / `[hidden]` 会命中宿主全部元素，而游戏自己看着完全正常。
 * ★ 也不能运行时 `fetch`：漏一个文件不会报错，只会让整套样式一条都不命中（界面隐形）。
 */
const styleEl=document.createElement('style');
styleEl.dataset.game='doodlederby';
/*
 * ★ `__AB__` 是构建期留的占位：CSS 里的 `url('./assets/…')` 原来相对**样式表**，
 *   内联进 `<style>` 之后会相对**文档** ⇒ 插件里打到宿主根，三个图标 404 而不报错。
 *
 * ★ 注入到**挂载根里**，不是 `document.head`：`<style>` 放在哪儿都作用于整篇文档，
 *   但挂在根里 ⇒ 卸载时 `mountRoot.remove()` 顺手带走，不会在宿主 head 里留垃圾，
 *   也就不用往宿主 head 里 append 任何东西。
 *
 * ★★ 但**必须等 `createUI(app)` 之后再 append** —— 它里面是 `app.innerHTML = \`…\``，
 *   会把挂载根的子节点全换掉。先 append 的话 `<style>` 当场被丢掉：
 *   **整套 CSS 一条都不生效、零报错、pageerror 0**，画面是一坨没有样式的原始 HTML。
 *   2026-10-28 实测踩过（`smoke.mjs` 判「颜色种类 ≥ 20」照样绿 —— 未样式化的
 *   HTML 也有文字和图标）。所以这里只建不挂，挂的动作在 `createUI` 之后。
 */
styleEl.textContent=SCOPED_CSS.replaceAll('__AB__',AB);
const rawSave=store?await store.getLatest():gp.player.saves.latestSync;
const restored=rawSave==null?null:decodeSave(rawSave),saved=restored||{};
const saveBlocked=rawSave!=null&&!restored;
const locale=(navigator.language||'zh').slice(0,2);
setLanguage(LANGUAGES.includes(saved.language)?saved.language:LANGUAGES.includes(locale)?locale:'zh');
const $=id=>document.getElementById(id),$q=sel=>mountRoot.querySelector(sel),app=mountRoot,audio=new DerbySound();createUI(app);
/* ★ 样式必须在 `createUI(app)` **之后**挂：它里面是 `app.innerHTML = …`，
   会把挂载根的子节点全换掉 —— 先挂的话 `<style>` 当场被丢掉，
   整套 CSS 一条都不生效而**零报错**（画面是没有样式的原始 HTML）。 */
mountRoot.appendChild(styleEl);
localize(app);
const languageMenu=mountLanguageMenu($q('.language-control'),$('language'),mountRoot);
let state='studio',mode='classic',race=null,paused=false,accumulator=0,last=0,adoption=0,lastCount=-4;
let portrait=innerHeight>innerWidth,studioTab='draw',feedback={key:'rhythmIdle'},calloutMessage=null,toastMessage=null,calloutTimer,toastTimer;
let boardPaused=false;
let responsiveLayout=null;
let tutorial=null;let guide=restored?(saved.guide??5):0;
let matching=false,startSerial=0;
const archive=createOfflineArchive(()=>renderArchive());
function renderArchive(){const el=$('archive-status');if(el){const info=archive.inspect();el.textContent=t(archive.status)+(info.rtt!==null?' · '+info.rtt+' ms':'');}}
const legacyNames=createLegacyNameTranslator(()=>{worldBoard.refreshTexts();renderNames();if(state==='result')renderResult();});
const worldBoard=createWorldBoard({t,archive,legacyNames,getMode:()=>mode,onOpen:()=>{boardPaused=paused;if(state==='race')pause(true);},onClose:()=>{if(state==='race'&&!boardPaused&&!document.hidden)pause(false);}});
let nameId=restored?saved.nameId:null;
const nameRoller=createNameRoller(opts=>gp.ai.chat(opts));
let nameRollBusy=false;
function currentNameRow(){return nameId?Object.fromEntries(['zh','en','ja'].map((k,i)=>[k,NAME_TABLE[nameId][i]])):Object.fromEntries(['zh','en','ja'].map(k=>[k,customName.display(k)]));}
let drawingData=0,booting=true,saveSerial=0,saveStatus=saveBlocked?'saveProtected':'saveAuto';
const customName=new CustomName(saved.custom,()=>{if(nameId)return;$('horse-name').value=currentName();renderNames();if(state==='result')renderResult();save();},key=>{if($('name-status'))$('name-status').textContent=t(key);});
audio.muted=!!saved.muted;
let opponents=PRESET_NAMES.slice(1);
let records=Array.isArray(saved.records)?saved.records.filter(r=>r&&Number.isFinite(r.time)&&['classic','chaos'].includes(r.mode)).slice(0,20):[];
function currentName(){return nameId?localizedName(nameId,getLanguage()):customName.display(getLanguage()).trim();}
function nameExclusions(){return Object.keys(NAME_TABLE).filter(id=>id===nameId||localizedName(id,getLanguage())===currentName());}
function names(){return [currentName(),...opponents.map((id,i)=>{const ghost=race?.replays?.[i];return ghost?legacyNames.display(ghost.n,ghost.l,getLanguage())+' · '+t('replayTag'):localizedName(id,getLanguage())+' · '+t('botTag');})];}
function snapshot(){return encodeSave({drawing:drawingData,nameId,custom:customName.value,language:getLanguage(),records,muted:audio.muted,guide:tutorial?.step??guide});}
function showSaveStatus(key){saveStatus=key;if($('save-status'))$('save-status').textContent=t(key);}
function save(){
  if(booting||saveBlocked)return;
  const serial=++saveSerial;showSaveStatus('saveSaving');
  /* ★ 存档走 `store`（宿主的 `host.storage`）。原版走 `gp.player.saves.putLatest`，
     插件里那个桩恒返回 `false` ⇒ **一个字节都不落盘**，而界面上只有「保存失败」一行小字。 */
  const text=JSON.stringify(snapshot());
  const writing=store?store.putLatest(text):gp.player.saves.putLatest(text,'text');
  void Promise.resolve(writing).then(ok=>{if(serial!==saveSerial)return;showSaveStatus(ok?'saveGuest':'saveFailed');});
}
function messageText(message){return message?t(message.key,{...message.values,...(message.key==='nameRolled'?{name:currentName()}:{})}):'';}
function toast(key,values={}){toastMessage={key,values};$('toast').textContent=messageText(toastMessage);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').classList.remove('show');toastMessage=null;},2800);}
let world;
try{world=new World($('world'));}catch(error){app.textContent=t('webglError');throw error;}
const board=new DrawingBoard($('drawing'),strokes=>{
  $('stroke-count').textContent=t('strokes',{n:strokes.length});$('empty-hint').hidden=strokes.length>0;
  $('start').disabled=$('clear').disabled=$('undo').disabled=!strokes.length;
  drawingData=compactDrawing(strokes);world.preview(strokes);renderTraits();tutorial?.update();save();
},toast);
$('horse-name').value=currentName();
board.set(Array.isArray(saved.strokes)?saved.strokes:[]);
tutorial=createTutorial({step:guide,t,getStrokes:()=>board.strokes,getName:currentName,onChange:()=>save(),onName:()=>{setStudioTab('entry');$('horse-name').focus();},onDraw:()=>setStudioTab('draw'),onEntry:()=>setStudioTab('entry'),root:mountRoot});tutorial.render();
booting=false;
if(restored&&!saveBlocked)save();
$('horse-name').addEventListener('input',()=>{nameId=null;customName.edit($('horse-name').value,getLanguage());renderNames();tutorial?.update();save();});
$('horse-name').addEventListener('change',()=>{if(!nameId)void customName.translate();});
$('horse-name').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();$('horse-name').blur();if(!nameId)void customName.translate();}});
$('name-status').onclick=()=>{if(!nameId)void customName.translate();};
$('rename').onclick=async()=>{
 if(nameRollBusy)return;
 nameRollBusy=true;const button=$('rename');button.disabled=true;button.setAttribute('aria-busy','true');
 customName.cancel();const version=customName.version;nameRoller.remember(currentNameRow());toast('nameGenerating');
 try{const result=await nameRoller.next();if(customName.version!==version||state!=='studio'||matching)return;
  customName.cancel();nameId=result.id;if(!nameId)customName.value={source:result.row[getLanguage()],lang:getLanguage(),ready:true,translations:result.row};
  $('horse-name').value=currentName();renderNames();tutorial?.update();save();toast('nameRolled');
 }finally{nameRollBusy=false;button.disabled=false;button.setAttribute('aria-busy','false');}
};
$('undo').onclick=()=>board.undo();$('clear').onclick=()=>board.clear();
mountRoot.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{board.color=b.dataset.color;mountRoot.querySelectorAll('[data-color]').forEach(el=>{const yes=el===b;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});});
$('adopt').onclick=()=>{
  startSerial++;matching=false;nameRoller.remember(currentNameRow());nameId=null;customName.edit('',getLanguage());
  $('horse-name').value='';renderNames();
  const p=preset(adoption++);board.set(p.strokes);toast('adopted');
};
function renderTraits(){
  const values=drawingTraits(board.strokes);$('traits').hidden=false;
  $('trait-focus').textContent=t(mode==='classic'?'focusClassic':'focusChaos');
  if(!portrait)renderRadar($('trait-radar'),values,mode,t);else $('trait-radar').replaceChildren();
  $('traits').replaceChildren(...TRAIT_KEYS.map(key=>{const el=document.createElement('span');el.classList.toggle('focus',EMPHASIS[mode].includes(key));el.title=t(key+'Help');const label=document.createElement('span');label.textContent=t(key);const value=document.createElement('b');value.textContent=values[key];const bar=document.createElement('i');bar.style.width=(values[key]/TRAIT_MAX*100)+'%';el.append(label,value,bar);return el;}));
  const note=document.createElement('small');note.textContent=t('traitNote',{max:TRAIT_MAX});$('traits').append(note);
}
function renderBest(){const times=records.filter(r=>r.mode===mode).map(r=>r.time);$('best').textContent=times.length?t('best',{time:Math.min(...times).toFixed(2)}):t('bestEmpty');}
function renderMode(){
  for(const id of ['classic','chaos']){$(id).classList.toggle('selected',id===mode);$(id).setAttribute('aria-pressed',id===mode);}
  $('mode-copy').textContent=t(mode+(portrait?'Touch':'Copy'));$q('.entry-foot').textContent=t(mode+'Foot');renderTraits();renderBest();
}
function chooseMode(value){mode=value;renderMode();}
$('classic').onclick=()=>chooseMode('classic');$('chaos').onclick=()=>chooseMode('chaos');
function positionWorld(){
  $q('.paper').style.setProperty('--paper-width',Math.min($q('.paper').clientWidth,$q('.paper').clientHeight*1.6)+'px');
  $q('.paper').style.setProperty('--paper-height',Math.min($q('.paper').clientHeight,$q('.paper').clientWidth/1.6)+'px');
  const r=(state==='studio'?$('preview-slot'):$('race-slot')).getBoundingClientRect();
  $('world').hidden=r.width<1||r.height<1;
  /* ★ `#world` 是 `position:absolute`（样式里把 7 处 fixed 全改了）⇒ 坐标必须换成
     **相对挂载根**的。`getBoundingClientRect()` 给的是视口坐标，不减这一段的话
     整块 3D 画布会按宿主顶栏的高度往下偏。 */
  const base=mountRoot.getBoundingClientRect();
  Object.assign($('world').style,{left:(r.left-base.left)+'px',top:(r.top-base.top)+'px',width:r.width+'px',height:r.height+'px'});
}
function setStudioTab(tab){studioTab=tab;mountRoot.dataset.studioTab=tab;$('draw-tab').setAttribute('aria-pressed',tab==='draw');$('preview-tab').setAttribute('aria-pressed',tab==='preview');$('entry-tab').setAttribute('aria-pressed',tab==='entry');positionWorld();responsiveLayout?.schedule();}
$('draw-tab').onclick=()=>setStudioTab('draw');$('preview-tab').onclick=()=>setStudioTab('preview');$('entry-tab').onclick=()=>setStudioTab('entry');
function renderFeedback(){
  const entry=feedback.key==='rhythmIdle'?{key:portrait?'rhythmTouch':'rhythmIdle'}:feedback;
  $('rhythm-copy').textContent=messageText(entry);$('rhythm-copy').className=feedback.key==='hit'?'good':feedback.key==='miss'?'miss':'';
  $('race-callout').textContent=messageText(calloutMessage);$('toast').textContent=messageText(toastMessage);
}
function renderNames(){
  $('race-name').textContent=currentName();$('race-name').dataset.fullText=currentName();
  $('leaderboard').replaceChildren(...names().map((name,i)=>{const el=document.createElement('div');el.dataset.horse=i;const dot=document.createElement('i');dot.style.background=i===0?(board.strokes[0]?.color||COLORS[0]):COLORS[i];const title=document.createElement('span');title.textContent=(i===0?t('you')+' · ':'')+name;title.dataset.fullText=title.textContent;el.append(dot,title);return el;}));responsiveLayout?.schedule();
}
function applyLanguage(){
  localize(app);renderArchive();worldBoard.refreshTexts();$('language').value=getLanguage();languageMenu.sync();$('horse-name').value=currentName();$('horse-name').placeholder=t('namePlaceholder');
  $('name-status').textContent=t(nameId?'nameAuto':customName.status);showSaveStatus(saveStatus);
  $('stroke-count').textContent=t('strokes',{n:board.strokes.length});
  $('sound').setAttribute('aria-pressed',audio.muted);$('sound').setAttribute('aria-label',t(audio.muted?'unmute':'mute'));
  $('pause').textContent=t(paused?'continueShort':'pause');$('jump-key').textContent=t(portrait?'touch':'space');
  $('boost').querySelector('b').textContent=t(portrait?'boostTouch':'boost');
  renderMode();renderNames();renderFeedback();world.setWinnerLabel(t('winnersSign'));
  if(race){$('race-mode').textContent=t(mode==='classic'?'raceClassic':'raceChaos');updateHUD();if(state==='result')renderResult();}
  positionWorld();tutorial?.render();
}
let manualLanguage=!!saved.language;
$('language').onchange=()=>{manualLanguage=true;setLanguage($('language').value);applyLanguage();save();};
gp.player.ready.then(({user})=>{const lang=user?.locale?.slice(0,2);if(!manualLanguage&&LANGUAGES.includes(lang)){setLanguage(lang);applyLanguage();}});
function resize(){/* ★ 量**容器**，不量视口：插件容器比视口矮一整个顶栏 + 底栏，
     用视口判定的话横屏平板会被判成竖屏（整套紧凑布局错位，零报错）。 */
  const box=mountRoot.getBoundingClientRect();
  portrait=(Math.round(box.height)||(window.visualViewport?.height||innerHeight))>(Math.round(box.width)||(window.visualViewport?.width||innerWidth));renderMode();$('jump-key').textContent=t(portrait?'touch':'space');$('boost').querySelector('b').textContent=t(portrait?'boostTouch':'boost');renderFeedback();positionWorld();}
observers.push(new ResizeObserver(()=>{if(!portrait)renderRadar($('trait-radar'),drawingTraits(board.strokes),mode,t);}));observers.at(-1).observe($('trait-radar'));
observers.push(new ResizeObserver(positionWorld));observers.at(-1).observe(app);observers.push(new ResizeObserver(positionWorld));observers.at(-1).observe($q('.paper'));observers.push(new ResizeObserver(positionWorld));observers.at(-1).observe($('preview-slot'));winOn('resize',resize);winOn('scroll',positionWorld,{passive:true});
async function launchRace(){
  if(!board.strokes.length||matching)return;
  if(!currentName()){toast('nameRequired');$('horse-name').focus();return;}
  /* 收费点：**开赛那一刻**扣一次。画马 / 3D 预览 / 起名 / 选赛制全免费 ——
     那是这款游戏的核心乐趣，收钱等于收「进教室」的钱。
     扣款失败就原地不动（`chargePlay` 自己弹 toast），不进入比赛、不消耗什么。
     ★ 「再跑一场」（`#again`）走的是同一个函数 ⇒ 也收费，一局 10 分。 */
  if(chargePlay&&!(await chargePlay()))return;
  customName.cancel();
  const serial=++startSerial;matching=true;$('start').disabled=true;
  const drawing=encodeDrawing(board.strokes),raceStrokes=decodeDrawing(drawing),raceName=currentName(),raceNames=compactHorseNames(currentName(),currentNameRow()),raceMode=mode;
  const data=await archive.sample(raceMode);
  if(serial!==startSerial)return;matching=false;$('start').disabled=!board.strokes.length;
  if(!data.ok&&archive.inspect().connected){toast('archiveOffline');return;}
  const replays=data.ok?data.horses:[];for(const ghost of replays)legacyNames.request(ghost.n,ghost.l);mode=raceMode;tutorial?.finish();
  save();if(!nameId)void customName.translate();audio.clear();audio.unlock();audio.lastBeat=-1;race=new Race({mode,seed:Math.floor(Math.random()*0xffffffff),traits:drawingTraits(raceStrokes),strokes:raceStrokes,replays});race.drawing=drawing;race.horseName=raceName;race.horseNames=raceNames;race.archiveRun=data.ok;opponents=randomNames(3,nameExclusions());
  state='race';clearTimeout(toastTimer);toastMessage=null;$('toast').classList.remove('show');$('toast').textContent='';paused=false;accumulator=0;lastCount=-4;feedback={key:'rhythmIdle'};calloutMessage=null;
  $('studio').hidden=true;$('footer').hidden=true;$('race-screen').hidden=false;$('result-overlay').hidden=true;$('pause-overlay').hidden=true;
  $('race-mode').textContent=t(mode==='classic'?'raceClassic':'raceChaos');
  $('jump').hidden=mode!=='chaos';$('jump').disabled=false;$('boost').classList.add('inactive');$('show-results').hidden=true;$('pause').disabled=false;$('pause').textContent=t('pause');$('countdown').hidden=false;
  renderNames();renderFeedback();positionWorld();world.setMode('race',race,raceStrokes);renderArchive();updateHUD();
}
function studio(){startSerial++;matching=false;renderArchive();audio.clear();state='studio';paused=false;race=null;accumulator=0;$('race-screen').hidden=true;$('studio').hidden=false;$('footer').hidden=false;world.setMode('studio');renderBest();positionWorld();}
function callout(key,values={}){calloutMessage={key,values};renderFeedback();clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>{calloutMessage=null;renderFeedback();},1800);}
function cheer(){
  if(worldBoard.isOpen||paused||state!=='race')return;const result=race.cheer();
  if(result==='hit'){audio.play('hit');feedback={key:'hit',values:{combo:race.combo}};if(race.combo===3||race.combo%5===0)callout('comboCallout',{combo:race.combo});}
  else if(result==='miss'){audio.play('miss');feedback={key:'miss'};}
  renderFeedback();updateHUD();
}
function jump(){if(worldBoard.isOpen||paused||state!=='race')return;if(race.jump())audio.play('jump');}
function pause(force){if(state!=='race')return;paused=force??!paused;accumulator=0;$('pause-overlay').hidden=!paused;$('pause').textContent=t(paused?'continueShort':'pause');}
$('start').onclick=()=>void launchRace();$('again').onclick=()=>void launchRace();$('redraw').onclick=studio;$('back').onclick=studio;
$('jump').onclick=jump;$('pause').onclick=()=>pause();$('resume').onclick=()=>pause(false);$('camera').onclick=()=>{world.view=(world.view+1)%2;};
$('sound').onclick=()=>{audio.unlock();audio.muted=!audio.muted;$('sound').setAttribute('aria-pressed',audio.muted);$('sound').setAttribute('aria-label',t(audio.muted?'unmute':'mute'));save();};
winOn('keydown',e=>{
  if(worldBoard.isOpen)return;
  if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(state!=='race')return;
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();return;}
  if(e.repeat)return;
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();pause();}
  if(e.code==='KeyC')world.view=(world.view+1)%2;
});
rootOn('pointerdown',e=>{
  if(e.button!==0||e.isPrimary===false||!(e.target instanceof Element))return;
  if(e.target.closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]'))return;
  cheer();
});
$('view-podium').onclick=()=>{$('result-overlay').hidden=true;world.resultCardVisible=false;world.cameraSnap=true;};
$('show-results').onclick=()=>{$('result-overlay').hidden=false;world.resultCardVisible=true;world.cameraSnap=true;};
docOn('visibilitychange',()=>{last=0;if(document.hidden&&state==='race')pause(true);});
function updateHUD(){
  if(!race)return;
  $('timer').innerHTML=`${Math.max(0,race.player.finish??race.time).toFixed(2)} <i>s</i>`;$('rank').innerHTML=`${race.rank} <i>/ 4</i>`;$('combo').innerHTML=`${race.combo} <i>×</i>`;
  $('distance').textContent=`${Math.floor(race.player.x)} / ${race.length} m`;$('distance-fill').style.width=`${race.player.x/race.length*100}%`;
  const zone=$q('.beat-zone');zone.style.left=((.68-race.profile.windowPad)*100)+'%';zone.style.width=((.26+race.profile.windowPad*2)*100)+'%';
  $('beat-marker').style.left=`${race.phase*100}%`;$('boost').classList.toggle('inactive',!race.running||race.player.finish!==null);$('jump').disabled=!race.running||race.player.finish!==null||race.player.jump>0;
  const next=race.obstacles[race.player.passed];$('obstacle-hint').textContent=next!==undefined?t('nextHurdle',{distance:Math.max(0,Math.ceil(next-race.player.x))})+(next-race.player.x<6?t('jumpNow'):''):t(race.player.finish!==null?'waiting':'finishDirection');
  race.ranking.forEach((h,i)=>{const el=$('leaderboard').querySelector(`[data-horse="${h.id}"]`);el.style.order=i;el.classList.toggle('is-player',h.id===0);});
  const number=Math.ceil(-race.time);
  if(race.time<0){$('countdown').textContent=number;$('countdown').hidden=false;if(number!==lastCount){audio.play('count');lastCount=number;}}
  else{$('countdown').textContent=t('go');$('countdown').hidden=race.time>.65;}
}
function renderResult(){
  const rank=race.rank;$('result-place').textContent=String(rank).padStart(2,'0');$('result-title').textContent=t(rank===1?'winTitle':'finishTitle');$('result-comment').textContent=t(rank===1?'winCopy':rank===2?'secondCopy':'otherCopy');
  $('result-time').textContent=race.player.finish.toFixed(2)+'s';$('result-combo').textContent=race.maxCombo+'×';$('result-hits').textContent=race.hits+'/'+(race.hits+race.misses);
  $('results').replaceChildren(...race.ranking.map((h,i)=>{const li=document.createElement('li');if(h.id===0)li.className='me';const name=document.createElement('span');name.textContent=`${i+1}  ${names()[h.id]}${h.id===0?' · '+t('you'):''}`;const time=document.createElement('b');time.textContent=h.finish.toFixed(2)+'s';li.append(name,time);return li;}));
}
function finish(){
  state='result';$('show-results').hidden=false;$('countdown').hidden=true;$('pause').disabled=true;$('result-overlay').hidden=false;audio.play('finish');world.setMode('result',race);renderResult();
  void worldBoard.submit(race);
  records.push({mode,time:race.player.finish,rank:race.rank,combo:race.maxCombo});records=records.slice(-20);save();
}
function loop(timestamp){
  if(dead)return;
  const realDt=last?Math.min((timestamp-last)/1000,.05):0;last=timestamp;const dt=realDt*world.tickFx(realDt);
  if(state==='race'&&!paused){accumulator+=dt;while(accumulator>=STEP){race.update(STEP);accumulator-=STEP;for(const event of race.events.splice(0)){if(event==='stumble'){audio.play(event);callout('stumble');}if(event==='jump')callout('cleared');if(event==='go')audio.play('go');}if(race.finished){finish();accumulator=0;break;}}audio.update(race);updateHUD();}
  if(!$('world').hidden)world.render(paused?0:dt,race);
  $('world').dataset.diagnostics=JSON.stringify({state,mode,language:getLanguage(),portrait,studioTab,paused,time:race?.time,rank:race?.rank,jumps:race?.player.jumps,airborne:race?.player.jump,hits:race?.hits,misses:race?.misses,traits:drawingTraits(board.strokes),traitMax:TRAIT_MAX,trophyVisible:world.awards.trophy.visible,...world.diagnostics()});
  rafId=requestAnimationFrame(loop);
}
/* ─────────────── 收尾：监听器 / 就绪标记 / 调试桥 ─────────────── */
docOn('pointerdown',()=>{void audio.unlock();},{once:true});
docOn('keydown',()=>{void audio.unlock();},{once:true});
winOn('pagehide',()=>{audio.dispose();archive.dispose();world.fx?.dispose();},{once:true});
responsiveLayout=mountResponsiveLayout({app,root:mountRoot,onResize:resize});
setStudioTab('draw');resize();applyLanguage();world.render(0,null);
window.__gpReady=true;window.__gpPlayable=true;
/*
 * ★ 原版这里包了一层「没平台就跳过音频」的判断。那个判断在 MakePlay 上意思是
 *   「没平台就别初始化云端音频」，但**音频包是本地的**（`sound.pack` + `assets/audio/*.m4a`）。
 *   照抄原判断的症状是：整局没有音乐、控制台零报错、静态扫和 `--browse` 都收不到 404
 *   （流式音频进场景才加载）。
 */
{
 const soundReady=import('@makeplay/sound').then(({loadSoundSystem})=>loadSoundSystem({manifestUrl:AB+'sound.manifest.json'}));
 void world.initFx().catch(error=>console.warn('Celebration unavailable',error));
 audio.init(soundReady);
}
void archive.enter();
/* 世界排行榜 / 录像库整条线恒离线（`createOfflineArchive`）⇒ 入口直接藏掉。
   留一个「点进去转两圈然后报错」的按钮，在孩子眼里就是「这个游戏坏了」。 */
for(const id of ['world-board-open','world-board-result','world-board-submit']){const el=$(id);if(el)el.hidden=true;}
window.__qa={ready:true,scene:()=>state==='studio'?'menu':state==='race'?'play':'over',enter:async()=>{await launchRace();return archive.inspect();},host:async()=>{await launchRace();return archive.inspect();},join:async()=>{await launchRace();return archive.inspect();},stats:()=>({state,...archive.inspect(),replays:race?.replays?.length||0})};
window.__derbyTutorial=()=>tutorial.inspect();
window.__derbyArchive=()=>archive.inspect();
window.__derbyBoard=()=>worldBoard.inspect();
window.__derbySave=()=>({snapshot:snapshot(),name:currentName(),custom:structuredClone(customName.value),strokes:structuredClone(board.strokes),saveStatus,saveBlocked,sound:audio.sound?.inspect()});
window.__derbyDiagnostics=()=>JSON.parse($('world').dataset.diagnostics||'{}');
rafId=requestAnimationFrame(loop);

/* ───────────────────────── 卸载 ─────────────────────────
 *
 * ★ 每条都要真摘掉。留一条的症状都不是「报错」，是**下一次挂载行为怪**：
 *   - 监听器留着 ⇒ 切走后按 Space 还会 `preventDefault()` 宿主的滚动；
 *   - 调试钩子留着 ⇒ 第二次挂载时 `window.__gpPlayable` 已经是 `true`，
 *     任何「等它变 true」的探针立刻通过 ⇒ **假就绪**；
 *   - `styleEl` 留着 ⇒ 切几次游戏叠十几份同样的 CSS；
 *   - `mountRoot` 留着 ⇒ 两份界面叠着，`getElementById` 拿到上一份的节点。
 */
async function destroy(){
  dead=true;
  if(rafId)cancelAnimationFrame(rafId);rafId=0;
  for(const off of offs){try{off();}catch{}}
  offs.length=0;
  for(const o of observers){try{o.disconnect();}catch{}}
  observers.length=0;
  try{audio.dispose();}catch{}
  try{archive.dispose();}catch{}
  try{worldBoard.dispose?.();}catch{}
  try{languageMenu.dispose?.();}catch{}
  try{responsiveLayout?.dispose?.();}catch{}
  try{world.dispose?.();}catch{}
  try{styleEl.remove();}catch{}
  for(const key of ['__qa','__derbyTutorial','__derbyArchive','__derbyBoard','__derbySave','__derbyDiagnostics','__gpReady','__gpPlayable']){
    if(key in window)delete window[key];
  }
  try{mountRoot.remove();}catch{}
}
return destroy;
}
