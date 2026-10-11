import type { ProfileRow } from '@seo/shared';
import type { MailboxRow, OutreachSequenceRow, SiteRow } from '../db/schema';

// D14 (2026-10-11): the Reply Reader may state about the business only what is on file. With the facts empty it invented "we're not
// directly accredited by the Ministry, but we work with accredited providers" (live execs 357-360). Every reply call now carries the
// owner's business facts and the business profile (author / reviewer / NAP) as separate fields; the Reply Reader merges them into one facts
// block that is always in the prompt ("none on file" when empty) and brackets every claim the facts do not carry.

const PROFILE_KEYS = ['business_name', 'business_type', 'author_name', 'author_job_title', 'author_credentials', 'reviewer_name', 'reviewer_job_title', 'street_address', 'city', 'region', 'postal_code', 'country_code', 'phone', 'public_email', 'service_areas'] as const;

/** the profile fields the Reply Reader turns into fact lines (strings only, trimmed; nothing else from the row) */
export function profileFacts(p: ProfileRow | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!p) return out;
  for (const k of PROFILE_KEYS) { const v = String((p as unknown as Record<string, unknown>)[k] ?? '').trim(); if (v) out[k] = v.slice(0, 200); }
  return out;
}

export interface ReplyReadInput {
  site: Pick<SiteRow, 'domain' | 'business' | 'businessFacts'>;
  profile: ProfileRow | null | undefined;
  mailbox: Pick<MailboxRow, 'fromName' | 'signatureName' | 'signatureTitle' | 'company'>;
  sequence: Pick<OutreachSequenceRow, 'prospectDomain' | 'pageUrl' | 'steps'>;
  ourSubject: string;
  ourBody: string;
  from: string;
  subject: string;
  text: string;
  now: Date;
}

/** the body of the Reply Reader call (POST /webhook/seo-reply-read): the reply, our e-mail, the signer, and the facts in both fields */
export function replyReadBody(a: ReplyReadInput): Record<string, unknown> {
  const facts = a.site.businessFacts.slice(0, 1500);
  return {
    domain: a.site.domain, prospect_domain: a.sequence.prospectDomain, page_url: a.sequence.pageUrl,
    business: a.site.business ? a.site.business.slice(0, 120) : a.site.domain,
    signer: [a.mailbox.signatureName || a.mailbox.fromName, a.mailbox.signatureTitle, a.mailbox.company].filter(Boolean).join(', '),
    facts, business_facts: facts, profile: profileFacts(a.profile),
    our_subject: a.ourSubject, our_body: a.ourBody, reply_from: a.from, reply_subject: a.subject, reply_text: a.text, received_at: a.now.toISOString(),
  };
}
