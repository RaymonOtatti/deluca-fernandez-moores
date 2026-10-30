// Checks on the built site (run after `astro build`; see `pnpm test:build`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import sharp from 'sharp';
import { DIST, bytes, files, read, rel, tags } from '../helpers/dist.ts';
import { figures } from '../../src/content/figures.ts';

const pages = files(DIST, '.html');
const home = join(DIST, 'index.html');
const html = existsSync(home) ? read(home) : '';

test('the build produced a home page', () => {
  assert.ok(existsSync(home), 'dist/index.html exists');
});

test('no page loads anything from another origin', () => {
  const local = (url: string) => !/^(https?:)?\/\//i.test(url.trim());
  for (const p of pages) {
    const h = read(p);
    const urls = [
      ...tags(h, 'script').map((t) => t.src),
      ...tags(h, 'link').map((t) => t.href),
      ...tags(h, 'img').map((t) => t.src),
      ...tags(h, 'iframe').map((t) => t.src),
      ...tags(h, 'source').flatMap((t) => (t.srcset ?? '').split(',').map((s) => s.trim().split(/\s+/)[0])),
    ].filter(Boolean);
    const remote = urls.filter((u) => !local(u) && !u.startsWith('https://svya-mvp.'));
    assert.deepEqual(remote, [], `${rel(p)} loads remote resources`);
  }
});

// 8.5k3 raised the cap from 1 KB to 2.5 KB: the page's one module also plays the hero's light (about 1.5 KB, 600 bytes
// after brotli). It blends the layers on a canvas, because a full-bleed video or image shown later took the LCP; and it
// keeps its guards (reduced motion, Save-Data, the hero in view). The menu, the refresh and the drum had taken it to 951.
// 8.6h6b raised it to 2.7 KB: Workers static assets answer no byte ranges, so the clip is fetched whole into a blob:
// URL, or Safari plays no light in production (2,616 bytes then, about 1.1 KB after brotli)
test('JavaScript budget: one same-origin module at most, nothing inline, under 2.7 KB', () => {
  for (const p of pages) {
    const scripts = tags(read(p), 'script');
    assert.ok(scripts.length <= 1, `${rel(p)} has ${scripts.length} scripts`);
    for (const s of scripts) {
      assert.equal(s.type, 'module');
      assert.match(s.src ?? '', /^\/_astro\/.+\.js$/, 'scripts are external, hashed files');
    }
    assert.doesNotMatch(read(p), /<script[^>]*>[^<]+<\/script>/, `${rel(p)} has an inline script`);
  }
  const js = bytes(files(DIST, '.js'));
  assert.ok(js <= 2_700, `JS is ${js} bytes`);
});

test('every image has alt text and an intrinsic size', () => {
  for (const p of pages) {
    for (const img of tags(read(p), 'img')) {
      assert.ok('alt' in img, `${img.src} in ${rel(p)} has an alt attribute`);
      assert.ok(img.width && img.height, `${img.src} in ${rel(p)} has width and height`);
    }
  }
});

// Per page, because that's what a visitor loads: with a second page (404) Astro splits the CSS into a
// shared sheet plus one per page, so a site-wide total grows with every page and measures nothing.
// Raw bytes keep the source honest; brotli is what actually travels (3.5).
const sheetsOf = (p: string) => tags(read(p), 'link').filter((l) => l.rel === 'stylesheet').map((l) => join(DIST, l.href));
test('weight budgets: HTML ≤ 40 KB per page; the CSS a page loads ≤ 8 KB brotli', () => {
  for (const p of pages) {
    assert.ok(bytes([p]) <= 40_000, `${rel(p)} is ${bytes([p])} bytes`);
    const br = sheetsOf(p).reduce((n, f) => n + brotliCompressSync(readFileSync(f)).length, 0);
    assert.ok(br <= 8_000, `${rel(p)} loads ${br} bytes of CSS after brotli`);
  }
});

// 8.4b (Franco, 2026-10-23): "keep working, then at the end we will ultra compress all that we can". The
// raw cap waits on that pass (8.5c), which brings the sheet back under it; until then it reports, not fails.
test('weight budgets: the CSS a page loads ≤ 32 KB raw', () => {
  for (const p of pages) {
    const raw = bytes(sheetsOf(p));
    assert.ok(raw <= 32_000, `${rel(p)} loads ${raw} bytes of CSS`);
  }
});

test('html is Spanish (Argentina)', () => {
  assert.match(html, /<html[^>]*\blang="es-AR"/);
});

test('the prototype is hidden from search engines', () => {
  const robots = tags(html, 'meta').find((m) => m.name === 'robots');
  assert.equal(robots?.content, 'noindex, nofollow');
});

