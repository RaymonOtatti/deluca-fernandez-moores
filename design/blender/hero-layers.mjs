// 8.5k2: the hero's light, from the Blender renders (hero-light.py, take A) to the layers the site uses.
//   node design/blender/hero-layers.mjs <render dir> [--tooth]
// The render dir holds, all 16-bit as Blender wrote them (hero-light.py --take a):
//   still.png, paper.png               2400 × 1500, lit and with --no-sun: the approved take and its paper
//   still-smooth.png, paper-smooth.png the same with --set tooth=0: the light without the paper's grain
//   paper-smooth-small.png, frames/f000.png …   600 × 375, tooth=0: the gust (--time), and its paper
// The smooth light comes from renders without the tooth, not from blurring it out, so the folds' streaks keep
// their edges in the clip (a blur wide enough to lose the grain also softened the streaks and muted the motion).
//
// Writes src/assets/art/hero/:
//   still.jpg       the approved render: the hero image, the LCP, and the rest state
//   paper.jpg       the paper with no sun
//   tooth.jpg       with --tooth only: how the paper's tooth catches the light (grey, multiplied in): the sun's
//                   direction never changes, so the light at any moment is a smooth light times this fixed texture
//   light-rest.png  the smooth light at rest (640 × 400; the browser scales it up)
//   light-av1.mp4, light-h264.mp4   the smooth light through the gust (640 × 400, 24 fps)
// At rest, paper + light (× tooth, with one) = the still (tests/hero-light.test.ts measures it).
import { mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = new URL('../../', import.meta.url).pathname;
const sharp = createRequire(join(ROOT, 'package.json'))('sharp');
const OUT = join(ROOT, 'src/assets/art/hero');
const src = process.argv[2];
if (!src) throw new Error('usage: node design/blender/hero-layers.mjs <render dir>');

const W = 2400, H = 1500, w = 600, h = 375, CW = 640, CH = 400;
const DENOISE = 1.5; // px at 2400: only the renders' own noise; the streaks are tens of pixels wide
const JPEG = { quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true };

// 16-bit PNG → floats on the 0–255 scale, RGB
async function read16(path) {
  // rgb16 keeps the 16 bits: without it sharp hands back 8-bit values in 16-bit words
  const { data, info } = await sharp(path).removeAlpha().toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
  const u16 = new Uint16Array(data.buffer, data.byteOffset, data.length / 2);
  const f = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) f[i] = u16[i] / 257;
  return { f, width: info.width, height: info.height };
}
async function read8(path) {
  const data = await sharp(path).removeAlpha().raw().toBuffer();
  return Float32Array.from(data);
}
const to8 = (f) => Uint8Array.from(f, (v) => Math.max(0, Math.min(255, Math.round(v))));
const raw = (f, width, height, channels = 3) => sharp(Buffer.from(to8(f).buffer), { raw: { width, height, channels } });

