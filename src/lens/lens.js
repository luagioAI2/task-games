// src/pixi/socket-attachment.js
var finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
var degrees = (radians2) => Math.round(radians2 * 180 / Math.PI * 1e3) / 1e3;
var radians = (value) => value * Math.PI / 180;
function isContainerLike(object) {
  return Boolean(
    object && typeof object === "object" && object.nodeType === void 0 && object.isObject3D !== true && typeof object.addChild === "function"
  );
}
function detach(container) {
  container?.parent?.removeChild?.(container);
}
function applyTransform(container, { x = 0, y = 0, rotation = 0, scaleX = 1, scaleY } = {}) {
  container.position.set(finite(x), finite(y));
  container.rotation = finite(rotation);
  container.scale.set(finite(scaleX, 1), finite(scaleY, finite(scaleX, 1)));
}
function createPixiSocketAttachment({
  id,
  label,
  socketId,
  createContainer,
  correction = {},
  initialTuning = {}
} = {}) {
  if (!id || typeof createContainer !== "function") {
    throw new TypeError("Socket attachment requires id and a createContainer factory.");
  }
  const socketCorrection = createContainer();
  const translatePivot = createContainer();
  const tuningPivot = createContainer();
  if (!isContainerLike(socketCorrection) || !isContainerLike(translatePivot) || !isContainerLike(tuningPivot)) {
    throw new TypeError("createContainer must return Pixi containers.");
  }
  const correctionTransform = {
    x: finite(correction.x),
    y: finite(correction.y),
    rotation: radians(finite(correction.rotation)),
    scaleX: Math.max(1e-4, finite(correction.scale, 1))
  };
  applyTransform(socketCorrection, correctionTransform);
  socketCorrection.addChild(translatePivot);
  translatePivot.addChild(tuningPivot);
  const tuning = {
    x: finite(initialTuning.x),
    y: finite(initialTuning.y),
    rotation: radians(finite(initialTuning.rotation)),
    scale: Math.max(0.01, finite(initialTuning.scale, 1))
  };
  let socketProxy = null;
  let getTransform = null;
  let assetRoot = null;
  let bindAttempted = false;
  let socketResolved = false;
  let disposed = false;
  function applyTuning() {
    let chainRotation = 0;
    let chainScaleX = 1;
    let chainScaleY = 1;
    let node = socketCorrection;
    const seen = /* @__PURE__ */ new Set();
    while (node && !seen.has(node)) {
      seen.add(node);
      chainRotation += finite(node.rotation);
      chainScaleX *= finite(node.scale?.x, 1) || 1;
      chainScaleY *= finite(node.scale?.y, 1) || 1;
      node = node.parent;
    }
    const cos = Math.cos(-chainRotation);
    const sin = Math.sin(-chainRotation);
    const localX = (tuning.x * cos - tuning.y * sin) / (chainScaleX || 1);
    const localY = (tuning.x * sin + tuning.y * cos) / (chainScaleY || 1);
    applyTransform(translatePivot, { x: localX, y: localY });
    applyTransform(tuningPivot, { rotation: tuning.rotation, scaleX: tuning.scale });
  }
  function currentStatus() {
    if (disposed) return "disposed";
    if (!socketResolved) return bindAttempted ? "missing-socket" : "waiting-socket";
    return assetRoot ? "ready" : "waiting-asset";
  }
  applyTuning();
  return {
    id,
    label: label || id,
    bindSocket({ container, host, getTransform: transformProvider } = {}) {
      if (disposed) throw new Error("Socket attachment is disposed.");
      bindAttempted = true;
      socketResolved = false;
      getTransform = null;
      detach(socketCorrection);
      if (socketProxy) {
        detach(socketProxy);
        socketProxy = null;
      }
      if (isContainerLike(container)) {
        container.addChild(socketCorrection);
        socketResolved = true;
        applyTuning();
      } else if (typeof transformProvider === "function" && isContainerLike(host)) {
        socketProxy = createContainer();
        if (!isContainerLike(socketProxy)) throw new TypeError("createContainer must return Pixi containers.");
        host.addChild(socketProxy);
        socketProxy.addChild(socketCorrection);
        getTransform = transformProvider;
        socketResolved = true;
        this.update();
        applyTuning();
      }
      return socketResolved;
    },
    update() {
      if (disposed || !socketProxy || typeof getTransform !== "function") return false;
      let transform = null;
      try {
        transform = getTransform();
      } catch {
        return false;
      }
      if (!transform || typeof transform !== "object") return false;
      applyTransform(socketProxy, {
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation,
        scaleX: transform.scaleX ?? 1,
        scaleY: transform.scaleY
      });
      return true;
    },
    attachAsset(root) {
      if (disposed) throw new Error("Socket attachment is disposed.");
      if (assetRoot) detach(assetRoot);
      assetRoot = isContainerLike(root) ? root : null;
      if (assetRoot) tuningPivot.addChild(assetRoot);
      return assetRoot !== null;
    },
    setTuning(next = {}) {
      if (disposed) throw new Error("Socket attachment is disposed.");
      for (const key of ["x", "y", "rotation"]) {
        if (Object.hasOwn(next, key)) tuning[key] = finite(next[key], tuning[key]);
      }
      if (Object.hasOwn(next, "scale")) tuning.scale = Math.max(0.01, finite(next.scale, tuning.scale));
      applyTuning();
    },
    getTuning() {
      return { ...tuning };
    },
    getDescriptor() {
      return {
        id,
        label: label || id,
        socketId: socketId ?? null,
        correction: {
          x: correctionTransform.x,
          y: correctionTransform.y,
          rotation: degrees(correctionTransform.rotation),
          scale: correctionTransform.scaleX
        }
      };
    },
    getRoot() {
      return assetRoot;
    },
    getTuningPivot() {
      return tuningPivot;
    },
    getStatus() {
      return {
        status: currentStatus(),
        socketId: socketId ?? null,
        mode: socketProxy ? "transform-provider" : socketResolved ? "container" : null,
        assetReady: Boolean(assetRoot)
      };
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      detach(assetRoot);
      detach(socketCorrection);
      if (socketProxy) detach(socketProxy);
      socketProxy = null;
      getTransform = null;
      assetRoot = null;
    }
  };
}
function attachmentControl(attachment, id, label, key, { min, max, step, unit, socketLabel }) {
  const rotation = key === "rotation";
  const initialValue = attachment.getTuning()[key];
  const defaultValue = rotation ? degrees(initialValue) : initialValue;
  const requireReady = () => {
    if (attachment.getStatus().status !== "ready") {
      throw new Error("Socket attachment is not bound to a visible socket.");
    }
  };
  return {
    id,
    type: "number",
    label,
    description: rotation ? `\u56F4\u7ED5${socketLabel}\u6302\u70B9\u7684\u81EA\u8F6C\uFF1B\u4E0D\u5F71\u54CD\u504F\u79FB\u8F74\u5411\u3002` : `\u5C4F\u5E55\u8F74\u5411\u7684\u89C6\u89C9\u504F\u79FB\uFF1AX \u53EA\u6539\u6A2A\u5411\u3001Y \u53EA\u6539\u7EB5\u5411\uFF0C\u4E0D\u53D7\u6302\u70B9\u65CB\u8F6C\u5F71\u54CD\u3002`,
    category: "visual",
    unit,
    min,
    max,
    step,
    defaultValue,
    get: () => {
      requireReady();
      const value = attachment.getTuning()[key];
      return rotation ? degrees(value) : value;
    },
    set: (value) => {
      requireReady();
      attachment.setTuning({ [key]: rotation ? radians(value) : value });
    }
  };
}
function createPixiSocketAttachmentLensSpec(attachment, {
  id,
  parent,
  ownerSemanticId,
  socketLabel = "\u6302\u70B9",
  label,
  summary,
  tags = [],
  resources = [],
  source = null
} = {}) {
  if (!attachment?.getDescriptor || !attachment?.getStatus || !attachment?.setTuning) {
    throw new TypeError("A createPixiSocketAttachment result is required.");
  }
  const descriptor = attachment.getDescriptor();
  return Object.freeze({
    definition: {
      id,
      parent,
      label: label || descriptor.label,
      summary,
      tags: ["attachment", "socket", "tunable", ...tags],
      source,
      resources,
      config: {
        relationship: "socket-attachment",
        ownerSemanticId,
        socket: { id: descriptor.socketId },
        correction: descriptor.correction,
        tuningLayer: "local-visual-only"
      },
      parts: [{ id: "attachment", label: `${label || descriptor.label}\u89C6\u89C9` }],
      controls: [
        attachmentControl(attachment, "offset-x", "\u504F\u79FB X\uFF08\u6A2A\u5411\uFF09", "x", { min: -200, max: 200, step: 1, unit: "px", socketLabel }),
        attachmentControl(attachment, "offset-y", "\u504F\u79FB Y\uFF08\u7EB5\u5411\uFF09", "y", { min: -200, max: 200, step: 1, unit: "px", socketLabel }),
        attachmentControl(attachment, "rotate", "\u65CB\u8F6C", "rotation", { min: -180, max: 180, step: 1, unit: "deg", socketLabel }),
        attachmentControl(attachment, "uniform-scale", "\u89C6\u89C9\u6BD4\u4F8B", "scale", { min: 0.1, max: 3, step: 0.01, unit: "\xD7", socketLabel })
      ]
    },
    binding() {
      return {
        parts: {
          attachment: {
            provideRoot: () => attachment.getStatus().status === "ready" ? attachment.getRoot() : null,
            providers: { inspect: () => attachment.getStatus() }
          }
        },
        providers: {
          inspect: () => ({ socket: attachment.getStatus(), tuning: attachment.getTuning() })
        }
      };
    }
  });
}

