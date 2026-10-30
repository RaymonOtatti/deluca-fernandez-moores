// 3.2b, better-es-ar: rules every content string keeps. The content modules are walked whole, so
// a new string is checked without touching this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const dir = new URL('../src/content/', import.meta.url);
const modules = await Promise.all(readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => import(new URL(f, dir).href)));
const strings: string[] = [];
const walk = (v: unknown) => {
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
modules.forEach(walk);

test('content strings were found', () => {
  assert.ok(strings.length > 100, `found ${strings.length}`);
});

test('a number never sits apart from its % on a breakable space (Intl es-AR writes 12%)', () => {
  for (const s of strings) assert.doesNotMatch(s, /\d[ \t]%/, s);
});
