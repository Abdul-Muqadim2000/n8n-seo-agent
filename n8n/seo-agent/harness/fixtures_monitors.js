// Fixtures for the growth monitors (v4.5). Most are REAL DataForSEO responses captured on 2026-10-02 for techand.ai / "e invoicing uae"
// (fixtures_live/*.json); a few are derived from them to exercise the brand-mention, broken-link and Google Business Profile paths.
const fs = require('fs'); const path = require('path');
const L = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures_live', n + '.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const SITE = 'site_northwind-erp-com', DOMAIN = 'northwind-erp.com';
// ---- AI answers: real shapes; variants name / cite the client ----
const scraper = (withUs) => { const d = clone(L('scraper')); const r = d.tasks[0].result[0];
  if (withUs) { r.markdown = 'Here are the main options:\n\n| Company | Website |\n|---|---|\n| **Azentio Software** | [azentio.com](https://www.azentio.com/) |\n| **Northwind ERP** | [northwind-erp.com](https://northwind-erp.com/e-invoicing-uae/?utm_source=chatgpt.com) |\n| **ClearTax** | [cleartax.com](https://www.cleartax.com/ae/) |\n\n' + r.markdown;
    r.sources = [{ type: 'chat_gpt_source', domain: 'northwind-erp.com', url: 'https://northwind-erp.com/e-invoicing-uae/?utm_source=chatgpt.com', title: 'E-invoicing in the UAE' }, ...r.sources]; }
  return d; };
const claude = (withUs) => { const d = clone(L('r_claude')); if (withUs) { const s = d.tasks[0].result[0].items[0].sections; s.splice(1, 0, { type: 'text', text: 'Northwind ERP (northwind-erp.com) - an Odoo partner that runs e-invoicing readiness projects for distributors', annotations: [{ title: 'Northwind ERP', url: 'https://northwind-erp.com/services/e-invoicing/' }] }); } return d; };
const gemini = () => clone(L('r_gemini'));
const perplexity = () => clone(L('r_perplexity'));
const aio = () => clone(L('aio'));
const aiMode = () => clone(L('aimode'));
const noAio = () => { const d = clone(L('aio')); d.tasks[0].result[0].items = d.tasks[0].result[0].items.filter(x => x.type !== 'ai_overview'); return d; };
const market = () => clone(L('top_domains'));
const failed = () => ({ tasks: [{ status_code: 40501, status_message: "Invalid Field: 'max_output_tokens'.", cost: 0, result: null }] });
const answerFor = (req, i, o = {}) => { const e = req.engine; const us = o.us && o.us(req, i);
  if (o.fail && o.fail(req, i)) return failed();
  return e === 'chatgpt' ? scraper(us) : e === 'claude' ? claude(us) : e === 'gemini' ? gemini() : e === 'perplexity' ? perplexity() : e === 'ai_overview' ? (o.noAio ? noAio() : aio()) : e === 'ai_mode' ? aiMode() : market(); };
// ---- monitor plan inputs ----
const sites = () => [{ json: { site_id: SITE, domain: DOMAIN, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: 'owner@northwind-erp.com', callback_url: 'https://hooks.example.com/x', keywords: 'e invoicing uae, erp implementation services', status: 'active', source: 'form' } }];
const ladders = () => [{ json: { ladder_id: 'lad_1', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 4, page_no: 5, keyword: 'e invoicing in uae', target_url: 'https://northwind-erp.com/e-invoicing-uae/', page_exists: true, status: 'published', email: 'owner@northwind-erp.com' } },
  { json: { ladder_id: 'lad_1', domain: DOMAIN, head_keyword: 'e invoicing in uae', rung: 1, page_no: 1, keyword: 'uae e invoicing penalties', target_url: 'https://northwind-erp.com/uae-e-invoicing-penalties/', page_exists: false, status: 'writing' } }];