// src/runtime/frame-provider.js
function activeFrameProvider(globalRef = globalThis) {
  const providers = globalRef.__mpLensRegistry?.providers;
  if (typeof providers?.values !== "function") return null;
  for (const provider of providers.values()) {
    if (provider?.kind === "frame-provider" && typeof provider.renderFrame === "function") return provider;
  }
  return null;
}

// src/dom/node-snapshot.js
var MAX_EDGE = 1024;
var MAX_DATA_URL = 18e4;
var FINGERPRINT_NODES = 64;
var FINGERPRINT_TEXT = 2048;
function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
function renderedRect(root, windowRef) {
  if (!root?.isConnected || typeof root.getBoundingClientRect !== "function") return null;
  let current = root;
  while (current?.nodeType === 1) {
    let style;
    try {
      style = windowRef.getComputedStyle(current);
    } catch {
      return null;
    }
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.contentVisibility === "hidden" || Number.parseFloat(style.opacity) === 0) return null;
    current = current.parentElement;
  }
  const rect = root.getBoundingClientRect();
  if (![rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}
function dimensionsFor(rect) {
  const scale = Math.min(1, MAX_EDGE / Math.max(rect.width, rect.height));
  return {
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale))
  };
}
function fingerprint(root, rect) {
  const chunks = [
    `${Math.round(rect.width * 10)}/${Math.round(rect.height * 10)}`,
    String(root.className ?? ""),
    String(root.getAttribute?.("aria-hidden") ?? "")
  ];
  let textBudget = FINGERPRINT_TEXT;
  const queue = [root];
  while (queue.length && chunks.length < FINGERPRINT_NODES * 4) {
    const node = queue.shift();
    if (!node || node.nodeType !== 1) continue;
    chunks.push(String(node.tagName ?? ""), String(node.className ?? ""), String(node.getAttribute?.("style") ?? ""));
    const text = String(node.childNodes?.length === 1 && node.firstChild?.nodeType === 3 ? node.textContent ?? "" : "");
    if (text && textBudget > 0) {
      const slice = text.slice(0, textBudget);
      chunks.push(slice);
      textBudget -= slice.length;
    }
    if (String(node.tagName).toLowerCase() === "img") chunks.push(String(node.currentSrc ?? node.src ?? ""));
    for (const child of node.children ?? []) queue.push(child);
  }
  return hashString(chunks.join(""));
}
function decodeImage(dataUrl, windowRef) {
  return new Promise((resolve, reject) => {
    const image = new windowRef.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("UI node snapshot image decode failed."));
    image.src = dataUrl;
  });
}
async function boundRaster(dataUrl, width, height, windowRef) {
  if (dataUrl.length <= MAX_DATA_URL) {
    return { dataUrl, width, height, mime: "image/png" };
  }
  const image = await decodeImage(dataUrl, windowRef);
  const canvas = windowRef.document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  let scale = 1;
  while (scale >= 0.35) {
    const nextWidth = Math.max(1, Math.round(width * scale));
    const nextHeight = Math.max(1, Math.round(height * scale));
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    context.clearRect(0, 0, nextWidth, nextHeight);
    context.drawImage(image, 0, 0, nextWidth, nextHeight);
    const png = canvas.toDataURL("image/png");
    if (png.length <= MAX_DATA_URL) return { dataUrl: png, width: nextWidth, height: nextHeight, mime: "image/png" };
    scale *= 0.75;
  }
  for (const quality of [0.82, 0.68, 0.52, 0.4]) {
    const jpeg = canvas.toDataURL("image/jpeg", quality);
    if (jpeg.length <= MAX_DATA_URL) {
      return { dataUrl: jpeg, width: canvas.width, height: canvas.height, mime: "image/jpeg" };
    }
  }
  return null;
}
async function captureDomRaster(root, rect, windowRef) {
  const htmlToImage = windowRef.htmlToImage;
  if (!htmlToImage || typeof htmlToImage.toPng !== "function") return null;
  const dimensions = dimensionsFor(rect);
  const dataUrl = await htmlToImage.toPng(root, {
    cacheBust: false,
    includeQueryParams: false,
    pixelRatio: 1,
    canvasWidth: dimensions.width,
    canvasHeight: dimensions.height,
    skipAutoScale: true,
    skipFonts: true,
    style: {
      position: "relative",
      inset: "auto",
      left: "0",
      top: "0",
      right: "auto",
      bottom: "auto",
      margin: "0",
      transform: "none",
      translate: "none"
    }
  });
  if (!dataUrl?.startsWith("data:image/png;base64,")) return null;
  return boundRaster(dataUrl, dimensions.width, dimensions.height, windowRef);
}
function createDomNodeSnapshotProvider(getRoot, { windowRef = globalThis.window } = {}) {
  let cached = null;
  let cachedFingerprint = "";
  let pendingFingerprint = "";
  let currentRoot = null;
  let generation = 0;
  return function provideNodeSnapshot() {
    const root = getRoot?.();
    if (root !== currentRoot) {
      currentRoot = root;
      cached = null;
      cachedFingerprint = "";
      pendingFingerprint = "";
      generation += 1;
    }
    const rect = renderedRect(root, windowRef);
    if (!rect) {
      cached = null;
      cachedFingerprint = "";
      pendingFingerprint = "";
      generation += 1;
      return null;
    }
    const nextFingerprint = fingerprint(root, rect);
    if (nextFingerprint !== cachedFingerprint && nextFingerprint !== pendingFingerprint) {
      pendingFingerprint = nextFingerprint;
      const captureGeneration = ++generation;
      void captureDomRaster(root, rect, windowRef).then((snapshot) => {
        if (captureGeneration !== generation || pendingFingerprint !== nextFingerprint) return;
        cached = snapshot ? {
          version: 1,
          kind: "image",
          width: snapshot.width,
          height: snapshot.height,
          mime: snapshot.mime,
          dataUrl: snapshot.dataUrl
        } : null;
        cachedFingerprint = snapshot ? nextFingerprint : "";
        pendingFingerprint = "";
      }).catch(() => {
        if (captureGeneration === generation) pendingFingerprint = "";
      });
    }
    return cached;
  };
}
function captureCanvasNodeSnapshot(canvas) {
  if (!canvas || typeof canvas.toDataURL !== "function") return null;
  try {
    activeFrameProvider()?.renderFrame?.();
  } catch {
  }
  const width = Number(canvas.width);
  const height = Number(canvas.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null;
  try {
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > MAX_DATA_URL) return null;
    return { version: 1, kind: "image", width, height, mime: "image/png", dataUrl };
  } catch {
    return null;
  }
}

