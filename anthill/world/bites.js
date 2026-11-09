import * as THREE from 'three';

// Bite masking: an item's footprint is sampled into a grid of cells whose centres lie ON the item.
// Every fragment belongs to its nearest cell (Voronoi partition in world XZ, slightly wobbled);
// fragments of eaten cells are discarded. Because the partition is exact, the visible remainder always
// matches the remaining hp — no invisible leftovers and no over-eaten neighbours.
export const MAX_BITES = 112;
// jittered cell centres give an irregular partition → organic chew outlines instead of grid staircases
function hash2(a        , b        ) {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

;                          
                                                                          
               
               
                                                                                                       
 

const VERT_DECL = '#include <common>\nvarying vec3 vBiteW;';
const VERT_BODY = '#include <project_vertex>\nvBiteW = (modelMatrix * vec4(transformed, 1.0)).xyz;';
const FRAG_DECL = `#include <common>
varying vec3 vBiteW;
uniform vec4 uCells[${MAX_BITES}];
uniform int uCellN;
uniform vec3 uInner;`;
const FRAG_CLIP = `#include <clipping_planes_fragment>
{
  float bestD = 1e9; float bestDead = 0.0;
  for (int i = 0; i < ${MAX_BITES}; i++) {
    if (i >= uCellN) break;
    vec2 bd = vBiteW.xz - uCells[i].xy;
    float dd = length(bd) * (1.0 + 0.12 * sin(atan(bd.y, bd.x) * 5.0 + uCells[i].w));
    if (dd < bestD) { bestD = dd; bestDead = uCells[i].z; }
  }
  if (bestDead > 0.5) discard;
}`;
// Cut surfaces: the remaining shell is open where cells were discarded, so through the hole you would
// see the far inner wall (looks hollow). Back faces are therefore shaded as a SOLID cross-section:
// flat inner colour (flesh / crumb), a fixed upward-and-toward-camera normal so they light evenly like
// one cut face, and a faint low-poly crumb speckle in world space.
const FRAG_COLOR = `#include <color_fragment>
if (!gl_FrontFacing) {
  vec3 q = floor(vBiteW * 9.0);
  float n = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  diffuseColor.rgb = uInner * (0.94 + 0.08 * n);
}`;
const FRAG_NORMAL = `#include <normal_fragment_maps>
if (!gl_FrontFacing) {
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  normal = normalize(mix(upV, vec3(0.0, 0.0, 1.0), 0.45));
}`;
const FRAG_EMIT = `#include <emissivemap_fragment>
if (!gl_FrontFacing) totalEmissiveRadiance = uInner * 0.18;`;

function patch(m                , U               ) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCells = U.uCells;
    shader.uniforms.uCellN = U.uCellN;
    shader.uniforms.uInner = U.uInner;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_DECL).replace('#include <project_vertex>', VERT_BODY);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', FRAG_DECL)
      .replace('#include <clipping_planes_fragment>', FRAG_CLIP).replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL).replace('#include <emissivemap_fragment>', FRAG_EMIT);
  };
  m.customProgramCacheKey = () => 'ant-bite-v3';
}

