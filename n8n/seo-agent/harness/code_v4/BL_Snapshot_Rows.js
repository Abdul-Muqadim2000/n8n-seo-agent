// One seo_backlink_snapshots row per site per run (exact columns); lists are kept short.
return $('Parse Backlinks').all().map(i => { const s = i.json; const J = (o) => JSON.stringify(o);
  return { json: { site_id: s.site_id, domain: s.domain, checked_at: s.checked_at, mode: s.mode, rank: s.summary.rank, backlinks: s.summary.backlinks, referring_domains: s.summary.referring_domains, referring_domains_nofollow: s.summary.referring_domains_nofollow,
    spam_score: s.summary.spam_score, broken_backlinks: s.summary.broken_backlinks, new_links: s.new_links.length, lost_links: s.lost.length, important_lost: s.important_lost.length, spammy_new: s.spammy.length,
    lost_json: J(s.important_lost.slice(0, 20)), new_json: J(s.new_links.filter(l => !l.spammy).slice(0, 20)), competitors_json: J(s.competitors.map(d => ({ domain: d }))), timeseries_json: J(s.timeseries), cost_usd: s.cost_usd } }; });
