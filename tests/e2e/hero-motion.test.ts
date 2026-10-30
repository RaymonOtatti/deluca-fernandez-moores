// 8.5k3: the hero's light moves once, in real Chrome. With reduced motion nothing of it is fetched or drawn. With
// motion welcome, after the still's intro the layers fade in over it, the clip plays once (AV1, which Chrome takes),
// and the page ends on the still again, the layers gone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9347 }); });
after(() => browser?.close());

const fetched = `performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\\/_astro\\/(paper|tooth|light-)/.test(n))`;

test('reduced motion: the still only; the motion layers are never fetched', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  await sleep(3500);
  const r = await browser.evaluate(`({ layers: document.querySelectorAll('.hero__motion').length, fetched: ${fetched} })`);
  assert.equal(r.layers, 0, 'no motion layers in the page');
  assert.deepEqual(r.fetched, [], 'nothing of the motion downloaded');
});

test('motion welcome: the layers fade in over the still as canvases, the clip plays once, the still is back', async () => {
  await browser.open(BASE, { width: 1440 });
  const seen = await browser.evaluate(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { canvas: false, on: false, changed: false, removed: false, lcp: '' };
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); out.lcp = e?.element ? e.element.tagName + '.' + e.element.className : ''; }).observe({ type: 'largest-contentful-paint', buffered: true });
    let first = null;
    for (let t = 0; t < 14000; t += 100) {
      const m = document.querySelector('.hero__motion');
      const c = m?.querySelector('canvas.hero__light');
      if (m && c) {
        out.canvas = m.querySelectorAll('canvas').length === 2 && !m.querySelector('img');
        if (getComputedStyle(m).opacity === '1') out.on = true;
        out.during = [...document.querySelectorAll('video')].map((v) => { const r = v.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(v).opacity]; });
        // the canvas really redraws: a pixel in the light changes while the clip plays
        const px = c.getContext('2d').getImageData(Math.round(c.width * 0.85), Math.round(c.height * 0.2), 1, 1).data.join();
        if (first === null) first = px; else if (px !== first) out.changed = true;
      }
      if (out.canvas && !m) { out.removed = true; break; }
      await wait(100);
    }
    out.fetched = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /light-(av1|h264)/.test(n));
    // 8.6c: Safari loads a clip only from the page, so it sits there at 1 px and invisible (never the LCP)
    out.clips = [...document.querySelectorAll('video')].map((v) => { const r = v.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(v).opacity]; });
    return out;
  })()`);
  assert.ok(seen.canvas, 'the paper and the clip, as two canvases');
  assert.ok(seen.on, 'the layers were fully in while the clip played');
  assert.ok(seen.changed, 'the clip\'s canvas followed the clip');
  assert.ok(seen.removed, 'the layers left once the clip ended, so the still is what stays');
  assert.ok(seen.during?.length === 1 && seen.during[0][0] <= 1 && seen.during[0][1] <= 1 && seen.during[0][2] === '0', `the clip on the page at 1 px, invisible (${JSON.stringify(seen.during)})`);
  assert.deepEqual(seen.clips, [], 'and gone with the layers');
  assert.ok(seen.fetched.length === 1 && /light-av1\./.test(seen.fetched[0]), `Chrome takes the AV1 clip (${seen.fetched})`);
  assert.doesNotMatch(seen.lcp, /CANVAS|VIDEO|IMG\.(?!hero__img)/, `the LCP stays the hero (${seen.lcp})`);
  const still = await browser.evaluate(`getComputedStyle(document.querySelector('.hero__img')).opacity`);
  assert.equal(still, '1');
});

// 8.6b (Franco: "on mobile we may need to cancel this animation and show a plain green")
test('390px: plain forest green; neither the still nor the motion is downloaded', async () => {
  await browser.open(BASE, { width: 390 });
  await sleep(4000);
  const r = await browser.evaluate(`({
    bg: getComputedStyle(document.querySelector('.hero')).backgroundColor,
    fig: getComputedStyle(document.querySelector('.hero__fig')).display,
    layers: document.querySelectorAll('.hero__motion').length,
    fetched: performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\\/_astro\\/(still|paper|tooth|light-)/.test(n)),
  })`);
  assert.equal(r.bg, 'rgb(42, 50, 32)', 'the brand green (--forest)');
  assert.equal(r.fig, 'none', 'no light');
  assert.equal(r.layers, 0, 'no motion');
  assert.deepEqual(r.fetched, [], 'nothing of the light downloaded');
});

// 8.6g (astra's review): one way out for every ending. A clip that errors once it has started, a clip that stalls,
// and a visitor who asks for reduced motion mid-play all leave the still, never a frozen layer over it
const playing = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let t = 0; t < 12000; t += 50) {
    const m = document.querySelector('.hero__motion.is-on'), v = m?.querySelector('video');
    if (v && !v.paused && v.currentTime > 0.3) return true;
    await wait(50);
  }
  return false;
})()`;
const gone = (ms: number) => `(async () => {
  for (let t = 0; t < ${ms}; t += 50) { if (!document.querySelector('.hero__motion')) return true; await new Promise((r) => setTimeout(r, 50)); }
  return false;
})()`;

