import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = new URL('../src/assets/art/hero/', import.meta.url);
const file = (name: string) => fileURLToPath(new URL(name, dir));

test('hero video assets exist and are optimized for web delivery', () => {
  for (const name of ['film-web.mp4', 'film-two-web.mp4']) {
    const filePath = file(name);
    assert.ok(existsSync(filePath), `${name} exists`);
    const size = statSync(filePath).size;
    assert.ok(size > 0 && size <= 6_000_000, `${name} is under 6 MB (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }
});
