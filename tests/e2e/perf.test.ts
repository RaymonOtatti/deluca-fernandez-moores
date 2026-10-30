// 3.4: performance budgets on what a first visit actually transfers (cold cache, compressed as the
// CDN serves it), plus layout stability and the LCP element. Lighthouse itself runs at checkpoints
// through `pnpm lighthouse` (scripts/lighthouse.mjs), which enforces the scores and LCP < 1.5 s.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
const FIRST_VIEW_BUDGET = 100_000; // bytes; 82 KB at 1440 and 73 KB at 390 on 2026-10-22, fonts are 50 KB of it
const MOTION = /\/_astro\/(paper|tooth|light-)/;
// 8.5k3: the motion layers, fetched once the still's intro is over: the paper and the clip, about 10 KB at 1440 since
// 8.6f dropped the tooth (71 KB of 81). Phones fetch none since 8.6b (plain green; tests/e2e/hero-motion.test.ts)
const MOTION_BUDGET = { 1440: 20_000 };
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => {
  browser = await launch({ port: 9339 });
  await browser.send('Network.enable');
  await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
});
after(() => browser?.close());

for (const width of [1440, 390]) {
  test(`${width}px: first view under ${FIRST_VIEW_BUDGET / 1000} KB, no layout shift, the LCP is in the hero`, async () => {
    await browser.open(BASE, { width });
    await sleep(1500);
    const r = await browser.evaluate(`new Promise((resolve) => {
      const lcp = [], shifts = [];
      new PerformanceObserver((list) => lcp.push(...list.getEntries())).observe({ type: 'largest-contentful-paint', buffered: true });
      // 8.6g (astra's review): layout shifts reach an observer only; getEntriesByType('layout-shift') is always empty
      new PerformanceObserver((list) => shifts.push(...list.getEntries())).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        // 8.5k3: the hero's motion layers come after the still's intro, only where motion is welcome; they have their
        // own budget below, so a slow load that reaches them before this point doesn't count them as the first view
        const bytes = nav.transferSize + performance.getEntriesByType('resource').filter((e) => !${MOTION}.test(e.name)).reduce((s, e) => s + e.transferSize, 0);
        const cls = shifts.reduce((s, e) => s + (e.hadRecentInput ? 0 : e.value), 0);
        const last = lcp.at(-1);
        // 5.2: the hero art or the hero's name. Chrome skips sparse images for LCP, and on a phone the
        // dark crop of Fig. 01 is sparse enough that the name wins, which is the faster case
        const el = last && last.element;
        resolve({ bytes, cls, observed: PerformanceObserver.supportedEntryTypes.includes('layout-shift'), encoding: nav.encodedBodySize < nav.decodedBodySize, lcp: el ? (el.closest('.hero__img, .hero__name') ? 'hero' : el.tagName + '.' + el.className) : null });
      }, 300);
    })`);
    assert.ok(r.encoding, 'the HTML arrives compressed');
    assert.ok(r.bytes <= FIRST_VIEW_BUDGET, `first view transfers ${r.bytes} bytes`);
    assert.ok(r.observed, 'layout shifts are observable here');
    assert.ok(r.cls < 0.01, `CLS ${r.cls}`);
    assert.equal(r.lcp, 'hero', `LCP element: ${r.lcp}`);
  });
}

for (const width of [1440] as const) {
  test(`${width}px: the hero's motion layers stay under ${MOTION_BUDGET[width] / 1000} KB`, async () => {
    await browser.open(BASE, { width });
    await sleep(9000);
    const r = await browser.evaluate(`performance.getEntriesByType('resource').filter((e) => ${MOTION}.test(e.name)).map((e) => [e.name, e.transferSize])`);
    const bytes = r.reduce((s: number, [, n]: [string, number]) => s + n, 0);
    assert.equal(r.length, 2, `the paper and one clip (${r.map(([n]: [string]) => n.split('/').pop()).join(', ')})`);
    assert.ok(bytes <= MOTION_BUDGET[width], `the motion layers transfer ${bytes} bytes`);
  });
}
