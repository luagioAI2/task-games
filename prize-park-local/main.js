/**
 * main.js —— 独立运行入口（双击 start.bat / 本地 http 服务跑的就是这个）。
 *
 * game.js 已经改成工厂函数（`createGame({container, host, save})`），不再模块求值时自执行，
 * 所以需要一个入口来造一个「本地宿主」把同样的契约喂进去。
 *
 * 本地宿主 = 用 localStorage 实现宿主那几个方法。形状故意和
 * kid-quest-farm-2d 的 HostApi **完全一致**，这样游戏代码在两种环境下走的是同一条路径，
 * 不会出现「本地好的、装进宿主就坏」。
 *
 * ## 币也要在这里实现（不能只做个空壳）
 *
 * 游戏已经把 `save.coins` 彻底删掉，**所有**余额读写都走钱包（`wallet.js`）
 * → 宿主的那几扇门。所以本地宿主**必须真的记账**，否则独立运行时一开局就没钱、
 * 卖娃娃也不进账 —— 而且不会报错，只会「点了没反应」。
 *
 * 这里用一个**极简账本**（数组 delta，余额 = 求和），和宿主 `db.ts` 同一套口径：
 * 存一个 `balance` 字段就会出现「余额和流水对不上」，而且不报错。
 */

import { createGame } from "./game.js";
import { loadWalletFromHost, POINTS_PER_COIN } from "./wallet.js";

const SAVE_KEY = "prizepark.save.v1";
const COIN_KEY = "prizepark.coin.v1"; // [{delta, memo, at}]
const POINTS_KEY = "prizepark.points.v1"; // [{delta, memo, at}]
const VOUCHER_KEY = "prizepark.voucher.v1"; // [{delta, memo, at}] —— 兑换券（只进不出）

/** 本地新手积分。够买 30 局 —— 够玩明白这套经济，又不至于一开局就通胀。 */
const START_POINTS = 30;

function readLedger(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw == null ? [] : JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.delta === "number") : [];
  } catch {
    return [];
  }
}
function writeLedger(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* 隐私模式 / 配额满：静默失败，游戏照常能玩，只是不记账 */
  }
}
const sum = (rows) => rows.reduce((a, r) => a + r.delta, 0);

