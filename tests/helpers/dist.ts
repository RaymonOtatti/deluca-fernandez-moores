// Reads the built site in dist/ for output tests.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

export function files(dir = DIST, ext?: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p, ext);
    return !ext || p.endsWith(ext) ? [p] : [];
  });
}

export const read = (p: string) => readFileSync(p, 'utf8');
export const rel = (p: string) => relative(DIST, p);
export const bytes = (paths: string[]) => paths.reduce((n, p) => n + statSync(p).size, 0);

// Every <tag ...> opening tag with its attributes, e.g. tags(html, 'img').
export function tags(html: string, name: string): Array<Record<string, string>> {
  const re = new RegExp(`<${name}\\b([^>]*)>`, 'gi');
  return [...html.matchAll(re)].map((m) => {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    return attrs;
  });
}
