import * as THREE from 'three';
import { mountDisplay } from '@makeplay/display';
import { loadSoundSystem } from '@makeplay/sound';
                                                           
import { t, setLang, getLang, pickLang, onLangChange,                        } from './i18n.js';
import { buildItem, buildDecor, buildNest, ITEM_DEFS, mat, GLB_URLS, registerGlb,                               } from './world/props.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLensTree, createLensThreeBridge } from './src/lens/lens.js';
import { createThreeFx } from '@makeplay/fx';
import { createBiteMask, eatTo, biteSpot, isAlive, surfaceAt,               } from './world/bites.js';

// ======================= config =======================
const FIELD_W = 9.2; // x extent of playfield
const FIELD_D = 14.4; // z extent
const NEST_POS = new THREE.Vector3(2.85, 0, -5.4);
const HOLE = new THREE.Vector3(2.68, 0, -4.45);
const MAX_ANTS = 200;
const BASE_ANTS = 5;
const BASE_SPEED = 0.85;

                      
                                                                                                         
 
const THEMES               = [
  { key: 'w_garden', ground: '#bcd170', decor: ['tuft', 'tuft', 'pebble', 'clover'], items: ['leaf', 'apple', 'lollipop', 'daisy', 'leaf'] },
  { key: 'w_picnic', ground: '#b3cc6c', blanket: true, decor: ['tuft', 'pebble', 'clover'], items: ['watermelon', 'croissant', 'sandwich', 'strawberry', 'sugar', 'cookie', 'grapes'] },
  { key: 'w_kitchen', ground: '#e8d5c2', tiles: true, decor: [], items: ['cupcake', 'cheese', 'pretzel', 'donut', 'banana', 'cookie', 'candy'] },
  { key: 'w_beach', ground: '#f0cf96', decor: ['shell', 'pebble', 'shell'], items: ['icecream', 'watermelon', 'pretzel', 'candy', 'lollipop', 'grapes', 'strawberry'] },
  { key: 'w_forest', ground: '#d2be6c', decor: ['mushroom', 'twig', 'tuft', 'pebble'], items: ['acorn', 'maple', 'apple', 'acorn', 'donut', 'banana', 'leaf'] },
];
const HP_SCALE = 1.5; // trips per item (halved on user request)
const hpMult = (w        ) => HP_SCALE * Math.pow(1.85, w);
// User-set: every unit hauled in world 1 pays exactly 1; later worlds grow gently (×1.3 per world)
const VALUE_GROWTH = 1.3;
const valMult = (w        ) => Math.pow(VALUE_GROWTH, w);
// per-kind payout: an item's own worth (2-4) scales the pay, so the haul is not flat
const PER_UNIT = 0.35;

                                              
const UPS                                                               = {
  speed: { base: 20, growth: 1.42, max: 30 },
  workers: { base: 25, growth: 1.38, max: 60 },
  strength: { base: 150, growth: 2.1, max: 20 },
};
                                               
const SPECS                                                                                                                                            = {
  soldier: { base: 600, growth: 2.3, max: 5, color: '#e0503c', speed: 1.8, carry: 1, value: 1, scale: 1.1 },
  strong: { base: 1500, growth: 2.4, max: 5, color: '#7a4a2a', speed: 0.85, carry: 3, value: 1, scale: 1.35 },
  golden: { base: 4000, growth: 2.5, max: 5, color: '#f2c230', speed: 1.1, carry: 1, value: 3, scale: 1.05 },
};
const upCost = (k       , lv        ) => Math.round(UPS[k].base * Math.pow(UPS[k].growth, lv));
const specCost = (k         , n        ) => Math.round(SPECS[k].base * Math.pow(SPECS[k].growth, n));

// ======================= state & save =======================
                    
                                                                                               
                                                                                                                           
 
const S           = {
  v: 1, money: 0, world: 0, lv: { speed: 0, workers: 0, strength: 0 }, spec: { soldier: 0, strong: 0, golden: 0 },
  items: null, rate: 0, lastSeen: Date.now(), lang: null, music: true, sfx: true, hinted: false,
};
function loadSave() {
  try {
    const d = window.gp?.player?.saves?.latestSync;
    const info = window.gp?.player?.saves?.latestInfo;
    if (!d || info?.legacy || typeof d !== 'object' || d.v !== 1) return false;
    S.money = Number(d.money) || 0;
    S.world = Math.max(0, Math.floor(Number(d.world) || 0));
    for (const k of Object.keys(S.lv)           ) S.lv[k] = Math.max(0, Math.min(UPS[k].max, Math.floor(Number(d.lv?.[k]) || 0)));
    for (const k of Object.keys(S.spec)             ) S.spec[k] = Math.max(0, Math.min(SPECS[k].max, Math.floor(Number(d.spec?.[k]) || 0)));
    S.items = Array.isArray(d.items) ? d.items.map((x         ) => Math.max(0, Number(x) || 0)) : null;
    S.rate = Number(d.rate) || 0;
    S.lastSeen = Number(d.lastSeen) || Date.now();
    S.lang = d.lang === 'zh' || d.lang === 'en' || d.lang === 'ja' ? d.lang : null;
    S.music = d.music !== false; S.sfx = d.sfx !== false; S.hinted = !!d.hinted;
    return true;
  } catch { return false; }
}
let dirty = false;
function save() {
  S.items = items.map((it) => Math.round(it.hp * 1000) / 1000);
  S.lastSeen = Date.now();
  window.gp?.player?.saves?.putLatest({ ...S });
  dirty = false;
}
const hadSave = loadSave();
const offlineElapsed = hadSave ? (Date.now() - S.lastSeen) / 1000 : 0;

