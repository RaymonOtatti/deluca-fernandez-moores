// Screenshots through headless Chrome's DevTools protocol (no extra deps).
// Scrolls the page first so scroll-triggered content renders, then captures.
//
//   node scripts/shoot.mjs <url> <outDir> [--widths 1440,390] [--frames] [--wait 2500]
//   node scripts/shoot.mjs <url> <outDir> --widths 1200 --height 630 --out og.png   (exact size, no scroll)
//   --eval "document.getElementById('menu').showPopover()"   runs before an exact-size capture
//   --reduced-motion   emulates prefers-reduced-motion: reduce (full-page captures show every reveal)
//
// Writes <outDir>/<name>-<width>.png (full page) and, with --frames,
// <outDir>/<name>-<width>-fNN.png (one per viewport while scrolling).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './cdp.mjs';

const args = process.argv.slice(2);
const url = args[0];
const outDir = args[1];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
};
const widths = opt('widths', '1440,390').split(',').map(Number);
const frames = args.includes('--frames');
const wait = Number(opt('wait', '2500'));
const fixedHeight = Number(opt('height', '0'));
const outFile = opt('out', '');
const evalJs = opt('eval', '');
const reducedMotion = args.includes('--reduced-motion');
if (!url || !outDir) {
  console.error('usage: node scripts/shoot.mjs <url> <outDir> [--widths 1440,390] [--frames] [--name x]');
  process.exit(1);
}
const name = opt('name', new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home');
mkdirSync(outDir, { recursive: true });

const save = (file, data) => writeFileSync(file, Buffer.from(data, 'base64'));
const browser = await launch({ profileDir: join(outDir, '.chrome-profile') });
const { send, evaluate } = browser;

try {
  for (const width of widths) {
    const { height } = await browser.open(url, { width, height: fixedHeight || undefined, reducedMotion });
    await sleep(wait);

    if (fixedHeight) {
      if (evalJs) { await evaluate(evalJs); await sleep(500); }
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = outFile || join(outDir, `${name}-${width}x${height}.png`);
      save(file, data);
      console.log(`${file}  ${width}×${height}`);
      continue;
    }

    // Scroll a viewport at a time so scroll-triggered animations fire.
    const total = await evaluate('document.documentElement.scrollHeight');
    let f = 0;
    for (let y = 0; y < total; y += Math.round(height * 0.9)) {
      await evaluate(`window.scrollTo(0, ${y})`);
      await sleep(700);
      if (frames) {
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        save(join(outDir, `${name}-${width}-f${String(f++).padStart(2, '0')}.png`), data);
      }
    }
    await evaluate('window.scrollTo(0, 0)');
    await sleep(800);

    const fullHeight = await evaluate('document.documentElement.scrollHeight');
    const { data } = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.min(fullHeight, 16000), scale: 1 },
    });
    save(join(outDir, `${name}-${width}.png`), data);
    console.log(`${name}-${width}.png  ${width}×${fullHeight}${frames ? `  +${f} frames` : ''}`);
  }
} finally {
  browser.close();
}
