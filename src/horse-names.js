import { NAME_TABLE } from './names.js';
const LANGS=['zh','en','ja'];
export function compactHorseNames(source,row){const strings=[],refs=LANGS.map(k=>{const s=String(row[k]||source).slice(0,48);if(s===source)return 0;let i=strings.indexOf(s);if(i<0){i=strings.length;strings.push(s);}return i+1;});return strings.length?[strings,refs]:null;}
export function horseName(source,packed,lang){const i=LANGS.indexOf(lang);if(packed&&Array.isArray(packed[0])&&Array.isArray(packed[1])){const ref=packed[1][i];if(ref>0&&typeof packed[0][ref-1]==='string')return packed[0][ref-1];if(ref===0)return source;}
 const known=Object.values(NAME_TABLE).find(row=>row.includes(source));return known?known[i<0?0:i]:source;
}
