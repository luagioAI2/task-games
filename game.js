// 糖珠不挂科 —— 入口：场景组装、五层战斗编排、技能/连携、HUD 与界面层
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { Board, BOARD_W, BOARD_H } from './src/board.js';
                                           
import { sched, EaseOutQuad, EaseInQuad, EaseOutBack } from './src/tween.js';
import { AudioMan } from './src/audio.js';

// ---------- 常量（色板见 ART_DIRECTION.md） ----------
const W = 420;
const H = 800;
const BOARD_Y = 420;
const PAL = {
  cream: 0xfff9ee,
  red: 0xff9f5a,
  blue: 0x8fd3ee,
  green: 0xa8d8a0,
  yellow: 0xffe38a,
  heart: 0xffb9d2,
  brown: 0x8a6d5c,
  purple: 0xc4b2e0,
  boardBg: 0xefe3ec,
};
const MENU_PAL = {
  wine: 0x592d46,
  wineLight: 0x754259,
  coral: 0xea7561,
  coralLight: 0xf29a7f,
  gold: 0xd8aa58,
  goldLight: 0xffe7a8,
  cocoa: 0x6c4a3d,
  cream: 0xfff3dc,
  paper: 0xfff4e6,
  teal: 0x4f98a5,
  violet: 0x806789,
  line: 0xe9c98e,
  ink: 0x725343,
};
const UI_ELEVATION = {
  panel: { offset: 2, alpha: 0.022 },
  card: { offset: 2, alpha: 0.018 },
  button: { offset: 3, alpha: 0.045 },
  modal: { offset: 4, alpha: 0.055 },
};
const ORB_COLORS = [PAL.red, PAL.blue, PAL.green, PAL.yellow, PAL.heart];
const TYPE = { R: 0, B: 1, G: 2, Y: 3, H: 4 }         ;
const PHASE = { Title: 0, Idle: 1, Drag: 2, Busy: 3, Over: 4 }         ;

// ---------- 多语言（中/英/日/韩） ----------
let LANG         = localStorage.getItem('tz_lang') || '';
const S                                         = {
  sub: { zh: '甜点魔法学院 · 放学补考', en: 'Sweet Magic Academy · After-School Exam', ja: 'スイーツ魔法学園・放課後の追試', ko: '디저트 마법학원 · 방과 후 시험' },
  tip: { zh: '按住糖珠自由拖动，5 秒排出三连\n三色 ×1.5 · 四色 ×1.8 · 五色彩虹圣代 ×2.2', en: 'Hold & drag an orb freely — match 3+ in 5 seconds!\n3 colors ×1.5 · 4 colors ×1.8 · 5-color Rainbow ×2.2', ja: 'ドロップを自由に動かして5秒で3つ揃え！\n3色×1.5・4色×1.8・5色レインボー×2.2', ko: '구슬을 자유롭게 드래그해 5초 안에 3개!\n3색 ×1.5 · 4색 ×1.8 · 5색 무지개 ×2.2' },
  menuRule: { zh: '拖动消除  ·  充能战斗  ·  培养进化', en: 'MATCH  ·  CHARGE  ·  EVOLVE', ja: '消す  ·  チャージ  ·  進化', ko: '매치  ·  충전  ·  진화' },
  start: { zh: '开始', en: 'Start', ja: 'スタート', ko: '시작' },
  floor0: { zh: '第 1 层 · 奶油操场', en: 'Floor 1 · Cream Yard', ja: '1層・クリーム校庭', ko: '1층 · 크림 운动场' },
  floor1: { zh: '第 2 层 · 软糖走廊', en: 'Floor 2 · Gummy Hallway', ja: '2層・グミの廊下', ko: '2층 · 젤리 복도' },
  floor2: { zh: '第 3 层 · 泡芙教室', en: 'Floor 3 · Puff Classroom', ja: '3層・シュークリーム教室', ko: '3층 · 슈크림 교실' },
  floor3: { zh: '第 4 层 · 闪电泡芙考场', en: 'Floor 4 · Éclair Exam Hall', ja: '4層・エクレア試験場', ko: '4층 · 에클莱어 시험장' },
  floor4: { zh: '第 5 层 · 冰淇淋冷柜', en: 'Floor 5 · Ice Cream Freezer', ja: '5層・アイス冷凍庫', ko: '5층 · 아이스크림 냉장고' },
  floor5: { zh: '第 6 层 · 焦糖档案室', en: 'Floor 6 · Caramel Archive', ja: '6層・キャラメル資料室', ko: '6층 · 캐러멜 자료실' },
  floor6: { zh: '第 7 层 · 彩虹实验室', en: 'Floor 7 · Rainbow Lab', ja: '7層・レインボー実験室', ko: '7층 · 무지개 실험실' },
  floor7: { zh: '第 8 层 · 皇家烤箱', en: 'Floor 8 · Royal Oven', ja: '8層・ロイヤルオーブン', ko: '8층 · 로열 오븐' },
  floor8: { zh: '第 9 层 · 校监前厅', en: 'Floor 9 · Principal Hall', ja: '9層・校長前室', ko: '9층 · 교장 전실' },
  floor9: { zh: '最终层 · 布丁校监室', en: 'Final · Pudding Principal', ja: '最終層・プリン校長室', ko: '최종층 · 푸딩 교장실' },
  statusDef: { zh: '拖动糖珠，排出三连！', en: 'Drag orbs to match 3!', ja: 'ドロップを動かして3つ揃えよう！', ko: '구슬을 드래그해 3개를 맞춰요!' },
  skill0: { zh: '香橙爆裂！', en: 'Orange Burst!', ja: 'オレンジバースト！', ko: '오렌지 버스트!' },
  skill1: { zh: '汽水泡盾！', en: 'Soda Bubble!', ja: 'ソーダバブル！', ko: '소다 버블!' },
  skill2: { zh: '抹茶转化！', en: 'Matcha Change!', ja: '抹茶チェンジ！', ko: '말차 체인지!' },
  skill3: { zh: '柠檬急救！', en: 'Lemon Rescue!', ja: 'レモンレスキュー！', ko: '레몬 구출!' },
  skill4: { zh: '奶油急救！', en: 'Cream Rescue!', ja: 'クリームレスキュー！', ko: '크림 구출!' },
  bubDrag: { zh: '按住糖珠自由拖动，5 秒内排出三连！', en: 'Hold and drag freely — match 3 in 5 seconds!', ja: '自由に動かして、5秒で3つ揃えよう！', ko: '자유롭게 드래그해 5초 안에 3개를 맞춰요!' },
  bubShield: { zh: '精英护盾：消除与护盾同色的糖珠可击碎！', en: "Elite shield: match the shield's color to break it!", ja: 'シールド：同じ色のドロップを消すと破壊！', ko: '엘리트 실드: 같은 색 구슬을 지우면 파괴!' },
  bubHeal: { zh: '棉花糖会治疗同伴，优先集火它！', en: 'Marshmallow heals its friends — focus it first!', ja: 'マシュマロは仲間を回復する！優先しよう！', ko: '마시멜로는 동료를 치유해요. 먼저 공략하세요!' },
  bubSplit: { zh: '甜甜圈被击败后会分裂成两个小的！', en: 'Donut splits into two minis when defeated!', ja: 'ドーナツは倒すと2つに分裂する！', ko: '도넛은 쓰러지면 둘로 분열해요!' },
  bubCounter: { zh: '姜饼人会反击每一次攻击，注意血量！', en: 'Gingerbread counters every hit — watch your HP!', ja: 'ジンジャーは反撃する！HPに注意！', ko: '진저는 매번 반격해요. HP 주의!' },
  bubTaunt: { zh: '蜂蜜罐嘲讽：它在场时只能攻击它！', en: 'Honey pot taunts: you can only target it!', ja: 'ハチミツ壺が挑発！そいつしか狙えない！', ko: '꿀단지 도발: 얘만 공격할 수 있어요!' },
  bubCap: { zh: '巧克力骑士：单次受击最多掉 1500！', en: 'Choco knight: max 1500 damage per hit!', ja: 'チョコ騎士：1回のダメージは1500まで！', ko: '초코 기사: 한 번에 최대 1500 피해!' },
  sealCast: { zh: '奶油封印！', en: 'Cream seal!', ja: 'クリーム封印！', ko: '크림 봉인!' },
  bubSeal: { zh: '奶油封印：包含它的消除会先碎掉封印！', en: 'Cream seal: any match including it breaks the seal!', ja: 'クリーム封印：消すと封印がはがれる！', ko: '크림 봉인: 지우면 봉인이 풀려요!' },
  bubSkill: { zh: '同色消除给对应小动物充能，充满自动放技能！', en: 'Match a color to charge that buddy — full bar = auto skill!', ja: '同色を消すと仲間が充電！満タンで自動スキル！', ko: '같은 색을 지우면 충전! 가득 차면 자동 스킬!' },
  tut1: { zh: '欢迎来到甜点魔法补习！', en: 'Welcome to the Sweet Magic exam!', ja: 'スイーツ魔法の追試へようこそ！', ko: '디저트 마법 보충 수업에 온 걸 환영해!' },
  tut2: { zh: '按住糖珠，上下左右随便拖——5 秒内想拖多远就拖多远！', en: 'Hold an orb and drag freely — as far as you want in 5 seconds!', ja: 'ドロップを長押しして自由に動かそう！5秒間どこまでも！', ko: '구슬을 누르고 자유롭게 드래그 — 5초 안에 원하는 만큼!' },
  tut3: { zh: '试试：把橙色糖珠向上拖一格，凑成三连！', en: 'Try it: drag the orange orb up one cell to match 3!', ja: 'オレンジを1つ上に動かして3つ揃えよう！', ko: '주황 구슬을 위로 한 칸 끌어 3개를 맞춰봐!' },
  tutDone: { zh: '做得好！正式开考吧！', en: 'Well done! Let the exam begin!', ja: 'ナイス！試験スタート！', ko: '잘했어! 이제 시작이야!' },
  tut2b: { zh: '很好！这次拖远一点：把橙色糖珠一路向上拖三格！', en: 'Great! Now farther: drag the orange orb up three cells!', ja: 'いいね！次はもっと遠く：オレンジを3つ上へ！', ko: '좋아! 이번엔 멀리: 주황 구슬을 위로 세 칸!' },
  tut3b: { zh: '同色消除会给对应小动物充能——充满就自动放技能！去战斗吧！', en: 'Matching a color charges that buddy — a full bar fires its skill! Go fight!', ja: '同色を消すと仲間が充電！満タンで自動スキル！さあ戦おう！', ko: '같은 색을 지우면 충전! 가득 차면 자동 스킬! 싸우러 가자!' },
  tutTarget: { zh: '敌人不止一只时，点按想打的那只就能集火它！试试点右边的橘子团子', en: 'With multiple enemies, tap the one you want to focus! Try tapping the mandarin blob on the right', ja: '敵が複数いる時は、狙いたい敵をタップで集火！右のみかん団子をタップしてみて', ko: '적이 여러 마리면 공격할 적을 터치해 집중! 오른쪽 귤 몬을 터치필 보세요' },
  story1: { zh: '放学后，甜点魔法学院的厨房突然大乱——', en: 'After school, chaos erupts in the academy kitchen…', ja: '放課後、スイーツ魔法学園の厨房が大騒ぎに——', ko: '방과 후, 디저트 마법학원의 주방이 뒤집혔다…' },
  story2: { zh: '布丁校监大发雷霆：“你们的点心全都变成怪物了！”', en: 'Principal Pudding roars: "Your desserts have all turned into monsters!"', ja: 'プリン校長が激怒：「お前たちのお菓子が全部モンスターになった！」', ko: '푸딩 교장의 호통: "디저트가 전부 몬스터가 됐다!"' },
  story3: { zh: '五只小动物举起法杖：穿过十层考场，把点心怪变回来吧！', en: 'Five little witches grab their wands: clear ten floors and turn the desserts back!', ja: '5匹の小魔女が杖を取る：10の試験を突破してお菓子を取り戻せ！', ko: '다섯 마리 작은 마녀들: 10개 층을 돌파해 디저트를 되찾자!' },
  storySkip: { zh: '点按继续', en: 'Tap to continue', ja: 'タップで続く', ko: '터치해서 계속' },
  nameOrange: { zh: '橙团子', en: 'Orange', ja: 'オレンジ', ko: '오렌지' },
  nameBlue: { zh: '蓝团子', en: 'Blue', ja: 'ブルー', ko: '블루' },
  nameGreen: { zh: '绿团子', en: 'Green', ja: 'グリーン', ko: '그린' },
  nameYellow: { zh: '黄团子', en: 'Yellow', ja: 'イエロー', ko: '옐로' },
  namePink: { zh: '粉团子', en: 'Pink', ja: 'ピンク', ko: '핑크' },
  nameMob: { zh: '点心怪们', en: 'Dessert Monsters', ja: 'お菓子モンスター', ko: '디저트 몬스터' },
  nameBoss: { zh: '布丁校监', en: 'Principal Pudding', ja: 'プリン校長', ko: '푸딩 교장' },
  d0a: { zh: '第一场补考！热身而已，看我一次三连解决它们！', en: 'First exam! Just a warm-up — watch me match them away!', ja: '一発目の追試！準備運動だよ——3つ揃えで倒す！', ko: '첫 시험! 몸풀기야 — 3개 매치로 해결!' },
  d0b: { zh: '咕噜咕噜……（史莱姆和橘子团子完全没在怕）', en: 'Blub blub… (The slime and mandarin blob are not scared at all.)', ja: 'プルプル……（全然怖がっていない）', ko: '말랑말랑… (전혀 겁먹지 않았다)' },
  d0c: { zh: '别大意，攒满我们的条才能放技能哦。', en: 'Careful — we need full bars to fire our skills.', ja: '油断しないで。ゲージ満タンでスキルだよ', ko: '방심 마. 게이지가 차야 스킬이 나가.' },
  d1a: { zh: '这条走廊的蝙蝠好吵……那个护士一直在给它们回血。', en: 'Those bats are so loud… and that nurse keeps healing them.', ja: 'この廊下、コウモリがうるさい……看護師がずっと回復してる', ko: '박쥐가 시끄럽네… 간호사가 계속 치유해.' },
  d1b: { zh: '先打护士！姜饼人交给我——哎哟它会反击？！', en: 'Get the nurse first! Leave the gingerbread to— ow, it counters?!', ja: '看護師から倒そう！ジンジャーは私が——いたっ、反撃！？', ko: '간호사부터! 진저는 내가—— 앗, 반격?!' },
  d1c: { zh: '集火一个打，别分散火力！', en: 'Focus fire! Don’t spread out!', ja: '一点集中でいこう！', ko: '한 놈씩 집중 공격!' },
  d2a: { zh: '泡芙怕同色糖珠——红泡芙用橙珠打，绿泡芙用绿珠！', en: 'Puffs fear their own color — orange for the red puff, green for the green one!', ja: 'シュークリームは同色が弱点——赤にはオレンジ、緑には緑！', ko: '슈크림은 같은 색이 약점 — 빨강엔 주황, 초록엔 초록!' },
  d2b: { zh: '中间的甜甜圈交给我！……等等，它怎么越打越多？！', en: 'The donut in the middle is mine! …Wait, why are there MORE of them?!', ja: '真ん中のドーナツは任せて！……って、増えてる！？', ko: '가운데 도넛은 내가! …잠깐, 왜 늘어나?!' },
  d2c: { zh: '噗噗！', en: 'Puff puff!', ja: 'ププッ！', ko: '뿌뿌!' },
  d3a: { zh: '那件盔甲的护盾每两回合换一种颜色……看好了再打。', en: 'That armor’s shield changes color every two turns… watch before you strike.', ja: 'あの鎧、2ターンごとにシールドの色が変わる……よく見て。', ko: '저 갑옷, 두 턴마다 실드 색이 바뀌어… 잘 보고 쳐.' },
  d3b: { zh: '旁边的马卡龙在蓄大招！赶在第三回合前削它！', en: 'The macaron is charging a big slam! Burn it before turn three!', ja: 'マカロンが大技を溜めてる！3ターン目までに削れ！', ko: '마카롱이 강타를 모아! 3턴 전에 녹여!' },
  d3c: { zh: '（闪电泡芙得意地晃着盔甲）', en: '(The éclair proudly wiggles its armor.)', ja: '（エクレアが鎧を得意げに揺らしている）', ko: '(에클레어가 갑옷을 자랑스럽게 흔든다)' },
  d4a: { zh: '好冷……术士会把我们的糖珠冻上奶油封印！', en: 'So cold… the wizard will freeze cream seals onto our orbs!', ja: 'さむい……術士がドロップをクリーム封印してくる！', ko: '추워… 마법사가 구슬을 크림 봉인해!' },
  d4b: { zh: '蜂蜜罐在嘲讽我们！只能先打它了，忍耐一下！', en: 'The honey pot is taunting us! We have to hit it first — hang in there!', ja: 'ハチミツ壺が挑発してる！先にそいつを倒すしかない！', ko: '꿀단지가 도발해! 얘부터 쳐야 해, 참아!' },
  d4c: { zh: '巧克力骑士硬得离谱，单次伤害有上限——多段攻击磨它！', en: 'The choco knight is rock hard — damage per hit is capped. Grind it down!', ja: 'チョコ騎士は固い！1発の上限あり——多段で削れ！', ko: '초코 기사는 너무 단단해 — 타격 상한 있어. 여러 번 갈아!' },
  d5a: { zh: '档案室还有第二轮守卫：护士、反击兵和蓝泡芙一起上了！', en: 'A second guard squad: nurse, counter fighter, and blue puff together!', ja: '資料室の第二守備隊だ！看護師、反撃兵、青シューが一緒に来る！', ko: '자료실 2차 수비대야! 간호사, 반격병, 파란 슈가 함께 온다!' },
  d5b: { zh: '先压住治疗，再用蓝色技能打泡芙弱点，别被拖进消耗战。', en: 'Stop the healing, then hit the blue puff weakness. Avoid a long fight.', ja: '回復を止めて、青の弱点を突こう。長期戦は避けて！', ko: '회복부터 막고 파란 약점을 노려. 장기전은 피하자!' },
  d5c: { zh: '嘿嘿，档案可不是白拿的！', en: 'Heh-heh, those files are not free!', ja: 'へへっ、資料はタダじゃないぞ！', ko: '헤헤, 자료는 공짜가 아니지!' },
  d6a: { zh: '蜂蜜罐挡在前面，甜甜圈会分裂，后面还有限伤骑士……真会排阵。', en: 'Honey taunts up front, donut splits, and a damage-cap knight waits behind.', ja: '前は挑発ハニー、分裂ドーナツ、後ろにダメージ上限の騎士か。', ko: '앞엔 도발 꿀단지, 분열 도넛, 뒤엔 피해 상한 기사라니.' },
  d6b: { zh: '按顺序拆：蜂蜜罐、甜甜圈、骑士。大招别全砸在限伤上！', en: 'Break the formation in order. Do not waste every burst on the capped knight!', ja: '順番に崩そう。上限のある騎士に大技を全部使わないで！', ko: '순서대로 무너뜨려. 상한 기사에게 필살기를 몰아 쓰지 마!' },
  d6c: { zh: '这一层开始，阵容克制比单纯堆伤害更重要。', en: 'From here on, target order matters more than raw damage.', ja: 'ここからは火力より狙う順番が大事だよ。', ko: '이제부터는 화력보다 공격 순서가 더 중요해.' },
  d7a: { zh: '皇家烤箱里是四色盾卫，旁边的冰淇淋术士还会不断封珠。', en: 'A four-color shield guard and an ice-cream sealer defend the royal oven.', ja: '四色シールド衛兵と封印術士がロイヤルオーブンを守ってる。', ko: '4색 방패병과 봉인 마법사가 로열 오븐을 지키고 있어.' },
  d7b: { zh: '看清护盾颜色再出手；封印太多时，先处理术士。', en: 'Read the shield color before attacking; remove the sealer if seals pile up.', ja: '盾の色を見て攻撃。封印が増えたら術士を先に倒そう。', ko: '방패 색을 보고 공격해. 봉인이 쌓이면 마법사부터 처리하자.' },
  d7c: { zh: '终于像真正的毕业考试了，我开始紧张了……', en: 'Now this feels like a real final exam. I am getting nervous…', ja: '本当の卒業試験みたい……ちょっと緊張してきた。', ko: '이제 진짜 졸업 시험 같아… 조금 긴장되네.' },
  d8a: { zh: '校监前厅全是精锐：重盾、重锤，再加一只蓝泡芙。', en: 'The principal hall is all elites: heavy shield, heavy hammer, and blue puff.', ja: '校長前室は精鋭だらけ。重盾、重槌、それに青シュー！', ko: '교장 전실은 정예뿐이야. 중방패, 중망치, 파란 슈까지!' },
  d8b: { zh: '这是最后的资源检查。该进化谁、该留什么技能，现在就决定。', en: 'This is the final resource check. Choose evolutions and saved skills wisely.', ja: '最後の戦力確認だ。進化先と残すスキルを今決めよう。', ko: '마지막 전력 점검이야. 진화와 남길 스킬을 지금 정하자.' },
  d8c: { zh: '冲过去，布丁校监就在门后！', en: 'Break through. Principal Pudding is behind that door!', ja: '突破しよう。扉の向こうにプリン校長がいる！', ko: '돌파하자. 문 뒤에 푸딩 교장이 있어!' },
  d9a: { zh: '哼，一群不及格的点心师。让校监我亲自监考！', en: 'Hmph, a bunch of failing pastry chefs. I will proctor this myself!', ja: 'ふん、落第点心師たち。校長の私が直々に試験する！', ko: '흥, 낙제 파티시에들. 교장인 내가 직접 시험한다!' },
  d9b: { zh: '全员集合！把他打到半血他会暴怒——留好技能！', en: 'Everyone together! He rages at half HP — save your skills!', ja: '全員集合！HP半分で怒るから——スキルを残して！', ko: '전원 집합! HP 절반에서 분노해 — 스킬 아껴둬!' },
  d9c: { zh: '这场过了就全员及格！上啊！', en: 'Pass this and we all graduate! Let’s go!', ja: 'これに勝てば全員合格！行くよ！', ko: '이기면 전원 합격! 가자!' },
  roster0: { zh: '香橙爆裂：5000 单体爆发', en: 'Orange Burst: 5000 single burst', ja: 'オレンジバースト：5000単体攻撃', ko: '오렌지 버스트: 5000 단일 폭발' },
  roster1: { zh: '汽水泡盾：伤害 + 减半敌人攻击', en: 'Soda Bubble: dmg + halve enemy hit', ja: 'ソーダバブル：攻撃＋敵の次撃半減', ko: '소다 버블: 피해 + 적 다음 공격 반감' },
  roster2: { zh: '抹茶转化：伤害 + 转化 3 颗绿珠', en: 'Matcha Change: dmg + 3 orbs to green', ja: '抹茶チェンジ：攻撃＋3個緑変換', ko: '말차 체인지: 피해 + 3개 초록 변환' },
  roster3: { zh: '柠檬急救：伤害 + 全员回血 300', en: 'Lemon Rescue: dmg + heal team 300', ja: 'レモンレスキュー：攻撃＋全員300回復', ko: '레몬 구출: 피해 + 전원 300 회복' },
  roster4: { zh: '奶油急救：全员回血 400', en: 'Cream Rescue: heal team 400', ja: 'クリームレスキュー：全員400回復', ko: '크림 구출: 전원 400 회복' },
  clearReward: { zh: '全员恢复 +200', en: 'Team heal +200', ja: '全員回復 +200', ko: '전원 회복 +200' },
  evolveTitle: { zh: '进化！', en: 'Evolution!', ja: '進化！', ko: '진화!' },
  evolvePower: { zh: '招牌技能威力提升', en: 'Signature skill powered up', ja: '必殺技がパワーアップ', ko: '필살기 위력 상승' },
  evolutionTab: { zh: '角色进化', en: 'Evolution', ja: 'キャラ進化', ko: '캐릭터 진화' },
  evolutionShort: { zh: '进化', en: 'Evolve', ja: '進化', ko: '진화' },
  evolutionExp: { zh: '进化经验', en: 'Evolution EXP', ja: '進化EXP', ko: '진화 EXP' },
  evolutionHint: { zh: '战斗获得共享 EXP，由你决定进化谁', en: 'Earn shared EXP in battle and choose who evolves', ja: '戦闘で共通EXPを獲得し、進化先を選ぼう', ko: '전투에서 공용 EXP를 얻고 진화 대상을 선택하세요' },
  evolutionBuy: { zh: '进化', en: 'Evolve', ja: '進化', ko: '진화' },
  evolutionNeed: { zh: '还差 {x}', en: 'Need {x}', ja: 'あと {x}', ko: '{x} 부족' },
  evolutionMax: { zh: '最终形态', en: 'MAX FORM', ja: '最終形態', ko: '최종 형태' },
  evolutionPowerShort: { zh: '技能', en: 'Skill', ja: 'スキル', ko: '스킬' },
  evolutionReady: { zh: '可进化！', en: 'READY!', ja: '進化可能！', ko: '진화 가능!' },
  evolutionReadyNoticeTitle: { zh: '进化时刻到了！', en: 'Evolution is ready!', ja: '進化の準備完了！', ko: '진화 준비 완료!' },
  evolutionReadyNoticeBody: { zh: '进化经验已经达标\n右下角按钮会持续发光，点击后选择要进化的角色', en: 'You have enough Evolution EXP.\nThe glowing button opens your hero choices.', ja: '進化EXPがたまりました。\n光るボタンから進化する仲間を選べます。', ko: '진화 EXP가 충분해요.\n빛나는 버튼에서 진화할 캐릭터를 고르세요.' },
  evolutionGo: { zh: '前往进化', en: 'Evolve Now', ja: '進化へ', ko: '진화하러 가기' },
  evolutionLater: { zh: '稍后再说', en: 'Later', ja: 'あとで', ko: '나중에' },
  stageSmall: { zh: '小形态', en: 'Small Form', ja: 'ちび形態', ko: '소형' },
  stageMedium: { zh: '中形态', en: 'Medium Form', ja: '中形態', ko: '중형' },
  stageLarge: { zh: '大形态', en: 'Large Form', ja: '大形態', ko: '대형' },
  mapTitle: { zh: '关卡地图', en: 'Stage Map', ja: 'ステージマップ', ko: '스테이지 맵' },
  floorTime: { zh: '本层用时 {x}', en: 'Time {x}', ja: 'タイム {x}', ko: '시간 {x}' },
  mapHint: { zh: '点亮的层可以重打哦', en: 'Cleared floors can be replayed', ja: 'クリア済みの層は再挑戦できる', ko: '클리어한 층은 다시 도전 가능' },
  continueBtn: { zh: '继续前进', en: 'Continue', ja: '次へ', ko: '계속' },
  startGame: { zh: '开始游戏', en: 'Start Game', ja: 'ゲーム開始', ko: '게임 시작' },
  selectStage: { zh: '选择关卡', en: 'Stage Select', ja: 'ステージ選択', ko: '스테이지 선택' },
  settings: { zh: '设置', en: 'Settings', ja: '設定', ko: '설정' },
  leaderboard: { zh: '排行榜', en: 'Leaderboard', ja: 'ランキング', ko: '랭킹' },
  leaderboardSub: { zh: '本机最佳挑战记录', en: 'Best runs on this device', ja: 'この端末のベスト記録', ko: '이 기기의 최고 기록' },
  leaderboardRule: { zh: '按进度、评级、生命与速度综合排名', en: 'Ranked by progress, grade, HP and speed', ja: '進行度・評価・HP・速度の総合順位', ko: '진행·등급·HP·속도 종합 순위' },
  leaderboardEmpty: { zh: '还没有挑战记录\n完成或结束一局后就会出现在这里', en: 'No runs yet\nFinish a run to enter the board', ja: 'まだ記録がありません\nプレイ後にここに表示されます', ko: '아직 기록이 없어요\n플레이를 마치면 여기에 표시돼요' },
  leaderboardScore: { zh: '综合分', en: 'SCORE', ja: 'スコア', ko: '점수' },
  leaderboardFloor: { zh: '进度', en: 'FLOOR', ja: '進行', ko: '진행' },
  leaderboardGrade: { zh: '评级', en: 'GRADE', ja: '評価', ko: '등급' },
  leaderboardTime: { zh: '用时', en: 'TIME', ja: 'タイム', ko: '시간' },
  leaderboardPlace: { zh: '排行榜第 {x} 名', en: 'Leaderboard #{x}', ja: 'ランキング {x}位', ko: '랭킹 {x}위' },
  leaderboardBest: { zh: '当前榜首', en: 'CURRENT BEST', ja: '現在の1位', ko: '현재 1위' },
  sfxVol: { zh: '音效音量', en: 'SFX Volume', ja: '効果音の音量', ko: '효과음 볼륨' },
  back: { zh: '返回', en: 'Back', ja: '戻る', ko: '뒤로' },
  toTitle: { zh: '返回主界面', en: 'Main Menu', ja: 'タイトルへ', ko: '메인으로' },
  starRule: { zh: '评星：剩余总血量 ≥4000 ★★★ / ≥2000 ★★', en: 'Stars: HP left ≥4000 ★★★ / ≥2000 ★★', ja: '星：残りHP≥4000で★3 / ≥2000で★2', ko: '평가: 남은 HP ≥4000 ★★★ / ≥2000 ★★' },
  fstory0: { zh: '热身考！奶油史莱姆和橘子团子在操场上等你——拖出三连，给它们点颜色看看！', en: 'Warm-up exam! The cream slime and mandarin blob await — show them your matches!', ja: 'ウォームアップ試験！クリームスライムとみかん団子が校庭で待っている！', ko: '워밍업 시험! 크림 슬라임과 귤 몬이 운다장에서 기다려요!' },
  fstory1: { zh: '软糖走廊：蝙蝠成群巡逻，棉花糖护士会给同伴回血，姜饼人被打会反击——先集火护士！', en: 'Gummy Hallway: bats patrol, the marshmallow nurse heals friends, gingerbread counters — take out the nurse first!', ja: 'グミの廊下：コウモリが巡回、マシュマロ看護師が回復、ジンジャーは反撃！', ko: '젤리 복도: 박쥐 순찰, 마시멜로 간호사는 치유, 진저는 반격!' },
  fstory2: { zh: '泡芙教室的弱点课：泡芙怕同色糖珠！中间的甜甜圈倒下会分裂成两个小的。', en: 'Puff Classroom: puffs fear their own color! The donut splits into two when defeated.', ja: 'シュークリーム教室：同色ドロップが弱点！ドーナツは分裂するぞ。', ko: '슈크림 교실: 같은 색이 약점! 도넛은 쓰러지면 분열!' },
  fstory3: { zh: '闪电泡芙披着四色护盾轮番切换，马卡龙重坦三回合一记重锤——很疼！', en: 'The éclair cycles a 4-color shield; the macaron tank slams hard every 3 turns!', ja: 'エクレアは4色シールド交代！マカロンの3ターン重撃に注意！', ko: '에클레어는 4색 실드 교체! 마카롱의 3턴 강타 조심!' },
  fstory4: { zh: '冰淇淋冷柜大混战：术士给糖珠上封印，蜂蜜罐强迫你只打它，巧克力骑士单次最多掉 1500！', en: 'Freezer brawl: the wizard seals orbs, the honey pot taunts, the choco knight caps each hit at 1500!', ja: 'アイス冷凍庫：術士が封印！ハチミツ壺が挑発！チョコ騎士は1発1500まで！', ko: '냉장고大乱闘： 마법사 봉인, 꿀단지 도발, 초코 기사는 1500 상한!' },
  fstory5: { zh: '焦糖档案室：治疗、反击与属性弱点首次组成完整战术小队。', en: 'Caramel Archive: healing, counters, and weakness form a tactical squad.', ja: 'キャラメル資料室：回復、反撃、弱点が戦術チームを組む。', ko: '캐러멜 자료실: 회복, 반격, 약점이 전술 부대를 이룬다.' },
  fstory6: { zh: '彩虹实验室：嘲讽、分裂与单次限伤要求严格规划攻击顺序。', en: 'Rainbow Lab: taunt, split, and damage cap demand careful target order.', ja: 'レインボー実験室：挑発、分裂、上限を順番に攻略しよう。', ko: '무지개 실험실: 도발, 분열, 피해 상한을 순서대로 공략하자.' },
  fstory7: { zh: '皇家烤箱：轮换护盾与奶油封印同时施压。', en: 'Royal Oven: rotating shields and cream seals attack together.', ja: 'ロイヤルオーブン：交代シールドとクリーム封印の同時攻撃。', ko: '로열 오븐: 회전 방패와 크림 봉인이 동시에 압박한다.' },
  fstory8: { zh: '校监前厅：三名强化精锐把守最后一道门。', en: 'Principal Hall: three empowered elites guard the final door.', ja: '校長前室：強化された三体の精鋭が最後の扉を守る。', ko: '교장 전실: 강화된 정예 셋이 마지막 문을 지킨다.' },
  fstory9: { zh: '最终补考！布丁校监亲自坐镇——半血暴怒并封印糖珠！', en: 'The final exam! Principal Pudding rages at half HP and seals your orbs!', ja: '最終試験！プリン校長はHP半分で怒り、ドロップを封印する！', ko: '최종 시험! 푸딩 교장은 절반 체력에서 분노하고 구슬을 봉인한다!' },
  delSave: { zh: '删除存档', en: 'Delete Save', ja: 'セーブ削除', ko: '저장 삭제' },
  delConfirm: { zh: '确认删除？', en: 'Confirm delete?', ja: '本当に削除？', ko: '정말 삭제?' },
  praiseNice: { zh: '不错！', en: 'Nice!', ja: 'ナイス！', ko: '나이스!' },
  praiseGreat: { zh: '太棒了！', en: 'Great!', ja: 'グレート！', ko: '굿!' },
  praiseSweet: { zh: '甜蜜连击！', en: 'Sweet!', ja: 'スイート！', ko: '스위트!' },
  praiseTasty: { zh: '美味！', en: 'Tasty!', ja: 'おいしい！', ko: '맛있어!' },
  praiseDelicious: { zh: '超美味！', en: 'Delicious!', ja: '激うま！', ko: '최고야!' },
  clear: { zh: '通过！', en: 'CLEAR!', ja: 'クリア！', ko: '클리어!' },
  tri: { zh: '缤纷连携！ ×1.5', en: 'Color Combo! ×1.5', ja: 'カラーコンボ！ ×1.5', ko: '컬러 콤보! ×1.5' },
  bossAngry: { zh: '校监生气了！', en: 'The Principal is furious!', ja: '校長が怒った！', ko: '교장이 화났다!' },
  shieldBreak: { zh: '护盾破碎！', en: 'Shield broken!', ja: 'シールド破壊！', ko: '실드 파괴!' },
  shieldRotate: { zh: '护盾轮换', en: 'Shield shifted', ja: 'シールド交替', ko: '실드 교체' },
  debuff: { zh: '下次伤害减半！', en: 'Next attack halved!', ja: '次の攻撃半減！', ko: '다음 공격 반감!' },
  weak: { zh: '弱', en: 'WK', ja: '弱', ko: '약' },
  pause: { zh: '课间休息', en: 'Intermission', ja: '休み時間', ko: '쉬는 시간' },
  pauseSub: { zh: '战斗已暂停，甜点魔法暂时冻结', en: 'Battle paused · sweet magic is resting', ja: 'バトル一時停止・魔法もひと休み', ko: '전투 일시정지 · 마법도 잠시 휴식' },
  musicLabel: { zh: '音乐', en: 'Music', ja: '音楽', ko: '음악' },
  sfxLabel: { zh: '音效', en: 'SFX', ja: '効果音', ko: '효과음' },
  resume: { zh: '继续', en: 'Resume', ja: '再開', ko: '계속' },
  restart: { zh: '重新开始', en: 'Restart', ja: 'リスタート', ko: '다시 시작' },
  musicOn: { zh: '音乐：开', en: 'Music: On', ja: 'BGM：オン', ko: '음악: 켬' },
  musicOff: { zh: '音乐：关', en: 'Music: Off', ja: 'BGM：オフ', ko: '음악: 끔' },
  sfxOn: { zh: '音效：开', en: 'SFX: On', ja: '効果音：オン', ko: '효과음: 켬' },
  sfxOff: { zh: '音效：关', en: 'SFX: Off', ja: '効果音：オフ', ko: '효과음: 끔' },
  lang: { zh: '语言', en: 'Language', ja: '言語', ko: '언어' },
  langTitle: { zh: '选择语言', en: 'Select Language', ja: '言語を選択', ko: '언어 선택' },
  failTitle: { zh: '这次烤糊了…', en: 'Burnt this time…', ja: '焦がしちゃった…', ko: '이번엔 태워버렸다…' },
  reached: { zh: '撑到了 {x}', en: 'Made it to {x}', ja: '{x}まで到達', ko: '{x}까지 도달' },
  retry: { zh: '再烤一次！', en: 'Bake again!', ja: 'もう一度焼こう！', ko: '다시 굽기!' },
  winTitle: { zh: '补考通过！', en: 'Exam Passed!', ja: '追試合格！', ko: '시험 합격!' },
  rlTime: { zh: '通关时间  {x}', en: 'Time  {x}', ja: 'タイム  {x}', ko: '클리어 시간  {x}' },
  rlCombo: { zh: '最大 Combo  {x}', en: 'Max Combo  {x}', ja: '最大コンボ  {x}', ko: '최고 콤보  {x}' },
  rlSundae: { zh: '彩虹圣代  {x} 次', en: 'Rainbow Sundae  ×{x}', ja: 'レインボーパフェ  {x}回', ko: '무지개 파르페  {x}회' },
  rlHp: { zh: '剩余生命  {x}', en: 'HP Left  {x}', ja: '残りHP  {x}', ko: '남은 HP  {x}' },
  newBest: { zh: '★ 新纪录！', en: '★ New Record!', ja: '★ 新記録！', ko: '★ 신기록!' },
  best: { zh: '最佳：{r} · {x}', en: 'Best: {r} · {x}', ja: 'ベスト：{r} · {x}', ko: '최고: {r} · {x}' },
  again: { zh: '再来一局', en: 'Play Again', ja: 'もう一回', ko: '한 판 더' },
};
function t(id        )         {
  const e = S[id];
  return e ? e[LANG] || e.zh : id;
}

