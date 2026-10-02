// API delivery for audits: scores, counts and the report files go to the callback (the e-mail is still sent).
const item = $input.first(); const d = item.json; const bin = item.binary || {};
const b64 = async (prop, b) => { try { const buf = await this.helpers.getBinaryDataBuffer(0, prop); if (buf && buf.length) return buf.toString('base64'); } catch (e) {} return (b && b.data && String(b.data).length > 100) ? b.data : null; };
const pdfData = bin.pdf ? await b64('pdf', bin.pdf) : null;
const docData = bin.data ? await b64('data', bin.data) : null;
return [{ json: {
  status: 'completed', stage: /full/i.test(d.report_title || '') ? 'full_report' : 'site_audit', request_id: d.request_id || null, execution_id: $execution.id,
  domain: d.domain, health_score: d.health_score,
  search_console: d.search_console ? { connected: d.search_console.connected, property: d.search_console.property, error: d.search_console.error || null, totals: d.search_console.totals, sitemaps: d.search_console.sitemaps, coverage: d.search_console.coverage, not_indexed: d.search_console.not_indexed, canonical_mismatch: d.search_console.canonical_mismatch, top_queries: d.search_console.top_queries, top_pages: d.search_console.top_pages, rich_results: d.search_console.rich_results } : null,
  site_structure: d.site_structure || null,
  ...(() => { try { const r = $('Restore Audit Item').first().json; const a = r.site_audit || {}; return { audit_id: r.audit_id, audit_diff: a.audit_diff || null, internal_links: a.internal_links || [], entity: a.entity || null, fix_pack: r.fix_pack || null }; } catch (e) { return {}; } })(), grade: d.grade, issue_counts: d.issue_counts, top_issues: d.top_issues, emailed_to: d.email || null, run_ledger: d.run_ledger || null,
  pdf: pdfData ? { data: pdfData, fileName: bin.pdf.fileName || d.pdf_file_name, mimeType: 'application/pdf' } : null,
  file: docData ? { data: docData, fileName: bin.data.fileName || d.file_name, mimeType: 'application/msword' } : null,
  callback_url: d.callback_url || ''
} }];
