// 6.3: the browser's bar and the site's header are one surface. theme-color (what Safari and
// Chrome paint their own bar with) must equal the header's rendered colour, at every width.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9342 }); });
after(() => browser?.close());

const hex = (rgb: string) => '#' + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

for (const width of [1440, 390]) {
  test(`${width}px: the header is fixed, unpainted and translucent`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    await sleep(200);
    const r = await browser.evaluate(`(() => {
      const meta = document.querySelector('meta[name="theme-color"]').content;
      const style = getComputedStyle(document.querySelector('.site-header'));
      document.querySelector('.site-header .menu-button').click();
      const menu = getComputedStyle(document.getElementById('menu')).backgroundColor;
      return { meta, bar: style.backgroundColor, backdrop: style.backdropFilter || style.webkitBackdropFilter,
        position: style.position, menu };
    })()`);
    assert.equal(r.bar, 'rgba(0, 0, 0, 0)', `header has no painted background: ${r.bar}`);
    assert.match(r.backdrop, /blur\(16px\)/, `header softens the page beneath it: ${r.backdrop}`);
    assert.equal(r.position, 'fixed');
    if (width < 900) assert.equal(hex(r.menu), r.meta.toLowerCase(), `the phone menu ${r.menu} matches too`);
  });
}

// 7.1 (Franco, 2026-10-22): the name in the bar a bit bigger, still inside the bar and clear of the menu
// button down to 320. 8.2 (Franco, 2026-10-23): the name alone, without the monogram, on the content edge
for (const width of [1440, 390, 320]) {
  test(`${width}px: the bar's name reads a step larger, on the content edge, and still fits`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    await sleep(200);
    const r = await browser.evaluate(`(() => {
      const header = document.querySelector('.site-header');
      const bar = header.getBoundingClientRect();
      const name = document.querySelector('.site-header .brand-link__name');
      const range = document.createRange(); range.selectNodeContents(name);
      const t = range.getBoundingClientRect();
      const brand = document.querySelector('.site-header > .brand-link').getBoundingClientRect();
      const button = document.querySelector('.site-header .menu-button');
      const b = getComputedStyle(button).display === 'none' ? null : button.getBoundingClientRect();
      return { marks: document.querySelectorAll('.site-header .brand-link svg, #menu .brand-link svg').length,
        textLeft: t.left, edge: bar.left + parseFloat(getComputedStyle(header).paddingLeft),
        textTop: t.top - bar.top, textBottom: bar.bottom - t.bottom,
        nameSize: parseFloat(getComputedStyle(name).fontSize), brandRight: brand.right, buttonLeft: b ? b.left : null };
    })()`);
    assert.equal(r.marks, 0, 'no monogram in the bar or the menu');
    assert.ok(r.nameSize >= 13, `name at ${r.nameSize}px (was 11)`);
    assert.ok(Math.abs(r.textLeft - r.edge) <= 1, `the name starts at ${r.textLeft}px, the content edge is at ${r.edge}px`);
    assert.ok(r.textTop >= 4 && r.textBottom >= 4, `the name sits inside the bar (${r.textTop}px / ${r.textBottom}px clear)`);
    if (r.buttonLeft !== null) assert.ok(r.brandRight <= r.buttonLeft - 8, `the brand ends at ${r.brandRight}px, the menu button starts at ${r.buttonLeft}px`);
  });
}

// The clean navigation stays whole while scrolling: no filled brand block and no surprise menu square.
test('1440px: the transparent desktop navigation stays whole after the hero', async () => {
  await browser.open(BASE, { width: 1440 });
  const r = await browser.evaluate(`(async () => {
    scrollTo({ top: innerHeight * 1.5, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    const header = document.querySelector('.site-header');
    const link = document.querySelector('.site-header > .brand-link');
    const nav = document.querySelector('.site-header > .site-nav');
    const button = document.querySelector('.site-header > .menu-button');
    return { bar: getComputedStyle(header).backgroundColor, brand: getComputedStyle(link).backgroundColor,
      navOpacity: getComputedStyle(nav).opacity, navDisplay: getComputedStyle(nav).display,
      buttonDisplay: getComputedStyle(button).display };
  })()`);
  assert.equal(r.bar, 'rgba(0, 0, 0, 0)');
  assert.equal(r.brand, 'rgba(0, 0, 0, 0)');
  assert.equal(r.navOpacity, '1');
  assert.notEqual(r.navDisplay, 'none');
  assert.equal(r.buttonDisplay, 'none');
});

// 8.4: Chrome reads the manifest under the real CSP and headers, with no errors, in the brand green
test('Chrome reads the web app manifest, served as a manifest, in the brand green', async () => {
  await browser.open(BASE, { width: 1440 });
  const r = await browser.send('Page.getAppManifest', {});
  assert.match(r.url ?? '', /\/site\.webmanifest$/);
  assert.deepEqual(r.errors, [], 'no manifest errors');
  assert.equal(JSON.parse(r.data || '{}').theme_color, '#2a3220');
  const type: string = await browser.evaluate(`fetch('/site.webmanifest').then((res) => res.headers.get('content-type'))`);
  assert.match(type, /^application\/manifest\+json/);
});

// 8.9 (Franco, 2026-10-24: "disable that on chrome its wierd that a website ask for download it"): Chrome finds the
// page not installable, so it shows no install button in the address bar and no install prompt
test('Chrome offers no install: the manifest asks for a browser tab, not an app window', async () => {
  await browser.open(BASE, { width: 1440 });
  const { installabilityErrors: errors } = await browser.send('Page.getInstallabilityErrors', {});
  assert.ok(errors.some((e: { errorId: string }) => e.errorId === 'manifest-display-not-supported'), JSON.stringify(errors));
});
