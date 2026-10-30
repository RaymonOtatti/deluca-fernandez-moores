import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nav } from '../src/content/nav.ts';
import { contact } from '../src/content/contact.ts';
import { telHref, mailHref } from '../src/lib/links.ts';

test('nav has the sections from svya.com.ar without home, unique in-page anchors', () => {
  assert.deepEqual(nav.map((n) => n.label), ['Acerca de', 'Áreas', 'Equipo', 'Oficina', 'Contacto']);
  for (const n of nav) {
    assert.match(n.href, /^#[a-z]+$/, `${n.label} links to an in-page anchor`);
    assert.ok(n.label.length <= 15);
  }
  assert.equal(new Set(nav.map((n) => n.href)).size, nav.length);
});

test('telHref keeps only the plus sign and digits', () => {
  assert.equal(telHref('+54 11 5235-4769'), 'tel:+541152354769');
  assert.equal(telHref('(011) 5236-0543'), 'tel:01152360543');
});

test('mailHref adds an encoded subject when given', () => {
  assert.equal(mailHref('info@svya.com.ar'), 'mailto:info@svya.com.ar');
  assert.equal(mailHref('contacto@svya.com.ar', 'CV — Búsqueda'), 'mailto:contacto@svya.com.ar?subject=CV%20%E2%80%94%20B%C3%BAsqueda');
});

test('contact data is complete', () => {
  assert.equal(contact.phones.length, 2);
  for (const p of contact.phones) assert.match(p, /^\+54 11 \d{4}-\d{4}$/);
  for (const e of contact.emails) assert.match(e.address, /^[a-z]+@svya\.com\.ar$/);
  assert.match(contact.address.street, /Freyre 3650/);
  assert.match(contact.address.postal, /^C1425$/);
});
