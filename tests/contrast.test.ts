import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oklch, contrastRatio, parseHex } from '../src/lib/contrast.ts';

test('parseHex reads 3- and 6-digit hex', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.deepEqual(parseHex('#2a3220'), [42, 50, 32]);
});

test('parseHex rejects anything else', () => {
  assert.throws(() => parseHex('rgb(0,0,0)'));
  assert.throws(() => parseHex('#12345'));
});

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrastRatio('#777777', '#ffffff').toFixed(2), '4.48');
  assert.equal(contrastRatio('#ffffff', '#777777').toFixed(2), '4.48');
});

// 7.6: OKLCH, to describe a colour the way it's perceived (lightness, chroma, hue)
test('oklch: white, black and a known colour', () => {
  const [wl, wc] = oklch('#ffffff');
  assert.ok(Math.abs(wl - 1) < 0.001 && wc < 0.001, `white ${wl} ${wc}`);
  const [bl] = oklch('#000000');
  assert.ok(Math.abs(bl) < 0.001, `black ${bl}`);
  const [l, c, h] = oklch('#ff0000'); // sRGB red: oklch(0.628 0.258 29.2)
  assert.ok(Math.abs(l - 0.628) < 0.002 && Math.abs(c - 0.258) < 0.002 && Math.abs(h - 29.2) < 0.3, `red ${l} ${c} ${h}`);
});
