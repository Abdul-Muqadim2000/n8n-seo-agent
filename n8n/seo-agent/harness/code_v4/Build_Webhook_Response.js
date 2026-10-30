const item = $input.first();
const d = item.json;
const bin = item.binary && item.binary.data ? item.binary.data : null;
const pdfBin = item.binary && item.binary.pdf ? item.binary.pdf : null;
// Binary content: code-created binaries carry base64 in .data; binaries written by HTTP nodes are stored on disk and .data
// is only a reference, so read the bytes through the helper and fall back to .data when it already looks like base64.
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const docData = bin ? await b64('data', bin) : null;
// G30 (2026-10-13): the produced images (WebP cards built from this page) travel in the callback like the PDF; the app stores every
// embedded file of a callback and offers it for download next to the article.
const imgPlan = ((d.article_meta || {}).images) || [];
const images = [];
for (const k of Object.keys(item.binary || {}).filter(x => /^image_\d+$/.test(x)).sort()) {
  const b = item.binary[k]; const data = await b64(k, b);
  const plan = imgPlan.find(p => p && p.binary_key === k) || {};
  if (data) images.push({ data, fileName: b.fileName || (k + '.webp'), mimeType: b.mimeType || 'image/webp',
    alt_text: plan.alt_text || '', caption: plan.caption || '', width: plan.width ?? null, height: plan.height ?? null, purpose: plan.purpose || '' });
}
const pdfData = pdfBin ? await b64('pdf', pdfBin) : null;

