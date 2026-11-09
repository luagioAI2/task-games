// 声音：全部经由 @makeplay/sound（和风 DJ 配乐三首 + 和风音效），本文件只把游戏事件翻译成语义 Cue。
// 配乐随镜头所在深层切换：地表 / 晨光林缘 = surface，垂藤之森 = woods，静晶之海 = deep。
const LAYER_MUSIC = ['surface', 'woods', 'deep'];
import { BeatClock } from './beat.js';
// 振动反馈（支持振动的手机上）：只跟玩家亲手触发的事件，矿工自己干活的声音不振
const HAPTIC = { tap: 8, pick: 6, upgrade: 14, hire: [18, 40, 26], boost: [12, 30, 22], unlock: [30, 50, 40], layer: [30, 60, 30, 60, 50], deny: [10, 50, 10], guide: 10 };

export class SoundBoard {
  constructor() { this.sound = null; this.sfx = true; this.music = true; this.layer = 0; this.unlocked = false; this.state = null; this.n = 0; this.haptics = true; this.beat = new BeatClock(); }
  buzz(p) { if (!this.haptics || !p) return; try { navigator.vibrate?.(p); } catch { /* 不支持振动 */ } }
  attach(sound) { this.sound = sound; this.applyVolumes(); if (this.unlocked) this.syncMusic(); }
  applyVolumes() { try { this.sound?.settings.setVolumes({ music: this.music ? 1 : 0, sfx: this.sfx ? 1 : 0 }); } catch { /* 忽略 */ } }
  setSfx(on) { this.sfx = on; this.applyVolumes(); }
  setMusic(on) { this.music = on; this.applyVolumes(); }
  // main.js 的手势监听里 unlockSound() 成功后调用
  onUnlocked() { if (this.unlocked) return; this.unlocked = true; this.syncMusic(); }
  setLayer(li) { const k = Math.max(0, Math.min(LAYER_MUSIC.length - 1, li)); if (k !== this.layer) { this.layer = k; this.syncMusic(); } }
  syncMusic() {
    const s = this.sound; if (!s || !this.unlocked) return;
    const want = LAYER_MUSIC[this.layer]; if (this.state === want) return; this.state = want;
    const opt = { eventId: `music:${want}:${++this.n}` };
    let p;
    if (want === 'surface') p = s.setMusicState('surface', opt);
    else if (want === 'woods') p = s.setMusicState('woods', opt);
    else p = s.setMusicState('deep', opt);
    // 新曲真正开始播放时，把节拍时钟对到它的曲首
    p?.then?.(() => { if (this.state === want) this.beat.start(want); }, () => {});
    p?.catch?.(() => {});
  }
  play(name) {
    this.buzz(HAPTIC[name]);
    const s = this.sound; if (!s || !this.unlocked) return;
    const id = `${name}:${++this.n}`, o = { eventId: id, seed: id };
    let p = null;
    switch (name) {
      case 'click': p = s.playCue('ui.click', o); break;
      case 'tap': p = s.playCue('work.tap', { ...o, pitchSemitones: (this.n % 3) - 1 }); break;
      case 'pick': p = s.playCue('work.pick', { ...o, pitchSemitones: (this.n % 5) - 2 }); break;
      case 'deposit': p = s.playCue('work.deposit', { ...o, pitchSemitones: (this.n % 4) - 2 }); break;
      case 'sell': p = s.playCue('econ.sell', { ...o, pitchSemitones: this.n % 3 }); break;
      case 'creak': p = s.playCue('elev.arrive', o); break;
      case 'upgrade': p = s.playCue('econ.upgrade', o); break;
      case 'hire': p = s.playCue('econ.hire', o); break;
      case 'boost': p = s.playCue('skill.boost', o); break;
      case 'unlock': p = s.playCue('world.unlock', o); break;
      case 'layer': p = s.playCue('world.layer', o); break;
      case 'deny': p = s.playCue('ui.deny', o); break;
      case 'guide': p = s.playCue('ui.guide', o); break;
      default: break;
    }
    p?.catch?.(() => {});
  }
}
