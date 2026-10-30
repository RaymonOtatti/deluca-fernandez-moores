// Prints an HTML file to PDF with headless Chrome, at the page size its own CSS sets (@page), with its
// backgrounds. Waits for the fonts and every image first, so nothing prints in a fallback face.
//   node scripts/pdf.mjs design/hero-logo/propuesta.html docs/Saenz-Valiente-portada-propuestas.pdf
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: node scripts/pdf.mjs <page.html> <out.pdf>');

const browser = await launch({ port: 9361 });
try {
  // A4 landscape at 96 dpi, so the screen layout matches the page
  await browser.open(pathToFileURL(resolve(src)).href, { width: 1123, height: 794 });
  await browser.evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => null))))');
  await sleep(300);
  const { data } = await browser.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
  const pdf = Buffer.from(data, 'base64');
  writeFileSync(out, pdf);
  console.log(`${out}: ${pdf.length} bytes`);
} finally {
  browser.close();
}
