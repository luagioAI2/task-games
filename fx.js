/**
 * fx.js —— 替换 @makeplay/fx（3.25 MB → 约 12 KB）
 *
 * 为什么能砍掉 99.6%：原库带 52 个预设、2D/3D 双前端、bloom 后处理、成本预算器、
 * 播放节流器、flipbook 加载器、素材绑定…… 而这个游戏只用 4 个预设、只传 {pos, power}。
 *
 * 对外接口与原库**逐字兼容**，所以 game.js 一行不用改（只改 import 路径）：
 *   const fx = await createThreeFx({ THREE, renderer, world, camera, viewport, referenceSpan, onImpulse })
 *   fx.play(name, { pos, power })   fx.update(dt) -> timeScale
 *   fx.clear()   fx.dispose()   fx.diagnostics()
 *
 * 参数不是编的：全部照抄原库 4 个预设的 v4 定义（count / speed / lifetime / size /
 * spreadDeg / drag / gravity / sizeCurve / alphaCurve / impulse），
 * 所以换完之后画面应该和原来一致。基准图见 shots/fx/orig-*.png。
 *
 * 唯一需要标定的是 SIZE_K：原库的 size 单位换算到屏幕像素不是 1:1
 * （实测 light-hit 的 size .008~.018 画出来约 15px，而按世界单位直算只有 3px）。
 * 这里用一个常数统一放大，靠 A/B 截图对齐，见 scripts/fx-ab.cjs。
 */

// 尺寸/速度标定（重要，别当成「随便调的魔法数」）
// ------------------------------------------------------------------
// 原库的 size / speed 单位换算到世界坐标**不是**统一比例：实测 4 个预设各自差 2~8 倍
// （spark 约 3×，dust 约 4.8×，legendary 约 2×）。所以这里按预设各给一个系数，
// 数值由 shots/fx/orig-*.png 反推得到，判据是「同一时刻屏幕上占多少像素」。
//
// 想改观感就改这两个系数，改完务必重跑：
//   node scripts/fx-ab.cjs 4392 mine shots/fx   → 再拼图对比 orig
// 不要凭感觉调，否则很容易越调越偏。

const MAX_P = 640;   // 粒子池上限（原库 384 上限，这里给足）
const MAX_Q = 8;     // 柔光/光环 quad 池

