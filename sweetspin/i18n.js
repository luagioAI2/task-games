                                      

export const STRINGS                                       = {
  zh: {
    gameTitle: '旋转灯泡',
    totalStars: '总星星 {n}',
    level: '第 {n} 关',
    moves: '步数 {n}',
    par: '3星≤{n}步',
    hint: '提示',
    next: '下一关',
    replay: '再玩一次',
    levels: '选择关卡',
    settings: '设置',
    language: '语言',
    sound: '声音',
    on: '开',
    off: '关',
    play: '开始',
    cleared: '全部点亮！',
    allClear: '100关全部通关！',
    close: '关闭',
    noHint: '提示用完了，通关新关卡可获得提示',
    loading: '加载中',
    tip: '点击方块旋转管道，点亮所有灯泡',
    page: '{a} / {b}',
  },
  en: {
    gameTitle: 'Sweet Spin',
    totalStars: 'Stars {n}',
    level: 'Level {n}',
    moves: 'Moves {n}',
    par: '3★ ≤ {n}',
    hint: 'Hint',
    next: 'Next',
    replay: 'Replay',
    levels: 'Levels',
    settings: 'Settings',
    language: 'Language',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    play: 'Play',
    cleared: 'All lit up!',
    allClear: 'All 100 levels cleared!',
    close: 'Close',
    noHint: 'No hints left. Clear new levels to earn more.',
    loading: 'Loading',
    tip: 'Tap tiles to rotate pipes and light every bulb',
    page: '{a} / {b}',
  },
  ja: {
    gameTitle: 'スイートスピン',
    totalStars: 'スター {n}',
    level: 'レベル {n}',
    moves: '手数 {n}',
    par: '★3 ≤ {n}手',
    hint: 'ヒント',
    next: '次へ',
    replay: 'もう一度',
    levels: 'レベル選択',
    settings: '設定',
    language: '言語',
    sound: 'サウンド',
    on: 'オン',
    off: 'オフ',
    play: 'スタート',
    cleared: '全部点灯！',
    allClear: '全100レベルクリア！',
    close: '閉じる',
    noHint: 'ヒントがありません。新しいレベルをクリアで獲得',
    loading: '読み込み中',
    tip: 'タイルをタップして回転、全部の電球を点けよう',
    page: '{a} / {b}',
  },
};

let current       = 'zh';

/**
 * 插件形态下**不许**动 `<html lang>` —— 那是宿主页面的，改了整个 App 的
 * 排版/朗读语言都跟着变（`mount-test` 里有断言钉着）。独立网页保持原行为。
 */
let documentSideEffects = true;
export function setDocumentSideEffects(on        ) {
  documentSideEffects = !!on;
}

export function setLang(l      ) {
  current = l;
  if (documentSideEffects) document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
}
export function getLang()       { return current; }

export function detectLang(locale                )       {
  const s = (locale || navigator.language || 'zh').toLowerCase();
  if (s.startsWith('ja')) return 'ja';
  if (s.startsWith('en')) return 'en';
  return 'zh';
}

export function t(key        , vars                                  )         {
  let s = STRINGS[current][key] ?? STRINGS.zh[key] ?? key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', String(vars[k]));
  return s;
}
