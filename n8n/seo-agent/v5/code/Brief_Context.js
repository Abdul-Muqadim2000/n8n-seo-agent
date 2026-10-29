/*__FIT_GATE__*/
/*__ANCHOR__*/
/*__SITE_MODEL__*/
/*__EXCLUSIONS__*/
// Content runs (v4.4): what the brief, the copy, the schema and the blog package need beyond the keyword research —
// the site's business profile (author, reviewer, address / NAP), proof from its case studies, the page role (hub, case study, local,
// standard), the cluster pages a hub links down to, and the video details (YouTube page / Vimeo oEmbed, read by Fetch Video Details).
// 2026-10-11 (FIX_PLAN D8): a cluster page that is another company's brand (or a government / portal search) never reaches the writer, even
// when an older ladder row still carries it.
const d = $('Parse Verdict').first().json;
const rowsOf = (name) => { try { return $(name).all().map(i => i.json).filter(x => x && typeof x === 'object' && !x.error && Object.keys(x).length); } catch (e) { return []; } };
const s = (v) => String(v == null ? '' : v).trim();
const list = (v, sep) => s(v).split(sep || /\s*,\s*/).map(x => x.trim()).filter(Boolean);
const domain = s(d.domain).toLowerCase();
const site_id = 'site_' + domain.replace(/[^a-z0-9]+/g, '-');
const kw = s(d.keyword).toLowerCase();

