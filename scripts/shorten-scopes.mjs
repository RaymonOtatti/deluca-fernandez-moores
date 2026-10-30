import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const kinds = ['.css', '.html', '.js'];
const scope = /astro-[a-z0-9]{8}/g;
const wholeScope = /(?<![\w-])astro-[a-z0-9]{8}(?![\w-])/g;
const shortClass = /(?<![\w-])_[a-z0-9]{1,3}(?![\w-])/;

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function shortenScopes(distDir) {
  const files = filesUnder(distDir)
    .filter((file) => kinds.some((kind) => file.endsWith(kind)))
    .sort((a, b) => kinds.findIndex((kind) => a.endsWith(kind)) - kinds.findIndex((kind) => b.endsWith(kind)) || a.localeCompare(b));
  const contents = files.map((file) => readFileSync(file, 'utf8'));

  // 8.5c: fail before writing if a short scope could collide with a class already in the build.
  for (const content of contents) {
    const classes = content.matchAll(/class="([^"]*)"/g);
    if ([...classes].some((match) => shortClass.test(match[1])) || /\._[a-z0-9]{1,3}(?![\w-])/.test(content)) {
      throw new Error('Short scope class already exists in the build');
    }
  }

  const names = new Map();
  for (const content of contents) {
    for (const match of content.matchAll(scope)) {
      if (!names.has(match[0])) names.set(match[0], '_' + names.size.toString(36));
    }
  }

  let saved = 0;
  for (const [index, file] of files.entries()) {
    const shorter = contents[index].replace(wholeScope, (name) => names.get(name));
    saved += Buffer.byteLength(contents[index]) - Buffer.byteLength(shorter);
    if (shorter !== contents[index]) writeFileSync(file, shorter);
  }
  console.log('Shortened ' + names.size + ' scope names; saved ' + saved + ' bytes');
}
