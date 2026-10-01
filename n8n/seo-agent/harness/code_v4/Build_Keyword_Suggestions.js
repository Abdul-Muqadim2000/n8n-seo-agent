const base = $('Seed List').first().json;
const ideaItems = $('Discover Ideas').first().json.tasks?.[0]?.result?.[0]?.items || [];
const cands = $('Rank Candidates').all().map(i => i.json);
const serps = $input.all().map(i => i.json);
const INTENTS = ['informational', 'navigational', 'commercial', 'transactional'];
const brand = String(base.domain || '').split('.')[0].toLowerCase();
const ours = String(base.domain || '').toLowerCase();

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => (n == null || isNaN(n)) ? 'N/A' : Number(n).toLocaleString('en-GB');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const diffLabel = (v) => v == null ? 'N/A' : v + (v < 30 ? ' · easy' : v < 50 ? ' · medium' : v < 70 ? ' · hard' : ' · very hard');

const classify = (kw, intent) => {
  if (INTENTS.includes(intent)) return intent;
  const k = String(kw).toLowerCase();
  if (brand && k.includes(brand)) return 'navigational';
  if (/\b(price|pricing|cost|costs|buy|hire|quote|near me|licen[cs]e|subscription|free trial|demo)\b/.test(k)) return 'transactional';
  if (/\b(best|top|vs|versus|compare|comparison|review|reviews|alternatives?|services?|company|companies|agency|partner|partners|consultants?|consulting|providers?|firms?)\b/.test(k)) return 'commercial';
  return 'informational';
};

const seen = new Set();
const all = [];
ideaItems.forEach(it => {
  const kd = it.keyword_data || it;
  const kw = String(kd.keyword || '').toLowerCase().trim();
  if (!kw || seen.has(kw)) return;
  seen.add(kw);
  const info = kd.keyword_info || {};
  if (!info.search_volume) return;
  all.push({ keyword: kw, volume: info.search_volume, difficulty: (kd.keyword_properties || {}).keyword_difficulty ?? null,
    cpc: info.cpc ?? null, intent: classify(kw, (kd.search_intent_info || {}).main_intent) });
});
const by_intent = {};
INTENTS.forEach(x => {
  by_intent[x] = all.filter(k => k.intent === x).sort((a, b) => b.volume - a.volume).slice(0, 8);
});

const recommended = cands.filter(c => !c.fallback).map((c, i) => {
  const items = serps[i]?.tasks?.[0]?.result?.[0]?.items || [];
  const organic = items.filter(x => x.type === 'organic');
  const top = organic.slice(0, 3).map(o => String(o.domain || '').replace(/^www\./, ''));
  const mine = ours ? organic.find(o => String(o.domain || '').replace(/^www\./, '').endsWith(ours)) : null;
  let why = '';
  if (c.difficulty != null && c.difficulty < 30) why = 'Low competition with real demand — a strong first target.';
  else if (c.intent === 'transactional') why = 'Buyers searching this are ready to act.';
  else if (c.intent === 'commercial') why = 'Buyers comparing providers — good for a service page.';
  else why = 'Good for a helpful guide that builds trust and links to your services.';
  return { ...c, top_domains: top, your_position: mine ? mine.rank_group : null, why };
});

const easy = all.filter(k => k.difficulty != null && k.difficulty < 30 && k.intent !== 'navigational')
  .sort((a, b) => b.volume - a.volume).slice(0, 8);

// ---------- Topic clusters (greedy, token overlap) ----------
const STOP = new Set(['the','a','an','and','or','of','for','to','in','on','with','by','at','from','your','our','is','are','near','me','vs','what','how','best','top']);
const toks = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)).map(t => t.replace(/(ies|es|s)$/, ''));
const clusters = [];
for (const k of [...all].sort((a, b) => b.volume - a.volume)) {
  if (k.intent === 'navigational') continue;
  const t = new Set(toks(k.keyword));
  let home = null;
  for (const c of clusters) {
    const shared = [...t].filter(x => c.tokens.has(x)).length;
    const need = Math.min(2, Math.min(t.size, c.tokens.size));
    if (shared >= need && shared > 0 && c.intent === k.intent && c.keywords.length < 12) { home = c; break; }
  }
  if (home) { home.keywords.push(k); home.volume += k.volume; }
  else clusters.push({ head: k.keyword, tokens: t, keywords: [k], volume: k.volume, intent: k.intent });
}
const topic_clusters = clusters
  .filter(c => c.keywords.length >= 2)
  .sort((a, b) => b.volume - a.volume)
  .slice(0, 8)
  .map(c => ({
    topic: c.head,
    total_volume: c.volume,
    keyword_count: c.keywords.length,
    suggested_page: c.keywords.some(k => k.intent === 'informational') && !c.keywords.some(k => k.intent !== 'informational') ? 'Guide / blog post' : 'Service or landing page (+ supporting guide)',
    keywords: c.keywords.slice(0, 8).map(k => k.keyword)
  }));