// ---------------- 曲线 ----------------
class Curve {
  constructor(pts) { this.p = pts; }
  at(t) {
    const p = this.p;
    if (t <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (t <= p[i][0]) {
        const a = p[i - 1], b = p[i];
        const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return p[p.length - 1][1];
  }
}

const C = {
  sparkSize: new Curve([[0, 0.55], [0.18, 1.15], [1, 0]]),
  sparkAlpha: new Curve([[0, 1], [0.7, 0.85], [1, 0]]),
  dustSize: new Curve([[0, 0.25], [0.2, 1], [1, 1.45]]),
  dustAlpha: new Curve([[0, 0], [0.12, 0.72], [1, 0]]),
  pulse: new Curve([[0, 0.62], [0.22, 1], [0.55, 0.82], [1, 0.6]]),
  appear: new Curve([[0, 0], [0.12, 1], [0.55, 0.8], [1, 0]]),
  ringSize: new Curve([[0, 0.55], [0.18, 1], [1, 1.8]]),
  // teleport 的环实测**几乎不扩张**（t=117ms 半径 95px，t=617ms 85px），
  // 所以这里给一条接近水平的曲线，而不是原库默认的 1.8 倍扩张。
  ringFlat: new Curve([[0, 0.78], [0.15, 1], [1, 0.95]]),
  ringAlpha: new Curve([[0, 0], [0.1, 1], [1, 0]]),
  rewardGlow: new Curve([[0, 0], [0.1, 1], [0.5, 0.6], [1, 0]]),
  hold: new Curve([[0, 0.35], [0.2, 1], [0.7, 0.9], [1, 0]]),
};

// ---------------- 预设（数值来自原库）----------------
const PRESETS = {
  'light-hit': {
    sizeMul: 2.5, velMul: 3.4,
    burst: {
      count: 20, spread: 62, shape: 'cone',
      speed: [0.16, 0.34], life: [0.14, 0.30], size: [0.008, 0.018],
      drag: 3.4, gravity: 0.32, hard: 1, spin: [-8, 8],
      sizeCurve: C.sparkSize, alphaCurve: C.sparkAlpha,
      color: [1.0, 0.96, 0.86],
    },
    impulse: { add: 0.16, decay: 3.8, freq: 27, offset: 0.32, roll: 0.05, fov: 0 },
  },

  'land-dust': {
    sizeMul: 4.8, velMul: 4.6,
    burst: {
      // shape 用 sphere：cone 的 dy=cos(ph) 恒为正，云会整团往上飘；
      // puff（纵向压扁）在近水平视角下会变成一张扁饼。球形才对得上原版那团圆云。
      count: 62, spread: 135, shape: 'sphere',
      speed: [0.08, 0.24], life: [0.38, 0.78], size: [0.022, 0.050],
      drag: 2.7, gravity: -0.02, hard: 0, spin: [-2, 2],
      sizeCurve: C.dustSize, alphaCurve: C.dustAlpha,
      color: [0.42, 0.78, 1.0],
    },
  },

  'teleport-light': {
    sizeMul: 2.0, velMul: 2.0,
    burst: {
      count: 14, spread: 360, shape: 'radial',
      speed: [0.10, 0.34], life: [0.55, 0.78], size: [0.012, 0.026],
      drag: 2.2, gravity: 0.0, hard: 0, spin: [1.4, 1.4],
      sizeCurve: C.pulse, alphaCurve: C.appear,
      color: [0.55, 0.86, 1.0],
    },
    // 原库这个预设的核心是：一团实心亮核 + 一圈几乎不扩张的**厚毛边**光环 + 一条横向光带
    quads: [
      // 内层填充光：原版环里那一片是亮的，不是黑的
      { kind: 'glow', size: 0.34, life: 0.80, curve: C.pulse, alpha: C.appear, color: [0.30, 0.68, 1.0], stretch: 1.0, alphaMul: 0.30 },
      { kind: 'glow', size: 0.24, life: 0.75, curve: C.pulse, alpha: C.appear, color: [0.40, 0.78, 1.0], stretch: 1.0 },
      { kind: 'glow', size: 0.13, life: 0.70, curve: C.pulse, alpha: C.appear, color: [0.85, 0.97, 1.0], stretch: 1.0 },
      { kind: 'ring', size: 0.46, life: 0.85, curve: C.ringFlat, alpha: C.ringAlpha, color: [0.38, 0.78, 1.0], thickness: 0.18 },
      { kind: 'glow', size: 0.075, life: 0.60, curve: C.hold, alpha: C.appear, color: [0.88, 0.98, 1.0], stretch: 12.0 },
    ],
  },

  'legendary-reward': {
    sizeMul: 2.0, velMul: 2.9,
    burst: {
      count: 110, spread: 360, shape: 'sphere',
      speed: [0.30, 0.95], life: [0.55, 1.25], size: [0.012, 0.026],
      drag: 1.5, gravity: 0.10, hard: 1, spin: [0, 0],
      sizeCurve: C.hold, alphaCurve: C.rewardGlow,
      color: [1.0, 0.84, 0.42],
    },
    // 原库这里是「散开的暗金方点 + 中心一层很淡的暖雾」，没有光环、没有亮核
    alphaMul: 0.55,
    quads: [
      { kind: 'glow', size: 0.30, life: 1.05, curve: C.rewardGlow, alpha: C.rewardGlow, color: [1.0, 0.62, 0.26], stretch: 1.0, alphaMul: 0.45 },
    ],
  },
};

const VS = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3  aColor;
  attribute float aHard;
  uniform float uScale;
  varying float vAlpha;
  varying vec3  vColor;
  varying float vHard;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(0.001, -mv.z), 1.0, 512.0);
    vAlpha = aAlpha; vColor = aColor; vHard = aHard;
  }
