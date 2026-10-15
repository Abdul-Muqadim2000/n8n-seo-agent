const base = $('Schema Findings').first().json;
const ours = base.domain;
const labsItems = $('Find Competitors Answers').first().json.tasks?.[0]?.result?.[0]?.items || [];
const queries = $('Fallback Queries').all().map(i => i.json.query);
const serps = $input.all().map(i => i.json);
// B-A11 (2026-10-15, INVARIANTS rule 1): the in-200 retry gate (rule 3) marks an answer `unavailable` when BOTH attempts
// failed, and attaches that block to every item as `__dfs`. Nothing below may rank, score or advise from one.
const __ev76 = (list, node) => { try { const a = (node ? $(node).all().map(i => i.json) : list) || []; return (a.find(x => x && x.__dfs) || {}).__dfs || null; } catch (e) { return null; } };
// A refusal fires on an evidence block that SAYS `unavailable`, never on the absence of one: a path with no gate attached
// (and every harness fixture) has no `__dfs`, and inventing a failure out of silence is the same mistake in the other
// direction. This is how the nine nodes that already refuse read it too (Assess Result falls back when `__dfs` is absent).
const __read76 = (ev) => !ev || !ev.unavailable;
const labsEv76 = __ev76(null, 'Find Competitors Answers'), serpEv76 = __ev76(serps);
// the list is readable when EITHER read answered; when neither did there is no list, only silence that must not be
// reported as "no competitors found" (the old wording, and a measurement nobody took).
const competitors_evidence = { what: 'the domains that compete with this site for the same searches',
  labs: labsEv76, serps: serpEv76, checked: (labsEv76 ? labsEv76.checked || 0 : 0) + (serpEv76 ? serpEv76.checked || 0 : 0),
  // both reads have to have FAILED for there to be no list: one silent block is not a refusal
  unavailable: !__read76(labsEv76) && !__read76(serpEv76),
  error: (labsEv76 && labsEv76.error) || (serpEv76 && serpEv76.error) || '' };

const BIG = ['microsoft.com', 'google.com', 'youtube.com', 'linkedin.com', 'facebook.com', 'wikipedia.org',
  'amazon.com', 'apple.com', 'reddit.com', 'quora.com', 'medium.com', 'instagram.com', 'twitter.com', 'x.com',
  'pinterest.com', 'tiktok.com', 'github.com', 'indeed.com', 'glassdoor.com', 'forbes.com', 'clutch.co', 'g2.com',
  'goodfirms.co', 'capterra.com', 'trustpilot.com', 'crunchbase.com', 'yelp.com', 'upwork.com', 'fiverr.com',
  'sortlist.com', 'designrush.com', 'gartner.com', 'techradar.com', 'bayut.com', 'dubizzle.com', 'yellowpages.ae'];
const isBig = (d) => BIG.some(b => d === b || d.endsWith('.' + b)) || /\.(gov|edu)(\.|$)/.test(d);
const clean = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
const isOurs = (d) => d === ours || d.endsWith('.' + ours);

const manual = (base.competitors || []).map(clean).filter(d => d && !isOurs(d));
let comps = [];
let method = '';

if (manual.length) {
  comps = manual.slice(0, 3).map(d => ({ domain: d, shared: null, source: 'provided' }));
  method = 'provided by user';
} else if (competitors_evidence.unavailable) {
  // both reads failed twice: no competitor is named, nothing is ranked, and the reason travels with the row
  comps = [];
  method = 'the competitor search could not be read' + (competitors_evidence.error ? ': ' + competitors_evidence.error : '')
    + ' (asked twice). This is not "no competitors": nothing was measured.';
} else {
  const score = {};
  const shared = {};
  labsItems.forEach(it => {
    const d = clean(it.domain);
    if (!d || isOurs(d) || isBig(d)) return;
    score[d] = (score[d] || 0) + (it.intersections || 0) * 10;
    shared[d] = it.intersections ?? null;
  });
  serps.forEach(s => {
    const items = s.tasks?.[0]?.result?.[0]?.items || [];
    items.filter(x => x.type === 'organic' && x.rank_group <= 10).forEach(x => {
      const d = clean(x.domain);
      if (!d || isOurs(d) || isBig(d)) return;
      score[d] = (score[d] || 0) + (11 - x.rank_group);
    });
  });
  comps = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([d]) => ({ domain: d, shared: shared[d] ?? null, source: 'auto' }));
  method = labsItems.length ? 'auto-detected from shared rankings and Google results for: ' + queries.join(', ')
    : 'auto-detected from Google results for: ' + queries.join(', ');
}

return [
  { json: { domain: ours, is_you: true, shared: null, source: 'you', method, competitors_evidence } },
  ...comps.map(c => ({ json: { ...c, is_you: false, method, competitors_evidence } }))
];