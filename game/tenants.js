// Occupant profiles: one AI call per tenancy, with a deterministic offline fallback table.
                                            
import { fontStack, getLang } from "../i18n.js";

                                                      

export const POOLS                                                   = {

  student: {
    ja: { names: ["佐藤 悠真", "鈴木 ひなた", "高橋 蓮", "田中 みなみ", "伊藤 大輝", "渡辺 彩", "山本 蒼", "中村 結衣", "小林 陸", "加藤 美月", "吉田 陽翔", "山田 咲", "佐々木 湊", "松本 葵", "井上 樹", "木村 花", "林 大和", "清水 凛", "山口 颯", "森 芽依", "池田 悠", "橋本 心春", "石川 岳", "前田 千尋"],
      comments: ["大学が近いので", "家賃が安いので決めました", "静かで勉強できそうです", "友達が近くに住んでいます", "一人暮らしは初めてです"] },
    zh: { names: ["佐藤 悠真", "铃木 日向", "高桥 莲", "田中 南", "伊藤 大辉", "渡边 彩", "山本 苍", "中村 结衣", "小林 陆", "加藤 美月", "吉田 阳翔", "山田 咲", "佐佐木 凑", "松本 葵", "井上 树", "木村 花", "林 大和", "清水 凛", "山口 飒", "森 芽依", "池田 悠", "桥本 心春", "石川 岳", "前田 千寻"],
      comments: ["离大学近", "房租便宜就定了", "这里安静，能好好学习", "朋友就住在附近", "第一次一个人住"] },
    en: { names: ["Yuma Sato", "Hinata Suzuki", "Ren Takahashi", "Minami Tanaka", "Daiki Ito", "Aya Watanabe", "Aoi Yamamoto", "Yui Nakamura", "Riku Kobayashi", "Mizuki Kato", "Haruto Yoshida", "Saki Yamada", "Minato Sasaki", "Aoi Matsumoto", "Itsuki Inoue", "Hana Kimura", "Yamato Hayashi", "Rin Shimizu", "Hayate Yamaguchi", "Mei Mori", "Yu Ikeda", "Koharu Hashimoto", "Gaku Ishikawa", "Chihiro Maeda"],
      comments: ["Close to my university", "The rent is cheap", "Quiet enough to study", "My friends live nearby", "My first place alone"] },
  },
  office: {
    ja: { names: ["青木 健太", "新井 沙織", "遠藤 拓海", "大野 由紀", "岡田 翔", "小川 理恵", "柏木 直人", "川口 真央", "菊地 亮", "工藤 彩花", "黒田 剛", "佐野 千夏", "篠原 涼", "菅原 麻衣", "関 雄大", "園田 綾", "田村 駿", "土屋 有希", "中野 智也", "西村 琴音", "根本 渉", "長谷川 遥", "藤井 俊介", "古川 菜摘"],
      comments: ["職場まで20分なので", "エアコンがあるのが決め手", "夜遅いので静かな部屋を", "在宅もできる広さがいい", "駅から近くて助かります"] },
    zh: { names: ["青木 健太", "新井 沙织", "远藤 拓海", "大野 由纪", "冈田 翔", "小川 理惠", "柏木 直人", "川口 真央", "菊地 亮", "工藤 彩花", "黑田 刚", "佐野 千夏", "筱原 凉", "菅原 麻衣", "关 雄大", "园田 绫", "田村 骏", "土屋 有希", "中野 智也", "西村 琴音", "根本 涉", "长谷川 遥", "藤井 俊介", "古川 菜摘"],
      comments: ["离公司20分钟", "有空调是决定因素", "下班晚，想要安静的房间", "能在家办公的宽度刚好", "离车站近很方便"] },
    en: { names: ["Kenta Aoki", "Saori Arai", "Takumi Endo", "Yuki Ono", "Sho Okada", "Rie Ogawa", "Naoto Kashiwagi", "Mao Kawaguchi", "Ryo Kikuchi", "Ayaka Kudo", "Go Kuroda", "Chinatsu Sano", "Ryo Shinohara", "Mai Sugawara", "Yudai Seki", "Aya Sonoda", "Shun Tamura", "Yuki Tsuchiya", "Tomoya Nakano", "Kotone Nishimura", "Wataru Nemoto", "Haruka Hasegawa", "Shunsuke Fujii", "Natsumi Furukawa"],
      comments: ["20 minutes from work", "The air conditioner settled it", "I work late, so quiet matters", "Big enough to work from home", "So close to the station"] },
  },
  couple: {
    ja: { names: ["石井 亮太・石井 真由", "大塚 直樹・大塚 香織", "小野寺 悠・小野寺 沙耶", "片山 修平・片山 恵", "木下 拓也・木下 由香", "久保田 匠・久保田 麻里", "小島 涼介・小島 亜美", "斎藤 貴之・斎藤 千尋", "坂本 雄一・坂本 彩香", "柴田 晃・柴田 美穂", "鈴木 健・鈴木 春香", "高木 智基・高木 奈々", "竹内 涼太・竹内 優子", "谷口 大輔・谷口 沙織", "中島 翔太・中島 絵里", "中山 渉・中山 由美", "西田 拓真・西田 千夏", "野口 健司・野口 真理", "橋本 亮・橋本 綾乃", "平野 翔・平野 美月", "藤原 大樹・藤原 咲子", "松田 優作・松田 麻衣", "三浦 亮太・三浦 佳奈", "村上 拓海・村上 由紀"],
      comments: ["二人で住める広さがいい", "追い焚きが付いているので", "共働きなので駅近が助かる", "料理が趣味なのでキッチン重視", "ペットはいません、静かに暮らします"] },
    zh: { names: ["石井 亮太・石井 真由", "大冢 直树・大冢 香织", "小野寺 悠・小野寺 沙耶", "片山 修平・片山 惠", "木下 拓也・木下 由香", "久保田 匠・久保田 麻里", "小岛 凉介・小岛 亚美", "斋藤 贵之・斋藤 千寻", "坂本 雄一・坂本 彩香", "柴田 晃・柴田 美穗", "铃木 健・铃木 春香", "高木 智基・高木 奈奈", "竹内 凉太・竹内 优子", "谷口 大辅・谷口 沙织", "中岛 翔太・中岛 绘里", "中山 涉・中山 由美", "西田 拓真・西田 千夏", "野口 健司・野口 真理", "桥本 亮・桥本 绫乃", "平野 翔・平野 美月", "藤原 大树・藤原 咲子", "松田 优作・松田 麻衣", "三浦 亮太・三浦 佳奈", "村上 拓海・村上 由纪"],
      comments: ["想要两个人住得下的宽度", "因为有追焚功能", "双职工，离车站近很省事", "爱好做饭，看重厨房", "没有宠物，会安静生活"] },
    en: { names: ["Ryota & Mayu Ishii", "Naoki & Kaori Otsuka", "Yu & Saya Onodera", "Shuhei & Megumi Katayama", "Takuya & Yuka Kinoshita", "Takumi & Mari Kubota", "Ryosuke & Ami Kojima", "Takayuki & Chihiro Saito", "Yuichi & Ayaka Sakamoto", "Akira & Miho Shibata", "Ken & Haruka Suzuki", "Tomoki & Nana Takagi", "Ryota & Yuko Takeuchi", "Daisuke & Saori Taniguchi", "Shota & Eri Nakajima", "Wataru & Yumi Nakayama", "Takuma & Chinatsu Nishida", "Kenji & Mari Noguchi", "Ryo & Ayano Hashimoto", "Sho & Mizuki Hirano", "Daiki & Sakiko Fujiwara", "Yusaku & Mai Matsuda", "Ryota & Kana Miura", "Takumi & Yuki Murakami"],
      comments: ["Room for the two of us", "The reheat bath did it", "We both work, so the station matters", "We cook a lot, so the kitchen", "No pets, and we are quiet"] },
  },
  doctor: {
    ja: { names: ["相川 智之", "赤坂 由香", "安藤 直樹", "飯田 沙耶", "井川 亮介", "上田 千尋", "江口 真一", "大木 麻衣", "岡本 達也", "加納 有希", "岸本 涼子", "栗原 健", "小泉 綾乃", "斉木 智也", "坂口 美帆", "清水 亮", "菅野 由紀", "関口 大輔", "高梨 沙織", "塚本 悠", "鳥居 千夏", "永井 亮太", "西川 由香里", "野田 智弘"],
      comments: ["当直明けに静かに眠りたい", "設備が整っていて安心", "病院まで歩ける距離なので", "家賃より住み心地を優先", "研究があるので書斎が欲しい"] },
    zh: { names: ["相川 智之", "赤坂 由香", "安藤 直树", "饭田 沙耶", "井川 亮介", "上田 千寻", "江口 真一", "大木 麻衣", "冈本 达也", "加纳 有希", "岸本 凉子", "栗原 健", "小泉 绫乃", "齐木 智也", "坂口 美帆", "清水 亮", "菅野 由纪", "关口 大辅", "高梨 沙织", "冢本 悠", "鸟居 千夏", "永井 亮太", "西川 由香里", "野田 智弘"],
      comments: ["值完夜班想安静睡一觉", "设施齐全让人放心", "走路就能到医院", "比起房租更看重住得舒服", "要写论文，想要一间书房"] },
    en: { names: ["Tomoyuki Aikawa", "Yuka Akasaka", "Naoki Ando", "Saya Iida", "Ryosuke Igawa", "Chihiro Ueda", "Shinichi Eguchi", "Mai Oki", "Tatsuya Okamoto", "Yuki Kano", "Ryoko Kishimoto", "Ken Kurihara", "Ayano Koizumi", "Tomoya Saiki", "Miho Sakaguchi", "Ryo Shimizu", "Yuki Kanno", "Daisuke Sekiguchi", "Saori Takanashi", "Yu Tsukamoto", "Chinatsu Torii", "Ryota Nagai", "Yukari Nishikawa", "Tomohiro Noda"],
      comments: ["I need quiet after night shifts", "Good fittings put my mind at ease", "I can walk to the hospital", "Comfort over rent", "I need a study for my research"] },
  },
  gamer: {
    ja: { names: ["音羽 湊","雨宮 律","九条 ひかり","三上 蒼","瀬川 ねむ","日向 灯","東雲 ゲン","椎名 るか","綾辻 ミオ","黒川 迅","白瀬 あさ","七海 ゆず","篠宮 れい","遠野 ネル","朝倉 ソラ","夜久 ちさ","月島 かける","寝子 まどか","犬飼 タケル","猫屋敷 ゆい","星川 ガク","霧島 ノア","天野 レン","宮瀬 ピコ"],
      comments: ["配信部屋にちょうどいい","ネットが速いと聞きました","防音がしっかりしていて助かる","夜型なので静かな部屋を","作業机が置ける広さで"] },
    zh: { names: ["音羽 凑","雨宫 律","九条 光","三上 苍","濑川 眠","日向 灯","东云 玄","椎名 露卡","绫辻 澪","黑川 迅","白濑 朝","七海 柚","筱宫 玲","远野 奈露","朝仓 空","夜久 千纱","月岛 翔","寝子 圆","犬饲 武","猫屋敷 结","星川 岳","雾岛 诺亚","天野 莲","宫濑 皮可"],
      comments: ["正好当直播房间","听说网速很快","隔音好，很安心","夜猫子，想要安静的房间","放得下工作台的大小"] },
    en: { names: ["Minato Otowa","Ritsu Amamiya","Hikari Kujo","Aoi Mikami","Nemu Segawa","Akari Hyuga","Gen Shinonome","Ruka Shiina","Mio Ayatsuji","Jin Kurokawa","Asa Shirasé","Yuzu Nanami","Rei Shinomiya","Neru Tono","Sora Asakura","Chisa Yakuku","Kakeru Tsukishima","Madoka Neko","Takeru Inukai","Yui Nekoyashiki","Gaku Hoshikawa","Noa Kirishima","Ren Amano","Piko Miyase"],
      comments: ["Perfect room for streaming","I heard the internet is fast","The soundproofing helps","I'm a night owl, so quiet please","Big enough for my desk"] },
  },
  retiree: {
    ja: { names: ["田辺 千代","小谷 キミ","野中 静江","真鍋 とし子","岩佐 春子","大和田 文","内海 さと","堀 ハル","松永 千枝","富田 幸子","森下 ふみ","北村 佳代","谷 君子","小柳 和子","白井 サチ","土田 芳江","八木 スミ","牟田 千代子","岩崎 民子","赤松 悦子","尾崎 すみれ","福田 はるみ","服部 澄江","三宅 とよ"],
      comments: ["日当たりがよくて安心","静かなので長く住めそうです","階段が少ないと助かります","自治会の方に勧められて","長く暮らせる部屋を探していました"] },
    zh: { names: ["田边 千代","小谷 喜美","野中 静江","真锅 敏子","岩佐 春子","大和田 文","内海 里","堀 春","松永 千枝","富田 幸子","森下 文","北村 佳代","谷 君子","小柳 和子","白井 幸","土田 芳江","八木 澄","牟田 千代子","岩崎 民子","赤松 悦子","尾崎 堇","福田 春美","服部 澄江","三宅 丰"],
      comments: ["采光好，安心","安静，可以长住","楼梯少就太好了","被居委会的人推荐来的","一直在找能长住的房间"] },
    en: { names: ["Chiyo Tanabe","Kimi Kotani","Shizue Nonaka","Toshiko Manabe","Haruko Iwasa","Aya Owada","Sato Utsumi","Haru Hori","Chie Matsunaga","Sachiko Tomita","Fumi Morishita","Kayo Kitamura","Kimiko Tani","Kazuko Koyanagi","Sachi Shirai","Yoshie Tsuchida","Sumi Yagi","Chiyoko Muta","Tamiko Iwasaki","Etsuko Akamatsu","Sumire Ozaki","Harumi Fukuda","Sumie Hattori","Toyo Miyake"],
      comments: ["Good light and safe","Quiet enough to stay for years","Fewer stairs would help","The neighbourhood association recommended it","I wanted a place to settle for good"] },
  },
  artist: {
    ja: { names: ["藤城 しおり","鏑木 蓮","水原 かなえ","一色 創","硯 ユイ","灰谷 ススム","絵馬 ちなつ","漆原 イサム","紙谷 ふみ","宇野 マコ","風間 レイ","土筆 える","胡桃 ケイ","藍原 シン","陶山 みなも","紫藤 アオ","砂田 カイ","白土 ひなた","絵門 トワ","筆山 すず"],
      comments: ["北向きの光が制作に向く","壁に大きな絵を掛けたい","作業に集中できる静けさ","近くに画材店があるので","家で制作できる部屋を"] },
    zh: { names: ["藤城 栞","镝木 莲","水原 佳苗","一色 创","砚 结衣","灰谷 进","绘马 千夏","漆原 勇","纸谷 文","宇野 真子","风间 玲","土笔 爱留","胡桃 圭","蓝原 新","陶山 水音","紫藤 葵","砂田 海","白土 日向","绘门 永久","笔山 铃"],
      comments: ["朝北的光适合创作","想把大画挂在墙上","安静，能专心创作","附近有画材店","想要能在家创作的房间"] },
    en: { names: ["Shiori Fujishiro","Ren Kaburagi","Kanae Mizuhara","Sou Isshiki","Yui Suzuri","Susumu Haitani","Chinatsu Ema","Isamu Urushihara","Fumi Kamitani","Mako Uno","Rei Kazama","Eru Tsukushi","Kei Kurumi","Shin Aihara","Minamo Suyama","Ao Shito","Kai Sunada","Hinata Shirato","Towa Emon","Suzu Fudeyama"],
      comments: ["North light suits my work","I want a wall for a big canvas","Quiet enough to concentrate","The art shop is close","A room where I can work at home"] },
  },
  family: {
    ja: { names: ["小暮 麻衣・小暮 はると","三好 千夏・三好 ゆう","永田 沙織・永田 いつき","飯塚 美咲・飯塚 けん","浦野 由佳・浦野 あさひ","古賀 奈々・古賀 そうた","真田 恵・真田 みなと","細川 真理・細川 つむぎ","浅野 あや・浅野 りく","大谷 真由・大谷 かなた","川瀬 友里・川瀬 はる","森川 千尋・森川 ゆづ","早瀬 繭・早瀬 あお","北川 玲奈・北川 いつは","新田 美和・新田 そら","津田 沙耶・津田 かんな"],
      comments: ["子どもが小学校に近い","公園がそばで助かります","家族で暮らせる広さを","安全な環境を優先したい","子どもが静かでよく眠れます"] },
    zh: { names: ["小暮 麻衣・小暮 阳斗","三好 千夏・三好 悠","永田 沙织・永田 树","饭冢 美咲・饭冢 健","浦野 由佳・浦野 朝日","古贺 奈奈・古贺 壮太","真田 惠・真田 港","细川 真理・细川 紬","浅野 绫・浅野 陆","大谷 真由・大谷 彼方","川濑 友里・川濑 春","森川 千寻・森川 结","早濑 茧・早濑 碧","北川 玲奈・北川 一叶","新田 美和・新田 空","津田 沙耶・津田 环奈"],
      comments: ["孩子上学近","旁边就是公园，很方便","想要一家人住得下的宽度","优先考虑安全的环境","孩子睡得很安稳"] },
    en: { names: ["Mai & Haruto Kogure","Chinatsu & Yu Miyoshi","Saori & Itsuki Nagata","Misaki & Ken Iizuka","Yuka & Asahi Uranaka","Nana & Sota Koga","Megumi & Minato Sanada","Mari & Tsumugi Hosokawa","Aya & Riku Asano","Mayu & Kanata Otani","Yuri & Haru Kawase","Chihiro & Yuzu Morikawa","Mayu & Ao Hayase","Rena & Itsuha Kitagawa","Miwa & Sora Nitta","Saya & Kanna Tsuda"],
      comments: ["The primary school is close","A park right nearby","Room for the family","Safety comes first for us","Our kid sleeps well here"] },
  },
  chef: {
    ja: { names: ["高峰 匠","板倉 誠","味沢 浩","村井 昌也","大河内 薫","三津田 満","宮下 健","水谷 慎","加賀 由紀","野村 武","須藤 浩二","梶原 涼","市川 哲","厨川 明","佐竹 悟","炭谷 吾郎","柚木 君江","鉄井 玲","一ノ宮 健太","椀田 春"],
      comments: ["深夜に帰るので静かな部屋","厨房の匂いを逃がしたい","近所の商店街が便利","休日に料理を試したい","仕込みができる台所を"] },
    zh: { names: ["高峰 匠","板仓 诚","味泽 浩","村井 昌也","大河内 薰","三津田 满","宫下 健","水谷 慎","加贺 由纪","野村 武","须藤 浩二","梶原 凉","市川 哲","厨川 明","佐竹 悟","炭谷 吾郎","柚木 君江","铁井 玲","一之宫 健太","椀田 春"],
      comments: ["深夜回家，想要安静","想把厨房的味道排出去","附近的商店街很方便","休息日想试做菜","想有个能备菜的厨房"] },
    en: { names: ["Takumi Takamine","Makoto Itakura","Hiroshi Ajisawa","Masaya Murai","Kaoru Okochi","Mitsuru Mitsuda","Ken Miyashita","Shin Mizutani","Yuki Kaga","Takeru Nomura","Koji Sudo","Ryo Kajiwara","Tetsu Ichikawa","Akira Kuriyagawa","Satoru Satake","Goro Sumitani","Kimie Yunoki","Rei Tetsui","Kenta Ichinomiya","Haru Wanda"],
      comments: ["I'm home late, so quiet","I want to vent kitchen smells","The shopping street is handy","I test dishes on days off","A kitchen for prep work"] },
  },
  athlete: {
    ja: { names: ["早川 涼真","桐谷 颯","赤羽 美那","陸奥 健二","速水 悠","球田 慎","青山 碧","箱崎 亮","飛田 翔","鉄村 圭","隼田 隼人","神崎 仁","剛田 豪","剣持 美沙","岩城 正","卓間 凛","弓削 菖蒲","空閑 空","体那 奈々","海野 魁"],
      comments: ["トレーニング後に静かに休みたい","駅近でジムに通いやすい","しっかり眠れる環境を","遠征が多く長期不在です","食事を作れる台所が欲しい"] },
    zh: { names: ["早川 凉真","桐谷 飒","赤羽 美那","陆奥 健二","速水 悠","球田 慎","青山 碧","箱崎 亮","飞田 翔","铁村 圭","隼田 隼人","神崎 仁","刚田 豪","剑持 美沙","岩城 正","卓间 凛","弓削 菖蒲","空闲 空","体那 奈奈","海野 魁"],
      comments: ["训练后想安静休息","离车站近，方便去健身房","想要睡得好的环境","常外出集训，长期不在","想要能做饭的厨房"] },
    en: { names: ["Ryoma Hayakawa","Sou Kiritani","Mina Akabane","Kenji Mutsu","Yu Hayami","Shin Tamada","Ao Aoyama","Ryo Hakozaki","Sho Tobita","Kei Tetsumura","Hayato Hayata","Jin Kanzaki","Go Goda","Misa Kenmochi","Tadashi Iwaki","Rin Takuma","Ayame Yuge","Sora Kuga","Nana Taina","Kai Unno"],
      comments: ["I need quiet after training","Close to the station and gym","A place to really sleep","I travel to competitions often","I want a kitchen to cook in"] },
  },
  ceo: {
    ja: { names: ["御堂 一郎","神野 清","藤枝 誠一","大隈 宗一郎","鷹山 修","蔵前 洋介","白洲 健三","宮内 鉄也","会津 龍之介","水城 隼人","平城 京介","戸田 兼人","黒田 正典","朝比奈 長治","本郷 忠彦","榊 康平","井上 直樹","真柴 昌弘","上村 景一","直井 兼吾"],
      comments: ["海外出張が多いので戸締まり重視","最上階の静けさを希望","秘書が送り迎えをします","来客があるので警備を","長期で借りたい"] },
    zh: { names: ["御堂 一郎","神野 清","藤枝 诚一","大隈 宗一郎","鹰山 修","藏前 洋介","白洲 健三","宫内 铁也","会津 龙之介","水城 隼人","平城 京介","户田 兼人","黑田 正典","朝比奈 长治","本乡 忠彦","榊 康平","井上 直树","真柴 昌弘","上村 景一","直井 兼吾"],
      comments: ["常出差海外，看重门锁安全","希望住最高层，图个安静","秘书会接送","常有客人来访，要安保","想长期租住"] },
    en: { names: ["Ichiro Mido","Kiyoshi Jinno","Seiichi Fujieda","Soichiro Okuma","Osamu Takayama","Yosuke Kuramae","Kenzo Shirasu","Tetsuya Miyauchi","Ryunosuke Aizu","Hayato Mizuki","Kyosuke Hirajo","Kaneto Toda","Masanori Kuroda","Nagaharu Asahina","Tadahiko Hongo","Kohei Sakaki","Naoki Inoue","Masahiro Mashiba","Keiichi Uemura","Kengo Naoi"],
      comments: ["I travel a lot, so security matters","I want the quiet of a top floor","My assistant drives me","I have guests, so security","I want a long lease"] },
  },
  celebrity: {
    ja: { names: ["綾瀬 ひかる", "一ノ瀬 蓮", "宇佐美 蘭", "大路 湊", "神楽坂 玲", "桐生 遥", "黒崎 蓮司", "小鳥遊 美咲", "桜庭 悠", "三条 あかり", "白河 累", "神宮寺 藍", "高峰 澪", "橘 蒼真", "月城 かなで", "東雲 玲奈", "氷室 律", "藤堂 美羽", "夏目 蓮華", "西園寺 環", "羽鳥 樹", "冬木 彩", "星野 灯", "真壁 湊"],
      comments: ["防音と設備は譲れません", "警備がしっかりした部屋を", "ここなら落ち着けそうです", "仕事の合間に仮眠したい", "静かな住民の方ばかりで安心"] },
    zh: { names: ["绫濑 光", "一之濑 莲", "宇佐美 兰", "大路 凑", "神乐坂 玲", "桐生 遥", "黑崎 莲司", "小鸟游 美咲", "樱庭 悠", "三条 明里", "白河 累", "神宫寺 蓝", "高峰 澪", "橘 苍真", "月城 奏", "东云 玲奈", "冰室 律", "藤堂 美羽", "夏目 莲华", "西园寺 环", "羽鸟 树", "冬木 彩", "星野 灯", "真壁 凑"],
      comments: ["隔音和设施不能让步", "想要安保完善的房间", "这里应该能静下来", "工作间隙想小睡一会", "邻居都很安静，放心"] },
    en: { names: ["Hikaru Ayase", "Ren Ichinose", "Ran Usami", "Minato Oji", "Rei Kagurazaka", "Haruka Kiryu", "Renji Kurosaki", "Misaki Kotori", "Yu Sakuraba", "Akari Sanjo", "Rui Shirakawa", "Ai Jinguji", "Mio Takamine", "Soma Tachibana", "Kanade Tsukishiro", "Rena Shinonome", "Ritsu Himuro", "Miu Todo", "Renka Natsume", "Tamaki Saionji", "Itsuki Hatori", "Aya Fuyuki", "Akari Hoshino", "Minato Makabe"],
      comments: ["Soundproofing is non-negotiable", "I need a secure building", "This one feels calm", "I nap between jobs", "Quiet neighbours put me at ease"] },
  },
};


