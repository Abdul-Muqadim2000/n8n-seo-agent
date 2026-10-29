// W0F1-W0F9 (page-quality programme 2026-10-29, PLAN §3 Fix 6, build section 154): local regulatory facts are researched, dated and
// never stale. Run 3299 ("ms 365 erp", a UAE ERP partner) never learned the UAE e-invoicing timeline; the 30 October 2026 provider
// deadline is itself an amendment of 31 July 2026 (Ministerial Decision No. 66 of 2026), and from 31 October a page must say it passed.
// Fixtures: replay_3299.json.gz (the run's own Analyze Competitor Pages item, anonymised), regulatory_pages.json (short public official
// passages as the reader returns them; synthetic secondary pages), ranking_guide_949.json (the guide that ranks: the owner's guard).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CODE_DIR = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const { REG, REGULATORS } = require(path.join(CODE_DIR, '_regulatory_kit.js'));
  const PAGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'regulatory_pages.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  let F3299 = null; const f3299 = () => F3299 || (F3299 = R.load('replay_3299.json.gz'));
  const acp3299 = () => clone(f3299().nodes['Analyze Competitor Pages']['0'].items[0].json);
  const searx = (results) => ({ results: results.map(([url, title, content]) => ({ url, title: title || '', content: content || '' })) });
  // the whole free path on one input: plan -> (SearXNG answers per task) -> candidates -> (reader answers per candidate) -> collect
  const chain = async (acp, answerFor, readFor) => {
    for (const k of ['Regulatory Plan', 'Regulatory Candidates', 'Regulatory SERP Candidates', 'Read Regulatory Pages', 'Collect Regulatory Facts']) delete store[k];
    mock('Analyze Competitor Pages', [{ json: acp }]);
    const plan = (await run('Regulatory Plan', [{ json: acp }])).map(i => i.json);
    if (plan[0] && plan[0].skip) { const c = (await run('Collect Regulatory Facts', [{ json: plan[0] }]))[0].json; return { plan, cands: [], c }; }
    const cands = (await run('Regulatory Candidates', plan.map(t => ({ json: answerFor(t) })))).map(i => i.json);
    const reads = cands.filter(x => x.read);
    if (!reads.length) { const c = (await run('Collect Regulatory Facts', [{ json: cands[0] }]))[0].json; return { plan, cands, c }; }
    mock('Read Regulatory Pages', reads.map(x => ({ json: readFor(x) })));
    const c = (await run('Collect Regulatory Facts', reads.map(x => ({ json: x }))))[0].json;
    return { plan, cands, c };
  };
  const readOf = (byUrl) => (x) => { const p = Object.values(PAGES).find(v => v && v.url === x.url); return byUrl[x.url] || (p ? { page_text: p.page_text } : { error: { message: 'not in the fixture' } }); };

  // ---------- W0F1 the kit: dates, markets, topics ----------
  await guard('W0F1 kit', async () => {
    const SN = 'W0F1 (2026-10-29, Fix 6) the regulatory kit reads dates in every common form, knows its markets and finds the topics a page touches';
    reset(); begin(SN); const check = mkCheck(SN);
    const d = REG.dates('appoint by 30 October 2026; go live on January 1st, 2027; from 2026-07-31; phase 2 in July 2027; not a date: 31 February 2027');
    check('four dates read, an impossible one refused', J(d.map(x => x.iso)) === J(['2026-10-30', '2027-01-01', '2026-07-31', '2027-07']), J(d));
    check('a date written back as a date', REG.fmt('2026-10-30') === '30 October 2026' && REG.fmt('2027-07') === 'July 2027');
    check('the market of a run with no map is null (US)', REG.marketOf(REGULATORS, 'US') === null && !!REG.marketOf(REGULATORS, 'ae'));
    const ae = REG.marketOf(REGULATORS, 'AE');
    const t = REG.topicsOf(ae, { keyword: 'ms 365 erp', business_facts: 'Content topics: UAE e-invoicing (Peppol), VAT compliance.', own_titles: [], terms: '' });
    check('"ms 365 erp" for a business whose facts name e-invoicing: e-invoicing is a context topic', t.some(x => x.id === 'e-invoicing' && x.relevance === 'context'), J(t));
    const core = REG.topicsOf(ae, { keyword: 'e-invoicing deadline uae', business_facts: '' });
    check('a keyword that names e-invoicing makes it core', core.length === 1 && core[0].id === 'e-invoicing' && core[0].relevance === 'core', J(core));
    check('"vat" is a whole word: "elevator" is not VAT', !REG.topicsOf(ae, { keyword: 'elevator maintenance dubai' }).length);
    check('at most two topics', REG.topicsOf(ae, { keyword: 'vat corporate tax e-invoicing payroll aml' }).length === 2);
    check('the status is computed in the market\'s time zone (21:00 UTC on 30 October is 31 October in the UAE)', REG.asOfFor('2026-10-30T21:00:00Z', 4) === '2026-10-31' && REG.asOfFor('2026-10-30T19:00:00Z', 4) === '2026-10-30');
    check('a deadline the day after is upcoming, the day it passed is passed, a go-live that passed is in force',
      REG.statusOf({ date: '2026-10-30', verb: 'appoint' }, '2026-10-29') === 'upcoming' && REG.statusOf({ date: '2026-10-30', verb: 'appoint' }, '2026-10-31') === 'passed'
      && REG.statusOf({ date: '2027-01-01', verb: 'implement' }, '2027-01-02') === 'in_force' && REG.statusOf({ date: '2026-10-30', verb: 'appoint' }, '2026-10-30') === 'upcoming');
  });

  // ---------- W0F2 the plan on run 3299 ----------
  await guard('W0F2 plan 3299', async () => {
    const SN = 'W0F2 (Fix 6 acceptance) "ms 365 erp", AE, business facts naming e-invoicing: the plan searches the Ministry of Finance\'s site and the amendments';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = acp3299();
    const plan = (await run('Regulatory Plan', [{ json: acp }])).map(i => i.json);
    const qs = plan.map(t => t.query || '');
    check('not skipped', plan.length > 1 && !plan[0].skip, J(plan[0]).slice(0, 300));
    check('a site:mof.gov.ae e-invoicing deadline query', plan.some(t => t.topic === 'e-invoicing' && t.kind === 'deadline' && /site:mof\.gov\.ae/.test(t.query) && /eInvoicing/.test(t.query) && /deadline OR timeline/.test(t.query)), J(qs));
    check('an amendment query on the official sites', plan.some(t => t.topic === 'e-invoicing' && t.kind === 'amendment' && /site:mof\.gov\.ae/.test(t.query) && /amended OR extended OR postponed/.test(t.query)), J(qs));
    check('every search goes to the stack\'s own SearXNG (free)', plan.every(t => /^http:\/\/searxng:8080\/search\?format=json/.test(t.url)));
    const P = plan[0].regulatory_plan;
    check('as of the run\'s day in the UAE (started 2026-10-28)', P.as_of === '2026-10-28', P.as_of);
    check('the official decision on file is read again (Decision No. 66 of 2026)', P.known_reads.some(k => /Ministerial-Resolution-No\.-66-of-2026/.test(k.url)), J(P.known_reads));
    check('at most two of the client\'s own posts, on the topic, for consistency', P.own_posts.length >= 1 && P.own_posts.length <= 2 && P.own_posts.every(o => /e-invoic|vat/i.test(o.url)), J(P.own_posts));
    check('e-invoicing is context for this keyword (never "core": the page is not about it)', P.topics.every(t => t.relevance === 'context'), J(P.topics));
    const us = (await run('Regulatory Plan', [{ json: { ...acp, country: 'United States', country_iso: 'US' } }]))[0].json;
    check('a market with no map is not researched', us.skip === true && /no regulatory map/.test(us.reason), J(us));
    const none = (await run('Regulatory Plan', [{ json: { ...acp, keyword: 'office furniture dubai', business_facts: 'We sell office chairs.', business: 'Office furniture', site_urls: [], site_model: {}, term_digest: '' } }]))[0].json;
    check('an AE page that touches no regulated topic is not researched', none.skip === true && /touches none/.test(none.reason), J(none));
  });

  // ---------- W0F3 the amendment wins, the status follows the day ----------
  await guard('W0F3 amendment', async () => {
    const SN = 'W0F3 (Fix 6 acceptance, REVIEW_EVIDENCE H5) an original decision (31 July) and its amendment (30 October): the 30 October date, with what it supersedes; a passed date is passed';
    reset(); begin(SN); const check = mkCheck(SN);
    // the kit alone, live official reads only (no copy on file): Decision 244 (2025/09) says 31 July, the news of 10 May 2026 moves it to 30 October
    const ex = (p, sd) => REG.extract(p.page_text, { topic: 'e-invoicing', url: p.url, role: 'official', tier: 1, source_date: sd || REG.sourceDate(p.url, p.page_text), triggers: REGULATORS.markets.AE.topics['e-invoicing'].triggers });
    const f244 = ex(PAGES.md244), fNews = ex(PAGES.mof_news);
    check('Decision 244 read from a PDF with its line breaks: six dated obligations, phase 1 appoint 31 July 2026', f244.filter(f => f.verb !== 'start').length === 6
      && f244.some(f => f.verb === 'appoint' && f.subject_class === 'ge:50000000' && f.date === '2026-07-31'), J(f244.map(f => [f.verb, f.subject_class, f.date, f.obligation])));
    check('the obligation is the verb phrase ("appoint an Accredited Service Provider", "implement the Electronic Invoicing System")',
      f244.some(f => f.obligation === 'appoint an Accredited Service Provider') && f244.some(f => f.obligation === 'implement the Electronic Invoicing System'), J(f244.map(f => f.obligation)));
    check('the news: 30 October 2026 supersedes 31 July 2026, and the old date is not a fact of its own', fNews.some(f => f.date === '2026-10-30' && f.supersedes === '2026-07-31' && f.subject_class === 'ge:50000000' && f.verb === 'appoint')
      && !fNews.some(f => f.date === '2026-07-31'), J(fNews));
    check('the source dates: a dated upload path, the reader\'s Published Time, a dated file name', REG.sourceDate(PAGES.md244.url, '') === '2025-09'
      && REG.sourceDate(PAGES.mof_news.url, PAGES.mof_news.page_text) === '2026-05-10' && REG.sourceDate(PAGES.md66.url, '') === '2026-05-14');
    const r = REG.resolve(f244.concat(fNews), { asOf: '2026-10-29' });
    const p1 = r.chosen.find(f => f.verb === 'appoint' && f.subject_class === 'ge:50000000');
    check('resolved: phase 1 appoint is 30 October 2026, supersedes 31 July 2026, upcoming on 29 October', p1 && p1.date === '2026-10-30' && p1.supersedes === '2026-07-31' && p1.status === 'upcoming', J(p1));
    check('phase 2 and government dates kept from Decision 244 (nothing amended them)', r.chosen.some(f => f.subject_class === 'lt:50000000' && f.verb === 'appoint' && f.date === '2027-03-31')
      && r.chosen.some(f => f.subject_class === 'gov' && f.verb === 'implement' && f.date === '2027-10-01'), J(r.chosen.map(f => [f.verb, f.subject_class, f.date])));
    const later = REG.resolve(f244.concat(fNews), { asOf: '2026-10-31' }).chosen.find(f => f.verb === 'appoint' && f.subject_class === 'ge:50000000');
    check('on 31 October the same fact is passed (never written as upcoming)', later && later.status === 'passed', J(later));
    // the node, end to end, after the copy on file has gone stale (fresh_until 2027-01-31): only what is read live counts
    const acp = { ...acp3299(), keyword: 'e-invoicing deadline uae', started_at: '2027-02-15T08:00:00Z' };
    const ans = (t) => t.kind === 'amendment' ? searx([[PAGES.mof_news.url, 'Ministry of Finance announces targeted amendments to eInvoicing system decisions', 'extend the deadline ... from 31 July 2026 to 30 October 2026']])
      : t.kind === 'deadline' ? searx([[PAGES.md244.url, 'Ministerial Decision No. 244 of 2025', '']]) : searx([]);
    const { c } = await chain(acp, ans, readOf({}));
    const reg = c.regulatory || {};
    const P1 = (c.regulatory_facts || []).find(f => f.verb === 'appoint' && f.subject_class === 'ge:50000000');
    check('node: the copy on file is stale, so the live read decides; phase 1 appoint 30 October 2026 superseding 31 July 2026, passed on 15 February 2027',
      P1 && P1.date === '2026-10-30' && P1.supersedes === '2026-07-31' && P1.status === 'passed' && P1.as_of === '2027-02-15' && P1.source_tier === 1, J(P1));
    check('node: the go-live of 1 January 2027 is in force, 31 March 2027 is upcoming', (c.regulatory_facts || []).some(f => f.date === '2027-01-01' && f.status === 'in_force')
      && (c.regulatory_facts || []).some(f => f.date === '2027-03-31' && f.status === 'upcoming'), J((c.regulatory_facts || []).map(f => [f.date, f.status])));
    check('node: no fact states 31 July 2026 as its date', !(c.regulatory_facts || []).some(f => f.date === '2026-07-31'));
    check('node: every fact has the PRC shape', (c.regulatory_facts || []).every(f => ['date', 'obligation', 'subject', 'threshold', 'url', 'paragraph', 'source_tier', 'source_date', 'as_of', 'supersedes', 'status'].every(k => k in f)), J((c.regulatory_facts || [])[0]));
    check('node: the block says the earlier date must never be written as current, and the passed one in the past tense',
      /This replaces the earlier date 31 July 2026: never write the earlier date as current/.test(reg.digest) && /was 30 October 2026 \(passed/.test(reg.digest), reg.digest);
    check('node: one item out, the competitor reading carried on (keyword, location)', c.keyword === acp.keyword && c.location_code === acp.location_code);
  });

  // ---------- W0F4 run 3299 today: the official text on file, and the client's old date ----------
  await guard('W0F4 3299 today', async () => {
    const SN = 'W0F4 (Fix 6) run 3299 replayed on 28 October 2026: the brief would have had the official UAE timeline; the client\'s own post saying 31 July is reported';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = acp3299();
    const ans = (t) => searx([]);   // the searches found nothing: the decision on file is still read live
    const ownPost = { page_text: 'Title: PDF invoices and the 2027 deadline\n\nMarkdown Content:\nIn the UAE, businesses with revenue of AED 50 million or more must appoint an accredited service provider by 31 July 2026 and go live with e-invoicing by 1 January 2027.\n' };
    const own = acp.site_urls.filter(u => /e-invoic/i.test(u));
    const byUrl = {}; own.forEach(u => { byUrl[u] = ownPost; });
    const { c, cands } = await chain(acp, ans, readOf(byUrl));
    const reg = c.regulatory || {};
    check('the official decision on file and the client\'s posts were read', cands.some(x => x.role === 'official' && /66-of-2026/.test(x.url)) && cands.some(x => x.role === 'own'), J(cands.map(x => [x.role, x.url])));
    const p1 = (c.regulatory_facts || []).find(f => f.verb === 'appoint' && f.subject_class === 'ge:50000000');
    check('phase 1: appoint by 30 October 2026, supersedes 31 July 2026, upcoming, from the Ministry of Finance', p1 && p1.date === '2026-10-30' && p1.supersedes === '2026-07-31' && p1.status === 'upcoming' && /mof\.gov\.ae/.test(p1.url), J(p1));
    check('the instrument is named (Decision No. 66 of 2026)', p1 && /Ministerial Decision No\. 66 of 2026/.test(p1.instrument || ''), J(p1));
    check('go live 1 January 2027 and phase 2 dates are there', ['2027-01-01', '2027-03-31', '2027-07-01'].every(dt => (c.regulatory_facts || []).some(f => f.date === dt)), J((c.regulatory_facts || []).map(f => f.date)));
    check('the block names the dates and the rules, as context (never a new section)', /30 October 2026/.test(reg.digest) && /1 January 2027/.test(reg.digest) && /never add a section for it/.test(reg.digest)
      && /never "next month", "tomorrow"/.test(reg.digest), reg.digest);
    check('the client\'s own post still saying 31 July 2026 is reported (advice, never a source)', (reg.own_posts || []).some(o => (o.conflicts || []).some(x => x.says === '31 July 2026' && x.current === '30 October 2026' && x.superseded)), J(reg.own_posts));
    check('the client\'s post is never the source of a fact', !(c.regulatory_facts || []).some(f => /novaand\.example/.test(f.url)));
    const words = /—|–|“|”|…/;
    check('the block keeps the customer wording rule (no em dash, curly quote or ellipsis)', !words.test(reg.digest), reg.digest.match(words));
    console.log('   AFTER 3299 regulatory block:\n      ' + String(reg.digest).split('\n').join('\n      '));
  });

  // ---------- W0F5 none could be confirmed; the two-source tier ----------
  await guard('W0F5 tiers', async () => {
    const SN = 'W0F5 (Fix 6 acceptance, REVIEW_EVIDENCE H5) a PDF-only official page with one secondary source: none could be confirmed; two agreeing independent sources: used, labelled as reported';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = { ...acp3299(), keyword: 'zatca e-invoicing integration', country: 'Saudi Arabia', country_iso: 'SA', started_at: '2026-10-29T08:00:00Z', business_facts: '', site_urls: [], site_model: {}, term_digest: '' };
    const one = (t) => t.kind === 'secondary' ? searx([[PAGES.sa_secondary_a.url, 'Saudi Arabia: e-invoicing integration wave', '']]) : searx([[PAGES.sa_official_unreadable.url, 'Wave notice (PDF)', '']]);
    const a = (await chain(acp, one, readOf({ [PAGES.sa_official_unreadable.url]: { page_text: '' } }))).c.regulatory;
    check('one secondary source alone is not used: none could be confirmed', a.status === 'none_confirmed' && !(a.facts || []).length, J(a).slice(0, 600));
    check('the block says so and gives no date', /No current date could be confirmed/.test(a.digest) && !/31 March 2027/.test(a.digest), a.digest);
    check('the official page that could not be read is listed with why', (a.sources_read || []).some(s => s.role === 'official' && /could not be read/.test(s.state)), J(a.sources_read));
    check('the lone source is named in what was not used', (a.not_used || []).some(n => n.kind === 'single_source' && /kpmg\.com/.test(n.reason)), J(a.not_used));
    const two = (t) => t.kind === 'secondary' ? searx([[PAGES.sa_secondary_a.url, 'a', ''], [PAGES.sa_secondary_b.url, 'b', ''], [PAGES.sa_secondary_stale.url, 'c', '']]) : searx([[PAGES.sa_official_unreadable.url, 'Wave notice (PDF)', '']]);
    const b = (await chain(acp, two, readOf({ [PAGES.sa_official_unreadable.url]: { page_text: '' } }))).c;
    const f = (b.regulatory_facts || [])[0] || {};
    check('two independent sources that agree: 31 March 2027, tier 2, reported by both', f.date === '2027-03-31' && f.source_tier === 2 && f.source_kind === 'secondary_pair'
      && J(f.reported_by) === J(['kpmg.com', 'deloitte.com']), J(b.regulatory_facts));
    check('a third source with another date, alone, does not win', !(b.regulatory_facts || []).some(x => x.date === '2026-12-31'));
    check('the block tells the writer to say "as reported by"', /as reported by kpmg\.com and deloitte\.com/.test(b.regulatory.digest), b.regulatory.digest);
    const pk = (await chain({ ...acp, country: 'Pakistan', country_iso: 'PK', keyword: 'fbr pos integration' }, () => searx([]), readOf({}))).c.regulatory;
    check('Pakistan (fbr.gov.pk) is a market by data: searched, nothing confirmed, nothing invented', pk.market === 'PK' && pk.status === 'none_confirmed' && /fbr\.gov\.pk/.test(pk.digest), J(pk).slice(0, 400));
  });

  // ---------- W0F6 SearXNG down: one paid search per topic, through the gate ----------
  await guard('W0F6 fallback', async () => {
    const SN = 'W0F6 (Fix 6, REVIEW_CODE M6) SearXNG answers nothing: one DataForSEO search per topic (site: query), its organic results become the pages to read';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = { ...acp3299(), keyword: 'e-invoicing deadline uae' };
    mock('Analyze Competitor Pages', [{ json: acp }]);
    const plan = (await run('Regulatory Plan', [{ json: acp }])).map(i => i.json);
    const empty = (await run('Regulatory Candidates', plan.map(() => ({ json: { results: [] } })))).map(i => i.json);
    check('an EMPTY answer is not "down": no paid search', !empty.some(x => x.dfs_fallback), J(empty).slice(0, 300));
    const down = (await run('Regulatory Candidates', plan.map(() => ({ json: { error: { message: 'connect ECONNREFUSED searxng:8080' } } })))).map(i => i.json);
    const topics = [...new Set(plan.map(t => t.topic))];
    check('one paid search per topic, never per query', down.length === topics.length && down.every(x => x.dfs_fallback === true && /site:/.test(x.keyword)) && down.some(x => /site:mof\.gov\.ae/.test(x.keyword)), J(down));
    const ans = down.map(() => ({ json: { tasks: [{ id: 't1', cost: 0.002, result: [{ items: [{ type: 'organic', url: PAGES.md66.url, title: 'Decision 66', description: '' }, { type: 'organic', url: 'https://www.kpmg.com/ae/x.html', title: 'k', description: '' }] }] }] } }));
    const sc = (await run('Regulatory SERP Candidates', ans)).map(i => i.json);
    check('the paid results become pages to read (official first)', sc.length >= 1 && sc[0].role === 'official' && sc[0].read === true && (sc[0].searched || {}).engine === 'dataforseo', J(sc));
    mock('Read Regulatory Pages', sc.map(x => ({ json: { page_text: (Object.values(PAGES).find(p => p && p.url === x.url) || { page_text: '' }).page_text } })));
    const c = (await run('Collect Regulatory Facts', sc.map(x => ({ json: x }))))[0].json;
    check('Collect Regulatory Facts reads the paid path\'s candidates', (c.regulatory.searched || {}).engine === 'dataforseo' && c.regulatory.facts.some(f => f.date === '2026-10-30'), J(c.regulatory.searched));
  });

  // ---------- W0F7 Collect Facts carries the facts on; nothing breaks without them ----------
  await guard('W0F7 collect facts', async () => {
    const SN = 'W0F7 (Fix 6, REVIEW_CODE M6 / L6) Collect Facts puts the official sources first in the run\'s verified facts and carries `regulatory` to Parse Analysis; without the step it is unchanged';
    reset(); begin(SN); const check = mkCheck(SN);
    const acp = acp3299();
    const serp = { tasks: [{ id: 'f1', status_code: 20000, cost: 0.002, result: [{ items: [{ type: 'organic', url: 'https://www.example-research.com/erp-stats', domain: 'example-research.com', title: 'ERP statistics', description: 'In 2026, 62% of mid-size firms run a cloud ERP, up from 48% in 2023.' }] }] }] };
    mock('Analyze Competitor Pages', [{ json: acp }]); mock('Facts SERP', [{ json: serp }]); delete store['Facts SERP (Retry)']; delete store['Collect Regulatory Facts'];
    const before = (await run('Collect Facts', [{ json: serp }]))[0].json;
    check('without the regulatory step: facts as before, no regulatory field', !('regulatory' in before) && (before.facts || []).length === 1 && before.facts[0].url === 'https://www.example-research.com/erp-stats', J(before.facts));
    const { c } = await chain(acp, () => searx([]), readOf({}));
    mock('Collect Regulatory Facts', [{ json: c }]); mock('Analyze Competitor Pages', [{ json: acp }]); mock('Facts SERP', [{ json: serp }]);
    const after = (await run('Collect Facts', [{ json: serp }]))[0].json;
    check('the official sources lead the verified facts, tier primary, then the search\'s facts', after.facts.length >= 2 && /mof\.gov\.ae/.test(after.facts[0].url) && after.facts[0].tier === 'primary'
      && after.facts.some(f => f.url === 'https://www.example-research.com/erp-stats'), J(after.facts.map(f => [f.url, f.tier])));
    check('regulatory and regulatory_facts travel on; the internal list does not', after.regulatory && after.regulatory.status === 'confirmed' && (after.regulatory_facts || []).length > 0 && !('regulatory_sources' in after), Object.keys(after).filter(k => /regul/.test(k)).join(','));
    check('the official paragraph is the source text, so "AED 50 million" checks against "AED 50,000,000"', /AED 50,000,000/.test(after.facts[0].text) && /30 October 2026/.test(after.facts[0].text), after.facts[0].text);
  });

  // ---------- W0F8 Content QA records, never scores; the owner's guard on the page that ranks ----------
  await guard('W0F8 qa record and owner guard', async () => {
    const SN = 'W0F8 (Fix 6, owner priority 2026-10-29) Content QA records whether the page states the current dates and never changes the grade; the ranking guide 949 is not touched';
    reset(); begin(SN); const check = mkCheck(SN);
    const F = f3299();
    const base = await R.replay(F, 'Content QA', 2, { mocks: { 'Collect Regulatory Facts': null } });
    const q0 = base.first.content_qa || {};
    // the grade production recorded, less W0-A's own correction (Fix 1): production read the slug as round 2's meta description, which is empty,
    // and scored structure on it; today the empty field is read as empty (S-META2), and that is the only part allowed to differ
    const rec0 = base.recordedFirst.content_qa || {}, b0 = q0.score_breakdown || {}, rb0 = rec0.score_breakdown || {};
    const metaMisread = (base.recordedFirst.meta || {}).description === 'Slug: ms-365-erp-uae' && (base.first.meta || {}).description === '';
    const sameGrade = Object.keys(rb0).every(k => k === 'structure' ? (b0[k] === rb0[k] || (metaMisread && b0[k] < rb0[k] && rb0[k] - b0[k] <= 2)) : b0[k] === rb0[k])
      && q0.content_score === rec0.content_score - ((rb0.structure || 0) - (b0.structure || 0));
    check('without the step, Content QA records "not checked" and keeps its grade (W0-A\'s meta read aside)', q0.regulatory && q0.regulatory.status === 'not_checked' && sameGrade, J({ reg: q0.regulatory, now: q0.content_score, recorded: rec0.content_score, metaMisread }));
    const acp = acp3299();
    const { c } = await chain(acp, () => searx([]), readOf({}));
    const withReg = await R.replay(F, 'Content QA', 2, { mocks: { 'Collect Regulatory Facts': [{ json: c }] } });
    const q1 = withReg.first.content_qa || {};
    check('with the step (context topic): recorded as not required, and the grade, the score and the not-ready reasons are unchanged',
      q1.regulatory && q1.regulatory.status === 'not_required' && q1.regulatory.required === false && q1.content_score === q0.content_score && J(q1.score_breakdown) === J(q0.score_breakdown)
      && J(q1.not_ready_reasons) === J(q0.not_ready_reasons), J({ reg: q1.regulatory, s0: q0.content_score, s1: q1.content_score }));
    // REG.qa on its own: a core page that leaves out the dates, states the superseded one, or writes a passed one as coming
    const reg = { topics: [{ id: 'e-invoicing', relevance: 'core' }], facts: [{ topic: 'e-invoicing', verb: 'appoint', date: '2026-10-30', supersedes: '2026-07-31', status: 'passed', source_tier: 1, obligation: 'appoint an Accredited Service Provider' },
      { topic: 'e-invoicing', verb: 'implement', date: '2027-01-01', supersedes: '', status: 'upcoming', source_tier: 1, obligation: 'implement the Electronic Invoicing System' }] };
    check('a core page with neither date: missing', REG.qa('# E-invoicing in the UAE\n\nNo dates here.', reg).status === 'missing');
    check('a page that still says 31 July 2026: stale', REG.qa('Businesses must appoint a provider by 31 July 2026 and go live by 1 January 2027.', reg).status === 'stale_date');
    check('a passed deadline written as coming: caught', REG.qa('Businesses must appoint a provider by 30 October 2026. Go live by 1 January 2027.', reg).passed_as_upcoming.length === 1);
    check('the same deadline written as passed: stated', REG.qa('The deadline to appoint a provider was 30 October 2026. Businesses must go live by 1 January 2027.', reg).status === 'stated');
    // the owner's guard: the guide that ranks (949) gets the block as context only, and its own text is "not required"
    const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
    const gacp = { ...acp, keyword: G.keyword, page_type: G.page_type, force_content: true, pipeline_source: 'ladder', started_at: '2026-10-22T08:00:00Z' };
    const g = (await chain(gacp, () => searx([]), readOf({}))).c.regulatory;
    check('949 guide: every topic is context (the block may add a sentence where it fits, never a section, never a requirement)', g.topics.length > 0 && g.topics.every(t => t.relevance === 'context') && g.required === false && /never add a section for it/.test(g.digest), J(g.topics));
    const gq = REG.qa(G.live_markdown, g);
    check('949 guide: its live text is recorded "not required" (no flag that could hold or grade it down)', gq.required === false && gq.status === 'not_required' && !gq.missing.length, J(gq));
  });

  // ---------- W0F9 the wiring the build proved ----------
  await guard('W0F9 wiring', async () => {
    const SN = 'W0F9 (Fix 6, REVIEW_CODE M6) the brief and the writer print the block, read explicitly and inside a try/catch; the data passes the wording rule';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const f of ['Strategy_Brief.prompt.txt', 'Copywriter.prompt.txt']) {
      const p = path.join(CODE_DIR, f); const s = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
      check(f + ': reads $(\'Collect Regulatory Facts\') in a try/catch', /\$\('Collect Regulatory Facts'\)\.first\(\)\.json\.regulatory/.test(s) && /catch \(e\)/.test(s), s.length);
    }
    const s = JSON.stringify(REGULATORS);
    check('regulators.json: no em dash, curly quote or ellipsis', !/—|–|“|”|…/.test(s));
    check('the UAE copy on file names the Ministry of Finance\'s texts and was checked', REGULATORS.markets.AE.topics['e-invoicing'].known.every(k => /^https:\/\/mof\.gov\.ae\//.test(k.url) && k.checked_on === '2026-10-29'));
    check('AE, SA, PK are on the map', ['AE', 'SA', 'PK'].every(k => REGULATORS.markets[k] && REGULATORS.markets[k].official.length));
  });
};
