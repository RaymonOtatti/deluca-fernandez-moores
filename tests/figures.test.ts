import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { figures } from '../src/content/figures.ts';
import { jpegSize } from './helpers/image-size.ts';
import { colourfulness } from './helpers/colourfulness.ts';

const asset = (file: string) => new URL(`../src/assets/${file}`, import.meta.url);

test('figure ids are unique', () => {
  const ids = figures.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the three office photos are all there', () => {
  assert.deepEqual(figures.map((f) => f.id), ['recepcion', 'sala', 'planta']);
});

for (const f of figures) {
  test(`${f.id}: file, size and words`, () => {
    assert.ok(existsSync(asset(f.file)), `${f.file} exists`);
    const [w, h] = jpegSize(readFileSync(asset(f.file)));
    assert.ok(w >= f.minWidth, `${f.file} is ${w} px wide, needs ${f.minWidth}`);
    assert.ok(h > 0);
    assert.ok(statSync(asset(f.file)).size <= 900_000, `${f.file} source stays under 900 KB`);
    assert.ok(f.alt.length >= 10 && f.alt.length <= 140, 'alt text is a real sentence, not a novel');
    assert.equal('caption' in f, false, `${f.id} carries no caption`);
  });
}

for (const f of figures.filter((x) => x.file.startsWith('photos/'))) {
  test(`${f.id}: the office photo is in full colour`, async () => {
    const m = await colourfulness(asset(f.file));
    assert.ok(m >= 25, `${f.file} scores ${m.toFixed(1)} for colourfulness, needs 25 or more`);
  });
}
