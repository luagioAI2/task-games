#!/usr/bin/env node
/**
 * 静态资源自检：把 ALL_TEXTURES / ANIM_PACKS 真的**求值**出来，
 * 逐个检查磁盘上是否存在，并检查动画包的 pages / frame 布局。
 *
 * 为什么必须求值而不是 grep：这些路径是 `Array.from({length:16})` 和
 * `ANIMALS.map(...)` 生成的，源码里根本没有字面量。
 *
 * 用法: node scripts/check-assets.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const ASSETS = join(ROOT, 'assets')

/**
 * 从源文件里抠出一个 `export const NAME = <expr>;` 并返回 <expr>。
 *
 * ⚠️ 不能用 `/^export const NAME = (.*?);$/m` —— ANIMALS 是多行数组，
 * 非贪婪会截在第一个「行尾分号」。这里按括号配对扫，能处理跨行的对象/数组。
 */
function extractConst(file, name) {
  const txt = readFileSync(join(SRC, file), 'utf8')
  const decl = `export const ${name}`
  let i = txt.indexOf(decl)
  if (i < 0) return null
  i = txt.indexOf('=', i + decl.length)
  if (i < 0) return null
  i++ // 跳过 '='
  let depth = 0
  let started = false
  let quote = null
  for (let j = i; j < txt.length; j++) {
    const c = txt[j]
    const prev = txt[j - 1]
    if (quote) {
      if (c === quote && prev !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; started = true; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; started = true; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; continue }
    if (c === ';' && depth === 0 && started) return txt.slice(i, j).trim()
    if (!started && !/\s/.test(c)) started = true
  }
  return null
}

const parts = []
for (const [file, name] of [
  ['data/catalog.js', 'ANIMALS'],
  ['world.js', 'SLEEP_POSE'],
  ['world.js', 'ALL_TEXTURES'],
  ['world.js', 'ANIM_PACKS'],
]) {
  const expr = extractConst(file, name)
  if (expr == null) {
    console.error(`✗ 没能从 ${file} 抠出 ${name}`)
    process.exit(1)
  }
  parts.push(`const ${name} = ${expr};`)
}

let env
try {
  env = new Function(`const pad = (n) => String(n).padStart(2, "0");
${parts.join('\n')}
return { ALL_TEXTURES, ANIM_PACKS };`)()
} catch (e) {
  console.error('✗ 求值失败:', e.message)
  process.exit(1)
}

const { ALL_TEXTURES, ANIM_PACKS } = env
console.log(`ALL_TEXTURES: ${ALL_TEXTURES.length} 条`)
console.log(`ANIM_PACKS : ${Object.keys(ANIM_PACKS).length} 个`)

const missing = []
let ok = 0
for (const rel of ALL_TEXTURES) {
  if (existsSync(join(ASSETS, rel))) ok++
  else missing.push(rel)
}

const animProblems = []
let animFiles = 0
for (const [kind, pack] of Object.entries(ANIM_PACKS)) {
  const mf = join(ASSETS, pack, 'manifest.json')
  if (!existsSync(mf)) { animProblems.push(`${kind}: 缺 manifest.json`); continue }
  const m = JSON.parse(readFileSync(mf, 'utf8'))
  for (const pg of m.pages || []) {
    if (existsSync(join(ASSETS, pack, pg))) animFiles++
    else animProblems.push(`${kind}: 缺页 ${pg}`)
  }
  const f = m.frame
  if (f) {
    const per = f.cols * f.rows
    const need = Math.ceil(f.count / per)
    if (need > (m.pages || []).length) {
      animProblems.push(`${kind}: ${f.count} 帧 / 每页 ${per} = 需要 ${need} 页，只有 ${(m.pages || []).length} 页`)
    }
  }
}

const UI_ICONS = ['animals', 'bag', 'fish', 'gear', 'hat', 'log', 'market', 'seeds']
const missingUi = UI_ICONS.filter(k => !existsSync(join(ASSETS, 'ui', `${k}.webp`)))

console.log(`\n静态贴图    : ${ok}/${ALL_TEXTURES.length} 存在`)
console.log(`UI 图标     : ${UI_ICONS.length - missingUi.length}/${UI_ICONS.length} 存在`)
console.log(`动画包页文件 : ${animFiles} 个存在`)

if (missing.length) {
  console.log(`\n✗ 缺 ${missing.length} 个静态贴图:`)
  for (const m of missing.slice(0, 20)) console.log('   ', m)
}
if (missingUi.length) console.log(`\n✗ 缺 UI 图标: ${missingUi.join(', ')}`)
if (animProblems.length) {
  console.log(`\n✗ 动画包问题 ${animProblems.length} 条:`)
  for (const m of animProblems) console.log('   ', m)
}

const bad = missing.length + missingUi.length + animProblems.length
if (bad === 0) console.log('\n✓ 全部资源就位')
else { console.log(`\n✗ 共 ${bad} 个问题`); process.exit(1) }
