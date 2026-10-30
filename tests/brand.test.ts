import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));

// PNG stores width and height as big-endian uint32 at bytes 16 and 20 (IHDR).
const pngSize = (p: string) => {
  const b = read(p);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${p} is a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const svgs: Array<[path: string, maxBytes: number]> = [
  ['src/assets/brand/monogram.svg', 8_000],
];

for (const [path, maxBytes] of svgs) {
  test(`${path} is a clean single-color vector`, () => {
    assert.ok(existsSync(new URL(path, root)), `${path} exists`);
    const svg = read(path).toString();
    assert.match(svg, /viewBox="0 0 [\d.]+ [\d.]+"/, 'has a viewBox');
    assert.match(svg, /fill="currentColor"/, 'inherits color from CSS');
    assert.doesNotMatch(svg, /<image|<text|<style|<script/i, 'no raster, text, styles or scripts');
    assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i, 'no hard-coded colors');
    assert.ok(statSync(new URL(path, root)).size <= maxBytes, `under ${maxBytes} bytes`);
  });
}

test('favicon set exists at the right sizes', () => {
  const svg = read('public/favicon.svg').toString();
  assert.match(svg, /viewBox=/);
  const ico = read('public/favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'favicon.ico has an ICO header');
  assert.deepEqual(pngSize('public/apple-touch-icon.png'), [180, 180]);
});

// 5.3: the card follows the hero since 5.2 (Velo light + the name). Soft light is photographic, so it's a
// JPEG: 66 KB, where the same card as PNG was 530 KB.
test("share image is a 1200×630 JPEG in the new hero's look, light enough to fetch", async () => {
  const { jpegSize } = await import('./helpers/image-size.ts');
  assert.deepEqual(jpegSize(read('public/og.jpg')), [1200, 630]);
  assert.ok(statSync(new URL('public/og.jpg', root)).size <= 150_000, 'og.jpg under 150 KB');
  assert.ok(!existsSync(new URL('public/og.png', root)), 'the old card is gone');
});

// 7.9: the card mirrors the hero, which has no kicker since 7.2 and no coordinates anywhere since 7.5;
// 7.11: the name with "& Asociados" under it
test('the share card carries no kicker and no coordinates, and the whole name', () => {
  const og = read('design/og.html').toString();
  assert.doesNotMatch(og, /34°34/);
  assert.doesNotMatch(og, /Estudio jurídico/);
  assert.match(og, /&amp; Asociados/);
});

test('the share card carries no figure label (6.2)', () => {
  assert.doesNotMatch(read('design/og.html').toString(), /Fig\./);
});

test('the share card sets the name in Valiente Display, like the hero (6.9)', () => {
  const og = read('design/og.html').toString();
  assert.match(og, /@font-face\{[^}]*font-family:'Valiente Display'[^}]*src:url\(\.\.\/src\/assets\/fonts\/ValienteDisplay-Light\.woff2\)/);
  assert.match(og, /h1\{[^}]*font-family:'Valiente Display'/);
});

// 8.5i: the card follows the hero, take E: the logo file's own path beside the name, centred
test('the share card carries the hero\'s lockup: the logo file\'s own path beside the name', () => {
  const og = read('design/og.html').toString();
  const d = (s: string) => s.match(/ d="([^"]+)"/)?.[1];
  assert.equal(d(og), d(read('src/assets/brand/monogram.svg').toString()), 'the original path');
  assert.doesNotMatch(og, /opacity:\.065/, 'no watermark');
  assert.match(og, /\.lockup\{[^}]*display:flex/, 'mark and name side by side');
  assert.match(og, /main\{[^}]*place-items:center/, 'centred');
});

// 8.6h4: Chrome fetches the manifest's 192 px icon on every first visit (6.5 KB, about an eighth of a phone's first
// view). The icons are flat colour, so a 256-colour palette holds them to within one level in 255 at half the bytes
test('the PNG icons are palette PNGs at their sizes, light enough to fetch on every first visit', () => {
  for (const [file, size, maxBytes] of [['icon-192.png', 192, 3_500], ['apple-touch-icon.png', 180, 3_500], ['icon-512.png', 512, 9_000]] as const) {
    const png = read(`public/${file}`);
    assert.deepEqual(pngSize(`public/${file}`), [size, size], file);
    assert.equal(png[25], 3, `${file} is indexed colour (PNG colour type 3)`);
    assert.ok(png.length <= maxBytes, `${file} is ${png.length} bytes`);
  }
});
