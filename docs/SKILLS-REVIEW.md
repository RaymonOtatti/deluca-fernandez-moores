# Skills review for clean, animated sites (item 3.1c, 2026-10-22)

Franco asked for a review of skills for clean websites with animation, with slight touches added where they help. This file lists what was found, what each skill offers this site, which checklist item uses it, and what was turned down.

Rules followed: installed skills are loaded in their own item. Public and community skills were **read over HTTP only** (`gh api`) and nothing was installed or run. Their useful ideas are written down here, so the site doesn't depend on them.

## What was found

| Skill | Source | What it offers this site | Used in |
|---|---|---|---|
| `better-ui` | installed (`~/.claude/skills`) | Exact motion values: transitions for interactive state, press scale 0.96, 100 ms stagger on entrances, exits shorter than entrances, no animation on first render, a reduced-motion gate. Also surfaces, radius and optical alignment. Has `animations.md` and `enter-exit.md` | 3.1d |
| `better-layout` | installed | Group with space rather than lines, shared edges, reading order, structure that holds until it breaks | 3.1e |
| `better-colors` | installed | Ramps, a job for each token, measuring rendered contrast. Needed now that the photos carry colour of their own | 3.1f |
| `better-interface` | installed | One review across every `better-*` skill, ranked by impact. Reviews without changing anything by default | 3.1g |
| `better-typography` | installed | Type scale, line-height and tracking by role, measure, deliberate wrapping, typographic punctuation | 3.2 |
| `better-es-ar` | installed | Argentine Spanish formats and punctuation. Its default is "vos", with "usted" only when the client uses it. **The client's own site uses "usted"** ("¿Quiere ser parte del equipo?", "Envíenos su C.V."), so "usted" stays | 3.2 |
| `better-writing` | installed | One vocabulary, buttons that start with a verb, links that name where they go | 3.2 |
| `better-accessibility` | installed | WCAG 2.2: focus, keyboard, hit areas, motion and zoom | 3.3 |
| `web-perf` | installed (Cloudflare plugin) | Core Web Vitals method. It expects the Chrome DevTools MCP, which isn't connected here, so the same measurements will run through `scripts/cdp.mjs` | 3.4 |
| `frontend-design` | public, [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design), read only | Restraint: one orchestrated moment rather than a fade on every section, and boldness spent in one place ("remove one accessory"). A list of the usual signs of a generated page | 3.1d, 3.1g |
| `scroll-animations`, `css-native` | community, [dylantarre/animation-principles](https://github.com/dylantarre/animation-principles) (MIT), read only | Scroll reveals start at 10–20 % visibility, run in reading order, stagger siblings and settle with ease-out. Never hijack scrolling | 3.1d |
| `scrollytelling` | community, [doodledood/claude-code-plugins](https://github.com/doodledood/claude-code-plugins), read only | Side-by-side sticky graphic (Áreas already does this with CSS `sticky`), restraint over spectacle, at most one subtle parallax with a reduced-motion fallback | 3.1d |

Also seen in directories but not read, because they overlap the above: `design-animate` (skills-hub.ai), `css-animation-creator` (onewave-ai), `web-animation-design` (skills.sh).

## Touches to try (each is kept only if it clearly helps, with a screenshot to prove it)

For 3.1d (motion):
1. **One orchestrated moment.** The hero intro and the bar folding into two squares are the signature. Fade-ins on every section are the generic default (frontend-design). Try reveals only where they mean something: figures, the large headings and the footer wordmark. Body text and labels would be visible at once.
2. **Stagger in reading order.** Sibling groups such as partner rows, the three office plates and the two practice-area lists would enter one after another (about 100 ms, or a shifted `animation-range` for scroll-linked reveals), not all at once.
3. **Ease-out settle.** The reveals map scroll to progress linearly. Give the keyframes an ease-out so content settles rather than sliding at constant speed.
4. **Menu enter and exit.** The phone menu popover could fade and rise in with `@starting-style`, and leave shorter and smaller than it entered (better-ui). CSS only, nothing added to the JS budget.
5. **Press feedback.** The CV button and menu button get `scale(0.96)` on `:active` as a transition, never a keyframe.
6. **At most one parallax.** Maybe a slow drift on Fig. 01 or one office plate, gated behind reduced motion. Likely rejected if it reads as decoration.

For 3.1g (whole page): look in the mirror and remove one accessory. The construction lines, the crop marks, the ruler, the mono captions and the grain are all quiet decorations; check that together they aren't one too many.

## Considered and turned down

- **Installing the community skills.** Third-party code in `~/.claude`, so a supply-chain risk, against the rule to read third-party repos over HTTP. Their useful content is captured above.
- **GSAP, Lenis or any smooth-scroll library.** It would break the JS budget (one module, 1 KB or less) and the strict-CSP plan. Smooth scrolling also takes over the reader's scroll. Native scroll-driven CSS already covers what's needed.
- **Disney-style squash, stretch, bounce and wiggle** (css-native). The wrong register for a law firm founded in 1946.
- **IntersectionObserver reveal scripts.** The site reveals with CSS `animation-timeline: view()` and no JS. Browsers without it simply show everything.
- **Layered parallax and moviescroller sequences** (scrollytelling). They can trigger vestibular symptoms, and there's nothing in the content for them to narrate.

## Where the brief wins over `frontend-design`

`frontend-design` names these as signs of a generated page: a tracked caps label above each heading, 01–04 section numbers, mono data labels, "A · B · C" meta strings, "Fig. 03 — X" labels and hairline rules. Here they come from the brief itself, oldtomcapital.com and the mockup, and the skill says the brief's own words win. They stay. 3.1g checks that each one carries information (the numbers are the reading order of the page; the figure labels index real images).
