# svya.com.ar: audit (2026-10-21)

Sáenz Valiente & Asociados, business law firm. Founded 1946; the founder's father had opened a practice in 1912. Office: Cnel. Marcelino E. Freyre 3650, Piso 2, Of. 205, C1425, Palermo, Buenos Aires.

## Stack and weight

| | svya.com.ar today |
|---|---|
| Server | Apache, static `index.html` (47 KB), one page with anchors |
| Front end | Bootstrap 3 (149 KB CSS) + animate.css (72 KB) + jQuery (84 KB) + Owl Carousel + Waypoints + Stellar + Modernizr + respond.js |
| Scripts | 12 tags, among them Universal Analytics `UA-143173772-1` (Google shut UA down in 2024, so it collects nothing) and Google Maps |
| Fonts | Google Fonts: Open Sans, Prata, Playfair, plus the Phosphor icon font from unpkg |
| Hero | `images/fondo.gif`: 2.5 MB animated GIF, 1000×563, a stock night aerial of **Osaka** (the Westin sign is visible), not Buenos Aires |
| Copy | about 2,400 words on one page |

## Defects

- **Exposed Google Maps API key** in the HTML (`AIzaSy…`). If it isn't restricted by referrer, anyone can bill against it. Tell the client.
- Plain HTTP serves the full site and doesn't redirect to HTTPS.
- `<html>` has no `lang` attribute. The meta description is just the firm's name. No Open Graph tags.
- The founder's bio modal is a **template that was never filled in**: "Abogado egresado de …………….. en el año ……., cursó un Master / Posgrado …………………. XXXXXXX se incorporó a SV&A en …."
- The CV link points to `cvBollini.pdf` (one person's CV) and `images/Brochure.pdf`.
- Nav items Blog and Publicaciones (Artículos / Newsletter) lead nowhere useful.
- Inconsistent names: "SV&A", "SVyA", "SVA", "Saenz" with and without the accent.
- Commented-out markup (`-->`) leaks as visible text in places.
- Mixed register: "No lo dudes, sumate" (vos) next to "Envíenos su C.V." (usted).

## Content inventory → what the MVP keeps

| Block on the current site | Words | MVP |
|---|---|---|
| Historia (5 paragraphs) | ~420 | Two short lines plus the facts 1912 / 1946 / +40 |
| El Estudio en la actualidad | ~170 | One statement line |
| Áreas: Asesoramiento (19) + Contenciosa (13) | ~200 | Both lists, condensed to short labels |
| Carrera | 20 | Title + CTA (mailto, no form) |
| Equipo: 10 socios, about 30 abogados, of counsel, procuración, administración | ~150 | The 10 current partners: name + one line on their field |
| Partner bios (modals) | ~1,300 | **Parked** in `CONTENT-PARKED.md` for a later partner page |
| Operación destacada (Exponenciar / Agripay) | ~150 | One sentence |
| Contacto: address, two phones, emails, form | | Address, phones, emails. No form in the MVP |
| D&B badge, brochure, Maps | | Dropped (can come back later) |

## Images extracted (`_source/images/`)

| File | Size | Use in the MVP |
|---|---|---|
| `LOGO.png` / `logo_sva.png` | 1657×892, white on transparent | Source for an SVG trace of the monogram and wordmark |
| `img_svya.jpg` | 1350×1350 | Logo in black on the office's wood wall. A real photo of the brand, so it's the best image |
| `img_2.jpg` | 976×1300 | Meeting room with an oval ceiling light. Usable with a strong tone treatment |
| `img_3.jpg` | 1000×750 | Open-plan office facing a green wall of reeds. Usable with a treatment |
| `fondo.gif` | 2.5 MB | Dropped: stock footage of Osaka |
| `duns.png`, favicons | | Dropped; new favicon made from the monogram |

The phone photos have uneven white balance (cyan ceiling light, warm wood). A shared tone treatment (green duotone / desaturated warm) will make them read as one set.
