// MakePlay FX frontend: one Pixi instance for battle feedback (hits, sparks, shake, hit-stop) + screen transitions.
import * as PIXI from 'pixi.js';
import { createPixiFx } from '@makeplay/fx';

export const fxScreen = new PIXI.Container();
export let fx = null;
export let impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };

export async function initFx(app, world, referenceSpan) {
  fx = await createPixiFx({
    PIXI,
    app,
    world,
    screen: fxScreen,
    referenceSpan,
    onImpulse: (next) => { impulse = next; },
  });
  return fx;
}

/** Real seconds → gameplay dt (FX hit-stop comes back as a time scale). */
export function fxUpdate(dt) { return fx ? fx.update(dt) : 1; }

/** One semantic preset; no-ops before initFx resolves. */
export function play(preset, opts) { fx?.play(preset, opts); }

/** Battle shake in screen pixels, driven by the library's impulse (never hand-rolled). */
export function applyShake(node, maxPx) {
  if (!fx) return;
  node.position.set(impulse.offsetX * maxPx, impulse.offsetY * maxPx);
}

export function clearFx() { fx?.clear(); }
