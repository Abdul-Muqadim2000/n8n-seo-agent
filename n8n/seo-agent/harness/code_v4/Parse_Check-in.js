// Monthly Search Console check-in: the two yes/no answers plus the optional "Pages" export (Table.csv: Reason, Source, Validation, Trend, Pages;
// a per-reason URL list: URL, Last crawled; or Chart.csv: Date, Not indexed, Indexed) -> one row per site and month, and the summary shown back.
// ---- a check-in that is a test (D25c, 2026-10-12; the builders inline this file where a node asks for the CHECKIN_TEST kit) ----
// October's Search Console check-in was still the 2026-10-02 test row ("October check-in (test)"), so the reminder stopped asking the owner
// and the Monday report showed a test as the month's answer. A check-in is a test when the person said so (the form's "test" answer or the
// API's is_test), when it was written by a test caller (source "test"), or when its own note marks it as one. A test check-in is recorded
// like any other, but it never satisfies the month: CK.isTest(row) keeps it out of the monthly check, so the reminder keeps asking.
const CK = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const yes = (v) => /^(y|yes|true|1|on)$/i.test(S(v));
  // the note marks it as a test: "(test)", "test check-in / submission / entry / row / run / data", or a note that starts with "test"
  const MARK = /\(\s*test[^)]*\)|\btest\s+(check-?in|submission|entry|row|run|data)\b|^test\b[\s:,-]/i;
  const isTest = (row) => {
    const r = row || {};
    return yes(r.is_test) || S(r.source).toLowerCase() === 'test' || MARK.test(S(r.notes));
  };
  // why a stored row counts as a test (for the report and the harness)
  const testReason = (row) => {
    const r = row || {};
    if (yes(r.is_test)) return 'marked as a test when it was submitted';
    if (S(r.source).toLowerCase() === 'test') return 'written by a test caller (source "test")';
    if (MARK.test(S(r.notes))) return 'its note marks it as a test';
    return '';
  };
  return { isTest, testReason, yes, MARK };
})();
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
// D25c (2026-10-12): a test check-in is stored like any other, marked as a test, and never counts as the month's answer. The mark comes from
// the person (the form's "test" answer / the API's is_test), from a test caller, or from the note itself ("October check-in (test)").
const row = { site_id, domain: String(d.domain || ''), month, manual_action: !!d.checkin_manual_action, security_issue: !!d.checkin_security_issue, notes: String(d.checkin_notes || '').slice(0, 1000), coverage_json: JSON.stringify(coverage).slice(0, 20000), not_indexed_total: coverage.not_indexed_total == null ? -1 : coverage.not_indexed_total, csv_kind: coverage.kind, submitted_at: now, source: d.via_webhook ? 'api' : 'form', request_id: String(d.request_id || ''), is_test: false };
row.is_test = CK.isTest({ is_test: d.checkin_is_test, source: row.source, notes: row.notes });
const test_reason = row.is_test ? CK.testReason({ is_test: d.checkin_is_test, source: row.source, notes: row.notes }) : '';
const lines = [];
lines.push(row.manual_action ? 'Manual action reported: rankings stay suppressed until it is fixed. Open Search Console → Security & Manual Actions → Manual actions, fix every page it names, then click Request review.' : 'No manual action reported.');
lines.push(row.security_issue ? 'Security issue reported: clean the site (malware, injected or deceptive content), update the CMS and plugins, change passwords, then request a review under Security issues.' : 'No security issue reported.');
if (coverage.kind === 'reasons') lines.push('Pages report: ' + coverage.not_indexed_total + ' pages not indexed across ' + coverage.reasons.length + ' reason(s); largest: ' + coverage.reasons.slice(0, 3).map(x => x.reason + ' (' + x.pages + ')').join(', ') + '.');
else if (coverage.kind === 'urls') lines.push('URL list uploaded: ' + coverage.urls.length + ' URLs.');
else if (coverage.kind === 'chart') lines.push('Pages chart: ' + coverage.indexed_total + ' indexed, ' + coverage.not_indexed_total + ' not indexed on the last date.');
else if (text) lines.push('The uploaded CSV was not recognised as a Search Console Pages export (expected columns Reason / Pages, URL / Last crawled, or Date / Indexed / Not indexed).');
else lines.push('No Pages report uploaded (optional).');
if (row.is_test) lines.push('Recorded as a TEST check-in (' + test_reason + '), so it does not count as the answer for ' + month + ': the weekly report keeps asking for the real check-in. Remove the row with the n8n public API (DELETE /api/v1/data-tables/<seo_console_checkins id>/rows/delete?filter=...) when it is no longer needed.');
else lines.push('Recorded for ' + month + '; the weekly report includes it and the reminder stops for this month.');
return [{ json: { ...d, checkin_row: row, coverage, summary_lines: lines, plain: lines.join('\n'), checkin_month: month, checkin_is_test: row.is_test, checkin_test_reason: test_reason, site_id } }];
