import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pad2 } from '../src/lib/format.ts';

test('pad2 numbers items the way the labels read: 01, 02 … 10', () => {
  assert.equal(pad2(1), '01');
  assert.equal(pad2(9), '09');
  assert.equal(pad2(10), '10');
  assert.equal(pad2(123), '123');
});

// 3.2b, better-es-ar: numbers come from Intl with the es-AR locale, never typed by hand
test('percent formats through Intl es-AR, which writes 12% with no breakable space', async () => {
  const { percent } = await import('../src/lib/format.ts');
  assert.equal(percent(0.12), new Intl.NumberFormat('es-AR', { style: 'percent' }).format(0.12));
  assert.doesNotMatch(percent(0.12), /\d %/);
});
