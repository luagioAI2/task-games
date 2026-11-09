import { TRAIT_KEYS,EMPHASIS } from './traits.js';
export function renderRadar(host,values,mode,t){
 host.replaceChildren();const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 const width=Math.max(230,host.clientWidth||280),height=Math.max(90,host.clientHeight||160),cx=width/2,cy=height/2,radius=Math.min(width*.19,height/2-24);
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',t('radarLabel'));
 const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));svg.append(el);return el;};
 const point=(i,r)=>{const angle=-Math.PI/2+i*Math.PI/3;return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];};
 for(const factor of [1/3,2/3,1])make('polygon',{points:TRAIT_KEYS.map((_,i)=>point(i,radius*factor).join(',')).join(' '),class:'radar-grid'});
 TRAIT_KEYS.forEach((key,i)=>{const [x,y]=point(i,radius);make('line',{x1:cx,y1:cy,x2:x,y2:y,class:'radar-grid'});const [lx,ly]=point(i,radius+13);const text=make('text',{x:lx,y:ly,'text-anchor':i===1||i===2?'start':i===4||i===5?'end':'middle','dominant-baseline':'middle',class:EMPHASIS[mode].includes(key)?'radar-label focus':'radar-label','data-trait':key});text.textContent=`${t(key)} ${values[key]}`;});
 make('polygon',{points:TRAIT_KEYS.map((k,i)=>point(i,radius*values[k]/10).join(',')).join(' '),class:'radar-shape'});
 TRAIT_KEYS.forEach((k,i)=>{const [x,y]=point(i,radius*values[k]/10);make('circle',{cx:x,cy:y,r:3,class:'radar-dot'});});host.append(svg);
}
