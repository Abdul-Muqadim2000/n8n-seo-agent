// ---- A-5 / A-6 / A-23 (2026-10-17, re-rating execs 760 / 765): the verdict's advice checked against what the site already holds ----
// (inlined into *Parse Verdict* by build_v4.py section 130, after the existing-page rules; reads `prev.own_coverage` from *Own Coverage
// (Run)*, the site model's pages and the existing page's whole text.) Four deterministic checks, each reported, nothing silently dropped:
//   1. a secondary keyword another page, a ladder or a written draft of the site already holds is taken off this page and named (A-5:
//      five planned pages of the ladder "e invoicing in uae" and the draft "uae e-invoicing deadline 2027"; A-23: the slug of the live
//      Business Central page, a rung of "erp software uae", a variant of "erp implementation dubai");
//   2. with no page of its own for the search, a change that says "build a ... page" is preceded by the pages the site already has on
//      that topic, read from their titles (A-23: /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae);
//   3. a change that asks for a section on a topic a rung or a draft of the site covers names it ("a penalties section" beside the
//      penalties rung and article, A-5);
//   4. an amount the change asks to "add" that the page already states is moved out of the request (A-6: "the AED 50 million threshold").
const OWNV = (() => {
  const cov = prev.own_coverage && typeof prev.own_coverage === 'object' ? prev.own_coverage : null;
  const model = prev.site_model && typeof prev.site_model === 'object' ? prev.site_model : null;
  const res = { secondary: (Array.isArray(verdict.secondary_keywords) ? verdict.secondary_keywords : []).map(s => String(s || '').trim()).filter(Boolean),
    covered: [], related: [], sections: [], already_on_page: [], keyword_covered: null, checked: !!cov };
  const pathOf = (u) => String(u || '').replace(/^https?:\/\/[^/]+/i, '') || '/';
  // 4 (first). an amount the change asks to add that the page already states (A-6)
  const pageText = String(prev.existing_page_text || '').toLowerCase().replace(/\s+/g, ' ');
  if (EXP && pageText) {
    const AMT = /\b(?:aed|usd|eur|gbp|sar|dhs?)\s?\d[\d,.]*\s*(?:million|billion|thousand|bn|m|k)?\b|\$\s?\d[\d,.]*\s*(?:million|billion|thousand|bn|m|k)?\b|\b\d[\d,.]*\s*(?:million|billion)\b/gi;
    const forms = (m) => { const t = m.toLowerCase().replace(/\s+/g, ' ').trim(); const out = [t];
      const n = t.match(/(\d[\d,.]*)\s*(million|billion|m|bn)?/); if (n) { const u = n[2] === 'm' ? 'million' : n[2] === 'bn' ? 'billion' : n[2] || ''; out.push(t.replace(/\s*(million|billion|m|bn)\b/, u ? ' ' + u : ''), n[1] + (u ? ' ' + u : '')); }
      return [...new Set(out)].filter(f => f.length >= 3); };
    verdict_changes = verdict_changes.map(line => {
      if (!/\b(?:add|include|state|mention|cover|explain)\b/i.test(line)) return line;
      const items = line.split(/,\s*(?:and\s+)?|;\s*|:\s+/);
      let out = line; const kept = [];
      for (const it of items) { const ms = it.match(AMT) || []; if (!ms.length) continue;
        if (!ms.every(m => forms(m).some(f => pageText.includes(f)))) continue;
        const item = it.trim().replace(/[.\s]+$/, ''); if (!item || item.length > 120) continue;
        const re = new RegExp('(,\\s*(?:and\\s+)?|\\s+and\\s+)?' + item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const next = out.replace(re, ''); if (next === out) continue;
        out = next; kept.push(item); }
      if (!kept.length) return line;
      kept.forEach(k => res.already_on_page.push(k));
      return out.replace(/\s+([,.;])/g, '$1').replace(/,\s*\./g, '.').replace(/\s*$/, '') + ' Already on the page, keep as it is: ' + kept.join('; ') + '.';
    });
  }
  if (cov) {
    const expUrl = EXP ? EXP.url : '';
    const self = cov.self || { ladder_id: prev.ladder_id || '', keyword: prev.keyword };
    const ctx = { matchPage: model ? (k) => SM.matchPage(model, k) : null, ladders: cov.ladders || [], drafts: cov.drafts || [],
      exclude_urls: [expUrl, self.target_url || prev.ladder_target_url || ''], self, page_min: 1 };
    // 0. the search itself: a ladder or a draft of the site may already hold it (A-23: "erp system dubai" is the rung "erp software dubai"
    //    of the ladder "erp software uae" in other words) - said first, so nobody writes a second page for it
    const selfClaim = EXP ? null : (OWN.ladderOf(ctx.ladders, prev.keyword, { self, min: 'other words' }) || OWN.draftOf(ctx.drafts, prev.keyword, { self_keyword: self.keyword }));
    if (selfClaim) { res.keyword_covered = { by: selfClaim.kind, ladder_id: selfClaim.ladder_id || null, head_keyword: selfClaim.head_keyword || null, keyword: selfClaim.keyword, status: selfClaim.status, how: selfClaim.how, note: OWN.sayOf(selfClaim) };
      verdict_changes.unshift('This search is already planned on the site: ' + OWN.sayOf(selfClaim) + ' is ' + selfClaim.how + '. Write or improve that page rather than a second one for it.'); }
    // 1. secondary keywords
    const keep = [];
    for (const s of res.secondary) {
      if (OWN.relate(s, prev.keyword)) { keep.push(s); continue; }   // the page's own search in other words stays on it
      const c = OWN.claim(s, ctx);
      if (c && c.relation !== 'other place') res.covered.push({ keyword: s, by: c.kind, url: c.url || c.target_url || '', ladder_id: c.ladder_id || null,
        head_keyword: c.head_keyword || null, status: c.status || null, how: c.how, note: OWN.sayOf(c) });
      else keep.push(s);
    }
    res.secondary = keep;
    // 2. "build a page" beside the pages the site already has on that topic (only when the search has no page of its own)
    const BUILD_RE = /\b(?:build|create|write|publish|launch|develop|make|set up)\b[^.;]{0,120}?\b(?:page|landing page|hub|guide|article|post)\b/i;
    const titleTerms = (p) => OWN.distinct(String(p.title || '').replace(/\s*[|–—]\s*[^|–—]{1,30}$/, ''), '');
    if (!EXP && model) {
      const ask = verdict_changes.find(l => BUILD_RE.test(l) && !/^This search is already planned on the site/.test(l));   // the model's own request, not our note
      if (ask) {
        const lt = new Set(OWN.tokens(ask).map(t => t === 'system' ? 'software' : t));
        res.related = SM.pages(model).filter(p => !SM.isListing(p.url)).map(p => { const tt = titleTerms(p); const hit = tt.filter(t => lt.has(t)).length;
          return { url: SM.canonUrl(model, p.url), title: String(p.title || '').replace(/\s*[|–—]\s*[^|–—]{1,30}$/, ''), hit, of: tt.length }; })
          .filter(p => p.of >= 2 && p.hit >= 2 && p.hit / p.of >= 0.75).sort((a, b) => b.hit / b.of - a.hit / a.of || b.hit - a.hit).slice(0, 4);
        const at = /^This search is already planned on the site/.test(verdict_changes[0] || '') ? 1 : 0;
        if (res.related.length) verdict_changes.splice(at, 0, 'Before building anything new: the site already has ' + res.related.map(p => pathOf(p.url) + (p.title ? ' ("' + p.title + '")' : '')).join(' and ')
          + ' on this topic. Improve and link those first; a new page is worth it only for a search none of them targets, and it must link to them.');
      }
    }
    // 3. a section on a topic a rung or a draft of the site covers
    const holders = [...(cov.ladders || []).filter(e => !(self.ladder_id && e.ladder_id === self.ladder_id && e.keyword === String(self.keyword || '').toLowerCase()))
      .map(e => ({ text: e.keyword, say: OWN.sayOf({ kind: 'ladder', ...e }), url: model ? ((SM.matchPage(model, e.keyword) || {}).url || '') : '' })),
      ...(cov.drafts || []).filter(d => d.keyword !== String(prev.keyword || '').toLowerCase()).map(d => ({ text: d.keyword, say: OWN.sayOf({ kind: 'draft', ...d }), url: '' }))];
    const kwCore = OWN.distinct(prev.keyword, '');
    const onTopic = (t) => { const tt = OWN.tokens(t); return kwCore.some(w => tt.includes(w)); };
    verdict_changes = verdict_changes.map(line => {
      const lt = new Set(OWN.tokens(line)); const notes = [];
      for (const h of holders) { const d = OWN.distinct(h.text, prev.keyword).filter(t => t.length >= 5); if (!d.length || d.length > 2 || !d.every(t => lt.has(t))) continue;
        if (!onTopic(h.text) || notes.some(n => n.topic === h.text)) continue;   // a rung of another topic is not this page's business
        notes.push({ topic: h.text, say: h.say + (h.url && (!EXP || OWN.ukey(h.url) !== OWN.ukey(EXP.url)) ? ', page ' + pathOf(h.url) : '') }); if (notes.length >= 2) break; }
      if (!notes.length) return line;
      notes.forEach(n => res.sections.push({ line: line.slice(0, 120), topic: n.topic, by: n.say }));
      return line.replace(/\s*$/, '') + ' (The site already covers ' + notes.map(n => '"' + n.topic + '": ' + n.say).join('; ') + ' — keep it to a short summary here that links there, not a full section.)';
    });
  }
  if (res.covered.length) verdict_changes.push('Kept off this page because the site already holds ' + (res.covered.length === 1 ? 'it' : 'them') + ': '
    + res.covered.slice(0, 8).map(c => '"' + c.keyword + '" (' + c.note + ')').join('; ') + '. Two pages for one search split the signals — link to those pages instead.');
  return res;
})();