const MAX_HP = 1000;
const FIXED_BOARD = [
  [TYPE.B, TYPE.G, TYPE.Y, TYPE.R, TYPE.B, TYPE.G],
  [TYPE.G, TYPE.Y, TYPE.B, TYPE.G, TYPE.Y, TYPE.R],
  [TYPE.Y, TYPE.B, TYPE.G, TYPE.Y, TYPE.R, TYPE.B],
  [TYPE.R, TYPE.B, TYPE.R, TYPE.B, TYPE.G, TYPE.Y],
  [TYPE.B, TYPE.R, TYPE.B, TYPE.Y, TYPE.R, TYPE.G],
];

                    
             
              
             
                 
              
            
                
                  
                 
                
                  
                   
                
               
                  
 
const FLOORS               = [
  [
    { id: 'slime', tex: 'enemy-slime', hp: 10000, period: 3, atk: 60, h: 118 },
    { id: 'pet', tex: 'enemy-pet', hp: 8000, period: 2, atk: 50, h: 96 },
  ],
  [
    { id: 'bat-a', tex: 'enemy-bat', hp: 9000, period: 1, atk: 45, h: 100 },
    { id: 'mallow', tex: 'enemy-mallow', hp: 7000, period: 2, atk: 0, h: 105, heal: 1500 },
    { id: 'ginger', tex: 'enemy-ginger', hp: 8000, period: 2, atk: 65, h: 108, counter: 35 },
  ],
  [
    { id: 'puff-r', tex: 'enemy-puff-red', hp: 9500, period: 2, atk: 75, h: 108, weak: TYPE.R },
    { id: 'donut', tex: 'enemy-donut', hp: 9000, period: 2, atk: 70, h: 110, split: true },
    { id: 'puff-g', tex: 'enemy-puff-green', hp: 9500, period: 2, atk: 75, h: 108, weak: TYPE.G },
  ],
  [
    { id: 'elite', tex: 'enemy-elite', hp: 26000, period: 2, atk: 130, h: 150, elite: true },
    { id: 'macaron', tex: 'enemy-macaron', hp: 14000, period: 3, atk: 200, h: 128 },
  ],
  [
    { id: 'icecream', tex: 'enemy-icecream', hp: 11000, period: 3, atk: 0, h: 115, seal: 2 },
    { id: 'honey', tex: 'enemy-honey', hp: 13000, period: 3, atk: 0, h: 110, taunt: true },
    { id: 'choco', tex: 'enemy-choco', hp: 9000, period: 2, atk: 90, h: 118, cap: 1500 },
  ],
  [
    { id: 'mallow-senior', tex: 'enemy-mallow', hp: 13000, period: 2, atk: 0, h: 108, heal: 2000 },
    { id: 'ginger-veteran', tex: 'enemy-ginger', hp: 16000, period: 2, atk: 85, h: 112, counter: 45 },
    { id: 'puff-b', tex: 'enemy-puff-blue', hp: 15000, period: 2, atk: 90, h: 110, weak: TYPE.B },
  ],
  [
    { id: 'honey-guard', tex: 'enemy-honey', hp: 18000, period: 3, atk: 0, h: 116, taunt: true },
    { id: 'donut-guard', tex: 'enemy-donut', hp: 17000, period: 2, atk: 90, h: 116, split: true },
    { id: 'choco-guard', tex: 'enemy-choco', hp: 15000, period: 2, atk: 110, h: 122, cap: 1800 },
  ],
  [
    { id: 'elite-royal', tex: 'enemy-elite', hp: 36000, period: 2, atk: 150, h: 154, elite: true },
    { id: 'icecream-royal', tex: 'enemy-icecream', hp: 19000, period: 3, atk: 0, h: 122, seal: 3 },
  ],
  [
    { id: 'elite-captain', tex: 'enemy-elite', hp: 42000, period: 2, atk: 175, h: 156, elite: true },
    { id: 'macaron-heavy', tex: 'enemy-macaron', hp: 28000, period: 3, atk: 260, h: 134 },
    { id: 'puff-b-elite', tex: 'enemy-puff-blue', hp: 23000, period: 2, atk: 110, h: 116, weak: TYPE.B },
  ],
  [{ id: 'boss', tex: 'enemy-boss', hp: 90000, period: 2, atk: 190, h: 205, boss: true }],
];

const FLOOR_CARD_INFO = [
  {
    name: { zh: '奶油监考官', en: 'Cream Proctor', ja: 'クリーム試験官', ko: '크림 감독관' },
    tag: { zh: '热身双敌', en: 'DUO WARM-UP', ja: '二体の前哨戦', ko: '2인 워밍업' },
    brief: { zh: '协同进攻，熟悉蓄能', en: 'Learn charging under duo attacks', ja: '連携攻撃でチャージを学ぶ', ko: '협공 속에서 충전을 익혀요' },
  },
  {
    name: { zh: '暮糖蝠伯爵', en: 'Gummy Bat Lord', ja: 'グミ蝙蝠伯爵', ko: '젤리 박쥐 백작' },
    tag: { zh: '高频突袭', en: 'RAPID RAID', ja: '高速襲撃', ko: '고속 습격' },
    brief: { zh: '护士会持续治疗同伴', en: 'The nurse keeps allies healed', ja: '看護師が仲間を回復する', ko: '간호사가 계속 아군을 치유해요' },
  },
  {
    name: { zh: '莓焰泡芙王', en: 'Berry Puff King', ja: 'ベリーパフ王', ko: '베리 퍼프 왕' },
    tag: { zh: '弱点与分裂', en: 'WEAK & SPLIT', ja: '弱点と分裂', ko: '약점과 분열' },
    brief: { zh: '同色破防，甜甜圈会分裂', en: 'Match weakness; donut splits', ja: '同色で破り、ドーナツは分裂', ko: '같은 색으로 깨고 도넛은 분열' },
  },
  {
    name: { zh: '四色盾卫·可可爵', en: 'Cocoa Shieldguard', ja: '四色盾のココア卿', ko: '4색 방패 코코아 경' },
    tag: { zh: '轮换护盾', en: 'SHIFTING SHIELD', ja: '交代シールド', ko: '교대 방패' },
    brief: { zh: '看准颜色，赶在重锤前破防', en: 'Break the right color before slam', ja: '重撃前に正しい色で破壊', ko: '강타 전에 맞는 색으로 파괴' },
  },
  {
    name: { zh: '霜杯封印师', en: 'Frost-Cup Sealer', ja: '霜杯の封印師', ko: '서리잔 봉인술사' },
    tag: { zh: '封印与嘲讽', en: 'SEAL & TAUNT', ja: '封印と挑発', ko: '봉인과 도발' },
    brief: { zh: '糖珠受限，蜂蜜罐强制集火', en: 'Sealed orbs; honey forces focus', ja: '封印とハニーの強制標的', ko: '구슬 봉인과 꿀단지 강제 타깃' },
  },
  {
    name: { zh: '棉云大护士', en: 'Cloudmallow Matron', ja: '雲マロの看護長', ko: '구름멜로 수간호사' },
    tag: { zh: '治疗反击', en: 'HEAL & COUNTER', ja: '回復と反撃', ko: '치유와 반격' },
    brief: { zh: '先断治疗，再利用蓝色弱点', en: 'Stop healing, then exploit blue', ja: '回復を止め青弱点を狙う', ko: '치유를 끊고 파란 약점을 공략' },
  },
  {
    name: { zh: '蜂蜜禁卫', en: 'Honey Warden', ja: 'ハニー禁衛', ko: '허니 근위대장' },
    tag: { zh: '强制嘲讽', en: 'FORCED TAUNT', ja: '強制挑発', ko: '강제 도발' },
    brief: { zh: '按顺序击破，避免浪费爆发', en: 'Break in order; save your burst', ja: '順番に倒し大技を温存', ko: '순서대로 격파하고 폭발기를 절약' },
  },
  {
    name: { zh: '皇家四色卫长', en: 'Royal Shield Captain', ja: '王家の四色衛長', ko: '왕실 4색 근위대장' },
    tag: { zh: '重盾封印', en: 'ROYAL LOCKDOWN', ja: '重盾と封印', ko: '중방패 봉쇄' },
    brief: { zh: '观察盾色，及时清理封印', en: 'Read shield colors; clear seals', ja: '盾色を読み封印を処理', ko: '방패 색을 보고 봉인을 해제' },
  },
  {
    name: { zh: '焦糖重装队长', en: 'Caramel Heavy Captain', ja: 'キャラメル重装隊長', ko: '캐러멜 중장대장' },
    tag: { zh: '高压合击', en: 'HEAVY ASSAULT', ja: '高圧連携', ko: '고압 협공' },
    brief: { zh: '重锤蓄力，蓝泡芙存在弱点', en: 'Charged slam plus blue weakness', ja: '溜め重撃と青パフの弱点', ko: '충전 강타와 파란 퍼프 약점' },
  },
  {
    name: { zh: '金冠布丁校监', en: 'Crowned Principal', ja: '金冠プリン校長', ko: '황금왕관 푸딩 교장' },
    tag: { zh: '最终考核', en: 'FINAL EXAM', ja: '最終試験', ko: '최종 시험' },
    brief: { zh: '半血暴怒，保留技能集中爆发', en: 'Rages at half HP; save your burst', ja: '半分で激怒、大技を温存', ko: '절반 체력에 격노, 스킬을 아껴요' },
  },
];

function floorCardText(index        , field        )         {
  const value = FLOOR_CARD_INFO[index]?.[field];
  return value ? value[LANG] || value.zh : '';
}

const LEADERBOARD_KEY = 'tz_leaderboard_v1';
const LEADERBOARD_LIMIT = 20;

function leaderboardRankValue(rank        )         {
  return rank === 'S' ? 3 : rank === 'A' ? 2 : rank === 'B' ? 1 : 0;
}

function leaderboardScore(entry                            )         {
  return Math.max(0, Math.round(
    entry.cleared * 100000
      + leaderboardRankValue(entry.rank) * 20000
      + entry.hp * 10
      + entry.combo * 1200
      + entry.rainbows * 2500
      - entry.time * 25,
  ));
}

function compareLeaderboard(a                            , b                            )         {
  if (b.cleared !== a.cleared) return b.cleared - a.cleared;
  if (Number(b.complete) !== Number(a.complete)) return Number(b.complete) - Number(a.complete);
  if (leaderboardRankValue(b.rank) !== leaderboardRankValue(a.rank)) return leaderboardRankValue(b.rank) - leaderboardRankValue(a.rank);
  if (b.score !== a.score) return b.score - a.score;
  if (a.time !== b.time) return a.time - b.time;
  return a.createdAt - b.createdAt;
}

function normalizeLeaderboardEntry(raw                            )                              {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {
    id: typeof raw.id === 'string' ? raw.id : `${Number(raw.createdAt) || Date.now()}`,
    complete: Boolean(raw.complete),
    cleared: Math.max(0, Math.min(FLOORS.length, Math.floor(Number(raw.cleared) || 0))),
    rank: ['S', 'A', 'B'].includes(raw.rank) ? raw.rank : '-',
    time: Math.max(0, Math.floor(Number(raw.time) || 0)),
    hp: Math.max(0, Math.floor(Number(raw.hp) || 0)),
    combo: Math.max(0, Math.floor(Number(raw.combo) || 0)),
    rainbows: Math.max(0, Math.floor(Number(raw.rainbows) || 0)),
    createdAt: Math.max(0, Math.floor(Number(raw.createdAt) || Date.now())),
    score: Math.max(0, Math.floor(Number(raw.score) || 0)),
  };
  if (!entry.score) entry.score = leaderboardScore(entry);
  return entry;
}

function loadLeaderboard()                                   {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLeaderboardEntry).filter(Boolean).sort(compareLeaderboard).slice(0, LEADERBOARD_LIMIT);
  } catch {
    return [];
  }
}

function recordLeaderboard(complete         , rank         , time        )                                   {
  const createdAt = Date.now();
  const entry = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    complete,
    cleared: complete ? FLOORS.length : Math.max(0, floorIndex),
    rank: complete ? rank : '-',
    time: Math.max(0, Math.round(time)),
    hp: totalHp(),
    combo: maxCombo,
    rainbows: rainbowCount,
    createdAt,
    score: 0,
  };
  entry.score = leaderboardScore(entry);
  const entries = [...loadLeaderboard(), entry].sort(compareLeaderboard).slice(0, LEADERBOARD_LIMIT);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch {
    // 排行榜是增强功能；存储失败不阻塞结算。
  }
  const position = entries.findIndex((item) => item.id === entry.id);
  return { entry, position: position >= 0 ? position + 1 : 0 };
}

function formatRunTime(seconds        )         {
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `${String(mm).padStart(2, '0')}:${ss}`;
}

function qaLeaderboardEntries()                                   {
  const samples = [
    [10, 'S', 188, 4320, 12, 3],
    [10, 'A', 264, 3510, 10, 2],
    [10, 'A', 318, 2860, 8, 1],
    [9, '-', 355, 740, 9, 2],
    [8, '-', 301, 1220, 7, 1],
    [7, '-', 246, 980, 8, 0],
    [6, '-', 218, 1630, 6, 1],
    [5, '-', 176, 2020, 5, 0],
    [4, '-', 135, 1760, 4, 0],
    [3, '-', 92, 2640, 3, 0],
  ];
  return samples.map((sample, index) => {
    const [cleared, rank, time, hpValue, combo, rainbows] = sample;
    const entry = { id: `qa-${index}`, complete: cleared === FLOORS.length, cleared, rank, time, hp: hpValue, combo, rainbows, createdAt: index + 1, score: 0 };
    entry.score = leaderboardScore(entry);
    return entry;
  }).sort(compareLeaderboard);
}

                 
                
                  
                 
             
                
             
                 
                  
                     
               
                 
                   
                      
                           
                    
                      
                       
                      
                 
                   
                  
                
                   
                 
                 
 

// ---------- 资源 ----------
const IMG                         = {
  bg: 'assets/bg-classroom.png',
  'char-0': 'assets/char-red.png',
  'char-1': 'assets/char-blue.png',
  'char-2': 'assets/char-green.png',
  'char-3': 'assets/char-yellow.png',
  'char-4': 'assets/char-pink.png',
  'char-0-medium': 'assets/char-red-medium.webp',
  'char-0-large': 'assets/char-red-large.webp',
  'char-1-medium': 'assets/char-blue-medium.webp',
  'char-1-large': 'assets/char-blue-large.webp',
  'char-2-medium': 'assets/char-green-medium.webp',
  'char-2-large': 'assets/char-green-large.webp',
  'char-3-medium': 'assets/char-yellow-medium.webp',
  'char-3-large': 'assets/char-yellow-large.webp',
  'char-4-medium': 'assets/char-pink-medium.webp',
  'char-4-large': 'assets/char-pink-large.webp',
  'orb-0': 'assets/orb-red.png',
  'orb-1': 'assets/orb-blue.png',
  'orb-2': 'assets/orb-green.png',
  'orb-3': 'assets/orb-yellow.png',
  'orb-4': 'assets/orb-heart.png',
  'enemy-slime': 'assets/enemy-slime.png',
  'enemy-bat': 'assets/enemy-bat.png',
  'enemy-puff-red': 'assets/enemy-puff-red.png',
  'enemy-puff-blue': 'assets/enemy-puff-blue.png',
  'enemy-puff-green': 'assets/enemy-puff-green.png',
  'enemy-elite': 'assets/enemy-elite.png',
  'enemy-boss': 'assets/enemy-boss.png',
  'enemy-mallow': 'assets/enemy-mallow.png',
  'enemy-donut': 'assets/enemy-donut.png',
  'enemy-ginger': 'assets/enemy-ginger.png',
  'enemy-macaron': 'assets/enemy-macaron.png',
  'enemy-pet': 'assets/enemy-pet.png',
  'enemy-icecream': 'assets/enemy-icecream.png',
  'enemy-choco': 'assets/enemy-choco.png',
  'enemy-honey': 'assets/enemy-honey.png',
  sundae: 'assets/rainbow-sundae.png',
  'prop-strawberry': 'assets/prop-strawberry.png',
  'prop-bubble': 'assets/prop-bubble.png',
  'prop-leaf': 'assets/prop-leaf.png',
  'prop-star': 'assets/prop-star.png',
  'icon-pause': 'assets/lib/kenney-game-icons/icons/pause.png',
  'icon-music-on': 'assets/lib/kenney-game-icons/icons/musicOn.png',
  'icon-music-off': 'assets/lib/kenney-game-icons/icons/musicOff.png',
  'icon-audio-on': 'assets/lib/kenney-game-icons/icons/audioOn.png',
  'icon-audio-off': 'assets/lib/kenney-game-icons/icons/audioOff.png',
  'icon-star': 'assets/lib/kenney-game-icons/icons/star.png',
  'ui-menu-icons': 'assets/ui/menu-icons.png',
  'ui-menu-pedestal': 'assets/ui/menu-pedestal.png',
};
const SND = [
  { id: 'bgm-main', url: 'assets/bgm-main.m4a' },
  { id: 'orb-step', url: 'assets/orb-step.mp3' },
  { id: 'match-pop', url: 'assets/match-pop.mp3' },
  { id: 'orb-land', url: 'assets/orb-land.mp3' },
  { id: 'cast-attack', url: 'assets/cast-attack.mp3' },
  { id: 'heal-chime', url: 'assets/heal-chime.mp3' },
  { id: 'enemy-warn', url: 'assets/enemy-warn.mp3' },
  { id: 'party-hit', url: 'assets/party-hit.mp3' },
  { id: 'shield-break', url: 'assets/shield-break.mp3' },
  { id: 'seal-break', url: 'assets/seal-break.mp3' },
  { id: 'combo-tricolor', url: 'assets/combo-tricolor.mp3' },
  { id: 'rainbow-slam', url: 'assets/rainbow-slam.mp3' },
  { id: 'jingle-victory', url: 'assets/jingle-victory.mp3' },
  { id: 'jingle-fail', url: 'assets/jingle-fail.mp3' },
  { id: 'skill-cast', url: 'assets/skill-cast.mp3' },
  { id: 'floor-bell', url: 'assets/floor-bell.mp3' },
];

// ---------- 全局状态 ----------
const audio = new AudioMan();
const TEX                          = {};
let phase         = PHASE.Title;
let floorIndex = 0;
let enemies          = [];
let targetIdx = 0;
const START_HP = 400; // 开局半条：需要充能才能放技能，避免首回合四技齐发
const hp = [START_HP, START_HP, START_HP, START_HP, START_HP];
const EVOLUTION_COSTS = [0, 180, 480];
const EVOLUTION_POWER = [1, 1.2, 1.5];
const CHAR_NAME_KEYS = ['nameOrange', 'nameBlue', 'nameGreen', 'nameYellow', 'namePink'];

function loadGrowthState() {
  try {
    const savedStages = JSON.parse(localStorage.getItem('tz_party_stages') || 'null');
    const savedExp = localStorage.getItem('tz_evolution_exp');
    if (Array.isArray(savedStages) && savedExp !== null) {
      return {
        stages: Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(2, Math.floor(Number(savedStages[i]) || 0)))),
        exp: Math.max(0, Math.floor(Number(savedExp) || 0)),
      };
    }

    // v12 旧存档迁移：保留已经解锁的形态，未用于形态门槛的经验汇入共享钱包。
    const legacy = JSON.parse(localStorage.getItem('tz_party_xp') || '[]');
    const oldXp = Array.from({ length: 5 }, (_, i) => Math.max(0, Math.floor(Number(legacy[i]) || 0)));
    const stages = oldXp.map((xp) => xp >= 180 ? 2 : xp >= 60 ? 1 : 0);
    const exp = oldXp.reduce((sum, xp, i) => sum + Math.max(0, xp - (stages[i] === 2 ? 180 : stages[i] === 1 ? 60 : 0)), 0);
    if (legacy.length) {
      localStorage.setItem('tz_party_stages', JSON.stringify(stages));
      localStorage.setItem('tz_evolution_exp', String(exp));
    }
    return { stages, exp };
  } catch {
    return { stages: [0, 0, 0, 0, 0], exp: 0 };
  }
}

const growthState = loadGrowthState();
let partyStages = growthState.stages;
let evolutionExp = growthState.exp;
const EVOLUTION_NOTICE_KEY = 'tz_evolution_ready_notice';

function evolutionStage(i) {
  return partyStages[i] || 0;
}

function charTextureKey(i, stage = evolutionStage(i)) {
  return stage === 0 ? `char-${i}` : `char-${i}-${stage === 1 ? 'medium' : 'large'}`;
}

function saveGrowthState() {
  localStorage.setItem('tz_party_stages', JSON.stringify(partyStages));
  localStorage.setItem('tz_evolution_exp', String(evolutionExp));
}

function gainEvolutionExp(amount) {
  if (amount <= 0) return;
  const wasReady = canAnyHeroEvolve();
  evolutionExp += Math.round(amount);
  const isReady = canAnyHeroEvolve();
  if (!wasReady && isReady && localStorage.getItem(EVOLUTION_NOTICE_KEY) !== '1') {
    evolutionReadyNoticePending = true;
  }
  saveGrowthState();
  if (portraitFaces.length) updatePartyHud();
}

function nextEvolutionCost(i) {
  const next = evolutionStage(i) + 1;
  return next > 2 ? 0 : EVOLUTION_COSTS[next];
}

function canEvolve(i) {
  const cost = nextEvolutionCost(i);
  return cost > 0 && evolutionExp >= cost;
}

function canAnyHeroEvolve() {
  return partyStages.some((_, i) => canEvolve(i));
}

let evolutionReadyNoticePending = canAnyHeroEvolve() && localStorage.getItem(EVOLUTION_NOTICE_KEY) !== '1';

function totalHp()         {
  return hp.reduce((a, b) => a + b, 0);
}
let timeSec = 0;
let maxCombo = 0;
let rainbowCount = 0;
let turnNo = 0;
let paused = false;
const bubbleShown                          = {};

// ---------- 场景节点 ----------
let app             ;
let frameLayer          ;
let gameRoot           ;
let sceneLayer           ;
let enemyLayer           ;
let fxLayer           ;
let lowerFxLayer           ;
let bottomFxLayer           ;
let bottomGlowG           ;
let overlayLayer           ;
let partyLayer           ;
let floorText      ;
let statusText      ;
let comboText      ;
let board       ;
let badges              = [];
let portraits              = [];
let portraitFaces          = [];
let hpBars             = [];
let hpNums         = [];
let stageLabels         = [];
let portraitGlows             = [];
let portraitAuras             = [];
let portraitStars           = [];
let portraitStarBase           = [];
let lowerBokeh             = [];
let bottomSparkles             = [];
let bottomLightDots             = [];
let growthHud           ;
let growthHudBg           ;
let growthHudText      ;
let evolutionTabButton           ;
let evolutionReadyFx           ;
let evolutionReadyBadge           ;
let evolutionReadySparkles             = [];
let badgeFaces          = [];
let activeOverlay                   = null;
let activeBubble                   = null;
let bubbleTimer = 0;
let evolutionTabOpen = false;
let evolutionTabOrigin = 'title';
let evolutionSelectedHero = 0;
let evolutionReturnAction                  = null;
let standalonePageOpen = false;
let menuHeroGroup                   = null;
let menuHeroActors                            = [];
let menuHeroFxLayer                   = null;
let menuHeroFx                            = [];
let menuHeroIdleReady = false;
let menuHeroBaseScaleX = 1;
let menuHeroBaseScaleY = 1;
let localQaScreen = '';
let localQaHps                  = null;

const FONT           = ['SmileySans', 'sans-serif'];
function mkText(text        , size        , color        , strokeW = 0, wrapW = 0)       {
  const resolvedStrokeW = strokeW > 0 ? Math.min(strokeW, Math.max(1.5, size * 0.1)) : 0;
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: FONT,
      fontSize: size,
      fill: color,
      fontWeight: 'bold',
      stroke: resolvedStrokeW > 0 ? { color: PAL.brown, width: resolvedStrokeW, join: 'round' } : undefined,
      align: 'center',
      wordWrap: wrapW > 0,
      wordWrapWidth: wrapW > 0 ? wrapW : undefined,
      breakWords: wrapW > 0, // CJK 无空格，必须允许按字符断行
    }),
  });
}

function mkBrandText(text        , size        , color        )       {
  return new Text({
    text,
    style: new TextStyle({
      fontFamily: ['SmileySans', 'Trebuchet MS', 'Arial', 'sans-serif'],
      fontSize: size,
      fill: color,
      fontWeight: '400',
      letterSpacing: 0.8,
      align: 'center',
    }),
  });
}

// ---------- 启动 ----------
async function boot()                {
  app = new Application();
  // UI screenshots and modern phones commonly render above 2× DPR. Capping at
  // 2 made the entire Pixi canvas get browser-upscaled, blurring text and art.
  await app.init({ resizeTo: window, background: 0xfdf3e7, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true });
  document.getElementById('app')?.appendChild(app.canvas);

  // 字体与图片并行加载，避免 1.1 MB 字体串行阻塞主资源。
  const fontPromise = (async () => {
    try {
      const fonts = [
        new FontFace('SmileySans', "url('assets/lib/smiley-sans/SmileySans-Oblique.woff2')"),
      ];
      const loadedFonts = await Promise.all(fonts.map((font) => font.load()));
      loadedFonts.forEach((font) => document.fonts.add(font));
    } catch (e) {
      console.warn('font load failed', e);
    }
  })();
  const aliases = Object.keys(IMG);
  aliases.forEach((a) => Assets.add({ alias: a, src: IMG[a] }));
  const [, loaded] = await Promise.all([fontPromise, Assets.load(aliases)])                           ;
  for (const a of aliases) TEX[a] = loaded[a];
  // Local-only visual QA route: ?qaStage=1 or ?qaStage=2 previews all forms
  // without changing the player's saved experience.
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    const qaParams = new URLSearchParams(location.search);
    const qaStage = Number(qaParams.get('qaStage'));
    if (qaStage === 1 || qaStage === 2) partyStages = Array(5).fill(qaStage);
    if (qaParams.has('qaExp')) evolutionExp = Math.max(0, Number(qaParams.get('qaExp')) || 0);
    if (qaParams.get('qaNotice') === '1') localStorage.removeItem(EVOLUTION_NOTICE_KEY);
    evolutionReadyNoticePending = canAnyHeroEvolve() && localStorage.getItem(EVOLUTION_NOTICE_KEY) !== '1';
    localQaScreen = qaParams.get('qaScreen') || '';
    if (qaParams.has('qaHps')) {
      const values = (qaParams.get('qaHps') || '').split(',').map((value) => Number(value));
      if (values.length === 5 && values.every(Number.isFinite)) {
        localQaHps = values.map((value) => Math.max(0, Math.min(MAX_HP, Math.round(value))));
      }
    }
  }
  buildScene();
  if (localQaHps) localQaHps.forEach((value, i) => { hp[i] = value; });
  layout();
  window.addEventListener('resize', layout);

  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS / 1000, 0.05);
    sched.update(dt);
    if (!sched.paused) board.update(dt);
    tick(dt);
  });

  if (localQaScreen === 'battle') {
    LANG = 'zh';
    phase = PHASE.Idle;
    setStandalonePage(false);
    updatePartyHud();
  } else if (localQaScreen === 'clear') {
    LANG = 'zh';
    showFloorClearScreen(0, 3);
  } else if (localQaScreen === 'result') {
    LANG = 'zh';
    showResult('S', 188, true, null);
  } else if (localQaScreen === 'leaderboard') {
    LANG = 'zh';
    showLeaderboard(true);
  } else if (LANG) showTitle();
  else showLangPicker('boot');
  // 音频是增强项，不应阻塞首屏交互与 gp:ready。
  void audio.load(SND).catch((e) => console.warn('audio init failed', e));
  window.__gpReady = true;
}

function layout()       {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const scale = Math.min(sw / W, sh / H);
  gameRoot.scale.set(scale);
  gameRoot.position.set((sw - W * scale) / 2, (sh - H * scale) / 2);
  // 侧边装饰：渐变底 + 糖珠圆点
  frameLayer.clear();
  frameLayer.rect(0, 0, sw, sh).fill(0xfdf3e7);
  frameLayer.rect(0, 0, sw, sh * 0.5).fill({ color: 0xfdf7ec, alpha: 0.6 });
  const dotCols = [PAL.red, PAL.blue, PAL.green, PAL.yellow, PAL.heart, PAL.purple];
  let i = 0;
  for (let y = 30; y < sh; y += 74) {
    for (let x = 26; x < sw; x += 74) {
      const inside = x > gameRoot.x - 20 && x < gameRoot.x + W * scale + 20 && y > gameRoot.y - 20 && y < gameRoot.y + H * scale + 20;
      if (inside) continue;
      frameLayer.circle(x + ((i * 37) % 23), y + ((i * 53) % 29), 7 + ((i * 13) % 6)).fill({ color: dotCols[i % dotCols.length], alpha: 0.35 });
      i++;
    }
  }
}

