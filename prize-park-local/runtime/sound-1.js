// ---- inlined from ./spatial.js ----
/**
 * 空间音频核心：Listener / Emitter / 距离衰减 / 多普勒。
 *
 * 这一层零引擎依赖——它只接收裸数值。"听者挂相机、声源挂对象"由
 * `runtime/adapters/` 下的引擎接入层完成，core 永远不认识 three 或 pixi。
 *
 * 设计约束（与 runtime/index.js 同源）：
 * - 不静默降级。没有有效听者却请求空间播放，显式报错而不是在原点出声。
 * - 所有连续参数走 AudioParam 自动化，不逐帧硬写值（硬写正是 Web Audio
 *   当年删掉 setVelocity 的直接原因：每次调用只接受常量，变化处必然爆音）。
 * - 只写有变化的参数。每帧无条件推 9 个听者参数 + 每 voice 3 个位置参数，
 *   在声源静止时是纯粹的控制消息噪声。
 */

const EPSILON = 1e-6;

/**
 * 引擎原生尺度的默认参数。
 *
 * 距离单位＝引擎原生单位（three 世界单位 / pixi、phaser 逻辑像素），游戏不再声明
 * "多少单位等于一米"。两个档位由**一个尺度比**联系起来：
 *
 *     SPATIAL_UNIT_SCALE = 26.67 px / 世界单位
 *
 * 这个比值不是拍脑袋的。inverse 距离模型的增益是
 *
 *     gain(d) = 1 / (1 + rolloffFactor × (d / refDistance − 1))
 *
 * ——它**只取决于归一化距离 d/refDistance 与 rolloffFactor**。所以两个档位
 * 想听起来一致，充要条件就是 refDistance 按场景尺度同比缩放、rolloff 相同。
 * three 侧的值由实听定案（2026-09-14），pixi 侧全部由它 ×26.67 导出，
 * 两边在任意等效位置上电平差 0.00 dB。
 *
 * ⚠️ **maxDistance 对 inverse 模型无效。** Web Audio 规范里只有 `linear`
 * 的公式引用 maxDistance；`inverse` 与 `exponential` 都不含它，声音会一直
 * 衰减下去而不是停在某个地板上（离线渲染实测：ref=15/rolloff=1.1 时
 * d=200 实际 −23.27 dB，而"按 maxDistance=120 截断"会算成 −18.79 dB）。
 * 这里保留该字段是给按 cue 覆盖成 `linear` 的场景用的，别把它当作
 * inverse 下的"作用半径"。
 */
const SPATIAL_UNIT_SCALE = 26.67;

/**
 * 逻辑像素平面档（pixi / phaser 共用）。两个 2D 引擎都以世界像素为单位、
 * 都映射到同一个音频平面，所以数值只写这一份，各档只在其上加 id——
 * 手抄两份迟早分叉，分叉就是两个引擎听起来不一样大。
 */
const PIXEL_PLANE_PROFILE = Object.freeze({
  // 2D 俯视/横版只需方位与距离，equalpower 比 HRTF 便宜得多。
  // ⚠️ 换 HRTF 会顺带抬高约 3 dB（离线实测 +1.65～+4.04 dB，均值 +3.2），
  // 那是模型自带的电平差，不是距离参数没调好。
  panningModel: "equalpower",
  distanceModel: "inverse",
  // 以下三项＝three 侧对应值 × SPATIAL_UNIT_SCALE，不得单独改动：
  // 动了其中一个就破坏了两档之间的响度均衡。
  refDistance: 133,
  maxDistance: 3200,
  rolloffFactor: 0.5,
  // 像素空间没有物理声速，同样按尺度比换算：343 × 26.67。
  speedOfSound: 9150,
  dopplerFactor: 1,
  // equalpower 是等功率声像：总能量守恒，而不空间化的单声道会被上混
  // 复制到两声道。于是它在所有方位上恒比非空间基准低 3.01 dB（离线实测，
  // 0°/45°/90°/180° 四点一致）。补回来，空间声才与 UI 音等响，
  // 两个档位之间也才真正齐平。
  levelTrimDb: 3,
});

const SPATIAL_PROFILES = Object.freeze({
  three: Object.freeze({
    id: "three",
    panningModel: "HRTF",
    distanceModel: "inverse",
    // 实听定案（2026-09-15 二轮）：inverse 模型在 refDistance 以内恒为满音量，
    // 首轮 ref=15 让 15 米内听不出远近；改 ref=5 / rolloff=0.5——5 米起衰，
    // 15 米 −6 dB、26 米 −9.8 dB、60 米 −16.3 dB（首轮 60 米 −12.7）。
    refDistance: 5,
    maxDistance: 120,
    rolloffFactor: 0.5,
    // three 世界单位通常按米建模，所以直接用真实声速。
    speedOfSound: 343,
    dopplerFactor: 1,
    // HRTF 平均只偏离非空间基准 +0.26 dB（离线实测，方位相关 +1.03～−1.36），
    // 在 HRTF 自身的方位起伏之内，不值得为它引入一个假精度的补偿。
    levelTrimDb: 0,
  }),
  pixi: Object.freeze({ id: "pixi", ...PIXEL_PLANE_PROFILE }),
  phaser: Object.freeze({ id: "phaser", ...PIXEL_PLANE_PROFILE }),
});

/** 把档位的电平补偿换成线性增益。非空间声不经过它。 */
function spatialLevelGain(params) {
  const db = Number(params?.levelTrimDb);
  return Number.isFinite(db) ? 10 ** (db / 20) : 1;
}

/**
 * Web Audio 的 inverse 距离模型（线性增益）。诊断与测试共用这一份，
 * 别在别处再抄一遍——上次抄的那份按 maxDistance 截断，远处读数偏高 4.5 dB。
 */
function inverseDistanceGain(distance, { refDistance, rolloffFactor }) {
  const clamped = Math.max(Number(distance) || 0, refDistance);
  return refDistance / (refDistance + rolloffFactor * (clamped - refDistance));
}

/** 多普勒倍率的硬边界：越过它只会变成啸叫，不会更像多普勒。 */
const DOPPLER_RATE_MIN = 0.5;
const DOPPLER_RATE_MAX = 2;

/** 连续参数的平滑时间常数（秒）。 */
const SMOOTHING_TIME = 0.02;
const DOPPLER_SMOOTHING_TIME = 0.05;

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isVectorLike(value) {
  return value != null && typeof value === "object" && (Array.isArray(value) || "x" in value || "y" in value || "z" in value);
}

/**
 * 统一接受 {x,y,z} 与 [x,y,z] 两种写法。不是向量形状的输入返回 fallback；
 * 缺失的分量当 0（2D 游戏常只给 x/y），但**写了却不是有限数**的分量同样返回
 * fallback——静默当 0 会把一个手误变成"声源钉在原点、诊断全绿"。
 */
