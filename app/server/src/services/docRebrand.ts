import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { rebrandText } from '@seo/shared';

/**
 * G5 (WHITE_LABEL.md §6): a document the engine produced, as a white-label client person gets it, the engine's report brand and our
 * own name replaced by the agency's product name. Word files and zips are rewritten entry by entry (a small ZIP reader / writer:
 * stored and deflated entries, no ZIP64, no encryption, anything else is returned unchanged and flagged); HTML / Markdown / text /
 * CSV / JSON as text. **PDF is never rewritten** (its text is glyph-encoded inside compressed streams): `pdf` answers `rewritable:
 * false` and the portal offers the branded print view instead.
 */

export type RebrandKind = 'pdf' | 'docx' | 'doc' | 'html' | 'md' | 'json' | 'zip' | 'csv' | 'txt' | 'image' | 'other';
export interface Rebranded {
  data: Buffer;
  /** false: this kind cannot be rewritten safely (PDF, old .doc, an unreadable zip), do not serve it to a white-label client */
  rewritable: boolean;
  changed: boolean;
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** text-like zip entries (Word's XML parts, the fix pack's robots.txt / llms.txt / CSV / JSON / HTML) */
const TEXT_ENTRY = /\.(xml|rels|txt|md|csv|json|html?|xhtml|yml|yaml)$/i;

// ---- CRC-32 (the zip checksum) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** reads a zip's entries; null for anything it does not handle (ZIP64, encryption, other compression, damage) */
export function readZip(zip: Buffer): ZipEntry[] | null {
  try {
    let eocd = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 65535); i--) {
      if (zip.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;
    const count = zip.readUInt16LE(eocd + 10);
    let p = zip.readUInt32LE(eocd + 16);
    if (count === 0xffff || p === 0xffffffff) return null;
    const out: ZipEntry[] = [];
    for (let n = 0; n < count; n++) {
      if (zip.readUInt32LE(p) !== 0x02014b50) return null;
      const flags = zip.readUInt16LE(p + 8);
      const method = zip.readUInt16LE(p + 10);
      const csize = zip.readUInt32LE(p + 20);
      const nameLen = zip.readUInt16LE(p + 28);
      const extraLen = zip.readUInt16LE(p + 30);
      const commentLen = zip.readUInt16LE(p + 32);
      const local = zip.readUInt32LE(p + 42);
      const name = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
      if (flags & 1 || csize === 0xffffffff || local === 0xffffffff) return null;
      if (zip.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const raw = zip.subarray(start, start + csize);
      const data = method === 0 ? Buffer.from(raw) : method === 8 ? inflateRawSync(raw) : null;
      if (!data) return null;
      out.push({ name, data });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  } catch {
    return null;
  }
}

/** writes entries as a zip (deflated, UTF-8 names, a fixed timestamp) */
export function writeZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // 1980-01-01 00:00 in DOS time: the same bytes for the same content
  const dosTime = 0;
  const dosDate = (0 << 9) | (1 << 5) | 1;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const comp = deflateRawSync(e.data);
    const crc = crc32(e.data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

function rebrandEntry(name: string, data: Buffer, from: string[], to: string): Buffer {
  if (!TEXT_ENTRY.test(name)) return data;
  const s = data.toString('utf8');
  const esc = /\.(xml|rels|html?|xhtml)$/i.test(name) ? (/\.html?$/i.test(name) ? htmlEsc(to) : xmlEsc(to)) : to;
  const r = rebrandText(s, from, esc);
  return r === s ? data : Buffer.from(r, 'utf8');
}

/** the document as a white-label client gets it (`from`: the names to replace, `to`: the agency's product name) */
export function rebrandDocument(kind: RebrandKind | string, raw: Buffer | Uint8Array, from: string[], to: string): Rebranded {
  // the database driver may hand bytea back as a plain Uint8Array
  const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  if (kind === 'pdf' || kind === 'doc') return { data, rewritable: false, changed: false };
  if (kind === 'image') return { data, rewritable: true, changed: false };
  if (kind === 'docx' || kind === 'zip') {
    const entries = readZip(data);
    if (!entries) return { data, rewritable: false, changed: false };
    let changed = false;
    const next = entries.map((e) => {
      const d = rebrandEntry(e.name, e.data, from, to);
      if (d !== e.data) changed = true;
      return { name: e.name, data: d };
    });
    return changed ? { data: writeZip(next), rewritable: true, changed } : { data, rewritable: true, changed: false };
  }
  if (['html', 'md', 'json', 'csv', 'txt'].includes(kind)) {
    const s = data.toString('utf8');
    const r = rebrandText(s, from, kind === 'html' ? htmlEsc(to) : to);
    return r === s ? { data, rewritable: true, changed: false } : { data: Buffer.from(r, 'utf8'), rewritable: true, changed: true };
  }
  // anything else ("other": an SVG, an unknown binary) is not something we can vouch for
  return { data, rewritable: false, changed: false };
}
