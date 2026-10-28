export const NAME_TABLE = {
  horse:['周一不想上班','Monday Nope','月曜はお休み'],banana:['香蕉也有梦想','Banana Dreamer','夢見るバナナ'],ufo:['马力飞碟','Galloping UFO','かけあし UFO'],giraffe:['长颈鹿申请参赛','Definitely a Horse','たぶんお馬さん'],
  cloud:['云朵不刹车','Cloud No Brakes','止まらない雲'],noodle:['面条冲锋队','Noodle Rocket','爆走ヌードル'],coffee:['咖啡续命王','Espresso Express','エスプレッソ急行'],comet:['彗星慢半拍','Sleepy Comet','ねぼすけ彗星'],
  socks:['袜子跑丢了','Runaway Socks','逃げたくつした'],toast:['吐司有点飘','Flying Toast','空飛ぶトースト'],puddle:['水坑大侠','Puddle Jumper','水たまりヒーロー'],moon:['月亮来迟了','Late Moon','遅刻のお月さま'],
  jelly:['果冻不服输','Jelly Never Quits','ねばり強いゼリー'],pepper:['小辣椒快跑','Pepper Sprint','駆けろとうがらし'],pencil:['铅笔没写完','Pencil on the Run','走り書きえんぴつ'],wind:['追风小土豆','Windy Potato','風追いポテト'],
  slippers:['拖鞋闪电侠','Lightning Slippers','いなずまスリッパ'],rainbow:['彩虹绕远路','Rainbow Detour','虹のよりみち'],peach:['桃子逃跑计划','Peach Escape','ももの脱走計画'],desk:['桌子想放假','Desk on Vacation','休暇中のつくえ'],
  popcorn:['爆米花起飞','Popcorn Takeoff','ポップコーン離陸'],snail:['蜗牛涡轮增压','Turbo Snail','ターボかたつむり'],pancake:['煎饼追太阳','Sunny Pancake','おひさまパンケーキ'],sardine:['沙丁鱼冲刺','Sardine Sprint','いわしダッシュ']
};
// Stable append-only components keep saved random IDs valid across languages.
const MOODS=[
 ['打瞌睡的','Sleepy','ねむねむ'],['逆风的','Headwind','向かい風の'],['迷路的','Wandering','迷子の'],['倔强的','Stubborn','がんこな'],
 ['打嗝的','Hiccup','しゃっくり'],['会跳舞的','Dancing','踊る'],['放假的','Holiday','お休みの'],['偷懒的','Lazy','のんびり'],
 ['追月亮的','Moonchasing','月追い'],['踩水的','Puddle-Splashing','水遊びの'],['带闪电的','Lightning','いなずま'],['哼歌的','Humming','鼻歌の'],
 ['戴墨镜的','Shaded','サングラスの'],['刚睡醒的','Just-Awake','寝起きの'],['有梦想的','Dreaming','夢見る'],['不刹车的','No-Brakes','止まらない']
];
const DOODLES=[
 ['小年糕','Rice Cake','おもち'],['布丁','Pudding','プリン'],['棉花糖','Marshmallow','マシュマロ'],['饭团','Rice Ball','おにぎり'],
 ['小南瓜','Pumpkin','かぼちゃ'],['小蘑菇','Mushroom','きのこ'],['小橘子','Tangerine','みかん'],['小饼干','Cookie','クッキー'],
 ['小豆包','Bean Bun','あんまん'],['纸飞机','Paper Plane','紙飛行機'],['小水壶','Teapot','やかん'],['小枕头','Pillow','まくら'],
 ['小拖把','Mop','モップ'],['小铅笔盒','Pencil Case','筆箱'],['小橡皮','Eraser','消しゴム'],['小风筝','Kite','たこ']
];
for(let a=0;a<MOODS.length;a++)for(let b=0;b<DOODLES.length;b++){
 const m=MOODS[a],d=DOODLES[b];NAME_TABLE['mix'+a.toString(16)+b.toString(16)]=[m[0]+d[0],m[1]+' '+d[1],m[2]+d[2]];
}
export const PRESET_NAMES=['horse','banana','ufo','giraffe'];
export function localizedName(id,language){
  const row=NAME_TABLE[id],index=['zh','en','ja'].indexOf(language);
  if(!row||index<0)throw new Error(`Unknown name or language: ${id}/${language}`);return row[index];
}
export function randomNames(count,exclude=[],rng=Math.random){
  const candidates=Object.keys(NAME_TABLE).filter(id=>!exclude.includes(id));
  if(count>candidates.length)throw new Error('Not enough distinct names');
  const selected=[];for(let i=0;i<count;i++)selected.push(candidates.splice(Math.floor(rng()*candidates.length),1)[0]);return selected;
}
