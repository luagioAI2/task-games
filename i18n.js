                                      

// Store name (platform identity). The in-game logo is localized on user request: see TITLES / displayTitle().
export const GAME_TITLE = '尖叫鸡';
export const TITLES                       = { zh: '尖叫鸡', en: 'Screaming Chicken', ja: '叫ぶチキン' };
export function displayTitle()         { return TITLES[current] ?? GAME_TITLE; }

export const STRINGS                                       = {
  zh: {
    play: '开始',
    tagline: '滑一下，铺满整块地！',
    levels: '选择关卡',
    level: '第 {n} 关',
    swipeHint: '滑动屏幕，让鸡脖子伸到底',
    fillHint: '铺满所有蓝色格子就过关',
    snackHint: '零食数字到 0 前吃到才算',
    clear: '过关啦！',
    next: '下一关',
    retry: '重玩',
    menu: '关卡',
    resume: '继续',
    paused: '暂停',
    settings: '设置',
    home: '主界面',
    sound: '音效',
    music: '音乐',
    on: '开',
    off: '关',
    language: '语言',
    starClear: '铺满全场',
    starSnack: '吃光零食',
    starPerfect: '一次通过',
    allDone: '全部通关！你是最长的鸡',
    stuck: '撞进死胡同了！',
    loading: '加载中',
    arrowHint: '踩到箭头会被强行拐弯',
    portalHint: '钻进传送门，从另一个门钻出来',
    shop: '商店',
    passName: '3星直通券',
    passPrice: '1 金币 / 关',
    passDesc: '直接三星过关，并解锁下一关',
    shopPick: '点选一个未满星的关卡购买',
    shopEmpty: '已解锁的关卡都满星啦',
    ticketsHave: '已有直通券 ×{n}，点关卡免费使用',
    passTitle: '第 {n} 关 · 3星直通',
    passDialogDesc: '立即以三星通过这一关，并解锁下一关',
    passDone: '第 {n} 关已三星直通！',
    ticketBanked: '直通券已到账，可在商店免费使用',
    payPending: '支付确认中，到账后会自动发放',
    paySelf: '作者不能购买自己游戏里的商品',
    payFail: '暂时无法购买，请稍后再试',
  },
  en: {
    play: 'Play',
    tagline: 'Swipe. Stretch. Fill it all!',
    levels: 'Levels',
    level: 'Level {n}',
    swipeHint: 'Swipe to stretch the chicken until it hits a wall',
    fillHint: 'Cover every blue square to win',
    snackHint: 'Eat snacks before their number hits 0',
    clear: 'Cleared!',
    next: 'Next',
    retry: 'Retry',
    menu: 'Levels',
    resume: 'Resume',
    paused: 'Paused',
    settings: 'Settings',
    home: 'Home',
    sound: 'Sound',
    music: 'Music',
    on: 'On',
    off: 'Off',
    language: 'Language',
    starClear: 'Fill the board',
    starSnack: 'Eat every snack',
    starPerfect: 'First try',
    allDone: 'All clear! Longest chicken ever',
    stuck: 'Dead end! Bonk.',
    loading: 'Loading',
    arrowHint: 'Arrows force you to turn',
    portalHint: 'Enter a portal, pop out of its twin',
    shop: 'Shop',
    passName: '3-Star Pass',
    passPrice: '1 coin per level',
    passDesc: '3 stars right away, next level unlocked',
    shopPick: 'Tap a level without 3 stars to buy',
    shopEmpty: 'Every unlocked level already has 3 stars',
    ticketsHave: 'Passes owned ×{n} — tap a level to use one free',
    passTitle: 'Level {n} · 3-Star Pass',
    passDialogDesc: 'Clear this level with 3 stars now and unlock the next one',
    passDone: 'Level {n} cleared with 3 stars!',
    ticketBanked: 'Pass delivered — use it free in the shop',
    payPending: 'Payment pending — it will be delivered automatically',
    paySelf: "Creators can't buy items in their own game",
    payFail: 'Purchases are unavailable right now',
  },
  ja: {
    play: 'スタート',
    tagline: 'スワイプして全部うめよう！',
    levels: 'ステージ',
    level: 'ステージ {n}',
    swipeHint: 'スワイプでニワトリが壁までのびる',
    fillHint: '青いマスを全部うめたらクリア',
    snackHint: '数字が0になる前におやつを食べよう',
    clear: 'クリア！',
    next: '次へ',
    retry: 'もう一度',
    menu: 'ステージ',
    resume: 'つづける',
    paused: 'ポーズ',
    settings: '設定',
    home: 'ホーム',
    sound: '効果音',
    music: '音楽',
    on: 'オン',
    off: 'オフ',
    language: '言語',
    starClear: '全部うめる',
    starSnack: 'おやつ完食',
    starPerfect: '一発クリア',
    allDone: '全クリア！最長のニワトリ',
    stuck: '行き止まり！',
    loading: '読み込み中',
    arrowHint: '矢印をふむと強制的に曲がる',
    portalHint: 'ポータルに入ると相方から出る',
    shop: 'ショップ',
    passName: '★3パス',
    passPrice: '1コイン／ステージ',
    passDesc: '★3で即クリア、次のステージも解放',
    shopPick: '★3でないステージをタップして購入',
    shopEmpty: '解放済みのステージはすべて★3です',
    ticketsHave: '所持パス ×{n}：ステージをタップで無料使用',
    passTitle: 'ステージ {n}・★3パス',
    passDialogDesc: 'このステージを★3で即クリアし、次を解放します',
    passDone: 'ステージ {n} を★3でクリア！',
    ticketBanked: 'パスが届きました。ショップで無料で使えます',
    payPending: '決済確認中。完了後に自動で付与されます',
    paySelf: '作者は自分のゲーム内で購入できません',
    payFail: '現在は購入できません',
  },
};

export const LANG_NAMES                       = { zh: '中文', en: 'English', ja: '日本語' };
export const LANG_ORDER         = ['zh', 'en', 'ja'];

let current       = 'zh';

export function pickLang(locale                           )       {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('en')) return 'en';
  return 'zh';
}

// ★ 插件形态下要关掉：游戏跑在**宿主页面**里，`document.documentElement.lang`
//   和 `document.title` 都是宿主的，改它们等于改 App 的标题栏。
let touchDocument = true;

/** 插件入口在 `start()` 之前调一次 `setDocumentSideEffects(false)`。 */
export function setDocumentSideEffects(on      ) { touchDocument = !!on; }

export function setLang(l      ) {
  current = l;
  if (!touchDocument) return;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
  document.title = TITLES[l] ?? GAME_TITLE;
}

export function getLang()       { return current; }

export function t(key        , vars                                  )         {
  let s = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', String(vars[k]));
  return s;
}
