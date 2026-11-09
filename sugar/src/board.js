// 棋盘模块：6×5 糖珠模型、自由拖珠逐格交换、5 秒计时环、三连/连锁/落珠补珠、奶油封印
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { sched, EaseInQuad, EaseOutBack, EaseOutQuad } from './tween.js';

export const COLS = 6;
export const ROWS = 5;
export const DRAG_TIME = 5;
export const CELL = 62;
export const GAP = 4;
export const PITCH = CELL + GAP;
export const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
export const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;

// 四方向单位向量（角度吸附用）：右下左上
const DIRS4 = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

                          
            
            
 
                             
               
                   
 
                       
                
                       
                      
 

               
               
                 
                
                         
            
            
 

                             
                     
                      
                    
                              
                                                   
                                   
                 
                                    
 

export class Board {
  container = new Container();
           colors          ;
          textures           ;
          hooks            ;
          orbs                   = [];
          orbLayer = new Container();
          fxLayer = new Container();
          boardAuraG = new Graphics();
          boardSweepG = new Graphics();
          boardSweepHG = new Graphics();
          cellGlowLayer = new Container();
          cellGlows             = [];
          orbGlints             = [];
          boardMotes             = [];
          borderComets             = [];
          ringG = new Graphics();
          shadowG = new Graphics();
          dragging             = null;
          dragT = 0;
          dragSteps = 0;
          resolving = false;
          animT = 0;
          lastPX = 0;
          lastPY = 0;
          pathG = new Graphics();
          path                             = [];
          bs = 0.05; // 糖珠基准缩放（纹理 1024px → 单元格内 0.92 倍）

