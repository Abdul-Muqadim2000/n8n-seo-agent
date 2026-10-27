// ---- is the live page the draft? (2026-10-27, techand.ai and devaicon.com on production) ----
// "I published it" marked a draft published whenever the address answered HTTP 200: a NEW page for "ms 365 erp" reported at an older,
// different page (/dynamics-365-business-central-uae, "Business Central ERP Solutions in UAE"); a REFRESH of
// /insights/is-microsoft-dynamics-365-an-erp-system reported before the refresh was applied (the old title, no "erp systems in uae");
// and so one address became the published page of two keywords from two ladders. HTTP 200 proves an address answers, not that the
// draft is on it. INVARIANTS rule 4: a record says a thing exists only when the thing exists, so the draft's page must be shown to BE
// the draft before any state moves. One copy, inlined by the build into Publish Check (no model call, deterministic).
//
// Evidence that the live page is the draft, any one of:
//   a) the keyword in the live title or main heading: the keyword's words (stop words dropped, simple plurals folded) as a phrase in
//      one part of the title / heading (parts split at ? ! : | and spaced dashes, so "ERP System? UAE Buyers Guide" is two parts), or
//      all of them inside one short part ("Accounting Software Pricing in Dubai" for "dubai accounting software pricing");
//   b) the live title / heading matches the draft's own title / heading (sent by the app from the draft's report): 80% of the
//      draft's words there and half of all words shared;
//   c) a NEW page only: the keyword phrase in 3 or more sentences of the page's own content. A planned REFRESH never passes on the
//      text alone: the old page was already about the topic, so only (a) or (b) shows that the update is live.
// Outcomes (verify): 'ok' | 'not_the_draft' | 'refresh_not_live' | 'refresh_other_address' | 'address_used_by_other_keyword'.
// A refused outcome writes nothing: the row keeps its state (Publish Check passes `live: recorded_live` to publishedRows). The owner
// may re-send with confirm_mismatch: true after reading the evidence; the page is then recorded with verified false and the reason
// kept (publish_note). An address that is already the published page of ANOTHER keyword is never accepted on a confirmation: it is
// only accepted for a draft planned as a refresh of exactly that page, which then carries both keywords.
// o: { keyword, url, title, h1, text (the page's own content), draft: { title, h1 }, log (content-log row or null), ladder (ladder
//      row or null), logs, ladders (all rows), domain, confirm }
function verifyPublished(o) {
  const STOP = new Set(['a', 'an', 'the', 'in', 'of', 'for', 'to', 'and', 'on', 'at', 'by', 'with', 'is', 'are', 'vs', 'versus', 'or', 'from', 'into', 'about', 'your', 'our', 'its']);
  const ent = (s) => String(s == null ? '' : s).replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/gi, "'").replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/&quot;|&#34;/gi, '"').replace(/&[a-z]+;|&#\d+;/gi, ' ');
  const stem = (t) => (t.length > 4 && /ies$/.test(t)) ? t.slice(0, -3) + 'y'
    : (t.length > 4 && /(sses|shes|ches|xes|zes)$/.test(t)) ? t.slice(0, -2)
    : (t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) ? t.slice(0, -1) : t;
  const toks = (s) => ent(s).toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(t => t && !STOP.has(t)).map(stem);
  const parts = (s) => ent(s).split(/[?!|:;·•–—]|\.(?=\s|$)|\s-\s/).map(toks).filter(p => p.length);
  const phraseIn = (k, p) => { if (!k.length || p.length < k.length) return false; for (let i = 0; i + k.length <= p.length; i++) { let ok = true; for (let j = 0; j < k.length; j++) if (p[i + j] !== k[j]) { ok = false; break; } if (ok) return true; } return false; };
  const bagIn = (k, p) => k.length > 0 && p.length <= k.length + 6 && k.every(t => p.includes(t));
  const hostless = (u) => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const normK = (s) => toks(s).join(' ');
  const clip = (s, n) => { const x = ent(s).replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n - 3).trim() + '...' : x; };
  const kwT = toks(o.keyword);
  const title = clip(o.title, 160), h1 = clip(o.h1, 160);
  // a) the keyword in the title or the main heading
  const inTitle = parts(o.title).some(p => phraseIn(kwT, p) || bagIn(kwT, p));
  const inH1 = parts(o.h1).some(p => phraseIn(kwT, p) || bagIn(kwT, p));
  // c) the keyword phrase in the page's own sentences
  const textHits = ent(o.text).split(/[.?!]\s+|\n+/).reduce((n, s) => n + (phraseIn(kwT, toks(s)) ? 1 : 0), 0);
  // b) the draft's own title / heading
  const head = (s) => toks(String(s || '').split(/\s[|–—-]\s(?=[^|–—-]*$)/)[0]);   // the part before a trailing " | Brand"
  const sim = (a, b) => { const A = head(a), B = head(b); if (A.length < 3 || !B.length) return 0; const SB = new Set(B), SA = new Set(A); const inB = A.filter(t => SB.has(t)).length / A.length; const uni = new Set([...SA, ...SB]).size; const shared = [...SA].filter(t => SB.has(t)).length / (uni || 1); return inB >= 0.8 && shared >= 0.5 ? Math.min(inB, 1) : 0; };
  const draft = o.draft || {};
  const draftMatch = [draft.title, draft.h1].filter(Boolean).some(dt => sim(dt, o.title) > 0 || sim(dt, o.h1) > 0);
  const log = o.log || null, ladder = o.ladder || null;
  const refreshOf = String((log || {}).existing_page_url || '').trim();
  const refresh = !!refreshOf;
  const here = hostless(o.url);
  const kwKey = normK(o.keyword);
  // the address already recorded as the published page of ANOTHER keyword of this site (content log or ladder)
  const onSite = (r) => hostless(r.domain) === hostless(o.domain);
  const sameRow = (r) => (log && r === log) || (log && log.request_id && String(r.request_id || '') === String(log.request_id) && normK(r.keyword) === normK(log.keyword));
  const owners = [];
  for (const r of (o.logs || [])) if (r && onSite(r) && !sameRow(r) && String(r.status) === 'published' && hostless(r.published_url) === here && normK(r.keyword) && normK(r.keyword) !== kwKey) owners.push(String(r.keyword));
  for (const r of (o.ladders || [])) if (r && onSite(r) && !(ladder && r.ladder_id === ladder.ladder_id && r.keyword === ladder.keyword) && (String(r.status) === 'published' || r.page_exists === true || r.page_exists === 'true') && hostless(r.target_url) === here && normK(r.keyword) && normK(r.keyword) !== kwKey) owners.push(String(r.keyword));
  const others = [...new Set(owners.map(k => String(k).trim()))];
  const refreshHere = refresh && hostless(refreshOf) === here;
  const byWords = inTitle || inH1 || draftMatch;
  const matched = byWords || (!refresh && textHits >= 3);
  const evidence = { title, h1, keyword_in_title: inTitle, keyword_in_heading: inH1, keyword_in_text: textHits, draft_title: clip(draft.title, 160), draft_heading: clip(draft.h1, 160), draft_match: draftMatch,
    refresh_of: refreshOf, used_by: others.slice(0, 3) };
  const kwq = '"' + String(o.keyword || '').trim() + '"';
  const seen = 'Its title is "' + (title || 'none') + '" and its main heading is "' + (h1 || 'none') + '".';
  let verify = 'ok', message = '', missing = [], note = '';
  if (others.length && !refreshHere) {
    verify = 'address_used_by_other_keyword';
    message = 'This address is already the published page for "' + others[0] + '"' + (others.length > 1 ? ' (and ' + (others.length - 1) + ' more)' : '') + '. One page can only be recorded for one keyword here, so nothing was marked published. Send the address of the page written for ' + kwq + '. If one page should now cover both searches, write this draft as an update of that page first.';
    missing = ['an address that is not already recorded for another keyword'];
  } else if (refresh && !refreshHere) {
    verify = 'refresh_other_address';
    message = 'This draft was planned as an update of ' + refreshOf + ', but you sent ' + o.url + '. Nothing was marked published. Send the address of the page it updates, or confirm that you published it at this new address.';
    missing = ['the address of the page this draft updates'];
  } else if (!matched) {
    verify = refresh ? 'refresh_not_live' : 'not_the_draft';
    missing = [refresh ? 'the keyword ' + kwq + ' in the title or main heading' : 'the keyword ' + kwq + ' in the title, the main heading or the text']
      .concat((draft.title || draft.h1) ? ['the title of the page that was written ("' + clip(draft.title || draft.h1, 120) + '")'] : []);
    message = refresh
      ? 'This draft is an update of this page, but the update does not look live yet. ' + seen + ' Neither uses ' + kwq + (draft.title ? ' or the new title "' + clip(draft.title, 120) + '"' : '') + '. Nothing was marked published. Put the update on the page, then check again. If the update is live, confirm it.'
      : 'This page does not look like the page written for ' + kwq + '. ' + seen + ' Neither uses the keyword' + (draft.title ? ' or the written title "' + clip(draft.title, 120) + '"' : '') + ', and the text uses it ' + (textHits === 1 ? 'once' : textHits ? textHits + ' times' : 'nowhere') + '. Nothing was marked published. Check the address and send it again. If this is the right page, confirm it.';
  }
  if (verify === 'ok' && refreshHere && others.length) note = 'This page was already the published page for "' + others[0] + '". This draft is its planned update, so the page now carries both keywords.';
  const confirmable = verify !== 'ok' && verify !== 'address_used_by_other_keyword';
  const confirmed = confirmable && o.confirm === true;
  const accepted = verify === 'ok' || confirmed;
  const reasonShort = verify === 'ok' ? '' : verify === 'refresh_not_live' ? 'the update was not seen on the page' : verify === 'refresh_other_address' ? 'sent at another address than the page it updates' : verify === 'not_the_draft' ? 'the page did not match the draft (keyword not in the title, heading or text)' : 'the address is the published page of another keyword';
  return { verified: verify === 'ok', verify, accepted, confirmed, confirmable, message, missing, note, evidence,
    publish_note: confirmed ? 'Marked published by you after a warning: ' + reasonShort + ' (checked ' + String(o.now || '').slice(0, 10) + ')' : '' };
}
