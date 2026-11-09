/**
 * platform.js —— MakePlay 平台桥的**离线替身**。
 *
 * ## 原版是什么
 *
 * 原版 `playerBridge()` 先看 `window.gp`（MakePlay 运行时注入的），没有就现造一个
 * offline 桩，并且**把桩写回 `window.gp`** —— 因为 `world-board.js` / `custom-name.js` /
 * `legacy-name-translator.js` / `archive-client.js` 里写的是**裸全局 `gp`**，不是 import。
 *
 * ## 插件里为什么改掉
 *
 * 1. **不许碰 `window`**：`scripts/check-plugin.mjs` 在 Node 里真 `import()` 一次包，
 *    模块顶层一碰 `window` 就抛，而那个脚本正是拦这件事的守卫。
 * 2. **不许留全局**：写 `window.gp` 等于给宿主页面留一个别人能读能改的入口，
 *    而且卸载时忘删就是第二次挂载读到上一次的旧桩（「假就绪」就是这么来的）。
 *
 * 所以这里改成：**导出一个常量单例**，四个模块改成 `import { gp }`。
 *
 * ## 三个联网面的收口点
 *
 * | 能力 | 这里给什么 | 后果 |
 * | --- | --- | --- |
 * | `player.saves` | `latestSync: null` / `putLatest → false` | **存档不走这里** —— 插件里由 `start(opts)` 的 `store` 接管（`host.storage`） |
 * | `room` | `available: false` | 录像库 / 世界排行榜恒离线，对手全是电脑选手 |
 * | `ai.chat` | `{ok:false,error:'disabled'}` | 起名不调云端：`randomNames()` 与 `NAME_TABLE` 本来就是纯本地的，随机名字照常可用；手打的名字原样使用（不翻译） |
 *
 * ★ `error` 必须是 `'disabled'` 而不是 `'offline'`：两个调用方都按
 *   `['disabled','offline'].includes(...)` 判「以后别再试了」，但 `'disabled'`
 *   是**永久**语义（不再重试），`'offline'` 会带 `retryAt` 退避、每 3 秒再试一次。
 *   这里根本不会通，用永久语义更诚实。
 */

const chat = async () => ({ ok: false, error: 'disabled' })

/** 平台桥单例。**没有 `window` 读写**，可以在 Node 里安全 import。 */
export const gp = {
  offline: true,
  player: {
    user: null,
    ready: Promise.resolve({ user: null }),
    requestLogin() {},
    saves: {
      latestSync: null,
      lastError: 'offline',
      putLatest: async () => false,
    },
  },
  room: {
    available: false,
    current: null,
    on: () => () => {},
    create: async () => ({ error: 'offline' }),
  },
  ai: { chat },
}

/** 老名字留着：`game.js` 以外的地方可能还在调（新代码请直接用 `gp`）。 */
export function playerBridge() {
  return gp
}
