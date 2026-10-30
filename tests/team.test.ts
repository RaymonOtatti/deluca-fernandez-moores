import { test } from 'node:test';
import assert from 'node:assert/strict';
import { team } from '../src/content/team.ts';
import { readFileSync } from 'node:fs';

test('all ten current partners, in the order of svya.com.ar', () => {
  assert.deepEqual(team.partners.map((p) => p.name), [
    'Ignacio J. M. Sáenz Valiente',
    'Damián F. Cassino',
    'María Lucila Romero',
    'Matías A. Fredriks',
    'Sebastián R. Frabosqui Díaz',
    'Nicolás S. Novoa',
    'Claudia Ostergaard',
    'María de los Milagros Páez',
    'Eugenia Prieri Belmonte',
    'Eduardo Romero',
  ]);
});

test('fields are short, and blank only where the site has no bio', () => {
  for (const p of team.partners) {
    assert.ok(p.field.length <= 60, `${p.name}: field is short`);
    if (!p.field) assert.ok(['Eugenia Prieri Belmonte', 'Eduardo Romero'].includes(p.name), `${p.name} needs a field`);
  }
});

// 7.4 (Franco, 2026-10-22): the featured operation left the page; its text waits in CONTENT-PARKED.md
test('no featured operation on the page; its text is parked', () => {
  assert.equal('deal' in team, false);
  const parked = readFileSync(new URL('../docs/CONTENT-PARKED.md', import.meta.url), 'utf8');
  for (const word of ['Exponenciar', 'Agripay', 'Grupo Financiero Galicia', 'Sebastián Frabosqui']) assert.ok(parked.includes(word), word);
});

// 3.2: "cuarenta abogados" stays together, so the heading never ends on a lone "abogados." The
// section title is capped to its column (SectionHead), which keeps the pair fitting at every width.
test('the team heading keeps its last two words together, and breaks where its tone changes', () => {
  assert.match(team.title[1], /cuarenta abogados\.$/);
  // "Un equipo de" stays whole, so on phones the line breaks where the second tone starts
  assert.equal(team.title[0], 'Un equipo\u00a0de');
});

// 8.4b (Franco, 2026-10-23): everyone else in the firm, by group, as svya.com.ar shows them (its visible
// list, which is Franco's pasted one), spelled as published; the partners keep their rows
test('everyone else, by group, as the site shows them', () => {
  const parked = readFileSync(new URL('../docs/CONTENT-PARKED.md', import.meta.url), 'utf8');
  const published = parked.slice(parked.indexOf('## Equipo (full list as published)'), parked.indexOf('## Partner bios'));
  assert.deepEqual(team.staff.map((g) => [g.label, g.names.length]), [
    ['Abogados', 31], ['Procuración', 2], ['Administración', 4], ['Colaboradores', 1], ['Colaborador externo permanente', 1],
  ]);
  const names = team.staff.flatMap((g) => g.names);
  assert.equal(new Set(names).size, names.length, 'no one twice');
  for (const n of names) assert.match(published, new RegExp(`^${n}\\s*$`, 'm'), `${n} is on the site's list, spelled as published`);
  for (const p of team.partners) assert.ok(!names.includes(p.name), `${p.name} stays a partner`);
});
