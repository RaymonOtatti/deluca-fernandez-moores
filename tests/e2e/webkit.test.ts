// 8.6c (Franco: "on localhost there is no animation"): the hero's light in Safari's engine. Chrome loads a clip off the
// page and from a server without byte ranges; Safari does neither, so the motion never started there while every Chrome
// test passed. WebKit ships with macOS; this runs scripts/webkit-hero.swift against the served build
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4323/';

test('WebKit (Safari): the light fades in, plays its clip and leaves', { timeout: 120_000 }, async () => {
  const { stdout } = await promisify(execFile)('swift', ['scripts/webkit-hero.swift', BASE], { timeout: 110_000 });
  const r = JSON.parse(stdout.trim().split('\n').at(-1)!);
  assert.ok(r.seen, 'the layers appeared');
  assert.ok(r.on, 'they faded fully in');
  assert.ok(r.drawn, 'the clip\'s frames were drawn');
  assert.ok(r.removed, 'they left at the end, so the still stays');
});
