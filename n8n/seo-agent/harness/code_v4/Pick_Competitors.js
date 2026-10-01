const base = $('Schema Findings').first().json;
const ours = base.domain;
const labsItems = $('Find Competitors').first().json.tasks?.[0]?.result?.[0]?.items || [];
const queries = $('Fallback Queries').all().map(i => i.json.query);
const serps = $input.all().map(i => i.json);

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
  { json: { domain: ours, is_you: true, shared: null, source: 'you', method } },
  ...comps.map(c => ({ json: { ...c, is_you: false, method } }))
];