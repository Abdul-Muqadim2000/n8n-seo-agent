import { randomUUID } from 'node:crypto';
import { extractFiles, shownFileKind, type ExtractedFile } from './files';

// W0-G (2026-10-29, n8n/seo-agent/docs/page-quality-2026-10-29/PLAN.md Fix 7, R4 D8, REVIEW_CODE M7): the final version's downloads. A page
// run delivers the page with files (the HTML / Markdown / meta.json package, a Word file, a PDF and the images); the final version used to
// be stored with none, so the client who answered the questions had nothing to download but the first draft's files. Now its report gets:
//   - the HTML, Markdown and meta.json of the FINAL page (extractFiles, as a callback's text deliverables);
//   - the PDF and the Word file of the final page when the engine returned them (the Finalize workflow's *Attach Final Files*: a PDF only
//     when the renderer made one, never a stub);
//   - copies of the first version's images (the final version changes text, never the pictures), with the payload's image references
//     pointing at the copies, so the downloads and the CMS publishing of the final version use its own rows.
// The first draft's PDF and Word file are never carried over: they show the first draft and its grade, not this version.

type P = Record<string, unknown>;
const obj = (v: unknown): P => (v && typeof v === 'object' && !Array.isArray(v) ? (v as P) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A stored file row of the original report (the columns the copy needs). */
export interface StoredFileRow {
  id: string;
  field: string;
  kind: string;
  fileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

/** The largest engine document stored (the files table takes 15 MB per file; a page's PDF is a few hundred KB). */
export const FINAL_FILE_MAX_BYTES = 15 * 1024 * 1024;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** One document the engine returned: base64 bytes of a sane size, a PDF only when it is one. Anything else is left out. */
export function engineDocument(v: unknown, kind: 'pdf' | 'word'): { data: string; fileName: string; mimeType: string } | null {
  const o = obj(v);
  const data = str(o.data).replace(/\s+/g, '');
  if (data.length < 8 || !B64.test(data)) return null;
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes > FINAL_FILE_MAX_BYTES) return null;
  const buf = Buffer.from(data.slice(0, 16), 'base64');
  if (kind === 'pdf' && (bytes < 200 || buf.subarray(0, 5).toString('latin1') !== '%PDF-')) return null;
  const ext = kind === 'pdf' ? '.pdf' : '.doc';
  const base = str(o.fileName).replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120) || 'page-final';
  return { data, fileName: base + ext, mimeType: kind === 'pdf' ? 'application/pdf' : 'application/msword' };
}

/** Is this stored file one of the page's images? (rows stored before `image` existed say `other`, D-13) */
export const isImageRow = (f: Pick<StoredFileRow, 'kind' | 'fileName' | 'mimeType' | 'field'>): boolean =>
  shownFileKind(f) === 'image' || /^images\[\d+\]$/.test(f.field);

/**
 * The final version's payload and files (pure). `payload` is the final report payload (finalReportPayload), `engineFiles` the answer's
 * `files` ({ pdf, word, pdf_missing } or absent from an older engine), `originalFiles` the original report's stored rows.
 */
export function finalVersionFiles(payload: P, engineFiles: unknown, originalFiles: readonly StoredFileRow[]): { payload: P; files: ExtractedFile[] } {
  const { pdf: _firstPdf, file: _firstWord, images: images0, ...rest } = payload;
  const ef = obj(engineFiles);
  const pdf = engineDocument(ef.pdf, 'pdf');
  const word = engineDocument(ef.word, 'word');
  const withDocs: P = { ...rest, pdf, file: word };
  const { payload: clean, files } = extractFiles(withDocs);
  // the first version's images, copied onto the final version (a new row each: the final version keeps them if the first is deleted)
  const copies = originalFiles.filter(isImageRow).map((f) => ({ from: f, row: { id: randomUUID(), kind: 'image' as const, fileName: f.fileName, mimeType: f.mimeType, size: f.size, field: f.field, data: f.data } }));
  const used = new Set<string>();
  const pick = (ref: P) => {
    const id = str(ref.$file);
    const name = str(ref.fileName);
    const c = copies.find((x) => !used.has(x.row.id) && id && x.from.id === id) ?? copies.find((x) => !used.has(x.row.id) && name && x.from.fileName === name);
    if (c) used.add(c.row.id);
    return c ?? null;
  };
  let images: unknown = images0 ?? null;
  if (Array.isArray(images0)) {
    images = images0.map((x) => {
      const ref = obj(x);
      const c = pick(ref);
      if (c) return { ...ref, $file: c.row.id, fileName: c.row.fileName, mimeType: c.row.mimeType, size: c.row.size };
      // a reference to a file this version does not hold is dropped (the plan entry stays, so a CMS still knows the file to add)
      const { $file: _gone, ...keep } = ref;
      return keep;
    });
  } else if (copies.length) {
    images = copies.map((c) => ({ $file: c.row.id, fileName: c.row.fileName, mimeType: c.row.mimeType, size: c.row.size }));
  }
  const out: P = { ...clean, images };
  if (!pdf) delete out.pdf;
  if (!word) delete out.file;
  const missing = str(ef.pdf_missing).trim();
  if (!pdf && missing) out.pdf_missing = missing.slice(0, 200);
  return { payload: out, files: [...files, ...copies.map((c) => c.row)] };
}
