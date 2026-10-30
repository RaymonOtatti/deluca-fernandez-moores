// 3.2, better-typography: how the text actually wraps and renders, measured in Chrome at every width.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch } from '../../scripts/cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9337 }); });
after(() => browser?.close());

// Every visible character with its line (rect top), in document order, grouped by block.
const LAYOUT = `(() => {
  // The text's block; Meta's flex items count as one run, so a separator is compared across items
  const block = (n) => { let e = n.parentElement; while (e && (getComputedStyle(e).display.startsWith('inline') || e.matches('.meta__run, .meta__item, .meta__sep'))) e = e.parentElement; return e; };
  // Hidden by an ancestor's overflow clip (how Meta drops the separator that lands at a line start)
  const clipped = (el, rect) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).overflowX === 'visible') continue;
      const r = e.getBoundingClientRect();
      if (rect.right <= r.left + 0.5 || rect.left >= r.right - 0.5) return true;
    }
    return false;
  };
  const chars = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (let i = 0; i < n.data.length; i++) {
      const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
      const rect = r.getClientRects()[0];
      if (rect && rect.width) chars.push({ c: n.data[i], top: Math.round(rect.top + scrollY), block: block(n), sep: !!n.parentElement.closest('.meta__sep'), meta: !!n.parentElement.closest('.meta'), clipped: clipped(n.parentElement, rect) });
    }
  }
  return chars;
})`;

const CHECKS = `(() => {
  const chars = ${LAYOUT}();
  const problems = [];

  // 1. Weight floor: under 18 px, 400 or heavier
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
    if (!own || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    // 8.5g: the address and the map's names are set in Valiente Display at Franco's request; it only comes in
    // Light (300), and at 14 px with 0.14em tracking it was checked legible on paper and ink, so those are exempt
    if (el.closest('.place') && parseFloat(cs.fontSize) >= 13.5 && parseFloat(cs.letterSpacing) >= 1.5) continue;
    if (parseFloat(cs.fontSize) < 18 && Number(cs.fontWeight) < 400) problems.push('light ' + cs.fontSize + ' ' + cs.fontWeight + ': ' + el.textContent.trim().slice(0, 40));
  }

  // 2. A separator ("·", or any separator Meta draws) never starts or ends a line it's visible on
  chars.forEach((ch, i) => {
    if ((ch.c !== '·' && !ch.sep) || !ch.c.trim() || ch.clipped) return;
    const near = (dir) => { for (let j = i + dir; j >= 0 && j < chars.length; j += dir) { if (chars[j].block !== ch.block) return null; if (chars[j].c.trim() && !chars[j].clipped) return chars[j]; } return null; };
    const prev = near(-1), next = near(1);
    if ((prev && Math.abs(prev.top - ch.top) > 2) || (next && Math.abs(next.top - ch.top) > 2)) {
      problems.push('dangling ·: ' + ch.block.textContent.trim().slice(0, 50));
    }
  });

  // 2b. (6.10) Meta clips only its separators: an item that wraps inside itself keeps every letter
  //     of its next line (at 320 the start of "Valiente" fell into the clipped margin)
  const lost = chars.filter((ch) => ch.meta && !ch.sep && ch.c.trim() && ch.clipped);
  if (lost.length) problems.push('clipped letters in a Meta run: ' + lost.map((ch) => ch.c).join(''));

  // 3. A heading or figure caption of 3+ words never ends on a lone word
  for (const el of document.querySelectorAll('h1, h2:not(.label), h3, figcaption > :first-child')) {
    if (!el.getClientRects().length) continue;
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const m of n.data.matchAll(/\\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + 1);
        const rect = r.getClientRects()[0];
        if (rect) words.push(Math.round(rect.top));
      }
    }
    if (words.length < 3) continue;
    const last = Math.max(...words);
    if (words.filter((t) => Math.abs(t - last) <= 2).length === 1) problems.push('lone last word: ' + el.textContent.trim().replace(/\\s+/g, ' '));
  }
  return problems;
})()`;

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`${width}px: weights, separators and last lines read deliberately`, async () => {
    await browser.open(BASE, { width, reducedMotion: true });
    const problems: string[] = await browser.evaluate(CHECKS);
    assert.deepEqual(problems, [], problems.join('\n'));
  });
}
