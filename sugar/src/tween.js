// 补间与计时调度：挂在 pixi ticker 上，暂停时整体冻结（游戏流程动画全部经过它）
                                         

export const EaseLinear       = (k) => k;
export const EaseOutQuad       = (k) => 1 - (1 - k) * (1 - k);
export const EaseInQuad       = (k) => k * k;
export const EaseOutBack       = (k) => {
  const c = 1.70158;
  const t = k - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
export const EaseOutElastic       = (k) => {
  if (k === 0 || k === 1) return k;
  return Math.pow(2, -9 * k) * Math.sin((k * 9 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

                
            
              
                              
             
                    
 

export class Scheduler {
  paused = false;
          items         = [];

  update(dt        )       {
    if (this.paused) return;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(it.t / it.dur, 1);
      try {
        it.update(it.ease(k));
      } catch (e) {
        // 单个补间写已销毁对象时移除并记录，不能冻结整个调度器
        this.items.splice(i, 1);
        console.error('tween dropped:', e);
        continue;
      }
      if (k >= 1) {
        this.items.splice(i, 1);
        if (it.done) it.done();
      }
    }
  }

  tween(dur        , update                     , ease       = EaseOutQuad, done             )       {
    if (dur <= 0) {
      update(1);
      if (done) done();
      return;
    }
    this.items.push({ t: 0, dur, update, ease, done });
  }

  delay(dur        )                {
    return new Promise((resolve) => {
      this.items.push({ t: 0, dur: Math.max(dur, 0.001), update: () => {}, ease: EaseLinear, done: resolve });
    });
  }

  clear()       {
    this.items.length = 0;
  }
}

export const sched = new Scheduler();
