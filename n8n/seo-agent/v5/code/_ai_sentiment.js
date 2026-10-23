// ---- W2-E2 (2026-10-23, docs/ai-visibility-2026-10-23/fixes/W2-E2.md): how AI answers speak of the business, aspect by aspect (inlined by build_monitors.py) ----
// Every answer that NAMES the business is read (no 24-job cap for this step): its polarity about the business (positive / neutral / negative),
// the aspects it judges (price, support, integration, trust, quality, ease, features, other) each with its own polarity, the objection a buyer
// would take from it, and how it speaks of each competitor it names. The reader is Claude Haiku (*Sentiment Reader*); the RULE READER below
// is its fallback when the model does not answer, and a second opinion whose agreement with the model is printed every run.
// Net sentiment = (positive - negative) / answers read, in points (-100..100), with a 95% range over QUESTIONS (AVX.ratio); withheld below 12.
// The rule reader and the model-output parser are scored on harness/accuracy/ai_sentiment.json (hold-out written before the rules; Cohen's
// kappa printed; the harness fails below 0.7). The model itself cannot be run offline: accuracy/eval_sentiment_model.js scores it with a key.
const SENT = (() => {
  const ASPECTS = ['price', 'support', 'integration', 'trust', 'quality', 'ease', 'features', 'other'];
  const POL = ['positive', 'neutral', 'negative'];
  const MIN = 12;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = (n) => { const s = String(n || '').trim(); if (!s) return null; return new RegExp('(^|[^\\p{L}\\p{N}])' + esc(s).replace(/\s+/g, '\\s+') + '(?=$|[^\\p{L}\\p{N}])', 'iu'); };
  // cue words (lower case; phrases first). Each is [pattern, weight]; a negation in the 3 words before flips it.
  const POS = ['highly rated', 'top-rated', 'top rated', 'well-regarded', 'well regarded', 'well-known', 'well known', 'stands out', 'standout', 'award-winning', 'cost-effective', 'cost effective', 'good value', 'great value', 'value for money',
    'user-friendly', 'user friendly', 'easy to use', 'easy to set up', 'simple to use', 'straightforward', 'no hidden fees', 'hands-on', 'on time', 'track record', 'gold partner', 'trusted', 'reliable', 'robust', 'strong', 'excellent', 'outstanding',
    'great', 'good', 'best', 'leading', 'leader', 'top', 'popular', 'recommended', 'recommend', 'ideal', 'praised', 'praise', 'affordable', 'cheapest', 'cheap', 'competitive', 'transparent', 'easy', 'easiest', 'intuitive', 'seamless', 'seamlessly',
    'comprehensive', 'powerful', 'fast', 'quick', 'responsive', 'accredited', 'certified', 'certification', 'approved', 'compliant', 'secure', 'reputable', 'renowned', 'prominent', 'proven', 'preferred', 'solid', 'flexible', 'scalable',
    'innovative', 'experienced', 'expert', 'expertise', 'efficient', 'accurate', 'safest', 'safe', 'favourite', 'favorite', 'loved', 'love', 'clean', 'natively', 'native', 'mature', 'established', 'specialist', 'advanced', 'rich', 'wide range', 'extensive', 'positive reviews', 'notable',
    // round 2 (after the first hold-out, 2026-10-23): what real and written answers praise with
    'painless', 'smooth', 'hassle-free', 'in an afternoon', 'fair value', 'fair', 'worth it', 'worth', 'highlight', 'highlights', '24/7', 'connects directly', 'stayed up', 'stayed online', 'dependable', 'unlimited', 'widely used', 'pragmatic', 'commercially minded', 'appear on', 'listed by', 'listed on'];
  const NEG = ['steep learning curve', 'learning curve', 'hidden fees', 'mixed reviews', 'negative reviews', 'not suitable', 'not yet', 'english only', 'only in english', 'higher than', 'more expensive', 'adds up', 'go unresolved', 'charges extra', 'extra for',
    'expensive', 'pricey', 'costly', 'overpriced', 'steep', 'limited', 'limiting', 'limits', 'lacks', 'lack', 'lacking', 'missing', 'complaints', 'complain', 'complained', 'slow', 'slower', 'poor', 'weak', 'difficult', 'hard', 'complex',
    'complicated', 'clunky', 'outdated', 'dated', 'buggy', 'bugs', 'crashes', 'crash', 'issues', 'problems', 'problem', 'downtime', 'outages', 'outage', 'unreliable', 'inaccurate', 'errors', 'drawback', 'drawbacks', 'downside', 'downsides', 'concerns', 'concern',
    'criticised', 'criticized', 'criticism', 'delays', 'delayed', 'frustrating', 'frustrated', 'cumbersome', 'restrictive', 'unexpected charges', 'unresolved', 'breach', 'penalty', 'fined', 'lawsuit', 'risk', 'risky', 'young company', 'few', 'fewer', 'longer', 'unclear', 'confusing', 'beware', 'be aware', 'caution', 'cancel', 'churn',
    // round 2: implicit criticism
    'waited', 'nobody', 'over budget', 'slipped', 'break', 'breaks', 'broke', 'manual', 'add up', 'thin', 'requires paid', 'patchy', 'junior', 'relies on', 'csv uploads', 'can take', 'take days', 'hours or more', 'struggled', 'struggles', 'no phone support', 'no live support', 'no native', 'no arabic', 'no api', 'no mobile app', 'are mixed', 'is mixed'];
  const NEGATE = /\b(not|no|never|isn't|isnt|aren't|doesn't|doesnt|don't|didn't|without|hardly|nor|cannot|can't|lacks?)\b/i;
  const ASP = { price: /\b(price[ds]?|pricing|cost(s|ly)?|expensive|cheap(est)?|afford\w*|fees?|value|subscription|plans?|charges?|charged|billing|budget|pricey|overpriced|per (invoice|user|month))\b/i,
    support: /\b(support|customer service|service team|onboarding|help ?desk|respon(sive|se|d)|account manager|training|after go-live|documentation|tickets?)\b/i,
    integration: /\b(integrat\w*|connect\w*|apis?|plug\w*|sync\w*|erp|sap|oracle|netsuite|dynamics|carrier|bank integrations?)\b/i,
    trust: /\b(accredit\w*|certif\w*|approved|complian\w*|trust\w*|reputa\w*|secur\w*|iso ?\d*|gdpr|fta|zatca|licen[cs]ed|track record|partner|case studies|young company|audited|regulat\w*|safest)\b/i,
    quality: /\b(accura\w*|inaccura\w*|quality|reliab\w*|unreliable|errors?|bugs?|buggy|crash\w*|uptime|outages?|downtime|performance|on time|delays?|delivering)\b/i,
    ease: /\b(easy|easiest|ease|intuitive|user[- ]friendly|simple|straightforward|learning curve|complex|complicated|clunky|set ?up|usab\w*|navigate|interface|learn)\b/i,
    features: /\b(features?|functional\w*|capabilit\w*|modules?|reporting|reports?|automation|tools?|comprehensive|suite|templates?|consolidation|validation|english only|arabic|multi-entity|workflows?|app)\b/i };
  const hits = (clause, list, orig) => { const lc = ' ' + clause.toLowerCase() + ' '; const ctx = orig ? ' ' + String(orig).toLowerCase() + ' ' : lc; let s = 0; const found = [];
    let masked = lc; for (const w of list) { const re = new RegExp('(^|[^a-z])' + esc(w) + '(?=$|[^a-z])', 'g'); let m; while ((m = re.exec(masked))) { const at = m.index + m[1].length; const before = ctx.slice(Math.max(0, at - 30), at).trim().split(/\s+/).slice(-3).join(' ');
        const after = ctx.slice(at + w.length, at + w.length + 30).trim().split(/\s+/).slice(0, 3).join(' ');
        const neg = (NEGATE.test(before) && !/^no /.test(w)) !== /\b(rare|rarely|minimal|resolved)\b/.test(after);
        const others = /\b(other (platforms|vendors|providers|tools|firms|companies|apps|systems)|competitors?|rivals?|most vendors)\b/.test(ctx.slice(Math.max(0, at - 40), at).trim().split(/\s+/).slice(-4).join(' '));
        found.push({ w, neg, others }); if (!others) s += neg ? -1 : 1; masked = masked.slice(0, at) + ' '.repeat(w.length) + masked.slice(at + w.length); re.lastIndex = at + w.length; } }
    return { s, found, masked }; };
  /** the clauses that speak of the business: its sentences (and the ones after it that start with "It / Its / They / The company"), split at
   *  ";", "but", "however", "although", "while", "whereas"; a clause naming only another business is left out */
  const SUFFIX = /[\s,]+(llp|ltd\.?|limited|llc|inc\.?|fze|fzco|fz-llc|plc|co\.?|corp\.?|gmbh|pvt\.?( ltd\.?)?|private limited|group|holding|holdings)$/i;
  const nameAny = (n) => { const v = [String(n || '').trim()]; let x = v[0]; for (let i = 0; i < 2; i++) { const y = x.replace(SUFFIX, '').trim(); if (y && y !== x) { v.push(y); x = y; } }
    const res = v.filter(Boolean).map(nameRe).filter(Boolean); return res.length ? { test: (s) => res.some(r => r.test(s)) } : null; };
  const FOLLOW = /^(it|its|it's|they|their|these|both|all (two|three|four|five|six|seven|eight|of them)|the (company|firm|platform|provider|tool|software|team|vendor|service))\b/i;
  const HEDGE = /^(whether|check|ensure|look for|consider|verify|make sure|ask)\b/i;
  const clausesOf = (text, business, rivals) => { const t = String(text || '').replace(/\*\*|__|`/g, '').replace(/[ \t]+/g, ' ').trim(); const bre = nameAny(business); const rres = (rivals || []).map(nameRe).filter(Boolean);
    const sents = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])|\s*\n+\s*|\s(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean);
    const mine = []; let follow = false, item = false; const ITEM = /^(#{1,6}\s|\d+[.)]\s|[-*•]\s|\|)/;
    for (const s of sents) { const hasB = bre ? bre.test(s) : false; const hasR = rres.some(r => r.test(s));
      if (hasB) { mine.push(s); follow = true; item = ITEM.test(s) || (s.split(/\s+/).length <= 8 && !/[.!?]$/.test(s)); }   // a heading or a list item: the lines under it are its own
      else if (item && !ITEM.test(s)) mine.push(s); else if (follow && FOLLOW.test(s) && !hasR) mine.push(s); else if (follow && !s.replace(/[|\-\s]/g, '')) continue; else { follow = false; item = false; } }
    const src = mine.length ? mine : sents;   // the name not found (a spelling of its own): the whole text is read
    const out = [];
    for (const s of src) { const parts = s.split(/;|\s(?=(?:but|however|although|though|while|whereas)\b)|,\s*(?=(?:but|however|although|though|while|whereas)\b)/i).map(x => x.trim()).filter(Boolean);
      const anyB = parts.some(p => bre && bre.test(p));
      for (const p of parts) { const hasB = bre ? bre.test(p) : false; const hasR = rres.some(r => r.test(p));
        if (anyB && !hasB && hasR) continue; if (HEDGE.test(p)) continue;                    // "Wafeq is the safest choice; Riyada is also listed": the Wafeq clause is not about Riyada
        out.push({ text: p, contrast: /^(but|however)\b/i.test(p) ? 'after' : /^(although|though|while|whereas)\b/i.test(p) ? 'concessive' : '' }); } }
    return out; };
  /** the rule reader: one snippet about one business -> { polarity, aspects: [{ aspect, polarity }], objection, score } */
  const rules = (text, business, rivals) => { const cl = clausesOf(text, business, rivals); let total = 0; const asp = new Map(); let objection = '';
    // a clause before "but" / "however" is outweighed by the one after it; an "although" clause is outweighed by the rest of its sentence
    const hasAfter = cl.some(c => c.contrast === 'after');
    for (const c of cl) { const lc = c.text.toLowerCase(); const ng = hits(lc, NEG), ps = hits(ng.masked.slice(1, -1), POS, lc);
      const raw = ps.s - ng.s; const pol = raw > 0 ? 'positive' : raw < 0 ? 'negative' : 'neutral';
      const w = c.contrast === 'after' ? 1.5 : c.contrast === 'concessive' ? 0.6 : (hasAfter ? 0.9 : 1);
      total += Math.sign(raw) * w * Math.min(2, Math.abs(raw));
      let found = false; for (const a of ASPECTS) { if (a === 'other' || !ASP[a].test(c.text)) continue; found = true; const old = asp.get(a); if (!old || old === 'neutral') asp.set(a, pol); }
      if (!found && pol !== 'neutral') { if (!asp.has('other')) asp.set('other', pol); }
      if (pol === 'negative' && !objection) objection = c.text.replace(/^(but|however|although|though|while|whereas|yet)\s+/i, '').replace(/[.;,]+$/, '').slice(0, 100); }
    const polarity = total > 0.25 ? 'positive' : total < -0.25 ? 'negative' : 'neutral';
    return { polarity, aspects: [...asp.entries()].map(([aspect, p]) => ({ aspect, polarity: p })), objection: polarity === 'negative' || objection ? objection : '', score: Math.round(100 * total) / 100, clauses: cl.length }; };
  /** the text the reader gets for one answer: the sentences that name the business (and the ones that continue them), at most 900 characters */
  const snippet = (text, business, rivals) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); const bre = nameRe(business); if (!bre) return t.slice(0, 900);
    const sents = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(*])|\s(?=\d+\.\s)/); const keep = []; let follow = false;
    for (const s of sents) { if (bre.test(s)) { keep.push(s); follow = true; } else if (follow && /^(it|its|it's|they|their|the (company|firm|platform|provider|tool|software|team|vendor))\b/i.test(s)) keep.push(s); else follow = false; }
    return (keep.length ? keep.join(' ') : t).slice(0, 900); };
  /** Cohen's kappa over pairs [label_a, label_b] */
  const kappa = (pairs) => { const P = (pairs || []).filter(p => p && p[0] != null && p[1] != null); const n = P.length; if (!n) return null; const cls = [...new Set(P.flat())];
    const po = P.filter(p => p[0] === p[1]).length / n; let pe = 0; for (const c of cls) pe += (P.filter(p => p[0] === c).length / n) * (P.filter(p => p[1] === c).length / n);
    return pe >= 1 ? 1 : Math.round(1000 * (po - pe) / (1 - pe)) / 1000; };
  /** the model's answer for one job -> one label per answer (by its number `n`), every value checked against the label lists */
  const parseModel = (out, job) => { let o = out; if (typeof o === 'string') { const s = o.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, ''); try { o = JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); try { o = JSON.parse(s.slice(a, b + 1)); } catch (e2) { o = null; } } }
    const res = new Map(); for (const x of ((o && o.answers) || [])) { const n = Number(x && x.n); const it = (job.items || []).find(i => i.n === n); if (!it) continue;
      const pol = POL.includes(String(x.polarity || '').toLowerCase()) ? String(x.polarity).toLowerCase() : null; if (!pol) continue;
      const aspects = (Array.isArray(x.aspects) ? x.aspects : []).map(a => ({ aspect: String((a && a.aspect) || '').toLowerCase(), polarity: String((a && a.polarity) || '').toLowerCase() })).filter(a => ASPECTS.includes(a.aspect) && POL.includes(a.polarity));
      const rv = (Array.isArray(x.rivals) ? x.rivals : []).map(r => ({ name: String((r && r.name) || '').trim(), polarity: String((r && r.polarity) || '').toLowerCase() })).filter(r => r.name && POL.includes(r.polarity));
      res.set(it.key, { polarity: pol, aspects, objection: String(x.objection || '').trim().slice(0, 140), rivals: rv }); }
    return res; };
  // The rule reader on the labelled set (harness W2E2-SENT recomputes these and fails when they differ): built on the T cases, it read the first
  // blind hold-out (H) at kappa 0.587 and, improved on H, the second blind hold-out (K, 80 cases, read once) at 0.548 - below the 0.7 bar. So the
  // rules never make a published figure: only the model's labels count, the rules are a second opinion. The model's own kappa needs a key
  // (accuracy/eval_sentiment_model.js) and is not measured yet: `model: null` until it is, and the report says "not yet validated".
  const KAPPA = { rules_blind_holdout: 0.548, rules_blind_n: 80, rules_all: 0.827, rules_all_n: 256, parser: 1, model: null, gate: 0.7,
    note: 'Polarity agreement with a hand-labelled set (Cohen\'s kappa). The rule reader is below the 0.7 bar on blind cases, so it never makes the figure; the model\'s agreement is not measured yet.' };
  const tb = (v) => v === true || String(v) === 'true';
  /** this run's answers that NAME the business, with the text the reader gets: the sentences about it (answer_text when stored, else the excerpt) */
  const namedAnswers = (rows, o) => { const opt = o || {}; const biz = opt.business || ''; const out = []; const seen = new Set();
    for (const r of (rows || [])) { if (!r || !tb(r.answered) || r.kind === 'brand' || r.error) continue; if (!(opt.named ? opt.named(r) : tb(r.named))) continue;
      const key = String(r.run_id || '') + '|' + String(r.prompt_id) + '|' + String(r.engine); if (seen.has(key)) continue; seen.add(key);
      let ents = []; try { ents = Array.isArray(r.entities) ? r.entities : JSON.parse(r.entities_json || '[]'); } catch (e) { ents = []; }
      const rivals = (Array.isArray(ents) ? ents : []).filter(e => e && String(e.role) === 'competitor').map(e => ({ id: String(e.id || e.name || ''), name: String(e.name || e.id || '') })).filter(e => e.name).slice(0, 8);
      const text = String(r._text || r.answer_text || r.excerpt || '');   // the parser's full text in memory, else W2-E1's stored answer_text, else the excerpt
      if (!text.trim()) continue;
      out.push({ key, prompt_id: String(r.prompt_id), engine: String(r.engine), prompt: r.prompt || '', snippet: snippet(text, biz, rivals.map(x => x.name)), rival_names: rivals.map(x => x.name), rivals }); }
    return out; };
  /** the jobs for the Sentiment Reader: every named answer, 20 to a job, at most `max_jobs` jobs (the rest are not read, and the report says how many) */
  const jobsOf = (answers, o) => { const opt = o || {}; const per = opt.per || 20, maxJ = opt.max_jobs == null ? 40 : opt.max_jobs; const A = answers || [];
    const jobs = []; for (let i = 0; i < A.length && jobs.length < maxJ; i += per) jobs.push(A.slice(i, i + per).map((a, j) => ({ n: j + 1, key: a.key, engine: a.engine, question: String(a.prompt || '').slice(0, 200), text: a.snippet, rivals: (a.rival_names || []).slice(0, 8) })));
    const sent = jobs.reduce((s, j) => s + j.length, 0); return { jobs, sent, not_sent: Math.max(0, A.length - sent) }; };
  /** sentiment_json. answers: namedAnswers(); model: Map key -> the model's label (parseModel over every job). Only the model's labels are counted. */
  const aggregate = (answers, model, o) => { const opt = o || {}; const A = answers || []; const M = model || new Map();
    const L = A.map(a => { const m = M.get(a.key); const r0 = rules(a.snippet, opt.business || '', a.rival_names || []); return m ? { ...a, ...m, by: 'model', rules_polarity: r0.polarity, rivals: (m.rivals || []).map(x => ({ ...x, id: ((a.rivals || []).find(y => y.name.toLowerCase() === x.name.toLowerCase()) || {}).id || x.name })) } : { ...a, by: 'none', rules_polarity: r0.polarity }; });
    const R = L.filter(l => l.by === 'model'); const n = R.length; const unread = L.length - n;
    const sc = (p) => p === 'positive' ? 1 : p === 'negative' ? -1 : 0;
    const base = { n, named_answers: L.length, unread, positive: R.filter(l => l.polarity === 'positive').length, neutral: R.filter(l => l.polarity === 'neutral').length, negative: R.filter(l => l.polarity === 'negative').length, min: MIN,
      method: 'Claude Haiku reads every answer that names you (20 to a call); a rule reader gives a second opinion and never makes the figure', kappa: { ...KAPPA }, validated: KAPPA.model != null && KAPPA.model >= KAPPA.gate,
      model_vs_rules: R.length ? { n: R.length, agreement: Math.round(1000 * R.filter(l => l.rules_polarity === l.polarity).length / R.length) / 10, kappa: kappa(R.map(l => [l.polarity, l.rules_polarity])) } : null,
      unread_note: unread ? unread + ' of the ' + L.length + ' answers that name you were not read by the model (' + (opt.unread_why || 'it did not answer for them') + '); they are not counted.' : '' };
    if (n < MIN) return { ...base, net: null, net_lo: null, net_hi: null, withheld: true, by_aspect: [], by_rival: [], objections: [], note: L.length ? 'Sentiment is withheld: ' + n + ' answer' + (n === 1 ? ' was' : 's were') + ' read, and a figure needs ' + MIN + '.' : 'No answer named you, so there is no sentiment to read.' };
    const r = AVX.ratio(R, (l) => [sc(l.polarity), 1], { scale: 100, lo0: -1, hi0: 1 });
    const aspects = ASPECTS.map(a => { const xs = R.map(l => (l.aspects || []).find(x => x.aspect === a)).filter(Boolean); const pos = xs.filter(x => x.polarity === 'positive').length, neg = xs.filter(x => x.polarity === 'negative').length;
      return { aspect: a, pos, neg, neu: xs.length - pos - neg, n: xs.length, net: xs.length >= MIN ? Math.round(100 * (pos - neg) / xs.length) : null }; }).filter(x => x.n);
    const rv = new Map(); for (const l of R) for (const x of (l.rivals || [])) { const k = String(x.id || x.name).toLowerCase(); const s0 = rv.get(k) || { id: x.id || x.name, pos: 0, neg: 0, n: 0 }; s0.n++; if (x.polarity === 'positive') s0.pos++; if (x.polarity === 'negative') s0.neg++; rv.set(k, s0); }
    const objMap = new Map(); for (const l of R) { const t = String(l.objection || '').trim(); if (!t) continue; const k = t.toLowerCase().replace(/[^a-z0-9 ]+/g, '').slice(0, 60); const s0 = objMap.get(k) || { text: t, n: 0, engines: new Set() }; s0.n++; s0.engines.add(l.engine); objMap.set(k, s0); }
    return { ...base, withheld: false, net: r.value == null ? null : Math.round(r.value), net_lo: r.lo == null ? null : Math.round(r.lo), net_hi: r.hi == null ? null : Math.round(r.hi), n_questions: r.n_questions,
      by_aspect: aspects.sort((a, b) => b.n - a.n), by_rival: [...rv.values()].sort((a, b) => b.n - a.n).slice(0, 10).map(s0 => ({ id: s0.id, n: s0.n, net: s0.n >= MIN ? Math.round(100 * (s0.pos - s0.neg) / s0.n) : null })),
      objections: [...objMap.values()].sort((a, b) => b.n - a.n).slice(0, 8).map(s0 => ({ text: s0.text, n: s0.n, engines: [...s0.engines] })),
      note: 'Net sentiment ' + (r.value >= 0 ? '+' : '') + Math.round(r.value) + ' (positive minus negative, per 100 answers that name you; 95% range ' + (r.lo == null ? 'not measurable' : Math.round(r.lo) + ' to ' + Math.round(r.hi)) + ', ' + n + ' answers to ' + r.n_questions + ' questions). Compare it only within one market and language.'
        + (KAPPA.model == null ? ' The model\'s labels are not yet validated against a hand-labelled set.' : '') }; };
  return { ASPECTS, POL, MIN, KAPPA, rules, snippet, clausesOf, kappa, parseModel, namedAnswers, jobsOf, aggregate, nameRe };
})();
