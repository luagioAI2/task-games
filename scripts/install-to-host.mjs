#!/usr/bin/env node
/**
 * 把打包产物装进宿主：`kid-quest-farm-2d/public/games/cellguard/`。
 *
 * ```bash
 * node scripts/install-to-host.mjs            # 装（会改宿主的 index.json）
 * node scripts/install-to-host.mjs --check    # 只比对，不写
 * ```
 *
 * ## 本作只有一个文件
 *
 * 美术是程序化绘制、音频列表是空的 ⇒ `dist-plugin/` 里**只有那一个 `.mjs`**，
 * 没有 `assets/`、没有 `sound.pack`、没有字体。所以这里没有 `ROOT_FILES` 段 ——
 * 抄别款那份过来只会去拷不存在的源文件（`ENOENT`，报错长得像磁盘坏了）。
 *
 * ★ 但 `assetBase` 仍写成 `${ID}/`：契约要求清单里那一栏恒在，
 *   将来要加资源时不用再改宿主。
 *
 * ## 它做三件事，**不做**第四件
 *
 * 1. 拷 `dist-plugin/cellguard.plugin.mjs` → `<host>/public/games/cellguard/`
 * 2. 更新 `<host>/public/games/index.json` 里 `id === 'cellguard'` 那一条（没有就追加）
 * 3. 跑 `make-local-catalog.mjs` 重算 `localGames.ts` 里的哈希
 *
 * **不做的**：`src/games/storefront.ts` 的文案、`GameIcon.tsx` 的图标、
 * `scripts/build-store-shots.py` 的 `PLAN` —— 那是人写的内容，漏了不报错，
 * 只会让详情页显示上一款游戏的图和话；`npm run check:registry` 与 `npm test` 专门查这件事。
 *
 * ## 为什么版本号必须一起改
 *
 * 宿主只比 `installed.version === g.version` 判断「要不要更新」。改了包没升版本
 * ⇒ 界面说「已是最新」，跑的还是旧的，**零报错**。版本的唯一真相是 `plugin.js`
 * 里 `manifest.version`，这里从**包里**读，不写第二份。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const CHECK = process.argv.includes('--check')

const ID = 'cellguard'
const NAME = '细胞守卫'
const BUNDLE = path.join(ROOT, 'dist-plugin', `${ID}.plugin.mjs`)
const DEST = path.join(HOST, 'public', 'games', ID)
const INDEX = path.join(HOST, 'public', 'games', 'index.json')

for (const [label, p] of [
  ['dist-plugin 里的包（先跑 node scripts/build-plugin.mjs）', BUNDLE],
  ['宿主仓库', HOST],
]) {
  if (!fs.existsSync(p)) {
    console.error(`缺 ${label}：`, p)
    process.exit(2)
  }
}

// manifest 的 version 是唯一真相 —— 从包里读
const code = fs.readFileSync(BUNDLE, 'utf8')
const vm = code.match(/version:\s*["']([^"']+)["']/)
if (!vm) {
  console.error('包里的 manifest 没找到 version 字段')
  process.exit(2)
}
const version = vm[1]

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
const entry = { id: ID, name: NAME, version, file: `${ID}/${ID}.plugin.mjs`, assetBase: `${ID}/` }
const at = index.games.findIndex((g) => g.id === ID)
const before = at >= 0 ? index.games[at] : null

const kb = (n) => (n / 1024).toFixed(0)

if (CHECK) {
  const problems = []
  const destBundle = path.join(DEST, `${ID}.plugin.mjs`)
  if (!fs.existsSync(destBundle)) problems.push('宿主里还没有这个包')
  else if (!fs.readFileSync(destBundle).equals(fs.readFileSync(BUNDLE))) {
    problems.push('宿主里的包和 dist-plugin 不是同一份（没装最新构建）')
  }
  if (!before) problems.push(`index.json 里没有 ${ID} 这一条`)
  else if (before.version !== version) problems.push(`index.json 版本 ${before.version} ≠ 包里 ${version}`)

  if (problems.length) {
    console.error('没装好：')
    for (const p of problems) console.error('  -', p)
    process.exit(1)
  }
  console.log(`已装好：${entry.file} v${version}（${kb(fs.statSync(BUNDLE).size)} KB）`)
  process.exit(0)
}

// ---- 1) 拷贝 ----
fs.mkdirSync(DEST, { recursive: true })
fs.copyFileSync(BUNDLE, path.join(DEST, `${ID}.plugin.mjs`))
console.log(`拷贝  public/games/${ID}/${ID}.plugin.mjs  ${kb(fs.statSync(BUNDLE).size)} KB`)

// ---- 2) index.json ----
if (before) {
  if (before.version !== version) console.log(`版本  ${before.version} → ${version}`)
  index.games[at] = { ...before, ...entry }
} else {
  index.games.push(entry)
  console.log('清单  追加了一条')
}
fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n')

// ---- 3) 重算哈希 ----
execFileSync(process.execPath, ['scripts/make-local-catalog.mjs'], { cwd: HOST, stdio: 'inherit' })

console.log(`
=== 还差三步（脚本不碰，人写的内容）===
  · src/games/storefront.ts              → 商城文案与截图
  · src/features/settings/GameIcon.tsx   → ART 表里那一支（npm test 会查）
  · scripts/build-store-shots.py         → PLAN 里那一行（详情页的图）
然后：python scripts/build-store-shots.py && npm run check:registry && npm test
`)
