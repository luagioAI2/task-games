import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CAB, HOLE, PRONG_PTS, PRONG_RADIUS, HUB_R, HUB_HH, CARRIAGE_Y } from './physics.ts';
import { fabricNormal, labelTexture, glossWhite, glassSmudge, backboardPrint, headerSign, prizeOutRing, ledgeLabel, doorSticker, floorTiles, feltPlain, glassReflection } from './textures.ts';
import { THEMES, type Theme, BRAND } from './themes.ts';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * 机台材质表 —— **每次挂载换一套**，不再是模块级常量。
 *
 * ## 为什么改（2026-10-23，两个都是真问题）
 *
 * ① **模块求值就 `document.createElement('canvas')`**（`glossWhite()` 里）。
 *    宿主用 `check-plugin.mjs` 验包时会在 **Node** 里真 `import()` 一次
 *    （它靠这个看导出形状），于是直接抛 `document is not defined` ——
 *    而报错长得像"插件包坏了"。同理，任何想在不带 DOM 的环境里碰一下
 *    这个包的地方都会炸。
 *
 * ② **插件会被反复挂载**（孩子切 tab）。材质是单例的话，第一次 `unmount`
 *    把它们 `dispose()` 之后，第二次挂载拿到的是**已销毁的材质** ——
 *    症状是黑屏或纯白，**不报错**。`unmount` 里该释放的必须释放，
 *    所以只能每次重建。
 *
 * ## 为什么用 Proxy，而不是把 50 处 `M.xxx` 改成 `M().xxx`
 *
 * 改调用点是 50 次机会去漏一处，而漏掉的那处会在运行时变成
 * `undefined is not a function`。Proxy 把"懒建 + 可重置"藏在属性读取后面，
 * 调用点一个字都不用动。
 */
function buildMaterials() {
  const whiteMap = glossWhite();
  return {
    body: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: whiteMap, roughness: 0.22, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.18 }),
    accent: new THREE.MeshPhysicalMaterial({ color: THEMES[0].accent, roughness: 0.28, metalness: 0.08, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    accentSoft: new THREE.MeshStandardMaterial({ color: THEMES[0].accentSoft, roughness: 0.45 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.95 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe0e2e6, roughness: 0.18, metalness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.92 }),
    blackPlastic: new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }),
    ballRed: new THREE.MeshPhysicalMaterial({ color: 0xd62828, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.35 }),
    buttonRed: new THREE.MeshPhysicalMaterial({ color: 0xe03030, roughness: 0.25, clearcoat: 0.75, clearcoatRoughness: 0.3 }),
    glassTint: new THREE.MeshStandardMaterial({ color: 0xe8f2f0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide }),
    glassRefl: new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, envMapIntensity: 3.8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02 }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xd0e4ea, roughness: 0.12, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    smoked: new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.25, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    tube: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf5f8ff, emissiveIntensity: 2.8 }),
    doorLamp: new THREE.MeshStandardMaterial({ color: 0x222, emissive: THEMES[0].led, emissiveIntensity: 0.15 }),
    ledStrip: new THREE.MeshStandardMaterial({ color: 0x111, emissive: THEMES[0].led, emissiveIntensity: 1.8 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7 }),
  };
}

export type Materials = ReturnType<typeof buildMaterials>;

let current: Materials | null = null;

/** 换一套全新的材质。**每次挂载都要调**（旧的已经在卸载时 dispose 了）。 */
export function useFreshMaterials(): Materials {
  current = buildMaterials();
  return current;
}

export const M: Materials = new Proxy({} as Materials, {
  get(_t, k) {
    if (!current) current = buildMaterials();
    return (current as unknown as Record<string | symbol, unknown>)[k];
  },
  set(_t, k, v) {
    if (!current) current = buildMaterials();
    (current as unknown as Record<string | symbol, unknown>)[k] = v;
    return true;
  },
});

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
function decal(map: THREE.Texture, w: number, h: number, x: number, y: number, z: number, parent: THREE.Object3D, rough = 0.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: rough, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
}

