import { randomUUID } from 'node:crypto';
import type { ReportFile } from '@seo/shared';

// n8n callbacks embed files as { data: <base64>, fileName, mimeType } anywhere in the body (pdf, file, files.prospects_csv, ...).
// They are moved out of the JSON into the files table and replaced by { $file: id, fileName, mimeType, size }.

export interface ExtractedFile extends ReportFile {
  data: Buffer;
}

const B64 = /^[A-Za-z0-9+/=\r\n]+$/;

export function fileKind(fileName: string, mimeType: string): ReportFile['kind'] {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || mimeType.includes('wordprocessingml')) return 'docx';
  if (ext === 'doc' || mimeType === 'application/msword') return 'doc';
  if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') return 'html';
  if (ext === 'md' || mimeType === 'text/markdown') return 'md';
  if (ext === 'json' || mimeType === 'application/json') return 'json';
  if (ext === 'zip' || mimeType.includes('zip')) return 'zip';
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  if (ext === 'txt' || mimeType.startsWith('text/')) return 'txt';
  return 'other';
}

const MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  html: 'text/html; charset=utf-8',
  json: 'application/json',
  csv: 'text/csv; charset=utf-8',
  xml: 'application/xml',
};

function isEmbeddedFile(v: unknown): v is { data: string; fileName?: string; mimeType?: string } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.data === 'string' && o.data.length >= 8 && (typeof o.fileName === 'string' || typeof o.mimeType === 'string') && B64.test(o.data.slice(0, 400));
}

function safeName(name: string, fallback: string): string {
  const n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim();
  return (n || fallback).slice(0, 180);
}

/** Returns the payload without file bytes, plus the files found. Also turns text deliverables into downloadable files. */
export function extractFiles(payload: Record<string, unknown>): { payload: Record<string, unknown>; files: ExtractedFile[] } {
  const files: ExtractedFile[] = [];

  const walk = (v: unknown, path: string, depth: number): unknown => {
    if (depth > 8) return v;
    if (isEmbeddedFile(v)) {
      const data = Buffer.from(v.data.replace(/\s+/g, ''), 'base64');
      if (!data.length) return null;
      // the same file can sit in two places of one callback (backlinks: pdf and files.pdf): store it once
      const dup = files.find((f) => f.size === data.length && f.fileName === (v.fileName ?? f.fileName) && f.data.equals(data));
      if (dup) return { $file: dup.id, fileName: dup.fileName, mimeType: dup.mimeType, size: dup.size };
      const mimeType = v.mimeType || 'application/octet-stream';
      const fileName = safeName(v.fileName ?? '', `${path.replace(/\W+/g, '-')}.bin`);
      const f: ExtractedFile = { id: randomUUID(), kind: fileKind(fileName, mimeType), fileName, mimeType, size: data.length, field: path, data };
      files.push(f);
      return { $file: f.id, fileName: f.fileName, mimeType: f.mimeType, size: f.size };
    }
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`, depth + 1));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, path ? `${path}.${k}` : k, depth + 1);
      return out;
    }
    return v;
  };
  const clean = walk(payload, '', 0) as Record<string, unknown>;

  const addText = (field: string, fileName: string, text: string) => {
    const data = Buffer.from(text, 'utf8');
    const ext = fileName.split('.').pop() ?? 'txt';
    const mimeType = MIME_BY_EXT[ext] ?? 'text/plain; charset=utf-8';
    files.push({ id: randomUUID(), kind: fileKind(fileName, mimeType), fileName, mimeType, size: data.length, field, data });
  };

  // content runs: the blog package (article HTML, Markdown, meta.json) arrives as text fields
  const slug = String((clean.meta as Record<string, unknown> | undefined)?.slug || clean.keyword || (clean.stage === 'site_description' ? `site-description-${clean.domain ?? ''}` : clean.stage) || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  if (typeof clean.html === 'string' && clean.html.length > 50) addText('html', `${slug}.html`, clean.html);
  if (typeof clean.markdown === 'string' && clean.markdown.length > 50) addText('markdown', `${slug}.md`, clean.markdown);
  if (clean.meta && typeof clean.meta === 'object') addText('meta', `${slug}.meta.json`, JSON.stringify(clean.meta, null, 2));

  // audits: the fix pack's files (robots.txt, llms.txt, redirects, schema, internal-links.csv) come as text
  const fp = clean.fix_pack as { files?: { name?: string; content?: string }[] } | undefined;
  if (fp && Array.isArray(fp.files)) {
    fp.files.forEach((f, i) => {
      if (f && typeof f.content === 'string' && f.content.length) addText(`fix_pack.files[${i}]`, safeName(f.name ?? '', `fix-${i}.txt`), f.content);
    });
  }
  // backlinks: the disavow list is also sent as text
  if (typeof clean.disavow_text === 'string' && clean.disavow_text.length > 20 && !files.some((f) => f.field.includes('disavow')))
    addText('disavow_text', 'disavow.txt', clean.disavow_text);

  return { payload: clean, files };
}
