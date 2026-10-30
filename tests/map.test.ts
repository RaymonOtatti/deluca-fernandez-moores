import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contact } from '../src/content/contact.ts';

const PIN = '-34.5690162,-58.4215254';

test('the map link opens Google Maps at the office pin', () => {
  const url = new URL(contact.map);
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/search/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), PIN);
});

test('the map embed points to the Google Maps office pin', () => {
  assert.ok(contact.mapEmbed.includes('-34.5690162%2C-58.4215254'));
});