// ======================= renderer / scene =======================
const host = document.getElementById('app') ;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = 'none';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 300);
scene.add(new THREE.HemisphereLight(0xfff0dc, 0xa58fc0, 1.6));
const sun = new THREE.DirectionalLight(0xffcf9a, 2.1);
sun.position.set(-7, 12, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0008;
sun.shadow.radius = 4;
scene.add(sun);
scene.add(sun.target);

const groundMat = new THREE.MeshStandardMaterial({ color: '#a9bf5e', roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// faceted low-poly ground: jittered triangle grid with per-face colour variation
function buildFacetGround(base        , r              ) {
  const geo = new THREE.PlaneGeometry(64, 52, 42, 34);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position                         ;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (Math.abs(x) > 31.9 || Math.abs(z) > 25.9) continue;
    p.setXYZ(i, x + (r() - 0.5) * 1.0, 0, z + (r() - 0.5) * 1.0);
  }
  const ng = geo.toNonIndexed();
  geo.dispose();
  const n = ng.attributes.position.count;
  const cols = new Float32Array(n * 3);
  const c = new THREE.Color(base), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const tmp = new THREE.Color();
  for (let f = 0; f < n; f += 3) {
    tmp.setHSL(hsl.h + (r() - 0.5) * 0.025, hsl.s * (0.9 + r() * 0.15), Math.min(0.95, hsl.l * (0.9 + r() * 0.17)));
    for (let k = 0; k < 3; k++) { cols[(f + k) * 3] = tmp.r; cols[(f + k) * 3 + 1] = tmp.g; cols[(f + k) * 3 + 2] = tmp.b; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  ng.computeVertexNormals();
  const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.position.y = 0.002;
  m.receiveShadow = true;
  return m;
}

const nest = buildNest();
nest.position.copy(NEST_POS);
nest.traverse((o) => { if ((o              ).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(nest);

let worldGroup = new THREE.Group();
scene.add(worldGroup);

function rng(seed        ) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function checkerTex(a        , b        , n        ) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d') ;
  const s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function tileTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') ;
  g.fillStyle = '#d8ebf3'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8f4f9'; g.fillRect(4, 4, 120, 120);
  g.fillStyle = '#c3dce8'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 0, 4, 128);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(150, 150);
  return tx;
}
let tileTexture                       = null;

// ======================= items =======================
                
                                                                                                      
                                                                                                                                                                      
 
let items         = [];
let worldDone = false;

// ======================= Scene Lens =======================
const lensTree = createLensTree({ id: 'ant-haul', label: 'Ant Haul' });
const lensNest = lensTree.entity({ id: 'nest', label: 'Ant nest', summary: 'Sand mound where ants deposit goods', parts: [{ id: 'body' }] });
lensNest.bind({ parts: { body: { provideRoot: () => nest } }, providers: { inspect: () => ({ position: [NEST_POS.x, 0, NEST_POS.z] }) } });
const lensItems = lensTree.collection({ id: 'items', label: 'Haulable items', summary: 'Food and objects ants carry home', parts: [{ id: 'mesh' }] });
const lensAnts = lensTree.entity({ id: 'ants', label: 'Ant colony', summary: 'All instanced ants', parts: [{ id: 'mesh' }] });

function buildWorld(w        , savedHp                 ) {
  for (const it of items) it.lease?.dispose();
  scene.remove(worldGroup);
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
  focusIdx = -1;
  const th = THEMES[w % THEMES.length];
  const r = rng(1000 + w * 7919);
  groundMat.color.set(th.ground);
  groundMat.map = null;
  groundMat.needsUpdate = true;
  renderer.setClearColor(th.ground);
  worldGroup.add(buildFacetGround(th.ground, r));
  if (th.blanket) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W + 0.6, 0.03, FIELD_D + 0.4), [
      mat('#f4f0e8'), mat('#f4f0e8'), new THREE.MeshStandardMaterial({ map: checkerTex('#e2725b', '#fbf0e0', 8), roughness: 0.95 }), mat('#f4f0e8'), mat('#f4f0e8'), mat('#f4f0e8'),
    ]);
    bl.position.set(-0.3, 0.015, 0.4);
    bl.receiveShadow = true;
    worldGroup.add(bl);
  }
  // items placement
  function footprintRadius(o                ) {
    o.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let m = 0.2;
    o.traverse((c) => {
      const me = c              ;
      if (!me.isMesh) return;
      const pos = me.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(me.matrixWorld);
        const d = Math.hypot(v.x, v.z);
        if (d > m) m = d;
      }
    });
    return m;
  }
  // convex hull of the item's vertices projected on XZ (item at origin, unrotated, unit scale)
  function hullXZ(o                )                     {
    o.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const pts                     = [];
    o.traverse((c) => {
      const me = c              ;
      if (!me.isMesh) return;
      const pos = me.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 1500));
      for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(me.matrixWorld); pts.push([v.x, v.z]); }
    });
    if (pts.length < 3) return [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o2          , a          , b          ) => (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]);
    const lo                     = [], up                     = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }
  // distance from a point to a convex polygon: 0 inside, else distance to the nearest edge
  function polyDist(poly                    , px        , pz        ) {
    let inside = true, best = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const ex = bx - ax, ez = bz - az;
      if (ex * (pz - az) - ez * (px - ax) < 0) inside = false;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez || 1)));
      best = Math.min(best, Math.hypot(px - (ax + ex * t), pz - (az + ez * t)));
    }
    return inside ? 0 : best;
  }
  // early worlds are sparse: 1 item in world 1, 2 in world 2, +1 per world until the full theme set
  const kinds = th.items.slice(0, Math.min(th.items.length, 1 + w));
  const extra = Math.min(3, Math.floor(w / THEMES.length));
  for (let i = 0; i < extra; i++) kinds.push(th.items[i % th.items.length]);
  if (kinds.length > 8) kinds.length = 8; // keep the field readable
  const placed                                        = [];
  items = [];
  const sizeK = Math.min(1.9, 1.45 + w * 0.05);
  // ---- non-overlapping placement on an occupancy grid using each item's real (rotated) XZ outline ----
  const objs = kinds.map((k) => buildItem(k));
  const hulls = objs.map((o) => hullXZ(o));
  const feet = objs.map((o) => footprintRadius(o));
  const order = kinds.map((_, i) => i).sort((a, b) => feet[b] - feet[a]);
  const GC = 0.12, GW = Math.ceil(FIELD_W / GC), GD = Math.ceil(FIELD_D / GC);
  const MARGIN = 0.38; // each side → ~0.76 walking gap between items
  const poses                                                     = [];
  let s = sizeK;
  for (let attempt = 0; attempt < 10; attempt++) {
    const grid = new Uint8Array(GW * GD);
    for (let gx = 0; gx < GW; gx++) for (let gz = 0; gz < GD; gz++) {
      const cx = -FIELD_W / 2 + (gx + 0.5) * GC, cz = -FIELD_D / 2 + (gz + 0.5) * GC;
      if (Math.hypot(cx - NEST_POS.x, cz - NEST_POS.z) < 2.7) grid[gx * GD + gz] = 1; // nest keep-out
    }
    let allOk = true;
    for (const i of order) {
      let ok = false;
      for (let tries = 0; tries < 260 && !ok; tries++) {
        const rot = r() * Math.PI * 2;
        const c = Math.cos(rot), sn = Math.sin(rot);
        // three.js rotation.y maps local (x,z) → (x c + z s, -x s + z c)
        const poly = hulls[i].map(([hx, hz]) => [(hx * c + hz * sn) * s, (-hx * sn + hz * c) * s]                    );
        let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
        for (const [px, pz] of poly) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz); }
        const spanX = FIELD_W - (maxX - minX) - 0.3, spanZ = FIELD_D - (maxZ - minZ) - 0.3;
        if (spanX <= 0 || spanZ <= 0) break;
        const x = -FIELD_W / 2 + 0.15 - minX + r() * spanX;
        const z = -FIELD_D / 2 + 0.15 - minZ + r() * spanZ;
        const cells           = [];
        let clash = false;
        const gx0 = Math.max(0, Math.floor((x + minX - MARGIN + FIELD_W / 2) / GC)), gx1 = Math.min(GW - 1, Math.floor((x + maxX + MARGIN + FIELD_W / 2) / GC));
        const gz0 = Math.max(0, Math.floor((z + minZ - MARGIN + FIELD_D / 2) / GC)), gz1 = Math.min(GD - 1, Math.floor((z + maxZ + MARGIN + FIELD_D / 2) / GC));
        for (let gx = gx0; gx <= gx1 && !clash; gx++) for (let gz = gz0; gz <= gz1; gz++) {
          const cx = -FIELD_W / 2 + (gx + 0.5) * GC - x, cz = -FIELD_D / 2 + (gz + 0.5) * GC - z;
          if (polyDist(poly, cx, cz) > MARGIN) continue;
          if (grid[gx * GD + gz]) { clash = true; break; }
          cells.push(gx * GD + gz);
        }
        if (clash) continue;
        for (const k of cells) grid[k] = 1;
        poses[i] = { x, z, rot, s };
        ok = true;
      }
      if (!ok) { allOk = false; break; }
    }
    if (allOk) break;
    s *= 0.92; // crowded: shrink every item of this world a little and re-pack
    poses.length = 0;
  }
  kinds.forEach((kind, idx) => {
    const def = ITEM_DEFS[kind];
    const obj = objs[idx];
    const pose = poses[idx] ?? { x: (r() - 0.5) * FIELD_W * 0.8, z: (r() - 0.5) * FIELD_D * 0.8, rot: 0, s };
    const x = pose.x, z = pose.z, scaleK = pose.s;
    const rad = feet[idx] * scaleK;
    placed.push({ x, z, r: rad });
    obj.position.set(x, 0, z);
    obj.rotation.y = pose.rot;
    obj.scale.setScalar(scaleK);
    worldGroup.add(obj);
    obj.updateMatrixWorld(true);
    const mask = createBiteMask(obj, new THREE.Color(def.inner ?? def.chunk));
    const maxHp = Math.round(def.hp * hpMult(w));
    let hp = maxHp;
    if (savedHp && savedHp.length === kinds.length) hp = Math.min(maxHp, savedHp[idx]);
    const it       = {
      kind, obj, x, z, maxHp, hp, reserved: 0, value: def.value * PER_UNIT * valMult(w), radius: rad, baseScale: scaleK, cur: scaleK, wob: 0,
      gone: hp <= 0, color: new THREE.Color(def.chunk), lease: null, mask,
    };
    if (hp < maxHp) eatTo(mask, 1 - hp / maxHp, HOLE.x, HOLE.z);
    obj.visible = !it.gone;
    obj.userData.itemIdx = idx;
    it.lease = lensItems.mount({ instanceRef: 'item-' + idx, parts: { mesh: { provideRoot: () => (it.gone ? null : obj) } }, providers: { inspect: () => ({ kind, hp: Math.round(it.hp), maxHp, position: [+x.toFixed(2), 0, +z.toFixed(2)] }), visible: () => !it.gone } });
    items.push(it);
  });
  // decor
  const nDecor = th.decor.length ? 90 : 0;
  for (let i = 0; i < nDecor; i++) {
    const x = (r() - 0.5) * 34, z = (r() - 0.5) * 26;
    const inField = Math.abs(x) < FIELD_W / 2 + 0.3 && Math.abs(z) < FIELD_D / 2 + 0.3;
    if (inField && r() < 0.55) continue;
    if (th.blanket && inField) continue;
    if (Math.hypot(x - NEST_POS.x, z - NEST_POS.z) < 2) continue;
    if (Math.hypot(x - HOLE.x, z - HOLE.z) < 2.2) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + 0.6)) continue;
    const d = buildDecor(th.decor[Math.floor(r() * th.decor.length)], r);
    d.position.set(x, 0, z);
    d.rotation.y = r() * Math.PI * 2;
    const s = 0.8 + r() * 0.6;
    d.scale.setScalar(s);
    worldGroup.add(d);
  }
  worldDone = false;
  // reset ants to the nest
  for (const a of ants) { a.state = 0; a.item = -1; a.carry = 0; a.reserve = 0; }
}
function curScale(it      ) {
  return it.baseScale;
}

// ======================= ants =======================
;              
                                                                                                                         
                                                                                                                  
                                                                                            
 
const ants        = [];
const antMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, flatShading: true });
const sphereGeo = new THREE.SphereGeometry(1, 12, 9);
const legGeo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0);
const chunkGeo = new THREE.DodecahedronGeometry(1, 0);
const bodyIM = new THREE.InstancedMesh(sphereGeo, antMat, MAX_ANTS * 3);
const legIM = new THREE.InstancedMesh(legGeo, antMat, MAX_ANTS * 8);
const chunkIM = new THREE.InstancedMesh(chunkGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), MAX_ANTS);
for (const im of [bodyIM, legIM, chunkIM]) { im.castShadow = true; im.frustumCulled = false; im.count = 0; scene.add(im); }
lensAnts.bind({ parts: { mesh: { provideRoot: () => bodyIM } }, providers: { inspect: () => ({ count: ants.length, position: [HOLE.x, 0, HOLE.z] }) } });

