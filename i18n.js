// All player-visible strings. Primary language: zh. Same keys in every set.
                                      
export const LANGS         = ['zh', 'en', 'ja'];
export const LANG_LABEL                       = { zh: '中文', en: 'English', ja: '日本語' };

                                   

const zh       = {
  prism: '无色水晶', prismDesc: '可以代替任意属性的水晶使用', prismShop: '无色水晶商店', prismBuy: '购买', prismOk: '获得 {n} 个无色水晶！', prismUse: '不足部分用无色水晶补 ×{n}', prismHint: '1 金币 = 20 个无色水晶',
  loading: '加载中', tapStart: '点击开始', adventure: '冒险', characters: '角色', settings: '设置',
  language: '语言', sound: '声音', on: '开', off: '关', close: '关闭', back: '返回',
  team: '编队', teamHint: '按住角色拖到上方队伍位置即可替换，轻点查看详情', locked: '未解锁', unlockAt: '通关第{n}关加入',
  stage: '第{n}关', area0: '花之原野', area1: '云之湖', area2: '灯火祭', area3: '星之丘', area4: '月之塔',
  boss: 'BOSS', cleared: '已通关', start: '出击', recommended: '推荐属性', joinReward: '通关奖励：{name} 加入',
  el_fire: '火', el_water: '水', el_wood: '木', el_light: '光', el_dark: '暗',
  shot_bounce: '反射', shot_pierce: '贯通', hp: '体力', atk: '攻击', spd: '速度',
  combo: '友情技', strike: '必杀技', turns: '{n}回合', energyGain: '能量获取', energyFull: '能量已满！', energyHint: '弹射时撞击怪物和队友积攒能量，能量满后下次弹射自动发动',
  combo_laser: '星光激光', combo_laser_d: '向左右发射横向激光',
  combo_cross: '十字光芒', combo_cross_d: '同时发射纵横两道激光',
  combo_blast: '花火爆裂', combo_blast_d: '在自身周围引发爆炸',
  combo_homing: '追踪星弹', combo_homing_d: '发射数颗自动追踪敌人的星弹',
  combo_heal: '治愈之光', combo_heal_d: '回复全队少量体力',
  strike_meteor: '流星雨', strike_meteor_d: '对全体敌人造成大量伤害',
  strike_boost: '极速冲刺', strike_boost_d: '本次弹射速度提升、伤害大幅提升',
  strike_heal: '大治愈', strike_heal_d: '回复全队大量体力',
  tier0: '基础', tier1: '进化', tier2: '觉醒', tierMax: '已达最高阶',
  evolve: '进化', awaken: '觉醒', need: '所需素材', notEnough: '素材不足', evolveDone: '{name} 进化成功！', awakenDone: '{name} 觉醒了！',
  gemsHint: '击败怪物可获得对应属性的星晶', inTeam: '队伍中',
  turn: '回合', wave: '第{n}/{m}波', ready: '可发动', armed: '发动中',
  dragHint: '向后拖拽瞄准，松手弹射', yourTurn: '{name} 的回合',
  strikeReady: '必杀技已就绪！本次弹射自动发动', strikeOn: '必杀技：{name}',
  victory: '胜利！', defeat: '战败…', drops: '获得星晶', newChar: '新伙伴加入！', next: '下一关', retry: '重试', home: '主页',
  pause: '暂停', resume: '继续', retreat: '撤退', retreatQ: '放弃本次战斗返回主页？',
  waveBanner: 'WAVE {n}', bossBanner: 'BOSS 来袭', firstClear: '首次通关奖励',
  title: '少女战记',
  rankRow: '第{n}关 · {t}回合', rankBest: '最佳 第{n}关 · 排名 #{r}', rankLogin: '登录后即可登上排行榜', login: '登录', guest: '玩家',
  allClear: '恭喜通关全部关卡！可以继续挑战或培养角色。', tierLabel: '阶段',
  buyTitle: '解锁角色', buyHint: '花平台金币直接解锁，不用等到第{n}关', buy: '购买解锁', buyPrice: '金币',
  buyOk: '解锁成功！剩余金币 {n}', buyNo: '金币不足，先去攒点金币吧', buyFail: '购买未完成，请稍后重试', buyBusy: '正在处理，请稍等',
  name_mira: '米菈', title0_mira: '晨星少女', title1_mira: '星辉公主',
  name_shizuku: '雫', title0_shizuku: '雨滴少女', title1_shizuku: '雨之巫女',
  name_hina: '日奈', title0_hina: '火花少女', title1_hina: '凤凰舞姬',
  name_wakaba: '若叶', title0_wakaba: '新芽少女', title1_wakaba: '森之妖精女王',
  name_karin: '花铃', title0_karin: '铃兰少女', title1_karin: '樱铃巫女',
  name_shion: '汐音', title0_shion: '贝壳少女', title1_shion: '海之歌姬',
  name_akari: '灯里', title0_akari: '灯笼少女', title1_akari: '祭火巫女',
  name_amane: '天音', title0_amane: '见习天使', title1_amane: '炽天使',
  name_kureha: '红羽', title0_kureha: '夜鸦少女', title1_kureha: '夜鸦公主',
  name_yoruka: '夜花', title0_yoruka: '月夜魔女', title1_yoruka: '月光大魔导',
};

