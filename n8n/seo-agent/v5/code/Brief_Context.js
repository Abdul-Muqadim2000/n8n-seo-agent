// Content runs (v4.4): what the brief, the copy, the schema and the blog package need beyond the keyword research —
// the site's business profile (author, reviewer, address / NAP), proof from its case studies, the page role (hub, case study, local,
// standard), the cluster pages a hub links down to, and the video details (YouTube page / Vimeo oEmbed, read by Fetch Video Details).
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
const article_like = /blog|guide|article|pillar|hub|case stud/.test(pt);
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'our', 'how', 'what', 'best', 'top', 'near', 'from', 'are', 'you', 'www', 'com', 'html', 'php', 'page', 'pages', 'blog', 'services', 'service']);
const toks = (t) => s(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x.length > 2 && !STOP.has(x));
let hub_pages = [];
if (page_role === 'hub') {
  // ladder top page: its links down to the rung pages (Spawn Page Runs: role "rung N"; Content Cadence: role "down")
  hub_pages = (d.ladder_links || []).filter(l => l && l.url && !/^(top|sibling)$/i.test(s(l.role))).slice(0, 12)
    .map(l => ({ url: s(l.url), keyword: s(l.keyword), role: s(l.role) || 'down', planned: !!l.planned }));
  if (!hub_pages.length) {   // a stand-alone pillar page: the site's own pages on the topic
    const kt = new Set(toks(kw));
    hub_pages = (d.internal_link_candidates || []).filter(c => c && c.url && c.path && c.path !== '/')
      .map(c => ({ c, score: toks(c.path + ' ' + (c.title || c.about || '')).filter(t => kt.has(t)).length })).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score).slice(0, 10)
      .map(x => ({ url: s(x.c.url), keyword: s(x.c.about || x.c.title) || s(x.c.path).replace(/[\/_-]+/g, ' ').trim(), role: 'cluster', planned: !!x.c.planned }));
  }
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
const cluster = hub_pages.map(p => '- ' + (p.keyword || p.url) + ' — ' + p.url + (p.planned ? ' (planned, not live yet)' : '')).join('\n');
const area = s(d.local_area);
const nap = site_profile ? [site_profile.business_name, [site_profile.address.street, site_profile.address.city, site_profile.address.region, site_profile.address.postal_code].filter(Boolean).join(', '), site_profile.phone, site_profile.opening_hours].filter(Boolean).join(' · ') : '';
const caseFacts = cs ? [['Client', cs.client_public === false ? (cs.client_name || 'the client') + ' (do NOT name them; describe them as "a ' + (cs.industry ? cs.industry + ' business' : 'client') + (cs.location ? ' in ' + cs.location : '') + '")' : cs.client_name], ['Industry', cs.industry], ['Location', cs.location], ['Service delivered', cs.service], ['Challenge', cs.challenge], ['What was done', cs.solution], ['Timeline', cs.timeline], ['Results', cs.results], ['Client quote (verbatim)', cs.quote ? '"' + cs.quote + '" — ' + (cs.client_public === false ? s(cs.quote_by).replace(/^[^,]+,\s*/, '') : cs.quote_by) : '']]
  .filter(x => s(x[1])).map(x => x[0] + ': ' + s(x[1])).join('\n') : '';
