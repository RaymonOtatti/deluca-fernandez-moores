# Motion: research and shortlist (item 6.4, 2026-10-22)

Franco asked for smooth, sober motion: "clean light animations and scrolling animations like rolling paper or minimalist lines roll on scroll". This file is the spec that 6.5–6.7 build. It draws on the installed `better-ui` skill (animations, enter/exit, performance), the restraint in Anthropic's `frontend-design`, and current notes on CSS scroll-driven animation (sources at the end).

## Rules every new animation keeps

1. **CSS only.** Scroll-driven (`animation-timeline: view()` or `scroll()`) or a one-shot intro, with no script and no library. The JS budget stays one module of 1 KB or less.
2. **Compositor properties only: `transform` and `opacity`.** Those stay smooth during fast scrolling. Avoid `clip-path`, `background-size`, widths and heights: they repaint or re-layout every frame, and Safari's support for some of them in timelines is uneven.
3. **Guarded twice:** `@supports (animation-timeline: view())` and `@media (prefers-reduced-motion: no-preference)`.
   - Without support, or with reduced motion, nothing moves and everything is visible: the hidden state lives only in the `from` keyframe.
   - Scroll-driven rules use longhands only. The minifier folds a shorthand plus `animation-timeline` into an invalid declaration (STYLE.md, 2.11).
4. **Nothing runs on its own for more than 5 s** (WCAG 2.2.2). Scroll-linked motion follows the reader's hand, so it's never "auto-playing". No infinite loops.
5. **One orchestrated moment** (frontend-design): the hero's intro. Everything else is a quiet accompaniment to scrolling, never a show. Spend boldness in one place.
6. **Exact values from `better-ui`:**
   - entrances combine opacity with a 12 px rise and, for the one headline moment, a 4 px blur;
   - groups stagger 100 ms apart; a two-word display headline enters word by word, 80 ms apart;
   - ease-out to settle; interactive presses 0.96 over 150 ms (already built in 3.1d).
7. **Tested:** every rule sits inside both guards (`tests/build/motion.test.ts` already enforces this for `animation-timeline`). Each new effect gets its own build test, plus a mid-scroll frame in Chrome to show it.

## What already moves (keep)

- **Hero intro, once on load:** the light comes up (`svya-light`, 2.2 s); the kicker, the name and the row rise 100 ms apart from a 4 px blur.
- **Scroll reveals** (`.reveal`): 12 px rise with an ease-out, side-by-side siblings a step apart (`.stagger`).
- **The bar folds** into two green squares past the hero, through a `scroll(root)` timeline.
- **Interaction:** hover only on hover-capable pointers; presses at 0.96; the menu opens in 200 ms and closes in 150 ms.

## Shortlist

### 6.5 Lines that draw on scroll ("minimalist lines roll on scroll")
- **What:** every hairline that structures the page draws itself from the left as it enters. That covers:
  - the facts' top rule;
  - each partner row's rule and the list's closing rule;
  - each practice item's rule;
  - the office heading's rule;
  - the footer columns' rules and the footer's bottom rule.
- **How:** the border stays as the fallback. Inside the guards the border turns transparent and a `::before` hairline in `var(--rule)` takes its place:
  - `transform: scaleX(0)` to `scaleX(1)`, `transform-origin` on the inline-start side, `animation-timing-function: linear` (the line follows the scroll like a pen);
  - `animation-timeline: view()`, `animation-range: entry 0% cover 30%`.
  - Rows lower on the page draw later, so a list draws row by row without any delay.
- **Plus one progress line:** the header's bottom hairline fills with sage from left to right as the page scrolls (`scroll(root)`, 0 → 100 %). It's a reading-progress line made of the existing rule, not a new element.

### 6.6 Rolling paper (images unroll into view)
- **What:** each image is covered by a strip of its own band's colour that rolls up as it enters, like paper being unrolled. That's the three office photos and Fig. 02.
- **How, transform only:**
  - The frame's `::before` is the "paper": the band colour, `scaleY(1)` to `scaleY(0)`, range `entry 5%` to `cover 35%`. Built with `transform-origin: bottom` (6.6), so it rolls down and the part already on screen shows first. A top origin revealed the bottom, which is still off screen, first.
  - A soft shadow at its top edge reads as the roll: a 12 px gradient to 6 % toward the band's text colour.
  - The image underneath settles from `scale(1.06)` to `scale(1)` over the same range.
  - The pinned Fig. 02 takes its timeline from its non-sticky column (a named `view-timeline`), so the pin doesn't distort it.
