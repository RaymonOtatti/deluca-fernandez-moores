import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areas } from '../src/content/areas.ts';

test('two practice groups with their names from svya.com.ar', () => {
  assert.deepEqual(areas.groups.map((g) => g.title), ['Asesoramiento empresario', 'Área contenciosa']);
});

test('each group has the practice areas from svya.com.ar', () => {
  for (const g of areas.groups) {
    assert.ok(g.items.length >= 13, `${g.title} has ${g.items.length} items`);
    assert.equal(new Set(g.items).size, g.items.length, `${g.title} has no duplicates`);
    for (const item of g.items) assert.ok(item.length <= 70, `"${item}" is readable`);
  }
});

test('the heading has two tones', () => {
  assert.equal(areas.title.length, 2);
});
