/**
 * gp-bridge.js —— 把游戏依赖的 `window.gp` 平台接口，桥到宿主 (kid-quest-farm-2d) 的 HostApi 上。
 *
 * 为什么需要这层：游戏源码里有 9 处裸调 `gp.player.*`，接口是**平台**给的。
 * 单独跑（prize-park-local）时由 platform-stub.js 用 localStorage 顶上；
 * 作为插件跑时要换成宿主的 storage，而且**不能污染 window**（宿主页面上可能还有别的游戏）。
 *
 * 最关键的一点：`saves.latestSync` 是**同步 getter**，而宿主 storage 是 async。
 * 这个矛盾不能靠"包一层 Promise"解决 —— 游戏在模块求值阶段就会读它
 * （`loadSave()` 在 boot 段直接同步调用）。所以做法是：
 *   **创建游戏之前先把存档读出来，作为快照传进来**；之后 latestSync 返回内存里的对象，
 *   写入走防抖 + 异步落盘。这样同步语义完整保留，而且不会有"读到 undefined 就从头开始"的丢档。
 */

const SAVE_KEY = 'save';        // 宿主 HostApi 会加游戏 id 前缀，且 '__' 开头是保留键
const FLUSH_MS = 400;

export function makeGp({ host, initialSave = null, playerName = '你' } = {}) {
  let latest = initialSave ?? null;
  let timer = 0;
  let writing = null;

  function schedule() {
    if (!host?.storage) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = 0; void doFlush(); }, FLUSH_MS);
  }

  async function doFlush() {
    if (!host?.storage || latest == null) return;
    // 同一时刻只允许一次写入在飞。注意 schedule() 每次都会重新武装定时器，
    // 所以「写的过程中又改了」不会丢 —— 那次改动会在 400ms 后再写一遍。
    if (writing) return writing;
    writing = (async () => {
      try { await host.storage.set(SAVE_KEY, latest); }
      catch (e) { console.warn('[pp] 存档写入失败', e); }
      finally { writing = null; }
    })();
    return writing;
  }

  return {
    player: {
      // 宿主的用户信息：目前只有显示名。没有 locale，让游戏自己按 navigator.language 选语言。
      user: { name: playerName },
      ready: Promise.resolve({ user: { name: playerName } }),

      saves: {
        // 必须是 getter（不是函数）：游戏写成 `gp.player.saves.latestSync` 直接取值
        get latestSync() { return latest; },
        async putLatest(value) {
          latest = value;
          schedule();
        },
      },

      // 宿主没有排行榜。游戏自己那份"本地最好成绩"仍然工作（存在 save 里），
      // 这两个接口只负责不抛错。
      async submitScore() { /* no-op */ },
      async topScores() { return []; },
    },

    /** 卸载前调一次，把防抖中的写入立刻落盘 —— 否则刚抓到的娃娃会丢 */
    async flush() { if (timer) { clearTimeout(timer); timer = 0; } await doFlush(); },
  };
}

/**
 * 插件挂载前读存档。读不到（首次玩 / 宿主 storage 报错）就返回 null，游戏会用自己的默认值开局。
 * 注意：这里**不能**吞掉"读到空"和"读失败"的区别 —— 两者对游戏都是"从头开始"，但日志要分开。
 */
export async function loadSaveFromHost(host) {
  if (!host?.storage) return null;
  try {
    const v = await host.storage.get(SAVE_KEY);
    return v ?? null;
  } catch (e) {
    console.warn('[pp] 读存档失败，按新档开局', e);
    return null;
  }
}