// ---------- 场景 ----------
function buildScene()       {
  frameLayer = new Graphics();
  app.stage.addChild(frameLayer);
  gameRoot = new Container();
  app.stage.addChild(gameRoot);
  const clip = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  gameRoot.addChild(clip);
  gameRoot.mask = clip;

  // 背景：上半教室，下半压暗衬棋盘（等比 cover，不拉伸）
  const bg = new Sprite(TEX.bg);
  const bgScale = Math.max(W / TEX.bg.width, H / TEX.bg.height);
  bg.scale.set(bgScale);
  bg.position.set((W - TEX.bg.width * bgScale) / 2, (H - TEX.bg.height * bgScale) / 2);
  gameRoot.addChild(bg);
  const dim = new Graphics();
  dim.rect(0, 300, W, H - 300).fill({ color: 0xefe3ec, alpha: 0.68 });
  gameRoot.addChild(dim);
  const sceneDim = new Graphics();
  sceneDim.rect(0, 0, W, 320).fill({ color: 0xfff9ee, alpha: 0.06 });
  gameRoot.addChild(sceneDim);

  // 下半区环境层：柔光泡泡 + 缓慢漂浮粒子，位于 HUD/棋盘下方，不拦截操作。
  lowerFxLayer = new Container();
  gameRoot.addChild(lowerFxLayer);
  const bokehColors = [PAL.red, PAL.blue, PAL.green, PAL.yellow, PAL.heart, PAL.purple];
  for (let i = 0; i < 9; i++) {
    const radius = 7 + (i % 4) * 3;
    const g = new Graphics().circle(0, 0, radius).fill({ color: bokehColors[i % bokehColors.length], alpha: 0.12 });
    const baseX = 24 + ((i * 71) % (W - 48));
    const baseY = 350 + ((i * 97) % 420);
    g.position.set(baseX, baseY);
    lowerFxLayer.addChild(g);
    lowerBokeh.push({ g, baseX, baseY, phase: i * 0.83, amp: 3 + (i % 3) * 2 });
  }

  // 顶栏
  floorText = mkText(t('floor0'), 20, PAL.cream, 4);
  floorText.position.set(16, 14);
  floorText.anchor.set(0, 0);
  gameRoot.addChild(floorText);
  const pauseBtn = new Container();
  const pbg = new Graphics().roundRect(0, 0, 44, 44, 12).fill({ color: PAL.brown, alpha: 0.85 });
  const pico = new Sprite(TEX['icon-pause']);
  pico.tint = PAL.cream;
  pico.width = 20;
  pico.height = 20;
  pico.anchor.set(0.5);
  pico.position.set(22, 22);
  pauseBtn.addChild(pbg, pico);
  pauseBtn.position.set(W - 58, 10);
  pauseBtn.eventMode = 'static';
  pauseBtn.cursor = 'pointer';
  pauseBtn.on('pointertap', () => togglePause(true));
  gameRoot.addChild(pauseBtn);

  // 战斗场景层
  sceneLayer = new Container();
  sceneLayer.position.set(0, 48);
  gameRoot.addChild(sceneLayer);
  enemyLayer = new Container();
  sceneLayer.addChild(enemyLayer);

  // 队伍栏
  partyLayer = new Container();
  partyLayer.position.set(0, 292);
  gameRoot.addChild(partyLayer);
  buildPartyBar();

  // 棋盘
  board = new Board(
    [TEX['orb-0'], TEX['orb-1'], TEX['orb-2'], TEX['orb-3'], TEX['orb-4']],
    ORB_COLORS,
    {
      canDrag: () => phase === PHASE.Idle && !paused,
      onDragStart: () => {
        phase = PHASE.Drag;
        if (tutHint) {
          tutHint.destroy();
          tutHint = null;
        }
        if (!tutActive && !bubbleShown.drag) {
          bubbleShown.drag = true;
          showBubble(t('bubDrag'), 210, 268);
        }
      },
      onDragEnd: () => {
        void runResolution();
      },
      onStep: (n) => {
        audio.play('orb-step', Math.min(0.95 + n * 0.03, 1.35), 0.8);
        if (tutStep === 2 && n >= 3) tutStepReady = true;
      },
      onPop: (groups, combo) => {
        maxCombo = Math.max(maxCombo, combo);
        audio.play('match-pop', Math.min(1 + (combo - 1) * 0.06, 1.3));
        playMatchImpact(groups, combo);
        showCombo(combo, groups[0]?.type ?? 0);
        showPraise(groups, combo);
        hideBubble();
      },
      onSealBreak: () => audio.play('seal-break'),
      onLand: () => audio.play('orb-land', 1, 0.5),
    },
  );
  board.container.position.set((W - BOARD_W) / 2, BOARD_Y);
  gameRoot.addChild(board.container);

  // 棋盘底部可见光效层：位于棋盘上方、文字和按钮下方。
  bottomFxLayer = new Container();
  bottomFxLayer.eventMode = 'none';
  gameRoot.addChild(bottomFxLayer);
  buildBottomEffects();

  // 状态栏
  statusText = mkText(t('statusDef'), 16, PAL.cream, 3);
  statusText.anchor.set(0.5, 0.5);
  statusText.position.set(126, 782);
  gameRoot.addChild(statusText);

  growthHud = new Container();
  growthHud.position.set(278, 782);
  growthHudBg = new Graphics();
  growthHudText = mkText('', 12, PAL.cream, 3);
  growthHudText.anchor.set(0.5, 0.5);
  growthHud.addChild(growthHudBg, growthHudText);
  gameRoot.addChild(growthHud);

  evolutionReadyFx = new Container();
  evolutionReadyFx.position.set(367, 782);
  evolutionReadyFx.eventMode = 'none';
  evolutionReadyFx.visible = false;
  const readyAura = new Graphics();
  readyAura.roundRect(-45, -21, 90, 42, 21).fill({ color: PAL.yellow, alpha: 0.14 });
  readyAura.roundRect(-43, -19, 86, 38, 19).stroke({ width: 2.5, color: PAL.yellow, alpha: 0.9 });
  readyAura.roundRect(-39, -15, 78, 30, 15).stroke({ width: 1, color: 0xffffff, alpha: 0.74 });
  evolutionReadyFx.addChild(readyAura);
  evolutionReadySparkles = [];
  const readySparkSpecs = [
    [-39, -15, 0], [39, -15, 0.7], [-39, 15, 1.4], [39, 15, 2.1], [0, -23, 2.8],
  ];
  readySparkSpecs.forEach(([x, y, phase]) => {
    const sparkle = new Graphics();
    drawMenuDiamond(sparkle, 0, 0, 3.2, PAL.yellow, 0.95);
    sparkle.circle(0, 0, 0.9).fill({ color: 0xffffff, alpha: 0.95 });
    sparkle.position.set(x, y);
    evolutionReadyFx.addChild(sparkle);
    evolutionReadySparkles.push({ g: sparkle, phase });
  });
  evolutionReadyBadge = new Container();
  const readyBadgeBg = new Graphics().circle(0, 0, 8).fill(MENU_PAL.wine).stroke({ width: 2, color: PAL.yellow, alpha: 0.96 });
  const readyBadgeText = mkText('!', 11, PAL.yellow);
  readyBadgeText.anchor.set(0.5);
  readyBadgeText.position.set(0, -0.5);
  evolutionReadyBadge.position.set(34, -17);
  evolutionReadyBadge.addChild(readyBadgeBg, readyBadgeText);
  evolutionReadyFx.addChild(evolutionReadyBadge);
  gameRoot.addChild(evolutionReadyFx);

  evolutionTabButton = mkButton(t('evolutionShort'), 78, 32, () => {
    if (phase === PHASE.Idle && !paused) showEvolutionTab('battle');
  }, PAL.purple, 14);
  evolutionTabButton.position.set(367, 782);
  gameRoot.addChild(evolutionTabButton);

  comboText = mkText('', 30, PAL.cream, 6);
  comboText.anchor.set(0.5, 0.5);
  comboText.position.set(W - 66, 150);
  comboText.visible = false;
  gameRoot.addChild(comboText);

  fxLayer = new Container();
  gameRoot.addChild(fxLayer);
  for (let i = 0; i < 5; i++) badges.push(makeBadge(i));
  overlayLayer = new Container();
  gameRoot.addChild(overlayLayer);

  // 输入
  board.container.eventMode = 'static';
  board.container.hitArea = { contains: (x        , y        ) => x >= -8 && y >= -8 && x <= BOARD_W + 8 && y <= BOARD_H + 8 };
  app.stage.eventMode = 'static';
  board.container.on('pointerdown', (e) => {
    audio.unlock();
    const p = board.container.toLocal(e.global);
    board.pointerDown(p.x, p.y);
  });
  app.stage.on('globalpointermove', (e) => {
    if (paused) return;
    const p = board.container.toLocal(e.global);
    board.pointerMove(p.x, p.y);
  });
  app.stage.on('pointerup', () => board.pointerUp());
  app.stage.on('pointerupoutside', () => board.pointerUp());
  app.stage.on('pointercancel', () => board.pointerUp());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && evolutionTabOpen) {
      closeEvolutionTab(evolutionTabOrigin);
      return;
    }
    if (e.key === 'Escape' && standalonePageOpen) return;
    if (e.key === 'Escape' && phase !== PHASE.Title && phase !== PHASE.Over) togglePause(!paused);
  });

  board.reset(FIXED_BOARD);
  spawnFloor(0, true);
  updatePartyHud();
}

function buildPartyBar()       {
  // 四个独立血条头像
  const size = 58;
  const gap = 10;
  const totalW = 5 * size + 4 * gap;
  const x0 = (W - totalW) / 2;
  for (let i = 0; i < 5; i++) {
    const port = new Container();
    port.position.set(x0 + i * (size + gap), 14);
    const aura = new Graphics().roundRect(-4, -4, size + 8, size + 8, 18).fill({ color: ORB_COLORS[i], alpha: 0.16 });
    const frame = new Graphics().roundRect(0, 0, size, size, 14).fill({ color: PAL.boardBg, alpha: 0.9 }).stroke({ width: 3, color: ORB_COLORS[i] });
    const faceTex = TEX[charTextureKey(i)];
    const face = new Sprite(faceTex);
    const fr = faceTex.width / faceTex.height;
    face.height = size * 1.15;
    face.width = face.height * fr;
    face.anchor.set(0.5, 0.62);
    face.position.set(size / 2, size / 2);
    const maskG = new Graphics().roundRect(2, 2, size - 4, size - 4, 12).fill(0xffffff);
    face.mask = maskG;
    const glow = new Graphics().roundRect(-3, -3, size + 6, size + 6, 16).stroke({ width: 4, color: PAL.cream, alpha: 0.95 });
    glow.visible = false;
    const star = new Sprite(TEX['icon-star']);
    star.tint = PAL.yellow;
    star.width = 20;
    star.height = 20;
    star.anchor.set(0.5);
    star.position.set(size - 6, 6);
    star.visible = false;
    portraitStarBase.push(star.scale.x);
    port.addChild(aura, frame, maskG, face, glow, star);
    portraitAuras.push(aura);
    portraitFaces.push(face);
    const stageLabel = mkText('I', 10, PAL.cream, 3);
    stageLabel.anchor.set(0.5);
    stageLabel.position.set(9, 9);
    port.addChild(stageLabel);
    stageLabels.push(stageLabel);
    // 独立血条（加粗描边 + 条内数字）
    const bar = new Graphics();
    bar.position.set(0, 64);
    port.addChild(bar);
    hpBars.push(bar);
    const num = mkText('1000', 11, PAL.cream, 3);
    num.anchor.set(0.5, 0.5);
    num.position.set(size / 2, 72);
    port.addChild(num);
    hpNums.push(num);
    partyLayer.addChild(port);
    portraits.push(port);
    portraitGlows.push(glow);
    portraitStars.push(star);
  }
}

function buildBottomEffects()       {
  bottomGlowG = new Graphics();
  bottomGlowG.ellipse(W / 2, 768, 198, 22).fill({ color: PAL.purple, alpha: 0.1 });
  bottomGlowG.ellipse(W / 2, 766, 170, 13).fill({ color: PAL.blue, alpha: 0.1 });
  bottomGlowG.roundRect(24, 755, W - 48, 5, 3).fill({ color: 0xffffff, alpha: 0.2 });
  bottomGlowG.roundRect(52, 760, W - 104, 3, 2).fill({ color: PAL.yellow, alpha: 0.16 });
  bottomFxLayer.addChild(bottomGlowG);

  const colors = [PAL.yellow, PAL.blue, PAL.heart, PAL.green, PAL.cream];
  for (let i = 0; i < 10; i++) {
    const g = new Graphics();
    const size = 2.5 + (i % 3);
    g.moveTo(0, -size).lineTo(size * 0.35, -size * 0.35).lineTo(size, 0).lineTo(size * 0.35, size * 0.35).lineTo(0, size).lineTo(-size * 0.35, size * 0.35).lineTo(-size, 0).lineTo(-size * 0.35, -size * 0.35).closePath().fill({ color: colors[i % colors.length], alpha: 0.9 });
    g.position.set(24 + ((i * 43) % (W - 48)), 758 + (i % 4) * 10);
    bottomFxLayer.addChild(g);
    bottomSparkles.push({ g, baseY: g.y, phase: i * 0.76 });
  }

  for (let i = 0; i < 3; i++) {
    const g = new Graphics();
    g.circle(0, 0, 7).fill({ color: colors[i + 1], alpha: 0.08 });
    g.circle(0, 0, 2.2).fill({ color: 0xffffff, alpha: 0.86 });
    g.position.set(28 + i * 120, 758 + i * 3);
    bottomFxLayer.addChild(g);
    bottomLightDots.push(g);
  }
}

// ---------- 敌人 ----------
function spawnFloor(idx        , instant = false)       {
  if (tutActive) finishTutorial(); // 教学期间楼层被打通则直接毕业
  floorIndex = idx;
  floorStartTime = timeSec;
  floorText.text = t('floor' + idx);
  enemyLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
  enemies = [];
  const cfgs = FLOORS[idx];
  const xs = cfgs.length === 1 ? [210] : cfgs.length === 2 ? [118, 302] : [72, 210, 348];
  cfgs.forEach((cfg, i) => {
    const e = makeEnemy(cfg, xs[i], 236);
    enemies.push(e);
    enemyLayer.addChild(e.root);
    if (!instant) {
      e.root.scale.set(0);
      const root = e.root;
      sched.tween(0.35, (k) => root.scale.set(k), EaseOutBack);
    }
  });
  targetIdx = 0;
  updateFocus();
  if (idx === 1 && !bubbleShown.heal) {
    bubbleShown.heal = true;
    showBubble(t('bubHeal'), 210, 268);
  }
  if (idx === 2 && !bubbleShown.split) {
    bubbleShown.split = true;
    showBubble(t('bubSplit'), 210, 268);
  }
  if (idx === 3 && !bubbleShown.shield) {
    bubbleShown.shield = true;
    showBubble(t('bubShield'), 210, 268);
  }
  if (idx === 4 && !bubbleShown.taunt) {
    bubbleShown.taunt = true;
    showBubble(t('bubTaunt'), 210, 268);
  }
}

function makeEnemy(cfg          , x        , baseY        )        {
  const root = new Container();
  root.position.set(x, baseY);
  const sprite = new Sprite(TEX[cfg.tex]);
  sprite.anchor.set(0.5, 1);
  sprite.height = cfg.h;
  sprite.width = (TEX[cfg.tex].width / TEX[cfg.tex].height) * cfg.h;
  root.addChild(sprite);
  // 蜂蜜怪沿用干净原画，在运行时补上丑萌盗贼装扮，避免光晕底图进入战斗。
  if (cfg.tex === 'enemy-honey') {
    sprite.tint = 0xe0c2ae;
    const bandit = new Graphics();
    bandit.roundRect(-29, -67, 58, 19, 9).fill({ color: 0x5f2b67, alpha: 0.36 });
    bandit.moveTo(-28, -70).lineTo(-8, -64).stroke({ width: 4, color: 0x573127, alpha: 0.95 });
    bandit.moveTo(28, -70).lineTo(8, -64).stroke({ width: 4, color: 0x573127, alpha: 0.95 });
    bandit.circle(0, -27, 4).fill({ color: 0x573127, alpha: 0.95 });
    bandit.moveTo(-3, -27).lineTo(-17, -18).lineTo(-8, -34).fill({ color: 0x573127, alpha: 0.9 });
    bandit.moveTo(3, -27).lineTo(17, -18).lineTo(8, -34).fill({ color: 0x573127, alpha: 0.9 });
    root.addChild(bandit);
  }
  const baseSX = sprite.scale.x;
  const baseSY = sprite.scale.y;
  // 脚下软阴影（手办立体感）
  const foot = new Graphics().ellipse(0, -2, sprite.width * 0.42, 9).fill({ color: 0x8a6d5c, alpha: 0.18 });
  root.addChildAt(foot, 0);

  const glowG = new Graphics();
  glowG.visible = false;
  root.addChildAt(glowG, 0);

  // 血条
  const barW = cfg.boss ? 210 : cfg.elite ? 150 : 96;
  const hpBar = new Graphics();
  hpBar.position.set(-barW / 2, -cfg.h - 26);
  root.addChild(hpBar);
  // 倒计时徽章
  const cdBadge = new Container();
  cdBadge.position.set(barW / 2 - 6, -cfg.h - 22);
  const cdBg = new Graphics();
  const cdText = mkText('', 16, PAL.cream, 3);
  cdText.anchor.set(0.5, 0.5);
  cdBadge.addChild(cdBg, cdText);
  cdBadge.position.x = -barW / 2 - 4;
  root.addChild(cdBadge);
  // 弱点珠
  if (cfg.weak !== undefined) {
    const weak = new Sprite(TEX[`orb-${cfg.weak}`]);
    weak.width = 18;
    weak.height = 18;
    weak.anchor.set(0.5);
    weak.position.set(barW / 2 + 10, -cfg.h - 21);
    root.addChild(weak);
    const wtxt = mkText(t('weak'), 11, PAL.cream, 2);
    wtxt.anchor.set(0.5, 0.5);
    wtxt.position.set(barW / 2 + 10, -cfg.h - 38);
    root.addChild(wtxt);
  }
  // 集火描边
  const focusG = new Graphics();
  root.addChildAt(focusG, 0);
  // 护盾
  const shieldRing = new Graphics();
  shieldRing.visible = false;
  root.addChild(shieldRing);

  const e        = {
    cfg, root, sprite, hp: cfg.hp, maxHp: cfg.hp, cd: cfg.period, alive: true,
    hpBar, cdBadge, cdText, cdBg, focusG, debuffHalf: false, bubbleSpr: null,
    shieldUp: false, shieldColor: 0, shieldRing, shieldTurns: 0, angry: false, bossAlt: false, glowG, baseY, squashCd: 0, baseSX, baseSY,
  };
  if (cfg.elite) {
    e.shieldUp = true;
    e.shieldColor = 0;
  }
  root.eventMode = 'static';
  root.cursor = 'pointer';
  root.on('pointertap', () => {
    if (phase !== PHASE.Idle || paused || !e.alive) return;
    const taunt = enemies.find((o) => o.alive && o.cfg.taunt);
    if (taunt && e !== taunt) {
      floatText(t('bubTaunt'), W / 2, 268, PAL.yellow, 16);
      return;
    }
    targetIdx = enemies.indexOf(e);
    updateFocus();
    audio.play('orb-step', 1.2, 0.6);
    if (tutActive && tutStep === 3) advanceTutorial();
  });
  refreshEnemyHud(e);
  return e;
}

function refreshEnemyHud(e       )       {
  const w = e.cfg.boss ? 210 : e.cfg.elite ? 150 : 96;
  const frac = Math.max(0, e.hp / e.maxHp);
  e.hpBar.clear();
  e.hpBar.roundRect(0, 0, w, 10, 5).fill({ color: 0xd9c9d8, alpha: 0.9 });
  e.hpBar.roundRect(1.5, 1.5, Math.max(0, (w - 3) * frac), 7, 3.5).fill(frac > 0.3 ? PAL.green : PAL.red);
  e.cdBg.clear();
  const urgent = e.cd <= 1;
  e.cdBg.circle(0, 0, 13).fill(urgent ? 0xff5c5c : PAL.brown).stroke({ width: 2, color: PAL.cream });
  e.cdText.text = String(e.cd);
  // 集火描边（嘲讽时锁定在蜂蜜罐上）
  e.focusG.clear();
  if (currentTarget() === e && e.alive) {
    e.focusG.ellipse(0, -e.cfg.h * 0.45, e.sprite.width * 0.62, e.cfg.h * 0.55).stroke({ width: 3, color: PAL.cream, alpha: 0.9 });
    e.focusG.ellipse(0, -6, e.sprite.width * 0.5, 10).fill({ color: PAL.cream, alpha: 0.25 });
  }
  // 护盾
  e.shieldRing.clear();
  if (e.shieldUp && e.alive) {
    e.shieldRing.ellipse(0, -e.cfg.h * 0.45, e.sprite.width * 0.66, e.cfg.h * 0.58).stroke({ width: 5, color: ORB_COLORS[e.shieldColor], alpha: 0.85 });
  }
}

function updateFocus()       {
  if (!enemies[targetIdx]?.alive) {
    const idx = enemies.findIndex((e) => e.alive);
    targetIdx = Math.max(0, idx);
  }
  enemies.forEach((e) => refreshEnemyHud(e));
}

// ---------- 战斗流水线 ----------
async function runResolution()                {
  if (phase !== PHASE.Drag) return;
  phase = PHASE.Busy;
  const waves = await board.resolveBoard();
  if (waves.length === 0) {
    // 无消除也算一回合
    await enemyTurn();
    if (phase === PHASE.Over) return;
    endTurn();
    return;
  }
  await applyWaves(waves);
  if (phase === PHASE.Over) return;
  if (tutActive) {
    if (tutStep === 1) advanceTutorial();
    else if (tutStep === 2 && tutStepReady) advanceTutorial();
  }
  if (checkFloorCleared()) return;
  await enemyTurn();
  if (phase === PHASE.Over) return;
  endTurn();
}

function endTurn()       {
  turnNo++;
  phase = PHASE.Idle;
  enemies.forEach((e) => {
    if (e.alive && e.cd === 1) {
      audio.play('enemy-warn', 1, 0.6);
      // 预警小跳（补间可能晚于换层销毁，需守卫）
      const root = e.root;
      sched.tween(0.3, (k) => {
        if (!root.destroyed) root.y = e.baseY - 8 * Math.sin(k * Math.PI);
      });
    }
  });
}

;                   
                    
                   
               
                   
               
 

const SIG_DMG = [5000, 2000, 2000, 1500];

function planTurn(waves        )           {
  const charges = [0, 0, 0, 0, 0];
  for (const w of waves) {
    for (const g of w.groups) {
      charges[g.type] += 340 + 85 * (g.cells.length - 3); // 爱心珠给粉团子充能
    }
  }
  const colors = [0, 1, 2, 3, 4].filter((i) => charges[i] > 0);
  const rainbow = colors.length >= 5;
  const tri = colors.length === 3;
  const mult = rainbow ? 2.2 : colors.length === 4 ? 1.8 : tri ? 1.5 : 1;
  return { charges, colors, tri, rainbow, mult };
}

// 头像中心坐标（gameRoot 系）
function portraitX(i        )         {
  return 74 + i * 68;
}

function matchOrigin(waves        , type        )                           {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const wave of waves) {
    for (const group of wave.groups) {
      if (group.type !== type) continue;
      for (const cell of group.cells) {
        const p = board.cellCenter(cell.r, cell.c);
        sx += p.x;
        sy += p.y;
        count++;
      }
    }
  }
  return count > 0
    ? { x: (W - BOARD_W) / 2 + sx / count, y: BOARD_Y + sy / count }
    : { x: W / 2, y: BOARD_Y + 70 };
}

function spawnChargeRush(i        , amount        , origin                           )       {
  const color = ORB_COLORS[i];
  const end = { x: portraitX(i), y: 330 };
  const count = amount >= 500 ? 7 : 5;
  for (let n = 0; n < count; n++) {
    const mote = new Graphics();
    if (n % 3 === 0) {
      mote.moveTo(0, -4).lineTo(1.3, -1.3).lineTo(4, 0).lineTo(1.3, 1.3).lineTo(0, 4).lineTo(-1.3, 1.3).lineTo(-4, 0).lineTo(-1.3, -1.3).closePath().fill({ color: PAL.cream, alpha: 0.95 });
    } else {
      mote.circle(0, 0, 3 + (n % 2)).fill({ color, alpha: 0.9 });
    }
    mote.position.set(origin.x + (Math.random() - 0.5) * 22, origin.y + (Math.random() - 0.5) * 16);
    fxLayer.addChild(mote);
    const sx = mote.x;
    const sy = mote.y;
    sched.tween(n * 0.035, () => {}, EaseOutQuad, () => {
      sched.tween(0.34, (k) => {
        const arc = Math.sin(k * Math.PI) * (28 + n * 2);
        mote.position.set(sx + (end.x - sx) * k, sy + (end.y - sy) * k - arc);
        mote.scale.set(0.75 + 0.65 * k);
        mote.alpha = 0.95 - 0.2 * k;
      }, EaseInQuad, () => {
        mote.destroy();
        if (n === count - 1) {
          spawnBurst(end.x, end.y, color, 7);
        }
      });
    });
  }
}

async function applyWaves(waves        )                {
  const plan = planTurn(waves);
  // 同色充能
  for (const i of plan.colors) {
    hp[i] = Math.min(MAX_HP, hp[i] + plan.charges[i]);
    gainEvolutionExp(Math.max(2, Math.round(plan.charges[i] / 170)));
    spawnChargeRush(i, plan.charges[i], matchOrigin(waves, i));
    floatText(`+${plan.charges[i]}`, portraitX(i), 344, ORB_COLORS[i], plan.charges[i] >= 500 ? 20 : 17);
  }
  updatePartyHud();
  if (!bubbleShown.skill && plan.colors.length > 0) {
    bubbleShown.skill = true;
    showBubble(t('bubSkill'), 210, 268);
  }
  if (plan.tri) await playTricolor();
  if (plan.rainbow) {
    rainbowCount++;
    await playRainbowCutin();
  }
  // 充满的动物依次放技能
  for (let i = 0; i < 5; i++) {
    if (phase === PHASE.Over) return;
    if (!enemies.some((e) => e.alive)) break;
    if (hp[i] >= MAX_HP) {
      hp[i] = 0;
      updatePartyHud();
      await fireSignature(i, plan.mult, plan.rainbow);
    }
  }
  updateFocus();
}

// 充满触发：招牌技能
async function fireSignature(i        , mult        , allTargets         )                {
  const names = [t('skill0'), t('skill1'), t('skill2'), t('skill3'), t('skill4')];
  const evolutionPower = EVOLUTION_POWER[evolutionStage(i)];
  statusText.text = names[i];
  audio.play('skill-cast', 1, 0.7);
  await skillCutin(i, names[i]);
  if (i === 4) {
    // 粉团子·奶油急救：全员回血
    const heal = Math.round(400 * mult * evolutionPower);
    audio.play('heal-chime');
    for (let j = 0; j < 5; j++) {
      hp[j] = Math.min(MAX_HP, hp[j] + heal);
      floatText(`+${heal}`, portraitX(j), 344, PAL.heart, 20);
    }
    updatePartyHud();
    skillOutro(i);
    statusText.text = t('statusDef');
    return;
  }
  const dmg = Math.round(SIG_DMG[i] * mult * evolutionPower);
  const primary = currentTarget();
  if (primary) {
    if (i === 0) await fxRed(primary, dmg);
    else if (i === 1) await fxBlue(primary, dmg);
    else if (i === 2) await fxGreen(primary, dmg);
    else await fxYellow(primary, dmg);
    if (allTargets) {
      for (const e of enemies.filter((x) => x.alive && x !== primary)) {
        const { final, brokeShield } = calcDamage(e, i, dmg);
        if (brokeShield) breakShield(e);
        applyDamage(e, final, ORB_COLORS[i]);
      }
    }
  }
  skillOutro(i);
  statusText.text = t('statusDef');
}

function calcDamage(e       , color        , base        )                                          {
  let d = base;
  let brokeShield = false;
  if (e.cfg.weak === color) d = Math.round(d * 1.5);
  if (e.shieldUp) {
    if (e.shieldColor === color) {
      brokeShield = true;
    } else {
      d = Math.round(d * 0.3);
    }
  }
  return { final: d, brokeShield };
}

function awardDefeatXp(e       , finisher        )       {
  const base = e.cfg.id === 'mini-donut' ? 4 : 8 + floorIndex * 2;
  const reward = base * 5 + (finisher >= 0 ? Math.ceil(base * 0.5) : 0);
  gainEvolutionExp(reward);
  floatText(`EXP +${reward}`, e.root.x, e.baseY - e.cfg.h * 0.75 + 48, PAL.yellow, 18);
}

function playDamageImpact(e       , dmg        , color        )       {
  const x = e.root.x;
  const y = e.baseY - e.cfg.h * 0.48 + 48;
  const power = Math.max(1, Math.min(5, dmg / 1150));
  const flash = new Graphics().circle(0, 0, 15 + power * 3).fill({ color: 0xffffff, alpha: 0.88 });
  flash.position.set(x, y);
  fxLayer.addChild(flash);
  sched.tween(0.16, (k) => {
    flash.scale.set(0.7 + k * (1.2 + power * 0.13));
    flash.alpha = 0.88 * (1 - k);
  }, EaseOutQuad, () => flash.destroy());

  for (let n = 0; n < 2; n++) {
    const ring = new Graphics().circle(0, 0, 10 + n * 6).stroke({ width: 4 - n, color: n ? PAL.cream : color, alpha: 0.94 });
    ring.position.set(x, y);
    fxLayer.addChild(ring);
    sched.tween(0.25 + n * 0.06, (k) => {
      ring.scale.set(0.65 + k * (2.1 + power * 0.35));
      ring.alpha = 0.94 * (1 - k);
    }, EaseOutQuad, () => ring.destroy());
  }

  const rayCount = 5 + Math.round(power * 1.8);
  for (let n = 0; n < rayCount; n++) {
    const a = (Math.PI * 2 * n) / rayCount + Math.random() * 0.25;
    const ray = new Graphics().roundRect(-1.5, 0, 3, 15 + power * 4, 2).fill({ color: n % 2 ? PAL.cream : color, alpha: 0.95 });
    ray.position.set(x, y);
    ray.rotation = a - Math.PI / 2;
    fxLayer.addChild(ray);
    const dist = 24 + power * 7 + Math.random() * 12;
    sched.tween(0.24, (k) => {
      ray.position.set(x + Math.cos(a) * dist * k, y + Math.sin(a) * dist * k);
      ray.scale.y = 1 - 0.72 * k;
      ray.alpha = 0.95 * (1 - k);
    }, EaseOutQuad, () => ray.destroy());
  }
  spawnBurst(x, y, color, 6 + Math.round(power * 2));
  shake(Math.min(e.cfg.boss ? 5.5 : 4.2, 1.3 + power * 0.7), 0.12);
}

function applyDamage(e       , dmg        , color        , silentShield = false)       {
  if (!e.alive) return;
  if (e.cfg.cap && dmg > e.cfg.cap) {
    dmg = e.cfg.cap;
    if (!bubbleShown.cap) {
      bubbleShown.cap = true;
      showBubble(t('bubCap'), 210, 268);
    }
  }
  e.hp -= dmg;
  const damageSize = Math.round((e.cfg.boss ? 42 : 32) + Math.min(12, dmg / 700));
  floatText(`${dmg}`, e.root.x, e.baseY - e.cfg.h * 0.6 + 48, color, damageSize);
  playDamageImpact(e, dmg, color);
  squashEnemy(e);
  refreshEnemyHud(e);
  if (e.cfg.boss && !e.angry && e.hp > 0 && e.hp <= e.maxHp / 2) {
    e.angry = true;
    void bossPhase2(e);
  }
  if (e.hp <= 0) {
    awardDefeatXp(e, ORB_COLORS.indexOf(color));
    killEnemy(e);
  } else if (e.cfg.counter && dmg > 0) {
    // 姜饼人反击随机一只
    const ai = Math.floor(Math.random() * 4);
    hp[ai] = Math.max(0, hp[ai] - e.cfg.counter);
    audio.play('party-hit', 1.3, 0.35);
    floatText(`-${e.cfg.counter}`, portraitX(ai), 344, 0xff5c5c, 20);
    updatePartyHud();
    if (!bubbleShown.counter) {
      bubbleShown.counter = true;
      showBubble(t('bubCounter'), 210, 268);
    }
    if (totalHp() <= 0) gameOver();
  }
  void silentShield;
}

function squashEnemy(e       )       {
  e.squashCd = 0.26;
  const s = e.sprite;
  const w = s.width;
  const h = s.height;
  // 挤压 + 旋转回弹 + 击退（换层销毁后挂起补间需守卫）
  sched.tween(0.24, (k) => {
    if (s.destroyed) return;
    const m = Math.sin(k * Math.PI);
    s.width = w * (1 + 0.18 * m);
    s.height = h * (1 - 0.14 * m);
    s.rotation = 0.1 * Math.sin(k * Math.PI * 2) * (1 - k);
  });
  const ox = e.root.x;
  const root = e.root;
  sched.tween(0.2, (k) => {
    if (!root.destroyed) root.x = ox + 7 * (1 - k);
  });
}

