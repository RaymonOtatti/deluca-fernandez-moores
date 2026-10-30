import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { site } from '../src/content/site.ts';

test('site metadata fits search and share cards', () => {
  assert.equal(site.name, 'Sáenz Valiente & Asociados');
  assert.ok(site.title.includes(site.name));
  assert.ok(site.title.length <= 60, `title is ${site.title.length} chars`);
  assert.ok(site.description.length >= 50 && site.description.length <= 160, `description is ${site.description.length} chars`);
  assert.equal(site.lang, 'es-AR');
  assert.equal(site.ogLocale, 'es_AR');
});

// 5.3: the card shows the name and the kicker, not the dropped headline
test("the share card's alt text describes the card as it is now", () => {
  assert.doesNotMatch(site.ogImageAlt, /Derecho empresario/);
  assert.match(site.ogImageAlt, /Sáenz Valiente/);
  // 7.12c took the mark off the card; 8.5 (Franco chose C) puts the monogram back, as the hero's watermark
  assert.match(site.ogImageAlt, /monograma/, '8.5: the card shows the hero, watermark included');
  assert.match(site.ogImageAlt, /& Asociados/, '7.11: and the whole name');
});

// 6.3 (Franco, 2026-10-22): the browser's own bar takes the brand green, the same as the site's header
test('theme-color is the brand green (the forest token)', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const forest = css.match(/--forest:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.equal(site.themeColor.toLowerCase(), forest?.toLowerCase());
});