  constructor(textures           , colors          , hooks            ) {
    this.textures = textures;
    this.colors = colors;
    this.hooks = hooks;
    this.bs = (CELL * 0.92) / textures[0].width;
    // 棋盘外沿双层呼吸光：始终很淡，只负责把下半区“托”起来。
    this.boardAuraG.roundRect(-17, -17, BOARD_W + 34, BOARD_H + 34, 25).stroke({ width: 4, color: 0xc4b2e0, alpha: 0.34 });
    this.boardAuraG.roundRect(-13, -13, BOARD_W + 26, BOARD_H + 26, 21).stroke({ width: 6, color: 0xffffff, alpha: 0.24 });
    this.container.addChild(this.boardAuraG);
    // 托盘底板 + 内凹格（软陶立体感）
    const tray = new Graphics();
    tray.roundRect(-12, -12, BOARD_W + 24, BOARD_H + 24, 20).fill({ color: 0xe7d5e2, alpha: 0.9 }).stroke({ width: 3, color: 0x8a6d5c, alpha: 0.25 });
    this.container.addChild(tray);
    const slots = new Graphics();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        slots.roundRect(c * PITCH - 2, r * PITCH - 2, CELL + 4, CELL + 4, 12).fill({ color: 0xd9c6d6, alpha: 0.9 });
        slots.roundRect(c * PITCH + 1, r * PITCH + 1, CELL - 2, CELL - 2, 10).fill({ color: 0xfff9ee, alpha: 0.85 });
      }
    this.container.addChild(slots);
    // 每个格子一层属性色底光，颜色跟随当前糖珠类型。
    this.container.addChild(this.cellGlowLayer);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const g = new Graphics();
        g.circle(0, 0, CELL * 0.43).fill({ color: 0xffffff, alpha: 0.28 });
        g.circle(0, 0, CELL * 0.38).stroke({ width: 2, color: 0xffffff, alpha: 0.52 });
        const p = this.cellCenter(r, c);
        g.position.set(p.x, p.y);
        g.alpha = 0.18;
        this.cellGlowLayer.addChild(g);
        this.cellGlows.push(g);
      }
    // 一道很轻的纵向扫光，从格子下方穿过，不盖住糖珠纹理。
    this.boardSweepG.roundRect(0, 0, 22, BOARD_H, 11).fill({ color: 0xffffff, alpha: 0.18 });
    this.boardSweepG.x = -18;
    this.container.addChild(this.boardSweepG);
    this.boardSweepHG.roundRect(0, 0, BOARD_W, 18, 9).fill({ color: 0xffe38a, alpha: 0.14 });
    this.boardSweepHG.y = -16;
    this.container.addChild(this.boardSweepHG);
    this.container.addChild(this.orbLayer);
    this.container.addChild(this.pathG);
    this.pathG.visible = false;
    this.container.addChild(this.fxLayer);
    // 少量常驻高光，错峰闪烁，避免 30 颗珠子同时“呼吸”造成视觉噪音。
    for (let i = 0; i < 12; i++) {
      const g = new Graphics();
      g.moveTo(0, -5).lineTo(1.5, -1.5).lineTo(5, 0).lineTo(1.5, 1.5).lineTo(0, 5).lineTo(-1.5, 1.5).lineTo(-5, 0).lineTo(-1.5, -1.5).closePath().fill({ color: 0xffffff, alpha: 0.9 });
      const idx = (i * 7 + 3) % (ROWS * COLS);
      const p = this.cellCenter(Math.floor(idx / COLS), idx % COLS);
      g.position.set(p.x - 15 + (i % 2) * 4, p.y - 15 + (i % 3));
      g.alpha = 0;
      this.fxLayer.addChild(g);
      this.orbGlints.push(g);
    }
    // 棋盘内部缓慢漂移的光尘，覆盖面积小且不会拦截指针。
    for (let i = 0; i < 14; i++) {
      const g = new Graphics();
      const radius = 1.2 + (i % 3) * 0.65;
      g.circle(0, 0, radius + 2.8).fill({ color: 0xffffff, alpha: 0.07 });
      g.circle(0, 0, radius).fill({ color: i % 3 === 0 ? 0xffe38a : 0xffffff, alpha: 0.82 });
      const baseX = 12 + ((i * 83) % (BOARD_W - 24));
      const baseY = 12 + ((i * 61) % (BOARD_H - 24));
      g.position.set(baseX, baseY);
      this.fxLayer.addChild(g);
      this.boardMotes.push({ g, baseX, baseY, phase: i * 0.69 });
    }
    // 沿外框巡游的光点，强调棋盘边界与能量流向。
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      g.circle(0, 0, 8).fill({ color: this.colors[i % this.colors.length], alpha: 0.08 });
      g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.92 });
      this.container.addChild(g);
      this.borderComets.push(g);
    }
    this.shadowG.visible = false;
    this.container.addChild(this.shadowG);
    this.ringG.visible = false;
    this.container.addChild(this.ringG);
  }

  get busy()          {
    return this.resolving || this.dragging !== null;
  }

  cellCenter(r        , c        )                           {
    return { x: c * PITCH + CELL / 2, y: r * PITCH + CELL / 2 };
  }

  reset(types            )       {
    this.orbLayer.removeChildren().forEach((c) => c.destroy());
    this.orbs = [];
    for (let r = 0; r < ROWS; r++) {
      this.orbs.push([]);
      for (let c = 0; c < COLS; c++) {
        const orb = this.createOrb(types[r][c], r, c);
        orb.sprite.scale.set(0);
        const d = 0.15 + (r * COLS + c) * 0.014;
        sched.tween(d, () => {}, EaseOutQuad, () => {
          sched.tween(0.22, (k) => orb.sprite.scale.set(k * this.bs), EaseOutBack);
        });
      }
    }
  }

  setTypes(types            )       {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const orb = this.orbs[r][c];
        if (!orb) continue;
        orb.type = types[r][c];
        orb.sprite.texture = this.textures[orb.type];
      }
  }

  getTypes()             {
    return this.orbs.map((row) => row.map((o) => (o ? o.type : -1)));
  }

  // 空洞检测：模型缺珠 / 精灵已销毁 / 缩放卡死不可见
  holes()           {
    const out           = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const o = this.orbs[r][c];
        if (!o) out.push(`${r},${c}:null`);
        else if (o.sprite.destroyed) out.push(`${r},${c}:destroyed`);
        else if (o.sprite.scale.x < this.bs * 0.2) out.push(`${r},${c}:tiny`);
        else {
          const p = this.cellCenter(o.r, o.c);
          if (Math.abs(o.sprite.x - p.x) > 2 || Math.abs(o.sprite.y - p.y) > 2) out.push(`${r},${c}:offpos(${o.sprite.x.toFixed(0)},${o.sprite.y.toFixed(0)})`);
        }
      }
    return out;
  }

          createOrb(type        , r        , c        )      {
    const sprite = new Sprite(this.textures[type]);
    sprite.anchor.set(0.5);
    sprite.scale.set(this.bs);
    const p = this.cellCenter(r, c);
    sprite.position.set(p.x, p.y);
    this.orbLayer.addChild(sprite);
    const orb      = { type, sprite, seal: false, sealG: null, r, c };
    this.orbs[r][c] = orb;
    return orb;
  }

          pointerToCell(x        , y        )                 {
    if (x < -GAP || y < -GAP || x > BOARD_W + GAP || y > BOARD_H + GAP) return null;
    const c = Math.max(0, Math.min(COLS - 1, Math.floor(x / PITCH)));
    const r = Math.max(0, Math.min(ROWS - 1, Math.floor(y / PITCH)));
    return { r, c };
  }

  pointerDown(x        , y        )          {
    if (!this.hooks.canDrag() || this.dragging || this.resolving) return false;
    const cell = this.pointerToCell(x, y);
    if (!cell) return false;
    const orb = this.orbs[cell.r][cell.c];
    if (!orb) return false;
    this.settleIdleOrbs();
    this.dragging = orb;
    this.dragT = DRAG_TIME;
    this.dragSteps = 0;
    this.lastPX = Math.max(CELL / 2, Math.min(BOARD_W - CELL / 2, x));
    this.lastPY = Math.max(CELL / 2, Math.min(BOARD_H - CELL / 2, y));
    this.path = [this.cellCenter(orb.r, orb.c)];
    this.pathG.visible = true;
    this.pathG.alpha = 1;
    this.redrawPath(this.lastPX, this.lastPY);
    this.orbLayer.addChild(orb.sprite); // 置顶
    sched.tween(0.06, (k) => orb.sprite.scale.set(this.bs * (1 + k * 0.08)), EaseOutQuad);
    this.shadowG.visible = true;
    this.ringG.visible = true;
    this.hooks.onDragStart();
    return true;
  }

  pointerMove(x        , y        )       {
    const orb = this.dragging;
    if (!orb) return;
    const cx = Math.max(CELL / 2, Math.min(BOARD_W - CELL / 2, x));
    const cy = Math.max(CELL / 2, Math.min(BOARD_H - CELL / 2, y));
    orb.sprite.position.set(cx, cy);
    // 四方向角度吸附：指针越过当前格边界时，按出离角最近的主轴方向换位（无斜换）
    let guard = 0;
    while (guard++ < 6) {
      const cc = this.cellCenter(orb.r, orb.c);
      const vx = cx - cc.x;
      const vy = cy - cc.y;
      if (Math.max(Math.abs(vx), Math.abs(vy)) <= PITCH / 2) break;
      const sector = Math.round(Math.atan2(vy, vx) / (Math.PI / 2));
      const dir = DIRS4[((sector % 4) + 4) % 4];
      this.swapDragged(orb.r + dir[0], orb.c + dir[1]);
    }
    this.redrawPath(cx, cy);
  }

          redrawPath(x        , y        )       {
    const g = this.pathG;
    g.clear();
    if (!this.path.length) return;
    const trace = () => {
      g.moveTo(this.path[0].x, this.path[0].y);
      for (let i = 1; i < this.path.length; i++) g.lineTo(this.path[i].x, this.path[i].y);
      g.lineTo(x, y);
    };
    trace();
    g.stroke({ width: 10, color: 0xffffff, alpha: 0.4, cap: 'round', join: 'round' });
    trace();
    g.stroke({ width: 4, color: 0xfff9ee, alpha: 0.85, cap: 'round', join: 'round' });
  }

  pathLength()         {
    return this.path.length;
  }

          swapDragged(nr        , nc        )       {
    const orb = this.dragging;
    if (!orb) return;
    const other = this.orbs[nr]?.[nc];
    if (!other) return;
    // 交换模型
    this.orbs[orb.r][orb.c] = other;
    this.orbs[nr][nc] = orb;
    const oldR = orb.r;
    const oldC = orb.c;
    orb.r = nr;
    orb.c = nc;
    other.r = oldR;
    other.c = oldC;
    // 被经过的糖珠弹性换位
    const tp = this.cellCenter(other.r, other.c);
    const sx = other.sprite.x;
    const sy = other.sprite.y;
    sched.tween(0.09, (k) => other.sprite.position.set(sx + (tp.x - sx) * k, sy + (tp.y - sy) * k), EaseOutBack);
    // 走位路径记录
    this.path.push(this.cellCenter(orb.r, orb.c));
    this.dragSteps++;
    this.hooks.onStep(this.dragSteps);
  }

  pointerUp()       {
    this.finishDrag();
  }

          finishDrag()       {
    const orb = this.dragging;
    if (!orb) return;
    this.dragging = null;
    this.ringG.visible = false;
    this.shadowG.visible = false;
    // 走位连线淡出
    const g = this.pathG;
    sched.tween(0.3, (k) => (g.alpha = 1 - k), EaseOutQuad, () => {
      g.clear();
      g.visible = false;
      g.alpha = 1;
      this.path = [];
    });
    const tp = this.cellCenter(orb.r, orb.c);
    const sx = orb.sprite.x;
    const sy = orb.sprite.y;
    sched.tween(
      0.08,
      (k) => {
        orb.sprite.position.set(sx + (tp.x - sx) * k, sy + (tp.y - sy) * k);
        orb.sprite.scale.set(this.bs * (1.08 - 0.08 * k));
      },
      EaseOutQuad,
      () => this.hooks.onDragEnd(),
    );
  }

  update(dt        )       {
    this.animT += dt;
    this.updateAmbientMotion();
    // 看门狗：空闲时修复任何模型缺失/精灵销毁/卡死不可见/位置漂移的格子
    if (!this.dragging && !this.resolving) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = 0.5;
        this.healHoles();
      }
    }
    const orb = this.dragging;
    if (!orb) return;
    this.dragT -= dt;
    if (this.dragT <= 0) {
      this.finishDrag();
      return;
    }
    this.hooks.onDragTick?.(this.dragT);
    // 柔软阴影跟随
    this.shadowG.clear();
    this.shadowG.ellipse(orb.sprite.x, orb.sprite.y + CELL * 0.42, CELL * 0.34, CELL * 0.12).fill({ color: 0x8a6d5c, alpha: 0.25 });
    // 收拢计时环
    const frac = this.dragT / DRAG_TIME;
    const urgent = this.dragT < 1;
    let radius = CELL * 0.62;
    if (urgent) radius *= 1 + 0.07 * Math.abs(Math.sin(this.animT * 12));
    this.ringG.clear();
    this.ringG.arc(orb.sprite.x, orb.sprite.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac).stroke({
      width: 5,
      color: urgent ? 0xff7a5c : 0xfff7e8,
      alpha: 0.95,
      cap: 'round',
    });
  }

  updateAmbientMotion()       {
    const pulse = 0.5 + 0.5 * Math.sin(this.animT * 2.15);
    this.boardAuraG.alpha = 0.46 + pulse * 0.42;
    this.boardSweepG.x = -18 + ((this.animT * 34) % (BOARD_W + 36));
    this.boardSweepG.alpha = 0.16 + 0.34 * Math.pow(0.5 + 0.5 * Math.sin(this.animT * 1.35), 2);
    this.boardSweepHG.y = -18 + ((this.animT * 25) % (BOARD_H + 36));
    this.boardSweepHG.alpha = 0.12 + 0.3 * Math.pow(0.5 + 0.5 * Math.sin(this.animT * 1.1 + 1.2), 2);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const glow = this.cellGlows[idx];
        const orb = this.orbs[r]?.[c];
        const wave = 0.5 + 0.5 * Math.sin(this.animT * 2.25 + r * 0.8 + c * 0.67);
        if (orb) glow.tint = this.colors[orb.type];
        glow.alpha = 0.2 + wave * 0.34;
        glow.scale.set(0.92 + wave * 0.12);
      }

    for (let i = 0; i < this.orbGlints.length; i++) {
      const g = this.orbGlints[i];
      const wave = Math.max(0, Math.sin(this.animT * 2.1 + i * 1.73));
      const show = Math.pow(wave, 7);
      g.alpha = show * 0.82;
      g.scale.set(0.45 + show * 0.7);
      g.rotation = this.animT * 0.22 + i * 0.17;
    }

    for (let i = 0; i < this.boardMotes.length; i++) {
      const mote = this.boardMotes[i];
      const wave = 0.5 + 0.5 * Math.sin(this.animT * 2.7 + mote.phase);
      mote.g.x = mote.baseX + Math.sin(this.animT * 0.9 + mote.phase) * 7;
      mote.g.y = mote.baseY - ((this.animT * (5 + i % 4) + i * 3) % 18) + 9;
      mote.g.alpha = 0.16 + Math.pow(wave, 3) * 0.74;
      mote.g.scale.set(0.65 + wave * 0.75);
    }

    const x0 = -10;
    const y0 = -10;
    const w = BOARD_W + 20;
    const h = BOARD_H + 20;
    const perimeter = 2 * (w + h);
    for (let i = 0; i < this.borderComets.length; i++) {
      const comet = this.borderComets[i];
      let d = (this.animT * (58 + i * 5) + i * perimeter / this.borderComets.length) % perimeter;
      if (d < w) comet.position.set(x0 + d, y0);
      else if ((d -= w) < h) comet.position.set(x0 + w, y0 + d);
      else if ((d -= h) < w) comet.position.set(x0 + w - d, y0 + h);
      else {
        d -= w;
        comet.position.set(x0, y0 + h - d);
      }
      const cometPulse = 0.5 + 0.5 * Math.sin(this.animT * 4 + i);
      comet.alpha = 0.46 + cometPulse * 0.5;
      comet.scale.set(0.72 + cometPulse * 0.42);
    }

    // 只在完全空闲时让糖珠做亚像素级错峰浮动；位移低于洞位看门狗阈值。
    if (!this.dragging && !this.resolving) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const orb = this.orbs[r]?.[c];
          if (!orb || orb.sprite.destroyed || orb.sprite.scale.x < this.bs * 0.2) continue;
          const p = this.cellCenter(r, c);
          const ph = this.animT * 1.65 + r * 0.73 + c * 0.91;
          orb.sprite.y = p.y + Math.sin(ph) * 0.72;
          orb.sprite.rotation = Math.sin(ph * 0.77) * 0.012;
        }
    }
  }

          settleIdleOrbs()       {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const orb = this.orbs[r]?.[c];
        if (!orb || orb.sprite.destroyed) continue;
        const p = this.cellCenter(r, c);
        orb.sprite.position.set(p.x, p.y);
        orb.sprite.rotation = 0;
      }
  }

          healT = 0;

          healHoles()       {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const o = this.orbs[r][c];
        const p = this.cellCenter(r, c);
        if (!o || o.sprite.destroyed) {
          this.orbs[r][c] = null;
          const orb = this.createOrb(this.safeType(r, c), r, c);
          orb.sprite.scale.set(0);
          sched.tween(0.2, (k) => orb.sprite.scale.set(k * this.bs), EaseOutBack);
        } else if (o.sprite.scale.x < this.bs * 0.2 || Math.abs(o.sprite.x - p.x) > 2 || Math.abs(o.sprite.y - p.y) > 2) {
          o.r = r;
          o.c = c;
          o.sprite.position.set(p.x, p.y);
          o.sprite.scale.set(this.bs);
        }
      }
  }

  findGroups()               {
    const groups               = [];
    const t = (r        , c        ) => this.orbs[r][c]?.type ?? -1;
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const type = t(r, c);
        let len = 1;
        while (c + len < COLS && t(r, c + len) === type && type >= 0) len++;
        if (type >= 0 && len >= 3) {
          const cells            = [];
          for (let i = 0; i < len; i++) cells.push({ r, c: c + i });
          groups.push({ type, cells });
        }
        c += len;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const type = t(r, c);
        let len = 1;
        while (r + len < ROWS && t(r + len, c) === type && type >= 0) len++;
        if (type >= 0 && len >= 3) {
          const cells            = [];
          for (let i = 0; i < len; i++) cells.push({ r: r + i, c });
          groups.push({ type, cells });
        }
        r += len;
      }
    }
    return groups;
  }

  async resolveBoard()                  {
    if (this.resolving) return [];
    this.settleIdleOrbs();
    this.resolving = true;
    const waves         = [];
    try {
      await sched.delay(0.1);
      let combo = 0;
      for (;;) {
        const groups = this.findGroups();
        if (!groups.length) break;
        combo++;
        let sealsBroken = 0;
        const uniq = new Map             ();
        for (const g of groups)
          for (const cell of g.cells) {
            const orb = this.orbs[cell.r][cell.c];
            if (orb) uniq.set(`${cell.r},${cell.c}`, orb);
          }
        for (const orb of uniq.values()) {
          if (orb.seal) {
            sealsBroken++;
            this.setSeal(orb, false, true);
          }
        }
        if (sealsBroken > 0) this.hooks.onSealBreak(sealsBroken);
        this.hooks.onPop(groups, combo);
        // 挤压 120ms → 爆裂 180ms
        for (const orb of uniq.values()) {
          this.orbs[orb.r][orb.c] = null;
          const s = orb.sprite;
          const bs = this.bs;
          sched.tween(0.12, (k) => s.scale.set(bs * (1 + 0.18 * k), bs * (1 - 0.12 * k)), EaseOutQuad, () => {
            this.burst(s.x, s.y, this.colors[orb.type]);
            sched.tween(0.18, (k) => s.scale.set(bs * 1.1 * (1 - k)), EaseInQuad, () => s.destroy());
          });
        }
        await sched.delay(0.34);
        await this.dropAndRefill();
        this.hooks.onLand();
        waves.push({ combo, groups, sealsBroken });
        await sched.delay(0.1);
      }
    } finally {
      this.resolving = false;
    }
    return waves;
  }

          burst(x        , y        , color        )       {
    for (let i = 0; i < 6; i++) {
      const p = new Graphics().circle(0, 0, 3 + Math.random() * 3).fill({ color: i % 2 ? color : 0xfff7e8 });
      p.position.set(x, y);
      this.fxLayer.addChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = 24 + Math.random() * 30;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d - 12;
      sched.tween(
        0.35,
        (k) => {
          p.position.set(x + dx * k, y + dy * k + 30 * k * k);
          p.alpha = 1 - k;
        },
        EaseOutQuad,
        () => p.destroy(),
      );
    }
  }

          safeType(r        , c        )         {
    const banned = new Set        ();
    const b1 = this.orbs[r + 1]?.[c];
    const b2 = this.orbs[r + 2]?.[c];
    if (b1 && b2 && b1.type === b2.type) banned.add(b1.type);
    const l1 = this.orbs[r]?.[c - 1];
    const l2 = this.orbs[r]?.[c - 2];
    if (l1 && l2 && l1.type === l2.type) banned.add(l1.type);
    const cand = [0, 1, 2, 3, 4].filter((t) => !banned.has(t));
    return cand[Math.floor(Math.random() * cand.length)];
  }

          async dropAndRefill()                {
    let maxDur = 0;
    for (let c = 0; c < COLS; c++) {
      const stack        = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        const o = this.orbs[r][c];
        if (o) stack.push(o);
      }
      let spawnIdx = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        let orb     ;
        if (stack.length) {
          orb = stack.shift() ;
        } else {
          const type = this.safeType(r, c);
          orb = this.createOrb(type, r, c);
          spawnIdx++;
          orb.sprite.position.set(this.cellCenter(0, c).x, -PITCH * spawnIdx - CELL / 2);
        }
        orb.r = r;
        orb.c = c;
        this.orbs[r][c] = orb;
        const target = this.cellCenter(r, c).y;
        const dist = Math.max(0, (target - orb.sprite.y) / PITCH);
        if (dist < 0.01) continue;
        const dur = Math.max(0.07 * dist, 0.08);
        maxDur = Math.max(maxDur, dur);
        const startY = orb.sprite.y;
        const s = orb.sprite;
        const bs = this.bs;
        sched.tween(0.001, () => {}, EaseOutQuad, () => {
          sched.tween(dur, (k) => (s.y = startY + (target - startY) * k), EaseInQuad, () => {
            s.y = target;
            sched.tween(0.12, (k) => {
              s.scale.set(bs * (1 + 0.06 * (1 - k)), bs * (1 + 0.08 * Math.sin(k * Math.PI) - 0.08 * (1 - k)));
            });
          });
        });
      }
    }
    await sched.delay(maxDur + 0.14);
  }

          setSeal(orb     , on         , animate = false)       {
    if (!on && orb.sealG) {
      const g = orb.sealG;
      orb.sealG = null;
      orb.seal = false;
      if (animate) {
        const inv = 1 / this.bs;
        sched.tween(
          0.25,
          (k) => {
            g.scale.set((1 + k * 0.7) * inv);
            g.alpha = 1 - k;
          },
          EaseOutQuad,
          () => g.destroy(),
        );
      } else g.destroy();
    }
    orb.seal = on;
  }

  addSeals(count        )         {
    const cand        = [];
    for (const row of this.orbs) for (const o of row) if (o && !o.seal) cand.push(o);
    let placed = 0;
    while (placed < count && cand.length) {
      const idx = Math.floor(Math.random() * cand.length);
      const orb = cand.splice(idx, 1)[0];
      orb.seal = true;
      const g = new Graphics();
      g.circle(0, 0, CELL * 0.4).fill({ color: 0xfff9ee, alpha: 0.92 });
      g.circle(-CELL * 0.18, CELL * 0.34, CELL * 0.09).fill({ color: 0xfff9ee, alpha: 0.92 });
      g.circle(CELL * 0.1, CELL * 0.38, CELL * 0.07).fill({ color: 0xfff9ee, alpha: 0.92 });
      g.circle(CELL * 0.2, -CELL * 0.2, CELL * 0.06).fill({ color: 0xffffff, alpha: 0.95 });
      orb.sprite.addChild(g);
      orb.sealG = g;
      const inv = 1 / this.bs;
      g.scale.set(0);
      sched.tween(0.3, (k) => g.scale.set(k * inv), EaseOutBack);
      placed++;
    }
    return placed;
  }

  sealCount()         {
    let n = 0;
    for (const row of this.orbs) for (const o of row) if (o && o.seal) n++;
    return n;
  }

  sealedCells()                             {
    const out                             = [];
    for (const row of this.orbs) for (const o of row) if (o && o.seal) out.push({ r: o.r, c: o.c });
    return out;
  }

  // 待机随机“眨眼”摇摆（无操作时的生命感）
  wobbleRandom()       {
    if (this.dragging || this.resolving) return;
    const all        = [];
    for (const row of this.orbs) for (const o of row) if (o) all.push(o);
    if (!all.length) return;
    const o = all[(Math.random() * all.length) | 0];
    const s = o.sprite;
    const bs = this.bs;
    sched.tween(0.28, (k) => {
      if (s.destroyed) return; // 摇摆期间糖珠可能被消除销毁
      const m = Math.sin(k * Math.PI);
      s.scale.set(bs * (1 + 0.1 * m), bs * (1 - 0.08 * m));
    });
  }

  clearSeals()       {
    for (const row of this.orbs) for (const o of row) if (o && o.seal) this.setSeal(o, false);
  }

  async convertRandomTo(count        , targetType        , excludeType        )                  {
    const cand        = [];
    for (const row of this.orbs)
      for (const o of row) if (o && o.type !== excludeType && o.type !== targetType) cand.push(o);
    const picked        = [];
    while (picked.length < count && cand.length) picked.push(cand.splice(Math.floor(Math.random() * cand.length), 1)[0]);
    for (const orb of picked) {
      const s = orb.sprite;
      const bs = this.bs;
      sched.tween(0.14, (k) => s.scale.set(bs * (1 - k)), EaseInQuad, () => {
        orb.type = targetType;
        s.texture = this.textures[targetType];
        this.burst(s.x, s.y, this.colors[targetType]);
        sched.tween(0.18, (k) => s.scale.set(bs * k), EaseOutBack);
      });
    }
    if (picked.length) await sched.delay(0.36);
    return picked.length;
  }
}
