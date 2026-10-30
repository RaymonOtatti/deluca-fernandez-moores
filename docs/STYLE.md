# SVyA style system (v0.1, 2026-10-21)

The source of truth for values is `src/styles/tokens.css`; this file explains them. The rendered sample is `design/style-tile.html` (serve the repo root, then open `/design/style-tile.html`); a capture is in `docs/style-tile.jpg`. The reference notes are in `STYLE-REFERENCE.md`.

**One idea:** a drafting plate for a law firm. Flat bands of ink, forest and paper; hairlines; mono notes in the margins; the monogram drawn like a technical figure. Calm, exact, no decoration that doesn't measure something.

## Color

| Token | Hex | Role | Text on it |
|---|---|---|---|
| `--ink` | `#1d1d1b` | Hero, nav, team, footer | `--paper` 14.4:1 · `--muted` 6.7:1 |
| `--graphite` | `#262624` | Raised panel on ink (`.band--graphite`; unused since the featured operation left in 7.4) | `--paper` 12.9:1 · `--muted` 6.0:1 |
| `--forest` | `#2a3220` | Practice areas: the one color moment | `--paper` 11.4:1 · `--sage` 5.9:1 |
| `--paper` | `#f1ede2` | Default page; ivory since 7.6 (the brief's `#ededea` at the same OKLCH lightness, warmed to hue 90°) | `--ink` 14.4:1 · `--olive` 5.9:1 |
| `--stone` | `#ddd9ce` | Closing band (careers); warmed with the paper in 7.6 (the brief's `#d9d9d4` read cold beside the ivory) | `--ink` 12.0:1 · `--olive` 4.9:1 |
| `--wall` | `#1e211b` | Fig. 02's surface: the wall the art fades into | `--paper` 13.9:1 · `--muted` 6.4:1 |
| `--olive-soft` | `#7a7258` | Second tone of **large** headlines on paper only | 3.8:1 (large text) |

- `tests/tokens.test.ts` enforces every pair: 7:1 for primary text, 4.5:1 for secondary, 3:1 for the large second tone.
- No accent color. Forest is the accent. No gradients, no shadows, no radius.
- Hairlines are `--rule` (16 % of the band's text color), so they work on every band without new tokens. (`--rule-strong` was never used and went in 6.10.)
- **Safari 26+ (6.3b):** it ignores `theme-color` and tints its bar with the background of the fixed or sticky element at the top edge. The film grain (`body::after`, fixed, full page) sits under the header (z-index 40 < 50), so that element is the green header. Verified in Safari 27.2: the bar is green at the top and stays green past the fold. `tests/e2e/theme.test.ts` checks the header's top strip renders as flat brand green.
- **The header in the brand green (6.3, Franco 2026-10-22):** the bar, its folded squares and the phone menu are forest (`--bg: var(--forest)`, `--soft: var(--sage)`), and `theme-color` is the same `#2a3220`, so Safari's and Chrome's own bar continue the header. `tests/e2e/theme.test.ts` compares the header's rendered colour with `theme-color`.
- **Roles, not colours (3.1f):** components never write a colour literal and use the palette only to set roles (`--bg`, `--fg`, `--soft`), the way the bands do; surfaces outside the bands (the header, the menu, Fig. 02's column) define their own roles. Shared roles live in tokens.css: `--image-outline` (`#0000001a`, pure black at 10 %) and `--media-placeholder` (stone). `tests/colors.test.ts` enforces both rules. The header's hairlines now use `--rule` too (16 %, was a one-off 14 %).
- **Text over art is measured as rendered:** `tests/e2e/contrast.test.ts` hides each caption, captures what's behind it and measures every pixel (worst 2 % excused for hairlines and grain). Lowest on 2026-10-22: 4.73:1, "Bajorrelieve, luz rasante" over the lit relief at 390. It passes AA but has little headroom, so recheck it if Fig. 01 changes.

## Type

- **Jost Variable** (open Futura revival, matching the wordmark) for all headings and text. **Geist Mono Variable** for labels, figure captions, numbers in lists, buttons and nav. Both self-hosted (@fontsource), Latin subset, cut to the weights the pages use (7.10, `design/font/instance-fonts.py`): Jost 300–400 (16.7 KB, still variable), Geist Mono 400 (9.9 KB, static). Jost and Valiente Display are preloaded; the label face isn't (no phone shows it in its first view).
- **Valiente Display Light** (6.8–6.9), our own face, drawn from the monogram's broad-nib stress (`design/font/build-font.py`, specimen in `design/font/specimen.html`). It sets the wordmark (hero and share card; the footer's left in 7.5) and the big numbers, through `--font-display` with Jost behind it. Capitals, Spanish accents, digits and a few symbols; 5 KB WOFF2, preloaded. To change a glyph, edit the builder, rebuild and copy the WOFF2 to `src/assets/fonts/`: `tests/font.test.ts` fails until the site's copy matches the build.
- Headings are **Light 300** and sentence case, never bold. Text is Regular 400. Nothing heavier than Medium 500.
- Scale (fluid from 360 to 1440 px): display 52→120, h1 40→76, h2 28→44, h3 22→28, lead 18→24, body 16, small 14, label 12.
- Display leading 0.95, tracking −0.025em. Heading leading 1.1. Body 1.55.
- **Two-tone headings:** ink first phrase + `--olive-soft` (paper), `--muted` (ink) or `--sage` (forest) for the rest. Use it once per section, not on every heading.
- **Wrapping (3.2a):**
  - Section titles cap themselves to their column: `min(var(--step-1), 100cqi / 8.2)` on a container `.section-head__body`. The longest phrase kept together fits at every width, and desktop sizes don't change.
  - No-break spaces keep "Un equipo de" and "cuarenta abogados" whole, so on phones the heading breaks where its tone changes and never ends on a lone word.
  - Dot-separated runs (the address, the Equipo notes) use `Meta.astro`. A separator that lands at a line start is clipped away, so none is ever left dangling.
  - `tests/e2e/typography.test.ts` checks all of it at five widths, plus the weight floor (400 or heavier under 18 px).
- Labels: mono, 12 px, uppercase, +0.14em. Since 7.3 (Franco) sections have no numbered label: the two-tone title opens each one, and the left columns stay open on desktop. Figure captions left in 6.2.
- `text-wrap: balance` on headings and `pretty` on paragraphs. Short copy capped at `--measure` (34rem); the hero lead at 30ch.

## Layout

- Full-bleed bands; content on a 12-column grid with `--pad` side padding (24→48) and `--gutter` (16→24). Vertical rhythm per band is `--section-y` (80→160).
- The section pattern: label in columns 1–4, heading and content in 5–12 (the mockup's layout). It collapses to one column below 760 px.
- Splits are 50/50 with a 1 px vertical rule; lists and stats are separated by horizontal rules (no boxes).
- Band order on the home page: ink hero → the passage (7.7b: a hard edge, a hairline drawing from the centre, the firm's one-line statement in the middle) → paper (Estudio) → forest | figure (Áreas) → ink (Socios) → paper (Oficina) → stone (Carrera, between crop marks) → a compact ink footer: the contact columns and the © line (7.5).

## Components

- **Buttons:** square, 44 px tall, mono label. Solid = paper on ink bands (ink on light bands) plus a 28 px inverted square holding the arrow. Plain = 1 px outline in the current color. No pills, no radius.
- **Nav:** a sticky 56 px ink bar: monogram + "Sáenz Valiente / & Asociados" in live Jost caps (+0.22em) on the left, because the traced lockup's small lines don't read at bar height. Mono uppercase links on the right with a hairline underline that grows on hover. Below 900 px the links become a 56 px menu square (as in the reference).
- **Menu:** the native Popover API (Esc and outside-tap close it for free), a full-screen ink panel with numbered Jost Light links and the address at the foot. One 140-byte module closes it when a link inside is followed; without JS it still works. The panel draws its own grain because the top layer sits above `body::after`. Collapsing the bar into squares on scroll, like the reference, belongs to 2.11 (scroll-driven CSS).
- **Crop marks:** `\ | /` at the corners and middle of a closing band, 1 px, current color.
- **Figures:** art and photos carry a mono caption. **Captions and measurements are HTML text, never SVG `<text>`**, so they stay at 12 px on phones (in the tile, SVG text shrank to about 5 px at 390).
- **Brand name casing:** "SVyA" keeps its lowercase y, even inside uppercase mono labels (`.brand { text-transform: none }`). Uppercasing turned it into "SVYA" in the first share image.
- **Logo files** (`src/assets/brand/`): `lockup.svg` (monogram + wordmark), `monogram.svg`, `wordmark.svg`. They're potrace traces of the site's PNG, single path, `fill="currentColor"`, so CSS sets the color. The source PNG has no anti-aliasing; ask the client for the official vector logo before launch.
- **Logo minimum sizes:** the lockup's small lines ("& ASOCIADOS", "ABOGADOS") stop reading below about 56 px of lockup height; under that, use the monogram + live text. The monogram holds from 32 px.
- **Icons:** `favicon.svg` is a forest square with the paper monogram at 88 % height plus a 16-unit stroke so the hairlines survive at 16 px. `favicon.ico` (32), `apple-touch-icon.png` (180) are rendered from `design/icon.html` with `scripts/shoot.mjs --height`. The share card `og.jpg` (1200×630, since 5.3) is rendered from `design/og.html` the same way, then saved as JPEG (the soft light is photographic: 66 KB, against 530 KB as PNG).
- **Footer wordmark (until 7.5, when Franco had it removed with the coordinates; the footer is now the contact columns and the © line, 350 px at 1440):** "Sáenz Valiente" in Light caps with +0.08em tracking. It breaks into two lines on phones (at 390 it overflowed on one). Sized in container units (`100cqi / 8.5`, `/ 4.75` on phones) against the footer's content box, not `100vw`, which includes a classic scrollbar and pushed it 18 px past the margin (3.1e).
- **Shared edges (3.1e):** on phones a partner's field hangs from the same edge as the name. On desktop the footer's monogram sits on the columns' top rules, and "Contacto" sits on the same line as the column labels. `tests/e2e/layout.test.ts` checks both, plus the wordmark's right edge, at every width.

- **Hero headline (5.1, Franco 2026-10-22):** the `<h1>` is the "Sáenz Valiente" wordmark, in the same lettering as the footer's sign-off. Both use `Wordmark.astro`, sized to its container in `cqi`: one line from 900 px, two below. "Derecho empresario desde 1946" was dropped. Since 7.2 (Franco) the hero is only the light, the name and the lead: the kicker, the two buttons and the coordinates are gone. Since 7.11 (Franco) the name is complete, and since 7.11b about two thirds of the width on desktop: "Sáenz Valiente" at `min(--step-display, 100cqi / 13)` in a wide container (103 px at 1440; 7.11 had it at half; one line on phones, capped to fit), with "& Asociados" under it in Jost caps at 0.3 em with the nav's tracking, in the soft tone. The lead moved to the passage in 7.7.

## Imagery
- **The map (7.8, Franco 2026-10-22):** a wide plate under the office photos (12:5 on desktop, 16:9 on tablets, square on phones), our own drawing of the streets, parks, lakes and railway around the office, centred on the pin from the firm's current site (-34.5690162, -58.4215254). `design/map/build-map.py` turns one Overpass extract into `src/assets/map/oficina.svg` (18 KB). It takes its colours from tokens.css, mixed in OKLab, and uses `vector-effect: non-scaling-stroke`, so hairlines stay hairlines at every crop.
  - Its edges dissolve into the paper (a mask), and the office's street, Freyre, takes the avenues' tone.
  - The page marks the office with a forest square and a "Freyre 3650" tag at the frame's centre (every crop keeps the centre), and unrolls the map like the photos.
  - Under it: "Ver en Google Maps" (the whole plate is its hit area) and the "© OpenStreetMap" credit the ODbL asks for. No embed, no tiles: the page loads nothing from outside. Google sees a visitor only if they follow the link.

- **No figure captions since 6.2 (Franco, 2026-10-22):** the "Fig. 01–05" labels are gone from the page and the share card, and every image is described by its alt text. Older notes below that mention captions are history.

- Brand art comes from the monogram's own geometry: the S's construction circle, the two long diagonals of the V and A, guide lines, and a ruler marked 1912 / 1946 / Hoy. The art is pre-rendered in 1.3.
- **Guides end on the baseline (3.1g):** the V and A diagonals and the dotted axis stop at the letters' baseline (y 1575), and the baseline stops where the A's leg lands (x 1317), so no line runs on into the caption, the ruler or the coordinates at any width (`tests/e2e/hero-lines.test.ts` maps the lines to the screen and checks them against every line box of that text). On phones Fig. 01's caption is just "Fig. 01 — SVyA"; the medium is in the alt text.
- The three office photos show **in their own colour**, untouched (Franco, 2026-10-22): the warm wood, the cyan skylight and the plants are part of the place. Until then they were toned toward forest/ink; `tests/figures.test.ts` now requires a colourfulness of 25 or more.
- **Fig. 01 since 7.12c (Franco, 2026-10-22): the plain Velo light again, with no mark** (the 5.2 render, below). The three marks tried in 7.9–7.12b stay in `design/art/` for the record.
- **Fig. 01 from 7.12b to 7.12c: their own SVA logo, drawn in black pencil and inked with a quill** (take M, `design/art/build-sign.py`): Velo, with a pool of light on the paper where the logo sits (black ink on the dark paper measured 2:1 at best). Under the ink, a black-pencil draft: six loose outline passes, construction lines ruled past the strokes, a cap line and baseline, and the S's bowls sketched as ovals, all grainy. Over it, their exact logo in iron-gall ink: a traced outline, dense quill hatching in the thick strokes, and a partial second pass. Then raw drops in wet ink. It's 860 px tall on the 2400 × 1500 canvas, inside the phone crop. The share card crops to the top of the art (`78% 0%`) so the whole logo shows.
- **Fig. 01 from 7.12 to 7.12b: Velo with the initials SVA signed in ink** (take D, `design/art/build-sign.py`): iron-gall ink in the Meddon quill hand (OFL, in `design/art/fonts/`), multiplied into the paper so it reads in the light. It has raw, frayed edges, dry-nib streaks, uneven pooling, a slight bleed and a few droplets where the pen first touched. Upright at −7°, centred at (1665, 470), inside the phone crop. The share card shows it, with the 7.11 name lockup.
- **Fig. 01 from 7.9 to 7.12: Velo with the SVA monogram pressed into the paper** (take A, "Relieve", `design/art/build-mark.py`): the monogram's alpha is a height map, lit from the upper right at 30° so flat paper stays 50 % grey under an overlay blend. Only its pressed edges show, strongest where the light falls. It's 720 px tall on the 2400 × 1500 canvas, centred at (1700, 500): in the light, inside the phone crop, and clear of the name. The share card shows the same art.
- **Fig. 01 from 5.2 to 7.9 (Franco, 2026-10-22):** `src/assets/art/fig-01-papel.jpg`, 2400×1500, abstract light: "Velo", soft forest-green bands like sun through a sheer curtain, on paper tooth lit from the upper right, with no symbol. Rendered by `design/art/build-light.py`; takes A "Ventana" and B "Halo" are kept there. It fills the hero at every width with the light upper right, the caption top left in shade, and the name and text bottom left. On phones the text block shades the light into the band (clear 6rem above the name, full ink from it), and the caption shows only "Fig. 01 — Luz". The construction lines and the ruler are gone. The text set on it is measured in `tests/e2e/contrast.test.ts`: 4.5:1, or 3:1 for the name.
- *Before 5.2:* **Fig. 01 (hero)** `src/assets/art/fig-01-relieve.jpg`, 1800², 79 KB: the monogram as a bajorrelieve in dark stone. Rendered by Chrome from `design/art/build-pages.py`: the monogram's alpha is the height map for `feDiffuseLighting` (light from the upper left, 27° elevation), with fine stone bumps. The light map sits at 50 % grey on flat stone and is blended in overlay mode.
- **Fig. 02 (áreas)** `src/assets/art/fig-02-luz.jpg`, 1400×1800, 86 KB: the monogram as projected light on a dark wall tinted toward forest. A slight perspective, a soft halo, and falloff toward the lower right; the wall texture shows through the light.
- **Grain** (`src/assets/grain.svg`, 373 bytes): a 220 px feTurbulence tile on a fixed `body::after` at 7 % opacity, no blend mode, off under `prefers-contrast: more`. Measured on the built page: 3.8 grey levels of deviation on ink (visible film grain) and 1.3 on paper (a faint tooth). The first version measured 0.8 on paper, which is invisible.
- The art is **smooth on purpose**. Film grain is incompressible, so it lives in one small tiled overlay over the whole page (built in 2.2) instead of being baked into every image.
- **Photos:** the originals from `_source/images/` copied as they are (1350², 976×1300, 1000×750). The forest tone map (`scripts/tone-photos.sh`, removed) is in git history.
- Sources are high-quality JPEG in `src/assets/`; Astro builds AVIF/WebP + `srcset` from them. Every image declares `width`/`height`. Captions and alt text live in `src/content/figures.ts`.
- The art's outer edges are not ink-black: the components fade them into the band with a CSS mask so there's no visible rectangle.

## Motion

- CSS only. Reveals use scroll-driven animations (`animation-timeline: view()`): fade plus an 8–16 px rise, `--dur-reveal` 900 ms with `--ease-out`. (The relief hero's line draw-in, `--dur-draw`, left with that art in 5.2; its token went in 6.10.)
- `prefers-reduced-motion: reduce` turns off every transform and every line drawing; content is visible without animation support.
- **Built (2.11):** `.reveal` (scroll-driven `view()`, `entry 5% → cover 22%`) on section heads, facts, practice groups, partner rows, the operation panel, office plates and footer columns. The hero intro runs once on load (text rises from 35 % opacity, never hidden, because it's the LCP candidate; the art "lights on" from 30 %; the construction lines draw down with `clip-path`; captions fade in). On desktop, past the hero, the bar folds into two ink squares (monogram top left, menu top right) through a `scroll(root)` timeline (55–70vh).
- **Guards, enforced by `tests/build/motion.test.ts`:** every scroll-driven declaration sits inside `@supports (animation-timeline: …)` *and* `prefers-reduced-motion: no-preference`; every `svya-*` intro animation sits inside the reduced-motion guard; `.reveal` never hides anything outside the guards. Print disables reveals.
- **Minifier trap:** lightningcss (Vite 8's CSS minifier) folds `animation: x linear both; animation-timeline: scroll()` into `animation: linear both x scroll(root)`. The shorthand can only *reset* the timeline, so browsers drop the whole declaration and nothing animates. Scroll-driven rules are written as longhands only, and a test rejects any `animation:` shorthand that carries `scroll(`/`view(`.
- Hover: color and underline shifts at `--dur-ui` 200 ms. Nothing bounces.
- **Lines that draw (6.5):**
  - `.line-top` / `.line-bottom` (global.css) draw an element's hairline from the left as it enters, with `scaleX` on a pseudo-element, a linear `view()` timeline and the range `entry 0%` to `cover 30%`. The plain border is the fallback.
  - On: the facts (the row on desktop, each fact on phones), the partner rows and the list's end, the practice items, the office heading, the footer columns and the footer's bottom line. The footer's lines and reveals follow the footer's own entry (`--footer`, 30–100 %), because the last band can't travel far into the view (6.10, 7.5).
  - The header's top edge carries a sage line that fills with the page scroll (`scroll(root)`), as a reading progress.
- **Light in motion (6.7):**
  - Over the first 100vh of `scroll(root)`, the hero's light layer drifts `translateY(10%)` and dims to 0.55, and the text block eases up 3rem. Every transform is the identity at the top of the page.
  - The intro's name enters word by word: "Sáenz" at 100 ms, "Valiente" at 180 ms, then the row at 280 ms. `Wordmark`'s spans are `inline-block` so they can move.
- **Rolling paper (6.6):** `.unroll` (global.css) on the three office photos and Fig. 02.
  - A strip in the band's colour covers the image and rolls down and away as it enters (`scaleY` 1 to 0, `transform-origin: bottom`, range `entry 5%` to `cover 35%`), so the top shows first, with a 12 px shaded edge as the roll. The image settles from `scale: 1.06` (the individual property, so hover's `transform` still works).
  - Each frame names its own timeline (`view-timeline-name: --unroll`): `overflow: hidden` makes a frame a scroll container, so an anonymous `view()` would measure against the frame and sit at the end. The sticky Fig. 02 uses its column's `--areas-fig`.
- **3.1d (better-ui pass, 2026-10-22):** every `:hover` rule sits in `@media (hover: hover)`, so a tap on a phone never leaves a stuck state. Hovers that move something (the button arrow, the photo zoom) also need `prefers-reduced-motion: no-preference`. Buttons and the menu button scale to **0.96 over 150 ms ease-out** when pressed, motion allowed only. The menu opens on `--dur-ui` (200 ms), closes on `--dur-exit` (150 ms) and contains its own scroll. Office photos carry a 1 px `oklch(0 0 0 / 0.1)` hairline just inside the edge. Scroll reveals rise **12 px** with an **ease-out**, and side-by-side siblings (`.stagger` parents: the facts, the practice groups, the footer columns) enter a step apart. The hero intro is the page's one orchestrated moment: a **100 ms** stagger, and the text comes into focus from a **4 px blur** as it rises (still 900 ms, the page's calm pace; the only blur on the page). All of it is enforced by `tests/build/motion.test.ts`.

## Accessibility (3.3, WCAG 2.2 AA)

- **Focus ring:** `outline: 2px solid var(--fg)`, 3 px out. It takes the surface's text colour, which contrasts with that surface everywhere. `currentColor` failed on filled buttons, where the text is the band's own background (1:1 on the hero and on Carrera).
- **Menu:** a native popover (Escape, Tab order right after its button). It covers the screen but isn't modal, so the 140-byte script now also closes it once focus has moved outside it. Focus is never left on something hidden behind it (2.4.11), and the next Tab simply lands on the page.
- A link that opens a new tab says so in its name: "Ver en el mapa (se abre en una pestaña nueva)", with the note visually hidden.
- `tests/e2e/a11y.test.ts` covers it at 1440 and 390:
  - the keyboard walk: skip link first; every stop named in Chrome's accessibility tree, ringed at 3:1 and in view;
  - the menu from the keyboard;
  - targets of at least 24×24 (2.5.8).

## Performance (3.4)

- Lighthouse 12.8.2 on 2026-10-22: **100 in all four categories on mobile and desktop.** SEO is scored without `is-crawlable` while the page is `noindex`; with it, SEO is 63 by design.
- Mobile LCP is **1.43 s** (the hero art; TTFB 453 ms, render delay 673 ms under Lighthouse's slow-4G simulation). Desktop is 0.35 s, with TBT 0 and CLS 0.
- It depends on compression: uncompressed, mobile LCP was 1.7 s. `scripts/serve.mjs` compresses like the CDN, and the deploy (4.2) must confirm production does too.
- Budgets, all enforced:
  - a first view of 100 KB or less, compressed and from a cold cache (82 KB at 1440 and 73 KB at 390, where the two fonts are 50 KB);
  - CLS under 0.01;
  - the hero art as the LCP element (`tests/e2e/perf.test.ts`);
  - HTML of 40 KB or less, CSS of 30 KB or less, JS of 1 KB or less (`tests/build`).

## Hosting and security (3.5)

- `public/_headers` (Workers static assets read it). The CSP is `default-src 'none'`, with `script-src`, `style-src`, `img-src`, `font-src` and `connect-src` set to `'self'` (`connect-src` only so audit tools can fetch robots.txt). `base-uri`, `form-action` and `frame-ancestors` are `'none'`, and it requires Trusted Types. Nothing is inline, so there are no hashes and no `unsafe-*`.
- Other headers: HSTS for a year, `nosniff`, `strict-origin-when-cross-origin`, COOP `same-origin`, a Permissions-Policy that denies camera, microphone, geolocation, payment and USB, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex, nofollow` while the pitch is not launched.
- `/_astro/*` is cached for a year, immutable; the names are hashed.
- `robots.txt` allows crawling, so the noindex can be seen. At launch, drop the noindex and add a Sitemap line.
- `404.html` has the hero's shape: "Esta página no existe." and a button home. The layout's `linkBase="/"` makes every header link lead home from any missing URL.
- One stylesheet for every page (`cssCodeSplit: false`): with a second page Astro had split it in two, which cost about 90 ms of mobile LCP.

## Mobile rules (from the 390 review)

- The hero figure sits above the headline, at most about 36 % of the viewport height, so both buttons stay above the fold.
- No horizontal overflow anywhere: long single words (the wordmark, "contencioso") get room or a break.
