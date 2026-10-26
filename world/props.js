import * as THREE from 'three';

// Low-poly faceted style: every material is flat-shaded and matte; every curved primitive is rebuilt
// with few segments and a deterministic vertex jitter so facets read clearly (warm sunset palette).
const matCache = new Map                                    ();
export function mat(color                 , rough = 0.55, extra                                                = {}) {
  const key = String(color) + ':' + rough + ':' + JSON.stringify(extra);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: Math.max(0.75, rough), metalness: 0, flatShading: true, ...extra });
    matCache.set(key, m);
  }
  return m;
}

function hash3(x        , y        , z        ) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function jitter(geo                      , amt        ) {
  const p = geo.attributes.position                         ;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const qx = Math.round(x * 1000) / 1000, qy = Math.round(y * 1000) / 1000, qz = Math.round(z * 1000) / 1000;
    p.setXYZ(i, x + (hash3(qx, qy, qz) - 0.5) * amt, y + (hash3(qy, qz, qx) - 0.5) * amt, z + (hash3(qz, qx, qy) - 0.5) * amt);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
export function lowpoly(geo                      )                       {
  const g = geo                                                                  ;
  const P = g.parameters;
  if (!P) return geo;
  let out                       = geo;
  switch (geo.type) {
    case 'SphereGeometry':
      out = new THREE.SphereGeometry(P.radius, Math.min(P.widthSegments, 14), Math.min(P.heightSegments, 10), P.phiStart, P.phiLength, P.thetaStart, P.thetaLength);
      jitter(out, P.radius * 0.06);
      break;
    case 'CylinderGeometry':
      out = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, Math.min(P.radialSegments, 16), 1, false, (P       ).thetaStart, (P       ).thetaLength);
      break;
    case 'ConeGeometry':
      out = new THREE.ConeGeometry(P.radius, P.height, Math.min(P.radialSegments, 10));
      break;
    case 'TorusGeometry':
      out = new THREE.TorusGeometry(P.radius, P.tube, Math.min(P.radialSegments, 10), Math.min(P.tubularSegments, 22));
      jitter(out, P.tube * 0.08);
      break;
    case 'LatheGeometry':
      out = new THREE.LatheGeometry((g       ).parameters.points, Math.min(P.segments, 14));
      break;
    case 'TubeGeometry':
      out = new THREE.TubeGeometry((g       ).parameters.path, 24, P.radius, 10, false);
      break;
    case 'ExtrudeGeometry':
      return geo;
  }
  if (out !== geo) geo.dispose();
  return out;
}

