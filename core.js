// Shared runtime: pixi app, logical layout, sound handle, texture cache.
import * as PIXI from 'pixi.js';
import { A } from './src/assets.js';
                                                           

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
  // ★ 过 A()：插件里 `assets/…` 相对的是 `blob:`，不过就是全 404
  const key = A(url);
  let p = texCache.get(key);
  if (!p) {
    p = PIXI.Assets.load              (key).catch(() => PIXI.Texture.WHITE);
    texCache.set(key, p);
  }
  return p;
}
export async function loadMany(urls          , onProgress                      ) {
  let done = 0;
  const uniq = [...new Set(urls)];
  await Promise.all(uniq.map(u => loadTex(u).then(() => { done++; onProgress?.(done / uniq.length); })));
}
export function texNow(url        )               {
  const t = PIXI.Assets.get              (A(url));
  return t || PIXI.Texture.WHITE;
}

/** Convert a pointer event to logical stage coords. */
export function toStage(e              ) {
  const rect = core.app.canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - core.offX) / core.scale, y: (e.clientY - rect.top - core.offY) / core.scale };
}

let seq = 0;
export function eid(tag        ) { return `${tag}:${++seq}`; }

/**
 * 每次挂载前重置运行时状态。
 *
 * ★ `core.root` / `core.backdrop` 是**模块级**的 PIXI 容器。第一次卸载时
 *   `app.destroy()` 把它们一起销毁了（`destroy({children:true})`），
 *   第二次挂载如果继续用同一对对象，画面**什么都画不出来，而且一个错都不报**。
 */
export function resetCore() {
  core.app = null;
  core.root = new PIXI.Container();
  core.backdrop = new PIXI.Container();
  core.H = 960;
  core.scale = 1;
  core.offX = 0;
  core.offY = 0;
  core.sound = null;
  core.unlocked = false;
  core.music = 'home';
  core.relayoutHooks = [];
}
