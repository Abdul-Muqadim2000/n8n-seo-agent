// API delivery for "suggest keywords": the keyword strategy (JSON + PDF + Word) goes to the callback.
// If content or an audit was also requested, those arrive later as separate callbacks (stage: content / site_audit).
const item = $input.first(); const d = item.json; const ks = d.keyword_strategy || {}; const bin = item.binary || {};
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const cpc2 = (v) => (v == null || isNaN(Number(v))) ? null : Math.round(Number(v) * 100) / 100;   // D20: DataForSEO CPCs are float32 (13.65999984741211)
const pick = (k) => ({ keyword: k.keyword, volume: k.volume, kd: k.kd, cpc: cpc2(k.cpc), intent: k.intent, page_type: k.page_type, topic: k.topic, traffic_potential: k.traffic_potential, opportunity: k.opportunity, ai_search_volume: k.ai_search_volume ?? null, serp_features: k.serp_types || [], why: k.why || null, live: k.live || null,
  difficulty_for_you: k.difficulty_for_you || null, plan_type: k.plan_type || null, months: k.months || null, label: k.for_you_label || null, chance: k.chance || null,
  covered_by: k.covered_by || null, ladder_covered: k.ladder_covered || null,
  // G8 (2026-10-13): whether the traffic number was calibrated against this site's Search Console data or modelled (K2), what
  // Search Console measured for the search (K6), and the keywords that share its results page (K7)
  traffic_basis: k.traffic_basis || null, traffic_note: k.traffic_note || null, modelled_traffic_potential: k.modelled_traffic_potential ?? null,
  gsc: k.gsc || null, serp_cluster: k.serp_cluster || null });   // D11 / D20: a live page or one of the site's ladders already covers this search   // v4.8: for this site (null without a website); G3: the chance band
const pdfData = bin.pdf ? await b64('pdf', bin.pdf) : null;
const docData = bin.data ? await b64('data', bin.data) : null;
return [{ json: {
  status: 'completed', stage: 'keyword_strategy', request_id: d.request_id || null, execution_id: $execution.id, domain: d.domain || null, country: d.country, goal: ks.goal || d.goal,
  summary: { keywords_researched: ks.pool_size, ai_reviewed: ks.ai_reviewed, relevant: ks.total_relevant, clusters: (ks.clusters || []).length, competitors: ks.competitor_domains || [] },
  start_with: ks.pipeline_keyword ? pick(ks.pipeline_keyword) : null,
  priority: (ks.priority || []).map(pick),
  content_plan: (ks.clusters || []).slice(0, 20).map(c => ({ tier: c.tier, topic: c.topic, primary_keyword: c.primary_keyword, page_type: c.page_type, keyword_count: c.keyword_count, total_volume: c.total_volume, supporting: c.supporting,
    primary_kd: c.primary_kd ?? null, difficulty_for_you: c.difficulty_for_you || null, plan_type: c.plan_type || null, months: c.months || null, label: c.for_you_label || null })),
  reach: ks.reach || null,
  quick_wins: (ks.quick_wins || []).map(pick), questions: (ks.questions || []).map(k => k.keyword), competitor_gaps: (ks.competitor_gaps || []).slice(0, 15).map(pick),
  ai_demand: ks.ai_demand || null, research_failures: ks.research_failures || [], refused: ks.refused || [], covered: ks.covered || [], ladder_covered: ks.ladder_covered || [],   // D4 (2026-10-11): government / portal / other-brand keywords left out, with a reason
  // G8 (2026-10-13): the three new research inputs — the site's own Search Console searches (K6), the groups one page can
  // serve (K7) and how many keywords were checked live on Google (K4)
  search_console: ks.search_console ? { available: !!ks.search_console.available, period_end: ks.search_console.period_end || '', period_days: ks.search_console.period_days ?? 28,
    page_check: ks.search_console.page_check || '', pages_known: ks.search_console.pages_known ?? 0, seeded: ks.search_console.seeded || [], dropped: ks.search_console.dropped || null,
    min_impressions: ks.search_console.min_impressions ?? null, striking_min: ks.search_console.striking_min ?? null, striking_max: ks.search_console.striking_max ?? null,
    no_page: (ks.search_console.no_page || []).slice(0, 20), striking: (ks.search_console.striking || []).slice(0, 20), answered: (ks.search_console.answered || []).slice(0, 10),
    mismatch: (ks.search_console.mismatch || []).slice(0, 20) } : null,   // R12: the page that gets the impressions targets something else
  serp_clusters: (ks.serp_clusters || []).slice(0, 10), serp_overlap: ks.serp_overlap || null, live_checks: ks.live_checks || null,
  follow_ups: { content: !!(d.include_content || d.include_seo_report), audit: !!d.include_audit },
  run_ledger: d.run_ledger || null,
  pdf: pdfData ? { data: pdfData, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
  file: docData ? { data: docData, fileName: bin.data.fileName || d.file_name, mimeType: 'application/msword' } : null,
  callback_url: d.callback_url || ''
} }];