const WORKER_COLOR = new THREE.Color('#2c2742');
function antTarget() {
  return BASE_ANTS + S.lv.workers;
}
function syncAnts() {
  const want           = [];
  for (let i = 0; i < antTarget(); i++) want.push(0);
  (['soldier', 'strong', 'golden']             ).forEach((k, idx) => { for (let i = 0; i < S.spec[k]; i++) want.push(idx + 1); });
  const total = Math.min(MAX_ANTS, want.length);
  // count existing by type
  const have = [0, 0, 0, 0];
  for (const a of ants) have[a.type]++;
  const need = [0, 0, 0, 0];
  for (let i = 0; i < total; i++) need[want[i]]++;
  for (let type = 0; type < 4; type++) {
    while (have[type] < need[type]) { ants.push(makeAnt(type)); have[type]++; }
  }
}
function makeAnt(type        )      {
  const spec = type === 0 ? null : SPECS[(['soldier', 'strong', 'golden']             )[type - 1]];
  return {
    x: HOLE.x + (Math.random() - 0.5) * 0.3, z: HOLE.z + Math.random() * 0.3, yaw: Math.random() * 6.28, state: 0, item: -1, tx: 0, tz: 0,
    carry: 0, reserve: 0, timer: Math.random() * 0.6, phase: Math.random() * 6.28, type,
    speedMul: spec ? spec.speed : 1, carryMul: spec ? spec.carry : 1, valueMul: spec ? spec.value : 1, scale: spec ? spec.scale : 1,
    color: spec ? new THREE.Color(spec.color) : WORKER_COLOR, chunk: new THREE.Color(), wobble: (Math.random() - 0.5) * 0.5, bx: 0, bz: 0, y: 0,
  };
}
const headReach = (a     ) => 0.21 * a.scale;
const antSpeed = () => BASE_SPEED * (1 + 0.1 * S.lv.speed);
const antCarry = () => 1 + 0.5 * S.lv.strength;

function pickItem(a     )         {
  if (focusIdx >= 0) {
    const f = items[focusIdx];
    if (f && !f.gone && f.hp - f.reserved > 0.001) return focusIdx;
    focusIdx = -1;
  }
  let best = -1, bs = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.gone || it.hp - it.reserved <= 0.001) continue;
    const d = Math.hypot(it.x - a.x, it.z - a.z) + Math.hypot(it.x - HOLE.x, it.z - HOLE.z) * 0.6;
    const sc = d * (0.75 + Math.random() * 0.5);
    if (sc < bs) { bs = sc; best = i; }
  }
  return best;
}
function assign(a     ) {
  const i = pickItem(a);
  if (i < 0) {
    a.state = 0; a.item = -1;
    const ang = Math.random() * 6.28, rr = 0.6 + Math.random() * 1.3;
    a.tx = HOLE.x + Math.cos(ang) * rr; a.tz = HOLE.z + 0.6 + Math.abs(Math.sin(ang)) * rr;
    a.timer = 0.6 + Math.random();
    return;
  }
  const it = items[i];
  const want = antCarry() * a.carryMul;
  a.reserve = Math.min(want, it.hp - it.reserved);
  it.reserved += a.reserve;
  a.item = i; a.state = 1;
  const spot = biteSpot(it.mask, a.x, a.z, headReach(a));
  if (spot) { a.bx = spot.bx; a.bz = spot.bz; a.tx = spot.sx; a.tz = spot.sz; }
  else { a.bx = it.x; a.bz = it.z; a.tx = it.x + 0.3; a.tz = it.z; }
}

let boost = 0;
// the item the player tapped: ants drop what they are doing and go for it until it is eaten
let focusIdx = -1;
function setFocus(i        , withFx         ) {
  if (i === focusIdx) return;
  focusIdx = i;
  for (const a of ants) {
    if (a.item >= 0) { const it = items[a.item]; if (it) it.reserved = Math.max(0, it.reserved - a.reserve); }
    a.reserve = 0;
    if (a.state === 1) { a.state = 0; a.timer = 0; } // biting ants finish their bite first
  }
  if (withFx && i >= 0) {
    const it = items[i];
    spawnRipple(it.x, it.z);
    spawnFloat('+' + fmt(it.value) + t('perUnit'), 0.55, it);
    playCueSafe('ui.tap');
  }
}
let pendingMoney = 0;
let earnedThisSec = 0;
function moneyGain(v        ) {
  S.money += v; pendingMoney += v; earnedThisSec += v; dirty = true;
}

function stepAnts(dt        ) {
  const spBase = antSpeed() * (boost > 0 ? 1.8 : 1);
  for (const a of ants) {
    const own = a.item >= 0 ? items[a.item] : null;
    const gy = own && !own.gone ? surfaceAt(own.mask, a.x, a.z) : 0;
    a.y += (gy - a.y) * Math.min(1, dt * 12);
    if (a.state === 2) { // biting
      a.timer -= dt;
      a.phase += dt * 6;
      if (a.timer <= 0) {
        const it = items[a.item];
        const got = Math.min(a.reserve, Math.max(0, it.hp));
        it.hp -= got; it.reserved = Math.max(0, it.reserved - a.reserve);
        a.carry = got; a.reserve = 0;
        a.chunk.copy(it.color);
        it.wob = 1;
        eatTo(it.mask, 1 - Math.max(0, it.hp) / it.maxHp, a.bx, a.bz);
        if (it.hp <= 0.0001 && !it.gone) { it.hp = 0; itemEaten(it); }
        a.state = 3;
        a.tx = HOLE.x + (Math.random() - 0.5) * 0.35; a.tz = HOLE.z + (Math.random() - 0.5) * 0.2;
        dirty = true;
      }
      continue;
    }
    if (a.state === 0) {
      // idle near nest; periodically look for work
      a.timer -= dt;
      if (a.timer <= 0) { assign(a); if (a.state === 0) a.timer = 0.8 + Math.random(); }
    }
    const dx = a.tx - a.x, dz = a.tz - a.z;
    const d = Math.hypot(dx, dz);
    const sp = (a.state === 0 ? 0.5 : 1) * spBase * a.speedMul * (a.state === 3 ? 0.9 : 1);
    if (d < 0.06 || (a.state === 0 && d < 0.2)) {
      if (a.state === 1) {
        const it = items[a.item];
        if (!it || it.gone) { if (it) it.reserved = Math.max(0, it.reserved - a.reserve); a.reserve = 0; assign(a); continue; }
        if (!isAlive(it.mask, a.bx, a.bz)) {
          // the spot was eaten by someone else on the way: walk to the nearest remaining material
          const sp2 = biteSpot(it.mask, a.x, a.z, headReach(a));
          if (!sp2) { it.reserved = Math.max(0, it.reserved - a.reserve); a.reserve = 0; assign(a); continue; }
          a.bx = sp2.bx; a.bz = sp2.bz; a.tx = sp2.sx; a.tz = sp2.sz;
          continue;
        }
        a.state = 2; a.timer = 0.6; a.yaw = Math.atan2(-(a.bz - a.z), a.bx - a.x);
      }
      else if (a.state === 3) {
        const it = items[a.item];
        if (a.carry > 0 && it) moneyGain(a.carry * it.value * a.valueMul);
        a.carry = 0; a.item = -1;
        assign(a);
      } else if (a.state === 0) {
        const ang = Math.random() * 6.28, rr = 0.6 + Math.random() * 1.3;
        a.tx = HOLE.x + Math.cos(ang) * rr; a.tz = HOLE.z + 0.6 + Math.abs(Math.sin(ang)) * rr;
      }
      continue;
    }
    const step = Math.min(d, sp * dt);
    // slight weave so trails look organic
    const nx = dx / d, nz = dz / d;
    const weave = Math.sin(a.phase * 0.12 + a.wobble * 10) * 0.25 * Math.min(1, d);
    const mx = nx - nz * weave, mz = nz + nx * weave;
    const ml = Math.hypot(mx, mz);
    a.x += (mx / ml) * step; a.z += (mz / ml) * step;
    const targetYaw = Math.atan2(-mz, mx);
    let dy = targetYaw - a.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    a.yaw += dy * Math.min(1, dt * 14);
    a.phase += step * 26 / a.scale;
  }
}

