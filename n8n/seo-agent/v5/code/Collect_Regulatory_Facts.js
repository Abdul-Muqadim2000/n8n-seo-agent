/*__REGULATORS__*/
/*__REGULATORY__*/
// W0-F (page-quality programme 2026-10-29, PLAN §3 Fix 6; REVIEW_EVIDENCE H5): the dated obligations this page may state, each with its
// source, its source's date, the day it is true as of, what it supersedes and its status on the day the page is written. Every route of
// the regulatory step ends here (nothing to research, nothing found, pages read), and it always answers ONE item: the competitor reading
// it was given plus `regulatory` (the summary, the REGULATORY FACTS block the brief and the writer print, what was read and why a source
// was not used), `regulatory_facts` (the PRC shape, read by Build Webhook Response) and `regulatory_sources` (the same facts as citable
// sources, which *Collect Facts* puts first in the run's verified facts so the figure check and the evidence plan know them).
// Rules: the official text first; the latest dated official source wins and records the date it supersedes (31 July 2026 -> 30 October
// 2026 for the UAE phase 1 provider deadline); with no official text read, two independent secondary sources that agree, labelled as
// reported by them; one secondary source alone is never used; else "none could be confirmed". The client's own posts are read only to tell
// the client where they still say an old date. A failure anywhere here never stops the page: the run goes on without the block.
const base = $('Analyze Competitor Pages').first().json || {};
const one = (regulatory, regulatory_facts, regulatory_sources) => [{ json: { ...base, regulatory, regulatory_facts: regulatory_facts || [], regulatory_sources: regulatory_sources || [] } }];
try {
  const firstOf = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return null; } };
  const planItems = firstOf('Regulatory Plan') || [];
  const plan = (planItems[0] || {}).regulatory_plan || { topics: [] };
  if (!planItems.length || (planItems[0] || {}).skip) {
    return one({ status: 'not_applicable', reason: (planItems[0] || {}).reason || 'the regulatory step did not run', market: plan.market || '', market_name: plan.market_name || '',
      as_of: plan.as_of || '', topics: [], facts: [], sources_read: [], not_used: [], own_posts: [], hints: [], digest: '' });
  }
  const market = REG.marketOf(REGULATORS, plan.market) || { topics: {}, official: [] };
  const asOf = plan.as_of;
  // the candidates the pages were read for: the paid fallback's when it ran, else the free search's
  const serpC = firstOf('Regulatory SERP Candidates');
  const freeC = firstOf('Regulatory Candidates') || [];
  const candsAll = (serpC && serpC.length ? serpC : freeC).filter(c => c && c.read);
  const searched = ((serpC && serpC.length ? serpC : freeC)[0] || {}).searched || null;
  const hints = ((serpC && serpC.length ? serpC : freeC)[0] || {}).hints || [];
  const reads = candsAll.length ? (firstOf('Read Regulatory Pages') || []) : [];
  const textOf = (r) => String((r && (r.page_text ?? r.data ?? r.body)) || '');
  const WALL = /\b(just a moment|attention required|access denied|enable javascript and cookies|verify you are human|captcha|request blocked|403 forbidden)\b/i;
  const cands = [], sources_read = [];
  candsAll.forEach((c, i) => {
    const r = reads[i]; const text = textOf(r);
    const T = (market.topics || {})[c.topic] || {};
    let state = 'read';
    if (!r) state = 'not read';
    else if (r.error || !text.trim()) state = 'could not be read' + (r.error ? ' (' + String(r.error.message || r.error).slice(0, 80) + ')' : '');
    else if (text.length < 4000 && WALL.test(text)) state = 'blocked by a bot wall';
    if (state !== 'read') { sources_read.push({ url: c.url, role: c.role, topic: c.topic, state, facts: 0 }); return; }
    const facts = REG.extract(text, { topic: c.topic, url: c.url, role: c.role, tier: c.role === 'official' ? 1 : c.role === 'secondary' ? 2 : null,
      source_date: REG.sourceDate(c.url, text), triggers: T.triggers || [] });
    facts.forEach(f => cands.push(f));
    sources_read.push({ url: c.url, role: c.role, topic: c.topic, state: facts.length ? 'read' : 'read, no dated obligation found', facts: facts.length, source_date: REG.sourceDate(c.url, text) });
  });
  // the dated obligations a person read on the official text itself (v5/data/regulators.json `known`), while they are fresh
  for (const t of plan.topics || []) { const T = (market.topics || {})[t.id] || {}; if (T.fresh_until && T.fresh_until < asOf) continue;
    for (const k of T.known || []) cands.push({ ...k, topic: t.id, role: 'on_file', precision: /^\d{4}-\d{2}-\d{2}$/.test(k.date) ? 'day' : 'month', source_tier: 1, amendment: !!k.supersedes }); }
  // old obligations are not news: a date more than 400 days before today is left out
  const floor = REG.addDays(asOf, -400);
  const recent = cands.filter(f => REG.endOf(f.date) >= floor);
  const R = REG.resolve(recent.filter(f => f.role !== 'own'), { asOf });
  const relevance = new Map((plan.topics || []).map(t => [t.id, t.relevance]));
  // per topic, in date order; over the cap, the oldest date that has already passed or come into force goes first, then the furthest away
  const facts = [];
  for (const t of plan.topics || []) {
    const mine = R.chosen.filter(f => f.topic === t.id && !(relevance.get(t.id) !== 'core' && f.verb === 'start' && f.status === 'in_force'))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const cap = relevance.get(t.id) === 'core' ? REG.MAX_FACTS_TOPIC : REG.MAX_CONTEXT_FACTS;
    while (mine.length > cap) { const k = mine.findIndex(f => f.status !== 'upcoming'); mine.splice(k >= 0 ? k : mine.length - 1, 1); }
    mine.forEach(f => facts.push(f));
  }
  const regulatory_facts = facts.map(f => ({ market: plan.market, topic: f.topic, date: f.date, obligation: f.obligation, subject: f.subject || '', threshold: f.threshold || '',
    url: f.url, paragraph: f.paragraph || '', source_tier: f.source_tier, source_date: f.source_date || '', as_of: asOf, supersedes: f.supersedes || '', status: f.status,
    source_kind: f.source_kind, reported_by: f.reported_by || [], ...(f.urls ? { urls: f.urls } : {}), ...(f.instrument ? { instrument: f.instrument } : {}), verb: f.verb, subject_class: f.subject_class }));
  // the same facts as citable sources for the run's verified facts (one per page and paragraph)
  const srcSeen = new Set(), regulatory_sources = [];
  for (const f of regulatory_facts) for (const u of (f.urls && f.urls.length ? f.urls : [f.url])) {
    const para = (f.urls && f.urls.length ? ((recent.find(x => x.url === u && x.date === f.date) || {}).paragraph || f.paragraph) : f.paragraph);
    const k = REG.urlKey(u) + '|' + para; if (!u || srcSeen.has(k)) continue; srcSeen.add(k);
    regulatory_sources.push({ claim: (para || (f.obligation + ' by ' + REG.fmt(f.date))).slice(0, 400),
      text: [f.instrument, para, (f.subject ? f.subject + ': ' : '') + f.obligation + ' by ' + REG.fmt(f.date) + (f.threshold ? ' (threshold: ' + f.threshold + ')' : '')].filter(Boolean).join(' - ').slice(0, 900),
      source: REG.host(u), url: u, title: (f.instrument || '').slice(0, 160), authority: 'high', year: f.date.slice(0, 4), regulatory: true, status: f.status, as_of: asOf });
  }
  // the client's own posts: dates they state for an obligation confirmed differently (advice for the client, never a source)
  const own = recent.filter(f => f.role === 'own');
  const ownConf = REG.ownConflicts(own, facts);
  const own_posts = sources_read.filter(x => x.role === 'own').map(x => ({ url: x.url, state: x.state, conflicts: ownConf.filter(c => c.url === x.url) }));
  const topics = (plan.topics || []).map(t => { const n = facts.filter(f => f.topic === t.id); const best = n.length ? Math.min(...n.map(f => f.source_tier || 9)) : null;
    return { ...t, facts: n.length, confirmed: n.length > 0, source_tier: best,
      basis: n.length ? n.length + ' dated obligation(s), ' + (best === 1 ? 'from the official text' : 'reported by two independent sources that agree (no official text could be read)')
        : 'none could be confirmed on an official source or by two independent sources that agree' }; });
  const not_used = R.notes.map(x => ({ ...x, kind: 'single_source' })).concat(R.conflicts.map(x => ({ ...x, kind: 'conflict' })));
  const regulatory = { status: facts.length ? 'confirmed' : 'none_confirmed', market: plan.market, market_name: plan.market_name, as_of: asOf, topics, facts: regulatory_facts,
    sources_read, not_used, own_posts, hints, searched, required: topics.some(t => t.relevance === 'core') };
  regulatory.digest = REG.digest({ ...regulatory, topics: topics.map(t => ({ ...t })) });
  return one(regulatory, regulatory_facts, regulatory_sources);
} catch (e) {
  return one({ status: 'error', reason: 'the regulatory step failed and the page goes on without it: ' + String((e && e.message) || e).slice(0, 200), topics: [], facts: [], sources_read: [],
    not_used: [], own_posts: [], hints: [], digest: '' });
}