function killEnemy(e       )       {
  e.alive = false;
  e.hp = 0;
  const root = e.root;
  const burstX = e.root.x;
  const burstY = e.baseY - e.cfg.h * 0.4 + 48;
  audio.play('match-pop', e.cfg.boss ? 1.18 : 1.08, e.cfg.boss ? 0.95 : 0.82);
  shake(e.cfg.boss ? 8 : 5.2, e.cfg.boss ? 0.28 : 0.2);
  floatText('K.O.!', burstX, burstY - 24, PAL.yellow, e.cfg.boss ? 48 : 36);
  // 消灭圆环波 + 奶油云
  for (let n = 0; n < 2; n++) {
    const ring = new Graphics().circle(0, 0, 12 + n * 7).stroke({ width: 6 - n * 2, color: n ? PAL.yellow : PAL.cream, alpha: 0.95 });
    ring.position.set(burstX, burstY);
    fxLayer.addChild(ring);
    sched.tween(0.4 + n * 0.08, (k) => {
      ring.scale.set(0.75 + k * (e.cfg.boss ? 6.2 : 4.4));
      ring.alpha = 0.95 * (1 - k);
    }, EaseOutQuad, () => ring.destroy());
  }
  for (let i = 0; i < 5; i++) {
    const c = new Graphics().circle(0, 0, 12 + (i % 3) * 7).fill({ color: i % 2 ? 0xfff9ee : PAL.yellow, alpha: 0.58 });
    c.position.set(burstX + (i - 2) * 15, burstY + (i % 2 ? 6 : -5));
    fxLayer.addChild(c);
    sched.tween(0.4, (k) => {
      c.scale.set(1 + k * 1.6);
      c.alpha = 0.55 * (1 - k);
    }, EaseOutQuad, () => c.destroy());
  }
  // 果冻预颤
  sched.tween(0.2, (k) => {
    if (!root.destroyed) root.scale.set(1 + 0.1 * Math.sin(k * Math.PI * 4));
  }, EaseOutQuad, () => {
    if (root.destroyed) return;
    sched.tween(0.34, (k) => {
      root.scale.set(1.05 * (1 - k));
      root.alpha = 1 - k;
    }, EaseInQuad, () => {
      root.visible = false;
    });
  });
  // 甜甜圈分裂成两个迷你甜甜圈
  if (e.cfg.split) {
    const miniCfg           = { id: 'mini-donut', tex: 'enemy-donut', hp: 4000, period: 2, atk: 30, h: 66 };
    for (const dx of [-72, 72]) {
      const m = makeEnemy(miniCfg, Math.max(60, Math.min(W - 60, e.root.x + dx)), e.baseY);
      enemies.push(m);
      enemyLayer.addChild(m.root);
      m.root.scale.set(0);
      sched.tween(0.3, (k) => m.root.scale.set(k), EaseOutBack);
    }
  }
  const particleCount = e.cfg.boss ? 24 : 18;
  for (let i = 0; i < particleCount; i++) {
    const p = new Graphics();
    const particleColor = i % 3 === 0 ? PAL.yellow : i % 2 ? PAL.cream : PAL.purple;
    if (i % 4 === 0) {
      p.moveTo(0, -6).lineTo(2, -2).lineTo(6, 0).lineTo(2, 2).lineTo(0, 6).lineTo(-2, 2).lineTo(-6, 0).lineTo(-2, -2).closePath().fill({ color: particleColor });
    } else {
      p.circle(0, 0, 3 + Math.random() * 4).fill({ color: particleColor });
    }
    p.position.set(burstX, burstY);
    fxLayer.addChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = (e.cfg.boss ? 55 : 38) + Math.random() * (e.cfg.boss ? 75 : 58);
    sched.tween(e.cfg.boss ? 0.7 : 0.56, (k) => {
      p.position.set(burstX + Math.cos(a) * d * k, burstY + Math.sin(a) * d * k + 42 * k * k);
      p.rotation = a + k * 4;
      p.alpha = 1 - k;
    }, EaseOutQuad, () => p.destroy());
  }
  updateFocus();
}

function breakShield(e       )       {
  e.shieldUp = false;
  e.cd += 1;
  audio.play('shield-break');
  floatText(t('shieldBreak'), e.root.x, e.baseY - e.cfg.h - 20 + 48, ORB_COLORS[e.shieldColor], 18);
  refreshEnemyHud(e);
}

async function enemyTurn()                {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.cd--;
    if (e.cd > 0) {
      refreshEnemyHud(e);
      continue;
    }
    // 棉花糖治疗同伴 / 其他敌人攻击
    if (e.cfg.heal) await enemyHeal(e);
    else if (e.cfg.seal) await enemySeal(e);
    else await enemyAttack(e);
    if (phase === PHASE.Over) return;
    if (e.cfg.boss && e.angry) {
      e.bossAlt = !e.bossAlt;
      e.cd = e.bossAlt ? 1 : 2;
    } else {
      e.cd = e.cfg.period;
    }
    refreshEnemyHud(e);
  }
  // 精英护盾轮换
  for (const e of enemies) {
    if (!e.alive || !e.cfg.elite) continue;
    e.shieldTurns++;
    if (e.shieldTurns >= 2) {
      e.shieldTurns = 0;
      e.shieldColor = (e.shieldColor + 1) % 4;
      e.shieldUp = true;
      refreshEnemyHud(e);
      floatText(t('shieldRotate'), e.root.x, e.baseY - e.cfg.h - 20 + 48, ORB_COLORS[e.shieldColor], 16);
    }
  }
}

// 棉花糖护士：治疗所有存活同伴
async function enemyHeal(e       )                {
  e.squashCd = 0.5;
  await new Promise      ((resolve) => {
    sched.tween(0.22, (k) => (e.root.y = e.baseY - 14 * Math.sin(k * Math.PI)), EaseOutQuad, () => resolve());
  });
  e.root.y = e.baseY;
  audio.play('heal-chime', 1.1, 0.6);
  const amount = e.cfg.heal ?? 0;
  for (const o of enemies) {
    if (!o.alive || o === e) continue;
    o.hp = Math.min(o.maxHp, o.hp + amount);
    refreshEnemyHud(o);
    floatText(`+${amount}`, o.root.x, o.baseY - o.cfg.h - 20 + 48, PAL.green, 18);
    spawnBurst(o.root.x, o.baseY - o.cfg.h * 0.5 + 48, PAL.green, 5);
  }
  await sched.delay(0.25);
}

// 冰淇淋术士：给随机糖珠上奶油封印
async function enemySeal(e       )                {
  e.squashCd = 0.5;
  await new Promise      ((resolve) => {
    sched.tween(0.22, (k) => (e.root.y = e.baseY - 14 * Math.sin(k * Math.PI)), EaseOutQuad, () => resolve());
  });
  e.root.y = e.baseY;
  audio.play('enemy-warn', 0.9);
  const n = board.addSeals(e.cfg.seal ?? 2);
  if (n > 0) floatText(t('sealCast'), e.root.x, e.baseY - e.cfg.h - 20 + 48, PAL.purple, 18);
  await sched.delay(0.25);
}

// 嘲讽下的有效目标
function currentTarget()                    {
  const taunt = enemies.find((e) => e.alive && e.cfg.taunt);
  if (taunt) return taunt;
  return enemies[targetIdx]?.alive ? enemies[targetIdx] : enemies.find((e) => e.alive);
}

async function enemyAttack(e       )                {
  const oy = e.root.y;
  const ox = e.root.x;
  e.squashCd = 0.6; // 演出期间暂停待机摆动
  // 蓄力下蹲
  await new Promise      ((resolve) => {
    sched.tween(0.14, (k) => {
      e.sprite.scale.set(e.baseSX * (1 + 0.12 * k), e.baseSY * (1 - 0.12 * k));
    }, EaseOutQuad, () => resolve());
  });
  // 前扑
  audio.play('cast-attack', 0.9, 0.45);
  await new Promise      ((resolve) => {
    sched.tween(0.14, (k) => {
      e.root.y = oy + 34 * k;
      e.root.x = ox - 16 * k;
      e.sprite.rotation = -0.12 * k;
    }, EaseInQuad, () => resolve());
  });
  let dmg = e.cfg.boss && e.angry ? Math.round(e.cfg.atk * 1.25) : e.cfg.atk;
  if (e.debuffHalf) {
    dmg = Math.round(dmg * 0.5);
    e.debuffHalf = false;
    popBubble(e);
  }
  // 随机攻击 1-4 只小动物
  const k = 1 + Math.floor(Math.random() * 4);
  const idxs = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, k);
  audio.play('party-hit', 0.85, 0.4);
  for (const ai of idxs) {
    hp[ai] = Math.max(0, hp[ai] - dmg);
    floatText(`-${dmg}`, portraitX(ai), 344, 0xff5c5c, 22);
    const port = portraits[ai];
    sched.tween(0.25, (k2) => (port.rotation = 0.15 * Math.sin(k2 * Math.PI * 3) * (1 - k2)));
  }
  // 命中冲击环
  const ring = new Graphics().circle(0, 0, 10).stroke({ width: 4, color: 0xff5c5c, alpha: 0.8 });
  ring.position.set(W / 2, 320);
  fxLayer.addChild(ring);
  sched.tween(0.3, (k) => {
    ring.scale.set(1 + k * 4);
    ring.alpha = 0.8 * (1 - k);
  }, EaseOutQuad, () => ring.destroy());
  shake(e.cfg.boss ? 4 : 2, 0.12);
  updatePartyHud();
  // 队伍栏抖动
  sched.tween(0.2, (k) => (partyLayer.x = 4 * Math.sin(k * Math.PI * 3) * (1 - k)));
  // 收回
  await new Promise      ((resolve) => {
    sched.tween(0.22, (k) => {
      e.root.y = oy + 34 * (1 - k);
      e.root.x = ox - 16 * (1 - k);
      e.sprite.rotation = -0.12 * (1 - k);
    }, EaseOutQuad, () => resolve());
  });
  e.root.y = oy;
  e.root.x = ox;
  e.sprite.rotation = 0;
  if (totalHp() <= 0) gameOver();
}

// ---------- Boss 二阶段 ----------
async function bossPhase2(e       )                {
  audio.play('enemy-warn', 0.8);
  e.glowG.visible = true;
  e.glowG.ellipse(0, -e.cfg.h * 0.45, e.sprite.width * 0.72, e.cfg.h * 0.62).fill({ color: 0x8f3c72, alpha: 0.28 });
  e.sprite.tint = 0xe6bfd4;
  // 卡通怒气符号：强化二阶段，但不再使用腐坏裂纹。
  const anger = new Graphics();
  anger.moveTo(42, -e.cfg.h + 22).lineTo(54, -e.cfg.h + 10);
  anger.moveTo(48, -e.cfg.h + 28).lineTo(63, -e.cfg.h + 23);
  anger.moveTo(37, -e.cfg.h + 17).lineTo(42, -e.cfg.h + 3);
  anger.stroke({ width: 4, color: 0x8f3c72, alpha: 0.95 });
  e.root.addChild(anger);
  floatText(t('bossAngry'), e.root.x, e.baseY - e.cfg.h - 30 + 48, 0xc9578e, 22);
  const n = board.addSeals(4);
  if (n > 0 && !bubbleShown.seal) {
    bubbleShown.seal = true;
    showBubble(t('bubSeal'), 210, 268);
  }
  await sched.delay(0.3);
}

// ---------- 连携演出 ----------
async function playTricolor()                {
  audio.play('combo-tricolor');
  // 全屏柔光闪
  const flash = new Graphics().rect(0, 0, W, H).fill({ color: PAL.yellow, alpha: 0.22 });
  fxLayer.addChild(flash);
  sched.tween(0.45, (k) => (flash.alpha = 0.22 * (1 - k)), EaseOutQuad, () => flash.destroy());
  const banner = mkText(t('tri'), 34, PAL.yellow, 7);
  banner.anchor.set(0.5);
  banner.position.set(W / 2, 210);
  banner.scale.set(0.3);
  fxLayer.addChild(banner);
  for (let i = 0; i < 5; i++) {
    sched.tween(0.15 + i * 0.08, () => {}, EaseOutQuad, () => {
      // 连携反馈只使用头像周围的粒子，禁止缩放整个 HUD 容器；
      // 否则头像框与血条会一起放大并下移，看起来像单个角色尺寸异常。
      spawnBurst(portraitX(i), 330, ORB_COLORS[i], 7);
    });
  }
  sched.tween(0.4, (k) => banner.scale.set(0.3 + 0.7 * k), EaseOutBack);
  sched.tween(0.9, (k) => (banner.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3), EaseOutQuad, () => banner.destroy());
  await sched.delay(0.5);
}

async function playRainbowCutin(withDamagePose = true)                {
  audio.play('rainbow-slam');
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x8a6d5c, alpha: 0.4 });
  dim.alpha = 0;
  fxLayer.addChild(dim);
  sched.tween(0.2, (k) => (dim.alpha = 0.55 * k));
  // 五人切入画面边缘
  const spots = [
    { x: 44, y: 240, r: -0.08 },
    { x: W - 44, y: 240, r: 0.08 },
    { x: 44, y: 420, r: -0.08 },
    { x: W - 44, y: 420, r: 0.08 },
    { x: W / 2, y: 150, r: 0 },
  ];
  badges.forEach((b, i) => {
    const sx = spots[i].x < W / 2 ? -120 : W + 120;
    b.visible = true;
    b.scale.set(1);
    b.position.set(sx, spots[i].y + 60);
    sched.tween(0.3, (k) => {
      b.x = sx + (spots[i].x - sx) * k;
      b.y = spots[i].y + 60 - 60 * k;
      b.rotation = spots[i].r * k;
    }, EaseOutBack);
  });
  await sched.delay(0.35);
  // 旋转放射光
  const rays = new Graphics();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.moveTo(0, 0).arc(0, 0, 300, a, a + 0.2).closePath().fill({ color: PAL.yellow, alpha: 0.14 });
  }
  rays.position.set(W / 2, 200);
  fxLayer.addChild(rays);
  sched.tween(1.4, (k) => (rays.rotation = k * 1.4));
  // 圣代砸下
  const sundae = new Sprite(TEX.sundae);
  sundae.anchor.set(0.5);
  sundae.height = 0;
  sundae.width = 0;
  sundae.position.set(W / 2, -80);
  fxLayer.addChild(sundae);
  const targetH = 168;
  const ratio = TEX.sundae.width / TEX.sundae.height;
  await new Promise      ((resolve) => {
    sched.tween(0.34, (k) => {
      sundae.height = targetH * Math.min(1, k * 1.6);
      sundae.width = sundae.height * ratio;
      sundae.y = -80 + (200 + 80) * k * k;
    }, EaseInQuad, () => resolve());
  });
  // 命中闪光
  const flash = new Graphics().rect(0, 0, W, H).fill({ color: 0xffffff, alpha: 0.85 });
  flash.alpha = 0;
  fxLayer.addChild(flash);
  sched.tween(0.3, (k) => (flash.alpha = k < 0.3 ? (k / 0.3) * 0.85 : 0.85 * (1 - (k - 0.3) / 0.7)), EaseOutQuad, () => flash.destroy());
  shake(5, 0.2);
  await sched.delay(0.5);
  // 收场
  sched.tween(0.3, (k) => {
    sundae.alpha = 1 - k;
    dim.alpha = 0.55 * (1 - k);
  }, EaseOutQuad, () => {
    sundae.destroy();
    dim.destroy();
    rays.destroy();
  });
  badges.forEach((b, i) => {
    const ex = spots[i].x < W / 2 ? -140 : W + 140;
    sched.tween(0.28, (k) => (b.x = spots[i].x + (ex - spots[i].x) * k), EaseInQuad, () => {
      b.visible = false;
      b.rotation = 0;
    });
  });
  await sched.delay(0.32);
  void withDamagePose;
}

// ---------- 技能特效演出 ----------
function skillCutin(i        , label        )                {
  const badge = badges[i];
  const strip = new Graphics().roundRect(-140, -23, 280, 46, 12).fill({ color: ORB_COLORS[i], alpha: 0.95 }).stroke({ width: 3, color: PAL.cream });
  const t = mkText(label, 23, PAL.cream, 5);
  t.anchor.set(0.5, 0.5);
  const banner = new Container();
  banner.addChild(strip, t);
  banner.position.set(W + 150, 252);
  fxLayer.addChild(banner);
  sched.tween(0.22, (k) => (banner.x = W + 150 + (W / 2 - (W + 150)) * k), EaseOutBack);
  sched.tween(1.0, (k) => (banner.alpha = k < 0.72 ? 1 : 1 - (k - 0.72) / 0.28), EaseOutQuad, () => banner.destroy());
  badge.visible = true;
  badge.position.set(-90, 240);
  badge.scale.set(0.6);
  return new Promise      ((resolve) => {
    sched.tween(0.2, (k) => {
      badge.x = -90 + (92 + 90) * k;
      badge.scale.set(0.6 + 0.65 * k);
    }, EaseOutBack, () => resolve());
  });
}

function skillOutro(i        )       {
  const badge = badges[i];
  sched.tween(0.18, (k) => {
    badge.x = 92 - (92 + 90) * k;
    badge.scale.set(1.25 - 0.65 * k);
  }, EaseInQuad, () => (badge.visible = false));
}

function spawnBurst(x        , y        , color        , n        )       {
  for (let i = 0; i < n; i++) {
    const p = new Graphics().circle(0, 0, 3 + Math.random() * 4).fill({ color: i % 3 === 2 ? PAL.cream : color });
    p.position.set(x, y);
    fxLayer.addChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 60;
    sched.tween(0.5, (k) => {
      p.position.set(x + Math.cos(a) * d * k, y + Math.sin(a) * d * k + 50 * k * k);
      p.alpha = 1 - k;
    }, EaseOutQuad, () => p.destroy());
  }
}

// 橙：巨型草莓弹
async function fxRed(target       , dmg        )                {
  const start = { x: 108, y: 210 };
  const end = { x: target.root.x, y: target.baseY - target.cfg.h * 0.5 + 48 };
  const berry = new Sprite(TEX['prop-strawberry']);
  berry.anchor.set(0.5);
  berry.height = 56;
  berry.width = 56 * (TEX['prop-strawberry'].width / TEX['prop-strawberry'].height);
  berry.position.set(start.x, start.y);
  fxLayer.addChild(berry);
  let frame = 0;
  await new Promise      ((resolve) => {
    sched.tween(0.45, (k) => {
      berry.position.set(start.x + (end.x - start.x) * k, start.y + (end.y - start.y) * k - Math.sin(k * Math.PI) * 46);
      berry.rotation = k * 9;
      if (frame++ % 3 === 0) spawnBurst(berry.x, berry.y, PAL.red, 1);
    }, EaseInQuad, () => resolve());
  });
  berry.destroy();
  audio.play('match-pop', 0.85);
  spawnBurst(end.x, end.y, PAL.red, 22);
  const flash = new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.9 });
  flash.position.set(end.x, end.y);
  fxLayer.addChild(flash);
  sched.tween(0.25, (k) => {
    flash.scale.set(1 + k * 6);
    flash.alpha = 0.9 * (1 - k);
  }, EaseOutQuad, () => flash.destroy());
  shake(4, 0.15);
  const { final, brokeShield } = calcDamage(target, 0, dmg);
  if (brokeShield) breakShield(target);
  applyDamage(target, final, PAL.red);
  await sched.delay(0.25);
}

// 蓝：泡泡弹 + 包裹减益
async function fxBlue(target       , dmg        )                {
  audio.play('heal-chime', 1.2);
  const { final, brokeShield } = calcDamage(target, 1, dmg);
  if (brokeShield) breakShield(target);
  applyDamage(target, final, PAL.blue);
  const start = { x: 108, y: 210 };
  const end = { x: target.root.x, y: target.baseY - target.cfg.h * 0.45 + 48 };
  for (let i = 0; i < 8; i++) {
    const b = new Sprite(TEX['prop-bubble']);
    b.anchor.set(0.5);
    b.width = 18 + (i % 3) * 6;
    b.height = b.width;
    b.position.set(start.x, start.y);
    fxLayer.addChild(b);
    sched.tween(i * 0.045, () => {}, EaseOutQuad, () => {
      sched.tween(0.5, (k) => {
        b.position.set(start.x + (end.x - start.x) * k, start.y + (end.y - start.y) * k - Math.sin(k * Math.PI) * (30 + i * 6));
        b.alpha = 0.9 - 0.4 * k;
      }, EaseOutQuad, () => b.destroy());
    });
  }
  await sched.delay(0.62);
  popBubble(target);
  const big = new Sprite(TEX['prop-bubble']);
  big.anchor.set(0.5);
  const h = target.cfg.h * 1.25;
  big.height = h;
  big.width = h * (TEX['prop-bubble'].width / TEX['prop-bubble'].height);
  big.position.set(0, -target.cfg.h * 0.45);
  big.alpha = 0.75;
  const bsc = big.scale.y;
  big.scale.set(0);
  target.root.addChild(big);
  target.bubbleSpr = big;
  sched.tween(0.3, (k) => big.scale.set(bsc * k), EaseOutBack);
  target.debuffHalf = true;
  floatText(t('debuff'), target.root.x, target.baseY - target.cfg.h - 20 + 48, PAL.blue, 18);
  await sched.delay(0.3);
}

function popBubble(e       )       {
  const b = e.bubbleSpr;
  if (!b) return;
  e.bubbleSpr = null;
  audio.play('seal-break', 1.3, 0.6);
  spawnBurst(e.root.x, e.baseY - e.cfg.h * 0.45 + 48, PAL.blue, 8);
  b.destroy();
}

// 绿：叶片旋风扫过棋盘 + 伤害
async function fxGreen(target       , dmg        )                {
  audio.play('heal-chime', 0.9);
  const { final, brokeShield } = calcDamage(target, 2, dmg);
  if (brokeShield) breakShield(target);
  applyDamage(target, final, PAL.green);
  const cx = W / 2;
  const cy = BOARD_Y + 163;
  const leaves           = [];
  for (let i = 0; i < 10; i++) {
    const leaf = new Sprite(TEX['prop-leaf']);
    leaf.anchor.set(0.5);
    leaf.width = 26;
    leaf.height = 26;
    fxLayer.addChild(leaf);
    leaves.push(leaf);
  }
  await new Promise      ((resolve) => {
    sched.tween(0.7, (k) => {
      leaves.forEach((leaf, i) => {
        const ang = (i / leaves.length) * Math.PI * 2 + k * 6;
        const rad = 150 * (1 - k * 0.55);
        leaf.position.set(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.7);
        leaf.rotation = ang;
      });
    }, EaseOutQuad, () => resolve());
  });
  leaves.forEach((leaf) => leaf.destroy());
  await board.convertRandomTo(3, TYPE.G, TYPE.H);
  // 转化造成的匹配自动连锁结算（不推进敌方回合）
  const waves = await board.resolveBoard();
  if (waves.length) await applyWaves(waves);
}

// 黄：星星雨落向队伍 + 伤害 + 全员恢复 300
async function fxYellow(target       , dmg        )                {
  audio.play('heal-chime');
  const heal = Math.round(300 * EVOLUTION_POWER[evolutionStage(3)]);
  for (let i = 0; i < 6; i++) {
    const st = new Sprite(TEX['prop-star']);
    st.anchor.set(0.5);
    st.width = 22 + (i % 3) * 8;
    st.height = st.width;
    const x = 60 + i * 60;
    st.position.set(x, 40);
    st.alpha = 0;
    fxLayer.addChild(st);
    sched.tween(i * 0.07, () => {}, EaseOutQuad, () => {
      st.alpha = 1;
      sched.tween(0.5, (k) => {
        st.position.set(x + Math.sin(k * 5) * 8, 40 + (316 - 40) * k * k);
        st.rotation = k * 3;
      }, EaseInQuad, () => {
        spawnBurst(st.x, st.y, PAL.yellow, 4);
        st.destroy();
      });
    });
  }
  await sched.delay(0.9);
  const { final, brokeShield } = calcDamage(target, 3, dmg);
  if (brokeShield) breakShield(target);
  applyDamage(target, final, PAL.yellow);
  for (let i = 0; i < 5; i++) {
    hp[i] = Math.min(MAX_HP, hp[i] + heal);
    floatText(`+${heal}`, portraitX(i), 344, PAL.heart, 18);
  }
  updatePartyHud();
  const glow = new Graphics().roundRect(60, 326, 296, 82, 14).stroke({ width: 4, color: PAL.heart, alpha: 0.9 });
  fxLayer.addChild(glow);
  sched.tween(0.5, (k) => (glow.alpha = 0.9 * (1 - k)), EaseOutQuad, () => glow.destroy());
  await sched.delay(0.2);
}

// ---------- 楼层与胜负 ----------
let floorStartTime = 0;
let mapPulse                   = null;

function starsOf(floorIdx        )         {
  try {
    return ((JSON.parse(localStorage.getItem('tz_stars') || '{}')                          )[floorIdx] || 0)          ;
  } catch {
    return 0;
  }
}

function saveStars(floorIdx        , s        )       {
  let m                         = {};
  try {
    m = JSON.parse(localStorage.getItem('tz_stars') || '{}')                          ;
  } catch {
    m = {};
  }
  if ((m[floorIdx] || 0) < s) {
    m[floorIdx] = s;
    localStorage.setItem('tz_stars', JSON.stringify(m));
  }
}

function checkFloorCleared()          {
  if (enemies.some((e) => e.alive)) return false;
  if (floorIndex >= FLOORS.length - 1) {
    void victory();
    return true;
  }
  void floorClearFlow();
  return true;
}

// 过关流程：评价星级 → 庆祝 → 关卡地图
async function floorClearFlow()                {
  const cleared = floorIndex;
  const stars = totalHp() >= 4000 ? 3 : totalHp() >= 2000 ? 2 : 1;
  saveStars(cleared, stars);
  await playFloorClear();
  showFloorClearScreen(cleared, stars);
}

