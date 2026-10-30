// 3.3, better-accessibility (WCAG 2.2 AA), walked in Chrome with the keyboard and read from its
// accessibility tree. Static structure (landmarks, headings, links that open tabs) is in tests/build.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, sleep } from '../../scripts/cdp.mjs';
import { contrastRatio } from '../../src/lib/contrast.ts';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9338 }); await browser.send('Accessibility.enable'); });
after(() => browser?.close());

const KEYS = {
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  ShiftTab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 },
};
async function press(name: keyof typeof KEYS) {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEYS[name] });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEYS[name] });
  await sleep(120);
}
const hex = (rgb: string) => '#' + (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('');

// The accessible name Chrome computes for the focused element
async function focusedName(): Promise<string> {
  const { result } = await browser.send('Runtime.evaluate', { expression: 'document.activeElement' });
  const { nodes } = await browser.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
  return String(nodes[0]?.name?.value ?? '').trim();
}

const FOCUSED = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  // The outline sits outside the element, so measure it against the first opaque background behind it
  let bg = null;
  for (let e = el.parentElement; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (!/rgba\\(\\d+, \\d+, \\d+, 0\\)|transparent/.test(c)) { bg = c; break; }
  }
  const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
  const seen = pts.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)
    .some(([x, y]) => { const h = document.elementFromPoint(x, y); return h && (h === el || el.contains(h)); });
  return { what: el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' "' + el.textContent.trim().slice(0, 30) + '"',
    href: el.getAttribute('href'), style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor, bg, seen };
})()`;

for (const width of [1440, 390]) {
  test(`${width}px: keyboard walk: skip link first; every stop named, ringed at 3:1 and in view`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const problems: string[] = [];
    const stops: string[] = [];
    for (let i = 0; i < 80; i++) {
      await press('Tab');
      const f = await browser.evaluate(FOCUSED);
      if (!f) break;
      if (stops.includes(f.what + f.href)) break;
      stops.push(f.what + f.href);
      if (i === 0) assert.match(f.what, /skip-link/, 'the first Tab lands on the skip link');
      const name = await focusedName();
      if (!name) problems.push(`no accessible name (4.1.2): ${f.what}`);
      if (f.style === 'none' || f.width < 2) problems.push(`no 2 px focus ring (2.4.7): ${f.what}`);
      else if (f.bg) {
        const ratio = contrastRatio(hex(f.color), hex(f.bg));
        if (ratio < 3) problems.push(`focus ring ${ratio.toFixed(2)}:1 against ${f.bg} (2.4.7, 1.4.11): ${f.what}`);
      }
      if (!f.seen) problems.push(`focused but hidden (2.4.11): ${f.what}`);
    }
    assert.deepEqual(problems, [], problems.join('\n'));
    // Phones keep the five nav links in the closed menu, so fewer stops there; the hero's two
    // buttons left in 7.2
    assert.ok(stops.length >= (width < 900 ? 9 : 13), `walked ${stops.length} stops: ${stops.join(' | ')}`);
  });
}

// The Tab walk inside the open menu is checked below (8.6g), with and without the script
test('390px: Escape closes the menu and returns focus to its button', async () => {
  await browser.open(BASE, { width: 390, reducedMotion: true });
  const isOpen = () => browser.evaluate(`document.getElementById('menu').matches(':popover-open')`);
  await browser.evaluate(`document.querySelector('.site-header .menu-button').focus()`);
  await press('Enter');
  assert.equal(await isOpen(), true, 'Enter on the menu button opens the menu');
  await press('Tab');
  await press('Escape');
  assert.equal(await isOpen(), false, 'Escape closes the menu');
  assert.equal(await browser.evaluate(`document.activeElement === document.querySelector('.site-header .menu-button')`), true, 'focus returns to the menu button');
});

// 8.6g (astra's review): the open menu covers the screen, so focus must never be behind it: it moves into the menu as
// the menu opens (focus left on the covered button was hidden), and neither Tab nor Shift+Tab takes it out, with the
// script or without it (a native popover isn't modal; without the script nothing closed it as focus left)
for (const script of [true, false]) {
  test(`390px${script ? '' : ', no script'}: focus enters the menu as it opens and stays there both ways`, async () => {
    await browser.send('Emulation.setScriptExecutionDisabled', { value: !script });
    try {
      await browser.open(BASE, { width: 390, reducedMotion: true });
      const isOpen = () => browser.evaluate(`document.getElementById('menu').matches(':popover-open')`);
      const where = () => browser.evaluate(`(() => { const a = document.activeElement; return { inMenu: !!a?.closest('#menu'), none: !a || a === document.body, what: a ? a.tagName + ' ' + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 25)) : '' }; })()`);
      await browser.evaluate(`document.querySelector('.site-header .menu-button').focus()`);
      await press('Enter');
      assert.equal(await isOpen(), true, 'Enter on the menu button opens the menu');
      const first = await where();
      assert.ok(first.inMenu, `focus moved into the menu as it opened (on ${first.what})`);
      const problems: string[] = [];
      for (const key of ['Tab', 'ShiftTab'] as const) {
        await browser.evaluate(`document.querySelector('#menu .menu-button').focus()`);
        for (let i = 0; i < 12; i++) {
          await press(key);
          const w = await where();
          if (!(await isOpen())) break;
          if (!w.inMenu && !w.none) problems.push(`${key}: focus behind the open menu (2.4.11): ${w.what}`);
        }
      }
      assert.deepEqual(problems, [], problems.join('\n'));
    } finally {
      await browser.send('Emulation.setScriptExecutionDisabled', { value: false });
    }
  });
}

for (const width of [1440, 390]) {
  test(`${width}px: every target is 24×24 or spaced like one (2.5.8)`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const small: string[] = await browser.evaluate(`(() => {
      const targets = [...document.querySelectorAll('a[href], button')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[popover]:not(:popover-open)') && !el.matches('.skip-link'));
      const box = (el) => el.getBoundingClientRect();
      const centre = (r) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
      const distToRect = ([x, y], r) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      // Inline exception: the link sits in a sentence, with text of its own block around it
      const inline = (el) => { const p = el.parentElement; return [...p.childNodes].some((n) => n !== el && n.nodeType === 3 && n.data.trim()); };
      const out = [];
      for (const t of targets) {
        const r = box(t);
        if ((r.width >= 24 && r.height >= 24) || inline(t)) continue;
        // Spacing exception: a 24 px circle on its centre touches no other target, nor the
        // circle of another undersized target (so two small ones need 24 px between centres)
        const c = centre(r);
        const small = (u) => { const b = box(u); return b.width < 24 || b.height < 24; };
        const clash = targets.find((u) => u !== t && !inline(u) && (distToRect(c, box(u)) < 12 || (small(u) && Math.hypot(c[0] - centre(box(u))[0], c[1] - centre(box(u))[1]) < 24)));
        if (clash) out.push(t.tagName.toLowerCase() + ' "' + t.textContent.trim().slice(0, 25) + '" ' + Math.round(r.width) + '×' + Math.round(r.height) + ' near "' + clash.textContent.trim().slice(0, 20) + '"');
      }
      return out;
    })()`);
    assert.deepEqual(small, [], small.join('\n'));
  });
}
