export const TRAIT_MAX=10;
export const TRAIT_KEYS=['stride','agility','balance','cadence','power','stamina'];
export const EMPHASIS={classic:['cadence','power','stamina'],chaos:['stride','agility','balance']};
export function drawingTraits(strokes){
 const points=strokes.flatMap(s=>s.points);if(!points.length)return Object.fromEntries(TRAIT_KEYS.map(k=>[k,1]));
 let x0=640,y0=400,x1=0,y1=0,length=0,turns=0,segments=0,left=0;
 for(const [x,y] of points){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const width=Math.max(8,x1-x0),height=Math.max(8,y1-y0),mid=(x0+x1)/2;
 for(const p of points)if(p[0]<mid)left++;
 for(const s of strokes)for(let i=1;i<s.points.length;i++){
  const a=s.points[i-1],b=s.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);length+=len;
  if(i>1&&len>0){const c=s.points[i-2],px=a[0]-c[0],py=a[1]-c[1],plen=Math.hypot(px,py);if(plen>0){turns+=Math.acos(Math.max(-1,Math.min(1,(px*dx+py*dy)/plen/len)));segments++;}}
 }
 const score=n=>Math.max(1,Math.min(10,Math.round(n))),normalized=length*400/Math.max(width,height),symmetry=1-Math.abs(left/points.length-.5)*2;
 return {stride:score(2+width/height*2.8),agility:score(11-normalized/650-strokes.length*.06),balance:score(2+symmetry*6+Math.max(0,2-Math.abs(width/height-1.5))),cadence:score(3+(segments?turns/segments:0)*5+Math.min(3,strokes.length*.22)),power:score(2+Math.sqrt(width*height)/65+Math.min(3,length/1400)),stamina:score(2+normalized/600+strokes.length*.16)};
}
export function raceProfile(mode,values){
 const t=Object.fromEntries(TRAIT_KEYS.map(k=>[k,Math.max(1,Math.min(10,values[k]??5))-5]));
 const fast=mode==='classic';
 const coefficients=fast?[.06,.025,.025,.12,.11,.1]:[.11,.08,.08,.04,.055,.05];
 return {
  base:5.8+TRAIT_KEYS.reduce((sum,k,i)=>sum+t[k]*coefficients[i],0),
  acceleration:7+t.power*.35+t.agility*.15,
  boostBase:2.6+t.power*(fast?.16:.08),
  comboGain:.18+t.cadence*(fast?.018:.008),
  boostDecay:Math.max(1.6,2.5-t.stamina*(fast?.13:.06)),
  windowPad:t.cadence*(fast?.007:.004)+t.balance*.002,
  jumpSpeed:8.0+t.agility*(fast?.025:.08),
  recovery:Math.max(.35,.8-t.balance*(fast?.025:.05)-t.stamina*.015)
 };
}
