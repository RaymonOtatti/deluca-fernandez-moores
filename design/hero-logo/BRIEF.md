You are designing ONE option for the hero of a law firm's website: Sáenz Valiente & Asociados (Buenos Aires, founded 1946). Their logo is the SVA monogram. The person deciding wants the logo integrated into the hero: "minimal, clean, keeping the logo's form, nothing weird, just perfection." Other designers are exploring other directions in parallel; stay strictly inside yours.

## Your direction: {{TITLE}}

{{DIRECTION}}

## Files (read them; do not edit them)
- `src/assets/brand/monogram.svg`: the SVA monogram, one path, `viewBox="0 0 581 849"`, `fill="currentColor"`. Use THIS path exactly: copy its `<path>` element (with its `transform`) into your inline SVG. Never redraw, trace, simplify, skew, rotate, stretch or re-letter it; scale it uniformly only.
- `src/assets/brand/lockup.svg`: the monogram with the traced wordmark (`viewBox="0 0 1621 849"`), for reference on how the firm composes mark and name.
- `src/assets/art/fig-01-papel.jpg`: the hero background (2400 × 1500): soft forest-green light falling from the upper right onto paper in shade. Keep it as the full-bleed background, `object-fit: cover`, `object-position: 78% 30%`.
- `src/assets/fonts/ValienteDisplay-Light.woff2`: the firm's display face (capitals and digits only, weight 300), for "SÁENZ VALIENTE".
- `src/assets/fonts/jost-latin-wght-normal.woff2`: Jost (variable, weights 300 to 400), for "& ASOCIADOS" in spaced capitals.
- `src/styles/tokens.css`: the colours. `--paper: #f1ede2` (the mark and the name), `--forest: #2a3220`, `--sage: #a9b09a` (secondary text on green), `--ink: #1d1d1b`.
- `src/components/Hero.astro` and `src/components/Wordmark.astro`: today's hero. The name is centred: "SÁENZ VALIENTE" in Valiente Display, `letter-spacing: 0.08em`, and "& ASOCIADOS" smaller under it, ending where "VALIENTE" ends, in Jost capitals at `0.22em` tracking, in sage.

## Write exactly one file: `design/hero-logo/{{ID}}.html`
- A complete standalone page that renders only the hero, filling the viewport (100vw × 100vh, no scrollbars), with relative paths to the files above (the page sits in `design/hero-logo/`, so `../../src/assets/...`).
- `@font-face` for the two fonts and no others. No JavaScript, no network, no external URLs, no images other than `fig-01-papel.jpg` (the monogram is inline SVG).
- It must look right at 1440 × 900 (desktop) and at 390 × 844 (phone). Use responsive CSS (`clamp()`, `vmin`, media queries) so proportions and spacing hold at both. Nothing may touch the edges or be clipped.
- A short comment at the top of the file: the idea in two sentences, and the sizes you chose and why.
- Restraint: one idea, executed precisely. No glows, shadows, gradients on the mark, textures, borders, frames, animation or decoration. Use optical centring where geometric centring looks off (the monogram's visual weight is not even inside its box; look at the path and compensate if needed). The firm's full name must still appear in the hero as live text.
- Quality bar: this is a pitch to a 75-year-old law firm. Quiet, exact, expensive-looking. If in doubt, smaller and calmer.

Do not run any build, install or network command. Do not edit any other file. When done, reply with the file path and the two-sentence idea.
