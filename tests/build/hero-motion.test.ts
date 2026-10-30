// 8.5k3 (Franco, 2026-10-23: "it needs to be the light that moves, not the background"; the Blender take A): the
// approved still stays the hero image (the LCP, and all that shows without the script or with reduced motion). The
// motion's three layers sit in a <template>, so nothing of them loads until the page's script decides to play, and
// the script blends them on a <canvas>: a canvas is never an LCP candidate, while a full-bleed <video> or <img>
// shown later was (on a phone, where the dark still is too sparse to count, it moved the LCP to ~2.6 s).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, files, read, tags } from '../helpers/dist.ts';

const html = read(join(DIST, 'index.html'));
const hero = html.slice(html.indexOf('class="hero '), html.indexOf('</section>', html.indexOf('class="hero ')));
const template = hero.match(/<template id="hero-motion"[^>]*>([\s\S]*?)<\/template>/)?.[1] ?? '';
const outside = html.replace(/<template[\s\S]*?<\/template>/g, '');
const css = files(DIST, '.css').map(read).join('\n');

test('the hero image is the approved still, first to load', () => {
  const img = tags(hero, 'img').find((i) => i.class?.includes('hero__img'));
  assert.ok(img, 'the hero <img>');
  assert.match(img.src, /\/_astro\/still\./, `src ${img.src}`);
  assert.equal(img.fetchpriority, 'high');
  // 8.6b (Franco, 2026-10-24: "on mobile we may need to cancel this animation and show a plain green"): under 900 px
  // the picture's first source is a blank, so a phone never downloads the still; the band shows plain forest green
  const [phone, ...rest] = tags(hero, 'source').filter((s) => s.srcset);
  assert.equal(phone.media, '(max-width: 899px)', 'a source for phones first');
  assert.ok(statSync(join(DIST, phone.srcset)).size <= 100, `the phone's source is a blank (${phone.srcset})`);
  for (const s of rest) assert.match(s.srcset, /\/_astro\/still\./);
  assert.doesNotMatch(html, /fig-01-papel/, 'the generated light (5.2) is gone from the page');
});

test('the motion waits in a template: the paper, as AVIF widths', () => {
  assert.ok(template, '<template id="hero-motion"> inside the hero');
  const imgs = tags(template, 'img');
  assert.equal(imgs.length, 1, 'the paper only (8.6f: no tooth layer)');
  assert.match(imgs[0]?.srcset ?? '', /\/_astro\/paper\.[^ ]+\.avif \d+w/, 'the paper, as AVIF widths');
  assert.equal(imgs[0].alt, '', 'decorative');
});

