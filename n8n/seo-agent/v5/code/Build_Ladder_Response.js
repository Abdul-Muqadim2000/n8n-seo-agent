// API delivery for ladder mode: the plan (JSON + PDF + Word) goes to the callback. The pages written now arrive later
// as separate callbacks (stage: content) carrying the same request_id and ladder_id.
const item = $input.first(); const d = item.json; const L = d.ladder || {}; const bin = item.binary || {};
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const pdfData = bin.pdf ? await b64('pdf', bin.pdf) : null;
const docData = bin.data ? await b64('data', bin.data) : null;
const page = (p) => ({ page_no: p.page_no, rung: p.rung, keyword: p.keyword, supporting: p.supporting, page_type: p.page_type, intent: p.intent, volume: p.volume, total_volume: p.total_volume, kd: p.kd, traffic_potential: p.traffic_potential, your_position: p.your_position, exists: p.exists, target_url: p.target_url, status: p.status, links_to: p.links_to, months: p.months || null });
return [{ json: {
  status: 'completed', stage: 'ladder_plan', request_id: d.request_id || null, execution_id: $execution.id, ladder_id: L.ladder_id || d.ladder_id || null,
  keyword: d.keyword, domain: d.domain, country: d.country, goal: L.goal, head: L.head || null, feasibility: L.feasibility || null,
  rungs: (L.rungs || []).map(r => ({ rung: r.rung, label: r.label, months: r.months, available_keywords: r.available, pages: (r.pages || []).map(page) })),
  top_page: (L.top && L.planned !== false) ? page(L.top) : null, link_map: L.link_map || [], timeline: L.timeline || [], write_now: L.write_now || [], pages_started: (L.write_now || []).slice(0, Number(d.pages_now) || 1).map(w => w.keyword),
  later: L.later || [], requirements: L.requirements || [], stats: L.stats || null, notes: L.notes || [], tracker: L.tracker || null,
  // v4.8 (PIPELINE_FEATURE_SPEC §5.3-5.5): the plan for this site
  plan_type: L.plan_type || null, difficulty_for_you: L.difficulty_for_you || null, reach: L.reach ?? null, months: L.months || '', months_range: L.months_range || null, stretch: !!L.stretch,
  label: L.label || '', order: L.order || '', planned: L.planned !== false, refusal: L.refusal || null, reach_info: L.reach_info || null, excluded_keywords: L.excluded_keywords || [],
  settings_registered: !!d.settings_registered, settings_error: d.settings_error || null,
  tracking_registered: !!d.tracking_registered, stored_rows: d.stored_rows || 0, store_error: d.store_error || null, run_ledger: d.run_ledger || null, emailed_to: d.email || null,
  pdf: pdfData ? { data: pdfData, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
  file: docData ? { data: docData, fileName: bin.data.fileName || d.file_name, mimeType: 'application/msword' } : null,
  callback_url: d.callback_url || ''
} }];
