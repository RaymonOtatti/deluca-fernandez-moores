// The built site in real Chrome at five widths (needs a server: run through `node scripts/e2e.mjs`).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
const WIDTHS = [1440, 1024, 768, 390, 320];
let browser: Awaited<ReturnType<typeof launch>>;

before(async () => { browser = await launch({ port: 9334 }); });
after(() => browser?.close());

for (const width of WIDTHS) {
  test(`${width}px: nothing scrolls sideways and every image decodes`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    // Scroll through so the lazy images load
    const total: number = await browser.evaluate('document.documentElement.scrollHeight');
    for (let y = 0; y < total; y += 500) { await browser.evaluate(`scrollTo(0, ${y})`); await sleep(50); }
    // eager first, as the contrast test does: a lazy image that hasn't started loading can hold decode() open
    await browser.evaluate('Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => null); }))');

    const layout = await browser.evaluate(`(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > vw + 1)
        .slice(0, 5).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
      return { scroll: document.documentElement.scrollWidth, vw, wide };
    })()`);
    assert.ok(layout.scroll <= layout.vw, `scrollWidth ${layout.scroll} > ${layout.vw} (wide: ${layout.wide.join(', ')})`);

    const broken = await browser.evaluate('[...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src)');
    assert.deepEqual(broken, [], 'every image decodes');

    // 7.11 (Franco): the hero name is smaller, in two lines: "Sáenz Valiente" over a smaller "& Asociados".
    // It fits inside the content box at every width
    const name = await browser.evaluate(HERO_NAME);
    assert.ok(name.right <= name.content + 1, `hero name ends at ${name.right}px, past the content edge at ${name.content}px`);
    // 8.5i (Franco, 2026-10-23: take E): the monogram beside the name, the pair centred in the hero; the name in
    // two lines, "& Asociados" under them, ending where "Valiente" ends
    const sig = await browser.evaluate(HERO_SIGNATURE);
    assert.ok(Math.abs(sig.centre - sig.contentCentre) <= Math.max(4, sig.contentWidth * 0.015), `the lockup is centred at ${Math.round(sig.centre)}px, the content at ${Math.round(sig.contentCentre)}px`);
    assert.ok(Math.abs(sig.middle - sig.heroMiddle) <= sig.heroHeight * 0.05, 'centred down');
    assert.ok(sig.markRight <= sig.nameLeft - 16, `the mark (ends ${Math.round(sig.markRight)}) sits left of the name (starts ${Math.round(sig.nameLeft)})`);
    // 8.6d (Franco, at Gate 6: "hero needs to be bigger"): the lockup about 1.4 times on a desktop, 1.3 on a phone
    assert.ok(width >= 900 ? sig.markHeight >= 196 && sig.markHeight <= 296 : sig.markHeight >= 117 && sig.markHeight <= 190, `mark ${Math.round(sig.markHeight)}px tall`);
    assert.ok(sig.valienteTop >= sig.saenzBottom - 4, '"Valiente" on its own line, under "Sáenz"');
    assert.ok(sig.subTop >= sig.valienteBottom - 2, '"& Asociados" under the name');
    assert.ok(Math.abs(sig.subRight - sig.valienteRight) <= 3, `"& Asociados" ends at ${Math.round(sig.subRight)}px, "Valiente" at ${Math.round(sig.valienteRight)}px`);
    assert.ok(sig.subSize <= Math.max(sig.lineSize * 0.45, 13), `"& Asociados" at ${sig.subSize}px under a ${sig.lineSize}px name`);

    // 3.1e, better-layout: align to shared edges
    const at = await browser.evaluate(SHARED_EDGES);
    if (width < 900) {
      assert.ok(Math.abs(at.fieldLeft - at.nameLeft) <= 1, `a partner's field starts at ${at.fieldLeft}px, under a name that starts at ${at.nameLeft}px`);
    } else {
      assert.ok(Math.abs(at.contactoTop - at.labelTop) <= 1, `footer "Contacto" sits at ${at.contactoTop}px, the column labels at ${at.labelTop}px`);
    }
  });
}

