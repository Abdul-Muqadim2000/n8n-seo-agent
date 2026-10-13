// Link Builder: everything read this run turned into decisions (LINK_BUILDER_SPEC.md §2-§6), per site —
// - journalist requests matched to the site's topics (deadline kept), resource pages, competitors' broken links → new prospects;
// - every prospect read qualified: gone / blocked / sells links / other language / already linking → not a fit (with the reason); the
//   evidence a personal first line can quote (the sentence naming us, the dead link, the list, the section on our topic); up to 3 contacts
//   ranked author / named person → editorial → general; a contact form when there is no address; the recipient's country (consent rules);
//   our page to point to and the link text to ask for (pickTarget: topic match × position band × links needed, paced per page);
// - the listings checklist (linked / listed / missing / submitted / unknown — a blocked check is unknown, never missing), competitors present;
// - our old URLs that now 404 → redirects to add; what each won link did for its page (impact, with a control group);
// - this week's writer jobs: the best `budget` ready prospects (value × fit), not in free-only checks.
// G12 (2026-10-13, FIX_PLAN): the control-group comparison that read what a won link did now also reads what a page CHANGE did
// (section 5b). One implementation (CT, v5/code/_change_test.js), one set of graded verdicts, the same table (seo_link_impact, with a
// `kind` column: link | page_change). Nothing in it ever says a change caused a move.
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__LISTINGS__*/
/*__CHANGE_TEST__*/
const plans = $('LB Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const rows = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && Object.keys(r).length && !r.error && !r.skip); } catch (e) { return []; } };
const pair = (a, b) => { try { const R = $(a).all().map(i => i.json); const S = $(b).all().map(i => i.json || {}); return R.map((r, i) => ({ r, x: S[i] || {} })).filter(o => !o.r.skip); } catch (e) { return []; } };
const prospects = rows('Load Link Prospects'), outreach = rows('Load Link Outreach'), listingRows = rows('Load Listings'), ledger = rows('Load Backlinks'), impacts = rows('Load Link Impact'), queries = rows('Load Query History');
const contentLog = rows('Load Content Log');   // G12: the dates pages went live, for the page-change test of section 5b
const sources = pair('LB Source Requests', 'Fetch LB Sources'), pagesRead = pair('LB Page Requests', 'Fetch LB Pages'), second = pair('LB Second Requests', 'Fetch LB Second');
const now = new Date(); const iso = now.toISOString(); const day = iso.slice(0, 10);
const htmlOf = (x) => String(x.body ?? x.data ?? ''); const statusOf = (x) => Number(x.statusCode || x.status || 0);
const jsonOf = (x) => { if (!x) return null; if (x.body && typeof x.body === 'object') return x.body; if (x.posts || Array.isArray(x)) return x; try { return JSON.parse(String(x.body ?? x.data ?? '')); } catch (e) { return null; } };
const errOf = (x) => x.error ? String(x.error.message || x.error.description || x.error).slice(0, 160) : '';
const pathKey = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
// the median and the one-decimal rounding of the control-group reading live in CT now (v5/code/_change_test.js), used by both kinds
const LIKELY = { lost: 0.7, mention: 0.9, list: 0.5, comp_new: 0.55, gap: 0.4, ai_source: 0.35, resource: 0.45, broken: 0.6, press: 0.5 };
// the posts of #journorequest (one shared fetch + per-topic searches), newest first, deduplicated
const posts = new Map();
for (const { r, x } of sources.filter(o => o.r.kind === 'press')) for (const pst of ((jsonOf(x) || {}).posts || [])) { const rec = pst.record || {}; if (!pst.uri || posts.has(pst.uri)) continue;
  const handle = (pst.author || {}).handle || ''; const rkey = String(pst.uri).split('/').pop();
  posts.set(pst.uri, { uri: pst.uri, rkey, handle, name: (pst.author || {}).displayName || handle, text: String(rec.text || ''), at: String(rec.createdAt || pst.indexedAt || ''), url: 'https://bsky.app/profile/' + handle + '/post/' + rkey, site_id: r.site_id, topic: r.topic || '' }); }
const deadlineOf = (t) => { for (const m of String(t).matchAll(/deadline[:\s-]+([^\n.]{2,40})/gi)) if (/\d|today|tomorrow|tonight|asap|eod|monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(m[1])) return m[1].trim(); return ''; };   // the deadline followed by a date, not "the 2027 deadline means…"
const out = [];
for (const p of plans) {
  const sid = p.site_id; const comp = p.competitors.map(c => LK.regDomain(c));
  const myLedger = ledger.filter(l => l.site_id === sid); const linking = new Set(myLedger.filter(l => l.status !== 'lost').map(l => l.ref_domain));
  const myProspects = prospects.filter(x => x.site_id === sid); const myOutreach = outreach.filter(o => o.site_id === sid);
  // IDF over our own pages: a site's topic words are everywhere; the rare shared words decide the topic match
  const df = new Map(); const docs = p.pages.map(x => [x.title, x.keyword].join(' ')); for (const d of docs) for (const w of new Set(OK.words(d).map(OK.stem))) df.set(w, (df.get(w) || 0) + 1);
  const topicText = [...p.topics, p.profile.business_type].join(' ');
  // D13: what we sell (the site model's services, else the topics) and whether the facts say we hold an accreditation — the two things
  // that decide whether a prospect is a competitor and whether an accredited-provider list may be asked to add us
  const sellTerms = (p.services && p.services.length ? p.services : [...p.topics, p.profile.business_type]).filter(Boolean);
  const weAreAccredited = OK.accredited(p.accreditation);
  const outreach_rows = [], prospect_rows = [], listing_rows = [], fixes = [];
  const base = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, status: o.status, score: o.score || 0, fit: o.fit || 0, fit_reason: o.fit_reason || '', checks_json: JSON.stringify(o.checks || {}),
    page_url: o.page_url || '', page_title: o.page_title || '', evidence: String(o.evidence || '').slice(0, 600), contacts_json: JSON.stringify(o.contacts || []), contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_form_url: o.contact_form_url || '',
    country: o.country || '', language: o.language || '', target_url: o.target_url || '', target_reason: o.target_reason || '', anchor_hint: o.anchor_hint || '', sequence_json: o.sequence_json || '', deadline: o.deadline || '', drafted_at: o.drafted_at || '', checked_at: iso, request_id: p.request_id || '' });
  const newProspect = (o) => ({ site_id: sid, domain: p.domain, prospect_domain: o.prospect_domain, type: o.type, rank: o.rank || 0, spam_score: 0, detail: String(o.detail || '').slice(0, 300), source_url: o.page_url || '', target_url: o.target_url || '',
    status: 'new', first_seen: iso, last_seen: iso, won_at: '', outreach_subject: '', outreach_body: '', note: '', score: o.score || 0, origin: o.origin || 'link_builder', contact_email: (o.contacts || [])[0] ? o.contacts[0].email : '', contact_url: (o.contacts || [])[0] ? o.contacts[0].source_url || '' : '',
    contacted_at: '', followup_step: 0, followup_subject: '', followup_body: '', verified_at: '', drafted_at: '' });   // the Link Builder's own sequence lives in seo_link_outreach; this row never carries a draft
  // ---- 1. journalist requests (Bluesky #journorequest): recent, on our topics, deadline not obviously past ----
  const press = [...posts.values()].filter(x => (!x.site_id || x.site_id === sid) && (now.getTime() - new Date(x.at).getTime()) / 864e5 <= 10)
    .map(x => ({ ...x, f: OK.fit(x.text, topicText + ' ' + p.topics.join(' '), df, docs.length) })).filter(x => x.f >= 0.34).sort((a, b) => b.f - a.f).slice(0, 3);
  for (const x of press) { if (myOutreach.some(o => o.type === 'press' && o.page_url === x.url)) continue;
    const em = (String(x.text).match(/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i) || [])[0];
    const o = { prospect_domain: (String(x.handle || 'bsky') + '/' + x.rkey).toLowerCase(), type: 'press',   /* one row per request: a journalist account posts many */ status: em ? 'ready' : 'needs_contact', score: Math.round(60 * x.f + 20), fit: x.f, fit_reason: 'request on your topic (' + Math.round(x.f * 100) + '% match)', page_url: x.url, page_title: 'Journalist request by ' + x.name,
      evidence: x.text.slice(0, 500), contacts: em ? [{ email: em.toLowerCase(), kind: 'person', own: false, source_url: x.url }] : [], contact_form_url: em ? '' : x.url, deadline: deadlineOf(x.text), target_url: p.home, target_reason: 'an expert answer names the business: the homepage', anchor_hint: 'brand', checks: { posted: x.at.slice(0, 10), how: em ? 'e-mail in the request' : 'reply on Bluesky or the link in the request' } };
    outreach_rows.push(base(o)); prospect_rows.push(newProspect({ ...o, detail: 'Journalist request: ' + x.text.slice(0, 240), origin: 'bluesky' })); }
  // ---- 2. every prospect page read: qualify, evidence, contacts, our page ----
  const contactsBy = new Map(); const formBy = new Map(); const deadBy = new Map();
  for (const { r, x } of second.filter(o => o.r.site_id === sid)) {
    const html = htmlOf(x); const st = statusOf(x);
    if (r.kind === 'contact' && html && st < 400 && !LK.challenge(st, html)) { const l = contactsBy.get(r.prospect_domain) || []; l.push(...OK.contactsIn(html, r.prospect_domain, r.url)); contactsBy.set(r.prospect_domain, l); const f = OK.contactForm(html, r.url); if (f && !formBy.has(r.prospect_domain)) formBy.set(r.prospect_domain, f); }
    if (r.kind === 'outbound') { const e = errOf(x); const dead = st === 404 || st === 410 || /ENOTFOUND|NXDOMAIN|EAI_AGAIN.*ENOTFOUND|certificate has expired/i.test(e);
      if (dead) { const l = deadBy.get(r.prospect_domain) || []; l.push({ url: r.url, anchor: r.anchor, status: st || 'no DNS', on_page: r.on_page }); deadBy.set(r.prospect_domain, l); } }
  }
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'prospect')) {
    const stored = myProspects.find(y => y.prospect_domain === r.prospect_domain && y.type === r.type) || {};
    const html = htmlOf(x); const st = statusOf(x); const e = errOf(x);
    const o = { prospect_domain: r.prospect_domain, type: r.type, page_url: r.url, score: Number(stored.score) || 0, checks: {}, country: OK.countryOf(r.prospect_domain) };
    const isNew = !stored.prospect_domain;
    if (linking.has(LK.refKey(r.prospect_domain))) continue;   // already links to us (the Backlink Monitor marks it won)
    let reasons = [];
    if (OK.isGov(r.prospect_domain)) reasons.push('government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)');
    if ((!html && e) || st === 404 || st === 410) reasons.push(st ? 'their page answers ' + st : 'their site does not answer');
    const blocked = !!html && LK.challenge(st, html);
    const facts = html && !blocked ? LK.pageFacts(html, x.headers, r.url) : {};
    if (html && !blocked) { reasons.push(...OK.sellSignals(html, facts));
      const lang = String(facts.lang || '').slice(0, 2).toLowerCase(); const L = String(p.language_code || 'en').slice(0, 2).toLowerCase();
      if (lang && lang !== L && !(lang === 'ar' && /^(AE|SA|QA|KW|BH|OM|EG|JO)$/.test(p.country_iso || ''))) reasons.push('page in another language (' + lang + ')'); }   // Arabic pages in Arab markets are fine for an English pitch
    const t = html && !blocked ? LK.text(html) : '';
    o.page_title = facts.title || r.title || stored.detail || '';
    // the evidence a first line can quote
    let evidence = '';
    if (r.type === 'broken' && r.dead_url) { const at = html.indexOf(r.dead_url.replace(/^https?:/, '')); if (html && at < 0 && !blocked) reasons.push('the dead link is no longer on their page');
      evidence = 'Dead link on their page: "' + (r.dead_anchor || r.dead_url) + '" → ' + r.dead_url + (at >= 0 ? ' — ' + LK.contextAt(html, at, 120) : ''); o.checks.dead = { url: r.dead_url, anchor: r.dead_anchor, competitor: r.competitor }; }
    const dead = (deadBy.get(r.prospect_domain) || []).filter(d => !LK.sameSite(LK.hostOf(d.url), p.domain));
    if (dead.length && !o.checks.dead) { o.checks.dead = dead[0]; if (['resource', 'gap', 'comp_new'].includes(r.type) && !evidence) { evidence = 'Dead link on their page: "' + (dead[0].anchor || dead[0].url) + '" → ' + dead[0].url + ' (' + dead[0].status + ')'; o.checks.angle = 'broken'; } }   // on a list or a mention the ask stays "add us"
    if (!evidence && r.type === 'mention' && t) { const re = new RegExp(p.brand_names.map(b => String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i'); const i = t.search(re); if (i >= 0) evidence = 'They name you: "…' + t.slice(Math.max(0, i - 140), i + 160).trim() + '…"'; }
    if (!evidence && t) { const named = comp.filter(c => t.toLowerCase().includes(c.split('.')[0])); const sent = t.split(/(?<=[.!?])\s+/).find(s => s.length > 40 && s.length < 400 && OK.fit(s, topicText, df, docs.length) >= 0.3);
      evidence = [named.length ? 'Names ' + named.join(', ') : '', sent ? '"' + sent.trim().slice(0, 300) + '"' : ''].filter(Boolean).join(' — '); o.checks.competitors_named = named; }
    if (!evidence) evidence = stored.detail || '';
    o.evidence = evidence;
    // topic fit (their page vs our topics); a low match is a note, not a refusal — the writer decides with the evidence
    o.fit = t ? OK.fit(o.page_title + ' ' + t.slice(0, 4000), topicText, df, docs.length) : (blocked ? 0.3 : 0);
    o.fit_reason = blocked ? 'their page blocks automated reading: check it yourself' : 'topic match ' + Math.round(o.fit * 100) + '%' + (facts.noindex ? ' · page is noindex (no search value)' : '');
    o.language = String(facts.lang || '').slice(0, 5);
    // ---- D13: who is never pitched (live 2026-10-11: competitors, bare homepages, mailbox providers and contact databases were) ----
    const bad = OK.badHost(r.prospect_domain); if (bad) reasons.push(bad);
    const onlyHome = OK.homepageOnly(r.type, r.url); if (onlyHome) reasons.push(onlyHome);
    const competing = OK.sellsSame({ type: r.type, domain: r.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals, title: o.page_title, text: t, terms: sellTerms });   // R4: a SERP rival counts as a competitor
    if (competing) reasons.push(competing);
    if (!weAreAccredited && OK.accreditedList(o.page_title + ' ' + r.url))   // the page IS such a list (its title / address says so); a page that merely names accredited providers is fine
      reasons.push('a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one (asking to be added claims it)');
    // contacts: the page itself + author / contact / about pages
    const cands = [...(html && !blocked ? OK.contactsIn(html, r.prospect_domain, r.url) : []), ...(contactsBy.get(r.prospect_domain) || [])];
    if (stored.contact_email && !cands.some(c => c.email === stored.contact_email)) cands.push({ email: stored.contact_email, kind: OK.kindOf(stored.contact_email), own: LK.sameSite(stored.contact_email.split('@')[1], r.prospect_domain), w: 2, source_url: stored.contact_url || '' });
    o.contacts = OK.rankContacts(cands); o.contact_form_url = o.contacts.length ? '' : (formBy.get(r.prospect_domain) || '');
    // our page and the link text
    const lostRow = r.type === 'lost' ? myLedger.find(l => l.ref_domain === r.prospect_domain) : null;
    const toCanon = (u) => { const hit = (p.pages || []).find(x => pathKey(x.url) === pathKey(u)); return hit ? hit.url : u; };   // D13 / D15: the page we ask them to link to is the one on our canonical host, not the host an old ledger row stored
    const tg = OK.pickTarget({ type: r.type === 'ai_source' && /list|best|top/i.test(o.page_title) ? 'ai_list' : (o.checks.angle === 'broken' ? 'broken' : r.type), text: o.page_title + ' ' + evidence, topics: p.topics.slice(0, 2).join(' '), dead_text: o.checks.dead ? [o.checks.dead.anchor, String(o.checks.dead.url).replace(/[\/_.-]+/g, ' ')].join(' ') : '', to_url: lostRow ? toCanon(lostRow.to_url) : '' }, p.pages, df, docs.length, p.home);
    o.target_url = tg.url; o.target_reason = tg.reason; o.anchor_hint = tg.anchor;
    if (!blocked && t && ['gap', 'comp_new', 'resource', 'broken'].includes(r.type) && o.fit < (r.type === 'broken' ? 0.15 : OK.OFF_TOPIC)) reasons.push('off topic for you (' + Math.round(o.fit * 100) + '% match)');
    if (isNew) o.score = Math.round(100 * (LIKELY[r.type] || 0.3) * (0.4 + 0.6 * Math.min(1, o.fit + 0.2)) * (r.rank ? Math.min(1.2, 0.6 + Number(r.rank) / 600) : 1));
    o.status = reasons.length ? 'not_fit' : (o.contacts.length ? 'ready' : 'needs_contact');
    o.checks.reasons = reasons; o.checks.page_status = st || (e ? 'error' : ''); o.checks.blocked = blocked; o.checks.noindex = !!facts.noindex;
    if (o.status === 'not_fit') o.fit_reason = reasons.join('; ');
    outreach_rows.push(base(o));
    if (isNew && o.status !== 'not_fit') prospect_rows.push(newProspect({ ...o, rank: r.rank || 0, detail: r.type === 'broken' ? 'Links to ' + (r.competitor || 'a competitor') + "'s dead page " + r.dead_url : r.type === 'resource' ? 'Resource page on "' + (r.topic || p.topics[0] || '') + '": ' + o.page_title : o.page_title, origin: r.type === 'broken' ? 'dfs' : 'web' }));
  }
  // ---- 2b. prospects nobody can be written to, refused without reading their site (D13): a mailbox provider, a contact database, a CDN,
  //      a statistics page, a government portal or a declared competitor. The Backlink Monitor and AI Growth keep finding them. ----
  for (const x of myProspects.filter(x => (x.status || 'new') === 'new' && x.type !== 'reclaim'
      && !outreach_rows.some(o => o.prospect_domain === x.prospect_domain && o.type === x.type)
      && !myOutreach.some(o => o.prospect_domain === x.prospect_domain && o.type === x.type && o.status === 'drafted'))) {
    const why = OK.badHost(x.prospect_domain)
      || (OK.isGov(x.prospect_domain) ? 'government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)' : '')
      || OK.sellsSame({ type: x.type, domain: x.prospect_domain, competitors: p.competitors, serp_rivals: p.serp_rivals });   // R4
    if (!why) continue;
    outreach_rows.push(base({ prospect_domain: x.prospect_domain, type: x.type, status: 'not_fit', score: Number(x.score) || 0, fit: 0, fit_reason: why,
      page_url: x.source_url || '', page_title: String(x.detail || '').slice(0, 140), evidence: String(x.detail || ''), country: OK.countryOf(x.prospect_domain), checks: { reasons: [why], read: false } }));
  }
  // ---- 3. our old URLs that now 404 (Wayback) → a redirect to the closest live page ----
  for (const { r, x } of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'wayback_check')) {
    const st = statusOf(x); if (st !== 404 && st !== 410) continue;
    const words = String(r.url).replace(/^https?:\/\/[^\/]+/, '').replace(/[\/_.-]+/g, ' ');
    const best = p.pages.filter(pg => pg.kind !== 'home').map(pg => ({ pg, f: OK.fit(words, [pg.title, pg.keyword, pg.url.replace(/[\/_.-]+/g, ' ')].join(' '), df, docs.length) })).sort((a, b) => b.f - a.f)[0];
    fixes.push({ from: r.url, to: best && best.f >= 0.3 ? best.pg.url : p.home, archived_at: r.archived_at, status: st });
  }
  for (const f of fixes.slice(0, 30)) outreach_rows.push(base({ prospect_domain: LK.normUrl(f.from), type: 'redirect',   /* one row per old URL */ status: 'fix', page_url: f.from, target_url: f.to, target_reason: 'answered ' + f.status + '; archived ' + String(f.archived_at).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), evidence: 'Add a 301 redirect from ' + f.from + ' to ' + f.to + ' (links and bookmarks to the old URL keep working).', checks: { kind: 'wayback' } }));
  // ---- 4. the listings checklist ----
  if (p.due.listings) {
    const selfHtml = pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'self').map(o => htmlOf(o.x)).join(' ');
    const kind = siteKind(p.profile.business_type, p.topics.join(' '));
    for (const l of listingsFor(kind, p.country_iso, topicText, LK.text(selfHtml))) {
      const old = listingRows.find(y => y.site_id === sid && y.listing_id === l.id) || {};
      let status = 'unknown', profile_url = '', rel = l.link, evidence = '', blocked_now = false;
      const led = myLedger.find(y => y.status !== 'lost' && (y.ref_domain === l.host || LK.sameSite(y.ref_domain, l.host) || LK.sameSite(l.host, y.ref_domain)) && (l.list ? LK.normUrl(y.from_url) === LK.normUrl(l.list) : l.re ? l.re.test(y.from_url || '') : true));   // the list page itself, the profile pattern, else the host
      if (led) { status = 'linked'; profile_url = led.from_url || ''; rel = led.rel || rel; evidence = 'their page links to you (link check)'; }
      const selfLink = l.re ? [...selfHtml.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]).find(u => l.re.test(u)) || (selfHtml.match(new RegExp('"(https?:[^"]*' + l.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*)"', 'i')) || [])[1] : '';
      if (status === 'unknown' && selfLink && (!l.re || l.re.test(selfLink))) { status = 'listed'; profile_url = selfLink; evidence = 'your site links to the profile'; }
      const comps = [];
      for (const o of pagesRead.filter(o => o.r.site_id === sid && o.r.kind === 'comp_home')) { const h = htmlOf(o.x); if (l.re && [...h.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].some(m => l.re.test(m[1]))) comps.push(o.r.competitor); }
      for (const o of pagesRead.filter(o => o.r.site_id === sid && ((o.r.listing_id === l.id && (o.r.kind === 'listing_list' || o.r.kind === 'listing_profile')) || (l.list && o.r.kind === 'prospect' && LK.normUrl(o.r.url) === LK.normUrl(l.list))))) {   // a list page read as a prospect counts too
        const h = htmlOf(o.x); const st = statusOf(o.x); const asList = o.r.kind === 'listing_list' || o.r.kind === 'prospect';
        // P34-2 (live 2026-10-12): a page nobody could read claims nothing. A challenge, any 4xx that is not a 404 / 410 and any 5xx is
        // "blocked": AlternativeTo answered 403 ("Just a moment…") and was reported "listed" because a search had found the URL.
        const blocked = !h || LK.challenge(st, h) || (st >= 400 && st !== 404 && st !== 410);
        const v = blocked ? { verify: 'blocked' } : LK.verify(o.x, p.domain, { url: o.r.url });
        const claim = listingClaim({ blocked, status: st, links_us: v.verify === 'found', named: blocked ? '' : OK.namesUs(LK.text(h), [p.brand, ...(p.brand_names || []), p.domain]),
          as_list: asList, guessed: !!o.r.guessed, gone: st === 404 || st === 410, url: o.r.url });   // OK.namesUs: a whole brand token or the domain, never "tech" for "Tech&"
        if (blocked) { blocked_now = true;   // a URL a search found is still worth opening by hand — but it is not a listing until someone sees it
          const found = o.r.kind === 'listing_profile' && !o.r.guessed;
          if (found && !profile_url) profile_url = o.r.url;
          if (status === 'unknown') evidence = found ? 'a profile was found by search (' + o.r.url + ') but the platform blocks checks' + (st ? ' (HTTP ' + st + ')' : '') + ': open it to confirm — it is not counted as a listing' : claim.evidence;
          continue; }
        if (claim.status === 'linked') { status = 'linked'; profile_url = o.r.url; rel = v.rel; evidence = claim.evidence; }
        else if (claim.status === 'listed' && status !== 'linked') { status = 'listed'; profile_url = o.r.url; evidence = claim.evidence; }
        else if (status === 'unknown' && claim.status === 'missing') { status = 'missing'; evidence = claim.evidence; }
        else if (status === 'unknown') { evidence = evidence || claim.evidence; }
        if (asList) for (const c of p.competitors) if (h.toLowerCase().includes(c.toLowerCase()) && !comps.includes(c)) comps.push(c);
      }
      // D13: a platform that blocks this week's check keeps the last definite answer with the date it was checked — never a fresh "unknown"
      // (the Ministry of Finance list flipped from "missing" to "unknown" within one day, live 2026-10-11)
      if (status === 'unknown' && ['linked', 'listed', 'missing'].includes(String(old.status || ''))) {
        status = old.status; profile_url = profile_url || old.profile_url || '';
        evidence = old.status + ' (checked ' + String(old.checked_at || '').slice(0, 10) + ')' + (blocked_now ? ' · the platform blocks checks now' : ' · nothing new could be read this week'); }
      if (['submitted', 'ignored'].includes(old.status) && !['linked', 'listed'].includes(status)) { status = old.status; }
      listing_rows.push({ site_id: sid, domain: p.domain, listing_id: l.id, name: l.name, category: l.cat, status, profile_url: profile_url || old.profile_url || '', rel: status === 'linked' ? rel : l.link, competitors: comps.join(', '), submit_url: l.submit || '',
        priority: l.prio + (comps.length ? -0.5 : 0), why: (evidence ? evidence + ' · ' : '') + l.why, checked_at: iso, submitted_at: old.submitted_at || '', note: old.note || '' });
    }
  }
  // ---- 5. what each won link did for its page (Search Console positions, control group of the site's other pages) ----
  const myQ = queries.filter(q => q.site_id === sid && q.page);
  const periods = [...new Set(myQ.map(q => String(q.period_end || '')))].filter(Boolean).sort();
  const pagePos = (period) => { const m = new Map(); for (const q of myQ.filter(q => String(q.period_end) === period)) { const k = pathKey(q.page); const i = Math.max(1, Number(q.impressions) || 0); const pos = Number(q.position) || 0; if (!pos) continue; const e = m.get(k) || { w: 0, s: 0, c: 0, q: q.query, qi: 0 }; e.w += i; e.s += pos * i; e.c += Number(q.clicks) || 0; if (i > e.qi) { e.q = q.query; e.qi = i; } m.set(k, e); } return m; };
  const impact_rows = [];
  // links that appeared after tracking began (the first run records every existing link as first seen that day: no t0 for them; live 2026-10-11)
  const trackStart = myLedger.map(l => String(l.first_seen || '')).filter(Boolean).sort()[0] || '';
  const farms = LK.footprints(myLedger, { domain: p.domain, brands: p.brand_names || [] });   // link-farm pages (D3): no impact tracking, whatever an older ledger row says
  const won = myLedger.filter(l => l.status !== 'lost' && l.kind === 'web' && l.link_type !== 'spam' && !farms.has(l.ref_domain) && l.to_url && l.first_seen && trackStart && new Date(l.first_seen).getTime() - new Date(trackStart).getTime() >= 7 * 864e5 && (now.getTime() - new Date(l.first_seen).getTime()) / 864e5 <= 200 && (l.verify === 'found' || Number(l.seo_value) >= 20));
  const lastPeriod = periods[periods.length - 1];
  // one reading: the page's own move before / after the date, minus what the site's OTHER pages did over the same weeks (CT.compare).
  // `exclude` keeps pages that changed inside the same window out of the control group, as the link reading always did.
  const readChange = (o) => {
    const t0 = String(o.t0).slice(0, 10); const weeks = Math.floor((now.getTime() - new Date(t0).getTime()) / (7 * 864e5)); const k = pathKey(o.target_url);
    const before = periods.filter(x => x <= t0).pop(); const after = lastPeriod;
    const B = before ? pagePos(before) : null, A = after && after !== before ? pagePos(after) : null;
    const pb = B && B.get(k), pa = A && A.get(k);
    const others = (B && A) ? [...A.keys()].filter(x => x !== k && B.has(x) && !o.exclude(x, before)).map(x => (B.get(x).s / B.get(x).w) - (A.get(x).s / A.get(x).w)) : [];
    const cmp = CT.compare({ kind: o.kind === 'page_change' ? 'page' : 'link', weeks, base: pb ? pb.s / pb.w : null, now: pa ? pa.s / pa.w : null, others, joint: o.joint,
      no_data: !myQ.length ? 'no Search Console data for this site' : (!before && o.kind === 'page_change') ? 'no stored Search Console period from before the change' : '' });
    const read = !['too_early', 'cant_tell'].includes(cmp.verdict);
    return { site_id: sid, domain: p.domain, kind: o.kind, change: o.change || '', ref_domain: o.ref_domain || '', from_url: o.from_url || '', target_url: o.target_url, t0, weeks: cmp.weeks,
      base_position: cmp.base_position, base_clicks: read ? pb.c : 0, position: cmp.position, clicks: read ? pa.c : 0, page_change: cmp.page_change, control_change: cmp.control_change,
      control_spread: cmp.control_spread, effect: cmp.effect, verdict: cmp.verdict, note: cmp.note, keyword: read ? (pa.q || pb.q || '') : '', updated_at: iso };
  };
  for (const l of won.slice(0, 30)) {
    const t0 = String(l.first_seen).slice(0, 10); const k = pathKey(l.to_url);
    impact_rows.push(readChange({ kind: 'link', t0, target_url: l.to_url, ref_domain: l.ref_domain, from_url: l.from_url || '',
      exclude: (x, before) => won.some(w => pathKey(w.to_url) === x && String(w.first_seen).slice(0, 10) >= before),
      joint: won.filter(w => w !== l && pathKey(w.to_url) === k && Math.abs(new Date(w.first_seen).getTime() - new Date(t0).getTime()) <= 28 * 864e5).length }));
  }
  // ---- 5b. G12: what each PAGE CHANGE did for its page, read exactly the same way (seo_content_log dates, kind page_change) ----
  const changes = new Map();
  for (const r of contentLog.filter(r => r.site_id === sid && String(r.published_at || '').slice(0, 10) && String(r.published_url || ''))) {
    const t0 = String(r.published_at).slice(0, 10); const k = pathKey(r.published_url);
    const kind = (String(r.existing_page_url || '') && pathKey(r.existing_page_url) === k) ? 'rewritten' : 'published';
    const old = changes.get(k);
    if (!old || t0 > old.t0) changes.set(k, { t0, url: String(r.published_url), change: kind, keyword: String(r.keyword || '') });
  }
  const changeList = [...changes.values()].filter(c => (now.getTime() - new Date(c.t0).getTime()) / 864e5 <= 400).sort((a, b) => b.t0.localeCompare(a.t0)).slice(0, 30);
  for (const c of changeList) {
    impact_rows.push(readChange({ kind: 'page_change', t0: c.t0, target_url: c.url, change: c.change,
      exclude: (x, before) => changes.has(x) && changes.get(x).t0 >= before && x !== pathKey(c.url),
      joint: won.filter(w => pathKey(w.to_url) === pathKey(c.url) && Math.abs(new Date(w.first_seen).getTime() - new Date(c.t0).getTime()) <= 28 * 864e5).length }));
  }
  // ---- 6. this week's writer jobs: the best ready prospects (new rows of this run + stored ready rows), not in free-only checks ----
  const ready = [...outreach_rows.filter(o => o.status === 'ready'), ...myOutreach.filter(o => o.status === 'ready' && !o.sequence_json && !outreach_rows.some(n => n.prospect_domain === o.prospect_domain && n.type === o.type))]
    .map(o => ({ ...o, rankv: (Number(o.score) || 0) * (0.5 + Number(o.fit || 0)) })).sort((a, b) => b.rankv - a.rankv);
  const jobs = p.free_only ? [] : ready.slice(0, p.budget).map(({ rankv, ...o }) => o);
  const stillOld = (k) => !(myOutreach.find(o => o.prospect_domain + '|' + o.type === k) || {}).sequence_json;
  out.push({ json: { site_id: sid, domain: p.domain, email: p.email, callback_url: p.callback_url, request_id: p.request_id, on_demand: p.on_demand, free_only: p.free_only, checked_at: iso,
    outreach_rows, prospect_rows, listing_rows, impact_rows, jobs: jobs.filter(j => stillOld(j.prospect_domain + '|' + j.type)), fixes,
    cache_row: { key: 'linkbld:' + sid, kind: 'linkbld', site_id: sid, value: JSON.stringify({ ...p.state, listings_at: p.due.listings ? iso : p.state.listings_at, resources_at: p.due.resources ? iso : p.state.resources_at, wayback_at: p.due.wayback ? iso : p.state.wayback_at, broken_at: p.due.broken ? iso : p.state.broken_at, last_run: iso }), updated_at: iso },
    summary: { press: press.length, qualified: outreach_rows.filter(o => !['not_fit', 'fix'].includes(o.status)).length, not_fit: outreach_rows.filter(o => o.status === 'not_fit').length, needs_contact: outreach_rows.filter(o => o.status === 'needs_contact').length,
      ready: ready.length, to_draft: jobs.length, redirects: fixes.length, listings_missing: listing_rows.filter(l => l.status === 'missing').length, listings_linked: listing_rows.filter(l => l.status === 'linked').length,
      impact_reads: impact_rows.filter(r => r.kind === 'link' && !['too_early', 'cant_tell'].includes(r.verdict)).length,
      page_changes: impact_rows.filter(r => r.kind === 'page_change').length,
      change_reads: impact_rows.filter(r => r.kind === 'page_change' && !['too_early', 'cant_tell'].includes(r.verdict)).length } } });
}
return out.length ? out : [{ json: { skip: true } }];
