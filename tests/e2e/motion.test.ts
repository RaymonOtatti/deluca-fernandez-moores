// 6.5–6.7: the scroll motion, measured mid-scroll in Chrome: what's half-way is half-way, what's
// past is complete, and with reduced motion nothing is drawn by pseudo-elements at all.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9343 }); });
after(() => browser?.close());

// scaleX of a pseudo-element's computed transform (1 when there's none)
const SCALE = `(el, pseudo) => { const t = getComputedStyle(el, pseudo).transform; if (!t || t === 'none') return 1; const m = t.match(/matrix\\(([^,]+)/); return m ? Number(m[1]) : 1; }`;

test('1440px: a partner rule entering at the bottom is part-drawn; one higher up is complete', async () => {
  await browser.open(BASE, { width: 1440 });
  const r = await browser.evaluate(`(async () => {
    const scale = ${SCALE};
    const rows = [...document.querySelectorAll('.partner')];
    // put the 6th row just inside the bottom of the viewport
    const target = rows[5];
    scrollTo({ top: target.getBoundingClientRect().top + scrollY - innerHeight * 0.92, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    const low = scale(target, '::before');
    const high = scale(rows[0], '::before');
    return { low, high, border: getComputedStyle(target).borderTopColor };
  })()`);
  assert.ok(r.low > 0.02 && r.low < 0.95, `a row entering is part-drawn (scaleX ${r.low})`);
  assert.ok(r.high > 0.99, `a row higher up is complete (scaleX ${r.high})`);
  assert.match(r.border, /rgba\(0, 0, 0, 0\)|transparent/, 'the plain border makes way for the drawn line');
});

test('1440px: the header progress line follows the page scroll', async () => {
  await browser.open(BASE, { width: 1440 });
  const r = await browser.evaluate(`(async () => {
    const scale = ${SCALE};
    const header = document.querySelector('.site-header');
    const at = async (f) => { scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 200)); return scale(header, '::before'); };
    return { start: await at(0), half: await at(0.5), end: await at(1) };
  })()`);
  assert.ok(r.start < 0.02, `empty at the top (${r.start})`);
  assert.ok(Math.abs(r.half - 0.5) < 0.05, `half-way at the middle (${r.half})`);
  assert.ok(r.end > 0.98, `full at the end (${r.end})`);
});

test('reduced motion: plain borders, no drawn lines', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  await sleep(200);
  const r = await browser.evaluate(`(() => {
    const row = document.querySelector('.partner');
    return { content: getComputedStyle(row, '::before').content, border: getComputedStyle(row).borderTopColor };
  })()`);
  assert.equal(r.content, 'none', 'no pseudo-element line');
  assert.doesNotMatch(r.border, /rgba\(0, 0, 0, 0\)/, 'the real border shows');
});

// 6.6: the paper over a figure just entering is part-rolled; over one well in view it's gone. On the map since
// 8.5h took the office photos off
const SCALE_Y = `(el, pseudo) => { const t = getComputedStyle(el, pseudo).transform; if (!t || t === 'none') return 1; const m = t.match(/matrix\\(([^)]+)\\)/); return m ? Number(m[1].split(',')[3]) : 1; }`;

for (const width of [1440, 390]) {
  test(`${width}px: the map unrolls as it enters`, async () => {
    await browser.open(BASE, { width });
    const r = await browser.evaluate(`(async () => {
      const scaleY = ${SCALE_Y};
      const frame = document.querySelector('.map__frame');
      const at = async (f) => {
        scrollTo({ top: frame.getBoundingClientRect().top + scrollY - innerHeight * f, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 250));
        return scaleY(frame, '::before');
      };
      return { entering: await at(0.9), inView: await at(0.15) };
    })()`);
    assert.ok(r.entering > 0.05 && r.entering < 0.98, `the paper is part-rolled as the map enters (scaleY ${r.entering})`);
    assert.ok(r.inView < 0.02, `and gone once the map is in view (scaleY ${r.inView})`);
  });
}

