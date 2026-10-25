/**
 * 一条命令把抓娃娃**部署进宿主**（kid-quest-farm-2d）。
 *
 * ```bash
 * node scripts/deploy-plugin.mjs
 * ```
 *
 * 顺序（每一步失败都要停，不能"继续跑下去"）：
 *
 *   1. `gen-plugin-assets --check` —— HTML / CSS 的生成文件有没有过期
 *   2. `build-plugin`           —— 打单文件包 + 自检
 *   3. 拷到 `public/games/claw3d/`
 *   4. 更新 `public/games/index.json`（幂等：已经登记过就只改版本号）
 *   5. 宿主 `make-local-catalog.mjs` —— **重算 sha256 并烧进 `localGames.ts`**
 *
 * ## 为什么 3~5 步必须写在一起
 *
 * 宿主的本地包是**按哈希校验**的：清单里的 sha256 和实际文件对不上，
 * 安装会直接失败（这是对的）。所以「换了包但忘了重算哈希」的症状是
 * 「装不上」，而排查的人第一反应是去查网络 —— 方向从第一秒就是错的。
 *
 * 把这三步钉在一个脚本里，就不存在"忘了跑最后一步"。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const HOST = path.resolve(ROOT, '..', 'kid-quest-farm-2d')

const GAME_ID = 'claw3d'
const OUT_NAME = 'claw3d.plugin.mjs'

const run = (cmd, args, cwd) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}   (cwd=${path.relative(ROOT, cwd) || '.'})`)
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
}

/* 1. 生成文件是否最新 */
run(process.execPath, ['scripts/gen-plugin-assets.mjs', '--check'], ROOT)

/* 2. 打包 */
run(process.execPath, ['scripts/build-plugin.mjs'], ROOT)

/* 3. 拷包 */
const src = path.join(ROOT, 'dist-plugin', OUT_NAME)
const destDir = path.join(HOST, 'public', 'games', GAME_ID)
fs.mkdirSync(destDir, { recursive: true })
const dest = path.join(destDir, OUT_NAME)
fs.copyFileSync(src, dest)
const bytes = fs.statSync(dest).size
console.log(`\n拷贝 ${OUT_NAME} → ${path.relative(ROOT, dest)} (${(bytes / 1024 / 1024).toFixed(2)} MB)`)

/* 4. 登记清单（幂等） */
const indexPath = path.join(HOST, 'public', 'games', 'index.json')
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const pluginSrc = fs.readFileSync(path.join(ROOT, 'src', 'plugin', 'index.ts'), 'utf8')
const version = pluginSrc.match(/version:\s*'([^']+)'/)?.[1]
if (!version) throw new Error('在 src/plugin/index.ts 里找不到 version')
const name = pluginSrc.match(/name:\s*'([^']+)'/)?.[1] ?? '抓娃娃'

const row = { id: GAME_ID, name, version, file: `${GAME_ID}/${OUT_NAME}`, assetBase: `${GAME_ID}/` }
const at = index.games.findIndex((g) => g.id === GAME_ID)
if (at >= 0) index.games[at] = row
else index.games.push(row)
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n')
console.log(`\n清单已更新：${GAME_ID} v${version}（${index.games.length} 款）`)

/* 5. 重算哈希（这一步不能省 —— 见文件头） */
run(process.execPath, ['scripts/make-local-catalog.mjs'], HOST)

console.log('\n=== 部署完成 ===')
console.log('下一步：')
console.log('  cd ../kid-quest-farm-2d && npm run lint && npm run build')
console.log('  npx vite preview --port 4396 --strictPort')
console.log('  node scripts/e2e-plugin-claw3d.mjs http://127.0.0.1:4396/')
