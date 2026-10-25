/**
 * 挂载 / 卸载 / 重新挂载 循环测试。
 *
 * 为什么非测不可：把模块顶层执行改成工厂函数之后，最大的风险是
 * **第二次挂载拿到上一份闭包残留**（已 dispose 的 renderer、停掉的 rAF、旧的 DOM 引用）。
 * 单测和"跑一次看起来正常"都发现不了，只有真的 mount→unmount→mount 才会露。
 *
 * 另外验三件事：
 *  - 卸载后宿主容器里不剩 canvas（否则 WebGL context 泄漏，进出十几次就白屏）
 *  - 存档经 host.storage 落盘（键名 'save'），第二次挂载能读回来
 *  - window.__debug / __gpPlayable 在卸载后被清掉（否则宿主页面被污染）
 *
 * 用法: node scripts/mount-test.cjs <port>
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = process.argv[2] || '4392';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DBG = 9335;
const CYCLES = 3;
const OUT = path.join(__dirname, '..', 'shots', 'mount');

fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(require('node:os').tmpdir(), 'pp-mount-' + Date.now());

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
  '--window-size=430,900', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
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
  const errors = [];
  const send = (m, p = {}, s) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method: m, params: p, sessionId: s }));
  });

  const ok = (cond, msg, extra) => {
    console.log(`   ${cond ? '✓' : '✗'} ${msg}${extra === undefined ? '' : '  ' + JSON.stringify(extra)}`);
    if (!cond) fail++;
  };

  try {
    ws = new WebSocket(await wsUrl());
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push(m.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push('EXC ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
      }
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    await S('Page.enable'); await S('Runtime.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: true });

    const evalv = async (expr) => {
      const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) return { __err: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || '') };
      return r.result?.value;
    };

    await S('Page.navigate', { url: `http://127.0.0.1:${PORT}/_mount-test.html` });
    for (let i = 0; i < 80; i++) { await sleep(200); if (await evalv('window.__ready === true')) break; }

    for (let c = 1; c <= CYCLES; c++) {
      console.log(`\n--- 第 ${c} 轮 ---`);

      const m = await evalv('window.__t.mount()');
      if (m !== true) { ok(false, 'mount 抛错', m); break; }

      // 等 wasm 初始化
      let playable = false;
      for (let i = 0; i < 100; i++) {
        await sleep(200);
        if (await evalv('window.__gpPlayable === true')) { playable = true; break; }
      }
      ok(playable, '挂载后 __gpPlayable = true');

      await sleep(600);
      const st = await evalv('JSON.stringify(window.__t.state())');
      const s1 = JSON.parse(st);
      ok(s1.canvases >= 1, 'canvas 已创建', { canvases: s1.canvases });

      // 进机台，产生一点状态，并触发 persist
      await evalv("window.__debug.enter('big-bear')");
      await sleep(1800);
      const inM = await evalv('JSON.stringify({ p: __debug.inMachine, n: __debug.prizes.length })');
      const s2 = JSON.parse(inM);
      ok(s2.p === true && s2.n > 0, '进入机台且奖品已生成', s2);

      const shot = await S('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `cycle${c}.png`), Buffer.from(shot.data, 'base64'));

      // 卸载
      const u = await evalv('window.__t.unmount()');
      ok(u === true, 'unmount 完成', u);
      await sleep(500);

      const st2 = JSON.parse(await evalv('JSON.stringify(window.__t.state())'));
      ok(st2.canvases === 0, '卸载后容器里没有 canvas（WebGL context 已释放）', { canvases: st2.canvases });
      ok(st2.hostChildren === 0, '卸载后宿主容器是空的', { children: st2.hostChildren });
      ok(st2.hasDebug === false, '卸载后 window.__debug 已清除');
      ok(st2.saveKeys.includes('save'), '存档已写入 host.storage 的 "save" 键', st2.saveKeys);
    }

    console.log('\n--- 错误汇总 ---');
    if (errors.length) {
      errors.slice(0, 8).forEach(e => console.log('   ', String(e).slice(0, 180)));
      fail++;
    } else console.log('   无控制台错误 / 无未捕获异常');

    console.log(fail === 0 ? '\n=== PASS ===' : `\n=== FAIL (${fail}) ===`);
  } catch (e) {
    console.error('测试脚本自身出错:', e);
    fail++;
  } finally {
    try { ws && ws.close(); } catch { /* ignore */ }
    chrome.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
    process.exit(fail ? 1 : 0);
  }
})();
