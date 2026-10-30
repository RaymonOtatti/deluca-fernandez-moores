// The web app manifest (8.4), built from the same source as the <head> (site.ts). Desktop Chrome and Edge
// don't let a page colour their bars, but an installed app's title bar takes theme_color, and Android's
// splash screen background_color: both the brand green. "browser" (8.9): Franco found Chrome's install offer
// odd for a firm's site, and only an app display mode ("minimal-ui" before) makes Chrome offer one.
// The icons are design/icon.html shot at 192 and 512 (like apple-touch-icon.png); "any", not "maskable":
// the monogram fills 88 % of the square, past a mask's safe zone.
import type { APIRoute } from 'astro';
import { site } from '../content/site.ts';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: site.name,
      short_name: site.shortName,
      description: site.description,
      lang: site.lang,
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'browser',
      theme_color: site.themeColor,
      background_color: site.themeColor,
      icons: [192, 512].map((n) => ({ src: `/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })),
    }),
  );
