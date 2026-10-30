// 3.1f, better-colors: components never write a colour of their own, and use the palette only
// through roles (--bg, --fg, --soft, --rule, …), the way the bands in global.css do. A colour change
// is then one line in tokens.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/components/', import.meta.url);
const styles = readdirSync(dir)
  .filter((f) => f.endsWith('.astro'))
  .map((f) => ({ file: f, css: [...readFileSync(new URL(f, dir), 'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') }));

const PALETTE = ['ink', 'forest', 'paper', 'stone', 'olive', 'olive-soft', 'muted', 'sage', 'wall'];
// Declarations, with comments removed: [property, value]
const declarations = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([-\w]+)\s*:\s*([^;{}]+)/g)].map((m) => [m[1], m[2]] as const);

test('components write no colour literals (masks excepted: they only use alpha)', () => {
  for (const { file, css } of styles) {
    for (const [prop, value] of declarations(css)) {
      if (prop.replace(/^-webkit-/, '').startsWith('mask')) continue; // the prefixed mask too (8.6g, Chrome before 120)
      assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/i, `${file}: ${prop}: ${value.trim()}`);
    }
  }
});

test('components use palette colours only to set roles, never directly', () => {
  const direct = new RegExp(`var\\(--(${PALETTE.join('|')})\\)`);
  for (const { file, css } of styles) {
    for (const [prop, value] of declarations(css)) {
      if (prop.startsWith('--')) continue; // defining a role, e.g. --fg: var(--paper)
      assert.doesNotMatch(value, direct, `${file}: ${prop}: ${value.trim()} (use a role such as var(--fg))`);
    }
  }
});