// instancing
const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
function local(x        , y        , z        , ry        , rz        , sx        , sy        , sz        ) {
  _e.set(0, ry, rz, 'YZX');
  _q.setFromEuler(_e);
  _p.set(x, y, z); _s.set(sx, sy, sz);
  return _l.compose(_p, _q, _s);
}
const GOLD_EMISSIVE = new THREE.Color('#ffe9a0');
function renderAnts() {
  let bi = 0, li = 0, ci = 0;
  for (const a of ants) {
    const bob = Math.abs(Math.sin(a.phase)) * 0.012;
    _e.set(0, a.yaw, 0); _q.setFromEuler(_e);
    _p.set(a.x, a.y + bob, a.z); _s.setScalar(a.scale * 0.9);
    _b.compose(_p, _q, _s);
    const col = a.color;
    // abdomen, thorax, head
    _m.multiplyMatrices(_b, local(-0.16, 0.13, 0, 0, 0.12, 0.15, 0.115, 0.12)); bodyIM.setMatrixAt(bi, _m); bodyIM.setColorAt(bi++, col);
    _m.multiplyMatrices(_b, local(0.02, 0.12, 0, 0, 0, 0.075, 0.065, 0.065)); bodyIM.setMatrixAt(bi, _m); bodyIM.setColorAt(bi++, col);
    _m.multiplyMatrices(_b, local(0.15, 0.14, 0, 0, 0, 0.085, 0.08, 0.085)); bodyIM.setMatrixAt(bi, _m); bodyIM.setColorAt(bi++, col);
    // legs
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        const group = (s === 1 ? i % 2 === 0 : i === 1) ? 0 : Math.PI;
        const sw = Math.sin(a.phase + group);
        const lift = Math.max(0, Math.cos(a.phase + group)) * 0.3;
        const yaw = s * (Math.PI / 2 - (1 - i) * 0.65) + sw * 0.32;
        _m.multiplyMatrices(_b, local(-0.03 + i * 0.05, 0.11, 0, yaw, -0.62 + lift, 0.21, 0.022, 0.022));
        legIM.setMatrixAt(li, _m); legIM.setColorAt(li++, col);
      }
      // antenna
      _m.multiplyMatrices(_b, local(0.2, 0.18, s * 0.03, -s * 0.45, 0.7 + Math.sin(a.phase * 0.5) * 0.08, 0.15, 0.016, 0.016));
      legIM.setMatrixAt(li, _m); legIM.setColorAt(li++, col);
    }
    if (a.carry > 0) {
      const cs = 0.09 * Math.min(2.4, 0.85 + 0.22 * Math.sqrt(a.carry / Math.max(1, ITEM_SCALE_HINT)));
      _m.multiplyMatrices(_b, local(0.08, 0.3, 0, a.phase * 0.05, 0.3, cs * 1.3, cs * 0.75, cs));
      chunkIM.setMatrixAt(ci, _m); chunkIM.setColorAt(ci++, a.chunk);
    }
  }
  bodyIM.count = bi; legIM.count = li; chunkIM.count = ci;
  bodyIM.instanceMatrix.needsUpdate = true; legIM.instanceMatrix.needsUpdate = true; chunkIM.instanceMatrix.needsUpdate = true;
  if (bodyIM.instanceColor) bodyIM.instanceColor.needsUpdate = true;
  if (legIM.instanceColor) legIM.instanceColor.needsUpdate = true;
  if (chunkIM.instanceColor) chunkIM.instanceColor.needsUpdate = true;
}
const ITEM_SCALE_HINT = 1;
void GOLD_EMISSIVE;

// ======================= effects (MakePlay FX) =======================
                                                     
let fx             = null;
function fxPlay(id                                                                 , x        , y        , z        , scale = 1) {
  if (!fx) return;
  try { fx.play(id, { pos: { x, y, z }, scale }); } catch { /* ignore */ }
}
function itemEaten(it      ) {
  it.gone = true;
  fxPlay('confetti-burst', it.x, 0.4, it.z, 1.2);
  playCueSafe('item.eaten');
}
function spawnRipple(x        , z        ) {
  fxPlay('shockwave-ring', x, 0.05, z, 0.8);
}
function stepFx(dt        ) {
  for (const it of items) {
    const target = curScale(it);
    it.cur += (target - it.cur) * Math.min(1, dt * 6);
    it.wob = Math.max(0, it.wob - dt * 4);
    const w = Math.sin(it.wob * 12) * 0.035 * it.wob;
    it.obj.scale.set(it.cur, it.cur * (1 - w), it.cur);
    if (it.gone) it.obj.visible = false;
  }
  if (focusIdx >= 0) {
    const f = items[focusIdx];
    if (!f || f.gone) focusIdx = -1; // the target is gone: ants go back to choosing for themselves
  }
}
// ======================= camera fit =======================
const camTarget = new THREE.Vector3();
const TILT = 0.7;
let viewW = 390, viewH = 844;
function placeCam(d        , tz        ) {
  camTarget.set(0, 0, tz);
  camera.position.set(0, Math.cos(TILT) * d, tz + Math.sin(TILT) * d);
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();
}
const corners = [[-FIELD_W / 2, -FIELD_D / 2], [FIELD_W / 2, -FIELD_D / 2], [-FIELD_W / 2, FIELD_D / 2], [FIELD_W / 2, FIELD_D / 2], [NEST_POS.x, NEST_POS.z - 1.0]];
const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tap = new THREE.Vector2();
function bounds() {
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const [x, z] of corners) {
    _v.set(x, 0, z).project(camera);
    x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
  }
  return { x0, x1, y0, y1 };
}
function fitCamera() {
  const w = viewW, h = viewH;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const topEl = document.querySelector('.top')                      ;
  const cardEl = document.querySelector('.cards')                      ;
  const topPx = topEl ? topEl.getBoundingClientRect().bottom - 30 : 90;
  const botPx = cardEl ? h - cardEl.getBoundingClientRect().top - 20 : 180;
  const yT = 1 - (2 * topPx) / h, yB = -1 + (2 * botPx) / h;
  let tz = 0, d = 20;
  for (let it = 0; it < 4; it++) {
    let lo = 3, hi = 150;
    for (let k = 0; k < 26; k++) {
      d = (lo + hi) / 2;
      placeCam(d, tz);
      const b = bounds();
      const ok = b.x0 >= -1.02 && b.x1 <= 1.02 && b.y1 - b.y0 <= yT - yB;
      if (ok) hi = d; else lo = d;
    }
    d = hi;
    placeCam(d, tz);
    const b = bounds();
    const mid = (b.y0 + b.y1) / 2, want = (yT + yB) / 2;
    tz -= (mid - want) * (FIELD_D / Math.max(0.2, b.y1 - b.y0)) * 0.9;
  }
  placeCam(d, tz);
  sun.target.position.set(0, 0, tz);
  sun.position.set(-7, 12, tz + 5);
}

// ======================= UI =======================
// small amounts keep their decimals (a 0.7-per-unit haul must not read as "+0"), big ones use K/M
const fmt = (n        ) => {
  if (n < 1000) {
    if (n < 10 && n !== Math.floor(n)) return n.toFixed(1).replace(/\.0$/, '');
    return String(Math.floor(n));
  }
  const units = ['K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af'];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1') + units[u];
};