- Rejected: the `clip-path` unveil (repaints every frame; uneven in Safari).

### 6.7 Light in motion (hero)
- **What:** as the hero scrolls away, its light drifts down a little and dims, as if the sun moved. The name eases up slightly faster than the page (a gentle depth), and the light never leaves the frame.
- **How:**
  - On `scroll(root)` over the first 100vh, the light layer (the figure, not the `<img>`, which keeps its intro) moves `translateY(0)` to `translateY(10%)` and `opacity` 1 to 0.55. The text eases up `translateY(-3rem)` as one block. Built that way in 6.7: the name alone ran into the kicker.
  - The intro gets one refinement from `better-ui`: the two words of the name rise 80 ms apart (the spans, not the whole `<h1>`).
- **Guard:** at scroll 0 every transform is the identity, so LCP and the first paint don't change.

### 7.7 The passage (Franco's third round)
- **What:** the lead "Asesoramos a empresas nacionales y extranjeras y a entidades del sector público." left the hero for a band of its own, between the green and the ivory.
  - The band's top dissolves from the hero's dark green into ivory: seam (`--seam`, forest into ink), then forest, then ivory, eased in OKLab so there's no grey band. The hero's art fades into the same seam at its bottom edge, so there's no line.
  - The statement sits centred on solid ivory, in three editorial lines; the last in the soft tone, like the section titles.
- **Motion:** hidden at rest. As the passage comes into view, each line rises out of its own mask (`translateY(110%)` and opacity to rest, ease-out), a step apart: `entry 0–60 %`, `20–80 %`, `40–100 %` of the statement's own timeline (`--passage`). All three have arrived once it's fully in view.
  - The masks are `overflow: clip`, which doesn't make a scroll container (an `overflow: hidden` mask would capture an anonymous `view()`, the 6.6 bug).
- **Guards:** both, as everywhere. Without support or with reduced motion the lines are plainly there (e2e).

### 7.7b The passage, second take (Franco)
- The gradient from the hero into the ivory went, with its seam colour. The hero now meets the ivory with a hard edge.
- A hairline across the content width sits halfway between that edge and the statement. It draws from the centre outwards as it enters (`svya-line` with `transform-origin: center`, `view()`, `entry 0% cover 30%`, linear), inside both guards, and is simply there without them.
- The statement sits in the middle of its band: equal top and bottom padding (`--py`), the line at half of it.

## Considered and turned down
- **Smooth-scroll or scroll-jacking libraries (Lenis, GSAP ScrollTrigger):** they break the JS budget and the CSP plan, and they take the scroll from the reader.
- **Scroll snapping and horizontal sections:** they fight the reader on a long page.
- **Split-letter or typewriter text, cursor followers, magnetic buttons:** loud, not sober.
- **Ambient loops** (a breathing light, drifting grain): auto-playing for more than 5 s would need a pause control (WCAG 2.2.2), and they're decoration.
- **Parallax on several layers:** one gentle drift in the hero is the limit (vestibular comfort, frontend-design restraint).
- **A reveal on every element:** the existing reveals plus lines and paper are enough; more would be noise.

## Sources
- `better-ui` (installed): `animations.md`, `enter-exit.md`, `performance.md`. The entry values, the 80 ms word stagger, transform and opacity only, `will-change` only when a stutter shows.
- Anthropic's `frontend-design` (read in 3.1c): one orchestrated moment; boldness in one place.
- [Scroll-driven Animations Explainer (CSSWG)](https://drafts.csswg.org/scroll-animations-1/EXPLAINER.html): scroll and view timelines.
- [Builder.io: view timeline](https://www.builder.io/blog/view-timeline): timelines run on the compositor, unlike scroll listeners.
- [webexpo: Scroll-driven animations with CSS](https://webexpo.net/blog/scroll-driven-animations-with-css-performance-focused-web-interactivity/): reveals with view timelines; uneven support for some properties.
- [buildmvpfast: CSS scroll-driven animations go cross-browser](https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026): the `@supports` plus reduced-motion pattern, `entry 0% cover 40%` ranges.
- [CSS Portal: view-timeline](https://cssportal.com/css-properties/view-timeline.php): transform and opacity for smooth results; avoid layout work.
