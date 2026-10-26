// Shared runtime: pixi app, logical layout, sound handle, texture cache.
import * as PIXI from 'pixi.js';
                                                           

export const W = 540;
export const core = {
  app: null                               ,
  root: new PIXI.Container(),       // logical 540×H stage
  backdrop: new PIXI.Container(),   // full-window background behind the stage
  H: 960,
  scale: 1, offX: 0, offY: 0,
  sound: null                           ,
  unlocked: false,
  music: 'home'                              ,
  relayoutHooks: []                     ,
};

export function setMusic(m                            ) {
  core.music = m;
  const s = core.sound;
  if (!s || !core.unlocked) return;
  if (m === 'home') void s.setMusicState('home', { eventId: 'm-home' });
  else if (m === 'battle') void s.setMusicState('battle', { eventId: 'm-battle' });
  else void s.setMusicState('boss', { eventId: 'm-boss' });
}

const texCache = new Map                               ();
export function loadTex(url        )                        {
  let p = texCache.get(url);
  if (!p) {
    p = PIXI.Assets.load              (url).catch(() => PIXI.Texture.WHITE);
    texCache.set(url, p);
  }
  return p;
}
export async function loadMany(urls          , onProgress                      ) {
  let done = 0;
  const uniq = [...new Set(urls)];
  await Promise.all(uniq.map(u => loadTex(u).then(() => { done++; onProgress?.(done / uniq.length); })));
}
export function texNow(url        )               {
  const t = PIXI.Assets.get              (url);
  return t || PIXI.Texture.WHITE;
}

/** Convert a pointer event to logical stage coords. */
export function toStage(e              ) {
  const rect = core.app.canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - core.offX) / core.scale, y: (e.clientY - rect.top - core.offY) / core.scale };
}

let seq = 0;
export function eid(tag        ) { return `${tag}:${++seq}`; }
