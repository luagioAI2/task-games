// 排行榜分数（第 2 版规则，和第 3 版经济一起上线）：直接提交累计收入（整数美元）。
// 新经济里收入封顶约 10^10/秒，正常游玩停在 T 量级；平台榜单最多存到 999.99T，超出的按上限提交。
// 必须和 LEADERBOARD.json 的 maxRaw 一致。
export const RANK_MAX = 999999999999999;
export const rankScore = (lifetime) => Math.min(RANK_MAX, Math.max(0, Math.floor(Number(lifetime) || 0)));