function showFloorClearScreen(cleared        , stars        )       {
  setStandalonePage(true);
  phase = PHASE.Busy;
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.yellow, PAL.heart));
  addPageHeader(ov, t('clear'), t('floor' + cleared), PAL.yellow);
  ov.addChild(makePagePanel(W / 2, 344, 354, 390, PAL.yellow, 28));

  for (let s = 0; s < 3; s++) {
    const star = new Sprite(TEX['icon-star']);
    star.anchor.set(0.5);
    star.width = 58;
    star.height = 58;
    star.position.set(W / 2 - 70 + s * 70, 182);
    star.tint = s < stars ? PAL.yellow : 0xd8ced8;
    ov.addChild(star);
  }

  const heroTex = TEX[charTextureKey(cleared % 5)];
  const hero = new Sprite(heroTex);
  hero.anchor.set(0.5, 1);
  hero.height = 128;
  hero.width = hero.height * (heroTex.width / heroTex.height);
  hero.position.set(W / 2, 376);
  ov.addChild(hero);

  const secs = Math.max(0, Math.round(timeSec - floorStartTime));
  const statData = [
    [t('floorTime').replace('{x}', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`), PAL.blue],
    [t('rlCombo').replace('{x}', `${maxCombo}`), PAL.red],
    [t('rlSundae').replace('{x}', `${rainbowCount}`), PAL.purple],
    [t('rlHp').replace('{x}', `${totalHp()}`), PAL.green],
  ];
  statData.forEach(([label, color], i) => {
    const x = i % 2 === 0 ? 119 : 301;
    const y = i < 2 ? 423 : 467;
    const chip = new Graphics();
    chip.roundRect(x - 82, y - 17, 164, 34, 14).fill(MENU_PAL.paper).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.38 });
    chip.roundRect(x - 70, y + 11, 140, 3, 2).fill({ color, alpha: 0.2 });
    const text = mkText(label, 12, MENU_PAL.ink);
    text.anchor.set(0.5);
    text.position.set(x, y);
    ov.addChild(chip, text);
  });
  const reward = mkText(t('clearReward'), 16, PAL.heart);
  reward.anchor.set(0.5);
  reward.position.set(W / 2, 520);
  ov.addChild(reward);

  const next = mkPageButton(t('continueBtn'), 154, 58, () => {
    clearOverlay();
    setStandalonePage(false);
    void nextFloor();
  }, PAL.red, true, 20);
  next.position.set(120, 636);
  const readyToEvolve = canAnyHeroEvolve();
  const evolve = mkPageButton(readyToEvolve ? t('evolutionReady') : t('evolutionTab'), 154, 58, () => {
    showEvolutionFromPage(() => showFloorClearScreen(cleared, stars));
  }, PAL.yellow, readyToEvolve, 16);
  evolve.position.set(300, 636);
  const map = mkPageButton(t('mapTitle'), 320, 54, () => showFloorMap(cleared, stars, false), PAL.blue, false, 17);
  map.position.set(W / 2, 706);
  ov.addChild(next, evolve, map);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function showFloorMap(cleared        , newStars        , fromMenu = false)       {
  setStandalonePage(true);
  phase = fromMenu ? PHASE.Title : PHASE.Busy;
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.blue, PAL.purple));
  const backAction = () => {
    mapPulse = null;
    if (fromMenu) showTitle();
    else showFloorClearScreen(cleared, newStars);
  };
  addPageHeader(ov, t('selectStage'), t('mapHint'), PAL.blue, backAction);
  ov.addChild(makePagePanel(W / 2, 402, 386, 548, PAL.blue, 28));

  const nodeY = (i        ) => 178 + Math.floor(i / 2) * 94;
  const nodeX = (i        ) => (i % 2 === 0 ? 110 : 310);
  const nextIndex = Math.min(cleared + 1, FLOORS.length - 1);
  mapPulse = null;
  FLOORS.forEach((cfgArr, i) => {
    const done = i <= cleared;
    const isNext = i === nextIndex;
    const unlocked = done || isNext;
    const node = new Container();
    node.position.set(nodeX(i), nodeY(i));
    const shadow = new Graphics().roundRect(-86, -38, 172, 82, 18).fill({ color: MENU_PAL.wine, alpha: unlocked ? UI_ELEVATION.card.alpha : 0.01 });
    shadow.y = UI_ELEVATION.card.offset;
    const bodyColor = done ? 0xfffdf8 : isNext ? 0xfff1f5 : 0xe9e3e9;
    const strokeColor = done ? PAL.yellow : isNext ? PAL.heart : 0xc9becb;
    const body = new Graphics();
    body.roundRect(-86, -38, 172, 82, 18).fill(bodyColor).stroke({ width: 1.4, color: MENU_PAL.gold, alpha: unlocked ? 0.5 : 0.22 });
    body.roundRect(-80, -32, 160, 70, 14).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: unlocked ? 0.13 : 0.06 });
    body.roundRect(-76, 35, 152, 2.5, 2).fill({ color: strokeColor, alpha: unlocked ? 0.22 : 0.09 });
    const noBg = new Graphics().circle(-69, -23, 13).fill(done ? PAL.yellow : isNext ? PAL.heart : 0xc9becb);
    const no = mkText(`${i + 1}`, 11.5, PAL.brown);
    no.anchor.set(0.5);
    no.position.set(-69, -23);
    const ico = new Sprite(TEX[cfgArr[0].tex]);
    ico.anchor.set(0.5);
    ico.height = 50;
    ico.width = 50 * (TEX[cfgArr[0].tex].width / TEX[cfgArr[0].tex].height);
    if (ico.width > 56) ico.width = 56;
    ico.position.set(-50, 5);
    ico.alpha = unlocked ? 1 : 0.34;

    const bossName = mkText(floorCardText(i, 'name'), LANG === 'en' ? 9.6 : 10.8, MENU_PAL.wine);
    bossName.style.letterSpacing = LANG === 'en' ? 0.05 : 0.2;
    bossName.anchor.set(0.5);
    bossName.position.set(23, -24);
    if (bossName.width > 102) bossName.scale.set(102 / bossName.width);
    bossName.alpha = unlocked ? 1 : 0.62;

    const tagBg = new Graphics().roundRect(-25, -14, 96, 15, 7).fill({ color: strokeColor, alpha: unlocked ? 0.2 : 0.1 });
    const tag = mkText(floorCardText(i, 'tag'), LANG === 'en' ? 7.1 : 8.1, MENU_PAL.cocoa);
    tag.style.letterSpacing = LANG === 'en' ? 0.35 : 0.2;
    tag.anchor.set(0.5);
    tag.position.set(23, -6.5);
    if (tag.width > 88) tag.scale.set(88 / tag.width);
    tag.alpha = unlocked ? 0.88 : 0.5;

    const brief = mkText(floorCardText(i, 'brief'), LANG === 'zh' ? 8.4 : 7.2, MENU_PAL.ink, 0, 98);
    brief.style.lineHeight = LANG === 'zh' ? 10 : 8.5;
    brief.anchor.set(0.5);
    brief.position.set(23, 10);
    brief.alpha = unlocked ? 0.72 : 0.42;
    node.addChild(shadow, body, noBg, no, ico, bossName, tagBg, tag, brief);
    const saved = starsOf(i);
    for (let s = 0; s < 3; s++) {
      const star = new Sprite(TEX['icon-star']);
      star.anchor.set(0.5);
      star.width = 13;
      star.height = 13;
      star.position.set(7 + s * 16, 31);
      star.tint = s < saved ? PAL.yellow : 0xc7bdc9;
      node.addChild(star);
    }
    if (isNext) {
      const nextTag = mkText('→', 18, PAL.red);
      nextTag.anchor.set(0.5);
      nextTag.position.set(70, -25);
      node.addChild(nextTag);
      mapPulse = node;
    }
    if (unlocked) {
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.on('pointertap', () => {
        audio.play('orb-step', 1.1);
        mapPulse = null;
        clearOverlay();
        spawnFloor(i);
        showFloorIntro(i);
      });
    }
    ov.addChild(node);
  });

  const continueBtn = mkPageButton(t('continueBtn'), 286, 54, () => {
    mapPulse = null;
    clearOverlay();
    spawnFloor(nextIndex);
    showFloorIntro(nextIndex);
  }, PAL.blue, true, 18);
  continueBtn.position.set(W / 2, 718);
  ov.addChild(continueBtn);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

// Legacy map kept only as a layout reference during the v12 screen split.
function showFloorMapLegacy(cleared        , newStars        , fromMenu = false)       {
  clearOverlay();
  const ov = new Container();
  overlayLayer.addChild(ov);
  activeOverlay = ov;
  blockOverlay(ov);
  ov.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x8a6d5c, alpha: 0.78 }));
  const title = mkText(fromMenu ? t('selectStage') : t('mapTitle'), 32, PAL.cream, 6);
  title.anchor.set(0.5);
  title.position.set(W / 2, fromMenu ? 118 : 82);
  ov.addChild(title);
  if (!fromMenu) {
    // 本层评价星（大）
    for (let s = 0; s < 3; s++) {
      const star = new Sprite(TEX['icon-star']);
      star.anchor.set(0.5);
      star.width = 38;
      star.height = 38;
      star.position.set(W / 2 - 44 + s * 44, 126);
      star.tint = s < newStars ? PAL.yellow : 0x6e6076;
      ov.addChild(star);
    }
    // 完整结算行
    const secs = Math.max(0, Math.round(timeSec - floorStartTime));
    const lines = [
      `${t('floorTime').replace('{x}', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`)} · ${t('rlCombo').replace('{x}', `${maxCombo}`)}`,
      `${t('rlSundae').replace('{x}', `${rainbowCount}`)} · ${t('rlHp').replace('{x}', `${totalHp()}`)}`,
      t('starRule'),
    ];
    lines.forEach((l, i) => {
      const lt = mkText(l, i === 2 ? 13 : 17, i === 2 ? PAL.yellow : PAL.cream, 3);
      lt.anchor.set(0.5);
      lt.position.set(W / 2, 166 + i * 27);
      ov.addChild(lt);
    });
  }
  const nodeY = (i        ) => 272 + Math.floor(i / 2) * 84;
  const nodeX = (i        ) => (i % 2 === 0 ? 118 : 302);
  const link = new Graphics();
  for (let i = 0; i < FLOORS.length - 1; i++) link.moveTo(nodeX(i), nodeY(i)).lineTo(nodeX(i + 1), nodeY(i + 1));
  link.stroke({ width: 5, color: PAL.cream, alpha: 0.4 });
  ov.addChild(link);
  const next = Math.min(cleared + 1, FLOORS.length - 1);
  mapPulse = null;
  FLOORS.forEach((cfgArr, i) => {
    const done = i <= cleared;
    const isNext = i === next;
    const node = new Container();
    node.position.set(nodeX(i), nodeY(i));
    const bg = new Graphics().circle(0, 0, 36).fill(done ? PAL.yellow : isNext ? PAL.heart : 0x9c8ba0).stroke({ width: 3, color: PAL.cream });
    const ico = new Sprite(TEX[cfgArr[0].tex]);
    ico.anchor.set(0.5);
    ico.height = 44;
    ico.width = 44 * (TEX[cfgArr[0].tex].width / TEX[cfgArr[0].tex].height);
    const no = mkText(`${i + 1}`, 15, done || isNext ? PAL.brown : PAL.cream, 0);
    no.anchor.set(0.5);
    no.position.set(-25, -27);
    node.addChild(bg, ico, no);
    const saved = starsOf(i);
    for (let s = 0; s < 3; s++) {
      const star = new Sprite(TEX['icon-star']);
      star.anchor.set(0.5);
      star.width = 19;
      star.height = 19;
      star.position.set(-20 + s * 20, 44);
      star.tint = s < saved ? PAL.yellow : 0x6e6076;
      node.addChild(star);
    }
    if (isNext) {
      const you = mkText('▼ YOU', 17, PAL.yellow, 3);
      you.anchor.set(0.5);
      you.position.set(0, -52);
      node.addChild(you);
      mapPulse = node;
    }
    if (done || (fromMenu && isNext)) {
      node.eventMode = 'static';
      node.cursor = 'pointer';
      node.on('pointertap', () => {
        audio.play('orb-step', 1.1);
        mapPulse = null;
        clearOverlay();
        if (done) {
          spawnFloor(i);
          showFloorIntro(i);
        } else {
          spawnFloor(i);
          showFloorIntro(i);
        }
      });
    }
    ov.addChild(node);
  });
  const hint = mkText(t('mapHint'), 16, PAL.cream, 3);
  hint.anchor.set(0.5);
  hint.position.set(W / 2, 692);
  ov.addChild(hint);
  const btn = mkButton(t('continueBtn'), 210, 56, () => {
    mapPulse = null;
    clearOverlay();
    if (fromMenu) {
      spawnFloor(next);
      showFloorIntro(next);
    } else {
      void nextFloor();
    }
  });
  btn.position.set(W / 2, 750);
  ov.addChild(btn);
  if (fromMenu) {
    btn.position.set(W / 2 - 116, 750);
    const back = mkButton(t('back'), 210, 56, () => showTitle(), PAL.green);
    back.position.set(W / 2 + 116, 750);
    ov.addChild(back);
  }
}

// 每层剧情卡：层名 + 敌人阵容 + 一句话剧情
// 每层剧情卡：层名 + 敌人阵容 + 三句对话小剧场（点按推进）
const FLOOR_DIALOG                                    = [
  [{ who: 'orange', text: 'd0a' }, { who: 'mob', text: 'd0b' }, { who: 'blue', text: 'd0c' }],
  [{ who: 'green', text: 'd1a' }, { who: 'yellow', text: 'd1b' }, { who: 'orange', text: 'd1c' }],
  [{ who: 'blue', text: 'd2a' }, { who: 'yellow', text: 'd2b' }, { who: 'mob', text: 'd2c' }],
  [{ who: 'green', text: 'd3a' }, { who: 'orange', text: 'd3b' }, { who: 'mob', text: 'd3c' }],
  [{ who: 'blue', text: 'd4a' }, { who: 'yellow', text: 'd4b' }, { who: 'orange', text: 'd4c' }],
  [{ who: 'pink', text: 'd5a' }, { who: 'blue', text: 'd5b' }, { who: 'mob', text: 'd5c' }],
  [{ who: 'green', text: 'd6a' }, { who: 'orange', text: 'd6b' }, { who: 'yellow', text: 'd6c' }],
  [{ who: 'pink', text: 'd7a' }, { who: 'blue', text: 'd7b' }, { who: 'yellow', text: 'd7c' }],
  [{ who: 'orange', text: 'd8a' }, { who: 'green', text: 'd8b' }, { who: 'pink', text: 'd8c' }],
  [{ who: 'boss', text: 'd9a' }, { who: 'orange', text: 'd9b' }, { who: 'yellow', text: 'd9c' }],
];

function showFloorIntro(idx        )       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  overlayLayer.addChild(ov);
  activeOverlay = ov;
  blockOverlay(ov);
  const floorAccent = ORB_COLORS[idx % ORB_COLORS.length];
  ov.addChild(makePageBase(floorAccent, PAL.purple));
  addPageHeader(ov, t('floor' + idx), t('sub'), floorAccent);
  ov.addChild(makePagePanel(W / 2, 392, W - 60, 412, floorAccent, 24));
  const cfgs = FLOORS[idx];
  const gap = 300 / cfgs.length;
  cfgs.forEach((cfg, i) => {
    const sp = new Sprite(TEX[cfg.tex]);
    sp.anchor.set(0.5, 1);
    sp.height = 88;
    sp.width = 88 * (TEX[cfg.tex].width / TEX[cfg.tex].height);
    sp.position.set(60 + gap * (i + 0.5), 380);
    ov.addChild(sp);
    const bsx = sp.scale.x;
    const bsy = sp.scale.y;
    sched.tween(0.15 + i * 0.1, () => {}, EaseOutQuad, () => {
      sched.tween(0.25, (k) => {
        if (!sp.destroyed) sp.scale.set(bsx * (1 + 0.15 * Math.sin(k * Math.PI)), bsy * (1 - 0.1 * Math.sin(k * Math.PI)));
      });
    });
  });
  // 对话区（左侧说话人立绘）
  const dbox = new Graphics();
  dbox.roundRect(48, 404 + UI_ELEVATION.card.offset, W - 96, 116, 14).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
  dbox.roundRect(48, 404, W - 96, 116, 14).fill(MENU_PAL.paper).stroke({ width: 1.4, color: MENU_PAL.gold, alpha: 0.48 });
  dbox.roundRect(54, 410, W - 108, 104, 10).stroke({ width: 1, color: floorAccent, alpha: 0.14 });
  ov.addChild(dbox);
  const portBg = new Graphics().circle(92, 462, 31).fill(PAL.boardBg).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.55 });
  const portSpr = new Sprite(TEX[charTextureKey(0)]);
  portSpr.width = 64;
  portSpr.height = 64;
  portSpr.anchor.set(0.5, 0.36);
  portSpr.position.set(92, 462);
  const portMask = new Graphics().circle(92, 462, 29).fill(0xffffff);
  portSpr.mask = portMask;
  ov.addChild(portBg, portSpr, portMask);
  const speakerName = mkText('', 14, PAL.brown);
  speakerName.anchor.set(0, 0.5);
  speakerName.position.set(136, 424);
  ov.addChild(speakerName);
  const dtxt = mkText('', 14, PAL.brown, 0, W - 210);
  dtxt.anchor.set(0.5, 0.5);
  dtxt.position.set((W + 60) / 2, 474);
  ov.addChild(dtxt);
  const nextHint = mkText(t('storySkip'), 12, PAL.brown);
  nextHint.anchor.set(1, 1);
  nextHint.position.set(W - 60, 512);
  ov.addChild(nextHint);
  const lines = FLOOR_DIALOG[idx];
  let li = 0;
  const renderLine = () => {
    const cur = lines[li];
    const whoKey = 'name' + cur.who[0].toUpperCase() + cur.who.slice(1);
    speakerName.text = t(whoKey);
    const colIdx = ['orange', 'blue', 'green', 'yellow', 'pink'].indexOf(cur.who);
    speakerName.style.fill = colIdx >= 0 ? ORB_COLORS[colIdx] : PAL.brown;
    // 说话人立绘：我方切头像，敌人/Boss 切对应立绘
    if (colIdx >= 0) {
      portSpr.texture = TEX[charTextureKey(colIdx)];
      portSpr.anchor.set(0.5, 0.36);
    } else {
      portSpr.texture = TEX[cur.who === 'boss' ? 'enemy-boss' : cfgs[0].tex];
      portSpr.anchor.set(0.5, 0.5);
    }
    dtxt.text = t(cur.text);
  };
  renderLine();
  const btn = mkPageButton(t('start'), 180, 50, () => {
    clearOverlay();
    setStandalonePage(false);
    phase = PHASE.Idle;
  }, PAL.red, true, 18);
  btn.position.set(W / 2, 558);
  btn.visible = false; // 读完对话才出现
  ov.addChild(btn);
  // 全屏点按推进对话（开始按钮出现后不再推进，避免误触）
  ov.on('pointertap', () => {
    if (btn.visible) return;
    audio.play('orb-step', 1.05, 0.5);
    if (li < lines.length - 1) {
      li++;
      renderLine();
      dtxt.scale.set(0.85);
      sched.tween(0.18, (k) => dtxt.scale.set(0.85 + 0.15 * k), EaseOutBack);
    } else {
      btn.visible = true;
      btn.scale.set(1.15);
      sched.tween(0.25, (k) => btn.scale.set(1.15 - 0.15 * k), EaseOutBack);
    }
  });
}

// 过层庆祝：压暗 + CLEAR 大横幅 + 三星 + 彩带 + 奖励行 + 全员恢复
async function playFloorClear()                {
  audio.play('jingle-victory', 1.08, 0.55);
  confetti(40);
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0x8a6d5c, alpha: 0.32 });
  overlayLayer.addChild(dim);
  for (let i = 0; i < 5; i++) {
    hp[i] = Math.min(MAX_HP, hp[i] + 200);
    floatText('+200', portraitX(i), 344, PAL.green, 18);
  }
  updatePartyHud();
  const banner = mkText(t('clear'), 62, PAL.yellow, 9);
  banner.anchor.set(0.5);
  banner.position.set(W / 2, 250);
  banner.scale.set(0.2);
  overlayLayer.addChild(banner);
  sched.tween(0.32, (k) => banner.scale.set(0.2 + 0.95 * k), EaseOutBack);
  sched.tween(0.55, () => {}, EaseOutQuad, () => {
    sched.tween(0.2, (k) => banner.scale.set(1.15 - 0.15 * k), EaseOutQuad);
  });
  for (let i = 0; i < 3; i++) {
    const st = new Sprite(TEX['icon-star']);
    st.tint = PAL.yellow;
    st.anchor.set(0.5);
    st.width = 56;
    st.height = 56;
    st.position.set(W / 2 - 76 + i * 76, 345);
    st.scale.set(0);
    overlayLayer.addChild(st);
    sched.tween(0.45 + i * 0.15, () => {}, EaseOutQuad, () => {
      sched.tween(0.28, (k) => st.scale.set(k), EaseOutBack);
    });
    sched.tween(1.5, (k) => (st.alpha = 1 - Math.max(0, (k - 0.75) / 0.25)), EaseOutQuad, () => st.destroy());
  }
  // 奖励行
  const reward = mkText(t('clearReward'), 24, PAL.heart, 5);
  reward.anchor.set(0.5);
  reward.position.set(W / 2, 420);
  reward.alpha = 0;
  overlayLayer.addChild(reward);
  sched.tween(0.55, () => {}, EaseOutQuad, () => {
    sched.tween(0.25, (k) => (reward.alpha = k), EaseOutQuad);
  });
  await sched.delay(1.5);
  sched.tween(0.25, (k) => {
    banner.alpha = 1 - k;
    reward.alpha = 1 - k;
    dim.alpha = 0.32 * (1 - k);
  }, EaseOutQuad, () => {
    banner.destroy();
    reward.destroy();
    dim.destroy();
  });
  await sched.delay(0.25);
}

async function nextFloor()                {
  phase = PHASE.Busy;
  audio.play('floor-bell', 1, 0.35);
  setStandalonePage(false);
  spawnFloor(floorIndex + 1);
  board.clearSeals();
  statusText.text = t('statusDef');
  phase = PHASE.Idle;
}

async function victory()                {
  phase = PHASE.Over;
  await playRainbowCutin(false);
  audio.play('jingle-victory');
  confetti(40);
  const time = Math.round(timeSec);
  const rank = time <= 600 && totalHp() >= MAX_HP * 2.5 ? 'S' : totalHp() >= MAX_HP ? 'A' : 'B';
  // 本地最佳
  let best                                        = null;
  try {
    best = JSON.parse(localStorage.getItem('tz_best') || 'null')                                         ;
  } catch {
    best = null;
  }
  const order = (r        ) => (r === 'S' ? 3 : r === 'A' ? 2 : 1);
  const isBest = !best || order(rank) > order(best.rank) || (order(rank) === order(best.rank) && time < best.time);
  if (isBest) localStorage.setItem('tz_best', JSON.stringify({ rank, time }));
  const leaderboardResult = recordLeaderboard(true, rank, time);
  showResult(rank, time, isBest, best, leaderboardResult);
}

function gameOver()       {
  phase = PHASE.Over;
  audio.play('jingle-fail');
  // 头像跌坐
  portraits.forEach((p, i) => {
    sched.tween(0.4, (k) => {
      p.rotation = (i % 2 ? 1 : -1) * 0.25 * k;
      p.alpha = 1 - 0.4 * k;
    }, EaseOutBack);
  });
  const leaderboardResult = recordLeaderboard(false, '-', Math.round(timeSec));
  showFail(leaderboardResult);
}

// ---------- HUD 小件 ----------
function updatePartyHud()       {
  for (let i = 0; i < 5; i++) {
    // HUD 根容器必须始终保持统一尺寸。所有战斗反馈都在内部素材或特效层播放。
    portraits[i].scale.set(1);
    const bar = hpBars[i];
    const value = Math.max(0, Math.min(MAX_HP, hp[i]));
    const frac = value / MAX_HP;
    const fillWidth = 54 * frac;
    bar.clear();
    bar.roundRect(0, 0, 58, 16, 8)
      .fill({ color: MENU_PAL.wine, alpha: 0.94 })
      .stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.72 });
    bar.roundRect(2, 2, 54, 12, 6).fill({ color: 0x4b3042, alpha: 0.62 });
    if (fillWidth > 0.5) {
      const fillRadius = Math.min(5, fillWidth / 2);
      bar.roundRect(2, 2, fillWidth, 12, fillRadius).fill({ color: ORB_COLORS[i], alpha: 0.98 });
      if (fillWidth > 7) {
        bar.roundRect(4, 3, Math.max(1, fillWidth - 4), 3, 1.5).fill({ color: 0xffffff, alpha: 0.24 });
      }
    }
    hpNums[i].text = `${value}`;
    const stage = evolutionStage(i);
    stageLabels[i].text = ['I', 'II', 'III'][stage];
    const tex = TEX[charTextureKey(i, stage)];
    if (portraitFaces[i].texture !== tex) portraitFaces[i].texture = tex;
    if (badgeFaces[i] && badgeFaces[i].texture !== tex) badgeFaces[i].texture = tex;
  }
  updateGrowthHud();
}

function updateGrowthHud()       {
  if (!growthHudBg || !growthHudText) return;
  const ready = canAnyHeroEvolve();
  growthHudBg.clear();
  growthHudBg.roundRect(-39, -15, 78, 30, 15).fill({ color: ready ? 0xc3944f : PAL.brown, alpha: 0.94 }).stroke({ width: 2, color: ready ? PAL.yellow : PAL.cream, alpha: 0.9 });
  growthHudText.text = `EXP ✦ ${evolutionExp}`;
  if (evolutionTabButton?.labelText) evolutionTabButton.labelText.text = ready ? t('evolutionReady') : t('evolutionShort');
  if (evolutionReadyFx) evolutionReadyFx.visible = ready;
}

function showEvolutionReadyNotice()       {
  if (!evolutionReadyNoticePending || localStorage.getItem(EVOLUTION_NOTICE_KEY) === '1') return;
  evolutionReadyNoticePending = false;
  localStorage.setItem(EVOLUTION_NOTICE_KEY, '1');
  paused = true;
  audio.play('floor-bell', 1.16, 0.48);
  clearOverlay();
  const ov = new Container();
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: MENU_PAL.wine, alpha: 0.34 });
  ov.addChild(dim);
  const panel = makePagePanel(W / 2, 406, 350, 286, PAL.yellow, 28);
  ov.addChild(panel);

  const crest = new Graphics();
  crest.circle(W / 2, 294, 34).fill(MENU_PAL.wine).stroke({ width: 3, color: MENU_PAL.gold, alpha: 0.96 });
  crest.circle(W / 2, 294, 27).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.42 });
  drawMenuDiamond(crest, W / 2, 294, 10, PAL.yellow, 0.96);
  const title = mkText(t('evolutionReadyNoticeTitle'), 24, MENU_PAL.wine);
  title.anchor.set(0.5);
  title.position.set(W / 2, 348);
  const body = mkText(t('evolutionReadyNoticeBody'), 13.5, MENU_PAL.ink, 0, 290);
  body.style.lineHeight = 22;
  body.anchor.set(0.5);
  body.position.set(W / 2, 405);
  const expChip = new Graphics().roundRect(W / 2 - 72, 441, 144, 32, 16).fill(MENU_PAL.wine).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.86 });
  const expText = mkBrandText(`${t('evolutionExp')}  ✦ ${evolutionExp}`, 12, MENU_PAL.goldLight);
  expText.anchor.set(0.5);
  expText.position.set(W / 2, 457);

  const resumeBattle = () => {
    clearOverlay();
    paused = false;
    phase = PHASE.Idle;
  };
  const later = mkPageButton(t('evolutionLater'), 142, 48, resumeBattle, PAL.purple, false, 14);
  later.position.set(126, 512);
  const go = mkPageButton(t('evolutionGo'), 142, 48, () => {
    clearOverlay();
    paused = false;
    showEvolutionTab('battle');
  }, PAL.yellow, true, 14);
  go.position.set(294, 512);
  ov.addChild(crest, title, body, expChip, expText, later, go);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function stageLabel(stage        )         {
  return t(['stageSmall', 'stageMedium', 'stageLarge'][stage]);
}

async function playEvolutionCutin(i        , stage        )                {
  audio.play('floor-bell', 1 + stage * 0.08, 0.55);
  const root = new Container();
  const dim = new Graphics().rect(0, 0, W, H).fill({ color: 0xfffaf2, alpha: 1 });
  const card = new Container();
  card.position.set(W / 2, 330);
  const panel = new Graphics().roundRect(-185, -175, 370, 350, 26).fill(PAL.cream).stroke({ width: 6, color: ORB_COLORS[i] });
  const innerGlow = new Graphics().circle(0, 4, 98).fill({ color: ORB_COLORS[i], alpha: 0.13 });
  const beam = new Graphics().roundRect(-34, -86, 68, 190, 32).fill({ color: ORB_COLORS[i], alpha: 0.16 });
  const haloBack = new Graphics().circle(0, 4, 72).stroke({ width: 8, color: ORB_COLORS[i], alpha: 0.46 });
  const haloFront = new Graphics().circle(0, 4, 52).stroke({ width: 3, color: PAL.yellow, alpha: 0.82 });
  const title = mkText(t('evolveTitle'), 34, ORB_COLORS[i], 5);
  title.anchor.set(0.5);
  title.position.set(0, -142);
  const name = mkText(t(CHAR_NAME_KEYS[i]), 18, PAL.brown);
  name.anchor.set(0.5);
  name.position.set(0, -108);

  const beforeTex = TEX[charTextureKey(i, stage - 1)];
  const afterTex = TEX[charTextureKey(i, stage)];
  const before = new Sprite(beforeTex);
  before.anchor.set(0.5);
  before.height = 122;
  before.width = before.height * (beforeTex.width / beforeTex.height);
  before.position.set(0, 4);
  const beforeScaleX = before.scale.x;
  const beforeScaleY = before.scale.y;
  const after = new Sprite(afterTex);
  after.anchor.set(0.5);
  after.height = 154;
  after.width = after.height * (afterTex.width / afterTex.height);
  after.position.set(0, -2);
  const afterScaleX = after.scale.x;
  const afterScaleY = after.scale.y;
  after.visible = false;
  after.alpha = 0;

  const toLabel = mkText(`${stageLabel(stage - 1)}  \u2192  ${stageLabel(stage)}`, 16, ORB_COLORS[i], 2);
  toLabel.anchor.set(0.5);
  toLabel.position.set(0, 112);
  toLabel.alpha = 0;
  const power = mkText(`${t('evolvePower')} \u00d7${EVOLUTION_POWER[stage].toFixed(1)}`, 16, PAL.brown);
  power.anchor.set(0.5);
  power.position.set(0, 142);
  power.alpha = 0;

  const sparks                  = [];
  for (let n = 0; n < 14; n++) {
    const spark = new Graphics();
    if (n % 3 === 0) {
      spark.moveTo(0, -5).lineTo(1.7, -1.7).lineTo(5, 0).lineTo(1.7, 1.7).lineTo(0, 5).lineTo(-1.7, 1.7).lineTo(-5, 0).lineTo(-1.7, -1.7).closePath().fill({ color: PAL.yellow, alpha: 0.95 });
    } else {
      spark.circle(0, 0, 2.5 + (n % 2)).fill({ color: n % 2 ? PAL.cream : ORB_COLORS[i], alpha: 0.95 });
    }
    spark.alpha = 0;
    sparks.push(spark);
  }
  const flash = new Graphics().circle(0, 4, 34).fill({ color: 0xffffff, alpha: 0 });
  card.addChild(panel, innerGlow, beam, haloBack, haloFront, ...sparks, before, after, title, name, toLabel, power, flash);
  root.addChild(dim, card);
  fxLayer.addChild(root);
  card.scale.set(0.68);
  card.alpha = 0;
  await new Promise((resolve) => sched.tween(0.32, (k) => {
    card.scale.set(0.68 + 0.32 * k);
    card.alpha = k;
  }, EaseOutBack, () => resolve()));

  audio.play('skill-cast', 1.04 + stage * 0.09, 0.7);
  await new Promise((resolve) => sched.tween(0.72, (k) => {
    const pulse = 1 + 0.055 * Math.sin(k * Math.PI * 8) * k;
    before.scale.set(beforeScaleX * pulse, beforeScaleY * pulse);
    beam.alpha = 0.12 + 0.42 * k;
    innerGlow.scale.set(1 + 0.34 * k);
    haloBack.scale.set(0.8 + 0.45 * k);
    haloBack.rotation = k * 2.2;
    haloFront.scale.set(1.25 - 0.35 * k);
    haloFront.rotation = -k * 3.1;
    for (let n = 0; n < sparks.length; n++) {
      const spark = sparks[n];
      const a = (Math.PI * 2 * n) / sparks.length + k * (2.6 + (n % 2) * 0.8);
      const radius = 94 - 34 * k + (n % 3) * 5;
      spark.position.set(Math.cos(a) * radius, 4 + Math.sin(a) * radius * 0.72);
      spark.alpha = Math.min(1, k * 2.3);
      spark.scale.set(0.7 + 0.55 * k);
      spark.rotation = a + k * 3;
    }
  }, EaseInQuad, () => resolve()));

  await new Promise((resolve) => sched.tween(0.16, (k) => {
    before.scale.set(beforeScaleX * (1 - 0.72 * k), beforeScaleY * (1 + 0.18 * k));
    before.alpha = 1 - 0.75 * k;
    haloBack.scale.set(1.25 - 0.62 * k);
    haloFront.scale.set(0.9 - 0.45 * k);
  }, EaseInQuad, () => resolve()));

  before.visible = false;
  after.visible = true;
  after.scale.set(afterScaleX * 1.58, afterScaleY * 1.58);
  flash.alpha = 0.96;
  flash.scale.set(0.65);
  shake(3.8 + stage * 1.2, 0.2);
  audio.play('floor-bell', 1.3 + stage * 0.12, 0.75);
  spawnBurst(W / 2, 334, ORB_COLORS[i], 32);
  for (let n = 0; n < 16; n++) {
    const a = (Math.PI * 2 * n) / 16;
    const ray = new Graphics().roundRect(-2, -6, 4, 38 + (n % 3) * 8, 2).fill({ color: n % 2 ? PAL.yellow : PAL.cream, alpha: 0.92 });
    ray.position.set(0, 4);
    ray.rotation = a;
    card.addChild(ray);
    sched.tween(0.42, (k) => {
      const d = 44 + (n % 3) * 8;
      ray.position.set(Math.cos(a - Math.PI / 2) * d * k, 4 + Math.sin(a - Math.PI / 2) * d * k);
      ray.scale.y = 1 - 0.72 * k;
      ray.alpha = 0.92 * (1 - k);
    }, EaseOutQuad, () => ray.destroy());
  }
  sched.tween(0.28, (k) => {
    flash.scale.set(0.65 + 3.2 * k);
    flash.alpha = 0.96 * (1 - k);
  }, EaseOutQuad);

  await new Promise((resolve) => sched.tween(0.46, (k) => {
    after.scale.set(afterScaleX * (1.58 - 0.58 * k), afterScaleY * (1.58 - 0.58 * k));
    after.alpha = Math.min(1, k * 2.5);
    toLabel.alpha = Math.max(0, (k - 0.25) / 0.75);
    power.alpha = Math.max(0, (k - 0.45) / 0.55);
    innerGlow.scale.set(1.34 + 0.18 * Math.sin(k * Math.PI));
    haloBack.scale.set(0.7 + 0.5 * k);
    haloFront.scale.set(0.55 + 0.55 * k);
  }, EaseOutBack, () => {
    after.scale.set(afterScaleX, afterScaleY);
    resolve();
  }));
  await sched.delay(0.82);
  await new Promise((resolve) => sched.tween(0.25, (k) => {
    root.alpha = 1 - k;
    card.y = 330 - 16 * k;
  }, EaseOutQuad, () => resolve()));
  root.destroy({ children: true });
}

async function buyEvolution(i        , origin        )                {
  const stage = evolutionStage(i);
  const nextStage = stage + 1;
  const cost = nextEvolutionCost(i);
  if (nextStage > 2 || cost <= 0 || evolutionExp < cost) return;
  evolutionExp -= cost;
  partyStages[i] = nextStage;
  saveGrowthState();
  updatePartyHud();
  clearOverlay();
  phase = PHASE.Busy;
  await playEvolutionCutin(i, nextStage);
  showEvolutionTab(origin);
}

function closeEvolutionTab(origin        )       {
  evolutionTabOpen = false;
  clearOverlay();
  if (origin === 'battle') {
    setStandalonePage(false);
    phase = PHASE.Idle;
  }
  else if (origin === 'page' && evolutionReturnAction) {
    const returnAction = evolutionReturnAction;
    evolutionReturnAction = null;
    returnAction();
  }
  else showTitle();
}

function showEvolutionFromPage(returnAction                  )       {
  evolutionReturnAction = returnAction;
  showEvolutionTab('page');
}

