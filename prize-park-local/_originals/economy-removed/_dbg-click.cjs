/**
 * 一次性调试脚本：点一下首页磁贴，看是「音频 unlock 挂住」还是「buildRecycle 抛错」。
 * 用完即弃，不进仓库验收链。
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = process.argv[2] || '4395';
const BASE = `http://127.0.0.1:${PORT}/`;
const DBG = 9335;
const profile = path.join(os.tmpdir(), 'pp-dbg-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--window-size=430,900', '--no-first-run', '--no-proxy-server', '--proxy-bypass-list=*',
  '--enable-unsafe-swiftshader', 'about:blank',
], { stdio: 'ignore' });

(async () => {
  let ws, id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  const logs = [];
  try {
    let url;
    for (let i = 0; i < 60; i++) {
      try { const j = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json(); if (j.webSocketDebuggerUrl) { url = j.webSocketDebuggerUrl; break; } } catch {}
      await sleep(250);
    }
    ws = new WebSocket(url);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
      if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
      if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    const ev = async (x) => {
      const r = await S('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
      return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description } : r.result?.value;
    };
    await S('Page.enable'); await S('Runtime.enable');
    await S('Page.navigate', { url: BASE });
    for (let i = 0; i < 120; i++) { await sleep(250); if ((await ev('window.__gpPlayable===true')) === true) break; }
    await sleep(800);

    console.log('screen =', await ev(`__debug.screen`));
    console.log('sellBtn exists =', await ev(`!!document.getElementById('sellBtn')`));
    await ev(`document.getElementById('sellBtn').click()`);
    await sleep(1500);
    console.log('after sellBtn click, screen =', await ev(`__debug.screen`));
    console.log('#sell hidden =', await ev(`document.getElementById('sell').classList.contains('hidden')`));
    console.log('#sellGrid children =', await ev(`document.getElementById('sellGrid').children.length`));
    console.log('--- 对照组：colBtn ---');
    await ev(`document.getElementById('colBtn').click()`);
    await sleep(1500);
    console.log('after colBtn click, screen =', await ev(`__debug.screen`));
    console.log('logs:', logs.slice(0, 8));
  } catch (e) { console.error(e); }
  finally { try { ws.close(); } catch {} chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(0); }
})();