const NEW_POOLS_PART1                                                   = {
  freeter: {
    ja: { names: ["岩本 啓太","皆川 真琴","香取 陸","郡山 あかり","道場防火墙?","二階堂 海里","石橋 風太","早乙女 純","広野 辰哉","薄 ゆな"],
      comments: ["バイトが近いので","学費を貯めつつ一人暮らし","シフトが不規則でも静かな部屋を","実家を出てきたばかり","家賃の安さが決め手です"] },
    zh: { names: ["岩本 启太","皆川 真琴","香取 陆","郡山 明里","西园 悠","二阶堂 海里","石桥 风太","早乙女 纯","广野 辰哉","薄 由奈"],
      comments: ["打工就在附近","边攒学费边独居","排班不规律，需要安静的房间","刚从家里搬出来","房租便宜是重点"] },
    en: { names: ["Keita Iwamoto","Makoto Minikawa","Riku Katori","Akari Koriyama","Yu Nishizono","Kairi Nikaido","Futa Ishibashi","Jun Saotome","Tatsuya Hirono","Yuna Usuki"],
      comments: ["My shifts are just around the corner","Saving tuition while living alone","Odd shifts, so peace and quiet, please","Just moved out from my parents","The cheap rent sealed it"] },
  },
  cosplayer: {
    ja: { names: ["栗栖 小夜","月見里 煌","西條 ましろ","早苗 つばさ","花屋 いろは","白雪 ルナ","夕張 風歌","一富士 あん","天羽 エリカ","理世 ねの"],
      comments: ["衣装作りに広い床が欲しい","撮影は週末だけです","近くのイベントに通える","段ボールが置ける広さを","布を広げる床面積が必要"] },
    zh: { names: ["栗栖 小夜","月见里 煌","西条 真白","早苗 翼","花屋 彩","白雪 露娜","夕张 风歌","一富士 安","天羽 绘里香","理世 宁音"],
      comments: ["想要能做衣服的地板空间","只在周末拍照","能跑附近的展会","要放得下纸箱的大小","需要摊开布料"] },
    en: { names: ["Sayo Kurisu","Kou Tsukimisato","Mashiro Saijo","Tsubasa Sanae","Iroha Hanaya","Luna Shirayuki","Fuka Yubari","An Ichifuji","Erika Amou","Neno Riyo"],
      comments: ["I need floor space for sewing costumes","Photo shoots are weekends only","Conventions nearby","Room for my boxes","Must fit a big bolt of fabric"] },
  },
  manga: {
    ja: { names: ["硯 かなえ","速筆 岳","西村 ひより","坂内 修斗","本江 あゆみ","筧 すず","久野 真澄","緒形 颯真","岸 千絵","榊 礼人"],
      comments: ["締切は部屋で乗り切ります","北向きの光が作画に向く","同人通販の段ボールが置ける","集中できる静けさを","原稿の置き場が欲しい"] },
    zh: { names: ["砚 佳苗","速笔 岳","西村 日和","坂内 修斗","本江 步美","筧 铃","久野 真澄","绪形 飒真","岸 千绘","榊 礼人"],
      comments: ["截稿就在房里拼","朝北的光适合作画","要放得下同人纸箱","安静，能专心","想要放原稿的地方"] },
    en: { names: ["Kanae Suzuri","Gaku Sappitsu","Hiyori Nishimura","Shuto Saka'uchi","Ayumi Hon'e","Suzu Kakehi","Masumi Kuno","Soma Ogata","Chie Kishi","Reito Sakaki"],
      comments: ["I hit deadlines from my desk","North light is good for ink","My doujin boxes need a corner","Quiet to concentrate","A place to keep originals"] },
  },
  novelist: {
    ja: { names: ["文園 俊輔","巷 智代","畷 一葉","榊原 小鳥","羽地 理穂","柳河 栞","三塚 芳正","鹿島 深雪","紙野 慧","窪木 文菜"],
      comments: ["カフェ替わりの窓辺を使います","静かな町屋で書きたい","図書館が近いので","夜作家なので昼寝ができる部屋を","キーボード音がうるさくないよう気を遣います"] },
    zh: { names: ["文园 俊辅","巷 智代","畷 一叶","榊原 小鸟","羽地 理穗","柳河 栞","三塚 芳正","鹿岛 深雪","纸野 慧","窪木 文菜"],
      comments: ["把窗边当咖啡馆用","想在安静的街道写作","图书馆很近","夜间写作，要能白天补觉","打字会轻一点"] },
    en: { names: ["Shunsuke Fumizono","Tomoyo Chimata","Ichiyou Nemori","Kotori Sakakibara","Riho Haji","Shiori Yanagawa","Yoshimasa Mitsuka","Miyuki Kashima","Kei Kamino","Fumina Kuboki"],
      comments: ["I'll write by the bay window","I wanted a quiet neighbourhood","The library is close","I write nights and nap days","I'll keep the typing down"] },
  },
  poet: {
    ja: { names: ["歌川 盈","咲良 梢","卯月 そよ","登勢 詩緒","汀 夏帆","枕 るみ","時雨 藍子","未央 詩穂","千早 凍月","遠望 ひかり"],
      comments: ["窓から空が見える部屋を","詩を作る静けさが欲しい","古書店が多い町だと聞いて","雨音が好き"] },
    zh: { names: ["歌川 盈","咲良 梢","卯月 蕭","登势 诗绪","汀 夏帆","枕 留美","时雨 蓝子","未央 诗穗","千早 冻月","远望 光"],
      comments: ["要一间看得见天空的房间","想要写诗的安静","听说附近旧书店很多","喜欢听下雨的声音"] },
    en: { names: ["Mitsuru Utagawa","Kozue Sakura","Soyo Uzuki","Shio Tose","Natsumi Migiwa","Rumi Makura","Aiko Shigure","Shiho Mio","Toduki Chihaya","Hikari Enbou"],
      comments: ["A window with some sky","Quiet enough to write verse","Lots of old bookshops nearby","I like the sound of rain"] },
  },
  delivery: {
    ja: { names: ["走村 丈","運部 隼","宅良 一貴","配川 亮","道上 真紀","轍 優斗","駒田 慶","輪久 敦","疾走 翔平","荷田 大智"],
      comments: ["配達センターが近いので","長距離の日は早く寝ます","保冷バッグが置ける玄関を","感謝する一定のルートです","雨でも稼げます"] },
    zh: { names: ["走村 丈","运部 隼","宅良 一贵","配川 亮","道上 真纪","辙 优斗","驹田 庆","轮久 敦","疾走 翔平","荷田 大智"],
      comments: ["站点就在附近","跑远路的日子会早睡","门口得放得下保温箱","熟了这条路线","下雨天也赚钱"] },
    en: { names: ["Joe Hashirimura","Hayate Unbu","Kazuki Takura","Ryo Haikawa","Maki Michiue","Yuto Wadachi","Kei Komada","Atsushi Waku","Shohei Shimbusi","Daichi Hasuda"],
      comments: ["The depot is around the corner","Early nights after the long route","The entrance holds my cold bag","I know this beat by heart","Even rainy days pay"] },
  },
  monk: {
    ja: { names: ["蓮桐 了空","円光 祐心","善松 悟淳","和正 観悟","月耕 徳明","覚明 宗賢","柳蓮 慶人","慈法 賢治","大宮 澄覚","本光 静照"],
      comments: ["勤行は静かに行います","檀家さんが近くに多いので","菜食の調理台がそれなりに","川が聞こえると助かります","持ち物は小さく済みます"] },
    zh: { names: ["莲桐 了空","圆光 祐心","善松 悟淳","和正 觀悟","月耕 德明","觉明 宗贤","柳莲 庆人","慈法 贤治","大宫 澄觉","本光 静照"],
      comments: ["早晚功课会安静地做","信众有很多住在附近","素菜厨房差不多就行","能听见河声最好","行李不多"] },
    en: { names: ["Ryoku Renttou","Yushin Enko","Sotojun Zenmatsu","Kango Yoshimasa","Noriaki Tsukiko","Soken Kakumei","Keito Yanagiren","Kenji Jiho","Shoukaku Omiya","Seisho Honkou"],
      comments: ["My chants are quiet","Many parishioners live nearby","A small vegetarian kitchen is enough","The river sounds nice","I travel light"] },
  },
  hairdresser: {
    ja: { names: ["髪崎 美那","櫛田 凛花","染原 あやか","推子 結衣","巻島 美咲","平間 環奈","鏡野 ちなつ","灯理 ひな","藍野 詩奈","彩理 りこ"],
      comments: ["サロンまで自転車5分","仕事道具を置ける棚を","休日は食材に困らない","近所に仲間が多い","鏡置き場があれば助かります"] },
    zh: { names: ["发崎 美那","栉田 凛花","染原 彩花","推子 结衣","卷岛 美咲","平间 环奈","镜野 千夏","灯理 日南","蓝野 诗奈","彩理 莉子"],
      comments: ["五站路骑车到店里","要个摆工具的架子","休息天不愁买菜","同行邻居很多","有放镜子的角落就好"] },
    en: { names: ["Mina Kamizaki","Rinka Kushida","Ayaka Somehara","Yui Oshiko","Misaki Makishima","Kana Hirama","Chinatsu Kagami","Hina Tomori","Shina Aino","Riko Sairi"],
      comments: ["The salon is five minutes by bike","A shelf for my kit","Groceries on my day off","Plenty of fellow stylists around","A corner for my mirror"] },
  },
  driver: {
    ja: { names: ["運高 進","車川 正敏","行橋 陽一","乗田 好雄","峰打 静治","坂東 忠","遠乗 恒","回転 鈴香","燈火 武志","街野 清司"],
      comments: ["車庫が向かいなので","夜勤帰りの仮眠用に","乗客の帰り道を安全に","TAXアプリで小遣い稼ぎ","待機場が近い"] },
    zh: { names: ["运高 进","车川 正敏","行桥 阳一","乘田 好雄","峰打 静治","坂东 忠","远乘 恒","回转 铃香","灯火 武志","街野 清司"],
      comments: ["车场就在对面","夜班回来能补个觉","把乘客安全送回家","用打车软件挣点外快","候客点很近"] },
    en: { names: ["Susumu Untaka","Masatoshi Kagawa","Yoichi Yukibashi","Yoshio Norita","Shizuji Mineuchi","Tadashi Bando","Tsune Tooe","Suzuka Kaiten","Takeshi Tomihi","Seiji Machino"],
      comments: ["The garage is opposite","I nap after night shifts","Safe rides home for everyone","App work on the side","The rank is up the road"] },
  },
  teacher: {
    ja: { names: ["教室 直紀","黒部 詩織","白土 学","板書 理恵","紘野 京子","千田 克己","柳浦 恭平","百瀬 美紀","授 かおる","米山 真一"],
      comments: ["塾も学校も近いので","丸つけは静かに済ませます","先生ぶらずに暮らしたい","読書が趣味です","放課後は編み物が癒し"] },
    zh: { names: ["教室 直纪","黑部 诗织","白土 学","板书 理惠","紘野 京子","千田 克己","柳浦 恭平","百濑 美纪","授 香","米山 真一"],
      comments: ["学校和补习社都近","批改作业会很安静","想住得不端着","爱好读书","放学之后针织最治愈"] },
    en: { names: ["Naoki Kyoshitsu","Shiori Kurebe","Manabu Shirato","Rie Itasho","Kyoko Hirono","Katsumi Senda","Kyohei Yaguchi","Miki Momose","Kaoru Kudari","Shinichi Yoneyama"],
      comments: ["School and the cram school are close","I grade quietly","I like to leave the teacher act at work","Reading is my pastime","Knitting after school is my therapy"] },
  },
  miko: {
    ja: { names: ["吉乃 うた","楪 あさぎ","桐島 環","花三編?","玉依 ようこ","白藤 柰々","美里 ことり","朝日奈 舞","清川 琴葉","巫安 ひより"],
      comments: ["神社まで歩いて参れます","舞の稽古は外でします","静かな朝が好きです","冠婚葬祭は戸締まりして来ます","神棚が置ける壁を"] },
    zh: { names: ["吉乃 歌","楪 朝音","楪 冬","大山 环","花三 织","玉依 悠子","白藤 奈柰","美里 琴","朝日奈 舞","清川 琴叶","巫安 日和"],
      comments: ["走路就能到神社","练舞会到室外去","喜欢安静的清晨","红白事出门会锁好门","想要一面能放神龛的墙"] },
    en: { names: ["Uta Yoshino","Asagi Yuzuriha","Tamaki Kirishima","Ori Hanami","Yoko Tamayori","Nana Shirafuji","Kotori Misato","Mai Asahina","Kotoha Kiyokawa","Hiyori Miyayasu"],
      comments: ["I can walk to the shrine","Dance practice is outside","Quiet mornings are my favourite","I lock up tight for rites","A wall for a little altar"] },
  },
  nurse: {
    ja: { names: ["白衣 央","薬師堂 燈","看取 いろは","水瓶 みわ","静注 杏","莉佳 涼花","美晴 由乃","凪葉 杏奈","雨麻 志保","桐野 結那"],
      comments: ["夜勤明けは昼間寝ます","救急車が近いと安心","洗濯場が乾きやすいと","携帯は常にミュート","白いもの多いです"] },
    zh: { names: ["白衣 央","药师堂 灯","看取 彩","水瓶 美和","静注 杏","莉佳 凉花","美晴 由乃","凪叶 杏奈","雨麻 志保","桐野 结那"],
      comments: ["夜班之后白天睡","离急救中心近比较安心","希望速干的洗衣环境","手机常年静音","白色东西很多"] },
    en: { names: ["Ou Hakui","Akari Yakushido","Iroha Katori","Miwa Suibin","An Shizuchu","Ryoka Rika","Yuno Miharu","Anna Nagaha","Shiho Uma","Yuna Kirino"],
      comments: ["I sleep days after nights","Close to the ER is reassuring","Laundry needs to dry fast","My phone is always on mute","Lots of white laundry"] },
  },
  reporter: {
    ja: { names: ["記久 剛","藤門 紗季","速報 駿","新聞 佳乃","騒矢 玲","坂垣 弦","丹内 尊","街郎 寛司","頭条 健","里誉 哲"],
      comments: ["新聞社の自転車圏内で","夜取材も多いので安全な場所を","ノート PC の置き場を","出典は守ります","自宅原稿も多い"] },
    zh: { names: ["记久 刚","藤门 纱季","速报 骏","新闻 佳乃","骚矢 玲","坂垣 弦","丹内 尊","街郎 宽司","头条 健","里誉 哲"],
      comments: ["报社骑车就到","夜间采访多，要个安全的地方","要个放笔记本的位置","消息源会保护好","在家写稿的日子很多"] },
    en: { names: ["Tsuyoshi Kiyu","Saki Fujimon","Shun Sokubo","Kano Shinbun","Rei Soya","Gen Sakagaki","Son Tannai","Kanji Machiro","Ken Zuto","Tetsu Sato"],
      comments: ["I bike to the paper","Nice security for late-night work","Space for my laptop","I protect my sources","I write from home a lot"] },
  },
  dancer: {
    ja: { names: ["舞扇 葵","踏倉 麗","純愛 りな","拍間 茉央","飛泉 華","梢野 伶菜","夏紀 かな","一音 李瑚","鏡宮 麻耶","動羽 詩南"],
      comments: ["レッスンに抜群の位置です","部屋では開脚残したい","床材料 ‧ 傷つけません","発表会前は静かに","足の置き場が広いほうがいい"] },
    zh: { names: ["舞扇 葵","踏仓 丽","纯爱 丽娜","拍间 茉央","飞泉 华","梢野 伶菜","夏纪 加奈","一音 李瑚","镜宫 麻耶","动羽 诗南"],
      comments: ["上舞蹈课位置绝佳","想在家也练基本功","不会伤害地板","演出前想安静","脚步空间大一点更好"] },
    en: { names: ["Aoi Mairo","Rei Fumikura","Rina Junai","Mao Hakuma","Hana Tobisen","Reina Kozono","Kana Natsuki","Riko Ichion","Maya Kagamiya","Shina Douha"],
      comments: ["Perfect spot for lessons","I stretch daily at home","Gentle on floors","Quiet before a recital","More floor room suits me"] },
  },
  constable: {
    ja: { names: ["捕部 厳","安武 翼","巡野 徹","固田 正","半田 賢治","守月 之助","柏台 宗治","津守 一","交番 晴人","正方 想"],
      comments: ["交番が近いので","市民を守る住まいを","制服の置き場が重要","目立つ制服で安心を","夜遅く帰る日も多い"] },
    zh: { names: ["捕部 严","安武 翼","巡野 彻","固田 正","半田 贤治","守月 之助","柏台 宗治","津守 一","交番 晴人","正方 想"],
      comments: ["岗亭就在附近","住处要能守护市民","制服要挂得整齐","制服醒目，大家安心","经常晚归"] },
    en: { names: ["Gen Toribe","Tsubasa Yasutake","Tetsu Megurino","Tadashi Katata","Kenji Handa","Shinosuke Moritsuki","Sohji Kashiwadai","Hajime Tsumori","Haruto Koban","So Sekikata"],
      comments: ["The koban is close","Home should keep people safe too","A tidy spot for the uniform","The uniform itself reassures the block","Lots of late nights"] },
  },
  baker: {
    ja: { names: ["麦田 豊","粉星 もちこ","焼走 一斗","麦良 千穂","酵母 廿紀","香田 さん","宵飯 香乃","麦原 英輔","麦山 美穂","中粉 拓実"],
      comments: ["朝が早いので静かな環境を","店が目と鼻の先で助かる","家でも焼きたい","パンの匂いがする部屋は諦めます"] },
    zh: { names: ["麦田 丰","粉星 饼子","烧走 一斗","麦良 千穗","酵母 廿纪","香田 桑","宵饭 香乃","麦原 英辅","麦山 美穗","中粉 拓实"],
      comments: ["起得早，需要安静","面包店就在视线内，真省心","在家也想烤","屋里会不会有面包味就算了"] },
    en: { names: ["Yutaka Mugita","Mochiko Konaboshi","Itto Yakibashi","Chiho Mugura","Niki Kobo","San Koda","Kano Yoimeshi","Eisuke Mugihara","Miho Mugiyama","Takumi Nakako"],
      comments: ["Early mornings need quiet","The bakery is right there","Home bakes too","The bread smell is on the house"] },
  },
  photographer: {
    ja: { names: ["写琉 迅","露本 冴子","光端 麻紀","現鷹 翔","撮田 恵司","近江 一樹","霞空 真幌","兜橋 千夏","望遠 晶子","捕野 晴香"],
      comments: ["暗室は不要、気楽に撮る","スタジオが近いので","レンズ乾燥庫を置きたい","遠征が多い","窓光をいっぱい欲しい"] },
    zh: { names: ["写琉 迅","露本 冴子","光端 麻纪","现鹰 翔","摄田 惠司","近江 一树","霞空 真幌","兜桥 千夏","望远 晶子","捕野 晴香"],
      comments: ["不需要暗房，轻松取景","工作室就在附近","想有个放镜头干燥箱的角落","常出差","窗光越多越好"] },
    en: { names: ["Jin Sharuru","Saeko Tsukumoto","Maki Kobata","Sho Utekida","Keiji Satsuta","Kazuki Omi","Mahi Kasora","Chinatsu Kabutobashi","Akiko Boen","Haruka Torino"],
      comments: ["No darkroom, carefree shots","The studio is near","A dry box for lenses","Travel for work","All the window light I can get"] },
  },
  singer: {
    ja: { names: ["歌羽 真琴","音原 玲奈","澄子 暁","汀那奈","美嶺 あいみ","琴念 せな","尺八 翠","廻潮 陽向","竿灯 ひまり","和音 ひより"],
      comments: ["発声練習は深夜にしません","ライブハウスへ近い","録音できる場所を","歌手の休息所として","声つぶれない静けさを"] },
    zh: { names: ["歌羽 真琴","音原 玲奈","澄子 晓","汀 那奈","美岭 爱未","琴念 世奈","尺八 翠","廻潮 阳向","竿灯 向日葵","和音 日和"],
      comments: ["深夜不练声","离Livehouse很近","需要一个能录音的角落","当作歌手的休养所","要护嗓，安静优先"] },
    en: { names: ["Makoto Utaboku","Rena Otobara","Akaki Sumiko","Nana Migiwa","Aimi Minei","Sena Kotone","Sui Shakuhachi","Hinata Kaishio","Himari Kantou","Hiyori Wakone"],
      comments: ["No belting after midnight","The live house is close","A corner for recording","A place to rest my voice","Quiet protects my instrument"] },
  },
};
Object.assign(POOLS, NEW_POOLS_PART1                                                        );