/** Call after obj is positioned in the scene (matrixWorld current). */
export function createBiteMask(obj                , inner             )           {
  const U                = {
    uCells: { value: Array.from({ length: MAX_BITES }, () => new THREE.Vector4()) },
    uCellN: { value: 0 },
    uInner: { value: inner.clone() },
  };
  const meshes               = [];
  obj.traverse((o) => {
    const m = o              ;
    if (!m.isMesh) return;
    meshes.push(m);
    const clone = (src                ) => { const c = src.clone(); c.side = THREE.DoubleSide; patch(c, U); return c; };
    m.material = Array.isArray(m.material) ? m.material.map(clone) : clone(m.material);
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    patch(depth, U);
    m.customDepthMaterial = depth;
  });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const top = box.max.y + 1;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const hitAt = (x        , z        ) => {
    ray.set(new THREE.Vector3(x, top, z), down);
    ray.far = top + 1;
    const hits = ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].point.y : -1;
  };
  const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
  let cell = Math.sqrt((w * d) / 130);
  let pts                  = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    pts = [];
    const nx = Math.max(1, Math.ceil(w / cell)), nz = Math.max(1, Math.ceil(d / cell));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const cx = box.min.x + (i + 0.5 + (hash2(i, j) - 0.5) * 0.6) * cell, cz = box.min.z + (j + 0.5 + (hash2(j + 17, i + 5) - 0.5) * 0.6) * cell;
      // only cells whose centre is on the item: every cell then owns visible material
      const top = hitAt(cx, cz);
      if (top >= 0) pts.push({ x: cx, z: cz, dead: false, edge: 0, h: top });
    }
    if (pts.length > MAX_BITES) cell *= 1.12;
    else if (pts.length < 45 && attempt < 8) cell *= 0.85;
    else break;
  }
  if (pts.length > MAX_BITES) pts.length = MAX_BITES;
  if (!pts.length) pts.push({ x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2, dead: false, edge: 0, h: box.max.y });
  // per-cell random phase for the wobbly bite outline
  pts.forEach((p, i) => { p.edge = (i * 2.399) % 6.283; });
  const mask = { pts, cell, dead: 0, U };
  sync(mask);
  return mask;
}

function sync(mask          ) {
  mask.pts.forEach((p, i) => mask.U.uCells.value[i].set(p.x, p.z, p.dead ? 1 : 0, p.edge));
  mask.U.uCellN.value = mask.pts.length;
}

/** Kill cells nearest (x,z) until the eaten fraction f is represented. */
export function eatTo(mask          , f        , x        , z        ) {
  const want = f >= 0.999 ? mask.pts.length : Math.min(mask.pts.length - 1, Math.floor(f * mask.pts.length));
  if (want <= mask.dead) return;
  const alive = mask.pts.filter((p) => !p.dead).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  for (let i = 0; i < want - mask.dead && i < alive.length; i++) alive[i].dead = true;
  mask.dead = want;
  sync(mask);
}

/** Low, flat items (leaf, cookie…) can be climbed: ants walk onto them. Tall ones are bitten from the edge. */
export const CLIMB_H = 0.42;
export function isAlive(mask          , x        , z        ) {
  return mask.pts.some((p) => !p.dead && Math.abs(p.x - x) < 1e-4 && Math.abs(p.z - z) < 1e-4);
}

/** Pick a spot on the remaining material for an ant at (ax,az). Returns the bite cell and where the ant's
 *  body centre must stand so its head touches (tall item) or sits on (flat item) that material. */
export function biteSpot(mask          , ax        , az        , headReach        ) {
  const alive = mask.pts.filter((p) => !p.dead);
  if (!alive.length) return null;
  alive.sort((a, b) => Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az));
  const p = alive[Math.floor(Math.random() * Math.min(3, alive.length))];
  let dx = ax - p.x, dz = az - p.z;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  const climb = p.h < CLIMB_H;
  // flat: stand right on the cell (body over material, head over the bite)
  // tall: stand outside so the head tip reaches ~0.05 into the cell's edge
  const off = climb ? headReach * 0.7 : mask.cell * 0.5 + headReach - 0.05;
  return { bx: p.x, bz: p.z, sx: p.x + dx * off, sz: p.z + dz * off, climb };
}

/** Height of remaining climbable material under (x,z), 0 when on the ground. */
export function surfaceAt(mask          , x        , z        ) {
  const r = mask.cell * 0.62;
  let best = 0;
  for (const p of mask.pts) {
    if (p.dead || p.h >= CLIMB_H) continue;
    if (Math.abs(p.x - x) < r && Math.abs(p.z - z) < r && p.h > best) best = p.h;
  }
  return best;
}
