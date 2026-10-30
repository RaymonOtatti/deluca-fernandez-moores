// 3.5: what the host serves around the pages: security headers (_headers, read by Workers static
// assets), robots.txt and the 404 page that `not_found_handling: "404-page"` returns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { DIST, read, tags } from '../helpers/dist.ts';
import { parseHeaders, headersFor } from '../../scripts/serve.mjs';

const headersFile = `${DIST}_headers`;
const rules = existsSync(headersFile) ? parseHeaders(read(headersFile)) : [];
const page = headersFor('/', rules);
const csp = Object.fromEntries((page['content-security-policy'] ?? '').split(';').map((d) => d.trim()).filter(Boolean)
  .map((d) => { const [name, ...values] = d.split(/\s+/); return [name, values]; }));

test('_headers ships with the build', () => {
  assert.ok(existsSync(headersFile), 'dist/_headers (from public/_headers)');
});

test('a strict CSP: only same-origin resources, nothing inline, no framing, no forms, no plugins', () => {
  assert.deepEqual(csp['default-src'], ["'none'"]);
  for (const d of ['script-src', 'style-src', 'img-src', 'font-src']) assert.deepEqual(csp[d], ["'self'"], d);
  for (const d of ['base-uri', 'form-action', 'frame-ancestors']) assert.deepEqual(csp[d], ["'none'"], d);
  // Same-origin only: Lighthouse fetches robots.txt from inside the page and failed under 'none' (3/3 runs)
  assert.deepEqual(csp['connect-src'], ["'self'"]);
  assert.doesNotMatch(page['content-security-policy'] ?? '', /unsafe-|data:|https?:|\*/, 'no unsafe-*, data:, hosts or wildcards');
});

test('transport and browser hardening headers', () => {
  assert.match(page['strict-transport-security'] ?? '', /max-age=(\d+)/);
  assert.ok(Number(page['strict-transport-security']?.match(/max-age=(\d+)/)?.[1]) >= 31536000, 'HSTS for a year or more');
  assert.equal(page['x-content-type-options'], 'nosniff');
  assert.equal(page['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(page['cross-origin-opener-policy'], 'same-origin');
  for (const feature of ['camera', 'microphone', 'geolocation']) assert.match(page['permissions-policy'] ?? '', new RegExp(`${feature}=\\(\\)`));
});

test('while the page is noindex, the header says so too', () => {
  const html = read(`${DIST}index.html`);
  if (/<meta name="robots" content="noindex/.test(html)) assert.equal(page['x-robots-tag'], 'noindex, nofollow');
});

test('hashed build assets are cached for a year, immutable', () => {
  assert.equal(headersFor('/_astro/index.abc123.css', rules)['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(headersFor('/', rules)['cache-control'], undefined, 'pages keep the host default (revalidate)');
});

test('everything the pages load is same-origin, so the CSP allows it', () => {
  for (const file of ['index.html', '404.html']) {
    if (!existsSync(`${DIST}${file}`)) continue;
    const html = read(`${DIST}${file}`);
    const urls = [
      ...tags(html, 'script').map((t) => t.src), ...tags(html, 'link').filter((l) => l.rel !== 'canonical').map((t) => t.href),
      ...tags(html, 'img').flatMap((t) => [t.src, ...(t.srcset ?? '').split(',').map((s) => s.trim().split(' ')[0])]),
      ...tags(html, 'source').flatMap((t) => (t.srcset ?? '').split(',').map((s) => s.trim().split(' ')[0])),
    ].filter(Boolean);
    assert.ok(urls.length > 3, `${file} loads something`);
    for (const u of urls) assert.match(u, /^\/(?!\/)/, `${file}: ${u} is same-origin`);
  }
});

test('robots.txt lets crawlers fetch the pages, so they can see the noindex', () => {
  assert.ok(existsSync(`${DIST}robots.txt`));
  const robots = read(`${DIST}robots.txt`);
  assert.match(robots, /^User-agent: \*$/m);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m, 'a disallowed page never shows crawlers its noindex');
});

test('404: a real page in the brand, noindex, whose every link works from any URL', () => {
  assert.ok(existsSync(`${DIST}404.html`), 'dist/404.html');
  const html = read(`${DIST}404.html`);
  assert.match(html, /<html[^>]*lang="es-AR"/);
  assert.match(html, /<title>Página no encontrada · Sáenz Valiente &amp; Asociados<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(html, /<h1[\s>]/);
  const hrefs = tags(html, 'a').map((a) => a.href);
  assert.ok(hrefs.includes('/'), 'a way home');
  // Served at any missing path, so in-page anchors must point at the home page, not at this URL
  for (const h of hrefs) if (h.startsWith('#')) assert.equal(h, '#contenido', `${h} would point at the missing URL`);
});
