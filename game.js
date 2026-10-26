// 独立网页入口（MakePlay 约定：根目录 index.html 只放 #app 并加载 ./game.js）。
//
// ⚠️ 插件形态**不走这里** —— `plugin.js` 直接 import `src/main.js` 的 `start()`，
//    差别（资源地址 / 存档 / 容器）全部由那边注入。两条路调的是同一个 `start()`。
import { start } from './src/main.js';
import { makeLocalStore } from './src/host.js';

const qa = new URLSearchParams(location.search).has('qa');

start({
  mountTo: document.body,
  // 独立网页：资源相对 index.html。插件里由宿主 `ctx.assetUrl` 给。
  assetUrl: (rel) => './' + String(rel).replace(/^\.?\//, ''),
  // ?qa：不落盘（免得调试时把真实进度覆盖掉），并暴露 `__mng` 调试入口
  store: qa ? undefined : makeLocalStore('minergirl:'),
  locale: navigator.language,
  qa,
  // 独立网页铺满整个视口，刘海 / 手势条要让出来；插件里宿主已经让过了
  safeArea: true,
}).catch((e) => {
  console.error(e);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;z-index:9999;margin:0;padding:16px;overflow:auto;background:#2a2140;color:#ffb0b0;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap';
  pre.textContent = `启动失败\n\n${e?.stack || e}`;
  document.body.appendChild(pre);
});
