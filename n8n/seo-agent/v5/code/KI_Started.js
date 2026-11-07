// KI Started (E2, 2026-11-08, CONTRACTS.md §4): the started notice (`ki_competitors_started` / `ki_research_started`, status accepted), sent
// once the run has passed every gate and holds its ledger row, so a run the guards refuse is never announced as started.
/*__KI_KITS__*/
const p = $('KI Plan').first().json || {};
const STAGE = { competitors: 'ki_competitors_started', keyword_research: 'ki_research_started' };
return [{ json: { callback_url: p.callback_url || '', callback_body: { stage: STAGE[p.kind] || 'ki_competitors_started', status: 'accepted', request_id: KIW.S(p.request_id),
  run_id: KIW.S(p.run_id), domain: KIW.S(p.domain), market: KIW.S(p.market), mode: KIW.S(p.ki_mode), rule_version: KIW.RULE } } }];