const css = `
:root{--navy:#1f3a5f;--font:'Nunito','Baloo 2','Arial Rounded MT Bold','PingFang SC','Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans CJK SC','Noto Sans JP','Microsoft YaHei',system-ui,sans-serif}
#ui{position:fixed;inset:0;pointer-events:none;font-family:var(--font);color:var(--navy);user-select:none;-webkit-user-select:none}
#col{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:min(100%,560px)}
#ui button{font-family:var(--font);pointer-events:auto;cursor:pointer;border:none;-webkit-tap-highlight-color:transparent}
.top{position:absolute;left:16px;right:16px;top:max(14px,env(safe-area-inset-top));display:flex;gap:8px;align-items:center}
.pill{background:#fff;border-radius:999px;box-shadow:0 4px 0 rgba(31,58,95,.18),0 6px 14px rgba(0,0,0,.08);display:flex;align-items:center;height:52px;padding:0 12px 0 6px;gap:6px;font-weight:900}
.pill img{width:40px;height:40px;object-fit:contain;flex:none}
.pill .num{font-size:22px;white-space:nowrap}
.pill.money .num{font-size:20px;letter-spacing:-0.5px}
.pill.money img{width:30px;height:30px}
.pill.money{flex:1.1 1 0;min-width:0;padding-right:8px}
.pill.ants{flex:0.8 1 0;min-width:0;justify-content:space-between}
.pill.world{flex:1.5 1 0;min-width:0;background:linear-gradient(#e9f7ff,#cdeeff);border:2px solid #9fd8f7;padding-right:12px}
.wcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.wlabel{font-size:14px;color:#fff;-webkit-text-stroke:0;text-shadow:0 1px 0 #2b7fc0,0 -1px 0 #2b7fc0,1px 0 0 #2b7fc0,-1px 0 0 #2b7fc0,0 2px 0 #2b7fc0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.bar{height:12px;border-radius:8px;background:#fff;box-shadow:inset 0 1px 2px rgba(0,0,0,.15);overflow:hidden}
.fill{height:100%;width:0;background:linear-gradient(#5ec0ff,#2f86e0);border-radius:8px;transition:width .25s}
.wname{position:absolute;top:calc(max(14px,env(safe-area-inset-top)) + 60px);left:50%;transform:translateX(-50%);font-size:14px;font-weight:900;color:#fff;background:rgba(31,58,95,.55);padding:5px 12px;border-radius:999px;white-space:nowrap}
.side{position:absolute;top:calc(max(14px,env(safe-area-inset-top)) + 64px);width:72px;height:76px;border-radius:18px;background:linear-gradient(#53a8f5,#2a74d6);box-shadow:0 4px 0 #1b4f9c,0 6px 12px rgba(0,0,0,.15);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px;padding:4px}
.side img{width:44px;height:44px;object-fit:contain}
#shopBtn{left:16px}
#rankBtn{left:16px;top:calc(max(14px,env(safe-area-inset-top)) + 152px)}
.side span{max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.rlist{margin:4px 14px 0;max-height:min(46vh,420px);overflow-y:auto}
.rrow{display:flex;align-items:center;gap:10px;padding:8px 10px;margin:6px 0;background:#f4e6cf;border-radius:14px;text-align:left;font-weight:900}
.rrow.me{background:#ffd9b8;box-shadow:inset 0 0 0 2px #e2725b}
.rno{width:30px;text-align:center;font-size:18px;color:#c75a43;flex:none}
.rav{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#e9d6bb;flex:none}
.rname{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px;color:#4a3550}
.rsc{flex:none;font-size:15px;color:#4a3550}
.rmine{margin:10px 14px 0;font-weight:900;color:#4a3550;font-size:16px}
.rnote{margin:16px;font-weight:800;color:#7a6070}
#setBtn{right:16px;width:56px;height:56px;border-radius:50%;background:linear-gradient(#5d6f86,#3b4a5e);box-shadow:0 4px 0 #26313f}
#setBtn img{width:38px;height:38px}
#boost{position:absolute;right:16px;top:calc(max(14px,env(safe-area-inset-top)) + 132px);background:#fff3b0;border:2px solid #ffc531;border-radius:999px;padding:4px 12px 4px 6px;display:flex;align-items:center;gap:4px;font-weight:900;font-size:15px;opacity:0;transition:opacity .2s}
#boost img{width:26px;height:26px}
#hint{position:absolute;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 196px);transform:translateX(-50%);background:rgba(255,255,255,.92);padding:9px 16px;border-radius:20px;font-weight:900;font-size:15px;line-height:1.25;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.12);animation:hintb 1.2s ease-in-out infinite;max-width:calc(100% - 32px);overflow-wrap:anywhere}
@keyframes hintb{50%{transform:translateX(-50%) translateY(-6px)}}
.cards{position:absolute;left:16px;right:16px;bottom:max(14px,env(safe-area-inset-bottom));display:flex;gap:10px}
.card{flex:1 1 0;min-width:0;position:relative;background:linear-gradient(#ffffff 0,#ffffff 62%,#dff1ff 62%);border-radius:18px;border:3px solid #b9e0fb;box-shadow:0 5px 0 rgba(31,58,95,.2),0 8px 16px rgba(0,0,0,.1);padding:26px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--navy);transition:transform .08s}
.card:active{transform:translateY(3px)}
.card.no{filter:saturate(.35);opacity:.85}
.ribbon{position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:linear-gradient(#4fd36a,#22a845);color:#fff;font-weight:900;font-size:13px;padding:4px 12px;border-radius:9px;white-space:nowrap;box-shadow:0 3px 0 #17803a;transition:opacity .15s}
.card.no .ribbon,.card.maxed .ribbon{opacity:0}
.cname{font-size:16px;font-weight:900;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.crow{display:flex;align-items:center;gap:4px}
.crow img{width:38px;height:38px;object-fit:contain}
.clv{font-size:16px;font-weight:900;color:#2f6fc0;white-space:nowrap}
.price{margin-top:4px;width:100%;height:40px;border-radius:999px;background:linear-gradient(#5ad874,#23a846);box-shadow:inset 0 -3px 0 #178a37;display:flex;align-items:center;justify-content:center;gap:4px;color:#fff;font-weight:900;font-size:19px;white-space:nowrap}
.card.no .price{background:linear-gradient(#b8c2cc,#97a3ae);box-shadow:inset 0 -3px 0 #7d8894}
.price img{width:24px;height:24px}
.card.pop{animation:pop .25s}
@keyframes pop{40%{transform:scale(1.08)}}
#floats{position:absolute;inset:0;overflow:hidden}
.float{position:absolute;font-weight:900;font-size:20px;color:#fff;text-shadow:0 2px 0 #1b7a33,0 0 6px rgba(0,0,0,.25);animation:flt 1s ease-out forwards;white-space:nowrap}
@keyframes flt{from{transform:translate(-50%,0);opacity:1}to{transform:translate(-50%,-70px);opacity:0}}
.modal{position:absolute;inset:0;background:rgba(18,40,60,.45);display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:16px}
.modal.hidden{display:none}
.panel{width:min(100%,440px);max-height:calc(100% - 32px);overflow-y:auto;background:#fff;border-radius:24px;box-shadow:0 8px 0 rgba(31,58,95,.25);padding:0 0 18px;text-align:center}
.phead{background:linear-gradient(#6cc6ff,#3b9be8);color:#fff;font-weight:900;font-size:24px;padding:14px;border-radius:24px 24px 0 0;margin-bottom:12px}
.prow{display:flex;align-items:center;gap:10px;margin:8px 14px;padding:10px;background:#f1f9ff;border-radius:16px;text-align:left}
.prow img{width:62px;height:62px;object-fit:contain;flex:none}
.pinfo{flex:1;min-width:0}
.pname{font-weight:900;font-size:18px}
.pdesc{font-size:14px;color:#3e5a7d;font-weight:700}
.pown{font-size:13px;color:#2f6fc0;font-weight:900}
.bbtn{min-width:96px;min-height:48px;border-radius:999px;background:linear-gradient(#5ad874,#23a846);box-shadow:inset 0 -3px 0 #178a37;color:#fff;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 12px;white-space:nowrap}
.bbtn img{width:24px;height:24px}
.bbtn.no{background:linear-gradient(#b8c2cc,#97a3ae);box-shadow:inset 0 -3px 0 #7d8894}
.bbtn.blue{background:linear-gradient(#5db7ff,#2a7fe0);box-shadow:inset 0 -3px 0 #1d5fb0}
.bbtn.big{margin:16px auto 0;min-width:200px;font-size:20px;min-height:56px}
.srow{display:flex;align-items:center;gap:8px;margin:10px 18px;font-weight:900;font-size:17px;flex-wrap:wrap}
.srow>span{flex:1 1 auto;min-width:0;text-align:left;white-space:nowrap}
.srow>.seg{margin-left:auto;flex:0 0 auto;flex-wrap:nowrap}
.seg{display:flex;gap:6px;flex-wrap:wrap}
.seg button{min-width:72px;min-height:48px;border-radius:14px;background:#e6eef6;color:var(--navy);font-weight:900;font-size:15px;padding:0 4px;flex:none;white-space:nowrap}
.seg button.on{background:linear-gradient(#5db7ff,#2a7fe0);color:#fff}
.bigmoney{display:flex;align-items:center;justify-content:center;gap:8px;font-size:38px;font-weight:900;margin:8px 0}
.bigmoney img{width:46px;height:46px}
.msub{font-size:16px;font-weight:800;color:#3e5a7d;margin:0 18px}
#loader{position:absolute;inset:0;background:#7dcb5e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;pointer-events:auto;transition:opacity .4s}
#loader .lt{color:#fff;font-weight:900;font-size:18px;text-shadow:0 2px 0 #3d8a2a}
#loader .lb{width:220px;height:14px;border-radius:8px;background:rgba(255,255,255,.5);overflow:hidden}
#loader .lf{height:100%;width:0;background:#fff;border-radius:8px}
#loader .spin{width:44px;height:44px;border-radius:50%;border:6px solid rgba(255,255,255,.4);border-top-color:#fff;animation:sp 0.8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
@media (max-width:370px){.pill .num{font-size:18px}.pill img{width:32px;height:32px}.cname{font-size:14px}.price{font-size:16px}}
.btnrow{display:flex;flex-direction:column;align-items:center}
@media (max-height:540px){
.panel{width:min(100%,760px);padding-bottom:10px}
.phead{padding:8px;font-size:19px;margin-bottom:4px}
.plist{display:flex;gap:8px;margin:0 10px}
.plist .prow{flex:1 1 0;min-width:0;flex-direction:column;text-align:center;margin:4px 0;padding:8px 6px;gap:4px}
.prow img{width:44px;height:44px}
.pname{font-size:16px}.pdesc{font-size:13px}
.bbtn.big{margin:8px auto 0;min-height:48px;font-size:17px;min-width:160px}
.btnrow{flex-direction:row;justify-content:center;gap:12px}
.btnrow .bbtn.big{margin:8px 0 0}
.srow{margin:4px 18px}
.bigmoney{font-size:30px;margin:4px 0}
.card{padding:20px 6px 6px}.crow img{width:28px;height:28px}.price{height:34px;font-size:17px}
#hint{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 150px)}
}
/* ---- coin exchange panel (top level: must apply on every viewport) ---- */
.cshop{display:flex;align-items:center;gap:12px;margin:0 14px 10px;padding:10px 12px;background:#fdf6e6;border:2px solid #efd3ad;border-radius:16px}
.cinfo{flex:1 1 auto;min-width:0;text-align:left}
.camt{display:flex;align-items:center;gap:6px;font-weight:900;font-size:20px;color:#4a3550}
.camt img{width:30px;height:30px;object-fit:contain;flex:none}
.cdesc{font-size:14px;color:#8a6a5e;font-weight:700}
.cmsg{margin:-4px 18px 10px;font-size:15px;font-weight:800;color:#c75a43;text-align:center}
.bigcoin{display:flex;align-items:center;justify-content:center;gap:10px;margin:2px 0;font-size:26px;font-weight:900;color:#4a3550}
.bigcoin img{width:44px;height:44px;object-fit:contain;flex:none}
.bigcash{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 4px;font-size:24px;font-weight:900;color:#3f8a4a}
.bigcash img{width:34px;height:34px;object-fit:contain;flex:none}
.crate{display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0 6px;font-weight:900;color:#6b4f45;line-height:1;white-space:nowrap}
.crate img{width:30px;height:30px;object-fit:contain;flex:none}
.crate img.cash{width:25px;height:25px}
.crate .eq{font-size:20px;color:#b99a86}
.crate .mul{font-size:21px;letter-spacing:0.5px}
.crate .arrow{font-size:20px;color:#c9a07a}
@media (max-height:540px){
.cshop{margin:0 10px 6px;padding:6px 10px}
.cinfo{gap:8px}
.camt{font-size:17px}
.camt img{width:24px;height:24px}
.cdesc{font-size:12px}
.cmsg{margin:-2px 12px 6px;font-size:13px}
.bigcoin{font-size:22px}
.bigcoin img{width:36px;height:36px}
.crate{margin:10px 0 4px;gap:8px}
.crate img{width:26px;height:26px}
.crate img.cash{width:22px;height:22px}
.crate .eq,.crate .mul{font-size:18px}
}
/* ---- low-poly sunset skin ---- */
:root{--navy:#4a3550}
.pill{background:#fbf3e4;box-shadow:0 4px 0 rgba(120,70,60,.22),0 6px 14px rgba(90,40,30,.12)}
.pill.world{background:#fbf3e4;border:2px solid #f0d6b4}
.wlabel{color:#4a3550;text-shadow:none}
.bar{background:#efe2cc}
.fill{background:linear-gradient(#7fd35e,#4fae3a)}
.wname{background:rgba(74,53,80,.6)}
.side{background:linear-gradient(#f7a982,#e2725b);box-shadow:0 4px 0 #b4503e,0 6px 12px rgba(0,0,0,.15)}
#setBtn{background:linear-gradient(#8f7aa0,#6a5580);box-shadow:0 4px 0 #4a3a5c}
#boost{background:#fff1d6;border-color:#f5a64a}
.card{background:linear-gradient(#fbf3e4 0,#fbf3e4 62%,#f6e4c8 62%);border-color:#efd3ad;box-shadow:0 5px 0 rgba(120,70,60,.25),0 8px 16px rgba(90,40,30,.12)}
.clv{color:#c75a43}
.panel{background:#fbf3e4}
.phead{background:linear-gradient(#f7a982,#e2725b)}
.prow{background:#f4e6cf}
.bbtn.blue{background:linear-gradient(#a08cc0,#7a62a0);box-shadow:inset 0 -3px 0 #5a4680}
.seg button{background:#efe0c8}
.seg button.on{background:linear-gradient(#f7a982,#e2725b)}
#loader{background:linear-gradient(#f7c59f,#e8927a 60%,#a98bb8)}
#loader .lt{text-shadow:0 2px 0 #a0503e}
`;
const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

