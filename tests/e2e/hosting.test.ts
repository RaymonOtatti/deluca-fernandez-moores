// 3.5, in Chrome with the headers from dist/_headers applied (scripts/serve.mjs reads them like
// Workers static assets do): the page runs under its CSP without a single violation, and a missing
// path gets the 404 page with a 404 status.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => {
  browser = await launch({ port: 9340 });
  // Record violations from the first byte, before any page script runs
  await browser.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '')));`,
  });
});
after(() => browser?.close());

for (const width of [1440, 390]) {
  test(`${width}px: the page runs under its CSP without a violation, menu included`, async () => {
    await browser.open(BASE, { width });
    // Read from Node: inside the page, fetch() is itself blocked by default-src 'none'
    const csp = (await fetch(BASE)).headers.get('content-security-policy');
    assert.match(String(csp), /default-src 'none'/, 'the policy is actually served');
    const total: number = await browser.evaluate('document.documentElement.scrollHeight');
    for (let y = 0; y < total; y += 600) { await browser.evaluate(`scrollTo(0, ${y})`); await sleep(40); }
    if (width < 900) {
      // The menu script must run under the policy: open, then follow a link, which closes it
      await browser.evaluate(`document.querySelector('.site-header .menu-button').click()`);
      await sleep(250);
      await browser.evaluate(`document.querySelector('#menu a[href$="#equipo"]').click()`);
      await sleep(250);
      assert.equal(await browser.evaluate(`document.getElementById('menu').matches(':popover-open')`), false, 'the menu script closed the menu');
    }
    const violations: string[] = await browser.evaluate('window.__csp');
    assert.deepEqual(violations, [], violations.join('\n'));
  });
}

for (const width of [1440, 390]) {
  test(`${width}px: a missing path answers 404 with the branded page, and its links lead home`, async () => {
    await browser.open(`${BASE}socios/viejo`, { width, reducedMotion: true });
    const r = await browser.evaluate(`(() => ({
      status: performance.getEntriesByType('navigation')[0].responseStatus,
      h1: document.querySelector('h1')?.textContent.replace(/\\s+/g, ' ').trim(),
      home: document.querySelector('main a[href="/"]') !== null,
      nav: [...document.querySelectorAll('.site-nav a, #menu a[href*="#"]')].map((a) => new URL(a.href).pathname),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      csp: window.__csp,
    }))()`);
    assert.equal(r.status, 404);
    assert.equal(r.h1, 'Esta página no existe.');
    assert.ok(r.home, 'a button home');
    assert.ok(r.nav.length > 0 && r.nav.every((p: string) => p === '/'), `nav links lead home: ${r.nav.join(', ')}`);
    assert.equal(r.overflow, 0);
    assert.deepEqual(r.csp, []);
  });
}
