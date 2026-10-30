import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serve } from '../scripts/serve.mjs';

// The timeout and unref() keep a regression a fast failure: a listen error that never settles
// the promise would otherwise leave the first server holding the process open.
test('serve rejects with EADDRINUSE when the port is taken, instead of crashing the process', { timeout: 3000 }, async () => {
  const first = await serve(4399);
  first.unref();
  try {
    await assert.rejects(serve(4399), { code: 'EADDRINUSE' });
  } finally {
    first.close();
  }
});

// 3.4: compress text like the production CDN does, so local measurements match what visitors get
test('serve compresses text with brotli or gzip when the browser accepts it, and leaves images alone', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { get } = await import('node:http');
  const { brotliDecompressSync, gunzipSync } = await import('node:zlib');
  const root = mkdtempSync(join(tmpdir(), 'svya-serve-'));
  const html = '<!doctype html><title>x</title>' + 'texto '.repeat(500);
  writeFileSync(join(root, 'index.html'), html);
  writeFileSync(join(root, 'a.avif'), Buffer.alloc(64, 1));
  const server = await serve(4398, root);
  const fetchRaw = (path: string, enc?: string) => new Promise<{ headers: Record<string, unknown>; body: Buffer }>((resolve) => {
    get({ host: '127.0.0.1', port: 4398, path, headers: enc ? { 'accept-encoding': enc } : {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
    });
  });
  try {
    const br = await fetchRaw('/', 'gzip, deflate, br, zstd');
    assert.equal(br.headers['content-encoding'], 'br');
    assert.equal(brotliDecompressSync(br.body).toString(), html);
    const gz = await fetchRaw('/', 'gzip');
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.equal(gunzipSync(gz.body).toString(), html);
    const plain = await fetchRaw('/');
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal(plain.body.toString(), html);
    const img = await fetchRaw('/a.avif', 'br');
    assert.equal(img.headers['content-encoding'], undefined, 'images are already compressed');
  } finally {
    server.close();
  }
});

// 3.5: the local server applies _headers and serves 404.html like Workers static assets do, so the
// e2e tests run with the real CSP and see the real 404
test('serve applies _headers rules, hides _headers itself, and answers misses with 404.html', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'svya-serve-'));
  writeFileSync(join(root, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(root, '404.html'), '<h1>no está</h1>');
  mkdirSync(join(root, '_astro'));
  writeFileSync(join(root, '_astro', 'a.css'), 'a{}');
  writeFileSync(join(root, '_headers'), '# comment\n/*\n  X-Content-Type-Options: nosniff\n  X-Robots-Tag: noindex\n\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  const server = await serve(4397, root);
  try {
    const home = await fetch('http://127.0.0.1:4397/');
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('cache-control'), 'public, max-age=0, must-revalidate', "Workers' default (8.6h6)");
    const css = await fetch('http://127.0.0.1:4397/_astro/a.css');
    assert.equal(css.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(css.headers.get('x-robots-tag'), 'noindex', 'rules stack');
    const miss = await fetch('http://127.0.0.1:4397/socios/viejo');
    assert.equal(miss.status, 404);
    assert.equal(await miss.text(), '<h1>no está</h1>');
    assert.equal(miss.headers.get('x-content-type-options'), 'nosniff', 'the 404 page gets the headers too');
    assert.equal((await fetch('http://127.0.0.1:4397/_headers')).status, 404, '_headers is never served');
  } finally {
    server.close();
  }
});

test('parseHeaders and headersFor read the Cloudflare _headers format', async () => {
  const { parseHeaders, headersFor } = await import('../scripts/serve.mjs');
  const rules = parseHeaders('/*\n  A: 1\n/x/*\n  B: 2\n  A: 3\n');
  assert.deepEqual(headersFor('/', rules), { a: '1' });
  assert.deepEqual(headersFor('/x/y.css', rules), { a: '1, 3', b: '2' });
});

