/*__OUTBOUND__*/
// A-14 (2026-10-17, re-rating 2026-10-17): every outbound link of the draft, as it answers today. Runs between *Content QA* and
// *Originality Check* on every QA round. Live (exec 771) two of the page's seven external links answered 404 and the quality check only
// asked the owner to "verify" three hosts it had never fetched. Now each link is fetched (*Fetch Outbound Links*) and read by one rule
// (OB.classify): a dead link (404 / 410, a domain that does not resolve, a "not found" page) FAILS the quality check — named by URL,
// with a replacement source from this run when one carries the anchor's words, else "remove it"; a link behind a bot check, a block or
// a server error is "could not be checked" and listed as such, never called dead. Like Originality Check, a failure here refuses: it
// changes `passed`, `publishable`, `not_ready`, the label and the reasons together (B3-3: a gate that only labels is no gate).
const d = { ...($('Content QA').first().json || {}) };
const qa = { ...(d.content_qa || {}) };
const warnings = Array.isArray(qa.warnings) ? [...qa.warnings] : [];
const round = Number(d.qa_round || qa.round) || 1;
let reqs = []; try { reqs = $('Outbound Link Requests').all().map(i => i.json || {}); } catch (e) { reqs = []; }
const live = reqs.filter(r => r && !r.skip && r.url && (Number(r.round) || 1) === round);
let resps = [];
if (live.length) { try { resps = $('Fetch Outbound Links').all().map(i => i.json || {}); } catch (e) { resps = []; } }
const results = live.map((r, i) => ({ url: r.url, anchor: r.anchor || '', host: r.host || OB.hostOf(r.url), ...(resps[i] ? OB.classify(resps[i]) : { state: 'unknown', status: 0, reason: 'not fetched' }) }));
const deadKeys = new Set(results.filter(x => x.state === 'dead').map(x => OB.keyOf(x.url)));
const brief = d.content_brief || {};
const candidates = [
  ...(brief.evidence_plan || []).map(e => ({ url: e && e.source_url, text: e && e.fact })),
  ...(d.facts || []).map(f => ({ url: f && f.url, text: [f && f.text, f && f.claim].filter(Boolean).join(' '), title: f && f.title })),
  ...results.filter(x => x.state === 'ok').map(x => ({ url: x.url, text: x.anchor }))
];
const dead = results.filter(x => x.state === 'dead').map(x => ({ ...x, suggestion: OB.suggest(x, candidates, deadKeys) }));
const unknown = results.filter(x => x.state === 'unknown');
const link_check = {
  round, checked: results.length, ok: results.filter(x => x.state === 'ok').length, dead, unknown: unknown.map(x => ({ url: x.url, status: x.status, reason: x.reason })),
  basis: !results.length ? 'the draft has no outbound link' : 'each of the draft\'s ' + results.length + ' outbound link(s) was fetched in this run (GET, redirects followed, three tries on a network error): a 404 / 410, a domain that does not resolve or a "not found" page is dead; a bot check, a block or a server error is "could not be checked", never dead'
};
qa.link_check = link_check;
if (dead.length) warnings.push('Dead links (fetched in this run): ' + dead.slice(0, 5).map(x => x.url + ' (' + x.reason + (x.suggestion ? '; use ' + x.suggestion + ' instead' : '; no live page in this run states it, so remove the link') + ')').join('; ')
  + '. Replace or remove each one: a page that links to a missing page is not ready to publish');
if (unknown.length) qa.link_check_note = unknown.length + ' outbound link(s) could not be checked: ' + unknown.slice(0, 4).map(x => x.url + ' (' + x.reason + ')').join('; ') + '. Open them once before publishing.';
qa.warnings = warnings;
if (dead.length) {
  qa.passed = false; qa.passed_copy = false; qa.editor_needed = true;
  const roundsLeft = Math.max(0, Number(qa.rounds_left) || 0);
  const reason = dead.length + ' outbound link(s) lead to a missing page: ' + dead.slice(0, 4).map(x => x.url + ' (' + x.reason + (x.suggestion ? '; replace with ' + x.suggestion : '; remove it') + ')').join('; ');
  qa.publishable = false;
  qa.not_ready = !roundsLeft;
  qa.quality_label = roundsLeft ? 'needs another editing round before it can be published' : 'did not pass the quality check, so it is not ready to publish';
  qa.not_ready_reasons = !roundsLeft
    ? [reason, ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 7)
    : (Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : []);
  const er = Number(qa.editor_rounds) || 0;
  qa.quality = { ...(qa.quality && typeof qa.quality === 'object' ? qa.quality : {}),
    passed: false, publishable: false, not_ready: qa.not_ready, label: qa.quality_label, reasons: qa.not_ready_reasons,
    // 2026-10-21: what to do is an edit by hand, never a paid re-run (Content QA's next_step, with the dead links first)
    next_step: roundsLeft ? '' : 'Finish this draft by hand: replace or remove each link to a missing page listed above' + ((qa.quality || {}).next_step ? ', and ' + String(qa.quality.next_step).replace(/^Finish this draft by hand:\s*/, '') : '. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.'),
    fix_by: roundsLeft ? '' : 'edit',
    note: roundsLeft ? '' : (er ? 'The editor had ' + er + ' round' + (er === 1 ? '' : 's') : 'No editing round was left') + ' and the page still links to a missing page: it is delivered as a draft to finish by hand, not as a page to publish as it is.' };
}
return [{ json: { ...d, content_qa: qa } }];
