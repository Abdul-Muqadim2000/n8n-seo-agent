// ---- AIRC: the AI ranking plan in the client's words (FX-C RC-1, 2026-11-06; inlined by build_monitors.py through its marker) ----
// The weekly memo of the AI ranking plan (ARL.memo, v5/code/_ai_rank_learn.js) is written for the owner's review: question ids, stage codes,
// statistics, the model's own figures and provider dollars. A client never reads it. This kit turns it into five short sections a client
// reads: what changed, why it moved ("likely helped" / "can't tell yet"), whether our steps worked, what we did and what we need from them.
// It reads only the memo's documented line shapes; a line it does not recognise is left out (never printed raw). No money: the number of
// questions won and the raw spend travel apart (`wins`, `spend_usd`) so the app can show credits; `spend_usd` is stripped before any
// customer sees a payload (app/shared/src/agency.ts clientSafePayload). The app mirror is app/shared/src/ai-rank-client.ts (its test runs
// this file and requires the same output for the same memo).
// Pure: no node access, no clock, no network; n8n sandbox rules (no URL constructor, no defineProperty, no structuredClone).
const AIRC = (() => {
  const S = (v) => (v == null ? '' : String(v)).trim();
  // the engine's lever names (ARL.LEVERS labels), as ARL writes them into the memo; harness AE5 holds this list equal to ARL.LEVERS
  const ENGINE_LABELS = { L01: 'Unblock AI bots in robots.txt', L02: 'Content in raw HTML (server render)', L03: 'Add the site to Bing Webmaster and submit', L04: 'Get the page indexed in Google', L05: 'Own answer page for the searches the engines run', L06: 'Refresh the ranking page for the searches the engines run', L07: 'Cited but not named: fix the passage', L08: 'Placement on an editorial list the answers cite', L09: 'Directory profile on a directory the answers cite', L10: 'Registry or partner listing (eligible only)', L11: 'Earned mention (press, partner, customer case)', L12: 'LinkedIn article by a named person', L13: 'Disclosed community answer', L14: 'Video for the question', L15: 'Correction (own page or ask the source)', L16: 'Protect a cited page; refresh it when citations decay', L17: 'Wikidata / Wikipedia entity' };
  // the client's words for each lever (equal to app/shared/src/ai-rank.ts AI_RANK_LEVER_LABELS; the app's test holds them equal)
  const LABELS = { L01: 'Let AI assistants read your website', L02: 'Put the page text in the page itself, not only in scripts', L03: 'Add your website to Bing Webmaster Tools', L04: 'Get the page into Google', L05: 'A new page that answers the question', L06: 'Refresh the page that ranks for the question', L07: 'Name your business in the passage AI answers quote', L08: 'Get onto a list that AI answers cite', L09: 'A profile on a directory that AI answers cite', L10: 'A registry or partner listing you qualify for', L11: 'Be mentioned in the press, by a partner or a customer', L12: 'A LinkedIn article by a named person', L13: 'An answer in a community, saying who you are', L14: 'A short video that answers the question', L15: 'Correct a wrong claim about your business', L16: 'Keep a page AI answers cite, and refresh it when they stop', L17: 'A Wikidata entry for your business' };
  const LEVER_OF_LABEL = {}; for (const k of Object.keys(ENGINE_LABELS)) LEVER_OF_LABEL[ENGINE_LABELS[k]] = k;
  const label = (lever) => LABELS[S(lever)] || 'A step to get you named in AI answers';
  // where a question stands in one assistant's answers (ARL stage codes), in plain words
  const STAGE = { S0: 'the assistant could not read your website', S1: 'not in the answer', S2: 'your website comes up but is not linked', S3: 'linked but not named', S4: 'named, but weakly or wrongly', S5: 'clearly named', unmeasured: 'not measured' };
  const ENGINES = { 'ChatGPT (API)': 'ChatGPT' };
  const engine = (e) => ENGINES[S(e)] || S(e);
  const WHO = { auto: 'we do it', approve: 'you approve it, we do it', human: 'you do it, we check it' };
  const STATUS = { proposed: 'proposed', queued: 'queued', in_progress: 'in progress', done: 'done', verified: 'confirmed', not_happened: 'did not happen', expired: 'expired', refused: 'not done', shadow: 'trial only' };
  const OPEN = ['proposed', 'queued', 'in_progress'];
  const VERDICT = { 'likely helped': 'likely helped', "can't tell": "can't tell yet", 'no effect seen': 'no change seen yet', 'did not happen': 'the step did not happen', 'not due yet': 'too early to tell' };
  /** a free text (an action's why, a blocker) without ids, stage codes, money, the internal name or the model's figures */
  const plain = (v) => S(v)
    .replace(/[–—]/g, '-').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/\s*\([^()]*(?:chance|model|prior|bootstrap|fisher|p ?=|own-page|notability)[^()]*\)/gi, '')
    .replace(/\bnotability gate\b/gi, 'the bar for an encyclopedia entry')
    .replace(/\b(?:aip|air|ait|lad|cad)_[A-Za-z0-9_.:-]+/g, '').replace(/\bAIR'?s?\b/g, 'AI ranking').replace(/\bS[0-5]\b/g, '')
    .replace(/(?:US)?\$\s?\d[\d,]*(?:\.\d+)?/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  const qWords = (q, ctx) => { const t = S(ctx && typeof ctx.question === 'function' ? ctx.question(q) : ''); return t ? '"' + plain(t) + '"' : 'One of your tracked questions'; };
  const lineOf = (l) => (l && typeof l === 'object' ? l : { text: S(l), figures: [] });
  const fig = (l, name) => { const f = (lineOf(l).figures || []).find(x => x && S(x.name) === name); return f ? f.value : undefined; };
  const num = (v) => { const n = Number(v); return v == null || S(v) === '' || !Number.isFinite(n) ? null : n; };

  /** memo (ARL.memo) + ctx -> { v, sections: [{ key, title, lines: [text] }], wins, spend_usd }
   *  ctx: { question(id) -> text, leverOf(actionId) -> lever, actions: [{ lever, executor, status, url }] } */
  const view = (memo, ctx) => { const m = memo && typeof memo === 'object' ? memo : {}; const c = ctx || {};
    const part = (k) => ((m.parts || []).find(p => p && p.key === k) || {}).lines || [];
    const changed = [], why = [], worked = [], did = [], you = [];
    for (const l0 of part('what_changed')) { const t = S(lineOf(l0).text); let x;
      if (t === 'No diagnosis this week.') changed.push('No new reading of your questions this week.');
      else if (/^This is the first reading/.test(t)) changed.push('This is the first week we read your questions, so there is nothing to compare with yet.');
      else if (t === 'No question changed stage this week.') changed.push('No question moved this week.');
      else if ((x = t.match(/^(.+?): found on (\d+) of (\d+) questions \(last week (\d+)\), won on (\d+) \(last week (\d+)\)\.$/)))
        changed.push(engine(x[1]) + ': your website comes up for ' + x[2] + ' of ' + x[3] + ' questions (' + x[4] + ' last week), and you are clearly named for ' + x[5] + ' (' + x[6] + ' last week).');
      else if ((x = t.match(/^Question (\S+) on (.+?): (up|down) from /))) { const from = STAGE[S(fig(l0, 'from'))], to = STAGE[S(fig(l0, 'to'))]; if (!from || !to) continue;
        changed.push(qWords(x[1], c) + ' on ' + engine(x[2]) + ': moved ' + x[3] + ', from ' + from + ' to ' + to + '.'); } }
    for (const l0 of part('why')) { const t = S(lineOf(l0).text); let x;
      if (/^Nothing moved up/.test(t)) { why.push('Nothing moved up this week.'); continue; }
      if (!(x = t.match(/^Question (\S+) on (.+?): (.+)$/))) continue; const head = qWords(x[1], c) + ' on ' + engine(x[2]) + ': ';
      const aid = S(fig(l0, 'attributed_to')); const bg = /background/.test(x[3]);
      if (aid) { const lv = S(typeof c.leverOf === 'function' ? c.leverOf(aid) : '') || LEVER_OF_LABEL[(x[3].match(/after "([^"]+)"/) || [])[1]] || '';
        why.push(head + (bg ? 'can\'t tell yet. It moved after our step "' + label(lv) + '", but questions we did not work on moved the same way.' : 'likely helped by our step "' + label(lv) + '".')); }
      else why.push(head + (bg ? 'it moved on its own: questions we did not work on moved the same way.' : 'it moved without a step of ours.')); }
    for (const l0 of part('projected_vs_real')) { const t = S(lineOf(l0).text); let x;
      if (/^No action has reached the end of its window yet/.test(t)) { worked.push('It is too early to tell whether our steps worked: each one is judged after a few weeks of answers, against questions we did not work on.'); continue; }
      if (!(x = t.match(/^(.+?): we projected .*Verdict: (.+)\.$/))) continue; const lv = LEVER_OF_LABEL[x[1]]; const v = VERDICT[S(x[2])]; if (!v) continue;
      worked.push(label(lv) + ': ' + v + '.'); }
    const acts = (Array.isArray(c.actions) ? c.actions : []).filter(a => a && S(a.lever));
    for (const a of acts) { const st = S(a.status); const ex = S(a.executor) === 'auto' || S(a.executor) === 'approve' ? S(a.executor) : 'human';
      const what = label(a.lever) + (S(a.url) ? ': ' + S(a.url) : '');
      if (ex === 'human') { if (!st || OPEN.includes(st)) you.push(what + ' (you do it, we check it).'); else did.push(what + ' (' + (STATUS[st] || plain(st).replace(/_/g, ' ')) + ').'); }
      else if (ex === 'approve' && (!st || st === 'proposed')) you.push(what + ' (you approve it, we do it).');
      else did.push(what + ' (' + WHO[ex] + (st ? '; ' + (STATUS[st] || plain(st).replace(/_/g, ' ')) : '') + ').'); }
    for (const b of (Array.isArray(m.blockers) ? m.blockers : [])) { const w = plain(b && b.what); if (!w) continue;
      const W = w.charAt(0).toUpperCase() + w.slice(1); (S(b.owner) === 'us' ? did : you).push((S(b.owner) === 'us' ? 'On us: ' : '') + W.replace(/[.\s]+$/, '') + '.'); }
    if (!did.length) did.push('No new step this week.');
    if (!you.length) you.push('Nothing from you this week.');
    let wins = null, spend = null;
    for (const l0 of part('cost_per_win')) { const w = num(fig(l0, 'wins')); const sp = num(fig(l0, 'spend_usd')); if (w != null) wins = w; if (sp != null) spend = sp; }
    const sections = [{ key: 'changed', title: 'What changed', lines: changed }, { key: 'why', title: 'Why it moved', lines: why }, { key: 'worked', title: 'Did our steps work', lines: worked },
      { key: 'did', title: 'What we did', lines: did.slice(0, 10) }, { key: 'you', title: 'What we need from you', lines: you.slice(0, 10) }].filter(s => s.lines.length);
    return { v: 1, sections, wins, spend_usd: spend }; };
  return { view, plain, label, LABELS, ENGINE_LABELS, STAGE, WHO, STATUS };
})();
