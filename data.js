// Card / enemy tables. All tuning numbers live here.

                                             
                                                                            

export const TAG_LABEL                      = {
  sword: "剣", fire: "炎", thunder: "雷", shield: "盾", holy: "聖", fest: "祭",
};
// index in assets/icons.webp 4x4 grid
export const ICON = {
  sword: 0, fire: 1, thunder: 2, shield: 3, holy: 4, fest: 5, energy: 6, heart: 7,
  attack: 8, strength: 9, weak: 10, charge: 11, curse: 12, burn: 13, deck: 14, discard: 15,
}         ;

                          
             
               
               
                 
                  
               
                    
                       
                                  
                                                                                   
 

export const C = {
  slash: 6, guard: 5, ember: 3, herb: 4, double: 3, zap: 3, ironwall: 11, bigswing: 12,
  frostDmg: 3, frostWeak: 2, cheerDraw: 2,
  fireballDmg: 10, fireballBurn: 3, chainPer: 3, warcryStr: 2, holyHeal: 8, holyBlock: 6,
  flurry: 4, flurryHits: 3, iceArmor: 8, vamp: 8,
  meteor: 30, swordDance: 3, thunderGodPer: 4, phoenixBurn: 8, rampart: 30, hourglassEnergy: 2,
  berserkHp: 5, berserkStr: 3, slayer: 25, slayerStrMul: 3, fireworksPer: 3, goddessHeal: 20, goddessBlock: 20,
  grimoireEnergy: 2,
};

export const CARDS            = [
  // N
  { id: "slash", name: "斬撃", cost: 1, rarity: "N", tag: "sword", kind: "melee", text: `${C.slash}ダメージ` },
  { id: "guard", name: "盾構え", cost: 1, rarity: "N", tag: "shield", kind: "block", text: `ブロック${C.guard}` },
  { id: "ember", name: "火の粉", cost: 1, rarity: "N", tag: "fire", kind: "fire", text: `燃焼${C.ember}を与える` },
  { id: "herb", name: "薬草", cost: 1, rarity: "N", tag: "holy", kind: "heal", text: `HPを${C.herb}回復` },
  { id: "double", name: "二連突き", cost: 1, rarity: "N", tag: "sword", kind: "melee", text: `${C.double}ダメージ×2` },
  { id: "zap", name: "雷の矢", cost: 0, rarity: "N", tag: "thunder", kind: "thunder", text: `${C.zap}ダメージ` },
  { id: "ironwall", name: "鉄壁", cost: 2, rarity: "N", tag: "shield", kind: "block", text: `ブロック${C.ironwall}` },
  { id: "bigswing", name: "大振り", cost: 2, rarity: "N", tag: "sword", kind: "melee", text: `${C.bigswing}ダメージ` },
  { id: "frost", name: "氷結の息", cost: 1, rarity: "N", tag: null, kind: "ice", text: `${C.frostDmg}ダメージ＋脱力${C.frostWeak}` },
  { id: "cheer", name: "鼓舞", cost: 1, rarity: "N", tag: "fest", kind: "buff", text: `カードを${C.cheerDraw}枚引く` },
  // R
  { id: "fireball", name: "火炎球", cost: 2, rarity: "R", tag: "fire", kind: "fire", text: `${C.fireballDmg}ダメージ＋燃焼${C.fireballBurn}` },
  { id: "chain", name: "稲妻連鎖", cost: 1, rarity: "R", tag: "thunder", kind: "thunder", text: `このターン使ったカード枚数×${C.chainPer}ダメージ` },
  { id: "bash", name: "盾撃", cost: 1, rarity: "R", tag: "shield", kind: "melee", text: "今のブロック値ぶんダメージ" },
  { id: "warcry", name: "雄叫び", cost: 1, rarity: "R", tag: "sword", kind: "buff", text: `筋力+${C.warcryStr}` },
  { id: "matsuri", name: "祭囃子", cost: 0, rarity: "R", tag: "fest", kind: "buff", exhaust: true, text: "エナジー+1、1枚引く。廃棄" },
  { id: "holylight", name: "聖なる光", cost: 2, rarity: "R", tag: "holy", kind: "heal", text: `HP${C.holyHeal}回復＋ブロック${C.holyBlock}` },
  { id: "flurry", name: "連続斬り", cost: 2, rarity: "R", tag: "sword", kind: "melee", text: `${C.flurry}ダメージ×${C.flurryHits}` },
  { id: "inferno", name: "業火", cost: 1, rarity: "R", tag: "fire", kind: "fire", text: "敵の燃焼を2倍にする" },
  { id: "icearmor", name: "氷の鎧", cost: 2, rarity: "R", tag: "shield", kind: "block", text: `ブロック${C.iceArmor}、次のターンもブロックが残る` },
  { id: "vamp", name: "吸血の刃", cost: 2, rarity: "R", tag: "sword", kind: "melee", text: `${C.vamp}ダメージ、与えた半分を回復` },
  // SR
  { id: "meteor", name: "隕石", cost: 3, rarity: "SR", tag: "fire", kind: "fire", text: `${C.meteor}ダメージ` },
  { id: "sworddance", name: "剣の舞", cost: 1, rarity: "SR", tag: "sword", kind: "buff", text: `このターン剣カードのダメージ+${C.swordDance}` },
  { id: "thundergod", name: "雷神の怒り", cost: 2, rarity: "SR", tag: "thunder", kind: "thunder", text: `${C.thunderGodPer}ダメージ×デッキ内の雷カード枚数` },
  { id: "phoenix", name: "不死鳥の羽", cost: 2, rarity: "SR", tag: "fire", kind: "fire", exhaust: true, text: `燃焼${C.phoenixBurn}を与える。廃棄` },
  { id: "rampart", name: "城壁", cost: 3, rarity: "SR", tag: "shield", kind: "block", text: `ブロック${C.rampart}` },
  { id: "hourglass", name: "時の砂時計", cost: 1, rarity: "SR", tag: "fest", kind: "buff", exhaust: true, text: `エナジー+${C.hourglassEnergy}。廃棄` },
  { id: "berserk", name: "狂戦士", cost: 0, rarity: "SR", tag: "sword", kind: "buff", text: `HPを${C.berserkHp}失い筋力+${C.berserkStr}` },
  { id: "mirror", name: "鏡写し", cost: 1, rarity: "SR", tag: "fest", kind: "magic", text: "次に使うカードを2回発動" },
  // UR
  { id: "dragonslayer", name: "竜殺しの剣", cost: 2, rarity: "UR", tag: "sword", kind: "melee", text: `${C.slayer}ダメージ。筋力を${C.slayerStrMul}倍で計算` },
  { id: "fireworks", name: "祭りの大花火", cost: 3, rarity: "UR", tag: "fest", kind: "magic", text: `${C.fireworksPer}ダメージ×デッキ内のカード種類数` },
  { id: "goddess", name: "女神の祝福", cost: 2, rarity: "UR", tag: "holy", kind: "heal", exhaust: true, text: `HP${C.goddessHeal}回復＋ブロック${C.goddessBlock}。廃棄` },
  { id: "grimoire", name: "無限の魔導書", cost: 1, rarity: "UR", tag: "fest", kind: "magic", text: `手札を全部捨て、その枚数+1枚引く。エナジー+${C.grimoireEnergy}` },
];