return [{
  json: {
    status: 'completed',
    stage: 'content',
    ladder_id: d.ladder_id || null,
    ladder_rung: d.ladder_rung ?? null,
    ladder_head: d.ladder_head || null,
    request_id: d.request_id || null,
    execution_id: $execution.id,
    verdict: d.verdict,
    score: d.verdict_score,
    score_withheld: !!d.score_withheld,
    ...(() => { let pv = {}; try { pv = $('Parse Verdict').first().json || {}; } catch (e) { pv = {}; }   // W0-D (section 153)
      const g = (k) => (d[k] !== undefined ? d[k] : pv[k]);
      return { hold: g('hold') || null, hold_shadow: g('hold_shadow') || null, verdict_acknowledged: g('verdict_acknowledged') === true,
        hold_exempt: g('hold_exempt') || '', hold_not_checked: g('hold_not_checked') || '',
        verdict_readings: g('verdict_readings') || null, existing_page_unconfirmed: g('existing_page_unconfirmed') || null,
        // W07-A (section 179): the pages the verdict stands on could not be read (the page reader refused, its fallback failed too)
        pages_unread: g('pages_unread') ? { reason: String(g('pages_unread').reason || ''), client_reason: String(g('pages_unread').client_reason || ''), missing: g('pages_unread').missing || [],
          existing: g('pages_unread').existing || null, client: g('pages_unread').client || null, competitors: g('pages_unread').competitors || null } : null,
        existing_page_unread: g('existing_page_unread') || null }; })(),   // W05-B (section 175)
    evidence: d.verdict_evidence || null,
    reasons: d.verdict_reasons || [],
    risks: d.verdict_risks || [],
    recommended_page: d.recommended_page,
    secondary_keywords: d.secondary_keywords || [],
    keyword_data: d.keyword_data || null,
    existing_page: d.existing_page || null,
    qa_summary: d.qa_summary || null,
    // R11 (2026-10-13): the app shows the last quality round's verdict, not a count of warnings
    qa_publishable: d.qa_publishable == null ? null : !!d.qa_publishable,
    qa_not_ready: !!d.qa_not_ready, qa_label: d.qa_label || null, qa_reasons: d.qa_reasons || [], qa_quality: d.qa_quality || null,
    qa_next_step: d.qa_next_step || null, qa_owner_edits: d.qa_owner_edits || [],
    qa_delivery_status: d.qa_delivery_status || null, qa_client_questions: d.qa_client_questions || [], qa_grade: d.qa_grade || null,   // H1 (2026-10-27): for the app's approval and questions (H3)
    qa_blocking: d.qa_blocking || [], qa_advisory: d.qa_advisory || [], qa_second_read: d.qa_second_read || null,   // W0-H (section 158)
    ...(() => {   // W0-B (section 155): the page-run context's grading fields, so the final version is judged like the page run
      if (!(d.article_markdown || d.page_markdown)) return { page_run: null };
      let pb = {}, cq = {}; try { pb = $('Parse Brief').first().json || {}; } catch (e) { pb = {}; }
      try { cq = ($('Page Candidates').first().json || {}).content_qa || {}; } catch (e) { cq = {}; }
      const A = (v) => (Array.isArray(v) ? v : []); const T = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
      const br = pb.content_brief || {}; const lbq = cq.length_band || (pb.competitor_analysis || {}).length_band || pb.length_band || null;
      const target = Number(br.target_word_count) > 0 ? Math.round(Number(br.target_word_count)) : (lbq && Number(lbq.target_word_count) > 0 ? Math.round(Number(lbq.target_word_count)) : null);
      const length_band = lbq && Number(lbq.low) > 0 && Number(lbq.high) >= Number(lbq.low) ? { low: Number(lbq.low), high: Number(lbq.high), source: lbq.source || (lbq.ok ? 'ranking_pages' : 'page_type'), sample: Number(lbq.sample) || 0, basis: T(lbq.basis, 400), target } : null;
      let reg = pb.regulatory || null; if (!reg) { try { reg = $('Collect Regulatory Facts').first().json.regulatory || null; } catch (e) { reg = null; } }
      const regFacts = A(pb.regulatory_facts).length ? A(pb.regulatory_facts) : A((reg || {}).facts);
      return { page_run: { prc: 1,
        length_band,
        coverage_target: pb.coverage_target && typeof pb.coverage_target === 'object' ? pb.coverage_target : null,
        terms: A(br.terms_to_use).map(t => (typeof t === 'string' ? { term: t, min_count: 1 } : { term: T((t || {}).term, 80), min_count: Number((t || {}).min_count) || 1 })).filter(t => t.term).slice(0, 80),
        facts: A(pb.facts).filter(f => f && typeof f === 'object').map(f => ({ claim: T(f.claim || f.text, 600), source: T(f.source, 120), url: T(f.url, 600), title: T(f.title, 200), ...(f.regulatory ? { regulatory: true } : {}) })).filter(f => f.claim || f.url).slice(0, 40),
        sources_cited: A(cq.sources_cited).filter(x => x && x.url).map(x => ({ anchor: T(x.anchor, 200), url: T(x.url, 600), host: T(x.host, 120), tier: x.tier == null ? null : x.tier })).slice(0, 30),
        style_guide: pb.style_guide && typeof pb.style_guide === 'object' ? pb.style_guide : { on_file: false },
        site_urls: A(pb.site_urls).map(u => String(u || '')).filter(u => /^https?:\/\//i.test(u)).slice(0, 300),
        serp_shapes: pb.serp_shapes || cq.serp_shapes || null,
        regulatory_facts: regFacts.slice(0, 40), regulatory_topics: A((reg || {}).topics).map(t => ({ id: T((t || {}).id, 60), relevance: T((t || {}).relevance, 20) })).filter(t => t.id).slice(0, 12),
        // W06-C (section 178): what the run took out of the page (the counts the delivered grade capped on, the share of the words and why), so
        // the final version keeps the cap while those sections are missing; null from a check before W06-C (the final version says "not checked")
        sections_removed: (() => { const dl = cq.delivery || {}; const ch = dl.changes || {}; const rr = ch.removed_run; if (!rr || typeof rr !== 'object') return null;
          const N = (v) => Math.max(0, Math.round(Number(v) || 0)); const gr = (dl.grade || {}).removed || null;
          const byEdits = N(rr.h2_before) > 0 ? Math.max(0, N(rr.h2_before) - N(rr.h2_removed) - N(rr.h2_now)) : 0;
          return { sections: N(rr.sections), words: N(rr.words), words_before: N(rr.words_before), h2_before: N(rr.h2_before), h2_removed: N(rr.h2_removed), h2_delivered: N(rr.h2_now),
            by_edits: gr && gr.by_edits != null ? N(gr.by_edits) : byEdits, share_pct: N(rr.words_before) && N(rr.words) ? Math.round(100 * N(rr.words) / N(rr.words_before)) : 0, capped: !!(gr && gr.capped),
            list: A(ch.sections_removed).filter(x => x && x.heading).map(x => ({ heading: T(x.heading, 200), topic: T(x.topic, 120), words: N(x.words), level: N(x.level), why: T(x.why || x.signal, 200) })).slice(0, 12) }; })(),
        // W05-A (section 172): the second read's advice (enforce mode, read and checked), so the final version keeps its deduction while the words are there
        second_read: (() => { const R = d.qa_second_read || null; if (!R || R.mode !== 'enforce' || R.status !== 'checked') return null;
          return A(R.advice).filter(a => a && a.location).map(a => ({ severity: T(a.severity, 10), kind: T(a.kind, 20), location: T(a.location, 300) })).slice(0, 12); })(),
        content_request_id: T(pb.content_request_id || d.request_id, 120) } }; })(),   // 2026-10-21: what to edit by hand (the app's Needs-you can say it instead of "run it again")
    run_ledger: d.run_ledger || null,
    dfs_tasks: (d.run_ledger || {}).dataforseo_tasks ?? null,
    markdown: d.article_markdown || d.page_markdown || null,
    html: d.article_html || null,
    meta: d.article_meta || null,
    images: images.length ? images : null,
    emailed_to: d.email || null,
    callback_url: d.callback_url || '',
    keyword: d.keyword,
    domain: d.domain,
    country: d.country,
    pdf: pdfData ? { data: pdfData, fileName: pdfBin.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
    file: docData ? {
      data: docData,
      fileName: bin.fileName || d.file_name,
      mimeType: bin.mimeType || 'application/msword'
    } : null
  }
}];