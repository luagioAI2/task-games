// 检查「代码里 t("x") 用到的每个键，三种语言都有」。
//
// 缺一个键的症状就是界面上直接显示原始键名（`buyBtn`）—— 不报错、不影响布局、
// 只影响家长看到的那一眼。2026-10-26 就是靠看截图才发现的。
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const ROOT = 'E:/plan/test25/task-games/ropeland'
const { STRINGS } = await import(pathToFileURL(`${ROOT}/i18n.js`).href)
const LANGS = ['zh', 'en', 'ja']
const src = fs.readFileSync(`${ROOT}/game.js`, 'utf8')

// t("literal") 直接取；t("a_" + x) 这类前缀另外按前缀展开
const allLiteral = new Set([...src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1]))
const dynamic = [...src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+_?)"\s*\+/g)].map((m) => m[1])

// ★ `t("w_" + run.weather)` 这种拼接，正则会把 `"w_"` 也当成一个字面量键抓出来
//   ⇒ 报「w_ 缺 zh/en/ja」。下面同时会按前缀 `w_*` 校验 4/4/4，两处结论自相矛盾。
//   前缀本身不是键，跳过。
const prefixes = new Set(dynamic)
const literal = new Set([...allLiteral].filter((k) => !prefixes.has(k)))

let bad = 0
for (const k of [...literal].sort()) {
  const miss = LANGS.filter((l) => !(k in (STRINGS[l] ?? {})))
  if (miss.length) {
    bad++
    console.log(`  ✗ ${k} 缺 ${miss.join('/')}`)
  }
}
console.log(`字面量键 ${literal.size} 个，缺翻译 ${bad} 个`)

// 动态前缀：把每种语言里以该前缀开头的键集合比一比，不一致就是某种语言漏了
for (const pre of [...new Set(dynamic)]) {
  const sets = LANGS.map((l) => Object.keys(STRINGS[l] ?? {}).filter((k) => k.startsWith(pre)).sort())
  const same = sets.every((s) => s.join() === sets[0].join())
  console.log(`  动态前缀 ${pre}* → ${sets.map((s) => s.length).join('/')}`, same ? '✓' : '✗ 三种语言不一致')
  if (!same) {
    const all = new Set(sets.flat())
    for (const l of LANGS) {
      const miss = [...all].filter((k) => !sets[LANGS.indexOf(l)].includes(k))
      if (miss.length) console.log(`      ${l} 缺：${miss.join(', ')}`)
    }
    bad++
  }
}
process.exit(bad ? 1 : 0)