function toVec3(value, fallback = null) {
  if (!isVectorLike(value)) return fallback;
  const raw = Array.isArray(value) ? [value[0], value[1], value[2]] : [value.x, value.y, value.z];
  const out = [];
  for (const component of raw) {
    if (component === undefined || component === null) { out.push(0); continue; }
    const parsed = Number(component);
    if (!Number.isFinite(parsed)) return fallback;
    out.push(parsed);
  }
  return { x: out[0], y: out[1], z: out[2] };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sameVec3(a, b) {
  return a != null && b != null && a.x === b.x && a.y === b.y && a.z === b.z;
}

function normalize(v) {
  const len = Math.sqrt(dot(v, v));
  if (len < EPSILON) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * 多普勒倍率。
 *
 * u = 从声源指向听者的单位向量。
 *   ratio = (c - v_listener·u) / (c - v_source·u)
 *
 * 于是：声源朝听者移动 → 分母变小 → 升调；听者朝声源移动 → 分子变大 → 升调；
 * 两者同速同向 → 两个投影相等 → 比值恒为 1（这正是"跟车不变调"的来源，
 * 必须由公式本身保证，而不是靠额外判断去补）。
 */
function dopplerRatio({
  listenerPosition,
  listenerVelocity,
  sourcePosition,
  sourceVelocity,
  speedOfSound,
  dopplerFactor = 1,
}) {
  if (!(dopplerFactor > 0)) return 1;
  const c = num(speedOfSound, 0);
  if (!(c > 0)) return 1;

  const toListener = normalize(sub(listenerPosition, sourcePosition));
  // 位置重合时方向未定义：此刻没有径向分量可言，返回 1 而不是让它发散。
  if (!toListener) return 1;

  const listenerRadial = dot(listenerVelocity, toListener) * dopplerFactor;
  const sourceRadial = dot(sourceVelocity, toListener) * dopplerFactor;

  const numerator = c - listenerRadial;
  const denominator = c - sourceRadial;
  // 声源以声速逼近时分母过零，物理上是音爆、数值上是发散。夹住即可。
  if (denominator <= EPSILON) return DOPPLER_RATE_MAX;
  if (numerator <= 0) return DOPPLER_RATE_MIN;

  const ratio = numerator / denominator;
  if (!Number.isFinite(ratio)) return 1;
  return Math.min(DOPPLER_RATE_MAX, Math.max(DOPPLER_RATE_MIN, ratio));
}

function smoothParam(param, value, at, timeConstant = SMOOTHING_TIME) {
  param.setTargetAtTime(value, at, timeConstant);
}

/**
 * 逐帧差分出的速度。显式速度优先——物理游戏自己知道得更准。
 *
 * reset() 的语义是「下一次 integrate 不差分」，而不是「把历史钉在当前位置」。
 * 接入层形态下瞬移的新位置要到下一帧 update 才推进来，钉当前位置等于钉了
 * 瞬移前的位置，下一帧照样差分出巨大的假速度。
 */
function createMotionTracker() {
  return {
    position: null,
    velocity: { x: 0, y: 0, z: 0 },
    explicitVelocity: null,
    skipNext: true,
    reset() {
      this.velocity = { x: 0, y: 0, z: 0 };
      this.skipNext = true;
    },
    /** 返回本帧生效的速度。dt<=0 时保持上一帧速度，不产生除零尖峰。 */
    integrate(nextPosition, dt) {
      if (this.explicitVelocity) {
        this.velocity = this.explicitVelocity;
      } else if (this.skipNext) {
        this.velocity = { x: 0, y: 0, z: 0 };
      } else if (dt > 0) {
        const delta = sub(nextPosition, this.position);
        this.velocity = { x: delta.x / dt, y: delta.y / dt, z: delta.z / dt };
      }
      this.skipNext = false;
      this.position = nextPosition;
      return this.velocity;
    },
  };
}

/**
 * 空间系统。一个运行时一个实例，与 AudioContext 同生命周期。
 */
function createSpatialSystem({ profile = SPATIAL_PROFILES.three } = {}) {
  let activeProfile = { ...profile };
  let listenerState = null;
  let pushedListener = null;
  const listenerMotion = createMotionTracker();
  const emitters = new Set();

  /** 档位 + 若干层覆盖（后者优先）。null/undefined 层直接跳过。 */
  function resolveParams(...layers) {
    let params = activeProfile;
    for (const layer of layers) {
      if (layer && typeof layer === "object") params = { ...params, ...layer };
    }
    return params;
  }

  function setProfile(next) {
    activeProfile = { ...activeProfile, ...(next ?? {}) };
    return { ...activeProfile };
  }

  function getProfile() {
    return { ...activeProfile };
  }

  function hasListener() {
    return listenerState != null;
  }

  /**
   * 设置听者。position 必填；forward/up 缺省保持 Web Audio 默认朝向
   * （-Z 前、+Y 上），2D 接入层正是靠这个默认把屏幕平面铺在水平面上。
   *
   * 接受 `{ position, forward?, up?, velocity? }` 或一个裸向量。
   * 传了对象却没有 position（比如只写了 forward）是错误，不是"落在原点"。
   */
  function setListener(input) {
    const position = isVectorLike(input) ? toVec3(input) : toVec3(input?.position);
    if (!position) throw new TypeError("setListener requires a position: { position: {x,y,z} } or a bare vector");
    const forward = toVec3(input?.forward) ?? { x: 0, y: 0, z: -1 };
    const up = toVec3(input?.up) ?? { x: 0, y: 1, z: 0 };
    listenerMotion.explicitVelocity = toVec3(input?.velocity);
    listenerState = { position, forward, up };
    return listenerState;
  }

  /** 瞬移／切相机／暂停恢复：下一帧不差分，否则会算出巨大的假速度。 */
  function resetListenerMotion() {
    listenerMotion.reset();
  }

  function applyListenerToContext(context) {
    const listener = context?.listener;
    if (!listenerState || !listener?.positionX) return;
    const { position, forward, up } = listenerState;
    const at = context.currentTime;
    if (!sameVec3(pushedListener?.position, position)) {
      smoothParam(listener.positionX, position.x, at);
      smoothParam(listener.positionY, position.y, at);
      smoothParam(listener.positionZ, position.z, at);
    }
    if (!sameVec3(pushedListener?.forward, forward) || !sameVec3(pushedListener?.up, up)) {
      smoothParam(listener.forwardX, forward.x, at);
      smoothParam(listener.forwardY, forward.y, at);
      smoothParam(listener.forwardZ, forward.z, at);
      smoothParam(listener.upX, up.x, at);
      smoothParam(listener.upY, up.y, at);
      smoothParam(listener.upZ, up.z, at);
    }
    pushedListener = { position, forward, up };
  }

  /**
   * 建一个 PannerNode 并把每个参数都显式写死。
   *
   * 这些是普通属性不是 AudioParam——留空就会掉进浏览器默认值
   * （refDistance=1 / rolloff=1），在像素坐标里等同于一屏之外全部静音。
   * `params` 必须是已经合并好的完整参数（resolveParams 的结果）。
   */
  function createPanner(context, position, params) {
    if (typeof context?.createPanner !== "function") return null;
    const panner = context.createPanner();
    panner.panningModel = params.panningModel;
    panner.distanceModel = params.distanceModel;
    panner.refDistance = params.refDistance;
    panner.maxDistance = params.maxDistance;
    panner.rolloffFactor = params.rolloffFactor;
    const at = context.currentTime;
    panner.positionX.setValueAtTime(position.x, at);
    panner.positionY.setValueAtTime(position.y, at);
    panner.positionZ.setValueAtTime(position.z, at);
    return panner;
  }

  function movePanner(voice, context, position) {
    if (!voice.panner || sameVec3(voice.pushedPosition, position)) return;
    const at = context.currentTime;
    smoothParam(voice.panner.positionX, position.x, at);
    smoothParam(voice.panner.positionY, position.y, at);
    smoothParam(voice.panner.positionZ, position.z, at);
    voice.pushedPosition = position;
  }

  /**
   * 声源。它持有空间状态并管理自己发出的播放实例——一个 Emitter 可以
   * 同时发出引擎声、喇叭与碰撞声，所以 voice 是复数。
   */
  function createEmitter({ position = { x: 0, y: 0, z: 0 }, spatial = null, id = null } = {}) {
    const motion = createMotionTracker();
    const emitter = {
      id,
      disposed: false,
      position: toVec3(position) ?? { x: 0, y: 0, z: 0 },
      // 声源级覆盖：优先级高于 Cue 的 spatial 块，两者都盖在档位之上。
      overrides: spatial && typeof spatial === "object" ? { ...spatial } : null,
      voices: new Set(),
      // stop()/dispose() 各自推进它。播放是异步的（要等解码），所以
      // playCue 在 await 前后各读一次：对不上就说明这次播放已被取消，
      // 不能在加载完成后突然发声。
      stopEpoch: 0,
      // 游戏侧的连续音高控制（引擎转速、加速）。与素材变奏、多普勒相乘。
      pitchScale: 1,
      get velocity() {
        return motion.velocity;
      },
      setPosition(next) {
        const parsed = toVec3(next);
        if (!parsed) throw new TypeError("emitter position must be a vector");
        emitter.position = parsed;
        return emitter;
      },
      setVelocity(next) {
        motion.explicitVelocity = toVec3(next);
        return emitter;
      },
      /** 音高倍率，夹在 [0.25, 4]：越过这个区间不会更像引擎，只会像坏了。 */
      setPitch(scale) {
        const parsed = Number(scale);
        if (!Number.isFinite(parsed) || parsed <= 0) throw new RangeError("pitch scale must be a positive number");
        emitter.pitchScale = Math.min(4, Math.max(0.25, parsed));
        return emitter;
      },
      resetMotion() {
        motion.reset();
        return emitter;
      },
      _integrate(dt) {
        return motion.integrate(emitter.position, dt);
      },
    };
    emitters.add(emitter);
    return emitter;
  }

  function removeEmitter(emitter) {
    if (!emitter) return;
    emitter.disposed = true;
    emitters.delete(emitter);
  }

  /**
   * 把多普勒写进 playbackRate。
   *
   * 最终倍率 ＝ 素材变奏倍率 × 游戏音高控制 × 多普勒倍率——三者相乘而不是
   * 互相覆盖，否则引擎转速一升多普勒就被抹掉。转速与多普勒一样是连续量，
   * 同样走平滑，不然转速阶跃一次就是一声"咔"。
   */
  function applyDoppler(voice, context, { listenerVelocity, sourceVelocity }) {
    if (!voice.source?.playbackRate) return;
    let ratio = 1;
    if (voice.doppler) {
      ratio = dopplerRatio({
        listenerPosition: listenerState.position,
        listenerVelocity,
        sourcePosition: voice.emitter.position,
        sourceVelocity,
        speedOfSound: voice.params.speedOfSound,
        dopplerFactor: voice.params.dopplerFactor,
      });
    }
    voice.dopplerRatio = ratio;
    const target = voice.playbackRate * voice.emitter.pitchScale * ratio;
    if (target === voice.appliedRate) return;
    voice.appliedRate = target;
    smoothParam(voice.source.playbackRate, target, context.currentTime, DOPPLER_SMOOTHING_TIME);
  }

  /**
   * 每帧推进：先积分听者与所有声源的速度，再把空间与多普勒结果写进节点。
   * 必须在游戏更新完变换之后调用。
   */
  function update(dt, context) {
    if (!listenerState || !context) return { emitters: emitters.size, voices: 0 };
    const listenerVelocity = listenerMotion.integrate(listenerState.position, dt);
    applyListenerToContext(context);

    let voiceCount = 0;
    for (const emitter of emitters) {
      if (emitter.disposed) continue;
      const sourceVelocity = emitter._integrate(dt);
      for (const voice of emitter.voices) {
        if (voice.finalized) continue;
        voiceCount += 1;
        movePanner(voice, context, emitter.position);
        applyDoppler(voice, context, { listenerVelocity, sourceVelocity });
      }
    }
    return { emitters: emitters.size, voices: voiceCount };
  }

  function snapshot() {
    return {
      profile: getProfile(),
      listener: listenerState
        ? {
            position: { ...listenerState.position },
            forward: { ...listenerState.forward },
            up: { ...listenerState.up },
            velocity: { ...listenerMotion.velocity },
          }
        : null,
      emitters: [...emitters].map((emitter) => ({
        id: emitter.id,
        position: { ...emitter.position },
        velocity: { ...emitter.velocity },
        pitchScale: emitter.pitchScale,
        // 诊断读这里的真实值，别在外面再算一遍多普勒。
        voices: [...emitter.voices]
          .filter((voice) => !voice.finalized)
          .map((voice) => ({
            instanceId: voice.instanceId,
            cueId: voice.cueId,
            doppler: Boolean(voice.doppler),
            dopplerRatio: voice.dopplerRatio ?? 1,
            appliedRate: voice.appliedRate ?? voice.playbackRate,
          })),
      })),
    };
  }

  function clear() {
    for (const emitter of emitters) emitter.disposed = true;
    emitters.clear();
    listenerState = null;
    pushedListener = null;
    listenerMotion.reset();
  }

  return {
    setProfile,
    getProfile,
    resolveParams,
    setListener,
    resetListenerMotion,
    hasListener,
    createEmitter,
    removeEmitter,
    createPanner,
    update,
    snapshot,
    clear,
  };
}

// ---- inlined from ./binding.js ----
/**
 * 引擎接入层的公共骨架：把"听者跟随谁、声源跟随谁"的生命周期做成一份。
 *
 * 每个引擎只需要提供三个纯函数：
 * - readListener()      读出听者的位置/朝向（裸数值）
 * - readPosition(object) 读出被绑定对象的世界位置
 * - isGone(object)       对象是否已销毁/摘出场景树（只是不可见不算）
 *
 * 声源句柄直接返回运行时的核心句柄，不再包一层：包一层就得把每个方法
 * 转发一遍，两个引擎各一份，加方法时必然漏掉一边。游戏直接调
 * `emitter.dispose()` 也没问题——update 会按 `emitter.disposed` 清掉绑定。
 *
 * 可链式的方法（syncListener / resetMotion）返回 `this` 而不是闭包里的 handle：
 * 各接入层把这里的方法展开进自己的扩展句柄（加 setCamera / setScreen、覆盖 dispose），
 * 返回闭包 handle 会让 `spatial.resetMotion().dispose()` 落到这里的 dispose 上、
 * 跳过扩展句柄摘场景监听那一步，`.setCamera()` 之类则直接不存在。
 */
function createEngineBinding(runtime, { engine, readListener, readPosition, isGone }) {
  runtime.configureSpatial(engine);

  /** emitter 核心句柄 → 被绑定的场景对象 */
  const bindings = new Map();
  let disposed = false;

  function pushListener() {
    runtime.setListener(readListener());
  }

  pushListener();

  const handle = Object.freeze({
    engine,

    /** 立即按当前读数推一次听者（切相机、改视口时用；update 每帧也会推）。 */
    syncListener() {
      pushListener();
      return this;
    },

    /** 相机瞬移、切场景后调用：下一帧不差分，避免把跳变当成运动。 */
    resetMotion() {
      runtime.resetListenerMotion();
      for (const emitter of bindings.keys()) emitter.resetMotion();
      return this;
    },

    /** 把声源挂到场景对象上。对象销毁后，下一次 update 自动回收。 */
    createEmitter({ object, ...emitterOptions } = {}) {
      if (!object) throw new TypeError(`${engine} adapter: createEmitter requires an object`);
      const emitter = runtime.createEmitter({ ...emitterOptions, position: readPosition(object) });
      bindings.set(emitter, object);
      return emitter;
    },

    /** 在游戏更新完变换之后、每帧调用一次。dt 单位是秒。 */
    update(dtSeconds) {
      if (disposed) return null;
      pushListener();
      for (const [emitter, object] of bindings) {
        if (emitter.disposed) {
          bindings.delete(emitter);
          continue;
        }
        if (isGone(object)) {
          bindings.delete(emitter);
          emitter.dispose();
          continue;
        }
        emitter.setPosition(readPosition(object));
      }
      return runtime.updateSpatial(dtSeconds);
    },

    dispose() {
      disposed = true;
      for (const emitter of [...bindings.keys()]) emitter.dispose();
      bindings.clear();
    },
  });

  return handle;
}

// ---- inlined from ./adapters/three.js ----
/**
 * Three.js 接入层：把相机变成听者，把场景对象变成声源。
 *
 * **不 import three。** 它只读 three 对象上有公开契约的字段
 * （`matrixWorld`、`parent`），所以 core 依旧零引擎依赖，游戏用哪个
 * three 版本、有没有打包 three 都不影响这里。
 *
 * 坐标直接沿用 three 的世界坐标，游戏不再声明"多少单位等于一米"。
 */

/** 从 4x4 世界矩阵里取出平移分量（列主序，three 的 Matrix4.elements 就是这个布局）。 */
function positionFromMatrix(elements) {
  return { x: elements[12], y: elements[13], z: elements[14] };
}

function normalized(x, y, z) {
  const length = Math.hypot(x, y, z);
  if (!(length > 1e-6)) return null;
  // `+ 0` 把取负产生的 -0 归回 0：数值上等价，但诊断面板里显示 -0 只会让人困惑。
  return { x: x / length + 0, y: y / length + 0, z: z / length + 0 };
}

/** 相机朝向＝世界矩阵第三列取负：three 的相机沿自身 -Z 看出去。 */
function forwardFromMatrix(elements) {
  return normalized(-elements[8], -elements[9], -elements[10]) ?? { x: 0, y: 0, z: -1 };
}

/** 上方向＝世界矩阵第二列。相机翻滚时听觉也应跟着翻，否则左右会反。 */
function upFromMatrix(elements) {
  return normalized(elements[4], elements[5], elements[6]) ?? { x: 0, y: 1, z: 0 };
}

function readWorldMatrix(object) {
  const elements = object?.matrixWorld?.elements;
  if (!elements || elements.length < 16) {
    throw new TypeError("three adapter needs an Object3D with a matrixWorld");
  }
  return elements;
}

/**
 * 对象是否已经离开场景树。
 * 只认"从场景里摘掉"这一件事——不可见或离开视锥都不算销毁，
 * 那些情况下声音本来就该继续响。
 */
function isDetached(object) {
  return object == null || (object.parent === null && object.isScene !== true);
}

/**
 * @param {object} runtime  createSoundRuntime 的返回值
 * @param {object} options
 * @param {object} options.camera        听者跟随的相机
 * @param {object} [options.listenerObject] 改为跟随别的对象（比如角色而不是相机）
 * @param {boolean} [options.autoUpdateMatrices] 是否在读取前补一次 updateMatrixWorld
 */
function attachThree(runtime, { camera, listenerObject, autoUpdateMatrices = false } = {}) {
  let listenerTarget = listenerObject ?? camera;
  if (!listenerTarget) throw new TypeError("attachThree requires a camera (or listenerObject)");

  function syncMatrices(object) {
    // 游戏的渲染循环通常已经更新过；只有在 update 早于 render 调用时才需要补。
    if (autoUpdateMatrices && typeof object?.updateMatrixWorld === "function") object.updateMatrixWorld();
  }

  const binding = createEngineBinding(runtime, {
    engine: "three",
    readListener() {
      syncMatrices(listenerTarget);
      const elements = readWorldMatrix(listenerTarget);
      return {
        position: positionFromMatrix(elements),
        forward: forwardFromMatrix(elements),
        up: upFromMatrix(elements),
      };
    },
    readPosition(object) {
      syncMatrices(object);
      return positionFromMatrix(readWorldMatrix(object));
    },
    isGone: isDetached,
  });

  return Object.freeze({
    ...binding,
    /** 换一个跟随目标（切相机、切视角）。历史随即重置，避免瞬移被当成运动。 */
    setListenerTarget(next) {
      if (!next) throw new TypeError("setListenerTarget requires an Object3D");
      listenerTarget = next;
      binding.syncListener().resetMotion();
      return this;
    },
  });
}

// ---- inlined from ./adapters/pixi.js ----
/**
 * Pixi 接入层：把视口中心变成听者，把显示对象变成声源。
 *
 * **不 import pixi。** 只读公开契约的字段（`worldTransform`、`destroyed`），
 * 所以 core 依旧零引擎依赖。
 *
 * 坐标沿用游戏世界的逻辑像素。必须显式提供 `world` 容器——显示对象存在
 * 父子变换，屏幕坐标不能直接当世界坐标；相机缩放、画布适配与 DPR 都在
 * `world` 的变换里，扣掉之后距离才不会随镜头推拉而变。
 *
 * 2D 到音频平面的映射：世界 X → 音频 X，世界 Y → 音频 Z。
 * Pixi 的 +Y 朝下，映射到音频的 +Z（听者身后）。equalpower 只用方位角，
 * 前后本就不可辨，所以俯视与横版共用这一个映射：左右正确、距离正确。
 */

function readTransform(object, label) {
  const transform = object?.worldTransform;
  if (!transform || typeof transform.tx !== "number") {
    throw new TypeError(`pixi adapter needs ${label} to have a worldTransform`);
  }
  return transform;
}

/** 屏幕坐标 → world 容器的局部坐标（逆变换）。 */
function screenToWorld(transform, x, y) {
  const { a, b, c, d, tx, ty } = transform;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) return { x: 0, y: 0 };
  const dx = x - tx;
  const dy = y - ty;
  return {
    x: (dx * d - dy * c) / determinant,
    y: (dy * a - dx * b) / determinant,
  };
}

/** world 局部坐标 → 音频坐标。屏幕平面铺在音频的水平面上。 */
function toAudio(point) {
  return { x: point.x, y: 0, z: point.y };
}

/**
 * 对象是否已经销毁或摘出显示树。
 * 仅不可见（visible=false / alpha=0）不算——那时声音本来就该继续响。
 */
function isGone(object) {
  return object == null || object.destroyed === true || object.parent === null;
}

function assertScreen(screen, label) {
  if (!screen || !(screen.width > 0) || !(screen.height > 0)) {
    throw new TypeError(`${label} requires a logical screen size`);
  }
}

/**
 * @param {object} runtime  createSoundRuntime 的返回值
 * @param {object} options
 * @param {object} options.world   游戏世界容器（相机平移缩放都作用在它身上）
 * @param {object} options.screen  逻辑视口 `{ width, height }`（不是画布像素尺寸）
 */
function attachPixi(runtime, { world, screen } = {}) {
  if (!world) throw new TypeError("attachPixi requires the game world container");
  assertScreen(screen, "attachPixi");
  let viewport = screen;

  const binding = createEngineBinding(runtime, {
    engine: "pixi",
    readListener() {
      // 听者＝视口中心反算回世界坐标。屏幕尺寸与缩放只影响"看到哪里"，
      // 不影响声音的距离尺度——距离永远在世界坐标里量。
      const transform = readTransform(world, "the world container");
      return { position: toAudio(screenToWorld(transform, viewport.width / 2, viewport.height / 2)) };
    },
    readPosition(object) {
      // 对象的全局落点先还原成屏幕坐标，再换算回 world 局部坐标，
      // 这样嵌套容器里的对象也能算对。
      const objectTransform = readTransform(object, "the emitter object");
      const worldTransform = readTransform(world, "the world container");
      return toAudio(screenToWorld(worldTransform, objectTransform.tx, objectTransform.ty));
    },
    isGone,
  });

  return Object.freeze({
    ...binding,
    /** 窗口尺寸变化时更新逻辑视口。 */
    setScreen(next) {
      assertScreen(next, "setScreen");
      viewport = next;
      binding.syncListener();
      return this;
    },
  });
}

// ---- inlined from ./adapters/phaser.js ----
/**
 * Phaser 接入层：把相机中心变成听者，把游戏对象变成声源。
 *
 * **不 import Phaser。** 只读公开契约的字段（相机的 `scrollX/scrollY/width/height`、
 * 对象的 `x/y/scene/parentContainer`、`getWorldTransformMatrix()`、场景的
 * `events`），所以 core 依旧零引擎依赖，Phaser 以经典脚本挂全局也不影响这里。
 *
 * 2D 到音频平面的映射与 pixi 相同：世界 X → 音频 X，世界 Y → 音频 Z，y=0。
 * 单位＝Phaser 世界像素，档位 `phaser` 与 `pixi` 数值相同（都是逻辑像素平面）。
 * Phaser 的 +Y 朝下，映射到音频的 +Z（听者身后）；equalpower 只用方位角，
 * 前后本就不可辨，俯视与横版共用这一个映射：左右正确、距离正确。
 *
 * 听者取相机中心的**世界坐标**：`scrollX + width / 2`、`scrollY + height / 2`。
 * 它与 Phaser 的 `camera.midPoint` 同式，但 midPoint 只在渲染前的 preRender 里
 * 刷新，读它会落后一帧且依赖时序，所以每帧直接算。相机 zoom 只改变
 * "看到多大一片"（worldView），不移动中心，也就不改变任何声音距离。
 *
 * 默认挂在场景的 `postupdate` 上自动推进：那时 update()、物理步进与对象位移
 * 都已完成，读到的是本帧的最终位置（与 three/pixi 要求的"更新完变换之后
 * 再 update"同一个时机）。场景 shutdown/destroy 时自动 dispose，重开场景
 * 不会留下还在响的循环声源。
 */

function assertPhaserCamera(camera, label) {
  const numeric = (value) => typeof value === "number" && Number.isFinite(value);
  if (
    !camera ||
    !numeric(camera.scrollX) ||
    !numeric(camera.scrollY) ||
    !numeric(camera.width) ||
    !numeric(camera.height)
  ) {
    throw new TypeError(`${label} requires a Phaser camera with numeric scrollX/scrollY/width/height`);
  }
}

/** 相机中心的世界坐标 → 音频坐标。与 zoom 无关：zoom 绕中心缩放。 */
function phaserCameraCenter(camera) {
  assertPhaserCamera(camera, "phaser adapter");
  return phaserToAudio({ x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2 });
}

/**
 * 对象的世界坐标。不在 Container 里时 `x/y` 就是世界坐标；
 * 在 Container 里时 `x/y` 是相对容器的局部坐标，必须走世界变换矩阵。
 * （`getWorldTransformMatrix()` 每次调用会分配临时矩阵，只有容器内对象付这个代价。）
 */
function phaserWorldPoint(object) {
  if (!object.parentContainer) {
    if (typeof object.x !== "number" || typeof object.y !== "number") {
      throw new TypeError("phaser adapter needs the emitter object to have numeric x/y");
    }
    return { x: object.x, y: object.y };
  }
  if (typeof object.getWorldTransformMatrix !== "function") {
    throw new TypeError("phaser adapter needs a container child to have getWorldTransformMatrix()");
  }
  const matrix = object.getWorldTransformMatrix();
  if (typeof matrix?.tx !== "number" || typeof matrix?.ty !== "number") {
    throw new TypeError("phaser adapter needs getWorldTransformMatrix() to return numeric tx/ty");
  }
  return { x: matrix.tx, y: matrix.ty };
}

/** 世界坐标 → 音频坐标。屏幕平面铺在音频的水平面上。 */
function phaserToAudio(point) {
  return { x: point.x, y: 0, z: point.y };
}

/**
 * 对象是否已经销毁。Phaser 的 `GameObject.destroy()` 会把 `scene` 置空。
 * 仅不可见（visible=false）或停用（active=false）不算——那时声音本来就该继续响。
 */
function phaserGone(object) {
  return object == null || object.scene == null;
}

/**
 * @param {object} runtime  createSoundRuntime 的返回值
 * @param {object} options
 * @param {object} options.scene   Phaser.Scene（用到 `events`，缺省相机取 `cameras.main`）
 * @param {object} [options.camera]  听者跟随的相机，默认 `scene.cameras.main`
 * @param {boolean} [options.autoUpdate]  默认 true：挂 `postupdate` 自动推进；false 时游戏每帧自己 `update(dt)`
 */
function attachPhaser(runtime, { scene, camera = scene?.cameras?.main, autoUpdate = true } = {}) {
  const events = scene?.events;
  if (
    !events ||
    typeof events.on !== "function" ||
    typeof events.once !== "function" ||
    typeof events.off !== "function"
  ) {
    throw new TypeError("attachPhaser requires a Phaser scene");
  }
  assertPhaserCamera(camera, "attachPhaser");
  let activeCamera = camera;

  const binding = createEngineBinding(runtime, {
    engine: "phaser",
    readListener() {
      return { position: phaserCameraCenter(activeCamera) };
    },
    readPosition(object) {
      return phaserToAudio(phaserWorldPoint(object));
    },
    isGone: phaserGone,
  });

  // Phaser 的 postupdate 回调参数是 (time, delta)，delta 单位毫秒。
  function onPostUpdate(_time, delta) {
    binding.update(delta / 1000);
  }

  function dispose() {
    events.off("postupdate", onPostUpdate);
    events.off("shutdown", dispose);
    events.off("destroy", dispose);
    binding.dispose();
  }

  if (autoUpdate) events.on("postupdate", onPostUpdate);
  // 生命周期与 autoUpdate 无关：场景关掉后对象全部销毁，绑定必须随之释放。
  events.once("shutdown", dispose);
  events.once("destroy", dispose);

  return Object.freeze({
    ...binding,
    /** 摘掉场景监听并释放全部声源。场景 shutdown/destroy 时自动调用。 */
    dispose,
    /** 换一个跟随的相机（切镜头、分屏切主视角）。历史随即重置，避免瞬移被当成运动。 */
    setCamera(next) {
      assertPhaserCamera(next, "setCamera");
      activeCamera = next;
      binding.syncListener().resetMotion();
      return this;
    },
  });
}


const USER_VOLUME_KEYS = Object.freeze(["master", "music", "sfx", "voice"]);
const DEFAULT_USER_VOLUMES = Object.freeze({ master: 1, music: 1, sfx: 1, voice: 1 });
const RECEIPT_LIMIT = 200;
/** 平台字节版本，随 package.json 走（测试钉住两者一致）；录制器经 `window.__mpSound.version` 读到。 */
const RUNTIME_VERSION = "0.8.0";
/** 运行时实例 → dispose 收尾回调（只给 loadSoundSystem 摘全局登记用，不进公开面）。 */
const disposeHooks = new WeakMap();

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asMap(value, label) {
  if (Array.isArray(value)) {
    const entries = value.map((entry, index) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0) {
        throw new TypeError(`${label}[${index}] must have a non-empty id`);
      }
      return [entry.id, { ...entry }];
    });
    return new Map(entries);
  }

  if (isRecord(value)) {
    return new Map(
      Object.entries(value).map(([id, entry]) => {
        if (!isRecord(entry)) {
          throw new TypeError(`${label}.${id} must be an object`);
        }
        return [id, { id, ...entry }];
      }),
    );
  }

  throw new TypeError(`manifest.${label} must be an object or array`);
}

