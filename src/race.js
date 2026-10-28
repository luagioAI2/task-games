import { makeRunner, actRunner, stepRunner, Ghost } from './replay-core.js';
import { raceProfile } from './traits.js';
export const BEAT = 0.8;
export const WINDOW = [0.68,0.94];
export const STEP = 1/120;
export function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

export class Race {
  constructor({mode='classic',seed=12345,traits={stride:5,agility:5,balance:5},strokes=null,replays=[]}={}) {
    this.mode=mode;this.seed=seed;this.length=mode==='chaos'?200:100;this.time=-3;this.finished=false;
    this.traits=traits;this.profile=raceProfile(mode,traits);
    this.combo=0;this.maxCombo=0;this.hits=0;this.misses=0;this.lastBeat=-1;this.boost=0;this.events=[];
    const rng=random(seed);
    this.horses=Array.from({length:4},(_,i)=>({id:i,x:0,speed:0,base:6.05+rng()*.65,phase:rng()*6.28,finish:null,jump:0,vy:0,stumble:0,passed:0,jumps:0}));
    this.tick=0;this.inputs=[];this.runner=strokes?makeRunner(mode,strokes):null;this.ghosts=replays.map(r=>new Ghost(mode,r.d,r.r));this.replays=replays;
    this.obstacles=mode==='chaos'?[34,69,106,143,177]:[];
  }
  get player(){return this.horses[0];}
  get phase(){return this.time<0?0:(this.time%BEAT)/BEAT;}
  get running(){return this.time>=0&&!this.finished;}
  get rank(){return this.ranking.indexOf(this.player)+1;}
  get ranking(){return [...this.horses].sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.x-a.x||a.id-b.id);}
  cheer(){
    if(!this.running||this.player.finish!==null)return 'inactive';
    if(this.runner){const result=actRunner(this.runner,0);if(!result)return 'locked';this.inputs.push([this.tick,0]);this.syncRunner();return result;}
    const beat=Math.floor((this.time+1e-8)/BEAT);
    if(this.lastBeat===beat)return 'locked';
    this.lastBeat=beat;
    const hit=this.phase>=WINDOW[0]-this.profile.windowPad&&this.phase<=WINDOW[1]+this.profile.windowPad;
    if(hit){this.combo++;this.hits++;this.maxCombo=Math.max(this.combo,this.maxCombo);this.boost=Math.min(4.5,this.profile.boostBase+this.combo*this.profile.comboGain);}
    else {this.combo=0;this.misses++;this.boost=0;}
    return hit?'hit':'miss';
  }
  syncRunner(){const r=this.runner;if(!r)return;for(const k of ['combo','maxCombo','hits','misses','lastBeat','boost'])this[k]=r[k];for(const k of ['x','speed','finish','jump','vy','stumble','passed','jumps'])this.player[k]=r[k];}
  jump(){if(this.runner){if(!this.running||!actRunner(this.runner,1))return false;this.inputs.push([this.tick,1]);this.syncRunner();return true;}if(!this.running||this.player.finish!==null||this.player.jump>0)return false;this.player.vy=this.profile.jumpSpeed;this.player.jump=.001;return true;}
  update(dt){
    if(this.finished||dt<=0)return;
    const before=this.time;this.time+=dt;
    if(this.time<0)return;
    dt=Math.min(dt,this.time);
    if(before<0)this.events.push('go');
    if(this.runner){const jumped=this.runner.jumps,passed=this.runner.passed;stepRunner(this.runner);this.syncRunner();this.tick++;if(this.runner.jumps>jumped)this.events.push('jump');else if(this.runner.passed>passed)this.events.push('stumble');for(let i=0;i<this.ghosts.length;i++){const g=this.ghosts[i];g.update();Object.assign(this.horses[i+1],g.runner,{id:i+1});}}
    this.boost=Math.max(0,this.boost-dt*this.profile.boostDecay);
    for(const h of this.horses){
      if(this.runner&&(h.id===0||h.id<=this.ghosts.length))continue;
      h.stumble=Math.max(0,h.stumble-dt);
      if(h.jump>0){h.vy-=20*dt;h.jump=Math.max(0,h.jump+h.vy*dt);if(h.jump===0)h.vy=0;}
      if(h.finish!==null)continue;
      const hurdle=this.obstacles[h.passed];
      if(h.id!==0&&hurdle!==undefined&&hurdle-h.x<3.2&&hurdle-h.x>2.5&&h.jump===0){h.vy=8;h.jump=.001;}
      const target=(h.id===0?this.profile.base+this.boost:h.base+.45*Math.sin(this.time*1.1+h.phase))*(h.stumble>0?.42:1);
      h.speed+=(target-h.speed)*Math.min(1,dt*(h.id===0?this.profile.acceleration:7));
      const previous=h.x;h.x+=h.speed*dt;
      if(hurdle!==undefined&&h.x>=hurdle){
        h.passed++;
        if(h.jump<.6){h.stumble=h.id===0?this.profile.recovery:.85;if(h.id===0){this.combo=0;this.events.push('stumble');}}
        else {h.jumps++;if(h.id===0)this.events.push('jump');}
      }
      if(h.x>=this.length){h.finish=this.time-dt+(this.length-previous)/Math.max(h.x-previous,.00001)*dt;h.x=this.length;}
    }
    if(this.horses.every(h=>h.finish!==null)){this.finished=true;this.events.push('finish');}
  }
}
