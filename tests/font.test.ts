// 6.8 (Franco, 2026-10-22): a display face of our own, "Valiente Display", drawn from the SVA
// monogram's logic (design/font/build-font.py). Capitals with Spanish accents, digits and the few
// symbols the wordmark and the numbers use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readTtf } from './helpers/font.ts';

const dir = new URL('../design/font/build/', import.meta.url);
const ttf = new URL('ValienteDisplay-Light.ttf', dir);
const woff2 = new URL('ValienteDisplay-Light.woff2', dir);

test('the font is built, as TTF and WOFF2', () => {
  assert.ok(existsSync(ttf), 'design/font/build/ValienteDisplay-Light.ttf');
  assert.ok(existsSync(woff2), 'design/font/build/ValienteDisplay-Light.woff2');
});

test('it covers the capitals, Spanish accents, digits and the symbols the site needs', () => {
  const info = readTtf(readFileSync(ttf));
  const need = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789 +.,·-–—';
  const missing = [...need].filter((c) => !info.chars.has(c.codePointAt(0)!));
  assert.deepEqual(missing, [], `missing: ${missing.join(' ')}`);
  // what the wordmark and the big numbers actually set
  for (const c of 'SÁENZ VALIENTE1912 1946 +40') assert.ok(info.chars.has(c.codePointAt(0)!), c);
});

test('metrics: 1000 units, cap height 700, named "Valiente Display"', () => {
  const info = readTtf(readFileSync(ttf));
  assert.equal(info.unitsPerEm, 1000);
  assert.equal(info.capHeight, 700);
  assert.equal(info.family, 'Valiente Display');
});

test('light enough to preload: WOFF2 under 30 KB', () => {
  const size = statSync(woff2).size;
  assert.ok(size <= 30_000, `woff2 is ${size} bytes`);
});

// 6.9: the site serves exactly the approved build, from its self-hosted fonts
test('the site uses the approved build: src/assets/fonts holds the same WOFF2', () => {
  const site = new URL('../src/assets/fonts/ValienteDisplay-Light.woff2', import.meta.url);
  assert.ok(existsSync(site), 'src/assets/fonts/ValienteDisplay-Light.woff2');
  assert.ok(readFileSync(site).equals(readFileSync(woff2)), 'same bytes as design/font/build');
});

test('a display token puts Valiente Display first, with Jost behind it', () => {
  const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, /--font-display:\s*'Valiente Display',\s*var\(--font-sans\)/);
});

// 7.10: the self-hosted text face carries only the weights the pages use (Jost 300–400)
test('the text faces are cut to the weights in use', () => {
  const size = (f: string) => statSync(new URL(`../src/assets/fonts/${f}`, import.meta.url)).size;
  assert.ok(size('jost-latin-wght-normal.woff2') <= 18_000, `Jost is ${size('jost-latin-wght-normal.woff2')} bytes`);
  assert.ok(existsSync(new URL('../design/font/instance-fonts.py', import.meta.url)), 'the cut is reproducible');
});

// 8.5e (Franco, 2026-10-23: "review letter S from hero, make it smoother"):
test('the S is drawn from one continuous spline, with smoothed widths, and that is the font the site ships', () => {
  const src = readFileSync(new URL('../design/font/build-font.py', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf("@glyph('S'"), src.indexOf('@glyph(', src.indexOf("@glyph('S'") + 1));
  assert.match(body, /smooth_sweep\(bspline\(/, 'a B-spline centre line, swept with smoothed widths');
  assert.doesNotMatch(body, /\bpath\(/, 'no node-to-node path');
  assert.match(src, /def bspline\(/);
  assert.match(src, /def smooth_sweep\(/);
  const site = readFileSync(new URL('../src/assets/fonts/ValienteDisplay-Light.woff2', import.meta.url));
  assert.ok(site.equals(readFileSync(woff2)), 'the site ships the build');
});

test('the subset text face stays light: Jost ≤ 15.7 KB', () => {
  const size = (f: string) => statSync(new URL(`../src/assets/fonts/${f}`, import.meta.url)).size;
  assert.ok(size('jost-latin-wght-normal.woff2') <= 15_700, `Jost is ${size('jost-latin-wght-normal.woff2')} bytes`);
});

test('the subsets keep what Chrome needs to draw them as before: glyph names in Jost', async () => {
  const { execFileSync } = await import('node:child_process');
  const py = `import json
from fontTools.ttLib import TTFont
t = TTFont('src/assets/fonts/jost-latin-wght-normal.woff2')
print(json.dumps({'post': t['post'].formatType}))`;
  const pyBin = process.platform === 'win32' ? 'python' : 'design/font/.venv/bin/python';
  const fonts = JSON.parse(execFileSync(pyBin, ['-c', py], { cwd: new URL('../', import.meta.url) }).toString());
  assert.equal(fonts.post, 2, 'Jost keeps its glyph names');
});