// 8.6g (astra's review): under 900 px the Áreas art fills the band's width. At 768 its 4:5 box, capped at 80 % of the
// screen's height, took its width from that height and left a strip of forest green beside it
for (const width of [768, 390, 320]) {
  test(`${width}px: the Áreas art spans the full width`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const r = await browser.evaluate(`(() => { const s = document.querySelector('.areas').getBoundingClientRect(), f = document.querySelector('.areas__fig').getBoundingClientRect(); return { s: s.width, f: f.width }; })()`);
    assert.ok(Math.abs(r.f - r.s) <= 1, `the art is ${Math.round(r.f)}px wide in a ${Math.round(r.s)}px band`);
  });
}

// 8.6g (astra's review): with reduced motion (or no script) the staff stand in columns; a group's label never ends a
// column while its names start the next
for (const width of [1440, 1024, 768]) {
  test(`${width}px: each staff label sits in the same column as its first name`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    await browser.evaluate('document.fonts.ready');
    const split: string[] = await browser.evaluate(`[...document.querySelectorAll('.staff__list:not([aria-hidden]) h3')].filter((h) => {
      const a = h.getBoundingClientRect(), b = h.nextElementSibling.querySelector('li').getBoundingClientRect();
      return Math.abs(a.left - b.left) > 2 || b.top < a.top;
    }).map((h) => h.textContent.trim())`);
    assert.deepEqual(split, [], `labels apart from their names: ${split.join(', ')}`);
  });
}

// 8.5i: the hero's lockup (take E), measured on text boxes and the mark's own box
const HERO_SIGNATURE = `(() => {
  const box = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const name = document.querySelector('.hero__name');
  const [saenz, valiente] = [...name.querySelectorAll(':scope > span:not(.wordmark__sub)')].map(box);
  const subEl = name.querySelector('.wordmark__sub'), sub = box(subEl);
  const mark = document.querySelector('.hero__text svg').getBoundingClientRect();
  const hero = name.closest('.hero'), hr = hero.getBoundingClientRect(), cs = getComputedStyle(hero);
  const left = hr.left + parseFloat(cs.paddingLeft), right = hr.right - parseFloat(cs.paddingRight);
  const l = Math.min(mark.left, saenz.left), r = Math.max(mark.right, valiente.right, sub.right, saenz.right);
  const t = Math.min(mark.top, saenz.top), b = Math.max(mark.bottom, sub.bottom);
  return { centre: (l + r) / 2, contentCentre: (left + right) / 2, contentWidth: right - left,
    middle: (t + b) / 2, heroMiddle: hr.top + hr.height / 2, heroHeight: hr.height,
    markRight: mark.right, markHeight: mark.height, nameLeft: Math.min(saenz.left, valiente.left),
    saenzBottom: saenz.bottom, valienteTop: valiente.top, valienteBottom: valiente.bottom, valienteRight: valiente.right,
    subTop: sub.top, subRight: sub.right, subSize: parseFloat(getComputedStyle(subEl).fontSize), lineSize: parseFloat(getComputedStyle(name).fontSize) };
})()`;

// Text boxes (not element boxes), so padding and line boxes don't hide a misalignment.
const SHARED_EDGES = `(() => {
  const textBox = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const p = document.querySelector('.partner');
  return {
    nameLeft: Math.round(textBox(p.querySelector('.partner__name')).left),
    fieldLeft: Math.round(textBox(p.querySelector('.partner__field')).left),
    contactoTop: Math.round(textBox(document.querySelector('.footer__brand h2')).top),
    labelTop: Math.round(textBox(document.querySelector('.footer__cols dt')).top),
  };
})()`;

