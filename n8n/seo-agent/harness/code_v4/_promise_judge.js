// harness shim (written by build_v4.py section 148): the promise judge kit, { fn, args } -> { r }
// ---- promise judge kit (CT-FIX2, 2026-10-22; inlined by build_v4.py section 148): the second reader of the promise check ----
// The rule-based check (CL.commitments, _claims.js) scored 100% / 88% recall offline and then, on the first fresh live page (exec 159),
// flagged three true or harmless sentences (a true fact said in other words, a mid-page invitation, a "Read [link]" line) and missed three
// promises (a phase named as the subject, a passive list item, an image caption). More patterns had stopped helping. So the check has two
// stages: the rules find CANDIDATES with a wide net (every sentence they would judge, plus the sentences a section about the business, a
// name on file or "we / our" puts near a commitment, captions included), and one Claude Haiku call per page judges each candidate against
// the closest facts on file: is it a commitment of the business, and which fact (if any) carries it. The model never adds a sentence: a
// verdict for anything that is not a candidate is ignored. When the call fails, is skipped or answers for another candidate list, the
// rules decide alone and the report says "checked by rules only".
const PJ = (() => {
  const MODEL = 'claude-haiku-4-5-20251001';
  const MAX_CANDS = 40;
  // OFF by default (2026-10-22): one real evaluation on the 180 labelled sentences (harness/accuracy/CLAIMS_MODEL_EVAL.md) showed the
  // second reader decides exactly as the rules under the safe policy, for about $0.02 and 10-13 s a QA round, and lowers recall when trusted.
  // A run turns it on with promise_judge: true in its brief (Parse Brief); switch the default on only after a model beats the rules there.
  const ENABLED_DEFAULT = false;
  const enabled = (prev) => (prev && typeof prev.promise_judge === 'boolean') ? prev.promise_judge : ENABLED_DEFAULT;
  const k = (s) => String(s || '').replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/^\[(?:Confirm|Owner)[^:]*:\s*/i, '').replace(/\]$/, '')
    .replace(/[*_`]+/g, '').replace(/^[-*]\s+/, '').toLowerCase().replace(/[^\p{L}\p{N}%$€£]+/gu, ' ').replace(/\s+/g, ' ').trim();
  // a short, stable fingerprint of the candidate list: the judge's answer is used only for the list it was asked about
  const keyOf = (cands) => { let h = 5381; const t = (cands || []).map(c => k(c.sentence)).join('|'); for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return 'pj' + h.toString(36) + '.' + (cands || []).length; };
  // what the business says about itself, from every place a content run reads it (Content QA §2b OWN_TEXT; one definition for both nodes)
  const ownText = (prev, siteModel) => {
    const P = prev || {}; const SMx = siteModel || (P.site_model && typeof P.site_model === 'object' ? P.site_model : null) || {};
    const vals = (o) => (o && typeof o === 'object') ? Object.values(o).map(v => (v && typeof v === 'object') ? vals(v) : String(v == null ? '' : v)).join(' ') : String(o || '');
    // H3 (2026-10-28): the facts the client confirmed or wrote in answer to an earlier page's questions (business_facts_kv) are on file too
    return [P.business, P.business_facts, (P.business_facts_kv && typeof P.business_facts_kv === 'object') ? vals(P.business_facts_kv) : '', P.case_facts_text, SMx.business_facts, SMx.accreditation, vals(SMx.services), vals(SMx.nap),
      vals(P.site_profile), vals(P.author), vals(P.reviewer), ...(P.client_pages || []).map(p => p && p.text),
      // H1 / H2 (2026-10-27): on a refresh of a page the system itself wrote (`existing_page_ours`, set by the caller from the content log),
      // that page's text is our own earlier draft, not the client's word, and never supports a claim about the business
      P.existing_page_ours ? '' : P.existing_page_text, P.existing_page_ours ? '' : P.existing_page_facts_text, vals(P.client_signals), P.proof_context, vals(P.proof_library), P.cta, SMx.cta].filter(Boolean).map(String).join('\n');
  };
  // the captions and alt texts the brief planned for the page's images: shown on the page next to the copy
  const captionsOf = (brief) => ((brief || {}).image_suggestions || []).flatMap(im => [im && im.caption]).map(x => String(x || '').trim()).filter(x => x.length >= 12);
  // Run 1 of the evaluation (CLAIMS_MODEL_EVAL.md) showed the two questions mixed up when asked as two booleans: "commitment: false,
  // because no fact states the price", or "supported_by: F13" beside "runbook and dashboards not stated". The answer now names what the
  // sentence IS first (one of seven kinds), then the detail the facts do not carry, then the fact; a commitment is supported only when
  // nothing is missing AND a fact is named.
  const KINDS = ['commitment', 'call_to_action', 'pointer_to_page', 'page_narration', 'advice_to_reader', 'about_others', 'quotation'];
  const TOOL = { name: 'record_verdicts', description: 'Record one verdict per candidate sentence.',
    input_schema: { type: 'object', properties: { key: { type: 'string' }, verdicts: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, kind: { type: 'string', enum: KINDS }, missing: { type: 'string' }, supported_by: { type: ['string', 'null'] },
      is_business_commitment: { type: 'boolean' }, reason: { type: 'string' } },
      required: ['id', 'kind', 'missing', 'supported_by', 'is_business_commitment', 'reason'] } } }, required: ['key', 'verdicts'] } };
  const SYSTEM = 'You check sentences of a web page draft written in the name of a business, before it is published. For each candidate:\n'
    + 'kind: what the sentence IS, whether or not it is true. "commitment" = it states something the business itself does, offers, delivers, includes, charges, guarantees, has, holds or has achieved (service, scope, process step, deliverable, price, term, timeline, credential, experience, location, client count); a sentence in the business\'s own voice (we, our, the business name, one of its phases or services as the subject, a passive line about its work, a list item under a lead-in in its voice, an image caption about how it works) is a commitment even when nothing supports it. Otherwise: call_to_action (an invitation: book, call, contact, start, including "to test X first, book a call"), pointer_to_page (only points to another page: "Read how X approaches security"), page_narration (about the page itself), advice_to_reader, about_others (the market, the law, a vendor product, a third party), quotation.\n'
    + 'missing: for a commitment, the specific details the facts below do NOT state (a number, a deliverable, a step, a price, a duration, a scope); empty string only when every detail is stated. Same meaning in other words counts as stated; "UAE" = "United Arab Emirates"; a sentence joining two facts is stated when both are.\n'
    + 'supported_by: the id of the fact that states it (the main one if two are needed), or null.\n'
    + 'is_business_commitment: true exactly when kind is "commitment".\n'
    + 'reason: at most 10 words.\n'
    + 'Judge only the candidates given, one verdict each, with its id. Copy the key you are given. Never assume a fact that is not listed.';
  // the facts sent with a page, each once, with its id (F1, F2 ...): the two closest to each candidate, in candidate order
  const factIds = (list) => { const fid = new Map(); const per = list.map(c => (c.facts || []).slice(0, 2).map(f => { const t = String(f || '').trim().slice(0, 220); if (!t) return null;
    if (!fid.has(t)) fid.set(t, 'F' + (fid.size + 1)); return fid.get(t); }).filter(Boolean)); return { fid, per, text: new Map([...fid].map(([t, id]) => [id, t])) }; };
  // one request per page: the candidates, each with the ids of its closest facts, and every such fact once
  const request = (cands, opts) => {
    const o = opts || {}; const list = (cands || []).slice(0, MAX_CANDS);
    const FI = factIds(list); const facts = [...FI.fid].map(([t, id]) => id + ': ' + t);
    const lines = list.map((c, i) => { const ids = FI.per[i];
      return 'C' + (i + 1) + (c.where === 'caption' ? ' (image caption)' : c.where === 'li' ? ' (list item' + (c.lead ? ' under "' + c.lead + '"' : '') + ')' : '') + ': ' + String(c.plain || c.sentence).slice(0, 500) + (ids.length ? '  [closest facts: ' + ids.join(', ') + ']' : '  [no close fact]'); });
    const user = 'Business: ' + (o.business || 'the business') + (o.domain ? ' (' + o.domain + ')' : '') + '\nKey: ' + keyOf(list) + '\n\nFacts on file (what the business says about itself):\n'
      + (facts.length ? facts.join('\n') : '(none close to these sentences)') + '\n\nCandidate sentences from the draft:\n' + lines.join('\n');
    return { model: MODEL, max_tokens: Math.min(4000, 300 + 80 * list.length), temperature: 0, system: SYSTEM, tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content: user }] };
  };
  // the answer, read only for the candidate list it was asked about. { ok, by: Map(k(sentence) -> verdict), usage, why }
  const read = (resp, cands) => {
    const list = (cands || []).slice(0, MAX_CANDS); const key = keyOf(list); const out = { ok: false, by: new Map(), usage: null, why: '', key };
    const r = resp || {};
    if (r.error || !Array.isArray(r.content)) { out.why = 'the second reader could not be reached' + (r.error ? ' (' + String((r.error && (r.error.message || r.error.type)) || r.error).slice(0, 80) + ')' : ''); return out; }
    if (r.usage) out.usage = { input_tokens: Number(r.usage.input_tokens) || 0, output_tokens: Number(r.usage.output_tokens) || 0 };
    const tu = r.content.find(c => c && c.type === 'tool_use' && c.input);
    if (!tu) { out.why = 'the second reader gave no verdicts'; return out; }
    if (String(tu.input.key || '') !== key) { out.why = 'the second reader answered for another list of sentences'; return out; }
    const FI = factIds(list);
    for (const v of (tu.input.verdicts || [])) { const m = String((v || {}).id || '').match(/^C(\d+)$/); const c = m ? list[Number(m[1]) - 1] : null; if (!c) continue;   // never a sentence that was not a candidate
      const kind = KINDS.includes(v.kind) ? v.kind : (v.is_business_commitment === true ? 'commitment' : 'unknown');
      const sup = v.supported_by && !/^(?:null|none|n\/a)$/i.test(String(v.supported_by).trim()) ? String(v.supported_by) : null;
      const missing = String(v.missing || '').trim(); const gap = !!missing && !/^(?:none|nothing|n\/a|-)$/i.test(missing);
      out.by.set(k(c.sentence), { commit: kind === 'commitment' || v.is_business_commitment === true, kind, supported_by: gap ? null : sup, fact: sup ? (FI.text.get(sup) || '') : '', missing: gap ? missing.slice(0, 160) : '', reason: String(v.reason || '').slice(0, 200) }); }
    out.ok = out.by.size > 0; if (!out.ok) out.why = 'the second reader gave no verdicts';
    return out;
  };
  // the final decision for one candidate. Both evaluation runs (CLAIMS_MODEL_EVAL.md) showed the reader is right where the rules are
  // blind and wrong where they are sure: it named facts for prices and counts no fact carries, and called true, rule-supported lines
  // unsupported. So it may (1) lift a rule flag from an invitation, a pointer to another page, the page's own narration or a quotation;
  // (2) lift one as supported only when the fact it names carries the sentence by the rules' own test (`backs`: every number, 40% of
  // the words); (3) add a flag only to a sentence the rules did not judge as a commitment at all (the wide net, "we recommend ...").
  // Otherwise the rules stand.
  const LIFT = new Set(['call_to_action', 'pointer_to_page', 'page_narration', 'quotation']);
  const decide = (cand, J, backs) => { const v = J && J.ok ? J.by.get(k(cand.sentence)) : null;
    if (!v) return { flagged: !!cand.rule_flag, by: 'rules' };
    const m = (flagged, why) => ({ flagged, by: 'model', reason: v.reason + (v.missing ? ' (not on file: ' + v.missing + ')' : ''), supported_by: v.supported_by, commit: v.commit, kind: v.kind, rule: why });
    if (cand.rule_flag) {
      if (!v.commit && LIFT.has(v.kind)) return m(false, 'lifted: ' + v.kind);
      if (v.commit && v.supported_by && v.fact && typeof backs === 'function' && backs(cand.plain || cand.sentence, v.fact)) return m(false, 'lifted: supported by ' + v.supported_by);
      return { flagged: true, by: 'rules', reason: v.reason, kind: v.kind };
    }
    if (v.commit && !v.supported_by && (cand.why === 'wide' || cand.why === 'advice')) return m(true, 'added');
    return { flagged: false, by: 'rules' };
  };
  return { MODEL, MAX_CANDS, ENABLED_DEFAULT, enabled, KINDS, LIFT, factIds, k, keyOf, ownText, captionsOf, request, read, decide, SYSTEM, TOOL };
})();
return $input.all().map(i => ({ json: { r: PJ[i.json.fn].apply(null, i.json.args || []) } }));
