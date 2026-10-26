// 皮肤表（2026-10-26 改造：原版是**平台硬币内购**，接进小任务农场后改成**按累计收入解锁**）。
//
// ## 为什么改
//
// 原版每套皮肤 `coins: 8`，走 `gp.pay.purchase()` —— 真钱。宿主（kid-quest-farm-2d）
// 里没有任何接口能发起支付，也不该有：那是个给孩子做任务的 App。
// 但皮肤本身是**纯外观**（每位角色一套立绘 + idle / 招牌动作 / 欢呼三段动画，不影响数值），
// 直接删掉太可惜 —— 它是「玩久了有回报」的那部分。所以改成：
//
//   累计收入（`state.lifetime`）≥ `need` ⇒ 自动解锁，永久拥有
//
// 用 `lifetime` 而不是「当前现金」有两个原因：
//   · 重开矿场（prestige）会把现金清零，但 `lifetime` 是累计的、只增不减；
//   · 它就是界面上「我的累计收入」那个数，孩子看得见、对得上。
//
// ⚠️ 原版存档里的 `ownedSkins` / `paidIds` 不再决定能不能穿 —— 解锁状态**由进度现算**，
//    所以老存档里花过钱的皮肤不会丢（进度到了自然还在），也不会有人靠改存档白拿。
//
// ## 门槛怎么定的
//
// 参照 `src/sim/economy.js` 的矿道价格表（第 1 条 $10 → 第 9 条 $4e10，认真玩 8 小时
// 累计约 $32T）。所以阶梯从 $1K 铺到 $3T：第一条矿道附近解锁第一套，第 9 条矿道之后
// 拿到最后几套。**改门槛只改下面这张表**，别在 ui.js 里写数字。
export const SKIN_ROLES = [
  { id: 'manager', name: 'skin.role.manager', at: 'skin.role.manager.at' },
  { id: 'miner', name: 'skin.role.miner', at: 'skin.role.miner.at', soon: true },
  { id: 'cyber', name: 'skin.role.cyber', at: 'skin.role.cyber.at', soon: true },
  { id: 'machine', name: 'skin.role.machine', at: 'skin.role.machine.at', soon: true },
  { id: 'staff', name: 'skin.role.staff', at: 'skin.role.staff.at', soon: true },
];

export const SKINS = [
  // —— 管理员 · 经典款式（制服统一前，每位自己的那身衣服）——
  { id: 'aya@classic', role: 'manager', mgr: 'aya', name: 'skin.aya.cl', desc: 'skin.aya.cl.desc', need: 1e3 },
  { id: 'komitsu@classic', role: 'manager', mgr: 'komitsu', name: 'skin.komitsu.cl', desc: 'skin.komitsu.cl.desc', need: 1e4 },
  { id: 'yukimi@classic', role: 'manager', mgr: 'yukimi', name: 'skin.yukimi.cl', desc: 'skin.yukimi.cl.desc', need: 1e5 },
  { id: 'kuriko@classic', role: 'manager', mgr: 'kuriko', name: 'skin.kuriko.cl', desc: 'skin.kuriko.cl.desc', need: 1e6 },
  { id: 'sakura@classic', role: 'manager', mgr: 'sakura', name: 'skin.sakura.cl', desc: 'skin.sakura.cl.desc', need: 1e7 },
  { id: 'akari@classic', role: 'manager', mgr: 'akari', name: 'skin.akari.cl', desc: 'skin.akari.cl.desc', need: 1e8 },
  { id: 'shion@classic', role: 'manager', mgr: 'shion', name: 'skin.shion.cl', desc: 'skin.shion.cl.desc', need: 1e9 },
  // —— 管理员 · 特别款式 ——
  { id: 'aya@miko', role: 'manager', mgr: 'aya', name: 'skin.aya', desc: 'skin.aya.desc', need: 3e9 },
  { id: 'sakura@yukata', role: 'manager', mgr: 'sakura', name: 'skin.sakura', desc: 'skin.sakura.desc', need: 1e10 },
  { id: 'shion@battle', role: 'manager', mgr: 'shion', name: 'skin.shion', desc: 'skin.shion.desc', need: 3e10 },
  { id: 'komitsu@taiko', role: 'manager', mgr: 'komitsu', name: 'skin.komitsu', desc: 'skin.komitsu.desc', need: 1e11 },
  { id: 'yukimi@snow', role: 'manager', mgr: 'yukimi', name: 'skin.yukimi', desc: 'skin.yukimi.desc', need: 3e11 },
  { id: 'kuriko@taisho', role: 'manager', mgr: 'kuriko', name: 'skin.kuriko', desc: 'skin.kuriko.desc', need: 1e12 },
  { id: 'akari@kitsune', role: 'manager', mgr: 'akari', name: 'skin.akari', desc: 'skin.akari.desc', need: 3e12 },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || null;
export const skinsFor = (mgr) => SKINS.filter((s) => s.mgr === mgr);
export const skinsByRole = (role) => SKINS.filter((s) => s.role === role);

/** 这套皮肤解锁了没有。`lifetime` 是累计收入（重开矿场不清零）。 */
export const skinUnlocked = (S, lifetime) => !!S && (lifetime || 0) >= (S.need || 0);
