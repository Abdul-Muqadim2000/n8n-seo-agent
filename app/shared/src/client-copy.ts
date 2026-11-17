// What a client may read (CR17-H, client report 2026-11-17 F1). The engine writes some of its working text into fields a client reads: the
// AI-ranking scoring line ("6 cell(s), expected gain 0.0082 over (client time at an hour)"), a lever code in a note ("AI ranking placement
// (L08)"), a data provider's raw answer ("500 - {\"version\":...}"), an arrow in a title. Each was fixed once, on one screen, and came back on
// the next. This file is the one rule for every screen and report the app renders: `clientText` turns a known internal shape into the
// client's words, and `clientTextIssues` names whatever still reads like an internal. The unit test runs every recommendation, site-task
// and report string builder over real production strings through it; the engine has the same guard as harness CR17H + build section 198.
// Pure: no imports with side effects, usable in the server, the web and tests.
import { AI_RANK_SCORE_LINE, aiRankWhyPlain } from './ai-rank-client';

/** One forbidden pattern: an internal shape that must never reach a client. */
export interface ClientCopyRule {
  id: string;
  re: RegExp;
  /** what it is, for the test failure and the build log */
  what: string;
}

/**
 * The patterns. Kept small and specific on purpose: a rule that also matches ordinary English ("expected", "cell phone") would teach people
 * to ignore it. `money` covers the dollar figures of the scoring line and of costs: a client reads credits, never provider dollars.
 */
