// Monthly Search Console check-in: the two yes/no answers plus the optional "Pages" export (Table.csv: Reason, Source, Validation, Trend, Pages;
// a per-reason URL list: URL, Last crawled; or Chart.csv: Date, Not indexed, Indexed) -> one row per site and month, and the summary shown back.
const d = $('Normalize Input').first().json;
const text = String(d.checkin_csv_text || '');
const parseCsv = (t) => { const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell.length || row.length) { row.push(cell); rows.push(row); } return rows.filter(r => r.some(x => String(x).trim())); };
const rows = text ? parseCsv(text.replace(/^﻿/, '')) : [];
const header = rows.length ? rows[0].map(h => String(h).trim().toLowerCase()) : [];
const col = (name) => header.findIndex(h => h === name || h.startsWith(name));
const num = (v) => Number(String(v == null ? '' : v).replace(/[^0-9]/g, '')) || 0;
const coverage = { kind: 'none', reasons: [], urls: [], not_indexed_total: null, indexed_total: null, rows: rows.length ? rows.length - 1 : 0 };
if (rows.length > 1 && col('reason') >= 0) { const ri = col('reason'), si = col('source'), pi = col('pages'), vi = col('validation');
  coverage.kind = 'reasons'; coverage.reasons = rows.slice(1).map(r => ({ reason: String(r[ri] || '').trim(), source: si >= 0 ? String(r[si] || '').trim() : '', validation: vi >= 0 ? String(r[vi] || '').trim() : '', pages: pi >= 0 ? num(r[pi]) : 0 })).filter(x => x.reason).sort((a, b) => b.pages - a.pages).slice(0, 30);
  coverage.not_indexed_total = coverage.reasons.reduce((n, x) => n + x.pages, 0); }
else if (rows.length > 1 && col('url') >= 0) { const ui = col('url'), li = col('last crawled'); coverage.kind = 'urls'; coverage.urls = rows.slice(1).map(r => ({ url: String(r[ui] || '').trim(), last_crawled: li >= 0 ? String(r[li] || '').trim() : '' })).filter(x => /^https?:\/\//.test(x.url)).slice(0, 200); coverage.not_indexed_total = coverage.urls.length; }
else if (rows.length > 1 && col('date') >= 0) { const ni = header.findIndex(h => /not indexed/.test(h)), ii = header.findIndex(h => /^indexed/.test(h)); const last = rows[rows.length - 1]; coverage.kind = 'chart'; coverage.not_indexed_total = ni >= 0 ? num(last[ni]) : null; coverage.indexed_total = ii >= 0 ? num(last[ii]) : null; }
const now = new Date().toISOString(); const month = now.slice(0, 7);
const site_id = 'site_' + String(d.domain || '').replace(/[^a-z0-9]+/g, '-');
const row = { site_id, domain: String(d.domain || ''), month, manual_action: !!d.checkin_manual_action, security_issue: !!d.checkin_security_issue, notes: String(d.checkin_notes || '').slice(0, 1000), coverage_json: JSON.stringify(coverage).slice(0, 20000), not_indexed_total: coverage.not_indexed_total == null ? -1 : coverage.not_indexed_total, csv_kind: coverage.kind, submitted_at: now, source: d.via_webhook ? 'api' : 'form', request_id: String(d.request_id || '') };
const lines = [];
lines.push(row.manual_action ? 'Manual action reported: rankings stay suppressed until it is fixed. Open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then click Request review.' : 'No manual action reported.');
lines.push(row.security_issue ? 'Security issue reported: clean the site (malware, injected or deceptive content), update the CMS and plugins, change passwords, then request a review under Security issues.' : 'No security issue reported.');
if (coverage.kind === 'reasons') lines.push('Pages report: ' + coverage.not_indexed_total + ' pages not indexed across ' + coverage.reasons.length + ' reason(s); largest: ' + coverage.reasons.slice(0, 3).map(x => x.reason + ' (' + x.pages + ')').join(', ') + '.');
else if (coverage.kind === 'urls') lines.push('URL list uploaded: ' + coverage.urls.length + ' URLs.');
else if (coverage.kind === 'chart') lines.push('Pages chart: ' + coverage.indexed_total + ' indexed, ' + coverage.not_indexed_total + ' not indexed on the last date.');
else if (text) lines.push('The uploaded CSV was not recognised as a Search Console Pages export (expected columns Reason / Pages, URL / Last crawled, or Date / Indexed / Not indexed).');
else lines.push('No Pages report uploaded (optional).');
lines.push('Recorded for ' + month + '; the Monday report includes it and the reminder stops for this month.');
return [{ json: { ...d, checkin_row: row, coverage, summary_lines: lines, plain: lines.join('\n'), checkin_month: month, site_id } }];
