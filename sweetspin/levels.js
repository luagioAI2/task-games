// Deterministic hex pipe level generator (flat-top hexes, odd-q offset layout).
// Edge index: 0=N 1=NE 2=SE 3=S 4=SW 5=NW (clockwise, screen y down).

export const AX_DIRS = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];

                                                  
                          
                                                 
                 
                                              
                                                 
                                     
 
                                                                                        

function rng(seed        ) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function rotMask(m        , k        ) {
  k = ((k % 6) + 6) % 6;
  return ((m << k) | (m >> (6 - k))) & 63;
}

/** Minimal clockwise taps to bring base mask (at rotation cur) to target mask. */
export function stepsTo(base        , cur        , target        ) {
  for (let s = 0; s < 6; s++) if (rotMask(base, cur + s) === target) return s;
  return 0;
}

const key = (q        , r        ) => q + ',' + r;

export function levelParams(L        ) {
  const cols = Math.min(7, 3 + Math.floor((L - 1) / 14));
  const rows = Math.min(9, 3 + Math.floor((L - 1) / 9));
  const holeFrac = L <= 4 ? 0 : Math.min(0.16, 0.05 + L * 0.0012);
  const branch = Math.min(0.75, 0.25 + L * 0.005);
  return { cols, rows, holeFrac, branch };
}

export function generateLevel(L        )           {
  const { cols, rows, holeFrac, branch } = levelParams(L);
  const rand = rng(L * 7919 + 1337);
  // all cells
  let cells                                                       = [];
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    cells.push({ col: c, row: rr, q: c, r: rr - (c - (c & 1)) / 2 });
  }
  // punch holes keeping connectivity
  const isConnected = (set                  ) => {
    const first = set.values().next().value;
    if (!first) return false;
    const seen = new Set        ([key(first.q, first.r)]);
    const stack = [first];
    while (stack.length) {
      const c = stack.pop();
      for (const [dq, dr] of AX_DIRS) {
        const k = key(c.q + dq, c.r + dr);
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(set.get(k)); }
      }
    }
    return seen.size === set.size;
  };
  const map = new Map             ();
  for (const c of cells) map.set(key(c.q, c.r), c);
  let holes = Math.floor(cells.length * holeFrac);
  let tries = 0;
  while (holes > 0 && tries < 200) {
    tries++;
    const c = cells[Math.floor(rand() * cells.length)];
    const k = key(c.q, c.r);
    if (!map.has(k)) continue;
    map.delete(k);
    if (!isConnected(map)) { map.set(k, c); continue; }
    holes--;
  }
  cells = [...map.values()];

  // spanning tree (growing tree algorithm: newest vs random mix)
  const masks = new Map                ();
  for (const c of cells) masks.set(key(c.q, c.r), 0);
  const root = cells[Math.floor(rand() * cells.length)];
  const inTree = new Set        ([key(root.q, root.r)]);
  const active = [root];
  while (active.length) {
    const idx = rand() < branch ? Math.floor(rand() * active.length) : active.length - 1;
    const c = active[idx];
    const opts           = [];
    for (let d = 0; d < 6; d++) {
      const k = key(c.q + AX_DIRS[d][0], c.r + AX_DIRS[d][1]);
      if (map.has(k) && !inTree.has(k)) opts.push(d);
    }
    // limit degree to 3 for readability (source up to 3 too)
    const deg = bitCount(masks.get(key(c.q, c.r)) );
    if (!opts.length || deg >= 3) { active.splice(idx, 1); continue; }
    const d = opts[Math.floor(rand() * opts.length)];
    const n = map.get(key(c.q + AX_DIRS[d][0], c.r + AX_DIRS[d][1]));
    masks.set(key(c.q, c.r), masks.get(key(c.q, c.r))  | (1 << d));
    masks.set(key(n.q, n.r), masks.get(key(n.q, n.r))  | (1 << ((d + 3) % 6)));
    inTree.add(key(n.q, n.r));
    active.push(n);
  }
  // cells not reached (degree cap) — attach them to any tree neighbor
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of cells) {
      const k = key(c.q, c.r);
      if (inTree.has(k)) continue;
      for (let d = 0; d < 6; d++) {
        const nk = key(c.q + AX_DIRS[d][0], c.r + AX_DIRS[d][1]);
        if (inTree.has(nk)) {
          masks.set(k, masks.get(k)  | (1 << d));
          masks.set(nk, masks.get(nk)  | (1 << ((d + 3) % 6)));
          inTree.add(k); changed = true; break;
        }
      }
    }
  }

  const out            = [];
  let par = 0;
  for (const c of cells) {
    const k = key(c.q, c.r);
    const mask = masks.get(k) ;
    const isRoot = c === root;
    const kind           = isRoot ? 'source' : bitCount(mask) === 1 ? 'bulb' : 'pipe';
    out.push({ ...c, kind, mask, start: 0, color: Math.floor(rand() * 5) });
  }
  // scramble: start rotation; mask stored as solved, displayed = rotMask(mask, start)
  const maxOff = L < 10 ? 2 : L < 30 ? 3 : L < 60 ? 4 : 5;
  const keepFrac = L < 10 ? 0.35 : L < 30 ? 0.2 : 0.08;
  for (const c of out) {
    const s = rand() < keepFrac ? 0 : 1 + Math.floor(rand() * maxOff);
    c.start = (6 - s) % 6;
    par += stepsTo(c.mask, c.start, c.mask);
  }
  if (par === 0) { out[0].start = (out[0].start + 1) % 6; par = stepsTo(out[0].mask, out[0].start, out[0].mask); }
  // recompute par cleanly
  par = 0;
  for (const c of out) par += stepsTo(c.mask, c.start, c.mask);
  return { cols, rows, cells: out, par };
}

export function bitCount(m        ) { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; }
