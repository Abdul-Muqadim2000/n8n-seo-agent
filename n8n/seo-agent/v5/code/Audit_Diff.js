// Compares this audit with the site's previous one OF THE SAME TYPE (seo_audits + seo_audit_findings, report_type technical / full): fixed, new and
// still-open findings (matched on category + title with numbers ignored) and the score change; and suggests internal links from the crawl (pages with few links in, orphan pages, pages with
// search impressions) from strong pages on the same topic. Adds audit_diff / internal_links to site_audit; audit_id identifies this audit.
/*__SITE_MODEL__*/
const d = $input.first().json; const a = d.site_audit || {};
const base = $('Check Crawl').first().json; const domain = base.domain; const site_id = 'site_' + String(domain).toLowerCase().replace(/[^a-z0-9]+/g, '-');
// D15 (system review 2026-10-11): every URL we emit uses the site model's canonical host (SITE_MODEL_SPEC.md §6) -- the bare domain
// 308-redirects on a www site. With no model (an older run) or another site's domain, the bare domain keeps today's behaviour.
let SITE_MODEL = null; try { SITE_MODEL = $('Site Model').first().json.site_model || null; } catch (e) {}
const siteUrlOf = (dom, path) => SM.siteUrl(SITE_MODEL && SITE_MODEL.domain && SITE_MODEL.domain === SM.helpers.bare(dom) ? SITE_MODEL : { domain: dom }, path);
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error && r.site_id); } catch (e) { return []; } };
const audits = rowsOf('Load Audit History').filter(r => r.site_id === site_id).sort((x, y) => String(y.audited_at).localeCompare(String(x.audited_at)));
// D2 (2026-10-11): only an audit of the same type is comparable — a technical audit never checks rankings, AI answers or the keyword gap, so
// compared with a full report it "fixed" 25 findings. Rows without a report_type (none since v4.5) are not compared either.
const curType = a.audit_level || 'site_audit'; const LABEL = { site_audit: 'technical audit', full: 'full SEO report' }; const labelOf = (t) => LABEL[t] || String(t || 'audit');
const prev = audits.find(r => String(r.report_type || '') === curType) || null;
const otherType = !prev ? (audits.find(r => r.report_type && r.report_type !== curType) || null) : null;
// R2 (2026-10-13, re-rating): the previous findings were filtered through the categories this audit type scores, the current ones were not, so a
// finding in a category the audit itself declares "not assessed" was reported **new** at every audit and never moved the score. Live: exec 513
// listed `new: ["Structured data with errors", Schema, Medium]` five minutes after exec 497 stored that exact finding.
//   The decision on Schema: a technical audit does NOT get a Schema weight. It only reads DataForSEO's `has_micromarkup_errors` flag per page --
//   it never validates a single property, which is why its own `not_assessed` list says "Structured data (schema) and HTML-level checks". A flag
//   with no detail cannot carry a score, so Schema stays in the full report's weights only; a technical audit keeps showing the finding as an
//   observation and the diff leaves it out of fixed / new / still-open on BOTH sides.
const assessed = new Set(Object.keys(a.weights || {}));   // the categories this audit type scores: a finding outside them is "not checked", never "fixed" or "new"
const inScope = (f) => !assessed.size || assessed.has(f.category);
// C-5 (re-rating 2026-10-17): two audits compare only on the checks BOTH ran. Audit 794 (crawl_js false) against 739 of 48 minutes earlier
// (crawl_js true) reported "1 fixed: AI crawlers see a different version of 20 key page(s)" - a finding only a JavaScript crawl can make,
// absent because the method changed, not because anything was fixed. The method is read from this run (Check Crawl / the audit) and from
// the stored row's `crawl_js` (the column is the audit report's to write; an older row without it is UNKNOWN, never "same"). When the two
// differ or one is unknown, the findings that depend on rendering are left out of fixed / new / still open on both sides and named.
const jsOf = (v) => (v === true || v === 'true' || v === 1 || v === '1') ? true : (v === false || v === 'false' || v === 0 || v === '0') ? false : null;
const curJs = jsOf(a.crawl_js != null ? a.crawl_js : base.crawl_js);
const prevJs = prev ? jsOf(prev.crawl_js) : null;
const methodSame = curJs !== null && prevJs !== null && curJs === prevJs;
const JS_DEP = /after JavaScript|written by JavaScript|not in the first response|changes after|AI crawlers see a different version|response-versus-render|without a real <a href>/i;
const jsDep = (f) => !!f && (f.source === 'render_diff' || JS_DEP.test(String(f.title || '')));
const methodOk = (f) => methodSame || !jsDep(f);
const jsWord = (v) => v === true ? 'with JavaScript rendering' : v === false ? 'without JavaScript rendering' : 'with a crawl method not recorded';
const prevAll = prev ? rowsOf('Load Audit Findings').filter(r => r.audit_id === prev.audit_id).filter(inScope) : [];
const prevF = prevAll.filter(methodOk);
const keyOf = (f) => String(f.category || '') + '|' + String(f.title || '').toLowerCase().replace(/\d[\d,.%]*/g, '#').replace(/["'“”‘’]/g, '').replace(/\s+/g, ' ').trim();
const curAll = (a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info').filter(inScope);
const cur = curAll.filter(methodOk);
const not_compared_method = prev && !methodSame ? [...new Set([...prevAll, ...curAll].filter(jsDep).map(f => String(f.title || '')))].slice(0, 12) : [];
const not_compared = [...new Set((a.findings || []).filter(f => f.scoring !== false && f.severity !== 'Info' && !inScope(f)).map(f => String(f.category || '')))].filter(Boolean);
const curKeys = new Map(cur.map(f => [keyOf(f), f])); const prevKeys = new Map(prevF.map(f => [f.finding_key, f]));
const SEV = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
// R74 (2026-10-16, re-rating of 2026-10-15): a finding that rests on ONE outside reading — one results page ("does not rank at the top
// for its own brand name"), one AI answer, one AI Overview, one content review written by a model — can disappear because that reading
// changed, not because anything was fixed: exec 614 called the brand finding "fixed" one day after exec 566 on two single results-page
// reads (not in the top 20, then #1). Such a finding is "no longer seen", never "fixed"; a new one is marked as resting on one reading.
// The stored rows carry no source, so the class is read from the title (and, for the content review, from the category of a full report
// whose review ran: its titles are written fresh by a model every run, so they never match by key).
const ONE_READING = /own brand name|recommends other providers|AI Overviews?|ChatGPT|Perplexity|Gemini|\bClaude\b|Copilot answers|AI Mode|AI answers?|named in AI|cited by AI/i;
const MEASURED_CONTENT = /duplicate content|text-to-html|hard-to-read|readab|light content|thin content|lorem|placeholder|named human author|freshness|phone number|word count|outbound links|images?\b|headings?\b|H1\b/i;
const reviewRan = (a.findings || []).some(f => f && f.source === 'ai_review');
const oneReading = (f) => !!f && (f.source === 'ai_review' || ONE_READING.test(String(f.title || ''))
  || (reviewRan && String(f.category || '') === 'Content' && !MEASURED_CONTENT.test(String(f.title || ''))));
const gone = [...prevKeys.entries()].filter(([k]) => !curKeys.has(k)).map(([, f]) => ({ title: f.title, category: f.category, severity: f.severity, one_reading: oneReading(f) })).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const fixed = gone.filter(f => !f.one_reading).map(({ one_reading, ...f }) => f);
const no_longer_seen = gone.filter(f => f.one_reading).map(({ one_reading, ...f }) => ({ ...f, why: 'it rested on a single outside reading (a results page, an AI answer or a content review) that did not repeat this time; nothing on the site has to have changed' }));
const added = [...curKeys.entries()].filter(([k]) => prev && !prevKeys.has(k)).map(([, f]) => ({ title: f.title, category: f.category, severity: f.severity, ...(oneReading(f) ? { one_reading: true } : {}) })).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const open = [...curKeys.entries()].filter(([k]) => prevKeys.has(k)).map(([k, f]) => { const p = prevKeys.get(k); return { title: f.title, category: f.category, severity: f.severity, was: p.severity, affected: f.affected_count ?? null, affected_before: Number(p.affected_count) || null }; }).sort((x, y) => SEV[x.severity] - SEV[y.severity]);
const audit_id = 'aud_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const audited_at = new Date().toISOString();
const days = prev ? Math.round((Date.now() - new Date(prev.audited_at).getTime()) / 864e5) : null;
const audit_diff = prev ? { baseline: false, report_type: curType, previous: { audit_id: prev.audit_id, audited_at: prev.audited_at, report_type: prev.report_type, health_score: Number(prev.health_score), grade: prev.grade, findings: Number(prev.findings) || prevF.length }, days_since: days,
  score_delta: (Number(a.health_score) || 0) - (Number(prev.health_score) || 0), fixed, new: added, open, not_compared,
  summary: fixed.length + ' fixed · ' + added.length + ' new · ' + open.length + ' still open (compared with the ' + labelOf(curType) + ' of ' + String(prev.audited_at).slice(0, 10) + ')'
    + (not_compared.length ? '. ' + not_compared.join(', ') + ' ' + (not_compared.length === 1 ? 'is' : 'are') + ' not assessed by a ' + labelOf(curType) + ', so those findings are shown but not compared.' : '') }
  : { baseline: true, report_type: curType, not_compared, summary: 'First ' + labelOf(curType) + ' stored: the next one shows what was fixed, what is new and what is still open.' + (otherType ? ' The ' + labelOf(otherType.report_type) + ' of ' + String(otherType.audited_at).slice(0, 10) + ' is a different report type and is not compared.' : '') };
// C-5: the crawl method of both audits, on the diff, and the findings left out because it changed (added after the build's patches of the literal)
audit_diff.crawl_js = curJs; audit_diff.basis = { ...(audit_diff.basis || {}), crawl_js: curJs, previous_crawl_js: prevJs, method_same: prev ? methodSame : null };
if (!audit_diff.baseline) { audit_diff.not_compared_method = not_compared_method;
  if (not_compared_method.length) audit_diff.summary += '. This audit ran ' + jsWord(curJs) + ' and the one before ' + jsWord(prevJs) + ', so the ' + not_compared_method.length
    + ' finding(s) that depend on rendering are not compared (' + not_compared_method.slice(0, 3).map(t => '\u201c' + t + '\u201d').join(', ') + ')'; }
// ---- internal links: targets that need links, sources on the same topic that already carry authority ----
const pages = ($('Get Crawled Pages').first().json.tasks?.[0]?.result?.[0]?.items || []).filter(p => p && p.status_code === 200 && p.resource_type === 'html' && !(p.checks || {}).is_redirect && !/(\?|\/(tag|category|author|page)\/|\/feed\/?$)/i.test(p.url));
const norm = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'how', 'what', 'you', 'are', 'from', 'that', 'this', 'page', 'home', 'blog', 'www', 'com', 'html']);
const toks = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(t => t.length > 2 && !STOP.has(t));
const brandToks = new Set(toks(domain.split('.')[0]));
const titleOf = (p) => String(((p.meta || {}).htags || {}).h1?.[0] || (p.meta || {}).title || '').replace(/\s+[|–—-]\s+[^|–—]+$/, '').trim();
const topicOf = (p) => new Set([...toks(titleOf(p)), ...toks(String(p.url).replace(/^https?:\/\/[^\/]+/, ''))].filter(t => !brandToks.has(t)));
const inl = (p) => Number((p.meta || {}).inbound_links_count) || 0;
const sc = a.search_console || {}; const shown = new Map((sc.top_pages || []).map(x => [norm(x.page), Number(x.impressions) || 0]));
const targets = pages.filter(p => norm(p.url) !== norm(siteUrlOf(domain, '/')) && (inl(p) <= 2 || (p.checks || {}).is_orphan_page || (shown.get(norm(p.url)) || 0) >= 50 && inl(p) <= 5) && !/privacy|terms|cookie|legal|login|cart|checkout/i.test(p.url))
  .sort((x, y) => (shown.get(norm(y.url)) || 0) - (shown.get(norm(x.url)) || 0) || inl(x) - inl(y)).slice(0, 25);
const sources = pages.filter(p => inl(p) >= 3 || (Number(p.click_depth) || 9) <= 1);
const internal_links = [];
for (const t of targets) { const tt = topicOf(t); if (!tt.size) continue;
  const best = sources.filter(s => norm(s.url) !== norm(t.url)).map(s => ({ s, score: [...topicOf(s)].filter(x => tt.has(x)).length * 10 + Math.min(9, Math.floor(inl(s) / 5)) })).filter(x => x.score >= 10).sort((x, y) => y.score - x.score).slice(0, 2);
  for (const b of best) internal_links.push({ from_url: b.s.url, to_url: t.url, anchor: titleOf(t).slice(0, 70) || [...tt].slice(0, 4).join(' '), reason: ((t.checks || {}).is_orphan_page || inl(t) === 0 ? 'orphan page (no links in)' : inl(t) + ' internal link(s) in') + ((shown.get(norm(t.url)) || 0) ? '; ' + shown.get(norm(t.url)) + ' impressions in 28 days' : '') }); }
return [{ json: { ...d, audit_id, audited_at, site_id, site_audit: { ...a, audit_id, audited_at, audit_diff, internal_links: internal_links.slice(0, 20) } } }];
