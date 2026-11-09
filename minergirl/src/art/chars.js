// 工作人员名册：生成的 Q 版和风工装女孩（立绘 / 动画见 sprites.js）。
// 矿工三套造型按矿道轮换；电梯 = 薄荷绿短发的升降员；推车 = 反光背心的推车员；6 位管理员与向导葵各有造型。
import { anim, still, faceCard, STAND, SIT } from './sprites.js';
export { faceCard };
import { t } from '../../i18n.js';

// 每种造型的贴图 key 前缀：矿工 miner-a / 改造娘 cyber-a / 机械娘 mecha（后接 -walk / -mine / -carry / -sleep）
const HUMAN_KEYS = ['miner-a', 'miner-b', 'miner-c'];
const CYBER_KEYS = ['cyber-a', 'cyber-b', 'cyber-c'];
const MECHA_KEYS = ['mecha', 'drill', 'crystal'];
const MINER_CACHE = {};
const minerKey = (ci) => (ci >= 6 ? MECHA_KEYS[(ci - 6) % 3] : ci >= 3 ? CYBER_KEYS[(ci - 3) % 3] : HUMAN_KEYS[ci % 3]);
export function minerSet(ci) {
  const v = minerKey(ci);
  return (MINER_CACHE[v] ??= {
    walk: anim(`${v}-walk`), carry: anim(`${v}-carry`), mine: anim(`${v}-mine`), sleep: still(`${v}-sleep`, SIT), face: v,
  });
}
export const operatorArt = (sleep = false) => still(sleep ? 'operator-sleep' : 'operator', STAND * 0.86);
// 推车员：walk（推车走）/ scoop（在电梯装车）/ dump（到仓库卸货欢呼）/ stand / sleep（没活时打盹）
export const carterArt = () => ({ walk: anim('carter-walk'), scoop: anim('carter-scoop'), dump: anim('carter-dump'), stand: still('carter-stand'), sleep: still('carter-sleep', SIT) });

// 管理员：电梯 = 绫、仓库 = 栗子，矿道轮流（小蜜、樱、雪见、灯）
export const MANAGERS = [
  { key: 'aya', bg: ['#e6e8f8', '#9aa4d8'] },
  { key: 'komitsu', bg: ['#fff2cc', '#f2c070'] },
  { key: 'yukimi', bg: ['#e4f2ea', '#9acbb0'] },
  { key: 'kuriko', bg: ['#f8e8d4', '#d8a878'] },
  { key: 'sakura', bg: ['#ffe8f0', '#f2a8c0'] },
  { key: 'akari', bg: ['#fbe6d0', '#d88a5a'] },
  { key: 'shion', bg: ['#e2f0f0', '#5a8a8c'] },   // 静晶之海的管理员：紫苑（御姐），指挥机械娘下矿
];
export const mgrName = (mi) => t('M' + (mi % MANAGERS.length));
export const mgrFace = (what, i = 0) => (what === 'elev' ? 0 : what === 'house' ? 3 : i >= 6 ? 6 : [1, 4, 2, 5][i % 4]);
// 职务：绫 = 电梯、栗子 = 仓库，其余都是矿道管理员（和 mgrFace 的分配一致）
export const mgrJob = (mi) => { const m = mi % MANAGERS.length; return m === 0 ? 'elev' : m === 3 ? 'house' : 'shaft'; };
// 带职务的名字：「电梯管理员 · 绫」
export const mgrTitled = (mi) => t('mgr.titled', { job: t('mgr.name.' + mgrJob(mi)), name: mgrName(mi) });
// 这位矿道管理员负责的矿道编号（1 起），按 mgrFace 反推
export const mgrShafts = (mi, count = 9) => { const out = []; for (let i = 0; i < count; i++) if (mgrFace('shaft', i) === mi % MANAGERS.length) out.push(i + 1); return out; };
// 管理员：idle（循环）/ gesture（偶尔来一下的招牌动作）/ cheer（技能生效时欢呼跳跃）
const MGR_ART = {};
// 皮肤（见 src/data/skins.js）：skinId 形如 shion@battle；不传就是默认造型。按“管理员 + 皮肤”缓存姿态对象
const skinKey = (mi, skin) => { const k = MANAGERS[mi % MANAGERS.length].key; return skin && skin.split('@')[0] === k ? skin : k; };
// 每帧每个管理员都要取一次姿态：按造型缓存，避免逐帧重复拼动画对象
export const managerArt = (mi, skin = null) => { const k = skinKey(mi, skin); return (MGR_ART[k] ??= { idle: anim(`mgr-${k}-idle`), gesture: anim(`mgr-${k}-gesture`), cheer: anim(`mgr-${k}-cheer`) }); };
export const ghostArt = () => still('ghost');
export const portrait = (mi, skin = null) => { const M = MANAGERS[mi % MANAGERS.length]; return faceCard(skinKey(mi, skin), M.bg); };
export const guidePortrait = () => faceCard('aoi', ['#fff0d8', '#f5b878']);
export const minerPortrait = (ci) => faceCard(minerKey(ci), ['#e8eefc', ci >= 6 ? '#7cc4e8' : ci >= 3 ? '#e8b86a' : '#a8b8e8']);
export const operatorPortrait = () => faceCard('operator', ['#e2f6ec', '#8ed0b0']);
export const carterPortrait = () => faceCard('carter', ['#fff0dc', '#f4b070']);
// 按时间挑动画帧
export const frameAt = (a, time, speed = 1, offset = 0) => (a?.frames?.length ? a.frames[Math.floor((time * a.fps * speed) + offset) % a.frames.length] : undefined);
