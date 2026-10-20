// Site Kickoff (POST /webhook/seo-site-kickoff, header X-API-Key; SCHEDULING_KEYWORDS_PLAN.md §4.7 / §14.3), rewritten 2026-10-19: it no
// longer starts the weekly jobs itself - it writes the website's seo_cycles row (anchor, time zone, cycle 0 due now, what the app already
// ran) and the Cycle Dispatcher starts cycle 0 within five minutes, with the scheduled semantics. Body:
// { domain | site_id, anchor_at?, tz?, skip_jobs?: [job], jobs?: [job], force?, dry_run?, request_id? }
//  * anchor_at - when the website's tracking started (the app's trackingStartedAt); default now. Cycle 0 is due at it, so it must be recent.
//  * tz - the owner's IANA time zone (`timezone` is accepted too); default the engine's. An unknown zone is refused (400).
//  * skip_jobs - what the app already ran at setup: cycle 0 skips them. `jobs` (the old body: only these) still works - every other job is skipped.
/*__CATCHUP__*/
/*__CYCLE__*/
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const normD = (x) => String(x || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
const yes = (v) => /^(true|1|yes|on)$/i.test(String(v ?? ''));
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(x => String(x).trim().toLowerCase()).filter(Boolean);
const domain = normD(b.domain); const site_id = String(b.site_id || '').trim();
const jobs = listOf(b.jobs), skip = listOf(b.skip_jobs);
const errors = []; if (!domain && !site_id) errors.push('domain or site_id is required');
const unknown = [...new Set([...jobs, ...skip].filter(j => !CYC.NAMES.includes(j)))];
if (unknown.length) errors.push('unknown jobs: ' + unknown.join(', ') + ' (known: ' + CYC.NAMES.join(', ') + ')');
const tz = String(b.tz ?? b.timezone ?? '').trim();
if (tz && !CYC.validTz(tz)) errors.push('unknown time zone "' + tz + '" (an IANA name such as Europe/London is expected)');
// the window is the cycle kit's (CYC.anchorOf, the same rule "Track my site" applies to tracking_started_at): the kickoff refuses, Track falls back to now
let anchor_at = '';
if (b.anchor_at != null && String(b.anchor_at).trim() !== '') {
  const A = CYC.anchorOf(b.anchor_at, Date.now());
  if (A.problem === 'not_a_date') errors.push('anchor_at "' + String(b.anchor_at).slice(0, 40) + '" is not a date (ISO 8601 expected)');
  else if (A.problem === 'too_old') errors.push('anchor_at is ' + A.days + ' days old: cycle 0 starts at the anchor, so it must be within the last ' + CYC.ANCHOR.past_days + ' days (leave it out to start now)');
  else if (A.problem === 'future') errors.push('anchor_at is in the future: cycle 0 starts at the anchor, at most an hour from now');
  else anchor_at = new Date(A.at).toISOString();
}
// the old `jobs` (start only these) is the same statement as "skip every other one", for cycle 0 only
const skip_jobs = [...new Set([...skip, ...(jobs.length ? CYC.NAMES.filter(j => !jobs.includes(j)) : [])])].filter(j => CYC.NAMES.includes(j));
return [{ json: { ok: !errors.length, error: errors.join('; '), domain, site_id, anchor_at, tz, skip_jobs, jobs, force: yes(b.force), dry_run: yes(b.dry_run),
  request_id: String(b.request_id || ('kickoff-' + $execution.id)) } }];
