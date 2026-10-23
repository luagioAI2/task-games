/**
 * 爪爪乐的**引擎本体** —— 一个可以挂载 / 卸载的工厂，不再自己启动。
 *
 * ## 为什么从 `main.ts` 拆出来
 *
 * 原来的 `main.ts` 是**模块求值即开机**：`import` 一到就开始建 renderer、
 * 建场景、读 `localStorage`、往 `window` / `document` 上挂十几个监听、
 * `requestAnimationFrame` 起循环。当独立网页跑没问题 —— 页面生命周期就是
 * 它的生命周期，关掉页面什么都会消失。
 *
 * 但作为宿主（kid-quest-farm-2d）的插件，"关掉页面"这件事**不存在**：
 * 玩家只是切了个 tab，页面还活着。这时候上面每一样东西都变成**泄漏**：
 *
 *   · rAF 还在跑 ⇒ 切走以后照样吃 CPU、照样发声音；
 *   · `window` 上的 keydown 还在 ⇒ 在**农场的输入框里**按空格，爪子会下爪；
 *   · `document` 上的 pointerdown 还在 ⇒ 每点一次别处都摸一下音频；
 *   · WebGL context 不释放 ⇒ 手机浏览器有上限（约 8~16 个），
 *     切几次就黑屏，而**不报错**；
 *   · rapier 的 `world` 不 `free()` ⇒ wasm 堆一直涨。
 *
 * 宿主 `PluginGameHost` 会在切走时调 `unmount`，所以这里必须**真的收干净**。
 * 本项目的原话是「卸载路径写得比挂载路径还小心」。
 *
 * ## 三处和独立版不同的注入点
 *
 * | 原来 | 现在 | 为什么 |
 * | --- | --- | --- |
 * | `document.getElementById` | `root.querySelector` | 插件里不能保证 id 全局唯一 |
 * | `localStorage` | `opts.kv` | 宿主用 `gameKv` 表，且**每个游戏一个命名空间** |
 * | 自己扣币 / 记奖品 | `opts.wallet` | 币在宿主账本里（余额 = Σdelta），不能存第二份 |
 *
 * ## `root` 扮演的是 `<body>`，不是 `#app`
 *
 * 这个区别很容易搞错，所以写死在这里：样式表里那 28 条 `body.wide` /
 * `body.intro` / `body.fine` 的规则，作用对象**就是 `root`**。
 * 独立运行时 `root === document.body`，插件里是 `.claw-root` 那个 div
 * —— 两边的 `#app` / `#hud` 都是它的子节点，所以同一份 CSS 在两种形态下
 * 都成立（插件那份由 `scopeCss` 把 `body` 前缀换成 `.claw-root`）。
 */

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
/*
 * ★ 必须是 `-compat`，不是 `@dimforge/rapier3d`。
 *
 * 普通包把 wasm 放成**独立文件**，运行时按 URL 去取；插件跑在宿主的
 * `blob:` 模块里，那个 URL 相对 `blob:` 解析 ⇒ 404 ⇒ `RAPIER.init()` 抛，
 * 症状是「一直在加载物理引擎…」。`-compat` 把 wasm 内联成 base64，
 * 单文件就够。
 */
import RAPIER from '@dimforge/rapier3d-compat'
import {
  ClawGame, CARRIAGE_Y, HUB_HH, HOLE, BIN_FLOOR_Y, PRIZE_TYPES,
  type Prize, type ClawState, type ContactPt, type GameEvent,
} from './physics.ts'
import { buildMachine, buildRoom, buildEnvScene, applyTheme, machineExtent, M, useFreshMaterials } from './models.ts'
import { THEMES } from './themes.ts'
import { buildPrize, disposePlush, setFurShells, type PlushModel } from './plush.ts'
import { Sfx, vibrate } from './audio.ts'

/** 一局多少秒 */
export const ROUND_TIME = 30

/* ============================ 注入的依赖 ============================ */

/** 插件能用的键值存储（宿主 `HostApi.storage` 的子集；独立版是 localStorage）。 */
export interface ClawKv {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
}

/**
 * 币不足时那颗按钮 —— **两种形态的语义完全不同，所以由钱包自己给文案**。
 *
 * 独立版是「每日免费领 10 币」（没有家长在看，也没人记账）；
 * 插件里**绝不能**送币：币是用积分买的，白送 10 个就是 10 局，
 * 而每局都有期望产出 ⇒ 直接变成刷券入口。
 */
export interface ClawRecharge {
  label: string
  hint: string
  run(): Promise<boolean>
}

/**
 * 钱。**所有方法都可能失败**，调用方必须看返回值 —— 不能假定「调了就等于成了」。
 *
 * 为什么是同步的 `coins` 而不是 `async coins()`：`refreshUI()` 在 3000 行里
 * 被同步调了几十次。做法和奖品公园一致：**挂载前**把余额读成快照，
 * 之后内存里这份就是界面读的那份，**每次变动 await 成功才改内存**
 * （先改内存再补账 = 允许"余额不够也开局"）。
 */
export interface ClawWallet {
  readonly coins: number
  readonly points: number
  /** 付一局的币。`true` = 真的扣掉了，可以开局。 */
  pay(cost: number): Promise<boolean>
  /** 抓到奖品 → 发兑换券。返回**宿主实际发了几张**（0 = 没发）。 */
  award(prizeTypeId: string, prizeName: string): Promise<number>
  readonly recharge: ClawRecharge
}

export interface ClawAppOptions {
  /**
   * 扮演 `<body>` 的那个元素：样式里的 `body.wide` / `body.intro` 作用在它身上。
   *
   * 独立版传 `document.body`；插件传 `.claw-root`（宿主给的容器里的那个 div）。
   */
  root: HTMLElement
  /** 要注入的 DOM（插件用）。不传 = 页面里已经有了（独立版）。 */
  html?: string
  /**
   * DOM 注入之后、建场景之前的一拍，给调用方改文案用。
   *
   * 为什么需要它：开场页那句「新玩家赠送 10 币」在插件里是**假的**
   * （币要用积分买），但它在 HTML 字符串里，`createClawApp` 返回时
   * 已经 boot 完了 —— 那时候改，玩家可能已经看见了一眼。
   */
  patch?: (root: HTMLElement) => void
  kv: ClawKv
  wallet: ClawWallet
  /** 独立版才有：全屏按钮、`<meta theme-color>`、`?q=` 参数 */
  standalone?: boolean
  /** 把调试句柄挂到 `window.__claw`（e2e / 截图走查用） */
  debug?: boolean
}

export interface ClawApp {
  /** 收干净：rAF、监听、定时器、WebGL context、物理 world。可重复调用。 */
  destroy(): Promise<void>
  /** 调试句柄（`debug: true` 时同时挂到 `window.__claw`） */
  debug: Record<string, unknown>
}

/* ============================ 工厂 ============================ */

