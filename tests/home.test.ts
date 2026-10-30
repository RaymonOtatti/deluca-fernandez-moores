import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as home from '../src/content/home.ts';

// 5.1: the headline is the firm's name (Wordmark); 7.2: no kicker, actions or place. 7.7 gave the lead a
// passage under the hero; 8.4d (Franco, 2026-10-23: "that part it's making that part too long") removed it
test('the hero needs no content of its own, and there is no passage under it', () => {
  assert.equal('hero' in home, false, 'the hero is the name and the light');
  assert.equal('passage' in home, false, 'no passage');
});

test('El Estudio: one statement, one short line, three facts', async () => {
  const { estudio } = await import('../src/content/home.ts');
  assert.equal(estudio.title.length, 2);
  assert.ok(estudio.text.length <= 180, `text is ${estudio.text.length} chars`);
  assert.deepEqual(estudio.facts.map((f) => f.value), ['1912', '1946', '+40']);
  for (const f of estudio.facts) {
    assert.ok(f.label.length <= 12 && f.caption.length <= 48, `${f.value} stays short`);
  }
});

// 8.3 (Franco, 2026-10-23): the firm's history and its present, from svya.com.ar, summarized hard. No new
// claims: every number and every name in them is in the site's own text (docs/CONTENT-PARKED.md)
test('El Estudio: its history and its present, short, in the site\'s own facts', async () => {
  const { estudio } = await import('../src/content/home.ts');
  const { readFile } = await import('node:fs/promises');
  const parked = await readFile(new URL('../docs/CONTENT-PARKED.md', import.meta.url), 'utf8');
  assert.deepEqual(estudio.story.map((s) => s.title), ['Historia', 'Una práctica amplia', 'El Estudio hoy']);
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  for (const s of estudio.story) {
    assert.ok(words(s.text) <= 90, `${s.title} is ${words(s.text)} words`);
    assert.doesNotMatch(s.text, /"/, 'typographic quotes only');
    for (const n of s.text.match(/\d+/g) ?? []) assert.ok(parked.includes(n), `${n} is in the site's text`);
    // capitalized words that don't open a sentence are names: each must be in the site's text
    for (const sentence of s.text.split(/(?<=[.;:])\s+/)) {
      for (const w of sentence.split(/\s+/).slice(1).map((x) => x.replace(/[^\p{L}]/gu, '')).filter((x) => /^\p{Lu}/u.test(x))) {
        assert.ok(parked.includes(w), `"${w}" is in the site's text`);
      }
    }
  }
  assert.ok(words(estudio.story.map((s) => s.text).join(' ')) <= 220, 'summarized hard');
});

test('Carrera: their question, one line, a mailto to contacto@ with a subject', async () => {
  const { carrera } = await import('../src/content/home.ts');
  assert.equal(carrera.title.join(' '), '¿Quiere ser parte del equipo?');
  assert.ok(carrera.text.length <= 100);
  assert.doesNotMatch(carrera.text, /sumate|dudes/, 'one register: usted');
  assert.equal(carrera.action.href, 'mailto:contacto@svya.com.ar?subject=CV');
});

test('the sections carry no label for a numbered subtitle (7.3)', async () => {
  const { estudio, carrera } = await import('../src/content/home.ts');
  const { areas } = await import('../src/content/areas.ts');
  const { team } = await import('../src/content/team.ts');
  for (const [name, s] of Object.entries({ estudio, carrera, areas, team })) assert.equal('label' in s, false, `${name}.label`);
});