test('title, description and share card are set', () => {
  assert.match(html, /<title>[^<]*Sáenz Valiente[^<]*<\/title>/);
  const meta = tags(html, 'meta');
  const by = (k: string) => meta.find((m) => m.name === k || m.property === k)?.content ?? '';
  assert.ok(by('description').length >= 50, 'meta description is a real sentence');
  assert.match(by('og:image'), /^https:\/\/.+\/og\.jpg$/, 'og:image is an absolute URL');
  assert.ok(by('og:title'));
  assert.equal(by('og:locale'), 'es_AR');
  assert.ok(tags(html, 'link').some((l) => l.rel === 'icon' && l.href === '/favicon.svg'));
});

// 7.2 (Franco, 2026-10-22): the hero is the name and the light; no kicker, no buttons, no coordinates
test('the hero carries no kicker, actions or coordinates', () => {
  const heroHtml = html.match(/<section[^>]*class="hero[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(heroHtml, 'found the hero');
  assert.doesNotMatch(heroHtml, /<a\s/, 'no links or buttons in the hero');
  assert.doesNotMatch(heroHtml, /Estudio jurídico/, 'no kicker');
  assert.doesNotMatch(heroHtml, /34°34/, 'no coordinates');
});

// 7.7 put the lead in a passage between the hero and El Estudio; 8.4d (Franco, 2026-10-23) removed it: the
// hero meets El Estudio directly, and the line stays only in the page's description
test('the hero meets El Estudio directly, with no passage between them', () => {
  assert.doesNotMatch(html, /class="[^"]*\bpassage/, 'no passage');
  const afterHero = html.slice(html.search(/<\/section>/) + '</section>'.length);
  assert.match(afterHero, /^\s*<section[^>]*id="estudio"/, 'El Estudio comes right after the hero');
  const body = html.slice(html.search(/<body/));
  assert.doesNotMatch(text(body), /Asesoramos a empresas/, 'not on the page');
  assert.match(tags(html, 'meta').find((m) => m.name === 'description')?.content ?? '', /Asesoramos a empresas nacionales y extranjeras/, 'still the description');
});

// 7.8 (Franco, 2026-10-22): our own map of the office's streets, linked to Google Maps; credited, never embedded
test('La Oficina: our own map, linked to Google Maps, credited to OpenStreetMap; no embedded map anywhere', () => {
  const s = section('oficina');
  const map = s.match(/<figure[^>]*class="[^"]*\bmap\b[\s\S]*?<\/figure>/)?.[0] ?? '';
  assert.ok(map, 'a map figure in La Oficina');
  const link = tags(map, 'a').find((a) => a.href?.startsWith('https://www.google.com/maps/search/'));
  assert.ok(link, 'the map links to Google Maps');
  assert.equal(link.target, '_blank');
  assert.match(link.rel ?? '', /noopener/);
  assert.match(link.rel ?? '', /noreferrer/);
  assert.match(text(map), /Ver en Google Maps \(se abre en una pestaña nueva\)/);
  const img = tags(map, 'img')[0];
  assert.match(img?.src ?? '', /^\/_astro\/oficina\.[\w-]+\.svg$/, 'the map is a self-hosted SVG');
  assert.equal(img.loading, 'lazy');
  const credit = tags(map, 'a').find((a) => a.href === 'https://www.openstreetmap.org/copyright');
  assert.ok(credit, 'credits OpenStreetMap');
  assert.match(text(map), /© OpenStreetMap/);
  for (const p of pages) assert.doesNotMatch(read(p), /<iframe/i, `${rel(p)} embeds nothing`);
});

// 7.8: component styles are scoped with a class (.astro-xxxx), not an attribute ([data-astro-cid-xxxx]):
// the same specificity, so the same cascade, and about 2.6 KB less CSS
// 8.5c (Franco: "at the end we will ultra compress all that we can"): after the build, Astro's 15-byte scope
// classes (.astro-xxxxxxxx, 274 in the CSS and 402 in the HTML) are renamed to short ones (scripts/shorten-scopes.mjs).
// Every short class the pages use is in the stylesheet and every one the stylesheet styles is used
test('scoped styles use short names, the same in the pages and the stylesheet', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const pages = files(DIST, '.html').map(read).join('\n');
  assert.doesNotMatch(css + pages, /\[data-astro-cid-|astro-[a-z0-9]{8}/, 'no long scope names left');
  const inCss = new Set([...css.matchAll(/\.(_[a-z0-9]{1,3})(?![\w-])/g)].map((m) => m[1]));
  const inHtml = new Set([...pages.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^_[a-z0-9]{1,3}$/.test(c)));
  assert.ok(inCss.size >= 10, `${inCss.size} short scopes in the CSS`);
  assert.deepEqual([...inHtml].filter((c) => !inCss.has(c)).length <= 1 ? [] : [...inHtml].filter((c) => !inCss.has(c)), [], 'every short scope in the pages is styled (a component without styles may keep one)');
  assert.deepEqual([...inCss].filter((c) => !inHtml.has(c)), [], 'every short scope the CSS styles is in a page');
});

