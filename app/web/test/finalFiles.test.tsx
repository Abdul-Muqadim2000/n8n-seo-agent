import { describe, expect, it, vi } from 'vitest';
import type { ReportFile } from '@seo/shared';
import { renderReport, report, text } from './renderReport';

// W0-G (2026-10-29, page-quality PLAN Fix 7): the final version of a page shows its own downloads as cards, as the first draft does: the
// page as Word, PDF, HTML and Markdown, its meta.json and the images; a PDF card only when the engine rendered one. Anonymised fixture.

vi.mock('@/components/reports/article', async (orig) => ({ ...(await orig<typeof import('@/components/reports/article')>()), ArticleViewer: () => null }));

const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
const MD = `# MS 365 ERP for UAE businesses\n\nBefore we recommend a product, we run business discovery. ${words}\n`;
const f = (id: string, field: string, kind: ReportFile['kind'], fileName: string, mimeType: string, size: number): ReportFile => ({ id, field, kind, fileName, mimeType, size });
const FILES: ReportFile[] = [
  f('h', 'html', 'html', 'ms-365-erp-uae.html', 'text/html; charset=utf-8', 4200),
  f('m', 'markdown', 'md', 'ms-365-erp-uae.md', 'text/markdown; charset=utf-8', 3100),
  f('j', 'meta', 'json', 'ms-365-erp-uae.meta.json', 'application/json', 900),
  f('p', 'pdf', 'pdf', 'ms-365-erp-uae-final.pdf', 'application/pdf', 182000),
  f('w', 'file', 'doc', 'ms-365-erp-uae-final.doc', 'application/msword', 26000),
  f('i1', 'images[0]', 'image', 'ms-365-erp-uae-hero.webp', 'image/webp', 61000),
  f('i2', 'images[1]', 'image', 'ms-365-erp-uae-choose.webp', 'image/webp', 48000),
];
const final = {
  keyword: 'ms 365 erp',
  markdown: MD,
  html: `<article><h1>MS 365 ERP</h1><p>${words}</p></article>`,
  meta: { title: 'MS 365 ERP in the UAE', slug: 'ms-365-erp-uae', page_type: 'Service Page' },
  qa_delivery_status: 'ready',
  qa_grade: { score: 95, of: 100 },
  qa_blocking: [],
  qa_advisory: [],
  qa_client_questions: [],
  finalized_from: 'rep-0',
};

describe('the final version\'s downloads', () => {
  it('lists the Word file, the PDF, the HTML, the Markdown, the meta.json and the images as download cards', () => {
    const t = text(renderReport(report('content', final, { files: FILES, status: 'completed' })));
    expect(t).toContain('Downloads');
    for (const name of FILES.map((x) => x.fileName)) expect(t).toContain(name);
    expect(t).toMatch(/\bPDF\b/);
    expect(t).toMatch(/\bWord\b/);
  });
  it('shows no PDF card when the engine could not render one', () => {
    const t = text(renderReport(report('content', final, { files: FILES.filter((x) => x.kind !== 'pdf'), status: 'completed' })));
    expect(t).toContain('ms-365-erp-uae-final.doc');
    expect(t).not.toContain('.pdf');
  });
});