export interface MachineParts {
  root: THREE.Group;
  beam: THREE.Object3D; carriage: THREE.Object3D; cable: THREE.Mesh;
  hub: THREE.Object3D; prongs: THREE.Object3D[];
  doorPos: THREE.Vector3;
  ledStrips: THREE.Mesh[];
  prizeRing: THREE.Mesh;
  themeables: { mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial; kind: 'accent' | 'led' | 'soft' }[];
  signMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  ledgeLbl: THREE.Mesh;
  doorDec: THREE.Mesh;
  ringDec: THREE.Mesh;
}

export function applyTheme(parts: MachineParts, theme: Theme) {
  for (const t of parts.themeables) {
    if (t.kind === 'accent') t.mat.color.setHex(theme.accent);
    else if (t.kind === 'soft') t.mat.color.setHex(theme.accentSoft);
    else { t.mat.emissive.setHex(theme.led); }
  }
  M.accent.color.setHex(theme.accent);
  M.accentSoft.color.setHex(theme.accentSoft);
  M.ledStrip.emissive.setHex(theme.led);
  M.doorLamp.emissive.setHex(theme.led);
  // refresh printed textures
  const softHex = '#' + theme.accentSoft.toString(16).padStart(6, '0');
  const hardHex = theme.accentHex;
  const sign = headerSign(hardHex, softHex);
  const bb = backboardPrint(hardHex, softHex);
  const ring = prizeOutRing(hardHex);
  const ledge = ledgeLabel(hardHex);
  const door = doorSticker(hardHex, softHex);
  const setMap = (mesh: THREE.Mesh, map: THREE.Texture, emissive = false) => {
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.map?.dispose(); if (emissive && m.emissiveMap) m.emissiveMap.dispose();
    m.map = map; if (emissive) { m.emissiveMap = map; m.emissive.setHex(0xffffff); }
    m.needsUpdate = true;
  };
  setMap(parts.signMesh, sign, true);
  setMap(parts.backMesh, bb, true);
  setMap(parts.ringDec, ring);
  setMap(parts.ledgeLbl, ledge);
  setMap(parts.doorDec, door);
}

