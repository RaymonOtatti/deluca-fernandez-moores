// 3.1f, better-colors: measure the rendered pair. Text set over art (the hero figure, the ruler, the
// coordinates, Fig. 02's caption) is checked against the pixels actually behind it, which the token
// pairs in tests/tokens.test.ts can't see. Each text is made transparent, the viewport is captured,
// and the text colour is measured against every pixel of its box.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { launch, sleep } from '../../scripts/cdp.mjs';
import { contrastRatio } from '../../src/lib/contrast.ts';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';
// WCAG AA: 4.5:1 for normal text, 3:1 for large (the hero's name)
// The worst 2 % of pixels may fall below it: a 1 px construction line or a grain speck under a letter
const PERCENTILE = 0.02;
// 5.2: the light now fills the whole hero, so everything set on it is measured against it
const OVER_ART: Array<[selector: string, min: number]> = [
  // 7.2: the kicker, the buttons and the place line are gone (the passage of 7.7 left in 8.4d)
  // 7.11: "& Asociados" is small text, so it needs 4.5:1 (listed first: the first match sets the bar)
  ['.hero__name > .wordmark__sub', 4.5], ['.hero__name > span', 3],
  // 8.4c: the avenue names sit on the map itself
  ['.map__road', 4.5],
];
const SELECTOR = OVER_ART.map(([s]) => s).join(',');


let browser: Awaited<ReturnType<typeof launch>>;
before(async () => { browser = await launch({ port: 9335 }); });
after(() => browser?.close());

const hex = (rgb: string) => '#' + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

for (const width of [1440, 390]) {
  test(`${width}px: text over art reaches 4.5:1 (3:1 when large) against the pixels behind it`, async (t) => {
    await browser.open(BASE, { width, reducedMotion: true });
    await browser.evaluate('Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => null); }))');
    const count: number = await browser.evaluate(`document.querySelectorAll(${JSON.stringify(SELECTOR)}).length`);
    assert.ok(count >= 3, `found ${count} texts over art`);

    const results: string[] = [];
    for (let i = 0; i < count; i++) {
      const box = await browser.evaluate(`(async () => {
        const el = document.querySelectorAll(${JSON.stringify(SELECTOR)})[${i}];
        el.scrollIntoView({ block: 'center' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = el.getBoundingClientRect();
        const color = getComputedStyle(el).color;
        const all = [el, ...el.querySelectorAll('*')];
        all.forEach((n) => n.style.setProperty('color', 'transparent', 'important'));
        const matches = ${JSON.stringify(OVER_ART.map(([s]) => s))}.filter((s) => el.matches(s));
        return { x: r.x, y: r.y, w: r.width, h: r.height, color, matches, text: el.textContent.trim().slice(0, 30), visible: r.width > 0 && r.height > 0 };
      })()`);
      if (!box.visible) continue;
      await sleep(80);
      const { data } = await browser.send('Page.captureScreenshot', { format: 'png' });
      await browser.evaluate(`document.querySelectorAll(${JSON.stringify(SELECTOR)})[${i}].querySelectorAll('*').forEach((n) => n.style.removeProperty('color')); document.querySelectorAll(${JSON.stringify(SELECTOR)})[${i}].style.removeProperty('color')`);

      const left = Math.max(0, Math.floor(box.x)), top = Math.max(0, Math.floor(box.y));
      const raw = await sharp(Buffer.from(data, 'base64'))
        .extract({ left, top, width: Math.max(1, Math.ceil(box.w)), height: Math.max(1, Math.ceil(box.h)) })
        .removeAlpha().raw().toBuffer();
      const ratios: number[] = [];
      for (let p = 0; p < raw.length; p += 3) {
        const bg = '#' + [raw[p], raw[p + 1], raw[p + 2]].map((n) => n.toString(16).padStart(2, '0')).join('');
        ratios.push(contrastRatio(hex(box.color), bg));
      }
      ratios.sort((a, b) => a - b);
      const worst = ratios[Math.floor(ratios.length * PERCENTILE)];
      results.push(`${box.text} ${worst.toFixed(2)}`);
      const min = OVER_ART.find(([sel]) => box.matches.includes(sel))?.[1] ?? 4.5;
      assert.ok(worst >= min, `"${box.text}" (${box.color}) reaches only ${worst.toFixed(2)}:1 against the art behind it, needs ${min}`);
    }
    t.diagnostic(results.join(' | '));
    // The name's two words and the lead (the kicker, buttons and place line left in 7.2)
    assert.ok(results.length >= 3, `measured ${results.length} texts: ${results.join(' | ')}`);
  });
}
