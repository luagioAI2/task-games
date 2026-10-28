// ★ `root`：原版把 `data-tutorial` / `data-tutorial-step` 写在 `document.body` 上，
//   而 `tiny-layout.css` 里一堆 `body[data-compact][data-tutorial-step="3"] #app …`
//   的规则靠它选中。插件里这两个属性必须写在**挂载根**上（样式已改成
//   `#dd-app[data-…]`），否则紧凑布局那套覆盖一条都不生效、界面在手机上撑破。
export function createTutorial({step,t,getStrokes,getName,onChange,onName,onDraw,onEntry,root}){
 let current=Number.isInteger(step)?step:5,baseline=0;const $=id=>document.getElementById(id);
 const keys=['Body','Legs','Head','Name','Race'];
 function allowed(){return current<3?getStrokes().length>baseline:current===3?!!getName():true;}
 function render(){const active=current<5;$('drawing-tutorial').hidden=!active;root.dataset.tutorialStep=String(current);root.dataset.tutorial=String(active);root.querySelectorAll('.tutorial-target').forEach(e=>e.classList.remove('tutorial-target'));if(!active)return;
 $('tutorial-title').textContent=t('tutorialTitle',{step:current+1})+' · '+t('tutorial'+keys[current]);$('tutorial-copy').textContent=t('tutorial'+keys[current]+'Copy');$('tutorial-next').textContent=t(current===4?'tutorialDone':'tutorialNext');$('tutorial-next').disabled=!allowed();const target=current<3?$('drawing'):current===3?$('horse-name'):$('start');target.classList.add('tutorial-target');
 }
 function update(){if(current<3&&getStrokes().length<baseline)baseline=0;render();}
 function finish(){current=5;render();onChange();}
 $('tutorial-next').onclick=()=>{if(!allowed())return;if(current===4){finish();return;}current++;baseline=getStrokes().length;render();onChange();if(current===3)onName();else if(current<3)onDraw();else onEntry?.();};
 $('tutorial-skip').onclick=finish;
 return {update,render,finish,get step(){return current},inspect:()=>({step:current,allowed:allowed(),baseline})};
}
