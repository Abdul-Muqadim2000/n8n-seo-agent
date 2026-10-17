// Earned media for AI (v4.12): the exact third-party pages AI cited in answers that did NOT name the business — the strongest lever on AI mentions
// (earned media is most of what AI cites; brand mentions on other sites track AI visibility far more than links do). Each page fetched: does it
// name the business, which competitors does it name, how to reach its author. One action per kind (a "best of" list: ask to be added; an article:
// offer a quote or data; news: pitch a comment; a review site: build the profile; a forum thread: answer it as yourself; video / LinkedIn: publish
// there; official list: apply). A page that now names the business is a win. The three most valuable new ones per site get drafts (AI Outreach
// Writer); they join the Backlink Monitor's prospects (type ai_source), which finds contacts and writes follow-ups.
/*__LINK_KIT__*/
/*__OUTREACH_KIT__*/
/*__DRAFTS__*/
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let reqs = [], res = []; try { reqs = $('Earned Requests').all().map(i => i.json); res = $('Fetch Cited Pages').all().map(i => i.json); } catch (e) {}
const prospects = (() => { try { return $('Load Link Prospects (Growth)').all().map(i => i.json).filter(r => r && r.site_id); } catch (e) { return []; } })();
const dec = (s) => String(s || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;|&rsquo;/gi, "'");
const strip = (h) => dec(String(h || '').replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (t) => new RegExp('(^|[^a-z0-9])' + esc(String(t).toLowerCase()) + '($|[^a-z0-9])', 'i');
const ACTION = {
  list: (b, h) => ['outreach', 'Ask the editor of ' + h + ' to add ' + b + ' to this list (AI reads it for the answer)'],
  article: (b, h) => ['outreach', 'Offer the author on ' + h + ' a quote, a data point or a correction that names ' + b],
  news: (b, h) => ['outreach', 'Pitch an expert comment or data to ' + h + ' (assistants quote news coverage)'],
  review: (b, h) => ['profile', 'Create or complete ' + b + "'s profile on " + h + ' and ask clients for reviews there'],
  forum: (b, h) => ['reply', 'Answer this thread helpfully as yourself (say you work for ' + b + '); no link spam'],
  video: (b, h) => ['publish', 'Publish a short video answering the question on ' + h + ' (assistants cite videos for how-to questions)'],
  social: (b, h) => ['publish', 'Publish a post answering the question on ' + h + ' under your company page'],
  official: (b, h) => ['apply', 'An official source AI trusts here (' + h + '): if ' + b + ' qualifies for its list or registry (an accreditation, a licence, a partner list), apply; otherwise cite it on your page for this question'],
  encyclopedia: (b, h) => ['coverage', 'Earn independent press coverage first; ' + h + ' only describes businesses that independent sources cover (never write about yourself there)'],
  competitor: (b, h) => ['content', 'A competitor\'s own page is cited here: answer the same question better on your site'],
};
// R83 (2026-10-16, re-rating defect C-7): the businesses AI recommends instead of you are never earned media to pitch. The Growth
// Plan's competitors are the AI visibility table's 8 rows plus the declared ones; the exclusion set also takes every business the
// Answer Analyst learned a website for (the `ai_brands:` cache the AI Visibility Tracker writes), by registrable domain.
const cacheRowsG = (() => { try { return $('Load Cache (Growth)').all().map(i => i.json).filter(r => r && r.key); } catch (e) { return []; } })();
const aliasDomains = (sid) => { const row = cacheRowsG.find(r => r.key === 'ai_brands:' + sid); if (!row) return []; try { return Object.values(JSON.parse(row.value || '{}') || {}).map(String); } catch (e) { return []; } };
const out = [];
for (const p of plans) {
  const business = p.business_name || p.domain;
  const ownReg = LK.regDomain(p.domain) || p.domain;
  const rivals = new Set([...(p.competitors || []), ...(p.rival_sources || []), ...aliasDomains(p.site_id)].map(d => LK.regDomain(String(d || '').toLowerCase().replace(/^www\./, '')) || '').filter(d => d && /\./.test(d) && d !== ownReg && !OK.isGov(d)));
  const rivalOf = (h) => rivals.has(LK.regDomain(String(h || '').toLowerCase().replace(/^www\./, '')) || '');   // D12: never the domain label ("techand" for Tech&) — the site model's name, else the domain
  const ourRes = p.brand_names.map(wordRe);
  const sellTerms = ((p.services || []).length ? p.services : [p.profile && p.profile.business_type]).filter(Boolean);
  const pageText = new Map();   // their page, for the competitor gate (never stored: the earned rows stay small)
  const fetched = new Map(); reqs.forEach((q, i) => { if (q && q.site_id === p.site_id) fetched.set(q.url, res[i] || {}); });
  const items = p.earned.map(e => {
    const r = fetched.get(e.url); let mentions_us = null, named = [], title = e.title, contact_email = '', contact_url = '', fetch_status = 0;
    if (r) { fetch_status = Number(r.statusCode) || 0; const html = String(r.body ?? r.data ?? '');
      if (fetch_status >= 200 && fetch_status < 300 && html.length > 120) { const text = strip(html).toLowerCase(); pageText.set(e.url, text.slice(0, 20000)); mentions_us = ourRes.some(re => re.test(text)); named = p.competitors.filter(c => { const lab = c.split('.')[0]; return wordRe(c).test(text) || (lab.length >= 5 && wordRe(lab).test(text)); }).slice(0, 6);
        if (!title) title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 140);
        contact_email = ((html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || '').toLowerCase();
        const cu = [...html.matchAll(/href=["']([^"'#]+)["'][^>]*>([^<]{0,40})</gi)].find(m => /contact|write for us|contribute|submit|editor|advertis|get listed|add your/i.test(m[2] + ' ' + m[1]));
        if (cu) contact_url = /^https?:/i.test(cu[1]) ? cu[1] : (cu[1].startsWith('/') ? 'https://' + e.host + cu[1] : ''); } }
    const [type, action] = (ACTION[e.kind] || ACTION.article)(business, e.host);
    const value = Math.round(10 * e.citations * (1 + e.engines.length / 2) * ({ list: 1.4, article: 1.1, news: 1.2, review: 1.2, forum: 1, official: 1.3, video: 0.9, social: 0.8, encyclopedia: 0.6, competitor: 0.3 }[e.kind] || 1)) / 10;
    // R83: a page on the site of a business AI names instead of you is a competitor's page — answer the question better on your own
    // site. C-2 (re-rating 2026-10-17): its "best X" list too - every site in this set is a BUSINESS rival (declared, or named by AI),
    // and a competitor's own list ranks itself, not you (flick.network: "Ask the editor of flick.network to add Tech& to this list" while
    // the AI visibility run named it among the businesses AI recommends instead, and the Link Builder refused it). The Link Builder's
    // exemption is for a SERP-only rival (a publisher that outranks you), which this set does not hold. A site that sells your category
    // by its own title or address (RV.providerOf: "ERPNext Implementation Partner", "Odoo Implementation") is a competitor here too.
    const sells = rivalOf(e.host) ? '' : (OK.isGov(e.host) ? '' : RV.providerOf({ domain: e.host, title, url: e.url, topics: p.topics || [], services: p.services || [] }));
    const rival = rivalOf(e.host) || !!sells;
    if (rival) { const [t2, a2] = ACTION.competitor(business, e.host); return { ...e, kind: 'competitor', rival: true, rival_why: sells ? 'it sells what you sell: ' + sells : 'a business AI recommends instead of you', title, mentions_us, competitors_named: named, contact_email, contact_url, fetch_status, action: a2, action_type: t2, value: Math.round(10 * e.citations * (1 + e.engines.length / 2) * 0.3) / 10 }; }
    return { ...e, title, mentions_us, competitors_named: named, contact_email, contact_url, fetch_status, action, action_type: type, value };
  }).sort((a, b) => b.value - a.value);
  // prospects (type ai_source, one row per site + domain): the exact page, what it names, the action; drafts for the 3 most valuable new ones
  const rows = []; const jobs = [];
  for (const e of items.filter(x => x.kind !== 'competitor').slice(0, 12)) {
    if (rows.some(r => r.prospect_domain === e.host)) continue;
    const old0 = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === e.host && x.type === 'ai_source') || {}; const old = old0.status === 'drafted' ? { ...old0, status: 'new' } : old0;   // 'drafted' (2026-10-10 runs) is not an app status
    const won = e.mentions_us === true;
    const kept = DRAFTS.carry(old, { handover: !!p.link_builder });
    const detail = 'AI cites this ' + e.kind + ' ' + e.citations + 'x (' + e.engines.join(', ') + ') for "' + (e.questions[0] || '').slice(0, 90) + '"' + (e.title ? ' — "' + e.title.slice(0, 80) + '"' : '') + (e.competitors_named.length ? '; it names ' + e.competitors_named.join(', ') : '') + (e.mentions_us === false ? ', not you' : won ? '; it names you now' : '');
    const row = { site_id: p.site_id, domain: p.domain, prospect_domain: e.host, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0, detail: detail.slice(0, 500), source_url: e.url, target_url: old.target_url || '',
      status: won ? 'won' : (old.status || 'new'), first_seen: old.first_seen || p.checked_at, last_seen: p.checked_at, won_at: won ? (old.won_at || p.checked_at) : (old.won_at || ''),
      outreach_subject: kept.outreach_subject, outreach_body: kept.outreach_body, drafted_at: kept.drafted_at,   // P34-1: a draft written before the D12 / D13 gates, or one handed to the Link Builder, is withdrawn — never offered again
      note: e.action.slice(0, 300), score: Math.min(100, Math.round(e.value * 8)), origin: 'ai_growth', contact_email: old.contact_email || e.contact_email, contact_url: old.contact_url || e.contact_url, contacted_at: old.contacted_at || '',
      followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '' };
    rows.push(row);
    // ---- D12: one writer, and the Link Builder's gates ----
    // With the Link Builder on, nothing is drafted here: the row above is the hand-over (its detail names the question AI cites them for),
    // and the Link Builder qualifies it, finds the contacts on their own domain and writes the sequence. With it off, the same gates decide
    // whether a draft may be written at all (live 2026-10-11: drafts went to two government portals and three competitors).
    const kindType = e.kind === 'list' ? 'list' : e.kind === 'forum' ? 'mention' : 'ai_source';
    const outreachKind = ['outreach', 'reply'].includes(e.action_type);   // a review profile, a video or a Wikipedia entry is the owner's own work: no writer is involved
    const blocked = !outreachKind ? '' : p.link_builder ? 'the Link Builder writes to them (one writer): approve the pitch on the Link building page'
      : (OK.badHost(e.host)
        || (OK.isGov(e.host) ? 'government site: you get on its lists by applying or being accredited, not by a pitch' : '')
        || OK.homepageOnly(kindType, e.url)
        || OK.sellsSame({ type: kindType, domain: e.host, competitors: p.competitors, ai_rivals: [...(p.rival_sources || []), ...aliasDomains(p.site_id)], topics: p.topics || [], title: e.title, url: e.url, text: pageText.get(e.url) || '', terms: sellTerms })
        || (!OK.accredited(p.accreditation) && OK.accreditedList(e.title + ' ' + e.url) ? 'a list of accredited / approved providers: you get on it by applying with the accreditation, and the facts on file do not say you hold one' : ''));
    if (blocked) row.note = String(blocked).slice(0, 300);
    if (kept.superseded && !blocked) row.note = (DRAFTS.reason + '; ' + row.note).slice(0, 300);   // P34-1: the owner is told the old pitch was withdrawn, not shown it again
    if (!won && !blocked && !kept.outreach_body && outreachKind && !['won', 'declined', 'contacted'].includes(String(old.status || '')) && jobs.length < 3)
      jobs.push({ n: jobs.length + 1, prospect_domain: e.host, kind: e.kind, action_type: e.action_type, url: e.url, title: e.title, question: e.questions[0] || '', competitors_named: e.competitors_named, engines: e.engines });
    if (blocked) e.no_draft = String(blocked).slice(0, 160);
  }
  // ---- B9-7: one correction target per wrong claim: the claim, the true fact from the profile, the cited pages that carry it ----
  // The Growth Plan decided which claims have a fact on file (`fact_on_file`); a claim without one stays "needs your fact" and is never
  // drafted. A page is drafted for only when its own text carries the claim (we fetched it); a page we could not read, or that does not
  // say it, is listed as "not confirmed" - the answer cited it, which is not the same as the page saying it. Drafting goes through the
  // one outreach writer (the jobs below join the AI Outreach Writer's list), or - with the Link Builder on - the page is handed over as
  // a prospect row. Nothing is sent from here.
  const wordsIn = (t) => [...new Set((String(t || '').toLowerCase().match(/[a-z0-9]{4,}|\d{2,}/g) || []))];
  const corrections = [];
  for (const c of (p.corrections || [])) {
    const cw = wordsIn(c.claim);
    const pages = (c.pages || []).map(pg => {
      const r = fetched.get(pg.url); const st = r ? Number(r.statusCode) || 0 : 0; const html = r ? String(r.body ?? r.data ?? '') : '';
      const ok = st >= 200 && st < 300 && html.length > 120; const text = ok ? strip(html).toLowerCase() : '';
      const confirmed = !ok ? null : (cw.length >= 2 && cw.filter(w => text.includes(w)).length / cw.length >= 0.6);
      const contact_email = ok ? ((html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || '').toLowerCase() : '';
      return { ...pg, fetched: ok, carries_claim: confirmed, contact_email };
    });
    const target = c.fact_on_file ? pages.find(pg => pg.carries_claim === true && !OK.badHost(pg.host) && !OK.isGov(pg.host) && !rivalOf(pg.host)) : null;
    let status = c.status, note = c.note, draft_job = null;
    if (c.fact_on_file) {
      if (!pages.length) { status = 'no_page'; note = 'AI made this claim but no third-party page was cited in those answers: nothing to correct at a publisher. Make sure your own pages state the fact plainly.'; }
      else if (!target) { status = 'page_not_confirmed'; note = 'None of the cited pages could be read saying this (' + pages.map(pg => pg.host + (pg.fetched ? ': does not say it' : ': not readable')).join('; ') + '): no correction is drafted for a claim we cannot show on the page.'; }
      else if (p.link_builder) { status = 'handed_over'; note = 'Handed to the Link Builder (one writer): ' + target.host + ' carries the claim. Approve the pitch on the Link building page.';
        const hit = rows.find(r => r.prospect_domain === target.host);
        const line = 'Correction needed: "' + c.claim + '" - the fact on file: ' + c.true_fact;
        if (hit) { hit.detail = (hit.detail + '. ' + line).slice(0, 500); hit.note = (String(hit.note || '') + ' ' + line).trim().slice(0, 300); }
        else { const old = prospects.find(x => x.site_id === p.site_id && x.prospect_domain === target.host && x.type === 'ai_source') || {};
          rows.push({ site_id: p.site_id, domain: p.domain, prospect_domain: target.host, type: 'ai_source', rank: Number(old.rank) || 0, spam_score: Number(old.spam_score) || 0, detail: line.slice(0, 500), source_url: target.url, target_url: old.target_url || '',
            status: old.status || 'new', first_seen: old.first_seen || p.checked_at, last_seen: p.checked_at, won_at: old.won_at || '', outreach_subject: old.outreach_subject || '', outreach_body: old.outreach_body || '', drafted_at: old.drafted_at || '',
            note: line.slice(0, 300), score: 40, origin: 'ai_growth', contact_email: old.contact_email || target.contact_email || '', contact_url: old.contact_url || '', contacted_at: old.contacted_at || '',
            followup_step: Number(old.followup_step) || 0, followup_subject: old.followup_subject || '', followup_body: old.followup_body || '', verified_at: old.verified_at || '' }); } }
      else if (jobs.length < 5) { status = 'draft_requested'; note = 'Drafted for you to review (never sent): ' + target.url;
        draft_job = { n: jobs.length + 1, prospect_domain: target.host, kind: 'correction', action_type: 'correction', url: target.url, title: target.title, question: '', claim: c.claim, true_fact: c.true_fact, competitors_named: [], engines: c.engines || [] };
        jobs.push(draft_job); }
      else { status = 'queued'; note = 'More corrections than drafts this week: it comes up again next run.'; }
    }
    corrections.push({ claim: c.claim, true_fact: c.true_fact, fact_on_file: c.fact_on_file, status, note, engines: c.engines, is_new: c.is_new, pages, job_n: draft_job ? draft_job.n : null });
  }
  out.push({ json: { site_id: p.site_id, domain: p.domain, business, earned: items, prospect_rows: rows, outreach_jobs: jobs, corrections } });
}
return out.length ? out : [{ json: { skip: true } }];