// The hero name's text boxes (not element boxes): line 1 is the two words, line 2 the smaller "& Asociados"
const HERO_NAME = `(() => {
  const box = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const name = document.querySelector('.hero__name');
  const words = [...name.querySelectorAll(':scope > span:not(.wordmark__sub)')].map(box);
  const sub = name.querySelector('.wordmark__sub');
  const hero = name.closest('.hero');
  const hr = hero.getBoundingClientRect(), cs = getComputedStyle(hero);
  const left = hr.left + parseFloat(cs.paddingLeft), right = hr.right - parseFloat(cs.paddingRight);
  const lineLeft = Math.min(...words.map((w) => w.left)), lineRight = Math.max(...words.map((w) => w.right));
  const lineTop = Math.min(...words.map((w) => w.top)), s = box(sub);
  return {
    right: Math.round(Math.max(box(name).right, ...words.map((w) => w.right))), content: Math.round(right), contentWidth: Math.round(right - left),
    lineWidth: Math.round(lineRight - lineLeft), lineRight: Math.round(lineRight), subRight: Math.round(s.right),
    lineCentre: Math.round((lineLeft + lineRight) / 2), contentCentre: Math.round((left + right) / 2),
    blockMiddle: Math.round((lineTop + s.bottom) / 2), heroMiddle: Math.round(hr.top + hr.height / 2), heroHeight: Math.round(hr.height),
    lineBottom: Math.round(Math.max(...words.map((w) => w.bottom))), subTop: Math.round(s.top),
    lineSize: parseFloat(getComputedStyle(name).fontSize), subSize: parseFloat(getComputedStyle(sub).fontSize),
  };
})()`;

// 3.1e, better-layout: 100vw includes a classic (Windows) scrollbar, so vw-sized type can overshoot the
// margin by the scrollbar's width. Headless Chrome hides scrollbars, so narrow the page by 15 px instead.
test('1440px with a classic 15 px scrollbar: the hero name still fits inside the content box', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  await browser.evaluate(`document.documentElement.style.width = 'calc(100% - 15px)'`);
  await sleep(200);
  const name = await browser.evaluate(HERO_NAME);
  assert.ok(name.right <= name.content + 1, `hero name ends at ${name.right}px, past the content edge at ${name.content}px`);
});

// 7.5 (Franco, 2026-10-22): without the wordmark and the coordinates, the footer shrinks to the
// contact columns and the © line: at most 60 % of its 6.10 height (685 px at 1440, 980 px at 390)
for (const [width, before] of [[1440, 685], [390, 980]] as const) {
  test(`${width}px: the footer is at most 60 % of its old height`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const h: number = await browser.evaluate(`document.querySelector('.footer').getBoundingClientRect().height`);
    assert.ok(h <= before * 0.6, `footer is ${Math.round(h)} px tall (was ${before})`);
  });
}

// 7.8: the map's pin marks the office, which the map is centred on, at every crop
for (const width of [1440, 768, 390]) {
  test(`${width}px: the map is in view-able shape and its pin sits at its centre`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const r = await browser.evaluate(`(async () => {
      const img = document.querySelector('.map__frame img');
      img.loading = 'eager'; await img.decode();
      const f = document.querySelector('.map__frame').getBoundingClientRect();
      const d = document.querySelector('.map__dot').getBoundingClientRect();
      return { w: f.width, h: f.height, dx: d.left + d.width / 2 - (f.left + f.width / 2), dy: d.top + d.height / 2 - (f.top + f.height / 2), natural: img.naturalWidth };
    })()`);
    assert.ok(r.natural > 0, 'the map decodes');
    assert.ok(r.h >= 240, `the map is ${Math.round(r.w)} × ${Math.round(r.h)}`);
    assert.ok(Math.abs(r.dx) <= 1 && Math.abs(r.dy) <= 1, `pin off centre by ${r.dx}, ${r.dy}`);
  });
}