export function buildMachine(theme: Theme = THEMES[0]): MachineParts {
  const root = new THREE.Group();
  const { hx, hz, top } = CAB;
  const OX = 0.58, OZ = 0.5, PH = 1.0;
  const themeables: MachineParts['themeables'] = [];
  const track = (mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial, kind: 'accent' | 'led' | 'soft') => { themeables.push({ mat, kind }); return mat; };

  // ---- lower cabinet: glossy white ----
  mesh(new RoundedBoxGeometry(OX * 2, PH - 0.012, 0.72, 4, 0.02), M.body, 0, -PH / 2 - 0.006, -0.14, root);
  // front panel with circular prize-out cutout (approx via plane + ring overlay)
  mesh(new RoundedBoxGeometry(OX * 2, PH - 0.12, 0.28, 3, 0.015), M.body, 0, -PH / 2 + 0.04, 0.36, root);
  // accent bumper strip around lower front
  const bumpMat = track(M.accent, 'accent');
  mesh(new THREE.BoxGeometry(OX * 2 + 0.004, 0.04, 0.012), bumpMat, 0, -0.08, 0.505, root);

  // circular PRIZE OUT
  const ringTex = prizeOutRing(theme.accentHex);
  const ringDec = decal(ringTex, 0.48, 0.48, -0.3, -0.52, 0.505, root, 0.35);
  // dark well behind the ring
  mesh(new THREE.CircleGeometry(0.18, 32), M.dark, -0.3, -0.52, 0.49, root, false);
  const prizeRing = mesh(new THREE.TorusGeometry(0.22, 0.022, 12, 48), track(M.doorLamp, 'led'), -0.3, -0.52, 0.502, root, false);

  // maintenance door + mascot sticker
  mesh(new RoundedBoxGeometry(0.38, 0.55, 0.02, 2, 0.01), M.body, 0.32, -0.52, 0.495, root);
  mesh(new THREE.BoxGeometry(0.39, 0.02, 0.022), bumpMat, 0.32, -0.25, 0.506, root);
  mesh(new THREE.BoxGeometry(0.39, 0.02, 0.022), bumpMat, 0.32, -0.79, 0.506, root);
  mesh(new THREE.BoxGeometry(0.02, 0.55, 0.022), bumpMat, 0.13, -0.52, 0.506, root);
  mesh(new THREE.BoxGeometry(0.02, 0.55, 0.022), bumpMat, 0.51, -0.52, 0.506, root);
  const doorDec = decal(doorSticker(theme.accentHex, '#' + theme.accentSoft.toString(16).padStart(6, '0')), 0.22, 0.28, 0.32, -0.55, 0.508, root);
  // lock
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), M.chrome, 0.32, -0.28, 0.51, root, false).rotation.x = Math.PI / 2;

  // control ledge (accent color, rounded)
  const ledge = mesh(new RoundedBoxGeometry(OX * 2 * 0.72, 0.08, 0.22, 3, 0.03), bumpMat, 0, -0.02, 0.58, root);
  ledge.rotation.x = 0.12;
  const ledgeLbl = decal(ledgeLabel(theme.accentHex), 0.5, 0.09, 0, 0.02, 0.695, root);
  ledgeLbl.rotation.x = -0.12;
  // joystick + red button on ledge
  const stick = new THREE.Group(); stick.position.set(-0.18, 0.03, 0.58); stick.rotation.x = 0.12; root.add(stick);
  mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.01, 28), M.chrome, 0, 0, 0, stick);
  mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.07, 10), M.steel, 0, 0.04, 0, stick);
  mesh(new THREE.SphereGeometry(0.02, 24, 16), M.ballRed, 0, 0.082, 0, stick);
  const btn = new THREE.Group(); btn.position.set(0.18, 0.032, 0.58); btn.rotation.x = 0.12; root.add(btn);
  mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.012, 32), M.chrome, 0, 0, 0, btn);
  mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.018, 32), M.buttonRed, 0, 0.012, 0, btn);
  // small LCD on ledge
  const lcd = mesh(new THREE.BoxGeometry(0.16, 0.07, 0.01), M.blackPlastic, 0, 0.028, 0.64, root);
  lcd.rotation.x = -0.2;
  const lcdFace = mesh(new THREE.PlaneGeometry(0.14, 0.055), new THREE.MeshStandardMaterial({ color: 0x0e1a14, emissive: 0x1a3a28, emissiveIntensity: 0.6, roughness: 0.4 }), 0, 0.03, 0.646, root, false);
  lcdFace.rotation.x = -0.2;

  // caster wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), M.wheel, sx * 0.48, -PH + 0.02, sz * 0.28 - 0.05, root, false).rotation.z = Math.PI / 2;
  }

  // ---- upper: aluminium posts + LED strips ----
  const postG = new RoundedBoxGeometry(0.04, top + 0.02, 0.04, 2, 0.005);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(postG, M.alu, sx * (hx + 0.02), top / 2, sz * (hz + 0.02), root);
  mesh(new THREE.BoxGeometry(hx * 2 + 0.08, 0.025, 0.04), M.alu, 0, 0.0, hz + 0.02, root);

  // LED rim strips along front vertical edges (chase/breathe via emissive later)
  const ledStrips: THREE.Mesh[] = [];
  const ledMat = track(M.ledStrip, 'led');
  for (const sx of [-1, 1]) {
    const strip = mesh(new THREE.BoxGeometry(0.012, top - 0.04, 0.012), ledMat, sx * (hx + 0.005), top / 2, hz + 0.008, root, false);
    ledStrips.push(strip);
  }
  // top and bottom horizontal LED
  ledStrips.push(mesh(new THREE.BoxGeometry(hx * 2 - 0.04, 0.01, 0.01), ledMat, 0, top - 0.02, hz + 0.008, root, false));
  ledStrips.push(mesh(new THREE.BoxGeometry(hx * 2 - 0.04, 0.01, 0.01), ledMat, 0, 0.02, hz + 0.008, root, false));

  // glass panes
  const smudge = new THREE.MeshBasicMaterial({ map: glassSmudge(), transparent: true, opacity: 0.14, depthWrite: false });
  const reflMat = new THREE.MeshBasicMaterial({ map: glassReflection(), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  const addPane = (w: number, x: number, z: number, ry: number, smudged: boolean) => {
    const g = new THREE.PlaneGeometry(w, top);
    const a = mesh(g, M.glassTint, x, top / 2, z, root, false); a.rotation.y = ry; a.renderOrder = 3;
    const b = mesh(g, M.glassRefl, x, top / 2, z, root, false); b.rotation.y = ry; b.renderOrder = 4;
    if (smudged) {
      const c = mesh(g, smudge, x, top / 2, z + 0.001, root, false); c.rotation.y = ry; c.renderOrder = 5;
      const r = mesh(g, reflMat, x, top / 2, z + 0.0015, root, false); r.rotation.y = ry; r.renderOrder = 6;
    }
  };
  addPane(hx * 2, 0, hz + 0.01, 0, true);
  addPane(hz * 2, -hx - 0.01, 0, -Math.PI / 2, false);
  addPane(hz * 2, hx + 0.01, 0, Math.PI / 2, false);

  // interior HAPPY GAMES banner strips (common on Gen-2)
  { const ban = labelTexture('HAPPY GAMES  ·  PAW PLAY', '#ffffff', theme.accentHex, 512, 64, 'bold 36px sans-serif');
    for (const y of [0.18, top - 0.12]) { const b = decal(ban, hx * 1.7, 0.045, 0, y, -hz + 0.01, root); (b.material as THREE.MeshStandardMaterial).emissiveMap = ban; (b.material as THREE.MeshStandardMaterial).emissive.setHex(0xffffff); (b.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4; } }
  const softHex = '#' + theme.accentSoft.toString(16).padStart(6, '0');
  const bb = backboardPrint(theme.accentHex, softHex);
  const backMesh = mesh(new THREE.PlaneGeometry(hx * 2, top), new THREE.MeshStandardMaterial({ map: bb, roughness: 0.55, emissive: 0xffffff, emissiveMap: bb, emissiveIntensity: 0.22 }), 0, top / 2, -hz - 0.002, root, false);

  // play-field floor
  const fs = new THREE.Shape();
  fs.moveTo(-hx, -hz); fs.lineTo(hx, -hz); fs.lineTo(hx, hz); fs.lineTo(HOLE.x1, hz); fs.lineTo(HOLE.x1, HOLE.z0); fs.lineTo(-hx, HOLE.z0); fs.lineTo(-hx, -hz);
  const fGeo = new THREE.ShapeGeometry(fs); fGeo.rotateX(Math.PI / 2);
  const floor = new THREE.Mesh(fGeo, new THREE.MeshStandardMaterial({ map: feltPlain(), roughness: 0.97, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide }));
  floor.receiveShadow = true; floor.position.y = 0.003; root.add(floor);

  // drop chute
  const pitW = HOLE.x1 - HOLE.x0, pitD = HOLE.z1 - HOLE.z0, pitH = 0.4;
  const pit = new THREE.Mesh(new THREE.BoxGeometry(pitW, pitH, pitD), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9, side: THREE.BackSide }));
  pit.position.set((HOLE.x0 + HOLE.x1) / 2, -pitH / 2 - 0.002, (HOLE.z0 + HOLE.z1) / 2); root.add(pit);
  const bh = 0.11;
  const b1 = mesh(new THREE.PlaneGeometry(pitW, bh), M.acrylic, (HOLE.x0 + HOLE.x1) / 2, bh / 2, HOLE.z0 - 0.004, root, false); b1.renderOrder = 2;
  const b2 = mesh(new THREE.PlaneGeometry(pitD, bh), M.acrylic, HOLE.x1 + 0.004, bh / 2, (HOLE.z0 + HOLE.z1) / 2, root, false); b2.rotation.y = Math.PI / 2; b2.renderOrder = 2;
  mesh(new THREE.BoxGeometry(pitW, 0.006, 0.006), M.alu, (HOLE.x0 + HOLE.x1) / 2, bh, HOLE.z0 - 0.004, root);
  mesh(new THREE.BoxGeometry(0.006, 0.006, pitD), M.alu, HOLE.x1 + 0.004, bh, (HOLE.z0 + HOLE.z1) / 2, root);
  decal(labelTexture('出口', '#fff', theme.accentHex, 160, 64, 'bold 40px sans-serif'), 0.07, 0.028, (HOLE.x0 + HOLE.x1) / 2, bh * 0.62, HOLE.z0 - 0.0015, root);

  // ---- header lightbox ----
  mesh(new RoundedBoxGeometry(OX * 2, 0.32, OZ * 2 - 0.04, 3, 0.02), M.body, 0, top + 0.16, 0, root);
  mesh(new THREE.BoxGeometry(OX * 2 + 0.004, 0.03, OZ * 2 - 0.036), bumpMat, 0, top + 0.01, 0, root);
  const sign = headerSign(theme.accentHex, softHex);
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.24), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.95, roughness: 0.25 }));
  signMesh.position.set(0, top + 0.17, OZ - 0.014); root.add(signMesh);

  // fluorescent tubes
  const tubeG = new THREE.CylinderGeometry(0.009, 0.009, hx * 2 - 0.1, 12); tubeG.rotateZ(Math.PI / 2);
  mesh(tubeG, M.tube, 0, top - 0.025, hz - 0.04, root, false);
  mesh(tubeG, M.tube, 0, top - 0.025, -hz + 0.06, root, false);
  mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), M.dark, 0, top - 0.002, 0, root, false).rotation.x = Math.PI / 2;

  // ---- gantry ----
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.025, hz * 2), M.alu, s * (hx - 0.012), CARRIAGE_Y + 0.035, 0, root);
  const beam = new THREE.Group(); root.add(beam);
  mesh(new THREE.BoxGeometry(hx * 2 - 0.02, 0.02, 0.028), M.alu, 0, CARRIAGE_Y + 0.025, 0, beam);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.035, 0.05), M.blackPlastic, s * (hx - 0.012), CARRIAGE_Y + 0.035, 0, beam);
  const carriage = new THREE.Group(); root.add(carriage);
  mesh(new RoundedBoxGeometry(0.075, 0.05, 0.07, 2, 0.006), M.blackPlastic, 0, CARRIAGE_Y + 0.005, 0, carriage);
  const pul = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.018, 16), M.steel, 0, CARRIAGE_Y - 0.02, 0, carriage); pul.rotation.z = Math.PI / 2;
  const cg = new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6); cg.translate(0, -0.5, 0);
  const cable = mesh(cg, M.steel, 0, 0, 0, root);

  // ---- claw (chrome, perforated hub like ref) ----
  const hub = new THREE.Group(); root.add(hub);
  mesh(new THREE.CylinderGeometry(HUB_R, HUB_R * 0.94, HUB_HH * 2, 28), M.chrome, 0, 0, 0, hub);
  mesh(new THREE.CylinderGeometry(0.014, HUB_R * 0.95, 0.034, 24), M.blackPlastic, 0, HUB_HH + 0.017, 0, hub);
  // perforated mid band
  const band = mesh(new THREE.CylinderGeometry(HUB_R * 1.02, HUB_R * 1.02, HUB_HH * 0.7, 28), M.steel, 0, -HUB_HH * 0.15, 0, hub);
  void band;
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 10), M.steel, 0, -HUB_HH - 0.004, 0, hub);
  const prongs: THREE.Object3D[] = [];
  for (const az of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]) {
    const g = new THREE.Group(); root.add(g);
    const inner = new THREE.Group(); inner.rotation.y = az; g.add(inner);
    const curve = new THREE.CatmullRomCurve3(PRONG_PTS.map(([rr, y]) => V(rr, y, 0)), false, 'centripetal');
    mesh(new THREE.TubeGeometry(curve, 28, PRONG_RADIUS, 8, false), M.chrome, 0, 0, 0, inner);
    const last = PRONG_PTS[PRONG_PTS.length - 1], prev = PRONG_PTS[PRONG_PTS.length - 2];
    const tip = mesh(new THREE.CapsuleGeometry(PRONG_RADIUS * 1.3, 0.02, 4, 10), M.rubber, (last[0] + prev[0]) / 2, (last[1] + prev[1]) / 2, 0, inner);
    tip.quaternion.setFromUnitVectors(V(0, 1, 0), V(last[0] - prev[0], last[1] - prev[1], 0).normalize());
    const pin = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), M.steel, 0, 0, 0, inner); pin.rotation.x = Math.PI / 2;
    prongs.push(g);
  }

  return {
    root, beam, carriage, cable, hub, prongs,
    doorPos: V(-0.3, -0.52, 0.5),
    ledStrips, prizeRing, themeables,
    signMesh, backMesh, ledgeLbl, doorDec, ringDec,
  };
}

