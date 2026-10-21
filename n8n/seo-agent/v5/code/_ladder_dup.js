// ---- N2 (KW recheck 2026-10-21, exec 152): one search, one ladder - the WORDS half of the rule, read before anything is paid for ----
// The ladder "ai consulting company dubai" was refused as the same search as the ladder "ai consulting dubai", correctly, but only after
// the competitor pages, the Competitor Analyzer, the Verdict, the ladder research, the cluster results pages and the relevance screen had
// run: $0.142 search data + $0.138 Claude (about 17 credits) for an answer a words comparison against the stored ladders gives for free.
// This kit is that comparison, used twice so the two cannot drift: by *Ladder Duplicate (Words)* right after *Rate Limit* (the run is
// refused there, nothing charged, before any paid call), and by Ladder_Plan.js (sameSearchLP), which still adds the results-page rule
// (3 of the top 7 pages in common) once today's results pages are read. Needs overlapTokens / overlapScore / reachDomain (_reach.js).
const LDUP = (() => {
  const S = (x) => String(x == null ? '' : x).toLowerCase().trim();
  // consultant / consulting / consultancy are one word, company / companies, service / services ... (KWL-LAD D14)
  const FAMILY = [[/^consult/, 'consult'], [/^compan/, 'company'], [/^agenc/, 'agency'], [/^servic/, 'service'], [/^provid/, 'provider'], [/^firm/, 'firm'],
    [/^solution/, 'solution'], [/^develop/, 'develop'], [/^automat/, 'automat'], [/^implement/, 'implement'], [/^integrat/, 'integrat'], [/^special/, 'special']];
  const fam = (s) => [...new Set(overlapTokens(s).map(t => { for (const [re, f] of FAMILY) if (re.test(t)) return f; return t; }))];
  /** the same search in other words: the same keyword, or 75% of the folded words shared */
  const sameWords = (a, b) => { const ka = S(a), kb = S(b); if (!ka || !kb) return false; return ka === kb || overlapScore(fam(ka), fam(kb)) >= 0.75; };
  const headOf = (r) => S(r.head_keyword || (Number(r.rung) === 4 ? r.keyword : ''));
  /** -> null | { kind: 'head' | 'page', ladder_id, head, keyword } : another ladder of this site whose main keyword (first) or one of
   *  whose planned pages is the same search as `head`, by words. `rows` = seo_ladders rows; opt: { ladder_id (this ladder, left out),
   *  domain, archived: [ladder ids] } */
  const byWords = (head, rows, o) => {
    const opt = o || {}, h = S(head), own = String(opt.ladder_id || ''), arch = new Set((opt.archived || []).map(String));
    if (!h) return null;
    const dom = opt.domain ? reachDomain(opt.domain) : '';
    const others = (rows || []).filter(r => r && r.ladder_id && String(r.ladder_id) !== own && !arch.has(String(r.ladder_id)) && (!dom || reachDomain(r.domain) === dom));
    const heads = new Map(); for (const r of others) { const x = headOf(r); if (x && !heads.has(String(r.ladder_id))) heads.set(String(r.ladder_id), x); }
    for (const [id, x] of heads) if (sameWords(x, h)) return { kind: 'head', ladder_id: id, head: x, keyword: x };
    for (const r of others) for (const k of [r.keyword, r.head_keyword]) if (S(k) && sameWords(k, h)) return { kind: 'page', ladder_id: String(r.ladder_id), head: heads.get(String(r.ladder_id)) || S(k), keyword: S(k) };
    return null;
  };
  const sameWhy = (a, b) => S(a) === S(b) ? 'it is the same keyword' : '"' + a + '" and "' + b + '" are the same search in other words';
  /** the sentence the client reads (the same words as Ladder_Plan.js's duplicate refusal), plus what it cost: nothing */
  const message = (m, head) => !m ? '' : (m.kind === 'head'
    ? 'This website already has a keyword ladder for "' + m.head + '" (' + m.ladder_id + ')' + (S(m.head) !== S(head) ? ': ' + sameWhy(head, m.head) : '') + '. One search needs one page, so no second ladder was planned: continue that ladder instead.'
    : 'Your ladder "' + m.head + '" (' + m.ladder_id + ') already plans a page for "' + m.keyword + '": ' + sameWhy(head, m.keyword) + '. One search needs one page, so no second ladder was planned: continue that ladder, or pause it and start this one.')
    + ' This was found before any research was paid for, so nothing was charged.';
  return { FAMILY, fam, sameWords, byWords, message };
})();
