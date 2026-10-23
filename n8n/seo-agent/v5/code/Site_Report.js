// Weekly performance report per site: e-mail HTML (KPI tiles, actions, tracked keywords, ladder pages, movers, opportunities, traffic, trends),
// the same document as a file for the PDF renderer, and the fields for the callback. Uses the AI brief when present, the facts otherwise.
// G12 / G29 (2026-10-13, FIX_PLAN): the period's events are listed with their dates (pages published, audit fixes, Google updates, the
// num=100 data break) so a move in the numbers can be read against what happened, and every figure group carries its source, period and
// sample — inline under the tiles and in full in "Where these numbers come from".
/*__LINEAGE__*/
/*__ANNOTATIONS__*/
const metrics = $('Site Metrics').all().map(i => i.json);
// 2026-10-19: the website's own weekly day ("every Wednesday", or "each week" when it has no cycle yet), from its Site Plan item
const planOf = (sid) => { try { return $('Site Plan').all().map(i => i.json || {}).find(p => p.site_id === sid) || {}; } catch (e) { return {}; } };
let briefs = []; try { briefs = $('Site Brief').all().map(i => (i.json && i.json.output && typeof i.json.output === 'object') ? i.json.output : null); } catch (e) { briefs = []; }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => (Number(v) || 0).toLocaleString('en-GB');
const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const pct = (cur, prev) => prev > 0 ? Math.round((cur - prev) / prev * 100) : (cur > 0 ? null : 0);
const pctS = (v) => v == null ? 'new' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + Math.abs(v) + '%';
const posS = (v) => !v ? '—' : '#' + r1(v);
const dcol = (v, invert) => v == null ? '#475569' : ((invert ? -v : v) > 0 ? '#15803d' : (invert ? -v : v) < 0 ? '#b91c1c' : '#475569');
const td = 'style="padding:4px 8px;border:1px solid #cbd5e1;font-size:13px;vertical-align:top"', th = 'style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left;font-size:12px"';
const table = (headers, rows, empty) => rows.length ? '<table style="border-collapse:collapse;margin:6px 0;max-width:100%">' + '<tr>' + headers.map(h => '<th ' + th + '>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td ' + td + '>' + c + '</td>').join('') + '</tr>').join('') + '</table>' : '<p style="color:#64748b;font-size:13px">' + esc(empty || 'nothing to show') + '</p>';
const tile = (label, value, delta, color) => '<td style="padding:8px 12px;border:1px solid #e2e8f0;min-width:110px;vertical-align:top"><div style="font-size:11px;color:#64748b;text-transform:uppercase">' + esc(label) + '</div><div style="font-size:20px;font-weight:700">' + value + '</div><div style="font-size:12px;color:' + (color || '#475569') + '">' + delta + '</div></td>';
const h3 = (t) => '<h3 style="margin:18px 0 4px;font-size:15px;color:#0f172a">' + esc(t) + '</h3>';
// R92 part 2 (W3-D): a page row whose host is not the canonical one (`other_host` / `hosts`) prints its FULL URL, so a reader can see the host differs
const path = (u, row) => { if (row && (row.other_host || (row.hosts && row.hosts.length > 1))) return String(u || ''); const p = String(u || '').replace(/^https?:\/\/[^\/]+/i, ''); return p || '/'; };
const link = (u, row) => u ? '<a href="' + esc(u) + '" style="color:#1d4ed8">' + esc(path(u, row)) + '</a>' : '—';
const deltaS = (cur, prev) => { const d = cur - prev; return (d > 0 ? '<span style="color:#15803d">+' + n(d) + '</span>' : d < 0 ? '<span style="color:#b91c1c">' + n(d) + '</span>' : '0'); };
return metrics.map((m, i) => {
  const b = briefs[i] || null; const G = m.gsc, A = m.ga4;
  const period = m.period.current.start + ' to ' + m.period.current.end;
  const sa = m.service_account_email || '<i>(service-account e-mail: ask your administrator)</i>';
  let html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:860px">';
  html += '<h2 style="margin:0 0 2px;font-size:20px">SEO performance: ' + esc(m.domain) + '</h2><p style="margin:0 0 10px;color:#64748b;font-size:13px">Last 28 days (' + esc(period) + ') vs the 28 days before · week ' + m.weeks_tracked + ' of tracking' + (m.on_demand ? ' · on-demand run' : '') + '</p>';
  if (b) { html += '<div style="background:#f8fafc;border-left:4px solid #1d4ed8;padding:10px 12px;margin:8px 0"><div style="font-weight:700;font-size:15px">' + esc(b.headline) + '</div><p style="margin:6px 0 0;font-size:14px">' + esc(b.summary) + '</p>' + ((b.highlights || []).length ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:13px">' + b.highlights.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + '</div>'; }
  const hard = m.alerts.filter(a => a.level === 'high' || a.level === 'medium');
  if (hard.length) html += '<div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:8px 12px;margin:8px 0;font-size:13px"><b>Alerts</b><ul style="margin:4px 0 0;padding-left:18px">' + hard.map(a => '<li>' + esc(a.text) + '</li>').join('') + '</ul></div>';
  if (!G.connected || !A.connected) html += '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;font-size:13px"><b>Connect Google to get real data</b><ol style="margin:4px 0 0;padding-left:18px">' +
    (!G.connected ? '<li><b>Search Console:</b> open <a href="https://search.google.com/search-console/users">Settings → Users and permissions</a> for ' + esc(m.domain) + ' and add <b>' + sa + '</b> with <i>Full</i> permission. ' + (G.error ? '<span style="color:#64748b">(' + esc(G.error) + ')</span>' : '') + '</li>' : '') +
    (!A.connected ? '<li><b>Google Analytics 4:</b> Admin → Property access management → add the same e-mail as <i>Viewer</i>. The property is detected automatically from its web stream URL; or register the site again with its GA4 property ID. ' + (A.error ? '<span style="color:#64748b">(' + esc(A.error) + ')</span>' : '') + '</li>' : '') +
    '</ol><p style="margin:4px 0 0">The next weekly report (or an on-demand run) picks the access up automatically.</p></div>';
  let tiles = '';
  if (G.connected) tiles += tile('Clicks', n(G.totals.cur.clicks), pctS(G.deltas.clicks_pct) + (G.deltas.yoy_clicks_pct != null ? ' · ' + pctS(G.deltas.yoy_clicks_pct) + ' YoY' : ''), dcol(G.deltas.clicks_pct)) + tile('Impressions', n(G.totals.cur.impressions), pctS(G.deltas.impressions_pct), dcol(G.deltas.impressions_pct)) + tile('CTR', (G.totals.cur.ctr * 100).toFixed(1) + '%', (G.deltas.ctr_pts > 0 ? '+' : '') + G.deltas.ctr_pts + ' pts', dcol(G.deltas.ctr_pts)) + tile('Avg position', posS(G.totals.cur.position), G.deltas.position == null ? '—' : (G.deltas.position > 0 ? '▲ ' : G.deltas.position < 0 ? '▼ ' : '') + Math.abs(G.deltas.position) + ' places', dcol(G.deltas.position));
  if (A.connected) { const ps = pct(A.organic.cur.sessions, A.organic.prev.sessions), pk = pct(A.organic.cur.key_events, A.organic.prev.key_events); tiles += tile('Organic sessions', n(A.organic.cur.sessions), pctS(ps) + ' · ' + A.organic_share + '% of all sessions', dcol(ps)) + tile('Key events (organic)', n(A.organic.cur.key_events), pctS(pk) + ' · ' + n(A.organic.cur.engaged) + ' engaged sessions', dcol(pk)); }
  if (tiles) html += '<table cellspacing="6" style="border-collapse:separate;margin:8px 0"><tr>' + tiles + '</tr></table>';
  // G29: the figures above, with their source, period and sample, right under them (the full list is at the end of the report)
  const LIN = m.lineage || [];
  const linOf = (re) => LIN.find(l => re.test(l.figure)) || null;
  if (LIN.length) { const top = linOf(/^Clicks, impressions/) || LIN[0];
    html += '<p style="margin:2px 0 8px;font-size:11px;color:#64748b">' + esc(LN.note(top)) + (linOf(/^Organic sessions/) ? ' · ' + esc(LN.note(linOf(/^Organic sessions/))) : '') + '</p>'; }
  // G12: what happened inside the two periods this report compares — the marks the dashboard charts carry, as a dated list here
  const MK = m.annotations || [], BRK = m.data_breaks || [];
  if (BRK.length) html += '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;font-size:13px"><b>These two periods are not directly comparable</b><ul style="margin:4px 0 0;padding-left:18px">'
    + BRK.map(b => '<li>' + esc(b.name) + ' (' + esc(b.start) + ' to ' + esc(b.end) + '): ' + esc(b.detail) + '</li>').join('') + '</ul></div>';
  if (MK.length) html += h3('What happened in this period') + AN.html(MK, { empty: false })
    + '<p style="font-size:12px;color:#64748b">' + esc(m.annotation_note || AN.OWN_NOTES_LINE) + '</p>'
    + '<p style="font-size:12px;color:#64748b">Every chart in your dashboard is marked with these dates. A Google update inside the period may be part of the cause of a move, which cannot be proven from these numbers.</p>';
  // B7-1 (2026-10-15, benchmark area 7): did the change work, or did the whole site move? Every dated change, read over its OWN
  // 28 days after against the 28 before, against the control group of the site's other pages over exactly the same days. A change
  // that could not be read keeps its row with the reason — a shorter list would read as "nothing was tried".
  const CTST = m.change_tests || null;
  if (CTST && (CTST.tests || []).length) {
    html += h3('Did it work? Your changes against the rest of the site')
      + table(['Page', 'What changed', 'Clicks before → after', 'The rest of the site expected', 'Verdict', 'Position'],
        CTST.tests.slice(0, 6).map(t => [link(t.url) + (t.keyword ? '<br><span style="color:#64748b;font-size:11px">' + esc(t.keyword) + '</span>' : ''),
          esc(t.what || 'changed') + ' ' + esc(t.date), t.read ? n(t.prev_clicks) + ' → ' + n(t.clicks) : '—',
          t.read && t.expected != null ? n(t.expected) + (t.lift_pct == null ? '' : ' <span style="color:#64748b">(' + (t.lift_pct >= 0 ? '+' : '') + t.lift_pct + '% vs expected)</span>') : '—',
          '<b>' + esc(t.verdict) + '</b>', t.read && t.position_verdict ? esc(t.position_verdict) : '—']))
      + '<ul style="font-size:12px;color:#475569;margin:4px 0;padding-left:18px">'
      + CTST.tests.slice(0, 6).map(t => '<li>' + esc(t.url) + ': ' + esc(t.basis || '') + '</li>').join('') + '</ul>'
      + '<p style="font-size:12px;color:#64748b">' + esc(CTST.method) + '</p>';
  } else if (CTST && CTST.reason) html += h3('Did it work? Your changes against the rest of the site')
    + '<p style="font-size:13px;color:#b45309">' + esc(CTST.reason) + '</p>';
  // R111 / R59 (2026-10-16): the Site Tracker emits `fix_draft` (a draft whose last quality round failed: fix it and run it again,
  // never "publish it") and `host_split` (Google serves the bare host and www apart). Either may arrive without a sentence of its own,
  // so the report words it from its fields instead of printing an empty bullet.
  const reasonsOf = (a) => (Array.isArray(a.reasons) ? a.reasons : String(a.reasons || '').split(';')).map(x => String(x).trim()).filter(Boolean);
  const wordAction = (a) => {
    if (a.action) return a;
    if (a.type === 'fix_draft') return { ...a, action: 'Fix the draft for "' + (a.keyword || 'this page') + '" and run it again: it did not pass the quality check, so it is not ready to publish', why: a.why || (reasonsOf(a).length ? 'The quality check found: ' + reasonsOf(a).slice(0, 3).join('; ') + '.' : '') };
    if (a.type === 'host_split') return { ...a, action: 'Make one host the only one Google serves: some pages appear under the bare domain and others under www', why: a.why || 'Redirect the other host to the canonical one, so the two versions stop splitting clicks and indexing.' };
    return a;
  };
  const acts = ((b && Array.isArray(b.actions) && b.actions.length) ? b.actions.slice(0, 6).map(a => ({ action: a.action, why: a.why, keyword: a.keyword, url: a.url, type: a.type, reasons: a.reasons })) : m.actions.slice(0, 6)).map(wordAction).filter(a => a.action);
  const withBody = m.actions.filter(a => a.api_body);
  html += h3('Do this week') + (acts.length ? '<ol style="margin:4px 0;padding-left:20px;font-size:14px">' + acts.map(a => '<li style="margin:4px 0"><b>' + esc(a.action) + '</b>' + (a.why ? '<br><span style="color:#475569;font-size:13px">' + esc(a.why) + '</span>' : '') + '</li>').join('') + '</ol>' : '<p style="font-size:13px;color:#64748b">Nothing urgent this week.</p>');
  if (withBody.length) html += '<p style="font-size:13px">Start the work with one click: open the <a href="' + esc(m.form_url) + '">SEO Assistant form</a> ("I know my keyword") or send one of these to the API (' + esc(m.api_url) + '):</p>' + withBody.slice(0, 3).map(a => '<pre style="background:#f1f5f9;padding:8px;font-size:11px;white-space:pre-wrap">' + esc(JSON.stringify(a.api_body)) + '</pre>').join('');
  // v4.5: the growth monitors' latest results (AI Visibility Tracker Mon 07:00, Backlink Monitor Mon 07:30, Audit Scheduler monthly)
  // R78 (2026-10-16): the block compared the two newest rows of each table whatever their TYPE — a full SEO report against the
  // technical audit before it ("health 70 ▼13"), a full backlink snapshot against a free_only one that never reads DataForSEO
  // ("18 referring domains ▲18"). Each row is now compared only with the previous row of the SAME kind, filtered BEFORE the two
  // newest are taken: an audit with the previous audit of its report_type (the engine's own diff rule, Audit_Diff.js), a backlink
  // snapshot with the previous one that read the same sources (free_only vs DataForSEO), an AI run with the previous one over the
  // same engines and the same panel (AI_Metrics.js B-L4). No like-for-like baseline = no arrow.
  const rowsOf = (name) => { try { return $(name).all().map(x => x.json).filter(r => r && r.site_id === m.site_id && !r.error).sort((x, y) => String(y.checked_at || y.audited_at).localeCompare(String(x.checked_at || x.audited_at))); } catch (e) { return []; } };
  const AVR = rowsOf('Load AI Visibility (Site)'), BLR = rowsOf('Load Backlink Snapshots (Site)'), AUR = rowsOf('Load Audits (Site)');
  const av = AVR[0] || null, bl = BLR[0] || null;
  const engSet = (r) => { let e = {}; try { e = JSON.parse(r.engines_json || '{}') || {}; } catch (x) {} return Object.keys(e).filter(k => k !== 'claude' && !(e[k] || {}).carried).sort().join('+'); };
  const av0 = av ? (AVR.slice(1).find(r => engSet(r) === engSet(av)) || null) : null;
  const avPanelOk = av && av0 && (() => { const a = Number(av.prompts) || 0, b = Number(av0.prompts) || 0; return a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= 0.2; })();
  const avWhy = av && !(av0 && avPanelOk) && AVR.length > 1 ? (!av0 ? 'not compared: the earlier runs asked a different set of AI engines' : 'not compared: the earlier run asked ' + n(av0.prompts) + ' questions, this one ' + n(av.prompts)) : '';
  const blKind = (r) => String(r.mode || '') === 'free' ? 'free' : 'index';
  const bl0 = bl ? (BLR.slice(1).find(r => blKind(r) === blKind(bl)) || null) : null;
  const AUDIT_LABEL = { site_audit: 'Technical audit', full: 'Full SEO report' };
  const auAll = []; for (const r of AUR) { const t = String(r.report_type || ''); if (!auAll.includes(t)) auAll.push(t); }
  const auTypes = auAll.some(Boolean) ? auAll.filter(Boolean) : auAll;   // rows without a type (before v4.5) only when nothing newer has one
  const auPairs = auTypes.slice(0, 2).map(t => { const list = AUR.filter(r => String(r.report_type || '') === t); return { t, cur: list[0], prev: t ? (list[1] || null) : null }; });
  if (av || bl || auPairs.length) {
    const dp = (cur, prev) => prev == null ? '' : (cur - prev > 0 ? ' <span style="color:#15803d">▲' + r1(cur - prev) + '</span>' : cur - prev < 0 ? ' <span style="color:#b91c1c">▼' + r1(prev - cur) + '</span>' : '');
    const rows = [];
    if (av) { let comp = []; try { comp = JSON.parse(av.competitors_json || '[]'); } catch (e) {} const pv = av0 && avPanelOk ? av0 : null; rows.push(['<b>AI answers</b> (' + esc(String(av.checked_at).slice(0, 10)) + ')', 'named in ' + r1(av.mention_rate) + '%' + dp(Number(av.mention_rate), pv ? Number(pv.mention_rate) : null) + ' · pages cited in ' + r1(av.citation_rate) + '% · share of voice ' + (av.share_of_voice === '' || av.share_of_voice == null ? 'not measurable' : r1(av.share_of_voice) + '%') + (comp[0] ? ' (leader: ' + esc(comp[0].domain) + ' ' + comp[0].share + '%)' : '') + (avWhy ? ' <span style="color:#64748b">(' + esc(avWhy) + ')</span>' : '') + (av.alerts ? '<br><span style="color:#b91c1c">' + esc(av.alerts) + '</span>' : '')]); }
    if (bl) {
      // R112: the merged count (every source, each link checked on its page) is THE count, as in the backlinks report itself;
      // DataForSEO's own figure is the index's, and a free_only check has no index figures at all
      const free = blKind(bl) === 'free'; const hasU = bl.union_domains !== '' && bl.union_domains != null;
      const count = hasU ? n(bl.union_domains) + ' linking sites (all sources)' + dp(Number(bl.union_domains), bl0 && bl0.union_domains !== '' && bl0.union_domains != null ? Number(bl0.union_domains) : null)
        : n(bl.referring_domains) + ' referring domains (DataForSEO)' + dp(Number(bl.referring_domains), bl0 ? Number(bl0.referring_domains) : null);
      rows.push(['<b>Backlinks</b> (' + esc(String(bl.checked_at).slice(0, 10)) + ', ' + esc(bl.mode) + ')', count + (hasU && !free ? " · DataForSEO's index: " + n(bl.referring_domains) : '') + ' · ' + n(bl.new_links) + ' new / ' + n(bl.lost_links) + ' lost' + (Number(bl.important_lost) ? ' · <b style="color:#b91c1c">' + bl.important_lost + ' important lost</b>' : '') + (Number(bl.spammy_new) ? ' · ' + bl.spammy_new + ' spammy' : '') + (free ? ' · free sources only' : " · spam score " + n(bl.spam_score) + " (the index's)")]);
    }
    for (const pr of auPairs) { const au = pr.cur; rows.push(['<b>' + esc(AUDIT_LABEL[pr.t] || 'Audit') + '</b> (' + esc(String(au.audited_at).slice(0, 10)) + ')', 'health ' + n(au.health_score) + '/100' + dp(Number(au.health_score), pr.prev ? Number(pr.prev.health_score) : null) + ' (' + esc(au.grade) + ') · ' + n(au.critical) + ' critical, ' + n(au.high) + ' high, ' + n(au.medium) + ' medium · ' + n(au.pages_crawled) + ' pages crawled']); }
    html += h3('AI search, backlinks and technical health') + table(['Monitor', 'Latest'], rows) + '<p style="font-size:12px;color:#64748b">Details in the AI-visibility, backlink and audit reports (separate e-mails).</p>';
  }
  if (m.tracked.length) html += h3('Tracked keywords') + table(['Keyword', 'Source', 'Search Console avg', 'Before', 'Live Google check', 'Clicks', 'Impr.', 'Ranking page'], m.tracked.map(t => [esc(t.keyword), esc(t.source === 'ladder' ? (t.rung === 4 ? 'ladder top' : 'ladder rung ' + t.rung) : t.source === 'blog' ? 'blog page' : 'your list'),
    G.connected ? posS(t.gsc_position) : '<span style="color:#94a3b8">connect GSC</span>', G.connected ? posS(t.gsc_prev_position) : '—', t.serp_position == null ? '—' : (t.serp_position > 0 ? '#' + t.serp_position : t.serp_position === 0 ? 'not in top 50' : 'check failed') + (t.serp_checked_at ? '<br><span style="color:#94a3b8;font-size:11px">' + esc(String(t.serp_checked_at).slice(0, 10)) + '</span>' : ''), n(t.clicks), n(t.impressions), link(t.page || t.serp_url)]));
  // B-G3 (2026-10-15, INVARIANTS rule 1 + 2): a rung the read-path fit gate set aside bought no rank check and is not in the table
  // above — so it is named here, with its reason, rather than leaving a shorter list nobody can explain.
  if ((m.set_aside || []).length) html += '<p style="margin:2px 0 8px;font-size:12px;color:#b45309"><b>Set aside</b> (planned before the keyword rule existed): '
    + m.set_aside.map(x => esc(x.note || (x.keyword + ' — ' + x.detail))).join(' | ') + '</p>';
  const linLine = (re) => { const l = linOf(re); return l ? '<p style="margin:2px 0 8px;font-size:11px;color:#64748b">' + esc(LN.note(l)) + '</p>' : ''; };
  if (m.tracked.length) html += linLine(/^Live Google check/) || linLine(/^Clicks, impressions/);
  const C = m.console || { notices: [], last_checkin: null, checkin_due: false };
  if (C.notices.length || C.last_checkin || C.checkin_due) {
    html += h3('Search Console notices and monthly check-in');
    if (C.notices.length) html += table(['Received', 'Kind', 'Notice'], C.notices.slice(0, 8).map(n => [esc(String(n.received_at).slice(0, 10)), esc(n.kind.replace(/_/g, ' ')) + (n.severity === 'critical' ? ' <b style="color:#b91c1c">urgent</b>' : ''), esc(n.subject)]));
    else html += '<p style="font-size:13px;color:#64748b">No Search Console notification in the last 35 days' + (m.service_account_email ? '' : '') + '.</p>';
    if (C.last_checkin) { const ck = C.last_checkin; html += '<p style="font-size:13px"><b>Last check-in (' + esc(ck.month) + '):</b> manual action ' + (ck.manual_action ? '<b style="color:#b91c1c">yes</b>' : 'no') + ', security issue ' + (ck.security_issue ? '<b style="color:#b91c1c">yes</b>' : 'no') + (ck.csv_kind === 'reasons' ? '; Pages report: ' + n(ck.not_indexed_total) + ' pages not indexed' + ((ck.coverage.reasons || []).length ? ' (' + ck.coverage.reasons.slice(0, 3).map(r => esc(r.reason) + ' ' + n(r.pages)).join(', ') + ')' : '') : ck.csv_kind === 'chart' ? '; Pages chart: ' + n(ck.coverage.indexed_total) + ' indexed, ' + n(ck.not_indexed_total) + ' not indexed' : '') + (ck.notes ? '; notes: ' + esc(ck.notes.slice(0, 160)) : '') + '</p>'; }
    if (C.checkin_due) html += '<p style="font-size:13px;color:#b45309"><b>Monthly check-in due:</b> open the <a href="' + esc(m.form_url) + '">form</a> ("Search Console check-in"), answer two questions and upload the Pages report export (Search Console → Pages → Export). It covers what the API cannot see: manual actions, security issues and the site-wide index coverage.</p>';
  }
  // v4.8 publish detection: written pages found live on the site this week (sitemap: planned slug, else title / H1) — shown only when there are some
  const found = m.detected_published || [];
  if (found.length) html += '<div style="background:#f0fdf4;border-left:4px solid #15803d;padding:8px 12px;margin:8px 0;font-size:13px"><b>We found these pages live on your site:</b><ul style="margin:4px 0 0;padding-left:18px">' + found.map(f => '<li><b>' + esc(f.keyword) + '</b> → <a href="' + esc(f.url) + '" style="color:#1d4ed8">' + esc(f.url) + '</a>' + (f.ladder_id ? ' <span style="color:#64748b">(keyword ladder)</span>' : '') + '</li>').join('') + '</ul><p style="margin:4px 0 0">— tracking has started: Google indexing and positions are followed from now on. Not the right page? Report the correct link with "I published a page".</p></div>';
  if ((m.pending_publish || []).length) html += '<p style="font-size:13px;color:#b45309"><b>Written, waiting for your publish link:</b> ' + m.pending_publish.map(p => esc(p.keyword) + ' (' + p.days + ' days ago)').join(', ') + ' — report it through the <a href="' + esc(m.form_url) + '">form</a> ("I published a page") so indexing and positions are tracked.</p>';
  if (m.ladder_pages.length) html += h3('Your pages: index status') + table(['Page', 'Rung', 'Status', 'Indexed', 'Coverage', 'Last crawl'], m.ladder_pages.map(p => [link(p.url), p.rung === 4 ? 'top' : p.rung ? String(p.rung) : 'blog', esc(p.status) + (p.detected ? ' <span style="color:#15803d">(found live this week)</span>' : ''), p.indexed == null ? '<span style="color:#94a3b8">' + esc(p.inspect_error || 'unknown') + '</span>' : (p.indexed ? '<span style="color:#15803d">yes</span>' : '<span style="color:#b91c1c">no</span>'), esc(p.coverage || '—'), esc(p.last_crawl ? String(p.last_crawl).slice(0, 10) : '—')]));
  if (G.connected) {
    // G9 (2026-10-12): every query row is read, so the report can say what Google withholds and split brand from non-brand
    const AN = (G.anonymised || {}).current || null, BS = G.brand_split || null;
    if (AN || BS) html += h3('Where the searches came from') + '<p style="font-size:13px">' +
      (BS ? 'Non-brand (people who did not search your name): <b>' + n(BS.non_brand.clicks) + '</b> clicks from ' + n(BS.non_brand.queries) + ' queries' + (BS.previous.non_brand.clicks ? ' (' + pctS(pct(BS.non_brand.clicks, BS.previous.non_brand.clicks)) + ')' : '') + ' · brand: ' + n(BS.brand.clicks) + ' clicks from ' + n(BS.brand.queries) + ' queries' + (BS.names.length ? ' <span style="color:#64748b">(brand = ' + esc(BS.names.join(', ')) + ')</span>' : '') + '.<br>' : '') +
      (AN ? 'Queries Google does not name (rare searches, withheld for privacy): ' + n(AN.clicks) + ' clicks and ' + n(AN.impressions) + ' impressions, ' + AN.impressions_pct + '% of all impressions.' : '') +
      (G.scraper_queries && G.scraper_queries.count ? '<br>' + n(G.scraper_queries.count) + ' queries came from SEO tools or scrapers (search operators) and are left out of every list above: ' + esc((G.scraper_queries.sample || []).join(', ')) + '.' : '') +
      // C-6 (re-rating 2026-10-17): searches for another website, named apart and never a quick win
      (G.other_site_queries && G.other_site_queries.count ? '<br>' + n(G.other_site_queries.count) + ' searches were for another website, not yours, and are left out of every list above: ' + esc((G.other_site_queries.sample || []).map(x => '"' + x.query + '" (' + x.site + ', ' + x.impressions + ' impressions)').join(', ')) + '.' : '') +
      ((G.truncated || []).length ? '<br><span style="color:#b45309">Search Console returned more rows than this run read (' + esc(G.truncated.join(', ')) + '): the figures below cover the ' + n(G.rows_read) + ' rows read.</span>' : '') + '</p>';
    // B7-6 (W3-D): brand in one place, three sources side by side
    const BSR = m.brand_series || null;
    if (BSR) html += h3('Brand demand: three measurements side by side') + table(['Line', 'Source', 'Before → now', 'Basis'],
        BSR.lines.map(l => l.read ? [esc(l.label), esc(l.source), n(l.prev) + ' → ' + n(l.cur) + ' (' + esc(l.change.text) + ')', esc(l.basis)] : [esc(l.label), esc(l.source), '—', 'Not read: ' + esc(l.reason)]))
      + '<p style="font-size:12px;color:#64748b">' + esc(BSR.note) + '</p>';
    // B7-4 (W3-D): Discover and Google News, only where the property has them; otherwise ONE line that says so
    const STY = G.search_types || null;
    if (STY) for (const [k, lab] of [['discover', 'Discover'], ['google_news', 'Google News']]) { const b = STY[k]; if (!b) continue;
      html += b.has_data ? h3(lab + ' (Google, separate from web search)') + '<p style="font-size:13px"><b>' + n(b.cur.clicks) + '</b> clicks and ' + n(b.cur.impressions) + ' impressions, ' + esc(b.change.text) + '. <span style="color:#64748b">' + esc(b.basis) + '</span></p>'
        : '<p style="font-size:12px;color:#64748b">' + esc(b.reason) + '.</p>'; }
    // B7-5 (W3-D): content groups, each on the same statistical bar as the site-wide alerts
    const CG = G.content_groups || null;
    if (CG && CG.configured) html += h3('How each part of the site is doing') + table(['Group', 'Pages', 'Clicks before → now', 'Verdict'],
        CG.groups.map(g => g.valid ? [esc(g.name), n(g.pages), n(g.prev_clicks) + ' → ' + n(g.clicks), g.change.real ? esc(g.change.direction === 'down' ? 'Fell: ' : 'Grew: ') + esc(g.change.text) : g.change.watch ? 'Watch: ' + esc(g.change.text) + ' (inside normal variation)' : g.change.measurable ? 'No real change' : 'Too few clicks to judge'] : [esc(g.name), '—', '—', 'Not used: ' + esc(g.reason)])
          .concat(CG.ungrouped ? [['All other pages', n(CG.ungrouped.pages), n(CG.ungrouped.prev_clicks) + ' → ' + n(CG.ungrouped.clicks), CG.ungrouped.change.real ? esc(CG.ungrouped.change.text) : 'No real change']] : []))
      + '<p style="font-size:12px;color:#64748b">' + esc(CG.note) + '</p>';
    // B7-8 (W3-D): the latest days, preliminary, apart from every tested figure
    const RC = G.recent || null;
    if (RC && RC.read) html += '<p style="font-size:13px;border-left:4px solid #94a3b8;padding:4px 10px;margin:8px 0"><b>Since the report window</b> (' + esc(RC.start) + ' to ' + esc(RC.end) + ', ' + n(RC.days) + ' day' + (RC.days === 1 ? '' : 's') + '): ' + n(RC.clicks) + ' clicks, ' + n(RC.impressions) + ' impressions'
      + (RC.window_daily_clicks != null ? ' (the report window averaged ' + RC.window_daily_clicks + ' clicks a day)' : '') + '. <span style="color:#64748b">' + esc(RC.label) + '</span></p>';
    // B3-12 (W3-D): Google's Search Console report on generative-AI performance has no API
    html += '<p style="font-size:12px;color:#64748b">Search Console\'s own generative-AI performance report is only in Search Console\'s interface: the Search Analytics API offers no search type or dimension that returns it, so none of its numbers are in this report.</p>';
    // B7-2 (2026-10-15, benchmark area 7): the device and the country, free and first-party. A split Google did not answer prints
    // its reason — an empty table would read as "no phone traffic" (INVARIANTS rule 1).
    const DV = G.devices || null, CO = G.countries || null;
    const DVL = { DESKTOP: 'Desktop', MOBILE: 'Phones', TABLET: 'Tablets' };
    if (DV) html += h3('Where your visitors searched from') + (DV.read
      ? table(['Device', 'Clicks', 'Change', 'Share of clicks', 'Impressions', 'Position'],
          DV.rows.map(d => [esc(DVL[d.key] || d.key), n(d.clicks), deltaS(d.clicks, d.prev_clicks), d.share + '%', n(d.impressions), posS(d.position)]), 'no device rows came back')
      : '<p style="font-size:13px;color:#b45309">' + esc(DV.reason) + '.</p>');
    if (CO && CO.read && CO.rows.length) html += table(['Country', 'Clicks', 'Change', 'Share of clicks', 'Impressions', 'Position'],
      CO.rows.slice(0, 6).map(c => [esc(String(c.key).toUpperCase()), n(c.clicks), deltaS(c.clicks, c.prev_clicks), c.share + '%', n(c.impressions), posS(c.position)]));
    else if (CO && !CO.read) html += '<p style="font-size:13px;color:#b45309">' + esc(CO.reason) + '.</p>';
    // B7-3: two of your own pages shown for one search — observed by Google, never inferred
    const CB = G.cannibal || [];
    if (CB.length) html += h3('Searches two of your pages compete for')
      + table(['Search', 'Impressions', 'Your pages', 'Google shows most often'],
        CB.slice(0, 6).map(c => [esc(c.query), n(c.impressions), c.pages.map(p => link(p.page) + ' <span style="color:#64748b">' + p.share + '% at #' + p.position + '</span>').join('<br>'),
          link(c.preferred) + (c.split ? '<br><span style="color:#b45309;font-size:11px">but ' + esc(c.best.page) + ' ranks better when it is shown</span>' : '')]))
      + '<p style="font-size:12px;color:#64748b">' + esc((G.cannibal_summary || {}).note || '') + '</p>';
    html += h3('Quick wins: striking distance (positions 4-20)') + table(['Query', 'Position', 'Before', 'Impressions', 'Clicks', 'Page'], G.striking.slice(0, 10).map(q => [esc(q.query), posS(q.position), posS(q.prev_position), n(q.impressions), n(q.clicks), link(q.page)]), 'no query between positions 4 and 20 with enough impressions yet');
    if (G.ctr_gaps.length) html += h3('Low click-through for the position (rewrite titles)') + table(['Query', 'Position', 'Impressions', 'CTR', 'Expected', 'Page'], G.ctr_gaps.slice(0, 6).map(q => [esc(q.query), posS(q.position), n(q.impressions), (q.ctr * 100).toFixed(1) + '%', Math.round(q.expected_ctr * 100) + '%', link(q.page)]));
    html += h3('Query movers') + '<table style="border-collapse:collapse;width:100%"><tr><td style="vertical-align:top;padding-right:8px;width:50%"><b style="font-size:13px;color:#15803d">Winners</b>' + table(['Query', 'Clicks', 'Position'], G.winners.slice(0, 6).map(q => [esc(q.query), n(q.clicks) + ' (' + deltaS(q.clicks, q.prev_clicks) + ')', posS(q.position) + (q.prev_position ? ' <span style="color:#94a3b8">was ' + posS(q.prev_position) + '</span>' : '')]), 'no clear winners') + '</td><td style="vertical-align:top;width:50%"><b style="font-size:13px;color:#b91c1c">Losers</b>' + table(['Query', 'Clicks', 'Position'], G.losers.slice(0, 6).map(q => [esc(q.query), n(q.clicks) + ' (' + deltaS(q.clicks, q.prev_clicks) + ')', posS(q.position) + (q.prev_position ? ' <span style="color:#94a3b8">was ' + posS(q.prev_position) + '</span>' : '')]), 'no clear losers') + '</td></tr></table>';
    if (G.new_queries.length || G.lost_queries.length) html += '<p style="font-size:13px"><b>New queries:</b> ' + (G.new_queries.slice(0, 8).map(q => esc(q.query) + ' (' + n(q.impressions) + ' impr.)').join(', ') || 'none') + '<br><b>Lost queries:</b> ' + (G.lost_queries.slice(0, 8).map(q => esc(q.query) + ' (' + n(q.prev_clicks) + ' clicks before)').join(', ') || 'none') + '</p>';
    html += h3('Pages') + table(['Page', 'Clicks', 'Change', 'Impressions', 'Position'], G.top_pages.slice(0, 8).map(p => [link(p.page, p), n(p.clicks), deltaS(p.clicks, p.prev_clicks), n(p.impressions), posS(p.position)]));
    // B4-1 (2026-10-15, benchmark area 4): every page with clicks is tested against the 28 days before AND the same 28 days a
    // year earlier, so this list is what really decayed — and the line underneath names what was checked and refused, because a
    // report that only prints its hits cannot be told apart from one that found nothing.
    if (G.decaying_pages.length) html += '<p style="font-size:13px"><b style="color:#b91c1c">Pages losing traffic:</b> ' + G.decaying_pages.slice(0, 5).map(p => esc(path(p.page, p)) + ' (' + n(p.prev_clicks) + ' → ' + n(p.clicks) + ' clicks, −' + n(p.lost) + (p.kind === 'clickthrough' ? ', still shown as often: title and description first' : '') + ')').join('; ') + '</p>';
    if (G.decay_summary && G.decay_summary.tested) { const ds = G.decay_summary;
      html += '<p style="font-size:12px;color:#64748b">Decay check: ' + n(ds.tested) + ' pages tested, <b>' + n(ds.decaying) + '</b> really losing traffic'
        + (ds.seasonal ? ', ' + n(ds.seasonal) + ' down only against the weeks before and not against a year ago (seasonal)' : '')
        + (ds.watch ? ', ' + n(ds.watch) + ' large but inside sampling noise' : '')
        + (ds.too_small ? ', ' + n(ds.too_small) + ' with too few clicks to test (under ' + n(ds.min_click_events) + ' over both periods)' : '')
        + '. ' + esc(ds.note) + '</p>'; }
  }
  if (A.connected) html += h3('Traffic (GA4, organic search)') + '<p style="font-size:13px">Organic: <b>' + n(A.organic.cur.sessions) + '</b> sessions (' + pctS(pct(A.organic.cur.sessions, A.organic.prev.sessions)) + '), ' + n(A.organic.cur.engaged) + ' engaged, ' + n(A.organic.cur.key_events) + ' key events, ' + n(A.organic.cur.users) + ' users · all channels: ' + n(A.total.cur.sessions) + ' sessions' + (A.channels.length ? ' (' + A.channels.slice(0, 4).map(c => esc(c.channel) + ' ' + n(c.sessions)).join(', ') + ')' : '') + (A.detected ? ' · property ' + esc(A.property_id) + ' detected automatically' : '') + '</p>' + table(['Landing page', 'Organic sessions', 'Change', 'Engaged', 'Key events'], A.landing.slice(0, 8).map(l => [link(l.page), n(l.sessions), deltaS(l.sessions, l.prev_sessions), n(l.engaged), n(l.key_events)]));
  if (m.trends.length) html += h3('Search interest (Google Trends, 12 months)') + table(['Keyword', 'Direction', 'Last 4 weeks vs average', 'Peak', 'Rising related searches'], m.trends.map(t => [esc(t.keyword), t.error ? '<span style="color:#94a3b8">' + esc(t.error) + '</span>' : t.direction === 'sparse' ? '<span style="color:#94a3b8">too little search volume for a trend</span>' : esc(t.direction), (t.change_pct == null || t.direction === 'sparse') ? '—' : (t.change_pct > 0 ? '+' : '') + t.change_pct + '%', esc(t.peak_date ? String(t.peak_date).slice(0, 7) : '—'), esc((t.rising || []).slice(0, 4).map(r => r.query + ' (' + r.value + ')').join(', ') || '—')]));
  if (m.trends.length) html += linLine(/^Search interest/);
  if (LIN.length) html += LN.block(LIN);
  if (b && (b.watch || []).length) html += h3('Watch') + '<ul style="font-size:13px;margin:4px 0;padding-left:18px">' + b.watch.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  html += '<p style="color:#64748b;font-size:12px;margin-top:16px">' + (G.connected ? 'A fall in clicks, impressions or sessions is only called a fall when it is beyond normal week-to-week variation (two-sample Poisson test, 95%); a larger move at low volume is shown as "Watch". ' : '') + 'Search Console figures are final up to 3 days ago and are averages across devices and locations; the live Google check is one SERP sample from DataForSEO. Trends are a relative index (100 = peak of the year). Reports run ' + (planOf(m.site_id).every_week || 'each week') + (planOf(m.site_id).cycle ? ' (this website\'s weekly cycle)' : '') + (m.tracked.some(t => t.source === 'ladder') ? '; the keyword ladder gets its own progress e-mail' : '') + '. Reply to this e-mail to pause tracking.</p></div>';
  const hi = m.alerts.filter(a => a.level === 'high').length; const parts = [];
  // R113 (2026-10-16): the subject follows the report's own significance test (G28). Clicks 21 -> 32 is "up 52%" in arithmetic and
  // "not a real change" in the test printed under it, so the subject no longer says "32 clicks ▲ 52%": it leads with a change the test
  // calls real and says the clicks are within normal variation. Without a significance block (older runs) the subject is unchanged.
  const SG = m.significance || null, SC = SG && SG.clicks;
  if (G.connected && SC && SC.real === false) {
    const realOne = ['impressions', 'sessions'].find(k => SG[k] && SG[k].real === true && SG[k].pct != null);
    if (realOne) parts.push(realOne + ' ' + pctS(SG[realOne].pct));
    parts.push(n(G.totals.cur.clicks) + ' clicks (within normal variation)');
  } else if (G.connected) parts.push(n(G.totals.cur.clicks) + ' clicks ' + pctS(G.deltas.clicks_pct)); if (hi) parts.push(hi + ' alert' + (hi > 1 ? 's' : '')); if (found.length) parts.push(found.length + ' page' + (found.length > 1 ? 's' : '') + ' found live'); if (G.connected && G.striking.length) parts.push(G.striking.length + ' quick win' + (G.striking.length > 1 ? 's' : ''));
  const subject = (G.connected ? '[SEO weekly] ' : '[SEO tracking] ') + m.domain + ' — ' + (parts.length ? parts.join(' · ') : 'connect Google Search Console to see real data');
  const file_name = 'seo-performance-' + m.domain.replace(/[^a-z0-9.]+/g, '-') + '-' + m.period.current.end + '.html';
  const doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(subject) + '</title></head><body style="margin:24px">' + html + '</body></html>';
  return { json: { ...m, brief: b, subject, html, file_name, status: 'progress', stage: 'site_tracker' }, binary: { data: { data: Buffer.from(doc, 'utf8').toString('base64'), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } } };
});