/**
 * 机台「要框住的那些东西」的包围盒 —— 取景距离**按它算**，不手写数字。
 *
 * 不直接对 `root` 求包围盒：root 底下挂着整个吊爪（`hub`/`prongs`/`cable`），
 * 爪子会随游戏上下移动，包围盒跟着抖 —— 相机会在游戏过程中自己推拉，
 * 而且「爪子在最下面」时框出来的机台明显更小（实测正面 wFill 1.008 / hFill 1.543，
 * 高度溢出 1.5 倍，机台整个被裁掉一半，但**画面看着只是「有点挤」**）。
 *
 * 所以只框**静止的那部分**：柜体 + 灯箱 + 控制台 + 吊臂轨道。
 * 爪子本来就在玻璃罩里面，罩住罩子就一定罩住爪子。
 */
export function machineExtent(parts: MachineParts): { hx: number; yMin: number; yMax: number; hz: number } {
  const moving = new Set<THREE.Object3D>([parts.hub, parts.cable, ...parts.prongs])
  const b = new THREE.Box3()
  const v = new THREE.Vector3()
  parts.root.updateWorldMatrix(true, true)
  parts.root.traverse((o) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (moving.has(p)) return
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry) return
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
    const gb = m.geometry.boundingBox!
    for (const x of [gb.min.x, gb.max.x]) for (const y of [gb.min.y, gb.max.y]) for (const z of [gb.min.z, gb.max.z]) {
      b.expandByPoint(v.set(x, y, z).applyMatrix4(m.matrixWorld))
    }
  })
  // hz 用「x/z 平面里离轴最远的那个」—— 侧面机位要框的就是进深，控制台往前探的部分也算进去
  return { hx: Math.max(-b.min.x, b.max.x), yMin: b.min.y, yMax: b.max.y, hz: Math.max(-b.min.z, b.max.z) }
}

