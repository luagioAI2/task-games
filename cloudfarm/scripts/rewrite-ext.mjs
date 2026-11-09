#!/usr/bin/env node
/**
 * 把源码里的图片引用从 .png/.jpg 改成 .webp。
 *
 * 为什么写成脚本而不是手改：引用点散在 world.js 的 ALL_TEXTURES 数组（含
 * `Array.from` / `ANIMALS.map` 这种情况）和 ui.js 的一堆字符串里，手改必漏。
 *
 * 规则刻意收窄 —— **只匹配「扩展名紧跟引号或反引号」和那一处去扩展名的正则**。
 * 不写宽泛的 `(png|jpg)` 替换：那会连正则表达式本身一起改，是最典型的
 * 「批量替换看着成功、其实改坏」。
 *
 * 用法: node scripts/rewrite-ext.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry-run')
const FILES = ['src/game.js', 'src/world.js', 'src/ui.js']

/** 每处替换都用一个「字符串 → 字符串」的精确对，便于计数与回读。 */
const RULES = [
  // 引号/反引号结尾的图片路径
  { find: '.png"', repl: '.webp"' },
  { find: ".png'", repl: ".webp'" },
  { find: '.png`', repl: '.webp`' },
  { find: '.jpg"', repl: '.webp"' },
  { find: ".jpg'", repl: ".webp'" },
  { find: '.jpg`', repl: '.webp`' },
  // game.js:82 把扩展名剥掉当 tex 的 key。ALL_TEXTURES 现在全是 .webp，
  // 不改这里的话 key 会变成 "bg/ranch.webp" 而 world.js 查的是 "bg/ranch"。
  { find: '/\\.(png|jpg)$/', repl: '/\\.(webp)$/' },
]

let grand = 0
for (const rel of FILES) {
  const p = join(ROOT, rel)
  const before = readFileSync(p, 'utf8')
  let after = before
  const hits = []
  for (const { find, repl } of RULES) {
    const n = after.split(find).length - 1
    if (n > 0) {
      after = after.split(find).join(repl)
      hits.push(`${JSON.stringify(find)} x${n}`)
    }
  }
  if (after === before) {
    console.log(`${rel}: 无变化`)
    continue
  }
  grand += hits.length
  console.log(`${rel}: ${hits.join(', ')}`)
  if (!DRY) writeFileSync(p, after)
}

console.log(DRY ? '\n[dry-run] 未写入' : `\n完成`)