// The only text face loaded by the page, Jost, covers every character the pages show.
test('Jost covers every character used by the pages', async () => {
  const { execFileSync } = await import('node:child_process');
  const text = files(DIST, '.html').map(read).join(' ').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, '\u00a0').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  const chars = [...new Set(text)].filter((c) => c.trim()).join('');
  const py = `import json, sys
from fontTools.ttLib import TTFont
cm = set(TTFont('src/assets/fonts/jost-latin-wght-normal.woff2').getBestCmap())
chars = sys.argv[1]
print(json.dumps([c for c in chars if ord(c) not in cm]))`;
  const miss = JSON.parse(execFileSync('design/font/.venv/bin/python', ['-c', py, chars], { cwd: process.cwd() }).toString());
  assert.deepEqual(miss, [], 'Jost lacks some characters');
});

// 7.10: each @font-face declares the weights its file really has, so a weight outside them is never
// asked of the variable axis (it would silently clamp)
test('@font-face weights match the cut fonts', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const faces = Object.fromEntries([...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => [
    m[1].match(/font-family:\s*["']?([^;"']+)/)?.[1], m[1].match(/font-weight:\s*([^;]+)/)?.[1].trim()]));
  assert.deepEqual(faces, { 'Jost Variable': '300 400', 'Valiente Display': '300' });
});

// 6.3b (Franco, 2026-10-22): Safari 26+ ignores theme-color and tints its bar with the background of the
// fixed or sticky element at the page's top edge. The full-page grain overlay sat there, transparent, so the
// bar stayed grey (measured in Safari 27.2). The grain now sits under the header: the header is that element
test('the grain overlay sits under the sticky header', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const grain = Number(css.match(/body:after\{[^}]*z-index:\s*(\d+)/)?.[1]);
  const header = Number(css.match(/\.site-header[.\w-]*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  assert.ok(grain > 1 && header > grain, `grain z-index ${grain}, header ${header}`);
});

// 6.10: the stylesheet sits at its raw budget, so nothing in it may be dead weight
test('the CSS carries no unused keyframes or custom properties', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const used = (name: string) => css.includes(`var(${name})`) || css.includes(`var(${name},`) || new RegExp(`timeline(-name)?:\\s*${name}\\b`).test(css);
  const props = [...new Set([...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]))].filter((p) => !used(p));
  const frames = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1])
    .filter((k) => !new RegExp(`animation(-name)?:[^;}]*\\b${k}\\b`).test(css));
  assert.deepEqual(props, [], 'custom properties never read');
  assert.deepEqual(frames, [], 'keyframes never used');
});

// 6.9: Valiente Display (5 KB) sets the hero's name, the page's LCP. 7.10: with the hero's mono text gone,
// no phone shows the label face in its first view (desktop only in the nav), so it isn't preloaded: its
// 24 KB no longer competes with the hero on a slow connection
test('fonts are self-hosted and preloaded: Jost and Valiente Display, not the label face', () => {
  const preloads = tags(html, 'link').filter((l) => l.rel === 'preload' && l.as === 'font');
  for (const l of preloads) assert.match(l.href, /^\/_astro\/.+\.woff2$/);
  const names = preloads.map((l) => l.href.split('/').pop()!.split('.')[0]).sort();
  assert.deepEqual(names, ['ValienteDisplay-Light', 'jost-latin-wght-normal']);
});

test('every page has a skip link to the main content', () => {
  for (const p of pages) {
    const h = read(p);
    assert.match(h, /<a[^>]+href="#contenido"/, `${rel(p)} has a skip link`);
    assert.match(h, /<main[^>]+id="contenido"/, `${rel(p)} has <main id="contenido">`);
  }
});

test('no inline styles: the CSP can stay style-src self', () => {
  for (const p of pages) {
    const h = read(p);
    assert.doesNotMatch(h, /<style[\s>]/i, `${rel(p)} has a <style> element`);
    assert.doesNotMatch(h, /\sstyle\s*=/i, `${rel(p)} has a style attribute`);
  }
});

test('header: brand link, labelled nav, menu button wired to its popover', () => {
  assert.match(html, /<header[^>]*class="[^"]*site-header/);
  const nav = tags(html, 'nav').find((n) => n['aria-label'] === 'Principal');
  assert.ok(nav, 'a nav labelled "Principal"');
  const brand = tags(html, 'a').find((a) => a.class?.includes('brand-link'));
  assert.ok(brand && /Sáenz Valiente/.test(brand['aria-label'] ?? ''), 'brand link has an accessible name');
  const button = tags(html, 'button').find((b) => b.popovertarget);
  assert.ok(button, 'a button opens the menu');
  const menu = tags(html, 'div').find((d) => d.id === button!.popovertarget);
  assert.ok(menu && 'popover' in menu, 'its target is a popover');
});

