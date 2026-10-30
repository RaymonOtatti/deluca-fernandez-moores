// 6.1 (Franco, 2026-10-22): a refresh starts at the top of the page. Every in-page link leaves its
// #hash in the address, and browsers restore the old scroll position on reload, so a refresh used
// to jump straight to a section (Áreas, after the hero's button). A shared link to a section
// still has to work on a fresh visit.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9341 }); });
after(() => browser?.close());

async function reload() {
  await browser.reload();
  // a beat for a late fragment scroll or scroll restoration, which is what this guards against
  await sleep(600);
}
const where = () => browser.evaluate(`({ y: Math.round(scrollY), hash: location.hash, areas: Math.round(document.getElementById('areas').getBoundingClientRect().top) })`);

for (const width of [1440, 390]) {
  test(`${width}px: a shared /#areas lands on Áreas, and a refresh from there starts at the top`, async () => {
    // From a blank page: going from / to /#areas would be a same-document jump with no load event
    await browser.open('about:blank', { width });
    await browser.open(`${BASE}#areas`, { width, reducedMotion: true });
    await sleep(500);
    const shared = await where();
    assert.ok(shared.y > 300 && Math.abs(shared.areas - 56) <= 4, `a fresh visit lands on the section (y ${shared.y}, section at ${shared.areas})`);
    await reload();
    const after = await where();
    assert.equal(after.y, 0, `after a refresh the page is at ${after.y}px, not the top`);
    assert.equal(after.hash, '', 'the #section is cleared from the address');
  });

  test(`${width}px: a refresh after scrolling down starts at the top too`, async () => {
    await browser.open('about:blank', { width });
    await browser.open(BASE, { width, reducedMotion: true });
    await browser.evaluate('scrollTo({ top: 2400, behavior: "instant" })');
    await sleep(300);
    await reload();
    assert.equal((await where()).y, 0, 'the old position is not restored');
  });
}

// Back after an in-page link returns to where the reader was (main-orch-builder, 2026-10-22, measured
// in WebKit): with history.scrollRestoration = 'manual' on every load, Back cleared the #hash but left
// the page at the section. Only a reload needs the manual mode.
for (const width of [1440]) {
  test(`${width}px: following an in-page link and pressing Back returns to where the reader was`, async () => {
    await browser.open('about:blank', { width });
    await browser.open(BASE, { width, reducedMotion: true });
    await browser.evaluate('scrollTo({ top: 300, behavior: "instant" })');
    await sleep(300);
    await browser.evaluate(`document.querySelector('.site-nav a[href="#equipo"]').click()`);
    await sleep(600);
    const there = await where();
    assert.equal(there.hash, '#equipo');
    assert.ok(there.y > 1000, `the link went to Equipo (y ${there.y})`);
    await browser.evaluate('history.back()');
    await sleep(600);
    const back = await where();
    assert.equal(back.hash, '', 'Back clears the #section');
    assert.ok(Math.abs(back.y - 300) <= 4, `Back returns to 300px, the page is at ${back.y}px`);
  });
}

// ...and after a refresh too: the manual mode a reload needs mustn't outlive the reset
test('1440px: after a refresh, an in-page link and Back still return to where the reader was', async () => {
  await browser.open('about:blank', { width: 1440 });
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  await reload();
  await browser.evaluate('scrollTo({ top: 300, behavior: "instant" })');
  await sleep(300);
  await browser.evaluate(`document.querySelector('.site-nav a[href="#equipo"]').click()`);
  await sleep(600);
  await browser.evaluate('history.back()');
  await sleep(600);
  const back = await where();
  assert.ok(Math.abs(back.y - 300) <= 4, `Back returns to 300px, the page is at ${back.y}px`);
});
