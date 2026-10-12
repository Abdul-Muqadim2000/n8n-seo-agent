import { describe, expect, it } from 'vitest';
import type { Finding } from './data';
import { foldMinor, isMinorFinding, minorFoldNote } from './findings';

const f = (over: Partial<Finding>): Finding => ({
  key: 'k',
  category: 'On-Page',
  severity: 'Low',
  title: 'Something small',
  affectedCount: 1,
  previousCount: null,
  status: 'open',
  impact: 0.6,
  impactBasis: '',
  ...over,
});

// G18-2 (2026-10-12, FIX_PLAN §3.9): the audit's own minor band, mirrored from v5/code/_impact.js, so the app folds exactly the rows the
// report folds. The cases are the ten findings the accuracy set labelled "true, but not worth a customer's time" plus the ones that must
// never fold.
describe('isMinorFinding', () => {
  it('folds the low-impact Low findings the accuracy set called cosmetic', () => {
    expect(isMinorFinding(f({ title: 'Long or messy URLs', impact: 0.6 }))).toBe(true);
    expect(isMinorFinding(f({ title: 'Missing Open Graph tags', impact: 0.9 }))).toBe(true);
    expect(isMinorFinding(f({ title: 'Title shorter than 30 characters', impact: 0.7 }))).toBe(true);
  });

  it('folds the measured low-value rules even where their impact is higher (a nav-heavy page, a title one character over)', () => {
    expect(isMinorFinding(f({ title: 'Too many links on one page', impact: 1.4 }))).toBe(true);
    expect(isMinorFinding(f({ title: 'Title longer than 60 characters', impact: 0.8 }))).toBe(true);
    expect(isMinorFinding(f({ category: 'Content', title: 'Light content (300-500 words)', impact: 0.8 }))).toBe(true);
    // ... but not when they sit on pages that earn real traffic
    expect(isMinorFinding(f({ title: 'Too many links on one page', impact: 4.2 }))).toBe(false);
  });

  it('never folds a Critical, High or Medium finding, whatever its impact', () => {
    expect(isMinorFinding(f({ severity: 'Medium', title: 'Duplicate meta tags on the same page', impact: 2 }))).toBe(false);
    expect(isMinorFinding(f({ severity: 'Medium', title: 'Light content (300-500 words)', impact: 0.2 }))).toBe(false);
    expect(isMinorFinding(f({ severity: 'High', title: 'Missing H1 heading', impact: 0.4 }))).toBe(false);
    expect(isMinorFinding(f({ severity: 'Critical', title: 'Missing title tag', impact: 0.1 }))).toBe(false);
  });

  it('keeps a Low finding that is worth doing in the main list (security headers, llms.txt)', () => {
    expect(isMinorFinding(f({ category: 'Security', title: 'Missing security headers', impact: 1.6 }))).toBe(false);
    expect(isMinorFinding(f({ category: 'AI Search Readiness', title: 'No llms.txt file', impact: 1.6 }))).toBe(false);
  });

  it('an audit written before the impact weight existed folds only by rule, never by a missing number', () => {
    expect(isMinorFinding(f({ title: 'Too many links on one page', impact: null }))).toBe(true);
    expect(isMinorFinding(f({ title: 'Missing Open Graph tags', impact: null }))).toBe(false);
  });
});

describe('foldMinor', () => {
  it('splits a finding list into the list to act on and the folded one, and counts the fold', () => {
    const list = [
      f({ key: 'a', severity: 'High', title: 'Some search and AI crawlers are blocked', impact: 7.8 }),
      f({ key: 'b', severity: 'Low', title: 'Missing security headers', impact: 1.6 }),
      f({ key: 'c', severity: 'Low', title: 'Too many links on one page', impact: 1.4 }),
      f({ key: 'd', severity: 'Low', title: 'Title longer than 60 characters', impact: 0.8 }),
    ];
    const { main, minor, folded } = foldMinor(list);
    expect(main.map((x) => x.key)).toEqual(['a', 'b']);
    expect(minor.map((x) => x.key)).toEqual(['c', 'd']);
    expect(folded).toBe(2);
    expect(minorFoldNote(folded)).toMatch(/^2 minor items are folded into one line/);
    expect(minorFoldNote(1)).toMatch(/^1 minor item is folded/);
    expect(minorFoldNote(0)).toBe('');
  });

  it('nothing is lost: main and minor together are the whole list', () => {
    const list = [f({ key: 'a', impact: 0.2 }), f({ key: 'b', severity: 'Info', impact: 0.4 }), f({ key: 'c', severity: 'High', impact: 9 })];
    const { main, minor } = foldMinor(list);
    expect([...main, ...minor].map((x) => x.key).sort()).toEqual(['a', 'b', 'c']);
  });
});
