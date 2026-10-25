// Single source of game settings: title, machine tuning, prize data, palette.
export const GAME = {
  title: "PRIZE PARK",
  // 调试台（爪力 / 必定GET / 切换POP）。
  // ⚠️ 默认**关**：里面的「必定GET」在真有经济系统的版本里就是一个洞
  // （免费抓娃娃 → 卖娃娃 → 换币）。调爪子参数时临时改回 true，
  // 发出去的包必须是 false。自动化测试不用它 —— 走 window.__debug（不受这个开关影响）。
  testMode: false,
}         ;

export const PALETTE = {
  pink: 0xff8fb8,
  lavender: 0xa995ff,
  mint: 0x7de2d1,
  cream: 0xfff3d8,
  ink: 0x302a4a,
  disabled: 0xb8b0cc,
  cabinet: 0xf7f4fa,
  acrylic: 0xdde9ff,
  steel: 0xcfd3e0,
}         ;

export const BEAR_FUR = [0xd9a66c, 0xe8b989, 0xc98f5c, 0xf0c9a0, 0xd4975f, 0xe2ae7e]         ;

                                
             
                  
                  
                
                             
                    
                                              
                                                                         
                                            
                                         
                                 
                                       
                          
                                                                                                                                       
                                                                  
                                           
                    
                                         
                     
                                                  
                    
                                                       
                                                
                                                                                                          
                                                                                                                                                    
                                                                                                 
                                 
                                                                                         
 

// POP slot: image path + placement on the back panel. x/y are fractions of the panel (0..1, from left/bottom), width is a fraction of panel width; aspect comes from the image itself.
                                                                                
                                                                           

// Ready-made POPs available to the TEST menu "POP切り替え" (and to a future admin screen)
export const POP_LIBRARY                         = {
  bigbear: "assets/pop-bigbear-main.webp", pillow: "assets/pop-pillow.webp", figure: "assets/pop-lumiere.webp", noctis: "assets/pop-noctis.webp", mascot: "assets/pop-mascot.webp", bigbearOld: "assets/pop-bigbear.webp", neighborA: "assets/pop-neighbor-a.webp", neighborB: "assets/pop-neighbor-b.webp", bridge: "assets/pop-bridge.webp", cake: "assets/pop-cake-plate.webp", takoyaki: "assets/pop-takoyaki.webp", sweets: "assets/pop-sweets.webp",
  badgeNew: "assets/pop-badge-new.webp", badgeHot: "assets/pop-badge-hot.webp",
};

                           
                                                  
                   
                                                             
                                                                                         
                
                                
                                                     
                                                                                                                  
                                                                                                      
 

// BIG CUDDLE PILLOW: 6 long pillows, mixed species, lying at varied yaws, none over the front-left chute (chute cx -1.5, cz 1.2)
const PILLOW_PRIZES             = [
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.9, 0.5, -1.0], rot: [0, 0.25, 0], pillow: "pillow_pig" },
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.9, 0.5, -1.1], rot: [0, -0.7, 0], pillow: "pillow_rabbit" },
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [1.2, 0.5, 0.35], rot: [0, 1.15, 0], pillow: "pillow_dog" },
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.1, 1.25, -0.35], rot: [0, -0.35, 0.12], pillow: "pillow_dog" },
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.2, 0.5, 0.25], rot: [0, 0.55, 0], pillow: "pillow_pig" },
  { weight: 1.0, friction: 0.9, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.7, 1.25, -0.5], rot: [0, 0.85, -0.1], pillow: "pillow_rabbit" },
];

// 3 bears, deterministic initial layout (no runtime randomness) — one upright, one lying, one leaning.
const BEAR_PRIZES             = [
  { weight: 1.00, friction: 0.90, centerOfMass: 0.2, grabPowerModifier: 1.00, scale: 1.00, pos: [-0.1, 0.62, -0.5], rot: [-0.1, 0.35, 0] },
  { weight: 0.92, friction: 0.85, centerOfMass: -0.1, grabPowerModifier: 1.05, scale: 0.96, pos: [1.15, 0.6, 0.4], rot: [-1.5, 0.9, 0] },
  { weight: 1.08, friction: 0.95, centerOfMass: 0.4, grabPowerModifier: 0.95, scale: 1.04, pos: [0.75, 0.62, -1.15], rot: [-0.1, -0.9, 0] },
];

