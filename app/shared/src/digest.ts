// L5 (n8n/seo-agent/LINK_BUILDER_SPEC.md §2): journalist digests. HARO (Help a Reporter Out) and Source of Sources send one e-mail with
// many journalist requests; answering a relevant one earns a named mention and, usually, a link from a real publication. The digests
// arrive in the customer's own mailbox, so this reads them there (server/src/services/outreachJobs.ts, the inbox poller) and turns each
// request into a `digest` prospect for the SEO engine, which qualifies it like every other prospect: on topic, not a competitor, and the
// pitch itself still passes the draft gate before anyone may send it. With no mailbox connected nothing arrives and nothing happens.
//
// The format both services use is a numbered list of blocks with labelled lines:
//   1) Summary: <one line>
//   Name: <journalist or outlet>            Category: <topic>
//   Email: query-1a2b@email.sosresponse.com Media Outlet: <publication>
//   Deadline: <date, often with a time zone>
//   Query: <what they are looking for, several lines>
//   Requirements: <who may answer>
// Anything that does not parse is skipped rather than guessed at.
import { parseReturnDate } from './outreach';

export interface DigestRequest {
  /** the query's own id (from the anonymised reply address), else a short hash of the request */
  id: string;
  summary: string;
  outlet: string;
  query: string;
  requirements: string;
  /** the address the digest says to answer (anonymised by the service) */
  email: string;
  /** ISO date, or '' when the digest gives none we can read */
  deadline: string;
  /** the outlet's own domain when the digest names a URL for it, else '' (most requests are anonymised) */
  domain: string;
}

/** the services whose digests are understood (the From address decides, never the subject alone) */
export const DIGEST_SENDERS = /(^|[.@])(helpareporter\.com|sosresponse\.com|sourceofsources\.com)$/i;
const DIGEST_SUBJECT = /\b(haro|source of sources|sos)\b.{0,40}\b(digest|queries|opportunit)/i;

export function isDigestEmail(from: string, subject: string): boolean {
  const domain = String(from || '').toLowerCase().split('@')[1] ?? '';
  return (!!domain && DIGEST_SENDERS.test(domain)) || DIGEST_SUBJECT.test(String(subject || ''));
}

const LABEL = (block: string, name: string): string => {
  const m = block.match(new RegExp('^[\\t ]*' + name + '[\\t ]*:[\\t ]*([^\\n]*(?:\\n(?![\\t ]*[A-Z][A-Za-z ]{2,24}:)[^\\n]*)*)', 'im'));
  return m ? m[1]!.replace(/\s+/g, ' ').trim() : '';
};
const hash = (s: string): string => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const URL_RE = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i;
const SERVICE_HOST = /(helpareporter|sosresponse|sourceofsources|unsubscribe|list-manage|mailchimp|sendgrid)/i;
const DEADLINE_WINDOW = 60;   // days: a journalist request is never open longer than this

/** every request a digest carries, in the order it lists them; a block without a query or an address is skipped */
export function parseDigest(text: string, now = new Date()): DigestRequest[] {
  const body = String(text || '').replace(/\r/g, '');
  const blocks = body.split(/^[\t ]*\d{1,3}\s*[).]\s*(?=Summary[\t ]*:)/im).slice(1);
  const out: DigestRequest[] = [];
  for (const b of blocks) {
    const query = LABEL(b, 'Query');
    const email = (LABEL(b, 'Email').match(EMAIL) ?? b.match(EMAIL) ?? [''])[0]!.toLowerCase();
    if (!query || !email) continue;
    const summary = LABEL(b, 'Summary');
    const outlet = LABEL(b, 'Media Outlet') || LABEL(b, 'Name') || LABEL(b, 'Publication');
    const dl = LABEL(b, 'Deadline');
    // a digest's deadline is always days away, so a date that reads as more than DEADLINE_WINDOW days ahead was last year's calendar day
    // and the request has in fact closed ("9 October" read on 13 October is four days ago, not in eleven months).
    let when = dl ? parseReturnDate('until ' + dl, now) : null;
    if (when && when.getTime() - now.getTime() > DEADLINE_WINDOW * 864e5) when = new Date(Date.UTC(when.getUTCFullYear() - 1, when.getUTCMonth(), when.getUTCDate(), 9));
    const url = [LABEL(b, 'Media Outlet'), LABEL(b, 'Name'), query].map((s) => s.match(URL_RE)?.[1] ?? '').find((h) => h && !SERVICE_HOST.test(h)) ?? '';
    out.push({
      id: (email.split('@')[0]?.replace(/^query-?/i, '') || hash(query)).slice(0, 40),
      summary: summary.slice(0, 200),
      outlet: outlet.replace(/\(?\s*https?:\/\/[^\s)]*\)?/gi, '').replace(/[\s(,;:·|-]+$/, '').trim().slice(0, 120),
      query: query.slice(0, 1200),
      requirements: LABEL(b, 'Requirements').slice(0, 300),
      email,
      deadline: when ? when.toISOString().slice(0, 10) : '',
      domain: url.toLowerCase().replace(/^www\./, ''),
    });
  }
  return out;
}

/** a request whose deadline has passed is not worth drafting an answer to */
export const digestOpen = (r: DigestRequest, now = new Date()): boolean => !r.deadline || r.deadline >= now.toISOString().slice(0, 10);

/** The prospect row the SEO engine reads (seo_link_prospects, upsert by site + prospect_domain + type). An anonymised request has no
 *  outlet domain, so it is keyed by the service and the query's own id — the engine then leaves out the checks that need a real domain. */
export function digestProspect(r: DigestRequest, o: { siteId: string; domain: string; service: string; now?: Date }): Record<string, unknown> {
  const at = (o.now ?? new Date()).toISOString();
  return {
    site_id: o.siteId,
    domain: o.domain,
    prospect_domain: r.domain || `${o.service}/${r.id}`,
    type: 'digest',
    rank: 0,
    spam_score: 0,
    detail: [r.outlet ? `${r.outlet}:` : '', r.query].filter(Boolean).join(' ').slice(0, 300),
    source_url: r.domain ? `https://${r.domain}/` : '',
    target_url: '',
    status: 'new',
    first_seen: at,
    last_seen: at,
    won_at: '',
    outreach_subject: '',
    outreach_body: '',
    note: [`${o.service} digest`, r.outlet, r.deadline ? `deadline ${r.deadline}` : '', r.requirements].filter(Boolean).join(' · ').slice(0, 300),
    score: 0,
    origin: 'digest',
    contact_email: r.email,
    contact_url: '',
    contacted_at: '',
    followup_step: 0,
    followup_subject: '',
    followup_body: '',
    verified_at: '',
    drafted_at: '',
  };
}
