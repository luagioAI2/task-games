/**
 * 独立版入口 —— **只负责接线，不含任何游戏逻辑**。
 *
 * 游戏本体在 `app.ts` 的 `createClawApp()` 里，那是一个可以挂载 / 卸载的工厂；
 * 这里做的是「把它接到一个真实网页上」：
 *
 * | 依赖 | 独立版给什么 | 插件版给什么（`plugin/index.ts`） |
 * | --- | --- | --- |
 * | 根节点 | `document.body` | 容器里的 `.claw-root` |
 * | 存档 | `localStorage` | 宿主的 `HostApi.storage`（`gameKv` 表） |
 * | 币 | `localStorage` 里一个数，用完可免费领 | 宿主的账本（积分买币，只进不出） |
 * | 奖品 | 只记在背包里（没有兑换券这个概念） | `host.mintVoucher()` 直接发兑换券 |
 *
 * 这份拆分是 2026-10-23 做的。之前 `main.ts` 是**模块求值即开机**，
 * 想把它塞进宿主就得整份复制一遍 —— 两份源码走散只是时间问题。
 */
import './style.css'
import { createClawApp, type ClawKv, type ClawWallet } from './app.ts'

/** 独立版的存档：localStorage。插件里这份会被宿主的 `gameKv` 顶掉。 */
const kv: ClawKv = {
  async get(k) { return localStorage.getItem('claw_' + k) ?? undefined },
  async set(k, v) { localStorage.setItem('claw_' + k, v) },
}

const KEY_COINS = 'claw_coins'
const clamp = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0))

/**
 * 独立版的钱包 —— **故意和插件版不是一回事**。
 *
 * 独立版没有家长在看，也没有账本，所以沿用原来的规则：默认 10 个币，
 * 用完了可以「领取 10 币」接着玩。插件版**绝不能**照抄这一条：
 * 白送 10 个币 = 白送 10 局，而每局都有期望产出 ⇒ 直接变成刷券入口。
 */
function makeStandaloneWallet(): ClawWallet {
  let coins = clamp(Number(localStorage.getItem(KEY_COINS) ?? 10))
  const save = () => localStorage.setItem(KEY_COINS, String(coins))

  return {
    get coins() { return coins },
    get points() { return 0 },

    async pay(cost) {
      const n = clamp(cost)
      if (n <= 0) return true
      if (coins < n) return false
      coins -= n
      save()
      return true
    },

    /** 独立版没有兑换券，奖品只进背包。 */
    async award() { return 0 },

    recharge: {
      label: '领取 10 币',
      hint: '今日免费补给：领取 10 个游戏币继续玩',
      async run() {
        coins += 10
        save()
        return true
      },
    },
  }
}

const wallet = makeStandaloneWallet()

createClawApp({
  root: document.body,
  kv,
  wallet,
  standalone: true,
  // 独立版的走查脚本（`test/`、`screenshots/`）一直用这个句柄
  debug: true,
}).catch((e) => {
  console.error(e)
  const txt = document.getElementById('loadTxt')
  if (txt) txt.textContent = '加载失败: ' + (e instanceof Error ? e.message : String(e))
})