function mesh(geo                      , m                , shadow = true) {
  const o = new THREE.Mesh(lowpoly(geo), m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

;                     
                                                                                              
                                                                             
                                                               

// Generated 3D models (GLB) for some kinds; loaded at boot, normalised into GLB_TEMPLATES.
export const GLB_URLS                                    = {
  cupcake: 'assets/item-cupcake-cbbf380f.glb',
  croissant: 'assets/item-croissant-1cead571.glb',
  acorn: 'assets/item-acorn-5316c373.glb',
  pretzel: 'assets/item-pretzel-58ef2ee3.glb',
};
/** target footprint (largest horizontal extent, world units before the per-world size factor) */
const GLB_SPAN                                    = { cupcake: 1.05, croissant: 1.5, acorn: 1.05, pretzel: 1.45 };
export const GLB_TEMPLATES                                            = {};
export function registerGlb(kind          , root                ) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = (GLB_SPAN[kind] ?? 1.2) / Math.max(size.x, size.z, 1e-3);
  const holder = new THREE.Group();
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  root.traverse((o) => {
    const m = o              ;
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const fix = (mt                ) => {
      const sm = mt                              ;
      if ('flatShading' in sm) { sm.flatShading = true; sm.roughness = Math.max(0.75, sm.roughness ?? 1); sm.metalness = 0; sm.needsUpdate = true; }
    };
    if (Array.isArray(m.material)) m.material.forEach(fix); else fix(m.material);
  });
  holder.add(root);
  GLB_TEMPLATES[kind] = holder;
}

/** chunk = colour of carried pieces; inner = colour of the solid cut face (defaults to chunk) */
;                                                                                                    

export const ITEM_DEFS                            = {
  leaf: { hp: 34, radius: 0.9, chunk: '#63c443', value: 2 },
  apple: { hp: 44, radius: 0.55, chunk: '#f4e2b0', value: 2 },
  lollipop: { hp: 52, radius: 0.75, chunk: '#f47a8a', value: 3 },
  daisy: { hp: 30, radius: 0.7, chunk: '#ffffff', value: 2 },
  cookie: { hp: 48, radius: 0.75, chunk: '#e2a85e', value: 3 },
  watermelon: { hp: 56, radius: 0.8, chunk: '#ef4f5a', value: 3 },
  strawberry: { hp: 30, radius: 0.5, chunk: '#e8403a', value: 3, inner: '#f7a29a' },
  sugar: { hp: 26, radius: 0.55, chunk: '#fbfbf2', value: 3 },
  cheese: { hp: 50, radius: 0.7, chunk: '#f7c948', value: 3 },
  donut: { hp: 46, radius: 0.72, chunk: '#f59ac0', value: 3, inner: '#efc88e' },
  banana: { hp: 42, radius: 0.8, chunk: '#f8dc4a', value: 3, inner: '#fbf0c4' },
  candy: { hp: 28, radius: 0.55, chunk: '#ff9a3c', value: 4 },
  icecream: { hp: 54, radius: 0.8, chunk: '#fbb3cf', value: 4 },
  grapes: { hp: 40, radius: 0.6, chunk: '#8d5bd1', value: 3, inner: '#cfe39a' },
  maple: { hp: 36, radius: 0.85, chunk: '#f08a2c', value: 2 },
  cupcake: { hp: 44, radius: 0.55, chunk: '#f59ac0', value: 3, inner: '#f2d49c' },
  croissant: { hp: 46, radius: 0.75, chunk: '#e8b060', value: 3, inner: '#f7e2b0' },
  acorn: { hp: 34, radius: 0.55, chunk: '#a8703a', value: 2, inner: '#ecd3a0' },
  pretzel: { hp: 42, radius: 0.75, chunk: '#c47a3a', value: 3, inner: '#f3dcae' },
  sandwich: { hp: 50, radius: 0.8, chunk: '#f2d9a0', value: 3 },
};

function swirlTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d') ;
  g.fillStyle = '#fbe3e3';
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = '#ef6a78';
  g.lineWidth = 22;
  g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.05) {
    const r = a * 5.6;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
let swirl                       = null;

function leafShape(len        , wid        , maple = false) {
  const s = new THREE.Shape();
  if (!maple) {
    s.moveTo(0, -len);
    s.bezierCurveTo(wid * 1.2, -len * 0.5, wid * 1.1, len * 0.5, 0, len);
    s.bezierCurveTo(-wid * 1.1, len * 0.5, -wid * 1.2, -len * 0.5, 0, -len);
  } else {
    const pts = 5;
    s.moveTo(0, -len * 0.55);
    for (let i = 0; i <= pts * 2; i++) {
      const a = -Math.PI / 2 - Math.PI * 0.8 + (i / (pts * 2)) * Math.PI * 1.6 + Math.PI;
      const r = i % 2 === 0 ? len : len * 0.45;
      s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.lineTo(0, -len * 0.55);
  }
  return s;
}

export function buildItem(kind          )              {
  const g = new THREE.Group();
  if (GLB_URLS[kind]) {
    const tpl = GLB_TEMPLATES[kind];
    if (tpl) g.add(tpl.clone(true));
    else { const ph = mesh(new THREE.SphereGeometry(0.4, 12, 8), mat(ITEM_DEFS[kind].chunk)); ph.scale.y = 0.6; ph.position.y = 0.24; g.add(ph); }
    return g;
  }
  switch (kind) {
    case 'sandwich': {
      // triangle half-sandwich lying flat: bread / cheese / tomato / lettuce / bread
      const tri = new THREE.Shape();
      tri.moveTo(-0.75, -0.55); tri.lineTo(0.75, -0.55); tri.lineTo(-0.75, 0.75); tri.lineTo(-0.75, -0.55);
      const layer = (depth        , y        , color        , grow = 0) => {
        const geo = new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03 + grow, bevelSegments: 2 });
        geo.rotateX(-Math.PI / 2);
        const m = mesh(geo, mat(color, 0.8));
        m.position.y = y;
        g.add(m);
      };
      layer(0.14, 0.03, '#f2d9a0');
      layer(0.04, 0.2, '#6cc94a', 0.06);
      layer(0.05, 0.25, '#e8503c', 0.01);
      layer(0.03, 0.31, '#f7c948', 0.04);
      layer(0.14, 0.37, '#f2d9a0');
      const crust = mat('#c98a4a', 0.8);
      const c1 = mesh(new THREE.BoxGeometry(1.56, 0.5, 0.06), crust); c1.position.set(0, 0.27, 0.58); g.add(c1);
      const c2 = mesh(new THREE.BoxGeometry(0.06, 0.5, 1.36), crust); c2.position.set(-0.78, 0.27, -0.1); g.add(c2);
      break;
    }
    case 'leaf':
    case 'maple': {
      const maple = kind === 'maple';
      const geo = new THREE.ExtrudeGeometry(leafShape(maple ? 0.95 : 1.05, 0.55, maple), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2, curveSegments: 9 });
      geo.rotateX(-Math.PI / 2);
      const m = mesh(geo, mat(maple ? '#f08a2c' : '#5fbf3f', 0.6));
      m.position.y = 0.04;
      g.add(m);
      const vein = mesh(new THREE.BoxGeometry(0.035, 0.02, maple ? 1.3 : 1.8), mat(maple ? '#d86a1a' : '#8bdc63', 0.6), false);
      vein.position.y = 0.13;
      g.add(vein);
      const stem = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.4, 6), mat(maple ? '#a8551c' : '#4a9a30'));
      stem.rotation.x = Math.PI / 2;
      stem.position.set(0, 0.08, maple ? 0.7 : 1.2);
      g.add(stem);
      break;
    }
    case 'apple': {
      const red = mat('#ea3b3b', 0.4), cream = mat('#f6e7bd', 0.7);
      const bottom = mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), red);
      bottom.scale.y = 0.55;
      bottom.position.y = 0.24;
      g.add(bottom);
      const capB = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), cream);
      capB.position.y = 0.25; g.add(capB);
      const mid = mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.5, 18), cream);
      mid.position.y = 0.5; g.add(mid);
      const top = mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), red);
      top.scale.y = 0.5; top.position.y = 0.76; g.add(top);
      const capT = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20), cream);
      capT.position.y = 0.75; g.add(capT);
      const stem = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6), mat('#7a4a22'));
      stem.position.y = 1.05; stem.rotation.z = 0.2; g.add(stem);
      break;
    }
    case 'lollipop': {
      swirl = swirl || swirlTexture();
      const side = mat('#ef6a78', 0.3);
      const topM = new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.8, flatShading: true });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 32), [side, topM, side]);
      disc.castShadow = true; disc.receiveShadow = true;
      disc.position.y = 0.12;
      g.add(disc);
      const stick = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 10), mat('#fafafa', 0.5));
      stick.rotation.z = Math.PI / 2;
      stick.position.set(1.15, 0.07, 0.15);
      stick.rotation.y = -0.25;
      g.add(stick);
      break;
    }
    case 'daisy': {
      const white = mat('#ffffff', 0.5);
      for (let i = 0; i < 10; i++) {
        const p = mesh(new THREE.SphereGeometry(0.2, 12, 8), white);
        p.scale.set(1.25, 0.25, 0.55);
        const a = (i / 10) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3);
        p.rotation.y = -a;
        g.add(p);
      }
      const c = mesh(new THREE.SphereGeometry(0.17, 16, 10), mat('#ffd52e', 0.5));
      c.scale.y = 0.6; c.position.y = 0.35; g.add(c);
      const stem = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.32, 8), mat('#4fae32'));
      stem.position.y = 0.14; g.add(stem);
      for (const s of [-1, 1]) {
        const lf = mesh(new THREE.SphereGeometry(0.25, 12, 8), mat('#55b838'));
        lf.scale.set(1.2, 0.2, 0.5);
        lf.position.set(s * 0.32, 0.06, 0.25);
        lf.rotation.y = s * 0.5;
        g.add(lf);
      }
      break;
    }
    case 'cookie': {
      const body = mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.18, 28), mat('#e2a85e', 0.8));
      body.position.y = 0.09; g.add(body);
      const chip = mat('#6b3b22', 0.6);
      const spots = [[0.2, 0.25], [-0.3, 0.1], [0.05, -0.35], [-0.15, 0.4], [0.4, -0.15], [-0.35, -0.3], [0.1, 0.0]];
      for (const [x, z] of spots) {
        const c = mesh(new THREE.DodecahedronGeometry(0.08), chip, false);
        c.position.set(x, 0.19, z); c.scale.y = 0.6; g.add(c);
      }
      break;
    }
    case 'watermelon': {
      const rind = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.22, 28, 1, false, 0, Math.PI), mat('#3e9e3a', 0.5));
      rind.position.y = 0.11; g.add(rind);
      const white = mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.25, 28, 1, false, 0, Math.PI), mat('#e9f4d4', 0.6));
      white.position.y = 0.12; g.add(white);
      const flesh = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.28, 28, 1, false, 0, Math.PI), mat('#ef4f5a', 0.5));
      flesh.position.y = 0.14; g.add(flesh);
      const seed = mat('#2a1a14', 0.3);
      for (let i = 0; i < 7; i++) {
        const a = 0.3 + (i / 6) * (Math.PI - 0.6);
        const r = i % 2 ? 0.45 : 0.3;
        const s = mesh(new THREE.SphereGeometry(0.035, 6, 4), seed, false);
        s.scale.set(1, 0.4, 1.6);
        s.position.set(Math.sin(a) * r, 0.29, Math.cos(a) * r);
        g.add(s);
      }
      g.children.forEach((c) => (c.position.z -= 0.0));
      break;
    }
    case 'strawberry': {
      const pts                  = [];
      for (let i = 0; i <= 12; i++) {
        const tt = i / 12;
        pts.push(new THREE.Vector2(Math.sin(tt * Math.PI) * 0.36 * (0.4 + 0.6 * tt) + 0.001, tt * 0.75));
      }
      const body = mesh(new THREE.LatheGeometry(pts, 20), mat('#e8403a', 0.35));
      body.rotation.z = Math.PI / 2;
      body.position.set(0.35, 0.3, 0);
      g.add(body);
      const leaf = mat('#3fa93a');
      for (let i = 0; i < 5; i++) {
        const l = mesh(new THREE.ConeGeometry(0.08, 0.3, 6), leaf);
        const a = (i / 5) * Math.PI * 2;
        l.position.set(-0.42, 0.3 + Math.sin(a) * 0.12, Math.cos(a) * 0.12);
        l.rotation.z = Math.PI / 2;
        g.add(l);
      }
      const seed = mat('#ffe27a', 0.4);
      for (let i = 0; i < 9; i++) {
        const s = mesh(new THREE.SphereGeometry(0.025, 5, 4), seed, false);
        s.position.set(-0.2 + (i % 3) * 0.2, 0.55 - Math.abs(1 - (i % 3)) * 0.05, -0.15 + Math.floor(i / 3) * 0.15);
        g.add(s);
      }
      break;
    }
    case 'sugar': {
      const m = mat('#fbfbf2', 0.85);
      const cubes = [[0, 0.19, 0, 0.2], [0.42, 0.19, 0.1, -0.3], [0.18, 0.56, 0.05, 0.5], [-0.25, 0.19, 0.38, 0.8]];
      for (const [x, y, z, r] of cubes) {
        const c = mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), m);
        c.position.set(x - 0.1, y, z - 0.1); c.rotation.y = r; g.add(c);
      }
      break;
    }
    case 'cheese': {
      const sh = new THREE.Shape();
      sh.moveTo(-0.7, -0.35); sh.lineTo(0.7, -0.35); sh.lineTo(-0.7, 0.45); sh.lineTo(-0.7, -0.35);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.04, 0);
      const body = mesh(geo, mat('#f7c948', 0.6));
      g.add(body);
      const hole = mat('#e0a92a', 0.7);
      for (const [x, z, r] of [[-0.3, 0.1, 0.1], [0.1, -0.05, 0.07], [-0.45, -0.25, 0.08]]) {
        const h = mesh(new THREE.CylinderGeometry(r, r, 0.02, 12), hole, false);
        h.position.set(x, 0.58, z); g.add(h);
      }
      g.position.y = 0;
      break;
    }
    case 'donut': {
      const dough = mesh(new THREE.TorusGeometry(0.46, 0.24, 14, 28), mat('#e0a35c', 0.7));
      dough.rotation.x = Math.PI / 2; dough.position.y = 0.22; g.add(dough);
      const icing = mesh(new THREE.TorusGeometry(0.46, 0.22, 14, 28), mat('#f59ac0', 0.35));
      icing.rotation.x = Math.PI / 2; icing.scale.z = 0.65; icing.position.y = 0.33; g.add(icing);
      const cols = ['#ffffff', '#5ec6f2', '#ffd52e', '#7ad65a'];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + (i % 3) * 0.2;
        const r = 0.36 + (i % 3) * 0.1;
        const s = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), mat(cols[i % 4], 0.4), false);
        s.position.set(Math.cos(a) * r, 0.47, Math.sin(a) * r);
        s.rotation.y = a * 3.1;
        g.add(s);
      }
      break;
    }
    case 'banana': {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.8, 0.25, 0.15), new THREE.Vector3(-0.4, 0.2, -0.15), new THREE.Vector3(0.1, 0.2, -0.25),
        new THREE.Vector3(0.55, 0.2, -0.1), new THREE.Vector3(0.85, 0.28, 0.2),
      ]);
      const b = mesh(new THREE.TubeGeometry(curve, 32, 0.18, 12, false), mat('#f8dc4a', 0.45));
      g.add(b);
      for (const p of [curve.getPoint(0), curve.getPoint(1)]) {
        const e = mesh(new THREE.SphereGeometry(0.1, 8, 6), mat('#6b4a22', 0.6));
        e.position.copy(p); g.add(e);
      }
      break;
    }
    case 'candy': {
      const body = mesh(new THREE.SphereGeometry(0.3, 18, 12), mat('#ff9a3c', 0.3));
      body.scale.set(1.25, 0.8, 0.85); body.position.y = 0.25; g.add(body);
      const stripe = mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 20), mat('#ffffff', 0.3), false);
      stripe.rotation.y = Math.PI / 2; stripe.scale.set(0.8, 1, 1); stripe.position.y = 0.25; g.add(stripe);
      for (const s of [-1, 1]) {
        const w = mesh(new THREE.ConeGeometry(0.2, 0.32, 10), mat('#ffb86b', 0.4));
        w.rotation.z = s * Math.PI / 2; w.position.set(s * 0.5, 0.25, 0); g.add(w);
      }
      break;
    }
    case 'icecream': {
      const cone = mesh(new THREE.ConeGeometry(0.28, 0.95, 16), mat('#e2a85e', 0.8));
      cone.rotation.z = -Math.PI / 2; cone.position.set(0.45, 0.26, 0); g.add(cone);
      const scoop = mesh(new THREE.SphereGeometry(0.36, 20, 14), mat('#fbb3cf', 0.45));
      scoop.position.set(-0.2, 0.32, 0); g.add(scoop);
      const puddle = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.04, 24), mat('#fbb3cf', 0.3), false);
      puddle.scale.set(1.2, 1, 0.9);
      puddle.position.set(-0.45, 0.02, 0.1); g.add(puddle);
      break;
    }
    case 'grapes': {
      const m = mat('#8d5bd1', 0.3);
      const rows = [4, 3, 3, 2, 1];
      let zz = -0.4;
      for (const n of rows) {
        for (let i = 0; i < n; i++) {
          const s = mesh(new THREE.SphereGeometry(0.16, 14, 10), m);
          s.position.set((i - (n - 1) / 2) * 0.3, 0.16 + (n > 2 ? 0.02 : 0), zz);
          g.add(s);
        }
        zz += 0.24;
      }
      const top = mesh(new THREE.SphereGeometry(0.15, 12, 8), m);
      top.position.set(0, 0.4, -0.15); g.add(top);
      const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), mat('#6a8a32'));
      stem.rotation.x = Math.PI / 2; stem.position.set(0, 0.2, -0.65); g.add(stem);
      break;
    }
  }
  return g;
}