test('a clip that errors mid-play leaves the still at once', async () => {
  await browser.open(BASE, { width: 1440 });
  assert.ok(await browser.evaluate(playing), 'the clip plays');
  await browser.evaluate(`document.querySelector('.hero__motion video').dispatchEvent(new Event('error'))`);
  assert.ok(await browser.evaluate(gone(1200)), 'the layers left within a second of the error');
});

test('a clip that stalls is given up: the layers leave by its length plus a margin', async () => {
  await browser.open(BASE, { width: 1440 });
  assert.ok(await browser.evaluate(playing), 'the clip plays');
  // the deadline is the clip's length plus 2 s, counted from the start (8.8: the clip grew from 4.8 to 7.25 s)
  const length = await browser.evaluate(`(v => (v.pause(), v.duration))(document.querySelector('.hero__motion video'))`);
  assert.ok(await browser.evaluate(gone(length * 1000 + 2500)), 'the stalled layers left');
});

test('reduced motion asked for mid-play stops the light', async () => {
  await browser.open(BASE, { width: 1440 });
  assert.ok(await browser.evaluate(playing), 'the clip plays');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.ok(await browser.evaluate(gone(1200)), 'the layers left once motion was unwelcome');
});

// 8.8 (Franco, 2026-10-24: "we need to add movement from the start, now the movement start 3/4sec after the page
// opens"): measured before, the clip played 2.7 s after opening, behind the still's 2.2 s intro. Now it plays as soon
// as its layers are in, inside the intro, which the layers share (so they never step out of it)
test('the light moves from the start: the clip plays within a second, inside the intro', async () => {
  await browser.open('about:blank', { width: 1440 });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__t = {};
    document.addEventListener('play', () => { window.__t.play ??= performance.now(); }, true);
    new MutationObserver(() => {
      const m = document.querySelector('.hero__motion');
      if (m?.classList.contains('is-on') && window.__t.on == null) {
        window.__t.on = performance.now();
        window.__t.shared = (m.parentElement?.getAnimations() ?? []).some((a) => a.animationName === 'svya-light' && a.playState === 'running');
        window.__t.own = document.querySelector('.hero__img').getAnimations().length;
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  ` });
  await browser.send('Page.navigate', { url: BASE });
  await sleep(3000);
  const t = await browser.evaluate('window.__t');
  assert.ok(t.play != null && t.play < 1200, `the clip played at ${Math.round(t.play)} ms`);
  assert.ok(t.on != null && t.on < 1200, `the layers came in at ${Math.round(t.on)} ms`);
  assert.ok(t.shared, 'they came in during the intro, inside the element it moves');
  assert.equal(t.own, 0, 'the still has no intro of its own: it and the layers move as one');
});
