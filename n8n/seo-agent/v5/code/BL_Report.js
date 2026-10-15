// Backlink report per site: monthly FULL report (profile vs last month, 12-month history, lost / new / spammy links, broken links to reclaim,
// link gap, unlinked mentions, the prospect pipeline with outreach drafts) or, on light weeks, a short ALERT e-mail when an important link was
// lost or spam arrived. Attachments: prospects.csv and, when needed, disavow-candidates.txt. Sites with nothing to report stay quiet.
// v4.10: every source merged (coverage per source and against Google's own sample), our own link check (verified / at risk / lost with the
// reason), the best links by SEO / referral / brand value, links that send visits, anchors, competitors' new links, "best X" lists that name
// competitors and not you, the gap from DataForSEO and Common Crawl, follow-up drafts, contacts, and the data credits the sources ask for.
// G29 (2026-10-13, FIX_PLAN): every figure group also says where it came from, over what period and from how big a sample (LN),
// because a backlink count is only ever one index's view of the web and the values are modelled, not measured.
/*__REPORT_KIT__*/
/*__LINEAGE__*/
const sites = $('Parse Backlinks').all().map(i => i.json);
let rows = []; try { rows = $('Prospect Rows').all().map(i => i.json).filter(r => !r.skip); } catch (e) {}
let stored = []; try { stored = $('Load Link Prospects').all().map(i => i.json).filter(x => x && x.prospect_domain); } catch (e) {}
const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
const TYPE = { lost: 'Lost link — ask to restore', mention: 'Unlinked mention — ask for the link', list: '"Best of" list without you', comp_new: 'Just linked to a competitor', gap: 'Links to competitors', ai_source: 'Cited by AI answers', reclaim: 'Broken page — redirect' };
const REASON = { link_removed: 'link removed from the page', page_gone: 'the page is gone (404 / 410)', domain_gone: 'the site is gone', not_seen: 'no index has seen it for 4 months, and it was not on the page when we last read it', reported_lost: 'reported lost by the index — being checked' };
const ACTION = { link_removed: 'Ask the editor to restore it (draft below)', page_gone: 'Ask whether the content moved; offer the link for the new page', domain_gone: 'Nothing to do', not_seen: 'Check the page by hand', reported_lost: 'Checked again next week' };
const SRC = [['dfs', 'DataForSEO index'], ['bing', 'Bing Webmaster Tools'], ['gsc', 'Google Search Console (upload)'], ['ga4', 'GA4 referrals (visits)'], ['cc', 'Common Crawl web graph'], ['wiki', 'Wikipedia'], ['hn', 'Hacker News'], ['news', 'News (GDELT)'], ['web', 'Web search'], ['import', 'Other upload']];
const vtag = (v) => ({ found: '<span style="color:#15803d">✓ on the page</span>', missing: '<span style="color:#b91c1c">not on the page</span>', gone: '<span style="color:#b91c1c">page gone</span>', blocked: '<span style="color:#64748b">bot-blocked (not checked)</span>', js: '<span style="color:#64748b">needs JavaScript</span>', error: '<span style="color:#64748b">error</span>' })[v] || '<span style="color:#64748b">not checked yet</span>';
return sites.filter(s => s.deliver).map(s => {
  const S = s.summary, P = s.previous, C = s.coverage || {}; const full = s.mode === 'full'; const st = C.status || {};
  const CK = C.check || {}, FR = C.freshness || {}, FRO = FR.own || {}, FRI = FR.index || {};
  const dayWord = (d) => d == null ? '' : (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
  const pipe = [...rows.filter(r => r.site_id === s.site_id), ...stored.filter(x => x.site_id === s.site_id && !rows.some(r => r.site_id === s.site_id && r.prospect_domain === x.prospect_domain && r.type === x.type))];
  const won = pipe.filter(r => r.status === 'won' && String(r.won_at || '').slice(0, 10) === s.checked_at.slice(0, 10));
  const counts = ['new', 'contacted', 'won', 'rejected', 'ignored'].map(x => x + ' ' + pipe.filter(r => (r.status || 'new') === x).length).join(' · ');
  const dv = (cur, prev) => P ? (cur - prev > 0 ? '<span style="color:#15803d">+' + n(cur - prev) + '</span>' : cur - prev < 0 ? '<span style="color:#b91c1c">' + n(cur - prev) + '</span>' : 'no change') : 'first check';
  const drCol = s.dr_enabled; const auth = (x) => { const a = Number(x.domain_rank ?? x.authority ?? x.rank) || 0, d = drCol && x.dr !== '' && x.dr != null && Number(x.dr) > 0 ? 'DR ' + n(x.dr) : ''; return a > 0 ? n(a) + (d ? ' · ' + d : '') : (d || '—'); };   // free runs have no DataForSEO authority: DR alone
  const L = s.ledger_rows || [];
  let html = '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;max-width:900px">';
  html += '<h2 style="margin:0 0 2px;font-size:20px">' + (full ? 'Backlinks: ' : 'Backlink alert: ') + esc(s.domain) + '</h2>' + p_(esc(s.checked_at.slice(0, 10)) + ' · changes since ' + esc(s.since.slice(0, 10)) + (full ? ' · monthly report' : ' · weekly watch') + (s.on_demand ? ' · on-demand run' : ''), true);
  html += alertBox(s.alerts.filter(a => full || a.level !== 'low'));
  // B-L5 (2026-10-15, INVARIANTS rule 1): what was NOT compared with the last snapshot, and why. A figure the two snapshots
  // cannot be compared on is said out loud here instead of appearing as "no change".
  if ((s.not_compared || []).length) html += '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:8px 12px;margin:8px 0;font-size:13px"><b>Not compared with the last check</b><ul style="margin:4px 0 0;padding-left:18px">'
    + s.not_compared.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  if (s.free_only) html += p_('<b>Free sources only</b> (asked on demand): Bing, your Search Console upload, GA4, Common Crawl, Wikipedia, Hacker News, news and web search, each important link checked on its page. No DataForSEO and no AI drafts: this check cost $0.', true);
  else if (!S.available) html += p_('The DataForSEO Backlinks API returned no summary (' + esc(S.error || 'no data') + '); the other sources are below.', true);
  html += '<table style="border-collapse:collapse;margin:8px 0"><tr>' + tile('Referring sites (all sources)', n(C.union), P && P.union_domains ? dv(C.union, P.union_domains) : (S.available ? 'DataForSEO alone: ' + n(S.referring_domains) : 'free sources')) + tile('Best links', n(s.best_links), 'SEO value 50+') +
    // B10-2 (2026-10-15, benchmark area 10): this tile used to read "Checked on the page 1" over "18 checked this run" - two
    // different denominators and no rate at all. It now shows what was read and what could not be read, and the rate itself is
    // stated below only when enough pages were readable to state one.
    tile('Checked on their page', n(CK.found) + (CK.read ? ' of ' + n(CK.read) : ''), CK.fetched ? n(CK.fetched) + ' fetched' + (CK.unread ? ' · ' + n(CK.unread) + ' could not be read' : '') : 'none fetched this run') + tile('Visits from links', n(s.referral.visits), 'past year · ' + n(s.referral.visits_28d) + ' in 28 days') +
    (S.available ? tile('Authority (0-1000)', n(S.rank), P && P.rank ? dv(S.rank, P.rank) : '') + tile('Spam score (the index\'s)', S.spam_score + '/100', 'reported by DataForSEO over ' + n(S.backlinks) + ' links') : tile('Authority (0-1000)', '—', 'DataForSEO: monthly full run')) + '</tr></table>';
  // lost and at risk
  const lostC = s.lost.filter(l => !l.pending);
  if (lostC.length || !full) html += h3('Links lost (confirmed by two checks)') + table(['From', 'Authority', 'Pointed to', 'Why', 'What to do'], lostC.slice(0, 15).map(l => [l.from_url ? link(l.from_url, l.from_domain) : esc(l.from_domain), auth(l), esc(pathOf(l.to_url)), esc(REASON[l.reason] || l.reason), esc(ACTION[l.reason] || '')]), 'none');
  if (s.at_risk.length) html += p_('Not found on their page this week, checked again next week before they count as lost: ' + esc(s.at_risk.slice(0, 10).map(a => a.ref_domain).join(', ')) + '.', true);
  // B10-4: an index that stopped re-crawling a page is not a lost link. These rows keep their value and their place in the count,
  // and they are first in next week's check.
  if ((s.dormant || []).length) html += p_('<b>No index has seen ' + n(s.dormant.length) + ' link(s) for more than 4 months</b>, and we have not read their pages yet: ' + esc(s.dormant.slice(0, 10).map(d => d.ref_domain + ' (last seen ' + d.last_seen + ')').join(', ')) + '. They are not counted as lost - an index that stopped re-crawling a page proves nothing - and they are first in the next check.', true);
  if (s.rel_changed.length) html += h3('Links that changed') + table(['Site', 'Page', 'Now'], s.rel_changed.map(r => [esc(r.ref_domain), link(r.url), esc(r.rel)]));
  if (full) {
    // coverage
    const covRows = SRC.filter(([k]) => (C.per_source || {})[k] || ['dfs', 'bing', 'gsc', 'ga4', 'cc'].includes(k)).map(([k, label]) => {
      const note = k === 'bing' ? (st.bing && st.bing.enabled ? (st.bing.connected ? (!(Number(st.bing.links) > 0) ? 'connected; Bing reports no links to this site yet (new sites in Bing: allow a few weeks)' : '') : (st.bing.in_account === false ? 'site not in the Bing account: add it (Search Console import) or have its owner add the account as a user' : esc(st.bing.error || 'not connected'))) : 'off: set SEO_BING_WEBMASTER_API_KEY')
        : k === 'gsc' ? ((st.gsc || {}).uploaded_at ? 'export of ' + esc(String(st.gsc.uploaded_at).slice(0, 10)) : 'upload the Links export in the app (Backlinks → Add Search Console links)')
        : k === 'ga4' ? ((st.ga4 || {}).connected ? (st.ga4.excluded && st.ga4.excluded.length ? 'not links: ' + esc(st.ga4.excluded.slice(0, 4).join(', ')) : '') : ((st.ga4 || {}).property ? esc(st.ga4.error || 'no answer') : 'connect GA4 through "Track my site"'))
        : k === 'cc' ? ((st.cc || {}).release ? 'release ' + esc(st.cc.release) : 'the monthly linkgraph job has not run yet') : '';
      return [esc(label), n((C.per_source || {})[k] || 0), n((C.only_in || {})[k] || 0), note]; });
    html += h3('Where the links were found') + table(['Source', 'Referring sites', 'Only this source', 'Note'], covRows) +
      p_(C.gsc_sample ? 'Of the ' + n(C.gsc_sample) + ' sites in Google\'s own sample (Search Console), DataForSEO sees <b>' + C.dfs_sees_google + '%</b>; at least one other source confirms ' + C.all_see_google + '%.' : 'Upload the Search Console Links export to measure how much of Google\'s view each source covers.', true) +
      p_('DataForSEO finds ' + C.dfs_share + '% of the ' + n(C.union) + ' referring sites; the rest come from the other sources.' + (C.social ? ' Social networks (not counted): ' + n(C.social) + '.' : ''), true) +
      // B10-1: how old this view of the web is. An index's "live" means "live when it last crawled it".
      p_('<b>How fresh this is.</b> ' + (FRI.rows ? 'The link index last saw these links between ' + dayWord(FRI.newest_days) + ' and ' + dayWord(FRI.oldest_days) + ' (middle: ' + dayWord(FRI.median_days) + ', over ' + n(FRI.rows) + ' link(s) it reports). ' : 'The link index reported no sighting dates in this run. ')
        + (FRO.rows ? 'We read ' + n(FRO.checked_this_run) + ' page(s) ourselves in this run; the links confirmed on their page were last read ' + dayWord(FRO.median_days) + ' on average' + (FRO.never_checked ? ', and ' + n(FRO.never_checked) + ' referring site(s) have never been read by us' : '') + '.' : 'No page has been read by us yet.')
        + (FR.gsc_days != null ? ' Google\'s own link sample was uploaded ' + dayWord(FR.gsc_days) + '.' : '') + (FR.cc_release ? ' Common Crawl release ' + esc(FR.cc_release) + (FR.cc_days != null ? ', read ' + dayWord(FR.cc_days) : '') + '.' : ''), true) +
      // B10-2: the one measured figure in this report - and no figure at all when too few pages could be read
      p_('<b>Checked by us, not taken on trust.</b> ' + (CK.precision == null
          ? 'Too few pages could be read this run to state a rate (' + n(CK.read) + ' read, at least ' + n(CK.min_sample) + ' needed)' + (CK.unread ? '; ' + n(CK.unread) + ' could not be read (' + esc(Object.keys(CK.unread_by || {}).map(k => ({ blocked: 'bot wall', js: 'needs JavaScript', error: 'fetch error' }[k] || k) + ' ' + CK.unread_by[k]).join(', ')) + ')' : '') + '.'
          : 'Of the ' + n(CK.read) + ' referring pages we could read, <b>' + CK.found + ' still carry the link (' + CK.precision + '%)</b>'
            + (CK.index_precision == null ? '' : ', and of the ' + n(CK.index_read) + ' the DataForSEO index reports live, ' + CK.index_live + ' are live (' + CK.index_precision + '%)')
            + (CK.unread ? '. ' + n(CK.unread) + ' page(s) could not be read (' + esc(Object.keys(CK.unread_by || {}).map(k => ({ blocked: 'bot wall', js: 'needs JavaScript', error: 'fetch error' }[k] || k) + ' ' + CK.unread_by[k]).join(', ')) + ') and count on neither side' : '') + '.'), true);
    if (s.wins.length) html += h3('Wins') + table(['Site', 'Page', ''], s.wins.slice(0, 12).map(w => [esc(w.ref_domain), link(w.url), w.why === 'restored' ? 'restored' : 'new' + (w.link_type ? ' · ' + esc(w.link_type) : '') + (w.seo ? ' · value ' + w.seo : '')]));
    const best = L.filter(r => r.status !== 'lost' && r.kind === 'web' && r.link_type !== 'spam').sort((a, b) => b.seo_value - a.seo_value).slice(0, 15);
    const farms = s.farms || []; const farmWhy = [...new Set(farms.map(f => String(f.reason || '').replace(/ \(.*$/, '')))].slice(0, 3);
    html += h3('Best links') + table(['From', 'Value (SEO / visits / brand)', 'Type', 'Placement', 'Authority', 'Check'], best.map(r => [link(r.from_url || ('https://' + r.ref_domain + '/'), r.ref_domain), r.seo_value + ' / ' + r.referral_value + ' / ' + r.brand_value, esc(r.link_type || '—') + (r.rel && r.rel !== 'follow' ? ' · ' + esc(r.rel) : ''), esc(r.placement || '—'), auth(r), vtag(r.verify)]), 'no links yet');
    if (farms.length) html += p_('<b>' + farms.length + ' link(s) from link farms set aside</b> — ' + esc(farmWhy.join('; ')) + ': ' + esc(farms.slice(0, 8).map(f => f.ref_domain).join(', ')) + (farms.length > 8 ? ' …' : '') + '. They carry no value here, raise no alert and are on the disavow candidates (review-only: Google ignores them unless you get a manual action).', true);
    const sending = L.filter(r => r.visits > 0).sort((a, b) => b.visits - a.visits).slice(0, 10);
    if (sending.length) html += h3('Links that send visits (GA4, past year)') + table(['From', 'Visits', 'Key events', 'Page'], sending.map(r => [esc(r.ref_domain), n(r.visits), n(r.key_events), link(r.from_url)]));
    if (s.timeseries.length) html += h3('Last 12 months (DataForSEO index)') + table(['Month', 'Referring domains', 'Backlinks'], s.timeseries.slice(-12).map(t => [esc(t.month), n(t.referring_domains), n(t.backlinks)]));
    html += h3('New links') + table(['From', 'Authority', 'Anchor', 'First seen', ''], s.new_links.slice(0, 20).map(l => [l.from_url ? link(l.from_url, l.from_domain) : esc(l.from_domain), auth(l), esc(l.anchor), esc(l.first_seen), l.spammy ? '<span style="color:#b91c1c">spammy</span>' : (l.dofollow ? 'follow' : 'nofollow') + (l.verified ? ' · ' + vtag(l.verified) : '')]), 'no new links since the last check');
    html += h3('Links to broken pages (reclaim with a 301)') + table(['Broken page', 'Status', 'Links', 'From', 'Redirect to'], s.reclaim.map(r => [esc(pathOf(r.broken_url)), esc(r.status || 'error'), n(r.links), esc(r.domains.join(', ')), link(r.redirect_to)]), 'none — every linked page works');
    const K = (s.anchors || {}).kinds || {}; const kt = Object.values(K).reduce((a, b) => a + b, 0);
    // B10-3 (2026-10-15, benchmark area 10): the percentages and the table are computed on the same set - the link farms out of
    // both, counted beside them - and the rule of thumb under it carries the measured distribution it is judged against.
    const AB = (s.anchors || {}).base || {}; const moneyPct = kt ? Math.round(100 * (K.money || 0) / kt) : null;
    if (kt) html += h3('Anchor texts') + p_(['brand', 'url', 'generic', 'money', 'image_or_empty'].filter(k => K[k]).map(k => esc({ brand: 'your name', url: 'web address', generic: 'generic ("here", "website")', money: 'keyword', image_or_empty: 'image / empty' }[k]) + ' ' + Math.round(100 * K[k] / kt) + '%').join(' · ')
      + ' — over ' + n(kt) + ' referring site(s)' + ((s.anchors || {}).set_aside ? ', with ' + n(s.anchors.set_aside) + ' link-farm site(s) left out of both the percentages and the table below' : '')
      + (AB.url ? '. For comparison, ' + esc(AB.source) + ': keyword ' + AB.money + '%, your name ' + AB.brand + '%, web address ' + AB.url + '%, image or empty ' + AB.image_or_empty + '%, generic ' + AB.generic + '%' : '') + '.'
      + (moneyPct != null && moneyPct > (AB.money || 30) && kt >= 10 ? ' <b>Keyword anchors are above that population (' + moneyPct + '%)</b>: ask new links to use your name or the page title.' : ''), true)
      + table(['Anchor', 'Referring domains', 'Kind'], ((s.anchors || {}).top || []).slice(0, 10).map(a => [esc(a.anchor), n(a.referring_domains), esc(a.kind) + (a.farm ? ' <span style="color:#b91c1c">· link farm, set aside</span>' : '')]));
    if (s.comp_new.length) html += h3('Sites that just linked to a competitor') + table(['Site', 'Linked to', 'When', 'Page', 'Authority'], s.comp_new.slice(0, 12).map(c => [esc(c.domain), esc(c.competitor), esc(c.first_seen), link(c.url, c.title || c.url), auth(c)]));
    if (s.lists.length) html += h3('"Best of" lists') + table(['Page', 'Names competitors', 'You'], s.lists.slice(0, 10).map(l => [link(l.url, l.title || l.url), esc(l.competitors.join(', ') || '—'), l.linked ? '<span style="color:#15803d">linked</span>' : l.named ? 'named, no link' : '<b>missing</b>']));
    html += h3('Link gap: sites that link to ' + (s.competitors.length ? s.competitors.join(', ') : 'your competitors') + ' but not to you') + (s.gap_stored ? p_('DataForSEO gap from ' + esc(s.gap_checked) + ' (refreshed every 3 months; links won since then are removed). Common Crawl adds its monthly view.', true) : '') + (s.gap_error ? p_('DataForSEO gap not available: ' + esc(s.gap_error), true) : '') +
      // D23 (2026-10-11): an off-topic gap site stays in the table with its reason, but it is never pitched
      table(['Site', 'Authority', 'Links to', 'Found by'], s.gap.slice(0, 20).map(g => [esc(g.domain) + ((g.off_topic || g.no_pitch) ? '<div style="font-size:11px;color:#64748b">not pitched: ' + esc(g.no_pitch || g.topic_reason || 'off topic') + '</div>' : ''), n(g.rank) + (g.cc_rank ? ' · CC #' + n(g.cc_rank) : ''), esc(g.links_to.join(', ')), esc({ dfs: 'DataForSEO', cc: 'Common Crawl', both: 'both' }[g.source] || g.source)]), s.competitors.length ? 'no gap found' : 'no competitors known yet — add them in the app (Settings → Tracking) or with Site Admin action "monitors"');
    html += h3('Unlinked mentions') + table(['Site', 'Page', 'Found by', ''], s.mentions.slice(0, 15).map(x => [esc(x.domain), link(x.url, x.title || x.url), esc({ news: 'news', web: 'web search', dfs_mention: 'DataForSEO' }[x.source] || x.source), x.verified ? 'checked: names you, no link' : 'not checked']), 'no pages found that name you without linking');
  }
  if (s.spammy.length) html += h3('Spammy new links') + table(['From', 'Spam', 'Anchor'], s.spammy.slice(0, 12).map(l => [esc(l.from_domain), n(l.spam), esc(l.anchor)])) + p_('Google ignores most spam links on its own. ' + (s.disavow_text ? 'A disavow list is attached for review: upload it only for a manual action or a paid-link pattern you did not create.' : ''), true);
  const drafts = pipe.filter(r => r.outreach_body && (r.status || 'new') === 'new').sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)).slice(0, 8);
  const follows = pipe.filter(r => r.status === 'contacted' && r.followup_body && String(r.followup_body).length > 10).slice(0, 8);
  const draftBox = (r, sub, body, tag) => '<div style="border:1px solid #e2e8f0;padding:8px 10px;margin:6px 0"><div style="font-size:12px;color:#64748b">' + esc(r.prospect_domain) + ' · ' + esc(tag) + (r.contact_email ? ' · to: ' + esc(r.contact_email) : '') + ' · ' + esc(r.detail) + '</div><div style="font-weight:600;font-size:13px;margin-top:4px">' + esc(sub) + '</div><pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:4px 0 0">' + esc(body) + '</pre></div>';
  if (full || drafts.length) html += h3('Outreach — this month\'s drafts') + (drafts.length ? drafts.map(r => draftBox(r, r.outreach_subject, r.outreach_body, (TYPE[r.type] || r.type) + ' · score ' + (r.score || 0))).join('') : p_('No new drafts this month.', true));
  if (follows.length) html += h3('Follow-ups due') + follows.map(r => draftBox(r, r.followup_subject, r.followup_body, 'follow-up ' + r.followup_step)).join('');
  if (full) html += h3('Prospect pipeline') + p_(esc(counts) + (won.length ? ' · <b>won this month: ' + esc(won.map(w => w.prospect_domain).join(', ')) + '</b>' : '')) + p_('Mark a prospect as contacted / won / rejected in the app (Backlinks → Outreach) or with Site Admin action "prospect". Contacted prospects get follow-up drafts after 7 and 14 days; "won" is set when the link is found on the page. Full list: prospects.csv.', true);
  html += h3('How this works') + p_('Every Monday the monitor checks for lost and new links and re-checks the valuable ones on their pages (alert e-mail only when something important happened); the first run of each month is the full report. Cost this run: $' + s.cost_usd.toFixed(2) + '.', true) +
    p_('Data: DataForSEO Backlinks; Bing Webmaster Tools; Google Search Console (your upload); Google Analytics 4; the <a href="https://commoncrawl.org/web-graphs" style="color:#1d4ed8">Common Crawl web graph</a>; Wikipedia; Hacker News (Algolia); news from the <a href="https://www.gdeltproject.org/" style="color:#1d4ed8">GDELT Project</a>' + (drCol ? '; <a href="https://ahrefs.com/" style="color:#1d4ed8">Domain Rating by Ahrefs</a>' : '') + '.', true);
  // G29: the same figures with their source, period and sample
  const srcNames = SRC.filter(([k]) => (C.per_source || {})[k]).map(([, label]) => label);
  const lineage = [
    LN.of('Referring sites (all sources)', 'link_graph', { basis: 'measured', period: 'everything seen up to ' + esc(s.checked_at.slice(0, 10)) + ', changes since ' + esc(s.since.slice(0, 10)),
      sample: LN.sample(C.union, 'referring sites in the ledger'), note: srcNames.length ? 'merged from ' + srcNames.join(', ') + '; every source sees part of the web, none sees all of it' : 'no source returned links yet' }),
    s.free_only || !S.available
      ? LN.unknown('Authority (0-1000) and spam score', s.free_only ? 'this was a free check: the DataForSEO index was not asked' : 'the DataForSEO Backlinks API returned no summary (' + String(S.error || 'no data') + ')')
      : LN.of('Authority (0-1000) and spam score', 'backlink_index', { basis: 'reported', period: LN.asOf(s.checked_at), sample: LN.sample(S.referring_domains, 'referring domains in that index'), note: 'DataForSEO\'s own rating of the domain, not a Google figure' }),
    // B10-1 / B10-2: the index's own freshness is a figure like any other, and so is the rate we measured
    FRI.rows ? LN.of('How old the link index\'s view of these links is', 'backlink_index', { basis: 'reported', period: 'last seen between ' + dayWord(FRI.newest_days) + ' and ' + dayWord(FRI.oldest_days),
      sample: LN.sample(FRI.rows, 'links with a sighting date'), note: 'an index\'s "live" means "live when it last crawled"; a complete refresh of a web-wide index takes weeks' })
      : LN.unknown('How old the link index\'s view of these links is', 'no sighting date was returned for any link in this run'),
    CK.precision == null
      ? LN.unknown('Share of the links we read that still carry the link', 'only ' + (CK.read || 0) + ' referring page(s) could be read this run; at least ' + (CK.min_sample || 5) + ' are needed to state a rate')
      : LN.of('Share of the links we read that still carry the link', 'own_check', { basis: 'measured', period: LN.asOf(s.checked_at), sample: LN.sample(CK.read, 'referring pages read'),
          note: 'pages behind a bot wall, JavaScript-only pages and fetch errors are counted on neither side' }),
    LN.of('Links checked on their page (found / at risk / lost)', 'own_check', { basis: 'measured', period: LN.asOf(s.checked_at),
      sample: LN.sample(C.verified, 'links confirmed on the page' + (C.checked_now ? ', ' + C.checked_now + ' fetched this run' : '')), note: 'lost needs two misses with a reason, never one index saying so' }),
    LN.of('SEO, referral and brand value per link', 'model', { basis: 'modelled', period: LN.asOf(s.checked_at), sample: LN.sample(L.length, 'links scored'),
      note: 'computed from authority, placement, rel, topic and visits — not a measurement of ranking value' }),
    LN.of('Visits from links', 'ga4', { basis: 'measured', period: 'the past year, with the last 28 days apart', sample: LN.sample(s.referral.visits, 'referral visits') }),
  ];
  if (drCol) lineage.push(LN.of('Domain Rating (DR)', 'ahrefs', { basis: 'reported', period: LN.asOf(s.checked_at), sample: LN.sample(L.filter(r => Number(r.dr) > 0).length, 'domains rated'), note: 'Ahrefs\' own 0-100 rating' }));
  html += LN.block(lineage) + '</div>';
  const csv = ['site,prospect_domain,type,status,score,authority,spam,detail,source_url,target_url,contact_email,first_seen,last_seen,won_at,outreach_subject,outreach_body,followup_subject,followup_body,note'].concat(pipe.map(r => [r.domain, r.prospect_domain, r.type, r.status, r.score, r.rank, r.spam_score, r.detail, r.source_url, r.target_url, r.contact_email, r.first_seen, r.last_seen, r.won_at, r.outreach_subject, r.outreach_body, r.followup_subject, r.followup_body, r.note].map(csvCell).join(','))).join('\n');
  const subject = (full ? '[Backlinks] ' : '[Backlink alert] ') + s.domain + ' — ' + n(C.union || S.referring_domains) + ' referring sites' + (s.important_lost.length ? ' · ' + s.important_lost.length + ' important link(s) lost' : '') + (s.spammy.length >= 3 ? ' · ' + s.spammy.length + ' spammy' : '') + (won.length ? ' · ' + won.length + ' won' : '');
  const file_name = 'backlinks-' + s.domain.replace(/[^a-z0-9]+/gi, '-') + '-' + s.checked_at.slice(0, 10) + '.html';
  const binary = { data: { data: b64(wrapDoc(subject, html)), mimeType: 'text/html', fileName: file_name, fileExtension: 'html' } };
  if (full && pipe.length) binary.prospects_csv = { data: b64(csv), mimeType: 'text/csv', fileName: 'prospects-' + s.domain.replace(/[^a-z0-9]+/gi, '-') + '.csv', fileExtension: 'csv' };
  if (s.disavow_text) binary.disavow_txt = { data: b64(s.disavow_text), mimeType: 'text/plain', fileName: 'disavow-candidates-' + s.domain.replace(/[^a-z0-9]+/gi, '-') + '.txt', fileExtension: 'txt' };
  const best = L.filter(r => r.status !== 'lost' && r.kind === 'web' && r.link_type !== 'spam').sort((a, b) => b.seo_value - a.seo_value).slice(0, 25).map(r => ({ ref_domain: r.ref_domain, from_url: r.from_url, seo_value: r.seo_value, referral_value: r.referral_value, brand_value: r.brand_value, link_type: r.link_type, rel: r.rel, placement: r.placement, authority: r.authority, dr: r.dr, verify: r.verify, visits: r.visits, sources: r.sources }));
  return { json: { ...s, refdomains: undefined, ledger_rows: undefined, lineage, best, pipeline: { counts, won: won.map(w => w.prospect_domain), total: pipe.length }, prospects: pipe.slice(0, 60), subject, html, file_name, status: 'progress', stage: 'backlinks' }, binary };
});
