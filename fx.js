// MakePlay FX frontend: one Pixi instance for battle feedback (hits, sparks, shake, hit-stop) + screen transitions.
import * as PIXI from 'pixi.js';
import { createPixiFx } from '@makeplay/fx';

/**
 * 特效层容器。
 *
 * ★ 它挂在 `app.stage` 下面，所以 `app.destroy({children:true})` 会**连它一起销毁**。
 *   第二次挂载继续用同一个对象就是「父容器已销毁」—— 症状可能是空白，
 *   也可能看着正常（空容器恰好还能塞子节点），**总之不报错**。
 *   所以每次挂载都要 `resetFx()` 换一个新的（`export let` 是活绑定，
 *   `game.js` 里 `addChild(... fxScreen)` 读的是当时的那个）。
 */
export let fxScreen = new PIXI.Container();
export let fx = null;
export let impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };

/** 第几代 fx —— 卸载时 +1，用来丢弃「初始化还没回来就已经被卸载了」的那一次。 */
let gen = 0;

/** 每次挂载前调用（紧挨着 `resetCore()`）。 */
export function resetFx() {
  fx = null;
  impulse = { offsetX: 0, offsetY: 0, roll: 0, fovPunch: 0 };
  fxScreen = new PIXI.Container();
  gen++;
}

export async function initFx(app, world, referenceSpan) {
  const mine = gen;
  try {
    const inst = await createPixiFx({
      PIXI,
      app,
      world,
      screen: fxScreen,
      referenceSpan,
      onImpulse: (next) => { impulse = next; },
    });
    // 初始化期间被卸载了：这个实例绑在已销毁的 renderer 上，直接丢掉
    if (mine !== gen) {
      try { inst.dispose?.(); } catch { /* ignore */ }
      return null;
    }
    fx = inst;
    return fx;
  } catch (e) {
    /*
     * ★ 这条 catch 是**必需的**，不是防御性编程。
     *   `createPixiFx` 内部会 `prewarm(renderer)`，而它是异步的：战斗中卸载
     *   ⇒ `app.destroy()` 先把 renderer 拆了 ⇒ prewarm 里 `renderer.render()`
     *   读到已销毁的 `_renderTarget`，抛 `Cannot read properties of null (reading 'screen')`。
     *   调用侧是 `void initFx(...).then(...)`，所以它会变成 **unhandled rejection**
     *   ⇒ e2e 的「0 个 pageerror」直接红，而画面其实一切正常。
     */
    console.warn('[moestrike] 特效初始化被丢弃（多半是战斗中卸载）', e?.message ?? e);
    return null;
  }
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
