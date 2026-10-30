# SVyA MVP: hand-off and pitch notes (2026-10-22)

**Live:** https://svya-mvp.francomichetti05.workers.dev
- Hidden from search engines until the client approves a launch (`noindex` in the page and in the headers).
- Private repo: https://github.com/onembyte/svya

## Side by side (Lighthouse 12.8.2, mobile, same day, same conditions)

| | svya.com.ar today | The MVP |
|---|---|---|
| Performance | 65 | **100** |
| Accessibility | 79 | **100** |
| Best practices | 96 | **100** |
| SEO | 82 | 100* |
| Largest image on screen (LCP) | 11.4 s | **1.3 s** |
| Downloaded | 4.9 MB in 43 requests | **90 KB in 9 requests** |
| Other companies' servers contacted | 8 | **0** |

\* 66 while the page is deliberately hidden from search; 100 with that one check excluded. At launch it is 100 outright.

## What to say in the pitch

1. **It's fast where their clients are: on a phone.** Their current homepage downloads almost 5 MB. 2.5 MB of that is a background video that is stock footage of Osaka, not Buenos Aires. The new one shows its main image in 1.3 s and weighs 90 KB.
2. **It was built from their own brand.** The art in the hero and the practice-areas section comes from their SVA monogram (a relief in raking light, then light on a wall). The office photos are the real reception, meeting room and open plan, in their own colour.
3. **It says less, better.** About 2,400 words became short lines: one statement, three dates, 18 practice areas, ten partners, one featured deal. Nothing was thrown away: the long texts are kept for partner pages later. The tone is formal "usted" throughout. Their current site mixes "usted" and "vos".
4. **It's built for everyone, and it's private.**
   - It passes the WCAG 2.2 AA accessibility checks we ran: keyboard, screen-reader names, contrast, zoom.
   - It has a strict security policy.
   - It contacts no third party: no Google fonts, no trackers, no external scripts. That's a natural fit for a law firm.
5. **We found real problems on the current site** (tell them privately):
   - their Google Maps API key is visible in the page source, so anyone can bill against it unless it's restricted;
   - the founder's bio is an unfilled template ("Abogado egresado de …………….. XXXXXXX");
   - plain HTTP doesn't redirect to HTTPS;
   - their Google Analytics stopped working in 2024.

## Questions for the client

- The official **vector logo**: the site uses a careful trace of the PNG.
- One line each on the practice of **Eugenia Prieri Belmonte** and **Eduardo Romero**.
- How each partner writes their name, accents included (Sebastián Frabosqui Díaz, Nicolás Novoa, María de los Milagros Páez…).
- Whether the **Exponenciar / Agripay** deal has closed, and its date.
- Whether CVs should still go to `contacto@svya.com.ar`.
- Approval of the condensed lines and the new headline "Dos frentes, un mismo criterio." (`docs/COPY-TO-VALIDATE.md` lists every line and its source).

## To launch on svya.com.ar (once approved)

1. Point `svya.com.ar` at this Worker through Cloudflare. The domain needs to be on Cloudflare (a DNS change on their side), then a custom domain on the Worker.
2. Remove the `noindex`:
   - the `<meta name="robots">` in `src/layouts/Base.astro`;
   - `X-Robots-Tag` in `public/_headers`;
   - the matching tests.

   Then add a sitemap and its line in `robots.txt`, and a canonical link to `https://svya.com.ar/` in `src/layouts/Base.astro`.
   On the domain's Cloudflare zone, turn on Early Hints (Speed > Settings) and send a `Link` preload header for the stylesheet and the two preloaded fonts. Their file names change with every build, so the build has to write that header. On `workers.dev` there is no such setting.
3. Redirect old URLs worth keeping (`cvBollini.pdf`, `images/Brochure.pdf`) with a `_redirects` file.
4. Swap in the vector logo. Later: partner pages from `docs/CONTENT-PARKED.md`.
5. Analytics only if they want it, and privacy-first. Cloudflare Web Analytics needs no cookies; it adds one beacon script, so the CSP would allow its host.

## Updating it

- The words are in `src/content/*.ts`.
- `pnpm test` runs every check: 63 unit, 44 build and 29 browser tests.
- `pnpm lighthouse` gives the scores.
- `pnpm run deploy` publishes, and only after the tests pass.
- History and every decision are in `BUILD-LOG.md`; the design system is in `docs/STYLE.md`.
