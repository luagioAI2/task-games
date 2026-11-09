// 节拍时钟：管理员们跟着配乐跳舞用。
// 三首配乐的节拍网格是离线从音乐文件的编码帧里测出来的（逐帧响度 + 瞬态短窗口按拍折叠）：都是 128 BPM，
// 底鼓落在曲首（相位 0），反拍是踩镲 / 侧链贝斯。这里只放测得的数字，游戏不读取、不解码任何音频。
// 时钟用真实流逝时间推进；切歌（换深层）时从新曲的开头重新对拍；页面切到后台时 rAF 停、音乐也被平台暂停，
// 所以超过 1 秒的空档当作暂停，不计入。还没开始放音乐（声音未解锁）时按 128 BPM 自由走拍，照样跳。
export const BEAT_MAP = {
  surface: { dur: 71.7, bpm: 128, phase: 0 },
  woods: { dur: 71.15, bpm: 128, phase: 0 },
  deep: { dur: 71.05, bpm: 128, phase: 0 },
};
// 声音从开始播放到真正从扬声器出来的大致延迟（秒）：画面晚一点点对齐耳朵听到的鼓点
const OUTPUT_LATENCY = 0.06;

export class BeatClock {
  constructor() { this.t = 0; this.anchor = 0; this.track = null; this.last = null; }
  // 每帧调用；now = performance.now()
  tick(now) {
    if (this.last !== null) { const d = (now - this.last) / 1000; if (d > 0 && d < 1) this.t += d; }
    this.last = now;
  }
  // 新曲开始播放（setMusicState 完成时）
  start(track) { this.track = BEAT_MAP[track] ? track : null; this.anchor = this.t; }
  // 当前在第几拍（小数）：整数 = 底鼓落点（動），.5 = 反拍（次）
  beats() {
    const tr = BEAT_MAP[this.track], P = 60 / (tr?.bpm ?? 128);
    let x = this.t - this.anchor - OUTPUT_LATENCY - (tr?.phase ?? 0);
    if (tr && x > 0) x %= tr.dur;   // 配乐循环时节拍网格跟着回到曲首
    return x / P;
  }
}