const IMG = {
  cash: 'assets/ui/icon_cash.png', ant: 'assets/ui/icon_ant.png', speed: 'assets/ui/icon_speed.png', strength: 'assets/ui/icon_strength.png',
  shop: 'assets/ui/icon_shop.png', trophy: 'assets/ui/icon_trophy.png', world: 'assets/ui/icon_world.png', gear: 'assets/ui/icon_gear.png',
  coin: 'assets/ui/icon_coin.svg',
  soldier: 'assets/ui/ant_soldier.png', strong: 'assets/ui/ant_strong.png', golden: 'assets/ui/ant_golden.png',
};
const ui = document.createElement('div');
ui.id = 'ui';
ui.innerHTML = `
<div id="col">
  <div class="top">
    <div class="pill money"><img src="${IMG.cash}" alt=""><span class="num" id="money">0</span></div>
    <div class="pill world"><img src="${IMG.world}" alt=""><div class="wcol"><div class="wlabel" id="wlabel"></div><div class="bar"><div class="fill" id="wfill"></div></div></div></div>
    <div class="pill ants"><img src="${IMG.ant}" alt=""><span class="num" id="antn">0</span></div>
  </div>
  <div class="wname" id="wname"></div>
  <button class="side" id="shopBtn"><img src="${IMG.shop}" alt=""><span id="shopLbl"></span></button>
  <button class="side" id="rankBtn"><img src="${IMG.trophy}" alt=""><span id="rankLbl"></span></button>
  <button class="side" id="setBtn" aria-label="settings"><img src="${IMG.gear}" alt=""></button>
  <div id="boost"><img src="${IMG.speed}" alt=""><span id="boostLbl"></span></div>
  <div id="hint"></div>
  <div class="cards">
    ${(['speed', 'workers', 'strength']           ).map((k) => `
    <button class="card" data-up="${k}"><div class="ribbon" data-l="upgrade"></div><div class="cname" data-l="${k}"></div>
      <div class="crow"><img src="${k === 'speed' ? IMG.speed : k === 'workers' ? IMG.ant : IMG.strength}" alt=""><span class="clv"></span></div>
      <div class="price"><img src="${IMG.cash}" alt=""><span class="pv"></span></div></button>`).join('')}
  </div>
  <div id="floats"></div>
</div>
<div id="modal" class="modal hidden"><div class="panel" id="panel"></div></div>
<div id="loader"><div class="spin"></div><div class="lt" data-l="loading"></div><div class="lb"><div class="lf" id="lfill"></div></div></div>
`;
document.body.appendChild(ui);
const $ = (id        ) => document.getElementById(id) ;

function applyStaticText() {
  ui.querySelectorAll('[data-l]').forEach((el) => { el.textContent = t((el               ).dataset.l          ); });
  $('shopLbl').textContent = t('shop');
  $('rankLbl').textContent = t('rank');
  $('boostLbl').textContent = t('boost');
  $('hint').textContent = t('tapHint');
  $('wlabel').textContent = t('nextWorld');
  $('wname').textContent = t('world', { n: S.world + 1 }) + ' · ' + t(THEMES[S.world % THEMES.length].key);
}

let lastHud = '';
function updateHud() {
  const total = items.reduce((s, i) => s + i.maxHp, 0);
  const left = items.reduce((s, i) => s + Math.max(0, i.hp), 0);
  const prog = total > 0 ? 1 - left / total : 1;
  const key = Math.floor(S.money) + '|' + ants.length + '|' + prog.toFixed(3) + '|' + JSON.stringify(S.lv) + getLang();
  if (key === lastHud) return;
  lastHud = key;
  $('money').textContent = fmt(S.money);
  $('antn').textContent = String(ants.length);
  ($('wfill')               ).style.width = (prog * 100).toFixed(1) + '%';
  ui.querySelectorAll             ('.card').forEach((c) => {
    const k = c.dataset.up         ;
    const lv = S.lv[k];
    const maxed = lv >= UPS[k].max;
    const cost = upCost(k, lv);
    (c.querySelector('.clv')               ).textContent = t('lv', { n: lv + 1 });
    (c.querySelector('.pv')               ).textContent = maxed ? t('max') : fmt(cost);
    c.classList.toggle('maxed', maxed);
    c.classList.toggle('no', maxed || S.money < cost);
  });
}

function buyUp(k       ) {
  const lv = S.lv[k];
  if (lv >= UPS[k].max) return false;
  const cost = upCost(k, lv);
  if (S.money < cost) { openCoins(); return false; } // not enough cash -> coin exchange
  S.money -= cost;
  S.lv[k]++;
  if (k === 'workers') syncAnts();
  playCueSafe('ui.upgrade');
  const c = ui.querySelector(`.card[data-up="${k}"]`)               ;
  c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  save();
  updateHud();
  return true;
}
ui.querySelectorAll             ('.card').forEach((c) => {
  let tm                = null, iv                = null;
  const stop = () => { if (tm) clearTimeout(tm); if (iv) clearInterval(iv); tm = iv = null; };
  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    const k = c.dataset.up         ;
    if (!buyUp(k)) { stop(); return; } // short on cash: openCoins() already opened the exchange, no repeat-buy
    stop();
    tm = window.setTimeout(() => { iv = window.setInterval(() => { if (!buyUp(k)) stop(); }, 110); }, 420);
  });
  c.addEventListener('pointerup', stop); c.addEventListener('pointerleave', stop); c.addEventListener('pointercancel', stop);
});

// ---- modals ----
let modalKind                                                         = '';
let offlineReward = 0;
let doneReward = 0;
function closeModal() { modalKind = ''; $('modal').classList.add('hidden'); }
function openModal(kind                  ) { modalKind = kind; $('modal').classList.remove('hidden'); renderModal(); }
let resetArmed = false;
function renderShop() {
  const p = $('panel');
  p.innerHTML = `<div class="phead">${t('shopTitle')}</div><div class="plist">` + (['soldier', 'strong', 'golden']             ).map((k) => {
    const n = S.spec[k], max = SPECS[k].max, cost = specCost(k, n), maxed = n >= max;
    return `<div class="prow"><img src="${IMG[k]}" alt=""><div class="pinfo"><div class="pname">${t((k + 'Name')          )}</div><div class="pdesc">${t((k + 'Desc')          )}</div><div class="pown">${t('owned', { n, m: max })}</div></div>
      <button class="bbtn ${maxed ? 'no' : ''}" data-buy="${k}">${maxed ? t('max') : `<img src="${IMG.cash}" alt="">${fmt(cost)}`}</button></div>`;
  }).join('') + `</div><button class="bbtn blue big" data-close="1">${t('close')}</button>`;
}

function renderCoins() {
  const p = $('panel');
  const pay = window.gp?.pay;
  const buyable = !!(pay && pay.available);
  p.innerHTML = `<div class="phead">${t('coinTitle')}</div>
    <div class="crate">
      <img src="${IMG.coin}" alt=""><span class="eq">=</span><img class="cash" src="${IMG.cash}" alt=""><span class="mul">×${String(Math.round(COIN_PACK.cash))}</span>
    </div>
    <button class="bbtn big" data-coin="1">${buyable ? (coinBusy ? '…' : t('coinBuy', { n: 1 })) : t('coinUnavailable')}</button>
    ${coinMsg ? `<div class="cmsg" style="margin-top:8px">${coinMsg}</div>` : ''}
    <button class="bbtn blue big" data-close="1">${t('close')}</button>`;
}

