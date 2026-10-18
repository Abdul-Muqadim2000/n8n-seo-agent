// ---- the draft gate (L2, system review 2026-10-11; inlined by the build next to the link kit, the outreach kit and the claims kit) ----
// Every outreach e-mail passes the same deterministic checks before it is offered for approval: it says nothing about the business that the
// facts do not carry (CL, D14), it leaves nothing for the owner to fill in, it writes to an address on the prospect's own domain, it quotes
// something that is really on their page, it carries exactly one link — our chosen page on our canonical host —, it is short, it makes one
// clear ask, it avoids the words we never use, and it writes the business name as the site model has it. A draft that fails is held
// ("needs_edit") with its reasons instead of being offered; nothing is ever sent from here.
// The app mirrors these rules in app/shared/src/draft-qa.ts (the approval queue refuses a held draft, automatic mode skips it): the two must
// change together, as Cadence_Plan.js and app/server/src/services/cadence.ts do.
const DQ = (() => {
  const LIMITS = { first: 120, press_first: 200, followup: 60, subject: 70 };
  const BANNED = [[/\bback\s?links?\b/i, 'the word "backlink"'], [/\b(do|no)-?follow\b/i, 'link jargon'], [/\blink (building|exchange|swap|juice)\b/i, 'link jargon'],
    [/\b(seo|serps?)\b/i, 'SEO jargon'], [/\b(domain authority|domain rating|\bda\s?\d{1,3}\b|\bdr\s?\d{1,3}\b)/i, 'authority metrics'],
    [/\b(ai (answers?|assistants?|search|overview|overviews|mode|visibility)|chatgpt|perplexity|copilot|gemini)\b/i, 'how we found them (AI answers)'],
    [/\b(ranks?|ranking|rankings|rank higher|search rankings)\b/i, 'talk of rankings'],
    [/\b(world.?class|best.in.class|revolutionary|cutting.edge|game.chang\w+|one.stop.shop|leading provider)\b/i, 'hype'],
    [/i hope (this|you) (e-?mail |message )?(finds you well|are doing well)|i('ve| have) been (reading|following) (your|the) (blog|site|work|newsletter) for (years|a while|some time)/i, 'filler or fake familiarity'],
    [/\b(guest post|sponsored post|paid (link|placement)|in exchange for a link)\b/i, 'an offer we never make']];
  const STOPW = new Set('the and for with from your our you are was has have that this they their them will can into out about more most than then when what which who why how not but any one two all its also been being here there over under per via'.split(' '));
  const S = (v) => String(v == null ? '' : v);
  const wordCount = (t) => S(t).replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const linksIn = (t) => [...S(t).matchAll(/https?:\/\/[^\s<>()"'\]]+/gi)].map(m => m[0].replace(/[.,;:!?)\]]+$/, ''));
  const bracketsIn = (t) => [...S(t).matchAll(/\[[^\]\n]{1,160}\]/g)].map(m => m[0]);
  const hostOf = (u) => S((S(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1]).toLowerCase().replace(/^www\./, '');   // the sandbox has no URL constructor
  const pathKey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const grams = (t, n) => { const w = S(t).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOPW.has(x)); const out = [];
    for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(' ')); return out; };
  // something from their page really said back to them: three distinctive words in a row from the page title, the evidence we stored or the
  // dead link's text / address (it is what makes a first line personal, and what the research says doubles replies)
  const quotesThem = (body, cands) => { const B = new Set(grams(body, 3));
    for (const c of cands) { for (const g of grams(c, 3)) if (B.has(g)) return g; } return ''; };
  const mask = (e) => { const [u = '', d = ''] = S(e).toLowerCase().split('@'); return u.slice(0, 1) + '***@' + d; };
  /** d: { type, steps: [{ subject, body }], to, prospect_domain, page_url, page_title, evidence, dead }
   *  ctx: { facts, signer, brand, brand_known, domain, canonical_host, target_url, competitors, accreditation / accredited } */
  function check(d, ctx) {
    const c = ctx || {}; const type = S(d.type); const press = type === 'press' || type === 'digest';   // L5: a request from a journalist digest is a press answer (its reply address is the digest's, and an answer may be longer than a pitch)
    const steps = (d.steps || []).map(x => ({ step: Number(x.step) || 0, subject: S(x.subject), body: S(x.body) }));
    const held = [], notes = [];
    const add = (why) => { if (why && !held.includes(why)) held.push(why); };
    if (!steps.length || !steps[0].body.trim()) { return { ok: false, held: ['no e-mail was written'], notes, steps }; }
    if (!steps[0].subject.trim()) add('the first e-mail has no subject');
    // 1. nothing left for the owner to fill in (a bracket is deliberate: the writer must not guess — but it cannot be sent as it stands)
    for (const st of steps) for (const b of bracketsIn(st.body + ' ' + st.subject)) add('needs you: ' + b.slice(0, 80));
    // 2. claims the facts on file do not carry are wrapped for the owner (CL, D14) and held
    for (const st of steps) { const r = CL.check(st.body, c.facts, { skip: c.signer, ours: true, brand: c.brand }); st.body = r.text;
      for (const f of r.flags) add('needs your confirmation: "' + S(f.claim).slice(0, 60) + '"'); }
    // 3. the recipient is on the prospect's own domain (never an address found on their page that belongs to someone else)
    const toDomain = S(d.to).toLowerCase().split('@')[1] || '';
    // a journalist request is answered at the address in the request (the "prospect" is a post, not a website), so it is exempt
    if (d.to && d.prospect_domain && !press && !d.prospect_domain.includes('/') && !(LK.sameSite(toDomain, d.prospect_domain) || LK.sameSite(d.prospect_domain, toDomain)))
      add('the address ' + mask(d.to) + ' is not on ' + d.prospect_domain);
    // 4. exactly one link per e-mail, ours, on our canonical host, and the page we chose
    const host = S(c.canonical_host || c.domain).toLowerCase().replace(/^www\./, '');
    steps.forEach((st, i) => { const ls = linksIn(st.body);
      if (ls.length > 1) add((i ? 'follow-up ' + i : 'the first e-mail') + ' carries ' + ls.length + ' links (one, to your page)');
      for (const u of ls) { const h = hostOf(u);
        if (!LK.sameSite(h, c.domain) && !LK.sameSite(c.domain, h)) add((i ? 'follow-up ' + i : 'the first e-mail') + ' links to ' + (h || 'nowhere') + ', not to your site');
        else if (host && h !== host) add('the link uses ' + h + '; your site is served on ' + host); } });
    if (!linksIn(steps.map(x => x.body).join('\n')).length) add('no link to your page');
    else if (c.target_url && !steps.some(st => linksIn(st.body).some(u => pathKey(u) === pathKey(c.target_url)))) add('none of the e-mails links to the page we chose (' + S(c.target_url).slice(0, 80) + ')');
    // 5. who is being written to (a stored "ready" row from an older run can still be one of these)
    add(OK.badHost(d.prospect_domain));
    if (OK.isGov(d.prospect_domain)) add('a government site: it lists providers through accreditation or an application, never through a pitch');
    add(OK.homepageOnly(type, d.page_url));
    add(OK.sellsSame({ type, domain: d.prospect_domain, competitors: c.competitors || [], serp_rivals: c.serp_rivals || [], ai_rivals: c.ai_rivals || [], topics: c.topics || [], title: d.page_title, url: d.page_url }));   // R21
    if (!(c.accredited === undefined ? OK.accredited(c.accreditation) : c.accredited) && OK.accreditedList(S(d.page_title) + ' ' + S(d.page_url)))
      add('a list of accredited / approved providers: the facts on file do not say you hold that accreditation');
    // 6. a real quote from their page (only when we have evidence to quote)
    if (S(d.evidence).trim() || S(d.page_title).trim()) {
      const cands = [d.page_title, d.evidence, (d.dead || {}).anchor, S((d.dead || {}).url).replace(/[\/_.-]+/g, ' ')].map(S).filter(Boolean);
      if (!quotesThem(steps[0].body + ' ' + steps[0].subject, cands)) add('the first e-mail quotes nothing that is on their page');
    }
    // 7. length, subject, one clear ask
    const w0 = wordCount(steps[0].body); const lim = press ? LIMITS.press_first : LIMITS.first;
    if (w0 > lim) add('the first e-mail is ' + w0 + ' words (at most ' + lim + ')');
    if (steps[0].subject.length > LIMITS.subject) add('the subject is ' + steps[0].subject.length + ' characters (at most ' + LIMITS.subject + ')');
    steps.slice(1).forEach((st, i) => { const w = wordCount(st.body); if (w > LIMITS.followup) add('follow-up ' + (i + 1) + ' is ' + w + ' words (at most ' + LIMITS.followup + ')'); });
    const asks = (steps[0].body.match(/\?/g) || []).length;
    if (asks > 2) add('the first e-mail asks ' + asks + ' questions: make one clear ask');
    if (!press && !asks && !/\b(would you|could you|can you|are you|let me know|happy to (send|share)|glad to send|glad to share|shall i|if (it|that|this) (helps|fits|is useful|would help))\b/i.test(steps[0].body))
      add('the first e-mail makes no clear ask');
    // 8. words we never use
    for (const st of steps) for (const [re, why] of BANNED) if (re.test(st.body) || re.test(st.subject)) add('uses ' + why);
    // 9. the business name exactly as the site model has it (the domain label is not a brand: "techand" for Tech&)
    const brandKey = S(c.brand).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const label = S(c.domain).split('.')[0].toLowerCase();
    if (c.brand_known && label.length >= 4 && !brandKey.includes(label)) {
      const re = new RegExp('(^|[^a-z0-9.@/])' + label + '($|[^a-z0-9.@-])', 'i');
      if (steps.some(st => re.test(st.body) || re.test(st.subject))) add('writes the business name as "' + label + '"; it is "' + c.brand + '"');
    }
    if (c.brand_known && !OK.namesUs(steps[0].body, [c.brand])) notes.push('the first e-mail never names the business');
    return { ok: !held.length, held, notes, steps };
  }
  return { LIMITS, check, quotesThem, grams, linksIn, bracketsIn, wordCount };
})();