export async function createClawApp(opts: ClawAppOptions): Promise<ClawApp> {
  const { root, kv, wallet, standalone = false, debug: wantDebug = false } = opts
  if (!root) throw new Error('createClawApp: 需要一个根元素')

  if (opts.html) root.insertAdjacentHTML('beforeend', opts.html)
  opts.patch?.(root)

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
    const el = root.querySelector('#' + id)
    if (!el) throw new Error(`[claw] 找不到 #${id} —— DOM 没注入全？`)
    return el as T
  }

  const params = standalone ? new URLSearchParams(location.search) : new URLSearchParams()
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window

  /* ---------------- 生命周期工具：每一样都要能撤 ---------------- */

  let disposed = false
  const cleanups: Array<() => void> = []
  const timers = new Set<ReturnType<typeof setTimeout>>()

  /** 挂监听 + 记账。**不要直接 addEventListener** —— 卸载时找不到它。 */
  function listen(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) {
    target.addEventListener(type, fn, options)
    cleanups.push(() => target.removeEventListener(type, fn, options))
  }

  /** `setTimeout` + 记账。卸载时全部清掉，否则回调会在空 DOM 上跑。 */
  function later(fn: () => void, ms: number) {
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn() }, ms)
    timers.add(id)
    return id
  }

  /* ---------------- 存档（原来是 localStorage） ---------------- */

  type Prefs = { theme: string; q: string; guide: string; keys: string; bag: string }
  const raw: Prefs = { theme: '', q: '', guide: '', keys: '', bag: '' }
  for (const k of Object.keys(raw) as (keyof Prefs)[]) raw[k] = (await kv.get(k)) ?? ''

  let bag: Record<string, number> = {}
  try { bag = JSON.parse(raw.bag || '{}') as Record<string, number> } catch { bag = {} }
  if (!bag || typeof bag !== 'object') bag = {}

  let bagTimer: ReturnType<typeof setTimeout> | null = null
  function saveBag() {
    if (bagTimer) clearTimeout(bagTimer)
    // 400ms 防抖：一次抓取会连续改，没必要每条都落盘
    bagTimer = setTimeout(() => {
      bagTimer = null
      void kv.set('bag', JSON.stringify(bag)).catch((e) => console.warn('[claw] 存档写入失败', e))
    }, 400)
    timers.add(bagTimer)
  }

  /* ---------------- renderer / scene ---------------- */

  /*
   * ★ 材质必须在**建场景之前**换一套新的。
   *
   * `models.ts` 里的材质表是懒建的（第一次读 `M.xxx` 时才建）。它不能是
   * 模块级单例：插件会被反复挂载，上一次 `unmount` 已经把材质 `dispose()` 了，
   * 再拿到的是**已销毁的对象** —— 黑屏或纯白，**不报错**。
   */
  useFreshMaterials()

  const canvas = $<HTMLCanvasElement>('c')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.info.autoReset = false
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe8e4de)
  scene.fog = new THREE.Fog(0xe8e4de, 6, 14)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(buildEnvScene(), 0.02).texture
  scene.environment = envTex
  scene.environmentIntensity = 0.65

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60)
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08
  // 方位角的上下限**不能写死**：得由 CAM_SPEC 里最侧的那一档推出来，
  // 否则侧面（1.40）超出上限，会被 controls.update() 悄悄夹回去 —— 见下面 AZ_LIMIT。
  controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.62; controls.rotateSpeed = 0.55
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }
  controls.enabled = false

  // lights: dim warm mall ceiling + the cabinet's own cool-white tubes
  scene.add(new THREE.HemisphereLight(0xfff5f0, 0xc8c0b8, 0.55))
  const sun = new THREE.DirectionalLight(0xfff8f2, 1.5) // the cabinet tubes, as a shadow-casting key
  sun.position.set(0.05, 3.2, 0.35); scene.add(sun, sun.target)
  sun.castShadow = true
  Object.assign(sun.shadow.camera, { left: -0.62, right: 0.62, top: 0.55, bottom: -0.55, near: 1.6, far: 4 })
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012; sun.shadow.radius = 4
  const fill = new THREE.DirectionalLight(0xffe8f0, 0.9); fill.position.set(-0.8, 2.6, 3.2); scene.add(fill)
  const inner = new THREE.SpotLight(0xfff5fa, 2.8, 2.2, 1.0, 0.8, 1.5); inner.position.set(0, 1.17, 0.3); scene.add(inner, inner.target)
  const doorLight = new THREE.PointLight(0xffb060, 0, 0.5, 2); doorLight.position.set(-0.3, -0.52, 0.44); scene.add(doorLight)

  // guide under the claw: soft contact shadow + theme-coloured target ring with a centre dot
  const aim = new THREE.Group(); scene.add(aim)
  const aimRingMat = new THREE.MeshBasicMaterial({ color: THEMES[0].led, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })
  {
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext('2d')!
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      return new THREE.CanvasTexture(c)
    })()
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }))
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.017, 0.021, 32), aimRingMat)
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 16), aimRingMat)
    for (const m of [sh, ring, dot]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 5; aim.add(m) }
    ring.position.y = dot.position.y = 0.001
  }

  // world
  scene.add(buildRoom())
  let themeIdx = (Number(raw.theme || 0) || 0) % THEMES.length
  const machine = buildMachine(THEMES[themeIdx]); scene.add(machine.root)
  applyTheme(machine, THEMES[themeIdx])

  function setTheme(i: number) {
    themeIdx = ((i % THEMES.length) + THEMES.length) % THEMES.length
    void kv.set('theme', String(themeIdx))
    applyTheme(machine, THEMES[themeIdx])
    const t = THEMES[themeIdx]
    // ★ 变量落在 root 上，不是 documentElement —— 后者会**改到宿主**的配色
    root.style.setProperty('--accent', t.accentHex)
    root.style.setProperty('--accent-soft', '#' + t.accentSoft.toString(16).padStart(6, '0'))
    root.style.setProperty('--accent-dark', '#' + t.dark.toString(16).padStart(6, '0'))
    root.querySelectorAll('#themes button').forEach((b, j) => b.classList.toggle('on', j === themeIdx))
    aimRingMat.color.setHex(t.led)
    if (standalone) {
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#' + t.accentSoft.toString(16).padStart(6, '0'))
    }
  }

  {
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.238, 0.04, 0.27), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 }))
    bin.position.set(machine.doorPos.x, BIN_FLOOR_Y - 0.021, 0.34); bin.receiveShadow = true; scene.add(bin)
  }
  machine.root.traverse((o) => { o.castShadow = false })
  for (const o of [machine.beam, machine.carriage, machine.hub, machine.cable, ...machine.prongs]) o.traverse((c) => { c.castShadow = true })
  // 取景按「机台实际占多大」算，不手写数字（爪子会动，所以不含吊爪 —— 见 machineExtent）
  const ext = machineExtent(machine)

  /* ---------------- win: prize drops into the pickup window, lamp blinks, a plain card ---------------- */

  let winNo = 0, doorBlink = 0, doorHold = 0, doorCam = 0
  function showWin(prize: Prize, vouchers: number) {
    winNo++
    $('winName').textContent = prize.type.name
    const extra = vouchers > 0 ? ` · +${vouchers} 兑换券` : ''
    $('winSub').textContent = `${prize.colorName} · 你的第 ${bagCount()} 个奖品${extra}`
    startPreview(prize)
    $('win').classList.add('show')
    goDoor(); doorCam = 3.5
  }

  // small turntable preview of the won toy, rendered once per frame into its own little canvas
  let prev: { r: THREE.WebGLRenderer; s: THREE.Scene; c: THREE.PerspectiveCamera } | null = null
  let prevModel: PlushModel | null = null
  let prevOn = false

  function startPreview(prize: Prize) {
    const cv = $<HTMLCanvasElement>('winPrev')
    if (!prev) {
      try {
        const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power' })
        r.setPixelRatio(1); r.setSize(240, 240, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1
        const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0xe6d8de, 2.4))
        const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(0.6, 1.4, 1.6); s.add(d)
        const c = new THREE.PerspectiveCamera(28, 1, 0.01, 5); prev = { r, s, c }
      } catch { cv.style.display = 'none'; return }
    }
    if (prevModel) { prev.s.remove(prevModel.group); disposePlush(prevModel) }
    prevModel = buildPrize(prize.type, prize.color, prize.seed)
    const box = new THREE.Box3().setFromObject(prevModel.group)
    const ctr = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3()).length()
    prevModel.group.position.sub(ctr); prevModel.u.uCenter.value.set(0, 0, 0); prevModel.u.uFloorY.value = -10
    prev.c.position.set(0, sz * 0.35, sz * 2.0); prev.c.lookAt(0, 0, 0)
    const pivot = new THREE.Group(); pivot.add(prevModel.group); prev.s.add(pivot)
    ;(prevModel as unknown as { pivot: THREE.Group }).pivot = pivot
    prevOn = true
  }

  function renderPreview(t: number) {
    if (!prevOn || !prev || !prevModel) return
    const pv = (prevModel as unknown as { pivot: THREE.Group }).pivot
    pv.rotation.y = t * 0.9; pv.position.y = Math.sin(t * 2.2) * 0.004
    prev.r.render(prev.s, prev.c)
  }

  function hideWin() { prevOn = false; $('win').classList.remove('show'); if (doorView) { doorCam = 0; goView(camMode) } }

  // taking prizes out of the pickup window: the toy slides out through the flap and disappears
  const taking = new Map<number, { m: PlushModel; t: number; p0: THREE.Vector3; s0: number }>()
  function takePrizes() {
    for (const p of [...game.prizes]) {
      if (!p.won) continue
      const m = models.get(p.uid)
      if (!m) { game.removePrize(p); continue }
      taking.set(p.uid, { m, t: 0, p0: m.group.position.clone(), s0: m.group.scale.x })
      models.delete(p.uid)
      game.removePrize(p)
    }
    doorHold = 0
  }

  function updateTaking(dt: number) {
    for (const [uid, k] of taking) {
      k.t += dt / 0.45; const e = Math.min(1, k.t)
      k.m.group.position.set(k.p0.x, k.p0.y + Math.sin(e * Math.PI) * 0.03, k.p0.z + e * 0.35)
      k.m.group.scale.setScalar(k.s0 * (1 - e * e))
      k.m.u.uCenter.value.copy(k.m.group.position); k.m.u.uFloorY.value = -10
      if (e >= 1) { scene.remove(k.m.group); disposePlush(k.m); taking.delete(uid) }
    }
  }

  $('winOk').addEventListener('click', () => { sfx.click(); hideWin(); takePrizes(); sfx.take() })

  /* ---------------- post-processing / quality ---------------- */

  const QUALITY = ['低', '中', '高']
  const nav = navigator as Navigator & { deviceMemory?: number }
  const lowEnd = (nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 4 || !renderer.capabilities.isWebGL2
  /*
   * 画质：URL 参数 > 存档 > 按设备猜。
   *
   * ⚠️ 不能用 `??` 串起来：`raw.q` 没存过时是**空串**（不是 null/undefined），
   * `'' ?? x` 不会走到兜底，于是 `Number('') === 0` —— 所有新玩家都被
   * 静默钉在最低画质上，而且界面上「低」是亮的，看着像正常。
   */
  const qRaw = standalone ? params.get('q') : new URLSearchParams(location.search).get('clawq')
  const qSaved = qRaw ?? (raw.q || null)
  let quality = qSaved != null && qSaved !== ''
    ? Math.max(0, Math.min(2, Number(qSaved) || 0))
    : (isTouch ? (lowEnd ? 0 : 1) : 2)
  let composer: EffectComposer | null = null
  let grain: ShaderPass | null = null

  /** 容器尺寸 —— 插件里 `window.innerWidth` 是**宿主**的窗口，不是这块游戏的地盘。 */
  function boxSize() {
    return { w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight) }
  }

  function applyQuality() {
    const dpr = Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][quality])
    renderer.setPixelRatio(dpr)
    const ss = [512, 1024, isTouch ? 2048 : 4096][quality]
    if (sun.shadow.mapSize.x !== ss) { sun.shadow.mapSize.set(ss, ss); sun.shadow.map?.dispose(); sun.shadow.map = null }
    setFurShells([0, 4, 7][quality])
    composer?.dispose(); composer = null
    if (quality > 0) {
      const { w, h } = boxSize()
      const rt = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: quality === 2 ? 4 : 2 })
      composer = new EffectComposer(renderer, rt)
      composer.setPixelRatio(dpr)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new OutputPass())
      grain = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uAmt: { value: 0.022 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; uniform float uAmt; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT) * 43758.5453); }
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          vec2 q = vUv - 0.5; float v = 1.0 - dot(q, q) * 0.35;
          c.rgb *= v; c.rgb += (h(gl_FragCoord.xy) - 0.5) * uAmt;
          gl_FragColor = vec4(c.rgb, 1.0); }`,
      })
      composer.addPass(grain)
    } else grain = null
    root.querySelectorAll<HTMLElement>('#qseg button').forEach((b) => b.classList.toggle('on', Number(b.dataset.q) === quality))
    resize()
  }

  /* ---------------- camera framing ---------------- */

  const target = new THREE.Vector3(0, 0.6, 0)
  /*
   * 机位只有两个：正面、侧面。
   *
   * 以前是三个（正面 / 斜侧 / 俯视）靠一个 📷 按钮循环切换。循环切换的问题是
   * 「按两次才知道自己在哪」，而且斜侧那档既看不清左右也看不清前后。
   * 玩家真正要判断的只有一件事 —— 爪子到底在不在娃娃正上方：
   * 正面看**左右**，侧面看**前后**。所以只留这两档，一个机位一个按钮，点哪档就是哪档。
   *
   * 侧面**不是正 90°**：留了 10° 的偏角（az = 1.40 ≈ 80°），还能看见一点柜门和取物口。
   * 纯 90° 时机台只剩一个方盒子，认不出是哪一面。prize-park 也是这么摆的（`outPos.set(d, y, 0.5)`）。
   */
  type CamMode = 'front' | 'side'
  const CAM_MODES: CamMode[] = ['front', 'side']
  /**
   * 两档的定义。**框取尺寸全部由 `ext` 现算**（机台实际包围盒），不写死 ——
   * 写死过的后果：正面按「半宽 0.62」算，而机台加控制台实际半宽 0.65，
   * 于是左右各出画一点、上下被底栏压住 40~160px，画面看着只是「机台有点大」。
   */
  const CAM_SPEC: Record<CamMode, { az: number; polWide: number; polNarrow: number; k: number }> = {
    // pol* 是宽 / 窄屏的俯角；k 是**整条距离**的缩放，不是屏占比 ——
    // 屏占比会让两个轴一起缩，反而把本来贴边的那条轴顶出去
    front: { az: 0, polWide: 1.30, polNarrow: 1.26, k: 1.05 },
    /*
     * 侧面不是正 90°：留 10° 偏角（az = 1.40 ≈ 80°），还能看见一点柜门和取物口。
     * 纯 90° 时机台只剩一个方盒子，认不出这是哪一面。
     * prize-park 那边也不在正轴上（`outPos.set(d, y, 0.5)`）。
     */
    side: { az: 1.40, polWide: 1.26, polNarrow: 1.22, k: 1.02 },
  }
  /*
   * 自由旋转的方位角上限跟着机位走。
   *
   * 踩过：这里原来写死 ±1.0，而新的「侧面」是 1.40 —— 点下去相机只转到 57°（正好 1.0 rad）
   * 就停住，看着像按钮没生效。原因是 OrbitControls.update() 每帧都会把 theta 夹进
   * [minAzimuthAngle, maxAzimuthAngle]，**不报错、不提示**，只是到不了位。
   */
  const AZ_LIMIT = Math.max(...CAM_MODES.map((m) => Math.abs(CAM_SPEC[m].az))) + 0.05
  controls.minAzimuthAngle = -AZ_LIMIT; controls.maxAzimuthAngle = AZ_LIMIT
  let camMode: CamMode = 'front'
  /** 出奖时蹲下去看取物口 —— 那不是机位，所以两档都不亮；关掉后回到原来那档 */
  let doorView = false
  let camAnim: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number; dur: number } | null = null
  let visFrac = 1, hFrac = 1, wideLayout = false

  /**
   * 某一档要**框住的那块**在垂直于视线方向上的半宽 / 半高（世界单位）。
   *
   * 正面看的是宽度 → 用 hx；侧面看的是进深 → 用 hz（控制台前探的 0.19 也算进去，
   * 不然侧视角会把控制台切掉）。高度两档都要框（灯箱顶到轮子）。
   * 半高按「离瞄准点最远的一侧」算，不是包围盒高的一半 —— 相机瞄的是 target.y=0.6，
   * 而机台中心在 0.25 附近，上下不对称，取半高会让灯箱顶出画。
   */
  function frameOf(mode: CamMode) {
    const halfW = (mode === 'front' ? ext.hx : ext.hz) * 1.02
    const halfH = Math.max(Math.abs(ext.yMax - target.y), Math.abs(ext.yMin - target.y)) * 1.02
    return { halfW, halfH }
  }

  /**
   * 站多远。
   *
   * 两个约束取大：① 横向塞得下（含屏形 / 侧边栏占掉的宽度）② 纵向塞得下（含顶栏和
   * 控制台占掉的高度）。**不能只看横向** —— 竖屏时纵向可视区只有 439px（667 屏里
   * 顶栏 56 + 控制台 172 都吃掉），只按宽度算距离会让机台高度溢出 1.5 倍。
   */
  function fitDist(mode: CamMode) {
    const s = CAM_SPEC[mode]
    const { halfW, halfH } = frameOf(mode)
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const pol = wideLayout ? s.polWide : s.polNarrow
    const dW = halfW / (vt * camera.aspect * hFrac)
    // 1.06 是「顶栏 56 + 控制台 172 之外再留一点」—— 机台贴边看着像被切掉了
    const dH = (halfH * 1.16) / (vt * visFrac)
    return Math.max(dW, dH) * s.k
  }

  function resize() {
    if (disposed) return
    const { w, h } = boxSize()
    camera.aspect = w / h
    wideLayout = w > h * 1.05
    const compact = wideLayout && h < 560
    root.classList.toggle('wide', wideLayout)
    root.classList.toggle('compact', compact)
    const side = wideLayout ? Math.round(compact ? Math.min(190, w * 0.22) : Math.min(320, Math.max(230, w * 0.15))) : 0
    root.style.setProperty('--side', side + 'px')
    const top = $('board').offsetHeight || 50
    root.style.setProperty('--top', top + 'px')
    const bot = wideLayout ? 0 : ($('deck').offsetHeight || 150)
    visFrac = Math.max(0.4, (h - top - bot - (wideLayout ? 12 : 0)) / h)
    hFrac = Math.max(0.3, (w - side * 2) / w)
    target.y = wideLayout ? 0.45 : 0.35
    camera.setViewOffset(w, h, 0, (bot - top) / 2, w, h)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    composer?.setSize(w, h)
    // 距离不预存：切机位时按当前屏形现算，避免「竖屏切横屏后还按旧屏形站」
    const d = fitDist(camMode)
    controls.minDistance = d * 0.5; controls.maxDistance = d * 1.3
  }

  function animCam(p1: THREE.Vector3, t1: THREE.Vector3, dur = 0.9) {
    camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, t: 0, dur }
  }

  function goView(mode: CamMode, instant = false) {
    camMode = mode; doorView = false
    const s = CAM_SPEC[mode]
    const d = fitDist(mode)
    const pol = wideLayout ? s.polWide : s.polNarrow
    const p = new THREE.Vector3().setFromSpherical(new THREE.Spherical(d, pol, s.az)).add(target)
    // 两档站的距离不一样，缩放范围要跟着换；不换的话切到侧面后 pinch 会「卡住不动」
    controls.minDistance = d * 0.5; controls.maxDistance = d * 1.3
    syncCamChips()
    if (instant) { controls.target.copy(target); camera.position.copy(p); camera.lookAt(target); controls.update(); return }
    animCam(p, target.clone())
  }

  /** 机位按钮的高亮跟着 camMode 走；蹲下看取物口时两档都不亮 */
  function syncCamChips() {
    root.querySelectorAll<HTMLElement>('#views [data-cam]').forEach((b) => {
      const on = b.dataset.cam === camMode && !doorView
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }

  /** crouch a little and look at the pickup window */
  function goDoor() {
    doorView = true; syncCamChips()
    const t = new THREE.Vector3(machine.doorPos.x + 0.08, -0.52, 0.36)
    const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const d = Math.max(0.32 / (vt * camera.aspect * hFrac), 0.34 / (vt * visFrac))
    animCam(new THREE.Vector3(t.x + d * 0.1, t.y + d * 0.16, t.z + d * 0.98), t, 1.1)
  }

  let resizeRaf = 0
  function onResize() {
    if (disposed) return
    cancelAnimationFrame(resizeRaf)
    resizeRaf = requestAnimationFrame(() => {
      if (disposed) return
      resize()
      if (!intro && !doorView && !closeup) goView(camMode)
    })
  }

  /*
   * 尺寸变化有两个来源，**两个都要听**：
   *   · 窗口变了（横竖屏 / 浏览器缩放）—— 插件里也可能发生；
   *   · 容器变了（平板断点切换、宿主侧栏展开）—— 窗口没变，但游戏的地盘变了。
   * 只监听 window 的话，第二种情况下画布会停在旧尺寸上（拉伸变形），
   * 而 `resize` 事件一次都不来。
   */
  listen(window, 'resize', onResize)
  listen(window, 'orientationchange', () => later(onResize, 250))
  window.visualViewport?.addEventListener('resize', onResize)
  cleanups.push(() => window.visualViewport?.removeEventListener('resize', onResize))
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
  ro?.observe(root)
  cleanups.push(() => ro?.disconnect())

  root.classList.toggle('fine', matchMedia('(pointer: fine)').matches)

  /*
   * 不许滚动 / 捏合 / 长按菜单。
   *
   * ⚠️ 这几条原来挂在 `document` 上，**必须收到 root 上** ——
   * 全局 `touchmove` 的 `preventDefault` 会让**宿主**整页滑不动，
   * 而症状是「农场页滚不了了」，没人会想到是娃娃机干的。
   */
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu'] as const) {
    listen(root, ev, (e) => e.preventDefault(), { passive: false })
  }
  listen(root, 'touchmove', (e) => { const te = e as TouchEvent; if (te.cancelable) te.preventDefault() }, { passive: false })

  // audio unlock on the first interaction of any kind
  const unlockAudio = () => sfx.unlock()
  listen(root, 'pointerdown', unlockAudio, { once: true, capture: true })
  listen(root, 'keydown', unlockAudio, { once: true, capture: true })

  /* ---------------- game ---------------- */

  const sfx = new Sfx()
  let game!: ClawGame
  const models = new Map<number, PlushModel>()
  let timeLeft = 0, lastTick = 99, intro = true
  let closeup = false

  const ui = {
    coins: $('coins').querySelector('b')!, timer: $('timer').querySelector('b')!, bag: $('bag').querySelector('b')!,
    insert: $<HTMLButtonElement>('insert'), grab: $<HTMLButtonElement>('grab'), joy: $('joy'), knob: $('knob'),
    hint: $('hint'), hintTxt: $('hintTxt'),
  }

  // theme chips
  {
    const host = $('themes')
    THEMES.forEach((t, i) => {
      const b = document.createElement('button')
      b.type = 'button'; b.title = t.name; b.style.background = t.accentHex
      b.addEventListener('click', () => { sfx.click(); setTheme(i) })
      host.appendChild(b)
    })
    setTheme(themeIdx)
  }

  /* ---- toasts: one at a time, top-centre under the HUD ---- */
  type ToastKind = 'info' | 'ok' | 'warn' | 'miss' | 'coin' | 'win'
  const TICON: Record<ToastKind, string> = { info: 'i-alert', ok: 'i-check', warn: 'i-clock', miss: 'i-hand', coin: 'i-coin', win: 'i-gift' }
  let toastEl: HTMLElement | null = null, toastT = 0

  function dropToast() {
    const el = toastEl; toastEl = null
    if (!el) return
    el.classList.remove('in'); el.classList.add('out')
    later(() => el.remove(), 240)
  }

  function toast(title: string, kind: ToastKind = 'info', sub = '', dur = 1.8) {
    if (disposed) return
    dropToast()
    const el = document.createElement('div')
    el.className = 'toast ' + kind; el.setAttribute('role', 'status')
    el.innerHTML = `<span class="ti"><svg><use href="#${TICON[kind]}"/></svg></span><span class="tt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>`
    $('toasts').appendChild(el); void el.offsetWidth; el.classList.add('in')
    toastEl = el; toastT = dur
  }

  /* ---- persistent state line above the drop button ---- */
  function status(text: string, kind = 'idle') { ui.hintTxt.textContent = text; ui.hint.className = 'hint ' + kind }
  function bagCount() { return Object.values(bag).reduce((a, b) => a + (Number(b) || 0), 0) }

  function refreshUI() {
    if (disposed) return
    const coins = wallet.coins
    ui.coins.textContent = String(coins)
    ui.bag.textContent = String(bagCount())
    const st = game?.state ?? 'idle'
    const idle = st === 'idle', play = st === 'play'
    ui.insert.classList.toggle('gone', !idle)
    ui.insert.classList.toggle('attn', idle && !intro)
    ui.insert.querySelector('small')!.textContent = coins > 0 ? '1 币 / 局' : '币不足'
    ui.grab.classList.toggle('disabled', !play); ui.grab.setAttribute('aria-disabled', String(!play))
    $('coins').classList.toggle('empty', coins <= 0)
    ui.joy.classList.toggle('disabled', !play)
    if (!play) ui.timer.textContent = '--'
    if (!play) $('timer').classList.remove('urgent')
    const S: Record<string, [string, string]> = {
      // ⚠️ 别写「领取」：插件里币是用积分**换**的，说「领取」会让家长以为在送钱
      idle: coins > 0 ? ['投币开始游戏', 'idle'] : ['币用完了 · 点投币补充', 'empty'],
      play: [isTouch ? '对准娃娃，按下爪' : '对准娃娃，按空格下爪', 'play'],
      descend: ['下爪中…', 'busy'], close: ['合爪中…', 'busy'], lift: ['提起中…', 'busy'], hold: ['提起中…', 'busy'],
      return: ['送往出口…', 'busy'], release: ['松爪…', 'busy'], reset: ['复位中…', 'busy'],
    }
    const [txt, kind] = S[st] ?? ['', 'busy']
    status(txt, kind)
  }

  /**
   * 投币 = **先扣钱、再开局**。
   *
   * `paying` 那道闸不是为了性能：`await wallet.pay()` 期间有 1~2 帧，
   * 连点两下会两次都通过上面那句 `game.state !== 'idle'` —— 于是扣两次钱
   * 只玩一局（或者反过来）。这和奖品公园 `wallet.js` 里 `serial()` 是同一个理由。
   */
  let paying = false
  async function insertCoin() {
    if (disposed) return
    sfx.unlock()
    if (game.state !== 'idle') return
    if ($('win').classList.contains('show')) takePrizes()
    hideWin()
    if (wallet.coins < 1) { sfx.click(); openModal('nocoin'); refreshUI(); return }
    if (paying) return
    paying = true
    let ok = false
    try { ok = await wallet.pay(1) } finally { paying = false }
    if (disposed) return
    if (!ok) { sfx.click(); refreshUI(); openModal('nocoin'); return }
    sfx.coin(); vibrate(30)
    game.startRound(); timeLeft = ROUND_TIME; lastTick = 99; held = null; heldShown = false
    toast('投币成功', 'coin', `本局 ${ROUND_TIME} 秒 · 剩余 ${wallet.coins} 币`, 1.5)
    refreshUI()
  }

  function doGrab() {
    if (disposed || game.state !== 'play') return
    sfx.click(); vibrate([20, 30, 40])
    game.drop()
  }

  // joystick
  const joy = { x: 0, y: 0, id: -1 }
  const keyIn = { x: 0, y: 0 }
  function joyMove(e: PointerEvent) {
    const r = ui.joy.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const max = r.width * 0.36; const l = Math.hypot(dx, dy)
    if (l > max) { dx *= max / l; dy *= max / l }
    ui.knob.style.transform = `translate(${dx}px, ${dy}px)`
    const nx = dx / max, ny = -dy / max, m = Math.hypot(nx, ny), dead = 0.12
    const k = m < dead ? 0 : (m - dead) / (1 - dead) / m
    joy.x = nx * k; joy.y = ny * k
  }

  ui.grab.addEventListener('pointerdown', () => {
    if (game.state !== 'idle' || intro) return
    const coins = wallet.coins
    sfx.click(); vibrate(15)
    toast(coins > 0 ? '请先投币' : '币用完了', 'info', coins > 0 ? '点右下角「投币」开始一局' : '点「投币」换几个币', 1.6)
    ui.insert.classList.remove('nudge'); void ui.insert.offsetWidth; ui.insert.classList.add('nudge')
  })
  ui.joy.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; ui.joy.setPointerCapture(e.pointerId); ui.joy.classList.add('drag'); joyMove(e); vibrate(8); e.preventDefault() })
  ui.joy.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e) })
  const joyEnd = (e: PointerEvent) => {
    if (e.pointerId !== joy.id) return
    joy.id = -1; joy.x = joy.y = 0; ui.joy.classList.remove('drag'); ui.knob.style.transform = ''
  }
  ui.joy.addEventListener('pointerup', joyEnd)
  ui.joy.addEventListener('pointercancel', joyEnd)
  ui.grab.addEventListener('pointerdown', (e) => { e.preventDefault(); doGrab() })
  ui.insert.addEventListener('click', () => { void insertCoin() })

  const keys = new Set<string>()
  listen(window, 'keydown', (e) => {
    const ke = e as KeyboardEvent
    if (disposed) return
    keys.add(ke.code)
    if (intro) return
    if (/^(Key[WASD]|Arrow|Space|Enter)/.test(ke.code)) keysUsed()
    if (ke.repeat) { if (ke.code.startsWith('Arrow') || ke.code === 'Space') ke.preventDefault(); return }
    if (ke.code === 'Space') { ke.preventDefault(); if (game.state === 'idle') void insertCoin(); else doGrab() }
    else if (ke.code === 'Enter' || ke.code === 'NumpadEnter' || ke.code === 'KeyC') void insertCoin()
    else if (ke.code === 'KeyV') { sfx.click(); goView(camMode === 'front' ? 'side' : 'front') }
    else if (/^(Digit|Numpad)[12]$/.test(ke.code)) { sfx.click(); goView(CAM_MODES[Number(ke.code.slice(-1)) - 1]) }
    else if (ke.code === 'KeyM') $('snd').click()
    else if (ke.code === 'KeyF') toggleFullscreen()
    else if (ke.code === 'Escape') {
      if ($('win').classList.contains('show')) $('winOk').click()
      closeModal('drawer'); closeModal('nocoin'); setSettings(false)
    }
    if (ke.code.startsWith('Arrow')) ke.preventDefault()
  })
  listen(window, 'blur', () => keys.clear())

  // fullscreen: only meaningful when the page IS the game
  const fsEl = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  const fsSupported = standalone && !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen)
  $('fs').classList.toggle('hidden', !fsSupported)
  function toggleFullscreen() {
    if (!fsSupported) return
    const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen ?? d.webkitExitFullscreen)?.call(d)
    else (fsEl.requestFullscreen ?? fsEl.webkitRequestFullscreen)?.call(fsEl)?.catch?.(() => {})
  }
  $('fs').addEventListener('click', () => { sfx.click(); toggleFullscreen() })

  // gamepad: left stick / d-pad move, A drop, X or Start coin, Y camera
  const padIn = { x: 0, y: 0 }; const padPrev: boolean[] = []
  function readPad() {
    padIn.x = padIn.y = 0
    const pads = navigator.getGamepads?.(); if (!pads) return
    for (const gp of pads) {
      if (!gp) continue
      const b = (i: number) => !!gp.buttons[i]?.pressed
      let x = gp.axes[0] ?? 0, y = -(gp.axes[1] ?? 0)
      if (Math.hypot(x, y) < 0.18) x = y = 0
      x += (b(15) ? 1 : 0) - (b(14) ? 1 : 0); y += (b(12) ? 1 : 0) - (b(13) ? 1 : 0)
      padIn.x = Math.max(-1, Math.min(1, x)); padIn.y = Math.max(-1, Math.min(1, y))
      const edge = (i: number) => b(i) && !padPrev[i]
      if (!intro) {
        if (edge(0)) { if (game.state === 'idle') void insertCoin(); else doGrab() }
        if (edge(2) || edge(9)) void insertCoin()
        if (edge(3)) goView(camMode === 'front' ? 'side' : 'front')
      }
      gp.buttons.forEach((_, i) => (padPrev[i] = b(i)))
      break
    }
  }

  listen(window, 'keyup', (e) => keys.delete((e as KeyboardEvent).code))
  function readKeys() {
    keyIn.x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
    keyIn.y = (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0)
  }

  // tool buttons
  $('snd').addEventListener('click', () => {
    sfx.unlock(); sfx.setMuted(!sfx.muted)
    $('snd').setAttribute('aria-checked', String(!sfx.muted))
    if (!sfx.muted) sfx.click()
  })

  // settings popover
  const setPop = $('settings')
  function setSettings(open: boolean) {
    setPop.classList.toggle('show', open)
    $('set').classList.toggle('on', open)
    $('set').setAttribute('aria-expanded', String(open))
  }
  $('set').addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); setSettings(!setPop.classList.contains('show')) })
  setPop.addEventListener('pointerdown', (e) => e.stopPropagation())
  listen(root, 'pointerdown', (e) => {
    if (setPop.classList.contains('show') && !(e.target as HTMLElement).closest('#set')) setSettings(false)
  })
  root.querySelectorAll<HTMLElement>('#qseg button').forEach((b) => b.addEventListener('click', () => {
    sfx.click(); quality = Number(b.dataset.q); void kv.set('q', String(quality)); autoQ = false; applyQuality()
  }))

  // modals
  function openModal(id: string) {
    dropToast()
    const m = $(id)
    m.classList.remove('hidden'); void m.offsetWidth; m.classList.add('show')
  }
  function closeModal(id: string) {
    const m = $(id)
    m.classList.remove('show')
    later(() => { if (!m.classList.contains('show')) m.classList.add('hidden') }, 220)
  }

  /* ---- 「币不够」那颗按钮：文案和动作都由钱包决定 ---- */
  $('nocoinHint').textContent = wallet.recharge.hint
  $('claim').textContent = wallet.recharge.label
  $('claim').addEventListener('click', () => {
    void (async () => {
      const ok = await wallet.recharge.run()
      if (disposed) return
      if (!ok) { sfx.click(); toast('还不够', 'warn', '积分不够换币，先去做任务吧', 1.8); refreshUI(); return }
      sfx.coin(); vibrate(30)
      closeModal('nocoin'); refreshUI()
      toast('换到了', 'coin', `${wallet.recharge.label} · 现在有 ${wallet.coins} 币`, 1.6)
    })()
  })
  $('later').addEventListener('click', () => { sfx.click(); closeModal('nocoin') })

  // first-run onboarding (3 steps, skippable, remembered)
  let obStep = 0
  if (!isTouch) {
    const ps = root.querySelectorAll('#onboard .step p')
    ps[0].textContent = '用 W A S D / 方向键 或拖动摇杆，把爪子移到娃娃正上方'
    ps[1].textContent = '对准后按空格或红色按钮，爪子会下降抓取'
  }
  function showGuide(i: number) {
    obStep = i
    root.querySelectorAll('#onboard .step').forEach((s, j) => s.classList.toggle('on', j === i))
    root.querySelectorAll('#onboard .dots i').forEach((s, j) => s.classList.toggle('on', j === i))
    $('obNext').textContent = i === 2 ? '开始玩' : '下一步'
  }
  function endGuide() { void kv.set('guide', '1'); closeModal('onboard'); refreshUI() }
  $('obNext').addEventListener('click', () => { sfx.click(); if (obStep < 2) showGuide(obStep + 1); else endGuide() })
  $('obSkip').addEventListener('click', () => { sfx.click(); endGuide() })
  $('replayGuide').addEventListener('click', () => { sfx.click(); setSettings(false); showGuide(0); openModal('onboard') })

  // PC key panel: visible until the player has used the keyboard, then tucks away
  function keysUsed() {
    if (raw.keys) return
    raw.keys = '1'
    void kv.set('keys', '1')
    later(() => root.classList.add('keys-off'), 2500)
  }
  if (raw.keys) root.classList.add('keys-off')
  $('keysClose').addEventListener('click', () => { sfx.click(); raw.keys = '1'; void kv.set('keys', '1'); root.classList.add('keys-off') })
  $('showKeys').addEventListener('click', () => { sfx.click(); setSettings(false); root.classList.remove('keys-off') })

  // light haptic tick on every button press
  listen(root, 'pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest?.('.btn')
    if (b && !b.classList.contains('disabled')) vibrate(6)
  }, { passive: true })

  // 机位：一个按钮管一档，点哪档就是哪档（不再是「循环切换」）
  root.querySelectorAll<HTMLElement>('#views [data-cam]').forEach((b) => {
    b.addEventListener('click', () => {
      const m = b.dataset.cam as CamMode
      if (m === camMode && !doorView) return
      sfx.click(); goView(m)
    })
  })

  $('bag').addEventListener('click', () => {
    const list = $('bagList'); list.innerHTML = ''
    sfx.click(); let kinds = 0
    for (const t of PRIZE_TYPES) {
      const n = bag[t.id] ?? 0; if (n) kinds++
      const d = document.createElement('div'); d.className = 'it' + (n ? '' : ' none')
      const col = '#' + t.colors[0].toString(16).padStart(6, '0')
      d.innerHTML = `<span class="sw" style="--c:${col}"></span><span class="nm">${t.name}</span><span class="ct">${n ? '×' + n : '未获得'}</span>`
      list.appendChild(d)
    }
    $('bagTotal').textContent = `${kinds}/${PRIZE_TYPES.length} 种 · 共 ${bagCount()} 个`
    openModal('drawer')
  })
  $('closeBag').addEventListener('click', () => { sfx.click(); closeModal('drawer') })
  $('drawer').addEventListener('click', (e) => { if (e.target === $('drawer')) closeModal('drawer') })

  /* ---------------- events ---------------- */

  let lastThud = 0
  let held: Prize | null = null, heldNear = false, heldShown = false

  function onEvent(e: GameEvent) {
    switch (e.type) {
      case 'spawn': {
        const m = buildPrize(e.prize.type, e.prize.color, e.prize.seed)
        m.group.scale.setScalar(e.prize.scale)
        models.set(e.prize.uid, m); scene.add(m.group); break
      }
      case 'remove': {
        const m = models.get(e.prize.uid)
        if (m) { scene.remove(m.group); disposePlush(m); models.delete(e.prize.uid) }
        break
      }
      case 'win': {
        dropToast()
        const prize = e.prize
        bag[prize.type.id] = (bag[prize.type.id] ?? 0) + 1
        saveBag()
        sfx.chute(); vibrate([40, 60, 120]); doorBlink = 3.2; doorHold = 12
        /*
         * 奖品 → 兑换券，**不经过币**。
         *
         * 走 `wallet.award()`（宿主那边是 `mintVoucher`，一个事务里扣 1 币 + 发券）。
         * 绝不写成「先 mint 币再 redeem」：那是两个事务，中间崩一下就是「币还在」，
         * 而币能开局 ⇒ 抓娃娃自己就能续玩。
         */
        void (async () => {
          const got = await wallet.award(prize.type.id, prize.type.name)
          if (disposed) return
          later(() => { sfx.win(); showWin(prize, got); refreshUI() }, 450)
        })()
        refreshUI(); break
      }
      case 'impact': if (e.strength > 0.8 && game.time - lastThud > 0.08) { lastThud = game.time; sfx.thud(e.strength) } break
      case 'clank': sfx.clank(); vibrate(25); break
      case 'state': refreshUI(); break
      case 'roundEnd':
        if (!e.won) {
          sfx.lose()
          if (held && heldNear) toast('差一点！', 'miss', '就差一点点掉进出口', 1.9)
          else if (held) toast('滑掉了', 'miss', '夹住了但没夹稳，再试一次', 1.9)
          else toast('没抓住', 'miss', '试试对准娃娃的身体中间', 1.9)
        }
        held = null
        refreshUI(); break
    }
  }

  /* ---------------- sync visuals ---------------- */

  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), invQ = new THREE.Quaternion(), down = new THREE.Vector3(0, -1, 0)
  const contacts = new Map<Prize, ContactPt[]>()
  function inHole(x: number, z: number) { return x < HOLE.x1 + 0.03 && z > HOLE.z0 - 0.03 }

  function syncVisuals(dt: number, t: number) {
    updateTaking(dt)
    game.gatherProngContacts(contacts)
    for (const p of game.prizes) {
      const m = models.get(p.uid); if (!m) continue
      const tr = p.body.translation(), rq = p.body.rotation()
      m.group.position.set(tr.x, tr.y, tr.z); m.group.quaternion.set(rq.x, rq.y, rq.z, rq.w)
      invQ.copy(m.group.quaternion).invert()
      m.u.uCenter.value.set(tr.x, tr.y, tr.z)
      m.u.uFloorY.value = p.won ? BIN_FLOOR_Y : inHole(tr.x, tr.z) ? -10 : 0
      // squash spring (impacts) + squeeze bulge when gripped
      const cs = contacts.get(p)
      const grip = cs && cs.length >= 2 ? -0.07 : 0
      p.squashV += (-900 * (p.squash - grip) - 16 * p.squashV) * dt
      p.squash = Math.max(-0.2, Math.min(0.25, p.squash + p.squashV * dt))
      tmpV.set(0, 1, 0).applyQuaternion(invQ)
      m.u.uSquash.value.set(tmpV.x, tmpV.y, tmpV.z, p.squash)
      // prong dents (contact points -> local space)
      const dents = m.u.uDent.value
      for (const d of dents) d.w *= Math.exp(-12 * dt)
      if (cs) {
        let n = 0
        for (const c of cs) {
          if (n >= 3) break
          tmpV2.set(c.x - tr.x, c.y - tr.y, c.z - tr.z).applyQuaternion(invQ).divideScalar(p.scale)
          let dup = false
          for (let j = 0; j < n; j++) if (Math.hypot(dents[j].x - tmpV2.x, dents[j].y - tmpV2.y, dents[j].z - tmpV2.z) < 0.015) dup = true
          if (dup) continue
          const w = Math.min(0.012, 0.004 + c.imp * 0.6)
          dents[n].set(tmpV2.x, tmpV2.y, tmpV2.z, Math.max(dents[n].w, w)); n++
        }
      }
    }
    const h = game.hub.translation(), hq = game.hub.rotation()
    machine.hub.position.set(h.x, h.y, h.z); machine.hub.quaternion.set(hq.x, hq.y, hq.z, hq.w)
    game.prongs.forEach((b, i) => {
      const p = b.translation(), q = b.rotation()
      machine.prongs[i].position.set(p.x, p.y, p.z); machine.prongs[i].quaternion.set(q.x, q.y, q.z, q.w)
    })
    machine.carriage.position.set(game.cx, 0, game.cz)
    machine.beam.position.z = game.cz
    const top = tmpV.set(game.cx, CARRIAGE_Y - 0.02, game.cz)
    const hubTop = tmpV2.set(0, HUB_HH + 0.03, 0).applyQuaternion(machine.hub.quaternion).add(machine.hub.position)
    const dir = hubTop.sub(top); const len = dir.length()
    machine.cable.position.copy(top); machine.cable.quaternion.setFromUnitVectors(down, dir.normalize()); machine.cable.scale.set(1, len, 1)
    // prize-out ring + LED rims: breathe normally, flash on win
    const blinkOn = doorBlink > 0 ? (Math.floor(t * 6) % 2 ? 1 : 0.1) : doorHold > 0 ? 0.7 : 0.2 + 0.15 * Math.sin(t * 2.2)
    M.doorLamp.emissiveIntensity = blinkOn * 2.8
    doorLight.intensity = blinkOn * 0.4
    doorBlink = Math.max(0, doorBlink - dt); doorHold = Math.max(0, doorHold - dt)
    const chase = 1.4 + 0.7 * Math.sin(t * 3.5) + (doorBlink > 0 ? 1.5 * Math.abs(Math.sin(t * 12)) : 0)
    M.ledStrip.emissiveIntensity = chase
    M.tube.emissiveIntensity = 2.8 + Math.sin(t * 13.1) * 0.03
    // what the claw is carrying (for 抓住了 / 滑掉了 / 差一点 feedback)
    const gs = game.state
    if (gs === 'hold' || gs === 'return' || gs === 'release' || gs === 'lift') {
      let cur: Prize | null = null
      for (const p of game.prizes) {
        if (p.won) continue
        const cs = contacts.get(p)
        if (cs && cs.length >= 2 && p.body.translation().y > h.y - 0.2 && h.y > 0.55) { cur = p; break }
      }
      if (cur) {
        held = cur; heldNear = false
        if (!heldShown && gs !== 'lift') { heldShown = true; sfx.click(); vibrate(20); toast('抓住了！', 'ok', '稳住…送往出口', 1.6) }
      } else if (held && !held.won) {
        const tp = held.body.translation()
        heldNear = heldNear || (tp.x < HOLE.x1 + 0.12 && tp.z > HOLE.z0 - 0.12)
      }
    }
    const showAim = game.state === 'play'
    aim.visible = showAim
    if (showAim) { const sy = game.probeSurface(); aim.position.set(h.x, sy + 0.004, h.z) }
  }

  listen(document, 'visibilitychange', () => {
    if (document.hidden) { sfx.ctx?.suspend(); keys.clear() }
    else { last = performance.now(); acc = 0; if (!sfx.muted) sfx.ctx?.resume() }
  })

  /* ---------------- main loop ---------------- */

  let acc = 0, last = performance.now(), fpsAcc = 0, fpsN = 0
  let autoQ = !params.has('noauto') && !raw.q
  let playStart = 0, wasMoving = false
  const perf = { cpu: [] as number[], calls: 0, tris: 0, geo: 0, tex: 0 }
  let rafId = 0

  function frame(now: number) {
    if (disposed) return
    rafId = requestAnimationFrame(frame)
    const t0 = performance.now(); renderer.info.reset()
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    if (game.state === 'play') {
      readKeys(); readPad()
      let ix = joy.x + keyIn.x + padIn.x, iy = joy.y + keyIn.y + padIn.y
      const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m }
      const fwd = tmpV.copy(target).sub(camera.position); fwd.y = 0; fwd.normalize()
      game.input.x = -fwd.z * ix + fwd.x * iy; game.input.z = fwd.x * ix + fwd.z * iy
      timeLeft -= dt
      const sec = Math.ceil(Math.max(0, timeLeft))
      ui.timer.textContent = String(sec)
      if (sec <= 5 && sec !== lastTick) {
        if (lastTick > 5) toast('剩余 5 秒', 'warn', '快下爪！', 1.3)
        lastTick = sec
        $('timer').classList.add('urgent'); $('timer').classList.remove('beat'); void $('timer').offsetWidth; $('timer').classList.add('beat')
        sfx.tick(); vibrate(10)
      }
      if (timeLeft <= 0) doGrab()
    }
    acc += dt; let steps = 0
    while (acc >= 1 / 120 && steps < 6) { game.step(1 / 120); acc -= 1 / 120; steps++ }
    if (steps === 6) acc = 0
    // motor sounds
    const st: ClawState = game.state
    const spd = Math.hypot(game.vx, game.vz)
    const moving = spd > 0.02
    if (moving !== wasMoving) { sfx.gantry(moving); wasMoving = moving }
    if (st === 'descend' || st === 'lift') sfx.motorLevel(0.9, st === 'lift' ? 1.25 : 1.05)
    else sfx.motorLevel(Math.min(1, spd / 0.18), 0.8 + spd * 2.2)
    // camera
    if (intro) {
      const d0 = fitDist('front'); const tt = now / 1000
      camera.position.setFromSpherical(new THREE.Spherical(d0 * 1.12, 1.36 + Math.sin(tt * 0.27) * 0.025, Math.sin(tt * 0.19) * 0.22)).add(target)
      camera.lookAt(target)
    } else if (camAnim) {
      camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur); const k = camAnim.t * camAnim.t * (3 - 2 * camAnim.t)
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, k); controls.target.lerpVectors(camAnim.t0, camAnim.t1, k)
      camera.lookAt(controls.target)
      if (camAnim.t >= 1) camAnim = null
    }
    if (doorCam > 0 && !camAnim) { doorCam -= dt; if (doorCam <= 0 && doorView) goView(camMode) }
    if (!intro && !closeup && !camAnim) controls.update()
    // slight handheld sway (a person standing, not a tripod); undone after rendering
    const tt = now / 1000
    const sway = intro || closeup ? 0 : 1
    const sx = (Math.sin(tt * 0.71) + Math.sin(tt * 1.37 + 1) * 0.5) * 0.0025 * sway
    const sy = (Math.sin(tt * 0.53 + 2) + Math.sin(tt * 1.13) * 0.4) * 0.0018 * sway
    camera.position.x += sx; camera.position.y += sy
    syncVisuals(dt, now / 1000)
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) dropToast() }
    renderPreview(now / 1000)
    if (grain) grain.uniforms.uT.value = (now / 1000) % 100
    if (composer) composer.render(); else renderer.render(scene, camera)
    perf.cpu.push(performance.now() - t0); if (perf.cpu.length > 240) perf.cpu.shift()
    perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles
    perf.geo = renderer.info.memory.geometries; perf.tex = renderer.info.memory.textures
    camera.position.x -= sx; camera.position.y -= sy
    /*
     * 自动降画质：**开局后 4 秒才开始采样**。
     *
     * 原先从开局 +1.5s 起采，而开局这 1.5 秒正好是「镜头推近 + 材质 / 着色器首次编译」，
     * 软件渲染（SwiftShader、老安卓）在这段必然掉到 40 fps 以下 ⇒ **每次开局都把画质
     * 降一档**，玩家没做任何操作就看到「画质已调整为「低」」。实测 390×844 走查里
     * 3 个视口全部被降到「低」，画面比手选「高」糊一圈。
     * 真要保流畅，等首帧稳定再判断；也顺手把「用户手动选过画质」当刹车（autoQ=false）。
     */
    if (autoQ && playStart && now - playStart > 4000) {
      fpsAcc += dt; fpsN++
      if (fpsAcc > 4) {
        const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0
        if (fps < 42 && quality > 0) { quality--; applyQuality(); toast(`画质已调整为「${QUALITY[quality]}」`, 'info', '保持流畅运行', 1.6) }
        else autoQ = false
      }
    }
  }

  /* ---------------- boot ---------------- */

  const debug: Record<string, unknown> = {}
  const bar = $('bar'), txt = $('loadTxt')

  applyQuality()
  goView('front', true)
  bar.style.width = '15%'; txt.textContent = '正在加载物理引擎…'
  await RAPIER.init()
  if (disposed) return makeHandle()
  bar.style.width = '50%'; txt.textContent = '正在摆放娃娃…'
  await new Promise((r) => setTimeout(r, 30))
  if (disposed) return makeHandle()
  game = new ClawGame(RAPIER)
  game.on(onEvent)
  game.fill(30)
  bar.style.width = '80%'; txt.textContent = '正在编译着色器…'
  await new Promise((r) => setTimeout(r, 30))
  if (disposed) return makeHandle()
  renderer.compile(scene, camera)
  bar.style.width = '100%'; txt.textContent = '准备就绪'
  refreshUI()
  rafId = requestAnimationFrame(frame)
  $('start').classList.add('ready')

  const go = $<HTMLButtonElement>('go')
  go.disabled = false
  go.addEventListener('click', () => {
    if (disposed) return
    sfx.unlock(); sfx.click(); vibrate(20)
    $('start').classList.add('hide'); playStart = performance.now()
    intro = false; controls.enabled = true; root.classList.remove('intro'); goView('front')
    if (!raw.guide && !params.has('noguide')) later(() => { showGuide(0); openModal('onboard') }, 650)
    refreshUI()
  })

  /*
   * ⚠️ 会变的那几个**必须用 `defineProperties`**，不能写在 `Object.assign` 里。
   *
   * `Object.assign(debug, { get intro() { return intro } })` 会**当场求值**，
   * 把 `true` 这个**值**拷进去 —— 之后 intro 变成 false，句柄里还是 true。
   * 症状是走查脚本点了「开始游戏」却一直等不到 `__claw.intro === false`，
   * 看着像按钮没接上。实测踩过一次。
   */
  Object.defineProperties(debug, {
    game: { get: () => game, enumerable: true },
    state: { get: () => game?.state ?? 'idle', enumerable: true },
    intro: { get: () => intro, enumerable: true },
    camMode: { get: () => camMode, enumerable: true },
    bag: { get: () => ({ ...bag }), enumerable: true },
  })
  Object.assign(debug, {
    perf, renderer, scene, camera, joy, toast, openModal, closeModal, showGuide,
    insertCoin, doGrab, showWin, goDoor, goView, setTheme, wallet,
    /** 走查脚本量「机台占了多少画面」用 —— 探针里不方便再 import three */
    machineRoot: machine.root,
    camInfo: () => ({ mode: camMode, door: doorView, d: +fitDist(camMode).toFixed(3), ext, visFrac: +visFrac.toFixed(3), hFrac: +hFrac.toFixed(3), wide: wideLayout, fov: camera.fov }),
    bboxOf: (o: THREE.Object3D) => { o.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(o); return { min: b.min.toArray(), max: b.max.toArray() } },
    setQuality: (q: number) => { quality = q; applyQuality() },
    camBusy: () => !!camAnim || doorCam > 0,
    camAnimating: () => !!camAnim,
    setCam: (p: number[], t: number[]) => {
      camAnim = null; closeup = true
      camera.position.set(p[0], p[1], p[2]); camera.lookAt(t[0], t[1], t[2])
    },
    /** 走查脚本用：把开场页点掉，直接进主界面 */
    start: () => go.click(),
    /** 走查脚本用：等物理引擎真的就绪 */
    ready: true,
  })

  function makeHandle(): ClawApp {
    return { destroy, debug }
  }

  /* ---------------- 卸载 ---------------- */

  async function destroy() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(rafId)
    cancelAnimationFrame(resizeRaf)
    for (const id of timers) clearTimeout(id)
    timers.clear()
    if (bagTimer) { clearTimeout(bagTimer); bagTimer = null }
    for (const off of cleanups.splice(0)) { try { off() } catch { /* 已经没了就算了 */ } }

    // 音频：suspend 不够（节点还活着），直接 close
    try { await sfx.ctx?.close() } catch { /* 已关 */ }
    sfx.ctx = null

    // 物理：wasm 堆不会自己回收
    try { game?.world.free() } catch { /* 没建起来 */ }

    for (const m of models.values()) disposePlush(m)
    models.clear()
    if (prevModel) { prev?.s.remove(prevModel.group); disposePlush(prevModel); prevModel = null }

    // three.js：几何 / 材质 / 贴图 / render target，逐个走一遍
    scene.traverse((o) => {
      const any = o as unknown as {
        geometry?: { dispose(): void }
        material?: THREE.Material | THREE.Material[]
      }
      any.geometry?.dispose()
      const mats = Array.isArray(any.material) ? any.material : any.material ? [any.material] : []
      for (const m of mats) {
        for (const v of Object.values(m)) {
          if (v && typeof v === 'object' && typeof (v as { dispose?: unknown }).dispose === 'function' && (v as { isTexture?: boolean }).isTexture) {
            (v as { dispose(): void }).dispose()
          }
        }
        m.dispose()
      }
    })
    scene.clear()
    controls.dispose()
    composer?.dispose(); composer = null
    grain = null
    envTex.dispose()
    pmrem.dispose()
    prev?.r.dispose()
    prev = null
    renderer.dispose()
    /*
     * `dispose()` 只释放 three 自己那份资源，**WebGL context 仍然活着**。
     * 手机浏览器同时能开的 context 有上限（约 8~16），反复进出插件不释放
     * 就是「玩几次以后黑屏」，而且**没有任何报错**。所以显式丢一次。
     */
    try { renderer.forceContextLoss() } catch { /* 已经丢了 */ }

    if (wantDebug || (window as unknown as Record<string, unknown>).__claw === debug) {
      delete (window as unknown as Record<string, unknown>).__claw
    }
    root.classList.remove('intro', 'wide', 'compact', 'fine', 'keys-off')
    root.removeAttribute('style')
  }

  if (wantDebug) (window as unknown as Record<string, unknown>).__claw = debug

  return makeHandle()
}