const baseMachine = {
  caseW: 4.8, caseD: 4.0, caseH: 5.2,
  chute: { cx: -1.5, cz: 1.2, w: 1.6, d: 1.5, depth: 2.3 },
  home: { x: -1.5, z: 1.2, y: 4.55 },
  limits: { xMax: 2.0, zMin: -1.55 },
  speedX: 0.8, speedZ: 0.62,
  accelTime: 0.15, decelTime: 0.1,
  descentDistance: 3.65,
  descentTime: 2.0, closeTime: 0.7, holdTime: 0.45, liftTime: 2.0, homeTime: 2.5, releaseTime: 0.6, settleMax: 3.0,
  armPower: 1.0, armWidth: 0.16, fingerLen: 0.82,
  openAngle: 0.95, closedAngle: -0.22,
};

export const MACHINES                  = [
  { ...baseMachine, id: "big-bear", nameKey: "m_bigbear", prizeId: "bear", price: 1, difficulty: 2, playable: true, kind: "grab", prizes: BEAR_PRIZES,
    pops: { main: { image: POP_LIBRARY.bigbear, x: 0.5, y: 0.58, width: 0.74 }, sub1: { image: POP_LIBRARY.badgeNew, x: 0.08, y: 0.9, width: 0.13 }, sub2: { image: POP_LIBRARY.badgeHot, x: 0.92, y: 0.9, width: 0.13 } } },
  // BIG CUDDLE PILLOW: same cabinet / camera / controls / chute as BIG bear, 3-finger large claw, long soft pillows
  { ...baseMachine, id: "big-pillow", nameKey: "m_pillow", prizeId: "pillow_pig", price: 1, difficulty: 2, playable: true, kind: "grab", claws: 3, isNew: true, prizes: PILLOW_PRIZES,
    armPower: 0.8, armWidth: 0.42, fingerLen: 1.15, openAngle: 0.5, closedAngle: -0.05, led: { a: 0xffc2d4, b: 0xbfd8ff },
    pops: { main: { image: POP_LIBRARY.pillow, x: 0.5, y: 0.58, width: 0.8 } } },
  {
    ...baseMachine, id: "bridge", nameKey: "m_bridge", prizeId: "figure", price: 1, difficulty: 3, playable: true, kind: "bridge",
    // bridge machine: chute is the whole pit under the bars; home is above the pit's front-left so a box can't be carried, only pushed
    chute: { cx: 0, cz: 0, w: 4.6, d: 3.8, depth: 2.3 }, home: { x: -1.6, z: 1.3, y: 4.55 }, limits: { xMax: 1.9, zMin: -1.5 },
    // wide open (≈1.45× the old spread) so both tips clear the box sides; descent runs to the bars, never stops on box contact; medium power (tilt/shift, not carry)
    descentDistance: 3.5, descentTime: 3.2, armWidth: 0.14, fingerLen: 1.08, openAngle: 0.8, closedAngle: -0.1, armPower: 0.13,
    // fixed floor for the claw HEAD: palm stays above the box top (box top ≈1.42); the longer fingers reach the box bottom / bar level from there
    minClawY: 1.85,
    bridge: { gap: 0.55, barR: 0.05, barY: 0.95, barLen: 3.4, zCenter: -0.1, friction: 0.7, box: { w: 0.6, h: 1.05, d: 0.42 } },
    led: { a: 0x8fd8ff, b: 0xc9b8ff },
    prizes: [
      // box lies across both bars (long axis along z), slightly yawed so the corners can be worked
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.15, 1.23, -0.1], rot: [-Math.PI / 2, 0, 0.08] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.0, 1.23, -0.1], rot: [-Math.PI / 2, 0, -0.08] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.1, 1.23, -0.1], rot: [-Math.PI / 2, 0, 0.06] },
    ],
    pops: { main: { image: POP_LIBRARY.figure, x: 0.5, y: 0.6, width: 0.9 } },
  },
  {
    // CAKE PLATE & FORK SET bridge: a verbatim clone of the "bridge" (figure) machine — same cabinet, bars, claw, physics, staff restock;
    // only the prize id, box sheet, POP and LED colours differ. Do not tune this block independently of "bridge".
    ...baseMachine, id: "cake-bridge", nameKey: "m_cake_bridge", prizeId: "cake_set", price: 1, difficulty: 3, playable: true, kind: "bridge", isNew: true, theme: "cafe",
    chute: { cx: 0, cz: 0, w: 4.6, d: 3.8, depth: 2.3 }, home: { x: -1.6, z: 1.3, y: 4.55 }, limits: { xMax: 1.9, zMin: -1.5 },
    descentDistance: 3.5, descentTime: 3.2, armWidth: 0.14, fingerLen: 1.08, openAngle: 0.8, closedAngle: -0.1, armPower: 0.13,
    minClawY: 1.85,
    // cake box = near-square gift package (front w:h ≈ 1:1.1, height ≈ 25% lower than the old 0.8). Lying across the bars: centre y = barY + barR + d/2 = 1.16
    bridge: { gap: 0.55, barR: 0.05, barY: 0.95, barLen: 3.4, zCenter: -0.1, friction: 0.7, box: { w: 0.54, h: 0.6, d: 0.32 } },
    led: { a: 0xffb6c9, b: 0xffe5cf },
    prizes: [
      // one live box on the bridge; the rest are stock (static display behind the bars, restocked by staff)
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.12, 1.16, -0.1], rot: [-Math.PI / 2, 0, 0.06] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.0, 1.16, -0.1], rot: [-Math.PI / 2, 0, -0.06] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.1, 1.16, -0.1], rot: [-Math.PI / 2, 0, 0.05] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.05, 1.16, -0.1], rot: [-Math.PI / 2, 0, 0.04] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.05, 1.16, -0.1], rot: [-Math.PI / 2, 0, -0.05] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.08, 1.16, -0.1], rot: [-Math.PI / 2, 0, 0.03] },
    ],
    pops: { main: { image: POP_LIBRARY.cake, x: 0.5, y: 0.66, width: 0.96 } },
  },
  {
    ...baseMachine, id: "bridge-noctis", nameKey: "m_bridge_noctis", prizeId: "noctis", price: 1, difficulty: 3, playable: true, kind: "bridge", isNew: true,
    // bridge machine: chute is the whole pit under the bars; home is above the pit's front-left so a box can't be carried, only pushed
    chute: { cx: 0, cz: 0, w: 4.6, d: 3.8, depth: 2.3 }, home: { x: -1.6, z: 1.3, y: 4.55 }, limits: { xMax: 1.9, zMin: -1.5 },
    // wide open (≈1.45× the old spread) so both tips clear the box sides; descent runs to the bars, never stops on box contact; medium power (tilt/shift, not carry)
    descentDistance: 3.5, descentTime: 3.2, armWidth: 0.14, fingerLen: 1.08, openAngle: 0.8, closedAngle: -0.1, armPower: 0.13,
    // fixed floor for the claw HEAD: palm stays above the box top (box top ≈1.42); the longer fingers reach the box bottom / bar level from there
    minClawY: 1.85,
    bridge: { gap: 0.55, barR: 0.05, barY: 0.95, barLen: 3.4, zCenter: -0.1, friction: 0.7, box: { w: 0.6, h: 1.05, d: 0.42 } },
    led: { a: 0x8fd8ff, b: 0xc9b8ff },
    prizes: [
      // box lies across both bars (long axis along z), slightly yawed so the corners can be worked
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.15, 1.23, -0.1], rot: [-Math.PI / 2, 0, 0.08] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [0.0, 1.23, -0.1], rot: [-Math.PI / 2, 0, -0.08] },
      { weight: 1.0, friction: 0.7, centerOfMass: 0, grabPowerModifier: 1, scale: 1, pos: [-0.1, 1.23, -0.1], rot: [-Math.PI / 2, 0, 0.06] },
    ],
    pops: { main: { image: POP_LIBRARY.noctis, x: 0.5, y: 0.6, width: 0.9 } },
  },
  { ...baseMachine, id: "takoyaki", nameKey: "m_takoyaki", prizeId: "figure", price: 1, difficulty: 2, playable: true, kind: "takoyaki", isNew: true,
    // scoop crane: home over the left ball pool, travels right/back over the pool only; the drop point over the plate is fixed (TAKO in game.ts)
    home: { x: -2.0, z: 0.7, y: 3.4 }, limits: { xMax: -1.0, zMin: -0.7 }, speedX: 0.7, speedZ: 0.6,
    descentDistance: 2.75, descentTime: 1.8, liftTime: 1.8, homeTime: 4.2, releaseTime: 2.0, settleMax: 6.0,
    prizes: [], led: { a: 0xffb347, b: 0xff8fb8 }, pops: { main: { image: POP_LIBRARY.figure, x: 0.5, y: 0.62, width: 0.8 } } },
  { ...baseMachine, id: "takoyaki-noctis", nameKey: "m_tako_noctis", prizeId: "noctis", price: 1, difficulty: 2, playable: true, kind: "takoyaki", isNew: true,
    // scoop crane: home over the left ball pool, travels right/back over the pool only; the drop point over the plate is fixed (TAKO in game.ts)
    home: { x: -2.0, z: 0.7, y: 3.4 }, limits: { xMax: -1.0, zMin: -0.7 }, speedX: 0.7, speedZ: 0.6,
    descentDistance: 2.75, descentTime: 1.8, liftTime: 1.8, homeTime: 4.2, releaseTime: 2.0, settleMax: 6.0,
    prizes: [], led: { a: 0x7fa8ff, b: 0xa995ff }, pops: { main: { image: POP_LIBRARY.noctis, x: 0.5, y: 0.62, width: 0.8 } } },
  { ...baseMachine, id: "mascot", nameKey: "m_mascot", prizeId: "mascot_bear", price: 1, difficulty: 2, playable: true, kind: "grab", mascot: true, isNew: true, claws: 3,
    // mini mascot pool: smaller, slightly weaker claw (0-1 per play), same chute logic as BIG Bear
    armPower: 0.8, armWidth: 0.3, fingerLen: 0.75, openAngle: 0.45, closedAngle: -0.05, descentDistance: 3.8,
    prizes: [], led: { a: 0xffb8d0, b: 0xa995ff }, pops: { main: { image: POP_LIBRARY.mascot, x: 0.5, y: 0.6, width: 0.8 } } },
  { ...baseMachine, id: "sweets", nameKey: "m_sweets", prizeId: "sweet_chips", price: 1, difficulty: 2, playable: true, kind: "sweets", isNew: true,
    // wide front chute; a deep pile of light snacks behind a low step. Claw is the standard 2-finger, a little wider, weaker grip (nudging the pile is the main play)
    chute: { cx: 0, cz: 1.35, w: 2.6, d: 1.0, depth: 2.3 }, home: { x: 0, z: 1.35, y: 4.55 }, limits: { xMax: 2.0, zMin: -1.55 },
    descentDistance: 3.4, openAngle: 1.0, armPower: 0.55, fingerLen: 0.9,
    prizes: [], led: { a: 0xffd166, b: 0xff8fb8 }, pops: { main: { image: POP_LIBRARY.sweets, x: 0.5, y: 0.62, width: 0.72 } } },
];