// 8.6c named .mp4 video/mp4 (Safari plays nothing named application/octet-stream). It also made this server answer byte
// ranges, believing Workers static assets did; read off the live site in 8.6h6, they don't: every Range gets the whole
// file, 200, no Accept-Ranges. This server does the same (8.6h6b), so local tests see what production serves
test('serve serves .mp4 as video/mp4 and, like Workers static assets, answers a range with the whole file', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { get } = await import('node:http');
  const root = mkdtempSync(join(tmpdir(), 'svya-serve-'));
  const clip = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
  writeFileSync(join(root, 'clip.mp4'), clip);
  const server = await serve(4396, root);
  const fetchRaw = (path: string, range?: string) => new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve) => {
    get({ host: '127.0.0.1', port: 4396, path, headers: range ? { range } : {} }, (res) => {
      const parts: Buffer[] = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts) }));
    });
  });
  try {
    const whole = await fetchRaw('/clip.mp4');
    assert.equal(whole.status, 200);
    assert.equal(whole.headers['content-type'], 'video/mp4');
    for (const range of ['bytes=0-1', 'bytes=100-199', 'bytes=900-', 'bytes=2000-']) {
      const r = await fetchRaw('/clip.mp4', range);
      assert.equal(r.status, 200, `${range}: the whole file`);
      assert.ok(r.body.equals(clip), `${range}: every byte`);
      assert.equal(r.headers['accept-ranges'], undefined);
      assert.equal(r.headers['content-range'], undefined);
    }
  } finally {
    server.close();
  }
});

// 8.6h6: caching as Workers static assets do it (read off the live site on 2026-10-24): without a rule, `public,
// max-age=0, must-revalidate` (not on a range request); an ETag, weak when the body is compressed, strong when it isn't;
// a matching If-None-Match answered 304 with no body. Repeat visits measured locally then cost what they cost live
test('serve sends the ETags, revalidation and default Cache-Control that Workers static assets send', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'svya-serve-'));
  writeFileSync(join(root, 'index.html'), '<h1>inicio</h1>'.repeat(50));
  writeFileSync(join(root, '404.html'), '<h1>no está</h1>');
  writeFileSync(join(root, 'og.jpg'), Buffer.alloc(500, 7));
  mkdirSync(join(root, '_astro'));
  writeFileSync(join(root, '_astro', 'a.css'), 'a{}');
  writeFileSync(join(root, '_headers'), '/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  const server = await serve(4395, root);
  const url = (p: string) => `http://127.0.0.1:4395${p}`;
  try {
    const home = await fetch(url('/'), { headers: { 'accept-encoding': 'br' } });
    assert.equal(home.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
    const tag = home.headers.get('etag') ?? '';
    assert.match(tag, /^W\/"[0-9a-f]{16,}"$/, `a weak ETag on a compressed body (${tag})`);
    const again = await fetch(url('/'), { headers: { 'accept-encoding': 'br', 'if-none-match': tag } });
    assert.equal(again.status, 304, 'revalidated');
    assert.equal((await again.arrayBuffer()).byteLength, 0, 'no body');
    assert.equal(again.headers.get('etag'), tag);
    const img = await fetch(url('/og.jpg'));
    const strong = img.headers.get('etag') ?? '';
    assert.match(strong, /^"[0-9a-f]{16,}"$/, `a strong ETag on an uncompressed body (${strong})`);
    assert.equal((await fetch(url('/og.jpg'), { headers: { 'if-none-match': `W/${strong}` } })).status, 304, 'compared weakly, as browsers do');
    assert.equal((await fetch(url('/og.jpg'), { headers: { 'if-none-match': '"other"' } })).status, 200);
    assert.equal((await fetch(url('/og.jpg'), { headers: { range: 'bytes=0-9' } })).headers.get('cache-control'), null, 'no default on a range request');
    assert.equal((await fetch(url('/_astro/a.css'))).headers.get('cache-control'), 'public, max-age=31536000, immutable', 'a rule overrides the default');
    const miss = await fetch(url('/nada'));
    assert.equal(miss.status, 404);
    assert.equal(miss.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  } finally {
    server.close();
  }
});
