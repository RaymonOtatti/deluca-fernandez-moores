// 8.5k2b: measure decoded sRGB, retaining the renders' 16 bits on the requested 0–255 scale.
// node design/blender/polish/measure.mjs image.png [image.png ...]
// node design/blender/polish/measure.mjs --diff first.png last.png
// node design/blender/polish/measure.mjs --boards
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const sharp = createRequire('/Users/francomichetti/dev/web/svya/package.json')('sharp');
const here = dirname(fileURLToPath(import.meta.url));
const regions = {
  shade: [60, 150, 120, 80], centre: [260, 150, 80, 80],
  topRight: [470, 30, 100, 80], bottomRight: [470, 280, 100, 80],
};
async function read(path, small = false) {
  let pipeline = sharp(path).removeAlpha();
  if (small) pipeline = pipeline.resize(600, 375, { fit: 'fill' });
  const { data, info } = await pipeline.toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
  return { values: new Uint16Array(data.buffer, data.byteOffset, data.length / 2), ...info };
}
async function measure(path) {
  const { values, width, channels } = await read(path, true);
  const result = {};
  for (const [name, [x, y, w, h]] of Object.entries(regions)) {
    const sum = [0, 0, 0];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      for (let c = 0; c < 3; c++) sum[c] += values[(yy * width + xx) * channels + c] / 257;
    }
    result[name] = sum.map(v => +(v / (w * h)).toFixed(3));
  }
  return { path, ...result };
}
const label = (text, width) => Buffer.from(`<svg width="${width}" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#151a12"/><text x="16" y="24" font-family="Helvetica,Arial,sans-serif" font-size="16" fill="#e9e5d9">${text}</text></svg>`);
async function boards() {
  const times = ['0', '0.6', '1.2', '2.0', '3.2', '4.8'];
  const frames = [];
  for (const [i, t] of times.entries()) {
    frames.push({ input: await sharp(join(here, `v-t${t}.png`)).resize(600, 375).toBuffer(), left: i * 600, top: 36 });
    frames.push({ input: label(`Velo, real · ${t} s${i > 0 && i < 5 ? ' · 180°' : ' · rest'}`, 600), left: i * 600, top: 0 });
  }
  await sharp({ create: { width: 3600, height: 411, channels: 3, background: '#151a12' } }).composite(frames).png().toFile(join(here, 'v-gust.png'));
  const pair = [];
  for (const [i, [file, title]] of [
    [join(here, '../ref/take-a-still.jpg'), 'A · Velo · approved reference'],
    [join(here, 'v-still.png'), 'V · Velo, real'],
  ].entries()) {
    pair.push({ input: await sharp(file).resize(1200, 750).toBuffer(), left: i * 1200, top: 36 });
    pair.push({ input: label(title, 1200), left: i * 1200, top: 0 });
  }
  await sharp({ create: { width: 2400, height: 786, channels: 3, background: '#151a12' } }).composite(pair).png().toFile(join(here, 'a-vs-v.png'));
}
const args = process.argv.slice(2);
if (args[0] === '--boards') {
  await boards();
} else if (args[0] === '--diff' || args[0] === '--gust') {
  const [a, b] = await Promise.all(args.slice(1, 3).map(p => read(p, args[0] === '--gust')));
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) throw new Error('Dimensions differ');
  let max = 0, sum = 0, count = 0;
  for (let i = 0; i < a.values.length; i++) {
    if (args[0] === '--gust' && Math.floor(i / a.channels) % a.width < 400) continue;
    count++;
    const d = Math.abs(a.values[i] - b.values[i]) / 257;
    max = Math.max(max, d);
    sum += d;
  }
  const mean = sum / count;
  const pass = args[0] === '--gust' ? mean >= 3 && mean <= 8 : max <= 2;
  console.log(JSON.stringify({ maxChannelDifference: max, meanAbsoluteDifference: mean, pass }, null, 2));
  if (!pass) process.exitCode = 1;
} else {
  if (!args.length) throw new Error('Provide one or more image paths, --diff first last, or --boards');
  for (const path of args) console.log(JSON.stringify(await measure(path)));
}
