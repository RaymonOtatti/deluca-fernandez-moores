// A small reader for TrueType files, enough for the font tests: the table directory, unitsPerEm,
// the cap height and the characters the cmap (format 4) maps.
export interface FontInfo {
  unitsPerEm: number;
  capHeight: number;
  numGlyphs: number;
  family: string;
  chars: Set<number>;
}

export function readTtf(buf: Buffer): FontInfo {
  const numTables = buf.readUInt16BE(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    tables.set(buf.toString('latin1', rec, rec + 4), buf.readUInt32BE(rec + 8));
  }
  const at = (tag: string) => {
    const off = tables.get(tag);
    if (off === undefined) throw new Error(`no ${tag} table`);
    return off;
  };
  const unitsPerEm = buf.readUInt16BE(at('head') + 18);
  const numGlyphs = buf.readUInt16BE(at('maxp') + 4);
  const os2 = at('OS/2');
  const capHeight = buf.readUInt16BE(os2) >= 2 ? buf.readInt16BE(os2 + 88) : 0;

  // name ID 1 (family), Windows Unicode record
  const name = at('name');
  let family = '';
  const count = buf.readUInt16BE(name + 2);
  const strings = name + buf.readUInt16BE(name + 4);
  for (let i = 0; i < count; i++) {
    const r = name + 6 + i * 12;
    if (buf.readUInt16BE(r) === 3 && buf.readUInt16BE(r + 6) === 1) {
      const len = buf.readUInt16BE(r + 8), off = buf.readUInt16BE(r + 10);
      family = buf.subarray(strings + off, strings + off + len).swap16().toString('utf16le');
      break;
    }
  }

  // cmap: the first format 4 subtable
  const cmap = at('cmap');
  const chars = new Set<number>();
  const subtables = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < subtables; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (buf.readUInt16BE(sub) !== 4) continue;
    const segX2 = buf.readUInt16BE(sub + 6);
    const ends = sub + 14, starts = ends + segX2 + 2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(ends + s * 2), start = buf.readUInt16BE(starts + s * 2);
      if (start === 0xffff) continue;
      for (let c = start; c <= end; c++) chars.add(c);
    }
    break;
  }
  return { unitsPerEm, capHeight, numGlyphs, family, chars };
}
