import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageReviewView } from '@seo/shared';
import { engineDocument, finalVersionFiles, type StoredFileRow } from '../src/services/finalFiles';

// W0-G (2026-10-29, page-quality PLAN Fix 7, R4 D8, REVIEW_CODE M7): the final version of a page has its own downloads, as the first
// draft does: the final page as HTML, Markdown and meta.json, the PDF and the Word file when the engine printed them (a PDF only when one
// was rendered), and the first version's images. The first draft's PDF and Word file are never carried over (they show the first draft).
// Client text anonymised (Nova&, novaand-demo.com).

const t = vi.hoisted(() => ({
  finalizeAnswer: null as null | { kind: 'answered' | 'unreachable' | 'timeout'; status: number; json: Record<string, unknown>; error: string | null },
}));
vi.hoisted(() => {
  process.env.APP_URL = 'http://localhost:5173';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.CREDIT_GUARD = 'false';
  process.env.LOG_LEVEL = 'silent';
  process.env.N8N_BASE_URL = 'http://127.0.0.1:9';
  process.env.SEO_API_KEY = 'test-only';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', async () => (await import('./helpers/pg')).pgDbModule());
vi.mock('../src/lib/mailer', async (orig) => ({ ...(await orig<typeof import('../src/lib/mailer')>()), sendMail: vi.fn(async () => true) }));
vi.mock('../src/n8n/client', async (orig) => {
  const real = await orig<typeof import('../src/n8n/client')>();
  return {
    ...real,
    rows: vi.fn(async () => []),
    siteRows: vi.fn(async () => []),
    insertRows: vi.fn(async () => true),
    updateRows: vi.fn(async () => true),
    upsertRow: vi.fn(async () => undefined),
    deleteRows: vi.fn(async () => true),
    ensureTable: vi.fn(async () => 'tbl'),
    invalidateSite: vi.fn(),
    executions: vi.fn(async () => []),
    siteAdmin: vi.fn(async (b: Record<string, unknown>) => ({ ok: true, action: String(b.action), affected: 1, error: null })),
    publishCheckCall: vi.fn(async () => ({ kind: 'answered', status: 200, json: { ok: true, publishable: true, reasons: [] }, error: null })),
    finalizeCall: vi.fn(async () => t.finalizeAnswer ?? { kind: 'unreachable', status: 0, json: {}, error: 'off' }),
  };
});

const { buildApp } = await import('../src/app');
const { db, schema } = await import('../src/db');
const { signUp } = await import('./helpers/client');
vi.setConfig({ testTimeout: 30_000 });

const DAY = 86_400_000;
const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
const MD = `# MS 365 ERP for UAE businesses\n\nA sound selection starts with business discovery. ${words}\n\n## How to choose\n\nCompare the options.\n`;
const FINAL_MD = MD.replace('A sound selection starts with business discovery.', 'Before we recommend a product, we run business discovery in our Assess phase.');
const Q1 = {
  id: 'q1', rank: 1, impact: 0.85, kind: 'process', category: 'service', fact_key: 'service.business_discovery_assess', source: 'claim',
  question: 'Is this true for Nova&? "Before we recommend a product, we run business discovery in our Assess phase."', why: 'Nothing on file says it.',
  original: 'Before we recommend a product, we run business discovery in our Assess phase.', neutral: 'A sound selection starts with business discovery.',
  in_page: 'neutral', section: 'How to choose', answer_type: 'choice', prefill: '', prefill_source: '',
};
const PDF_BYTES = Buffer.from('%PDF-1.7\n' + '1 0 obj << /Type /Catalog >> endobj\n'.repeat(12) + '%%EOF\n', 'latin1');
const WORD_BYTES = Buffer.from('﻿<html xmlns:w="urn:schemas-microsoft-com:office:word"><body><h1>MS 365 ERP</h1></body></html>', 'utf8');
const IMG = (n: number) => Buffer.from(`RIFF....WEBPVP8 image ${n} `.repeat(20), 'latin1');

/** A delivered page run as the callback stored it: its files in the files table, their references in the payload. */
async function setup(n: number) {
  const email = `files${n}@final-files.test`;
  const u = await signUp(app, email);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.email, email));
  const org = (await u.c.post('/api/orgs', { name: `Final Files ${n}` })).body as { id: string };
  await db.update(schema.organizations).set({ creditsEnforced: false, monthlyBudgetUsd: 500 }).where(eq(schema.organizations.id, org.id));
  const [site] = await db
    .insert(schema.sites)
    .values({ orgId: org.id, domain: `novaand-files${n}.com`, country: 'United Arab Emirates', businessFacts: 'Microsoft partner', verificationToken: 't', verifiedAt: new Date(Date.now() - 5 * DAY), trackingStatus: 'none' })
    .returning();
  const ids = { pdf: crypto.randomUUID(), doc: crypto.randomUUID(), img1: crypto.randomUUID(), img2: crypto.randomUUID(), html: crypto.randomUUID() };
  const payload = {
    stage: 'content', keyword: 'ms 365 erp', domain: site!.domain, country: 'United Arab Emirates', request_id: '3298', verdict: 'GO', score: 72,
    markdown: MD, html: `<article><h1>MS 365 ERP</h1><p>${words}</p></article>`,
    meta: { title: 'MS 365 ERP in the UAE', meta_description: 'Microsoft 365, Dynamics 365 and ERP in the UAE: what each one does and how to choose the system your business needs.', slug: 'ms-365-erp-uae', h1: 'MS 365 ERP for UAE businesses', primary_keyword: 'ms 365 erp', page_type: 'Service Page', schema_blocks: [],
      images: [{ filename: 'ms-365-erp-uae-hero.webp', alt_text: 'MS 365 ERP', purpose: 'hero', binary_key: 'image_1' }, { filename: 'ms-365-erp-uae-choose.webp', alt_text: 'How to choose', purpose: 'diagram', binary_key: 'image_2' }] },
    images: [
      { $file: ids.img1, fileName: 'ms-365-erp-uae-hero.webp', mimeType: 'image/webp', size: IMG(1).length, alt_text: 'MS 365 ERP', purpose: 'hero' },
      { $file: ids.img2, fileName: 'ms-365-erp-uae-choose.webp', mimeType: 'image/webp', size: IMG(2).length, alt_text: 'How to choose', purpose: 'diagram' },
    ],
    pdf: { $file: ids.pdf, fileName: 'page-content-ms-365-erp-2026-10-28.pdf', mimeType: 'application/pdf', size: PDF_BYTES.length },
    file: { $file: ids.doc, fileName: 'page-content-ms-365-erp-2026-10-28.doc', mimeType: 'application/msword', size: WORD_BYTES.length },
    qa_delivery_status: 'ready_with_questions', qa_client_questions: [Q1], qa_grade: { score: 88, of: 100 }, qa_blocking: [], qa_advisory: [], qa_publishable: true, qa_not_ready: false,
  };
  const [report] = await db.insert(schema.reports).values({ orgId: org.id, siteId: site!.id, stage: 'content', status: 'completed', title: 'ms 365 erp', requestId: '3298', payload }).returning();
  const row = (id: string, field: string, kind: string, fileName: string, mimeType: string, data: Buffer) => ({ id, orgId: org.id, reportId: report!.id, field, kind, fileName, mimeType, size: data.length, data });
  await db.insert(schema.files).values([
    row(ids.html, 'html', 'html', 'ms-365-erp-uae.html', 'text/html; charset=utf-8', Buffer.from(payload.html)),
    row(ids.pdf, 'pdf', 'pdf', payload.pdf.fileName, 'application/pdf', PDF_BYTES),
    row(ids.doc, 'file', 'doc', payload.file.fileName, 'application/msword', WORD_BYTES),
    // the second image as a row stored before `image` existed (D-13: kind `other`)
    row(ids.img1, 'images[0]', 'image', 'ms-365-erp-uae-hero.webp', 'image/webp', IMG(1)),
    row(ids.img2, 'images[1]', 'other', 'ms-365-erp-uae-choose.webp', 'image/webp', IMG(2)),
  ]);
  return { u, org, site: site!, report: report!, ids, base: `/api/orgs/${org.id}/reports/${report!.id}/review` };
}
const view = (r: { body: unknown }) => r.body as PageReviewView;
async function waitFinal(c: { get: (u: string) => Promise<{ body: unknown }> }, url: string): Promise<PageReviewView> {
  for (let i = 0; i < 60; i++) {
    const v = view(await c.get(url));
    if (v.finalize.status !== 'running') return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('finalize still running');
}
const engine = (files?: Record<string, unknown>) => ({
  kind: 'answered' as const,
  status: 200,
  error: null,
  json: {
    ok: true, request_id: 'x', markdown: FINAL_MD, applied: [{ id: 'q1', how: 'kept_original', section: 's0' }], sections_rewritten: [], changes: [],
    delivery_status: 'ready', delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], next_step: '', grade: { score: 95 } },
    client_questions: [], grade: { score: 95 }, cost: { claude_usd: 0, dfs_usd: 0, estimated: false, model_calls: 0 },
    meta: { title: 'MS 365 ERP in the UAE', meta_description: 'Microsoft 365, Dynamics 365 and ERP in the UAE: what each one does and how to choose the system your business needs.', slug: 'ms-365-erp-uae' },
    ...(files ? { files } : {}),
  },
});
async function finalOf(s: Awaited<ReturnType<typeof setup>>) {
  await s.u.c.put(`${s.base}/answers`, { answers: [{ questionId: 'q1', decision: 'yes' }] });
  await s.u.c.post(`${s.base}/finalize`, {});
  const v = await waitFinal(s.u.c, s.base);
  expect(v.finalize.status).toBe('done');
  const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, v.finalize.reportId!));
  const files = await db.select().from(schema.files).where(eq(schema.files.reportId, rep!.id)).orderBy(asc(schema.files.createdAt));
  const detail = (await s.u.c.get(`/api/orgs/${s.org.id}/reports/${rep!.id}`)).body as { files?: { kind: string; fileName: string; field: string }[] };
  return { rep: rep!, payload: rep!.payload as Record<string, unknown>, files, detail };
}

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  t.finalizeAnswer = null;
});