const localHost = {
  // ---------- 存档 ----------
  storage: {
    async get(key) {
      try {
        const raw = localStorage.getItem(SAVE_KEY + ":" + key);
        return raw == null ? undefined : JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(SAVE_KEY + ":" + key, JSON.stringify(value));
      } catch {
        /* 同上 */
      }
    },
    async list() {
      return {};
    },
  },

  // ---------- 积分 ----------
  balance() {
    return sum(readLedger(POINTS_KEY));
  },

  async spendPoints(amount) {
    const n = Math.round(amount);
    if (!(n > 0)) return false;
    const rows = readLedger(POINTS_KEY);
    if (sum(rows) < n) return false;
    rows.push({ delta: -n, memo: "spend", at: Date.now() });
    writeLedger(POINTS_KEY, rows);
    return true;
  },

  // ---------- 娃娃机币 ----------
  async gameCoinBalance() {
    return sum(readLedger(COIN_KEY));
  },

  /** 只进不出（和宿主 `addGameCoin` 的守卫一致：`delta <= 0` 直接 return） */
  async mintGameCoin(amount) {
    const n = Math.round(amount);
    if (!(n > 0)) return;
    const rows = readLedger(COIN_KEY);
    rows.push({ delta: n, memo: "mint", at: Date.now() });
    writeLedger(COIN_KEY, rows);
  },

  /** 唯一允许写负数的入口，且守卫和扣款在同一个「读—判—写」里 */
  async spendGameCoin(amount) {
    const n = Math.round(amount);
    if (!(n > 0)) return false;
    const rows = readLedger(COIN_KEY);
    if (sum(rows) < n) return false;
    rows.push({ delta: -n, memo: "play", at: Date.now() });
    writeLedger(COIN_KEY, rows);
    return true;
  },

  /** 扣积分 + 记币，**一次写完**（宿主那边是一个 Dexie 事务；这里退化成两次写，但中间没有 await） */
  async buyGameCoin(count, rate = POINTS_PER_COIN) {
    const n = Math.round(count);
    const cost = n * Math.round(rate);
    if (!(n > 0) || !(cost > 0)) return false;
    const points = readLedger(POINTS_KEY);
    if (sum(points) < cost) return false;
    points.push({ delta: -cost, memo: "buy", at: Date.now() });
    const coins = readLedger(COIN_KEY);
    coins.push({ delta: n, memo: "buy", at: Date.now() });
    writeLedger(POINTS_KEY, points);
    writeLedger(COIN_KEY, coins);
    return true;
  },

  // ---------- 兑换券 ----------
  /**
   * 娃娃 → **兑换券**（不经过币）。宿主那边走 `db.mintGameVouchers` → `postHarvest`，
   * 这里就是第三本账。返回实际发出的券数（`0` = 没发）。
   */
  async mintVoucher(amount, memo) {
    const n = Math.round(amount);
    if (!(n > 0)) return 0;
    const rows = readLedger(VOUCHER_KEY);
    rows.push({ delta: n, memo: memo || "prize", at: Date.now() });
    writeLedger(VOUCHER_KEY, rows);
    return n;
  },

  voucherBalance() {
    return sum(readLedger(VOUCHER_KEY));
  },

  /**
   * 没用完的币 → 兑换券（`VOUCHER_PER_COIN = 1`）。
   * 宿主那边是三件事一个事务；这里是同步读写，中间没有 await，等价。
   */
  async redeemGameCoin(count) {
    const n = Math.round(count);
    if (!(n > 0)) return 0;
    const coins = readLedger(COIN_KEY);
    if (sum(coins) < n) return 0;
    coins.push({ delta: -n, memo: "redeem", at: Date.now() });
    const vouchers = readLedger(VOUCHER_KEY);
    vouchers.push({ delta: n, memo: "redeem", at: Date.now() });
    writeLedger(COIN_KEY, coins);
    writeLedger(VOUCHER_KEY, vouchers);
    return n;
  },

  pushToast() {},
  haptic() {},
  tone() {},
};
/** 首次运行给一笔积分，否则「没钱玩 → 买币 → 也没积分」直接死锁。 */
function seedPointsOnce() {
  if (localStorage.getItem(POINTS_KEY) != null) return;
  writeLedger(POINTS_KEY, [{ delta: START_POINTS, memo: "新手积分", at: Date.now() }]);
}

// 老版本的存档是直接写在 SAVE_KEY 上的（platform-stub 时期），这里顺手迁移一次，
// 否则升级后所有人都会「进度清零」。
async function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(SAVE_KEY);
    if (!legacy) return undefined;
    const parsed = JSON.parse(legacy);
    await localHost.storage.set("save", parsed);
    localStorage.removeItem(SAVE_KEY);
    console.info("[pp] 已迁移旧存档到新键");
    return parsed;
  } catch {
    return undefined;
  }
}

(async () => {
  seedPointsOnce();
  const save = (await localHost.storage.get("save")) ?? (await migrateLegacy()) ?? null;
  // 币的快照必须在这里读 —— 游戏求值阶段就会同步读它（refreshTexts 在 boot 段直接调用）
  const wallet = await loadWalletFromHost(localHost, save);
  const root = document.getElementById("app");
  try {
    await createGame({ container: root, host: localHost, save, wallet });
  } catch (e) {
    console.error("[pp] 启动失败", e);
    root.innerHTML =
      '<div style="padding:24px;font:14px/1.6 ui-monospace,monospace;color:#f88">' +
      "启动失败：" + String(e && e.message) + "</div>";
  }
})();