export const CURSE          = { id: "curse", name: "呪い", cost: 0, rarity: "N", tag: null, kind: "magic", unplayable: true, text: "使えない。戦闘後に消える" };

export const CARD_MAP                          = Object.fromEntries([...CARDS, CURSE].map((c) => [c.id, c]));

export const RARITY_RATE                     = [["N", 0.6], ["R", 0.28], ["SR", 0.1], ["UR", 0.02]];
export const RARITY_ORDER                         = { N: 0, R: 1, SR: 2, UR: 3 };

                         
               
                
                 
               
                
                
                 
                   
 

                           
             
               
             
                    
                      
                                         
                                                    
               
 

export const ENEMIES             = [
  { id: "slime", name: "スライム", hp: 30, bg: "courtyard", size: 0.62, pattern: [{ atk: 6 }, { block: 5 }, { atk: 6 }] },
  { id: "bandit", name: "ゴブリン盗賊", hp: 45, bg: "courtyard", size: 0.78, pattern: [{ atk: 8 }, { atk: 4, hits: 2 }, { atk: 8 }] },
  { id: "general", name: "ゴブリン将軍", hp: 65, bg: "forest", size: 0.85, pattern: [{ atk: 12 }, { str: 2 }, { atk: 10 }] },
  { id: "mage", name: "闇の魔術師", hp: 80, bg: "forest", size: 0.85, pattern: [{ curse: 2 }, { atk: 10, weak: 2 }, { atk: 10 }] },
  { id: "golem", name: "石のゴーレム", hp: 110, bg: "forest", size: 0.88, pattern: [{ block: 15 }, { charge: true }, { atk: 24 }] },
  {
    id: "dragon", name: "炎竜ヴァルガロス", hp: 260, bg: "volcano", size: 0.98,
    pattern: [{ atk: 14 }, { burn: 4 }, { atk: 3, hits: 4 }],
    pattern2: [{ charge: true }, { atk: 30 }, { burn: 6, atk: 10 }],
  },
];

/** Numbers each card's text reads, in order (mirrors C above; i18n uses this). */
export const CARD_TEXT_ARGS                           = {
  slash: [C.slash], guard: [C.guard], ember: [C.ember], herb: [C.herb], double: [C.double, 2], zap: [C.zap],
  ironwall: [C.ironwall], bigswing: [C.bigswing], frost: [C.frostDmg, C.frostWeak], cheer: [C.cheerDraw],
  fireball: [C.fireballDmg, C.fireballBurn], chain: [C.chainPer], bash: [], warcry: [C.warcryStr], matsuri: [],
  holylight: [C.holyHeal, C.holyBlock], flurry: [C.flurry, C.flurryHits], inferno: [], icearmor: [C.iceArmor], vamp: [C.vamp],
  meteor: [C.meteor], sworddance: [C.swordDance], thundergod: [C.thunderGodPer], phoenix: [C.phoenixBurn],
  rampart: [C.rampart], hourglass: [C.hourglassEnergy], berserk: [C.berserkHp, C.berserkStr], mirror: [],
  dragonslayer: [C.slayer, C.slayerStrMul], fireworks: [C.fireworksPer], goddess: [C.goddessHeal, C.goddessBlock],
  grimoire: [C.grimoireEnergy], curse: [],
};

export const PLAYER_MAX_HP = 80;
export const ENERGY_PER_TURN = 3;
export const HAND_SIZE = 5;
export const HAND_MAX = 10;
export const MIN_DECK = 10;
export const BUILD_SECONDS = 60;
export const BONUS_SECONDS = 10;
                                                 
export const MODES                                                 = {
  normal: { build: 60, bonus: 10 },
  hard: { build: 30, bonus: 10 },
  extreme: { build: 30, bonus: 5 },
};
export const WIN_HEAL = 15;
export const BOSS_PHASE2_STR = 3;