const en       = {
  prism: 'Prism Crystal', prismDesc: 'Can replace a crystal of any element', prismShop: 'Prism Crystal Shop', prismBuy: 'Buy', prismOk: 'Got {n} Prism Crystals!', prismUse: 'Prism Crystals cover the rest ×{n}', prismHint: '1 coin = 20 Prism Crystals',
  loading: 'Loading', tapStart: 'Tap to start', adventure: 'Adventure', characters: 'Heroines', settings: 'Settings',
  language: 'Language', sound: 'Sound', on: 'On', off: 'Off', close: 'Close', back: 'Back',
  team: 'Team', teamHint: 'Drag a heroine onto a team slot to swap; tap for details', locked: 'Locked', unlockAt: 'Joins after Stage {n}',
  stage: 'Stage {n}', area0: 'Flower Meadow', area1: 'Cloud Lake', area2: 'Lantern Festival', area3: 'Star Hill', area4: 'Moon Tower',
  boss: 'BOSS', cleared: 'Cleared', start: 'Go!', recommended: 'Strong element', joinReward: 'Reward: {name} joins',
  el_fire: 'Fire', el_water: 'Water', el_wood: 'Wood', el_light: 'Light', el_dark: 'Dark',
  shot_bounce: 'Bounce', shot_pierce: 'Pierce', hp: 'HP', atk: 'ATK', spd: 'SPD',
  combo: 'Combo', strike: 'Strike Shot', turns: '{n} turns', energyGain: 'Energy gain', energyFull: 'ENERGY MAX!', energyHint: 'Hit monsters and teammates to build energy; when full it fires on her next shot',
  combo_laser: 'Star Laser', combo_laser_d: 'Fires a horizontal laser',
  combo_cross: 'Cross Light', combo_cross_d: 'Fires horizontal and vertical lasers',
  combo_blast: 'Flower Burst', combo_blast_d: 'Explodes around herself',
  combo_homing: 'Homing Stars', combo_homing_d: 'Launches stars that seek enemies',
  combo_heal: 'Healing Light', combo_heal_d: 'Heals the team a little',
  strike_meteor: 'Meteor Shower', strike_meteor_d: 'Heavy damage to all enemies',
  strike_boost: 'Star Dash', strike_boost_d: 'This shot is faster and hits much harder',
  strike_heal: 'Grand Heal', strike_heal_d: 'Heals the team a lot',
  tier0: 'Base', tier1: 'Evolved', tier2: 'Awakened', tierMax: 'Max tier reached',
  evolve: 'Evolve', awaken: 'Awaken', need: 'Materials', notEnough: 'Not enough crystals', evolveDone: '{name} evolved!', awakenDone: '{name} awakened!',
  gemsHint: 'Defeat monsters to collect crystals of their element', inTeam: 'In team',
  turn: 'TURN', wave: 'Wave {n}/{m}', ready: 'READY', armed: 'ON',
  dragHint: 'Drag back to aim, release to shoot', yourTurn: "{name}'s turn",
  strikeReady: 'Strike Shot ready! It fires on this shot', strikeOn: 'Strike: {name}',
  victory: 'Victory!', defeat: 'Defeated…', drops: 'Crystals earned', newChar: 'New heroine joined!', next: 'Next', retry: 'Retry', home: 'Home',
  pause: 'Paused', resume: 'Resume', retreat: 'Retreat', retreatQ: 'Give up this battle and go home?',
  waveBanner: 'WAVE {n}', bossBanner: 'BOSS INCOMING', firstClear: 'First clear bonus',
  title: 'Moe Girl Strike',
  rankRow: 'Stage {n} · {t} turns', rankBest: 'Best: Stage {n} · Rank #{r}', rankLogin: 'Sign in to join the ranking', login: 'Sign in', guest: 'Player',
  allClear: 'All stages cleared! Keep replaying and growing your heroines.', tierLabel: 'Tier',
  buyTitle: 'Unlock heroine', buyHint: 'Unlock now with platform coins instead of waiting for Stage {n}', buy: 'Unlock', buyPrice: 'coins',
  buyOk: 'Unlocked! {n} coins left', buyNo: 'Not enough coins yet', buyFail: 'Purchase not completed, try again later', buyBusy: 'Processing, hold on',
  name_mira: 'Mira', title0_mira: 'Morning Star', title1_mira: 'Starlight Princess',
  name_shizuku: 'Shizuku', title0_shizuku: 'Raindrop Girl', title1_shizuku: 'Rain Priestess',
  name_hina: 'Hina', title0_hina: 'Spark Girl', title1_hina: 'Phoenix Dancer',
  name_wakaba: 'Wakaba', title0_wakaba: 'Sprout Girl', title1_wakaba: 'Fairy Queen',
  name_karin: 'Karin', title0_karin: 'Bellflower Girl', title1_karin: 'Blossom Bell Maiden',
  name_shion: 'Shion', title0_shion: 'Seashell Girl', title1_shion: 'Ocean Songstress',
  name_akari: 'Akari', title0_akari: 'Lantern Girl', title1_akari: 'Festival Flame Maiden',
  name_amane: 'Amane', title0_amane: 'Angel Apprentice', title1_amane: 'Seraph',
  name_kureha: 'Kureha', title0_kureha: 'Night Raven', title1_kureha: 'Raven Princess',
  name_yoruka: 'Yoruka', title0_yoruka: 'Moon Witch', title1_yoruka: 'Moonlight Archmage',
};

