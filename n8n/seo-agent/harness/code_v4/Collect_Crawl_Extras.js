// Consolidates the extra On-Page reports into one object. Every report is optional.
const base = $('Check Crawl').first().json;
const reqs = $('Crawl Extra Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);

const extras = { duplicate_title: [], duplicate_description: [], non_indexable: [], redirect_chains: [], errors: [] };
reqs.forEach((r, i) => {
  const j = res[i] || {};
  const task = j.tasks?.[0] || {};
  if (j.error || (task.status_code && task.status_code >= 40000)) {
    extras.errors.push(r.extra + ': ' + (task.status_message || (j.error && j.error.message) || 'failed'));
    return;
  }
  const items = task.result?.[0]?.items || [];
  if (r.extra === 'duplicate_title' || r.extra === 'duplicate_description') {
    extras[r.extra] = items.map(it => ({
      text: String(it.accumulator || it.tag || it.value || '').slice(0, 120),
      count: it.total_count ?? (it.pages || []).length,
      urls: (it.pages || []).map(p => p.url || p.page_url || p).filter(Boolean).slice(0, 5)
    })).filter(x => x.count > 1 || x.urls.length > 1);
  } else if (r.extra === 'non_indexable') {
    extras.non_indexable = items.map(it => ({ url: it.url, reason: it.reason || it.non_indexable_reason || 'unknown', status: it.status_code ?? null })).filter(x => x.url);
  } else if (r.extra === 'redirect_chains') {
    extras.redirect_chains = items.map(it => {
      const chain = it.chain || it.redirect_chain || it.items || [];
      return { start: it.url || (chain[0] && (chain[0].url || chain[0])) || '', hops: chain.length, chain: chain.map(c => c.url || c).filter(Boolean).slice(0, 6) };
    }).filter(x => x.hops >= 2);
  }
});

return [{ json: { ...base, crawl_extras: extras } }];
