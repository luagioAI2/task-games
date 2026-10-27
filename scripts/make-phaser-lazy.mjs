#!/usr/bin/env node
/**
 * 从 `engines/phaser.min.js` 生成 `engines/phaser-lazy.js` —— **懒加载**版的 Phaser。
 *
 * ```bash
 * node scripts/make-phaser-lazy.mjs           # 生成
 * node scripts/make-phaser-lazy.mjs --check   # 只比对（产物过期就红）
 * ```
 *
 * ## 为什么需要它（2026-10-27 真踩）
 *
 * Phaser 3.90 是 **UMD**，它的 `device/index.js` 在**求值那一刻**就读
 * `window.cordova` / `navigator.standalone`：
 *
 * ```js
 * typeof importScripts != "function" && (window.cordova !== void 0 && …)
 * ```
 *
 * 浏览器里没事。但宿主 `scripts/check-plugin.mjs` 会在 **Node 里真 `import()` 一次**
 * 插件包（这是硬闸门，用来抓「模块顶层碰 window/document」），于是：
 *
 * ```
 * ✗ 包执行失败（import() 抛）
 *     window is not defined
 * ```
 *
 * 而其它十一款游戏用的都是 ES 模块引擎（pixi / three / rapier），顶层不碰 window，
 * 所以只有这一款会红 —— 看着像「插件坏了」，其实只是 UMD 的求值时机问题。
 *
 * ## 做法：把整段 UMD 包进一个函数
 *
 * `phaser.min.js` 原文一个字不动，只在外面套一层：
 *
 * ```js
 * export function ensurePhaser() {
 *   if (typeof globalThis.Phaser !== 'undefined') return globalThis.Phaser
 *   ;(function () { …原文… })()
 *   return globalThis.Phaser
 * }
 * ```
 *
 * UMD 的入口被改成了 `(globalThis, …)`（见 game.js 顶部注释），所以套一层函数
 * 不影响它往哪挂 —— 只是**把求值推迟到 `ensurePhaser()` 被调用的时候**。
 *
 * ⚠️ 包一层 IIFE 而不是直接把原文摊在函数体里：minify 后的顶层 `var e,t,n…`
 *    会污染 `ensurePhaser` 的作用域，将来手改这里极易撞名。
 *
 * ## 为什么还要单独一个文件，不直接改 phaser.min.js
 *
 * `phaser.min.js` 是**上游原件**（换版本时整份替换），改它等于每次升级都要重做一遍
 * 补丁。生成物是派生物，随时可以重跑。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const SRC = path.join(ROOT, 'engines', 'phaser.min.js')
const OUT = path.join(ROOT, 'engines', 'phaser-lazy.js')

if (!fs.existsSync(SRC)) {
  console.error('找不到引擎原件：', SRC)
  process.exit(2)
}

const src = fs.readFileSync(SRC, 'utf8')

// UMD 的入口必须已经被改成 `globalThis`（ES 模块顶层 `this` 是 undefined，
// 原样会在 `t.Phaser=e()` 那行抛）。这条不是「最好有」，是**前提**。
if (!/\}\(globalThis,/.test(src)) {
  console.error('engines/phaser.min.js 的 UMD 入口不是 globalThis —— 换版本后要重新打这个补丁')
  process.exit(2)
}

const out = `/* eslint-disable */
/**
 * ⚠️ 本文件由 \`scripts/make-phaser-lazy.mjs\` 从 \`engines/phaser.min.js\` 生成，**别手改**。
 *
 * 为什么要有这一层：Phaser 是 UMD，求值时会读 \`window\`，而宿主 \`check-plugin.mjs\`
 * 会在 Node 里真 \`import()\` 插件包（抓「模块顶层碰 window」）。套一层函数把求值
 * 推迟到 \`ensurePhaser()\`，Node 里 import 就不会炸。详见生成脚本的注释。
 */
let loaded = false

export function ensurePhaser() {
  if (typeof globalThis.Phaser !== 'undefined') return globalThis.Phaser
  // 已经试过一次但没挂上（比如在没有 DOM 的环境里）⇒ 不要每次调用都重跑 1.1 MB
  if (loaded) return globalThis.Phaser
  loaded = true
  ;(function () {
${src}
  })()
  return globalThis.Phaser
}
`

if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT)) {
    console.error('还没生成 engines/phaser-lazy.js —— 跑 node scripts/make-phaser-lazy.mjs')
    process.exit(1)
  }
  const same = fs.readFileSync(OUT, 'utf8') === out
  if (!same) {
    console.error('engines/phaser-lazy.js 和 phaser.min.js 不一致 —— 重跑本脚本')
    process.exit(1)
  }
  console.log('engines/phaser-lazy.js 是最新的')
  process.exit(0)
}

fs.writeFileSync(OUT, out)
console.log(
  `engines/phaser-lazy.js  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB（源 ${(fs.statSync(SRC).size / 1024).toFixed(0)} KB）`,
)