function optionalMap(value, label) {
  return value == null ? new Map() : asMap(value, label);
}

function dbToGain(db) {
  if (db === -Infinity) return 0;
  return 10 ** (Number(db || 0) / 20);
}

function sliderToGain(value) {
  return value === 0 ? 0 : value * value;
}

function setAudioParam(param, value, at) {
  if (!param || !Number.isFinite(value)) return;
  if (typeof param.setValueAtTime === "function" && Number.isFinite(at)) {
    param.setValueAtTime(value, at);
  } else {
    param.value = value;
  }
}

function rampAudioParam(param, value, at) {
  if (!param) return;
  if (typeof param.linearRampToValueAtTime === "function" && Number.isFinite(at)) {
    param.linearRampToValueAtTime(value, at);
  } else {
    param.value = value;
  }
}

/**
 * 在 dB 上线性的增益斜坡（指数斜坡在幅度上是指数，在 dB 上恰好是线性）。
 *
 * 为什么不能用线性增益斜坡做音量回归：它把 dB 变化前置——
 * 从 -6 dB 回到 0 dB 时，前 25% 的时间就涨了 1.95 dB，后 25% 只涨 1.16 dB，
 * 听感是「一松开就窜上来」。实测反馈正是如此。
 *
 * 指数斜坡不能经过 0，所以只用于 duck 这类恒正增益；
 * 淡入淡出涉及静音端点，仍走线性。
 */
function rampGainDb(param, value, at) {
  if (!param) return;
  const from = Number.isFinite(param.value) ? param.value : 1;
  if (typeof param.exponentialRampToValueAtTime === "function"
    && Number.isFinite(at) && from > 0 && value > 0) {
    param.exponentialRampToValueAtTime(value, at);
    return;
  }
  rampAudioParam(param, value, at);
}

function cancelAudioParam(param, at) {
  if (param && typeof param.cancelScheduledValues === "function") {
    param.cancelScheduledValues(Number.isFinite(at) ? at : 0);
  }
}

