import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { shortenScopes } from './scripts/shorten-scopes.mjs';

// Canonical production domain; may be overridden for a separate preview deployment.
const SITE = process.env.SITE_URL ?? 'https://delucafmoores.com.ar';
const BASE = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  // One cached stylesheet and no inline styles or scripts: the CSP stays strict (3.5).
  build: { format: 'directory', inlineStylesheets: 'never' },
  // cssCodeSplit off: one stylesheet for every page, so the 404 page doesn't split it in two (3.5)
  vite: { build: { assetsInlineLimit: 0, cssCodeSplit: false } },
  // Scope component styles with a class (.astro-xxxx) rather than an attribute ([data-astro-cid-xxxx]):
  // the same specificity, about 2.6 KB less CSS (7.8)
  scopedStyleStrategy: 'class',
  // 8.5c: Astro's scope names, shortened after the build; the tests read the result.
  integrations: [{ name: 'svya-short-scopes', hooks: { 'astro:build:done': ({ dir }) => shortenScopes(fileURLToPath(dir)) } }],
  devToolbar: { enabled: false },
});
