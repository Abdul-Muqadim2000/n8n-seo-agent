// Locates the client's domain in each SERP (top 50): position, ranking URL and the features present.
// One history row per keyword; position 0 = not in the top 50, -1 = the check failed.
const reqs = $('Tracker Plan').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const now = new Date().toISOString();
const normD = (x) => String(x || '').toLowerCase().replace(/^www\./, '');
return reqs.map((r, i) => {
  const items = res[i]?.tasks?.[0]?.result?.[0]?.items || [];
  const ours = normD(r.domain);
  const organic = items.filter(x => x.type === 'organic');
  const mine = organic.find(o => { const dd = normD(o.domain); return dd === ours || dd.endsWith('.' + ours); });
  const feats = [...new Set(items.map(x => x.type))].filter(t => t !== 'organic');
  const err = !res[i] || res[i].error || (((res[i].tasks || [])[0] || {}).status_code >= 40000);
  return { json: { ladder_id: String(r.ladder_id), keyword: String(r.keyword), checked_at: now, position: mine ? Number(mine.rank_group) : (err ? -1 : 0), url: mine ? String(mine.url || '') : '', serp_features: feats.join(','), domain: String(r.domain || ''), rung: Number(r.rung) || 0 } };
});
