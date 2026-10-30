// A tiny static server for dist/ (no dependencies), used by the e2e tests and screenshots.
// It compresses text (brotli, else gzip) the way the production CDN does, so local measurements
// see the same bytes visitors get. Like Workers static assets, it applies the rules in _headers
// (so the e2e tests run under the real CSP), answers a missing path with 404.html, and, like Workers static assets,
// answers a byte range with the whole file (read off the live site, 8.6h6b). It caches as Workers does (8.6h6): `public, max-age=0,
// must-revalidate` where no rule sets Cache-Control (not on a range request), an ETag (weak on a compressed body), and
// 304 for a matching If-None-Match.
//   node scripts/serve.mjs [port]      → serves dist/ on 127.0.0.1:<port> (default 4323)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.avif': 'image/avif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.gif': 'image/gif',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.txt', '.json', '.xml']);

/** Cloudflare's _headers format: a URL pattern ("*" is a splat), then indented "Name: value" lines. */
export function parseHeaders(src) {
  const rules = [];
  for (const line of src.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      rules.push({ pattern, headers: [] });
    } else {
      const i = line.indexOf(':');
      rules.at(-1)?.headers.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

/** Every matching rule applies; a header set twice is joined with a comma, as Cloudflare does. */
export function headersFor(path, rules) {
  const out = {};
  for (const rule of rules) {
    if (!rule.pattern.test(path)) continue;
    for (const [name, value] of rule.headers) out[name] = out[name] ? `${out[name]}, ${value}` : value;
  }
  return out;
}

export function serve(port = 4323, root = ROOT) {
  const server = createServer(async (req, res) => {
    const urlPath = new URL(req.url, 'http://x').pathname;
    const path = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    const rules = parseHeaders(await readFile(join(root, '_headers'), 'utf8').catch(() => ''));
    let status = 200;
    try {
      if (urlPath === '/_headers' || path === '/_headers' || path === '\\_headers') throw new Error('never served');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await stat(file);
    } catch {
      file = join(root, '404.html');
      status = 404;
    }
    try {
      let body = await readFile(file);
      const headers = { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', vary: 'accept-encoding', ...headersFor(urlPath, rules) };
      if (!headers['cache-control'] && !req.headers.range && !req.headers.authorization) headers['cache-control'] = 'public, max-age=0, must-revalidate';
      const hash = `"${createHash('md5').update(body).digest('hex')}"`;
      const accepts = String(req.headers['accept-encoding'] ?? '');
      if (COMPRESSIBLE.has(extname(file))) {
        if (/\bbr\b/.test(accepts)) { body = brotliCompressSync(body); headers['content-encoding'] = 'br'; }
        else if (/\bgzip\b/.test(accepts)) { body = gzipSync(body); headers['content-encoding'] = 'gzip'; }
      }
      headers.etag = headers['content-encoding'] ? `W/${hash}` : hash;
      // browsers compare weakly: W/"x" matches "x"
      const unweak = (t) => t.trim().replace(/^W\//, '');
      if (status === 200 && String(req.headers['if-none-match'] ?? '').split(',').some((t) => unweak(t) === hash)) {
        res.writeHead(304, headers);
        res.end();
        return;
      }
      res.writeHead(status, headers);
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

import { resolve } from 'node:path';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 4323);
  try {
    await serve(port);
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${port} is already in use. See what holds it: lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    console.error(`Stop that process (kill <PID>), or serve on another port: node scripts/serve.mjs ${port + 1}`);
    process.exit(1);
  }
  console.log(`dist/ on http://127.0.0.1:${port}/`);
}