function stableHash(value) {
  const text = String(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pickDeterministicAsset(cue, cueId, seed) {
  const raw = cue.assetIds ?? cue.assets ?? cue.assetId;
  const choices = (Array.isArray(raw) ? raw : [raw])
    .filter((choice) => choice != null)
    .map((choice) =>
      typeof choice === "string"
        ? { assetId: choice, weight: 1 }
        : {
            assetId: choice.assetId ?? choice.id,
            weight: Number.isFinite(choice.weight) && choice.weight > 0 ? choice.weight : 1,
          },
    )
    .filter((choice) => typeof choice.assetId === "string" && choice.assetId.length > 0);

  if (choices.length === 0) {
    throw new Error(`cue ${cueId} has no assets`);
  }

  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let point = (stableHash(`${cueId}:${seed}`) / 0x100000000) * totalWeight;
  for (const choice of choices) {
    point -= choice.weight;
    if (point < 0) return choice.assetId;
  }
  return choices.at(-1).assetId;
}

function normalizeVariants(asset, assetId) {
  const source = asset.variants;
  let variants;
  if (Array.isArray(source)) {
    variants = source.map((variant, index) => ({
      id: variant.id ?? variant.format ?? variant.codec ?? `${assetId}-${index}`,
      ...variant,
    }));
  } else if (isRecord(source)) {
    variants = Object.entries(source).map(([id, variant]) =>
      typeof variant === "string"
        ? { id, format: id, url: variant }
        : { id, format: variant.format ?? id, ...variant },
    );
  } else if (asset.url || asset.path || asset.file || asset.src) {
    variants = [{
      id: asset.format ?? asset.codec ?? assetId,
      format: asset.format ?? asset.codec,
      mimeType: asset.mimeType,
      url: asset.url ?? asset.path ?? asset.file ?? asset.src,
    }];
  } else {
    variants = [];
  }

  const codecRank = new Map([
    ["opus", 0],
    ["ogg", 1],
    ["vorbis", 1],
    ["aac", 2],
    ["m4a", 2],
    ["mp3", 3],
    ["mpeg", 3],
    ["wav", 4],
  ]);
  return variants
    .filter((variant) => variant.pack || variant.url || variant.path || variant.file || variant.src)
    .map((variant, index) => ({ variant, index }))
    .sort((left, right) => {
      const leftPriority = readNumber(left.variant.priority, left.variant.preference);
      const rightPriority = readNumber(right.variant.priority, right.variant.preference);
      if (leftPriority != null || rightPriority != null) {
        const delta = (leftPriority ?? Infinity) - (rightPriority ?? Infinity);
        if (delta !== 0) return delta;
      }
      const leftCodec = String(left.variant.codec ?? left.variant.format ?? left.variant.id).toLowerCase();
      const rightCodec = String(right.variant.codec ?? right.variant.format ?? right.variant.id).toLowerCase();
      const rankDelta = (codecRank.get(leftCodec) ?? 99) - (codecRank.get(rightCodec) ?? 99);
      return rankDelta || left.index - right.index;
    })
    .map(({ variant }) => variant);
}

const PACK_MAGIC = "MPSND1";
const PACK_FORMAT_VERSION = 1;
const PACK_KEYSTREAM_BYTES = 4096;
const PACK_HEADER_BYTES = 14;

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * 纯 JS SHA-256。
 *
 * 刻意不用 crypto.subtle：它只在 secure context 下可用，
 * 而 pack 是**混淆不是加密**——为一个非安全用途背上 HTTPS 依赖不值得。
 * 用了它就意味着明文 HTTP 的局域网预览、file:// 打开的离线单页全都解不开包。
 * 派生一条 4096 字节密钥流只需 129 次小输入哈希，纯 JS 耗时可忽略。
 */
function sha256Bytes(parts) {
  const input = concatBytes(parts);
  const bitLength = input.length * 8;
  const paddedLength = (((input.length + 9) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((value, index) => outView.setUint32(index * 4, value, false));
  return out;
}

/**
 * 与构建侧同一套派生：seed = sha256(salt || contentHash || domain)，
 * 逐块 block_i = sha256(seed || u32le(i))，拼到 4096 字节。
 * 任何一处改动都必须同步 builder/pack.mjs，否则解出来是噪声。
 */
function derivePackKeystream(salt, contentHash, domain) {
  const seed = sha256Bytes([salt, utf8Bytes(String(contentHash)), utf8Bytes(domain)]);
  const blocks = [];
  for (let index = 0; index * 32 < PACK_KEYSTREAM_BYTES; index += 1) {
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, index, true);
    blocks.push(sha256Bytes([seed, counter]));
  }
  return concatBytes(blocks).subarray(0, PACK_KEYSTREAM_BYTES);
}

function applyPackKeystream(bytes, keystream) {
  const out = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = bytes[index] ^ keystream[index % keystream.length];
  }
  return out;
}

function parsePack(buffer, contentHash) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = new TextDecoder().decode(bytes.subarray(0, 6));
  if (magic !== PACK_MAGIC) throw new Error("not a sound pack");
  const version = view.getUint16(6, true);
  if (version !== PACK_FORMAT_VERSION) throw new Error(`unsupported pack version ${version}`);
  const saltLength = view.getUint16(8, true);
  const indexLength = view.getUint32(10, true);
  const salt = bytes.subarray(PACK_HEADER_BYTES, PACK_HEADER_BYTES + saltLength);
  const indexStart = PACK_HEADER_BYTES + saltLength;
  const payloadStart = indexStart + indexLength;

  const indexKey = derivePackKeystream(salt, contentHash, "index");
  const payloadKey = derivePackKeystream(salt, contentHash, "payload");
  const indexJson = applyPackKeystream(bytes.subarray(indexStart, payloadStart), indexKey);
  const index = JSON.parse(new TextDecoder().decode(indexJson));
  const payload = applyPackKeystream(bytes.subarray(payloadStart), payloadKey);
  return { index, payload };
}

function getVariantUrl(variant) {
  return variant.url ?? variant.path ?? variant.file ?? variant.src;
}

function resolveUrl(baseUrl, relativeUrl) {
  if (!baseUrl || /^(?:data:|blob:|https?:|file:)/i.test(relativeUrl)) return relativeUrl;
  try {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(relativeUrl, normalizedBase).toString();
  } catch {
    const separator = baseUrl.endsWith("/") || baseUrl.endsWith("\\") ? "" : "/";
    return `${baseUrl}${separator}${relativeUrl}`;
  }
}

function manifestDirectoryUrl(manifestUrl, responseUrl) {
  const candidate = responseUrl || manifestUrl;
  const documentBase = globalThis.document?.baseURI ?? globalThis.location?.href;
  try {
    const absolute = documentBase ? new URL(candidate, documentBase) : new URL(candidate);
    return new URL(".", absolute).toString();
  } catch {
    const clean = String(candidate).split(/[?#]/, 1)[0].replaceAll("\\\\", "/");
    const slash = clean.lastIndexOf("/");
    return slash >= 0 ? clean.slice(0, slash + 1) : "";
  }
}

function getLoadPolicy(asset, manifest, assetId) {
  const raw =
    asset.resolvedLoadPolicy ??
    asset.loadPolicy ??
    manifest.resolvedLoadPlan?.[assetId] ??
    manifest.loadPlan?.[assetId] ??
    "buffer";

  if (typeof raw === "string") return { mode: raw };
  if (isRecord(raw)) {
    return {
      ...raw,
      mode: raw.mode ?? raw.type ?? raw.strategy ?? "buffer",
    };
  }
  throw new TypeError(`asset ${assetId} has an invalid load policy`);
}

/**
 * 解析引擎档位。接受档位名（"three" / "pixi" / "phaser"）或一整份参数对象；
 * manifest 里的声明作为回落，这样同一个游戏不必每次创建都重复传。
 */
/**
 * 解析引擎档位。接受档位名（"three" / "pixi" / "phaser"）、带 id 的完整对象，
 * 或一个部分对象——部分对象合并到 `base` 上：初始化时是 three 预设，
 * configureSpatial 时是**当前档位**。曾经把部分对象一律合到 three 上，
 * attachPixi 之后再微调一个参数就整档翻回 three（HRTF、无补偿）。
 */
function resolveSpatialProfile(requested, base) {
  if (requested == null) return base;
  if (typeof requested === "string") {
    const preset = SPATIAL_PROFILES[requested];
    if (!preset) throw new TypeError(`unknown spatial profile ${requested}`);
    return preset;
  }
  if (isRecord(requested)) {
    let start = base;
    if (requested.id != null) {
      start = SPATIAL_PROFILES[requested.id];
      if (!start) throw new TypeError(`unknown spatial profile ${requested.id}`);
    }
    return { ...start, ...requested };
  }
  throw new TypeError("spatial profile must be a profile id or a partial profile object");
}

/** Cue 声明的空间覆盖：不声明就完全跟随引擎档位。 */
function cueSpatialOverrides(cue) {
  const spatial = cue?.spatial;
  if (!isRecord(spatial)) return null;
  const overrides = {};
  for (const key of ["panningModel", "distanceModel", "refDistance", "maxDistance", "rolloffFactor", "speedOfSound", "dopplerFactor", "levelTrimDb"]) {
    if (spatial[key] != null) overrides[key] = spatial[key];
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
}

function cueWantsDoppler(cue) {
  return isRecord(cue?.spatial) && cue.spatial.doppler === true;
}

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // A node can already be disconnected during browser teardown.
  }
}

function readNumber(...values) {
  for (const value of values) {
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function snapshotPosition(position) {
  if (!position) return null;
  return {
    x: Number(position.x ?? position[0] ?? 0),
    y: Number(position.y ?? position[1] ?? 0),
    z: Number(position.z ?? position[2] ?? 0),
  };
}

function makeRuntimeError(code, message, details = {}) {
  const error = new Error(message);
  error.name = "SoundRuntimeError";
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deterministicPlaybackRate(cue, cueId, seed) {
  if (Number.isFinite(cue.playbackRate) && cue.playbackRate > 0) return Number(cue.playbackRate);
  const rateRange = cue.playbackRateRange;
  if (Array.isArray(rateRange) && rateRange.length === 2) {
    const low = Number(rateRange[0]);
    const high = Number(rateRange[1]);
    if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high >= low) {
      const unit = stableHash(`${cueId}:${seed}:playback-rate`) / 0x100000000;
      return low + (high - low) * unit;
    }
  }
  const semitoneRange = cue.pitchSemitoneRange ?? cue.pitchSemitones;
  if (Array.isArray(semitoneRange) && semitoneRange.length === 2) {
    const low = Number(semitoneRange[0]);
    const high = Number(semitoneRange[1]);
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low) {
      const unit = stableHash(`${cueId}:${seed}:pitch-semitones`) / 0x100000000;
      return 2 ** ((low + (high - low) * unit) / 12);
    }
  }
  return 1;
}

/**
 * Create one manifest-driven Sound Lab runtime.
 *
 * The core only uses injected IO (`fetchImpl`, `mediaElementFactory`, and
 * `telemetrySink`). It never persists user settings and it does not expose raw
 * file URLs, load policy, or per-call gain to gameplay code.
 */
export function createSoundRuntime({
  manifest,
  baseUrl = "",
  audioContextFactory,
  fetchImpl,
  mediaElementFactory,
  telemetrySink,
  now = () => Date.now(),
  spatialProfile,
} = {}) {
  if (!isRecord(manifest)) throw new TypeError("manifest is required");

  const assets = asMap(manifest.assets, "assets");
  const cues = asMap(manifest.cues, "cues");
  const busDefinitions = asMap(manifest.buses, "buses");
  const mixStates = optionalMap(manifest.mixStates, "mixStates");
  const musicStates = optionalMap(manifest.musicStates, "musicStates");
  const duckRules = optionalMap(manifest.duckRules, "duckRules");
  const voicePolicy = isRecord(manifest.voicePolicy) ? manifest.voicePolicy : {};

  let context = null;
  let busGraph = null;
  /** 外部保持（Scene Lens 等）与页面隐藏共同决定输出是否挂起。 */
  const suspendHolds = new Set();
  let pageHidden = false;
  let autoSuspended = false;
  /** 被挂起动作暂停的流式 voice——恢复时只重播我们暂停的那些。 */
  const suspendPausedVoices = new Set();
  let masterSafetyNode = null;
  /** 混音的最终出口（有主安全节点就是它，否则是各根总线）：扬声器与录音口都只接这里。 */
  let outputNodes = [];
  /** 录音口：首次 recordingStream() 时才建，没人录就不多一个节点。 */
  let recordingTap = null;
  let disposed = false;
  let unlocked = false;
  let muted = false;
  let instanceCounter = 0;
  let musicStateId = null;
  let musicInstanceId = null;

  const spatial = createSpatialSystem({
    profile: resolveSpatialProfile(spatialProfile, SPATIAL_PROFILES.three),
  });

  const userVolumes = { ...DEFAULT_USER_VOLUMES };
  const bufferCache = new Map();
  const packCache = new Map();
  const packBlobUrls = new Map();
  const voices = new Map();
  const receipts = [];
  const activeMixStates = new Map();
  const activeDucks = new Map();
  const lastCueStarts = new Map();
  const pendingBufferLoads = [];
  const maxConcurrentBufferLoads = Math.max(
    1,
    Math.floor(readNumber(
      manifest.loadPolicy?.maxConcurrentDecodes,
      manifest.runtimePolicy?.maxConcurrentDecodes,
      3,
    )),
  );
  let activeBufferLoads = 0;
  const diagnostics = {
    assetLoads: 0,
    decodeFallbacks: 0,
    streamFallbacks: 0,
    steals: 0,
    cooldownSuppressions: 0,
    budgetSuppressions: 0,
    playErrors: 0,
    telemetryErrors: 0,
    spatialDegradations: 0,
  };

  function assertUsable() {
    if (disposed) throw new Error("sound runtime is disposed");
  }

  /**
   * 页面隐藏 / 外部保持时挂起整条输出。
   *
   * 动因＝浏览器切后台时游戏画面随 rAF 停住，WebAudio 却继续响；
   * Scene Lens 锁定游戏内容时同理。挂起走 AudioContext.suspend（时钟一并冻结，
   * 淡入淡出与调度原地暂停），流式媒体元素单独 pause——它们的进度不吃 context
   * 时钟，不暂停会在恢复时跳进度。恢复只重播我们自己暂停的元素，
   * 不碰游戏显式停掉的。
   */
  function reconcileSuspension() {
    if (disposed) return;
    const shouldSuspend = pageHidden || suspendHolds.size > 0;
    if (shouldSuspend) {
      for (const voice of voices.values()) {
        if (voice.kind === "stream" && voice.element && voice.element.paused === false) {
          voice.element.pause?.();
          suspendPausedVoices.add(voice);
        }
      }
      if (context && context.state === "running" && typeof context.suspend === "function") {
        void Promise.resolve(context.suspend()).catch(() => {});
      }
      if (!autoSuspended) {
        autoSuspended = true;
        emit("sound_runtime_held", { pageHidden, holds: [...suspendHolds].sort() });
      }
    } else if (autoSuspended) {
      autoSuspended = false;
      if (unlocked && context && context.state === "suspended" && typeof context.resume === "function") {
        void Promise.resolve(context.resume()).catch(() => {});
      }
      for (const voice of suspendPausedVoices) {
        if (!voice.finalized) {
          void Promise.resolve(voice.element?.play?.()).catch(() => stopVoiceInternal(voice, "stream-play-error"));
        }
      }
      suspendPausedVoices.clear();
      emit("sound_runtime_resumed", {});
    }
  }

  const visibilityDocument = typeof document === "object" && document ? document : null;
  function onVisibilityChange() {
    pageHidden = visibilityDocument.visibilityState === "hidden" || visibilityDocument.hidden === true;
    reconcileSuspension();
  }
  if (visibilityDocument?.addEventListener) {
    visibilityDocument.addEventListener("visibilitychange", onVisibilityChange);
    pageHidden = visibilityDocument.visibilityState === "hidden" || visibilityDocument.hidden === true;
  }

  /**
   * 命名保持：`setHold("scene-lens", true)` 挂起输出，false 释放；
   * 多个 id 共存，全部释放且页面可见才恢复。游戏在 Scene Lens 的
   * onActiveChange、自建暂停菜单等处一行接线。
   */
  function setHold(id, held) {
    assertUsable();
    if (typeof id !== "string" || !id) throw new TypeError("setHold requires a non-empty string id");
    if (held === true) suspendHolds.add(id);
    else suspendHolds.delete(id);
    reconcileSuspension();
    return Object.freeze({
      type: "hold",
      status: autoSuspended ? "held" : "released",
      holds: Object.freeze([...suspendHolds].sort()),
    });
  }

  function pumpBufferLoads() {
    if (disposed) return;
    while (activeBufferLoads < maxConcurrentBufferLoads && pendingBufferLoads.length > 0) {
      const item = pendingBufferLoads.shift();
      activeBufferLoads += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          activeBufferLoads -= 1;
          pumpBufferLoads();
        });
    }
  }

  function scheduleBufferLoad(task) {
    assertUsable();
    return new Promise((resolve, reject) => {
      pendingBufferLoads.push({ task, resolve, reject });
      pumpBufferLoads();
    });
  }

  function emit(type, payload = {}) {
    if (!telemetrySink) return;
    const event = Object.freeze({
      ...payload,
      type,
      timestampMs: now(),
      manifestHash: manifest.contentHash ?? null,
    });
    try {
      if (typeof telemetrySink === "function") telemetrySink(event);
      else if (typeof telemetrySink.emit === "function") telemetrySink.emit(event);
    } catch {
      diagnostics.telemetryErrors += 1;
    }
  }

  function addReceipt(receipt) {
    receipts.push(receipt);
    if (receipts.length > RECEIPT_LIMIT) receipts.shift();
    return receipt;
  }

  function currentStateHash() {
    const state = JSON.stringify({
      muted,
      userVolumes: USER_VOLUME_KEYS.map((key) => [key, userVolumes[key]]),
      mixStates: [...activeMixStates.keys()].sort(),
      musicStateId,
    });
    return stableHash(state).toString(16).padStart(8, "0");
  }

  function validateBusGraph() {
    for (const [busId, definition] of busDefinitions) {
      const parentId = definition.parent ?? definition.parentId ?? definition.output ?? null;
      if (parentId != null && !busDefinitions.has(parentId)) {
        throw new Error(`bus ${busId} references missing parent ${parentId}`);
      }
    }

    const visiting = new Set();
    const visited = new Set();
    function visit(busId) {
      if (visiting.has(busId)) throw new Error(`bus graph contains a cycle at ${busId}`);
      if (visited.has(busId)) return;
      visiting.add(busId);
      const definition = busDefinitions.get(busId);
      const parentId = definition.parent ?? definition.parentId ?? definition.output ?? null;
      if (parentId != null) visit(parentId);
      visiting.delete(busId);
      visited.add(busId);
    }
    for (const busId of busDefinitions.keys()) visit(busId);
  }

  validateBusGraph();

  function getAudioContextFactory() {
    if (typeof audioContextFactory === "function") return audioContextFactory;
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error("audioContextFactory is required in this environment");
    return () => new Context();
  }

  function createMasterSafety(audioContext) {
    const safety = manifest.masterSafety;
    if (!isRecord(safety) || typeof audioContext.createDynamicsCompressor !== "function") return null;
    const node = audioContext.createDynamicsCompressor();
    const at = audioContext.currentTime;
    setAudioParam(node.threshold, readNumber(safety.thresholdDb, safety.threshold), at);
    setAudioParam(node.knee, readNumber(safety.kneeDb, safety.knee), at);
    setAudioParam(node.ratio, readNumber(safety.ratio), at);
    setAudioParam(node.attack, readNumber(safety.attackSeconds, safety.attack), at);
    setAudioParam(node.release, readNumber(safety.releaseSeconds, safety.release), at);
    node.connect(audioContext.destination);

    return node;
  }

  function inheritedUserCategory(busId) {
    let currentId = busId;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const definition = busDefinitions.get(currentId);
      const explicit = definition.userVolume ?? definition.userCategory ?? definition.category;
      if (USER_VOLUME_KEYS.includes(explicit)) return explicit;
      if (USER_VOLUME_KEYS.includes(currentId)) return currentId;
      currentId = definition.parent ?? definition.parentId ?? definition.output ?? null;
    }
    return null;
  }

  function buildBusGraph(audioContext) {
    const graph = new Map();
    for (const [busId, definition] of busDefinitions) {
      const input = audioContext.createGain();
      const canonical = audioContext.createGain();
      const mix = audioContext.createGain();
      const duck = audioContext.createGain();
      const user = audioContext.createGain();
      input.connect(canonical);
      canonical.connect(mix);
      mix.connect(duck);
      duck.connect(user);
      setAudioParam(canonical.gain, dbToGain(definition.gainDb ?? 0), audioContext.currentTime);
      setAudioParam(mix.gain, 1, audioContext.currentTime);
      setAudioParam(duck.gain, 1, audioContext.currentTime);
      setAudioParam(user.gain, 1, audioContext.currentTime);
      graph.set(busId, {
        id: busId,
        definition,
        parentId: definition.parent ?? definition.parentId ?? definition.output ?? null,
        userCategory: inheritedUserCategory(busId),
        input,
        canonical,
        mix,
        duck,
        user,
        mixDb: 0,
        duckDb: 0,
      });
    }

    masterSafetyNode = createMasterSafety(audioContext);
    const roots = [];
    for (const bus of graph.values()) {
      if (bus.parentId) bus.user.connect(graph.get(bus.parentId).input);
      else {
        bus.user.connect(masterSafetyNode ?? audioContext.destination);
        roots.push(bus.user);
      }
    }
    outputNodes = masterSafetyNode ? [masterSafetyNode] : roots;
    return graph;
  }

  /**
   * 录音口：混音出口（主安全节点之后）多接一路 MediaStreamDestination。
   *
   * 录制器只接这一路，就拿到与扬声器逐样本相同的成品混音——音效、BGM、语音、
   * 流式音乐都在里面，且只有一份。动因＝录制器此前靠 hook AudioNode.connect 与
   * 媒体元素 captureStream 偷听，流式 BGM 被录两遍（+6 dB）。用户音量与静音在出口之前，
   * 所以录到的是玩家实际听到的。
   */
  function recordingStream() {
    assertUsable();
    const audioContext = ensureContext();
    if (!recordingTap) {
      if (typeof audioContext.createMediaStreamDestination !== "function") {
        throw makeRuntimeError(
          "SOUND_RECORDING_UNSUPPORTED",
          "this AudioContext cannot create a MediaStreamDestination",
        );
      }
      recordingTap = audioContext.createMediaStreamDestination();
      for (const node of outputNodes) node.connect(recordingTap);
    }
    return recordingTap.stream;
  }

  function ensureContext() {
    assertUsable();
    if (!context) {
      context = getAudioContextFactory()();
      if (!context || typeof context.createGain !== "function") {
        throw new TypeError("audioContextFactory returned an invalid AudioContext");
      }
      busGraph = buildBusGraph(context);
      applyUserVolumes();
    }
    return context;
  }

  function ensureBus(busId) {
    ensureContext();
    const bus = busGraph.get(busId);
    if (!bus) throw new Error(`unknown bus ${busId}`);
    return bus;
  }

  function resolvedUserGain(bus) {
    let gain = bus.userCategory ? sliderToGain(userVolumes[bus.userCategory]) : 1;
    if (bus.id === "master" && muted) gain = 0;
    return gain;
  }

  function applyUserVolumes() {
    if (!busGraph || !context) return;
    for (const bus of busGraph.values()) {
      setAudioParam(bus.user.gain, resolvedUserGain(bus), context.currentTime);
    }
  }

  function busIsWithin(busId, ancestorId) {
    let currentId = busId;
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      if (currentId === ancestorId) return true;
      seen.add(currentId);
      const definition = busDefinitions.get(currentId);
      currentId = definition?.parent ?? definition?.parentId ?? definition?.output ?? null;
    }
    return false;
  }

  function policyGlobalMax() {
    return readNumber(voicePolicy.globalMax, voicePolicy.maxVoices, voicePolicy.globalMaxVoices) ?? Infinity;
  }

  function policyBusMax(busId) {
    const configured = voicePolicy.busMax ?? voicePolicy.busMaxVoices ?? {};
    return readNumber(configured[busId], busDefinitions.get(busId)?.maxVoices);
  }

  function selectVictim(candidates) {
    return [...candidates].sort((left, right) => {
      const priorityDelta = left.priority - right.priority;
      if (priorityDelta !== 0) return priorityDelta;
      const timeDelta = left.startedAt - right.startedAt;
      if (timeDelta !== 0) return timeDelta;
      return left.sequence - right.sequence;
    })[0];
  }

  function stopVoiceInternal(voice, reason, { emitReceipt = true } = {}) {
    if (!voice || voice.finalized) return null;
    voice.finalized = true;
    voices.delete(voice.instanceId);
    // 被并发预算抢占时也走这里，所以 emitter 的实例记录同步清理，
    // 不会留下指向已停 voice 的空壳。
    voice.emitter?.voices?.delete(voice);
    if (musicInstanceId === voice.instanceId) musicInstanceId = null;
    if (voice.startTimer) clearTimeout(voice.startTimer);
    if (voice.stopTimer) clearTimeout(voice.stopTimer);

    try {
      if (voice.kind === "stream") {
        voice.element?.pause?.();
        if (voice.element && "src" in voice.element && reason === "dispose") {
          voice.element.removeAttribute?.("src");
          voice.element.load?.();
        }
      } else if (reason !== "ended") {
        voice.source?.stop?.(context?.currentTime ?? 0);
      }
    } catch {
      // A naturally ended source throws if stop() is called again.
    }

    for (const node of voice.nodes ?? []) safeDisconnect(node);
    releaseDuck(voice);
    voice.status = reason === "ended" ? "ended" : "stopped";
    voice.endedAt = context?.currentTime ?? null;
    voice.stopReason = reason;

    if (!emitReceipt) return null;
    const receipt = addReceipt(Object.freeze({
      type: "stop",
      status: voice.status,
      instanceId: voice.instanceId,
      cueId: voice.cueId,
      eventId: voice.eventId,
      reason,
      endedAt: voice.endedAt,
    }));
    emit("sound_voice_stopped", receipt);
    return receipt;
  }

  function stealOrReject(candidates, newPriority, scope) {
    const victim = selectVictim(candidates);
    if (!victim || victim.priority > newPriority) return false;
    diagnostics.steals += 1;
    stopVoiceInternal(victim, `stolen:${scope}`);
    emit("sound_voice_stolen", {
      instanceId: victim.instanceId,
      cueId: victim.cueId,
      scope,
      replacementPriority: newPriority,
    });
    return true;
  }

  function enforceVoiceBudgets(cueId, cue, busId, newPriority) {
    const globalMax = Math.max(0, policyGlobalMax());
    while (voices.size >= globalMax) {
      if (!stealOrReject(voices.values(), newPriority, "global")) return "global";
    }

    const cueMax = readNumber(
      cue.polyphony,
      cue.maxVoices,
      cue.voiceLimit,
      voicePolicy.defaultCueMax,
    ) ?? Infinity;
    let cueVoices = [...voices.values()].filter((voice) => voice.cueId === cueId);
    while (cueVoices.length >= cueMax) {
      if (!stealOrReject(cueVoices, newPriority, `cue:${cueId}`)) return `cue:${cueId}`;
      cueVoices = [...voices.values()].filter((voice) => voice.cueId === cueId);
    }

    for (const configuredBusId of busDefinitions.keys()) {
      const max = policyBusMax(configuredBusId);
      if (max == null || !busIsWithin(busId, configuredBusId)) continue;
      let scoped = [...voices.values()].filter((voice) => busIsWithin(voice.busId, configuredBusId));
      while (scoped.length >= Math.max(0, max)) {
        if (!stealOrReject(scoped, newPriority, `bus:${configuredBusId}`)) return `bus:${configuredBusId}`;
        scoped = [...voices.values()].filter((voice) => busIsWithin(voice.busId, configuredBusId));
      }
    }
    return null;
  }

  function getMixBusDb(state, busId) {
    const values = state.busGainsDb ?? state.buses ?? state.gainsDb ?? {};
    const raw = values[busId];
    if (Number.isFinite(raw)) return Number(raw);
    if (isRecord(raw)) return readNumber(raw.gainDb, raw.db) ?? 0;
    return 0;
  }

  function applyMixStates() {
    if (!busGraph || !context) return;
    for (const bus of busGraph.values()) {
      let db = 0;
      for (const stateId of activeMixStates.keys()) {
        db += getMixBusDb(mixStates.get(stateId), bus.id);
      }
      bus.mixDb = db;
      setAudioParam(bus.mix.gain, dbToGain(db), context.currentTime);
    }
  }

  function duckTargetId(rule) {
    return rule.targetBus ?? rule.targetBusId ?? rule.bus;
  }

  function duckReductionDb(rule) {
    const value = readNumber(rule.reductionDb, rule.maxReductionDb);
    if (value != null) return -Math.abs(value);
    return Math.min(0, readNumber(rule.gainDb, rule.db) ?? 0);
  }

  function computeDuckDbForBus(busId) {
    let db = 0;
    for (const active of activeDucks.values()) {
      if (active.phase !== "idle" && duckTargetId(active.rule) === busId) {
        db += duckReductionDb(active.rule);
      }
    }
    return db;
  }

  function refreshDuckBus(busId, { attackMs = 0, releaseMs = 0, holdMs = 0, releasing = false } = {}) {
    if (!busGraph || !context) return;
    const bus = busGraph.get(busId);
    if (!bus) throw new Error(`duck rule references unknown bus ${busId}`);
    const currentTime = context.currentTime;
    const db = computeDuckDbForBus(busId);
    bus.duckDb = db;
    cancelAudioParam(bus.duck.gain, currentTime);
    const startGain = Number.isFinite(bus.duck.gain.value) ? bus.duck.gain.value : 1;
    setAudioParam(bus.duck.gain, startGain, currentTime);
    if (releasing) {
      // hold 是「维持在压低量」，不是回归的一部分：
      // 原实现把 hold 折进斜坡总时长，等于一松手就开始往回爬。
      const holdUntil = currentTime + holdMs / 1000;
      if (holdMs > 0) setAudioParam(bus.duck.gain, startGain, holdUntil);
      rampGainDb(bus.duck.gain, dbToGain(db), holdUntil + releaseMs / 1000);
    } else {
      rampGainDb(bus.duck.gain, dbToGain(db), currentTime + attackMs / 1000);
    }
  }

  function engageDuck(voice, ruleId, scheduledAt) {
    if (!ruleId) return;
    const rule = duckRules.get(ruleId);
    if (!rule) throw new Error(`cue ${voice.cueId} references unknown duck rule ${ruleId}`);
    const targetBusId = duckTargetId(rule);
    if (!targetBusId) throw new Error(`duck rule ${ruleId} has no target bus`);
    let active = activeDucks.get(ruleId);
    if (!active) {
      active = { id: ruleId, rule, voices: new Set(), phase: "active", releaseTimer: null };
      activeDucks.set(ruleId, active);
    }
    if (active.releaseTimer) clearTimeout(active.releaseTimer);
    active.releaseTimer = null;
    active.phase = "active";
    active.voices.add(voice.instanceId);
    voice.duckRuleId = ruleId;

    const attackMs = Math.max(0, readNumber(rule.attackMs) ?? 0);
    const bus = ensureBus(targetBusId);
    const startAt = Math.max(context.currentTime, scheduledAt ?? context.currentTime);
    cancelAudioParam(bus.duck.gain, startAt);
    setAudioParam(bus.duck.gain, bus.duck.gain.value, startAt);
    bus.duckDb = computeDuckDbForBus(targetBusId);
    rampGainDb(bus.duck.gain, dbToGain(bus.duckDb), startAt + attackMs / 1000);
    emit("sound_duck_started", { ruleId, targetBusId, instanceId: voice.instanceId });
  }

  function releaseDuck(voice) {
    const ruleId = voice.duckRuleId;
    if (!ruleId) return;
    const active = activeDucks.get(ruleId);
    if (!active) return;
    active.voices.delete(voice.instanceId);
    if (active.voices.size > 0) return;

    active.phase = "releasing";
    const targetBusId = duckTargetId(active.rule);
    const holdMs = Math.max(0, readNumber(active.rule.holdMs) ?? 0);
    const releaseMs = Math.max(0, readNumber(active.rule.releaseMs) ?? 0);
    activeDucks.delete(ruleId);
    refreshDuckBus(targetBusId, { holdMs, releaseMs, releasing: true });
    activeDucks.set(ruleId, active);
    active.releaseTimer = setTimeout(() => {
      if (active.voices.size === 0) {
        activeDucks.delete(ruleId);
        refreshDuckBus(targetBusId);
        emit("sound_duck_ended", { ruleId, targetBusId });
      }
    }, holdMs + releaseMs);
  }

  /** 取一个 pack 的解封装结果，按 packId 缓存——同组多个音效只解一次。 */
  async function loadPackData(packId) {
    if (packCache.has(packId)) return packCache.get(packId);
    const pack = manifest.packs?.[packId];
    if (!pack) throw new Error(`unknown pack ${packId}`);
    if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required to load sound packs");
    const promise = (async () => {
      const response = await fetchImpl(resolveUrl(baseUrl, pack.url));
      if (!response || response.ok === false || typeof response.arrayBuffer !== "function") {
        throw new Error(`pack fetch failed${response?.status ? ` (${response.status})` : ""}`);
      }
      return parsePack(await response.arrayBuffer(), manifest.contentHash);
    })();
    packCache.set(packId, promise);
    try {
      return await promise;
    } catch (error) {
      packCache.delete(packId);
      throw error;
    }
  }

  /** 打包变体的字节；未打包的变体走原有 URL 路径，返回 null 交给调用方。 */
  async function getPackedBytes(variant) {
    if (!variant.pack) return null;
    const { payload } = await loadPackData(variant.pack.id);
    const start = variant.pack.offset;
    const end = start + variant.pack.length;
    if (end > payload.length) throw new Error(`pack slice out of range for ${variant.id}`);
    return payload.slice(start, end).buffer;
  }

  /**
   * 流式变体在 pack 里时，用 blob URL 喂 MediaElement。
   * 注意：整曲下载 ≠ 整曲解码常驻——blob 里是压缩字节，
   * MediaElement 仍然流式解码，常驻内存是压缩数据而不是 PCM。
   */
  async function packedStreamUrl(assetId, variant) {
    const key = `${assetId}:${variant.id}`;
    const existing = packBlobUrls.get(key);
    if (existing) return existing;
    const bytes = await getPackedBytes(variant);
    if (!bytes) return null;
    if (typeof URL?.createObjectURL !== "function" || typeof Blob !== "function") {
      throw new Error("Blob/createObjectURL are required to stream packed audio");
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: variant.mimeType ?? "application/octet-stream" }));
    packBlobUrls.set(key, url);
    return url;
  }

  function revokePackBlobUrls() {
    for (const url of packBlobUrls.values()) {
      try { URL.revokeObjectURL?.(url); } catch { /* 释放失败不应阻断 teardown */ }
    }
    packBlobUrls.clear();
  }

  async function decodeAudioData(audioContext, bytes) {
    const copy = bytes.slice ? bytes.slice(0) : bytes;
    return new Promise((resolve, reject) => {
      let result;
      try {
        result = audioContext.decodeAudioData(copy, resolve, reject);
      } catch (error) {
        reject(error);
        return;
      }
      if (result && typeof result.then === "function") result.then(resolve, reject);
    });
  }

  async function loadBuffer(assetId) {
    if (bufferCache.has(assetId)) return bufferCache.get(assetId);
    if (typeof fetchImpl !== "function") {
      throw new Error("fetchImpl is required to load buffer assets");
    }
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`unknown asset ${assetId}`);
    const variants = normalizeVariants(asset, assetId);
    if (variants.length === 0) throw new Error(`asset ${assetId} has no variants`);
    const audioContext = ensureContext();

    const promise = scheduleBufferLoad(async () => {
      const failures = [];
      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        const url = variant.pack ? `pack:${variant.pack.id}` : resolveUrl(baseUrl, getVariantUrl(variant));
        try {
          let bytes = await getPackedBytes(variant);
          if (bytes === null) {
            const response = await fetchImpl(url, { signal: undefined });
            if (!response || response.ok === false || typeof response.arrayBuffer !== "function") {
              throw new Error(`fetch failed${response?.status ? ` (${response.status})` : ""}`);
            }
            bytes = await response.arrayBuffer();
          }
          const buffer = await decodeAudioData(audioContext, bytes);
          diagnostics.assetLoads += 1;
          if (index > 0) diagnostics.decodeFallbacks += 1;
          emit("sound_asset_loaded", { assetId, variantId: variant.id, mode: "buffer" });
          return { assetId, asset, variant, url, buffer };
        } catch (error) {
          failures.push(`${variant.id}: ${error.message}`);
          emit("sound_variant_failed", { assetId, variantId: variant.id, mode: "buffer" });
        }
      }
      throw new Error(`all variants failed for ${assetId}: ${failures.join("; ")}`);
    });
    bufferCache.set(assetId, promise);
    try {
      return await promise;
    } catch (error) {
      bufferCache.delete(assetId);
      throw error;
    }
  }

  /**
   * 建立 source → [panner] → voiceGain → bus 的连接。
   *
   * panner 只在这一处创建，参数由空间系统按引擎档位＋cue 覆盖显式写死——
   * 任何一项漏写都会掉回浏览器默认值，而默认值在像素坐标里等同于静音。
   */
  function connectVoiceSource(source, voiceGain, bus, spatialPlan, voice) {
    const panner = spatialPlan ? spatial.createPanner(context, spatialPlan.position, spatialPlan.params) : null;
    voice.panner = panner;
    if (panner) voice.pushedPosition = spatialPlan.position;
    if (panner) {
      source.connect(panner);
      panner.connect(voiceGain);
    } else {
      source.connect(voiceGain);
    }
    voiceGain.connect(bus.input);
    return panner ? [source, panner, voiceGain] : [source, voiceGain];
  }

  function makeBaseReceipt({ voice, at, position, loadPolicy, cue }) {
    const transientAnchorMs = readNumber(cue.transientAnchorMs) ?? 0;
    return {
      type: "play",
      status: at > context.currentTime + 0.001 ? "scheduled" : "playing",
      instanceId: voice.instanceId,
      cueId: voice.cueId,
      assetId: voice.assetId,
      assetVariantHash: voice.assetVariantHash ?? null,
      codec: voice.codec ?? null,
      busId: voice.busId,
      eventId: voice.eventId,
      seed: voice.seed,
      requestedAt: voice.requestedAt,
      scheduledAt: at,
      audioScheduledAt: at,
      startedAt: context.currentTime,
      audioStartedAt: context.currentTime,
      audioTransientAt: at + transientAnchorMs / 1000,
      position: snapshotPosition(position),
      priority: voice.priority,
      loadPolicy,
      syncRole: cue.syncRole ?? null,
      transientAnchorMs,
      duckRuleId: cue.duckRule ?? cue.duckRuleId ?? null,
      gainDb: readNumber(cue.gainDb) ?? 0,
      playbackRate: voice.playbackRate,
      stateHash: currentStateHash(),
      guard: "admitted",
    };
  }

  function suppressedReceipt({ cueId, eventId, seed, reason, at = null }) {
    const receipt = Object.freeze({
      type: "play",
      status: "suppressed",
      instanceId: null,
      cueId,
      eventId: eventId ?? null,
      seed,
      scheduledAt: at,
      reason,
    });
    addReceipt(receipt);
    emit("sound_cue_suppressed", receipt);
    return receipt;
  }

  async function createBufferVoice({ voice, cue, assetId, spatialPlan, at, loadPolicy }) {
    const loaded = await loadBuffer(assetId);
    const budgetReason = enforceVoiceBudgets(voice.cueId, cue, voice.busId, voice.priority);
    if (budgetReason) {
      diagnostics.budgetSuppressions += 1;
      return suppressedReceipt({
        cueId: voice.cueId,
        eventId: voice.eventId,
        seed: voice.seed,
        reason: `voice-budget:${budgetReason}`,
        at,
      });
    }

    const bus = ensureBus(voice.busId);
    const source = context.createBufferSource();
    const voiceGain = context.createGain();
    source.buffer = loaded.buffer;
    source.loop = Boolean(cue.loop ?? loaded.asset.loop ?? loadPolicy.loop);
    if (source.playbackRate) setAudioParam(source.playbackRate, voice.playbackRate, context.currentTime);
    voice.baseGain = dbToGain(cue.gainDb ?? 0) * (spatialPlan?.levelGain ?? 1);
    voice.gainNode = voiceGain;
    if (voice.fadeInMs > 0) {
      setAudioParam(voiceGain.gain, 0, at);
      rampAudioParam(voiceGain.gain, voice.baseGain, at + voice.fadeInMs / 1000);
    } else {
      setAudioParam(voiceGain.gain, voice.baseGain, context.currentTime);
    }
    voice.kind = "buffer";
    voice.source = source;
    voice.nodes = connectVoiceSource(source, voiceGain, bus, spatialPlan, voice);
    voice.variantId = loaded.variant.id;
    voice.variantUrl = loaded.url;
    voice.assetVariantHash = loaded.variant.sha256 ?? loaded.variant.hash ?? null;
    voice.codec = loaded.variant.codec ?? loaded.variant.format ?? loaded.variant.id;
    voice.status = at > context.currentTime + 0.001 ? "scheduled" : "playing";
    voices.set(voice.instanceId, voice);
    source.onended = () => stopVoiceInternal(voice, "ended");
    engageDuck(voice, cue.duckRule ?? cue.duckRuleId, at);
    source.start(at, Math.max(0, Number(loadPolicy.offsetSeconds ?? 0)));
    return null;
  }

  async function createStreamVoice({ voice, cue, assetId, spatialPlan, at, loadPolicy }) {
    const asset = assets.get(assetId);
    const variants = normalizeVariants(asset, assetId);
    if (variants.length === 0) throw new Error(`asset ${assetId} has no variants`);
    const budgetReason = enforceVoiceBudgets(voice.cueId, cue, voice.busId, voice.priority);
    if (budgetReason) {
      diagnostics.budgetSuppressions += 1;
      return suppressedReceipt({
        cueId: voice.cueId,
        eventId: voice.eventId,
        seed: voice.seed,
        reason: `voice-budget:${budgetReason}`,
        at,
      });
    }

    if (typeof mediaElementFactory !== "function") {
      throw makeRuntimeError(
        "SOUND_MEDIA_FACTORY_REQUIRED",
        "mediaElementFactory is required to stream assets",
        { assetId, cueId: voice.cueId },
      );
    }
    const factory = mediaElementFactory;
    const bus = ensureBus(voice.busId);
    const failures = [];
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const url = (await packedStreamUrl(assetId, variant)) ?? resolveUrl(baseUrl, getVariantUrl(variant));
      let element;
      let source;
      let voiceGain;
      let nodes;
      try {
        element = factory(url, { assetId, variant, cueId: voice.cueId });
        if (!element) throw new Error("mediaElementFactory returned no element");
        // 沙箱 iframe 是 opaque origin，所有资源都算跨源：媒体元素不走 CORS 协商时自己能出声，
        // 但接进 WebAudio 后 MediaElementAudioSource 按规范输出全零——无错误、无事件，纯静音。
        // 默认补 anonymous（工厂显式设置过则尊重）；blob/同源 URL 下该属性是无害 no-op。
        if (element.crossOrigin == null) element.crossOrigin = "anonymous";
        const mimeType = variant.mimeType ?? variant.mime;
        if (mimeType && typeof element.canPlayType === "function" && element.canPlayType(mimeType) === "") {
          throw new Error(`unsupported MIME type ${mimeType}`);
        }
        if ("src" in element && !element.src) element.src = url;
        element.preload = loadPolicy.preload ?? "auto";
        element.loop = Boolean(cue.loop ?? asset.loop ?? loadPolicy.loop);
        source = context.createMediaElementSource(element);
        voiceGain = context.createGain();
        voice.baseGain = dbToGain(cue.gainDb ?? 0) * (spatialPlan?.levelGain ?? 1);
        voice.gainNode = voiceGain;
        if (voice.fadeInMs > 0) {
          setAudioParam(voiceGain.gain, 0, at);
          rampAudioParam(voiceGain.gain, voice.baseGain, at + voice.fadeInMs / 1000);
        } else {
          setAudioParam(voiceGain.gain, voice.baseGain, context.currentTime);
        }
        nodes = connectVoiceSource(source, voiceGain, bus, spatialPlan, voice);

        voice.kind = "stream";
        voice.element = element;
        voice.source = source;
        voice.nodes = nodes;
        voice.variantId = variant.id;
        voice.variantUrl = url;
        voice.assetVariantHash = variant.sha256 ?? variant.hash ?? null;
        voice.codec = variant.codec ?? variant.format ?? variant.id;
        if ("playbackRate" in element) element.playbackRate = voice.playbackRate;
        voice.status = at > context.currentTime + 0.001 ? "scheduled" : "playing";
        const ended = () => stopVoiceInternal(voice, "ended");
        element.addEventListener?.("ended", ended, { once: true });
        voices.set(voice.instanceId, voice);
        engageDuck(voice, cue.duckRule ?? cue.duckRuleId, at);

        const play = async () => {
          if (voice.finalized) return;
          if (autoSuspended) {
            suspendPausedVoices.add(voice);
            voice.status = "playing";
            return;
          }
          const result = element.play?.();
          if (result && typeof result.then === "function") await result;
          voice.status = "playing";
        };
        const delayMs = Math.max(0, (at - context.currentTime) * 1000);
        if (delayMs > 1) {
          voice.startTimer = setTimeout(() => {
            play().catch(() => stopVoiceInternal(voice, "stream-play-error"));
          }, delayMs);
        } else {
          await play();
        }
        if (index > 0) diagnostics.streamFallbacks += 1;
        diagnostics.assetLoads += 1;
        emit("sound_asset_loaded", { assetId, variantId: variant.id, mode: "stream" });
        return null;
      } catch (error) {
        failures.push(`${variant.id}: ${error.message}`);
        if (voices.get(voice.instanceId) === voice) voices.delete(voice.instanceId);
        releaseDuck(voice);
        voice.duckRuleId = null;
        try { element?.pause?.(); } catch { /* no-op */ }
        for (const node of nodes ?? [source, voiceGain]) safeDisconnect(node);
        emit("sound_variant_failed", { assetId, variantId: variant.id, mode: "stream" });
      }
    }
    throw new Error(`all stream variants failed for ${assetId}: ${failures.join("; ")}`);
  }

  async function unlock() {
    assertUsable();
    const audioContext = ensureContext();
    if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
      await audioContext.resume();
    }
    unlocked = audioContext.state === "running" || audioContext.state == null;
    reconcileSuspension();
    const receipt = Object.freeze({ type: "unlock", status: unlocked ? "running" : audioContext.state });
    addReceipt(receipt);
    emit("sound_runtime_unlocked", { status: receipt.status });
    return receipt;
  }

  async function preload(group) {
    assertUsable();
    ensureContext();
    const selected = [];
    for (const [assetId, asset] of assets) {
      const policy = getLoadPolicy(asset, manifest, assetId);
      if (policy.mode !== "buffer") continue;
      const assetGroup = policy.group ?? policy.preloadGroup ?? asset.group ?? asset.preloadGroup;
      if (group != null && assetGroup !== group) continue;
      selected.push(assetId);
    }
    const settled = await Promise.allSettled(selected.map((assetId) => loadBuffer(assetId)));
    const result = Object.freeze({
      group: group ?? null,
      requested: selected.length,
      loaded: settled.filter((entry) => entry.status === "fulfilled").length,
      failed: settled.filter((entry) => entry.status === "rejected").length,
      assets: selected.map((assetId, index) => ({ assetId, status: settled[index].status })),
    });
    emit("sound_preload_completed", result);
    return result;
  }

  /**
   * 决定这次播放走不走空间链路。
   *
   * 三种形态互不混淆：
   * - 传 `emitter`：跟随对象的可移动声源，逐帧更新、可启用多普勒。
   * - 只传 `position`：世界里的一次性定点声（爆炸），播完即止、不跟踪。
   * - 都不传：非空间声（UI、提示音），完全不建 panner。
   *
   * 请求了空间播放却没有有效听者时显式报错。静默在原点播放正是这条线
   * 反复踩的坑：参数看着被接受了，声音却没了，诊断还全绿。
   */
  function resolveSpatialPlan({ cueId, cue, eventId, emitter, position, loadPolicy }) {
    const wantsSpatial = Boolean(emitter) || Boolean(position);
    if (!wantsSpatial) return null;
    if (!spatial.hasListener()) {
      if (emitter) {
        throw makeRuntimeError(
          "SOUND_LISTENER_MISSING",
          `spatial playback of ${cueId} requires setListener() to be called first`,
          { cueId, hint: "attachThree/attachPixi/attachPhaser 会每帧代劳；裸用 core 时自己喂听者" },
        );
      }
      // `playCue(id, { position })` 是 0.5 就有的公开入口，已发布的游戏可能在没有
      // 听者的情况下调用它。这里降级为非空间播放，但**不静默**：回执带 spatial.status、
      // 遥测出事件、诊断计数——三处都能看见，与"在原点静默播放"是两回事。
      diagnostics.spatialDegradations += 1;
      emit("sound_spatial_degraded", { cueId, eventId: eventId ?? null, reason: "listener-missing" });
      return { degraded: { status: "degraded", reason: "listener-missing" } };
    }
    const resolvedPosition = emitter ? emitter.position : toVec3(position);
    if (!resolvedPosition) {
      throw makeRuntimeError("SOUND_POSITION_INVALID", `position for ${cueId} must be a vector`, { cueId });
    }
    // 三层：引擎档位 < Cue 的 spatial 块 < 声源级覆盖。同一份合并结果同时喂 panner 与多普勒，
    // 别再各拿各的——曾经 Cue 的 dopplerFactor 进不了多普勒、声源的 refDistance 进不了 panner。
    const params = spatial.resolveParams(cueSpatialOverrides(cue), emitter?.overrides);
    let doppler = false;
    if (cueWantsDoppler(cue)) {
      // 多普勒改的是 playbackRate，而 MediaElement 走的 stream 路径没有这个参数。
      // 这里报错而不是静默忽略，否则同一个开关在两条路径上效果不一致。
      if (loadPolicy.mode !== "buffer") {
        throw makeRuntimeError(
          "SOUND_DOPPLER_REQUIRES_BUFFER",
          `cue ${cueId} enables doppler but resolves to a ${loadPolicy.mode} asset`,
          { cueId, loadPolicy: loadPolicy.mode },
        );
      }
      // 定点声没有速度可言，多普勒对它恒为 1——不建立跟踪，省掉逐帧开销。
      doppler = Boolean(emitter);
    }
    return {
      position: resolvedPosition,
      params,
      emitter: emitter ?? null,
      doppler,
      levelGain: spatialLevelGain(params),
    };
  }

  async function playCue(cueId, {
    eventId,
    seed,
    at,
    position,
    pitchSemitones,
    playbackRate,
    emitter: publicEmitter,
    __emitter: emitter,
    __fadeInMs = 0,
  } = {}) {
    assertUsable();
    const cue = cues.get(cueId);
    if (!cue) throw makeRuntimeError("SOUND_CUE_UNKNOWN", `unknown cue ${cueId}`, { cueId });
    if (publicEmitter !== undefined) {
      // 公开句柄不是内部核心：塞进来会在起播之后才炸。走 emitter.play(cueId)。
      throw makeRuntimeError(
        "SOUND_EMITTER_HANDLE_MISUSE",
        `playCue(${cueId}, { emitter }) is not supported; call emitter.play(cueId) instead`,
        { cueId },
      );
    }
    if (emitter?.disposed) {
      throw makeRuntimeError("SOUND_EMITTER_DISPOSED", `emitter for ${cueId} is disposed`, { cueId });
    }
    const audioContext = ensureContext();
    const normalizedSeed = String(seed ?? eventId ?? `${cueId}:default`);
    const scheduledAt = Number.isFinite(at) ? Math.max(audioContext.currentTime, Number(at)) : audioContext.currentTime;
    if (!unlocked) {
      const lockedPolicy = manifest.runtimePolicy?.lockedPlayback ?? manifest.lockedPolicy ?? "reject";
      if (lockedPolicy === "drop") {
        return suppressedReceipt({
          cueId,
          eventId,
          seed: normalizedSeed,
          reason: "locked",
          at: scheduledAt,
        });
      }
      throw makeRuntimeError(
        "SOUND_CONTEXT_LOCKED",
        "sound runtime must be unlocked from a user gesture before playback",
        { cueId, eventId: eventId ?? null, lockedPolicy },
      );
    }
    const cooldownMs = Math.max(0, readNumber(cue.cooldownMs, cue.cooldown) ?? 0);
    const clockMs = now();
    const previous = lastCueStarts.get(cueId);
    if (previous != null && clockMs - previous < cooldownMs) {
      diagnostics.cooldownSuppressions += 1;
      return suppressedReceipt({
        cueId,
        eventId,
        seed: normalizedSeed,
        reason: "cooldown",
        at: scheduledAt,
      });
    }
    const assetId = pickDeterministicAsset(cue, cueId, normalizedSeed);
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`cue ${cueId} references unknown asset ${assetId}`);
    const busId = cue.bus ?? cue.busId;
    if (!busId || !busDefinitions.has(busId)) throw new Error(`cue ${cueId} references unknown bus ${busId}`);
    const loadPolicy = getLoadPolicy(asset, manifest, assetId);
    if (!["buffer", "stream"].includes(loadPolicy.mode)) {
      throw new Error(`asset ${assetId} has unsupported load policy ${loadPolicy.mode}`);
    }
    const spatialPlan = resolveSpatialPlan({ cueId, cue, eventId, emitter, position, loadPolicy });
    // 走到这里所有同步校验都过了，才武装 cooldown：被拒的空间播放不能吃掉纠正后的重试。
    lastCueStarts.set(cueId, clockMs);
    const spatialDegraded = spatialPlan?.degraded ?? null;
    const activePlan = spatialDegraded ? null : spatialPlan;
    const emitterEpoch = emitter ? emitter.stopEpoch : 0;

    const instanceId = `sound-${++instanceCounter}`;
    const priority = readNumber(cue.priority) ?? 0;
    const voice = {
      sequence: instanceCounter,
      instanceId,
      cueId,
      assetId,
      busId,
      eventId: eventId ?? null,
      seed: normalizedSeed,
      priority,
      requestedAt: audioContext.currentTime,
      startedAt: audioContext.currentTime,
      scheduledAt,
      // 每调用变调：调用侧 pitchSemitones/playbackRate 叠乘在 cue 配置得出的确定性速率上。
      // 连锁合成音阶爬升这类玩法就在这里（playCue(id,{pitchSemitones: chain})），
      // 参数纯值、有界，不构成隐式状态。最终速率夹在 [0.25, 4]。
      playbackRate: clampNumber(
        deterministicPlaybackRate(cue, cueId, normalizedSeed) *
          (Number.isFinite(playbackRate) && playbackRate > 0 ? Number(playbackRate) : 1) *
          (Number.isFinite(pitchSemitones) ? 2 ** (clampNumber(Number(pitchSemitones), -24, 24) / 12) : 1),
        0.25,
        4,
      ),
      fadeInMs: Math.max(0, readNumber(__fadeInMs) ?? 0),
      status: "loading",
      position: snapshotPosition(activePlan?.position ?? position),
      finalized: false,
      // 空间状态：panner 由 connectVoiceSource 建；params 是档位+Cue+声源三层合并后的
      // 最终参数，panner 与多普勒共用；appliedRate 是上一帧真正写进 playbackRate 的值。
      panner: null,
      pushedPosition: null,
      emitter: activePlan?.emitter ?? null,
      doppler: activePlan?.doppler ?? false,
      params: activePlan?.params ?? null,
      dopplerRatio: 1,
      appliedRate: undefined,
    };

    try {
      const suppressed = loadPolicy.mode === "stream"
        ? await createStreamVoice({ voice, cue, assetId, spatialPlan: activePlan, at: scheduledAt, loadPolicy })
        : await createBufferVoice({ voice, cue, assetId, spatialPlan: activePlan, at: scheduledAt, loadPolicy });
      if (suppressed) return suppressed;

      // 声源在解码期间被停掉或销毁：此刻 source 已经 start 了，必须立刻撤回。
      // 否则「车已经没了，引擎声却在两秒后响起来」。
      if (voice.emitter) {
        if (voice.emitter.disposed || voice.emitter.stopEpoch !== emitterEpoch) {
          stopVoiceInternal(voice, "emitter-cancelled", { emitReceipt: false });
          return suppressedReceipt({
            cueId,
            eventId,
            seed: normalizedSeed,
            reason: "emitter-cancelled",
            at: scheduledAt,
          });
        }
        voice.emitter.voices.add(voice);
      }

      const receipt = Object.freeze({
        ...makeBaseReceipt({
          voice,
          at: scheduledAt,
          position: activePlan?.position ?? position,
          loadPolicy: loadPolicy.mode,
          cue,
        }),
        variantId: voice.variantId,
        spatial: activePlan
          ? { status: "spatial", emitterId: activePlan.emitter?.id ?? null, doppler: activePlan.doppler }
          : spatialDegraded,
      });
      addReceipt(receipt);
      emit("sound_cue_played", receipt);
      return receipt;
    } catch (error) {
      diagnostics.playErrors += 1;
      if (voices.get(instanceId) === voice) stopVoiceInternal(voice, "play-error", { emitReceipt: false });
      emit("sound_cue_failed", { cueId, assetId, eventId: eventId ?? null, message: error.message });
      throw error;
    }
  }

  function fadeOutVoice(instanceId, fadeMs, reason = "music-crossfade") {
    const voice = voices.get(instanceId);
    if (!voice) return null;
    const durationMs = Math.max(0, readNumber(fadeMs) ?? 0);
    if (durationMs === 0 || !voice.gainNode?.gain || !context) {
      return stopVoiceInternal(voice, reason);
    }
    const at = context.currentTime;
    const gain = voice.gainNode.gain;
    cancelAudioParam(gain, at);
    setAudioParam(gain, Number.isFinite(gain.value) ? gain.value : voice.baseGain, at);
    rampAudioParam(gain, 0, at + durationMs / 1000);
    voice.status = "fading-out";
    voice.stopTimer = setTimeout(() => stopVoiceInternal(voice, reason), durationMs);
    return Object.freeze({
      type: "fade-out",
      status: "scheduled",
      instanceId,
      cueId: voice.cueId,
      durationMs,
      reason,
    });
  }

  async function startMusic(cueId, options = {}) {
    assertUsable();
    const previousInstanceId = musicInstanceId;
    const crossfadeMs = Math.max(0, readNumber(options.crossfadeMs, options.fadeMs) ?? 0);
    const receipt = await playCue(cueId, { ...options, __fadeInMs: crossfadeMs });
    if (receipt.status === "playing" || receipt.status === "scheduled") {
      musicInstanceId = receipt.instanceId;
      if (previousInstanceId && previousInstanceId !== receipt.instanceId) {
        fadeOutVoice(previousInstanceId, crossfadeMs);
      }
    }
    return Object.freeze({ ...receipt, type: "music", previousInstanceId, crossfadeMs });
  }

  async function setMusicState(stateId, options = {}) {
    assertUsable();
    const state = musicStates.get(stateId) ?? mixStates.get(stateId);
    if (!state) throw new Error(`unknown music state ${stateId}`);
    const previousStateId = musicStateId;
    musicStateId = stateId;

    const previousState = previousStateId ? musicStates.get(previousStateId) : null;
    const previousMixStateId = previousState?.mixStateId ??
      (previousStateId && mixStates.has(previousStateId) ? previousStateId : null);
    if (previousMixStateId) {
      setMixState(previousMixStateId, { active: false, eventId: options.eventId });
    }
    const mixStateId = state.mixStateId ?? (mixStates.has(stateId) ? stateId : null);
    if (mixStateId) setMixState(mixStateId, { active: true, eventId: options.eventId });

    const hasCue = Object.hasOwn(state, "cueId") || Object.hasOwn(state, "musicCueId");
    const cueId = Object.hasOwn(state, "cueId") ? state.cueId : state.musicCueId;
    const crossfadeMs = Math.max(0, readNumber(options.crossfadeMs, state.crossfadeMs) ?? 0);
    let playReceipt = null;
    if (hasCue && cueId == null) {
      const previousInstanceId = musicInstanceId;
      musicInstanceId = null;
      if (previousInstanceId) fadeOutVoice(previousInstanceId, crossfadeMs, "music-silent-state");
    } else if (cueId) {
      playReceipt = await startMusic(cueId, { ...options, crossfadeMs });
    }
    const receipt = Object.freeze({
      type: "music-state",
      status: "active",
      stateId,
      previousStateId,
      eventId: options.eventId ?? null,
      instanceId: playReceipt?.instanceId ?? musicInstanceId,
    });
    addReceipt(receipt);
    emit("sound_music_state_changed", receipt);
    return receipt;
  }

  function setMixState(stateId, { active = true, eventId } = {}) {
    assertUsable();
    if (!mixStates.has(stateId)) throw new Error(`unknown mix state ${stateId}`);
    ensureContext();
    if (active) activeMixStates.set(stateId, { eventId: eventId ?? null });
    else activeMixStates.delete(stateId);
    applyMixStates();
    const receipt = Object.freeze({
      type: "mix-state",
      status: active ? "active" : "inactive",
      stateId,
      eventId: eventId ?? null,
    });
    addReceipt(receipt);
    emit("sound_mix_state_changed", receipt);
    return receipt;
  }

  function setUserVolumes(values) {
    assertUsable();
    if (!isRecord(values)) throw new TypeError("volume settings must be an object");
    for (const key of Object.keys(values)) {
      if (!USER_VOLUME_KEYS.includes(key)) throw new TypeError(`unknown user volume ${key}`);
      const value = values[key];
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`${key} volume must be between 0 and 1`);
      }
    }
    Object.assign(userVolumes, values);
    ensureContext();
    applyUserVolumes();
    const receipt = Object.freeze({ type: "user-volumes", status: "applied", volumes: { ...userVolumes } });
    addReceipt(receipt);
    emit("sound_user_volumes_changed", { volumes: { ...userVolumes } });
    return receipt;
  }

  function setMuted(value) {
    assertUsable();
    if (typeof value !== "boolean") throw new TypeError("muted must be boolean");
    muted = value;
    ensureContext();
    applyUserVolumes();
    const receipt = Object.freeze({ type: "mute", status: muted ? "muted" : "unmuted" });
    addReceipt(receipt);
    emit("sound_mute_changed", { muted });
    return receipt;
  }

  function stop(instanceId) {
    assertUsable();
    const voice = voices.get(instanceId);
    if (!voice) return null;
    return stopVoiceInternal(voice, "requested");
  }

  function clearDuckState() {
    for (const active of activeDucks.values()) {
      if (active.releaseTimer) clearTimeout(active.releaseTimer);
    }
    activeDucks.clear();
    if (busGraph && context) {
      for (const bus of busGraph.values()) {
        bus.duckDb = 0;
        cancelAudioParam(bus.duck.gain, context.currentTime);
        setAudioParam(bus.duck.gain, 1, context.currentTime);
      }
    }
  }

  function clear(scope = "voices") {
    assertUsable();
    const normalized = typeof scope === "string" ? { type: scope } : { ...scope };
    const type = normalized.type ?? normalized.scope ?? "voices";
    let selected = [...voices.values()];
    if (type === "music") selected = selected.filter((voice) => busIsWithin(voice.busId, "music"));
    else if (type === "sfx") selected = selected.filter((voice) => busIsWithin(voice.busId, "sfx"));
    else if (type === "bus") selected = selected.filter((voice) => busIsWithin(voice.busId, normalized.busId));
    else if (type === "cue") selected = selected.filter((voice) => voice.cueId === normalized.cueId);
    else if (["cache", "receipts"].includes(type)) selected = [];
    else if (!["voices", "all"].includes(type)) throw new Error(`unknown clear scope ${type}`);

    for (const voice of selected) stopVoiceInternal(voice, "clear");
    if (type === "cache" || type === "all") bufferCache.clear();
    if (type === "receipts" || type === "all") receipts.length = 0;
    if (type === "all") {
      revokePackBlobUrls();
    clearDuckState();
      activeMixStates.clear();
      applyMixStates();
      lastCueStarts.clear();
      musicStateId = null;
    }
    const receipt = Object.freeze({ type: "clear", status: "cleared", scope: type, stopped: selected.length });
    addReceipt(receipt);
    emit("sound_runtime_cleared", receipt);
    return receipt;
  }

  function inspect() {
    const graph = busGraph;
    return Object.freeze({
      disposed,
      unlocked,
      context: context
        ? { state: context.state ?? "unknown", currentTime: context.currentTime }
        : { state: "not-created", currentTime: null },
      manifest: {
        schemaVersion: manifest.schemaVersion ?? null,
        contentHash: manifest.contentHash ?? null,
      },
      muted,
      suspension: {
        held: autoSuspended,
        pageHidden,
        holds: [...suspendHolds].sort(),
      },
      userVolumes: { ...userVolumes },
      activeMixStates: [...activeMixStates.keys()],
      music: { stateId: musicStateId, instanceId: musicInstanceId },
      buses: graph
        ? [...graph.values()].map((bus) => ({
            id: bus.id,
            parentId: bus.parentId,
            userCategory: bus.userCategory,
            canonicalGainDb: readNumber(bus.definition.gainDb) ?? 0,
            mixGainDb: bus.mixDb,
            duckGainDb: bus.duckDb,
            userGain: resolvedUserGain(bus),
            currentUserGain: bus.user.gain?.value ?? null,
            voiceCount: [...voices.values()].filter((voice) => busIsWithin(voice.busId, bus.id)).length,
          }))
        : [...busDefinitions.entries()].map(([id, definition]) => ({
            id,
            parentId: definition.parent ?? definition.parentId ?? definition.output ?? null,
            userCategory: inheritedUserCategory(id),
            canonicalGainDb: readNumber(definition.gainDb) ?? 0,
            mixGainDb: 0,
            duckGainDb: 0,
            userGain: null,
            voiceCount: 0,
          })),
      voices: [...voices.values()].map((voice) => ({
        instanceId: voice.instanceId,
        cueId: voice.cueId,
        assetId: voice.assetId,
        variantId: voice.variantId ?? null,
        assetVariantHash: voice.assetVariantHash ?? null,
        codec: voice.codec ?? null,
        busId: voice.busId,
        eventId: voice.eventId,
        seed: voice.seed,
        priority: voice.priority,
        status: voice.status,
        kind: voice.kind ?? null,
        startedAt: voice.startedAt,
        scheduledAt: voice.scheduledAt,
        playbackRate: voice.playbackRate,
        position: voice.position,
        duckRuleId: voice.duckRuleId ?? null,
      })),
      ducks: [...activeDucks.values()].map((active) => ({
        id: active.id,
        targetBusId: duckTargetId(active.rule),
        reductionDb: duckReductionDb(active.rule),
        phase: active.phase,
        triggerCount: active.voices.size,
      })),
      cache: [...bufferCache.keys()],
      diagnostics: {
        ...diagnostics,
        decodedBufferBytes: [...bufferCache.keys()].reduce(
          (total, assetId) => total + (readNumber(assets.get(assetId)?.decodedBytes) ?? 0),
          0,
        ),
        clipDiagnostics: {
          available: false,
          reason: "no-runtime-meter",
        },
        masterSafety: {
          available: Boolean(masterSafetyNode),
          reductionDb: Number.isFinite(masterSafetyNode?.reduction)
            ? masterSafetyNode.reduction
            : null,
        },
        bufferLoadQueue: {
          active: activeBufferLoads,
          queued: pendingBufferLoads.length,
          maxConcurrent: maxConcurrentBufferLoads,
        },
      },
      receipts: receipts.map((receipt) => ({ ...receipt })),
      spatial: spatial.snapshot(),
    });
  }

  async function dispose() {
    if (disposed) return;
    for (const voice of [...voices.values()]) stopVoiceInternal(voice, "dispose", { emitReceipt: false });
    clearDuckState();
    spatial.clear();
    bufferCache.clear();
    activeMixStates.clear();
    lastCueStarts.clear();
    while (pendingBufferLoads.length > 0) {
      pendingBufferLoads.shift().reject(makeRuntimeError("SOUND_RUNTIME_DISPOSED", "sound runtime disposed"));
    }
    visibilityDocument?.removeEventListener?.("visibilitychange", onVisibilityChange);
    suspendHolds.clear();
    suspendPausedVoices.clear();
    if (busGraph) {
      for (const bus of busGraph.values()) {
        safeDisconnect(bus.input);
        safeDisconnect(bus.canonical);
        safeDisconnect(bus.mix);
        safeDisconnect(bus.duck);
        safeDisconnect(bus.user);
      }
    }
    safeDisconnect(masterSafetyNode);
    if (recordingTap) {
      for (const track of recordingTap.stream?.getTracks?.() ?? []) track.stop?.();
      recordingTap = null;
    }
    const closingContext = context;
    disposed = true;
    disposeHooks.get(api)?.();
    emit("sound_runtime_disposed");
    if (closingContext && closingContext.state !== "closed" && typeof closingContext.close === "function") {
      await closingContext.close();
    }
  }

  /**
   * 设置听者。一个运行时同时只有一个有效听者。
   *
   * 只收裸数值——"跟随哪个相机"是引擎接入层的事，core 不认识 camera 对象。
   */
  function setListener(input) {
    assertUsable();
    const state = spatial.setListener(input);
    return Object.freeze({
      type: "listener",
      status: "applied",
      position: { ...state.position },
      forward: { ...state.forward },
      up: { ...state.up },
    });
  }

  /**
   * 清掉听者的运动历史。瞬移、切相机、暂停恢复后必须调用，
   * 否则下一帧的位置差分会算出一个巨大的假速度，听感上就是一声尖叫。
   */
  function resetListenerMotion() {
    assertUsable();
    spatial.resetListenerMotion();
    return Object.freeze({ type: "listener-motion", status: "reset" });
  }

  /** 停掉某个声源当前发出的全部实例。 */
  function stopEmitterVoices(core, reason) {
    let stopped = 0;
    for (const voice of [...core.voices]) {
      stopVoiceInternal(voice, reason);
      stopped += 1;
    }
    core.voices.clear();
    return stopped;
  }

  /**
   * 创建声源。它跟着场景对象走，通过它播放**已有 Cue**——变奏、冷却、
   * 优先级与并发预算全部复用，不另造一个绕过混音系统的播放器。
   */
  function createEmitter(options = {}) {
    assertUsable();
    const core = spatial.createEmitter(options);
    const handle = Object.freeze({
      id: core.id,
      get position() {
        return { ...core.position };
      },
      get velocity() {
        return { ...core.velocity };
      },
      get disposed() {
        return core.disposed;
      },
      get voiceCount() {
        return core.voices.size;
      },
      setPosition(next) {
        core.setPosition(next);
        return handle;
      },
      /** 显式物理速度优先于位置差分——物理游戏自己知道得更准。 */
      setVelocity(next) {
        core.setVelocity(next);
        return handle;
      },
      /** 瞬移后调用，理由同 resetListenerMotion。 */
      resetMotion() {
        core.resetMotion();
        return handle;
      },
      /**
       * 连续音高控制——引擎转速、加速这类。倍率与素材变奏、多普勒相乘，
       * 不互相覆盖；下一帧 updateSpatial 走平滑写入。1 = 原速。
       */
      setPitch(scale) {
        core.setPitch(scale);
        return handle;
      },
      get pitchScale() {
        return core.pitchScale;
      },
      play(cueId, playOptions = {}) {
        if (core.disposed) {
          return Promise.reject(
            makeRuntimeError("SOUND_EMITTER_DISPOSED", `emitter ${core.id ?? ""} is disposed`, {
              cueId,
            }),
          );
        }
        return playCue(cueId, { ...playOptions, __emitter: core });
      },
      /** 停当前实例，声源本身还能再播。 */
      stop() {
        core.stopEpoch += 1;
        const stopped = stopEmitterVoices(core, "emitter-stop");
        return Object.freeze({ type: "emitter-stop", status: "stopped", stopped });
      },
      /** 停实例并解除绑定。对象销毁时调用；只是离开屏幕不算销毁。 */
      dispose() {
        core.stopEpoch += 1;
        const stopped = stopEmitterVoices(core, "emitter-dispose");
        spatial.removeEmitter(core);
        return Object.freeze({ type: "emitter-dispose", status: "disposed", stopped });
      },
    });
    return handle;
  }

  /**
   * 每帧推进空间状态。必须在游戏更新完变换之后调用。
   *
   * dt 是秒。传 0 或负数时保持上一帧速度，不产生除零尖峰。
   */
  function updateSpatial(dtSeconds) {
    assertUsable();
    if (!context) return Object.freeze({ type: "spatial-update", status: "no-context" });
    const result = spatial.update(Number(dtSeconds) || 0, context);
    return Object.freeze({ type: "spatial-update", status: "applied", ...result });
  }

  /** 切换或微调引擎档位。接入层在 attach 时调用，游戏一般不碰。 */
  function configureSpatial(profile) {
    assertUsable();
    return Object.freeze({
      type: "spatial-profile",
      status: "applied",
      profile: spatial.setProfile(resolveSpatialProfile(profile, spatial.getProfile())),
    });
  }

  /**
   * 给引擎接入层用的最小面。传它而不是传公开 runtime，既避免了
   * "返回值引用自身"的循环，也让接入层能碰的东西一目了然。
   */
  const spatialFacade = Object.freeze({
    configureSpatial,
    setListener,
    resetListenerMotion,
    createEmitter,
    updateSpatial,
  });

  const settings = Object.freeze({
    get() {
      assertUsable();
      return Object.freeze({ volumes: { ...userVolumes }, muted });
    },
    setVolumes: setUserVolumes,
    setMuted,
  });

  const api = Object.freeze({
    unlock,
    /** 只读回执：最近一次 unlock() 是否让输出跑起来了。 */
    unlocked: () => unlocked,
    recordingStream,
    preload,
    playCue,
    startMusic,
    setMusicState,
    setMixState,
    setUserVolumes,
    setMuted,
    setHold,
    settings,
    setListener,
    resetListenerMotion,
    createEmitter,
    updateSpatial,
    configureSpatial,
    /** 听者跟随 three 相机、声源跟随 Object3D。不 import three。 */
    attachThree: (options) => attachThree(spatialFacade, options),
    /** 听者跟随 pixi 视口中心、声源跟随显示对象。不 import pixi。 */
    attachPixi: (options) => attachPixi(spatialFacade, options),
    /** 听者跟随 Phaser 相机中心、声源跟随游戏对象；默认挂 postupdate 自动推进。不 import Phaser。 */
    attachPhaser: (options) => attachPhaser(spatialFacade, options),
    stop,
    clear,
    inspect,
    dispose,
  });
  return api;
}

