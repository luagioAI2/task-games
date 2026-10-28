export const COLORS = ['#e65c35', '#333b33', '#4677db', '#9856bf', '#22856a', '#d6a52b', '#d65b8e', '#249eb0'];
const stroke = (points, color=COLORS[0]) => ({ points, color });
const ellipse = (x,y,rx,ry) => Array.from({length:33},(_,i)=>[x+Math.cos(i/32*Math.PI*2)*rx,y+Math.sin(i/32*Math.PI*2)*ry]);

// Original doodles. Coordinates live in a fixed 640 x 400 drawing space.
export function preset(index=0) {
  const c=COLORS[index%5];
  const legs = [210,290,390,460].map((x,i)=>stroke([[x,252],[x+(i%2?22:-22),328],[x+22,328]],c));
  if(index%4===0) return {strokes:[
    stroke([[155,220],[170,173],[390,173],[410,93],[434,115],[475,111],[518,155],[460,179],[455,253],[200,257],[155,220]],c),
    ...legs,stroke([[166,184],[124,149],[118,186]],c),stroke([[445,139],[449,139]],'#333b33'),
    stroke([[417,94],[398,123],[393,153]],'#333b33') ]};
  if(index%4===1) return {strokes:[
    stroke([[143,118],[206,180],[318,210],[452,179],[498,114],[492,219],[411,277],[294,289],[202,247],[156,180],[143,118]],c),
    stroke([[258,280],[246,336],[280,336]],c),stroke([[392,280],[418,336],[446,336]],c),
    stroke([[409,211],[410,215]],'#333b33'),stroke([[446,204],[447,208]],'#333b33'),stroke([[420,238],[433,243],[447,231]],'#333b33') ]};
  if(index%4===2) return {strokes:[stroke(ellipse(318,210,172,58),c),
    stroke([[239,184],[260,112],[324,82],[384,112],[400,184]],c),
    ...[210,280,350,420].map(x=>stroke(ellipse(x,216,11,9),'#333b33')),
    stroke([[252,267],[225,328],[252,328]],c),stroke([[390,267],[415,328],[445,328]],c)]};
  return {strokes:[stroke([[170,210],[355,210],[358,66],[404,58],[459,102],[405,125],[407,272],[185,272],[170,210]],c),
    stroke([[217,272],[200,338],[234,338]],c),stroke([[360,272],[384,338],[417,338]],c),
    stroke([[380,65],[369,41]],c),stroke([[399,61],[409,39]],c),stroke([[410,92],[414,92]],'#333b33'),
    stroke([[178,223],[133,180]],c)]};
}

export function sanitizeStrokes(value) {
  if(!Array.isArray(value)) return [];
  return value.slice(0,48).filter(s=>s&&Array.isArray(s.points)).map(s=>({
    color: COLORS.includes(s.color) ? s.color : '#333b33',
    points:s.points.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)).slice(0,160).map(([x,y])=>[Math.max(0,Math.min(640,x)),Math.max(0,Math.min(400,y))])
  })).filter(s=>s.points.length>0);
}

export function bounds(strokes) {
  const p=strokes.flatMap(s=>s.points);
  if(!p.length)return null;
  let x0=640,y0=400,x1=0,y1=0;
  for(const [x,y] of p){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return {x0,y0,x1,y1,w:Math.max(x1-x0,8),h:Math.max(y1-y0,8)};
}

export { drawingTraits, TRAIT_MAX } from './traits.js';

export class DrawingBoard {
  constructor(canvas,onChange,onHint) {
    this.canvas=canvas;this.onChange=onChange;this.onHint=onHint;this.strokes=[];this.color=COLORS[0];this.current=null;
    canvas.width=960;canvas.height=600;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||this.current)return;
      if(this.strokes.length>=48){onHint('drawingFull');return;}
      canvas.setPointerCapture(e.pointerId);this.current={color:this.color,points:[this.point(e)],id:e.pointerId};this.render();
    });
    canvas.addEventListener('pointermove',e=>{
      if(this.current?.id!==e.pointerId)return;
      const p=this.point(e),last=this.current.points.at(-1);
      if(Math.hypot(p[0]-last[0],p[1]-last[1])>3&&this.current.points.length<160){this.current.points.push(p);this.render();}
    });
    const end=e=>{if(this.current?.id!==e.pointerId)return;const {color,points}=this.current;this.strokes.push({color,points});this.current=null;this.changed();};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
  }
  point(e){const r=this.canvas.getBoundingClientRect();return [Math.max(0,Math.min(640,(e.clientX-r.left)/r.width*640)),Math.max(0,Math.min(400,(e.clientY-r.top)/r.height*400))];}
  set(strokes){this.current=null;this.strokes=sanitizeStrokes(strokes);this.changed();}
  undo(){this.current=null;this.strokes.pop();this.changed();}
  clear(){this.set([]);}
  changed(){this.render();this.onChange(this.strokes);}
  render(){
    const ctx=this.canvas.getContext('2d');ctx.setTransform(1.5,0,0,1.5,0,0);ctx.clearRect(0,0,640,400);
    ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
    for(const s of [...this.strokes,...(this.current?[this.current]:[])]){
      ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      if(s.points.length===1){ctx.arc(...s.points[0],2.5,0,Math.PI*2);ctx.fill();}else ctx.stroke();
    }
  }
}
