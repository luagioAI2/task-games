export const TITLE = 'Cell, Not Today!';
export const PRIMARY = 'zh';
const rows = `普通|Common|ノーマル
稀有|Rare|レア
史诗|Epic|エピック
传说|Legendary|レジェンド
神话|Mythic|ミシック
绿色|Green|緑
蓝色|Blue|青
紫色|Purple|紫
橙色|Orange|橙
红色|Red|赤
抗体飞弹|Antibody Dart|抗体弾
远程·追踪|Ranged · Homing|遠距離・追尾
自动瞄准最近的病毒发射抗体弹。|Fires antibodies at the nearest virus.|最も近いウイルスへ抗体弾を発射。
分裂抗体|Split Antibodies|分裂抗体
命中后分裂出2枚小抗体继续攻击。|Splits into 2 small antibodies on hit.|命中すると小さな抗体2発に分裂。
弹数|Shots|弾数
射速|Fire rate|連射速度
穿刺针剂|Piercing Needle|貫通注射
远程·穿透|Ranged · Pierce|遠距離・貫通
阵地战中垂直向上发射，天生穿透2个目标。|Fires upward in Line Defense and pierces 2 targets.|陣地戦では真上に発射し、2体を貫通。
无限贯穿|Infinite Pierce|無限貫通
针剂可无限穿透，伤害+60%。|Unlimited piercing and +60% damage.|無限に貫通し、ダメージ+60%。
针数|Needles|針の数
环绕胶囊|Orbit Capsules|旋回カプセル
近战·环绕|Melee · Orbit|近距離・旋回
胶囊环绕英雄旋转，持续撞击靠近的病毒。|Orbiting capsules strike nearby viruses.|周囲を回るカプセルが近くの敵に体当たり。
胶囊风暴|Capsule Storm|カプセルの嵐
胶囊+2，旋转半径周期性大幅扩张。|Adds 2 capsules; orbit periodically expands.|カプセル+2。旋回半径が周期的に拡大。
胶囊数|Capsules|カプセル数
转速|Spin rate|回転速度
半径|Radius|半径
消毒喷雾|Sanitizer Spray|消毒スプレー
近战·范围|Melee · Area|近距離・範囲
向前方扇形持续喷洒，伤害范围内所有病毒。|Sprays a cone, damaging every virus within.|前方の扇形範囲に噴射し、全ての敵を攻撃。
强效消毒|Deep Clean|強力消毒
射程+50%，喷射角度更大，并使病毒减速。|+50% range, wider spray, and slows viruses.|射程+50%。噴射角度が拡大し、敵を減速。
频率|Frequency|頻度
射程|Range|射程
创可贴回旋镖|Bandage Boomerang|絆創膏ブーメラン
远程·往返|Ranged · Return|遠距離・往復
飞出后折返，往返路径上的病毒都会受伤。|Hits viruses on both its outward and return paths.|往路と復路の両方で敵にダメージ。
三重回旋|Triple Spin|三重旋回
回旋镖+2，体积与伤害大幅提升。|Adds 2 boomerangs with greater size and damage.|ブーメラン+2。サイズと威力が大幅上昇。
数量|Count|数量
投掷速度|Throw rate|投擲速度
高烧电弧|Fever Arc|高熱アーク
连锁·弹射|Chain · Bounce|連鎖・反射
释放电弧，在病毒之间连续跳跃。|An electric arc jumps between viruses.|電流がウイルスの間を連続で跳ぶ。
雷暴|Thunderstorm|雷嵐
跳跃次数+3，每次命中有概率再次落雷。|+3 jumps; hits may trigger an extra lightning strike.|連鎖+3。命中時に確率で追加の落雷。
跳跃|Jumps|連鎖数
施放速度|Cast rate|発動速度
跳跃距离|Jump range|連鎖距離
泡腾炸弹|Fizzy Bomb|発泡ボム
范围·爆炸|Area · Blast|範囲・爆発
投掷泡腾弹，落地爆炸造成范围伤害。|Throws a fizzy bomb that explodes on landing.|着弾時に爆発する発泡弾で範囲攻撃。
持续泡腾|Endless Fizz|持続発泡
爆炸后留下泡腾区域，持续灼烧病毒。|Leaves a fizzing zone that keeps burning viruses.|爆発後の発泡エリアが継続ダメージを与える。
爆炸范围|Blast area|爆発範囲
冷冻针|Frost Needle|冷凍針
远程·减速|Ranged · Slow|遠距離・減速
命中后使整条病毒链减速，最多叠加3层。|Slows the entire virus chain on hit, up to 3 stacks.|命中でウイルス列全体を減速。最大3重。
绝对零度|Absolute Zero|絶対零度
每隔一段时间冻结病毒链1.5秒。|Periodically freezes the chain for 1.5 seconds.|一定間隔でウイルス列を1.5秒凍結。
声波脉冲|Sonic Pulse|音波パルス
近战·冲击|Melee · Shockwave|近距離・衝撃波
以英雄为中心释放扩散声波，伤害沿途所有病毒。|An expanding sonic wave hits all viruses in its path.|英雄を中心に広がる音波で全ての敵を攻撃。
双重共振|Double Resonance|二重共鳴
声波范围+50%，并连续释放两道。|+50% wave range; releases two waves in succession.|音波範囲+50%。連続で2波を放つ。
释放速度|Pulse rate|発動速度
范围|Area|範囲
追踪抗体|Homing Antibodies|追尾抗体
远程·追踪爆炸|Ranged · Homing blast|遠距離・追尾爆発
发射会自动追踪的抗体导弹，命中小范围爆炸。|Homing antibody missiles explode in a small area.|追尾する抗体ミサイルが命中時に小範囲爆発。
饱和打击|Saturation Strike|飽和攻撃
导弹+3，爆炸范围大幅提升。|Adds 3 missiles and greatly increases blast area.|ミサイル+3。爆発範囲が大幅拡大。
导弹数|Missiles|ミサイル数
紫外光束|UV Beam|紫外線ビーム
直线·持续|Line · Sustained|直線・持続
发射持续的紫外光束，灼烧直线上所有病毒。|A sustained UV beam burns all viruses in a line.|持続する紫外線で直線上の全ての敵を焼く。
广谱照射|Broad Spectrum|広域照射
光束更宽，持续时间+50%。|Wider beams with +50% duration.|ビームが太くなり、持続時間+50%。
光束数|Beams|ビーム数
充能速度|Charge rate|充填速度
宽度|Width|幅
抗生素光剑|Antibiotic Saber|抗生物質セイバー
近战·斩击|Melee · Slash|近距離・斬撃
向前方挥出巨大的扇形斩击，造成海量伤害。|A massive frontal slash deals heavy damage.|前方へ巨大な扇形の斬撃を放ち、大ダメージ。
回旋斩|Spinning Slash|回転斬り
同时向前后斩击，范围+30%。|Slashes forward and backward with +30% area.|前後を同時に斬り、範囲+30%。
挥砍速度|Slash rate|斬撃速度
全面强化|Full Upgrade|全面強化
精准打击|Precision Strike|精密攻撃
致命要害|Vital Strike|急所攻撃
肾上腺素|Adrenaline|アドレナリン
病毒迟缓|Sluggish Virus|ウイルス鈍化
紧急击退|Emergency Push|緊急撃退
熬夜病毒|Night-Owl Virus|夜更かしウイルス
“再刷五分钟就睡。”——凌晨三点|“Five more minutes.” — 3 a.m.|「あと5分だけ。」——午前3時
拖延症病毒|Procrastination Virus|先延ばしウイルス
“明天再说吧。”|“I'll do it tomorrow.”|「明日でいいや。」
手机上瘾病毒|Phone Addiction Virus|スマホ依存ウイルス
解锁手机，只为了看一眼时间。|Unlocking the phone just to check the time.|時刻を見るだけのつもりでスマホを開く。
脱发病毒|Hair-Loss Virus|抜け毛ウイルス
发际线正在战略性撤退。|The hairline is making a tactical retreat.|生え際が戦略的撤退中。
社恐病毒|Social Anxiety Virus|人見知りウイルス
电话响了，假装不在家。|The phone rings. Pretend you're not home.|電話が鳴った。留守のふりをしよう。
暴食病毒|Snack Attack Virus|食べ過ぎウイルス
“吃饱了才有力气减肥。”|“I need energy to go on a diet.”|「ダイエットするにも腹ごしらえ。」
内卷病毒|Rat-Race Virus|競争疲れウイルス
别人卷，你也不得不卷。|Everyone hustles, so you hustle too.|みんなが頑張るから、自分も頑張るしかない。
选择困难病毒|Indecision Virus|優柔不断ウイルス
中午吃什么？这是个哲学问题。|What's for lunch? A philosophical question.|昼ごはんは何にする？哲学的な問題だ。
起床困难病毒|Snooze Virus|二度寝ウイルス
闹钟响了八次，被窝赢了八次。|Eight alarms. Eight wins for the blanket.|目覚まし8回、布団の8勝。
摸鱼病毒|Slacker Virus|サボりウイルス
看起来在工作，其实在摸鱼。|Looks like work. Actually slacking.|仕事中に見えて、実はサボり中。
健忘病毒|Forgetful Virus|物忘れウイルス
我进这个房间是要干嘛来着？|Why did I come into this room?|この部屋に何をしに来たんだっけ？
躺平病毒|Couch-Potato Virus|ごろ寝ウイルス
终极病毒：什么都不想干。|The final virus: doing absolutely nothing.|究極のウイルス：何もしたくない。
困难|Hard|ハード
噩梦|Nightmare|ナイトメア
阿免|Amian|アミアン
见习免疫卫士|Immune Rookie|免疫見習い
橙小维|Vita|ヴィータ
维C爆破手|Vitamin C Bomber|ビタミンC爆破士
雷小伏|Volt|ヴォルト
高烧电工|Fever Electrician|高熱電気技師
冰小凝|Frosty|フロスティ
冷敷专家|Cold-Pack Expert|冷却の専門家
光小剑|Lumen|ルーメン
紫外线骑士|UV Knight|紫外線の騎士
保温杯|Thermos|保温ボトル
人到中年不得已，保温杯里泡枸杞。|A thermos of goji tea keeps you going.|クコ茶入りボトルで今日も元気に。
一包枸杞|Goji Berries|クコの実
养生从娃娃抓起。|Healthy habits start early.|健康習慣は早いうちから。
泡脚桶|Foot Bath|足湯桶
泡完脚，环绕胶囊都转得更快了。|Warm feet, faster capsules.|足が温まればカプセルも快調。
蒸汽眼罩|Steam Eye Mask|蒸気アイマスク
闭眼五分钟，攻速提升百分之一。|Five minutes of shut-eye for a little more speed.|目を閉じて5分、攻撃速度アップ。
速溶咖啡|Instant Coffee|インスタントコーヒー
三合一，开局多一发抗体。|Three-in-one, plus one starting antibody.|3-in-1で開始時の抗体弾+1。
防蓝光眼镜|Blue-Light Glasses|ブルーライト眼鏡
专业对付紫外线和蓝光。|Made to handle UV and blue light.|紫外線とブルーライト対策のプロ。
护腰|Back Brace|腰サポーター
久坐一族的最后防线。|The desk worker's last line of defense.|座りっぱなしの人の最後の防衛線。
U型颈枕|Neck Pillow|ネックピロー
在哪都能睡，在哪都能战。|Sleep anywhere. Fight anywhere.|どこでも眠れて、どこでも戦える。
机械键盘|Mechanical Keyboard|メカニカルキーボード
青轴的声音，就是针剂的穿透力。|Clicky keys, piercing needles.|キーの打鍵音が針の貫通力に。
四叶草|Four-Leaf Clover|四つ葉のクローバー
据说能刷出更好的词条。|Rumored to roll better upgrades.|良い強化を引けるらしい。
锦鲤贴纸|Lucky Koi Sticker|幸運の鯉シール
转发这条锦鲤，战斗奖励翻倍（并不会）。|Share this koi for double rewards. (Not really.)|この鯉を広めると報酬2倍。（なりません）
转运红绳|Lucky Red Cord|幸運の赤い紐
复活时击退更远。|Pushes viruses farther on revival.|復活時に敵をより遠くへ押し戻す。
养生三件套|Wellness Trio|健康3点セット
熬夜冠军|Night-Owl Champion|夜更かし王者
打工人套装|Office Warrior|会社員セット
欧皇附体|Lucky Streak|幸運の加護
欧气满满|Feeling Lucky|幸運いっぱい
再来一次|One More Try|もう一回
每个宝箱额外 1 次免费刷新|One extra free reroll per chest|宝箱ごとに無料更新+1回
寻宝达人|Treasure Hunter|お宝ハンター
开局补给|Starting Supplies|開始時の補給
战斗开始时获得 1 个银色宝箱|Start each battle with 1 silver chest|戦闘開始時に銀の宝箱を1個獲得
绝地反击|Last Stand|背水の反撃
完成 3 场战斗|Complete 3 battles|戦闘を3回完了
开启 10 个局内宝箱|Open 10 battle chests|戦闘中に宝箱を10個開く
英雄升级 3 次|Upgrade heroes 3 times|英雄を3回強化
领取 1 次挂机奖励|Claim idle rewards once|放置報酬を1回受け取る
新武器|New weapon|新武器
全局|Global|全体
觉醒|Awakened|覚醒
伤害|Damage|ダメージ
飞行速度|Projectile speed|弾速
弹速|Shot speed|弾速
穿透|Pierce|貫通
商店|Shop|ショップ
武器|Weapons|武器
战斗|Battle|戦闘
英雄|Heroes|英雄
藏品|Relics|コレクション
金币|Gold|ゴールド
钻石|Gems|ダイヤ
体力|Stamina|スタミナ
密宝钥匙|Hero key|秘宝の鍵
藏品钥匙|Relic key|収集の鍵
绿色碎片|Green shards|緑の欠片
蓝色碎片|Blue shards|青の欠片
紫色碎片|Purple shards|紫の欠片
橙色碎片|Orange shards|橙の欠片
红色碎片|Red shards|赤の欠片
解锁|Unlock|解放
确定|Confirm|確認
取消|Cancel|キャンセル
超级强化|Super upgrade|超強化
小技巧：点击病毒可以集火攻击它！|Tip: tap a virus to focus fire!|ヒント：ウイルスをタップで集中攻撃！
击破金色宝箱获得新武器|Break a gold chest for a new weapon|金の宝箱を壊すと新武器を獲得
击破银色宝箱获得强化|Break a silver chest for an upgrade|銀の宝箱を壊すと強化を獲得
本局次数已用完|No uses left this battle|今回の使用回数は残っていません
钻石不足|Not enough gems|ダイヤが足りません
刷新次数已用完|No rerolls left|更新回数が残っていません
阵地战|Line Defense|陣地戦
包围战|Encirclement|包囲戦
病毒从上方蜿蜒而下，穿透与直线武器更强！|Viruses wind down from above. Piercing weapons excel!|敵が上から蛇行してくる。貫通武器が有効！
病毒四面合围，近战与范围武器更强！|Surrounded! Melee and area weapons excel!|四方から包囲される。近距離・範囲武器が有効！
⚠ 病毒逼近！|⚠ Viruses closing in!|⚠ ウイルス接近！
❄ 冻结|❄ Frozen|❄ 凍結
强化|Upgrade|強化
宝箱掉落啦！点击宝箱挑选强化|Chest dropped! Tap it to choose an upgrade.|宝箱が落ちた！タップして強化を選ぼう。
金色宝箱＝新武器，银色宝箱＝强化属性。可以先攒着，等拿到好武器再开！|Gold chests give weapons; silver chests give upgrades. Save them for a better loadout!|金は新武器、銀は能力強化。良い武器を得てから開けてもOK！
金色宝箱 · 选择新武器|Gold Chest · Pick a Weapon|金の宝箱・武器を選択
银色宝箱 · 强化属性|Silver Chest · Upgrade|銀の宝箱・能力強化
刷新可能出现更高级的词条|Reroll for a chance at better upgrades|更新で上位の強化が出ることも
免费刷新|Free reroll|無料更新
免费刷新后可用|Use the free reroll first|無料更新後に使用可能
复活|Revive|復活
复活后大幅度击退病毒|Reviving pushes viruses far back|復活すると敵を大きく押し戻す
免费复活|Free revive|無料復活
放弃复活|Give up|復活を諦める
暂停|Paused|一時停止
音效：|SFX: |効果音：
音乐：|Music: |音楽：
开|On|オン
关|Off|オフ
退出战斗|Leave battle|戦闘を終了
继续战斗|Resume|戦闘を再開
胜利！|Victory!|勝利！
战斗结束|Battle over|戦闘終了
生存进度|Progress|生存進度
消灭病毒|Viruses defeated|撃破数
战斗时长|Time|戦闘時間
新的最高进度！|New best progress!|最高進度を更新！
首次通关！额外钻石奖励|First clear! Bonus gems earned|初クリア！追加ダイヤ獲得
解锁新武器：|New weapon: |新武器解放：
（已自动上阵）|(auto-equipped)|（自動編成済み）
返回|Back|戻る
每日任务|Daily tasks|デイリー
已领取|Claimed|受取済み
任务奖励|Task rewards|任務報酬
领取|Claim|受け取る
完成全部任务|Complete all tasks|全任務を達成
额外奖励|Bonus rewards|追加報酬
全部完成|All done|全て達成
每日 0 点刷新|Resets daily at midnight|毎日0時に更新
七日签到|7-Day Check-in|7日間ログイン
今天已经签到过了|Already checked in today|本日は受取済みです
签到奖励|Check-in rewards|ログイン報酬
明天再来|Come back tomorrow|また明日
签到|Check in|ログイン
密宝钥匙不足（可在商店购买）|Not enough hero keys. Visit the shop.|秘宝の鍵が足りません。ショップで購入できます。
英雄密宝|Hero Vault|英雄の秘宝
已满星，转化为钻石|Max stars: converted to gems|星が最大のためダイヤに変換
重复获得 · 星级+1|Duplicate · +1 star|重複獲得・星+1
新英雄！|New hero!|新英雄！
金币不足|Not enough gold|ゴールドが足りません
攻击力|Attack|攻撃力
暴击|Critical|クリティカル
攻速|Attack speed|攻撃速度
专属武器：|Signature weapon: |専用武器：
天赋：|Talent: |特性：
属性加点|Stat upgrades|能力強化
（任意加一点，英雄升一级）|(Each upgrade grants a hero level)|（能力強化で英雄レベル+1）
被动技能|Passives|パッシブ
（可重复获得并叠加）|(Can be gained again and stacked)|（繰り返し獲得して重複可能）
出战|Active|出撃
品质：|Rarity: |レア度：
（开局自带）|(Starting weapon)|（開始時に所持）
星级：|Stars: |星数：
出战中|Active|出撃中
设为出战|Select hero|出撃させる
去英雄密宝抽取|Visit Hero Vault|英雄の秘宝へ
挂机宝箱|Idle Chest|放置宝箱
领取次数越多，挂机宝箱品质越高|Claim more often to improve chest quality|受取回数に応じて宝箱品質が上昇
再挂机一会儿吧|Let the chest fill a little longer|もう少し待ちましょう
挂机收益|Idle rewards|放置報酬
关卡选择|Chapters|章を選択
请先通关上一章|Clear the previous chapter first|前の章を先にクリアしてください
已通关|Cleared|クリア済み
知道了|Got it|了解
下一章|Next|次の章
已满|Full|満杯
最高生存进度：|Best progress: |最高生存進度：
开始战斗|Start battle|戦闘開始
藏品宝箱|Relic Chest|収集宝箱
随机获得藏品或藏品碎片|Random relics or relic shards|ランダムな収集品または欠片を獲得
开启 ×1|Open ×1|開く ×1
开启 ×10|Open ×10|開く ×10
套装：|Set: |セット：
满级|Max level|最大レベル
未获得|Not owned|未獲得
获得藏品|Relics obtained|収集品を獲得
碎片不足，多开藏品宝箱吧|Need more shards. Open relic chests.|欠片が足りません。収集宝箱を開きましょう。
每日福利|Daily rewards|毎日の特典
每日补给|Daily supplies|毎日の補給
武器碎片+金币|Weapon shards + gold|武器の欠片＋ゴールド
免费|Free|無料
每日金币|Daily gold|毎日のゴールド
今日次数已用完|Daily limit reached|本日の回数上限に達しました
武器宝箱|Weapon chests|武器宝箱
蓝色武器箱|Blue weapon chest|青の武器箱
绿/蓝碎片，小概率开出新武器|Green/blue shards; a chance of a new weapon|緑・青の欠片。低確率で新武器
紫色武器箱|Purple weapon chest|紫の武器箱
超值|Value|お得
钥匙|Keys|鍵
开启藏品宝箱|Opens relic chests|収集宝箱を開く
开启英雄密宝|Opens the Hero Vault|英雄の秘宝を開く
藏品钥匙 +1|Relic key +1|収集の鍵 +1
密宝钥匙 +1|Hero key +1|秘宝の鍵 +1
金币商店|Gold shop|ゴールド交換
最划算|Best value|一番お得
常用|Standard|定番
小袋|Small bag|小袋
推荐|Recommended|おすすめ
上阵武器|Loadout|編成武器
金色宝箱只会开出上阵的武器——根据战场类型搭配你的武器池！|Gold chests only offer equipped weapons. Build your loadout for each battlefield!|金の宝箱からは編成武器のみ出現。戦場に合わせて編成しよう！
上阵|Equip|編成
未解锁|Locked|未解放
穿透：无限|Pierce: unlimited|貫通：無限
局内获得 4 次强化后，银色宝箱可能出现觉醒|After 4 upgrades, silver chests may offer awakening|戦闘中に4回強化すると銀の宝箱に覚醒が出現することも
至少保留 1 把上阵武器|Keep at least 1 weapon equipped|武器を最低1つ編成してください
已上阵|Equipped|編成済み
已下阵|Unequipped|編成解除
下阵|Unequip|外す
升级|Upgrade|強化
体力不足|Not enough stamina|スタミナ不足
完成每日任务、领取进度宝箱也能获得体力|Get stamina from daily tasks and progress chests|デイリー任務や進度宝箱でもスタミナを獲得
设置|Settings|設定
重置存档|Reset progress|進度リセット
确定清空全部进度重新开始吗？此操作无法撤销。|Erase all progress and start again? This cannot be undone.|全進度を消して最初から始めますか？元に戻せません。
重置|Reset|リセット
${TITLE} · 原创轻度塔防肉鸽 · 所有角色与美术均为程序绘制|${TITLE} · Casual defense roguelite with original procedural art|${TITLE}・オリジナルの軽快な防衛ローグライト
收下|Collect|受け取る
语言|Language|言語
自动存档已启用|Autosave enabled|自動保存は有効です
进度已交给平台保存|Progress sent to platform autosave|進度を自動保存に送信しました
正在保存进度…|Saving progress…|進度を保存中…
暂未保存成功，请重试|Save not accepted. Please retry.|保存できませんでした。再試行してください
登录后可跨设备同步进度|Sign in to sync progress across devices|ログインすると端末間で進度を同期できます
存档无法读取，已保留原数据|Save unreadable; original data preserved|保存データを読めません。元データは保護されています
重试存档|Retry save|保存を再試行
登录|Sign in|ログイン
重置失败，请稍后再试|Reset failed. Please try again.|リセット失敗。後で再試行してください
战斗每10秒自动记录，离开时再次记录|Battles checkpoint every 10 seconds and on exit|戦闘は10秒ごとと離脱時に保存
所有武器伤害|All weapon damage|全武器ダメージ
所有武器攻速|All weapon speed|全武器攻撃速度
高品质词条出现概率|Better upgrade chance|上位強化の出現率
高品质词条概率|Better upgrade chance|上位強化の出現率
暴击率|Critical chance|クリティカル率
暴击伤害|Critical damage|クリティカルダメージ
暴伤|Crit damage|クリティカルダメージ
病毒移动速度|Virus speed|ウイルス移動速度
病毒减速|Virus slow|ウイルス減速
复活时击退距离|Revive knockback|復活時の撃退距離
复活击退|Revive knockback|復活時の撃退
战斗奖励|Battle rewards|戦闘報酬
基础攻击|Base attack|基礎攻撃
星级攻击|Star attack bonus|星の攻撃補正
奖励|Rewards|報酬
战斗力|Power|戦闘力
推荐战力|Rec. power|推奨戦闘力
初始|Starting |初期
刷新|Reroll|更新
获得全部|Take all|全て獲得
当前 Lv.|Current Lv.|現在 Lv.
下一级 Lv.|Next Lv.|次 Lv.
已挂机|Idle time|放置時間
最多累积|Accumulates up to|蓄積上限
小时 · 宝箱品质 Lv.|hours · Chest Lv.|時間・宝箱品質 Lv.
每分钟|Per minute|毎分
金币 · 每小时|gold · Per hour|ゴールド・毎時
剩余|Left:|残り
次|uses|回
只差|Only|あと
通关|to clear|でクリア
剩余次数 ×|Uses left ×|残り回数 ×
再抽|Guaranteed hero within|あと
次内必出英雄！|more draws!|回以内に英雄確定！
每次消耗 1 把密宝钥匙 · 最多 6 次必出英雄（已抽|1 hero key per draw. Hero guaranteed within 6 draws (drawn:|1回につき秘宝の鍵1個。6回以内に英雄確定（現在
次）· 重复英雄提升星级（最高|draws). Duplicates add stars (max|回）。重複で星アップ（最大
星）|stars)|星）
开启 ×1（拥有|Open ×1 (owned:|1回開く（所持
/ 5（每星攻击 +|/ 5 (Attack per star +|/ 5（星ごとの攻撃 +
场 · 胜利|battles · Wins|回・勝利
场 · 消灭病毒|· Viruses defeated|回・撃破数
当前体力|Stamina|現在のスタミナ
，每 5 分钟恢复 1 点|; regenerates 1 every 5 minutes|、5分ごとに1回復
购买|Buy|購入
体力（今日剩余|stamina (left today:|スタミナ（本日残り
碎片不足|shards needed|の欠片が不足
间隔：|Interval: |間隔：
秒|s|秒
第|No. |第
最高生存进度达到|Reach best progress of|最高生存進度が
% 即可领取|% to claim|%で受取可能
章|Ch.|章
天|day|日
绿|G|緑
蓝|B|青
紫|P|紫
橙|O|橙
红|R|赤`;
export const LANGS = { zh: {}, en: {}, ja: {} };
for (const row of rows.split('\n')) {
  const [zh,en,ja] = row.split('|');
  if (en === undefined || ja === undefined) throw new Error(`Invalid translation: ${zh}`);
  LANGS.zh[zh] = zh; LANGS.en[zh] = en; LANGS.ja[zh] = ja;
}
const templates = [
 ['立即将病毒击退 {0} 距离','Immediately pushes viruses back {0} units','敵を即座に{0}押し戻す'],
 ['本局剩余 {0} 次','{0} uses left this battle','今回の残り{0}回'],
 ['英雄 Lv.{0} 奖励','Hero Lv.{0} rewards','英雄 Lv.{0} 報酬'],
 ['解锁被动：{0}','Passive unlocked: {0}','パッシブ解放：{0}'],
 ['通关普通难度第1章后解锁{0}','Clear Normal Chapter 1 to unlock {0}','ノーマル第1章クリアで{0}を解放'],
 ['进度 {0}% 宝箱','{0}% progress chest','進度{0}%の宝箱'],
 ['{0}% 进度宝箱','{0}% progress chest','進度{0}%の宝箱'],
 ['最高生存进度达到 {0}% 即可领取','Reach {0}% best progress to claim','最高生存進度{0}%で受取可能'],
 ['藏品钥匙不足（需要 {0} 把），进度宝箱、签到和商店都能获得','Need {0} relic keys. Get them from progress chests, check-ins or the shop.','収集の鍵が{0}個必要です。進度宝箱・ログイン・ショップで入手。'],
 ['今日剩余 {0} 次','{0} left today','本日残り{0}回'],
 ['高级碎片，概率开出新武器（今日 {0}）','Rare shards; chance of a new weapon ({0} left today)','上位の欠片。確率で新武器（本日残り{0}）'],
 ['通关第{0}章','Clear Chapter {0}','第{0}章をクリア'],
 ['最多上阵 {0} 把武器','Equip up to {0} weapons','武器は最大{0}個まで編成可能'],
 ['普通难度通关第 {0} 章解锁，商店武器宝箱也有概率获得','Clear Normal Chapter {0}, or find it in shop weapon chests.','ノーマル第{0}章クリアで解放。ショップの武器箱からも確率で入手。'],
 ['{0} 出战！','{0} is ready!','{0}、出撃！'],
 ['第{0}天','Day {0}','{0}日目'],
 ['第{0}章{1}','Chapter {0} {1}','第{0}章{1}']
];
for (const [zh,en,ja] of templates) { LANGS.zh[zh]=zh; LANGS.en[zh]=en; LANGS.ja[zh]=ja; }
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = templates.map(([key]) => ({key, re: new RegExp('^'+key.split(/\{\d+\}/).map(escape).join('(.*?)')+'$')}));
const words = Object.keys(LANGS.zh).filter(k=>!k.includes('{')).sort((a,b)=>b.length-a.length);
const wordRE = new RegExp(words.map(escape).join('|'), 'g');
let language = PRIMARY, manual = false;
const listeners = new Set();
export const getLanguage = () => language;
export function pickLanguage(value) { const k=String(value||'').slice(0,2).toLowerCase(); return k in LANGS ? k : PRIMARY; }
export function setLanguage(value, explicit=true) {
  if (!explicit && manual) return;
  language=pickLanguage(value); if(explicit) manual=true;
  if(typeof document!=='undefined') {
    document.documentElement.lang=language; document.documentElement.dir='ltr'; document.title=TITLE;
    const titleNode=document.querySelector('title');
    if(titleNode) { titleNode.lang='en'; titleNode.setAttribute('translate','no'); titleNode.classList.add('notranslate'); }
    document.documentElement.style.setProperty('--font', language==='ja' ? '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", system-ui, sans-serif' : language==='zh' ? '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' : 'system-ui, Arial, sans-serif');
  }
  for(const listener of listeners) listener(language);
}
export function onLanguage(listener) { listeners.add(listener); return ()=>listeners.delete(listener); }
export function tr(value, lang=language) {
  if(typeof value!=='string' || lang==='zh' || !value) return value;
  if(value===TITLE || value==='中文' || value==='日本語' || value==='English') return value;
  const exact=LANGS[lang][value]; if(exact!==undefined) return exact;
  if(value.includes(TITLE)) return value.split(TITLE).map(part=>tr(part,lang)).join(TITLE);
  const trimmed=value.trim(), match=LANGS[lang][trimmed];
  if(match!==undefined) return value.slice(0,value.indexOf(trimmed))+match+value.slice(value.indexOf(trimmed)+trimmed.length);
  for(const {key,re} of patterns) {
    const m=re.exec(value); if(m) return LANGS[lang][key].replace(/\{(\d+)\}/g,(_,i)=>tr(m[Number(i)+1],lang));
  }
  return value.replace(wordRE,k=>LANGS[lang][k]).replace(/，/g,lang==='en'?', ':'、').replace(/：/g,lang==='en'?': ':'：').replace(/（/g,' (').replace(/）/g,')');
}
export function translateChildren(value) {
  if(typeof value==='string') return tr(value);
  if(!Array.isArray(value)) return value;
  const out=[]; let text='';
  const flush=()=>{if(text){out.push(tr(text));text='';}};
  for(const child of value) {
    if(typeof child==='string'||typeof child==='number') text+=child;
    else {flush();out.push(Array.isArray(child)?translateChildren(child):child);}
  }
  flush(); return out;
}
export function formatNumber(value) {
  if(!Number.isFinite(value)) return '∞';
  return new Intl.NumberFormat(language==='zh'?'zh-CN':language==='ja'?'ja-JP':'en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
}
