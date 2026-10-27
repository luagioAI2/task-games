import { loadSoundSystem } from '@makeplay/sound';
                                                           

export let snd                          = null;
let unlocked = false;
let live = false; // true once unlock() resolved: cues before that are dropped instead of throwing

export async function initSound() {
  try {
    const rt      = await loadSoundSystem({ manifestUrl: './sound.manifest.json' });
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
window.addEventListener('pointerdown', onFirstGesture, true);
window.addEventListener('keydown', onFirstGesture);
window.addEventListener('pagehide', () => { void snd?.dispose(); }, { once: true });

export function applyVolumes(music         , sfx         ) {
  snd?.settings.setVolumes({ music: music ? 1 : 0, sfx: sfx ? 1 : 0 });
}
