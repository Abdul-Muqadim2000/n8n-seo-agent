/*__SERP_OBS__*/
/*__RANK_SERP__*/
// Reads everything one rank check's results page showed (G6, 2026-10-12 system review): our position and ranking URL in the top 50, the
// SERP features (AI Overview — shown and whether it cites us —, featured snippet, People Also Ask, local pack, video, shopping), the
// top-10 domains with their positions, our competitors' positions, a modelled share of voice, and a compact snapshot of the top 10 kept
// as proof of the reading. All of it comes from the SERP call the check already pays for.
// One history row per check (the row is exactly the seo_rank_history columns, which the Save History node auto-maps).
// position 0 = not in the top 50, -1 = the check failed ("check again", never "does not rank"); share_of_voice -1 means the same.
const reqs = $('Tracker Plan').all().map(i => i.json);
const res = $input.all().map(i => i.json);
const now = new Date().toISOString();
return reqs.map((r, i) => {
  const a = RS.read(res[i]);
  // SERP-GOTO (2026-11-08, review H2 + re-review N1): a -1 that only means "a result Google hid might be yours". In the second WEEK in a row
  // Unread Alert Row (Tracker) raises one ops alert; from the third week the reading is SETTLED: it stays -1 (so no report, alert or chart
  // can compute a drop from it - the hidden result most likely IS ours) and carries `st: 1`, which every report shows as "not found among
  // the results we could read" instead of "check failed".
  const mine = RS.ourRank(a, r.domain);
  const settled = mine.position === -1 && !!mine.maybe_ours && String(r.device || 'desktop') !== 'mobile' && Number(r.prev_unread) >= 2;
  const feats = RS.features(a, r.domain);
  const land = RS.landscape(a, r.domain, r.competitors || [], mine.position);
  const sov = RS.voice(land, feats, r.domain, mine.position);
  const device = String(r.device || 'desktop');
  return { json: {
    // every row of one run shares the run's timestamp (the series and the "last 4 checks" rule depend on it); the moment Google's page
    // was really read travels in features_json.checked_at and in the snapshot, so a reading can still be dated exactly.
    ladder_id: String(r.ladder_id), keyword: String(r.keyword), checked_at: now,
    position: mine.position, url: mine.url, serp_features: RS.typeList(a), domain: String(r.domain || ''), rung: Number(r.rung) || 0,
    device,
    features_json: RS.pack(feats, 1600),
    competitors_json: RS.pack({ our_position: mine.position > 0 ? mine.position : null, above: land.above.map(x => ({ d: x.domain, p: x.position, t: x.tracked })),
      competitors: land.competitors.map(x => ({ d: x.domain, p: x.position, t: x.tracked })), shares: sov.shares, tracked: land.tracked, method: sov.method }, 1800),
    snapshot_json: RS.pack({ ...RS.snapshot(a, land, feats, device), ...(settled ? { st: 1 } : {}) }, 1800),
    share_of_voice: a.ok ? (sov.ours == null ? 0 : sov.ours) : -1 } };
});