describe('the final version has its own downloads (PLAN Fix 7)', () => {
  it('HTML, Markdown and meta.json of the final page, the engine\'s PDF and Word file, and copies of the first version\'s images', async () => {
    const s = await setup(1);
    t.finalizeAnswer = engine({
      pdf: { data: PDF_BYTES.toString('base64'), fileName: 'ms-365-erp-uae-final.pdf', mimeType: 'application/pdf' },
      word: { data: WORD_BYTES.toString('base64'), fileName: 'ms-365-erp-uae-final.doc', mimeType: 'application/msword' },
      pdf_missing: '',
    });
    const f = await finalOf(s);
    const byField = Object.fromEntries(f.files.map((x) => [x.field, x]));
    expect(Object.keys(byField).sort()).toEqual(['file', 'html', 'images[0]', 'images[1]', 'markdown', 'meta', 'pdf']);
    // the page files are the FINAL page's, not the first draft's
    expect(Buffer.from(byField.markdown!.data).toString('utf8')).toBe(FINAL_MD);
    expect(Buffer.from(byField.html!.data).toString('utf8')).toContain('Assess phase');
    expect(byField.markdown!.fileName).toBe('ms-365-erp-uae.md');
    expect(JSON.parse(Buffer.from(byField.meta!.data).toString('utf8')).content_score).toBe(95);
    // the engine's PDF and Word file of this version
    expect(byField.pdf).toMatchObject({ kind: 'pdf', fileName: 'ms-365-erp-uae-final.pdf', mimeType: 'application/pdf' });
    expect(Buffer.from(byField.pdf!.data).equals(PDF_BYTES)).toBe(true);
    expect(byField.file).toMatchObject({ kind: 'doc', fileName: 'ms-365-erp-uae-final.doc', mimeType: 'application/msword' });
    // the images are copies (new rows, same bytes), and the payload points at the copies
    expect(byField['images[0]']!.id).not.toBe(s.ids.img1);
    expect(byField['images[1]']).toMatchObject({ kind: 'image', fileName: 'ms-365-erp-uae-choose.webp' });
    expect(Buffer.from(byField['images[1]']!.data).equals(IMG(2))).toBe(true);
    const imgs = f.payload.images as { $file: string; alt_text: string }[];
    expect(imgs.map((x) => x.$file)).toEqual([byField['images[0]']!.id, byField['images[1]']!.id]);
    expect(imgs[0]!.alt_text).toBe('MS 365 ERP');
    // the references in the payload are this version's own; nothing points at the first draft's PDF or Word file
    expect((f.payload.pdf as { $file: string }).$file).toBe(byField.pdf!.id);
    expect((f.payload.file as { $file: string }).$file).toBe(byField.file!.id);
    const text = JSON.stringify(f.payload);
    expect(text).not.toContain(s.ids.pdf);
    expect(text).not.toContain(s.ids.doc);
    expect(text).not.toContain(s.ids.img1);
    expect(text).not.toContain('"data"');
    // the report page lists them as downloads
    expect((f.detail.files ?? []).map((x) => x.kind).sort()).toEqual(['doc', 'html', 'image', 'image', 'json', 'md', 'pdf']);
    // the first version keeps its own files
    const first = await db.select().from(schema.files).where(eq(schema.files.reportId, s.report.id));
    expect(first).toHaveLength(5);
  });

  it('an older engine (no files) or a renderer that failed: the page files and the images, no PDF and no Word file listed', async () => {
    const s = await setup(2);
    t.finalizeAnswer = engine();
    const f = await finalOf(s);
    expect(f.files.map((x) => x.field).sort()).toEqual(['html', 'images[0]', 'images[1]', 'markdown', 'meta']);
    expect(f.payload.pdf).toBeUndefined();
    expect(f.payload.file).toBeUndefined();

    const s2 = await setup(3);
    t.finalizeAnswer = engine({ pdf: null, word: { data: WORD_BYTES.toString('base64'), fileName: 'ms-365-erp-uae-final.doc', mimeType: 'application/msword' }, pdf_missing: 'the PDF renderer did not answer' });
    const f2 = await finalOf(s2);
    expect(f2.files.map((x) => x.kind).sort()).toEqual(['doc', 'html', 'image', 'image', 'json', 'md']);
    expect(f2.payload.pdf_missing).toBe('the PDF renderer did not answer');
  });
});