/** One generic pool of adult names per language; per-kind pools below only override the comment set. */
const NAMES                                       = {
  ja: [
    "佐藤 悠真", "鈴木 ひなた", "高橋 蓮", "田中 みなみ", "伊藤 大輝", "渡辺 彩", "山本 蒼", "中村 結衣",
    "小林 陸", "加藤 美月", "吉田 陽翔", "山田 咲", "佐々木 湊", "松本 葵", "井上 樹", "木村 花",
    "林 大和", "清水 凛", "山口 颯", "森 芽依", "池田 悠", "橋本 心春", "石川 岳", "前田 千尋",
    "青木 健太", "新井 沙織", "遠藤 拓海", "大野 由紀", "岡田 翔", "小川 理恵", "柏木 直人", "川口 真央",
    "菊地 亮", "工藤 彩花", "黒田 剛", "佐野 千夏", "篠原 涼", "菅原 麻衣", "関 雄大", "園田 綾",
    "田村 駿", "土屋 有希", "中野 智也", "西村 琴音", "根本 渉", "長谷川 遥", "藤井 俊介", "古川 菜摘",
    "綾瀬 ひかる", "北大路 遙", "三浦 優子", "福井 誠", "原田 環", "三好 拓斗", "渋谷 涼太", "白川 朱音",
    "高柳 誠二", "稲葉 燈", "上杉 四季", "野田 健司", "冨田 智弘", "武内 陽子", "根室 直樹", "戸部 潤",
    "川村 裕太", "今井 舞香", "有馬 剛", "尾崎 美和", "柏崎 陽介", "石黒 陽太", "広瀬 茜", "洼地 健",
    "野呂 美沙子", "安河内 豊", "雨宮 純一", "真下 菜摘", "新谷 亮", "田沼 雅人", "愛甲 環奈", "白根 慎也",
  ],
  zh: [
    "佐藤 悠真", "铃木 日向", "高桥 莲", "田中 南", "伊藤 大辉", "渡边 彩", "山本 苍", "中村 结衣",
    "小林 陆", "加藤 美月", "吉田 阳翔", "山田 咲", "佐佐木 凑", "松本 葵", "井上 树", "木村 花",
    "林 大和", "清水 凛", "山口 飒", "森 芽依", "池田 悠", "桥本 心春", "石川 岳", "前田 千寻",
    "青木 健太", "新井 沙织", "远藤 拓海", "大野 由纪", "冈田 翔", "小川 理惠", "柏木 直人", "川口 真央",
    "菊地 亮", "工藤 彩花", "黑田 刚", "佐野 千夏", "筱原 凉", "菅原 麻衣", "关 雄大", "园田 绫",
    "田村 骏", "土屋 有希", "中野 智也", "西村 琴音", "根本 涉", "长谷川 遥", "藤井 俊介", "古川 菜摘",
    "绫濑 光", "北大路 遥", "三浦 优子", "福井 诚", "原田 环", "三好 拓斗", "涩谷 凉太", "白川 朱音",
    "高柳 诚二", "稻叶 灯", "上杉 四季", "野田 健司", "富田 智弘", "武内 阳子", "根室 直树", "户部 润",
    "川村 裕太", "今井 舞香", "有马 刚", "尾崎 美和", "柏崎 阳介", "石黑 阳太", "广濑 茜", "洼地 健",
    "野吕 美沙子", "安河内 丰", "雨宫 纯一", "真下 菜摘", "新谷 亮", "田沼 雅人", "爱甲 环奈", "白根 慎也",
  ],
  en: [
    "Yuma Sato", "Hinata Suzuki", "Ren Takahashi", "Minami Tanaka", "Daiki Ito", "Aya Watanabe", "Aoi Yamamoto", "Yui Nakamura",
    "Riku Kobayashi", "Mizuki Kato", "Haruto Yoshida", "Saki Yamada", "Minato Sasaki", "Aoi Matsumoto", "Itsuki Inoue", "Hana Kimura",
    "Yamato Hayashi", "Rin Shimizu", "Hayate Yamaguchi", "Mei Mori", "Yu Ikeda", "Koharu Hashimoto", "Gaku Ishikawa", "Chihiro Maeda",
    "Kenta Aoki", "Saori Arai", "Takumi Endo", "Yuki Ono", "Sho Okada", "Rie Ogawa", "Naoto Kashiwagi", "Mao Kawaguchi",
    "Ryo Kikuchi", "Ayaka Kudo", "Go Kuroda", "Chinatsu Sano", "Ryo Shinohara", "Mai Sugawara", "Yudai Seki", "Aya Sonoda",
    "Shun Tamura", "Yuki Tsuchiya", "Tomoya Nakano", "Kotone Nishimura", "Wataru Nemoto", "Haruka Hasegawa", "Shunsuke Fujii", "Natsumi Furukawa",
    "Hikaru Ayase", "Haruka Kitano", "Yuko Miura", "Makoto Fukui", "Tamaki Harada", "Takuto Miyoshi", "Ryota Shibuya", "Akane Shirakawa",
    "Seiji Takayanagi", "Akari Inaba", "Shiki Uesugi", "Kenji Noda", "Tomohiro Tomita", "Yoko Takeuchi", "Naoki Nemuro", "Jun Tobe",
    "Yuta Kawamura", "Maika Imai", "Go Arima", "Miwa Ozaki", "Yosuke Kashiwasaki", "Yota Ishiguro", "Akane Hirose", "Ken Kubochi",
    "Misako Noro", "Yutaka Agochi", "Junichi Amamiya", "Natsumi Mashita", "Ryo Aratani", "Masato Tanuma", "Kanna Aigou", "Shinya Shirane",
  ],
};