// separable Gaussian, per channel
function blur(f, width, height, sigma, channels = 3) {
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += (k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(f.length), out = new Float32Array(f.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * f[(y * width + Math.min(width - 1, Math.max(0, x + i))) * channels + c];
    tmp[(y * width + x) * channels + c] = a;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < channels; c++) {
    let a = 0;
    for (let i = -r; i <= r; i++) a += k[i + r] * tmp[(Math.min(height - 1, Math.max(0, y + i)) * width + x) * channels + c];
    out[(y * width + x) * channels + c] = a;
  }
  return out;
}
const minus = (a, b) => Float32Array.from(a, (v, i) => Math.max(0, v - b[i]));
const lum = (f, i) => 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
// bilinear, in floats (the light is smooth, so sampling at the pixel centres is enough even going down 3.75×,
// once it is blurred)
function resize(f, width, height, toW, toH) {
  const out = new Float32Array(toW * toH * 3);
  for (let y = 0; y < toH; y++) {
    const sy = Math.min(height - 1, Math.max(0, (y + 0.5) * height / toH - 0.5)), y0 = Math.floor(sy), y1 = Math.min(height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < toW; x++) {
      const sx = Math.min(width - 1, Math.max(0, (x + 0.5) * width / toW - 0.5)), x0 = Math.floor(sx), x1 = Math.min(width - 1, x0 + 1), fx = sx - x0;
      for (let c = 0; c < 3; c++) {
        const a = f[(y0 * width + x0) * 3 + c], b = f[(y0 * width + x1) * 3 + c], d = f[(y1 * width + x0) * 3 + c], e = f[(y1 * width + x1) * 3 + c];
        out[(y * toW + x) * 3 + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
      }
    }
  }
  return out;
}

mkdirSync(OUT, { recursive: true });

// 1. the still and the paper, as the site will serve them; everything after works from these decoded JPEGs, so
//    their rounding is in the sum and not an error on top of it
for (const [name, file] of [['still', 'still.png'], ['paper', 'paper.png']]) {
  const { f } = await read16(join(src, file));
  await raw(f, W, H).jpeg(JPEG).toFile(join(OUT, `${name}.jpg`));
}
const still = await read8(join(OUT, 'still.jpg')), paper = await read8(join(OUT, 'paper.jpg'));

// 2. the light at rest, its smooth part, and (with --tooth) the tooth as their ratio, one grey value per pixel. SVyA's
//    take w ships without it (8.6f): on its painted wall the served still keeps no grain in the light (paper + light
//    alone matched better), and Safari at 2× dropped the tooth's multiply past a size, drawing a box on the hero
const withTooth = process.argv.includes('--tooth');
const light = minus(still, paper);
const smooth = blur(minus((await read16(join(src, 'still-smooth.png'))).f, (await read16(join(src, 'paper-smooth.png'))).f), W, H, DENOISE);
let k = 1;
if (withTooth) {
  const ratio = new Float32Array(W * H);
  const lit = [];
  for (let p = 0; p < W * H; p++) {
    const b = lum(smooth, p * 3);
    ratio[p] = b > 0.5 ? lum(light, p * 3) / b : 1;
    if (b > 2) lit.push(ratio[p]);
  }
  lit.sort((a, b) => a - b);
  k = lit[Math.floor(lit.length * 0.999)]; // the brightest grain → white in the tooth image
  // softened to the grain the served still keeps (AVIF drops the finest; measured): sharper costs twice the bytes
  // and only adds a mismatch with the still where the two cross-fade
  const tooth = Float32Array.from(blur(ratio, W, H, 0.8, 1), (v) => Math.min(1, v / k) * 255);
  await raw(tooth, W, H, 1).jpeg({ ...JPEG, chromaSubsampling: '4:2:0' }).toFile(join(OUT, 'tooth.jpg'));
  console.log(`tooth: grain scale k = ${k.toFixed(3)}`);
}

// with a tooth the smooth light carries k, so light × tooth/255 gives back the light; without one, k is 1
const restFull = Float32Array.from(smooth, (v) => v * k);
const rest = resize(restFull, W, H, CW, CH);
await raw(rest, CW, CH).png({ compressionLevel: 9 }).toFile(join(OUT, 'light-rest.png'));

// 3. the gust: each frame's smooth light, as a change from its own rest frame laid on light-rest (the full-size
//    render), so the clip starts and ends exactly on light-rest
const paperSmall = (await read16(join(src, 'paper-smooth-small.png'))).f;
const names = readdirSync(join(src, 'frames')).filter((n) => n.endsWith('.png')).sort();
const frames = mkdtempSync(join(tmpdir(), 'svya-light-'));
const frameLight = async (name) => resize(Float32Array.from(blur(minus((await read16(join(src, 'frames', name))).f, paperSmall), w, h, 0.6), (v) => v * k), w, h, CW, CH);

// The wall stays still (Franco: "background still, light reflecting on it moves"). Where a room's own light
// reaches the shade (take v's bounce off the sunlit floor), the gust would stir it too; so only where the
// curtain's light ever falls during the gust may a pixel move, and everywhere else every frame keeps the rest
// value. A first pass finds that reach: the brightest each pixel gets, against the shade's own level
const first = await frameLight(names[0]);
const reach = new Float32Array(CW * CH);
for (const name of names) {
  const f = await frameLight(name);
  for (let p = 0; p < CW * CH; p++) reach[p] = Math.max(reach[p], lum(f, p * 3));
}
const shade = Float32Array.from(reach).sort()[Math.floor(CW * CH * 0.2)];
const moves = Float32Array.from(reach, (v) => {
  const x = Math.min(1, Math.max(0, (v - (shade * 1.3 + 2)) / 8));
  return x * x * (3 - 2 * x);
});
for (const [i, name] of names.entries()) {
  const big = await frameLight(name);
  const frame = Float32Array.from(big, (v, j) => rest[j] + moves[Math.floor(j / 3)] * (v - first[j]));
  await raw(i === 0 || i === names.length - 1 ? rest : frame, CW, CH).png().toFile(join(frames, `${String(i).padStart(3, '0')}.png`));
}
const input = ['-y', '-v', 'error', '-framerate', '24', '-i', join(frames, '%03d.png'), '-an', '-movflags', '+faststart'];
execFileSync('ffmpeg', [...input, '-c:v', 'libsvtav1', '-preset', '4', '-crf', '34', '-pix_fmt', 'yuv420p10le', '-g', '240', join(OUT, 'light-av1.mp4')]);
// no grain tuning: the light is smooth, and that tuning keeps block noise flickering on the still wall. Full range,
// the matrix tagged: 8-bit limited range left the whole light 1.5 levels dark, near black where it mostly sits.
// CRF 21 (18 until 8.8): measured on 8.8's 7.25 s clip, 46 KB against 69 KB, the same error against the frames
// (0.789 against 0.784 mean squared), no flicker on the shade at either, no banding seen at the page's 2.25× scale
execFileSync('ffmpeg', [...input, '-vf', 'scale=out_color_matrix=bt709:out_range=pc', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '21',
  '-pix_fmt', 'yuv420p', '-color_range', 'pc', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-profile:v', 'high', join(OUT, 'light-h264.mp4')]);
rmSync(frames, { recursive: true });
console.log(`${names.length} frames → light-av1.mp4, light-h264.mp4`);
