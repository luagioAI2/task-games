// 三个深层（原创命名与配色），每层 3 条矿道，矿种照参考作：煤 → 金 → 钻石。层与层之间有一道岩障。
// ore：矿色（也用来认矿种，见 src/art/ore.js）；oreKind：coal / gold / diamond；moss：岩壁上地衣斑块的颜色。
// sky：左侧深渊虚空的上下渐变；rock：崖壁岩色；ore：矿脉颜色；glow：发光物色；mote：漂浮微粒。
import { SHAFT_COUNT, SHAFTS_PER_LAYER } from '../sim/economy.js';
export { SHAFT_COUNT, SHAFTS_PER_LAYER };
export const LAYERS = [
  {
    id: 'rim', name: '晨光林缘', en: 'DAWN RIM', oreName: '煤炭', oreKind: 'coal', depth: '0–400 米',
    sky: ['#e6dcae', '#8fbf98'], fog: '#e8f0d0', rock: '#8a6a4a', rock2: '#6e5238', ore: '#2a2e36', ore2: '#8c97aa', moss: '#a8c080', glow: '#ffe9a0', mote: '#fff6c8',
    desc: '裂渊边缘的森林，金色晨光一直照到崖壁上，苔藓和蕨类长满岩缝。',
  },
  {
    id: 'vines', name: '垂藤之森', en: 'HANGING WOODS', oreName: '金矿', oreKind: 'gold', depth: '400–1300 米',
    sky: ['#8fbf98', '#4a7fa8'], fog: '#cfe6d6', rock: '#6e5a48', rock2: '#54443a', ore: '#f2b632', ore2: '#fff0a0', moss: '#8ab878', glow: '#ffd27a', mote: '#e8ffd8',
    desc: '巨树从崖壁横向长出，藤蔓像瀑布一样垂进深渊，空气里飘着发光的种子。',
  },
  {
    id: 'sea', name: '静晶之海', en: 'CRYSTAL SEA', oreName: '钻石', oreKind: 'diamond', depth: '1300 米以下',
    sky: ['#3a4a8a', '#1e2a5e'], fog: '#8090d0', rock: '#2e3a5a', rock2: '#222c48', ore: '#7ae0ff', ore2: '#ffffff', moss: '#6a8ab8', glow: '#9ad8ff', mote: '#c8e8ff',
    desc: '被水淹没的洞穴，晶簇从水底长出，发光的小鱼在晶石之间游动。',
  },
];
export const layerOf = (shaftIdx) => LAYERS[Math.min(LAYERS.length - 1, Math.floor(shaftIdx / SHAFTS_PER_LAYER))];
