import { loadSoundSystem } from '@makeplay/sound';
import { AB } from './base.js';
                                                           

export let snd                          = null;
let unlocked = false;
let live = false; // true once unlock() resolved: cues before that are dropped instead of throwing

let sndP = null;
/** 幂等：切走再切回时不要重复建音频上下文（每次挂载新建会耗尽 AudioContext 上限） */
export async function initSound() {
  if (sndP) return sndP;
  sndP = initSoundOnce();
  return sndP;
}
async function initSoundOnce() {
  try {
    // ★ 清单地址必须绝对：插件跑在 blob: 里，'./sound.manifest.json' 会按宿主页面解析 ⇒ 404
    const rt      = await loadSoundSystem({ manifestUrl: AB + 'sound.manifest.json' });
    const raw = rt.playCue.bind(rt)                        ;
    // the runtime object is frozen: hand out a facade whose playCue drops cues until unlock resolved
    const facade      = new Proxy({}, {
      get(_t, k) {
        if (k === 'playCue') return (...a       ) => {
          if (!live) return Promise.resolve(null);
          try { const r = raw(...a); if (r && typeof r.catch === 'function') r.catch(() => {}); return r; } catch { return Promise.resolve(null); }
        };
        const v = rt[k];
        return typeof v === 'function' ? v.bind(rt) : v;
      },
    });
    snd = facade                    ;
  } catch (e) {
    console.warn('sound unavailable', e);
    snd = null;
  }
}

export async function unlockAudio() {
  if (!snd || unlocked) return;
  unlocked = true;
  try {
    await snd.unlock();
    live = true;
    await snd.preload('gameplay');
    await snd.setMusicState('main', { eventId: 'session-start' });
  } catch (e) { console.warn(e); }
}

function onFirstGesture() {
  void unlockAudio();
}
// ★ 模块顶层不许碰 window：check-plugin.mjs 在 Node 里真 import() 一次
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', onFirstGesture, true);
  window.addEventListener('keydown', onFirstGesture);
  window.addEventListener('pagehide', () => { void snd?.dispose(); }, { once: true });
}

export function applyVolumes(music         , sfx         ) {
  snd?.settings.setVolumes({ music: music ? 1 : 0, sfx: sfx ? 1 : 0 });
}