const ja       = {
  prism: '無色クリスタル', prismDesc: 'どの属性のクリスタルの代わりにも使える', prismShop: '無色クリスタルショップ', prismBuy: '購入', prismOk: '無色クリスタルを{n}個獲得！', prismUse: '足りない分を無色クリスタルで補う ×{n}', prismHint: '1コイン = 無色クリスタル20個',
  loading: '読み込み中', tapStart: 'タップでスタート', adventure: '冒険', characters: 'キャラ', settings: '設定',
  language: '言語', sound: 'サウンド', on: 'オン', off: 'オフ', close: '閉じる', back: '戻る',
  team: '編成', teamHint: 'キャラを上の枠にドラッグして入れ替え、タップで詳細', locked: '未解放', unlockAt: 'ステージ{n}クリアで加入',
  stage: 'ステージ{n}', area0: '花の原野', area1: '雲の湖', area2: '灯火祭', area3: '星の丘', area4: '月の塔',
  boss: 'BOSS', cleared: 'クリア', start: '出撃', recommended: '有利属性', joinReward: 'クリア報酬：{name} 加入',
  el_fire: '火', el_water: '水', el_wood: '木', el_light: '光', el_dark: '闇',
  shot_bounce: '反射', shot_pierce: '貫通', hp: 'HP', atk: '攻撃', spd: 'スピード',
  combo: '友情コンボ', strike: 'ストライクショット', turns: '{n}ターン', energyGain: 'エネルギー獲得', energyFull: 'エネルギーMAX！', energyHint: 'モンスターや仲間に当たるとエネルギーがたまり、満タンで次のショットに自動発動',
  combo_laser: 'スターレーザー', combo_laser_d: '横方向にレーザーを放つ',
  combo_cross: 'クロスライト', combo_cross_d: '縦横にレーザーを放つ',
  combo_blast: 'フラワーバースト', combo_blast_d: '自身の周囲で爆発する',
  combo_homing: 'ホーミングスター', combo_homing_d: '敵を追尾する星弾を放つ',
  combo_heal: '癒しの光', combo_heal_d: '味方全体のHPを少し回復',
  strike_meteor: '流星群', strike_meteor_d: '敵全体に大ダメージ',
  strike_boost: 'スターダッシュ', strike_boost_d: 'このショットのスピードと威力が大幅アップ',
  strike_heal: 'グランドヒール', strike_heal_d: '味方全体のHPを大きく回復',
  tier0: '基本', tier1: '進化', tier2: '覚醒', tierMax: '最高段階です',
  evolve: '進化', awaken: '覚醒', need: '必要素材', notEnough: '素材が足りません', evolveDone: '{name} が進化した！', awakenDone: '{name} が覚醒した！',
  gemsHint: 'モンスターを倒すとその属性の星晶が手に入る', inTeam: '編成中',
  turn: 'TURN', wave: 'ウェーブ{n}/{m}', ready: '発動可', armed: '発動中',
  dragHint: '後ろに引っ張って狙い、離して発射', yourTurn: '{name} のターン',
  strikeReady: 'ストライクショット準備完了！このショットで自動発動', strikeOn: 'SS：{name}',
  victory: '勝利！', defeat: '敗北…', drops: '獲得した星晶', newChar: '新しい仲間が加入！', next: '次へ', retry: 'リトライ', home: 'ホーム',
  pause: 'ポーズ', resume: '再開', retreat: '撤退', retreatQ: 'バトルをやめてホームに戻る？',
  waveBanner: 'WAVE {n}', bossBanner: 'BOSS 出現', firstClear: '初回クリアボーナス',
  title: '少女ストライク',
  rankRow: 'ステージ{n} · {t}ターン', rankBest: 'ベスト ステージ{n} · {r}位', rankLogin: 'ログインするとランキングに参加できます', login: 'ログイン', guest: 'プレイヤー',
  allClear: '全ステージクリアおめでとう！引き続き挑戦や育成を楽しもう。', tierLabel: '段階',
  buyTitle: 'キャラ解放', buyHint: 'プラットフォームコインで今すぐ解放（ステージ{n}まで待たない）', buy: '解放する', buyPrice: 'コイン',
  buyOk: '解放しました！残り{n}コイン', buyNo: 'コインが足りません', buyFail: '購入が完了しませんでした。後でもう一度', buyBusy: '処理中です',
  name_mira: 'ミラ', title0_mira: '明けの星の少女', title1_mira: '星輝の姫',
  name_shizuku: 'シズク', title0_shizuku: '雨粒の少女', title1_shizuku: '雨の巫女',
  name_hina: 'ヒナ', title0_hina: '火花の少女', title1_hina: '鳳凰の舞姫',
  name_wakaba: 'ワカバ', title0_wakaba: '若芽の少女', title1_wakaba: '森の妖精女王',
  name_karin: 'カリン', title0_karin: '鈴蘭の少女', title1_karin: '桜鈴の巫女',
  name_shion: 'シオン', title0_shion: '貝殻の少女', title1_shion: '海の歌姫',
  name_akari: 'アカリ', title0_akari: '提灯の少女', title1_akari: '祭火の巫女',
  name_amane: 'アマネ', title0_amane: '見習い天使', title1_amane: '熾天使',
  name_kureha: 'クレハ', title0_kureha: '夜鴉の少女', title1_kureha: '夜鴉の姫',
  name_yoruka: 'ヨルカ', title0_yoruka: '月夜の魔女', title1_yoruka: '月光の大魔導',
};

const DICTS                     = { zh, en, ja };
/** A heroine's name in every shipped language — for gp.pay's titles {en,zh,ja}. */
export function nameAll(id        )                  { return { zh: DICTS.zh['name_' + id], en: DICTS.en['name_' + id], ja: DICTS.ja['name_' + id] }; }
export let lang       = 'zh';

export function pickLang(locale                )       {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('en')) return 'en';
  return 'zh';
}

export function setLang(l      ) {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
}

export function t(key        , vars                                  )         {
  let s = DICTS[lang][key] ?? DICTS.zh[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
}

export const FONT = '"PingFang SC","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei","Yu Gothic",sans-serif';