function showEvolutionTab(origin = 'title')       {
  evolutionTabOpen = true;
  evolutionTabOrigin = origin;
  if (origin !== 'page') evolutionReturnAction = null;
  setStandalonePage(true);
  clearOverlay();
  hideBubble();
  phase = origin === 'title' ? PHASE.Title : PHASE.Busy;
  evolutionSelectedHero = Math.max(0, Math.min(4, evolutionSelectedHero));
  const ov = new Container();
  ov.addChild(makePageBase(PAL.yellow, PAL.purple));
  ov.addChild(makePagePanel(W / 2, 434, 392, 590, PAL.yellow, 28));
  addPageHeader(ov, t('evolutionTab'), t('evolutionHint'), PAL.yellow, () => closeEvolutionTab(origin));

  const bankBg = new Graphics();
  bankBg.roundRect(76, 143 + UI_ELEVATION.card.offset, 268, 38, 19).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
  bankBg.roundRect(76, 143, 268, 38, 19).fill(MENU_PAL.wine).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.84 });
  bankBg.roundRect(81, 148, 258, 28, 14).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.2 });
  drawMenuDiamond(bankBg, 96, 162, 3, MENU_PAL.goldLight, 0.7);
  const bankLabel = mkText(t('evolutionExp'), 12, MENU_PAL.cream);
  bankLabel.anchor.set(0, 0.5);
  bankLabel.position.set(110, 162);
  bankLabel.alpha = 0.8;
  const bankDivider = new Graphics().roundRect(258, 153, 1, 18, 1).fill({ color: MENU_PAL.goldLight, alpha: 0.28 });
  const bankValue = mkBrandText(`✦ ${evolutionExp}`, 16, MENU_PAL.goldLight);
  bankValue.anchor.set(1, 0.5);
  bankValue.position.set(325, 162);
  ov.addChild(bankBg, bankLabel, bankDivider, bankValue);

  // Compact roster selector: every hero remains visible, while the selected
  // route receives the full width below instead of being squeezed into a grid.
  for (let i = 0; i < 5; i++) {
    const selected = i === evolutionSelectedHero;
    const stage = evolutionStage(i);
    const selector = new Container();
    selector.position.set(70 + i * 70, 224);
    const selectorShell = new Graphics();
    if (selected) selectorShell.roundRect(-29, -31 + UI_ELEVATION.card.offset, 58, 62, 16).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
    selectorShell.roundRect(-29, -31, 58, 62, 16)
      .fill(selected ? 0xfff4df : 0xfffdf8)
      .stroke({ width: selected ? 2.2 : 1.2, color: selected ? MENU_PAL.gold : MENU_PAL.line, alpha: selected ? 0.95 : 0.35 });
    selectorShell.roundRect(-24, -26, 48, 51, 12).fill({ color: ORB_COLORS[i], alpha: selected ? 0.12 : 0.045 });
    if (selected) selectorShell.roundRect(-18, 24, 36, 3, 2).fill({ color: ORB_COLORS[i], alpha: 0.8 });
    const tex = TEX[charTextureKey(i, stage)];
    const portrait = new Sprite(tex);
    portrait.anchor.set(0.5);
    portrait.height = 46;
    portrait.width = portrait.height * (tex.width / tex.height);
    if (portrait.width > 50) portrait.scale.set(portrait.scale.x * (50 / portrait.width), portrait.scale.y * (50 / portrait.width));
    portrait.position.set(0, -2);
    const chip = new Graphics().circle(20, -22, 8).fill(ORB_COLORS[i]).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    const chipText = mkBrandText(['I', 'II', 'III'][stage], 7.2, MENU_PAL.wine);
    chipText.anchor.set(0.5);
    chipText.position.set(20, -22);
    selector.addChild(selectorShell, portrait, chip, chipText);
    selector.eventMode = 'static';
    selector.cursor = selected ? 'default' : 'pointer';
    selector.on('pointerdown', () => { if (!selected) selector.scale.set(0.96); });
    selector.on('pointerupoutside', () => selector.scale.set(1));
    selector.on('pointertap', () => {
      selector.scale.set(1);
      if (selected) return;
      audio.unlock();
      audio.play('orb-step', 1.08);
      evolutionSelectedHero = i;
      showEvolutionTab(origin);
    });
    ov.addChild(selector);
  }

  const i = evolutionSelectedHero;
  const stage = evolutionStage(i);
  const nextStage = Math.min(2, stage + 1);
  const accent = ORB_COLORS[i];
  const detail = new Container();
  detail.position.set(W / 2, 448);
  const detailShell = new Graphics();
  detailShell.roundRect(-174, -170 + UI_ELEVATION.card.offset, 348, 340, 24).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
  detailShell.roundRect(-174, -170, 348, 340, 24).fill(0xfffdf8).stroke({ width: 1.6, color: MENU_PAL.gold, alpha: 0.58 });
  detailShell.roundRect(-167, -163, 334, 326, 19).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.2 });
  detailShell.roundRect(-160, -156, 320, 42, 14).fill({ color: accent, alpha: 0.09 });
  detailShell.ellipse(0, -37, 270, 146).fill({ color: accent, alpha: 0.045 });
  detailShell.roundRect(-145, 89, 290, 1.5, 1).fill({ color: MENU_PAL.line, alpha: 0.18 });
  detail.addChild(detailShell);

  const heroName = mkText(t(CHAR_NAME_KEYS[i]), 20, MENU_PAL.wine);
  heroName.anchor.set(0.5);
  heroName.position.set(0, -136);
  if (heroName.width > 190) heroName.scale.set(190 / heroName.width);
  const stagePlate = new Graphics().roundRect(119, -153, 33, 24, 12).fill({ color: accent, alpha: 0.18 });
  const stageNumber = mkBrandText(['I', 'II', 'III'][stage], 10, MENU_PAL.wine);
  stageNumber.anchor.set(0.5);
  stageNumber.position.set(135.5, -141);
  detail.addChild(heroName, stagePlate, stageNumber);

  const addFormSprite = (texture        , x        , y        , height        , maxWidth        )         => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.height = height;
    sprite.width = height * (texture.width / texture.height);
    if (sprite.width > maxWidth) sprite.scale.set(sprite.scale.x * (maxWidth / sprite.width), sprite.scale.y * (maxWidth / sprite.width));
    sprite.position.set(x, y);
    detail.addChild(sprite);
    return sprite;
  };

  if (stage < 2) {
    const currentTag = mkText(stageLabel(stage), 10, MENU_PAL.cocoa);
    currentTag.anchor.set(0.5);
    currentTag.position.set(-89, -104);
    const nextTag = mkText(stageLabel(nextStage), 10, accent);
    nextTag.anchor.set(0.5);
    nextTag.position.set(89, -104);
    detail.addChild(currentTag, nextTag);
    addFormSprite(TEX[charTextureKey(i, stage)], -88, -31, 126, 132);
    addFormSprite(TEX[charTextureKey(i, nextStage)], 88, -31, 126, 132);
    const arrowPlate = new Graphics().circle(0, -31, 21).fill({ color: MENU_PAL.paper, alpha: 0.96 }).stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.5 });
    const arrow = mkBrandText('→', 19, MENU_PAL.cocoa);
    arrow.anchor.set(0.5);
    arrow.position.set(0, -31);
    detail.addChild(arrowPlate, arrow);
  } else {
    const finalTag = mkText(stageLabel(stage), 10.5, accent);
    finalTag.anchor.set(0.5);
    finalTag.position.set(0, -104);
    detail.addChild(finalTag);
    addFormSprite(TEX[charTextureKey(i, stage)], 0, -27, 150, 180);
  }

  const formRoute = mkText(stage < 2 ? `${stageLabel(stage)}  →  ${stageLabel(nextStage)}` : t('evolutionMax'), 13, accent);
  formRoute.anchor.set(0.5);
  formRoute.position.set(0, 65);
  const power = mkText(`${t('evolutionPowerShort')}  ×${EVOLUTION_POWER[stage].toFixed(1)}${stage < 2 ? `  →  ×${EVOLUTION_POWER[nextStage].toFixed(1)}` : ''}`, 11.5, MENU_PAL.cocoa);
  power.anchor.set(0.5);
  power.position.set(0, 84);
  detail.addChild(formRoute, power);

  if (stage < 2) {
    const cost = nextEvolutionCost(i);
    const affordable = evolutionExp >= cost;
    const progress = Math.max(0, Math.min(1, evolutionExp / cost));
    const progressText = mkBrandText(`${evolutionExp} / ${cost} EXP`, 10.5, MENU_PAL.cocoa);
    progressText.anchor.set(0.5);
    progressText.position.set(0, 105);
    const track = new Graphics();
    track.roundRect(-136, 116, 272, 8, 4).fill({ color: MENU_PAL.line, alpha: 0.2 });
    track.roundRect(-136, 116, Math.max(8, 272 * progress), 8, 4).fill({ color: accent, alpha: 0.72 });
    const label = affordable ? `${t('evolutionBuy')}  ✦ ${cost}` : t('evolutionNeed').replace('{x}', `${cost - evolutionExp}`);
    const buy = mkPageButton(label, 260, 42, () => {
      if (affordable) void buyEvolution(i, origin);
    }, affordable ? accent : 0xb5a29a, affordable, 14);
    buy.position.set(0, 145);
    if (!affordable) buy.cursor = 'default';
    detail.addChild(progressText, track, buy);
  } else {
    const maxPlate = new Graphics().roundRect(-130, 112, 260, 44, 16).fill(MENU_PAL.wine).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.8 });
    const max = mkText(t('evolutionMax'), 14, MENU_PAL.goldLight);
    max.anchor.set(0.5);
    max.position.set(0, 134);
    detail.addChild(maxPlate, max);
  }
  ov.addChild(detail);

  const pageDots = new Graphics();
  for (let n = 0; n < 5; n++) {
    pageDots.circle(W / 2 - 36 + n * 18, 650, n === i ? 4.5 : 3).fill({ color: n === i ? ORB_COLORS[n] : MENU_PAL.line, alpha: n === i ? 0.9 : 0.28 });
  }
  const footer = mkBrandText(`${i + 1} / 5  ·  3 FORMS`, 9.5, MENU_PAL.wine);
  footer.anchor.set(0.5);
  footer.position.set(W / 2, 680);
  footer.alpha = 0.42;
  ov.addChild(pageDots, footer);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function showCombo(combo        , type        )       {
  comboText.visible = true;
  comboText.text = `${combo} Combo!`;
  comboText.style.fill = ORB_COLORS[type] ?? PAL.cream;
  comboText.scale.set(1.4);
  sched.tween(0.2, (k) => comboText.scale.set(1.4 - 0.4 * k), EaseOutBack);
  comboText.alpha = 1;
  sched.tween(1.0, (k) => (comboText.alpha = 1 - Math.max(0, (k - 0.6) / 0.4)), EaseOutQuad, () => (comboText.visible = false));
  // 高连击屏边闪光
  if (combo >= 4) {
    const edge = new Graphics().roundRect(4, 4, W - 8, H - 8, 18).stroke({ width: 6, color: ORB_COLORS[type] ?? PAL.cream, alpha: 0.8 });
    fxLayer.addChild(edge);
    sched.tween(0.35, (k) => (edge.alpha = 0.8 * (1 - k)), EaseOutQuad, () => edge.destroy());
  }
  // 5+ 连击屏幕脉冲
  if (combo >= 5) {
    const s0 = gameRoot.scale.x;
    sched.tween(0.2, (k) => gameRoot.scale.set(s0 * (1 + 0.02 * Math.sin(k * Math.PI))));
  }
}


// 过层/胜利彩带
function confetti(n        )       {
  const cols = [PAL.red, PAL.blue, PAL.green, PAL.yellow, PAL.heart, PAL.purple];
  for (let i = 0; i < n; i++) {
    const p = new Graphics().rect(-3, -2, 6, 4).fill(cols[i % cols.length]);
    const x = 30 + Math.random() * (W - 60);
    p.position.set(x, -10);
    p.rotation = Math.random() * 3;
    fxLayer.addChild(p);
    const dur = 0.9 + Math.random() * 0.7;
    const dx = (Math.random() - 0.5) * 80;
    const spin = 0.3 + Math.random() * 0.6;
    sched.tween(i * 0.02, () => {}, EaseOutQuad, () => {
      sched.tween(dur, (k) => {
        p.position.set(x + dx * k + Math.sin(k * 7 + i) * 10, -10 + H * 0.55 * k * k);
        p.rotation += spin;
        p.alpha = 1 - Math.max(0, (k - 0.75) / 0.25);
      }, EaseInQuad, () => p.destroy());
    });
  }
}

// 釉面高光闪点
function spawnGlint()       {
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return;
  const e = alive[(Math.random() * alive.length) | 0];
  const g = new Graphics();
  g.moveTo(0, -6).lineTo(1.8, -1.8).lineTo(6, 0).lineTo(1.8, 1.8).lineTo(0, 6).lineTo(-1.8, 1.8).lineTo(-6, 0).lineTo(-1.8, -1.8).closePath().fill({ color: 0xffffff, alpha: 0.9 });
  g.position.set(e.root.x + (Math.random() - 0.5) * e.sprite.width * 0.5, e.baseY - e.cfg.h * (0.35 + Math.random() * 0.35) + 48);
  fxLayer.addChild(g);
  sched.tween(0.55, (k) => {
    g.scale.set(Math.max(0.01, Math.sin(k * Math.PI)));
    g.alpha = 0.9 - 0.4 * k;
  }, EaseOutQuad, () => g.destroy());
}

// Boss 焦糖火星
function spawnEmber(e       )       {
  const p = new Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: 0xd98a4a, alpha: 0.8 });
  const x = e.root.x + (Math.random() - 0.5) * e.sprite.width * 0.7;
  const y = e.baseY - e.cfg.h * 0.3 + 48;
  p.position.set(x, y);
  fxLayer.addChild(p);
  sched.tween(0.8, (k) => {
    p.position.set(x + Math.sin(k * 6) * 6, y - 46 * k);
    p.alpha = 0.8 * (1 - k);
  }, EaseOutQuad, () => p.destroy());
}

// 环境飘浮光点（一直存在，绘本空气感）
function spawnAmbient()       {
  const x = 20 + Math.random() * (W - 40);
  const y = 70 + Math.random() * 210;
  const c = [PAL.cream, PAL.heart, PAL.blue, PAL.yellow][(Math.random() * 4) | 0];
  const p = new Graphics().circle(0, 0, 1.5 + Math.random() * 2.5).fill({ color: c, alpha: 0.7 });
  p.position.set(x, y);
  fxLayer.addChild(p);
  const dx = (Math.random() - 0.5) * 24;
  sched.tween(2.4, (k) => {
    p.position.set(x + dx * k, y - 34 * k);
    p.alpha = 0.7 * (1 - k);
  }, EaseOutQuad, () => p.destroy());
}

// 下半区专属上升粒子：尺寸与密度都克制，保持棋盘辨识度。
function spawnLowerAmbient()       {
  if (!lowerFxLayer || lowerFxLayer.children.length > lowerBokeh.length + 18) return;
  const x = 18 + Math.random() * (W - 36);
  const y = 470 + Math.random() * 315;
  const color = [PAL.cream, PAL.heart, PAL.blue, PAL.yellow, PAL.purple][(Math.random() * 5) | 0];
  const p = new Graphics();
  if (Math.random() < 0.28) {
    p.moveTo(0, -4).lineTo(1.2, -1.2).lineTo(4, 0).lineTo(1.2, 1.2).lineTo(0, 4).lineTo(-1.2, 1.2).lineTo(-4, 0).lineTo(-1.2, -1.2).closePath().fill({ color, alpha: 0.68 });
  } else {
    const radius = 1.4 + Math.random() * 2.2;
    p.circle(0, 0, radius).fill({ color, alpha: 0.55 });
    p.circle(0, 0, radius + 2.5).stroke({ width: 1, color, alpha: 0.18 });
  }
  p.position.set(x, y);
  lowerFxLayer.addChild(p);
  const dx = (Math.random() - 0.5) * 30;
  const drift = 42 + Math.random() * 42;
  const duration = 2.3 + Math.random() * 1.1;
  sched.tween(duration, (k) => {
    p.position.set(x + dx * k + Math.sin(k * 5.5) * 3, y - drift * k);
    p.alpha = Math.sin(k * Math.PI) * 0.72;
    p.rotation = k * 0.8;
  }, EaseOutQuad, () => p.destroy());
}

function floatText(text        , x        , y        , color        , size        )       {
  const t = mkText(text, size, color, 6);
  t.anchor.set(0.5);
  t.position.set(x, y);
  fxLayer.addChild(t);
  sched.tween(0.95, (k) => {
    t.y = y - 62 * k;
    t.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    const ek = Math.min(1, k / 0.16);
    const back = 1 + 3.2 * Math.pow(ek - 1, 3) + 2.2 * Math.pow(ek - 1, 2);
    t.scale.set(Math.max(0.05, back * 1.15));
  }, EaseOutQuad, () => t.destroy());
}

// 消除表扬字（糖果传奇式，按连击/组大分级）
function playMatchImpact(groups                                                       , combo        )       {
  if (!groups.length) return;
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const group of groups) {
    for (const cell of group.cells) {
      const p = board.cellCenter(cell.r, cell.c);
      sx += p.x;
      sy += p.y;
      count++;
    }
  }
  if (!count) return;
  const x = (W - BOARD_W) / 2 + sx / count;
  const y = BOARD_Y + sy / count;
  const color = ORB_COLORS[groups[0].type] ?? PAL.cream;
  const power = Math.min(5, 1 + combo * 0.65 + groups.length * 0.25);

  const flash = new Graphics().circle(0, 0, 18 + power * 2).fill({ color: PAL.cream, alpha: 0.78 });
  flash.position.set(x, y);
  fxLayer.addChild(flash);
  sched.tween(0.2, (k) => {
    flash.scale.set(0.65 + k * (1.25 + power * 0.12));
    flash.alpha = 0.78 * (1 - k);
  }, EaseOutQuad, () => flash.destroy());

  for (let n = 0; n < 2; n++) {
    const ring = new Graphics().circle(0, 0, 12 + n * 8).stroke({ width: 3.5 - n, color: n ? PAL.cream : color, alpha: 0.88 });
    ring.position.set(x, y);
    fxLayer.addChild(ring);
    sched.tween(0.28 + n * 0.07, (k) => {
      ring.scale.set(0.7 + k * (2.2 + power * 0.28));
      ring.alpha = 0.88 * (1 - k);
    }, EaseOutQuad, () => ring.destroy());
  }

  const rayCount = 6 + Math.min(4, combo) * 2;
  for (let n = 0; n < rayCount; n++) {
    const a = (Math.PI * 2 * n) / rayCount + Math.random() * 0.18;
    const ray = new Graphics().roundRect(-1.5, -10, 3, 20 + power * 3, 2).fill({ color: n % 2 ? PAL.cream : color, alpha: 0.9 });
    ray.position.set(x, y);
    ray.rotation = a + Math.PI / 2;
    fxLayer.addChild(ray);
    const dist = 18 + power * 5 + Math.random() * 10;
    sched.tween(0.26, (k) => {
      ray.position.set(x + Math.cos(a) * dist * k, y + Math.sin(a) * dist * k);
      ray.scale.y = 1 - 0.7 * k;
      ray.alpha = 0.9 * (1 - k);
    }, EaseOutQuad, () => ray.destroy());
  }

  const bx = board.container.x;
  const by = board.container.y;
  sched.tween(0.14, (k) => {
    const m = (1 - k) * Math.min(3.5, 0.8 + combo * 0.55);
    board.container.position.set(bx + Math.sin(k * Math.PI * 5) * m, by + Math.cos(k * Math.PI * 4) * m * 0.45);
  }, EaseOutQuad, () => board.container.position.set(bx, by));
  if (combo >= 2) shake(Math.min(3.5, 0.8 + combo * 0.55), 0.11);
}

function showPraise(groups                                                       , combo        )       {
  let key = 'praiseNice';
  if (combo >= 4) key = 'praiseDelicious';
  else if (combo === 3) key = 'praiseTasty';
  else if (combo === 2) key = 'praiseSweet';
  else if (groups.some((g) => g.cells.length >= 5)) key = 'praiseGreat';
  const g = groups[0];
  let sx = 0;
  let sy = 0;
  for (const c of g.cells) {
    const p = board.cellCenter(c.r, c.c);
    sx += p.x;
    sy += p.y;
  }
  const bx = (W - BOARD_W) / 2 + sx / g.cells.length;
  const by = BOARD_Y + sy / g.cells.length;
  const size = key === 'praiseNice' ? 26 : key === 'praiseGreat' || key === 'praiseSweet' ? 30 : 34;
  const pt = mkText(t(key), size, ORB_COLORS[g.type] ?? PAL.cream, 7);
  pt.anchor.set(0.5);
  pt.position.set(Math.max(60, Math.min(W - 60, bx)), by - 16);
  fxLayer.addChild(pt);
  pt.scale.set(0.2);
  pt.rotation = -0.06;
  sched.tween(0.28, (k) => {
    pt.scale.set(0.2 + 0.9 * k);
    pt.rotation = -0.06 + 0.06 * k;
  }, EaseOutBack);
  sched.tween(0.95, (k) => {
    pt.y = by - 16 - 54 * k;
    pt.alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
  }, EaseOutQuad, () => pt.destroy());
}

let shakeToken = 0;
let shakeBaseX = 0;
let shakeBaseY = 0;
let shakeActive = false;

function shake(px        , dur        )       {
  if (!shakeActive) {
    shakeBaseX = gameRoot.x;
    shakeBaseY = gameRoot.y;
    shakeActive = true;
  }
  const token = ++shakeToken;
  sched.tween(dur, (k) => {
    if (token !== shakeToken) return;
    const m = (1 - k) * px;
    gameRoot.position.set(shakeBaseX + (Math.random() * 2 - 1) * m, shakeBaseY + (Math.random() * 2 - 1) * m);
  }, EaseOutQuad, () => {
    if (token !== shakeToken) return;
    gameRoot.position.set(shakeBaseX, shakeBaseY);
    shakeActive = false;
  });
}

// ---------- 开场剧情演出 ----------
function showStory()       {
  phase = PHASE.Busy;
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  overlayLayer.addChild(ov);
  activeOverlay = ov;
  blockOverlay(ov);
  ov.addChild(makePageBase(PAL.red, PAL.purple));
  // 布丁校监登场
  const boss = new Sprite(TEX['enemy-boss']);
  boss.anchor.set(0.5, 1);
  boss.height = 170;
  boss.width = (TEX['enemy-boss'].width / TEX['enemy-boss'].height) * 170;
  boss.position.set(W / 2, 330);
  const bossScale = boss.scale.y;
  boss.scale.set(0);
  ov.addChild(boss);
  sched.tween(0.4, (k) => {
    if (!boss.destroyed) boss.scale.set(bossScale * k);
  }, EaseOutBack);
  sched.tween(0.5, () => {}, EaseOutQuad, () => {
    sched.tween(0.9, (k) => {
      if (boss.destroyed) return;
      const m = Math.sin(k * Math.PI * 3);
      boss.scale.set(bossScale * (1 + 0.06 * m), bossScale * (1 - 0.05 * m));
    });
  });
  // 四只小动物从两侧入场
  const storyBadges              = [];
  for (let i = 0; i < 5; i++) {
    const b = makeBadge(i);
    b.visible = true;
    b.scale.set(0.9);
    const tx = 90 + i * 80;
    const sx = i < 2 ? -60 : W + 60;
    b.position.set(sx, 505);
    ov.addChild(b);
    storyBadges.push(b);
    sched.tween(0.6 + i * 0.15, () => {}, EaseOutQuad, () => {
      sched.tween(0.35, (k) => {
        if (!b.destroyed) b.x = sx + (tx - sx) * k;
      }, EaseOutBack);
    });
  }
  // 底部剧情文本板（点按翻页）
  const panelG = new Graphics();
  panelG.roundRect(24, 556 + UI_ELEVATION.panel.offset, W - 48, 136, 18).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.panel.alpha });
  panelG.roundRect(24, 556, W - 48, 136, 18).fill(MENU_PAL.paper).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.5 });
  panelG.roundRect(30, 562, W - 60, 124, 13).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.22 });
  const ptxt = mkText(t('story1'), 16, MENU_PAL.ink, 0, W - 100);
  ptxt.anchor.set(0.5, 0.5);
  ptxt.position.set(W / 2, 624);
  // 技能介绍页：四行角色配色
  const rosterC = new Container();
  rosterC.visible = false;
  for (let i = 0; i < 5; i++) {
    const line = mkText(t(`roster${i}`), 15, ORB_COLORS[i], 0);
    line.anchor.set(0.5, 0.5);
    line.position.set(W / 2, 576 + i * 25);
    rosterC.addChild(line);
  }
  const hint = mkText(t('storySkip'), 13, MENU_PAL.wine);
  hint.anchor.set(0.5);
  hint.position.set(W / 2, 706);
  ov.addChild(panelG, ptxt, hint, rosterC);
  let panel = 0;
  ov.on('pointertap', () => {
    audio.unlock();
    panel++;
    if (panel >= 4) {
      storyBadges.forEach((b) => b.destroy());
      localStorage.setItem('tz_story', '1');
      clearOverlay();
      setStandalonePage(false);
      if (localStorage.getItem('tz_tut')) phase = PHASE.Idle;
      else startTutorial();
      return;
    }
    if (panel === 3) {
      ptxt.visible = false;
      rosterC.visible = true;
    } else {
      ptxt.text = t(`story${panel + 1}`);
    }
    if (panel === 2 || panel === 3) {
      storyBadges.forEach((b) => {
        sched.tween(0.35, (k) => {
          if (!b.destroyed) b.y = 505 - 20 * Math.sin(k * Math.PI);
        }, EaseOutQuad);
      });
    }
  });
}

// ---------- 开场教学（三段递进） ----------
let tutActive = false;
let tutStep = 1;
let tutStepReady = false;
let tutGhost                   = null;
let tutHint                  = null;

function boardCellPos(r        , c        )                           {
  const p = board.cellCenter(r, c);
  return { x: (W - BOARD_W) / 2 + p.x, y: BOARD_Y + p.y };
}

function startTutorial()       {
  setStandalonePage(false);
  tutActive = true;
  tutStep = 1;
  tutStepReady = false;
  phase = PHASE.Busy;
  showBubble(t('tut1'), 210, 240);
  void runTutDemo();
}

// 幽灵手指演示：按住一颗珠拖着亮线四处走——想拖多远都行
async function runTutDemo()                {
  const g = new Container();
  const line = new Graphics();
  const hand = new Graphics().circle(0, 0, 13).fill({ color: 0xfff9ee, alpha: 0.85 }).stroke({ width: 3, color: PAL.brown, alpha: 0.7 });
  g.addChild(line, hand);
  fxLayer.addChild(g);
  tutGhost = g;
  sched.tween(0.6, () => {}, EaseOutQuad, () => showBubble(t('tut2'), 210, 268, true));
  const path = [
    [4, 1], [3, 1], [2, 1], [2, 2], [3, 2], [4, 2], [4, 1], [3, 1], [2, 1],
  ].map(([r, c]) => boardCellPos(r, c));
  await new Promise      ((resolve) => {
    sched.tween(3.0, (k) => {
      const f = k * (path.length - 1);
      const i = Math.min(path.length - 2, Math.floor(f));
      const m = f - i;
      const x = path[i].x + (path[i + 1].x - path[i].x) * m;
      const y = path[i].y + (path[i + 1].y - path[i].y) * m;
      hand.position.set(x, y);
      line.clear();
      line.moveTo(path[0].x, path[0].y);
      for (let j = 1; j <= i; j++) line.lineTo(path[j].x, path[j].y);
      line.lineTo(x, y);
      line.stroke({ width: 8, color: 0xffffff, alpha: 0.5, cap: 'round', join: 'round' });
    }, EaseOutQuad, () => resolve());
  });
  if (tutGhost) {
    tutGhost.destroy();
    tutGhost = null;
  }
  // 引导玩家亲手试：高亮橙珠与目标格
  tutHint = new Graphics();
  fxLayer.addChild(tutHint);
  showBubble(t('tut3'), 210, 268, true);
  phase = PHASE.Idle;
}

function tutHintTick()       {
  if (!tutHint) return;
  const pulse = 1 + 0.08 * Math.sin(glowT * 6);
  tutHint.clear();
  if (tutStep === 1) {
    const p1 = boardCellPos(4, 1);
    const p2 = boardCellPos(3, 1);
    tutHint.circle(p1.x, p1.y, 34 * pulse).stroke({ width: 4, color: PAL.yellow, alpha: 0.9 });
    tutHint.circle(p2.x, p2.y, 30 * pulse).stroke({ width: 3, color: PAL.cream, alpha: 0.7 });
    tutHint.moveTo(p1.x - 8, p1.y - 42).lineTo(p1.x, p1.y - 54).lineTo(p1.x + 8, p1.y - 42).closePath().fill({ color: PAL.yellow, alpha: 0.9 });
  } else if (tutStep === 2) {
    // 三格长拖路线指引
    const pts = [boardCellPos(4, 1), boardCellPos(3, 1), boardCellPos(2, 1)];
    tutHint.circle(pts[0].x, pts[0].y, 34 * pulse).stroke({ width: 4, color: PAL.yellow, alpha: 0.9 });
    tutHint.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) tutHint.lineTo(pts[i].x, pts[i].y);
    tutHint.stroke({ width: 6, color: PAL.yellow, alpha: 0.6, cap: 'round', join: 'round' });
    tutHint.circle(pts[2].x, pts[2].y, 30 * pulse).stroke({ width: 3, color: PAL.cream, alpha: 0.8 });
    tutHint.moveTo(pts[2].x - 8, pts[2].y - 42).lineTo(pts[2].x, pts[2].y - 54).lineTo(pts[2].x + 8, pts[2].y - 42).closePath().fill({ color: PAL.yellow, alpha: 0.9 });
  } else if (tutStep === 3) {
    // 集火指引：高亮右侧橘子团子
    const pet = enemies[1];
    if (pet && pet.alive) {
      tutHint.ellipse(pet.root.x, pet.baseY - pet.cfg.h * 0.45 + 48, pet.sprite.width * 0.7 * pulse, pet.cfg.h * 0.6 * pulse).stroke({ width: 4, color: PAL.yellow, alpha: 0.9 });
      tutHint.moveTo(pet.root.x - 8, 188).lineTo(pet.root.x, 176).lineTo(pet.root.x + 8, 188).closePath().fill({ color: PAL.yellow, alpha: 0.9 });
    }
  }
}

// 教学推进：step1 首消 → step2 三格长拖 → step3 点敌集火 → step4 充能讲解
function advanceTutorial()       {
  if (tutStep === 1) {
    tutStep = 2;
    tutStepReady = false;
    showBubble(t('tut2b'), 210, 268, true);
  } else if (tutStep === 2) {
    tutStep = 3;
    showBubble(t('tutTarget'), 210, 268, true);
  } else if (tutStep === 3) {
    tutStep = 4;
    if (tutHint) {
      tutHint.destroy();
      tutHint = null;
    }
    showBubble(t('tut3b'), 210, 268, true);
    sched.tween(2.6, () => {}, EaseOutQuad, () => finishTutorial());
  }
}

function finishTutorial()       {
  tutActive = false;
  localStorage.setItem('tz_tut', '1');
  if (tutHint) {
    tutHint.destroy();
    tutHint = null;
  }
  showBubble(t('tutDone'), 210, 268);
}

function showBubble(text        , x        , y        , sticky = false)       {
  hideBubble();
  const b = new Container();
  const bg = new Graphics();
  bg.roundRect(-170, -26, 340, 52, 14).fill(MENU_PAL.gold);
  bg.roundRect(-167, -23, 334, 46, 11).fill(MENU_PAL.paper).stroke({ width: 1, color: MENU_PAL.coral, alpha: 0.24 });
  const t = mkText(text, 15, MENU_PAL.wine);
  t.anchor.set(0.5, 0.5);
  b.addChild(bg, t);
  b.position.set(x, y);
  b.eventMode = 'static';
  b.on('pointertap', () => hideBubble());
  overlayLayer.addChild(b);
  activeBubble = b;
  bubbleTimer = sticky ? -1 : 2.5;
}

function hideBubble()       {
  if (activeBubble) {
    activeBubble.destroy();
    activeBubble = null;
  }
  bubbleTimer = 0;
}

// ---------- 界面层 ----------
function clearOverlay()       {
  if (activeOverlay) {
    activeOverlay.destroy({ children: true });
    activeOverlay = null;
  }
  menuHeroGroup = null;
  menuHeroActors = [];
  menuHeroFxLayer = null;
  menuHeroFx = [];
  menuHeroIdleReady = false;
}

function setStandalonePage(open         )       {
  standalonePageOpen = open;
  if (open) hideBubble();
}

function makePageBase(accent        , secondary = PAL.purple)            {
  const base = new Container();
  const bg = new Graphics();
  bg.rect(0, 0, W, H).fill(MENU_PAL.paper);
  // The selected direction uses one continuous sheet instead of a dark stage
  // plus a second content surface. Very faint color blooms keep it warm without
  // creating another visual layer.
  bg.ellipse(38, 76, 116, 96).fill({ color: accent, alpha: 0.022 });
  bg.ellipse(W - 24, H - 40, 148, 118).fill({ color: secondary, alpha: 0.018 });
  bg.roundRect(7, 7, W - 14, H - 14, 26).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.64 });
  bg.roundRect(12, 12, W - 24, H - 24, 22).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.42 });
  base.addChild(bg);
  return base;
}

function makePagePanel(x        , y        , w        , h        , accent = PAL.purple, radius = 22)            {
  const panel = new Container();
  panel.position.set(x, y);
  const shadow = new Graphics().roundRect(-w / 2, -h / 2 + UI_ELEVATION.panel.offset, w, h, radius).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.panel.alpha });
  const body = new Graphics();
  body.roundRect(-w / 2, -h / 2, w, h, radius).fill(0xfffdf8).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.46 });
  body.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, Math.max(10, radius - 5)).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.22 });
  body.roundRect(-w / 2 + 12, -h / 2 + 10, w - 24, 14, 7).fill({ color: 0xffffff, alpha: 0.2 });
  panel.addChild(shadow, body);
  return panel;
}

function pageJewelColor(color        )         {
  if (color === PAL.red) return MENU_PAL.coral;
  if (color === PAL.blue) return MENU_PAL.teal;
  if (color === PAL.green) return 0x6e9d68;
  if (color === PAL.yellow) return 0xc78a38;
  if (color === PAL.heart) return 0xc66f8d;
  if (color === PAL.purple) return MENU_PAL.violet;
  if (color === PAL.cream) return MENU_PAL.wine;
  return color;
}

function mkPageButton(label        , w        , h        , onTap            , color = PAL.red, primary = false, fontSize = 18)            {
  const btn = new Container();
  const radius = Math.min(18, h * 0.32);
  const jewel = pageJewelColor(color);
  const shadow = new Graphics().roundRect(-w / 2, -h / 2 + UI_ELEVATION.button.offset, w, h, radius).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.button.alpha });
  const bg = new Graphics();
  bg.roundRect(-w / 2, -h / 2, w, h, radius).fill(primary ? MENU_PAL.coral : MENU_PAL.paper).stroke({ width: primary ? 2 : 1.5, color: MENU_PAL.gold, alpha: primary ? 0.9 : 0.5 });
  bg.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(8, radius - 4)).stroke({ width: 1, color: primary ? MENU_PAL.goldLight : MENU_PAL.line, alpha: primary ? 0.32 : 0.28 });
  if (!primary) bg.roundRect(-w / 2 + 11, h / 2 - 9, w - 22, 3, 2).fill({ color: jewel, alpha: 0.25 });
  const labelText = mkText(label, fontSize, primary ? MENU_PAL.cream : MENU_PAL.ink);
  labelText.style.letterSpacing = 0.8;
  labelText.anchor.set(0.5);
  btn.addChild(shadow, bg, labelText);
  btn.labelText = labelText;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown', () => btn.scale.set(0.985));
  btn.on('pointerupoutside', () => btn.scale.set(1));
  btn.on('pointertap', () => {
    btn.scale.set(1);
    audio.unlock();
    audio.play('orb-step', 1.1);
    onTap();
  });
  return btn;
}

function drawMenuDiamond(g           , x        , y        , radius        , color        , alpha = 1)       {
  g.moveTo(x, y - radius)
    .lineTo(x + radius, y)
    .lineTo(x, y + radius)
    .lineTo(x - radius, y)
    .closePath()
    .fill({ color, alpha });
}

function drawMenuHeart(g           , size        , color        , alpha = 1)       {
  g.moveTo(0, size * 0.78)
    .bezierCurveTo(-size * 1.06, size * 0.14, -size * 0.84, -size * 0.72, -size * 0.28, -size * 0.72)
    .bezierCurveTo(0, -size * 0.72, 0, -size * 0.45, 0, -size * 0.32)
    .bezierCurveTo(0, -size * 0.45, 0, -size * 0.72, size * 0.28, -size * 0.72)
    .bezierCurveTo(size * 0.84, -size * 0.72, size * 1.06, size * 0.14, 0, size * 0.78)
    .closePath()
    .fill({ color, alpha });
}