// 8.2 (Franco, 2026-10-23): the bar's brand is the name alone, "Sáenz Valiente / & Asociados", without the
// monogram, in the header and at the top of the phone menu (the favicon keeps it)
test('the brand in the bar and the menu is text only', () => {
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  const brand = header.match(/<a[^>]*class="[^"]*brand-link[\s\S]*?<\/a>/)?.[0] ?? '';
  // up to the close button, whose icon is an svg of its own
  const top = html.match(/<div[^>]*class="[^"]*menu__top[^>]*>([\s\S]*?)<button/)?.[1] ?? '';
  for (const [where, h] of [['header', brand], ['menu', top]]) {
    assert.ok(h, `${where} brand found`);
    assert.doesNotMatch(h, /<svg|brand-link__mark/, `no monogram in the ${where}`);
    assert.match(h, /Sáenz Valiente[\s\S]*&amp; Asociados/, `the name in the ${where}`);
  }
});

test('every in-page link lands on an element', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = tags(html, 'a').map((a) => a.href).filter((h) => h?.startsWith('#') && h.length > 1);
  const missing = [...new Set(anchors)].filter((h) => !ids.has(h.slice(1)));
  assert.deepEqual(missing, []);
});

test('hero: one h1, the art as a responsive picture loaded first, with its caption', () => {
  const h1s = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)].map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  assert.equal(h1s.length, 1, 'exactly one h1');
  // 5.1: the headline is the firm's name, drawn by Wordmark; 7.5: the footer no longer repeats it;
  // 7.11: the whole name, "& Asociados" on a smaller second line
  assert.equal(h1s[0].replace(/&amp;/g, '&'), 'Sáenz Valiente & Asociados');
  assert.match(html, /<h1[^>]*>[\s\S]*class="[^"]*\bwordmark__sub\b[^"]*"[^>]*>&amp; Asociados</);
  assert.match(tags(html, 'h1')[0].class ?? '', /\bwordmark\b/);
  assert.equal(tags(html, 'p').filter((p) => /\bwordmark\b/.test(p.class ?? '')).length, 0, 'no second wordmark');

  const hero = html.match(/<section[^>]*class="[^"]*hero[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(hero, 'a hero section');
  assert.doesNotMatch(hero, /Derecho empresario/, 'the old headline is gone');
  const sources = tags(hero, 'source').map((s) => s.type);
  assert.ok(sources.includes('image/avif') && sources.includes('image/webp'), 'AVIF and WebP sources');
  const img = tags(hero, 'img')[0];
  assert.equal(img?.fetchpriority, 'high', 'the hero image is fetched first');
  assert.notEqual(img?.loading, 'lazy');
  for (const svg of tags(hero, 'svg')) assert.equal(svg['aria-hidden'], 'true', 'drawings are decorative');
  assert.doesNotMatch(hero, /hero__lines/, '5.2: the relief and its construction lines are gone');
});

const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const section = (id: string) => html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))?.[0] ?? '';

// 7.3 (Franco, 2026-10-22): no numbered section labels; the titles carry the page, and every
// section still takes its accessible name from its heading
test('no numbered section labels, and every section is named by its heading', () => {
  assert.doesNotMatch(html, /section-head__label/);
  assert.doesNotMatch(text(html), /\b0[1-4] — (El Estudio|Áreas de práctica|Equipo|Carrera)/);
  for (const id of ['estudio', 'areas', 'equipo', 'carrera']) {
    const named = section(id).match(/^<section[^>]*aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(named && new RegExp(`<h2[^>]*id="${named}"`).test(section(id)), `#${id} is named by its h2`);
  }
});

test('El Estudio: statement and the three dates', () => {
  const s = section('estudio');
  assert.ok(s, 'section#estudio exists');
  assert.match(s, /<h2[\s\S]*Soluciones prácticas[\s\S]*<\/h2>/);
  for (const v of ['1912', '1946', '+40']) assert.ok(text(s).includes(v), `shows ${v}`);
});

// 8.5i (Franco, 2026-10-23: "we need to change to E hero"): the monogram beside the name (take E), in place of
// 8.5's watermark. The logo file's own path, decorative, next to the live h1; nothing in the figure but the light
test('hero: the exact monogram beside the name, decorative, and no watermark', () => {
  const hero = html.match(/<section[^>]*class="[^"]*hero[\s\S]*?<\/section>/)?.[0] ?? '';
  const text = hero.slice(hero.search(/class="[^"]*hero__text/));
  const svg = text.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? '';
  assert.ok(svg && text.indexOf(svg) < text.search(/<h1/), 'the mark comes before the name');
  assert.match(svg, /aria-hidden="true"/, 'decorative');
  const d = (s: string) => s.match(/ d="([^"]+)"/)?.[1];
  assert.equal(d(svg), d(readFileSync(join(process.cwd(), 'src/assets/brand/monogram.svg'), 'utf8')), 'the logo file\'s own path');
  assert.doesNotMatch(hero, /hero__mark/, 'no watermark');
  const fig = hero.match(/<figure[\s\S]*?<\/figure>/)?.[0] ?? '';
  assert.doesNotMatch(fig, /<svg/, 'the figure is the light alone');
});

