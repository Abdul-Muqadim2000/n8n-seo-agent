// Production review 2026-11-12 (S3-05 / S2-05, build section 189): the live grade of two of a client's live, ranking pages read 59 "Not ready
// to publish yet: this website already has a page for the same search: /dynamics-365-business-central-uae". That address had answered 308 to
// /business-central-implementation-uae since 2026-11-07 (the daily page watch said so the same day): the "same search" page the first check
// named weeks earlier was no longer a page at all. Finalize never looked: it carried the first check's duplicate as it was.
// This node lists the addresses the first check named as "the same search" (page_run.duplicate_targets, the duplicate blocker's urls and
// the addresses in its text), on this website only, at most 3, so *Fetch Duplicate Pages* reads each one once WITHOUT following redirects
// (free, the client's own site). *Duplicate Status* hands what they answered to Parse Brief; Finalize Verdict then never keeps a duplicate
// whose address redirects, is gone, or is the page being graded (or redirects to it). One item per address; none = one item, no read.
const it = $input.first().json || {};
const b = (it.body && typeof it.body === 'object' && !Array.isArray(it.body)) ? it.body : {};
const S = (v) => String(v == null ? '' : v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const host = (u) => (S(u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || '';
const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
const domain = bare(S(b.domain).trim().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, ''));
const key = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const pr = isObj(b.page_run) ? b.page_run : {};
const urls = [];
const add = (u) => { const x = S(u).trim().replace(/[.,;:)]+$/, ''); if (!/^https?:\/\/[^\s"<>]+$/i.test(x) || x.length > 600) return;
  if (/[\\@]/.test(x)) return;   // review N1: a backslash or an "@" can make the fetcher read another host than this check does
  if (!domain || bare(host(x)) !== domain) return;   // the client's own website only: never a read of another site
  if (!urls.some(y => key(y) === key(x))) urls.push(x); };
for (const d of (Array.isArray(pr.duplicate_targets) ? pr.duplicate_targets : [])) if (isObj(d)) add(d.url);
for (const q of (Array.isArray(pr.qa_blocking) ? pr.qa_blocking : [])) { if (!isObj(q) || S(q.code) !== 'duplicate_page') continue;
  for (const u of (Array.isArray(q.urls) ? q.urls : [])) add(u);
  for (const m of S(q.text).match(/https?:\/\/[^\s"<>)]+/g) || []) add(m); }
const take = urls.slice(0, 3);
// review N2: nothing read = no status; a duplicate_status the caller sent itself is never taken as a reading
if (!take.length) { const body0 = { ...b }; delete body0.duplicate_status; return [{ json: { ...it, body: body0, dup_check: { asked: 0 } } }]; }
return take.map((u, i) => ({ json: i === 0 ? { ...it, dup_check: { url: u, asked: take.length } } : { dup_check: { url: u, asked: take.length } } }));
