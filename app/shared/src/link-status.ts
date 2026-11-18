// CR17-E (client report 2026-11-17, devaicon.com F9 + C4; engine build section 195): ONE status model for link building.
//
// The client saw three different pitch counts on three screens (the Pipeline "0 pitch(es) drafted", the Overview "2 pitches are drafted",
// the Links page "1 pitch ready"), a Backlinks page that counted 51 prospects "to contact" while the Links page had left 41 of them out,
// and "3 links won this month" that were domain collisions nobody had written to. Each screen counted its own population from its own
// table. Here every count comes from one function over the rows that exist (the engine's seo_link_outreach and seo_link_prospects rows and
// the app's outreach sequences), and every screen calls it: the Links page (server linkBuilder.ts), the Backlinks page and the Pipeline row
// (server data.ts backlinksData -> BacklinksData.linkCounts), the AI growth "pages citing others" list (prospectLinkState) and the
// recommendations (linkSummary -> linkStatusCounts; package H wires the wording).
//
// Rules (the engine applies the same ones, v5/code/_link_kit.js LK.wonCheck and v5/code/_outreach_kit.js OK.reasonCode / domainVerdicts):
// - WON only when we contacted the site (a sequence that started, or contacted_at: our sender or "I sent it myself") AND our own check
//   found the link (the engine's verified_at, or the Reply Reader's own reading: sequence status won). A link nobody asked for is
//   "already links to you"; a link on a junk page (a job listing, a profile, a farm) is "found, low value". Neither is a result.
// - A website-level verdict (a competitor, a government portal, a platform, a job board, a site that sells links, too little authority)
//   on any row of a registrable domain leaves every not-yet-contacted row of that domain out. A page-level verdict (their page answers
//   404, another language, off topic) on one row of a domain that also has a live pitch is not listed: the queue and the left-out list
//   never name the same website.
// - A draft nobody has sent is "waiting for you", never progress.
// - FX-LINKS (review R2 M2 / M5): "they linked" said by a person (Mark won on a reply, Won on the Backlinks page) is CLAIMED until our check
//   finds the link on their page: shown as such, never silently reverted and never counted as won; our check then makes it won.
import { registrableDomain } from './domain';

export const LINK_STATES = ['found', 'left_out', 'no_page', 'needs_contact', 'to_write', 'needs_edit', 'to_review', 'approved', 'sent', 'replied', 'claimed', 'won', 'lost', 'declined', 'already_links', 'low_value'] as const;
export type LinkState = (typeof LINK_STATES)[number];

/** what the client reads for each state (short, plain) */
export const LINK_STATE_LABEL: Record<LinkState, string> = {
  found: 'Found', left_out: 'Left out', no_page: 'Waiting for a page of yours', needs_contact: 'No e-mail address yet', to_write: 'Pitch not written yet', needs_edit: 'Needs your edit',
  to_review: 'Pitch ready for you', approved: 'Approved, not sent yet', sent: 'Sent', replied: 'Replied', claimed: 'You said it is live: checking', won: 'Won (link checked)', lost: 'Link gone', declined: 'Declined',
  already_links: 'Already links to you', low_value: 'Found, low value',
};