// 8.6e (Franco, 2026-10-24, at Gate 6: "carousel needs to be horizontal, not vertical, and remove 'todo el equipo' and
// 'pausar', we need to only see the carousel"; told that content moving on its own past 5 s needs a pause (WCAG 2.2.2),
// he chose "auto, continue, no pause"): one row of names rolling sideways on its own, the groups' labels inline; the
// list once for screen readers, a hidden copy for the loop (the e2e checks it); nothing else shown
test('Equipo: everyone else in one row rolling sideways, listed once for screen readers, nothing else shown', () => {
  const s = section('equipo');
  const staff = s.match(/<div[^>]*class="[^"]*\bstaff\b[\s\S]*$/)?.[0] ?? '';
  assert.ok(staff && s.search(/class="[^"]*\bpartners\b/) < s.search(/class="[^"]*\bstaff\b/), 'after the partners');
  const lists = [...staff.matchAll(/<div[^>]*class="[^"]*\bstaff__list\b[^"]*"([^>]*)>/g)];
  assert.equal(lists.length, 1, 'the list, once');
  assert.doesNotMatch(lists[0][1], /aria-hidden/, 'the list is read');
  const first = staff.slice(lists[0].index);
  assert.deepEqual([...first.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1])),
    ['Abogados', 'Procuración', 'Administración', 'Colaboradores', 'Colaborador externo permanente']);
  assert.equal([...first.matchAll(/<li[\s>]/g)].length, 39, 'every name, once');
  assert.equal(tags(staff, 'button').length, 0, 'no pause button');
  assert.doesNotMatch(staff, /Pausar|Reanudar/);
  const label = staff.match(/<[a-z0-9]+[^>]*class="([^"]*)"[^>]*>\s*Todo el equipo\s*</);
  assert.ok(label && /\bvisually-hidden\b/.test(label[1]), '"Todo el equipo" kept for screen readers, not shown');
  const css = read(files(join(DIST, '_astro'), '.css')[0]);
  const rule = [...css.matchAll(/[^{}]*\.staff__track[^{}]*\{[^}]*animation-name[^}]*\}/g)][0];
  assert.ok(rule, 'the track rolls');
  assert.match(rule[0], /animation-iteration-count:\s*infinite/);
  assert.match(rule[0], /animation-timing-function:\s*linear/);
  const before = css.slice(0, rule.index);
  assert.match(before.slice(before.lastIndexOf('@media')), /^@media[^{]*prefers-reduced-motion:\s*no-preference/, 'only where motion is welcome');
  const name = rule[0].match(/animation-name:\s*([\w-]+)/)![1];
  const frames = css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?\\})\\s*\\}`))?.[1] ?? '';
  assert.match(frames, /translate:\s*-50%(\s+0)?\s*[;}]|translateX\(-50%\)/, "sideways, by the list's width");
  assert.doesNotMatch(css, /staff__track[^{]*\{[^}]*animation-play-state:\s*paused/, 'nothing pauses it (Franco: no pause)');
});

// 8.4 (Franco, 2026-10-23: "add them color for all web browsers"): where a page can't paint the browser's
// own bar (desktop Chrome and Edge), an installed app's title bar takes the manifest's theme_color, and
// Android's splash its background_color. Both the brand green, from the same source as theme-color.
test('a web app manifest in the brand green, linked from every page, with its icons, allowed by the CSP', () => {
  const m = JSON.parse(read(join(DIST, 'site.webmanifest')));
  const meta = tags(html, 'meta').find((t) => t.name === 'theme-color')?.content;
  assert.equal(m.name, 'Sáenz Valiente & Asociados');
  assert.equal(m.short_name, 'SVyA');
  assert.equal(m.lang, 'es-AR');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  // 8.9 (Franco, 2026-10-24: "disable that on chrome its wierd that a website ask for download it"): "browser"
  // fails Chrome's install criteria, so it offers no install; the name, icons and colours stay
  assert.equal(m.display, 'browser', 'a page, not an app: no install offer');
  assert.equal(m.theme_color, meta);
  assert.equal(m.background_color, meta);
  for (const n of [192, 512]) {
    const icon = m.icons.find((i: { sizes: string }) => i.sizes === `${n}x${n}`);
    assert.ok(icon && icon.type === 'image/png', `a ${n} px PNG icon`);
    const png = readFileSync(join(DIST, icon.src));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [n, n], `${icon.src} is ${n} × ${n}`);
  }
  for (const p of pages) {
    assert.ok(tags(read(p), 'link').some((l) => l.rel === 'manifest' && l.href === '/site.webmanifest'), `${rel(p)} links the manifest`);
  }
  // default-src 'none' would block it
  assert.match(read(join(DIST, '_headers')), /manifest-src 'self'/);
});

// 9.1 (Franco, 2026-10-25: "office photos should be the 3 of the same size, and cut whatever its necessary to place
// them clean"; of three takes he chose the landscape strip, "but photo in the middle needs to be centered vertically"):
// the photos are back between La Oficina's head and its map, each cut to 4:3 at build (no bytes for what CSS would
// hide), with no captions (6.2)
const plates = () => section('oficina').match(/<figure[^>]*class="[^"]*\bplate\b[\s\S]*?<\/figure>/g) ?? [];
const candidates = (fig: string) => [tags(fig, 'img')[0].src, ...tags(fig, 'source').flatMap((x) => x.srcset.split(',').map((c) => c.trim().split(/\s+/)[0]))];
test('La Oficina: the three office photos, each cut to 4:3 at build, between the head and the map', async () => {
  const s = section('oficina');
  const head = s.search(/class="[^"]*\boficina__head\b/), strip = s.search(/class="[^"]*\bplates\b/), map = s.search(/<figure[^>]*class="[^"]*\bmap\b/);
  assert.ok(head >= 0 && head < strip && strip < map, 'the head, then the photos, then the map');
  assert.doesNotMatch(s, /<figcaption/, 'no captions (6.2)');
  assert.equal(plates().length, 3, 'three photos');
  for (const [i, id] of ['recepcion', 'sala', 'planta'].entries()) {
    const fig = plates()[i], img = tags(fig, 'img')[0];
    assert.equal(img.alt.replaceAll('&amp;', '&'), figures.find((f) => f.id === id)!.alt, `${id}: its alt text`);
    assert.equal(img.loading, 'lazy');
    assert.equal(img.decoding, 'async');
    assert.ok(Math.abs(Number(img.width) / Number(img.height) - 4 / 3) < 0.01, `${id}: the img is ${img.width} × ${img.height}`);
    assert.deepEqual(tags(fig, 'source').map((x) => x.type), ['image/avif', 'image/webp'], `${id}: AVIF, then WebP`);
    for (const u of candidates(fig)) {
      const { width, height } = await sharp(join(DIST, u)).metadata();
      assert.ok(Math.abs(width! * 3 - height! * 4) <= 4, `${u} is ${width} × ${height}, not 4:3`);
    }
  }
});

test('La Oficina: the meeting room, in the middle, is cut from its vertical centre', async () => {
  const served = candidates(plates()[1]).filter((u) => u.endsWith('.webp')).at(-1)!;
  const small = (img: sharp.Sharp) => img.resize(160, 120, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const source = 'src/assets/photos/oficina-sala.jpg';
  const { width, height } = await sharp(source).metadata();
  const cut = Math.round((width! * 3) / 4);
  const at = (top: number) => small(sharp(source).extract({ left: 0, top, width: width!, height: cut }));
  const shown = await small(sharp(join(DIST, served)));
  const diff = (a: Buffer, b: Buffer) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
  const centre = diff(shown, await at(Math.round((height! - cut) / 2))), top = diff(shown, await at(0));
  assert.ok(centre < 4 && centre * 3 < top, `against a centred cut ${centre.toFixed(1)}, against a top cut ${top.toFixed(1)}`);
});

// 8.3b: Publicaciones, between Equipo and La Oficina; each title links out, and says it opens a new tab
test('Publicaciones: a named section after Equipo, its titles linking out in a new tab', () => {
  const s = section('publicaciones');
  assert.ok(s, 'section#publicaciones exists');
  const at = (id: string) => html.search(new RegExp(`<section[^>]*id="${id}"`));
  assert.ok(at('equipo') < at('publicaciones') && at('publicaciones') < at('oficina'), 'Equipo, Publicaciones, La Oficina');
  const named = s.match(/^<section[^>]*aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(named && new RegExp(`<h2[^>]*id="${named}"`).test(s), 'named by its h2');
  const links = tags(s, 'a');
  assert.ok(links.length >= 3, `${links.length} links`);
  for (const a of links) {
    assert.equal(a.target, '_blank');
    assert.match(a.rel ?? '', /noopener/);
  }
  assert.equal([...s.matchAll(/se abre en una pestaña nueva/g)].length, links.length, 'each link says it opens a new tab');
});

// 8.3: under the dates, the history and the present, each under its own h3
test('El Estudio: "Historia" and "El Estudio hoy" follow the dates, each under an h3', () => {
  const s = section('estudio');
  const facts = s.search(/class="[^"]*\bfacts\b/);
  const heads = [...s.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => ({ at: m.index ?? 0, text: text(m[1]) }));
  assert.deepEqual(heads.map((h) => h.text), ['Historia', 'El Estudio hoy']);
  for (const h of heads) assert.ok(h.at > facts, `${h.text} comes after the dates`);
  assert.match(text(s), /Unión Industrial Argentina/);
  assert.match(text(s), /Corte Suprema/);
});

// 8.5f (Franco, 2026-10-23: "01 to 09 numbers on bullet list, remove them"): the practice areas have no order,
// so they are plain lists, without numbers
test('Áreas: two plain lists, without numbers, next to Fig. 02', () => {
  const s = section('areas');
  assert.ok(s, 'section#areas exists');
  assert.equal([...s.matchAll(/<h3[\s>]/g)].length, 2, 'one h3 per group');
  assert.ok([...s.matchAll(/<li[\s>]/g)].length >= 16, 'both lists are there');
  assert.doesNotMatch(s, /<ol[\s>]/, 'no ordered lists');
  assert.equal([...s.matchAll(/<ul[\s>]/g)].length, 2, 'two plain lists');
  const items = [...s.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
  assert.deepEqual(items.filter((t) => /\b0\d\b/.test(t)), [], 'no 01–09');
  const img = tags(s, 'img')[0];
  assert.equal(img?.loading, 'lazy', 'Fig. 02 loads lazily, it is below the fold');
  assert.ok(tags(s, 'source').some((x) => x.type === 'image/avif'));
});

test('Equipo: the ten partners, and no featured operation since 7.4', () => {
  const s = section('equipo');
  assert.ok(s, 'section#equipo exists');
  const list = s.match(/<ol[^>]*class="[^"]*partners[\s\S]*?<\/ol>/)?.[0] ?? '';
  assert.equal([...list.matchAll(/<li[\s>]/g)].length, 10);
  assert.doesNotMatch(text(s), /Operación destacada|Exponenciar/);
  assert.doesNotMatch(s, /class="[^"]*\bdeal\b/);
});

// 8.5h (Franco, 2026-10-23: "remove images from la oficina; we need to add them later in a more artistic way"):
// the head and the map stayed, the three photos went; 9.1 brings them back as one strip
test('Oficina: its head, the three photos and the map', () => {
  const s = section('oficina');
  assert.ok(s, 'section#oficina exists');
  assert.match(s, /<h2[\s\S]*?La oficina[\s\S]*?<\/h2>/, 'the section has a heading (it may be visually hidden)');
  assert.equal(s.match(/<picture[\s>]/g)?.length, 3, 'three photos');
  assert.equal(tags(s, 'img').length, 4, 'four images: the photos and the map');
  assert.match(s, /class="[^"]*\bmap__frame/, 'the map');
});

test('Carrera: the question between crop marks and an "Enviar CV" mailto', () => {
  const s = section('carrera');
  assert.ok(s, 'section#carrera exists');
  assert.match(text(s), /¿Quiere ser parte del equipo\?/);
  const cta = tags(s, 'a').find((a) => a.href?.startsWith('mailto:'));
  assert.equal(cta?.href, 'mailto:contacto@svya.com.ar?subject=CV');
  assert.match(text(s), /Enviar CV/);
  assert.match(s, /class="crop-marks\b[^"]*"[^>]*aria-hidden="true"/);
});

test('footer#contacto: address, phones and emails, then only the © line; no prototype line', () => {
  const footer = html.match(/<footer[^>]*id="contacto"[\s\S]*?<\/footer>/)?.[0] ?? '';
  assert.ok(footer, 'footer#contacto exists');
  const t = text(footer);
  assert.match(t, /Cnel\. Marcelino E\. Freyre 3650/);
  const hrefs = tags(footer, 'a').map((a) => a.href);
  for (const h of ['tel:+541152354769', 'tel:+541152360543', 'mailto:info@svya.com.ar', 'mailto:contacto@svya.com.ar']) {
    assert.ok(hrefs.includes(h), `links ${h}`);
  }
  // 7.5 (Franco, 2026-10-22): no wordmark and no coordinates; the bottom line is the © alone
  assert.doesNotMatch(t, /34°34/);
  assert.doesNotMatch(footer, /footer__wordmark|class="wordmark/);
  const bottom = footer.match(/<div[^>]*class="[^"]*footer__bottom[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.match(text(bottom).replace(/&amp;/g, '&'), new RegExp(`^© ${new Date().getFullYear()} Sáenz Valiente & Asociados$`));
  // Franco, 2026-10-22: the footer line saying this is a prototype goes; noindex stays.
  assert.doesNotMatch(t, /prototipo|propuesta de rediseño|no es el sitio oficial/i);
  assert.match(t, new RegExp(`© ${new Date().getFullYear()}`));
  for (const a of tags(footer, 'a').filter((x) => /^https?:/.test(x.href ?? ''))) {
    assert.match(a.rel ?? '', /noreferrer/, `${a.href} doesn't leak the prototype URL`);
  }
});

