import { describe, expect, it } from 'vitest';
import { renderReport, report, text } from './renderReport';

// 2026-10-27 (techand.ai on production): "I published it" no longer marks a page published because its address answers. When the live page
// is not the page that was written, the report says nothing was marked, shows what the page has, and offers the right address or a
// confirmation (never for an address that is already another keyword's page).
const mismatch = {
  status: 'completed',
  keyword: 'ms 365 erp',
  published_url: 'https://www.techand.ai/dynamics-365-business-central-uae',
  content_request_id: '5101',
  live: true,
  recorded: false,
  verified: false,
  verify: 'not_the_draft',
  verify_message: 'This page does not look like the page written for "ms 365 erp". Nothing was marked published. Check the address and send it again. If this is the right page, confirm it.',
  verify_missing: ['the keyword "ms 365 erp" in the title, the main heading or the text'],
  verify_evidence: { title: 'Business Central ERP Solutions in UAE | Tech&', h1: 'Certified Microsoft Dynamics 365 Business Central Partner in UAE', keyword_in_text: 0, used_by: [] },
  confirmable: true,
  stored: true,
  checks: [{ name: 'Page is live (HTTP 200)', ok: true, detail: 'HTTP 200' }],
  passed: 1,
  failed: [],
  summary: 'Not marked published. This page does not look like the page written for "ms 365 erp".',
};

describe('publish check report', () => {
  it('a page that is not the draft: warning, evidence, both buttons, no "Marked as published"', () => {
    const html = renderReport(report('published', mismatch));
    const t = text(html);
    expect(t).toContain('Not marked published yet: check the address');
    expect(t).toContain('Not marked published: this does not look like the page that was written');
    expect(t).toContain('Business Central ERP Solutions in UAE');
    expect(t).toContain('Use the right address');
    expect(t).toContain('It is the right page, mark it published');
    expect(t).not.toContain('Marked as published');
    expect(t).not.toContain('Live and ready to rank');
  });

  it('an address that belongs to another keyword: no confirmation button', () => {
    const t = text(renderReport(report('published', { ...mismatch, verify: 'address_used_by_other_keyword', confirmable: false, verify_evidence: { ...mismatch.verify_evidence, used_by: ['business central erp uae'] } })));
    expect(t).toContain('this address belongs to another keyword');
    expect(t).toContain('Already the page of');
    expect(t).toContain('Use the right address');
    expect(t).not.toContain('It is the right page, mark it published');
  });

  it('confirmed by the owner: marked, not verified, said so', () => {
    const t = text(renderReport(report('published', { ...mismatch, recorded: true, confirmed: true, summary: 'Marked published as you confirmed.' })));
    expect(t).toContain('Marked published on your word');
    expect(t).toContain('Marked as published (not verified)');
    expect(t).not.toContain('Use the right address');
  });

  it('a verified page and an older report read as before', () => {
    const ok = text(renderReport(report('published', { ...mismatch, recorded: true, verified: true, verify: 'ok', verify_message: '', summary: 'Recorded. 1 of 1 checks passed.' })));
    expect(ok).toContain('Live and ready to rank');
    expect(ok).not.toContain('Not marked');
    const { recorded: _r, verify: _v, verified: _f, ...older } = mismatch;
    expect(text(renderReport(report('published', { ...older, summary: 'Recorded.' })))).toContain('Live and ready to rank');
  });
});