// ---- business profile: the stored row, with per-request author / reviewer overrides (API `author` / `reviewer`) ----
const AUTHOR_KEYS = ['author_name', 'author_job_title', 'author_credentials', 'author_bio', 'author_url', 'author_image_url', 'author_same_as', 'author_knows_about', 'reviewer_name', 'reviewer_job_title', 'reviewer_url'];
const stored = domain ? (rowsOf('Load Profile (Brief)').find(r => r.site_id === site_id) || null) : null;
const P = { ...(stored || {}) }; const over = d.profile_input || {};
if (over.author_name) for (const k of AUTHOR_KEYS.filter(k => k.startsWith('author_'))) P[k] = s(over[k]);
if (over.reviewer_name) for (const k of AUTHOR_KEYS.filter(k => k.startsWith('reviewer_'))) P[k] = s(over[k]);
const sameAs = list(P.author_same_as, /\s+/).filter(u => /^https?:\/\//i.test(u));
const author = s(P.author_name) ? { name: s(P.author_name), job_title: s(P.author_job_title), credentials: s(P.author_credentials), bio: s(P.author_bio), url: s(P.author_url) || sameAs[0] || '', has_author_page: !!s(P.author_url), image_url: s(P.author_image_url),
  same_as: sameAs, knows_about: list(P.author_knows_about) } : null;   // no author page on the site: the byline links to the first public profile
const reviewer = s(P.reviewer_name) ? { name: s(P.reviewer_name), job_title: s(P.reviewer_job_title), url: s(P.reviewer_url) } : null;
const hasBiz = ['business_name', 'street_address', 'city', 'phone'].some(k => s(P[k]));
const site_profile = hasBiz || author ? { business_name: s(P.business_name), business_type: s(P.business_type), logo_url: s(P.logo_url),
  address: { street: s(P.street_address), city: s(P.city), region: s(P.region), postal_code: s(P.postal_code), country_code: s(P.country_code) || s(d.country_iso) },
  phone: s(P.phone), public_email: s(P.public_email), opening_hours: s(P.opening_hours), price_range: s(P.price_range), service_areas: list(P.service_areas), map_url: s(P.map_url), stored: !!stored } : null;

// ---- which angles the facts support (FIX_PLAN D10, 2026-10-12) ----
// The live page of execution 365 was built on cost and timeline — the gap the competitor analysis found — although the business had given
// no prices and no timelines, so the copy ended up with 30 × [Price] and 20 × [Timeline]. A cost or timeline angle is allowed only when
// such facts exist: the site model answers that (profile price range, business facts, call to action), and the case facts count too.
let site_model = null;
try { site_model = $('Site Model').first().json.site_model || null; } catch (e) {}
if (!site_model && d.site_model && typeof d.site_model === 'object') site_model = d.site_model;
const model = site_model || SM.from({ domain }, { profile: P, request: d, description: d.site_description || {} });
const mFacts = SM.facts(model);
const csIn = (d.case_study && typeof d.case_study === 'object') ? d.case_study : {};
const ownText = [d.business_facts, s(P.price_range), csIn.timeline, csIn.results].map(s).filter(Boolean).join(' ');
const pricing_facts = !!(mFacts.pricing || (/\d/.test(ownText) && /(\$|£|€|₹|\b(aed|sar|pkr|inr|usd|gbp|eur)\b|\bprice|\bpricing|\bcost|\bfee|per (user|seat|month|hour|day|project))/i.test(ownText)));
const timeline_facts = !!(mFacts.timeline || /\b\d+\s*(day|week|month|year)s?\b|\btimeline\b|\bgo.?live\b|\bturnaround\b|\bwithin \d/i.test(ownText));
const angle_rules = (pricing_facts && timeline_facts)
  ? 'ANGLE: price and timeline facts are on file, so a cost or a timeline angle is allowed — but every figure must come from the facts above, never from the competitors or from an estimate.'
  : 'ANGLE LIMIT: this business has given no ' + (pricing_facts ? 'timeline facts' : timeline_facts ? 'price facts' : 'price or timeline facts')
    + ', so the page must NOT be built on ' + (pricing_facts ? 'how long the work takes' : timeline_facts ? 'what it costs' : 'what it costs or how long it takes')
    + '. Do not make that the unique_angle, do not promise it in information_gain, do not plan a comparison-table column for it and never plan a row that can only be filled with [Price] or [Timeline].'
    + ' A buyer question about ' + (pricing_facts ? 'duration' : 'cost') + ' may still be answered — qualitatively: what drives it, which choices change it, what to ask a vendor for, with no numbers and no placeholders.'
    + ' Build the page on something the facts support instead: the compliance or regulatory requirements, a decision framework, the risks and how to avoid them, integration depth, migration effort, local rules, or what separates the options.';

// ---- proof: the site's recorded case studies (anonymised where the client may not be named) ----
const proof_library = domain ? rowsOf('Load Case Studies (Brief)').filter(r => r.site_id === site_id && r.case_id !== d.case_id)
  .sort((a, b) => s(b.created_at).localeCompare(s(a.created_at))).slice(0, 6)
  .map(r => { const pub = r.client_public === true || r.client_public === 'true';
    return { title: s(r.title), client: pub ? s(r.client_name) : ('a ' + (s(r.industry) ? s(r.industry) + ' business' : 'client') + (s(r.location) ? ' in ' + s(r.location) : '')), industry: s(r.industry), location: s(r.location), service: s(r.service),
      results: s(r.results).slice(0, 400), quote: s(r.quote).slice(0, 300), quote_by: pub ? s(r.quote_by) : s(r.quote_by).replace(/^[^,]+,\s*/, ''), url: s(r.status) === 'published' ? s(r.page_url) : '' }; }) : [];

// ---- page role ----
const pt = s(d.page_type).toLowerCase();
const isHub = Number(d.ladder_rung) === 4 || /pillar|hub/.test(pt);
const cs = d.case_study && typeof d.case_study === 'object' ? d.case_study : null;
const page_role = (cs || /case stud/.test(pt)) ? 'case_study' : /local/.test(pt) ? 'local' : isHub ? 'hub' : 'standard';
const article_like = /blog|guide|article|pillar|hub|case stud|comparison|faq/.test(pt) || !!(d.ai_target && d.ai_target.question);   // v4.12: these pages show the byline with a visible "Updated" date (AI cites fresh, dated pages)
// RV-10 (2026-10-21, pre-launch run exec 42): the first page waits for the author profile (P1), and then the ladder's service page
// printed no author at all, because only article-like pages carry the byline. A page that is not article-like now carries a compact
// expert line (the author's name and job title, a visible "Updated" date, the reviewer when there is one) and the author's Person
// schema, whenever a profile is on file; with no profile it prints nothing and asks for nothing (the readiness rule is unchanged).
const author_line = article_like ? 'byline' : (author ? 'compact' : 'none');
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'how', 'what', 'best', 'top', 'near', 'from', 'are', 'you', 'www', 'com', 'html', 'php', 'page', 'pages', 'blog', 'services', 'service']);
const toks = (t) => s(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 2 && !STOP.has(x));
// 2026-10-11 (FIX_PLAN D9): a cluster page counts as live only when the site really has it (sitemap / crawl — Collect Site URLs keeps the
// ladder pages it found there out of `planned_link_targets`). Everything else is planned: it is described in the brief, but nothing links to
// it, and the blog package records it as a link to add once it is published. Every page carries the anchor words a link would use.
const normU = (u) => s(u).toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
const liveUrls = new Set([...(d.site_urls || []), ...(d.internal_link_candidates || []).map(c => c && c.url)].map(normU).filter(Boolean));
const plannedUrls = new Set((d.planned_link_targets || []).map(l => normU(l && l.url)).filter(Boolean));
const isLive = (u) => { const k = normU(u); return !!k && liveUrls.has(k) && !plannedUrls.has(k); };
let hub_pages = [];
if (page_role === 'hub') {
  // ladder top page: its links down to the rung pages (Spawn Page Runs: role "rung N"; Content Cadence: role "down")
  hub_pages = [...(d.ladder_links || []), ...(d.planned_link_targets || [])].filter(l => l && l.url && !/^(top|sibling)$/i.test(s(l.role || l.ladder)))
    .filter((l, i, a) => a.findIndex(x => normU(x.url) === normU(l.url)) === i).slice(0, 12)
    .map(l => ({ url: s(l.url), keyword: s(l.keyword || l.about), title: s(l.title), role: s(l.role || l.ladder) || 'down', planned: !isLive(l.url) }));
  if (!hub_pages.length) {   // a stand-alone pillar page: the site's own pages on the topic
    const kt = new Set(toks(kw));
    hub_pages = (d.internal_link_candidates || []).filter(c => c && c.url && c.path && c.path !== '/')
      .map(c => ({ c, score: toks(c.path + ' ' + (c.title || c.about || '')).filter(t => kt.has(t)).length })).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score).slice(0, 10)
      .map(x => ({ url: s(x.c.url), keyword: s(x.c.about || x.c.title) || s(x.c.path).replace(/[\/_-]+/g, ' ').trim(), title: s(x.c.title), role: 'cluster', planned: !isLive(x.c.url) }));
  }
  hub_pages = hub_pages.map(p => ({ ...p, anchor: anchorText(p) }));
  const sdB = d.site_description || {};
  const fitCtxB = { own_domain: domain, competitors: (d.competitors || []).map(String), serp_domains: [...new Set((d.competitors_summary || []).map(c => String(c.domain || '')).filter(Boolean))],
    brands: {}, protect: [kw, ...(sdB.products_or_services || []), ...(d.services || []), String(d.business || sdB.business_description || '').slice(0, 400)] };
  hub_pages = hub_pages.filter(p => { if (!p.planned && !p.keyword) return true; const g = fitGate(p.keyword, fitCtxB); return g.ok || (g.reason === 'own brand' && !p.planned); });
}