// 3.2b, better-es-ar: every question opens with ¿, and copy never shows a straight quote
test('visible text opens every question with ¿ and uses no straight quotes', () => {
  const body = text(html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' '));
  const opens = (body.match(/¿/g) ?? []).length;
  const closes = (body.match(/\?/g) ?? []).length;
  assert.ok(closes > 0, 'there is a question to check');
  assert.equal(opens, closes, 'each ? has its ¿');
  assert.doesNotMatch(body, /"/);
});

// 3.3: a link that opens a new tab says so in its name, so nobody is surprised by it
test('links that open a new tab say so', () => {
  const blanks = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/g)];
  for (const [, inner] of blanks) assert.match(text(inner), /pestaña nueva/, `"${text(inner)}" opens a new tab without saying so`);
});

// One render-blocking request for styles on every page: with a second page Astro split the CSS into
// a shared sheet plus one per page, and the extra request cost the home page ~90 ms of mobile LCP.
test('every page loads exactly one stylesheet', () => {
  for (const p of pages) {
    const sheets = tags(read(p), 'link').filter((l) => l.rel === 'stylesheet');
    assert.equal(sheets.length, 1, `${rel(p)} loads ${sheets.length} stylesheets`);
  }
});

// 6.2 (Franco, 2026-10-22): the figure labels are gone ("Fig. 01 — Luz / Velo sobre papel", Fig. 02–05)
test('no figure captions anywhere on the page', () => {
  for (const p of pages) {
    const page = read(p);
    assert.doesNotMatch(page, /<figcaption/, `${rel(p)} has a figcaption`);
    assert.doesNotMatch(text(page), /Fig\. 0\d/, `${rel(p)} shows a "Fig." label`);
  }
});

