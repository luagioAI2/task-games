// Static game data: elements, characters, monsters, stages (100 stages, 20 areas, 10 heroines).

                                                                   
                                           
                                                                        
                                                     

export const ELEMENTS            = ['fire', 'water', 'wood', 'light', 'dark'];
export const EL_COLOR                          = {
  fire: 0xff8fa3, water: 0x7db9ff, wood: 0x7fd8a6, light: 0xffd36e, dark: 0xb48cff,
};
export const EL_CSS                          = {
  fire: '#ff8fa3', water: '#7db9ff', wood: '#6fd09a', light: '#f5c451', dark: '#a985f5',
};
export const GEM_ICON                          = {
  fire: 'assets/ui-gem/frame-00.png', water: 'assets/ui-gem/frame-01.png', wood: 'assets/ui-gem/frame-02.png',
  light: 'assets/ui-gem/frame-03.png', dark: 'assets/ui-gem/frame-04.png',
};

/** Attacker element vs defender element damage multiplier. */
export function elemMult(a         , d         )         {
  if ((a === 'fire' && d === 'wood') || (a === 'wood' && d === 'water') || (a === 'water' && d === 'fire')) return 1.5;
  if ((a === 'wood' && d === 'fire') || (a === 'water' && d === 'wood') || (a === 'fire' && d === 'water')) return 0.75;
  if ((a === 'light' && d === 'dark') || (a === 'dark' && d === 'light')) return 1.5;
  return 1;
}

;                         
                                                                                
                                                                                                           
 

export const CHARS            = [
  { id: 'mira', el: 'light', shot: 'bounce', combo: 'laser', strike: 'meteor', hp: 2600, atk: 1900, spd: 1.0, unlockAfter: 0 },
  { id: 'shizuku', el: 'water', shot: 'bounce', combo: 'heal', strike: 'boost', hp: 2900, atk: 1650, spd: 1.05, unlockAfter: 0 },
  { id: 'hina', el: 'fire', shot: 'bounce', combo: 'blast', strike: 'meteor', hp: 2500, atk: 2050, spd: 0.95, unlockAfter: 0 },
  { id: 'wakaba', el: 'wood', shot: 'bounce', combo: 'homing', strike: 'heal', hp: 3000, atk: 1700, spd: 1.0, unlockAfter: 0 },
  { id: 'karin', el: 'wood', shot: 'bounce', combo: 'heal', strike: 'boost', hp: 3100, atk: 1800, spd: 1.0, unlockAfter: 10 },
  { id: 'shion', el: 'water', shot: 'bounce', combo: 'cross', strike: 'meteor', hp: 2800, atk: 2000, spd: 1.0, unlockAfter: 20 },
  { id: 'akari', el: 'fire', shot: 'bounce', combo: 'homing', strike: 'boost', hp: 2700, atk: 2150, spd: 1.08, unlockAfter: 30 },
  { id: 'amane', el: 'light', shot: 'bounce', combo: 'cross', strike: 'heal', hp: 3300, atk: 1950, spd: 1.0, unlockAfter: 50 },
  { id: 'kureha', el: 'dark', shot: 'bounce', combo: 'homing', strike: 'boost', hp: 2700, atk: 2300, spd: 1.1, unlockAfter: 70 },
  { id: 'yoruka', el: 'dark', shot: 'bounce', combo: 'blast', strike: 'meteor', hp: 3000, atk: 2250, spd: 1.0, unlockAfter: 90 },
];
export const CHAR_BY_ID                          = Object.fromEntries(CHARS.map(c => [c.id, c]));

// Growth: 0 base, 1 evolved (new art), 2 awakened (evolved art + golden aura, stronger skills)
export const TIER_STAT = [1, 1.5, 2.1];
export const TIER_COMBO = [1, 1.35, 1.8];
export const TIER_STRIKE = [1, 1.3, 1.7];
// Strike Shot energy: the shooter fills 0..100 by hitting monsters / touching teammates; tier speeds it up.
export const ENERGY_MAX = 100;
export const ENERGY_HIT = 3.6; // user: cut 70% from 8/12, then +50%
export const ENERGY_ALLY = 5.4;
export const TIER_ENERGY = [1, 1.25, 1.5];
export function subElement(el         )          { return el === 'light' ? 'dark' : 'light'; }
/** Gem cost to reach the next tier (from current tier). */
export function tierCost(c         , tier        )                                          {
  if (tier === 0) return { [c.el]: 8 };
  if (tier === 1) return { [c.el]: 16, [subElement(c.el)]: 6 };
  return null;
}
export function charArt(id        , tier        )         { return `assets/chara/${id}_${tier > 0 ? 1 : 0}.webp`; }

