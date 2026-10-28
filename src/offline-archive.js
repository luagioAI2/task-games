/**
 * offline-archive.js —— 「录像库 / 世界排行榜」的**永久离线**替身。
 *
 * ## 原版是什么
 *
 * `archive-client.js` 是这款游戏唯一的重联网面：它通过 `gp.room` 开一个官方房间，
 * 用**分片 JSON 消息**跟服务端换两样东西：
 *
 * | 调用 | 换什么 | 影响什么 |
 * | --- | --- | --- |
 * | `sample(mode)` | 3 段真人录像（`replays`） | 赛道上的 3 个对手换成真人影子 |
 * | `board(mode)` | 世界排行榜前 N 名 | 「世界排行榜」弹层 |
 * | `upload({...})` | 把这一局传上去 | 结算页的「已上榜 · 第 N 名」 |
 *
 * ## 插件里为什么整条拆掉
 *
 * 它要**登录**（`gp.player.user`）、要**开房间**（`plan_required` / `rooms_disabled`
 * 之类服务端开关）、还要传用户画的马和名字 —— 三件在离线 App 里都不成立。
 *
 * 拆法不是删代码，而是**换实现**：接口一模一样，恒返回离线。
 * 于是 `game.js` 的调用点一行都不用改：
 *
 *   - `sample()` 失败 ⇒ `replays = []` ⇒ 对手是 `preset(i+1)` 的**电脑选手**（原版本来就有 bot 补位）；
 *   - `board()` / `upload()` 失败 ⇒ 弹层显示「暂时不可用」。
 *
 * ★ 弹层入口在 `game.js` 里**直接藏掉**（`#world-board-open` / `#world-board-result`），
 *   否则用户会点进一个只会转圈然后报错的按钮 —— 「功能坏了」和「没这个功能」
 *   在孩子眼里是同一件事，但后者不该出现。
 *
 * ★ 为什么不去删 `archive-client.js`：它记录了原版的协议形状（分片 5500 字符、
 *   最多 40 片、60 秒超时），将来真要接回来是照着改，不是重写。
 */

/** 恒离线的状态串。`game.js` 拿它去 `t(status)` 显示一行小字。 */
const STATUS = 'archiveOffline'

const offline = async () => ({ ok: false, error: 'offline' })

/**
 * @param {() => void} [onStatus] 状态变化回调（`game.js` 用它刷新左下角那行小字）
 */
export function createOfflineArchive(onStatus) {
  // 只在第一次建的时候报一次状态，后面全静默 —— 这个回调会触发 DOM 写入
  let announced = false
  const announce = () => {
    if (announced) return
    announced = true
    try {
      onStatus?.()
    } catch {
      /* 渲染还没建好就调了，忽略 */
    }
  }
  announce()

  return {
    /** 原版会 `await gp.player.ready` 再开房间。这里直接说「不可用」。 */
    enter: async () => ({ error: 'unavailable' }),
    request: offline,
    sample: offline,
    board: offline,
    upload: offline,
    get status() {
      return STATUS
    },
    get connected() {
      return false
    },
    inspect: () => ({ status: STATUS, live: false, connected: false, rtt: null, pending: 0 }),
    dispose() {},
  }
}
