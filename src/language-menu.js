export function mountLanguageMenu(root,select){
 const trigger=root.querySelector('#language-toggle'),menu=root.querySelector('#language-menu');
 const options=[...menu.querySelectorAll('[data-language]')];
 function sync(){const current=options.find(b=>b.dataset.language===select.value)||options[0];trigger.querySelector('.language-label').textContent=current.textContent.trim();trigger.setAttribute('aria-label',(select.getAttribute('aria-label')||'')+': '+current.textContent.trim());menu.setAttribute('aria-label',select.getAttribute('aria-label')||'');options.forEach(b=>b.setAttribute('aria-checked',String(b===current)));}
 function close(restore=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore)trigger.focus();}
 function open(index){sync();menu.hidden=false;trigger.setAttribute('aria-expanded','true');const r=trigger.getBoundingClientRect(),width=menu.offsetWidth,height=menu.offsetHeight;menu.style.left=Math.max(12,Math.min(innerWidth-width-12,r.right-width))+'px';menu.style.top=Math.max(12,Math.min(innerHeight-height-12,r.bottom+8))+'px';if(index!==undefined)options[index].focus();}
 trigger.addEventListener('click',()=>{if(menu.hidden)open();else close();});
 options.forEach(b=>b.addEventListener('click',()=>{select.value=b.dataset.language;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);}));
 root.addEventListener('pointerdown',e=>e.stopPropagation());
 root.addEventListener('keydown',e=>{
  e.stopPropagation();const i=options.indexOf(document.activeElement);
  if(e.key==='Escape'){if(!menu.hidden){e.preventDefault();close(true);}return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?options.length-1:i<0?options.findIndex(b=>b.dataset.language===select.value):(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;open(Math.max(0,next));}
  if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();document.activeElement.click();}
 });
 root.addEventListener('focusout',e=>{if(!(e.relatedTarget instanceof Node)||!root.contains(e.relatedTarget))close();});
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!root.contains(e.target)){close();e.stopPropagation();}},true);
 window.addEventListener('resize',()=>close());
 sync();return {sync,close};
}
