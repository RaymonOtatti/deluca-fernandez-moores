// Motion rules, checked on the built CSS: scroll-driven animation only where it's supported
// and wanted; nothing hidden for browsers or people that get no animation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIST, files, read } from '../helpers/dist.ts';

const css = files(DIST, '.css').map(read).join('\n');

// The chain of at-rule preludes that encloses position `at` (outermost first).
function context(src: string, at: number): string[] {
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < at; i++) {
    if (src[i] === '{') { stack.push(src.slice(start, i).trim()); start = i + 1; }
    else if (src[i] === '}') { stack.pop(); start = i + 1; }
    else if (src[i] === ';') start = i + 1;
  }
  return stack.filter((s) => s.startsWith('@'));
}

test('there is scroll-driven motion to check, as real declarations', () => {
  assert.match(css, /(?<=[{;]\s*)animation-timeline:\s*(view|scroll)\(/);
});

test('no animation shorthand carries a timeline (the shorthand can only reset it, so browsers drop it)', () => {
  // A minifier once folded animation-timeline into the shorthand: "animation:linear both x scroll(root)".
  for (const m of css.matchAll(/(?<=[{;]\s*)animation:([^;}]*)/g)) {
    assert.doesNotMatch(m[1], /\b(scroll|view)\(/, `invalid shorthand: animation:${m[1]}`);
  }
});

test('every scroll-driven animation sits inside @supports and prefers-reduced-motion: no-preference', () => {
  // Declarations only (after { or ;), not the @supports condition that mentions the property.
  for (const m of css.matchAll(/(?<=[{;]\s*)animation-timeline:/g)) {
    const ctx = context(css, m.index!).join(' ');
    assert.match(ctx, /@supports[^{]*animation-timeline/, `missing @supports around …${css.slice(m.index! - 60, m.index! + 30)}`);
    assert.match(ctx, /prefers-reduced-motion:\s*no-preference/, 'missing reduced-motion guard');
  }
});

test('time-based intro animations are also guarded by prefers-reduced-motion', () => {
  for (const m of css.matchAll(/animation:\s*(svya-[\w-]+)/g)) {
    const ctx = context(css, m.index!).join(' ');
    assert.match(ctx, /prefers-reduced-motion:\s*no-preference/, `${m[1]} runs without the guard`);
  }
});

test('.reveal never hides content outside the guards', () => {
  for (const m of css.matchAll(/\.reveal[^{}]*\{([^}]*)\}/g)) {
    const ctx = context(css, m.index!).join(' ');
    if (/no-preference/.test(ctx)) continue;
    assert.doesNotMatch(m[1], /opacity:\s*0[;}\s]|visibility:\s*hidden/, 'unguarded .reveal hides content');
  }
});

// Every style rule with its selector, declarations and the at-rules around it (keyframes skipped).
function rules(src: string) {
  const out: Array<{ selector: string; body: string; ctx: string }> = [];
  const stack: Array<{ prelude: string; open: number }> = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') { stack.push({ prelude: src.slice(start, i).trim(), open: i }); start = i + 1; }
    else if (src[i] === '}') {
      const r = stack.pop()!;
      const ctx = stack.map((s) => s.prelude).filter((s) => s.startsWith('@'));
      if (!r.prelude.startsWith('@') && !ctx.some((c) => c.startsWith('@keyframes'))) {
        out.push({ selector: r.prelude, body: src.slice(r.open + 1, i), ctx: ctx.join(' ') });
      }
      start = i + 1;
    } else if (src[i] === ';') start = i + 1;
  }
  return out;
}
const all = rules(css);
// A component's scope, written after its class: .astro-xxxx since 7.8 (an attribute before)
// Astro's scope class, or its short name after the build (8.5c, scripts/shorten-scopes.mjs)
const SCOPE = String.raw`(?:\[[^\]]*\]|\.astro-[a-z0-9]+|\._[a-z0-9]{1,3})?`;
const motionOk = /prefers-reduced-motion:\s*no-preference/;

// 3.1d, better-ui: on touch, :hover latches after a tap and reads as a stuck state.
test('hover styling only applies on pointers that can hover', () => {
  const hovers = all.filter((r) => r.selector.includes(':hover'));
  assert.ok(hovers.length >= 5, `found ${hovers.length} hover rules`);
  for (const r of hovers) assert.match(r.ctx, /hover:\s*hover/, `${r.selector} sits outside @media (hover: hover)`);
});

test('hover effects that move or scale also respect reduced motion', () => {
  for (const r of all.filter((x) => x.selector.includes(':hover') && /transform|translate|scale/.test(x.body))) {
    assert.match(r.ctx, motionOk, `${r.selector} moves without the reduced-motion guard`);
  }
});

test('pressing the button or the menu button scales it to 0.96 over 150 ms, motion allowed only', () => {
  for (const name of ['.button', '.menu-button']) {
    const press = all.find((r) => r.selector.includes(name) && r.selector.includes(':active') && /scale:\s*\.96\b/.test(r.body));
    assert.ok(press, `${name}:active scales to 0.96`);
    assert.match(press.ctx, motionOk, `${name}:active is guarded`);
  }
  assert.ok(all.some((r) => /\.button\b/.test(r.selector) && /transition:[^;]*scale\s+\.15s\s+ease-out/.test(r.body)), 'scale transitions over 150 ms ease-out');
});

test('the menu keeps its scroll to itself and leaves faster than it arrives', () => {
  const base = all.find((r) => new RegExp(`^\\.menu${SCOPE}$`).test(r.selector));
  assert.ok(base, '.menu rule');
  assert.match(base.body, /overscroll-behavior:\s*contain/);
  assert.match(base.body, /var\(--dur-exit\)/, 'closing uses the exit duration');
  const open = all.find((r) => new RegExp(`^\\.menu${SCOPE}:popover-open$`).test(r.selector) && /transition-duration/.test(r.body));
  assert.match(open?.body ?? '', /transition-duration:\s*var\(--dur-ui\)/, 'opening uses the UI duration');
  const ms = (name: string) => {
    const v = css.match(new RegExp(`${name}:\\s*([\\d.]+)(m?s)`));
    assert.ok(v, `${name} is defined`);
    return Number(v[1]) * (v[2] === 's' ? 1000 : 1);
  };
  assert.ok(ms('--dur-exit') < ms('--dur-ui'), 'exit is shorter than enter');
});

test('scroll reveals settle with an ease-out and enter side-by-side siblings in reading order', () => {
  const reveal = all.find((r) => /^\.reveal$/.test(r.selector) && /animation-timeline/.test(r.body));
  assert.ok(reveal, '.reveal rule');
  assert.doesNotMatch(reveal.body, /animation-timing-function:\s*linear/, 'reveals settle instead of sliding at constant speed');
  for (const n of [2, 3]) {
    const later = all.find((r) => /^\.stagger\s*>\s*\.reveal:nth-child/.test(r.selector) && r.selector.includes(`:nth-child(${n})`) && /animation-range/.test(r.body));
    assert.ok(later, `.stagger > .reveal:nth-child(${n}) enters after the one before`);
    assert.match(later.ctx, motionOk);
  }
  const html = read(`${DIST}index.html`);
  for (const parent of ['facts', 'areas__groups', 'footer__cols']) {
    assert.match(html, new RegExp(`class="[^"]*\\b${parent}\\b[^"]*\\bstagger\\b|class="[^"]*\\bstagger\\b[^"]*\\b${parent}\\b`), `.${parent} staggers its children`);
  }
});

test('the hero intro staggers by 100 ms and comes into focus: 12 px rise, 4 px blur', () => {
  const delays = all
    // the minifier writes :nth-child(1) as :first-child
    .filter((r) => /hero__/.test(r.selector) && /:nth-child\(\d\)|:first-child/.test(r.selector) && /animation-delay/.test(r.body))
    .map((r) => r.body.match(/animation-delay:\s*([\d.]+m?s)/)?.[1]);
  // 6.7 (better-ui): the name's two words rise 80 ms apart (100, 180 ms); 7.11: "& Asociados" follows (260 ms)
  assert.deepEqual(delays.sort(), ['.18s', '.1s', '.26s'].sort());
  assert.ok(all.some((r) => /wordmark/.test(r.selector) && /span/.test(r.selector) && /display:\s*inline-block/.test(r.body)), 'the words can move (transforms skip plain inline boxes)');
  const rise = css.match(/@keyframes svya-rise\s*\{\s*(?:from|0%)\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(rise, /translateY\(12px\)/);
  assert.match(rise, /blur\(4px\)/);
});

// 6.5 (docs/MOTION.md): the structural hairlines draw from the left as they enter, with transform
// only, and the plain border stays for browsers without scroll timelines or with reduced motion
test('hairlines draw on scroll: scaleX on a pseudo-element, view() timeline, inside the guards', () => {
  const keyframes = css.match(/@keyframes svya-line\s*\{([^}]*\}[^}]*)\}/)?.[1] ?? '';
  assert.match(keyframes, /scaleX\(0\)/, 'starts undrawn');
  for (const sel of ['.line-top:before', '.line-bottom:after']) {
    const rule = all.find((r) => r.selector.includes(sel) && /animation-name:\s*svya-line/.test(r.body));
    assert.ok(rule, `${sel} draws`);
    assert.match(rule.body, /animation-timeline:\s*view\(\)/);
    assert.match(rule.ctx, motionOk);
  }
});

test('the hairlines that structure the page carry the draw classes', () => {
  const html = read(`${DIST}index.html`);
  const has = (re: RegExp, what: string) => assert.match(html, re, what);
  has(/class="[^"]*\bfacts\b[^"]*\bline-top\b/, 'the facts row');
  has(/class="[^"]*\bfact\b[^"]*\bline-top\b/, 'each fact (phones)');
  has(/class="[^"]*\bpartners\b[^"]*\bline-bottom\b/, 'the partner list closes with a line');
  has(/class="[^"]*\bpartner\b[^"]*\bline-top\b/, 'each partner row');
  has(/<li[^>]*class="[^"]*\bline-top\b/, 'practice items');
  has(/class="[^"]*\boficina__head\b[^"]*\bline-bottom\b/, 'the office heading');
  has(/class="[^"]*\bfooter__bottom\b[^"]*\bline-top\b/, 'the footer bottom line');
});

test('a hairline along the header fills with the page scroll (reading progress)', () => {
  const rule = all.find((r) => /site-header/.test(r.selector) && /:before/.test(r.selector) && /animation-timeline:\s*scroll\(root/.test(r.body));
  assert.ok(rule, '.site-header::before on a scroll(root) timeline');
  assert.match(rule.body, /animation-name:\s*svya-line/);
  assert.match(rule.ctx, motionOk);
});

// 6.6 (docs/MOTION.md): images unroll like paper. A strip of the band's colour rolls up (scaleY) as
// the image enters, and the image settles from 1.06 (the `scale` property, so hover's transform still
// works). Transform only; the pinned Fig. 02 takes its timeline from its non-sticky column.
test('images unroll: a band-coloured strip rolls up and the image settles, inside the guards', () => {
  const unroll = css.match(/@keyframes svya-unroll\s*\{([^}]*\}[^}]*)\}/)?.[1] ?? '';
  assert.match(unroll, /scaleY\(1\)/);
  assert.match(unroll, /scaleY\(0\)/);
  const settle = css.match(/@keyframes svya-settle\s*\{([^}]*\}[^}]*)\}/)?.[1] ?? '';
  assert.match(settle, /scale:\s*1\.06/);
  const paper = all.find((r) => r.selector.includes('.unroll:before') && /animation-name:\s*svya-unroll/.test(r.body));
  assert.ok(paper, '.unroll::before rolls up');
  // A named timeline on the frame: overflow: hidden makes the frame a scroll container of its own, so
  // an anonymous view() on its pseudo-element would measure against the frame and sit at the end
  assert.match(paper.body, /animation-timeline:\s*--unroll/);
  assert.ok(all.some((r) => /^\.unroll$/.test(r.selector) && /view-timeline-name:\s*--unroll/.test(r.body)), 'the frame names its timeline');
  assert.match(paper.ctx, motionOk);
  const pinned = all.find((r) => /areas__pin/.test(r.selector) && /:before/.test(r.selector) && /animation-timeline:\s*--areas-fig/.test(r.body));
  assert.ok(pinned, 'the pinned Fig. 02 uses its column\'s named timeline');
  assert.ok(all.some((r) => /areas__fig/.test(r.selector) && /view-timeline-name:\s*--areas-fig/.test(r.body)), 'the column names the timeline');
});

// 8.5h: the office photos left La Oficina; 9.1 brings them back as one strip, and they unroll like Fig. 02 and the map
test('Fig. 02, the map and the three office photos carry the unroll class', () => {
  const html = read(`${DIST}index.html`);
  assert.equal(html.match(/class="[^"]*\bplate__frame\b[^"]*\bunroll\b/g)?.length, 3, 'the three office photos');
  assert.match(html, /class="[^"]*\bmap__frame\b[^"]*\bunroll\b/, 'the map');
  assert.match(html, /class="[^"]*\bareas__pin\b[^"]*\bunroll\b/, 'Fig. 02');
});

// 6.7 (docs/MOTION.md): as the hero scrolls away its light drifts down and dims, and the name eases
// up a little faster than the page. scroll(root), transform and opacity, identity at the top
test('the hero light drifts and dims with the scroll, and the name eases up, inside the guards', () => {
  const drift = css.match(/@keyframes svya-drift\s*\{([^}]*\}[^}]*)\}/)?.[1] ?? '';
  assert.match(drift, /translateY\(10%\)/);
  assert.match(drift, /opacity:\s*\.55/);
  const fig = all.find((r) => /hero__fig/.test(r.selector) && /animation-name:\s*svya-drift/.test(r.body));
  assert.ok(fig, 'the light layer drifts');
  assert.match(fig.body, /animation-timeline:\s*scroll\(root/);
  assert.match(fig.ctx, motionOk);
  // the whole text block, not the name alone: the name easing up on its own ran into the kicker
  const name = all.find((r) => new RegExp(`^\\.hero__text${SCOPE}$`).test(r.selector) && /animation-name:\s*svya-ease-up/.test(r.body));
  assert.ok(name, 'the text block eases up together');
  assert.match(name.body, /animation-timeline:\s*scroll\(root/);
  assert.match(name.ctx, motionOk);
});

// 8.5j's CSS sway of the hero's picture left in 8.5k3: it moved the paper with the light. The light now moves on
// its own, once, from Blender's clip (tests/build/hero-motion.test.ts, tests/e2e/hero-motion.test.ts)