// 8.4c: the avenue names stay on the map at every crop, readable, clear of the pin's tag and of each other
for (const width of [1440, 768, 390]) {
  test(`${width}px: the three avenue names sit inside the map, clear of the pin's tag and of each other`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const r = await browser.evaluate(`(() => {
      const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const frame = box(document.querySelector('.map__frame'));
      const tag = box(document.querySelector('.map__tag'));
      const roads = [...document.querySelectorAll('.map__road')].map((el) => ({ text: el.textContent, size: parseFloat(getComputedStyle(el).fontSize), ...box(el) }));
      return { frame, tag, roads };
    })()`);
    const hit = (a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    assert.equal(r.roads.length, 3);
    for (const road of r.roads) {
      assert.ok(road.size >= 12, `${road.text} at ${road.size}px`);
      assert.ok(road.l >= r.frame.l && road.r <= r.frame.r && road.t >= r.frame.t && road.b <= r.frame.b, `${road.text} stays inside the map`);
      assert.ok(!hit(road, r.tag), `${road.text} clears the pin's tag`);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(!hit(r.roads[i], r.roads[j]), `${r.roads[i].text} and ${r.roads[j].text} overlap`);
  });
}

// 9.1 (Franco, 2026-10-25, take B): the three office photos, one size, as one 4:3 strip across the content, joined by
// 2 px of paper; under 900 px the strip stands, one photo above the next
const PLATES = `(() => {
  const head = document.querySelector('.oficina__head').getBoundingClientRect();
  return { head: [head.left, head.right], plates: [...document.querySelectorAll('.plate__frame')].map((p) => { const r = p.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }) };
})()`;
for (const width of [1440, 1024, 768, 390, 320]) {
  test(`${width}px: La Oficina's three photos, one size, 4:3, joined by 2 px`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const { head, plates } = await browser.evaluate(PLATES);
    assert.equal(plates.length, 3);
    for (const p of plates) {
      assert.ok(Math.abs(p.w - plates[0].w) <= 1 && Math.abs(p.h - plates[0].h) <= 1, `one size: ${plates.map((q: { w: number; h: number }) => `${Math.round(q.w)}×${Math.round(q.h)}`).join(', ')}`);
      assert.ok(Math.abs(p.w / p.h - 4 / 3) < 0.02, `4:3, not ${Math.round(p.w)}×${Math.round(p.h)}`);
    }
    const row = width >= 900;
    for (let i = 1; i < 3; i++) {
      const gap = row ? plates[i].l - plates[i - 1].r : plates[i].t - plates[i - 1].b;
      assert.ok(Math.abs(gap - 2) <= 0.6, `${row ? 'side by side' : 'stacked'}, 2 px apart, not ${gap.toFixed(1)}`);
      if (row) assert.ok(Math.abs(plates[i].t - plates[0].t) <= 0.5, 'on one line');
      else assert.ok(Math.abs(plates[i].l - plates[0].l) <= 0.5, 'one above the next');
    }
    assert.ok(Math.abs(plates[0].l - head[0]) <= 1 && Math.abs((row ? plates[2] : plates[0]).r - head[1]) <= 1, `across the content: ${Math.round(plates[0].l)}–${Math.round((row ? plates[2] : plates[0]).r)} against ${Math.round(head[0])}–${Math.round(head[1])}`);
  });
}

// 9.2 (Franco, 2026-10-25, a screenshot with the space marked from the notes to the band's end: "carrousell thinner not
// text of the carrousell, shrink that space"): measured before, 84 px above the rolling row and the band's full padding
// below it (160 px at 1440, 129 at 1024, 82 at 390); the names keep their size
for (const width of [1440, 1024, 390]) {
  test(`${width}px: the rolling names sit close to the notes and to the band's end`, async () => {
    await browser.open(BASE, { width });
    await sleep(800);
    const r = await browser.evaluate(`(() => {
      const notes = document.querySelector('.equipo__notes').getBoundingClientRect(), row = document.querySelector('.staff__window').getBoundingClientRect(), band = document.querySelector('#equipo').getBoundingClientRect();
      return { turning: document.querySelector('.staff').hasAttribute('data-turning'), above: row.top - notes.bottom, below: band.bottom - row.bottom, font: getComputedStyle(document.querySelector('.staff li')).fontSize };
    })()`);
    assert.ok(r.turning, 'the row rolls');
    assert.ok(r.above >= 24 && r.above <= 40, `${Math.round(r.above)} px above the row`);
    assert.ok(r.below >= 48 && r.below <= 64, `${Math.round(r.below)} px from the row to the band's end`);
    assert.equal(r.font, '16px', 'the names keep their size');
  });
}