`;

const FS = `
  varying float vAlpha;
  varying vec3  vColor;
  varying float vHard;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, r);
    soft *= soft;
    // 硬边粒子用「切比雪夫距离」才是真正的方块；用 length 得到的是圆盘，
    // 原库 legendary-reward / light-hit 的闪光是方块状，所以这里必须分开算。
    float sq = max(abs(d.x), abs(d.y)) * 2.0;
    float hard = 1.0 - step(0.74, sq);
    float a = mix(soft, hard, vHard) * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const QUAD_VS = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const QUAD_FS = `
  uniform vec3  uColor;
  uniform float uAlpha;
  uniform float uKind;   // 0 = 柔光, 1 = 环
  uniform float uThick;
  varying vec2 vUv;
  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float a;
    if (uKind < 0.5) {
      a = 1.0 - smoothstep(0.0, 1.0, r);
      a *= a;
    } else {
      // 光环：内缘要糊、外缘也要糊，中间实。
      // 试过用 sin(ang*k) 做「毛边」，但低频是花瓣、高频是十七边形，都比如实画一个干净的环难看。
      // 原版的毛边是噪声质感，两个正弦模拟不出来 —— 宁可干净，不要假毛边。
      float inner = 1.0 - uThick;
      a = smoothstep(inner - 0.10, inner + 0.06, r) * (1.0 - smoothstep(0.92, 1.02, r));
    }
    a *= uAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export async function createThreeFx(opts) {
  const { THREE, world: scene, camera, viewport, referenceSpan = 1, onImpulse } = opts;

  // ---- 粒子 ----
  const pos = new Float32Array(MAX_P * 3);
  const size = new Float32Array(MAX_P);
  const alpha = new Float32Array(MAX_P);
  const col = new Float32Array(MAX_P * 3);
  const hard = new Float32Array(MAX_P);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aHard', new THREE.BufferAttribute(hard, 1));
  geo.setDrawRange(0, 0);

  const pmat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, pmat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  // 粒子用普通对象数组（最多 640 个，开销可忽略，但可读性远好于并行数组）
  const live = [];
  const pool = [];

  // ---- quad（柔光 / 环）----
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const quads = [];
  for (let i = 0; i < MAX_Q; i++) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0 }, uKind: { value: 0 }, uThick: { value: 0.12 } },
      vertexShader: QUAD_VS, fragmentShader: QUAD_FS,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(quadGeo, m);
    mesh.visible = false;
    mesh.renderOrder = 9;
    scene.add(mesh);
    quads.push({ mesh, mat: m, active: false });
  }

  // ---- 相机抖动（原库公式照抄）----
  let phase = 0, shakeAmt = 0, impFreq = 24, impOffset = 0, impRoll = 0, impFov = 0;
  const view = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0, timeScale: 1 };
  // hit-stop：4 个预设都没有定义 hitstop，所以 timeScale 恒为 1。
  // 机制保留，将来要加就设 preset.hitstop = { ms, timeScale }。
  let hitstopRemain = 0, hitstopScale = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawnBurst(b, p, power, sizeMul, velMul, alphaMul) {
    const span = referenceSpan;
    const n = Math.max(1, Math.round(b.count * (0.55 + 0.45 * power)));
    for (let i = 0; i < n && live.length < MAX_P; i++) {
      const p0 = pool.pop() || {};
      // 方向：cone 沿 +Y 张开，radial 在水平面全向，sphere 全向
      let dx, dy, dz;
      if (b.shape === 'radial') {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a); dz = Math.sin(a); dy = rand(-0.15, 0.15);
      } else if (b.shape === 'sphere') {
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        dx = s * Math.cos(a); dy = u; dz = s * Math.sin(a);
      } else if (b.shape === 'puff') {
        // 球形但压扁纵向：像落地扬尘一样贴着地面向四周散，重心不跑
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(Math.max(0, 1 - u * u));
        dx = s * Math.cos(a); dy = u * 0.55; dz = s * Math.sin(a);
      } else {
        const half = (b.spread * Math.PI / 180) / 2;
        const th = Math.random() * Math.PI * 2, ph = Math.random() * half;
        dx = Math.sin(ph) * Math.cos(th); dz = Math.sin(ph) * Math.sin(th);
        dy = Math.cos(ph);
      }
      const sp = rand(b.speed[0], b.speed[1]) * span * velMul;
      p0.x = p.x; p0.y = p.y; p0.z = p.z;
      p0.vx = dx * sp; p0.vy = dy * sp; p0.vz = dz * sp;
      p0.age = 0;
      p0.life = rand(b.life[0], b.life[1]);
      p0.size0 = rand(b.size[0], b.size[1]) * span * sizeMul;
      p0.drag = b.drag; p0.grav = b.gravity * span;
      p0.hard = b.hard; p0.power = power; p0.am = alphaMul;
      p0.sc = b.sizeCurve; p0.ac = b.alphaCurve;
      p0.cr = b.color[0]; p0.cg = b.color[1]; p0.cb = b.color[2];
      live.push(p0);
    }
  }

  function spawnQuad(q, p, power) {
    const slot = quads.find(s => !s.active);
    if (!slot) return;
    const span = referenceSpan;
    slot.active = true;
    slot.age = 0;
    slot.life = q.life;
    slot.size0 = q.size * span;
    slot.curve = q.curve; slot.ac = q.alpha;
    slot.power = power * (q.alphaMul ?? 1);
    slot.stretch = q.stretch || 1;
    slot.x = p.x; slot.y = p.y; slot.z = p.z;
    slot.mesh.visible = true;
    slot.mat.uniforms.uColor.value.setRGB(q.color[0], q.color[1], q.color[2]);
    slot.mat.uniforms.uKind.value = q.kind === 'ring' ? 1 : 0;
    slot.mat.uniforms.uThick.value = q.thickness ?? 0.12;
    slot.mesh.rotation.z = 0;
  }

  const api = {
    play(name, args = {}) {
      const P = PRESETS[name];
      if (!P) return null;                      // 未知预设静默忽略（原库也这样）
      const pos0 = args.pos || { x: 0, y: 0, z: 0 };
      const power = Math.max(0.05, Math.min(2, args.power ?? 1));

      if (P.burst) spawnBurst(P.burst, pos0, power, P.sizeMul ?? 1, P.velMul ?? 1, P.alphaMul ?? 1);
      if (P.quads) for (const q of P.quads) spawnQuad(q, pos0, power);

      if (P.impulse) {
        shakeAmt = Math.min(1, shakeAmt + P.impulse.add * power);
        impFreq = P.impulse.freq;
        impOffset = Math.min(1, P.impulse.offset * power);
        impRoll = Math.min(1, P.impulse.roll * power);
        impFov = Math.min(1, P.impulse.fov * power);
      }
      if (P.hitstop) {
        hitstopRemain = Math.max(hitstopRemain, P.hitstop.ms / 1000);
        hitstopScale = Math.min(hitstopScale, P.hitstop.timeScale);
      }
      return { preset: name };
    },

    update(dt) {
      const d = Math.max(0, Math.min(0.1, dt));

      // 视口尺寸变了就重算投影系数（gl_PointSize 是像素单位，必须跟着 viewport）
      const vp = viewport ? viewport() : { width: 1, height: 1 };
      const fov = (camera && camera.fov) || 50;
      pmat.uniforms.uScale.value = (vp.height * 0.5) / Math.tan(fov * Math.PI / 360);

      // 粒子
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.age += d;
        const t = p.age / p.life;
        if (t >= 1) { pool.push(p); live.splice(i, 1); continue; }
        const damp = Math.exp(-p.drag * d);
        p.vx *= damp; p.vz *= damp;
        p.vy = p.vy * damp - p.grav * d;
        p.x += p.vx * d; p.y += p.vy * d; p.z += p.vz * d;
      }

      const n = live.length;
      for (let i = 0; i < n; i++) {
        const p = live[i];
        const t = p.age / p.life;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        size[i] = p.size0 * p.sc.at(t);
        alpha[i] = p.ac.at(t) * Math.min(1, 0.55 + 0.45 * p.power) * (p.am ?? 1);
        col[i * 3] = p.cr; col[i * 3 + 1] = p.cg; col[i * 3 + 2] = p.cb;
        hard[i] = p.hard;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aHard.needsUpdate = true;

      // quad：朝向相机（billboard），按 stretch 横向拉伸
      for (const q of quads) {
        if (!q.active) continue;
        q.age += d;
        const t = q.age / q.life;
        if (t >= 1) { q.active = false; q.mesh.visible = false; continue; }
        const s = q.size0 * q.curve.at(t);
        q.mesh.position.set(q.x, q.y, q.z);
        q.mesh.quaternion.copy(camera.quaternion);
        q.mesh.scale.set(s * 2 * q.stretch, s * 2, 1);
        q.mat.uniforms.uAlpha.value = q.ac.at(t) * Math.min(1, 0.55 + 0.45 * q.power);
      }

      // 抖动
      shakeAmt *= Math.exp(-3.8 * d);
      if (shakeAmt < 1e-4) shakeAmt = 0;
      phase += d * impFreq;
      view.offsetX = Math.sin(phase * 1.07 + 0.2) * shakeAmt * impOffset;
      view.offsetY = Math.sin(phase * 1.39 + 1.7) * shakeAmt * impOffset * 0.72;
      view.roll = Math.sin(phase * 0.83 + 0.5) * shakeAmt * impRoll;
      view.fovPunch = shakeAmt * impFov;

      if (hitstopRemain > 0) {
        hitstopRemain = Math.max(0, hitstopRemain - d);
        view.timeScale = hitstopRemain > 0 ? hitstopScale : 1;
        if (hitstopRemain === 0) hitstopScale = 1;
      } else view.timeScale = 1;

      if (onImpulse) onImpulse(view);
      return view.timeScale;
    },

    clear() {
      while (live.length) pool.push(live.pop());
      for (const q of quads) { q.active = false; q.mesh.visible = false; }
      geo.setDrawRange(0, 0);
      shakeAmt = 0; hitstopRemain = 0; hitstopScale = 1;
      view.offsetX = view.offsetY = view.roll = view.fovPunch = 0; view.timeScale = 1;
    },

    dispose() {
      api.clear();
      scene.remove(points);
      geo.dispose(); pmat.dispose();
      for (const q of quads) { scene.remove(q.mesh); q.mat.dispose(); }
      quadGeo.dispose();
    },

    diagnostics() {
      return { version: 'local-1', live: live.length, capacity: MAX_P, quads: quads.filter(q => q.active).length, presets: Object.keys(PRESETS) };
    },
  };

  return api;
}
