/**
 * leaderboard.js —— **离线版**（原版是联网排行榜，插件里整块拆掉）。
 *
 * ## 原版是什么
 *
 * 一个 DOM 浮层（`position:fixed; inset:0`，直接 append 到 `document.body`），
 * 里面列出「各关最佳星数相加」的前 10 名，数据来自 `gp.player.submitScore(total)`
 * ——**联网 + 要登录**。接进宿主后：
 *
 * 1. 宿主没有 `gp.player`，`submitScore` 不存在 ⇒ 永远 `{offline:true}`；
 * 2. 那个浮层是 `position:fixed` 挂到 `document.body` 上的 ⇒ 会**盖住宿主的顶栏和底栏**；
 * 3. 「登录上榜」按钮在这个 App 里没有任何意义（孩子不该有账号）。
 *
 * ## 现在留什么
 *
 * | 导出 | 现在做什么 | 谁还在用 |
 * | --- | --- | --- |
 * | `totalStars` / `keepBestStars` | **原样保留**（纯函数，星星是真进度） | `showResult` / 存档 |
 * | `syncStars` | 直接返回 `{ offline: true }`，**不发请求** | `showResult`（保留调用点，少改一处） |
 * | `leaderboardOpen` | 恒 `false` | 主 ticker（`!leaderboardOpen()` 才跑玩法） |
 * | `openLeaderboard` | 空函数 | 已删掉唯一入口（`rankButton`） |
 * | `closeLeaderboard` | 空函数 | `clearScene()` |
 *
 * 排行榜入口（标题页 / 选关页 / 结算卡上的「星星排行榜」）**整个删掉** ——
 * 留一个点了没反应的按钮，比没有更糟。星星总数在存档里，选关页仍然显示。
 */

export function totalStars(stars) {
  return stars.slice(0, 200).reduce((n, s) => n + (Number.isFinite(s) ? Math.max(0, Math.min(3, Math.floor(s))) : 0), 0)
}

export function keepBestStars(stars, level, earned) {
  stars[level] = Math.max(stars[level] || 0, Math.max(0, Math.min(3, Math.floor(earned))))
  return totalStars(stars)
}

/** 原版会把总星数提交到服务器；插件里没有账号体系，直接当作离线。 */
export async function syncStars() {
  return { offline: true }
}

export function leaderboardOpen() {
  return false
}

export function openLeaderboard() {
  /* 无排行榜 */
}

export function closeLeaderboard() {
  /* 无排行榜 */
}