;                                                                                                                                  
export const MONS                         = {
  mushroom: { id: 'mushroom', el: 'wood', hp: 5200, atk: 520, turns: 2, r: 44, tex: 'assets/mon/mushroom.webp' },
  jelly: { id: 'jelly', el: 'water', hp: 5000, atk: 480, turns: 2, r: 44, tex: 'assets/mon/jelly.webp' },
  cloud: { id: 'cloud', el: 'water', hp: 6500, atk: 420, turns: 3, r: 46, tex: 'assets/mon/cloud.webp' },
  pudding: { id: 'pudding', el: 'fire', hp: 5400, atk: 560, turns: 2, r: 44, tex: 'assets/mon/pudding.webp' },
  starbat: { id: 'starbat', el: 'light', hp: 4800, atk: 600, turns: 1, r: 42, tex: 'assets/mon/starbat.webp' },
  ghost: { id: 'ghost', el: 'dark', hp: 5600, atk: 640, turns: 2, r: 44, tex: 'assets/mon/ghost.webp' },
  flowerbud: { id: 'flowerbud', el: 'wood', hp: 5300, atk: 540, turns: 2, r: 44, tex: 'assets/mon/flowerbud.webp' },
  bubblefish: { id: 'bubblefish', el: 'water', hp: 5100, atk: 500, turns: 2, r: 44, tex: 'assets/mon/bubblefish.webp' },
  candle: { id: 'candle', el: 'fire', hp: 5500, atk: 580, turns: 2, r: 44, tex: 'assets/mon/candle.webp' },
  angelpuff: { id: 'angelpuff', el: 'light', hp: 4900, atk: 620, turns: 1, r: 42, tex: 'assets/mon/angelpuff.webp' },
  shadowcat: { id: 'shadowcat', el: 'dark', hp: 5700, atk: 660, turns: 2, r: 44, tex: 'assets/mon/shadowcat.webp' },
  stag: { id: 'stag', el: 'wood', hp: 34000, atk: 1150, turns: 3, r: 92, boss: true, tex: 'assets/boss/stag.webp' },
  jellyfish: { id: 'jellyfish', el: 'water', hp: 36000, atk: 1150, turns: 3, r: 92, boss: true, tex: 'assets/boss/jellyfish.webp' },
  fox: { id: 'fox', el: 'fire', hp: 38000, atk: 1200, turns: 3, r: 92, boss: true, tex: 'assets/boss/fox.webp' },
  pegasus: { id: 'pegasus', el: 'light', hp: 40000, atk: 1250, turns: 3, r: 95, boss: true, tex: 'assets/boss/pegasus.webp' },
  moonwitch: { id: 'moonwitch', el: 'dark', hp: 44000, atk: 1300, turns: 3, r: 100, boss: true, tex: 'assets/boss/moonwitch.webp' },
  golem: { id: 'golem', el: 'wood', hp: 48000, atk: 1400, turns: 3, r: 95, boss: true, tex: 'assets/boss/golem.webp' },
  whale: { id: 'whale', el: 'water', hp: 52000, atk: 1450, turns: 3, r: 95, boss: true, tex: 'assets/boss/whale.webp' },
  phoenix: { id: 'phoenix', el: 'fire', hp: 56000, atk: 1500, turns: 3, r: 95, boss: true, tex: 'assets/boss/phoenix.webp' },
  lion: { id: 'lion', el: 'light', hp: 60000, atk: 1550, turns: 3, r: 95, boss: true, tex: 'assets/boss/lion.webp' },
  dragon: { id: 'dragon', el: 'dark', hp: 68000, atk: 1650, turns: 3, r: 100, boss: true, tex: 'assets/boss/dragon.webp' },
};

                                                                                                                
const AREA_EL            = ['wood', 'water', 'fire', 'light', 'dark', 'wood', 'water', 'fire', 'light', 'dark', 'wood', 'water', 'fire', 'light', 'dark', 'wood', 'water', 'fire', 'light', 'dark'];
const AREA_MINIONS = [
  ['mushroom', 'jelly', 'mushroom', 'cloud'],
  ['jelly', 'cloud', 'pudding', 'jelly'],
  ['pudding', 'mushroom', 'pudding', 'starbat'],
  ['starbat', 'ghost', 'starbat', 'cloud'],
  ['ghost', 'starbat', 'ghost', 'pudding'],
  ['flowerbud', 'bubblefish', 'flowerbud', 'cloud'],
  ['bubblefish', 'cloud', 'candle', 'bubblefish'],
  ['candle', 'flowerbud', 'candle', 'angelpuff'],
  ['angelpuff', 'shadowcat', 'angelpuff', 'cloud'],
  ['shadowcat', 'angelpuff', 'shadowcat', 'candle'],
  ['mushroom', 'bubblefish', 'flowerbud', 'jelly'],
  ['jelly', 'bubblefish', 'pudding', 'cloud'],
  ['candle', 'mushroom', 'pudding', 'angelpuff'],
  ['starbat', 'angelpuff', 'shadowcat', 'cloud'],
  ['ghost', 'shadowcat', 'starbat', 'candle'],
  ['flowerbud', 'jelly', 'mushroom', 'bubblefish'],
  ['bubblefish', 'cloud', 'candle', 'jelly'],
  ['candle', 'pudding', 'flowerbud', 'starbat'],
  ['angelpuff', 'starbat', 'ghost', 'shadowcat'],
  ['shadowcat', 'ghost', 'angelpuff', 'pudding'],
];
const AREA_BOSS = ['stag', 'jellyfish', 'fox', 'pegasus', 'moonwitch', 'golem', 'whale', 'phoenix', 'lion', 'dragon', 'stag', 'jellyfish', 'fox', 'pegasus', 'moonwitch', 'golem', 'whale', 'phoenix', 'lion', 'dragon'];
const AREA_BG_LIST = ['assets/bg/opt_forest.webp', 'assets/bg/area_lake.webp', 'assets/bg/area_festival.webp', 'assets/bg/area_ruins.webp', 'assets/bg/area_tower.webp'];

