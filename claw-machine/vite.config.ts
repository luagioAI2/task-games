import { defineConfig } from 'vite';

/*
 * 独立版（整页跑）的构建配置。
 *
 * ★ 2026-10-23 去掉了 `vite-plugin-wasm`：物理引擎从 `@dimforge/rapier3d`
 *   换成了 `@dimforge/rapier3d-compat`（wasm 内联成 base64）。
 *   这不是为了省事 —— 插件跑在宿主的 blob: 模块里，**取不到第二个文件**，
 *   普通包那份独立的 `.wasm` 会 404，而报错长得像"打包坏了"。
 *   独立版跟着一起换，两边才是同一份物理实现。
 *
 * GitHub Pages serves this at /claw-machine/. Override with VITE_BASE=./ for other hosts / local testing.
 */
export default defineConfig({
  base: process.env.VITE_BASE ?? '/claw-machine/',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  server: { host: true },
});
