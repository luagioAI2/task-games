import { readFileSync, writeFileSync } from 'node:fs'

const s = readFileSync(new URL('./main.js', import.meta.url), 'utf8')

function grab(name) {
  // 匹配 `var NAME=` / `,NAME=` 后面到配对的括号
  const re = new RegExp('(?:^|[,;]|var |let |const )' + name + '\\s*=\\s*')
  const m = re.exec(s)
  if (!m) throw new Error('not found: ' + name)
  let i = m.index + m[0].length
  const open = s[i]
  if (open !== '[' && open !== '{') throw new Error(name + ' not literal: ' + s.slice(i, i + 40))
  const close = open === '[' ? ']' : '}'
  let d = 0
  let end = -1
  let inStr = false
  let q = ''
  for (let j = i; j < s.length; j++) {
    const ch = s[j]
    if (inStr) {
      if (ch === '\\') j++
      else if (ch === q) inStr = false
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true
      q = ch
      continue
    }
    if (ch === open) d++
    else if (ch === close) {
      d--
      if (d === 0) {
        end = j + 1
        break
      }
    }
  }
  if (end < 0) throw new Error('unbalanced: ' + name)
  return s.slice(i, end)
}

function evalIt(src) {
  // 表里只有字面量（字符串/数字/数组/对象），可以直接求值
  return new Function('return (' + src + ')')()
}

const raw = {
  crops: grab('Pe'),
  animals: grab('Ru'),
  dogs: grab('je'),
  decor: grab('bt'),
  fert: grab('pu'),
  feed: grab('Ne'),
  dogfood: grab('Le'),
  plotCost: grab('yt'),
  penCost: grab('Et'),
  soil: grab('wt'),
  start: grab('Ie'),
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))

const crops = evalIt(raw.crops).map((c) =>
  pick(c, ['id', 'lv', 'seed', 'sell', 'yield', 'exp', 'grow', 'seasons', 'regrow', 'soil']),
)
const animals = evalIt(raw.animals).map((a) =>
  pick(a, ['id', 'lv', 'price', 'grow', 'make', 'yield', 'sell', 'exp', 'eats', 'product']),
)
const dogs = evalIt(raw.dogs).map((d) => pick(d, ['id', 'price', 'gems', 'catch']))
const decor = evalIt(raw.decor).map((d) => pick(d, ['id', 'lv', 'price', 'gems', 'slot']))
const fert = evalIt(raw.fert)
const feed = pick(evalIt(raw.feed), ['price'])
const dogfood = pick(evalIt(raw.dogfood), ['price', 'days'])
const plotCost = evalIt(raw.plotCost)
const penCost = evalIt(raw.penCost)
const soil = evalIt(raw.soil)
const start = evalIt(raw.start)

const out = {
  crops,
  animals,
  dogs,
  decor,
  fert,
  feed,
  dogfood,
  plotCost,
  penCost,
  soil,
  start,
}

console.log(JSON.stringify(out, null, 2))
writeFileSync(new URL('./_tables.json', import.meta.url), JSON.stringify(out, null, 2))