function buildStages()             {
  const out             = [];
  for (let a = 0; a < 20; a++) {
    const m = AREA_MINIONS[a];
    const bg = AREA_BG_LIST[a % 5];
    for (let k = 0; k < 5; k++) {
      const n = a * 5 + k + 1;
      const boss = k === 4;
      const waves             = [];
      if (k === 0) waves.push([m[0], m[1]], [m[0], m[2], m[1]], [m[3], m[0], m[2]]);
      else if (k === 1) waves.push([m[1], m[0], m[2]], [m[3], m[2], m[0], m[1]], [m[0], m[3], m[1], m[2]]);
      else if (k === 2) waves.push([m[0], m[1]], [m[2], m[3], m[0]], [m[1], m[2], m[3], m[0]]);
      else if (k === 3) waves.push([m[2], m[1]], [m[3], m[0], m[1], m[2]], [m[0], m[1], m[3], m[2]]);
      else waves.push([m[0], m[1], m[2]], [m[3], m[1], m[0], m[2]], [AREA_BOSS[a], m[0], m[1]]);
      out.push({ n, area: a, el: AREA_EL[a], waves, boss, bg });
    }
  }
  return out;
}
export const STAGES             = buildStages();
/** Enemy stat scale for a stage number: HP base ×2.7 +5%/stage; ATK base ×1.6 +3%/stage (user asked for tougher monsters). */
export function stageScale(n        ) { return { hp: 2.43 * (1 + 0.05 * (n - 1)), atk: 1.44 * (1 + 0.03 * (n - 1)) }; }
export const AREA_BG = 'assets/bg/opt_forest.webp';
