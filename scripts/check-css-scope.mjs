#!/usr/bin/env node
/**
 * 验 `ui.js` 里的 `scopeCss()` 真的把 CSS 作用域收进 `#ui` 了。
 *
 * 为什么值得单独一个脚本：它是**纯字符串处理、不做 CSS 解析**，一旦
 * CSS 的书写风格变了（比如有人改成 SCSS 嵌套），它会静默失效 ——
 * 而症状是「宿主的布局莫名其妙变了」，没人会联想到插件。
 *
 * 判据（按重要性）：
 *  1) 输出里不能再有裸的顶层选择器（每条规则的选择器要么 #ui、要么 html）
 *  2) `@keyframes` 的**名字**不能被前缀（前缀了动画直接不生效）
 *  3) `@media` 内部的规则仍要被作用域化（只包外层是不够的）
 *  4) 至少存在几条已知的裸选择器，证明这份 CSS 确实需要作用域化
 *
 * 用法: node scripts/check-css-scope.mjs
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UI = readFileSync(join(ROOT, 'src/ui.js'), 'utf8')

// 从 ui.js 里抠出 CSS 常量与三个函数，放进沙箱跑
function grab(re, what) {
  const m = UI.match(re)
  if (!m) {
    console.error(`✗ 没能从 ui.js 抠出 ${what}`)
    process.exit(1)
  }
  return m[0]
}

const cssDecl = grab(/const CSS = `[\s\S]*?\n`;/, 'CSS')
// CSS 模板里插值了这些常量，必须一起注入（手抄值会走样，直接抠声明）
const constDecls =
  grab(/const C = \{[\s\S]*?\n\};/, 'C') + '\n' +
  // `const R = 14, RL = 22;` 写在同一行 —— 一次抠出来，别分两条
  grab(/const R = [^\n]*;/, 'R/RL') + '\n' +
  grab(/const FONT = [^\n]*;/, 'FONT') + '\n' +
  grab(/const FONT_JA = [^\n]*;/, 'FONT_JA') + '\n' +
  grab(/const SH1 = [^\n]*;/, 'SH1') + '\n' +
  grab(/const SH2 = [^\n]*;/, 'SH2') + '\n' +
  grab(/const SH3 = [^\n]*;/, 'SH3') + '\n' +
  grab(/const GLASS = [^\n]*;/, 'GLASS') + '\n' +
  grab(/const GLASS_SOLID = [^\n]*;/, 'GLASS_SOLID') + '\n' +
  grab(/const BLUR = [^\n]*;/, 'BLUR') + '\n' +
  grab(/const TXT_SH = [^\n]*;/, 'TXT_SH')
const scopeCssFn = grab(/function scopeCss\(css\) \{[\s\S]*?\n\}/, 'scopeCss')
const scopeAtRuleFn = grab(/function scopeAtRule\(block\) \{[\s\S]*?\n\}/, 'scopeAtRule')
const scopeRuleFn = grab(/function scopeRule\(rule\) \{[\s\S]*?\n\}/, 'scopeRule')

let out
try {
  out = new Function(
    `${constDecls}
     ${cssDecl}
     ${scopeCssFn}
     ${scopeAtRuleFn}
     ${scopeRuleFn}
     return { raw: CSS, scoped: scopeCss(CSS) };`
  )()
} catch (e) {
  console.error('✗ 求值失败:', e.message)
  process.exit(1)
}

const { raw, scoped } = out
// 解析前先把**注释抹掉**。
//
// 2026-10-24 踩过：`scopeCss` 修好「注释紧挨 @media 会被当成选择器、整块被浏览器丢掉」
// 之后，它会把注释**原样单独输出**一行。于是这里的解析器读到的是
// 「一行注释 + 换行 + #ui .hud」，`startsWith('#ui')` 判否 ⇒ 报了 12 个
// **假裸选择器**。而修之前之所以是绿的，是因为那时注释被塞进了选择器里，
// 检查器等于在验一个畸形选择器 —— 绿得没有意义。
const scopedNoComments = scoped.replace(/\/\*[\s\S]*?\*\//g, '')
const problems = []

console.log(`原始 CSS ${raw.length} 字符 → 作用域化 ${scoped.length} 字符`)

// ① 顶层裸选择器
const topLevelSels = []
{
  let depth = 0
  let buf = ''
  for (let i = 0; i < scopedNoComments.length; i++) {
    const c = scopedNoComments[i]
    if (c === '{') {
      const sel = buf.trim()
      if (depth === 0 && sel && !sel.startsWith('@')) topLevelSels.push(...sel.split(',').map(s => s.trim()))
      buf = ''
      depth++
    } else if (c === '}') { depth--; buf = '' }
    else if (depth === 0) buf += c
    else if (c === '\n') buf = ''
  }
}
const bare = topLevelSels.filter(s => s && !s.startsWith('#ui') && !s.startsWith('html'))
if (bare.length) problems.push(`还有 ${bare.length} 个裸选择器: ${bare.slice(0, 8).join(' | ')}`)

// ② keyframes 名字
const kfRaw = [...raw.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map(m => m[1])
const kfScoped = [...scoped.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)].map(m => m[1])
if (kfRaw.length !== kfScoped.length) {
  problems.push(`keyframes 数量变了: ${kfRaw.length} → ${kfScoped.length}`)
} else if (kfRaw.join(',') !== kfScoped.join(',')) {
  problems.push(`keyframes 名字被改了: ${kfRaw.join(',')} → ${kfScoped.join(',')}`)
}

// ③ @media 内部的规则 —— **每一块都要查**（原来只查第一块，后面新加的窄屏规则等于没被检查）
{
  // scopeCss 输出的每块都以行首 `}` 收尾，所以按「行首 }」切块是可靠的
  const blocks = [...scopedNoComments.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g)]
  let total = 0
  const innerBare = []
  for (const b of blocks) {
    const inner = [...b[1].matchAll(/(?:^|\n)([^\n{@}][^\n{]*)\{/g)].map((m) => m[1].trim())
    total += inner.length
    innerBare.push(...inner.filter((s) => s && !s.startsWith('#ui') && !s.startsWith('html')))
  }
  if (blocks.length && innerBare.length) problems.push(`@media 内有 ${innerBare.length} 个裸选择器: ${innerBare.slice(0, 5).join(' | ')}`)
  console.log(`@media ${blocks.length} 块 / 规则 ${total} 条，裸的 ${innerBare.length} 条`)
  if (blocks.length < 2) problems.push(`只找到 ${blocks.length} 块 @media —— 窄屏规则可能又丢了（2026-10-24 的坑）`)
}

// ④ 已知裸选择器确实存在过（证明这个检查不是空转）
const known = ['.row', '.grid', '.item', '.modal', '.btn']
const present = known.filter(k => new RegExp(`(^|\\n)\\s*${k.replace('.', '\\.')}[\\s,{:]`).test(raw))
if (present.length < 3) {
  problems.push(`源 CSS 里这些通用类居然不存在: ${known.join(', ')} —— 检查可能没命中真东西`)
} else {
  console.log(`源 CSS 里确实有这些通用类: ${present.join(', ')}`)
}

if (problems.length) {
  console.log('\n✗ 问题:')
  for (const p of problems) console.log('  -', p)
  process.exit(1)
}
console.log('\n✓ CSS 作用域化正确')