const table = (list, withIntent) => list.length
  ? `<table class="t"><tr><th>Keyword</th><th>Searches/mo</th><th>Difficulty</th><th>CPC $</th>${withIntent ? '<th>Intent</th>' : ''}</tr>` +
    list.map(k => `<tr><td>${esc(k.keyword)}</td><td>${num(k.volume)}</td><td>${diffLabel(k.difficulty)}</td><td>${k.cpc == null ? '—' : k.cpc}</td>${withIntent ? '<td>' + cap(k.intent) + '</td>' : ''}</tr>`).join('') + `</table>`
  : '<p class="muted">No keywords with measurable search volume found.</p>';

const DESC = {
  informational: 'People researching or learning. Best for guides and blog posts.',
  navigational: 'People looking for a specific brand or website.',
  commercial: 'People comparing providers. Best for service and comparison pages.',
  transactional: 'People ready to buy, hire or ask for a price. Best for service and pricing pages.'
};

const html = `
<style>
  .w{font-family:Arial,sans-serif;max-width:860px;margin:0 auto;color:#1e293b;text-align:left;line-height:1.55;padding:24px 20px}
  h1{font-size:24px;margin:0 0 4px;color:#0f172a} h2{font-size:17px;color:#1e3a8a;margin:26px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .muted{color:#64748b;font-size:13px} .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:10px 0}
  .kw{font-size:17px;font-weight:bold;color:#0f172a} .pill{display:inline-block;background:#e0e7ff;color:#1e3a8a;border-radius:20px;padding:2px 10px;font-size:12px;margin-right:6px}
  .t{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0} .t th{background:#1e3a8a;color:#fff;text-align:left;padding:7px} .t td{border:1px solid #e2e8f0;padding:7px}
  .by{color:#64748b;font-size:12px;margin-top:24px}
</style>
<div class="w">
  <h1>Keyword ideas${base.domain ? ' for ' + esc(base.domain) : ''}</h1>
  <p class="muted">${esc(base.country)} · based on: ${esc(base.seeds.slice(0, 8).join(', '))}</p>

  <h2>Top ${recommended.length} keywords to target first</h2>
  ${recommended.map((k, i) => `<div class="card">
    <div class="kw">${i + 1}. ${esc(k.keyword)}</div>
    <p><span class="pill">${num(k.volume)} searches/mo</span><span class="pill">Difficulty ${diffLabel(k.difficulty)}</span><span class="pill">${cap(k.intent)}</span>${k.cpc != null ? '<span class="pill">CPC $' + k.cpc + '</span>' : ''}</p>
    <p>${esc(k.why)}</p>
    <p class="muted"><b>Who ranks now:</b> ${esc(k.top_domains.join(', ') || 'unknown')}${base.domain ? ' · <b>Your position:</b> ' + (k.your_position ? '#' + k.your_position : 'not in top 10') : ''}</p>
  </div>`).join('') || '<p class="muted">Not enough data to recommend keywords.</p>'}

  <h2>Easy wins (low difficulty)</h2>
  ${table(easy, true)}

  <h2>Topic clusters (one page per cluster)</h2>
  <p class="muted">Keywords that share the same intent and topic should be targeted by one strong page, not several thin ones.</p>
  ${topic_clusters.length ? `<table class="t"><tr><th>Cluster</th><th>Total searches/mo</th><th>Keywords</th><th>Suggested page</th></tr>` + topic_clusters.map(c => `<tr><td><b>${esc(c.topic)}</b></td><td>${num(c.total_volume)}</td><td>${esc(c.keywords.join(', '))}</td><td>${esc(c.suggested_page)}</td></tr>`).join('') + `</table>` : '<p class="muted">Not enough related keywords to form clusters.</p>'}

  ${INTENTS.map(x => `<h2>${cap(x)} keywords</h2><p class="muted">${DESC[x]}</p>${table(by_intent[x], false)}`).join('')}

  <p class="by">Prepared by ${esc(base.brand || 'Dev SEO')} · Search volumes and difficulty from DataForSEO for ${esc(base.country)}.</p>
</div>`;

return [{
  json: {
    ...base,
    keyword_suggestions: { recommended, easy_wins: easy, by_intent, topic_clusters, total_found: all.length },
    result_html: html
  }
}];