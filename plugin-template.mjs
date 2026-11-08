/**
 * 「我是一个农场主」—— 小任务农场插件包（模板，由 build-plugin.mjs 填充后发布）。
 *
 * ## 为什么是 srcdoc iframe，而不是直接往容器里画
 *
 * 这游戏不是「给我一个容器我自己画 canvas」那种组件，它是一张**完整网页**：
 * 自带 canvas、header、nav、几十个写死的 #id，而且 style.css 第一条就是
 * `html,body{margin:0;height:100%;overflow:hidden}`。直接塞进宿主 DOM 有三个后果，
 * 每个都很难查：
 *
 *   ① html/body 那条规则会**改掉宿主的整页样式**；
 *   ② #hud / #tools / #dock 这些 id 和宿主的撞了，querySelector 取到别人的节点；
 *   ③ 游戏的 position:fixed 层（引导遮罩 #tut）会盖住宿主底栏。
 *
 * 所以用 iframe 隔离。但**不能用 `<iframe src>`**：远程包在 API 那台机器上，
 * 和 App 不同源，contentWindow 拿不到 ⇒ 存储交接（host.storage）做不了。
 *
 * srcdoc 的关键性质：**文档继承父页面的 origin**。
 * 于是 contentWindow.__farmlordUseStorage 能直接调，localStorage 也是同一份。
 *
 * ## base href 是必须的
 *
 * srcdoc 的文档 URL 是 about:srcdoc，所有相对路径会以它为基准 ⇒ 全 404。
 * 加一条 `<base href="{assetBase}">` 把基准指到包目录，游戏里那些
 * assets/x.webp / fetch('assets/manifest.json') / ./i18n.js 才找得到。
 *
 * ## 存档怎么在启动前送进去
 *
 * 游戏是**同步**启动的：main.js 第一句 await gp.player.ready，
 * 紧接着 /hello + /farm/enter。那时 host.storage.get() 还没回来。
 * 所以在模块脚本**之前**内联一行 window.__farmlordBootSave = {...}，
 * gp-bridge.js 读它当初始状态。
 */

export const manifest = __MANIFEST__

/** body 里的静态标记（原 index.html 的 body，去掉三条 module 脚本） */
const BODY = __BODY__

/** 按顺序加载的模块（必须 gp-bridge 在前：原版第一句就要 window.gp） */
const SCRIPTS = __SCRIPTS__

/** 存档键 —— 宿主 gameKv 里这个名字 */
const SAVE_KEY = 'save'

/** iframe 的样式：铺满宿主给的容器，去掉边框与背景缝 */
const FRAME_CSS = [
  'position:absolute',
  'inset:0',
  'width:100%',
  'height:100%',
  'border:0',
  'display:block',
  'background:#7fb24a',
].join(';')

/** 内联进 <script> 的 JSON：只需要挡住 </script 提前闭合 */
function esc(s) {
  return String(s).replace(/<\/(script)/gi, '<\\/$1')
}

export async function mount(container, host, ctx) {
  /* ① 先把存档读出来（异步），等会内联进 srcdoc */
  let save = null
  try {
    const v = await host.storage.get(SAVE_KEY)
    if (v !== undefined && v !== null) save = v
  } catch (e) {
    console.warn('[farmlord] 读存档失败，按新档启动', e)
  }

  const base = ctx.assetBase || ''
  const url = (rel) => ctx.assetUrl(rel)

  /* ② 拼 srcdoc */
  const doc = [
    '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">',
    '<title>' + manifest.name + '</title>',
    /* ★ 基准：没有它，srcdoc 里所有相对路径都会以 about:srcdoc 为基准 ⇒ 全 404 */
    '<base href="' + base + '">',
    '<link rel="stylesheet" href="' + url('style.css?v=20') + '">',
    /* 存档必须在模块脚本之前就位 —— 游戏是同步启动的 */
    '<script>window.__farmlordBootSave=' + esc(JSON.stringify(save)) + ';<\/script>',
    '<script type="importmap">' +
      esc(JSON.stringify({ imports: { '@makeplay/sound': url('runtime/sound-1.js') } })) +
      '<\/script>',
    '</head><body>',
    BODY,
    ...SCRIPTS.map((s) => '<script type="module" src="' + url(s) + '"><\/script>'),
    '</body></html>',
  ].join('')

  /* ③ 建 iframe */
  const frame = document.createElement('iframe')
  frame.setAttribute('title', manifest.name)
  frame.setAttribute('allow', 'autoplay')
  frame.style.cssText = FRAME_CSS
  frame.srcdoc = doc

  const loaded = new Promise((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true })
  })

  container.replaceChildren(frame)
  await loaded

  const win = frame.contentWindow
  if (!win) {
    frame.remove()
    throw new Error('游戏框架没起来（contentWindow 为空）')
  }

  /* ④ 等游戏自己报 ready（main.js 结尾会 dispatch hh:ready）。
     拿不到也继续 —— 引导层可能已经在跑，不该因为等待超时就不给玩。 */
  await new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      try {
        win.removeEventListener('hh:ready', finish)
      } catch {}
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, 12000)
    try {
      win.addEventListener('hh:ready', finish, { once: true })
    } catch {
      finish()
    }
  })

  /* ⑤ 把后续写入接到宿主存储。
     用 _setStore 而不是重建 server —— 重建会把内存里刚跑出来的状态退回去。 */
  let unmounted = false
  if (typeof win.__farmlordUseStorage === 'function') {
    win.__farmlordUseStorage({
      /* load 给「当前内存状态」：这一刻服务端已经跑起来了，
         再读一遍宿主可能读到旧值。 */
      load: () => win.__farmlordGetServer && win.__farmlordGetServer()._state(),
      save: (state) => host.storage.set(SAVE_KEY, state),
    })
  }

  /* ⑥ 卸载：落盘 + 摘 iframe。不落盘会丢最后一个动作（节流 300ms 还没写） */
  return async () => {
    if (unmounted) return
    unmounted = true
    try {
      const s = win.__farmlordGetServer && win.__farmlordGetServer()
      if (s && s._flush) s._flush()
    } catch (e) {
      console.warn('[farmlord] 卸载时落盘失败', e)
    }
    frame.remove()
  }
}
