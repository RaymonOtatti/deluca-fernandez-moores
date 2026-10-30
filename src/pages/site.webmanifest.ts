import type { APIRoute } from 'astro';
import { site } from '../content/site.ts';

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;
  return new Response(
    JSON.stringify({
      name: site.name,
      short_name: site.shortName,
      description: site.description,
      lang: site.lang,
      dir: 'ltr',
      start_url: base,
      scope: base,
      display: 'browser',
      theme_color: site.themeColor,
      background_color: site.themeColor,
      icons: [192, 512].map((n) => ({ src: `${base}icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })),
    }),
  );
};
