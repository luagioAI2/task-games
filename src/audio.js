// WebAudio 管理：fetch+decode 预载，首次手势解锁，BGM 循环 + 暂停低通
import { LS } from './host.js';
const SFX_GAIN = 0.8;
const BGM_GAIN = 0.55;

export class AudioMan {
  musicOn = true;
  sfxOn = true;
          ctx                      = null;
          buffers = new Map                     ();
          sfxBus                  = null;
          bgmBus                  = null;
          bgmFilter                          = null;
          bgmSrc                               = null;
          unlocked = false;
          sfxVol = 1;
          loading                                     = null;

  constructor() {
    this.musicOn = LS.getItem('tz_music') !== '0';
    this.sfxOn = LS.getItem('tz_sfx') !== '0';
    const v = parseFloat(LS.getItem('tz_sfxvol') || '1');
    this.sfxVol = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }

  /** 宿主注入之后重读偏好（构造函数跑在模块顶层，那时还读不到宿主的存档） */
  reloadPrefs()       {
    this.musicOn = LS.getItem('tz_music') !== '0';
    this.sfxOn = LS.getItem('tz_sfx') !== '0';
    const v = parseFloat(LS.getItem('tz_sfxvol') || '1');
    this.sfxVol = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  }

  /** 卸载：停 BGM、关 AudioContext。不关的话切几次 tab 会攒一堆 ctx。 */
  dispose()       {
    try { this.bgmSrc?.stop(); } catch { /* 已停 */ }
    this.bgmSrc = null;
    try { void this.ctx?.close(); } catch { /* 已关 */ }
    this.ctx = null;
    this.sfxBus = null;
    this.bgmBus = null;
    this.bgmFilter = null;
    this.buffers.clear();
    // ★ 必须清 loading：不清的话第二次挂载 load() 直接返回**旧 promise**，
    //   音频永远不重载（症状是「切回来之后没声音」，且没有任何报错）。
    this.loading = null;
    this.unlocked = false;
  }

  async load(list                               )                {
    if (this.loading) return this.loading;
    this.loading = this.loadBuffers(list);
    return this.loading;
  }

          async loadBuffers(list                               )                {
    const AC                                  =
      window.AudioContext || (window                                                           ).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? SFX_GAIN * this.sfxVol : 0;
    this.sfxBus.connect(this.ctx.destination);
    this.bgmFilter = this.ctx.createBiquadFilter();
    this.bgmFilter.type = 'lowpass';
    this.bgmFilter.frequency.value = 20000;
    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = this.musicOn ? BGM_GAIN : 0;
    this.bgmBus.connect(this.bgmFilter);
    this.bgmFilter.connect(this.ctx.destination);

    await Promise.all(
      list.map(async ({ id, url }) => {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          const audio = await this.ctx .decodeAudioData(buf);
          this.buffers.set(id, audio);
          if (id === 'bgm-main' && this.unlocked) this.startBgm();
        } catch (e) {
          console.warn('audio load failed', id, e);
        }
      }),
    );
  }

  unlock()       {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.ctx) return;
    void this.ctx.resume();
    this.startBgm();
  }

          startBgm()       {
    if (!this.ctx || !this.bgmBus || this.bgmSrc) return;
    const buf = this.buffers.get('bgm-main');
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.bgmBus);
    src.start();
    this.bgmSrc = src;
  }

  play(id        , rate = 1, gain = 1)       {
    if (!this.ctx || !this.sfxBus || !this.unlocked) return;
    const buf = this.buffers.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
  }

  setMusicOn(on         )       {
    this.musicOn = on;
    LS.setItem('tz_music', on ? '1' : '0');
    if (this.bgmBus && this.ctx) this.bgmBus.gain.setTargetAtTime(on ? BGM_GAIN : 0, this.ctx.currentTime, 0.1);
  }

  getSfxVol()         {
    return this.sfxVol;
  }

  setSfxVol(v        )       {
    this.sfxVol = Math.max(0, Math.min(1, v));
    LS.setItem('tz_sfxvol', String(this.sfxVol));
    if (this.sfxBus && this.ctx)
      this.sfxBus.gain.setTargetAtTime(this.sfxOn ? SFX_GAIN * this.sfxVol : 0, this.ctx.currentTime, 0.05);
  }

  setSfxOn(on         )       {
    this.sfxOn = on;
    LS.setItem('tz_sfx', on ? '1' : '0');
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(on ? SFX_GAIN * this.sfxVol : 0, this.ctx.currentTime, 0.05);
  }

  setPaused(paused         )       {
    if (this.bgmFilter && this.ctx)
      this.bgmFilter.frequency.setTargetAtTime(paused ? 500 : 20000, this.ctx.currentTime, 0.15);
  }
}