/**
 * 在 `window.__mpSound` 登记录音口，并派发 `mp:sound-ready`（游戏录制契约 C-A）。
 *
 * 平台的回放录制器在游戏脚本之前就装好了，它等这个登记：有登记就只录
 * `recordingStream()`，不再 hook 任何 Web Audio 与媒体元素。登记只暴露录音与解锁，
 * 不暴露播放面。多实例时后登记者覆盖（按约定一局只有一个）；dispose 时仅当
 * 登记仍是自己才摘掉，不误删后来者。
 */
function registerRecordingTap(runtime) {
  const target = globalThis.window;
  if (!target || typeof target !== "object") return;
  const registration = Object.freeze({
    recordingStream: () => runtime.recordingStream(),
    unlocked: () => runtime.unlocked(),
    unlock: () => runtime.unlock(),
    version: RUNTIME_VERSION,
  });
  try {
    Object.defineProperty(target, "__mpSound", { configurable: true, enumerable: false, writable: false, value: registration });
  } catch {
    return;
  }
  disposeHooks.set(runtime, () => {
    if (target.__mpSound === registration) {
      try { delete target.__mpSound; } catch { /* no-op */ }
    }
  });
  if (typeof target.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
    try { target.dispatchEvent(new globalThis.CustomEvent("mp:sound-ready")); } catch { /* no-op */ }
  }
}

