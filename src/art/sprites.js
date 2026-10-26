// 角色贴图：生成的立绘 / 动画表（assets/sprites/，由 index.json 描述）。启动时按真实进度加载，之后同步取用。
// 尺寸统一：站立角色在世界里约 STAND 个设计单位高；坐着打盹的约 SIT 高。
//
// ★★ **所有资源地址都要过 `ASSET()`**：插件在 `blob:` 模块里跑，`new URL('../../assets/x', import.meta.url)`
//    会以 blob: 为基准解析 ⇒ 全部 404，而报错是一堆 "image …"，看着像贴图没打进去。
//    `setAssetUrl()` 由 `main.js` 的 `start()` 注入（独立网页是 `./` 前缀，插件是 `ctx.assetUrl`）。
import { Texture, Rectangle } from '../../lib/pixi.min.js';
import { canvas } from './kit.js';

export const STAND = 58, SIT = 40;
let IDX = null, ENVI = null;
const IMG = {}, BASE = {}, ANIM = {}, ENV = {};

let ASSET = (rel) => rel;
/** 注入资源地址拼法。`null` = 回到「相对文档」（独立网页）。 */
export function setAssetUrl(fn) { ASSET = typeof fn === 'function' ? fn : (rel) => rel; }

function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error(`image ${url}`)); im.src = url; });
}

/** 已经全部加载过？（切走再切回来时直接复用，别再把 14MB 图重下一遍） */
const loaded = () =>
  !!IDX && !!ENVI &&
  Object.keys(IDX.anims).every((k) => IMG[k]) &&
  Object.keys(IDX.statics).every((k) => IMG[k]) &&
  Object.keys(IDX.portraits).every((k) => IMG['face-' + k]) &&
  Object.keys(ENVI).every((k) => ENV[k]);

// onProgress(0..1)：每张图片加载完成推进一次（角色 + 场景美术）
export async function loadSprites(onProgress = () => {}) {
  if (loaded()) { onProgress(1); return 0; }
  const [r, re] = await Promise.all([fetch(ASSET('assets/sprites/index.json')), fetch(ASSET('assets/env/index.json'))]);
  if (!r.ok || !re.ok) throw new Error(`sprite index ${r.status}/${re.status}`);
  IDX = await r.json(); ENVI = await re.json();
  const all = [...Object.entries(IDX.anims), ...Object.entries(IDX.statics), ...Object.entries(IDX.portraits).map(([k, v]) => ['face-' + k, v])];
  const envAll = Object.entries(ENVI), total = all.length + envAll.length;
  let done = 0; onProgress(0);
  const tick = () => { done++; onProgress(done / total); };
  await Promise.all([
    ...all.map(async ([key, e]) => { IMG[key] = await loadImage(ASSET(e.file)); tick(); }),
    ...envAll.map(async ([key, e]) => { ENV[key] = await loadImage(ASSET(e.file)); tick(); }),
  ]);
  return total;
}
// 场景美术：原始图片（画到离屏画布里用）和尺寸信息（w / h / body = 主体最宽那一段的行范围）
export const envImg = (k) => ENV[k];
export const envInfo = (k) => ENVI[k];
const base = (key) => BASE[key] ?? (BASE[key] = Texture.from(IMG[key]));

// 动画：{ frames: Texture[], fps, loop, anchor, scale, impact }
export function anim(key, height = STAND) {
  if (ANIM[key]) return ANIM[key];
  const e = IDX.anims[key], b = base(key), frames = [];
  if (!e) throw new Error(`no such sprite animation: ${key}`);
  for (let f = 0; f < e.count; f++) frames.push(new Texture({ source: b.source, frame: new Rectangle((f % e.cols) * e.w, Math.floor(f / e.cols) * e.h, e.w, e.h) }));
  return (ANIM[key] = { frames, fps: e.fps, loop: e.loop, anchor: e.anchor, scale: height / e.subjectH, impact: e.impact, subjectH: e.subjectH, srcH: e.srcH ?? e.h });
}
// 单张立绘：{ tex, scale }，锚点在脚底中点 (0.5, 1)
export function still(key, height = STAND) { const e = IDX.statics[key]; if (!e) throw new Error(`no such sprite image: ${key}`); return { tex: base(key), scale: height / e.h }; }
export const image = (key) => IMG[key];

// 圆形头像卡（面板 / 向导气泡用的画布）：色块底 + 头像 + 白边
const faceCache = {};
export function faceCard(key, bg = ['#fde9d6', '#f2b8a0']) {
  const ck = key + bg.join(); if (faceCache[ck]) return faceCache[ck];
  const S = 192, c = canvas(S, S), g = c.getContext('2d'), im = IMG['face-' + key];
  const gr = g.createRadialGradient(S * 0.4, S * 0.32, 8, S / 2, S / 2, S / 2); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); g.clip();
  if (im) g.drawImage(im, 4, 14, S - 8, S - 8);
  g.restore();
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2); g.stroke();
  return (faceCache[ck] = c);
}