/** the engine's verdict codes (OK.reasonCode in v5/code/_outreach_kit.js; keep the two tables equal) */
const REASON_CODES: [string, RegExp][] = [
  ['client_declined', /marked (in the app|not a fit)|not a fit \(marked/i],
  ['government', /government site/i],
  ['platform', /a platform page|a code host on|a profile on|a channel page on/i],
  ['job_board', /job board|job listing/i],
  ['not_a_site', /mailbox provider|contact \/ company database|infrastructure \(|statistics page|not a website/i],
  ['competitor_list', /its own list ranks itself/i],
  ['competitor', /competing (site|provider)|competitor of yours|recommends instead of you/i],
  ['listing', /a directory or list where companies are listed/i],
  ['your_platform', /the maker of the platform you work with/i],
  ['software', /a software maker, not a competitor/i],
  ['sells_links', /sells posts or links|paid guest posts|offers links|link-farm|spam score|gambling|essay-mill|press-release wire|different sites linked from one page/i],
  ['low_authority', /too little authority/i],
  ['accreditation', /accredited \/ approved providers/i],
  ['no_matching_page', /no page of yours covers their topic/i],
  ['off_topic', /off topic|off your topics/i],
  ['language', /another language/i],
  ['page_gone', /answers 4\d\d|does not answer|page itself is gone/i],
  ['homepage_only', /only their homepage/i],
  ['page_changed', /no longer carr|dead link is no longer/i],
  ['writer_skip', /^writer:/i],
];
export function linkReasonCode(why: string | null | undefined): string {
  const t = String(why ?? '');
  if (!t.trim()) return '';
  for (const [c, re] of REASON_CODES) if (re.test(t)) return c;
  return 'other';
}
/** verdicts about the WEBSITE, not one page: they leave every row of that registrable domain out */
export const DOMAIN_REASON_CODES: ReadonlySet<string> = new Set(['government', 'platform', 'job_board', 'not_a_site', 'competitor', 'competitor_list', 'sells_links', 'low_authority']);

export interface LinkStatusOutreach {
  prospect_domain: string; type: string; status: string; fit_reason?: string | null; reason_code?: string | null; sequence_json?: string | null; checked_at?: string | null;
}
export interface LinkStatusProspect {
  prospect_domain: string; type: string; status: string; contacted_at?: string | null; won_at?: string | null; verified_at?: string | null;
}
export interface LinkStatusSequence {
  prospectDomain: string; type: string; status: string; startedAt: string | null; approvedAt: string | null; replyAt: string | null; replyClass: string | null; wonAt: string | null;
}
export interface LinkStatusInput { outreach?: readonly LinkStatusOutreach[]; prospects?: readonly LinkStatusProspect[]; sequences?: readonly LinkStatusSequence[] }
export interface LinkStatusRow {
  key: string; prospectDomain: string; type: string; site: string; state: LinkState; reason: string; reasonCode: string;
  /** a page-level verdict on a website that also has a live pitch: not listed, not counted (the queue and the left-out list never share a website) */
  hidden: boolean;
  /** when the link was won (verified), for "this month" */
  wonAt: string;
}

const s = (v: unknown) => (v == null ? '' : String(v));
const keyOf = (d: string, t: string) => `${d.toLowerCase()}|${t}`;
/** the website a row belongs to (its registrable domain; a journalist request keeps its own id) */
const siteOf = (d: string) => { const x = d.toLowerCase().replace(/^www\./, ''); return /\//.test(x) || !/\./.test(x) ? x : registrableDomain(x) || x; };
const hasSteps = (j: string | null | undefined) => { try { const a = JSON.parse(s(j) || '[]'); return Array.isArray(a) && a.some((x) => x && s((x as { body?: unknown }).body).trim()); } catch { return false; } };
const PRE_CONTACT: ReadonlySet<LinkState> = new Set(['found', 'no_page', 'needs_contact', 'to_write', 'needs_edit', 'to_review']);
const QUEUE: ReadonlySet<LinkState> = new Set(['no_page', 'needs_contact', 'to_write', 'needs_edit', 'to_review', 'approved']);
/** types that are not link-building pitches (a redirect to add on your own site, a broken page of yours) */
const NOT_A_PITCH = new Set(['redirect', 'reclaim']);

/** the state of a prospect row alone (no outreach row, no sequence): the AI growth list and the Backlinks pipeline use it */
export function prospectLinkState(p: LinkStatusProspect | null | undefined): LinkState {
  if (!p) return 'found';
  const st = s(p.status);
  if (st === 'won') return s(p.verified_at) && s(p.contacted_at) ? 'won' : s(p.verified_at) ? 'already_links' : s(p.contacted_at) ? 'claimed' : 'found';
  if (st === 'lost') return 'lost';
  if (st === 'linked') return 'already_links';
  if (st === 'low_value') return 'low_value';
  if (st === 'rejected' || st === 'ignored') return 'declined';
  if (st === 'replied') return 'replied';
  if (st === 'contacted' && s(p.contacted_at)) return 'sent';
  return 'found';
}

function sequenceState(q: LinkStatusSequence): LinkState | null {
  if (q.status === 'won') return 'won';
  if (q.status === 'claimed') return 'claimed';
  if (q.replyClass === 'declined' || q.replyClass === 'unsubscribe') return 'declined';
  if (q.status === 'replied' || (q.replyAt && q.replyClass !== 'out_of_office')) return 'replied';
  if (q.startedAt) return 'sent';
  if (q.approvedAt && ['scheduled', 'paused'].includes(q.status)) return 'approved';
  return null;   // stopped before anything went out: as if it never existed
}

function outreachState(o: LinkStatusOutreach): LinkState | null {
  switch (s(o.status)) {
    case 'not_fit': return 'left_out';
    case 'held': return 'no_page';
    case 'needs_contact': return 'needs_contact';
    case 'ready': return 'to_write';
    case 'needs_edit': return 'needs_edit';
    case 'drafted': return hasSteps(o.sequence_json) ? 'to_review' : 'to_write';
    case 'recheck': return 'found';
    case 'fix': return null;
    default: return 'found';
  }
}

/** every pitch's state, one row per website + opportunity type */
export function linkStates(input: LinkStatusInput): LinkStatusRow[] {
  const out = new Map<string, LinkStatusRow>();
  const seqBy = new Map<string, LinkStatusSequence>();
  for (const q of input.sequences ?? []) {
    const k = keyOf(q.prospectDomain, q.type); const was = seqBy.get(k);
    if (!was || s(q.startedAt || q.approvedAt) > s(was.startedAt || was.approvedAt)) seqBy.set(k, q);
  }
  const proBy = new Map((input.prospects ?? []).map((p) => [keyOf(s(p.prospect_domain), s(p.type)), p] as const));
  const outBy = new Map((input.outreach ?? []).map((o) => [keyOf(s(o.prospect_domain), s(o.type)), o] as const));
  const keys = new Set<string>([...outBy.keys(), ...proBy.keys(), ...seqBy.keys()]);
  for (const k of keys) {
    const o = outBy.get(k); const p = proBy.get(k); const q = seqBy.get(k);
    const domain = s(o?.prospect_domain ?? p?.prospect_domain ?? q?.prospectDomain).toLowerCase(); const type = s(o?.type ?? p?.type ?? q?.type);
    if (!domain || NOT_A_PITCH.has(type)) continue;
    let state: LinkState | null = null; let reason = ''; let code = ''; let wonAt = '';
    const contacted = !!(q?.startedAt || s(p?.contacted_at));
    const qs = q ? sequenceState(q) : null;
    if (qs === 'won') { state = 'won'; wonAt = s(q!.wonAt); }
    else if (p && s(p.status) === 'won' && s(p.verified_at) && contacted) { state = 'won'; wonAt = s(p.verified_at || p.won_at); }
    else if (p && ['lost', 'linked', 'low_value'].includes(s(p.status))) state = prospectLinkState(p);
    else if (qs) state = qs;
    else if (p && ['rejected', 'ignored', 'replied'].includes(s(p.status))) state = prospectLinkState(p);
    else if (p && s(p.status) === 'contacted' && s(p.contacted_at)) state = 'sent';
    else if (p && s(p.status) === 'won' && prospectLinkState(p) === 'already_links') state = 'already_links';
    else if (p && s(p.status) === 'won' && contacted) state = 'claimed';   // FX-LINKS: a person's "won" our check has not confirmed yet   // a "won" nobody wrote to: a link that was there anyway, not a result (a "won" with no check at all is a collision and counts as nothing)
    if (!state && o) { state = outreachState(o); if (state === 'left_out' || state === 'no_page') { reason = s(o.fit_reason); code = s(o.reason_code) || linkReasonCode(o.fit_reason) || (state === 'no_page' ? 'no_matching_page' : ''); } }
    if (!state) state = o ? null : 'found';
    if (!state) continue;
    out.set(k, { key: k, prospectDomain: domain, type, site: siteOf(domain), state, reason, reasonCode: code, hidden: false, wonAt });
  }
  // one verdict per website
  const rows = [...out.values()];
  const bySite = new Map<string, LinkStatusRow[]>();
  for (const r of rows) { const l = bySite.get(r.site) ?? []; l.push(r); bySite.set(r.site, l); }
  for (const list of bySite.values()) {
    const verdict = list.filter((r) => r.state === 'left_out' && DOMAIN_REASON_CODES.has(r.reasonCode)).sort((a, b) => a.key.localeCompare(b.key))[0];
    if (verdict) {
      for (const r of list) if (PRE_CONTACT.has(r.state)) { r.state = 'left_out'; r.reasonCode = verdict.reasonCode; r.reason = verdict.reason; }
      continue;
    }
    if (list.some((r) => QUEUE.has(r.state))) for (const r of list) if (r.state === 'left_out') r.hidden = true;
  }
  return rows;
}

export interface LinkStatusCounts {
  found: number; leftOut: number; noPage: number; needsContact: number; toWrite: number; needsEdit: number; toReview: number; approved: number; sent: number; replied: number;
  /** FX-LINKS: links a person said are live, not found by our check yet (never counted as won) */
  claimed: number;
  won: number; wonThisMonth: number; lost: number; declined: number; alreadyLinks: number; lowValue: number;
  /** pitches written and waiting for a person (ready to read + held for an edit): never progress until someone sends them */
  waitingForYou: number;
  /** every pitch still before the first e-mail (no page, no contact, to write, to edit, to review, approved) */
  inQueue: number;
}

/** every link-building count, from one population (`now` decides "this month", UTC month unless `month` is given as YYYY-MM) */
export function linkStatusCounts(input: LinkStatusInput | readonly LinkStatusRow[], opts: { now?: number | Date; month?: string } = {}): LinkStatusCounts {
  const rows = Array.isArray(input) ? (input as readonly LinkStatusRow[]) : linkStates(input as LinkStatusInput);
  const month = opts.month ?? new Date(opts.now ?? Date.now()).toISOString().slice(0, 7);
  const c: LinkStatusCounts = { found: 0, leftOut: 0, noPage: 0, needsContact: 0, toWrite: 0, needsEdit: 0, toReview: 0, approved: 0, sent: 0, replied: 0, claimed: 0, won: 0, wonThisMonth: 0, lost: 0, declined: 0, alreadyLinks: 0, lowValue: 0, waitingForYou: 0, inQueue: 0 };
  // a website counts once per state (two pitches to one website are one website to the client)
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.hidden) continue;
    const k = r.site + '|' + r.state; if (seen.has(k)) continue; seen.add(k);
    switch (r.state) {
      case 'found': c.found++; break; case 'left_out': c.leftOut++; break; case 'no_page': c.noPage++; break; case 'needs_contact': c.needsContact++; break;
      case 'to_write': c.toWrite++; break; case 'needs_edit': c.needsEdit++; break; case 'to_review': c.toReview++; break; case 'approved': c.approved++; break;
      case 'sent': c.sent++; break; case 'replied': c.replied++; break; case 'claimed': c.claimed++; break; case 'lost': c.lost++; break; case 'declined': c.declined++; break;
      case 'already_links': c.alreadyLinks++; break; case 'low_value': c.lowValue++; break;
      case 'won': c.won++; if (r.wonAt.slice(0, 7) === month) c.wonThisMonth++; break;
    }
  }
  c.waitingForYou = c.toReview + c.needsEdit;
  c.inQueue = c.noPage + c.needsContact + c.toWrite + c.needsEdit + c.toReview + c.approved;
  return c;
}

// ---- the link text (C4c): the text itself, never a kind label like "Your brand name" ----
export const ANCHOR_KIND_LABEL: Record<string, string> = { brand: 'your business name', title: "your page's title", url: "your page's address", 'as before': 'the same text as before' };
const bare = (u: string) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
/** the link text to show for a pitch: the stored text, else what the engine would choose (the brand, else the bare address) */
export function anchorDisplay(o: { anchorText?: string | null; anchorHint?: string | null; targetUrl?: string | null }, brand: string, domain: string): { text: string; kind: string; kindLabel: string } {
  const kind = s(o.anchorHint) || 'brand';
  const stored = s(o.anchorText).trim();
  if (stored) return { text: stored, kind, kindLabel: ANCHOR_KIND_LABEL[kind] ?? '' };
  if (kind === 'as before') return { text: '', kind, kindLabel: ANCHOR_KIND_LABEL[kind]! };
  if (kind === 'url') return { text: bare(s(o.targetUrl)) || bare(domain), kind, kindLabel: ANCHOR_KIND_LABEL.url! };
  const b = brand.trim();
  return b ? { text: b, kind: 'brand', kindLabel: ANCHOR_KIND_LABEL.brand! } : { text: bare(s(o.targetUrl)) || bare(domain), kind: 'url', kindLabel: ANCHOR_KIND_LABEL.url! };
}

// ---- the junk gate for a page that links to the client (integration of CR17-E into the recommendations) ----
// The engine's LK.junkLink (v5/code/_link_kit.js) decides won links; the app needs the same answer for a LOST link: a job listing, a profile,
// a code host, a link farm or a scraper page is never worth a "win back the link" step. The job-board host list is the engine's, character
// for character (link-status.test.ts compares them).
const JOB_HOST = /(^|\.)(bebee|indeed|glassdoor|rozee|naukri|naukrigulf|bayt|monster|ziprecruiter|jooble|careerjet|simplyhired|wuzzuf|gulftalent|mustakbil|jobstreet|seek|reed|totaljobs|stepstone|dice|jobrapido|adzuna|neuvoo|careerbuilder|jobsdb|laimoon|workable|recruitee|smartrecruiters|greenhouse|lever|wellfound)\.[a-z.]+$|^(jobs|careers)\.[a-z0-9-]+\.[a-z.]+$/;
const JOB_PATH = /(^|\/)(jobs?|job-listings?|vacanc(?:y|ies)|careers?\/jobs?)(\/|$)/i;
const JOB_TITLE = /\b\d+\+?\s+[^|]{0,60}\bjobs?\b|\bjobs? in\b|\bhiring\b|\bvacanc(?:y|ies)\b|\bapply now\b|\|\s*bebee\b/i;
const CODE_HOST = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|sourceforge\.net)$/;
const PROFILE_PATH: [RegExp, RegExp][] = [
  [/(^|\.)linkedin\.[a-z.]+$/, /^\/(in|pub|company|school|showcase)\//i],
  [/(^|\.)(x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|threads\.net|pinterest\.[a-z.]+|behance\.net|dribbble\.com|about\.me|linktr\.ee|producthunt\.com)$/, /^\/[^/]+\/?$|^\/@/],
  [/(^|\.)medium\.com$/, /^\/@/],
  [/(^|\.)youtube\.com$/, /^\/(@|channel\/|c\/|user\/)/i],
];
const hostOfUrl = (u: string) => s(u).toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
const pathOfUrl = (u: string) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(s(u)) ? s(u).replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '').replace(/[?#].*$/, '') || '/' : '');
/** '' when the linking page is a real page, else the plain reason it is not worth a link-building step (lost or won). */
export function junkLinkSite(o: { domain?: string | null; url?: string | null; title?: string | null; linkType?: string | null; spam?: number | null }): string {
  const url = s(o.url);
  const h = hostOfUrl(url) || hostOfUrl(s(o.domain));
  const path = pathOfUrl(url);
  const lt = s(o.linkType).toLowerCase();
  if (lt === 'spam') return 'a link-farm or spam page';
  if (lt === 'scraper') return 'an automatic report page';
  if ((Number(o.spam) || 0) >= 30) return 'a page with a high spam score';
  if (h && (JOB_HOST.test(h) || (/(^|\.)linkedin\.[a-z.]+$/.test(h) && /^\/jobs(\/|$)/i.test(path)) || (JOB_PATH.test(path) && JOB_TITLE.test(s(o.title))))) return 'a job listing';
  if (h && CODE_HOST.test(h)) return 'a code host';
  if (h && path && PROFILE_PATH.some(([hr, pr]) => hr.test(h) && pr.test(path))) return 'a profile';
  if (lt === 'profile') return 'a profile';
  return '';
}