export const PRIZE_META                                                                       = {
  bear: { nameKey: "p_bear", rarity: 2, descKey: "pd_bear" },
  pillow_pig: { nameKey: "p_ppig", rarity: 2, descKey: "pd_pillow" },
  pillow_rabbit: { nameKey: "p_prabbit", rarity: 2, descKey: "pd_pillow" },
  pillow_dog: { nameKey: "p_pdog", rarity: 2, descKey: "pd_pillow" },
  figure: { nameKey: "p_figure", rarity: 3, descKey: "pd_figure" },
  cake_set: { nameKey: "p_cake_set", rarity: 2, descKey: "pd_cake_set" },
  cake_parfait: { nameKey: "p_cake_parfait", rarity: 2, descKey: "pd_cake_parfait" },
  noctis: { nameKey: "p_noctis", rarity: 3, descKey: "pd_noctis" },
  sweet_chips: { nameKey: "p_chips", rarity: 1, descKey: "pd_sweet" },
  sweet_choco: { nameKey: "p_choco", rarity: 1, descKey: "pd_sweet" },
  sweet_gummy: { nameKey: "p_gummy", rarity: 1, descKey: "pd_sweet" },
  sweet_cookie: { nameKey: "p_cookie", rarity: 1, descKey: "pd_sweet" },
  snackbox: { nameKey: "p_snackbox", rarity: 1, descKey: "pd_sweet" },
  mascot_bear: { nameKey: "p_mbear", rarity: 2, descKey: "pd_mascot" },
  mascot_rabbit: { nameKey: "p_mrabbit", rarity: 2, descKey: "pd_mascot" },
  mascot_cat: { nameKey: "p_mcat", rarity: 2, descKey: "pd_mascot" },
  mascot_dog: { nameKey: "p_mdog", rarity: 2, descKey: "pd_mascot" },
  mascot_chick: { nameKey: "p_mchick", rarity: 2, descKey: "pd_mascot" },
  mascot_panda: { nameKey: "p_mpanda", rarity: 2, descKey: "pd_mascot" },
};

export const PHYSICS = {
  fixedDt: 1 / 120,
  maxStepsPerFrame: 8,
  maxLinVel: 7,
  maxAngVel: 12,
  getHoldTime: 0.35,
}         ;