// ---------------- decor ----------------
;                                                                                    

export function buildDecor(kind           , rnd              )                 {
  const g = new THREE.Group();
  switch (kind) {
    case 'tuft': {
      const m = mat(rnd() < 0.5 ? '#5bb83c' : '#66c445', 0.7);
      for (let i = 0; i < 5; i++) {
        const b = mesh(new THREE.ConeGeometry(0.09, 0.5 + rnd() * 0.3, 6), m);
        b.scale.z = 0.75;
        b.position.set((i - 2) * 0.08, 0.25, (rnd() - 0.5) * 0.1);
        b.rotation.z = (i - 2) * 0.22;
        b.rotation.x = (rnd() - 0.5) * 0.4;
        g.add(b);
      }
      break;
    }
    case 'pebble': {
      const p = mesh(new THREE.SphereGeometry(0.22 + rnd() * 0.2, 14, 10), mat(rnd() < 0.5 ? '#9a86a8' : '#b49aae', 0.8));
      p.scale.y = 0.6; p.position.y = 0.05; g.add(p);
      break;
    }
    case 'mushroom': {
      const st = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.25, 8), mat('#f4ecd8'));
      st.position.y = 0.12; g.add(st);
      const cap = mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e84a3a', 0.4));
      cap.position.y = 0.22; g.add(cap);
      break;
    }
    case 'shell': {
      const s = mesh(new THREE.ConeGeometry(0.18, 0.3, 10), mat(rnd() < 0.5 ? '#fbd3c4' : '#fff1e0', 0.5));
      s.rotation.x = Math.PI / 2; s.scale.y = 0.6; s.position.y = 0.06; g.add(s);
      break;
    }
    case 'twig': {
      const s = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6), mat('#9a6a3a', 0.8));
      s.rotation.z = Math.PI / 2; s.position.y = 0.05; g.add(s);
      break;
    }
    case 'clover': {
      const m = mat('#6cc94a', 0.6);
      for (let i = 0; i < 3; i++) {
        const l = mesh(new THREE.SphereGeometry(0.1, 10, 6), m, false);
        const a = (i / 3) * Math.PI * 2;
        l.scale.y = 0.25; l.position.set(Math.cos(a) * 0.09, 0.03, Math.sin(a) * 0.09); g.add(l);
      }
      break;
    }
  }
  return g;
}

export function buildNest()              {
  const g = new THREE.Group();
  const sand = mat('#de9461', 0.9);
  const mound = mesh(new THREE.SphereGeometry(1.2, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), sand);
  mound.scale.set(1.15, 0.62, 0.95);
  g.add(mound);
  const hole = mesh(new THREE.SphereGeometry(0.38, 20, 14), mat('#4a2c2c', 0.95), false);
  hole.scale.set(1.1, 0.75, 0.5);
  hole.position.set(-0.15, 0.25, 0.85);
  g.add(hole);
  for (const [x, z, r] of [[-1.25, 0.6, 0.25], [1.1, 0.75, 0.2], [0.5, 1.05, 0.14], [-0.8, 1.0, 0.16]]) {
    const c = mesh(new THREE.SphereGeometry(r, 12, 8), sand);
    c.scale.y = 0.7; c.position.set(x, r * 0.3, z); g.add(c);
  }
  return g;
}