// ======================= coins (platform purchases) =======================
// 1 platform coin = COIN_PACK.cash game cash, paid straight into the bank. Nothing about the
// purchase is stored: the panel just shows the rate.
const COIN_PACK = { itemId: 'coin_pack_1', price: 1, cash: 1000 };
let coinMsg = '';
let coinBusy = false;
function applyCoinDelivery() {
  moneyGain(COIN_PACK.cash);
  playCueSafe('ui.coin');
  coinMsg = t('coinOk');
  save();
}
async function checkPendingPurchases() {
  const pay = window.gp?.pay;
  if (!pay || !pay.available) return 0;
  let delivered = 0;
  try {
    const r = await pay.pending();
    if (!r || !r.ok) return 0; // failed query: do nothing now, retry next launch
    for (const it of r.items) {
      if (it.itemId !== COIN_PACK.itemId) continue;
      delivered++;
      applyCoinDelivery();
      await pay.ack(it.purchaseId);
    }
  } catch { /* offline */ }
  return delivered;
}
// single entry point, opened wherever the player runs out of cash
function openCoins() {
  coinMsg = '';
  openModal('coins');
  void checkPendingPurchases().then(() => { if (modalKind === 'coins') renderModal(); });
}
async function buyCoins() {
  const pay = window.gp?.pay;
  if (coinBusy) return;
  if (!pay || !pay.available) { coinMsg = t('coinUnavailable'); renderModal(); return; }
  coinBusy = true; coinMsg = ''; renderModal();
  try {
    const r = await pay.purchase({ itemId: COIN_PACK.itemId, title: t('coinTitle'), desc: t('coinDesc'), price: COIN_PACK.price });
    if (r.ok) {
      await pay.ack(r.purchaseId);
      // the acked purchase is no longer pending, so this pass only picks up earlier unfinished ones
      const late = await checkPendingPurchases();
      if (late === 0) applyCoinDelivery();
    } else if (r.error === 'need_login') { try { window.gp?.player?.requestLogin(); } catch { /* ignore */ } }
    else if (r.error !== 'declined') coinMsg = t('coinErr');
  } catch { coinMsg = t('coinErr'); }
  coinBusy = false;
  if (modalKind === 'coins') renderModal();
  updateHud();
}

function renderModal() {
  const p = $('panel');
  if (modalKind === 'shop') {
    renderShop();
  } else if (modalKind === 'coins') {
    renderCoins();
  } else if (modalKind === 'rank') {
    p.innerHTML = renderRank();
  } else if (modalKind === 'settings') {
    const L = getLang();
    p.innerHTML = `<div class="phead">${t('settings')}</div>
      <div class="srow"><span>${t('language')}</span><div class="seg"><button data-lang="zh" class="${L === 'zh' ? 'on' : ''}" lang="zh-CN">中文</button><button data-lang="en" class="${L === 'en' ? 'on' : ''}" lang="en">English</button><button data-lang="ja" class="${L === 'ja' ? 'on' : ''}" lang="ja">日本語</button></div></div>
      <div class="srow"><span>${t('music')}</span><div class="seg"><button data-music="1" class="${S.music ? 'on' : ''}">${t('on')}</button><button data-music="0" class="${!S.music ? 'on' : ''}">${t('off')}</button></div></div>
      <div class="srow"><span>${t('sfx')}</span><div class="seg"><button data-sfx="1" class="${S.sfx ? 'on' : ''}">${t('on')}</button><button data-sfx="0" class="${!S.sfx ? 'on' : ''}">${t('off')}</button></div></div>
      <div class="btnrow"><button class="bbtn no big" data-reset="1" style="font-size:16px">${resetArmed ? t('resetConfirm') : t('resetProgress')}</button>
      <button class="bbtn blue big" data-close="1">${t('close')}</button></div>`;
  } else if (modalKind === 'done') {
    p.innerHTML = `<div class="phead">${t('worldDone')}</div><div class="msub">${t('worldDoneSub', { name: t(THEMES[S.world % THEMES.length].key) })}</div>
      <div class="msub" style="margin-top:10px">${t('reward')}</div><div class="bigmoney"><img src="${IMG.cash}" alt="">+${fmt(doneReward)}</div>
      <button class="bbtn big" data-next="1">${t('goNext')}</button>`;
  } else if (modalKind === 'offline') {
    const hrs = offlineElapsed / 3600;
    const tt = hrs >= 1 ? t('hours', { n: Math.min(4, Math.floor(hrs)) }) : t('minutes', { n: Math.max(1, Math.floor(offlineElapsed / 60)) });
    p.innerHTML = `<div class="phead">${t('offlineTitle')}</div><div class="msub">${t('offlineSub', { t: tt })}</div>
      <div class="bigmoney"><img src="${IMG.cash}" alt="">+${fmt(offlineReward)}</div><button class="bbtn big" data-collect="1">${t('collect')}</button>`;
  }
}
$('modal').addEventListener('pointerdown', (e) => {
  unlockAudio();
  const tg = (e.target               ).closest('button')                      ;
  if (!tg) { if (e.target === $('modal') && (modalKind === 'shop' || modalKind === 'coins' || modalKind === 'settings' || modalKind === 'rank')) closeModal(); return; }
  const d = tg.dataset;
  if (d.close) { resetArmed = false; closeModal(); return; }
  if (d.login) { try { window.gp?.player?.requestLogin(); } catch { /* ignore */ } return; }
  if (d.buy) {
    const k = d.buy           ;
    const n = S.spec[k];
    const cost = specCost(k, n);
    if (n >= SPECS[k].max) return; // maxed: nothing to buy, nothing to upsell
    if (S.money < cost) { openCoins(); return; } // not enough cash -> coin exchange
    S.money -= cost; S.spec[k]++; syncAnts(); playCueSafe('ui.upgrade'); save();
    renderModal(); updateHud(); return;
  }
  if (d.coin) { void buyCoins(); return; }
  if (d.lang) { S.lang = d.lang        ; setLang(S.lang); save(); renderModal(); return; }
  if (d.music) { S.music = d.music === '1'; applyVolumes(); save(); renderModal(); return; }
  if (d.sfx) { S.sfx = d.sfx === '1'; applyVolumes(); save(); renderModal(); return; }
  if (d.reset) {
    if (!resetArmed) { resetArmed = true; renderModal(); return; }
    resetArmed = false;
    S.money = 0; S.world = 0; S.lv = { speed: 0, workers: 0, strength: 0 }; S.spec = { soldier: 0, strong: 0, golden: 0 }; S.rate = 0;
    ants.length = 0; syncAnts(); buildWorld(0, null); applyStaticText(); save(); closeModal(); return;
  }
  if (d.next) { nextWorld(); return; }
  if (d.collect) { moneyGain(offlineReward); pendingMoney = 0; playCueSafe('ui.coin'); save(); closeModal(); return; }
});
$('shopBtn').addEventListener('pointerdown', () => { unlockAudio(); coinMsg = ''; openModal('shop'); });
$('rankBtn').addEventListener('pointerdown', () => { unlockAudio(); openRank(); });

// ======================= leaderboard =======================
// Score = worlds cleared (S.world). Submitted once per world clear, plus once at boot to sync old progress.
                                                                              
let rankRows                   = null;
let rankState                               = 'loading';
let myBest                                        = null;
let lastSubmitted = -1;
const esc = (x        ) => x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }                          )[c]);
async function submitProgress() {
  const p = window.gp?.player;
  if (!p || S.world <= 0 || S.world <= lastSubmitted) return;
  lastSubmitted = S.world;
  try {
    const r = await p.submitScore(S.world)                                    ;
    if (r && typeof r.best === 'number') myBest = { best: r.best, rank: Number(r.rank) || 0 };
    else lastSubmitted = -1; // needLogin / offline: allow a retry on the next clear or panel open
  } catch { lastSubmitted = -1; }
}
async function openRank() {
  rankState = 'loading';
  openModal('rank');
  try {
    const p = window.gp?.player;
    if (!p) throw new Error('no player');
    await p.ready;
    await submitProgress();
    const top = await p.topScores(10);
    rankRows = Array.isArray(top) ? (top             ) : [];
    rankState = 'ok';
  } catch { rankState = 'offline'; }
  if (modalKind === 'rank') renderModal();
}
function renderRank() {
  let body = '';
  if (rankState === 'loading') body = `<div class="rnote">${t('rankLoading')}</div>`;
  else if (rankState === 'offline') body = `<div class="rnote">${t('rankOffline')}</div>`;
  else if (!rankRows || !rankRows.length) body = `<div class="rnote">${t('rankEmpty')}</div>`;
  else body = `<div class="rlist" data-mp-scroll>` + rankRows.map((r, i) => `<div class="rrow${r.isMe ? ' me' : ''}"><span class="rno">${i + 1}</span>${r.avatar ? `<img class="rav" src="${esc(String(r.avatar))}" alt="">` : '<span class="rav"></span>'}<span class="rname">${esc(String(r.name || t('rankGuest')))}</span><span class="rsc">${t('rankWorlds', { n: r.score })}</span></div>`).join('') + '</div>';
  const user = window.gp?.player?.user;
  let mine = '';
  if (myBest && myBest.rank > 0) mine = t('rankMineRank', { n: myBest.best, r: myBest.rank });
  else mine = t('rankMine', { n: S.world });
  const login = !user ? `<button class="bbtn big" data-login="1">${t('rankLogin')}</button>` : '';
  return `<div class="phead">${t('rankTitle')}</div><div class="msub">${t('rankSub')}</div>${body}<div class="rmine">${mine}</div><div class="btnrow">${login}<button class="bbtn blue big" data-close="1">${t('close')}</button></div>`;
}
$('setBtn').addEventListener('pointerdown', () => { unlockAudio(); resetArmed = false; openModal('settings'); });

function nextWorld() {
  S.money += doneReward;
  S.world++;
  S.items = null;
  void submitProgress();
  buildWorld(S.world, null);
  applyStaticText();
  closeModal();
  save();
  updateHud();
}

