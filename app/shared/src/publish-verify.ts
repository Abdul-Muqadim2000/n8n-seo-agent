// 2026-10-27 (techand.ai on production): "I published it" checks that the live page IS the page that was written before it marks anything
// published (engine: n8n/seo-agent/v5/code/_publish_verify.js). When the page does not match, nothing is recorded and the report warns,
// with what was found; the person then sends the right address, or says it is the right page and sends it again with `confirmMismatch`
// (the owner's rule: flag it, then let them continue anyway). One reader of the callback for the report, the summary line and the form.

export type PublishVerifyOutcome = 'not_the_draft' | 'refresh_not_live' | 'refresh_other_address' | 'address_used_by_other_keyword';

export interface PublishVerifyState {
  outcome: PublishVerifyOutcome;
  title: string;
  body: string;
  /** what the live page shows (title, main heading) and what was missing */
  evidence: { label: string; value: string }[];
  missing: string[];
  /** the person may say it is the right page (never for an address that is another keyword's published page) */
  confirmable: boolean;
  /** the values "I published it" is re-opened with */
  keyword: string;
  publishedUrl: string;
  contentRequestId: string;
}

const OUTCOMES: readonly PublishVerifyOutcome[] = ['not_the_draft', 'refresh_not_live', 'refresh_other_address', 'address_used_by_other_keyword'];

const TITLES: Record<PublishVerifyOutcome, string> = {
  not_the_draft: 'Not marked published: this does not look like the page that was written',
  refresh_not_live: 'Not marked published: the update is not on the page yet',
  refresh_other_address: 'Not marked published: this is not the page the update was for',
  address_used_by_other_keyword: 'Not marked published: this address belongs to another keyword',
};

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** The warning a publish check carries, or null when the page was recorded (or the report predates the check, or the page did not answer). */
export function publishVerifyState(payload: Record<string, unknown>): PublishVerifyState | null {
  const outcome = str(payload.verify) as PublishVerifyOutcome;
  if (payload.recorded !== false || payload.live !== true || !OUTCOMES.includes(outcome)) return null;
  const ev = obj(payload.verify_evidence);
  const evidence: { label: string; value: string }[] = [];
  if (str(ev.title)) evidence.push({ label: 'Title on the page', value: str(ev.title) });
  if (str(ev.h1)) evidence.push({ label: 'Main heading on the page', value: str(ev.h1) });
  if (str(ev.draft_title)) evidence.push({ label: 'Title of the page that was written', value: str(ev.draft_title) });
  if (str(ev.refresh_of)) evidence.push({ label: 'Page the update is for', value: str(ev.refresh_of) });
  const usedBy = Array.isArray(ev.used_by) ? ev.used_by.map(str).filter(Boolean) : [];
  if (usedBy.length) evidence.push({ label: 'Already the page of', value: usedBy.join(', ') });
  return {
    outcome,
    title: TITLES[outcome],
    body: str(payload.verify_message),
    evidence,
    missing: Array.isArray(payload.verify_missing) ? payload.verify_missing.map(str).filter(Boolean) : [],
    confirmable: payload.confirmable === true && outcome !== 'address_used_by_other_keyword',
    keyword: str(payload.keyword),
    publishedUrl: str(payload.published_url),
    contentRequestId: /^[A-Za-z0-9:_.-]{1,120}$/.test(str(payload.content_request_id)) ? str(payload.content_request_id) : '',
  };
}

/** The prefill of "I published it" for the two buttons: the right address (the address left empty) or the same page, confirmed. */
export function publishVerifyPrefill(s: PublishVerifyState, confirm: boolean): Record<string, unknown> {
  return {
    keyword: s.keyword,
    publishedUrl: confirm ? s.publishedUrl : '',
    ...(s.contentRequestId ? { contentRequestId: s.contentRequestId } : {}),
    ...(confirm ? { confirmMismatch: true } : {}),
  };
}

/** The short line of the report list: a page the person confirmed is marked, not verified. */
export function publishVerifyShort(payload: Record<string, unknown>): string {
  if (publishVerifyState(payload)) return 'Not marked published: check the address';
  if (payload.confirmed === true && payload.recorded === true) return 'Marked published on your word (did not match the draft)';
  return '';
}