const monitors = (o = {}) => [{ json: { site_id: SITE, domain: DOMAIN, ai_visibility: true, ai_engines: '', ai_prompts_max: 8, backlinks: true, audit_monthly: true, audit_pages: 500, audit_js: false, competitors: 'azentio.com, cleartax.com', brand_names: '', updated_at: '2026-09-30T08:00:00.000Z', request_id: '', ...o } }];
const profiles = () => [{ json: { site_id: SITE, domain: DOMAIN, business_name: 'Northwind ERP', business_type: 'IT consultancy', city: 'Dubai', phone: '+971 4 555 0100', street_address: 'Office 1203, Aspect Tower, Business Bay', country_code: 'AE', author_name: 'Sara Khan', logo_url: 'https://northwind-erp.com/logo.png', opening_hours: 'Mo-Fr 09:00-18:00' } }];
const promptWriter = { output: { prompts: [
  { prompt: 'Which companies help businesses in the UAE get ready for e-invoicing before the 2027 deadline?', kind: 'recommend', topic: 'e invoicing in uae', keyword: 'e invoicing service providers uae' },
  { prompt: 'How much does an e-invoicing implementation cost for a mid-size UAE distributor?', kind: 'cost', topic: 'e invoicing in uae', keyword: 'e invoicing cost uae' },
  { prompt: 'What should I check before choosing an accredited e-invoicing service provider in the UAE?', kind: 'choose', topic: 'e invoicing in uae', keyword: 'choose asp uae' },
  { prompt: 'Odoo or Business Central: which ERP handles UAE e-invoicing better for distributors?', kind: 'compare', topic: 'erp implementation services', keyword: 'odoo vs business central uae' },
  { prompt: 'What are the penalties if my UAE company misses the e-invoicing deadline?', kind: 'problem', topic: 'uae e invoicing penalties', keyword: 'uae e invoicing penalties' },
  { prompt: 'Who are the best ERP implementation partners in Dubai for distributors?', kind: 'recommend', topic: 'erp implementation services', keyword: 'erp implementation partner dubai' },
  { prompt: 'What is Northwind ERP (northwind-erp.com) and what does it offer?', kind: 'brand', topic: 'brand', keyword: 'northwind erp' },
  { prompt: 'Who are the best ERP implementation partners in Dubai for distributors?', kind: 'recommend', topic: 'duplicate', keyword: 'dup' } ] } };
// ---- backlinks: real responses + a broken-link variant ----
const blSummary = () => clone(L('bl_summary'));
const blLost = () => clone(L('bl_lost'));
const blNew = () => clone(L('bl_new'));
const blBroken = () => { const d = clone(L('bl_new')); const r = d.tasks[0].result[0]; r.items = r.items.slice(0, 3).map((x, i) => ({ ...x, domain_from: ['tradenews.ae', 'erpforum.org', 'tradenews.ae'][i], url_to: 'https://' + DOMAIN + '/old-odoo-pricing/', url_to_status_code: 404, is_broken: true, backlink_spam_score: 5, anchor: 'Odoo pricing guide', page_from_title: 'ERP news' })); return d; };
const blRefdom = () => { const d = clone(L('bl_refdom')); d.tasks[0].result[0].items.push({ type: 'backlinks_referring_domain', domain: 'uae-asp.ae', rank: 25, backlinks: 1 }); return d; };
const blTs = () => clone(L('bl_ts'));
const mentions = () => { const d = clone(L('ca_search')); d.tasks[0].result[0].items = [{ type: 'content_analysis_search', url: 'https://gulfbusiness.example.org/erp-partners-2026/', domain: 'gulfbusiness.example.org', domain_rank: 310, spam_score: 2, content_info: { title: 'ERP partners to watch in 2026', snippet: 'Northwind ERP helped three distributors go live with Odoo before the deadline.' } }, ...d.tasks[0].result[0].items.slice(0, 2)]; return d; };
const labsCompetitors = () => ({ tasks: [{ status_code: 20000, cost: 0.0107, result: [{ items: [{ domain: 'www.google.com' }, { domain: 'azentio.com' }, { domain: 'tax.gov.ae' }, { domain: 'cleartax.com' }, { domain: 'comarch.com' }] }] }] });
const gap = () => clone(L('gap_partial'));
const blFor = (req) => ({ summary: blSummary, lost: blLost, new: blNew, broken: blBroken, refdomains: blRefdom, timeseries: blTs, mentions, competitors: labsCompetitors }[req.kind] || blSummary)();
const outreach = { output: { drafts: [{ prospect_domain: 'peppol.org', subject: 'Your Peppol members list and Northwind ERP', body: 'Hello,\n\nYour full-members list used to link to our site; the link seems to have gone during an update. Could you restore it to https://northwind-erp.com/ ? Thank you.\n\n[Your name], Northwind ERP' },
  { prospect_domain: 'gulfbusiness.example.org', subject: 'Thanks for mentioning Northwind ERP', body: 'Hello,\n\nThank you for naming Northwind ERP in your 2026 ERP partners piece. Would you link the mention to https://northwind-erp.com/ so readers can find us? \n\n[Your name], Northwind ERP' }] } };
// ---- Google Business Profile ----
const gbpFound = () => ({ tasks: [{ status_code: 20000, cost: 0.0054, result: [{ items_count: 1, items: [{ type: 'google_business_info', title: 'Northwind ERP LLC', phone: '+971 4 555 0199', url: 'https://northwind-erp.com/', domain: 'northwind-erp.com', address: 'Office 1203, Aspect Tower, Business Bay, Dubai', category: 'Software company', rating: { value: 4.8, votes_count: 23 }, is_claimed: false, cid: '1234567890' }] }] }] });
const gbpNone = () => clone(L('gbp'));
module.exports = { L, SITE, DOMAIN, answerFor, sites, ladders, monitors, profiles, promptWriter, blFor, gap, outreach, gbpFound, gbpNone, scraper, claude, blLost };