describe('finalVersionFiles (pure)', () => {
  const rows: StoredFileRow[] = [
    { id: 'p1', field: 'pdf', kind: 'pdf', fileName: 'first.pdf', mimeType: 'application/pdf', size: 3, data: Buffer.from('abc') },
    { id: 'i1', field: 'images[0]', kind: 'image', fileName: 'hero.webp', mimeType: 'image/webp', size: 3, data: Buffer.from('img') },
  ];
  const base = { stage: 'content', keyword: 'k', markdown: MD, html: `<p>${words}</p>`, meta: { slug: 'k-page' }, pdf: { $file: 'p1' }, file: { $file: 'd1' } };

  it('a PDF is listed only when it is one: a stub, an HTML error page or an oversize answer is left out', () => {
    const html = Buffer.from('<html><body>Gateway timeout</body></html>'.repeat(10)).toString('base64');
    for (const pdf of [null, { data: Buffer.from('%PDF-').toString('base64') }, { data: html, fileName: 'x.pdf' }, { data: 'not base64!!' }]) {
      const r = finalVersionFiles(base, { pdf }, []);
      expect(r.files.some((f) => f.kind === 'pdf')).toBe(false);
      expect(r.payload.pdf).toBeUndefined();
    }
    expect(engineDocument({ data: 'A'.repeat(21 * 1024 * 1024) }, 'word')).toBeNull();
    expect(engineDocument({ data: PDF_BYTES.toString('base64'), fileName: '../../etc/passwd.pdf' }, 'pdf')?.fileName).toBe('..-..-etc-passwd.pdf');
  });

  it('images with no list in the payload are still copied; a reference to a file this version does not hold is dropped', () => {
    const r1 = finalVersionFiles(base, {}, rows);
    expect(r1.files.filter((f) => f.kind === 'image')).toHaveLength(1);
    expect((r1.payload.images as { $file: string }[])[0]!.$file).toBe(r1.files.find((f) => f.kind === 'image')!.id);
    const r2 = finalVersionFiles({ ...base, images: [{ $file: 'gone', fileName: 'other.webp', alt_text: 'x' }] }, {}, rows);
    expect(r2.payload.images).toEqual([{ fileName: 'other.webp', alt_text: 'x' }]);
    // the first draft's PDF and Word references never reach the final version
    expect(JSON.stringify(r2.payload)).not.toContain('"p1"');
    expect(JSON.stringify(r2.payload)).not.toContain('"d1"');
  });

  it('a second final version (made from a final version) matches its images by name', () => {
    const r = finalVersionFiles({ ...base, images: [{ $file: 'copy-from-last-final', fileName: 'hero.webp', alt_text: 'Hero' }] }, {}, rows);
    const img = r.files.find((f) => f.kind === 'image')!;
    expect(r.payload.images).toEqual([{ $file: img.id, fileName: 'hero.webp', mimeType: 'image/webp', size: 3, alt_text: 'Hero' }]);
  });
});
