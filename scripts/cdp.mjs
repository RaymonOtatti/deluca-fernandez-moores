// A minimal Chrome DevTools Protocol client: launch headless Chrome, open pages, evaluate.
// Shared by scripts/shoot.mjs (screenshots) and tests/e2e (layout checks). No dependencies.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333, profileDir } = {}) {
  const profile = profileDir ?? mkdtempSync(join(tmpdir(), 'svya-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) { chrome.kill(); throw new Error('Chrome did not start'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((l) => l(msg));
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send('Page.enable');
  await send('Runtime.enable');

  /** Open `url` at a viewport size; resolves after the load event. */
  async function open(url, { width, height = width < 600 ? 844 : 900, reducedMotion = false } = {}) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
    });
    const loaded = new Promise((r) => {
      const l = (m) => { if (m.method === 'Page.loadEventFired') { listeners.delete(l); r(); } };
      listeners.add(l);
    });
    await send('Page.navigate', { url });
    await loaded;
    return { width, height };
  }

  /** Reload the current page like the browser's refresh button; resolves after the load event. */
  async function reload() {
    const loaded = new Promise((r) => {
      const l = (m) => { if (m.method === 'Page.loadEventFired') { listeners.delete(l); r(); } };
      listeners.add(l);
    });
    await send('Page.reload', {});
    await loaded;
  }

  function close() {
    ws.close();
    chrome.kill();
  }

  /** Listen to a CDP event (8.6h5: holding fonts back with the Fetch domain); returns the unsubscribe. */
  function on(method, fn) {
    const l = (m) => { if (m.method === method) fn(m.params); };
    listeners.add(l);
    return () => listeners.delete(l);
  }

  return { send, evaluate, open, reload, close, on };
}
