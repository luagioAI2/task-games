#!/usr/bin/env node
/**
 * 把打包产物装进宿主：`kid-quest-farm-2d/public/games/melonjar/`。
 *
 * ```bash
 * node scripts/install-to-host.mjs            # 装（会改宿主的 index.json）
 * node scripts/install-to-host.mjs --check    # 只比对，不写
 * ```
 *
 * ## 为什么补这个脚本（2026-10-27）
 *
 * 之前这款是**手工**拷包 + 手改 `index.json` + 手跑 `make-local-catalog`。
 * 手工的代价已经在隔壁两款上出现过：工作区里躺着一个「重打过但提交时
 * `git add` 漏掉」的包 ⇒ 清单记下的是**那个没入库的构建**的哈希，
 * 随后 `public/games` 恢复成 HEAD 版本 ⇒ 清单成孤儿（清单字节 ≠ 实际），
 * 而 `git status` 是干净的、`check:registry` 报「换了包没重算哈希」，
 * 人第一反应会去查打包。
 *
 * 所以：**拷包、改清单、重算哈希，三件事必须在同一次运行里做完**，
 * 而且版本要从包里读，不许在这里手写第二份。
 *
 * ## 它做三件事，**不做**第四件
 *
 * 1. 拷 `dist-plugin/melonjar.plugin.mjs` → `<host>/public/games/melonjar/`
 * 2. 拷 `dist-plugin/assets/` → `<host>/public/games/melonjar/assets/`
 *    （⚠️ 用 `dist-plugin/assets` 而不是源码根下的 `assets/` —— 打包脚本会把
 *    `sound.pack` / `sound.manifest.json` 一起搬进去，源码根下没有这两个）
 * 3. 更新 `<host>/public/games/index.json` 里 `id === 'melonjar'` 那一条
 *    （没有就追加），然后跑 `make-local-catalog.mjs` 重算 `localGames.ts` 里的哈希
 *
 * **不做的**：`src/games/storefront.ts` 的文案和 `scripts/build-store-shots.py`
 * 的 `PLAN` —— 那两处是**人写的内容**，不该被脚本覆盖。
 * 漏掉它们不会报错，只会让详情页显示上一款游戏的图和话。
 * `npm run check:registry` 专门查这件事。
 *
 * ## 为什么版本号必须一起改
 *
 * 宿主只比 `installed.version === g.version` 来判断「要不要更新」。
 * 改了包没升版本 ⇒ 界面说「已是最新」，实际跑的还是旧的，**零报错**。
 * 版本号的唯一真相在 `plugin.js` 的 `manifest.version`。
 *
 * ★ `--check` 比的是 **`Buffer.equals`**，不是字节数：改一个数字（`1.0.0`→`1.0.1`）
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

const ID = 'melonjar'
const NAME = '爆汁瓜瓜罐'
const BUNDLE = path.join(ROOT, 'dist-plugin', `${ID}.plugin.mjs`)
const ASSETS = path.join(ROOT, 'dist-plugin', 'assets')
const DEST = path.join(HOST, 'public', 'games', ID)
const INDEX = path.join(HOST, 'public', 'games', 'index.json')

if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}
if (!fs.existsSync(ASSETS)) {
  console.error('dist-plugin/assets 不存在 —— 打包脚本没搬资源？')
  process.exit(2)
}
if (!fs.existsSync(HOST)) {
  console.error('找不到宿主：', HOST)
  process.exit(2)
}

// manifest 的 version 是唯一真相 —— 从包里读，不在这里手写第二份
const code = fs.readFileSync(BUNDLE, 'utf8')
const vm = code.match(/version:\s*["']([^"']+)["']/)
if (!vm) {
  console.error('包里的 manifest 没找到 version 字段')
  process.exit(2)
}
const version = vm[1]

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
const entry = {
  id: ID,
  name: NAME,
  version,
  file: `${ID}/${ID}.plugin.mjs`,
  assetBase: `${ID}/`,
}
const at = index.games.findIndex((g) => g.id === ID)
const before = at >= 0 ? index.games[at] : null

const walkCount = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? walkCount(path.join(d, e.name)) : 1),
    0,
  )

if (CHECK) {
  const problems = []
  const destBundle = path.join(DEST, `${ID}.plugin.mjs`)
  if (!fs.existsSync(destBundle)) problems.push('宿主里还没有这个包')
  else if (!fs.readFileSync(destBundle).equals(fs.readFileSync(BUNDLE))) {
    problems.push('宿主里的包和 dist-plugin 不是同一份（没装最新构建）')
  }
  if (!before) problems.push('index.json 里没有 melonjar 这一条')
  else if (before.version !== version) problems.push(`index.json 版本 ${before.version} ≠ 包里 ${version}`)

  const destAssets = path.join(DEST, 'assets')
  if (!fs.existsSync(destAssets)) problems.push('宿主里没有 assets/')
  else if (walkCount(destAssets) !== walkCount(ASSETS)) {
    problems.push(`宿主 assets ${walkCount(destAssets)} 个文件 ≠ dist-plugin ${walkCount(ASSETS)} 个`)
  }

  if (problems.length) {
    console.error('没装好：')
    for (const p of problems) console.error('  -', p)
    process.exit(1)
  }
  console.log(`已装好：${entry.file} v${version}（${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB）`)
  process.exit(0)
}

// ---- 1) 拷贝 ----
fs.mkdirSync(DEST, { recursive: true })
fs.copyFileSync(BUNDLE, path.join(DEST, `${ID}.plugin.mjs`))
const destAssets = path.join(DEST, 'assets')
fs.rmSync(destAssets, { recursive: true, force: true })
fs.cpSync(ASSETS, destAssets, { recursive: true })
console.log(`拷贝  public/games/${ID}/${ID}.plugin.mjs  ${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB`)
console.log(`拷贝  public/games/${ID}/assets/  ${walkCount(destAssets)} 个文件`)

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
  · src/games/storefront.ts   → 文案有变才改
  · scripts/build-store-shots.py → 画面有变才重抓（PLAN 里那一行）
然后：python scripts/build-store-shots.py && npm run check:registry
`)