test('the clip: muted, inline, loads nothing until asked, never plays itself; AV1 first, H.264 after', () => {
  const [video] = tags(template, 'video');
  assert.ok(video, 'a <video> in the template');
  for (const a of ['muted', 'playsinline', 'disablepictureinpicture']) assert.ok(a in video, a);
  assert.equal(video.preload, 'none');
  assert.equal(video['aria-hidden'], 'true');
  for (const a of ['autoplay', 'loop', 'controls']) assert.ok(!(a in video), `no ${a}`);
  const sources = tags(template, 'source');
  assert.equal(sources.length, 2);
  assert.match(sources[0].type, /^video\/mp4; codecs=(?:"|&quot;)?av01\./);
  assert.match(sources[0].src, /^\/_astro\/light-av1\.[^.]+\.mp4$/);
  assert.match(sources[1].type, /^video\/mp4; codecs=(?:"|&quot;)?avc1\./);
  assert.match(sources[1].src, /^\/_astro\/light-h264\.[^.]+\.mp4$/);
  // 8.6g (astra's review): a budget per codec. Safari takes H.264 wherever the hardware has no AV1 decoder (most Macs
  // and iPhones today), so its clip is a common path, not a rare fallback: 42 KB against AV1's 7 KB on 2026-10-24
  const [av1, h264] = sources.map((s) => statSync(join(DIST, s.src)).size);
  assert.ok(av1 <= 10_000, `the AV1 clip is ${av1} bytes`);
  assert.ok(h264 <= 50_000, `the H.264 clip is ${h264} bytes`);
});

test('without the script, nothing of the motion is fetched, and no page autoplays', () => {
  assert.doesNotMatch(outside, /\/_astro\/(paper|tooth|light-)/, 'the layers are only referenced inside the template');
  for (const f of files(DIST, '.html')) assert.doesNotMatch(read(f), /<video[^>]*\sautoplay/, `${f}: no autoplay`);
});

test('the blend: canvases (never LCP candidates), the light added to the paper; the 8.5j sway is gone', () => {
  const js = files(DIST, '.js').map(read).join('\n');
  assert.match(js, /getContext\(\W2d\W\)/, 'the layers drawn on canvases');
  assert.match(js, /requestVideoFrameCallback/, 'the clip redrawn only when a new frame arrives');
  assert.match(js, /min-width: ?900px/, 'only from 900 px up (8.6b: phones show plain green)');
  // 8.6: the blend runs in the compositor (CSS), not on the main thread: redrawing scaled, full-size layers on every
  // frame cost 30–70 ms a frame at a phone's CPU (Lighthouse mobile 86, its blocking time 520 ms)
  assert.match(css, /mix-blend-mode:\s*plus-lighter/);
  // 8.6f: one blend, no group inside a group: Safari at 2× dropped a nested multiply past a size (a box on the hero)
  assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
  assert.doesNotMatch(css, /svya-sway/, "8.5j's CSS sway moved the paper with the light");
});

test('the CSP lets the page play its own media, and nothing else', () => {
  const headers = readFileSync(join(DIST, '_headers'), 'utf8');
  // 8.6h6b: and its own blob: (the clip, fetched whole, plays from memory)
  assert.match(headers, /media-src 'self' blob:;/);
});

// 8.6h6b: Workers static assets answer no byte ranges (8.6h6, read off the live site), and Safari plays nothing from a
// server that won't, so the clip is fetched whole and played from a blob: URL; the picked source is the one the
// browser can play (AV1 where it decodes it, else H.264), as <source> would pick
test('the clip is fetched whole and played from memory, the playable source first', () => {
  const js = files(DIST, '.js').map(read).join('\n');
  assert.match(js, /canPlayType/, 'the playable source picked');
  assert.match(js, /fetch\(/, 'fetched whole');
  assert.match(js, /createObjectURL/, 'played from a blob: URL');
});

// 8.6g (Claude's fast pass of the cross-browser review): Firefox ESR 128 has no requestVideoFrameCallback; without the
// check it downloaded the layers and failed half-way through the fade
test('the light only starts where the clip can be followed frame by frame', () => {
  const js = files(DIST, '.js').map(read).join('\n');
  assert.match(js, /requestVideoFrameCallback.\s*in\s*HTMLVideoElement\.prototype|in HTMLVideoElement\.prototype/, 'checked before anything loads');
});

// 8.8 (Franco, 2026-10-24: "we need to add movement from the start, now the movement start 3/4sec after the page
// opens"): the light no longer waits for the still's intro. The intro runs on a wrapper the layers join, so they can
// come in at any moment of it and move with it; they're fetched at low priority from the script's start (a few KB,
// never ahead of the still)
test('the intro runs on a wrapper the layers join, and the light never waits for it', () => {
  const lit = hero.match(/<div class="hero__lit[^"]*"[^>]*>([\s\S]*?)<\/template>/)?.[1] ?? '';
  assert.match(lit, /<picture[^>]*>[\s\S]*hero__img[\s\S]*<\/picture>/, 'the still inside the wrapper');
  assert.match(lit, /<template id="hero-motion"/, 'the motion joins it there');
  assert.match(css, /\.hero__lit[^{}]*\{[^}]*animation:\s*svya-light/, 'the intro on the wrapper');
  assert.doesNotMatch(css, /\.hero__img[^{}]*\{[^}]*animation:\s*svya-light/, 'not on the still alone');
  const js = files(DIST, '.js').map(read).join('\n');
  assert.doesNotMatch(js, /getAnimations/, 'no wait for the intro');
  assert.match(js, /priority:\s*["'`]low["'`]/, 'the clip fetched at low priority');
  assert.match(js, /fetchPriority\s*=\s*["'`]low["'`]/, 'the paper too');
});
