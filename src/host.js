/**
 * 宿主存档适配 —— 把**异步**的 `host.storage` 包成**同步**的 `get/set`。
 *
 * ## 为什么需要这一层
 *
 * `game.js` 里读存档的地方有十几处，而且都在「决定初始状态」的路径上
 * （金币 / 世界 / 等级 / 特殊蚂蚁 / 语言 / 音频偏好 / lastSeen）。
 * 那些语句是同步写的，改成一串 `await` 会把启动流程拆成十几帧，
 * 而且很容易漏掉一处 —— 漏掉的那处读到 `undefined`，表现为「进度没恢复」，
 * **不报错**。
 *
 * 所以：挂载时 `preload()` 一次性把整份存档读进内存，之后读走内存、
 * 写走内存并标记脏键，卸载时 `flush()` 一次落盘。
 *
 * ## 两条硬规矩
 *
 * ★★ **模块顶层不许碰 `window` / `document`**：宿主的 `check-plugin.mjs`
 *   会在 Node 里真 `import()` 这个包，顶层碰浏览器全局直接抛。
 *
 * ★★ **`preload()` 必须在 `start()` 之前 await 完**。写在 start 里面、
 *   又放在读存档之后，等于没等 —— 读到的永远是空 Map。
 */

/** @typedef {{ list(): Promise<Record<string, unknown>>, get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }} HostStorage */

const DELETED = Symbol('deleted')

/**
 * @param {HostStorage} storage 宿主的 `host.storage`
 */
export function makeHostStore(storage) {
  /** @type {Map<string, unknown>} 已读进内存的存档 */
  const cache = new Map()
  /** @type {Map<string, unknown>} 待落盘的键（`DELETED` = 删除） */
  const pending = new Map()

  return {
    /** 一次性把整份存档读进内存。**在 start() 之前 await。** */
    async preload() {
      const all = await storage.list()
      for (const [k, v] of Object.entries(all)) cache.set(k, v)
    },

    /** 同步读。没写过的键返回 `undefined`（`loadSave()` 靠这个判「新档」）。 */
    get(key) {
      return cache.has(key) ? cache.get(key) : undefined
    },

    /** 同步写：立刻进内存，等 `flush()` 才落盘。 */
    set(key, value) {
      cache.set(key, value)
      pending.set(key, value)
    },

    remove(key) {
      cache.delete(key)
      pending.set(key, DELETED)
    },

    /**
     * 把所有脏键落盘。卸载时 await 它。
     * 单个键失败只 warn —— 丢一次进度不该拦住宿主切 tab。
     */
    async flush() {
      const keys = [...pending.keys()]
      const jobs = keys.map(async (k) => {
        const v = pending.get(k)
        pending.delete(k)
        try {
          await storage.set(k, v === DELETED ? null : v)
        } catch (e) {
          console.warn('[anthill] 存档落盘失败', k, e)
        }
      })
      await Promise.all(jobs)
    },
  }
}
