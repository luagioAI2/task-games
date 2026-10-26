#!/usr/bin/env node
/**
 * 把打包产物装进宿主：`kid-quest-farm-2d/public/games/moestrike/`。
 *
 * ```bash
 * node scripts/install-to-host.mjs            # 装（会改宿主的 index.json）
 * node scripts/install-to-host.mjs --check    # 只比对，不写
 * ```
 *
 * ## 它做三件事，**不做**第四件
 *
 * 1. 拷 `dist-plugin/moestrike.plugin.mjs` → `<host>/public/games/moestrike/`
 * 2. 拷 `assets/` → `<host>/public/games/moestrike/assets/`
 *    （外加站点根的 `sound.pack` 和 `sound.manifest.json` —— 音频清单里
 *     `packs.main.url` 就是裸的 `sound.pack`，音乐变体是裸的 `assets/audio/…`）
 * 3. 更新 `<host>/public/games/index.json` 里 `id === 'moestrike'` 那一条
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
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', '..', 'kid-quest-farm-2d')
const CHECK = process.argv.includes('--check')

const ID = 'moestrike'
const BUNDLE = path.join(ROOT, 'dist-plugin', `${ID}.plugin.mjs`)
const ASSETS = path.join(ROOT, 'assets')
const DEST = path.join(HOST, 'public', 'games', ID)
const INDEX = path.join(HOST, 'public', 'games', 'index.json')

if (!fs.existsSync(BUNDLE)) {
  console.error('还没打包：node scripts/build-plugin.mjs')
  process.exit(2)
}
if (!fs.existsSync(HOST)) {
  console.error('找不到宿主：', HOST)
  process.exit(2)
}

// manifest 的 version 是唯一真相 —— 从**源码** `plugin.js` 读，不手写第二份。
//
// ★ 别从打包产物里 grep：包里还有 pixi / fx / sound 这些第三方库，它们**自己也带**
//   `version:` 字段（实测 three 里就有 `version: "none"`），正则会抓到那一个，
//   于是清单里写进 `"version": "none"` —— 宿主「已是最新」的判定全乱，
//   而且没有任何一步报错。源码里的 manifest 只有一处，锚点唯一。
const manifestSrc = fs.readFileSync(path.join(ROOT, 'plugin.js'), 'utf8')
const vm = manifestSrc.match(/^\s*version:\s*'([^']+)'/m)
if (!vm) {
  console.error('plugin.js 的 manifest 里没找到 version 字段')
  process.exit(2)
}
const version = vm[1]

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
const entry = {
  id: ID,
  name: '少女战记',
  version,
  file: `${ID}/${ID}.plugin.mjs`,
  assetBase: `${ID}/`,
}
const at = index.games.findIndex((g) => g.id === ID)
const before = at >= 0 ? index.games[at] : null

if (CHECK) {
  const problems = []
  const destBundle = path.join(HOST, 'public', 'games', entry.file)
  if (!fs.existsSync(destBundle)) problems.push('宿主里还没有这个包')
  else if (fs.readFileSync(destBundle).length !== fs.statSync(BUNDLE).size) {
    problems.push('宿主里的包和 dist-plugin 的大小不一致（没装最新构建）')
  }
  if (!before) problems.push('index.json 里没有 moestrike 这一条')
  else if (before.version !== version) problems.push(`index.json 版本 ${before.version} ≠ 包里 ${version}`)
  const destAssets = path.join(DEST, 'assets')
  if (!fs.existsSync(destAssets)) problems.push('宿主里没有 assets/')
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
const count = (function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? walk(path.join(d, e.name)) : 1), 0)
})(destAssets)
console.log(`拷贝  public/games/${ID}/${ID}.plugin.mjs  ${(fs.statSync(BUNDLE).size / 1024).toFixed(0)} KB`)
// 站点根这几样都不在 `assets/` 里，但清单按**裸相对路径**引用它们 ⇒ 必须单独拷
fs.copyFileSync(path.join(ROOT, 'sound.pack'), path.join(DEST, 'sound.pack'))
fs.copyFileSync(path.join(ROOT, 'sound.manifest.json'), path.join(DEST, 'sound.manifest.json'))
console.log(`拷贝  public/games/${ID}/assets/  ${count} 个文件 + sound.pack + sound.manifest.json`)

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
  · src/games/storefront.ts   → 加 id '${ID}' 的条目（文案 + 4 张截图 caption）
  · scripts/build-store-shots.py → PLAN 里加一行 ("${ID}", "${ID}", [...])
然后：python scripts/build-store-shots.py && npm run check:registry
`)