function makeMenuHeroIdleFx()            {
  const layer = new Container();
  layer.eventMode = 'none';
  menuHeroFx = [];

  const addBubble = (x        , y        , radius        , phase        ) => {
    const g = new Graphics();
    g.circle(0, 0, radius).fill({ color: 0xc8f3fb, alpha: 0.16 }).stroke({ width: 1, color: 0x75cfe5, alpha: 0.72 });
    g.circle(-radius * 0.28, -radius * 0.3, Math.max(0.8, radius * 0.2)).fill({ color: 0xffffff, alpha: 0.78 });
    layer.addChild(g);
    menuHeroFx.push({ g, baseX: x, baseY: y, phase, rise: 18, speed: 0.2, maxAlpha: 0.58, drift: 2.2, spin: 0.08 });
  };
  const addSparkle = (x        , y        , radius        , phase        ) => {
    const g = new Graphics();
    drawMenuDiamond(g, 0, 0, radius, 0xffdc7a, 0.92);
    g.circle(0, 0, Math.max(0.9, radius * 0.2)).fill({ color: 0xffffff, alpha: 0.82 });
    layer.addChild(g);
    menuHeroFx.push({ g, baseX: x, baseY: y, phase, rise: 10, speed: 0.16, maxAlpha: 0.72, drift: 1.2, spin: 0.5 });
  };
  const addHeart = (x        , y        , size        , phase        ) => {
    const g = new Graphics();
    drawMenuHeart(g, size, 0xffb5cc, 0.9);
    layer.addChild(g);
    menuHeroFx.push({ g, baseX: x, baseY: y, phase, rise: 16, speed: 0.18, maxAlpha: 0.64, drift: 1.8, spin: 0.14 });
  };

  addBubble(57, 403, 3.3, 0.08);
  addBubble(112, 365, 2.5, 0.56);
  addSparkle(158, 327, 3.6, 0.18);
  addSparkle(271, 353, 3, 0.7);
  addHeart(318, 366, 3.6, 0.28);
  addHeart(364, 397, 3, 0.78);
  return layer;
}

function makeOrnateMenuBase()            {
  const base = new Container();
  const backdrop = new Graphics();
  backdrop.rect(0, 0, W, H).fill(MENU_PAL.paper);
  backdrop.rect(0, 0, W, 250).fill({ color: 0xffead7, alpha: 0.18 });
  backdrop.ellipse(W / 2, 244, 278, 112).fill({ color: MENU_PAL.paper, alpha: 0.96 });
  backdrop.rect(0, 545, W, H - 545).fill({ color: 0xeee3ef, alpha: 0.14 });
  backdrop.ellipse(W / 2, 552, 270, 82).fill({ color: MENU_PAL.paper, alpha: 0.9 });
  backdrop.ellipse(32, 88, 148, 124).fill({ color: MENU_PAL.coralLight, alpha: 0.055 });
  backdrop.ellipse(W - 24, 330, 154, 260).fill({ color: MENU_PAL.goldLight, alpha: 0.052 });
  backdrop.ellipse(28, H - 62, 176, 150).fill({ color: MENU_PAL.violet, alpha: 0.038 });

  const lattice = new Graphics();
  for (let x = -210; x <= W + 180; x += 48) {
    lattice.moveTo(x, 244).lineTo(x + 238, 716);
    lattice.moveTo(x, 716).lineTo(x + 238, 244);
  }
  lattice.stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.026 });

  const alcove = new Graphics();
  alcove.moveTo(54, 492)
    .lineTo(54, 337)
    .bezierCurveTo(54, 273, 112, 238, W / 2, 238)
    .bezierCurveTo(W - 112, 238, W - 54, 273, W - 54, 337)
    .lineTo(W - 54, 492)
    .bezierCurveTo(W - 94, 510, 94, 510, 54, 492)
    .closePath()
    .fill({ color: 0xffe7d1, alpha: 0.31 })
    .stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.16 });
  alcove.moveTo(73, 478)
    .lineTo(73, 344)
    .bezierCurveTo(73, 292, 122, 261, W / 2, 261)
    .bezierCurveTo(W - 122, 261, W - 73, 292, W - 73, 344)
    .lineTo(W - 73, 478)
    .stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.18 });
  alcove.ellipse(W / 2, 379, 138, 104).fill({ color: 0xffffff, alpha: 0.17 });
  alcove.ellipse(W / 2, 392, 104, 83).fill({ color: MENU_PAL.goldLight, alpha: 0.055 });

  const lowerPanel = new Graphics();
  lowerPanel.roundRect(36, 586, W - 72, 146, 28).fill({ color: 0xffffff, alpha: 0.15 });
  lowerPanel.roundRect(42, 592, W - 84, 134, 23).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.12 });
  lowerPanel.moveTo(64, 579).lineTo(W / 2 - 13, 579).stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.22 });
  lowerPanel.moveTo(W / 2 + 13, 579).lineTo(W - 64, 579).stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.22 });
  drawMenuDiamond(lowerPanel, W / 2, 579, 4, MENU_PAL.gold, 0.36);

  const ornaments = new Graphics();
  for (const side of [-1, 1]) {
    const x = side < 0 ? 30 : W - 30;
    const inward = side < 0 ? 1 : -1;
    ornaments.moveTo(x, 282).bezierCurveTo(x + inward * 22, 298, x + inward * 22, 326, x, 344).stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.2 });
    drawMenuDiamond(ornaments, x + inward * 10, 301, 3, MENU_PAL.goldLight, 0.25);
    ornaments.circle(x + inward * 14, 328, 2.4).fill({ color: MENU_PAL.coralLight, alpha: 0.18 });
    ornaments.moveTo(x, 650).bezierCurveTo(x + inward * 18, 661, x + inward * 18, 685, x, 696).stroke({ width: 1.1, color: MENU_PAL.violet, alpha: 0.12 });
    drawMenuDiamond(ornaments, x + inward * 9, 673, 2.6, MENU_PAL.gold, 0.22);
  }

  const footer = new Graphics();
  footer.moveTo(151, 776).bezierCurveTo(176, 766, 190, 766, W / 2, 776).bezierCurveTo(230, 766, 244, 766, 269, 776).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.17 });
  drawMenuDiamond(footer, W / 2, 776, 3, MENU_PAL.gold, 0.26);
  backdrop.roundRect(6, 6, W - 12, H - 12, 28).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.72 });
  backdrop.roundRect(11, 11, W - 22, H - 22, 24).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.44 });
  base.addChild(backdrop, lattice, alcove, lowerPanel, ornaments, footer);
  return base;
}

function makeMenuColorWash()            {
  const wash = new Graphics();
  for (let i = 0; i < 6; i++) {
    wash.ellipse(W / 2, 322, 258 - i * 25, 286 - i * 26).fill({ color: 0xffd9ba, alpha: 0.009 });
  }
  for (let i = 0; i < 5; i++) {
    wash.ellipse(W / 2, 548, 220 - i * 24, 122 - i * 13).fill({ color: 0xffcbbd, alpha: 0.01 });
  }
  for (let i = 0; i < 5; i++) {
    wash.ellipse(W / 2, 742, 164 - i * 18, 88 - i * 9).fill({ color: 0xd8c5e5, alpha: 0.012 });
  }
  wash.eventMode = 'none';
  return wash;
}

function traceMenuPlaque(g           , yOffset = 0)            {
  g.moveTo(-150, 48 + yOffset)
    .bezierCurveTo(-150, 27 + yOffset, -136, 14 + yOffset, -116, 14 + yOffset)
    .lineTo(-76, 14 + yOffset)
    .bezierCurveTo(-61, 14 + yOffset, -56, 5 + yOffset, -47, -2 + yOffset)
    .bezierCurveTo(-34, -13 + yOffset, -17, -17 + yOffset, 0, -17 + yOffset)
    .bezierCurveTo(17, -17 + yOffset, 34, -13 + yOffset, 47, -2 + yOffset)
    .bezierCurveTo(56, 5 + yOffset, 61, 14 + yOffset, 76, 14 + yOffset)
    .lineTo(116, 14 + yOffset)
    .bezierCurveTo(136, 14 + yOffset, 150, 27 + yOffset, 150, 48 + yOffset)
    .lineTo(150, 145 + yOffset)
    .bezierCurveTo(150, 163 + yOffset, 136, 176 + yOffset, 116, 176 + yOffset)
    .lineTo(-116, 176 + yOffset)
    .bezierCurveTo(-136, 176 + yOffset, -150, 163 + yOffset, -150, 145 + yOffset)
    .closePath();
  return g;
}

function makeCandyLogo()            {
  const logo = new Container();
  const plaqueShadow = new Graphics();
  traceMenuPlaque(plaqueShadow, 3).fill({ color: MENU_PAL.cocoa, alpha: 0.13 });
  const plaque = new Graphics();
  traceMenuPlaque(plaque, 0).fill(MENU_PAL.wine).stroke({ width: 3, color: MENU_PAL.gold, alpha: 0.96 });
  const plaqueInner = new Graphics();
  traceMenuPlaque(plaqueInner, 0).stroke({ width: 1.2, color: MENU_PAL.goldLight, alpha: 0.42 });
  plaqueInner.scale.set(0.95, 0.91);
  plaqueInner.position.set(0, 8);
  const plaqueGlow = new Graphics();
  plaqueGlow.ellipse(0, 54, 118, 39).fill({ color: 0xffffff, alpha: 0.025 });
  const leaves = new Graphics();
  for (const side of [-1, 1]) {
    const sx = side * 154;
    leaves.moveTo(sx, 118).bezierCurveTo(side * 170, 109, side * 174, 93, side * 170, 78).stroke({ width: 1.4, color: MENU_PAL.gold, alpha: 0.86 });
    leaves.ellipse(side * 164, 105, 9, 3.6).fill({ color: MENU_PAL.goldLight, alpha: 0.82 });
    leaves.ellipse(side * 170, 91, 8, 3.2).fill({ color: MENU_PAL.gold, alpha: 0.82 });
  }
  const pudding = new Graphics();
  pudding.ellipse(0, 27, 14, 5).fill(MENU_PAL.gold);
  pudding.roundRect(-9, 12, 18, 15, 5).fill(MENU_PAL.goldLight).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.9 });
  pudding.circle(0, 11, 2.5).fill(MENU_PAL.goldLight);
  pudding.moveTo(-7, 16).bezierCurveTo(-3, 20, 3, 20, 7, 16).stroke({ width: 2, color: MENU_PAL.cocoa, alpha: 0.8 });

  const makeLogoWord = (text        , size        , y        )         => {
    const word = new Text({
      text,
      style: new TextStyle({
        fontFamily: ['Georgia', 'Times New Roman', 'serif'],
        fontSize: size,
        fill: MENU_PAL.cream,
        fontWeight: '900',
        letterSpacing: 1,
        stroke: { color: 0x7a3f34, width: 2, join: 'round' },
        align: 'center',
      }),
    });
    word.anchor.set(0.5);
    word.position.set(0, y);
    return word;
  };
  const title1 = makeLogoWord('PUZZLE &', 31, 65);
  const title2 = makeLogoWord('PUDDINGS', 37, 102);
  const crest = new Graphics();
  crest.roundRect(-56, 126, 112, 32, 16).fill(MENU_PAL.cream).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.88 });
  crest.roundRect(-51, 130, 102, 24, 12).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.62 });
  drawMenuDiamond(crest, -39, 142, 3, MENU_PAL.gold, 0.9);
  drawMenuDiamond(crest, 39, 142, 3, MENU_PAL.gold, 0.9);
  crest.roundRect(-90, 141, 24, 1.5, 1).fill({ color: MENU_PAL.goldLight, alpha: 0.58 });
  crest.roundRect(66, 141, 24, 1.5, 1).fill({ color: MENU_PAL.goldLight, alpha: 0.58 });
  const kanji = mkText('\u5927\u6218', 17, MENU_PAL.ink);
  kanji.style.letterSpacing = 3;
  kanji.anchor.set(0.5);
  kanji.position.set(1, 142);
  logo.addChild(plaqueShadow, plaque, plaqueGlow, plaqueInner, leaves, pudding, title1, title2, crest, kanji);
  return logo;
}

function makeMenuHeroStage()            {
  const group = new Container();
  menuHeroActors = [];
  const floor = new Sprite(TEX['ui-menu-pedestal']);
  floor.anchor.set(0.5, 0);
  floor.width = 360;
  floor.height = floor.width * (floor.texture.height / floor.texture.width);
  floor.position.set(0, 60);
  group.addChild(floor);

  const specs = [
    { key: 'char-1', x: -102, y: 24, size: 132, phase: 0.18, amp: 1.8, speed: 1.12, tilt: 0.008 },
    { key: 'char-0', x: 0, y: 2, size: 174, phase: 0.64, amp: 2.2, speed: 0.94, tilt: 0.006 },
    { key: 'char-4', x: 105, y: 28, size: 124, phase: 1.06, amp: 1.6, speed: 1.2, tilt: 0.009 },
  ];
  for (const spec of specs) {
    const actor = new Sprite(TEX[spec.key]);
    actor.anchor.set(0.5);
    actor.width = spec.size;
    actor.height = spec.size;
    actor.position.set(spec.x, spec.y);
    actor.baseX = spec.x;
    actor.baseY = spec.y;
    actor.baseScaleX = actor.scale.x;
    actor.baseScaleY = actor.scale.y;
    actor.idlePhase = spec.phase;
    actor.idleAmp = spec.amp;
    actor.idleSpeed = spec.speed;
    actor.idleTilt = spec.tilt;
    group.addChild(actor);
    menuHeroActors.push(actor);
  }
  return group;
}

function mkOrnateButton(label        , w        , h        , onTap            , color        , primary = false, fontSize = 18)            {
  const btn = new Container();
  const radius = Math.min(22, h * 0.38);
  const shadow = new Graphics().roundRect(-w / 2, -h / 2 + UI_ELEVATION.button.offset, w, h, radius).fill({ color: MENU_PAL.cocoa, alpha: UI_ELEVATION.button.alpha });
  const frame = new Graphics();
  frame.roundRect(-w / 2, -h / 2, w, h, radius).fill(primary ? MENU_PAL.coral : MENU_PAL.paper).stroke({ width: primary ? 2.2 : 1.5, color: MENU_PAL.gold, alpha: primary ? 0.95 : 0.54 });
  frame.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(8, radius - 4)).stroke({ width: 1, color: primary ? MENU_PAL.goldLight : MENU_PAL.line, alpha: primary ? 0.34 : 0.28 });
  frame.roundRect(-w / 2 + 12, -h / 2 + 7, w - 24, Math.max(6, h * 0.16), 5).fill({ color: 0xffffff, alpha: primary ? 0.12 : 0.24 });
  if (primary) {
    drawMenuDiamond(frame, -w / 2 + 25, 0, 4, MENU_PAL.goldLight, 0.9);
    drawMenuDiamond(frame, w / 2 - 25, 0, 4, MENU_PAL.goldLight, 0.9);
  }
  const labelText = mkText(label, fontSize, primary ? MENU_PAL.cream : MENU_PAL.ink);
  labelText.style.letterSpacing = 1;
  labelText.anchor.set(0.5);
  btn.addChild(shadow, frame, labelText);
  btn.labelText = labelText;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown', () => btn.scale.set(0.975));
  btn.on('pointerupoutside', () => btn.scale.set(1));
  btn.on('pointertap', () => {
    btn.scale.set(1);
    audio.unlock();
    audio.play('orb-step', 1.1);
    onTap();
  });
  return btn;
}

function addPageHeader(ov           , titleText        , subtitleText        , accent        , backAction                  = null)       {
  const plaque = new Graphics();
  plaque.roundRect(W / 2 - 112, 27 + UI_ELEVATION.card.offset, 224, 72, 22).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
  plaque.roundRect(W / 2 - 112, 27, 224, 72, 22).fill(MENU_PAL.wine).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.86 });
  plaque.roundRect(W / 2 - 106, 33, 212, 60, 17).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.24 });
  const title = mkText(titleText, 25, MENU_PAL.cream);
  title.style.letterSpacing = 1;
  title.anchor.set(0.5);
  title.position.set(W / 2, 62);
  ov.addChild(plaque, title);
  if (subtitleText) {
    const subtitle = mkText(subtitleText, 11, MENU_PAL.ink, 0, W - 90);
    subtitle.alpha = 0.68;
    subtitle.anchor.set(0.5);
    subtitle.position.set(W / 2, 119);
    ov.addChild(subtitle);
  }
  if (backAction) {
    const back = mkPageButton('‹', 42, 42, backAction, PAL.cream, false, 28);
    back.position.set(43, 63);
    ov.addChild(back);
  }
}

// 圆形角色徽章：攻击/技能/连携切入用。
// 原版把 1024² 整图放大到 220px 再裁成 92px 圆形，会只剩瓶盖/帽子。
// 徽章现在容纳完整立绘，让技能角色在小屏上也可辨认。
function makeBadge(i        )            {
  const R = 46;
  const c = new Container();
  const bg = new Graphics().circle(0, 0, R).fill(PAL.boardBg).stroke({ width: 4, color: ORB_COLORS[i] });
  const tex = TEX[charTextureKey(i)];
  const face = new Sprite(tex);
  badgeFaces[i] = face;
  face.width = R * 2;
  face.height = R * 2;
  face.anchor.set(0.5);
  const mask = new Graphics().circle(0, 0, R - 3).fill(0xffffff);
  face.mask = mask;
  c.addChild(bg, face, mask);
  c.visible = false;
  c.position.set(-110, 230);
  fxLayer.addChild(c);
  return c;
}

function mkButton(label        , w        , h        , onTap            , color = PAL.red, fontSize = 20)            {
  const btn = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2 + UI_ELEVATION.button.offset, w, h, h / 2).fill({ color: PAL.brown, alpha: UI_ELEVATION.button.alpha });
  const bg = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(color).stroke({ width: 1.5, color: PAL.cream, alpha: 0.72 });
  const t = mkText(label, fontSize, color === PAL.yellow ? PAL.brown : PAL.cream);
  t.style.letterSpacing = 0.7;
  t.anchor.set(0.5, 0.5);
  btn.addChild(shadow, bg, t);
  btn.labelText = t;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointertap', () => {
    audio.unlock();
    audio.play('orb-step', 1.1);
    onTap();
  });
  return btn;
}

// 一排四语言小按钮（标题/暂停直接平铺，不开二级菜单）
function mkLangRow(y        , onPick            )            {
  const row = new Container();
  // Keep the four language buttons comfortably inside the narrowest menu
  // panel (300px). The previous 68px buttons only left 2px at each side,
  // so their strokes visually collided with the panel border when scaled.
  const buttonWidth = 58;
  const buttonGap = 8;
  const buttonStep = buttonWidth + buttonGap;
  const langs = [
    { key: 'zh', label: '中文' },
    { key: 'en', label: 'EN' },
    { key: 'ja', label: '日本語' },
    { key: 'ko', label: '한국어' },
  ];
  langs.forEach((l, i) => {
    const active = LANG === l.key;
    const btn = mkPageButton(
      l.label,
      buttonWidth,
      36,
      () => {
        LANG = l.key;
        localStorage.setItem('tz_lang', l.key);
        applyLang();
        onPick();
      },
      active ? PAL.yellow : PAL.purple,
      false,
      13,
    );
    btn.position.set((i - (langs.length - 1) / 2) * buttonStep, 0);
    row.addChild(btn);
  });
  row.position.set(W / 2, y);
  return row;
}

function applyLang()       {
  floorText.text = t('floor' + floorIndex);
  statusText.text = t('statusDef');
  updateGrowthHud();
}

function showLangPicker(origin        )       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.yellow, PAL.purple));
  ov.addChild(makePagePanel(W / 2, 400, 330, 390, PAL.yellow, 26));
  addPageHeader(ov, t('langTitle'), t('sub'), PAL.yellow);
  const langs = [
    { key: 'zh', label: '中文', color: PAL.red },
    { key: 'en', label: 'English', color: PAL.blue },
    { key: 'ja', label: '日本語', color: PAL.green },
    { key: 'ko', label: '한국어', color: PAL.purple },
  ];
  langs.forEach((l, i) => {
    const btn = mkPageButton(l.label, 200, 56, () => {
      LANG = l.key;
      localStorage.setItem('tz_lang', l.key);
      applyLang();
      if (origin === 'pause') {
        paused = false;
        togglePause(true);
      } else {
        showTitle();
      }
    }, l.color, false, 18);
    btn.position.set(W / 2, 300 + i * 64);
    ov.addChild(btn);
  });
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function mkMenuTile(label        , kind        , onTap            , accent        )            {
  const tile = new Container();
  const w = 94;
  const h = 102;
  const shell = new Graphics();
  shell.roundRect(-w / 2, -h / 2 + UI_ELEVATION.card.offset, w, h, 17).fill({ color: MENU_PAL.wine, alpha: UI_ELEVATION.card.alpha });
  shell.roundRect(-w / 2, -h / 2, w, h, 17).fill(MENU_PAL.paper).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.5 });
  shell.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 13).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.25 });
  shell.roundRect(-w / 2 + 11, -h / 2 + 8, w - 22, 11, 6).fill({ color: 0xffffff, alpha: 0.3 });

  const icon = new Container();
  icon.position.set(0, -15);
  const iconIndex = kind === 'map' ? 0 : kind === 'evolve' ? 1 : 2;
  const strip = new Sprite(TEX['ui-menu-icons']);
  strip.anchor.set(0, 0.5);
  strip.width = 180;
  strip.height = 60;
  strip.position.set(-30 - iconIndex * 60, 0);
  const iconMask = new Graphics().rect(-30, -30, 60, 60).fill(0xffffff);
  strip.mask = iconMask;
  icon.addChild(strip, iconMask);

  const text = mkText(label, 13, MENU_PAL.ink);
  text.style.letterSpacing = 0.3;
  text.anchor.set(0.5);
  text.position.set(0, 31);
  if (text.width > w - 18) text.scale.set((w - 18) / text.width);
  tile.addChild(shell, icon, text);
  tile.eventMode = 'static';
  tile.cursor = 'pointer';
  tile.on('pointerdown', () => tile.scale.set(0.975));
  tile.on('pointerupoutside', () => tile.scale.set(1));
  tile.on('pointertap', () => {
    tile.scale.set(1);
    audio.unlock();
    audio.play('orb-step', 1.08);
    onTap();
  });
  return tile;
}

function mkMenuHitTarget(label        , w        , h        , onTap            , fontSize = 14, textColor = MENU_PAL.ink)            {
  const target = new Container();
  const hit = new Graphics().roundRect(-w / 2, -h / 2, w, h, 16).fill({ color: 0xffffff, alpha: 0.001 });
  const text = mkText(label, fontSize, textColor);
  text.style.letterSpacing = 0.35;
  text.anchor.set(0.5);
  text.position.set(0, h * 0.255);
  if (text.width > w - 18) text.scale.set((w - 18) / text.width);
  target.addChild(hit, text);
  target.eventMode = 'static';
  target.cursor = 'pointer';
  target.on('pointerdown', () => target.scale.set(0.98));
  target.on('pointerupoutside', () => target.scale.set(1));
  target.on('pointertap', () => {
    target.scale.set(1);
    audio.unlock();
    audio.play('orb-step', 1.08);
    onTap();
  });
  return target;
}

function mkLeaderboardMenuButton()            {
  const btn = new Container();
  const w = 184;
  const h = 40;
  const shadow = new Graphics().roundRect(-w / 2, -h / 2 + UI_ELEVATION.button.offset, w, h, 18).fill({ color: MENU_PAL.cocoa, alpha: UI_ELEVATION.button.alpha });
  const shell = new Graphics();
  shell.roundRect(-w / 2, -h / 2, w, h, 18).fill(MENU_PAL.paper).stroke({ width: 1.7, color: MENU_PAL.gold, alpha: 0.74 });
  shell.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 13).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.32 });
  shell.roundRect(-w / 2 + 12, -h / 2 + 7, w - 24, 7, 4).fill({ color: 0xffffff, alpha: 0.34 });
  const medal = new Graphics();
  medal.circle(-61, 0, 11).fill(MENU_PAL.wine).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.95 });
  medal.moveTo(-68, -2).lineTo(-65, 3).lineTo(-61, -4).lineTo(-57, 3).lineTo(-54, -2).lineTo(-55, 6).lineTo(-67, 6).closePath().fill(MENU_PAL.goldLight);
  const label = mkText(t('leaderboard'), 14, MENU_PAL.ink);
  label.style.letterSpacing = 0.8;
  label.anchor.set(0.5);
  label.position.set(13, 0);
  btn.addChild(shadow, shell, medal, label);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown', () => btn.scale.set(0.98));
  btn.on('pointerupoutside', () => btn.scale.set(1));
  btn.on('pointertap', () => {
    btn.scale.set(1);
    audio.unlock();
    audio.play('orb-step', 1.08);
    showLeaderboard();
  });
  return btn;
}

function showTitle()       {
  evolutionTabOpen = false;
  phase = PHASE.Title;
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makeOrnateMenuBase());
  ov.addChild(makeMenuColorWash());

  const logo = makeCandyLogo();
  logo.position.set(W / 2, 56);
  logo.alpha = 0;
  logo.scale.set(1.08);
  const logoBaseX = 1.08;
  const logoBaseY = 1.08;
  logo.scale.set(logoBaseX * 0.94, logoBaseY * 0.94);
  ov.addChild(logo);
  sched.tween(0.42, (k) => {
    if (logo.destroyed) return;
    logo.alpha = k;
    logo.scale.set(logoBaseX * (0.94 + k * 0.06), logoBaseY * (0.94 + k * 0.06));
  }, EaseOutBack);

  const heroGroup = makeMenuHeroStage();
  heroGroup.position.set(W / 2, 375);
  heroGroup.alpha = 0;
  const heroBaseX = heroGroup.scale.x;
  const heroBaseY = heroGroup.scale.y;
  menuHeroGroup = heroGroup;
  menuHeroBaseScaleX = heroBaseX;
  menuHeroBaseScaleY = heroBaseY;
  menuHeroIdleReady = false;
  heroGroup.scale.set(heroBaseX * 0.975, heroBaseY * 0.975);
  ov.addChild(heroGroup);
  sched.tween(0.46, (k) => {
    if (heroGroup.destroyed) return;
    heroGroup.alpha = k;
    heroGroup.scale.set(heroBaseX * (0.975 + k * 0.025), heroBaseY * (0.975 + k * 0.025));
  }, EaseOutBack, () => {
    if (!heroGroup.destroyed) menuHeroIdleReady = true;
  });
  menuHeroFxLayer = makeMenuHeroIdleFx();
  menuHeroFxLayer.alpha = 0;
  ov.addChild(menuHeroFxLayer);

  const start = mkOrnateButton(t('startGame'), 276, 66, () => {
    clearOverlay();
    setStandalonePage(false);
    if (localStorage.getItem('tz_story')) {
      if (localStorage.getItem('tz_tut')) phase = PHASE.Idle;
      else startTutorial();
    } else {
      showStory();
    }
  }, PAL.red, true, 24);
  start.position.set(W / 2, 532);

  const mapBtn = mkMenuTile(t('selectStage'), 'map', () => {
    showFloorMap(highestCleared(), 0, true);
  }, MENU_PAL.teal);
  mapBtn.position.set(99, 632);
  const evolveBtn = mkMenuTile(t('evolutionTab'), 'evolve', () => {
    showEvolutionTab('title');
  }, MENU_PAL.gold);
  evolveBtn.position.set(210, 632);
  const setBtn = mkMenuTile(t('settings'), 'settings', () => {
    showSettings();
  }, MENU_PAL.violet);
  setBtn.position.set(321, 632);
  const leaderboardBtn = mkLeaderboardMenuButton();
  leaderboardBtn.position.set(W / 2, 714);
  ov.addChild(start, mapBtn, evolveBtn, setBtn, leaderboardBtn);

  const progress = new Container();
  progress.position.set(W / 2, 764);
  const progressShadow = new Graphics().roundRect(-87, -21 + UI_ELEVATION.button.offset, 174, 42, 19).fill({ color: MENU_PAL.cocoa, alpha: UI_ELEVATION.button.alpha });
  const progressBg = new Graphics();
  progressBg.roundRect(-87, -21, 174, 42, 19).fill(MENU_PAL.wine).stroke({ width: 1.8, color: MENU_PAL.gold, alpha: 0.9 });
  progressBg.roundRect(-82, -16, 164, 32, 14).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.2 });
  progressBg.roundRect(-73, -13, 146, 7, 4).fill({ color: 0xffffff, alpha: 0.045 });
  const progressLabel = mkText(t('evolutionExp'), 12.5, MENU_PAL.cream);
  progressLabel.style.letterSpacing = 0.25;
  progressLabel.alpha = 0.82;
  progressLabel.anchor.set(0, 0.5);
  progressLabel.position.set(-64, 0);
  if (progressLabel.width > 78) progressLabel.scale.set(78 / progressLabel.width);
  const progressValue = mkBrandText(`✦ ${evolutionExp}`, 15, MENU_PAL.goldLight);
  progressValue.anchor.set(1, 0.5);
  progressValue.position.set(69, 0);
  const divider = new Graphics().roundRect(16, -8, 1, 16, 1).fill({ color: MENU_PAL.goldLight, alpha: 0.3 });
  progress.addChild(progressShadow, progressBg, progressLabel, progressValue, divider);
  ov.addChild(progress);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function highestCleared()         {
  let best = -1;
  for (let i = 0; i < FLOORS.length; i++) if (starsOf(i) > 0) best = i;
  return best;
}

// 设置页：音效音量滑条 + 音乐/音效开关 + 删除存档
function showSettings()       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.purple, PAL.blue));
  ov.addChild(makePagePanel(W / 2, 360, 350, 446, PAL.purple, 26));
  addPageHeader(ov, t('settings'), t('sub'), PAL.purple, () => showTitle());
  // 音效音量滑条
  const volLabel = mkText('', 17, PAL.brown);
  volLabel.anchor.set(0.5);
  volLabel.position.set(W / 2, 190);
  ov.addChild(volLabel);
  const slider = new Container();
  slider.position.set(W / 2, 226);
  const track = new Graphics().roundRect(-110, -6, 220, 12, 6).fill({ color: MENU_PAL.wine, alpha: 0.14 });
  const fill = new Graphics();
  const knob = new Graphics().circle(0, 0, 13).fill(MENU_PAL.gold).stroke({ width: 2, color: MENU_PAL.cream, alpha: 0.9 });
  slider.addChild(track, fill, knob);
  const renderVol = () => {
    const v = audio.getSfxVol();
    fill.clear();
    fill.roundRect(-110, -6, Math.max(0.01, 220 * v), 12, 6).fill(MENU_PAL.coral);
    knob.x = -110 + 220 * v;
    volLabel.text = `${t('sfxVol')} ${Math.round(v * 100)}%`;
  };
  renderVol();
  slider.eventMode = 'static';
  slider.cursor = 'pointer';
  slider.hitArea = { contains: (x        , y        ) => x >= -125 && y >= -20 && x <= 125 && y <= 20 };
  const setFromX = (lx        ) => audio.setSfxVol(Math.max(0, Math.min(1, (lx + 110) / 220)));
  slider.on('pointerdown', (e) => {
    setFromX(slider.toLocal(e.global).x);
    renderVol();
  });
  slider.on('pointermove', (e) => {
    if (e.buttons === 1) {
      setFromX(slider.toLocal(e.global).x);
      renderVol();
    }
  });
  ov.addChild(slider);
  // 与暂停页共用同一套 2.5D 音频开关，避免设置入口各用一套组件。
  const music = mkPauseAudioToggle(t('musicLabel'), audio.musicOn, 'icon-music-on', 'icon-music-off', MENU_PAL.teal, () => {
    audio.setMusicOn(!audio.musicOn);
    music.setOn(audio.musicOn);
  });
  music.position.set(137, 310);
  const sfx = mkPauseAudioToggle(t('sfxLabel'), audio.sfxOn, 'icon-audio-on', 'icon-audio-off', MENU_PAL.violet, () => {
    audio.setSfxOn(!audio.sfxOn);
    sfx.setOn(audio.sfxOn);
  });
  sfx.position.set(283, 310);
  ov.addChild(music, sfx);
  const langLabel = mkText(t('lang'), 15, PAL.brown);
  langLabel.anchor.set(0.5);
  langLabel.position.set(W / 2, 374);
  ov.addChild(langLabel, mkLangRow(412, () => showSettings()));
  ov.addChild(mkDelButton(W / 2, 480, 200, 48, 17));
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function blockOverlay(ov           )       {
  ov.eventMode = 'static';
  ov.hitArea = { contains: (x        , y        ) => x >= 0 && y >= 0 && x <= W && y <= H };
}

// 放弃本局返回主界面
function backToTitle()       {
  paused = false;
  sched.paused = false;
  audio.setPaused(false);
  clearOverlay();
  hideBubble();
  mapPulse = null;
  hp[0] = START_HP;
  hp[1] = START_HP;
  hp[2] = START_HP;
  hp[3] = START_HP;
  hp[4] = START_HP;
  timeSec = 0;
  maxCombo = 0;
  rainbowCount = 0;
  turnNo = 0;
  board.reset(FIXED_BOARD);
  spawnFloor(0, true);
  updatePartyHud();
  showTitle();
}

// 删除存档按钮（二次确认，点两次才生效）
function mkDelButton(x        , y        , w        , h        , fontSize        )            {
  const btn = new Container();
  const bg = new Graphics();
  bg.roundRect(-w / 2, -h / 2, w, h, 16).fill(MENU_PAL.gold);
  bg.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 13).fill(0xffece7).stroke({ width: 1, color: MENU_PAL.coral, alpha: 0.54 });
  const label = mkText(t('delSave'), fontSize, MENU_PAL.wine);
  label.style.letterSpacing = 0.7;
  label.anchor.set(0.5, 0.5);
  btn.addChild(bg, label);
  btn.position.set(x, y);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  let armed = false;
  btn.on('pointertap', () => {
    audio.unlock();
    audio.play('orb-step', 1.1);
    if (!armed) {
      armed = true;
      label.text = t('delConfirm');
      return;
    }
    ['tz_best', 'tz_stars', 'tz_tut', 'tz_story', 'tz_lang', 'tz_party_xp', 'tz_party_stages', 'tz_evolution_exp', LEADERBOARD_KEY, EVOLUTION_NOTICE_KEY].forEach((k) => localStorage.removeItem(k));
    resetGameToFresh();
  });
  return btn;
}