test('reduced motion: the map shows plainly, no paper over it', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  await sleep(200);
  assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('.map__frame'), '::before').content`), 'none');
});

// 6.7: the hero's light, measured at the top and half a screen down
test('1440px: the hero light is still at the top, and drifts and dims half a screen down', async () => {
  await browser.open(BASE, { width: 1440 });
  const r = await browser.evaluate(`(async () => {
    const fig = document.querySelector('.hero__fig');
    const read = () => { const cs = getComputedStyle(fig); const m = cs.transform.match(/matrix\\(([^)]+)\\)/); return { y: m ? Number(m[1].split(',')[5]) : 0, o: Number(cs.opacity) }; };
    scrollTo({ top: 0, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 200));
    const top = read();
    scrollTo({ top: innerHeight / 2, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 200));
    return { top, half: read() };
  })()`);
  assert.equal(r.top.y, 0, 'no drift at the top (first paint unchanged)');
  assert.equal(r.top.o, 1);
  assert.ok(r.half.y > 10, `drifted down half a screen in (${r.half.y}px)`);
  assert.ok(r.half.o < 0.9 && r.half.o > 0.5, `dimmed (${r.half.o})`);
});

// 6.10: a line that draws as it moves into the viewport must finish by the end of the page. The
// footer's bottom rule is the last thing on the page and can never travel 30 % into the view, so with
// the shared range it stayed a third drawn for good.
for (const width of [1440, 1024, 390, 320]) {
  test(`${width}px: at the end of the page every drawn hairline in view is complete`, async () => {
    await browser.open(BASE, { width });
    const r = await browser.evaluate(`(async () => {
      const scale = ${SCALE};
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 300));
      const short = [];
      for (const [sel, pseudo] of [['.line-top', '::before'], ['.line-bottom', '::after']]) {
        for (const el of document.querySelectorAll(sel)) {
          const box = el.getBoundingClientRect();
          if (box.bottom < 0 || box.top > innerHeight || getComputedStyle(el, pseudo).content === 'none') continue;
          const s = scale(el, pseudo);
          if (s < 0.99) short.push(el.className + ' ' + s.toFixed(2));
        }
      }
      // 7.5: and every reveal in view has fully arrived (the footer's columns stayed at 89–97 %)
      for (const el of document.querySelectorAll('.reveal')) {
        const box = el.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) continue;
        const o = Number(getComputedStyle(el).opacity);
        if (o < 0.999) short.push(el.className + ' opacity ' + o.toFixed(3));
      }
      return short;
    })()`);
    assert.deepEqual(r, [], 'lines left part-drawn, or reveals part-faded, at the end of the page');
  });
}

// 8.6e (Franco, 2026-10-24: horizontal, no label, no pause): the names roll sideways on their own in one row, and
// nothing scrolls the page sideways
for (const width of [1440, 390]) {
  test(`${width}px: the names roll sideways on their own, in one row, with nothing else shown`, async () => {
    await browser.open(BASE, { width });
    const pos = `(() => { const b = document.querySelector('.staff__track').getBoundingClientRect(); return [b.left, b.top]; })()`;
    const r = await browser.evaluate(`(async () => {
      const staff = document.querySelector('.staff');
      staff.scrollIntoView({ block: 'center', behavior: 'instant' }); // the page scrolls smoothly otherwise
      await new Promise((r) => setTimeout(r, 300));
      const items = [...staff.querySelectorAll('.staff__list:not([aria-hidden]) :is(h3, li)')].map((el) => el.getBoundingClientRect().top);
      const label = [...staff.querySelectorAll('*')].find((el) => el.childElementCount === 0 && el.textContent.trim() === 'Todo el equipo');
      const lb = label?.getBoundingClientRect();
      return { spread: Math.max(...items) - Math.min(...items), buttons: staff.querySelectorAll('button').length,
        label: lb ? lb.width * lb.height : -1, sw: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
    })()`);
    assert.ok(r.spread <= 4, `one row (the names' tops spread over ${r.spread}px)`);
    const [x0, y0] = await browser.evaluate(pos);
    await sleep(1500);
    const [x1, y1] = await browser.evaluate(pos);
    assert.ok(x0 - x1 > 3, `it rolls sideways on its own (${(x0 - x1).toFixed(1)}px in 1.5 s)`);
    assert.ok(Math.abs(y1 - y0) < 0.5, 'and only sideways');
    const copy = await browser.evaluate(`document.querySelectorAll('.staff__list').length + ' ' + document.querySelector('.staff__list + .staff__list')?.getAttribute('aria-hidden')`);
    assert.equal(copy, '2 true', 'the script adds the loop copy, hidden from screen readers');
    assert.equal(r.buttons, 0, 'no pause button');
    assert.ok(r.label >= 0 && r.label <= 1, '"Todo el equipo" only for screen readers');
    assert.ok(r.sw <= r.vw, `the page scrolls sideways: ${r.sw} > ${r.vw}`);
  });
}

test('reduced motion: everyone in a still list, without the loop copy', async () => {
  await browser.open(BASE, { width: 390, reducedMotion: true });
  const r = await browser.evaluate(`(() => {
    const items = [...document.querySelectorAll('.staff__list:not([aria-hidden]) li')].map((el) => el.getBoundingClientRect());
    const copy = document.querySelector('.staff__list[aria-hidden]');
    return { n: items.length, out: items.filter((b) => b.left < -1 || b.right > innerWidth + 1 || b.height === 0).length,
      copy: copy ? getComputedStyle(copy).display : 'none', anim: getComputedStyle(document.querySelector('.staff__track')).animationName };
  })()`);
  assert.equal(r.n, 39);
  assert.equal(r.out, 0, `${r.out} names outside the screen or hidden`);
  assert.equal(r.copy, 'none', 'no copy');
  assert.equal(r.anim, 'none', 'nothing moves');
});

// 8.5j's sway left in 8.5k3 (it moved the paper with the light); tests/e2e/hero-motion.test.ts checks the light's
// own motion now

test('reduced motion: the hero light stays still', async () => {
  await browser.open(BASE, { width: 1440, reducedMotion: true });
  const anim: string = await browser.evaluate(`getComputedStyle(document.querySelector('.hero__fig picture')).animationName`);
  assert.equal(anim, 'none');
});

// 8.6g (astra's review): the names roll at about 40 px a second. With reduced motion the list stands in columns, so a
// duration measured then was the columns' width; once motion is welcome again it is measured on the row
test('390px: the names keep their pace when motion becomes welcome after the page loaded', async () => {
  await browser.open(BASE, { width: 390, reducedMotion: true });
  await browser.evaluate('document.fonts.ready');
  await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await sleep(300);
  const r = await browser.evaluate(`(() => {
    const list = document.querySelector('.staff__list:not([aria-hidden])');
    return { width: list.offsetWidth, roll: parseFloat(getComputedStyle(document.querySelector('.staff')).getPropertyValue('--roll')) };
  })()`);
  assert.ok(r.width > 1000, `the names stand in one row (${r.width}px)`);
  assert.ok(Math.abs(r.width / r.roll - 40) < 4, `${(r.width / r.roll).toFixed(1)} px a second`);
});
