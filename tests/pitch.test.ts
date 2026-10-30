// 8.5b (Franco, 2026-10-23: "create a pdf with those options to also show the client, to be able to change if
// they prefer another", "in spanish"): the five hero-logo takes as a PDF for the client. Printed by headless
// Chrome from design/hero-logo/propuesta.html (scripts/pdf.mjs), so it matches the renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const PDF = new URL('docs/Saenz-Valiente-portada-propuestas.pdf', root);
const HTML = new URL('design/hero-logo/propuesta.html', root);

test('the PDF: seven A4 landscape pages, light enough to send', () => {
  assert.ok(existsSync(PDF), 'the PDF exists');
  const pdf = readFileSync(PDF).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  const pages = pdf.match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
  assert.equal(pages.length, 7, 'a cover, five takes, how to choose');
  const box = pdf.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  assert.ok(box && Math.abs(Number(box[1]) - 841.9) < 2 && Math.abs(Number(box[2]) - 595.3) < 2, `A4 landscape (${box?.slice(1)})`);
  assert.ok(statSync(PDF).size <= 3_000_000, `${statSync(PDF).size} bytes`);
});

test('its source: Spanish for the client, the five options, E proposed, in usted', () => {
  const html = readFileSync(HTML, 'utf8');
  assert.match(html, /<html lang="es-AR"/);
  for (const letter of 'ABCDE') assert.match(html, new RegExp(`Opción ${letter}\\b`), `Opción ${letter}`);
  // 8.5i (Franco chose E after C): E is the proposal, C an option like the rest
  const option = (l: string, next: string) => html.slice(html.indexOf(`Opción ${l}`), html.indexOf(next));
  assert.match(option('E', 'Cómo elegir'), /class="tag">Propuesta/, 'E is the proposal');
  assert.doesNotMatch(option('C', 'Opción D'), /class="tag"/, 'C is not');
  assert.match(html, /Proponemos la opción E/);
  const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\b(elegí|elegís|podés|mirá|decinos|tenés|querés)\b/i, 'usted, not vos');
  assert.doesNotMatch(text, /\b(Desktop|Phone|option|choose)\b/, 'no English left in it');
  for (const img of html.matchAll(/src="([^"]+)"/g)) assert.ok(existsSync(new URL(img[1], HTML)), `${img[1]} exists`);
});
