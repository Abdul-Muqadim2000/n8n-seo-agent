import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deliveryDecision } from './report-delivery';
import { findOpenBrackets, isReviewNote, PLACEHOLDER_BRACKET_SRC, PLACEHOLDER_NOTE_SRC } from './placeholders';

// A-13 (2026-10-17): exec 771's delivered body, cut to the sentence the engine and the view both missed
const BODY771 = 'For example, a three-entity group on a legacy ERP pays a fixed [Price band: typical Assess & Envision fee in AED]. See [the law](https://u.ae/x) and ![hero](hero.webp).';

describe('A-13 — one detector for every bracket left for a person', () => {
  it('counts the colon bracket the writer invented as a placeholder (exec 771 counted 0)', () => {
    const b = findOpenBrackets(BODY771);
    expect(b).toEqual([{ token: '[Price band: typical Assess & Envision fee in AED]', count: 1, kind: 'placeholder' }]);
  });

  it('keeps links, images, checkboxes, footnotes and numbers out, lower-case gaps in, and the closed list of review notes apart', () => {
    const b = findOpenBrackets('[a link](https://x.y) ![img](a.png) [ ] [x] [1] [^2] [name, role] [date] [Price] [Confirm: AED 5m] [Owner: confirm — we resell] [Author insight: a story] [Image: hero]');
    expect(b.filter((x) => x.kind === 'placeholder').map((x) => x.token).sort()).toEqual(['[Price]', '[date]', '[name, role]']);
    expect(b.filter((x) => x.kind === 'review_note').map((x) => x.token)).toHaveLength(4);
    expect(isReviewNote('[Confirm: AED 5m]')).toBe(true);
    expect(isReviewNote('[Price band: fee]')).toBe(false);
  });

  it('is the engine’s own pattern, character for character (build_v4.py section 130 asserts the same)', () => {
    const kit = readFileSync(join(__dirname, '../../../n8n/seo-agent/v5/code/_placeholders.js'), 'utf8');
    expect(kit).toContain(`const BRACKET_SRC = ${JSON.stringify(PLACEHOLDER_BRACKET_SRC)};`);
    expect(kit).toContain(`const NOTE_SRC = ${JSON.stringify(PLACEHOLDER_NOTE_SRC)};`);
  });

  it('the delivery rule holds a page that still carries one, even when the gate let it through', () => {
    const d = deliveryDecision({ stage: 'content', status: 'completed', payload: { keyword: 'it consulting dubai', qa_publishable: true, markdown: BODY771 } });
    expect(d.code).toBe('not_ready');
    expect(d.reason).toContain('[Price band: typical Assess & Envision fee in AED]');
    const clean = deliveryDecision({ stage: 'content', status: 'completed', payload: { keyword: 'it consulting dubai', qa_publishable: true, markdown: 'All done. See [the law](https://u.ae/x).' } });
    expect(clean.deliver).toBe(true);
  });
});