export const CLIENT_COPY_FORBIDDEN: readonly ClientCopyRule[] = [
  { id: 'cells', re: /\bcell\(s\)|\b\d+\s+cells?\b/i, what: 'the AI-ranking scoring line (cells)' },
  { id: 'expected_gain', re: /\bexpected gain\b/i, what: 'the AI-ranking scoring line (expected gain)' },
  { id: 'client_time', re: /\bclient time\b/i, what: 'an estimate of the client\'s time in money' },
  { id: 'lever_code', re: /\bL(?:0[1-9]|1[0-7])\b/, what: 'an AI-ranking lever code (L01-L17)' },
  { id: 'stage_code', re: /\bS[0-5]\s*(?:->|to)\s*S[0-5]\b/, what: 'an AI-ranking stage code' },
  { id: 'run_id', re: /\b(?:cad|air|aip|ait|lad|aud)_[A-Za-z0-9][A-Za-z0-9_.:-]{3,}/, what: 'an internal run or action id' },
  { id: 'table_name', re: /\bseo_[a-z][a-z_]+/i, what: 'an internal table name' },
  { id: 'raw_json', re: /\{\s*\\?"[A-Za-z_]+\\?"\s*:|\bstatus_code\b|\btasks_error\b/, what: 'raw provider JSON' },
  { id: 'object', re: /\[object Object\]|\bundefined\b|\bNaN\b/, what: 'a value that was never filled in' },
  { id: 'money', re: /(?:US)?\$\s?\d/, what: 'a dollar figure' },
  { id: 'arrow', re: /→/, what: 'an arrow (write "then")' },
  { id: 'dash', re: /[—–]/, what: 'an em or en dash (owner copy rule)' },
  { id: 'curly', re: /[‘’“”]/, what: 'a curly quote (owner copy rule)' },
  { id: 'ellipsis', re: /…|\.\.\./, what: 'an ellipsis (owner copy rule)' },
];

/** The ids of the forbidden patterns a text still contains ([] = fine for a client). */
export function clientTextIssues(v: unknown): string[] {
  const t = typeof v === 'string' ? v : v == null ? '' : String(v);
  return CLIENT_COPY_FORBIDDEN.filter((r) => r.re.test(t)).map((r) => r.id);
}

/** A data provider's answer that is an HTTP dump ("500 - {\"version\"...", a JSON body, a status code) rather than a sentence. */
const PROVIDER_DUMP = /\b\d{3}\s+-\s+["'{\\]|\{\s*\\?"[A-Za-z_]+\\?"\s*:|\bstatus_code\b|\btasks_error\b/;
/** The client's words for a provider answer we could not use (the engine's Collect Research / Ladder Pool / Keyword Strategy write the same). */
export const PROVIDER_ERROR_TEXT = 'could not be read this time (the data provider had an error), so the research used the other sources';

/**
 * One line of a research failure ("keyword ideas for 20 seeds: 500 - {...}") in the client's words: the label kept, the dump replaced. A
 * short message that is already a sentence ("Internal Server Error") is kept.
 */
export function providerErrorText(v: unknown): string {
  const t = (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
  if (!t) return '';
  const i = t.search(PROVIDER_DUMP);
  if (i < 0) return t;
  const label = t.slice(0, i).replace(/[\s:,-]+$/, '').trim();
  return label ? `${label}: ${PROVIDER_ERROR_TEXT}` : `A source ${PROVIDER_ERROR_TEXT}`;
}

/** Old prospect notes the engine wrote before CR17-H ("AI ranking placement (L08)", "...: a contact form only, a manual step"). */
const AIR_NOTE = /^AI ranking placement \(L\d{2}\)/i;
/** The note the engine writes now (AI_Rank_Plan.js, the same words). */
export const AI_RANK_PROSPECT_NOTE = 'Found by AI ranking: AI answers cite this page';

/**
 * Any engine text, made fit for a client. Known internal shapes become the client's words; the copy rules (no em dashes, curly quotes,
 * ellipses or arrows) are applied; whatever else is internal (ids, table names, lever codes) is taken out. `lever` helps the AI-ranking line.
 * An empty string means there is nothing a client should read here (the caller shows its own sentence instead).
 */
export function clientText(v: unknown, opts: { lever?: string } = {}): string {
  let t = (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
  if (!t) return '';
  if (AI_RANK_SCORE_LINE.test(t) && /cell|expected gain|client time/i.test(t)) return aiRankWhyPlain(t, opts.lever);
  if (AIR_NOTE.test(t)) t = AI_RANK_PROSPECT_NOTE + (/contact form/i.test(t) ? '. A contact form only, a manual step: you send it yourself' : '');
  t = t
    .split(/;\s*/)
    .map((part) => (PROVIDER_DUMP.test(part) ? providerErrorText(part) : part))
    .join('; ');
  return t
    .replace(/^AI ranking \(L\d{2}\):\s*/i, '')
    .replace(/\s*\((?:L(?:0[1-9]|1[0-7]))\)/g, '')
    .replace(/\bL(?:0[1-9]|1[0-7])\b\s*/g, '')
    .replace(/\b(?:cad|air|aip|ait|lad|aud)_[A-Za-z0-9][A-Za-z0-9_.:-]{3,}/g, '')
    .replace(/\bseo_[a-z][a-z_]+/gi, 'our records')
    .replace(/\s*→\s*/g, ', then ')
    .replace(/\s+[—–]\s+/g, ': ')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s*(?:…|\.\.\.)\s*/g, ' ')
    .replace(/\[object Object\]|\bundefined\b|\bNaN\b/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * A title of at most `max` characters that never ends mid-sentence (client report 2026-11-17: "...in Search Console (URL inspection →
 * Request indexing) and link to it from" was a High item's whole title). It ends at the last sentence or clause end that fits; whatever is
 * left goes to `rest`, which the caller puts first in the detail, so nothing is lost. No ellipsis (copy rule).
 */
export function splitTitle(v: unknown, max = 140): { title: string; rest: string } {
  const t = clientText(v);
  if (t.length <= max) return { title: t, rest: '' };
  const head = t.slice(0, max);
  // the last place a sentence or a clause ends inside the limit, but not so early that the title says nothing
  const ends = [...head.matchAll(/[.;:!?](?=\s)|,(?=\s)|\s\((?=[^)]*$)|\s(?:and|then|or)\s/g)].map((m) => (m[0].startsWith(' ') ? m.index! : m.index! + 1)).filter((i) => i >= 40);
  let cut = ends.length ? ends[ends.length - 1] : head.replace(/\s+\S*$/, '').length;
  if (cut < 20) cut = head.replace(/\s+\S*$/, '').length;
  const title = t.slice(0, cut).replace(/[\s,;:(-]+$/, '').trim();
  const rest = t.slice(cut).replace(/^[\s,;:.)]+/, '').replace(/^(and|then|or)\s+/i, '').trim();
  // a quoted question cut inside its quotes keeps its closing quote
  const closed = (title.match(/"/g) ?? []).length % 2 ? `${title}"` : title;
  return { title: closed, rest: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '' };
}