// ---- video: details from the YouTube watch page or Vimeo oEmbed; transcript cleaned; chapters from "0:00 Title" lines ----
const ent = (t) => s(t).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const isoDur = (secs) => { secs = Math.round(Number(secs) || 0); if (!secs) return ''; const h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), x = secs % 60; return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (x ? x + 'S' : ''); };
const toSecs = (t) => { const p = s(t).split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
let video = d.video && d.video.url ? { ...d.video } : null;
if (video) {
  let r = {}; try { r = $('Fetch Video Details').first().json || {}; } catch (e) {}
  const raw = r.body != null ? r.body : r.data; const body = typeof raw === 'string' ? raw : (raw ? JSON.stringify(raw) : '');
  const m1 = (re) => { const x = body.match(re); return x ? ent(x[1]) : ''; };
  let found = false;
  if (video.provider === 'vimeo' && body) { try { const j = JSON.parse(body); found = true;
    video.title = video.title || s(j.title); video.description = video.description || s(j.description); video.thumbnail_url = video.thumbnail_url || s(j.thumbnail_url);
    if (!video.duration && j.duration) video.duration = String(j.duration); if (!video.upload_date && j.upload_date) video.upload_date = s(j.upload_date).replace(' ', 'T'); } catch (e) {} }
  if (video.provider === 'youtube' && body) {
    const up = m1(/<meta[^>]+itemprop=["']uploadDate["'][^>]+content=["']([^"']+)["']/i) || m1(/"uploadDate":"([^"]+)"/) || m1(/"publishDate":"([^"]+)"/);
    const du = m1(/<meta[^>]+itemprop=["']duration["'][^>]+content=["']([^"']+)["']/i); const ls = m1(/"lengthSeconds":"(\d+)"/);
    const ti = m1(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || m1(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i);
    const de = m1(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) || m1(/"shortDescription":"((?:[^"\\]|\\.)*)"/).replace(/\\n/g, '\n');
    found = !!(up || du || ls || ti);
    video.title = video.title || ti; video.description = video.description || de; if (!video.upload_date && up) video.upload_date = up; if (!video.duration) video.duration = du || ls;
  }
  const dur = s(video.duration);
  video.duration_iso = /^P(T|\d)/i.test(dur) ? dur.toUpperCase() : /^\d+$/.test(dur) ? isoDur(dur) : /^\d+(:\d{1,2}){1,2}$/.test(dur) ? isoDur(toSecs(dur)) : '';
  video.duration_seconds = (() => { const m = video.duration_iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0; })();
  video.minutes = video.duration_seconds ? Math.max(1, Math.round(video.duration_seconds / 60)) : null;
  video.upload_date = s(video.upload_date);
  // transcript: strip WebVTT / SRT numbering and cue timings, keep the words; chapters from "0:00 Title" lines (description first, then transcript)
  const tr = s(video.transcript).replace(/^WEBVTT.*$/m, '').split(/\r?\n/).filter(l => !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  video.transcript = tr;
  const chap = (txt) => s(txt).split(/\r?\n/).map(l => l.trim().match(/^\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:]?\s+(.{3,90})$/)).filter(Boolean).map(m => ({ start_seconds: toSecs(m[1]), name: m[2].trim() }));
  let chapters = chap(video.description); if (chapters.length < 2) chapters = chap(tr);
  video.chapters = chapters.length >= 2 && chapters[0].start_seconds === 0 ? chapters.slice(0, 20) : [];
  video.details_found = found;
  video.missing = [!video.upload_date && 'upload date', !video.duration_iso && 'duration', !video.thumbnail_url && 'thumbnail', !video.transcript && 'transcript'].filter(Boolean);
}

// ---- texts for the prompts (built here so the prompts stay readable) ----
const hub_live = hub_pages.filter(p => !p.planned), hub_planned = hub_pages.filter(p => p.planned);
const cluster = (hub_live.length ? 'LIVE — link to these, with the anchor shown:\n' + hub_live.map(p => '- ' + (p.keyword || p.url) + ' — ' + p.url + ' — anchor: "' + p.anchor + '"').join('\n') : 'LIVE: none yet')
  + (hub_planned.length ? '\nPLANNED, NOT PUBLISHED — write the section, set no link_to and never write a link to these:\n' + hub_planned.map(p => '- ' + (p.keyword || p.url)).join('\n') : '');
const area = s(d.local_area);
const nap = site_profile ? [site_profile.business_name, [site_profile.address.street, site_profile.address.city, site_profile.address.region, site_profile.address.postal_code].filter(Boolean).join(', '), site_profile.phone, site_profile.opening_hours].filter(Boolean).join(' · ') : '';
const caseFacts = cs ? [['Client', cs.client_public === false ? (cs.client_name || 'the client') + ' (do NOT name them; describe them as "a ' + (cs.industry ? cs.industry + ' business' : 'client') + (cs.location ? ' in ' + cs.location : '') + '")' : cs.client_name], ['Industry', cs.industry], ['Location', cs.location], ['Service delivered', cs.service], ['Challenge', cs.challenge], ['What was done', cs.solution], ['Timeline', cs.timeline], ['Results', cs.results], ['Client quote (verbatim)', cs.quote ? '"' + cs.quote + '" — ' + (cs.client_public === false ? s(cs.quote_by).replace(/^[^,]+,\s*/, '') : cs.quote_by) : '']]
  .filter(x => s(x[1])).map(x => x[0] + ': ' + s(x[1])).join('\n') : '';
const ROLE_BRIEF = {
  hub: 'HUB PAGE (pillar): this page is the complete guide to "' + kw + '" and the hub of a topic cluster. Plan 8-12 H2 sections: the core definition and the decision framework in depth, plus one section per cluster page below (group 2-3 closely related ones) that summarises the subtopic in 120-250 words. Set "link_to" ONLY for a page listed as LIVE, and only to its exact URL; a page listed as PLANNED has no URL yet, so its section carries no link_to and no link. internal_link_suggestions must include every LIVE cluster page with its anchor, in addition to the usual links, and no planned page. The system adds a linked table of contents and a "Guides in this series" block of the live pages only; do not plan them as sections.\nCLUSTER PAGES:\n' + (cluster || '- none found: plan the hub so each section can later link to a detailed page'),
  case_study: 'CASE STUDY: the page tells one real project and proves the service "' + s((cs || {}).service || kw) + '". Use ONLY the case facts below for anything about the project: never invent numbers, names, dates, tools or quotes; anything missing stays a bracketed placeholder. Copy the case facts into client_facts. Outline (6-8 H2s): the challenge; why they chose the business; what was done (approach, steps, timeline); the results (each number from the case facts, before → after where given, plus a results table); in the client\'s words (only when a quote is given, verbatim); what other ' + (s((cs || {}).industry) || 'teams') + ' can learn (3-5 transferable lessons); next step (CTA). Title pattern: client (or the anonymised description) + the headline result + the service. target_word_count 900-1,600. The system renders an "at a glance" snapshot box.\nCASE FACTS:\n' + (caseFacts || 'none given'),
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': written for buyers in ' + (area || 'this area') + '. It must carry genuinely local substance, never a city-name swap of another page: the districts, free zones or neighbourhoods served, local rules, authorities or permits that matter for this service, how the service works on site there (visits, response times, local team), local examples or proof, and local FAQs. Plan one section about reaching the business in ' + (area || 'the area') + ' — the system adds the verified name / address / phone / opening hours block below it. Never invent an address, phone number, office, review or local client.\nBUSINESS DETAILS ON FILE: ' + (nap || 'none — the page must not claim a local office; describe the service area instead') + (site_profile && site_profile.service_areas.length ? '\nAREAS SERVED: ' + site_profile.service_areas.join(', ') : ''),
  standard: ''
};
const ROLE_WRITER = {
  hub: 'HUB PAGE: every outline section with a "link_to" URL ends with one sentence that links to that page with a descriptive anchor ([anchor](url)). A section without a "link_to" is about a page that is not published yet: summarise the subtopic and write NO link for it — never invent or guess a URL. Summarise each subtopic; do not repeat the detailed page. Do not write a table of contents or a list of guides (the system adds both).',
  case_study: 'CASE STUDY: tell the project as a story with real numbers. These case facts are true and may be stated; nothing else about the project may be:\n' + caseFacts + '\nUse the quote verbatim and only if given. Include a before → after results table. No invented metrics, names, dates or tools.',
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': genuinely local detail in every section (areas served, local rules and authorities, how the service works on site, local examples). Do not write the address, phone number or opening hours (the system inserts the verified block); never claim an office, review or client that is not in the facts.',
  standard: ''
};
// FU-SV (2026-10-29): the context names the author for the writer's use, not as a line to copy: it opened "Written by <name>.", and 3 of 8
// pages printed a second byline in the body. The system prints the one byline (Blog Package).
const eeat_context = (author ? 'Author (the system prints the byline and the author box; never write them in the copy): ' + author.name + (author.job_title ? ', ' + author.job_title : '') + '. Credentials and experience: ' + (author.credentials || 'not given') + (author.knows_about.length ? '. Expert in: ' + author.knows_about.join(', ') : '') + (author.bio ? '. Bio: ' + author.bio.slice(0, 400) : '') + '.'
  : 'No author profile on file: plan the experience notes as bracketed prompts for the author.') + (reviewer ? ' Expert reviewer: ' + reviewer.name + (reviewer.job_title ? ', ' + reviewer.job_title : '') + '.' : '');
const proof_context = proof_library.length ? proof_library.map(c => '- ' + (c.title || c.service) + ' — ' + c.client + (c.industry ? ' (' + c.industry + ')' : '') + ': ' + c.results + (c.quote ? ' Quote: "' + c.quote + '"' + (c.quote_by ? ' — ' + c.quote_by : '') : '') + (c.url ? ' — ' + c.url : ' — no public page yet (do not link)')).join('\n') : 'none recorded';
const video_context = video ? 'VIDEO: the page has a video ("' + (video.title || 'untitled') + '"' + (video.minutes ? ', about ' + video.minutes + ' minutes' : '') + '). The system embeds it' + (video.placement ? ' under "' + video.placement + '"' : ' after the quick answer') + ' with its transcript. Refer to it once, naturally (what it shows and why to watch); never transcribe it or invent what it says.' + (video.chapters.length ? ' Key moments: ' + video.chapters.map(c => c.name).join(' · ') + '.' : '') : '';
const case_facts_text = caseFacts.replace(/\n/g, ' | ') + (proof_library.length ? (caseFacts ? ' | ' : '') + proof_library.map(c => c.results).join(' | ') : '');

// ---- D5 (2026-10-21): the subtopics of the page to beat, without the topics the verdict said to leave out ----
// Parse Analysis runs before the verdict, so its subtopic list cannot know them. Live (exec 42) the verdict said to skip "AI consultant
// certification" and "AI consultant course" while the brief was asked to cover a certification course's "Program Eligibility" and
// "Program Curriculum". Here, after the verdict and before the brief, a subtopic about an excluded topic is dropped, and every subtopic
// goes when the page to beat itself is about one (its title or address names it).
const VEX = Array.isArray(d.verdict_exclusions) ? d.verdict_exclusions : [];
let coverage_target = d.coverage_target && typeof d.coverage_target === 'object' ? d.coverage_target : null;
let coverage_digest = s(d.coverage_digest);
const subtopics_excluded = [];
if (coverage_target && Array.isArray(coverage_target.subtopics) && coverage_target.subtopics.length && VEX.length) {
  const bestC = (d.competitors || []).find(c => c && coverage_target.best && c.url === coverage_target.best.url) || {};
  const benchText = s(bestC.title) + ' ' + s((coverage_target.best || {}).url).replace(/^https?:\/\/[^\/]+/i, '').replace(/[\/_-]+/g, ' ');
  const benchHit = VEX.find(e => EXC.match(benchText, e, kw));
  const kept = coverage_target.subtopics.filter(st => { const e = benchHit || VEX.find(x => EXC.match(st, x, kw));
    if (e) subtopics_excluded.push({ subtopic: st, topic: s(e.topic != null ? e.topic : e), why: benchHit ? 'the page to beat is about it' : 'the subtopic is about it' }); return !e; });
  if (subtopics_excluded.length) {
    coverage_target = { ...coverage_target, subtopics: kept, subtopics_excluded };
    if (d.coverage_digest_base != null) coverage_digest = s(d.coverage_digest_base) + (kept.length ? '\nSUBTOPICS THAT PAGE COVERS (cover each one, in our own structure and words; do not copy its headings):\n- ' + kept.join('\n- ') : '');
  }
}

return [{ json: { ...d, site_profile, author, reviewer, proof_library, page_role, article_like, hub_pages, hub_pages_planned: hub_planned, video, case_study: cs, local_area: area,
  eeat_context, proof_context, role_brief: ROLE_BRIEF[page_role] || '', role_writer: ROLE_WRITER[page_role] || '', video_context, case_facts_text,
  author_line, coverage_target, coverage_digest, subtopics_excluded,   // RV-10 / D5
  // the facts and the call to action the site model holds (what the app sent, what the weekly run stored) when this request carries none
  business_facts: s(d.business_facts) || mFacts.business_facts, cta: s(d.cta) || mFacts.cta,
  pricing_facts, timeline_facts, angle_rules, site_model: model } }];
