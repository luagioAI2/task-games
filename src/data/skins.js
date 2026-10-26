// 皮肤商店的商品表。按“工种系列”分组售卖：矿工 / 改造娘 / 机械娘 / 地面职员 / 管理员。
// 皮肤只换外观（每位角色一套立绘 + idle / 招牌动作 / 欢呼三段动画），不影响数值。
// 购买走平台硬币（gp.pay）：购买 → 发放并存 paidIds → ack；启动时用 pending() 补发。
// 存档里记 skins: { <角色 key>: <皮肤 id> }（已装备）与 ownedSkins: [<皮肤 id>]。
// 目前上架的是管理员系列（制服统一后，她们原本的衣服成了“经典款式”）。
// 其他工种的皮肤：在 SKIN_ROLES 的 series 里补条目、并把对应的动画表打进 assets/sprites 即可。
export const SKIN_ROLES = [
  { id: 'manager', name: 'skin.role.manager', at: 'skin.role.manager.at' },
  { id: 'miner', name: 'skin.role.miner', at: 'skin.role.miner.at', soon: true },
  { id: 'cyber', name: 'skin.role.cyber', at: 'skin.role.cyber.at', soon: true },
  { id: 'machine', name: 'skin.role.machine', at: 'skin.role.machine.at', soon: true },
  { id: 'staff', name: 'skin.role.staff', at: 'skin.role.staff.at', soon: true },
];

export const SKINS = [
  // —— 管理员 · 经典款式（制服统一前，每位自己的那身衣服）——
  { id: 'aya@classic', role: 'manager', mgr: 'aya', name: 'skin.aya.cl', desc: 'skin.aya.cl.desc', coins: 8 },
  { id: 'komitsu@classic', role: 'manager', mgr: 'komitsu', name: 'skin.komitsu.cl', desc: 'skin.komitsu.cl.desc', coins: 8 },
  { id: 'yukimi@classic', role: 'manager', mgr: 'yukimi', name: 'skin.yukimi.cl', desc: 'skin.yukimi.cl.desc', coins: 8 },
  { id: 'kuriko@classic', role: 'manager', mgr: 'kuriko', name: 'skin.kuriko.cl', desc: 'skin.kuriko.cl.desc', coins: 8 },
  { id: 'sakura@classic', role: 'manager', mgr: 'sakura', name: 'skin.sakura.cl', desc: 'skin.sakura.cl.desc', coins: 10 },
  { id: 'akari@classic', role: 'manager', mgr: 'akari', name: 'skin.akari.cl', desc: 'skin.akari.cl.desc', coins: 8 },
  { id: 'shion@classic', role: 'manager', mgr: 'shion', name: 'skin.shion.cl', desc: 'skin.shion.cl.desc', coins: 12 },
  // —— 管理员 · 特别款式 ——
  { id: 'aya@miko', role: 'manager', mgr: 'aya', name: 'skin.aya', desc: 'skin.aya.desc', coins: 15 },
  { id: 'sakura@yukata', role: 'manager', mgr: 'sakura', name: 'skin.sakura', desc: 'skin.sakura.desc', coins: 15 },
  { id: 'shion@battle', role: 'manager', mgr: 'shion', name: 'skin.shion', desc: 'skin.shion.desc', coins: 20 },
  // 第二批特别款式：让 7 位管理员的款式数量一致（每人 = 标准制服 + 经典 + 特别，共 3 种）
  { id: 'komitsu@taiko', role: 'manager', mgr: 'komitsu', name: 'skin.komitsu', desc: 'skin.komitsu.desc', coins: 15 },
  { id: 'yukimi@snow', role: 'manager', mgr: 'yukimi', name: 'skin.yukimi', desc: 'skin.yukimi.desc', coins: 15 },
  { id: 'kuriko@taisho', role: 'manager', mgr: 'kuriko', name: 'skin.kuriko', desc: 'skin.kuriko.desc', coins: 15 },
  { id: 'akari@kitsune', role: 'manager', mgr: 'akari', name: 'skin.akari', desc: 'skin.akari.desc', coins: 15 },
];

// 所有皮肤统一售价：1 硬币（用户要求）。改价只改这一处，上面各条里的 coins 仅是旧价记录
export const SKIN_PRICE = 1;
for (const S of SKINS) S.coins = SKIN_PRICE;

export const skinById = (id) => SKINS.find((s) => s.id === id) || null;
export const skinsFor = (mgr) => SKINS.filter((s) => s.mgr === mgr);
export const skinsByRole = (role) => SKINS.filter((s) => s.role === role);

// 平台的 itemId 只允许 [A-Za-z0-9_.-]（不能有 @、空格等），所以付款用的 id 单独算一份：
// 'shion@battle' → 'skin.shion.battle'。存档里记的仍是皮肤 id，付款回来时按这张表翻回去。
for (const S of SKINS) S.pay = `skin.${S.id.replace('@', '.')}`;
const BY_PAY = Object.fromEntries(SKINS.map((S) => [S.pay, S]));
export const skinByPayId = (payId) => BY_PAY[payId] || null;
