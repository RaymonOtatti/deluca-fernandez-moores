import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, oklch } from '../src/lib/contrast.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const color = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  assert.ok(m, `token --${name} is defined as a hex color`);
  return m[1];
};

// Every text color the site uses, on every band it appears on.
// 7:1 for body text on the main bands (AAA), 4.5:1 for secondary text (AA).
const pairs: Array<[fg: string, bg: string, min: number]> = [
  ['ink', 'paper', 7],
  ['ink', 'stone', 7],
  ['olive', 'paper', 4.5],
  ['olive', 'stone', 4.5],
  ['olive-soft', 'paper', 3], // large headline type only
  ['paper', 'ink', 7],
  ['muted', 'ink', 4.5],
  ['paper', 'forest', 7],
  ['sage', 'forest', 4.5],
  ['sage-light', 'forest', 4.5], // 8.6d: the hero's "& Asociados", on the phone's plain green
  ['sage-light', 'ink', 4.5], // and on the desktop hero's shade
  ['paper', 'wall', 7], // Fig. 02's caption, on the wall the art fades into
  ['muted', 'wall', 4.5],
];

for (const [fg, bg, min] of pairs) {
  test(`--${fg} on --${bg} reaches ${min}:1`, () => {
    const ratio = contrastRatio(color(fg), color(bg));
    assert.ok(ratio >= min, `${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
  });
}

test('palette keeps the brief colors exactly (but the paper and the stone, since 7.6)', () => {
  assert.equal(color('forest').toLowerCase(), '#2a3220');
});

// 7.6 (Franco, 2026-10-22): the off-white goes a bit more ivory ("marfil"). Same lightness as the
// brief's #ededea (L 0.945), so every pair above holds, but warmer: a little chroma, on a yellow hue
test('the paper is ivory: the brief\'s lightness, a little warmer', () => {
  const [l, c, h] = oklch(color('paper'));
  assert.ok(Math.abs(l - 0.945) <= 0.005, `lightness ${l.toFixed(3)}`);
  assert.ok(c >= 0.012 && c <= 0.025, `chroma ${c.toFixed(4)} (the brief's is 0.004)`);
  assert.ok(h >= 80 && h <= 100, `hue ${h.toFixed(0)}° (a warm yellow)`);
});

// 7.6: the stone (Carrera's band) read cold and greenish beside the ivory, so it takes the same warmth
// at its own lightness (the brief's #d9d9d4, L 0.884)
test('the stone shares the paper\'s warmth at its own lightness', () => {
  const [l, c, h] = oklch(color('stone'));
  const [, , paperHue] = oklch(color('paper'));
  assert.ok(Math.abs(l - 0.884) <= 0.005, `lightness ${l.toFixed(3)}`);
  assert.ok(c >= 0.012 && c <= 0.025, `chroma ${c.toFixed(4)}`);
  assert.ok(Math.abs(h - paperHue) <= 5, `hue ${h.toFixed(0)}°, the paper's is ${paperHue.toFixed(0)}°`);
});

test('type, space and motion scales are defined', () => {
  for (const t of ['step-display', 'step-1', 'step-2', 'step-3', 'step-lead', 'step-0', 'step-small', 'step-label',
    'font-sans', 'font-editorial', 'pad', 'section-y', 'gutter', 'ease-out', 'dur-reveal']) {
    assert.match(css, new RegExp(`--${t}:`), `--${t} is defined`);
  }
});

// The photo roles (--image-outline, --media-placeholder) left with the office photos in 8.5h; 9.1 brings back
// whatever the new take needs