export function buildRoom(): THREE.Group {
  const room = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorTiles(), roughness: 0.4, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.0; floor.receiveShadow = true; room.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), new THREE.MeshStandardMaterial({ color: 0xf0eeea, roughness: 0.92 })); wall.position.set(0, 2, -1.6); room.add(wall);

  /*
   * 只摆一台机子 —— **没有邻居**。
   *
   * 这里原来左右各排 3 台一模一样的柜子当背景（x = ±1.3 / ±2.62 / ±3.95）。
   * 它们把侧面机位堵死了：柜子之间的空隙只有 0.14，侧视相机（x ≈ 3.3）正好落在
   * 第三台柜子**内部**，屏幕上就是一整块粉色塑料。
   * prize-park 那边侧视能用，是因为它的邻居是**透明亚克力**，从里面还能看穿；
   * 这台机子的邻居是实心白漆，看不过去。所以按「只保留一个机位」把整排撤掉，
   * 侧面才立得住。
   */
  return room;
}

export function buildEnvScene(): THREE.Scene {
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 16), new THREE.MeshStandardMaterial({ color: 0xe8e4de, side: THREE.BackSide, roughness: 1 }));
  box.position.y = 1.5; s.add(box);
  const panel = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff6ea, emissiveIntensity: 10 });
  for (let x = -6; x <= 6; x += 2.4) for (let z = -6; z <= 6; z += 2.4) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.35), panel); p.rotation.x = Math.PI / 2; p.position.set(x, 3.95, z); s.add(p); }
  const shop = (c: number, x: number, z: number, ry: number, w = 3, i = 1.8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i })); m.position.set(x, 1.2, z); m.rotation.y = ry; s.add(m); };
  shop(0xfff0f5, 0, 7.9, Math.PI, 6, 2.4); shop(0xffe8a0, -7.9, 2, Math.PI / 2); shop(0xb8f0f6, 7.9, -1, -Math.PI / 2); shop(0xf47aa8, 3, 7.9, Math.PI, 1.5, 1.6);
  s.add(new THREE.HemisphereLight(0xfff5f0, 0xb0a898, 0.7));
  return s;
}
