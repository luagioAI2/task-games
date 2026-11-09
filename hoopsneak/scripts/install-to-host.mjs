#!/usr/bin/env node
/**
 * 把打包产物装进宿主：`kid-quest-farm-2d/public/games/hoopsneak/`。
 *
 * ```bash
 * node scripts/install-to-host.mjs            # 装（会改宿主的 index.json）
 * node scripts/install-to-host.mjs --check    # 只比对，不写
 * ```
 *
 * ## 本作的包根上不止 `assets/`
 *
 * | 位置 | 里面是什么 | 谁在请求 |
 * | --- | --- | --- |
 * | `assets/` | 140 个文件（棋盘 / 走路图集 / 立绘 / 音乐 m4a） | `assetUrl('assets/…')` |
 * | `sound.manifest.json` / `sound.pack` | 音频清单与音效包（**裸文件名**） | `@makeplay/sound` 按清单里的 `packs.main.url` 拼 |
 *
 * ★★ 只拷 `assets/` 的后果（deckrush 2026-10-27 真踩过，一模一样的形状）：
 *   假宿主把 `dist-plugin/` 当站点根 ⇒ 全绿；真宿主里 `sound.manifest.json` 404
 *   ⇒ 音频运行时把 404 的 HTML 当 JSON 解析 ⇒ 抛 `… is not valid JSON`
 *   ⇒ **整个 mount 失败**，界面上是「『偷偷投篮』打不开」。
 *   字体漏拷不会崩，只是标题掉回系统字体 —— 更难发现，所以也进 `--check`。
 *
 * ## 它做三件事，**不做**第四件
 *
 * 1. 拷 `dist-plugin/hoopsneak.plugin.mjs` → `<host>/public/games/hoopsneak/`
 * 2. 拷 `dist-plugin/assets/` + 包根那两个音频文件
 * 3. 更新 `<host>/public/games/index.json` 里 `id === 'hoopsneak'` 那一条（没有就追加），
 *    然后跑 `make-local-catalog.mjs` 重算 `localGames.ts` 里的哈希
 *
 * **不做的**：`src/games/storefront.ts` 的文案和 `scripts/build-store-shots.py` 的
 * `PLAN` —— 那是人写的内容。漏了不报错，只会让详情页显示上一款游戏的图和话；
 * `npm run check:registry` 专门查这件事。
 *
 * ## 为什么版本号必须一起改
 *
 * 宿主只比 `installed.version === g.version` 判断「要不要更新」。改了包没升版本
 * ⇒ 界面说「已是最新」，跑的还是旧的，**零报错**。版本的唯一真相是 `plugin.js`
 * 里 `manifest.version`，这里从**包里**读，不写第二份。
 *
 * ★ `--check` 比的是 `Buffer.equals`，不是字节数：改一个数字（`1.0.0`→`1.0.1`）
 *   长度不变、注释又被剥掉，新旧包**字节数完全可能相同**，只比大小会得出「没变」。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const CHECK = process.argv.includes('--check')

const ID = 'hoopsneak'
const NAME = '偷偷投篮'
const BUNDLE = path.join(ROOT, 'dist-plugin', `${ID}.plugin.mjs`)
const DIST = path.join(ROOT, 'dist-plugin')
const ASSETS = path.join(DIST, 'assets')
/** 包根上、`assets/` **之外**的运行时文件（音频运行时按裸文件名请求它们） */
const ROOT_FILES = ['sound.manifest.json', 'sound.pack']
/** 包根上、`assets/` **之外**的目录（本作没有；字体在 assets/fonts/ 里） */
const ROOT_DIRS = []
const DEST = path.join(HOST, 'public', 'games', ID)
const INDEX = path.join(HOST, 'public', 'games', 'index.json')

for (const [label, p] of [
  ['dist-plugin 里的包（先跑 node scripts/build-plugin.mjs）', BUNDLE],
  ['dist-plugin/assets', ASSETS],
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

const walkCount = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? walkCount(path.join(d, e.name)) : 1),
    0,
  )
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

  const destAssets = path.join(DEST, 'assets')
  if (!fs.existsSync(destAssets)) problems.push('宿主里没有 assets/')
  else if (walkCount(destAssets) !== walkCount(ASSETS)) {
    problems.push(`宿主 assets ${walkCount(destAssets)} 个文件 ≠ dist-plugin ${walkCount(ASSETS)} 个`)
  }
  for (const f of ROOT_FILES) {
    const dst = path.join(DEST, f)
    if (!fs.existsSync(dst)) problems.push(`宿主里没有 ${f}（音频 / 字体运行时起不来）`)
    else if (!fs.readFileSync(dst).equals(fs.readFileSync(path.join(DIST, f)))) {
      problems.push(`${f} 和 dist-plugin 里的不是同一份`)
    }
  }
  for (const d of ROOT_DIRS) {
    const dst = path.join(DEST, d)
    if (!fs.existsSync(dst)) problems.push(`宿主里没有 ${d}/`)
    else if (walkCount(dst) !== walkCount(path.join(DIST, d))) {
      problems.push(`宿主 ${d} ${walkCount(dst)} 个文件 ≠ dist-plugin ${walkCount(path.join(DIST, d))} 个`)
    }
  }

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
const destAssets = path.join(DEST, 'assets')
fs.rmSync(destAssets, { recursive: true, force: true })
fs.cpSync(ASSETS, destAssets, { recursive: true })
console.log(`拷贝  public/games/${ID}/${ID}.plugin.mjs  ${kb(fs.statSync(BUNDLE).size)} KB`)
console.log(`拷贝  public/games/${ID}/assets/  ${walkCount(destAssets)} 个文件`)

for (const f of ROOT_FILES) {
  fs.copyFileSync(path.join(DIST, f), path.join(DEST, f))
  console.log(`拷贝  public/games/${ID}/${f}  ${kb(fs.statSync(path.join(DEST, f)).size)} KB`)
}
for (const d of ROOT_DIRS) {
  const dst = path.join(DEST, d)
  fs.rmSync(dst, { recursive: true, force: true })
  fs.cpSync(path.join(DIST, d), dst, { recursive: true })
  console.log(`拷贝  public/games/${ID}/${d}/  ${walkCount(dst)} 个文件`)
}

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
=== 还差两步（脚本不碰，人写的内容）===
  · src/games/storefront.ts      → 文案有变才改
  · scripts/build-store-shots.py → 画面有变才重抓（PLAN 里那一行）
然后：python scripts/build-store-shots.py && npm run check:registry
`)
