// W0H1-W0H8 (page-quality programme 2026-10-29, W0-H: PLAN Fix 3b, 2.4, 2.7, 2.8; R4 G9 / G12 / G13 / G14 / G18; REVIEW_EVIDENCE H1;
// owner priority of 2026-10-29). The causes the grade now counts are removed instead of only being scored:
//   * the three prompt lines that made padding and repetition (every People Also Ask question a section, every FAQ a heading, the keyword
//     in two H2s) are gone from the built prompts, and the guide that ranks keeps its shape (a Guide may carry up to 8 question headings);
//   * a market, adoption, cost or compliance figure whose only source has no independent authority is a soft blocker: a rewrite job for
//     the editor, else the system takes the sentence out; Finalize measures it again;
//   * a blind second read (Sonnet 5.5) of the page the client receives: high fact / source / claim / local problems whose quoted words are
//     on the page block a run a person started and are only reported for a run the system started (shadow, D17); a refused, cut, failed
//     or unreadable answer is "not checked"; Finalize keeps such a blocker open while its words are on the page;
//   * and the guide that ranks (exec 949) gets none of it: no weak figure, no blocker from its own first-draft critique, not shortened.
// Tested on the anonymised replays of page run 3299, its finalize 3336 and the ranking guide 949 (harness/fixtures). No model call: the
// second read's answers here are recorded shapes of the Messages API. Called from scenarios_v5.js before the report.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W0-H ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const pf = async (fn, args) => (await run('PF Kit', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const rr = async (fn, args, kit) => (await run('RR Kit', [{ json: { kit: kit || 'RR', fn, args } }], { code: '_critic_reread' }))[0].json.r;
  const F99 = R.load('replay_3299.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const WIRE = JSON.parse(fs.readFileSync(path.join(__dirname, 'second_read_wiring.json'), 'utf8'));
  const PB99 = F99.nodes['Parse Brief']['0'].items[0].json;
  const answer = (problems, extra) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: J({ score: 70, strengths: ['clear'], problems }) }], usage: { input_tokens: 9100, output_tokens: 1400 }, ...(extra || {}) });
  const firstWords = (md, n) => { const l = String(md).split('\n').map(x => x.trim()).find(x => x.length > 80 && !/^(#|\||-|\*|>|\[|Title:|Meta|Slug:|Primary|Secondary|\*\*Quick)/.test(x)) || '';
    return l.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').split(/\s+/).slice(0, n || 9).join(' '); };

  // ---------- W0H1 the prompt lines that made padding and repetition ----------
  await guard('W0H1 prompts', async () => {
    const SN = 'W0H1 (W0-H, PLAN 2.4 / Fix 3b) the built prompts no longer turn every People Also Ask question into a section, every FAQ into a heading, or put the keyword in two H2s; each point has one home';
    reset(); begin(SN); const check = mkCheck(SN);
    const sb = WIRE.prompts['Strategy Brief'], cw = WIRE.prompts['Copywriter'];
    check('the brief no longer says "reuse the People Also Ask questions" or "each becomes its own question-style heading"', !/reuse the People Also Ask questions/.test(sb) && !/each becomes its own question-style heading/.test(sb));
    check('the copywriter no longer makes every FAQ a heading', !/Every question in the brief's "faqs" list becomes its own question-style heading/.test(cw));
    check('the copywriter no longer asks for the keyword in at least two H2s', !/at least two H2s/.test(cw) && /primary keyword in the H1, the first sentence and the final section\. An H2 may carry it/.test(cw));
    check('People Also Ask is evidence, filtered to the same reading of the search, counted per page type (a Guide up to 8, Service / Location / Pricing 3-5, a Case Study none)',
      /People Also Ask shows what readers need, it is not the outline/.test(sb) && /same reading of this search/.test(sb) && /a Guide up to 8/.test(sb) && /Service, Location or Pricing page 3-5/.test(sb) && /a Case Study none/.test(sb));
    check('one home per point, in the brief and in the copywriter (no callout, closing line or call to action repeats a point)', /Each point has one home: give every claim, definition and list one owning section/.test(sb)
      && /6b\. Each point has one home/.test(cw) && /No callout box, closing line or call to action repeats a point/.test(cw));
    check('a FAQ is a heading only when its answer is new; the main search in other words may keep its heading', /when its answer says something that section does not already say/.test(cw) && /main search in other words may keep its heading/.test(cw));
    check('no market or compliance figure on a vendor or agency blog alone', /A market, adoption, cost or compliance figure needs an official, research or major-press source/.test(cw));
    check('the shape of the guide that ranks stays possible: its 8 question H3s fit the Guide limit, and question headings are still asked for', (G.live_markdown.match(/^### .+\?\s*$/gm) || []).length <= 8
      && /question-style heading/.test(cw), (G.live_markdown.match(/^### .+\?\s*$/gm) || []).length);
    check('the Critic itself is unchanged (its quality bar is the one the second read uses)', /QUALITY BAR/.test(WIRE.prompts['Critic']) && /SOURCE QUALITY/.test(WIRE.prompts['Critic']));
  });

  // ---------- W0H2 a figure whose only source has no independent authority ----------
  const LINKS = [
    { url: 'https://www.agency.example/blog/erp-market-share', tier: 'weak' }, { url: 'https://tracker.example/tech/dynamics-365', tier: 'weak' },
    { url: 'https://mof.gov.ae/en/einvoicing', tier: 'primary' }, { url: 'https://www.gartner.com/en/erp', tier: 'research' }, { url: 'https://blog.vendor.example/erp-tips', tier: 'weak' } ];
  const S_A = 'Dynamics 365 holds a 2.1% share of the ERP market, according to [an agency blog](https://www.agency.example/blog/erp-market-share).';
  const S_B = 'Over 93,301 companies use Dynamics 365, a [tracker](https://tracker.example/tech/dynamics-365) counts.';
  const S_C = 'The UAE requires e-invoicing in phases from July 2026, as the [Ministry of Finance](https://mof.gov.ae/en/einvoicing) sets out.';
  const S_D = 'About 40% of ERP projects run late, according to [Gartner](https://www.gartner.com/en/erp) and [a vendor blog](https://blog.vendor.example/erp-tips).';
  const S_E = 'Business Central suits teams of 10 to 250 users, as [one vendor blog](https://blog.vendor.example/erp-tips) puts it.';
  const S_F = 'ISO 27001 certification is often required by banks, as [one vendor blog](https://blog.vendor.example/erp-tips) notes.';
  const S_G = 'The 2026 release wave added 1,200 new screens, as [one vendor blog](https://blog.vendor.example/erp-tips) lists.';
  const S_H = 'Nova& has served 2,000 clients since 2005, see [our story](https://www.novaand.example/about).';
  const MDW = ['Title: ERP choices', 'Meta Description: How to choose an ERP in the UAE, with the questions to ask and the rules that apply to e-invoicing.', 'Slug: erp-choices', '',
    '# ERP choices in the UAE', '', 'An ERP system runs finance and operations in one place. ' + S_A, '', '**Quick answer:** pick by size and by rules.', '',
    '## How common is Dynamics 365?', '', S_B + ' ' + S_E, '', '## What the rules say', '', S_C + ' ' + S_F, '', '## Risks', '', S_D + ' ' + S_G, '', '## Talk to us', '', S_H, ''].join('\n');
  await guard('W0H2 weak-only figures', async () => {
    const SN = 'W0H2 (W0-H, Fix 3b.2, R4 G9 / G18) a market, adoption, cost or compliance figure whose only linked source is weak is a soft blocker with a rewrite job; the system takes the sentence out if the edit does not';
    reset(); begin(SN); const check = mkCheck(SN);
    const ctx = { domain: 'novaand.example', keyword: 'erp uae', names: ['Nova&'] };
    const qa = { outbound_links: LINKS, main_content_words: 180 };
    const cls = await pf('classify', [qa, MDW, ctx]);
    const wf = cls.blocking.filter(b => b.code === 'weak_figure');
    show('weak figures found', wf.map(b => [b.figure, b.hosts]));
    check('the agency blog market share (2.1%) and the tracker company count (93,301) are soft blockers', wf.length === 2 && wf.every(b => b.tier === 'soft') && wf.some(b => b.sentence === S_A && /2\.1/.test(b.figure)) && wf.some(b => b.sentence === S_B && /93,301/.test(b.figure)), J(wf));
    check('not flagged: an official source, one strong source beside a weak one, a small count, a standard\'s number, a figure on no market / cost / rule topic, our own link', !wf.some(b => [S_C, S_D, S_E, S_F, S_G, S_H].includes(b.sentence)), J(wf.map(b => b.sentence)));
    check('the blocker text is plain words with the weak host named', wf.every(b => !PLAIN.test(b.text) && /no independent authority \((?:agency|tracker)\.example\)/.test(b.text)), J(wf.map(b => b.text)));
    const sc = await pf('score', [cls]);
    check('each one counts in the candidate rule (soft blockers)', sc.soft >= 2, J(sc));
    const job = await pf('plan', [MDW, cls, qa, ctx]);
    const probs = job.sections.flatMap(s => s.problems);
    check('the editor gets "rewrite the sentence without the number" for each, in the section where it stands', probs.filter(p => /rewrite the sentence without the number/.test(p)).length === 2
      && job.sections.some(s => s.id === 's0') && job.sections.some(s => /How common/.test(s.heading)), J(job.sections.map(s => [s.id, s.problems])));
    const N = await pf('neutralize', [MDW, cls, ctx]);
    check('if the figure is still there at the end, the system takes the sentence out and nothing else', !N.md.includes('2.1% share') && !N.md.includes('93,301') && [S_C, S_D, S_E, S_F, S_G, S_H].every(s => N.md.includes(s))
      && N.removed.filter(r => r.code === 'weak_figure').length === 2, J(N.removed));
    const res = await pf('residual', [cls, N.md]);
    check('after that, no weak figure is left open', !res.blocking.some(b => b.code === 'weak_figure'), J(res.blocking));
    const del = await pf('deliver', [cls, {}]);
    check('the client reads what to do (rewrite without the number, or cite an official body, research house or major press)', del.status === 'not_ready' && del.blocking.filter(b => b.code === 'weak_figure').every(b => /rewrite the sentence without the number/.test(b.action)), J(del.blocking));
    const old = await pf('classify', [{ main_content_words: 180 }, MDW, ctx]);
    check('a check with no tier for its links (an older report) judges nothing (advice beats a wrong block)', !old.blocking.some(b => b.code === 'weak_figure'));
    const cut = await pf('weakFigures', [MDW.replace(S_A, 'Dynamics 365 holds a 2.1% share of the ERP market, according to [an agency blog](https://www.agency.example/blog/unmeasured).'), qa, ctx]);
    check('a link whose tier this run never measured is not guessed', !cut.some(w => /2\.1/.test(w.figure)), J(cut));
  });

  // ---------- W0H3 run 3299 on the new rule ----------
  await guard('W0H3 3299 replay', async () => {
    const SN = 'W0H3 (W0-H, PLAN Fix 3b) page run 3299 on the new rule: every recorded Page Candidates round still runs, and what it now flags';
    reset(); begin(SN); const check = mkCheck(SN);
    const rounds = [];
    for (const rec of F99.runs['Page Candidates']) {
      const r = await R.replay(F99, 'Page Candidates', rec.run);
      const q = r.first.content_qa || {}; const pfx = r.first.page_fix || {};
      rounds.push({ run: rec.run, next: pfx.next, hist: (pfx.history || []).slice(-1), weak: ((q.delivery || {}).blocking || []).filter(b => b.code === 'weak_figure').length });
      check('Page Candidates #' + rec.run + ' answers one item', r.out.length === 1 && !!r.first.page_fix, J(r.out).slice(0, 200));
    }
    show('3299 rounds', rounds);
    const q0 = (await R.replay(F99, 'Content QA', 0)).first.content_qa || {};
    const md0 = (await R.replay(F99, 'Content QA', 0)).first.output;
    const ctx = await pf('ctxOf', [PB99, {}]);
    const wf = await pf('weakFigures', [md0, q0, ctx]);
    show('3299 first draft: figures whose only source is weak', wf.map(w => [w.figure, w.hosts, w.sentence.slice(0, 120)]));
    const tiers = (q0.outbound_links || []).map(x => x.tier);
    check('the first draft\'s links carry their tier (what the rule reads)', tiers.length > 0, J(q0.outbound_links));
    check('every flagged figure rests only on weak hosts and is a figure on a market, adoption, cost or rule topic', wf.every(w => w.hosts.length && /\d/.test(w.figure)), J(wf));
    check('the company count resting only on a data broker page (1,284, one of the figures the Critic called high) is flagged on the first draft', wf.some(w => /1,284/.test(w.figure) && w.hosts.some(h => /landbase/.test(h))), J(wf));
    const pc0 = (await R.replay(F99, 'Page Candidates', 0)).first;
    const jobs = ((pc0.page_fix || {}).edit_job || {}).sections || [];
    check('... and round 1\'s edit job asks for that sentence to be rewritten without the number', jobs.some(x => x.problems.some(p => /1,284/.test(p) && /rewrite the sentence without the number/.test(p))), J(jobs.map(x => [x.id, x.problems.length])));
    const pc2 = (await R.replay(F99, 'Page Candidates', 2)).first;
    const del = (pc2.content_qa || {}).delivery || {};
    show('3299 delivered blocking', (del.blocking || []).map(b => b.code));
    check('the delivered page still carries the duplicate-page blocker (W0-D / W0-B unchanged by this fix)', (del.blocking || []).some(b => b.code === 'duplicate_page'), J(del.blocking));
    check('no weak-only figure is left on the delivered page (removed by the edit or by the system)', !(del.blocking || []).some(b => b.code === 'weak_figure') && !(await pf('weakFigures', [pc2.output, pc2.content_qa || {}, ctx])).length, J(del.blocking));
  });

  // ---------- W0H4 the second read: the request ----------
  const DELIVERED = () => clone((F99.runs['Page Candidates'][2].output || [])[0].json);
  await guard('W0H4 second read request', async () => {
    const SN = 'W0H4 (W0-H, Fix 3b.3, PLAN 2.7) the second read is blind, uses the Critic\'s own quality bar, sends what Sonnet 5.5 accepts, and runs in shadow mode for runs the system started';
    reset(); begin(SN); const check = mkCheck(SN);
    const it = DELIVERED();
    const P = await rr('plan', [it, { ...PB99, client_ip: 'app:company-1' }, { regulatory_digest: 'UAE e-invoicing: phase 1 from 1 July 2026 (Ministry of Finance).' }]);
    check('a delivered page is read (not skipped), in enforce mode for a run a person started', P.skip === false && P.mode === 'enforce' && P.model === 'claude-sonnet-5-5', J({ skip: P.skip, mode: P.mode, reason: P.reason }));
    const body = JSON.parse(P.body); const prompt = body.messages[0].content;
    check('Sonnet 5.5 request: adaptive thinking, medium effort, JSON schema through output_config, no temperature, no forced tool, max_tokens 16000 (non-streaming limit)',
      body.model === 'claude-sonnet-5-5' && body.thinking.type === 'adaptive' && body.output_config.effort === 'medium' && body.output_config.format.type === 'json_schema'
      && !('temperature' in body) && !('tool_choice' in body) && !('tools' in body) && body.max_tokens === 16000, J(Object.keys(body)));
    check('the answer schema asks for severity, kind, the exact words and the fix', J(body.output_config.format.schema).includes('"kind"') && body.output_config.format.schema.properties.problems.items.required.join(',') === 'severity,kind,location,issue,fix');
    check('it reads the page the client receives, the keyword, the website\'s own live pages, the facts on file, the verified sources and the regulatory digest',
      prompt.includes(it.output.slice(0, 200)) && prompt.includes(PB99.keyword) && /novaand\.example/.test(prompt) && /THE BUSINESS'S OWN LIVE PAGES/.test(prompt) && /phase 1 from 1 July 2026/.test(prompt), prompt.slice(0, 600));
    check('it shares the Critic\'s quality bar and source list (one source, inlined by the build)', /QUALITY BAR/.test(prompt) && /SOURCE QUALITY/.test(prompt) && prompt.includes(WIRE.prompts['Critic'].slice(WIRE.prompts['Critic'].indexOf('QUALITY BAR'), WIRE.prompts['Critic'].indexOf('QUALITY BAR') + 300)));
    const crit = (() => { try { return (F99.nodes['Parse Critique'] && F99.nodes['Parse Critique']['0'].items[0].json.critique) || null; } catch (e) { return null; } })();
    const q = it.content_qa || {};
    check('blind: no earlier review, no edit history, no score of ours', !/first_draft_review|Editor review:|page_fix|content_score|"history"/.test(prompt)
      && !(crit && (crit.problems || []).some(p => p && p.issue && prompt.includes(String(p.issue).slice(0, 60))))
      && !(q.content_score != null && new RegExp('content score[^\\n]{0,20}' + q.content_score).test(prompt)), crit ? 'critique present in fixture' : 'no critique in fixture');
    check('no n8n expression is left in the prompt and no template slot is unfilled', !/\{\{[A-Z_]+\}\}/.test(prompt) && !/\$json|\$\('/.test(prompt), (prompt.match(/\{\{[A-Z_]+\}\}/g) || []).join(','));
    for (const ip of ['ladder:lad_mvjsa7995bsr', 'cadence:novaand.example:2026-11-02', 'tracker:x', 'casestudy:y']) {
      const p = await rr('plan', [it, { ...PB99, client_ip: ip }, {}]);
      check('a run the system started (' + ip.split(':')[0] + ') is read in SHADOW mode (D17)', p.skip === false && p.mode === 'shadow', J(p.mode));
    }
    const skips = [[{ ...it, output: '' }, 'no page'], [{ ...it, content_qa: { ...q, delivery: null } }, 'delivered status'], [{ ...it, content_qa: { ...q, cut_off: true } }, 'stops before its end']];
    for (const [x, why] of skips) { const p = await rr('plan', [x, { ...PB99, client_ip: 'app:1' }, {}]); check('skipped with a reason: ' + why, p.skip === true && p.reason.includes(why === 'no page' ? 'no page' : why), J(p)); }
    const off = await rr('plan', [it, { ...PB99, critic_reread: false }, {}]);
    check('a run can switch it off', off.skip === true && /switched off/.test(off.reason));
  });

  // ---------- W0H5 the second read: the answer ----------
  await guard('W0H5 second read answer', async () => {
    const SN = 'W0H5 (W0-H, Fix 3b.3 acceptance) a recorded answer with one unresolved high problem yields a soft blocker; a refused or unreadable answer yields "not checked"; a quote that is not on the page is never shown';
    reset(); begin(SN); const check = mkCheck(SN);
    const it = DELIVERED(); const md = it.output; const q = it.content_qa || {};
    const quote = firstWords(md, 10);
    check('a sentence of the delivered page to quote', quote.split(' ').length >= 8, quote);
    // W05-A (wave 0.5, 2026-10-30): only a factual error the page states blocks (here: an unsupported claim about the business); a figure
    // resting on an agency blog is advice that costs its part of the grade (scenarios_w05a.js)
    const HIGH = { severity: 'high', kind: 'claim', location: quote, issue: 'Nothing on file says the business does this.', fix: 'Say it as advice to the reader.' };
    const SRCADV = { severity: 'high', kind: 'source', location: quote, issue: 'This market figure rests only on an agency blog.', fix: 'Remove the figure or cite an official source.' };
    const DEPTH = { severity: 'high', kind: 'depth', location: quote, issue: 'The answer is generic for a regulated bank.', fix: 'Add a short scenario for a bank.' };
    const GONE = { severity: 'high', kind: 'fact', location: 'this sentence is not on the page at all, anywhere in it', issue: 'Wrong.', fix: 'Fix it.' };
    const P = { skip: false, mode: 'enforce', model: 'claude-sonnet-5-5' };
    const r1 = await rr('read', [answer([HIGH, SRCADV, DEPTH, GONE]), md, P, '__PF__']);
    show('read (enforce)', { status: r1.status, gates: r1.gates.length, advice: r1.advice.length, not_shown: r1.not_shown, usage: r1.usage });
    check('checked: the high claim quoted on the page gates (an unsupported claim about the business), the high source and depth problems are advice (W05-A), the quote that is not on the page is not shown',
      r1.status === 'checked' && r1.gates.length === 1 && r1.gates[0].kind === 'claim' && r1.gates[0].error === 'claim' && r1.advice.length === 2 && r1.advice.map(a => a.kind).join() === 'source,depth' && r1.not_shown === 1, J(r1));
    check('the usage Anthropic reported is kept (the cost is measured)', r1.usage && r1.usage.input_tokens === 9100 && r1.usage.output_tokens === 1400);
    const before = q.delivery || {};
    const qa1 = await rr('apply', [q, r1, '__PF__']);
    const d1 = qa1.delivery || {};
    show('delivery after the read (enforce)', { before: before.status, after: d1.status, blocking: (d1.blocking || []).map(b => b.code), label: d1.label });
    check('enforce: one soft blocker "review", the page is not ready, publishable false, the reasons and next step say what to do', (d1.blocking || []).filter(b => b.code === 'review').length === 1
      && d1.status === 'not_ready' && qa1.publishable === false && qa1.not_ready === true && (qa1.not_ready_reasons || []).some(t => /second read/.test(t)) && /Finish this draft by hand/.test(d1.next_step || ''), J(d1));
    check('the review blocker quotes the words and says how to fix them, in plain words', (d1.blocking || []).filter(b => b.code === 'review').every(b => b.text.includes(quote.slice(0, 30)) && /correct or remove/.test(b.action) && !PLAIN.test(b.text + b.action)), J(d1.blocking));
    check('every blocker of the page run is kept with its own action', (before.blocking || []).every(b => (d1.blocking || []).some(x => x.code === b.code && x.text === b.text && x.action === b.action)), J({ before: before.blocking, after: d1.blocking }));
    check('the grade is the one Page Candidates gave (only its count of blocking items moves)', (d1.grade || {}).score === (before.grade || {}).score && (d1.grade || {}).blocking === (d1.blocking || []).length, J({ b: before.grade, a: d1.grade }));
    check('the advice of the read is shown (the depth problem, and the agency-blog figure as something to fix before publishing)', (d1.advisory || []).some(a => a.code === 'second_read' && /generic for a regulated bank/.test(a.text))
      && (d1.advisory || []).some(a => a.code === 'second_read' && /^A second read of the page found something to fix before publishing at/.test(a.text) && /agency blog/.test(a.text)));
    check('the record of the read travels with the check (qa.critic_reread)', qa1.critic_reread && qa1.critic_reread.status === 'checked' && qa1.critic_reread.gates.length === 1 && qa1.critic_reread.mode === 'enforce');
    // shadow mode
    const r2 = await rr('read', [answer([HIGH, DEPTH]), md, { ...P, mode: 'shadow' }, '__PF__']);
    const qa2 = await rr('apply', [q, r2, '__PF__']);
    check('shadow (a run the system started): nothing gates, what would have blocked is reported, the status is the one delivered',
      r2.gates.length === 0 && r2.would_block.length === 1 && (qa2.delivery || {}).status === before.status && (qa2.delivery.blocking || []).length === (before.blocking || []).length
      && (qa2.delivery.advisory || []).some(a => /reported only while this check is new/.test(a.text)) && qa2.critic_reread.would_block.length === 1, J(qa2.delivery));
    // not checked
    const NC = [[answer([], { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms' }, content: [] }), /declined/],
      [answer([HIGH], { stop_reason: 'max_tokens' }), /cut off/],
      [{ error: { message: 'overloaded', type: 'overloaded_error' } }, /could not be run/],
      [{ ...answer([]), content: [{ type: 'text', text: 'Here is my review: the page is fine.' }] }, /could not read/],
      [{ ...answer([]), content: [] }, /no answer/]];
    for (const [resp, why] of NC) {
      const r3 = await rr('read', [resp, md, P, '__PF__']);
      const qa3 = await rr('apply', [q, r3, '__PF__']);
      check('"not checked" (' + String(why).slice(1, -1) + '), never a pass and never a block', r3.status === 'not_checked' && why.test(r3.reason) && r3.gates.length === 0
        && (qa3.delivery || {}).status === before.status && (qa3.delivery.advisory || []).some(a => /^Not checked by a second read/.test(a.text)), J({ r3, st: (qa3.delivery || {}).status }));
    }
    const sk = await rr('read', [{}, md, { skip: true, reason: 'no page was written', mode: 'enforce' }, '__PF__']);
    check('a skipped read is "not checked" with its reason and no usage', sk.status === 'not_checked' && sk.reason === 'no page was written' && sk.usage === null);
    // the blocker lives on the page's words
    const cls = await rr('reviewed', [{ blocking: [], advisory: [] }, r1], 'PF');
    const still = await pf('residual', [cls, md]);
    const gone = await pf('residual', [cls, md.split(quote.split(' ').slice(0, 6).join(' ')).join('')]);
    check('PF.reviewed adds it as a soft "review" blocker; it stays while its words are on the page and goes when they are gone', cls.blocking.length === 1 && cls.blocking[0].tier === 'soft' && still.blocking.length === 1 && gone.blocking.length === 0, J({ cls, still: still.blocking, gone: gone.blocking }));
  });

  // ---------- W0H6 the nodes and the wiring ----------
  await guard('W0H6 nodes and wiring', async () => {
    const SN = 'W0H6 (W0-H, build section 158) Second Read Plan -> Second Read? -> Second Read (HTTP) -> Apply Second Read -> Build Word File, after the delivered page; measured cost; the callback carries the read';
    reset(); begin(SN); const check = mkCheck(SN);
    const C = WIRE.connections;
    check('Finalize Page?: finalize goes back to Page Fix, deliver goes to the second read', J(C['Finalize Page?']) === J([['Page Fix'], ['Second Read Plan']]), J(C['Finalize Page?']));
    check('Second Read? true -> Second Read, false -> Apply Second Read; the answer -> Apply Second Read -> Build Word File',
      J(C['Second Read?']) === J([['Second Read'], ['Apply Second Read']]) && J(C['Second Read']) === J([['Apply Second Read']]) && J(C['Apply Second Read']) === J([['Build Word File']]), J(C));
    const hp = WIRE.http_params;
    check('the call: POST to the Messages API with the Anthropic credential, the body the plan built, a 5-minute timeout', hp.method === 'POST' && hp.url === 'https://api.anthropic.com/v1/messages' && hp.nodeCredentialType === 'anthropicApi'
      && hp.jsonBody === '={{ $json.second_read.body }}' && hp.options.timeout === 300000 && (hp.headerParameters.parameters || []).some(p => p.name === 'anthropic-version'), J(hp));
    check('a failed call never fails the run (continue, always output, the retry rule)', WIRE.http.onError === 'continueRegularOutput' && WIRE.http.alwaysOutputData === true && WIRE.http.retryOnFail === true && WIRE.http.credentials.anthropicApi.id === 'SEOcredAnthropic', J(WIRE.http));
    check('the cost is measured in the report and the ledger settle; the ledger counts it as an AI step; the callback carries qa_second_read',
      ['Build Word File', 'Run Ledger Settle'].every(n => WIRE.cost_in.includes(n)) && WIRE.ai_nodes_word === true && WIRE.callback === true, J({ cost: WIRE.cost_in, ai: WIRE.ai_nodes_word, cb: WIRE.callback }));
    // the two Code nodes, end to end on the delivered 3299 page
    const it = DELIVERED();
    mock('Parse Brief', [{ json: { ...PB99, client_ip: '' } }]);
    mock('Normalize Input', [{ json: { client_ip: 'app:company-1' } }]);
    delete store['Collect Regulatory Facts'];
    const planned = await run('Second Read Plan', [{ json: it }]);
    const pj = planned[0].json;
    check('Second Read Plan passes the delivered item through with its request (enforce: the app started this run)', pj.output === it.output && pj.second_read && pj.second_read.skip === false && pj.second_read.mode === 'enforce' && typeof pj.second_read.body === 'string', J(pj.second_read).slice(0, 300));
    mock('Second Read Plan', planned);
    const quote = firstWords(it.output, 10);
    const applied = (await run('Apply Second Read', [{ json: answer([{ severity: 'high', kind: 'claim', location: quote, issue: 'Nothing on file says the business does this.', fix: 'Say it as advice to the reader.' }]) }]))[0].json;
    check('Apply Second Read: the same item, content_qa updated (a review blocker), the request body dropped', applied.output === it.output && !('second_read' in applied)
      && ((applied.content_qa || {}).delivery || {}).blocking.some(b => b.code === 'review') && applied.content_qa.critic_reread.status === 'checked', J(Object.keys(applied)));
    mock('Second Read Plan', [{ json: { ...pj, second_read: { skip: true, reason: 'no page was written', mode: 'enforce' } } }]);
    const sk = (await run('Apply Second Read', [{ json: { ...pj } }]))[0].json;
    check('the "no" branch of Second Read? (its input is the plan item itself) is "not checked" with its reason, and the delivered status unchanged', sk.content_qa.critic_reread.status === 'not_checked' && sk.content_qa.critic_reread.reason === 'no page was written' && sk.content_qa.delivery.status === (it.content_qa.delivery || {}).status, J(sk.content_qa.critic_reread));
  });

  // ---------- W0H7 the final version keeps a second-read blocker while its words are there ----------
  await guard('W0H7 finalize', async () => {
    const SN = 'W0H7 (W0-H with W0-B\'s carried blockers) a "review" blocker of the page run stays open in the final version while its quoted words are on the page, and is resolved once they are gone; a weak figure is measured again';
    reset(); begin(SN); const check = mkCheck(SN);
    const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
    const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
    const EDITOR = F36.nodes['Finalize Editor']['0'].items;
    const gating = (qab) => ({ qa_blocking: qab, duplicate_targets: [], verdict: CB.verdict == null ? null : CB.verdict, score: CB.score == null ? null : CB.score, score_withheld: false,
      page_type: ((CB.meta || {}).page_type) || '', verdict_acknowledged: false, copied_passages: [], content_request_id: CB.request_id || '', length_points: null });
    const chain = async (body) => {
      reset(); delete store['Finalize Editor'];
      const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
      mock('Finalize Plan', pb);
      const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
      if (ap[0].json.needs_editor) mock('Finalize Editor', clone(EDITOR));
      const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
      const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
      const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
      return (await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' }))[0].json.body;
    };
    const base = await chain({ ...clone(BODY), page_run: gating([]) });
    const quote = firstWords(base.markdown, 10);
    check('a sentence of the final version to quote', quote.split(' ').length >= 8, quote);
    const REV = (q) => ({ code: 'review', text: 'A second read of the page found a problem at "' + q + '": this market figure rests only on an agency blog', action: 'correct or remove the words the second read quoted, or check them against a source you trust' });
    const kept = await chain({ ...clone(BODY), page_run: gating([REV(quote)]) });
    show('final version with a review blocker on the page', { status: kept.delivery_status, kept_open: kept.page_run.kept_open, resolved: kept.page_run.resolved });
    check('kept open while its words are on the page: not ready, the blocker shown', kept.page_run.kept_open.includes('review') && kept.delivery_status === 'not_ready' && kept.delivery.blocking.some(b => b.code === 'review'), J(kept.page_run));
    const gone = await chain({ ...clone(BODY), page_run: gating([REV('words that the final version does not carry anywhere at all')]) });
    check('resolved once its words are gone', gone.page_run.resolved.includes('review') && !gone.page_run.kept_open.includes('review'), J(gone.page_run));
    const wf = await chain({ ...clone(BODY), page_run: gating([{ code: 'weak_figure', text: 'A figure whose only source has no independent authority (x.example): "a figure"', action: '' }]) });
    check('a weak figure of the page run is measured again by the final check (not carried blindly)', wf.page_run.resolved.includes('weak_figure:rechecked') && !wf.page_run.kept_open.includes('weak_figure'), J(wf.page_run));
    check('the final version without these blockers is judged as before (same status as with none)', gone.delivery_status === base.delivery_status && wf.delivery_status === base.delivery_status, J([base.delivery_status, gone.delivery_status, wf.delivery_status]));
  });

  // ---------- W0H8 the guide that ranks ----------
  await guard('W0H8 ranking guide 949', async () => {
    const SN = 'W0H8 (W0-H, owner priority 2026-10-29) the published guide that ranks (exec 949): no weak figure, no blocker from the second read (shadow as a ladder page; its own first-draft review read as if a person had started it), not shortened, grade not below 3299';
    reset(); begin(SN); const check = mkCheck(SN);
    // the guide through today's Content QA, in the 3299 run's context with the guide's own fields (as RPL4)
    const pb = clone(PB99);
    Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
      ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [], client_ip: 'ladder:' + G.brief.ladder_id,
      length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
    pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
    const rec = F99.runs['Content QA'][2];
    // W0-C (2026-10-29): with Promise Candidates mocked out (below) Content QA reads the guide itself, not 3299's draft; the live capture ends
    // with the site's author box and tag line, which the cut-off check reads as a page that stops mid-way (W0B9's note), so the guide is
    // judged ending on its last complete line, as it was delivered
    const gl = G.live_markdown.replace(/\s+$/, '').split('\n'); let gLast = gl.length - 1; while (gLast > 0 && !/[.!?]["')\]*_]*$|\]\([^()\s]*\)$/.test(gl[gLast].trim())) gLast--;
    const GMD = gl.slice(0, gLast + 1).join('\n') + '\n';
    const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: GMD, qa_round: 1 };
    const pfi = clone(F99.nodes['Page Fix']['2'].items); pfi[0].json.output = GMD;
    const g = await R.replay(F99, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pfi, 'Promise Candidates': null }, runIndex: 0 });   // W0-C: Content QA reads its draft through Promise Candidates when that node ran; null makes it read the guide
    const s = await R.replay(F99, 'Content QA', 2);
    const qg = g.first.content_qa || {}; const qs = s.first.content_qa || {};
    const md = GMD;
    const ctx = await pf('ctxOf', [pb, {}]);
    const wf = await pf('weakFigures', [md, qg, ctx]);
    show('949 outbound links by tier', (qg.outbound_links || []).reduce((m, x) => ({ ...m, [x.tier]: (m[x.tier] || 0) + 1 }), {}));
    check('the guide\'s links carry their tier (the rule had something to read)', (qg.outbound_links || []).length > 0, J(qg.outbound_links));
    check('no figure of the guide rests only on a weak source', wf.length === 0, J(wf));
    const cls = await pf('classify', [qg, md, ctx]);
    check('no weak_figure and no review blocker on the guide', !cls.blocking.some(b => b.code === 'weak_figure' || b.code === 'review'), J(cls.blocking.map(b => b.code)));
    const N = await pf('neutralize', [md, { ...cls, blocking: cls.blocking.filter(b => b.code === 'weak_figure') }, ctx]);
    check('nothing is taken out of the guide by this fix (not shortened)', N.md.split(/\s+/).length >= md.split(/\s+/).length - 5 && !N.removed.some(r => r.code === 'weak_figure'), J(N.removed));
    check('its grade is not below the 3299 service page (the same check, the same context)', typeof qg.content_score === 'number' && qg.content_score >= qs.content_score, 'guide ' + qg.content_score + ' vs 3299 ' + qs.content_score);
    // the second read of the guide
    const item = { output: md, content_qa: { ...qg, delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], client_questions: [], grade: { score: qg.content_score, of: 100, blocking: 0 }, next_step: '' } } };
    const plan = await rr('plan', [item, pb, {}]);
    check('as a ladder page (a run the system started), the guide is read in shadow mode', plan.skip === false && plan.mode === 'shadow', J({ skip: plan.skip, mode: plan.mode, reason: plan.reason }));
    // M4 (WAVE0_REVIEW 2026-10-30): the same guide started from the app's ladder "Write now" (client_ip app:..., the ladder fields attached)
    // is read in shadow mode too, until the owner has reviewed the first 20 second reads; a page that is not a ladder page stays enforced
    const planApp = await rr('plan', [item, { ...pb, client_ip: 'app:company-1' }, {}]);
    check('M4: started by a person from the app\'s ladder "Write now", the guide is still read in shadow mode', planApp.skip === false && planApp.mode === 'shadow', J({ mode: planApp.mode }));
    const planKw = await rr('plan', [item, { ...pb, client_ip: 'app:company-1', ladder_id: '', ladder_rung: null }, {}]);
    check('M4: the same page outside a ladder, started by a person, is enforced as before', planKw.skip === false && planKw.mode === 'enforce', J({ mode: planKw.mode }));
    // its own first-draft review, as if a person had started the run and the second read had said exactly that
    const KIND = (p) => /placeholder|bracket/i.test(p.issue) ? 'claim' : /figure|weak|source|blog|unsourced/i.test(p.issue + ' ' + p.location) ? 'source' : /objection|generic|no concrete|vague/i.test(p.issue) ? 'depth' : 'other';
    const probs = G.critique.problems.map(p => ({ severity: p.severity, kind: KIND(p), location: p.location, issue: p.issue, fix: p.fix }));
    const rEn = await rr('read', [answer(probs), md, { skip: false, mode: 'enforce', model: 'claude-sonnet-5-5' }, '__PF__']);
    show('949 first-draft review re-read on the live page', { gates: rEn.gates.length, advice: rEn.advice.map(a => [a.severity, a.kind]), not_shown: rEn.not_shown });
    check('read in enforce mode, none of its first-draft problems blocks the live guide (the high trust ones are no longer on the page; the high one still there is depth: advice)', rEn.status === 'checked' && rEn.gates.length === 0, J(rEn.gates));
    const qe = await rr('apply', [item.content_qa, rEn, '__PF__']);
    check('the guide stays Ready, with no blocker; the depth problem still on the page is shown as advice', (qe.delivery || {}).status === 'ready' && !(qe.delivery.blocking || []).length && (qe.delivery.advisory || []).some(a => a.code === 'second_read'), J(qe.delivery));
    const rSh = await rr('read', [answer(probs.map(p => ({ ...p, severity: 'high', kind: 'source' }))), md, { skip: false, mode: 'shadow', model: 'claude-sonnet-5-5' }, '__PF__']);
    const qsd = await rr('apply', [item.content_qa, rSh, '__PF__']);
    check('even a second read that called every problem a high source problem cannot hold the guide back as a ladder page (shadow: reported, not counted)', (qsd.delivery || {}).status === 'ready' && rSh.gates.length === 0, J({ st: qsd.delivery.status, would: rSh.would_block.length }));
  });
};
