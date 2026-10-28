import { mountResponsiveLayout } from './src/responsive-layout.js';
import { createLegacyNameTranslator } from './src/legacy-name-translator.js';
import { compactHorseNames } from './src/horse-names.js';
import { createTutorial } from './src/tutorial.js';
import { playerBridge } from './src/platform.js';
import { createArchive } from './src/archive-client.js';
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

const uiTokens={background:'#f5f2e9',text:'#263b2f',accent:'#e7663e',green:'#315f48',line:'#dddcd0'};
for(const [key,value] of Object.entries(uiTokens))document.documentElement.style.setProperty('--doodle-'+key,value);
const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./style.css';
const styleReady=new Promise((resolve,reject)=>{stylesheet.onload=resolve;stylesheet.onerror=()=>reject(Error('Stylesheet failed to load'));});
document.head.append(stylesheet);await styleReady;
const responsive=document.createElement('link');responsive.rel='stylesheet';responsive.href='./responsive.css';
const responsiveReady=new Promise((resolve,reject)=>{responsive.onload=resolve;responsive.onerror=()=>reject(Error('Responsive stylesheet failed to load'));});document.head.append(responsive);await responsiveReady;
const boardStyle=document.createElement('link');boardStyle.rel='stylesheet';boardStyle.href='./world-board.css';const boardStyleReady=new Promise((resolve,reject)=>{boardStyle.onload=resolve;boardStyle.onerror=()=>reject(Error('Leaderboard styles failed'));});document.head.append(boardStyle);await boardStyleReady;
const asyncStyle=document.createElement('link');asyncStyle.rel='stylesheet';asyncStyle.href='./async.css';document.head.append(asyncStyle);
const gp=playerBridge();
const studioStyle=document.createElement('link');studioStyle.rel='stylesheet';studioStyle.href='./studio-update.css';await new Promise((resolve,reject)=>{studioStyle.onload=resolve;studioStyle.onerror=reject;document.head.append(studioStyle);});
const resolutionStyle=document.createElement('link');resolutionStyle.rel='stylesheet';resolutionStyle.href='./resolution.css';await new Promise((resolve,reject)=>{resolutionStyle.onload=resolve;resolutionStyle.onerror=reject;document.head.append(resolutionStyle);});
const tinyStyle=document.createElement('link');tinyStyle.rel='stylesheet';tinyStyle.href='./tiny-layout.css';await new Promise((resolve,reject)=>{tinyStyle.onload=resolve;tinyStyle.onerror=reject;document.head.append(tinyStyle);});
const rawSave=gp.player.saves.latestSync;
const restored=rawSave==null?null:decodeSave(rawSave),saved=restored||{};
const saveBlocked=rawSave!=null&&!restored;
const locale=(navigator.language||'zh').slice(0,2);
setLanguage(LANGUAGES.includes(saved.language)?saved.language:LANGUAGES.includes(locale)?locale:'zh');
const $=id=>document.getElementById(id),app=$('app'),audio=new DerbySound();createUI(app);localize(app);
const languageMenu=mountLanguageMenu(document.querySelector('.language-control'),$('language'));
let state='studio',mode='classic',race=null,paused=false,accumulator=0,last=0,adoption=0,lastCount=-4;
let portrait=innerHeight>innerWidth,studioTab='draw',feedback={key:'rhythmIdle'},calloutMessage=null,toastMessage=null,calloutTimer,toastTimer;
let boardPaused=false;
let responsiveLayout=null;
let tutorial=null;let guide=restored?(saved.guide??5):0;
let matching=false,startSerial=0;
const archive=createArchive(()=>renderArchive());
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
  void gp.player.saves.putLatest(JSON.stringify(snapshot()),'text').then(ok=>{if(serial!==saveSerial)return;showSaveStatus(ok?(gp.player.user?'saveCloud':'saveGuest'):'saveFailed');});
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
tutorial=createTutorial({step:guide,t,getStrokes:()=>board.strokes,getName:currentName,onChange:()=>save(),onName:()=>{setStudioTab('entry');$('horse-name').focus();},onDraw:()=>setStudioTab('draw'),onEntry:()=>setStudioTab('entry')});tutorial.render();
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
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{board.color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(el=>{const yes=el===b;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',yes);});});
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
  $('mode-copy').textContent=t(mode+(portrait?'Touch':'Copy'));document.querySelector('.entry-foot').textContent=t(mode+'Foot');renderTraits();renderBest();
}
function chooseMode(value){mode=value;renderMode();}
$('classic').onclick=()=>chooseMode('classic');$('chaos').onclick=()=>chooseMode('chaos');
function positionWorld(){
  document.querySelector('.paper').style.setProperty('--paper-width',Math.min(document.querySelector('.paper').clientWidth,document.querySelector('.paper').clientHeight*1.6)+'px');
  document.querySelector('.paper').style.setProperty('--paper-height',Math.min(document.querySelector('.paper').clientHeight,document.querySelector('.paper').clientWidth/1.6)+'px');
  const r=(state==='studio'?$('preview-slot'):$('race-slot')).getBoundingClientRect();
  $('world').hidden=r.width<1||r.height<1;
  Object.assign($('world').style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
}
function setStudioTab(tab){studioTab=tab;document.body.dataset.studioTab=tab;$('draw-tab').setAttribute('aria-pressed',tab==='draw');$('preview-tab').setAttribute('aria-pressed',tab==='preview');$('entry-tab').setAttribute('aria-pressed',tab==='entry');positionWorld();responsiveLayout?.schedule();}
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
function resize(){portrait=(window.visualViewport?.height||innerHeight)>(window.visualViewport?.width||innerWidth);renderMode();$('jump-key').textContent=t(portrait?'touch':'space');$('boost').querySelector('b').textContent=t(portrait?'boostTouch':'boost');renderFeedback();positionWorld();}
new ResizeObserver(()=>{if(!portrait)renderRadar($('trait-radar'),drawingTraits(board.strokes),mode,t);}).observe($('trait-radar'));
new ResizeObserver(positionWorld).observe(app);new ResizeObserver(positionWorld).observe(document.querySelector('.paper'));new ResizeObserver(positionWorld).observe($('preview-slot'));window.addEventListener('resize',resize);window.addEventListener('scroll',positionWorld,{passive:true});
async function start(){
  if(!board.strokes.length||matching)return;
  if(!currentName()){toast('nameRequired');$('horse-name').focus();return;}
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
  renderNames();renderFeedback();window.scrollTo(0,0);positionWorld();world.setMode('race',race,raceStrokes);renderArchive();updateHUD();
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
$('start').onclick=()=>void start();$('again').onclick=()=>void start();$('redraw').onclick=studio;$('back').onclick=studio;
$('jump').onclick=jump;$('pause').onclick=()=>pause();$('resume').onclick=()=>pause(false);$('camera').onclick=()=>{world.view=(world.view+1)%2;};
$('sound').onclick=()=>{audio.unlock();audio.muted=!audio.muted;$('sound').setAttribute('aria-pressed',audio.muted);$('sound').setAttribute('aria-label',t(audio.muted?'unmute':'mute'));save();};
window.addEventListener('keydown',e=>{
  if(worldBoard.isOpen)return;
  if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(state!=='race')return;
  if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();return;}
  if(e.repeat)return;
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();pause();}
  if(e.code==='KeyC')world.view=(world.view+1)%2;
});
document.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.isPrimary===false||!(e.target instanceof Element))return;
  if(e.target.closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]'))return;
  cheer();
});
$('view-podium').onclick=()=>{$('result-overlay').hidden=true;world.resultCardVisible=false;world.cameraSnap=true;};
$('show-results').onclick=()=>{$('result-overlay').hidden=false;world.resultCardVisible=true;world.cameraSnap=true;};
document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&state==='race')pause(true);});
function updateHUD(){
  if(!race)return;
  $('timer').innerHTML=`${Math.max(0,race.player.finish??race.time).toFixed(2)} <i>s</i>`;$('rank').innerHTML=`${race.rank} <i>/ 4</i>`;$('combo').innerHTML=`${race.combo} <i>×</i>`;
  $('distance').textContent=`${Math.floor(race.player.x)} / ${race.length} m`;$('distance-fill').style.width=`${race.player.x/race.length*100}%`;
  const zone=document.querySelector('.beat-zone');zone.style.left=((.68-race.profile.windowPad)*100)+'%';zone.style.width=((.26+race.profile.windowPad*2)*100)+'%';
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
  const realDt=last?Math.min((timestamp-last)/1000,.05):0;last=timestamp;const dt=realDt*world.tickFx(realDt);
  if(state==='race'&&!paused){accumulator+=dt;while(accumulator>=STEP){race.update(STEP);accumulator-=STEP;for(const event of race.events.splice(0)){if(event==='stumble'){audio.play(event);callout('stumble');}if(event==='jump')callout('cleared');if(event==='go')audio.play('go');}if(race.finished){finish();accumulator=0;break;}}audio.update(race);updateHUD();}
  if(!$('world').hidden)world.render(paused?0:dt,race);
  $('world').dataset.diagnostics=JSON.stringify({state,mode,language:getLanguage(),portrait,studioTab,paused,time:race?.time,rank:race?.rank,jumps:race?.player.jumps,airborne:race?.player.jump,hits:race?.hits,misses:race?.misses,traits:drawingTraits(board.strokes),traitMax:TRAIT_MAX,trophyVisible:world.awards.trophy.visible,...world.diagnostics()});
  requestAnimationFrame(loop);
}
document.addEventListener('pointerdown',()=>{void audio.unlock();},{once:true});
document.addEventListener('keydown',()=>{void audio.unlock();},{once:true});
window.addEventListener('pagehide',()=>{audio.dispose();archive.dispose();world.fx?.dispose();},{once:true});
responsiveLayout=mountResponsiveLayout({app,onResize:resize});
setStudioTab('draw');resize();applyLanguage();world.render(0,null);window.__gpReady=true;window.__gpPlayable=true;
if(!gp.offline){
 const soundReady=import('@makeplay/sound').then(({loadSoundSystem})=>loadSoundSystem({manifestUrl:'./sound.manifest.json'}));
 void world.initFx().catch(error=>console.warn('Celebration unavailable',error));
 audio.init(soundReady);
}
void archive.enter();
window.__qa={ready:true,scene:()=>state==='studio'?'menu':state==='race'?'play':'over',enter:async()=>{await start();return archive.inspect();},host:async()=>{await start();return archive.inspect();},join:async()=>{await start();return archive.inspect();},stats:()=>({state,...archive.inspect(),replays:race?.replays?.length||0})};
window.__derbyTutorial=()=>tutorial.inspect();
window.__derbyArchive=()=>archive.inspect();
window.__derbyBoard=()=>worldBoard.inspect();
window.__derbySave=()=>({snapshot:snapshot(),name:currentName(),custom:structuredClone(customName.value),strokes:structuredClone(board.strokes),saveStatus,saveBlocked,sound:audio.sound?.inspect()});
window.__derbyDiagnostics=()=>JSON.parse($('world').dataset.diagnostics||'{}');
requestAnimationFrame(loop);