const COMMENTS                                                       = {
  freeter: {
    ja: ["バイトが近いので", "学費を貯めつつ一人暮らし", "シフトが不規則でも静かな部屋を", "実家を出たばかり", "家賃の安さが決め手です"],
    zh: ["打工就在附近", "边攒学费边独居", "排班不规律，需要安静", "刚从家里搬出来", "房租便宜是关键"],
    en: ["Work's just around the corner", "Saving for tuition while living alone", "Odd shifts, so quiet matters", "Just moved out from my parents", "Cheap rent did it"],
  },
  cosplayer: {
    ja: ["衣装作りに広い床が欲しい", "撮影は週末だけ", "近くのイベントに行きやすい", "段ボールが置ける広さを", "布を広げられる床が必要"],
    zh: ["要能做衣服的地板空间", "只有周末拍照", "去附近展会方便", "要放得下纸箱", "需要摊开布料"],
    en: ["Need floor space for sewing", "Photo shoots are weekends only", "Conventions nearby", "Room for my boxes", "Must fit fabric bolts"],
  },
  manga: {
    ja: ["締切は部屋で乗り切ります", "北向きの光が作画に向く", "同人誌の段ボールが置ける", "集中できる静けさ", "原稿を置く場所が欲しい"],
    zh: ["截稿就在房里拼", "朝北的光适合作画", "要放得下同人纸箱", "安静，能专心", "想有地方放原稿"],
    en: ["Deadlines happen at my desk", "North light is ideal to ink", "Somewhere for my doujin boxes", "Quiet to concentrate", "A place for originals"],
  },
  novelist: {
    ja: ["窓辺がカフェ代わり", "静かな町屋で書きたい", "図書館が近い", "夜に書くので昼寝できる部屋を", "キー音を静かにします"],
    zh: ["把窗边当咖啡馆", "想在安静的街道写作", "图书馆很近", "夜里写，要能白天补觉", "我会轻点打字"],
    en: ["The window seat is my café", "Quiet streets to write", "Library close", "I write nights and nap days", "I'll keep the typing soft"],
  },
  poet: {
    ja: ["空が見える窓辺を", "詩を書く静けさを", "古書店が近くてうれしい", "雨音が好き"],
    zh: ["要看得见天空的窗", "想要写诗的安静", "附近旧书店很多，太好了", "喜欢听雨声"],
    en: ["A window with some sky", "Quiet enough to write verse", "Old bookshops nearby", "I like the sound of rain"],
  },
  delivery: {
    ja: ["配達センターが近い", "長距離の日は早く寝ます", "保冷バッグが置ける玄関を", "この道程を覚えた", "雨でも仕事はある"],
    zh: ["站点附近", "跑远路会早睡", "门口要放得下保温箱", "这条路线我熟了", "雨天照样有钱赚"],
    en: ["The depot is nearby", "Early nights after long routes", "Somewhere for the cold bag", "I know this route by heart", "Rain still pays"],
  },
  monk: {
    ja: ["檀家さんが近くに多いので", "勤行は静かに行います", "菜食だけの小さな台所で","川の音が聞ける", "荷物は少なく"],
    zh: ["信众很多住在附近", "早晚功课会很安静", "素菜厨房就足够", "想听河水的声音", "行李少"],
    en: ["Parishioners live nearby", "I'll chant quietly", "A small vegetarian kitchen is enough", "I like to hear the river", "Light luggage"],
  },
  hairdresser: {
    ja: ["サロンには自転車で5分", "道具の棚が欲しい", "休日は料理をするのが楽しみ", "同業の仲間が近くにいる", "大きな鏡の置き場があれば"],
    zh: ["骑车五分钟到店里", "要摆工具的架子", "休息天喜欢自己做饭", "同行邻居很多", "有地方放大镜子就好"],
    en: ["The salon is five minutes by bike", "A shelf for my kit", "I cook on days off", "Fellow stylists around", "A spot for a big mirror"],
  },
  driver: {
    ja: ["車庫が目の前なので", "夜勤明けに仮眠したい", "乗客の帰り道を安全に", "アプリの配車で小遣い稼ぎ", "待機場が近い"],
    zh: ["车场就在对面", "夜班回来想眯一会", "把乘客安全送回家", "打车软件上挣点外快", "候客点近"],
    en: ["The garage is opposite", "Naps after night shifts", "Safe rides home for everyone", "App income on the side", "The taxi rank is close"],
  },
  teacher: {
    ja: ["学校も塾も近いので", "採点は静かにします", "先生は職場の役割", "読書が趣味", "放課後は編み物が癒し"],
    zh: ["学校和补习社都近", "批改会很安静", "学校只是工作", "爱好读书", "放学后的针织是治愈"],
    en: ["School and the cram school are close", "I grade quietly", "Teacher is just the day job", "Reading is my hobby", "Knitting after school"],
  },
  miko: {
    ja: ["神社まで歩けます", "舞の稽古は屋外で", "静かな朝が好き", "冠婚葬祭の参列も多い", "神棚が置ける壁を"],
    zh: ["走路就到神社", "练舞会到室外", "喜欢安静的清晨", "红白事也常去", "想要一面能放神龛的墙"],
    en: ["I can walk to the shrine", "Dance practice is outside", "I love quiet mornings", "Many ceremonies to attend", "A wall for a small altar"],
  },
  nurse: {
    ja: ["夜勤明けは昼間寝ます", "救急車が近いと安心", "洗濯が乾きやすい場所が欲しい", "携帯は常にミュート", "白い洗濯物が多い"],
    zh: ["夜班之后白天睡", "急救点近就安心", "希望洗衣容易干", "手机不外放", "白色衣物多"],
    en: ["Days off after nights", "Near the ER feels safer", "Laundry needs to dry fast", "My phone is always muted", "Lots of white laundry"],
  },
  reporter: {
    ja: ["新聞社へ自転車で", "夜の取材も多いので安全な場所を", "ノートPCの置き場を", "取材源は守ります", "自宅原稿も多い"],
    zh: ["骑车到报社", "夜间采访多，要安全的地方", "要个放笔记本的地方", "消息源我会保护好", "在家写稿的日子很多"],
    en: ["I bike to the paper", "Late-night scoops, so safety matters", "A spot for my laptop", "I protect my sources", "I write from home a lot"],
  },
  dancer: {
    ja: ["レッスン場が抜群の位置", "家でもストレッチを続けます", "床は傷つけません", "発表会直前は静かに", "足の広げられるスペースが欲しい"],
    zh: ["舞蹈课位置绝佳", "家里也坚持拉伸", "不会伤到地板", "演出前想安静", "想有能放开脚步的空间"],
    en: ["Perfect location for lessons", "I stretch at home too", "I'll respect the floor", "Quiet before the recital", "Space to open my stride"],
  },
  constable: {
    ja: ["交番が近くて安心", "市民の安心を守る家として", "制服の掛け場が大切", "制服を見ると住民が安心", "夜が遅い日も多い"],
    zh: ["岗亭就在附近", "把住处当市民的安全岛", "制服要有个挂的地方", "制服显眼，安宁", "常要很晚才回"],
    en: ["The koban is close, reassuring", "Home base for community safety", "A rack for my uniform matters", "The uniform reassures the block", "Lots of late shifts"],
  },
  baker: {
    ja: ["朝が早いので静かな環境を", "店が目と鼻の先", "家でもパンを焼きたい", "お菓子な住民も多そうで期待"],
    zh: ["起得早，需要安静", "店就在视线内", "在家也想烤面包", "这里会是爱吃面包的邻居吧"],
    en: ["Early mornings need quiet", "The bakery is right there", "I bake at home too", "Hopeful for bread-loving neighbours"],
  },
  photographer: {
    ja: ["スタジオが近いので", "乾燥箱の置き場が大切", "遠征が多い時期あり", "窓光を浴びたい", "機材が多いので棚多めで"],
    zh: ["工作室就在附近", "干燥箱要有位置", "有时一连好多天出差", "想要大窗光", "器材多，需要很多架子"],
    en: ["The studio is close", "A dry box for the lenses", "Travel seasons are long", "Lots of window light please", "I own lots of gear"],
  },
  singer: {
    ja: ["深夜の発声は控えます", "ライブハウスへ近い", "録音コーナーがほしい", "声の静養に最適な静けさを", "喉のケアが一番"],
    zh: ["深夜不练声", "离Livehouse很近", "想要个录音角", "最适合静养声音的安静", "护嗓是最要紧的"],
    en: ["No belting past midnight", "The live house is close", "A recording nook please", "Silence to rest my voice", "Vocal care first"],
  },
  model: {
    ja: ["スタジオまでチャリで", "全身鏡の置き場を", "撮影前夜は早寝", "雑誌の読者でもあります"],
    zh: ["骑车到棚里", "需要全身镜的位置", "拍摄前一晚会早睡", "我也爱看杂志"],
    en: ["Studio is a bike ride", "Need a full-length mirror", "Early to bed before shoots", "I read the magazines too"],
  },
  sommelier: {
    ja: ["レストランまで徒歩8分", "温度管理にこだわります", "仕入れの先が近店多い", "休息日は茶道に通います"],
    zh: ["走八分钟到餐厅", "严守温度管理", "供货点也近", "休日去学茶道"],
    en: ["An 8-minute walk to the restaurant", "Temperature control matters to me", "Suppliers are nearby", "Tea ceremony on days off"],
  },
  carpenter: {
    ja: ["仕事場には歩いて通えます", "道具は3本の箱に収まる", "木香りが好き", "夜作業は静かに"],
    zh: ["走路去工地", "工具就三只箱", "喜欢木香", "夜里干活要保证安静"],
    en: ["Walk to the jobsite", "My tools fit in three boxes", "I love the smell of fresh sawdust", "Night work stays quiet"],
  },
  comedian: {
    ja: ["劇場が近いので", "ネタ帳を静かに書きます", "明るい住人が増えるといい", "ボケの研究中です"],
    zh: ["剧场离得近", "写段子会很安静", "邻居欢笑一点也好", "还在研究吐槽"],
    en: ["The theatre's near", "I write bits quietly", "Cheerful neighbours welcome", "Refining my punchlines"],
  },
  lawyer: {
    ja: ["裁判所の隣で助かる", "書類の置き場をたくさん", "夜は朗らかなビールで", "正義と静けさを"],
    zh: ["法院就在隔壁", "需要很多放文件的地方", "晚上小酌怡情", "正义与安静一样重要"],
    en: ["Court next door helps", "Room for thick binders", "Friendly beer after work", "Justice and silence"],
  },
  pilot: {
    ja: ["空港へは鉄道で一本", "搭乗前夜は早寝", "荷物が小さめの住人", "世界各地へします"],
    zh: ["机场一条铁路直达", "值机前夜早睡", "住家轻装的房客", "常常飞世界各地"],
    en: ["Airport is one ride away", "Early to bed before flights", "A light-living tenant", "Flying everywhere"],
  },
  doctor: {
    ja: ["当直明けに静かに眠りたい", "設備が整っていて安心", "病院まで歩ける距離", "家賃より住み心地", "研究のため書斎が欲しい"],
    zh: ["值完夜班想安静睡", "设施齐全就安心", "可以步行到医院", "比房租更看重住得舒服", "写论文，想要书房"],
    en: ["I need quiet after night shifts", "Good fittings ease my mind", "I can walk to the hospital", "Comfort over rent", "I want a study for research"],
  },
  vet: {
    ja: ["動物病院へ通勤", "緊急呼出は即対応します", "毛のつくものに寛容", "安心できる住人"],
    zh: ["通勤到兽医院", "紧急召唤随叫随到", "对带毛的东西宽容", "令人放心的住户"],
    en: ["Commute to the clinic", "Emergency calls answered fast", "Friendly to furry things", "A reassuring tenant"],
  },
  violinist: {
    ja: ["ホール通いが多い", "朝日が大好き", "練習は弱音器で", "弓のスタンドがほしい"],
    zh: ["常跑音乐厅", "最爱晨间阳光", "练琴都用弱音器", "想要放弓的架子"],
    en: ["Often at the hall", "Morning light is the best", "All practice muted", "A stand for my bow"],
  },
  captain: {
    ja: ["出航で月一列島不在の月も", "陸にいる時は静かに暮らす", "水辺の見える窓の良さ", "風向きを気にする"],
    zh: ["出海常有整月不在", "靠岸时安静住", "能看得见水的窗户最好", "总盯着风向"],
    en: ["At sea for whole months", "Quiet when ashore", "A window with water in view", "Always checking the wind"],
  },
  architect: {
    ja: ["設計事務所が近い", "好みの造作が多く無理", "図面確認は外で", "曲線整理が必要な職業"],
    zh: ["设计事务所就在近边", "好看的墙面很多", "核图出门做", "需要整理曲线的工作"],
    en: ["Studio is nearby", "Pickier than most about interiors", "I mark up drawings outside", "My work cares for the curved line"],
  },
  jeweler: {
    ja: ["展示場は宝石通りの近く", "ライトの手配はうまくやります", "収集家の目線が近い", "のびのびとした部屋"],
    zh: ["展场就在宝石街附近", "灯光管理我会弄得很专业", "收藏爱好者一枚", "想要通风透气一点的房间"],
    en: ["Showroom is a stone's throw from gem street", "I look after my displays well", "A collector's eye lives here", "A breezy flat suits me best"],
  },
  racer: {
    ja: ["サーキット当番で通勤", "レースに賭けています", "ヘルメットの置き場が広く", "良い休息は形を変えます"],
    zh: ["把赛场当通勤地", "把自己押在比赛上", "头盔需要大的安放处", "好好休息，状态调回来"],
    en: ["Commute is the circuit", "Racing is my whole life", "A big rack for the helmet", "Rest reshapes everything"],
  },
  seiyuu: {
    ja: ["スタジオ近く楽で発声の日", "のど保養は静けさを一番に", "朝問健声の連習", "住人には静けさを重点をください"],
    zh: ["录音棚近啊好舒服", "护嗓第一是安静", "清晨做嗓音练习", "住处请多安静一点"],
    en: ["Studio near the niche", "Voice rest is priority one", "I sing scales at dawn", "Please keep the building hushed"],
  },
  director: {
    ja: ["撮影現場への動きが多い", "静読は黙々と", "監督の研究に最適", "家具は小さめで"],
    zh: ["经常赶往拍摄现场", "默默地读剧本", "导演研习的最适环境", "家具布托大就能住"],
    en: ["Always on the move to sets", "I soak theatre scripts in quiet", "Best place for director research", "Compact furniture, charming light"],
  },
  dev: {
    ja: ["リモート端末会が多い", "なぜ三台並べたいモニター", "夜に静かにコードを書きます", "ほんとコードの日が多い"],
    zh: ["远程班多", "要摆三台电脑", "夜里安安静静敲代码", "大部分日子都在写代码"],
    en: ["Mostly remote colleagues", "Three monitors side by side", "Coding quietly after dark", "Most days are pure code"],
  },
  astronaut: {
    ja: ["訓練センターへ直行で", "地球の休息日を楽しむ", "書依との量は多く", "屋上広眺めが好き"],
    zh: ["基地直达好走", "地球的休息日也想慢下来", "书籍和壁画都不少", "就爱开阔的楼顶"],
    en: ["Training base, direct line", "I savor the Earth days", "Lots of books and charts", "Love a wide rooftop view"],
  },
  baseballer: {
    ja: ["試合が終わるとすぐ寝る", "練習道具は何かの箱に全部収納", "子供に覚えられる選手になれました", "打率の変動を気にします"],
    zh: ["比赛一结束就睡觉", "训练器材全部收纳", "开始有小朋友认识我了", "按数据过每一天"],
    en: ["Nap as soon as games end", "Training gear all stored away", "The local kids recognize me", "Living by the numbers"],
  },
  hotelier: {
    ja: ["ホテル運営で留守が多く", "庭の見える部屋が好き", "来客が多い人だけど", "部屋は常に整えます"],
    zh: ["忙着管理旅馆", "喜欢看得见庭院的房间", "常有宾客来访", "房间总是打理得整齐"],
    en: ["Busy managing the hotel", "A room with a garden view", "I host many guests", "Rooms always stay tidy"],
  },
  tycoon: {
    ja: ["多くの投資を動いています", "秘書と事務は外です", "高級な部屋は楽です", "面会事は外部で"],
    zh: ["后边投资很多条线路", "秘书处理在外", "住高级住处最舒适", "见面都安排在外"],
    en: ["Many open ventures", "Secretaries and offices elsewhere", "The suite life is easy here", "Meetings away from home"],
  },
  judge: {
    ja: ["権威は静かに重ねます", "論文集を読む時が多い", "公私は区別を守っています", "伝統睡覚します"],
    zh: ["住处里威信安静检查逐一", "很多时间用来看案件卷宗", "公堂和家庭分得很清楚", "场合保持严肃"],
    en: ["A quiet place for a quiet hand", "Many case files to read this week", "The bench stays at court", "Lights out at ten"],
  },
};

