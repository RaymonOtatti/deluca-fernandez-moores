// 6.9: the wordmark (hero and footer) and the big numbers are set in Valiente Display, our own face
// (design/font). Checked in the rendered page: the face loads, and those elements ask for it first.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9344 }); });
after(() => browser?.close());

for (const width of [1440, 390]) {
  test(`${width}px: the wordmark and the big numbers render in Valiente Display`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    await sleep(200);
    const r = await browser.evaluate(`document.fonts.ready.then(() => ({
      loaded: [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Valiente Display' && f.status === 'loaded'),
      families: ['.hero__name', '.fact__value', '.estudio__text', '.wordmark__sub']
        .map((s) => getComputedStyle(document.querySelector(s)).fontFamily),
    }))`);
    assert.ok(r.loaded, 'the Valiente Display face is loaded');
    // the footer's wordmark left in 7.5
    const [hero, fact, body, sub] = r.families;
    assert.match(sub, /^"?Jost Variable"?,/, `"& Asociados" is set in Jost, like the nav: ${sub}`);
    for (const [what, family] of [['hero name', hero], ['fact value', fact]]) {
      assert.match(family, /^"?Valiente Display"?,/, `${what}: ${family}`);
    }
    assert.match(body, /^"?Jost Variable"?,/, `body text stays in Jost: ${body}`);
  });
}

// No rendered text asks a face for a weight it doesn't have (Jost 300–400, Valiente 300).
const RANGES: Record<string, [number, number]> = { 'Jost Variable': [300, 400], 'Valiente Display': [300, 300] };
for (const width of [1440, 390]) {
  test(`${width}px: every text uses a weight its face has`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    await sleep(200);
    const used: string[] = await browser.evaluate(`(() => {
      document.getElementById('menu')?.showPopover?.();
      return [...document.body.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.data.trim()))
        .map((e) => { const cs = getComputedStyle(e); return cs.fontFamily.split(',')[0].replace(/"/g, '').trim() + '|' + cs.fontWeight; });
    })()`);
    const off = [...new Set(used)].filter((u) => {
      const [family, weight] = u.split('|');
      const range = RANGES[family];
      return !range || Number(weight) < range[0] || Number(weight) > range[1];
    });
    assert.deepEqual(off, [], 'faces and weights outside the cut');
  });
}

// 8.5g (Franco, 2026-10-23: the map's "FREYRE 3650", "that font also needs to be our custom font"; and the address,
// "that font needs to be our custom font in all places it appears"): the address (La Oficina's head, the footer,
// the menu) and the map's tag and avenue names in Valiente Display, 14 px, spaced capitals
test('the address and the map\'s names render in Valiente Display, wherever they appear', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  const r = await browser.evaluate(`document.fonts.ready.then(() => ['.oficina__address', '.footer__address', '.menu__address', '.map__tag', '.map__road']
    .map((sel) => { const el = document.querySelector(sel); if (!el) return [sel, 'missing']; const cs = getComputedStyle(el);
      return [sel, cs.fontFamily, parseFloat(cs.fontSize), cs.textTransform, parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)]; }))`);
  for (const [sel, family, size, transform, tracking] of r) {
    assert.match(String(family), /^"?Valiente Display"?/, `${sel}: ${family}`);
    assert.ok(size >= 13.5, `${sel} at ${size}px`);
    assert.equal(transform, 'uppercase', `${sel} in capitals`);
    assert.ok(tracking >= 0.12, `${sel} spaced (${tracking.toFixed(2)}em)`);
  }
});

// 8.6h5: when the web fonts come late (a slow line), the swap from the fallback mustn't move the page. Measured with
// every font held back 1.5 s: CLS under 0.004 whether the fallback is Futura (macOS), system-ui (as on Android) or
// Arial (as on Windows), so the fallbacks carry no metric overrides; a badly matched one (Zapfino) gave 0.03
for (const width of [1440, 390]) {
  test(`${width}px: fonts 1.5 s late, the swap shifts nothing (CLS under 0.01)`, async () => {
    await browser.send('Network.enable');
    await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: '*.woff2', requestStage: 'Request' }] });
    const off = browser.on('Fetch.requestPaused', ({ requestId }: { requestId: string }) => {
      setTimeout(() => browser.send('Fetch.continueRequest', { requestId }).catch(() => {}), 1500);
    });
    const { identifier } = await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__shifts = []; new PerformanceObserver((l) => window.__shifts.push(...l.getEntries().map((e) => e.value))).observe({ type: 'layout-shift', buffered: true });` });
    try {
      await browser.open(BASE, { width });
      await sleep(3200);
      const r = await browser.evaluate(`({ cls: window.__shifts.reduce((a, v) => a + v, 0), late: performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.woff2')).map((e) => Math.round(e.responseEnd)) })`);
      assert.ok(r.late.length >= 2 && r.late.every((t: number) => t >= 1400), `the fonts really came late (${r.late} ms)`);
      assert.ok(r.cls < 0.01, `CLS ${r.cls.toFixed(4)} as the fonts swapped in`);
    } finally {
      off();
      await browser.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      await browser.send('Fetch.disable');
      await browser.send('Network.setCacheDisabled', { cacheDisabled: false });
    }
  });
}