// 8.6g (Claude's fast pass of the cross-browser review): the phone menu is a native popover. Where that's missing
// (Safari before 17, Chrome before 114, Firefox before 125) the panel stayed in the page as an invisible, full-screen
// layer over everything, taking every tap; there the menu and its button hide, and the one-page site still scrolls
test('without popover support, the menu and its button step aside instead of covering the page', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const block = css.match(/@supports not selector\(:popover-open\)\s*\{([\s\S]*?\})\s*\}/)?.[1] ?? '';
  assert.match(block, /\.menu\b[^{]*\{[^}]*display:\s*none/, 'the panel hidden');
  assert.match(block, /\.menu-button\b[^{]*\{[^}]*display:\s*none|\.menu-button\b[^{,]*,[^{]*\{[^}]*display:\s*none|,\s*[^{]*\.menu-button[^{]*\{[^}]*display:\s*none/, 'the button hidden');
});

// 8.6g: the team row's speed is measured once the web fonts are in, since they change its width
test('the team row is timed after the fonts load', () => {
  const js = files(DIST, '.js').map(read).join('\n');
  assert.match(js, /fonts\.ready[\s\S]{0,120}--roll|--roll[\s\S]{0,40}fonts\.ready/);
});

// 8.6g (astra's review): a publication's arrow follows its last word onto a new line, never alone (it did in Firefox at
// 768); the new-tab note for screen readers stays outside, so the pair is only the word and the arrow
test('each publication keeps its last word and its arrow together', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const titles = [...html.matchAll(/<a[^>]*class="press__title[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
  assert.ok(titles.length >= 3, `${titles.length} publications`);
  for (const t of titles) assert.match(t, /<span class="press__end[^"]*">[^<\s]+<svg[\s\S]*?<\/svg><\/span>/, `last word and arrow wrapped: ${t.slice(0, 80)}`);
  assert.match(css, /\.press__end[^{]*\{[^}]*white-space:\s*nowrap/);
});

// 8.6h1b: the rolling row's window clips with overflow: hidden, not clip. Both clip the same on screen, but axe (4.14,
// in Lighthouse 12.8.2) only knows text is cut off under `hidden`: under `clip` it read the group labels thousands of
// pixels out of view against the page's paper (2.17:1), and Lighthouse's accessibility fell to 96
test('the rolling row hides what it clips in a way audit tools understand', () => {
  const css = files(DIST, '.css').map(read).join('\n');
  const rule = css.match(/[^{}]*\.staff__window[^{}]*\{[^}]*mask-image[^}]*\}/)?.[0] ?? '';
  assert.match(rule, /overflow:\s*hidden/, `the window's rule: ${rule.slice(0, 120)}`);
});

// 8.6h3: notes for whoever edits the source stay in the source (Astro's {/* */}); no page ships HTML comments
test('no page ships source comments', () => {
  for (const p of pages) assert.doesNotMatch(read(p), /<!--/, `${rel(p)} carries an HTML comment`);
});

// 8.6h6: what each kind of file may be cached for. The HTML revalidates on every visit (Workers' default, no rule
// here), so a redeploy shows at once; hashed build files are immutable; the manifest and the icons, fixed names that
// rarely change, keep a day, so a repeat visit doesn't revalidate them
test('caching: the HTML revalidates, build files are immutable, the manifest and icons keep a day', async () => {
  const { parseHeaders, headersFor } = await import('../../scripts/serve.mjs');
  const rules = parseHeaders(readFileSync(join(DIST, '_headers'), 'utf8'));
  for (const p of ['/', '/index.html', '/404.html', '/robots.txt', '/og.jpg']) assert.equal(headersFor(p, rules)['cache-control'], undefined, `${p}: no rule, so Workers revalidates it`);
  assert.equal(headersFor('/_astro/style.x.css', rules)['cache-control'], 'public, max-age=31536000, immutable');
  for (const p of ['/site.webmanifest', '/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png']) {
    assert.equal(headersFor(p, rules)['cache-control'], 'public, max-age=86400', p);
  }
});
