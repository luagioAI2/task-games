#!/usr/bin/env node
/**
 * 把整台游戏打成宿主插件：`dist-plugin/farmlord.plugin.mjs` + 同级资源。
 *
 * 插件源码在 `plugin-template.mjs`（一份能直接读的普通文件），
 * 这里只做三件填充：`__MANIFEST__` / `__BODY__` / `__SCRIPTS__`。
 *
 * ## 为什么用「模板文件 + 占位符」而不是在脚本里拼模板字符串
 *
 * 第一版把整段插件源码写在 `const plugin = ` + "`...`" + ` 里，结果注释里的反引号
 * （比如提到 ` + "`main.js`" + `）直接把模板字符串**提前闭合**了 ——
 * `node --check` 报的是「Unexpected identifier」，指向的位置却在一百行以外，
 * 完全看不出是引号的问题。模板单独放一个文件就不会有这类转义地雷。
 *
 * ## 经济口径
 *
 * 「只花积分」（2026-11-08 用户选的 B）：游戏内的钱/宝石**不出农场**，
 * 也没有「币 → 兑换券」的出口 ⇒ `voucherPerCoin: 0`、`expectedPayout: 0`。
 *
 * ⚠️ **先不收积分**（2026-11-08 用户第二次拍板）：`playCost` 只能是正数
 * （`checkPluginEconomy` 硬校验），所以填 `1` 当占位，**插件里一行扣分都没有**。
 * 详情页那行会显示「一局 1 积分」—— 那是 manifest 声明的价，实际不扣。
 * 真要开始收的时候：改成 20，并在 `plugin-template.mjs` 挂载前按
 * `host.spendPoints(...)` 那套（参考 `hoopsneak` 的 `chargePlay`）收，
 * 别忘了「作物最短 10 分钟成熟」⇒ 按次收会把「回来看一眼」变成收费动作。
 */
import fs from 'node:fs'
import path from 'node:path'
import { existsSync } from 'node:fs'

const GAME = path.resolve(process.argv[2] ?? 'E:/plan/test25/task-games/farmlord')
const OUT = path.join(GAME, 'dist-plugin')

const MANIFEST = {
  id: 'farmlord',
  name: '我是一个农场主',
  emoji: '🌾',
  tabLabel: '农场主',
  version: '1.0.1',
  minHostApi: 4,
  coin: { id: 'crop', name: '庄稼', emoji: '🌾' },
  economy: {
    // 占位值：先不收积分（理由见文件头「经济口径」）。校验要求必须 > 0。
    playCost: 1,
    expectedPayout: 0,
    /*
     * ⚠️ `capPerPrize` 必须 ≥ 1（`checkPluginEconomy` 硬校验），填 0 会在
     * **装包那一刻**报「经济参数不合法（cap）：capPerPrize 必须 ≥ 1」——
     * 不是打包时报，是玩家点安装才报。这一款一分产出都没有，
     * 这个上限实际用不到，但契约要求它在。
     */
    capPerPrize: 1,
    voucherPerCoin: 0,
  },
}

/* 必须一起发布的文件（顺序无关，但**一个都不能少**） */
const FILES = [
  'style.css',
  'main.js',
  'tutorial.js',
  'i18n.js',
  'gem-packs.js',
  'gp-bridge.js',
  'local-server.js',
  'sound.manifest.json',
  'sound.pack',
]
const DIRS = ['assets', 'runtime']

/* ------------------------------- 前置检查 ------------------------------- */

const need = ['index.html', 'plugin-template.mjs', ...FILES, ...DIRS]
const missing = need.filter((f) => !existsSync(path.join(GAME, f)))
if (missing.length) {
  console.error('✗ 缺文件：' + missing.join(', '))
  process.exit(2)
}

const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8')
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
if (!bodyMatch) {
  console.error('✗ index.html 里找不到 <body>')
  process.exit(2)
}

/* body 里原来的三条 module 脚本由插件自己重新拼（要加 assetBase 前缀），
   其余标记原样搬过去。importmap 在 head 里，也不搬。 */
const bodyHtml = bodyMatch[1]
  .replace(/<script\b[^>]*type="module"[^>]*><\/script>\s*/gi, '')
  .trim()

const scriptOrder = ['gp-bridge.js', 'main.js?v=20', 'tutorial.js?v=20']

/* ------------------------------- 生成插件 ------------------------------- */

const tpl = fs.readFileSync(path.join(GAME, 'plugin-template.mjs'), 'utf8')

const filled = tpl
  .replace('__MANIFEST__', () => JSON.stringify(MANIFEST, null, 2))
  .replace('__BODY__', () => JSON.stringify(bodyHtml))
  .replace('__SCRIPTS__', () => JSON.stringify(scriptOrder))

for (const marker of ['__MANIFEST__', '__BODY__', '__SCRIPTS__']) {
  if (filled.includes(marker)) {
    console.error('✗ 占位符没替换掉：' + marker)
    process.exit(3)
  }
}

/* ------------------------------- 落盘 ------------------------------- */

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

fs.writeFileSync(path.join(OUT, 'farmlord.plugin.mjs'), filled, 'utf8')

let copied = 0
let bytes = 0
for (const f of FILES) {
  const src = path.join(GAME, f)
  fs.copyFileSync(src, path.join(OUT, f))
  copied++
  bytes += fs.statSync(src).size
}
for (const d of DIRS) {
  fs.cpSync(path.join(GAME, d), path.join(OUT, d), { recursive: true })
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else {
        copied++
        bytes += fs.statSync(p).size
      }
    }
  }
  walk(path.join(OUT, d))
}

console.log('✓ ' + path.join(OUT, 'farmlord.plugin.mjs'))
console.log('  插件 ' + (filled.length / 1024).toFixed(0) + 'K · 资源 ' + copied + ' 个 ' + (bytes / 1024 / 1024).toFixed(1) + 'M')
console.log('  manifest: ' + MANIFEST.id + ' / ' + MANIFEST.name + ' / v' + MANIFEST.version + ' / minHostApi ' + MANIFEST.minHostApi)
