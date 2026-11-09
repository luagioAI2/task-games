/**
 * 娃娃界面改版验收（换币上顶栏 / 拆右侧竖栏 / 娃娃界面也有动作条）。
 *
 * 用法：node scripts/probe-play-ui.mjs [port]
 *
 * 为什么单独一个脚本：`plugin-test.cjs` 验的是契约与经济，`capture-ui.mjs` 只出图。
 * 「换币在顶上」「右边那栏没了」这类是**布局**问题，jsdom 完全量不出来，
 * 而 `.click()` 又绕过命中测试 —— 必须真浏览器 + `elementFromPoint` + 几何断言。
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOST_APP = 'E:/plan/test25/kid-quest-farm-2d'
const require = createRequire(join(HOST_APP, 'noop.js'))
const puppeteer = require('puppeteer-core')

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH 指过去')
  process.exit(2)
}

const PORT = Number(process.argv[2] ?? 4398)
const OUT = join(ROOT, 'shots', 'probe')
mkdirSync(OUT, { recursive: true })

let pass = 0
const fails = []
const ok = (cond, label, detail) => {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`)
  } else {
    fails.push(label)
    console.log(`  ✗ ${label} ${JSON.stringify(detail)}`)
  }
}

const srv = spawn(process.execPath, ['server.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-proxy-server', '--proxy-bypass-list=*', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
})

/** 进机台。两档视口都要来一遍。 */
async function boot(w, h, tag) {
  const page = await browser.newPage()
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  await page.goto(`http://127.0.0.1:${PORT}/_plugin-test.html`, { waitUntil: 'load' })
  await page.waitForFunction('window.__ready === true', { timeout: 20000 })
  await page.evaluate('window.__t.loadAndMount()')
  await page.waitForFunction('window.__gpPlayable === true', { timeout: 45000 })
  await sleep(600)
  await page.evaluate(`__debug.enter('big-bear')`)
  await page.waitForFunction('__debug.screen === "play"', { timeout: 20000 })
  await sleep(1500)
  console.log(`\n=== ${tag} ${w}×${h} ===`)
  return page
}

