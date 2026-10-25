/**
 * FX 视觉 A/B 采样器。
 *
 * 目的：换掉 3.2MB 的 @makeplay/fx 之前，先把原库 4 个预设**在固定时刻**拍下来当基线，
 *      换完再用同样的步进拍一遍，并排比。不这么做就只能凭印象说「差不多」。
 *
 * 为什么固定步进：headless 里真实时钟不可靠（首帧就要 ~1s，rAF 被节流），
 * 靠 sleep 截到的帧每次都不一样，A/B 就没意义了。这里由脚本调 `__probe.step(dt)` 推进。
 *
 * 用法: node scripts/fx-ab.cjs <port> <lib> <outDir>
 *       lib = orig | mine
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.argv[2] || '4392';
const LIB = process.argv[3] || 'orig';
const OUT = process.argv[4] || path.join(__dirname, '..', 'shots', 'fx');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9334;

// 每个预设的总时长（取库里的 lifetime / duration 上界）与采样点（占总时长比例）
const PRESETS = [
  { name: 'light-hit', dur: 0.30, at: [0.15, 0.40, 0.75] },
  { name: 'land-dust', dur: 0.78, at: [0.15, 0.40, 0.75] },
  { name: 'teleport-light', dur: 0.82, at: [0.15, 0.40, 0.75] },
  { name: 'legendary-reward', dur: 1.20, at: [0.15, 0.40, 0.75] },
];
const FPS = 60;
const DT = 1 / FPS;

fs.mkdirSync(OUT, { recursive: true });

const profile = path.join(require('node:os').tmpdir(), 'pp-fx-' + Date.now() + '-' + LIB);
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--window-size=520,520', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--no-proxy-server', '--proxy-bypass-list=*', '--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* not up */ }
    await sleep(250);
  }
  throw new Error('devtools 未就绪');
}

(async () => {
  let ws, id = 0, fail = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });

  try {
    ws = new WebSocket(await wsUrl());
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      }
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 520, height: 520, deviceScaleFactor: 1, mobile: false });

    const evalv = async (expr) => {
      const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return r.result?.value;
    };

    for (const p of PRESETS) {
      const url = `http://127.0.0.1:${PORT}/_fx-probe.html?lib=${LIB}`;
      await S('Page.navigate', { url });
      // 等就绪
      let ready = false;
      for (let i = 0; i < 120; i++) {
        await sleep(200);
        if (await evalv('window.__probeReady === true')) { ready = true; break; }
        const err = await evalv('window.__probeError || null');
        if (err) { console.log(`  ✗ ${p.name} 初始化失败: ${String(err).slice(0, 300)}`); break; }
      }
      if (!ready) { fail++; continue; }

      // 空跑一帧，让 renderer 的 shader 编译/尺寸就绪（首帧很慢，且不能算进动画时间）
      await evalv('window.__probe.step(0)');
      await sleep(400);

      await evalv(`window.__probe.play(${JSON.stringify(p.name)}, 1)`);

      const steps = Math.round(p.dur * FPS);
      const targets = new Set(p.at.map(f => Math.max(1, Math.round(steps * f))));
      const maxStep = Math.max(...targets);

      for (let s = 1; s <= maxStep; s++) {
        await evalv(`window.__probe.step(${DT})`);
        if (targets.has(s)) {
          const shot = await S('Page.captureScreenshot', { format: 'png' });
          const file = path.join(OUT, `${LIB}-${p.name}-t${String(Math.round(s * DT * 1000)).padStart(3, '0')}.png`);
          fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
          console.log('  ✓', path.basename(file));
        }
      }
      const diag = await evalv('JSON.stringify(window.__probe.diag())');
      console.log(`  ${p.name} diag=${String(diag).slice(0, 140)}`);
    }

    console.log(fail === 0 ? `\n=== ${LIB} 采样完成 ===` : `\n=== ${LIB} 有 ${fail} 个失败 ===`);
  } catch (e) {
    console.error('采样器出错:', e);
    fail++;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(fail ? 1 : 0);
  }
})();
