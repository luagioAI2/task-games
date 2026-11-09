import fs from 'node:fs'

const src = fs.readFileSync(new URL('../i18n.js', import.meta.url), 'utf8')

function block(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*\\{').exec(src)
  if (!m) throw new Error('no block: ' + name)
  const from = m.index + m[0].length - 1
  let depth = 0
  let quote = null
  let i = from
  for (; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) break }
  }
  return new Function(`return ${src.slice(from, i + 1)}`)()
}

const dicts = { zh: block('zh'), en: block('en'), ja: block('ja') }
const keys = Object.fromEntries(Object.entries(dicts).map(([k, v]) => [k, Object.keys(v).sort()]))

console.log('键数:', Object.entries(keys).map(([k, v]) => `${k}=${v.length}`).join('  '))

let bad = false
for (const lang of ['en', 'ja']) {
  const only = keys[lang].filter(k => !keys.zh.includes(k))
  const miss = keys.zh.filter(k => !keys[lang].includes(k))
  if (only.length) { bad = true; console.log(`只在 ${lang}:`, only.join(', ')) }
  if (miss.length) { bad = true; console.log(`${lang} 缺:`, miss.join(', ')) }
}
console.log(bad ? '✗ 键集不一致' : '✓ 三语键集一致')
process.exit(bad ? 1 : 0)
