import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deliveryDecision } from './report-delivery';
import { findOpenBrackets, isOpenBracket, isReviewNote, PLACEHOLDER_BRACKET_SRC, PLACEHOLDER_CODE_SRC, PLACEHOLDER_NOTE_SRC, PLACEHOLDER_NOT_GAP_SRC } from './placeholders';

// A-13 (2026-10-17): exec 771's delivered body, cut to the sentence the engine and the view both missed
const BODY771 = 'For example, a three-entity group on a legacy ERP pays a fixed [Price band: typical Assess & Envision fee in AED]. See [the law](https://u.ae/x) and ![hero](hero.webp).';

describe('A-13, one detector for every bracket left for a person', () => {
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

  // the engine's kit lives outside app/: present in a repo checkout, absent in the app-only test container and the production image
  // (build_v4.py section 130 asserts the same equality from the engine side, so the check is never lost)
  const KIT = join(__dirname, '../../../n8n/seo-agent/v5/code/_placeholders.js');
  it.skipIf(!existsSync(KIT))('is the engine\'s own pattern, character for character (build_v4.py section 130 asserts the same)', () => {
    const kit = readFileSync(KIT, 'utf8');
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

// CT-FIX (2026-10-22, independent review item 11): code, edit labels and "[sic]" are not gaps; an Arabic placeholder is one
describe('CT-FIX, brackets that are not gaps and gaps in another script', () => {
  it('reads code as code: an index in inline or fenced code is not a placeholder', () => {
    expect(findOpenBrackets('Set `labels[sensitivity]` first.\n\n```\nrows[index] = value\n```\n')).toEqual([]);
  });
  it('leaves an edit label and an editor\'s [sic] alone, but still counts a real gap beside them', () => {
    const b = findOpenBrackets('[Updated 2026] The FTA said "recieve" [sic]. Call [Phone number].');
    expect(b).toEqual([{ token: '[Phone number]', count: 1, kind: 'placeholder' }]);
    expect(isOpenBracket('Updated 2026')).toBe(false);
    expect(isOpenBracket('Price')).toBe(true);
  });
  it('counts an Arabic placeholder (it passed with 0 before)', () => {
    expect(findOpenBrackets('تبلغ الرسوم [السعر] شهريا.')).toEqual([{ token: '[السعر]', count: 1, kind: 'placeholder' }]);
  });
  it('carries the same four patterns as the engine, character for character', () => {
    const js = join(__dirname, '..', '..', '..', 'n8n', 'seo-agent', 'v5', 'code', '_placeholders.js');
    if (!existsSync(js)) return;
    const src = readFileSync(js, 'utf8');
    for (const [k, v] of [['BRACKET_SRC', PLACEHOLDER_BRACKET_SRC], ['NOTE_SRC', PLACEHOLDER_NOTE_SRC], ['CODE_SRC', PLACEHOLDER_CODE_SRC], ['NOT_GAP_SRC', PLACEHOLDER_NOT_GAP_SRC]]) {
      expect(src).toContain('const ' + k + ' = ' + JSON.stringify(v) + ';');
    }
  });
});