/**
 * Browser-facing convenience entrypoint.
 *
 * This owns manifest IO and media-element creation, but it still returns one
 * explicit runtime instance that the game keeps and disposes with its own
 * lifecycle; nothing is persisted. The only global it touches is the read-only
 * recording registration `window.__mpSound` (see registerRecordingTap).
 */
export async function loadSoundSystem({
  manifestUrl = "./sound.manifest.json",
  baseUrl,
  audioContextFactory,
  fetchImpl,
  mediaElementFactory,
  telemetrySink,
  now,
} = {}) {
  const browserFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (typeof browserFetch !== "function") {
    throw makeRuntimeError(
      "SOUND_MANIFEST_FETCH_REQUIRED",
      "fetch is required to load the sound manifest",
      { manifestUrl },
    );
  }

  let response;
  try {
    response = await browserFetch(manifestUrl);
  } catch (cause) {
    throw makeRuntimeError(
      "SOUND_MANIFEST_LOAD_FAILED",
      `failed to load sound manifest ${manifestUrl}`,
      { manifestUrl, cause },
    );
  }
  if (!response || response.ok === false || typeof response.json !== "function") {
    throw makeRuntimeError(
      "SOUND_MANIFEST_LOAD_FAILED",
      `failed to load sound manifest ${manifestUrl}`,
      { manifestUrl, status: response?.status ?? null },
    );
  }

  let manifest;
  try {
    manifest = await response.json();
  } catch (cause) {
    throw makeRuntimeError(
      "SOUND_MANIFEST_INVALID",
      `sound manifest ${manifestUrl} is not valid JSON`,
      { manifestUrl, cause },
    );
  }

  const defaultMediaElementFactory = globalThis.document?.createElement
    ? () => globalThis.document.createElement("audio")
    : undefined;
  const runtime = createSoundRuntime({
    manifest,
    baseUrl: baseUrl ?? manifestDirectoryUrl(manifestUrl, response.url),
    audioContextFactory,
    fetchImpl: browserFetch,
    mediaElementFactory: mediaElementFactory ?? defaultMediaElementFactory,
    telemetrySink,
    now,
  });
  registerRecordingTap(runtime);
  return runtime;
}

export default createSoundRuntime;