// 删档后游戏内完整重置：回到语言选择 → 标题 → 剧情 → 教学（不刷新页面）
function resetGameToFresh()       {
  paused = false;
  sched.paused = false;
  audio.setPaused(false);
  LANG = '';
  partyStages = [0, 0, 0, 0, 0];
  evolutionExp = 0;
  evolutionReadyNoticePending = false;
  clearOverlay();
  hideBubble();
  mapPulse = null;
  tutActive = false;
  if (tutHint) {
    tutHint.destroy();
    tutHint = null;
  }
  Object.keys(bubbleShown).forEach((k) => delete bubbleShown[k]);
  hp[0] = START_HP;
  hp[1] = START_HP;
  hp[2] = START_HP;
  hp[3] = START_HP;
  hp[4] = START_HP;
  timeSec = 0;
  maxCombo = 0;
  rainbowCount = 0;
  turnNo = 0;
  board.reset(FIXED_BOARD);
  spawnFloor(0, true);
  updatePartyHud();
  statusText.text = t('statusDef');
  phase = PHASE.Title;
  showLangPicker('boot');
}

// Pause controls use one restrained 2.5D material system: gold rim, molded
// body, top sheen and a short lower extrusion. Text stays outline-free so the
// Smiley Sans shapes remain crisp at small sizes.
function mkPauseAction(label        , w        , h        , onTap            , color        , lightText = true, fontSize = 17)            {
  const btn = new Container();
  const radius = Math.min(18, h * 0.34);
  const art = new Graphics();
  art.roundRect(-w / 2, -h / 2 + UI_ELEVATION.button.offset, w, h, radius).fill({ color: MENU_PAL.cocoa, alpha: UI_ELEVATION.button.alpha });
  art.roundRect(-w / 2, -h / 2, w, h, radius).fill(lightText ? color : MENU_PAL.paper).stroke({ width: lightText ? 2 : 1.5, color: MENU_PAL.gold, alpha: lightText ? 0.9 : 0.5 });
  art.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(8, radius - 4)).stroke({ width: 1, color: lightText ? MENU_PAL.goldLight : MENU_PAL.line, alpha: lightText ? 0.28 : 0.24 });
  art.roundRect(-w / 2 + 11, -h / 2 + 7, w - 22, Math.max(7, h * 0.16), 4).fill({ color: 0xffffff, alpha: lightText ? 0.12 : 0.26 });
  if (!lightText) art.roundRect(-w / 2 + 12, h / 2 - 9, w - 24, 3, 2).fill({ color, alpha: 0.24 });
  const textColor = lightText ? MENU_PAL.cream : MENU_PAL.wine;
  const labelText = mkText(label, fontSize, textColor);
  labelText.style.letterSpacing = 0.8;
  labelText.anchor.set(0.5);
  btn.addChild(art, labelText);
  btn.labelText = labelText;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown', () => {
    btn.scale.set(0.975);
    btn.y += 2;
  });
  btn.on('pointerupoutside', () => {
    btn.scale.set(1);
    btn.y -= 2;
  });
  btn.on('pointertap', () => {
    btn.scale.set(1);
    btn.y -= 2;
    audio.unlock();
    audio.play('orb-step', 1.08);
    onTap();
  });
  return btn;
}

function mkPauseAudioToggle(label        , enabled         , onIcon        , offIcon        , accent        , onTap            )            {
  const btn = new Container();
  const art = new Graphics();
  art.roundRect(-63, -29 + UI_ELEVATION.card.offset, 126, 58, 17).fill({ color: MENU_PAL.cocoa, alpha: UI_ELEVATION.card.alpha });
  art.roundRect(-63, -29, 126, 58, 17).fill(0xfffbf4).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.58 });
  art.roundRect(-58, -24, 116, 48, 13).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.19 });
  art.roundRect(-53, -21, 106, 11, 6).fill({ color: 0xffffff, alpha: 0.34 });
  const iconPlate = new Graphics();
  iconPlate.circle(-38, 0, 18).fill({ color: accent, alpha: 0.17 });
  iconPlate.circle(-38, 0, 16.5).stroke({ width: 1.5, color: accent, alpha: 0.46 });
  iconPlate.circle(-42, -5, 4).fill({ color: 0xffffff, alpha: 0.25 });
  const icon = new Sprite(TEX[enabled ? onIcon : offIcon]);
  icon.anchor.set(0.5);
  icon.position.set(-38, 0);
  icon.width = 24;
  icon.height = 24;
  icon.tint = MENU_PAL.wine;
  const name = mkText(label, 12, MENU_PAL.wine);
  name.style.letterSpacing = 0.6;
  name.anchor.set(0.5);
  name.position.set(20, -10);
  const stateShell = new Graphics();
  const stateKnob = new Graphics();
  const state = mkText('', 8, MENU_PAL.cream);
  state.style.letterSpacing = 0.7;
  state.anchor.set(0.5);
  const renderState = (on         ) => {
    icon.texture = TEX[on ? onIcon : offIcon];
    state.text = on ? 'ON' : 'OFF';
    stateShell.clear();
    stateKnob.clear();
    stateShell.roundRect(-6, 1, 52, 19, 10).fill(on ? accent : 0xb9aaa4);
    stateShell.roundRect(-4, 3, 48, 15, 8).stroke({ width: 1, color: 0xffffff, alpha: 0.14 });
    const knobX = on ? 35 : 5;
    stateKnob.circle(knobX, 10.5, 7).fill(MENU_PAL.cream).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.36 });
    state.position.set(on ? 10 : 31, 10.5);
  };
  renderState(enabled);
  btn.addChild(art, iconPlate, icon, name, stateShell, stateKnob, state);
  btn.setOn = renderState;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerdown', () => btn.scale.set(0.975));
  btn.on('pointerupoutside', () => btn.scale.set(1));
  btn.on('pointertap', () => {
    btn.scale.set(1);
    audio.unlock();
    onTap();
  });
  return btn;
}

function togglePause(on         )       {
  if (phase === PHASE.Title || phase === PHASE.Over) return;
  if (on === paused) return;
  paused = on;
  sched.paused = on;
  audio.setPaused(on);
  if (on) {
    clearOverlay();
    const ov = new Container();
    const dim = new Graphics();
    dim.rect(0, 0, W, H).fill({ color: MENU_PAL.wine, alpha: 0.46 });
    dim.ellipse(W / 2, H / 2, 185, 250).fill({ color: MENU_PAL.cream, alpha: 0.028 });
    ov.addChild(dim);

    const card = new Container();
    card.position.set(W / 2, H / 2);
    const panel = new Graphics();
    panel.roundRect(-160, -170 + UI_ELEVATION.modal.offset, 320, 340, 28).fill({ color: 0x34192a, alpha: 0.11 });
    panel.roundRect(-160, -170, 320, 340, 28).fill(MENU_PAL.paper).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.8 });
    panel.roundRect(-153, -163, 306, 326, 22).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.29 });
    panel.roundRect(-144, -154, 288, 15, 8).fill({ color: 0xffffff, alpha: 0.22 });

    const header = new Graphics();
    header.roundRect(-148, -158, 296, 76, 22).fill(MENU_PAL.wine).stroke({ width: 1.8, color: MENU_PAL.gold, alpha: 0.88 });
    header.roundRect(-142, -152, 284, 64, 17).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.21 });
    header.ellipse(0, -134, 112, 25).fill({ color: 0xffffff, alpha: 0.025 });
    drawMenuDiamond(header, -125, -120, 3, MENU_PAL.goldLight, 0.5);
    drawMenuDiamond(header, 125, -120, 3, MENU_PAL.goldLight, 0.5);

    const pauseMedal = new Graphics();
    pauseMedal.circle(0, -168, 29).fill({ color: MENU_PAL.cocoa, alpha: 0.12 });
    pauseMedal.circle(0, -172, 28).fill(MENU_PAL.gold).stroke({ width: 1, color: MENU_PAL.cream, alpha: 0.8 });
    pauseMedal.circle(0, -172, 22).fill(MENU_PAL.wine).stroke({ width: 1, color: MENU_PAL.goldLight, alpha: 0.28 });
    pauseMedal.roundRect(-8, -181, 6, 18, 2).fill(MENU_PAL.cream);
    pauseMedal.roundRect(2, -181, 6, 18, 2).fill(MENU_PAL.cream);

    const title = mkText(t('pause'), 22, MENU_PAL.cream);
    title.style.letterSpacing = 1.2;
    title.anchor.set(0.5);
    title.position.set(0, -130);
    const subtitle = mkText(t('pauseSub'), 10, MENU_PAL.cream, 0, 268);
    subtitle.alpha = 0.58;
    subtitle.style.letterSpacing = 0.3;
    subtitle.anchor.set(0.5);
    subtitle.position.set(0, -101);

    const floorChip = new Graphics();
    floorChip.roundRect(-112, -91, 224, 28, 14).fill(0xfffbf4).stroke({ width: 1.2, color: MENU_PAL.gold, alpha: 0.58 });
    floorChip.roundRect(-105, -86, 210, 18, 9).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.18 });
    drawMenuDiamond(floorChip, -94, -77, 2.6, MENU_PAL.gold, 0.52);
    drawMenuDiamond(floorChip, 94, -77, 2.6, MENU_PAL.gold, 0.52);
    const floorLabel = mkText(t(`floor${floorIndex}`), 11.5, MENU_PAL.wine, 0, 194);
    floorLabel.alpha = 0.88;
    floorLabel.style.letterSpacing = 0.45;
    floorLabel.anchor.set(0.5);
    floorLabel.position.set(0, -77);

    const resume = mkPauseAction(t('resume'), 264, 54, () => togglePause(false), MENU_PAL.coral, true, 19);
    resume.position.set(0, -32);
    const music = mkPauseAudioToggle(t('musicLabel'), audio.musicOn, 'icon-music-on', 'icon-music-off', MENU_PAL.teal, () => {
      audio.setMusicOn(!audio.musicOn);
      music.setOn(audio.musicOn);
    });
    music.position.set(-68, 42);
    const sfx = mkPauseAudioToggle(t('sfxLabel'), audio.sfxOn, 'icon-audio-on', 'icon-audio-off', MENU_PAL.violet, () => {
      audio.setSfxOn(!audio.sfxOn);
      sfx.setOn(audio.sfxOn);
    });
    sfx.position.set(68, 42);

    const separator = new Graphics();
    separator.moveTo(-123, 83).lineTo(-12, 83).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.26 });
    separator.moveTo(12, 83).lineTo(123, 83).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.26 });
    drawMenuDiamond(separator, 0, 83, 3.2, MENU_PAL.gold, 0.42);

    const restart = mkPauseAction(t('restart'), 126, 44, () => {
      togglePause(false);
      restartRun();
    }, 0xc68b3b, false, 13);
    restart.position.set(-68, 116);
    const toTitle = mkPauseAction(t('toTitle'), 126, 44, () => backToTitle(), MENU_PAL.violet, false, 13);
    toTitle.position.set(68, 116);

    const footer = new Graphics();
    footer.moveTo(-78, 151).lineTo(-10, 151).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.22 });
    footer.moveTo(10, 151).lineTo(78, 151).stroke({ width: 1, color: MENU_PAL.line, alpha: 0.22 });
    drawMenuDiamond(footer, 0, 151, 2.6, MENU_PAL.gold, 0.36);

    card.addChild(panel, header, pauseMedal, title, subtitle, floorChip, floorLabel, resume, music, sfx, separator, restart, toTitle, footer);
    ov.addChild(card);
    blockOverlay(ov);
    overlayLayer.addChild(ov);
    activeOverlay = ov;
  } else {
    clearOverlay();
  }
}

function showLeaderboard(useQaData = false)       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.yellow, PAL.purple));
  addPageHeader(ov, t('leaderboard'), t('leaderboardSub'), PAL.yellow, () => showTitle());
  ov.addChild(makePagePanel(W / 2, 430, 364, 606, PAL.yellow, 26));

  const entries = useQaData ? qaLeaderboardEntries() : loadLeaderboard();
  const rule = mkText(t('leaderboardRule'), 11, MENU_PAL.ink, 0, 304);
  rule.alpha = 0.66;
  rule.anchor.set(0.5);
  rule.position.set(W / 2, 153);
  ov.addChild(rule);

  if (!entries.length) {
    const emptyMedal = new Graphics();
    emptyMedal.circle(W / 2, 320, 54).fill({ color: MENU_PAL.goldLight, alpha: 0.32 }).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.62 });
    emptyMedal.circle(W / 2, 320, 38).fill(MENU_PAL.wine).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.92 });
    drawMenuDiamond(emptyMedal, W / 2, 320, 12, MENU_PAL.goldLight, 0.96);
    const empty = mkText(t('leaderboardEmpty'), 16, MENU_PAL.ink, 0, 280);
    empty.anchor.set(0.5);
    empty.position.set(W / 2, 430);
    empty.style.lineHeight = 27;
    ov.addChild(emptyMedal, empty);
  } else {
    const best = entries[0];
    const bestCard = new Graphics();
    bestCard.roundRect(40, 169, 340, 58, 17).fill({ color: MENU_PAL.goldLight, alpha: 0.3 }).stroke({ width: 1.5, color: MENU_PAL.gold, alpha: 0.5 });
    bestCard.roundRect(46, 175, 328, 13, 7).fill({ color: 0xffffff, alpha: 0.32 });
    bestCard.circle(70, 198, 18).fill(MENU_PAL.wine).stroke({ width: 2, color: MENU_PAL.gold, alpha: 0.92 });
    const crown = new Graphics();
    crown.moveTo(61, 194).lineTo(65, 202).lineTo(70, 193).lineTo(75, 202).lineTo(79, 194).lineTo(77, 205).lineTo(63, 205).closePath().fill(MENU_PAL.goldLight);
    const bestLabel = mkText(t('leaderboardBest'), 10.5, MENU_PAL.ink);
    bestLabel.alpha = 0.65;
    bestLabel.anchor.set(0, 0.5);
    bestLabel.position.set(97, 188);
    const bestScore = mkBrandText(best.score.toLocaleString('en-US'), 18, MENU_PAL.wine);
    bestScore.anchor.set(0, 0.5);
    bestScore.position.set(97, 207);
    const bestMeta = mkText(`${best.cleared}/${FLOORS.length}  ·  ${best.rank === '-' ? '—' : best.rank}  ·  ${formatRunTime(best.time)}`, 12, MENU_PAL.ink);
    bestMeta.alpha = 0.74;
    bestMeta.anchor.set(1, 0.5);
    bestMeta.position.set(359, 199);
    ov.addChild(bestCard, crown, bestLabel, bestScore, bestMeta);

    const columns = [
      [t('leaderboardScore'), 114],
      [t('leaderboardFloor'), 229],
      [t('leaderboardGrade'), 299],
      [t('leaderboardTime'), 355],
    ];
    columns.forEach(([labelText, x]) => {
      const label = mkText(String(labelText), 9.5, MENU_PAL.ink);
      label.alpha = 0.48;
      label.anchor.set(0.5);
      label.position.set(Number(x), 247);
      ov.addChild(label);
    });

    entries.slice(0, 10).forEach((entry, index) => {
      const y = 276 + index * 43;
      const row = new Graphics();
      const topColors = [0xffefbd, 0xeaf2f4, 0xf6e3d2];
      row.roundRect(42, y - 18, 336, 37, 12).fill({ color: topColors[index] || 0xfffaf2, alpha: index < 3 ? 0.82 : 0.72 });
      row.roundRect(42, y - 18, 336, 37, 12).stroke({ width: 1, color: index < 3 ? MENU_PAL.gold : MENU_PAL.line, alpha: index < 3 ? 0.42 : 0.24 });
      row.roundRect(48, y - 13, 324, 8, 4).fill({ color: 0xffffff, alpha: 0.26 });
      const medalColor = index === 0 ? MENU_PAL.gold : index === 1 ? 0x9fb6c1 : index === 2 ? 0xc78a62 : MENU_PAL.wine;
      row.circle(61, y, 12.5).fill({ color: medalColor, alpha: index < 3 ? 1 : 0.72 });
      ov.addChild(row);
      const pos = mkBrandText(`${index + 1}`, 12.5, MENU_PAL.cream);
      pos.anchor.set(0.5);
      pos.position.set(61, y);
      const score = mkBrandText(entry.score.toLocaleString('en-US'), 13.5, index === 0 ? MENU_PAL.wine : MENU_PAL.ink);
      score.anchor.set(0.5);
      score.position.set(117, y);
      const floor = mkText(`${entry.cleared}/${FLOORS.length}`, 12.5, MENU_PAL.ink);
      floor.anchor.set(0.5);
      floor.position.set(229, y);
      const grade = mkBrandText(entry.rank === '-' ? '—' : entry.rank, 14, entry.rank === 'S' ? MENU_PAL.gold : entry.rank === 'A' ? MENU_PAL.coral : MENU_PAL.teal);
      grade.anchor.set(0.5);
      grade.position.set(299, y);
      const timeLabel = mkBrandText(formatRunTime(entry.time), 11.5, MENU_PAL.ink);
      timeLabel.anchor.set(0.5);
      timeLabel.position.set(351, y);
      ov.addChild(pos, score, floor, grade, timeLabel);
    });
  }

  const footerLine = new Graphics();
  footerLine.moveTo(92, 716).lineTo(188, 716).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.28 });
  footerLine.moveTo(232, 716).lineTo(328, 716).stroke({ width: 1, color: MENU_PAL.gold, alpha: 0.28 });
  drawMenuDiamond(footerLine, W / 2, 716, 3.5, MENU_PAL.gold, 0.55);
  ov.addChild(footerLine);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function showFail(leaderboardResult                                      = null)       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.red, PAL.purple));
  addPageHeader(ov, t('failTitle'), t('reached').replace('{x}', t('floor' + floorIndex)), PAL.red);
  ov.addChild(makePagePanel(W / 2, 420, 340, 290, PAL.red, 28));
  const sub = mkText(t('reached').replace('{x}', t('floor' + floorIndex)), 17, MENU_PAL.wine);
  sub.anchor.set(0.5);
  sub.position.set(W / 2, 345);
  const place = mkText(leaderboardResult?.position ? t('leaderboardPlace').replace('{x}', `${leaderboardResult.position}`) : '', 14, MENU_PAL.coral);
  place.anchor.set(0.5);
  place.position.set(W / 2, 381);
  const btn = mkPageButton(t('retry'), 156, 54, () => restartRun(), PAL.red, true, 17);
  btn.position.set(120, 434);
  const menu = mkPageButton(t('toTitle'), 156, 54, () => backToTitle(), PAL.purple, false, 15);
  menu.position.set(300, 434);
  const leaderboardBtn = mkPageButton(t('leaderboard'), 320, 48, () => showLeaderboard(), PAL.yellow, false, 15);
  leaderboardBtn.position.set(W / 2, 501);
  ov.addChild(sub, place, btn, menu, leaderboardBtn);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function showResult(rank        , time        , isBest         , prev                                       , leaderboardResult                                      = null)       {
  setStandalonePage(true);
  clearOverlay();
  const ov = new Container();
  ov.addChild(makePageBase(PAL.yellow, PAL.heart));
  addPageHeader(ov, t('winTitle'), t('sub'), PAL.yellow);
  ov.addChild(makePagePanel(W / 2, 410, 320, 480, PAL.yellow, 24));
  const rankT = mkBrandText(rank, 84, rank === 'S' ? MENU_PAL.gold : rank === 'A' ? MENU_PAL.coral : MENU_PAL.teal);
  rankT.anchor.set(0.5);
  rankT.position.set(W / 2, 300);
  ov.addChild(rankT);
  const mm = Math.floor(time / 60);
  const ss = String(time % 60).padStart(2, '0');
  const lines = [
    t('rlTime').replace('{x}', `${mm}:${ss}`),
    t('rlCombo').replace('{x}', `${maxCombo}`),
    t('rlSundae').replace('{x}', `${rainbowCount}`),
    t('rlHp').replace('{x}', `${totalHp()}`),
  ];
  lines.forEach((l, i) => {
    const t = mkText(l, 18, PAL.brown);
    t.anchor.set(0.5);
    t.position.set(W / 2, 380 + i * 32);
    ov.addChild(t);
  });
  const recordText = isBest ? t('newBest') : prev ? t('best').replace('{r}', prev.rank).replace('{x}', `${Math.floor(prev.time / 60)}:${String(prev.time % 60).padStart(2, '0')}`) : '';
  const placeText = leaderboardResult?.position ? t('leaderboardPlace').replace('{x}', `${leaderboardResult.position}`) : '';
  const bestLine = mkText([recordText, placeText].filter(Boolean).join('  ·  '), 14.5, PAL.red);
  bestLine.anchor.set(0.5);
  bestLine.position.set(W / 2, 516);
  ov.addChild(bestLine);
  const btn = mkPageButton(t('again'), 152, 54, () => restartRun(), PAL.red, true, 17);
  btn.position.set(120, 566);
  const menu = mkPageButton(t('toTitle'), 152, 54, () => backToTitle(), PAL.purple, false, 15);
  menu.position.set(300, 566);
  const readyToEvolve = canAnyHeroEvolve();
  const evolve = mkPageButton(readyToEvolve ? t('evolutionReady') : t('evolutionTab'), 152, 50, () => {
    showEvolutionFromPage(() => showResult(rank, time, isBest, prev, leaderboardResult));
  }, PAL.yellow, readyToEvolve, 16);
  evolve.position.set(120, 630);
  const leaderboardBtn = mkPageButton(t('leaderboard'), 152, 50, () => showLeaderboard(), PAL.blue, false, 15);
  leaderboardBtn.position.set(300, 630);
  ov.addChild(btn, menu, evolve, leaderboardBtn);
  blockOverlay(ov);
  overlayLayer.addChild(ov);
  activeOverlay = ov;
}

function restartRun()       {
  setStandalonePage(false);
  clearOverlay();
  hideBubble();
  hp[0] = START_HP;
  hp[1] = START_HP;
  hp[2] = START_HP;
  hp[3] = START_HP;
  hp[4] = START_HP;
  timeSec = 0;
  maxCombo = 0;
  rainbowCount = 0;
  turnNo = 0;
  portraits.forEach((p) => {
    p.rotation = 0;
    p.alpha = 1;
  });
  board.reset(FIXED_BOARD);
  spawnFloor(0, true);
  updatePartyHud();
  statusText.text = t('statusDef');
  phase = PHASE.Idle;
}

// ---------- 帧循环 ----------
let glowT = 0;
let ambT = 0;
let wobT = 0;
let glT = 0;
let emberT = 0;
let lowerAmbT = 0;
function tick(dt        )       {
  if (phase !== PHASE.Title && phase !== PHASE.Over && !paused && !evolutionTabOpen && !standalonePageOpen) timeSec += dt;
  // 技能就绪星标跳动
  glowT += dt;
  if (menuHeroGroup && !menuHeroGroup.destroyed) {
    if (menuHeroFxLayer && !menuHeroFxLayer.destroyed) menuHeroFxLayer.alpha = menuHeroGroup.alpha;
    if (menuHeroIdleReady) {
      const breath = Math.sin(glowT * 1.32);
      menuHeroGroup.y = 375 + Math.sin(glowT * 1.18) * 0.7;
      menuHeroGroup.scale.set(
        menuHeroBaseScaleX * (1 + breath * 0.0018),
        menuHeroBaseScaleY * (1 - breath * 0.0012),
      );
      for (const actor of menuHeroActors) {
        if (!actor || actor.destroyed) continue;
        const motion = Math.sin(glowT * actor.idleSpeed + actor.idlePhase * Math.PI * 2);
        actor.x = actor.baseX + Math.sin(glowT * actor.idleSpeed * 0.52 + actor.idlePhase) * 0.45;
        actor.y = actor.baseY + motion * actor.idleAmp;
        actor.rotation = motion * actor.idleTilt;
        actor.scale.set(
          actor.baseScaleX * (1 + motion * 0.004),
          actor.baseScaleY * (1 - motion * 0.0025),
        );
      }
    }
    for (const item of menuHeroFx) {
      if (!item.g || item.g.destroyed) continue;
      const cycle = (glowT * item.speed + item.phase) % 1;
      const pulse = Math.sin(cycle * Math.PI);
      item.g.x = item.baseX + Math.sin(glowT * 1.45 + item.phase * 6) * item.drift;
      item.g.y = item.baseY - cycle * item.rise;
      item.g.alpha = item.maxAlpha * pulse * pulse;
      item.g.scale.set(0.72 + pulse * 0.42);
      item.g.rotation = glowT * item.spin + item.phase;
    }
  }
  for (let i = 0; i < 5; i++) {
    const portraitPulse = Math.sin(glowT * 1.85 + i * 0.72);
    portraits[i].scale.set(1);
    if (phase !== PHASE.Over) portraits[i].y = 14 + portraitPulse * 1.35;
    portraitAuras[i].alpha = 0.12 + (0.5 + 0.5 * portraitPulse) * 0.13;
    stageLabels[i].scale.set(1 + (evolutionStage(i) > 0 ? 0.055 : 0.025) * Math.sin(glowT * 2.7 + i));
    if (portraitStars[i].visible) {
      portraitStars[i].scale.set(portraitStarBase[i] * (1 + 0.2 * Math.sin(glowT * 6 + i)));
      portraitGlows[i].alpha = 0.6 + 0.4 * Math.sin(glowT * 4 + i);
    }
  }
  for (const b of lowerBokeh) {
    b.g.x = b.baseX + Math.sin(glowT * 0.72 + b.phase) * b.amp;
    b.g.y = b.baseY + Math.cos(glowT * 0.55 + b.phase) * b.amp;
    b.g.alpha = 0.045 + 0.075 * (0.5 + 0.5 * Math.sin(glowT * 1.05 + b.phase));
  }
  if (statusText) {
    const promptPulse = 0.5 + 0.5 * Math.sin(glowT * 2.25);
    statusText.alpha = 0.83 + promptPulse * 0.17;
    statusText.scale.set(1 + promptPulse * 0.012);
  }
  if (bottomGlowG) bottomGlowG.alpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(glowT * 1.8));
  for (let i = 0; i < bottomSparkles.length; i++) {
    const s = bottomSparkles[i];
    const wave = Math.max(0, Math.sin(glowT * 2.5 + s.phase));
    s.g.y = s.baseY - wave * 4;
    s.g.alpha = 0.15 + Math.pow(wave, 4) * 0.8;
    s.g.scale.set(0.65 + wave * 0.65);
    s.g.rotation = glowT * 0.28 + i * 0.2;
  }
  for (let i = 0; i < bottomLightDots.length; i++) {
    const dot = bottomLightDots[i];
    dot.x = 20 + ((glowT * (42 + i * 8) + i * 122) % (W - 40));
    dot.y = 758 + Math.sin(glowT * 2 + i * 1.7) * 4;
    dot.alpha = 0.38 + 0.5 * (0.5 + 0.5 * Math.sin(glowT * 3.2 + i));
  }
  if (evolutionTabButton) {
    const ready = canAnyHeroEvolve();
    const readyWave = 0.5 + 0.5 * Math.sin(glowT * 5.4);
    const pulse = ready ? 1 + 0.06 * readyWave : 1;
    evolutionTabButton.scale.set(pulse);
    evolutionTabButton.y = 782 - (ready ? readyWave * 1.5 : 0);
    if (evolutionReadyFx) {
      evolutionReadyFx.visible = ready;
      if (ready) {
        evolutionReadyFx.alpha = 0.58 + readyWave * 0.42;
        evolutionReadyFx.scale.set(0.97 + readyWave * 0.08);
        for (const sparkle of evolutionReadySparkles) {
          const sparkWave = 0.5 + 0.5 * Math.sin(glowT * 6.4 + sparkle.phase);
          sparkle.g.alpha = 0.22 + sparkWave * 0.78;
          sparkle.g.scale.set(0.65 + sparkWave * 0.75);
          sparkle.g.rotation = glowT * 0.8 + sparkle.phase;
        }
        if (evolutionReadyBadge) evolutionReadyBadge.scale.set(0.9 + readyWave * 0.22);
      }
    }
  }
  if (evolutionReadyNoticePending && phase === PHASE.Idle && !paused && !tutActive && !standalonePageOpen && !evolutionTabOpen && !activeOverlay) {
    showEvolutionReadyNotice();
  }
  // 环境光点
  ambT -= dt;
  if (ambT <= 0) {
    ambT = 0.55;
    spawnAmbient();
  }
  lowerAmbT -= dt;
  if (!paused && lowerAmbT <= 0) {
    lowerAmbT = 0.34;
    spawnLowerAmbient();
  }
  // 糖珠随机摇摆
  if (phase === PHASE.Idle && !paused) {
    wobT -= dt;
    if (wobT <= 0) {
      wobT = 0.9;
      board.wobbleRandom();
    }
  }
  // 釉面高光闪点
  glT -= dt;
  if (glT <= 0) {
    glT = 1.6;
    spawnGlint();
  }
  // 敌人动画
  for (const e of enemies) {
    if (!e.alive) continue;
    e.squashCd = Math.max(0, e.squashCd - dt);
    // 果冻待机：双频摆动 + 轻微浮沉（受击/攻击演出期间暂停）
    if (e.squashCd <= 0) {
      const ph = glowT * 2.6 + e.root.x * 0.7;
      const w1 = Math.sin(ph);
      const w2 = Math.sin(ph * 0.5 + 1);
      e.sprite.scale.set(e.baseSX * (1 + 0.028 * w1 + 0.012 * w2), e.baseSY * (1 - 0.028 * w1 + 0.01 * w2));
      e.sprite.y = -2.5 * Math.abs(Math.sin(ph * 0.5));
    }
    // 倒计时 1 持续心跳
    if (e.cd === 1) e.cdBadge.scale.set(1 + 0.1 * Math.sin(glowT * 8));
    // 减益泡泡漂浮
    if (e.bubbleSpr) {
      e.bubbleSpr.y = -e.cfg.h * 0.45 + Math.sin(glowT * 2.5) * 4;
      e.bubbleSpr.rotation = Math.sin(glowT * 1.8) * 0.06;
    }
    // Boss 怒后：颤动 + 红光脉动 + 焦糖火星
    if (e.cfg.boss && e.angry) {
      e.sprite.x = (Math.random() - 0.5) * 2;
      e.glowG.alpha = 0.16 + 0.1 * Math.sin(glowT * 5);
      emberT -= dt;
      if (emberT <= 0) {
        emberT = 0.35;
        spawnEmber(e);
      }
    }
  }
  // 气泡计时
  if (activeBubble && bubbleTimer > 0) {
    bubbleTimer -= dt;
    if (bubbleTimer <= 0) hideBubble();
  }
  tutHintTick();
  if (mapPulse && !mapPulse.destroyed) mapPulse.scale.set(1 + 0.08 * Math.sin(glowT * 6));
}

// ---------- 调试钩子（自测用） ----------
;               
                    
                        
                                      
   
 

boot().then(() => {
  window.__debug = {
    state: () => ({
      phase,
      paused,
      floorIndex,
      partyHp: totalHp(),
      hps: [...hp],
      timeSec: Math.round(timeSec),
      maxCombo,
      rainbowCount,
      evolutionExp,
      evolutionStages: [...partyStages],
      enemies: enemies.map((e) => ({ id: e.cfg.id, hp: e.hp, cd: e.cd, alive: e.alive, shieldUp: e.shieldUp, shieldColor: e.shieldColor, angry: e.angry, debuffHalf: e.debuffHalf })),
      board: board.getTypes(),
    }),
    cellClient: (r        , c        ) => {
      const p = board.cellCenter(r, c);
      const gp = board.container.toGlobal({ x: p.x, y: p.y });
      const rect = app.canvas.getBoundingClientRect();
      return { x: rect.left + gp.x * (rect.width / app.screen.width), y: rect.top + gp.y * (rect.height / app.screen.height) };
    },
    setBoard: (types            ) => board.setTypes(types),
    setTargetHp: (hp        ) => {
      const e = enemies[targetIdx];
      if (e) {
        e.hp = hp;
        refreshEnemyHud(e);
      }
    },
    setPartyHp: (v        ) => {
      hp[0] = v;
      hp[1] = v;
      hp[2] = v;
      hp[3] = v;
      hp[4] = v;
      updatePartyHud();
    },
    setMana: (v        ) => {
      hp[0] = v;
      hp[1] = v;
      hp[2] = v;
      hp[3] = v;
      hp[4] = v;
      updatePartyHud();
    },
    setXp: (_i        , v        ) => {
      evolutionExp = Math.max(0, Number(v) || 0);
      saveGrowthState();
      updatePartyHud();
    },
    setStage: (i        , v        ) => {
      if (i < 0 || i >= 5) return;
      partyStages[i] = Math.max(0, Math.min(2, Math.floor(Number(v) || 0)));
      saveGrowthState();
      updatePartyHud();
    },
    showEvolution: () => showEvolutionTab(phase === PHASE.Title ? 'title' : 'battle'),
    showLeaderboard: () => showLeaderboard(true),
    gotoFloor: (i        ) => spawnFloor(i, true),
    setTarget: (i        ) => {
      targetIdx = i;
      updateFocus();
    },
    pathLen: () => board.pathLength(),
    showBadge: (i        ) => {
      const b = badges[i];
      b.visible = true;
      b.position.set(210, 200);
      b.scale.set(1.4);
    },
    tut: () => tutActive,
    stars: (i        ) => starsOf(i),
    overlay: () => activeOverlay !== null,
    sfxVol: () => audio.getSfxVol(),
    holes: () => board.holes(),
    sealCount: () => board.sealCount(),
    sealedCells: () => board.sealedCells(),
    fxCount: () => fxLayer.children.length,
    lang: () => LANG,
  };
});