// build POOLS: keep every existing kind-specific name set; other kinds get the shared NAMES + their comments
const ALL_KINDS           = Object.keys(COMMENTS);
for (const kind of ALL_KINDS) {
  const entry = COMMENTS[kind];
  (POOLS                                                    )[kind] ??= { ja: { names: NAMES.ja, comments: entry.ja }, zh: { names: NAMES.zh, comments: entry.zh }, en: { names: NAMES.en, comments: entry.en } };
}

/** Deterministic profile — used instantly on move-in and whenever the AI is unavailable. */
export function fallbackProfile(kind            , seed        , lang         )                                    {
  const l = (lang ?? getLang())                      ;
  const pool = (POOLS[kind] ?? POOLS.student)[l] ?? POOLS[kind].ja;
  const n = pool.names.length, c = pool.comments.length;
  const i = ((seed % n) + n) % n;
  const j = (((seed * 7 + 3) % c) + c) % c;
  return { name: pool.names[i], comment: pool.comments[j] };
}

const LANG_NAME                         = { ja: "Japanese", zh: "Simplified Chinese", en: "English" };

/** One AI call per tenancy. Never blocks the move-in; resolves to null on any failure. */
export async function requestProfile(kind            , kindLabel        , roomNo        , lv        , timeoutMs = 4000)                                                    {
  const lang = getLang();
  if (!window.gp?.ai) return null;
  const system =
    "あなたは日本の賃貸住宅の入居者プロフィールを作るアシスタントです。" +
    `出力は必ず次の1行のJSONのみ: {"name":"氏名","comment":"一言"}` +
    `\n・name は日本の成人の氏名（姓と名、空白区切り）` +
    `\n・comment は入居理由を${lang === "ja" ? "日本語" : LANG_NAME[lang] ?? "Japanese"}で30文字以内、句点なし` +
    `\n・comment はその人物らしい具体的な理由（設備や生活の事情）\n・JSON以外は一切出力しない`;
  const context = `入居者の種別: ${kindLabel}\n部屋番号: ${roomNo}\n設備レベル: ${lv}`;
  try {
    const r = await Promise.race([
      window.gp.ai.chat({ system, context, messages: [{ role: "user", content: "プロフィールを作成してください。" }], temperature: 0.9, maxTokens: 120 }),
      new Promise      ((res) => setTimeout(() => res(null), timeoutMs)),
    ]);
    if (!r || !r.ok) return null;
    const m = r.text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    const name = typeof parsed.name === "string" ? parsed.name.trim().slice(0, 24) : "";
    let comment = typeof parsed.comment === "string" ? parsed.comment.trim().replace(/[。．.]$/, "").slice(0, 30) : "";
    if (!name) return null;
    if (!comment) comment = fallbackProfile(kind, roomNo).comment;
    return { name, comment };
  } catch {
    return null;
  }
}

export function aiFontStack()         {
  return fontStack(getLang());
}