try {
  await sleep(900)

  // ───────────────────────────── 竖屏 ─────────────────────────────
  const page = await boot(430, 860, '竖屏')

  const geo = await page.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { l: +b.left.toFixed(1), t: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }
    }
    const host = r('#host')
    const vp = r('#viewport')
    // 3D 画面右侧那一条：以前这里压着「正面/侧面/店员」一竖列
    const px = vp ? Math.min(vp.r - 14, vp.r - 4) : 0
    const py = vp ? vp.t + vp.h * 0.35 : 0
    const topAtRight = vp ? document.elementFromPoint(px, py) : null
    const name = (el) => (el ? el.id || el.className || el.tagName : null)
    return {
      host, vp, hud: r('#hud'), ctrl: r('#controls'), bar: r('#play > .ppBar'), btn: r('#btnPlay'),
      sideBtns: !!document.querySelector('#sideBtns'),
      camInHud: !!document.querySelector('#hud #camBtns'),
      staffInHud: !!document.querySelector('#hud #staffBtn'),
      chips: [...document.querySelectorAll('#camBtns button, #staffBtn')].map((b) => ({ t: b.textContent, w: Math.round(b.getBoundingClientRect().width) })),
      coinsText: document.querySelector('#pCoins')?.textContent ?? null,
      coinBtnTag: document.querySelector('#pCoinsBtn')?.tagName ?? null,
      topAtRight: name(topAtRight),
      topAtRightIsOverlayBtn: !!(topAtRight && topAtRight.closest && topAtRight.closest('#camBtns,#staffBtn')),
      vpRightFree: vp ? +(vp.r - (topAtRight ? 0 : 0)).toFixed(1) : 0,
      barTiles: [...document.querySelectorAll('#play > .ppBar .barTile b')].map((b) => b.textContent),
      barParent: document.querySelector('.ppBar')?.parentElement?.id ?? null,
      barCompact: document.querySelector('.ppBar')?.classList.contains('compact'),
      inMachine: window.__debug.inMachine,
    }
  })

  ok(geo.sideBtns === false, '右侧竖栏 #sideBtns 已删除', geo.sideBtns)
  ok(geo.camInHud && geo.staffInHud, '视角 / 店员 已挪进顶栏 #hud', { cam: geo.camInHud, staff: geo.staffInHud })
  ok(geo.coinBtnTag === 'BUTTON', '顶栏那颗币是按钮（换币入口）', geo.coinBtnTag)
  ok(/0/.test(geo.coinsText ?? ''), '顶栏币数渲染出来了', geo.coinsText)
  ok(geo.topAtRightIsOverlayBtn === false, '3D 画面右侧 35% 高度处没有按钮压着', { top: geo.topAtRight })
  ok(geo.vp.w >= geo.host.w - 24, '3D 画面基本占满整宽（左右各 10px 边距）', { vp: geo.vp.w, host: geo.host.w })
  ok(geo.hud.b <= geo.vp.t + 0.5, '顶栏没压住画面', { hudBottom: geo.hud.b, vpTop: geo.vp.t })
  ok(geo.vp.b <= geo.ctrl.t + 0.5, '画面没压住操作区', { vpBottom: geo.vp.b, ctrlTop: geo.ctrl.t })
  ok(geo.ctrl.b <= geo.bar.t + 0.5, '操作区没压住动作条', { ctrlBottom: geo.ctrl.b, barTop: geo.bar.t })
  ok(geo.bar.b <= geo.host.b + 0.5, '动作条完整在容器内', { barBottom: geo.bar.b, hostBottom: geo.host.b })
  ok(geo.barTiles.join('/') === '背包/排行', '娃娃界面动作条 = 背包 / 排行（回收已并入背包）', geo.barTiles)
  ok(geo.barParent === 'play' && geo.barCompact === true, '动作条搬到了 #play 且用紧凑版', { parent: geo.barParent, compact: geo.barCompact })
  ok(geo.chips.length === 3 && geo.chips.every((c) => c.w > 0), '三颗胶囊都渲染出宽度', geo.chips)
  ok(geo.vp.h / geo.host.h > 0.55, '3D 画面仍占容器高度 55% 以上', +(geo.vp.h / geo.host.h).toFixed(2))

  // 换币：命中测试 + 真的打开买币面板
  const hitCoin = await page.evaluate(() => {
    const el = document.querySelector('#pCoinsBtn')
    const b = el.getBoundingClientRect()
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return { ok: !!top && (top === el || el.contains(top)), top: top ? top.id || top.className : null }
  })
  ok(hitCoin.ok, '顶栏换币按钮没被别的层盖住', hitCoin)
  await page.evaluate(`document.querySelector('#pCoinsBtn').click()`)
  await sleep(300)
  const payOpen = await page.evaluate(`!document.querySelector('#payModal').classList.contains('hidden')`)
  ok(payOpen, '点顶栏换币 → 打开买币面板')
  await page.evaluate(`document.querySelector('#buyNo').click()`)
  await sleep(250)
  ok(await page.evaluate(`document.querySelector('#payModal').classList.contains('hidden')`), '取消能关掉买币面板')

  // 动作条：从娃娃界面进背包，必须真的离开机台
  // —— 先验一条「数据变了，条上的角标得跟着变」：
  //    动作条以前只在首页，抓到娃娃时玩家已经不在首页了，所以 `refreshBar()`
  //    漏调也看不出来。现在它就在眼前，角标不动 = 玩家以为没抓到。
  await page.evaluate(`__debug.forceGet(0)`)
  await sleep(900)
  const badges = await page.evaluate(`JSON.stringify({
    col: document.querySelector('#colCnt')?.textContent,
    colShown: !document.querySelector('#colCnt')?.classList.contains('zero'),
    tiles: document.querySelectorAll('.ppBar .barTile').length,
    stock: JSON.stringify(__debug.stock),
  })`)
  const bd = JSON.parse(badges)
  ok(bd.colShown && bd.col === '1', '抓到娃娃后，动作条的「背包」角标立刻变 1（可卖件数，不用退出去才更新）', bd)
  ok(bd.tiles === 2, '动作条只剩两格（背包 / 排行）', { tiles: bd.tiles })
  // 关掉中奖那层再往下走（它盖住了整个 #play）
  await page.evaluate(`document.querySelector('#getOverlay').classList.add('hidden')`)
  await sleep(300)

  await page.evaluate(`document.querySelector('#colBtn').click()`)
  await sleep(600)
  const navCol = await page.evaluate(`JSON.stringify({
    screen: __debug.screen, inMachine: __debug.inMachine,
    barHidden: document.querySelector('.ppBar').classList.contains('hidden'),
    barParent: document.querySelector('.ppBar').parentElement.id,
  })`)
  const n1 = JSON.parse(navCol)
  ok(n1.screen === 'collection', '娃娃界面点背包 → 图鉴页', n1.screen)
  ok(n1.inMachine === false, '进图鉴时机台已退出（3D 场景不再后台跑）', n1.inMachine)
  ok(n1.barHidden === true, '图鉴页不显示动作条', n1.barHidden)

  await page.evaluate(`document.querySelector('#colBack').click()`)
  await sleep(500)
  const backList = await page.evaluate(`JSON.stringify({
    screen: __debug.screen,
    barHidden: document.querySelector('.ppBar').classList.contains('hidden'),
    barParent: document.querySelector('.ppBar').parentElement.id,
    compact: document.querySelector('.ppBar').classList.contains('compact'),
    barH: Math.round(document.querySelector('.ppBar').getBoundingClientRect().height),
  })`)
  const n2 = JSON.parse(backList)
  ok(n2.screen === 'list' && n2.barHidden === false, '返回 → 首页动作条回来了', n2)
  ok(n2.barParent === 'list' && n2.compact === false, '动作条搬回 #list 且恢复常规尺寸', { parent: n2.barParent, compact: n2.compact })

  // 背包布局：组合条 / 网格 / 底部换券条 三段不许互相压。
  // ⚠️ 这一段**只能在这里验**：jsdom 不做布局（getBoundingClientRect 全 0），
  //    而 `.click()` 绕过命中测试 —— 组合条压住网格这种事，单测和 e2e 都看不见。
  await page.evaluate(`__debug.enter('big-bear')`)
  await sleep(1400)
  await page.evaluate(`document.querySelector('#colBtn').click()`)
  await sleep(700)
  const bagRaw = await page.evaluate(`JSON.stringify((() => {
    const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
    const strip = document.querySelector('#comboWrap');
    const cards = [...document.querySelectorAll('#comboWrap .comboCard')];
    const grid = document.querySelector('#colGrid');
    const cells = [...document.querySelectorAll('#colGrid .cell')];
    const own = cells.filter((c) => +(c.dataset.owned || 0) > 0);
    const host = document.querySelector('.pp-root').getBoundingClientRect();
    return {
      screen: __debug.screen, inMachine: __debug.inMachine,
      barHidden: document.querySelector('.ppBar').classList.contains('hidden'),
      strip: r('#comboWrap'), grid: r('#colGrid'), rc: r('#rcBar'),
      host: { t: Math.round(host.top), b: Math.round(host.bottom) },
      nCards: cards.length,
      cardW: cards.length ? Math.round(cards[0].getBoundingClientRect().width) : 0,
      cardH: cards.length ? Math.round(cards[0].getBoundingClientRect().height) : 0,
      stripScrollable: strip.scrollWidth > strip.clientWidth + 1,
      gridScrollable: grid.scrollHeight > grid.clientHeight,
      firstOwned: cells[0] ? +(cells[0].dataset.owned || 0) : -1,
      ownCount: own.length,
      // 有货的格子最后一行是「🎟 N」——它要是被格子下沿裁掉，就只能从截图上「看着像」，
      // 所以量出来：这一行的底边有没有越过格子的内容盒（border-box 减去 padding-bottom）。
      // 顺带量 scrollHeight / clientHeight：撑出内容盒的第二种表现是格子自己溢出。
      clip: own.map((c) => {
        const kids = [...c.children];
        const v = kids[kids.length - 1];
        const cb = c.getBoundingClientRect();
        const vb = v.getBoundingClientRect();
        const padB = parseFloat(getComputedStyle(c).paddingBottom) || 0;
        return {
          id: c.dataset.prize,
          over: Math.round(vb.bottom - (cb.bottom - padB)),
          sh: c.scrollHeight, ch: c.clientHeight,
        };
      }),
      sellBtn: document.querySelectorAll('#sellBtn').length,
      sellScreen: document.querySelectorAll('#sell').length,
    };
  })())`)
  const bg = JSON.parse(bagRaw)
  ok(bg.screen === 'collection' && bg.inMachine === false, '点背包 → 背包页且已退机台', { screen: bg.screen, inMachine: bg.inMachine })
  ok(bg.barHidden === true, '背包页不显示动作条', bg.barHidden)
  ok(bg.sellBtn === 0 && bg.sellScreen === 0, '★ 回收按钮与回收屏都彻底删掉了', { btn: bg.sellBtn, screen: bg.sellScreen })
  ok(bg.nCards === 5 && bg.cardW >= 120 && bg.cardH >= 90, '组合条里 5 张卡都有尺寸', { n: bg.nCards, w: bg.cardW, h: bg.cardH })
  ok(bg.stripScrollable === true, '5 张组合卡横向排不下 ⇒ 组合条可横滑', bg.stripScrollable)
  ok(bg.strip.b <= bg.grid.t + 0.5, '★ 组合条没压住背包网格', { stripBottom: bg.strip.b, gridTop: bg.grid.t })
  ok(bg.grid.b <= bg.rc.t + 0.5, '★ 网格没压住底部「换成兑换券」条', { gridBottom: bg.grid.b, rcTop: bg.rc.t })
  ok(bg.rc.b <= bg.host.b + 0.5, '换券条完整在容器内', { rcBottom: bg.rc.b, hostBottom: bg.host.b })
  ok(bg.gridScrollable === true, '背包网格能滚动（19 个格子放不下一屏）', bg.gridScrollable)
  ok(bg.firstOwned > 0, '★ 有货的格子排在最前面（背包先能卖）', { firstOwned: bg.firstOwned, own: bg.ownCount })
  // 「🎟 N」那行是不是被裁掉了 —— 截图看着像被切，量一下才算数。
  // 判据：越界量 ≤ 0.5px（亚像素取整），且格子没有溢出（scrollHeight ≤ clientHeight）。
  const clipped = bg.clip.filter((c) => c.over > 0.5 || c.sh > c.ch + 1)
  ok(bg.clip.length > 0 && clipped.length === 0,
    '★ 有货格子里的「🎟 N」没被裁掉（不越过内容盒、格子也没溢出）',
    { cells: bg.clip.length, clipped })

  // 零食页：**也能卖**。回收屏删掉之后，零食如果只留在「看一眼」的列表里，
  // 抓到的零食就再也换不成券了 —— 那是静默砍功能，e2e 也不会报。
  const snackRaw = await page.evaluate(`JSON.stringify((() => {
    const tabs = [...document.querySelectorAll('#collection .cat')];
    const sweet = tabs.find((b) => b.dataset.cc === 'sweets');
    const prize = tabs.find((b) => b.dataset.cc === 'prize');
    sweet.click();
    const rows = [...document.querySelectorAll('#snackList .snackRow')];
    const out = {
      rows: rows.length,
      tag: rows[0] ? rows[0].tagName : null,
      hasOwnedAttr: rows.every((r) => r.dataset.owned !== undefined),
      head: (document.querySelector('#snackList .bagHead')?.textContent ?? '').trim(),
      gridHidden: document.querySelector('#colGrid').classList.contains('hidden'),
      comboHidden: document.querySelector('#comboWrap').classList.contains('hidden'),
    };
    prize.click();
    return out;
  })())`)
  const sn = JSON.parse(snackRaw)
  // SWEETS 是 4 种（`snackbox` 不在里面，它是另一个奖品）
  ok(sn.rows === 4 && sn.tag === 'BUTTON' && sn.hasOwnedAttr, '零食页 4 行、每行都是按钮（零食也能卖）', sn)
  ok(sn.gridHidden && sn.comboHidden, '零食页藏掉奖品网格与组合条', { grid: sn.gridHidden, combo: sn.comboHidden })
  ok(sn.head.length > 0, '零食页顶部有提示文案', sn.head)

  await page.evaluate(`document.querySelector('#colBack').click()`)
  await sleep(400)
  ok(await page.evaluate(`__debug.screen === 'list'`), '背包返回首页')

  // 排行
  await page.evaluate(`__debug.enter('big-bear')`)
  await sleep(1400)
  await page.evaluate(`document.querySelector('#rankBtn').click()`)
  await sleep(600)
  const navRank = await page.evaluate(`JSON.stringify({ screen: __debug.screen, inMachine: __debug.inMachine })`)
  ok(JSON.parse(navRank).screen === 'rank' && JSON.parse(navRank).inMachine === false, '娃娃界面点排行 → 排行页且已退机台', JSON.parse(navRank))

  await page.close()

  // ───────────────────────────── 横屏 ─────────────────────────────
  // ⚠️ `_plugin-test.html` 的 `#host` 是写死的 390×780 —— 光改页面视口，
  // 容器尺寸纹丝不动（量出来的还是竖屏那套数字，看着像「横屏没生效」）。
  // 必须把容器也改成横的，再手动 dispatch 一次 resize（`.land` 是在 resize 里算的）。
  const land = await boot(860, 430, '横屏')
  await land.evaluate(() => {
    const host = document.querySelector('#host')
    host.style.width = '780px'
    host.style.height = '390px'
    window.dispatchEvent(new Event('resize'))
  })
  await sleep(1200)
  const lgeo = await land.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }
    }
    const play = document.querySelector('#play')
    return {
      land: play.classList.contains('land'),
      vp: r('#viewport'), bar: r('#play > .ppBar'), ctrl: r('#controls'), hud: r('#hud'),
      host: r('#host'),
      overflowX: play.scrollWidth - play.clientWidth,
      tileOverflow: [...document.querySelectorAll('#play > .ppBar .barTile')].map((t) => t.scrollWidth - t.clientWidth),
    }
  })
  ok(lgeo.land === true, '横屏走了 .land 布局', lgeo.land)
  ok(lgeo.vp.h > 120, '横屏画面还有高度', lgeo.vp.h)
  ok(lgeo.bar.b <= lgeo.host.b + 1, '横屏动作条在容器内', { barBottom: lgeo.bar.b, hostBottom: lgeo.host.b })
  ok(lgeo.overflowX <= 1, '横屏没有横向溢出', lgeo.overflowX)
  ok(lgeo.tileOverflow.every((n) => n <= 1), '横屏动作条磁贴文字没被挤破', lgeo.tileOverflow)
  ok(lgeo.ctrl.b <= lgeo.bar.t + 1, '横屏操作区没压住动作条', { ctrlBottom: lgeo.ctrl.b, barTop: lgeo.bar.t })
  await land.screenshot({ path: join(OUT, 'landscape-play.png') })
  await land.close()
} catch (e) {
  fails.push('脚本异常: ' + e.message)
  console.error('FAIL', e)
} finally {
  await browser.close().catch(() => {})
  srv.kill()
}

console.log(`\n=== ${fails.length ? 'FAIL' : 'PASS'} (${pass} 条通过${fails.length ? `，${fails.length} 条失败` : ''}) ===`)
if (fails.length) {
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
process.exit(0)
