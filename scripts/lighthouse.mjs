// Lighthouse at checkpoints (not in `pnpm test`: it's slow and fetches Lighthouse once through npx).
//   node scripts/lighthouse.mjs                 → builds nothing; serves dist/ locally and audits it
//   node scripts/lighthouse.mjs https://…       → audits a live URL (the deploy check in 4.2)
// Enforces: Performance, Accessibility, Best practices and SEO ≥ 95 on mobile and desktop, and
// mobile LCP < 1.5 s. While the page is noindex (a pitch), SEO skips only the is-crawlable audit.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { serve } from './serve.mjs';

// Async on purpose: the local server runs in this process, so a sync exec would block it and
// Lighthouse would wait forever for the page
const run = promisify(execFile);

const LIGHTHOUSE = 'lighthouse@12.8.2';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIN_SCORE = 95;
const MAX_MOBILE_LCP_MS = 1500;

const target = process.argv[2];
const server = target ? null : await serve(4331);
const url = target ?? 'http://127.0.0.1:4331/';
const out = mkdtempSync(join(tmpdir(), 'svya-lh-'));
const failures = [];

try {
  for (const preset of ['mobile', 'desktop']) {
    const file = join(out, `${preset}.json`);
    const html = await (await fetch(url)).text();
    const noindex = /<meta[^>]+name="robots"[^>]+noindex/.test(html);
    await run('npx', ['--yes', LIGHTHOUSE, url, '--quiet', '--chrome-flags=--headless=new', '--output=json', `--output-path=${file}`,
      '--only-categories=performance,accessibility,best-practices,seo', ...(preset === 'desktop' ? ['--preset=desktop'] : []),
      ...(noindex ? ['--skip-audits=is-crawlable'] : [])], { env: { ...process.env, CHROME_PATH: CHROME }, maxBuffer: 64 * 1024 * 1024 });
    const r = JSON.parse(readFileSync(file, 'utf8'));
    const scores = Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    const lcp = r.audits['largest-contentful-paint'].numericValue;
    console.log(`${preset.padEnd(7)} ${Object.entries(scores).map(([k, v]) => `${k} ${v}`).join(' · ')} · LCP ${(lcp / 1000).toFixed(2)} s${noindex ? ' (SEO without is-crawlable: page is noindex)' : ''}`);
    for (const [k, v] of Object.entries(scores)) if (v < MIN_SCORE) failures.push(`${preset} ${k} ${v} < ${MIN_SCORE}`);
    if (preset === 'mobile' && lcp >= MAX_MOBILE_LCP_MS) failures.push(`mobile LCP ${Math.round(lcp)} ms ≥ ${MAX_MOBILE_LCP_MS} ms`);
  }
} finally {
  server?.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
