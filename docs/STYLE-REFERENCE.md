# Style reference: oldtomcapital.com (studied 2026-10-21)

Captured with `scripts/shoot.mjs` (home, /firm, /portfolio at 1440; home at 390). The captures live in `_source/reference/`, which git ignores because they're third-party screenshots for internal use only.

Built on Webflow: Messina Sans + Geist Mono, a JS intro animation, and content that reveals on scroll.

## What makes it feel the way it does

1. **Full-bleed bands of solid color, no cards.** The page runs: dark photo hero → off-white split → photo | forest split → near-black grid → off-white closing statement → dark footer. Each band is one flat color; nothing floats, nothing has a shadow.
2. **Hairlines do the structuring.** 50/50 splits divided by a 1 px vertical rule; stats stacked on the right, separated by 1 px horizontal rules. Rules are 10 to 15 % of the text color.
3. **A drafting and print vocabulary.** Mono figure labels ("FIG. A"), section names set vertically ("THE PLATFORM"), crop marks (`\ | /`) at the corners of the closing statement, thin construction lines drawn over photos (dashed ellipses, connector lines to numbered circles 01–05). It reads like an engineering plate, which is where the "artistic" feeling comes from.
4. **Big, light type with tight leading.** The hero is about 120 px (`clamp` 67→120 px) at a line height of about 0.95, left-aligned at the bottom of the viewport. Headings are sentence case and regular weight, never bold.
5. **Headlines in two tones.** The first line is ink and the rest olive `#726a4f` ("543 Million / U.S. rounds played"). Long paragraphs are also olive, so the eye lands on the ink first.
6. **Photos in black and white with grain**, in heroes and big panels. Color shows only in the portfolio grid (3 columns, tall 2:3, 16 px gutters, name + → above, one grey line under it).
7. **Very little UI.** Nav: a 48 px dark bar, small mark + wordmark on the left, uppercase links at about 11 px with wide tracking on the right. After scrolling it collapses into two 48 px black squares (mark + menu) in the top-right corner. Buttons: stone `#dad6c8` pills, uppercase 11 px tracked, with a small white circle holding an orange arrow.
8. **One pop color**, orange `#f34e30`, used only in tiny doses: the arrow, the active nav dot, the "Spotlight" filter.
9. **Footer:** dark, outline-pill links, and a huge wordmark across the bottom, with © in small type.

## Measured tokens

| Token | Value |
|---|---|
| Ink / nav / footer | `#1c1c17` (warm near-black) |
| Forest panel | `#2a3220` |
| Off-white | `#efede7` |
| Stone (buttons) | `#dad6c8` |
| Olive secondary text | `#726a4f` |
| Pop | `#f34e30` |
| Side padding | 48 / 32 / 24 px (desktop / tablet / mobile) |
| Type sizes | hero 120, h1 80, h2 40, big-p 24, small-p 15, detail 13, button 11 (px) |
| Radius | 0 everywhere except the pill buttons |

The mockup (`docs/mockup-homepage.png`) uses the **same** forest `#2a3220`, ink `#1d1d1b`, off-white `#ededea` and stone `#d9d9d4`. Franco's brief already sits inside this palette.

## For SVyA: take / change / leave

**Take**
- Flat full-bleed bands in ink / off-white / forest, with hairline splits.
- The drafting vocabulary: FIG. captions, vertical section labels, crop marks, construction lines. This is the strongest idea and it fits a law firm (rigor, precision).
- Big, light, tightly leaded headlines; two-tone headlines; secondary text in olive.
- Grainy black-and-white or duotone treatment for the office photos.
- A closing statement centered between crop marks.
- A huge wordmark in the footer.
- The nav that collapses into squares on scroll.

**Change**
- The sunburst motif becomes **the SVA monogram's own geometry**: the long diagonal of the V/A, the S's construction circle, guide lines with measurements. This is the mockup's Fig. 01, so the art comes from their brand, not from Old Tom's.
- Messina Sans becomes **Jost**, because the SVyA wordmark is set in Futura. Geist Mono stays for labels.
- Pill buttons become **square buttons with a 1 px rule**, as in the mockup. Sharp corners match the Futura caps and the Didone S better.
- The orange pop goes. A law firm calls for restraint, so the accent is the forest itself (plus at most a warm brass for one detail; decide in 1.1).

**Leave**
- The long olive paragraphs (Old Tom still has a lot of copy; our brief is titles and short lines).
- The JS intro and count-up animations. Motion stays CSS-only and subtle.
- Color photo grids. SVyA has only three office photos, and they carry one shared treatment.