// floats
const floatsEl = $('floats');
function spawnFloat(text        , lift = 0.6, at = null                    ) {
  _v.copy(at ? _t.set(at.x, lift, at.z) : _tmp.copy(HOLE).setY(lift)).project(camera);
  const colRect = $('col').getBoundingClientRect();
  const x = (_v.x * 0.5 + 0.5) * viewW - colRect.left + (Math.random() - 0.5) * 40;
  const y = (-_v.y * 0.5 + 0.5) * viewH - 20;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  const cw = colRect.width || viewW;
  // percentages keep the popup inside the column even if the window resizes mid-animation
  el.style.left = (Math.max(40, Math.min(cw - 40, x)) / cw * 100).toFixed(2) + '%';
  el.style.top = Math.max(22, Math.min(70, (y / viewH) * 100)).toFixed(2) + '%';
  floatsEl.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ======================= input: tap to sprint =======================
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function itemIndexAt(nx        , ny        )         {
  ray.setFromCamera(_tap.set(nx, ny), camera);
  const hits = ray.intersectObjects(worldGroup.children, true);
  for (const h of hits) {
    let o                = h.object;
    while (o && o.userData.itemIdx === undefined) o = o.parent              ;
    if (o && o.userData.itemIdx !== undefined) {
      const it = items[o.userData.itemIdx];
      if (it && !it.gone) return o.userData.itemIdx;
    }
  }
  return -1;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (modalKind) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1, ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const hitIdx = itemIndexAt(nx, ny);
  if (hitIdx >= 0) {
    // tapped an item: ants switch to it (a second tap on the same item still grants the sprint boost)
    setFocus(hitIdx, true);
  } else {
    ray.setFromCamera(_tap.set(nx, ny), camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(groundPlane, hit)) spawnRipple(hit.x, hit.z);
    playCueSafe('ui.tap');
  }
  boost = Math.min(3.5, boost + 0.7);
  tapCount++;
  if (tapCount >= 3 && !S.hinted) { S.hinted = true; dirty = true; }
});
let tapCount = 0;

// ======================= sound =======================
let sound                          = null;
let audioUnlocked = false;
let musicStarted = false;
function applyVolumes() {
  if (!sound) return;
  sound.settings.setVolumes({ music: S.music ? 1 : 0, sfx: S.sfx ? 1 : 0 });
}
function unlockAudio() {
  if (!sound || audioUnlocked) return;
  audioUnlocked = true;
  void sound.unlock().then(async () => {
    applyVolumes();
    await sound .preload('gameplay');
    if (!musicStarted) { musicStarted = true; await sound .setMusicState('garden', { eventId: 'session' }); }
  }).catch(() => { audioUnlocked = false; });
}
let cueSeq = 0;
function playCueSafe(id                                                               , pitch = 0) {
  if (!sound || !audioUnlocked) return;
  const eventId = id + ':' + cueSeq++;
  try {
    if (id === 'ui.coin') void sound.playCue('ui.coin', { eventId, pitchSemitones: pitch });
    else if (id === 'ui.tap') void sound.playCue('ui.tap', { eventId, pitchSemitones: pitch });
    else if (id === 'ui.upgrade') void sound.playCue('ui.upgrade', { eventId });
    else if (id === 'ui.win') void sound.playCue('ui.win', { eventId });
    else void sound.playCue('item.eaten', { eventId });
  } catch { /* ignore */ }
}
window.addEventListener('pagehide', () => { save(); void sound?.dispose(); }, { once: true });

// ======================= loop =======================
let last = performance.now();
let floatAcc = 0, secAcc = 0, saveAcc = 0;
function frame(now        ) {
  const rawDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let dt = rawDt;
  if (fx) dt = rawDt * fx.update(rawDt);
  if (!modalKind || modalKind === 'shop' || modalKind === 'settings') {
    boost = Math.max(0, boost - dt);
    stepAnts(dt);
  }
  stepFx(dt);
  renderAnts();
  // world complete?
  if (!worldDone && !modalKind && items.length && items.every((i) => i.gone) && ants.every((a) => a.carry === 0 && a.state !== 2)) {
    worldDone = true;
    doneReward = Math.round(items.reduce((s, i) => s + i.maxHp * i.value, 0) * 0.15);
    playCueSafe('ui.win');
    fxPlay('level-up', NEST_POS.x, 0.5, NEST_POS.z + 1, 1.5);
    setTimeout(() => { if (!modalKind) openModal('done'); else worldDone = false; }, 700);
    save();
  }
  floatAcc += dt;
  if (floatAcc > 0.22 && pendingMoney > 0) {
    floatAcc = 0;
    spawnFloat('+' + (pendingMoney < 10 ? String(Math.round(pendingMoney * 10) / 10) : fmt(pendingMoney)));
    if (Math.random() < 0.35) fxPlay('pickup-pop', HOLE.x, 0.4, HOLE.z, 0.6);
    playCueSafe('ui.coin', (Math.random() - 0.5) * 3);
    pendingMoney = 0;
  }
  secAcc += dt;
  if (secAcc >= 1) {
    S.rate = S.rate * 0.9 + (earnedThisSec / secAcc) * 0.1;
    earnedThisSec = 0; secAcc = 0;
  }
  saveAcc += dt;
  if (saveAcc > 3 && dirty) { saveAcc = 0; save(); }
  ($('boost')               ).style.opacity = boost > 0 ? '1' : '0';
  ($('hint')               ).style.display = S.hinted || modalKind ? 'none' : '';
  updateHud();
  if (!fx || !fx.render()) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ======================= boot =======================
document.title = 'Ant Boss';
const display = mountDisplay({
  orientation: 'portrait',
  onResize: ({ width, height }                                   ) => { viewW = width; viewH = height; floatsEl.replaceChildren(); fitCamera(); },
});
display.attachThree(renderer, camera);
viewW = display.info.width || window.innerWidth;
viewH = display.info.height || window.innerHeight;

setLang(S.lang || pickLang(window.gp?.player?.user?.locale || navigator.language));
onLangChange(() => { applyStaticText(); lastHud = ''; updateHud(); });
syncAnts();
buildWorld(S.world, S.items);
applyStaticText();
updateHud();
fitCamera();
// pre-warm ants spread along trails for a lively first frame
for (let i = 0; i < 240; i++) stepAnts(1 / 30);
pendingMoney = 0; earnedThisSec = 0;
renderAnts();
renderer.render(scene, camera);
window.__gpReady = true;

lensTree; // registered above
createLensThreeBridge({ tree: lensTree, THREE, renderer, camera });

// boot sync only for signed-in players (a guest submit would trigger a login prompt at launch)
window.gp?.player?.ready.then(() => { if (window.gp?.player?.user) return submitProgress(); }).catch(() => { /* offline */ });
if (hadSave && offlineElapsed > 120 && S.rate > 0) {
  offlineReward = Math.round(S.rate * Math.min(offlineElapsed, 4 * 3600) * 0.4);
  if (offlineReward >= 1) openModal('offline');
}

(async () => {
  const lf = $('lfill')               ;
  const urls = Object.values(IMG);
  let done = 0;
  const glbEntries = Object.entries(GLB_URLS)                        ;
  const total = urls.length + 1 + glbEntries.length;
  const tick = () => { done++; lf.style.width = ((done / total) * 100).toFixed(0) + '%'; };
  const gltf = new GLTFLoader();
  const glbs = Promise.all(glbEntries.map(([kind, url]) => gltf.loadAsync(url)
    .then((g                           ) => registerGlb(kind, g.scene)).catch(() => { /* keep placeholder */ }).finally(tick)))
    .then(() => {
      // the current world may already contain generated models built as placeholders: rebuild it in place
      if (items.some((it) => GLB_URLS[it.kind])) { const hp = items.map((it) => it.hp); buildWorld(S.world, hp); }
    });
  const imgs = urls.map((u) => new Promise      ((res) => { const im = new Image(); im.onload = im.onerror = () => { tick(); res(); }; im.src = u; }));
  const snd = loadSoundSystem({ manifestUrl: './sound.manifest.json' })
    .then((s) => { sound = s                    ; applyVolumes(); })
    .catch(() => { sound = null; })
    .finally(tick);
  const fxP = (async () => {
    try {
      fx = await createThreeFx({ THREE, renderer, world: scene, camera, viewport: () => ({ width: viewW, height: viewH, dpr: display.info.resolution }), referenceSpan: 0.8 });
      fx.post.configure({ glow: false, vignette: false, grading: 'neutral' });
    } catch { fx = null; }
  })();
  await Promise.race([Promise.all([...imgs, snd, fxP, glbs]), new Promise((r) => setTimeout(r, 8000))]);
  const ld = $('loader');
  ld.style.opacity = '0';
  ld.style.pointerEvents = 'none';
  setTimeout(() => ld.remove(), 450);
  fitCamera();
  window.__gpPlayable = true;
})();

last = performance.now();
requestAnimationFrame(frame);

// debug hooks for testing
window.__ant = { S, get items() { return items; }, ants, buyUp, get boost() { return boost; }, get worldDone() { return worldDone; }, get modal() { return modalKind; }, nextWorld, eatTo, get focus() { return focusIdx; }, setFocus, itemIndexAt, get camera() { return camera; }, get canvas() { return renderer.domElement; }, overlaps: () => { const o           = []; for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; const d = Math.hypot(a.x - b.x, a.z - b.z); if (d < a.radius + b.radius) o.push(a.kind + '/' + b.kind + ' ' + d.toFixed(2) + '<' + (a.radius + b.radius).toFixed(2)); } return o; } };
