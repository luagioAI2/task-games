// UI 令牌单一来源（与 UI_CONTRACT.md §1 一致）。启动时写入 :root。和风现代：和纸 + 藏青 / 朱红 / 金 / 抹茶。
export const UI_TOKENS = {
  washi: '#fbf4e6', 'washi-d': '#f1e4ca', ink: '#2a2140', sub: '#6b5a72', indigo: '#26356b', 'indigo-d': '#18224a', 'indigo-l': '#3d4f8f',
  vermilion: '#d2463a', 'vermilion-d': '#9e2f26', gold: '#f2c95c', 'gold-d': '#b8862a', matcha: '#3f9a46', 'matcha-d': '#276a2d',
};
export function applyTokens(root = document.documentElement) {
  for (const [k, v] of Object.entries(UI_TOKENS)) root.style.setProperty(`--${k}`, v);
}
