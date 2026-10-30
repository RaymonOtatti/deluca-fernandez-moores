// 4.2: the Worker that publishes dist/. Static assets only, with no Worker script, so the rules in
// _headers apply to every response and no request runs (or bills) Worker code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../wrangler.jsonc', import.meta.url);
const config = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'))
  : null;

test('wrangler.jsonc publishes dist/ as svya-mvp on workers.dev (Gate 2, 2026-10-22)', () => {
  assert.ok(config, 'wrangler.jsonc exists');
  assert.equal(config.name, 'svya-mvp');
  assert.equal(config.workers_dev, true);
  assert.equal(config.preview_urls, false, 'no extra preview URLs to share by accident');
  assert.equal(config.assets.directory, './dist');
});

test('missing paths get the 404 page, and there is no Worker script to bypass _headers', () => {
  assert.equal(config?.assets.not_found_handling, '404-page');
  assert.equal(config?.main, undefined, 'assets only');
});

test('the deploy runs every test and pins its tools', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.deploy ?? '', /^pnpm test && /, 'nothing ships without the full suite');
  assert.match(pkg.scripts.deploy ?? '', /wrangler@\d+\.\d+\.\d+ deploy/, 'a pinned Wrangler');
});