// src/dom/offset-apply.js
var FALLBACK_BASELINE = /* @__PURE__ */ new WeakMap();
function supportsTranslateProperty(element) {
  const style = element?.style;
  return Boolean(style) && typeof style.translate === "string";
}
function applyDomOffset(element, offset) {
  if (!element || typeof element !== "object" || !element.style) return false;
  const x = Number(offset?.x);
  const y = Number(offset?.y);
  const dx = Number.isFinite(x) ? x : 0;
  const dy = Number.isFinite(y) ? y : 0;
  if (supportsTranslateProperty(element)) {
    element.style.translate = dx === 0 && dy === 0 ? "" : `${dx}px ${dy}px`;
    return true;
  }
  if (!FALLBACK_BASELINE.has(element)) FALLBACK_BASELINE.set(element, element.style.transform || "");
  const baseline = FALLBACK_BASELINE.get(element);
  const shift = dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`;
  element.style.transform = [baseline, shift].filter(Boolean).join(" ");
  return true;
}

// src/controls/offset-controls.js
var AXIS_LABEL = { x: "X", y: "Y", z: "Z" };
function buildOffsetControls(defaults, options = {}) {
  const {
    getOffset,
    setOffset,
    axes = defaults.axes,
    labelPrefix = "\u89C6\u89C9\u504F\u79FB",
    description,
    category = defaults.category,
    unit = defaults.unit,
    min = defaults.min,
    max = defaults.max,
    step = defaults.step,
    integer = defaults.integer,
    dragRange = defaults.dragRange,
    idPrefix = "offset",
    locked = false,
    lockedNote
  } = options;
  const axisList = Array.isArray(axes) && axes.length ? axes : defaults.axes;
  return axisList.map((axis) => ({
    id: `${idPrefix}-${axis}`,
    type: "number",
    label: `${labelPrefix} ${AXIS_LABEL[axis] ?? String(axis).toUpperCase()}`,
    ...description ? { description } : {},
    category,
    unit,
    ...min != null ? { min } : {},
    ...max != null ? { max } : {},
    ...step != null ? { step } : {},
    ...integer ? { integer: true } : {},
    ...dragRange != null ? { dragRange } : {},
    defaultValue: 0,
    ...locked === true ? { locked: true, ...lockedNote ? { lockedNote } : {} } : {},
    get: () => Number(getOffset?.()?.[axis] ?? 0),
    // set 必须回传**全量**偏移对象(现值铺底+本轴覆写):游戏侧 setOffset 常见替换式写法
    // (off.x = next.x; off.y = next.y),只传单轴会让其余轴吃到 undefined 当场归零
    // (2026-09-02 实报:改 Y 后 X 清零)。全量回传对 merge 式与替换式实现都成立。
    ...locked === true || typeof setOffset !== "function" ? {} : { set: (value) => setOffset({ ...getOffset?.() ?? {}, [axis]: value }) }
  }));
}
function screenOffsetControls(options) {
  return buildOffsetControls({ axes: ["x", "y"], unit: "px", min: null, max: null, step: 1, integer: true, dragRange: 200, category: "ui-layout" }, options);
}
function worldOffsetControls2D(options) {
  return buildOffsetControls({ axes: ["x", "y"], unit: "px", min: null, max: null, step: 1, integer: true, dragRange: 150, category: "visual" }, options);
}
function worldOffsetControls3D(options) {
  return buildOffsetControls({ axes: ["x", "y", "z"], unit: "u", min: null, max: null, step: 0.05, integer: false, dragRange: 2, category: "visual" }, options);
}

// src/entry/lens.js
var SCENE_LENS_CHANNEL = "makeplay:scene-lens:v1";
var runtime = () => {
  const candidate = globalThis.__mpLensRuntime;
  return candidate && typeof candidate === "object" ? candidate : null;
};
var noop = () => {
};
function stubLease(instanceRef) {
  return Object.freeze({
    active: false,
    instanceRef: typeof instanceRef === "string" ? instanceRef : null,
    rebind: () => false,
    dispose: () => false
  });
}
function stubHandle(definition) {
  return Object.freeze({
    id: typeof definition?.id === "string" ? definition.id : "",
    bind: () => stubLease(),
    mount: (input) => stubLease(input?.instanceRef)
  });
}
function stubTree() {
  return Object.freeze({
    group: stubHandle,
    entity: stubHandle,
    collection: stubHandle,
    virtual: stubHandle,
    snapshot: () => ({ nodes: [] }),
    describe: () => null,
    view: () => null,
    bindings: () => [],
    subscribe: () => noop,
    setActive: noop,
    cancelPendingControls: noop,
    applyControl: async () => null,
    resetControl: async () => null,
    resetAll: async () => null,
    destroy: noop
  });
}
function stubBridge() {
  return Object.freeze({
    active: false,
    selection: null,
    view: () => null,
    select: () => null,
    startPicker: noop,
    stopPicker: noop,
    setActive: () => null,
    captureCurrentFrame: () => null,
    dispose: noop
  });
}
function createLensTree(options) {
  const active = runtime();
  return typeof active?.createLensTree === "function" ? active.createLensTree(options) : stubTree();
}
function createLensThreeBridge(options) {
  const active = runtime();
  return typeof active?.createLensThreeBridge === "function" ? active.createLensThreeBridge(options) : stubBridge();
}
function createLensPixiBridge(options) {
  const active = runtime();
  return typeof active?.createLensPixiBridge === "function" ? active.createLensPixiBridge(options) : stubBridge();
}
export {
  SCENE_LENS_CHANNEL,
  applyDomOffset,
  captureCanvasNodeSnapshot,
  createDomNodeSnapshotProvider,
  createLensPixiBridge,
  createLensThreeBridge,
  createLensTree,
  createPixiSocketAttachment,
  createPixiSocketAttachmentLensSpec,
  screenOffsetControls,
  worldOffsetControls2D,
  worldOffsetControls3D
};
