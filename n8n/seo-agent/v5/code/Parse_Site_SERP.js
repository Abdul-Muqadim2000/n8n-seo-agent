/*__SERP_OBS__*/
/*__RANK_SERP__*/
// Locates the site in each SERP (top 50): one seo_rank_history row per keyword (ladder_id = site id, rung 0). position 0 = not in the top 50, -1 = check failed.
// G6 (2026-10-12 system review): the row carries the whole results page of the same call, like the Rank Tracker's rows — the features it
// showed (AI Overview and whether it cites us, snippet, People Also Ask, local pack, video), the top-10 domains with their positions,
// the competitors' positions, the modelled share of voice and a compact snapshot as proof. Every writer of the table writes every column.
// These checks are desktop (the mobile check is the ladder's main keywords, in the Rank Tracker).
const reqs = $('Site SERP Requests').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const now = new Date().toISOString();
return reqs.filter(q => !q.skip).map((r, i) => {
  const a = RS.read(res[i]);
  // SERP-GOTO (review H2 + re-review N1): "a result Google hid may be yours" (-1). From the third WEEK in a row of such readings (Site Plan's
  // unread_weeks; a failed API read is not one) the reading is settled: it stays -1, so nothing computes a drop from it, and carries `st: 1`,
  // which the report shows as "not found among the results we could read"
  const mine = RS.ourRank(a, r.domain);
  const settled = mine.position === -1 && !!mine.maybe_ours && Number(r.prev_unread) >= 2;
  const feats = RS.features(a, r.domain);
  const land = RS.landscape(a, r.domain, r.competitors || [], mine.position);
  const sov = RS.voice(land, feats, r.domain, mine.position);
  return { json: {
    ladder_id: String(r.site_id), keyword: String(r.keyword), checked_at: now, position: mine.position, url: mine.url,
    serp_features: RS.typeList(a), domain: String(r.domain || ''), rung: 0, device: 'desktop',
    features_json: RS.pack(feats, 1600),
    competitors_json: RS.pack({ our_position: mine.position > 0 ? mine.position : null, above: land.above.map(x => ({ d: x.domain, p: x.position, t: x.tracked })),
      competitors: land.competitors.map(x => ({ d: x.domain, p: x.position, t: x.tracked })), shares: sov.shares, tracked: land.tracked, method: sov.method }, 1800),
    snapshot_json: RS.pack({ ...RS.snapshot(a, land, feats, 'desktop'), ...(settled ? { st: 1 } : {}) }, 1800),
    share_of_voice: a.ok ? (sov.ours == null ? 0 : sov.ours) : -1 } };
});
