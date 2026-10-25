/**
 * 存档 / 偏好 / 语言的适配层。
 *
 * ## 为什么需要这一层
 *
 * 原版跑在 MakePlay 的运行时里，存档、语言、字体、触感都挂在全局 `gp` 上：
 *
 * ```js
 * await gp.player.ready
 * const latest = await gp.player.saves.getLatest()      // 存档
 * await gp.player.saves.putLatest(json, "text")
 * gp.player.user?.locale                                 // 语言
 * gp.fonts.url("open-huninn/OpenHuninn.woff2")           // 字体
 * gp.haptics?.selection?.()                              // 触感
 * ```
 *
 * 我们要它在**两种形态**下都能跑：
 *
 * | 形态 | 存档后端 | 语言来源 |
 * | --- | --- | --- |
 * | 独立网页（`npm run dev` / 远程站点） | `localStorage` | `navigator.language` |
 * | 农场插件（`blob:` 模块） | 宿主的 `host.storage` | `ctx.locale` |
 *
 * 所以把这些调用集中到一个 `Store` 接口后面。业务代码只认接口，
 * 不认 `gp` / `localStorage` / `host.storage` 中的任何一个。
 *
 * ## 槽位命名
 *
 * 原版有两个槽：玩法存档（`getLatest` / `putLatest`）和系统设置
 * （`__sys_settings`，存音量/静音/隐藏上下栏）。这里统一成两把键：
 * `save` 和 `settings`。宿主侧直接当 `host.storage` 的两个 key 用
 * （宿主会自动加 `<gameId>:` 前缀）。
 *
 * ⚠️ 宿主的 `storage` 拒绝以 `__` 开头的键（那是宿主保留的
 * `__bundle` / `__coin`），所以这里**不能**沿用原版的 `__sys_settings`。
 */

/** 存档后端。两种实现，见文件末尾。 */
export class Store {
  /**
   * @param {{ get: (k: string) => Promise<unknown>, set: (k: string, v: unknown) => Promise<void> }} backend
   * @param {string | null} locale 宿主给的语言；null = 自己探测
   */
  constructor(backend, locale = null) {
    this.backend = backend
    this.locale = locale
  }

  /** 玩法存档。原版是 `saves.getLatest()`，返回 `{ data }` 或 null。 */
  async loadSave() {
    try {
      const raw = await this.backend.get('save')
      if (!raw) return null
      // 原版存的是 JSON 字符串（`putLatest(JSON.stringify(...), "text")`），
      // 但宿主 storage 能存对象。两种都认，免得换后端就读不出老档。
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {
      console.warn('[cloudfarm] 读存档失败', e)
      return null
    }
  }

  /** 写玩法存档。 */
  async saveGame(state) {
    try {
      await this.backend.set('save', JSON.stringify(state))
      return true
    } catch (e) {
      console.warn('[cloudfarm] 写存档失败', e)
      return false
    }
  }

  /** 系统设置（音量/静音/隐藏上下栏）。 */
  async loadSettings() {
    try {
      const raw = await this.backend.get('settings')
      if (!raw) return null
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      return null
    }
  }

  async saveSettings(obj) {
    try {
      await this.backend.set('settings', JSON.stringify(obj))
      return true
    } catch {
      return false
    }
  }
}

/**
 * 独立网页用的后端：`localStorage`。
 *
 * ⚠️ `localStorage` 在**隐私模式 / 存储配额满 / 被策略禁用**时会**抛**，
 * 不是返回 null。全部 try/catch，失败就当没存档 —— 游戏照常能玩，
 * 只是下次进来是新的。
 */
export function localStorageBackend(prefix = 'cloudfarm:') {
  return {
    async get(k) {
      try {
        return localStorage.getItem(prefix + k)
      } catch {
        return null
      }
    },
    async set(k, v) {
      try {
        localStorage.setItem(prefix + k, v)
      } catch (e) {
        console.warn('[cloudfarm] localStorage 写入被拒', e)
      }
    },
  }
}

/** 插件形态：直接用宿主的 `host.storage`（已带命名空间前缀）。 */
export function hostBackend(host) {
  return {
    get: (k) => host.storage.get(k),
    set: (k, v) => host.storage.set(k, v),
  }
}
