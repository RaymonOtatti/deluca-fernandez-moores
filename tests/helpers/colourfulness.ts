// Hasler & Süsstrunk's colourfulness metric (2003): about 0 for grey or a single tone,
// 15 "slightly", 33 "moderately", 45 "averagely" colourful. Sampled at 96 × 96 for speed.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export async function colourfulness(file: string | URL): Promise<number> {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const data = await sharp(path).resize(96, 96, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const rg: number[] = [];
  const yb: number[] = [];
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    rg.push(r - g);
    yb.push((r + g) / 2 - b);
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const sd = (a: number[], m: number) => Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
  const [mrg, myb] = [mean(rg), mean(yb)];
  return Math.hypot(sd(rg, mrg), sd(yb, myb)) + 0.3 * Math.hypot(mrg, myb);
}
