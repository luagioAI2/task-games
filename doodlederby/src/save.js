import { encodeDrawing, decodeDrawing } from './replay-codec.js';
import { COLORS, preset, sanitizeStrokes } from './drawing.js';
import { NAME_TABLE } from './names.js';
const LANGS=['zh','en','ja'];
const zig=n=>n<0?-n*2-1:n*2;
const unzig=n=>n&1?-(n+1)/2:n/2;
function bytesToBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s);}
function packLegacyDrawing(strokes){
  const bytes=[];const put=n=>{while(n>127){bytes.push((n&127)|128);n>>>=7;}bytes.push(n);};
  put(strokes.length);
  for(const stroke of strokes){put(COLORS.indexOf(stroke.color));put(stroke.points.length);let x=0,y=0;for(const p of stroke.points){const nx=Math.round(p[0]*16),ny=Math.round(p[1]*16);put(zig(nx-x));put(zig(ny-y));x=nx;y=ny;}}
  return bytesToBase64(bytes);
}
function unpackLegacyDrawing(encoded){
  if(typeof encoded!=='string'||encoded.length>50000)throw Error('Invalid drawing');
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));let cursor=0;
  const get=()=>{let n=0;for(let shift=0;shift<=21;shift+=7){if(cursor>=bytes.length)throw Error('Truncated drawing');const b=bytes[cursor++];n|=(b&127)<<shift;if(!(b&128))return n;}throw Error('Invalid integer');};
  const count=get();if(count>48)throw Error('Too many strokes');const strokes=[];
  for(let i=0;i<count;i++){const color=COLORS[get()],length=get();if(!color||length<1||length>160)throw Error('Invalid stroke');let x=0,y=0;const points=[];for(let j=0;j<length;j++){x+=unzig(get());y+=unzig(get());if(x<0||x>10240||y<0||y>6400)throw Error('Invalid point');points.push([x/16,y/16]);}strokes.push({color,points});}
  if(cursor!==bytes.length)throw Error('Trailing drawing data');return strokes;
}
export const packDrawing=encodeDrawing,unpackDrawing=decodeDrawing;
const presetData=Array.from({length:20},(_,i)=>packDrawing(preset(i).strokes));
export function compactDrawing(strokes){const encoded=packDrawing(strokes),index=presetData.indexOf(encoded);return index<0?encoded:index;}
const validText=x=>typeof x==='string'&&x.length<=48;
export function packName(nameId,custom){
  if(nameId)return nameId;
  const strings=[custom.source],refs=LANGS.map(lang=>{const text=custom.translations[lang]||custom.source;let i=strings.indexOf(text);if(i<0){i=strings.length;strings.push(text);}return i;});
  return [LANGS.indexOf(custom.lang),custom.ready?1:0,strings,refs];
}
function unpackName(raw){
  if(typeof raw==='string'&&Object.hasOwn(NAME_TABLE,raw))return {nameId:raw,custom:null};
  if(!Array.isArray(raw)||raw.length!==4||!LANGS[raw[0]]||![0,1].includes(raw[1])||!Array.isArray(raw[2])||raw[2].length<1||raw[2].length>4||!raw[2].every(validText)||!Array.isArray(raw[3])||raw[3].length!==3||!raw[3].every(n=>Number.isInteger(n)&&n>=0&&n<raw[2].length))throw Error('Invalid name');
  return {nameId:null,custom:{source:raw[2][0],lang:LANGS[raw[0]],ready:!!raw[1],translations:Object.fromEntries(LANGS.map((l,i)=>[l,raw[2][raw[3][i]]]))}};
}
export function encodeSave({drawing,nameId,custom,language,records,muted,guide}){
  return {v:3,...(Number.isInteger(guide)?{g:guide}:{}),d:drawing,n:packName(nameId,custom),l:LANGS.indexOf(language),...(muted?{m:1}:{}),...(records.length?{r:records.map(r=>[r.mode==='chaos'?1:0,Math.round(r.time*1000),r.rank,r.combo])}:{})};
}
export function decodeSave(raw){
  try{
    if(typeof raw==='string')raw=JSON.parse(raw);
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    if(Object.hasOwn(raw,'doodle-derby-3d-v1'))return decodeSave(raw['doodle-derby-3d-v1']);
    if(raw.v===2||raw.v===3){
      if(!LANGS[raw.l])return null;
      const strokes=Number.isInteger(raw.d)&&raw.d>=0&&raw.d<20?preset(raw.d).strokes:(raw.v===2?unpackLegacyDrawing:unpackDrawing)(raw.d);
      const name=unpackName(raw.n),rows=raw.r??[];
      if(!Array.isArray(rows)||rows.length>20||!rows.every(r=>Array.isArray(r)&&r.length===4&&[0,1].includes(r[0])&&Number.isInteger(r[1])&&r[1]>=0&&Number.isInteger(r[2])&&r[2]>=1&&r[2]<=4&&Number.isInteger(r[3])&&r[3]>=0))return null;
      return {...name,guide:Number.isInteger(raw.g)&&raw.g>=0&&raw.g<=5?raw.g:5,strokes,language:LANGS[raw.l],muted:raw.m===1,records:rows.map(r=>({mode:r[0]?'chaos':'classic',time:r[1]/1000,rank:r[2],combo:r[3]}))};
    }
    if(raw.v!==undefined||!Array.isArray(raw.strokes))return null;
    const strokes=sanitizeStrokes(raw.strokes);if(strokes.length!==raw.strokes.length)return null;
    const lang=LANGS.includes(raw.language)?raw.language:'zh',nameId=Object.hasOwn(NAME_TABLE,raw.nameId)?raw.nameId:null;
    if(!nameId&&!validText(raw.name))return null;
    return {strokes,nameId,custom:nameId?null:{source:raw.name,lang,ready:false,translations:{}},language:lang,muted:false,records:(Array.isArray(raw.records)?raw.records:[]).filter(r=>r&&Number.isFinite(r.time)&&r.time>=0&&['classic','chaos'].includes(r.mode)&&Number.isInteger(r.rank)&&r.rank>=1&&r.rank<=4&&Number.isInteger(r.combo)&&r.combo>=0).slice(-20)};
  }catch{return null;}
}