const ROLE_BRIEF = {
  hub: 'HUB PAGE (pillar): this page is the complete guide to "' + kw + '" and the hub of a topic cluster. Plan 8-12 H2 sections: the core definition and the decision framework in depth, plus one section per cluster page below (group 2-3 closely related ones) that summarises the subtopic in 120-250 words and sets "link_to" to that page\'s URL. internal_link_suggestions must include every cluster page (up to 12) with a descriptive anchor, in addition to the usual links. The system adds a linked table of contents and a "Guides in this series" block; do not plan them as sections.\nCLUSTER PAGES:\n' + (cluster || '- none found: plan the hub so each section can later link to a detailed page'),
  case_study: 'CASE STUDY: the page tells one real project and proves the service "' + s((cs || {}).service || kw) + '". Use ONLY the case facts below for anything about the project: never invent numbers, names, dates, tools or quotes; anything missing stays a bracketed placeholder. Copy the case facts into client_facts. Outline (6-8 H2s): the challenge; why they chose the business; what was done (approach, steps, timeline); the results (each number from the case facts, before → after where given, plus a results table); in the client\'s words (only when a quote is given, verbatim); what other ' + (s((cs || {}).industry) || 'teams') + ' can learn (3-5 transferable lessons); next step (CTA). Title pattern: client (or the anonymised description) + the headline result + the service. target_word_count 900-1,600. The system renders an "at a glance" snapshot box.\nCASE FACTS:\n' + (caseFacts || 'none given'),
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': written for buyers in ' + (area || 'this area') + '. It must carry genuinely local substance, never a city-name swap of another page: the districts, free zones or neighbourhoods served, local rules, authorities or permits that matter for this service, how the service works on site there (visits, response times, local team), local examples or proof, and local FAQs. Plan one section about reaching the business in ' + (area || 'the area') + ' — the system adds the verified name / address / phone / opening hours block below it. Never invent an address, phone number, office, review or local client.\nBUSINESS DETAILS ON FILE: ' + (nap || 'none — the page must not claim a local office; describe the service area instead') + (site_profile && site_profile.service_areas.length ? '\nAREAS SERVED: ' + site_profile.service_areas.join(', ') : ''),
  standard: ''
};
const ROLE_WRITER = {
  hub: 'HUB PAGE: every outline section with a "link_to" URL ends with one sentence that links to that page with a descriptive anchor ([anchor](url)). Summarise each subtopic; do not repeat the detailed page. Do not write a table of contents or a list of guides (the system adds both).',
  case_study: 'CASE STUDY: tell the project as a story with real numbers. These case facts are true and may be stated; nothing else about the project may be:\n' + caseFacts + '\nUse the quote verbatim and only if given. Include a before → after results table. No invented metrics, names, dates or tools.',
  local: 'LOCAL PAGE for ' + (area || '[City]') + ': genuinely local detail in every section (areas served, local rules and authorities, how the service works on site, local examples). Do not write the address, phone number or opening hours (the system inserts the verified block); never claim an office, review or client that is not in the facts.',
  standard: ''
};
const eeat_context = (author ? 'Written by ' + author.name + (author.job_title ? ', ' + author.job_title : '') + '. Credentials and experience: ' + (author.credentials || 'not given') + (author.knows_about.length ? '. Expert in: ' + author.knows_about.join(', ') : '') + (author.bio ? '. Bio: ' + author.bio.slice(0, 400) : '') + '.'
  : 'No author profile on file: plan the experience notes as bracketed prompts for the author.') + (reviewer ? ' Expert reviewer: ' + reviewer.name + (reviewer.job_title ? ', ' + reviewer.job_title : '') + '.' : '');
const proof_context = proof_library.length ? proof_library.map(c => '- ' + (c.title || c.service) + ' — ' + c.client + (c.industry ? ' (' + c.industry + ')' : '') + ': ' + c.results + (c.quote ? ' Quote: "' + c.quote + '"' + (c.quote_by ? ' — ' + c.quote_by : '') : '') + (c.url ? ' — ' + c.url : ' — no public page yet (do not link)')).join('\n') : 'none recorded';
const video_context = video ? 'VIDEO: the page has a video ("' + (video.title || 'untitled') + '"' + (video.minutes ? ', about ' + video.minutes + ' minutes' : '') + '). The system embeds it' + (video.placement ? ' under "' + video.placement + '"' : ' after the quick answer') + ' with its transcript. Refer to it once, naturally (what it shows and why to watch); never transcribe it or invent what it says.' + (video.chapters.length ? ' Key moments: ' + video.chapters.map(c => c.name).join(' · ') + '.' : '') : '';
const case_facts_text = caseFacts.replace(/\n/g, ' | ') + (proof_library.length ? (caseFacts ? ' | ' : '') + proof_library.map(c => c.results).join(' | ') : '');

return [{ json: { ...d, site_profile, author, reviewer, proof_library, page_role, article_like, hub_pages, video, case_study: cs, local_area: area,
  eeat_context, proof_context, role_brief: ROLE_BRIEF[page_role] || '', role_writer: ROLE_WRITER[page_role] || '', video_context, case_facts_text } }];
