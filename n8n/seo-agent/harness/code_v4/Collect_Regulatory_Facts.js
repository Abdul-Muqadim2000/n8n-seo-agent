const REGULATORS = {"version":1,"updated":"2026-10-29","about":"Regulatory facts step (page-quality programme 2026-10-29, PLAN Fix 6, build section 153). Market (ISO country) -> topics -> the official domains a date may come from, the words that make a page touch the topic, and what to search. A market or topic not listed here is never researched: the page then says nothing dated about it. `known` holds dated obligations a person read on the official text itself (url + paragraph quoted verbatim + checked_on); they are used only until `fresh_until`, and a later-dated official source read live always wins over them. Add a market or topic here, never in code (owner decision D4 for markets after AE, SA, PK).","secondary":{"about":"Independent secondary sources for the second tier: when no official text can be read, two of these on different sites that state the same date are used, labelled in the page as reported by them. One alone is never used.","hosts":["kpmg.com","deloitte.com","pwc.com","pwc.ae","ey.com","bakermckenzie.com","tamimi.com","bsalaw.com","pinsentmasons.com","dentons.com","clydeco.com","dlapiper.com","hfw.com","nortonrosefulbright.com","hadefpartners.com","galadarilaw.com","wam.ae","spa.gov.sa","app.com.pk","reuters.com","gulfnews.com","khaleejtimes.com","thenationalnews.com","arabnews.com","dawn.com","tribune.com.pk"]},"markets":{"AE":{"name":"United Arab Emirates","utc_offset_hours":4,"official":["mof.gov.ae","tax.gov.ae","u.ae","uaelegislation.gov.ae"],"topics":{"e-invoicing":{"label":"e-invoicing","search":"eInvoicing","triggers":["e-invoic","einvoic","e invoic","electronic invoic","peppol","accredited service provider"],"official":["mof.gov.ae","tax.gov.ae"],"fresh_until":"2027-01-31","known":[{"date":"2026-10-30","verb":"appoint","obligation":"appoint an Accredited Service Provider","subject":"A Person subject to the Electronic Invoicing System whose Revenue is equal to or exceeds AED 50,000,000 (phase 1)","subject_class":"ge:50000000","threshold":"revenue equal to or above AED 50,000,000 (AED 50 million)","url":"https://mof.gov.ae/wp-content/uploads/2026/05/Ministerial-Resolution-No.-66-of-2026-Amending-Certain-Provisions-of-Ministerial-Resolution-No.-244-of-2025-Regarding-the-Implementation-of-the-Electronic-Invoicing-System-En-20260514.pdf","paragraph":"(a) A Person subject to the Electronic Invoicing System and whose Revenue is equal to or exceeds AED 50,000,000 shall appoint an Accredited Service Provider by 30 October 2026 and shall implement the Electronic Invoicing System by 1 January 2027.","instrument":"Ministerial Decision No. 66 of 2026, replacing Article 5(1)(a) of Ministerial Decision No. 244 of 2025","source_date":"2026-05-10","supersedes":"2026-07-31","supersedes_url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","announced_url":"https://mof.gov.ae/en/news/ministry-of-finance-announces-targeted-amendments-to-einvoicing-system-decisions/","checked_on":"2026-10-29"},{"date":"2027-01-01","verb":"implement","obligation":"implement the Electronic Invoicing System","subject":"A Person subject to the Electronic Invoicing System whose Revenue is equal to or exceeds AED 50,000,000 (phase 1)","subject_class":"ge:50000000","threshold":"revenue equal to or above AED 50,000,000 (AED 50 million)","url":"https://mof.gov.ae/wp-content/uploads/2026/05/Ministerial-Resolution-No.-66-of-2026-Amending-Certain-Provisions-of-Ministerial-Resolution-No.-244-of-2025-Regarding-the-Implementation-of-the-Electronic-Invoicing-System-En-20260514.pdf","paragraph":"(a) A Person subject to the Electronic Invoicing System and whose Revenue is equal to or exceeds AED 50,000,000 shall appoint an Accredited Service Provider by 30 October 2026 and shall implement the Electronic Invoicing System by 1 January 2027.","instrument":"Ministerial Decision No. 66 of 2026 (the date is unchanged from Ministerial Decision No. 244 of 2025)","source_date":"2026-05-10","supersedes":"","checked_on":"2026-10-29"},{"date":"2027-03-31","verb":"appoint","obligation":"appoint an Accredited Service Provider","subject":"A Person subject to the Electronic Invoicing System whose Revenue is less than AED 50,000,000 (phase 2)","subject_class":"lt:50000000","threshold":"revenue below AED 50,000,000 (AED 50 million)","url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","paragraph":"(b) A Person subject to the Electronic Invoicing System and whose Revenue is less than AED 50,000,000 shall appoint an Accredited Service Provider by 31 March 2027 and shall implement the Electronic Invoicing System by 1 July 2027.","instrument":"Ministerial Decision No. 244 of 2025, Article 5(1)(b)","source_date":"2025-09-29","supersedes":"","checked_on":"2026-10-29"},{"date":"2027-07-01","verb":"implement","obligation":"implement the Electronic Invoicing System","subject":"A Person subject to the Electronic Invoicing System whose Revenue is less than AED 50,000,000 (phase 2)","subject_class":"lt:50000000","threshold":"revenue below AED 50,000,000 (AED 50 million)","url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","paragraph":"(b) A Person subject to the Electronic Invoicing System and whose Revenue is less than AED 50,000,000 shall appoint an Accredited Service Provider by 31 March 2027 and shall implement the Electronic Invoicing System by 1 July 2027.","instrument":"Ministerial Decision No. 244 of 2025, Article 5(1)(b)","source_date":"2025-09-29","supersedes":"","checked_on":"2026-10-29"},{"date":"2027-03-31","verb":"appoint","obligation":"appoint an Accredited Service Provider","subject":"A Government Entity","subject_class":"gov","threshold":"","url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","paragraph":"(c) A Government Entity shall appoint an Accredited Service Provider by 31 March 2027 and shall implement the Electronic Invoicing System by 1 October 2027.","instrument":"Ministerial Decision No. 244 of 2025, Article 5(1)(c)","source_date":"2025-09-29","supersedes":"","checked_on":"2026-10-29"},{"date":"2027-10-01","verb":"implement","obligation":"implement the Electronic Invoicing System","subject":"A Government Entity","subject_class":"gov","threshold":"","url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","paragraph":"(c) A Government Entity shall appoint an Accredited Service Provider by 31 March 2027 and shall implement the Electronic Invoicing System by 1 October 2027.","instrument":"Ministerial Decision No. 244 of 2025, Article 5(1)(c)","source_date":"2025-09-29","supersedes":"","checked_on":"2026-10-29"},{"date":"2026-07-01","verb":"start","obligation":"implement the Electronic Invoicing System on a voluntary basis","subject":"Any Person","subject_class":"voluntary","threshold":"","url":"https://mof.gov.ae/wp-content/uploads/2025/09/Ministerial-Decision-No.-244-of-2025-on-the-Implementation-of-the-Electronic-Invoicing-System.pdf","paragraph":"Any Person may implement the Electronic Invoicing System on a voluntary basis as from 1 July 2026 and shall, in that case, comply with all the technical requirements established by the Ministry and the Authority for the use of the Electronic Invoicing System.","instrument":"Ministerial Decision No. 244 of 2025, Article 4","source_date":"2025-09-29","supersedes":"","checked_on":"2026-10-29"}]},"vat":{"label":"VAT","search":"VAT","triggers":["vat","value added tax"],"official":["tax.gov.ae","mof.gov.ae"],"fresh_until":"","known":[]},"corporate-tax":{"label":"corporate tax","search":"corporate tax","triggers":["corporate tax","corporate income tax","ct registration","transfer pricing"],"official":["tax.gov.ae","mof.gov.ae"],"fresh_until":"","known":[]},"data-protection":{"label":"personal data protection","search":"personal data protection law","triggers":["data protection","pdpl","data residency","data localisation","data localization"],"official":["u.ae","uaelegislation.gov.ae"],"fresh_until":"","known":[]},"payroll-labour":{"label":"payroll and labour rules","search":"wage protection system","triggers":["payroll","wage protection","wps","emiratisation","labour law","labor law","end of service"],"official":["mohre.gov.ae","u.ae"],"fresh_until":"","known":[]},"aml":{"label":"anti-money laundering rules","search":"anti-money laundering","triggers":["anti-money laundering","aml","goaml","kyc"],"official":["mof.gov.ae","uaefiu.gov.ae","centralbank.ae"],"fresh_until":"","known":[]}}},"SA":{"name":"Saudi Arabia","utc_offset_hours":3,"official":["zatca.gov.sa"],"topics":{"e-invoicing":{"label":"e-invoicing (FATOORA)","search":"e-invoicing integration phase wave","triggers":["e-invoic","einvoic","e invoic","electronic invoic","fatoora","zatca integration"],"official":["zatca.gov.sa"],"fresh_until":"","known":[]},"vat":{"label":"VAT","search":"VAT","triggers":["vat","value added tax"],"official":["zatca.gov.sa"],"fresh_until":"","known":[]},"zakat-income-tax":{"label":"zakat and income tax","search":"zakat income tax","triggers":["zakat","income tax","withholding tax"],"official":["zatca.gov.sa"],"fresh_until":"","known":[]},"data-protection":{"label":"personal data protection","search":"personal data protection law","triggers":["data protection","pdpl","data residency","data localisation","data localization"],"official":["sdaia.gov.sa"],"fresh_until":"","known":[]}}},"PK":{"name":"Pakistan","utc_offset_hours":5,"official":["fbr.gov.pk"],"topics":{"e-invoicing":{"label":"e-invoicing and POS integration","search":"e-invoicing integration sales tax","triggers":["e-invoic","einvoic","e invoic","electronic invoic","pos integration","point of sale integration"],"official":["fbr.gov.pk"],"fresh_until":"","known":[]},"sales-tax":{"label":"sales tax","search":"sales tax","triggers":["sales tax","gst","federal excise"],"official":["fbr.gov.pk"],"fresh_until":"","known":[]},"income-tax":{"label":"income tax","search":"income tax return","triggers":["income tax","withholding tax","tax return"],"official":["fbr.gov.pk"],"fresh_until":"","known":[]}}}}};   // v5/data/regulators.json (build section 154)
// ---- regulatory facts kit (W0-F, page-quality programme 2026-10-29, PLAN §3 Fix 6; inlined through the __REGULATORY__ marker) ----
// Page run 3299 ("ms 365 erp", a UAE ERP partner) never learned the UAE e-invoicing timeline: the only facts search stripped every country
// name, so the dates the reader needed most (appoint an accredited provider by 30 October 2026, go live 1 January 2027) never reached the
// brief, and an expert reviewer took points off for it. And the reviews found the next trap: the 30 October date is itself an AMENDMENT of
// 31 July 2026, so "read the top official page" can state a superseded date, and from 31 October a page must say that deadline has passed.
// This kit is the one rule for every market, driven by v5/data/regulators.json (no code per country):
//   REG.marketOf(data, iso)                  the market's entry, or null (no entry = nothing is researched, nothing dated is said)
//   REG.topicsOf(market, ctx)                the regulated topics this page touches: `core` (the keyword / AI question names it) or `context`
//                                            (the business's own facts, its own posts or the ranking pages name it), at most MAX_TOPICS
//   REG.queries(market, topic, year)         the searches: official domains + deadline words, official domains + amendment words, and a
//                                            plain one for the secondary tier
//   REG.dates(text)                          every full date ("30 October 2026", "October 30, 2026", "2026-10-30") and month ("July 2027")
//   REG.extract(text, meta)                  dated obligations: {date, verb, obligation, subject, subject_class, threshold, paragraph,
//                                            supersedes}; "from 31 July 2026 to 30 October 2026" gives the new date superseding the old one
//   REG.sourceDate(url, text)                when the source was published (the reader's "Published Time", a dated upload path or file name)
//   REG.statusOf(fact, asOf)                 upcoming / passed / in_force against the day the page is written (never a passed date as coming)
//   REG.resolve(cands, opts)                 one fact per obligation: the latest dated official source wins and records what it supersedes;
//                                            with no official text, two independent secondary sources that agree; else nothing
//   REG.digest(reg)                          the REGULATORY FACTS block the brief and the writer print
//   REG.qa(md, reg)                          what Content QA records: {required, stated, status, source_tier, missing, stale, passed_as_upcoming}
// Regex only: the n8n Code sandbox has no URL constructor and no-ops Object.defineProperty.
const REG = (() => {
  const MAX_TOPICS = 2, MAX_FACTS_TOPIC = 8, MAX_CONTEXT_FACTS = 6;
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MRE = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const pad = (n) => String(n).padStart(2, '0');
  const s = (v) => String(v == null ? '' : v);
  const clean = (t) => s(t).replace(/\s+/g, ' ').trim();
  const host = (u) => { const m = s(u).trim().match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const registrable = (h) => { const p = s(h).toLowerCase().split('.').filter(Boolean); if (p.length <= 2) return p.join('.');
    return /^(gov|com|co|org|net|ac|edu|mil)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const onDomain = (h, list) => (list || []).some(d => { const x = s(d).toLowerCase().replace(/^www\./, ''); return x && (h === x || h.endsWith('.' + x)); });
  const urlKey = (u) => s(u).trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const monthNo = (w) => MON[s(w).toLowerCase().slice(0, s(w).toLowerCase().startsWith('sept') ? 4 : 3)] || MON[s(w).toLowerCase().slice(0, 3)] || 0;
  const validDay = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

  // ---------- dates ----------
  const dates = (text) => {
    const t = s(text), out = [];
    const take = (re, f) => { for (const m of t.matchAll(re)) { const r = f(m); if (!r) continue; const a = m.index, b = m.index + m[0].length;
      if (out.some(o => a < o.end && b > o.index)) continue; out.push({ ...r, raw: m[0], index: a, end: b }); } };
    take(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MRE + '\\.?,?\\s+(20\\d{2})\\b', 'gi'), (m) => { const d = +m[1], mo = monthNo(m[2]), y = +m[3];
      return validDay(y, mo, d) ? { iso: y + '-' + pad(mo) + '-' + pad(d), precision: 'day' } : null; });
    take(new RegExp('\\b' + MRE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b', 'gi'), (m) => { const mo = monthNo(m[1]), d = +m[2], y = +m[3];
      return validDay(y, mo, d) ? { iso: y + '-' + pad(mo) + '-' + pad(d), precision: 'day' } : null; });
    take(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (m) => validDay(+m[1], +m[2], +m[3]) ? { iso: m[1] + '-' + m[2] + '-' + m[3], precision: 'day' } : null);
    // a month alone, never the tail of a day that is not a date ("31 February 2027")
    take(new RegExp('\\b' + MRE + '\\.?,?\\s+(20\\d{2})\\b', 'gi'), (m) => { const mo = monthNo(m[1]); if (/\d(?:st|nd|rd|th)?\s+(?:of\s+)?$/i.test(t.slice(Math.max(0, m.index - 10), m.index))) return null;
      return mo ? { iso: m[2] + '-' + pad(mo), precision: 'month' } : null; });
    return out.sort((a, b) => a.index - b.index);
  };
  const fmt = (iso) => { const m = s(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); if (!m) return s(iso);
    return (m[3] ? (+m[3]) + ' ' : '') + MONTH_NAMES[+m[2]] + ' ' + m[1]; };
  // the last day a date covers (a month-only date runs to its end), for the status
  const endOf = (iso) => { const m = s(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); if (!m) return '';
    if (m[3]) return iso; const y = +m[1], mo = +m[2]; let d = 31; while (d > 28 && !validDay(y, mo, d)) d--; return m[1] + '-' + m[2] + '-' + pad(d); };
  const asOfFor = (startedAt, offsetHours) => { const t = Date.parse(s(startedAt)); const ms = (isNaN(t) ? Date.now() : t) + (Number(offsetHours) || 0) * 3600000;
    return new Date(ms).toISOString().slice(0, 10); };
  // W05-A (wave 0.5, 2026-10-30): the website's market day in its own time zone, for every market (not only the three in regulators.json):
  // the page's "Updated" date, the second read's "today" and the regulatory status all use it. A market with an IANA zone here is read
  // with Intl (summer time included); a market with only an offset in regulators.json uses the offset; anything else is UTC.
  const ZONES = { AE: 'Asia/Dubai', SA: 'Asia/Riyadh', PK: 'Asia/Karachi', QA: 'Asia/Qatar', KW: 'Asia/Kuwait', BH: 'Asia/Bahrain', OM: 'Asia/Muscat',
    EG: 'Africa/Cairo', JO: 'Asia/Amman', LB: 'Asia/Beirut', TR: 'Europe/Istanbul', IN: 'Asia/Kolkata', SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur',
    GB: 'Europe/London', IE: 'Europe/Dublin', DE: 'Europe/Berlin', FR: 'Europe/Paris', NL: 'Europe/Amsterdam', ES: 'Europe/Madrid', IT: 'Europe/Rome',
    US: 'America/New_York', CA: 'America/Toronto', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', ZA: 'Africa/Johannesburg', NG: 'Africa/Lagos', KE: 'Africa/Nairobi' };
  const zoneOf = (iso, market) => { const z = s((market && market.tz) || ZONES[s(iso).toUpperCase()]); if (!z) return '';
    try { new Intl.DateTimeFormat('en-US', { timeZone: z }).format(0); return z; } catch (e) { return ''; } };
  const dayFor = (startedAt, iso, market) => { const z = zoneOf(iso, market);
    if (!z) return asOfFor(startedAt, market ? market.utc_offset_hours : 0);
    const t = Date.parse(s(startedAt)); const d = new Date(isNaN(t) ? Date.now() : t); const p = {};
    for (const x of new Intl.DateTimeFormat('en-US', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)) p[x.type] = x.value;
    return p.year + '-' + p.month + '-' + p.day; };
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

  // ---------- market and topics ----------
  const marketOf = (data, iso) => { const k = s(iso).toUpperCase(); const m = ((data || {}).markets || {})[k]; return m ? { ...m, iso: k } : null; };
  const trigRe = (words) => new RegExp('(?:' + (words || []).map(w => { const x = s(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /^[a-z]{1,4}$/.test(x) ? '\\b' + x + '\\b' : '\\b' + x; }).join('|') + ')', 'i');
  const touches = (topic, text) => !!s(text).trim() && trigRe(topic.triggers).test(s(text).replace(/[-_\/]+/g, (c) => c === '-' ? '-' : ' '));
  // ctx: { keyword, ai_question, business_facts, own_titles[], terms }
  const topicsOf = (market, ctx) => {
    if (!market || !market.topics) return [];
    const c = ctx || {}, out = [];
    for (const [id, t] of Object.entries(market.topics)) {
      const core = [], context = [];
      if (touches(t, c.keyword)) core.push('the keyword');
      if (touches(t, c.ai_question)) core.push('the AI question');
      if (touches(t, c.business_facts)) context.push("the business's own facts");
      const own = (c.own_titles || []).filter(x => touches(t, x));
      if (own.length) context.push(own.length + ' of its own page(s)');
      if (touches(t, c.terms)) context.push('the pages that rank for this search');
      if (!core.length && !context.length) continue;
      out.push({ id, label: t.label || id, relevance: core.length ? 'core' : 'context', because: core.concat(context), weight: core.length * 10 + context.length,
        own_pages: (c.own_urls || []).filter(u => touches(t, u)).slice(0, 4) });
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, MAX_TOPICS);
  };
  const officialOf = (market, topicId) => { const t = ((market || {}).topics || {})[topicId] || {}; return (t.official && t.official.length ? t.official : (market || {}).official) || []; };
  const queries = (market, topicId, year) => {
    const t = ((market || {}).topics || {})[topicId] || {};
    const site = officialOf(market, topicId).slice(0, 4).map(d => 'site:' + d).join(' OR ');
    const subj = s(t.search || t.label || topicId);
    return [
      { kind: 'deadline', q: (site + ' ' + subj + ' deadline OR timeline OR phase OR "go-live" ' + year).trim() },
      { kind: 'amendment', q: (site + ' ' + subj + ' amended OR extended OR postponed ' + year).trim() },
      { kind: 'secondary', q: (subj + ' ' + s(market.name) + ' deadline ' + year).trim() }];
  };
  const isSecondary = (h, data) => onDomain(h, (((data || {}).secondary) || {}).hosts || []);

  // ---------- extraction ----------
  const MODAL = /\b(shall|must|will need to|will have to|are required to|is required to|are obliged to|is obliged to|need to|needs to|has to|have to|should|are expected to|is expected to)\b/i;
  const VERBS = [['appoint', /\bappoint(?:s|ed|ing)?\b/i], ['register', /\bregist(?:er|ers|ered|ering|ration)\b/i], ['file', /\bfil(?:e|es|ed|ing)\b/i],
    ['submit', /\bsubmi(?:t|ts|tted|tting|ssion)\b/i], ['implement', /\b(?:implement(?:s|ed|ing|ation)?|integrat(?:e|es|ed|ing|ion)|go(?:es)?[- ]live|went live|go-live|live with)\b/i],
    ['comply', /\bcompl(?:y|ies|iance)\b/i], ['issue', /\bissu(?:e|es|ing)\b/i],
    ['start', /\b(?:start(?:s|ed|ing)?|begin(?:s|ning)?|commenc(?:e|es|ed|ing)|come[s]? into (?:force|effect)|take[s]? effect|effective|apply|applies|in force)\b/i]];
  const DEADLINE = /\b(deadline|due date|due by|no later than|by|before|from|as of|starting|effective|until|on)\b/i;
  const AMEND = /\b(extend(?:s|ed|ing)?|extension|postpon(?:e|es|ed|ement)|amend(?:s|ed|ing|ment)|mov(?:e|es|ed)|push(?:ed)? back|replac(?:e|es|ed)|revis(?:e|es|ed|ion)|delay(?:s|ed)?|deferr?(?:ed|al)?)\b/i;
  // a PDF read as text breaks a sentence at every printed line: lines are joined inside a paragraph, and a list item, a heading or a table
  // row starts a new block
  const sentencesOf = (text) => s(text).replace(/\r/g, '').split(/\n\s*\n+/)
    .flatMap(p => p.split(/\n(?=\s*(?:[-*•#|]|\(?[a-z0-9]{1,3}[).]\s))/i))
    .map(b => b.replace(/\n+/g, ' '))
    .flatMap(b => b.split(/(?<=[.;!?])\s+(?=[A-Z(\[])/)).map(clean).filter(x => x.length >= 25 && x.length <= 900);
  const AMOUNT = /\b(AED|Dhs?|SAR|SR|PKR|Rs\.?|USD|US\$|\$)\s?(\d[\d,]*(?:\.\d+)?)\s*(million|mn|m|billion|bn|b|thousand|k)?\b/i;
  const amountValue = (m) => { const n = Number(s(m[2]).replace(/,/g, '')); const u = s(m[3]).toLowerCase();
    return n * ({ million: 1e6, mn: 1e6, m: 1e6, billion: 1e9, bn: 1e9, b: 1e9, thousand: 1e3, k: 1e3 }[u] || 1); };
  const thresholdOf = (sent) => {
    const m = s(sent).match(AMOUNT); if (!m) return { threshold: '', cls: '' };
    const v = amountValue(m); if (!(v >= 1000)) return { threshold: '', cls: '' };
    // the qualifier is the one nearest the amount: in the few words before it ("exceeding SAR 750,000", "less than AED 50,000,000"), else
    // right after it ("AED 50 million or more"); a word further back ("Under the latest notice, ...") is not about the amount
    const before = s(sent).slice(Math.max(0, m.index - 40), m.index).toLowerCase(), after = s(sent).slice(m.index + m[0].length, m.index + m[0].length + 25).toLowerCase();
    const last = (re) => { let k = -1; for (const x of before.matchAll(re)) k = x.index; return k; };
    const kLt = last(/\b(less than|below|under|lower than|not exceed|does not exceed|up to)\b/g), kGe = last(/\b(equal to or exceed|exceed|exceeds|exceeding|at least|above|over|greater than)\b/g);
    const lt = kLt > kGe || (kLt < 0 && kGe < 0 && /^\s*(or less|and below|or below)\b/.test(after));
    const ge = !lt && (kGe >= 0 || /^\s*(or more|or above|and above)\b/.test(after));
    const cur = m[1].toUpperCase().replace(/^DHS?$/, 'AED').replace(/^SR$/, 'SAR').replace(/^RS\.?$/, 'PKR');
    const human = v >= 1e9 ? cur + ' ' + (v / 1e9) + ' billion' : v >= 1e6 ? cur + ' ' + (v / 1e6) + ' million' : cur + ' ' + v.toLocaleString('en-US');
    return { threshold: (lt ? 'below ' : ge ? 'equal to or above ' : '') + human, cls: (lt ? 'lt:' : ge ? 'ge:' : 'at:') + Math.round(v) };
  };
  const subjectClassOf = (sent, thr) => /\bgovernment (entit|bod|agenc|department)|public sector entit/i.test(sent) ? 'gov'
    : /\bvoluntar/i.test(sent) ? 'voluntary' : thr.cls || 'all';
  const subjectOf = (sent) => { const m = s(sent).match(MODAL); if (!m || m.index < 6) return '';
    return clean(s(sent).slice(0, m.index).replace(/^\(?[a-z0-9]{1,3}[).]\s+/i, '').replace(/^(?:and|but|so|then)\s+/i, '')).slice(0, 200); };
  // the LAST obligation verb of the clause (the one nearest the date): "the next integration wave ... must integrate ... by <date>"
  const verbOf = (clause) => { let best = null; for (const [v, re] of VERBS) { const g = new RegExp(re.source, 'gi'); for (const m of s(clause).matchAll(g)) if (!best || m.index > best.index) best = { verb: v, index: m.index, word: m[0] }; } return best; };
  // the obligation is the verb phrase of the clause that ends at the date: "appoint an Accredited Service Provider" in
  // "... shall appoint an Accredited Service Provider by 30 October 2026 and shall implement ... by 1 January 2027"
  const obligationOf = (clause, vb) => {
    if (!vb) return '';
    let tail = s(clause).slice(vb.index);
    const d0 = dates(tail)[0]; if (d0) tail = tail.slice(0, d0.index);
    const stop = tail.search(/\s(?:by|before|from|on|no later than|until|as of|as from|starting|effective from|with effect from|at the latest)(?=\s|$)/i);
    if (stop > 0) tail = tail.slice(0, stop);
    tail = tail.replace(/[,;:(]+\s*$/, '');
    return clean(tail).split(' ').slice(0, 12).join(' ').replace(/[,.;:]+$/, '');
  };
  // meta: { topic, url, role, tier, source_date, triggers[] }
  const extract = (text, meta) => {
    const m0 = meta || {}, out = [];
    const trig = m0.triggers ? trigRe(m0.triggers) : null;
    const head = s(text).slice(0, 2500);
    const pageOnTopic = !trig || trig.test(head);
    for (const sent of sentencesOf(text)) {
      const ds = dates(sent).filter(d => d.precision === 'day' || /\b(by|from|in|until|before|starting|effective)\s+$/i.test(sent.slice(Math.max(0, d.index - 14), d.index)));
      if (!ds.length) continue;
      if (trig && !trig.test(sent) && !pageOnTopic) continue;
      if (!MODAL.test(sent) && !DEADLINE.test(sent) && !AMEND.test(sent)) continue;
      const thr = thresholdOf(sent), subject = subjectOf(sent), subject_class = subjectClassOf(sent, thr);
      // an amendment: "from <old> to <new>" (or "<old> ... extended to <new>") -> the new date supersedes the old one, the old one is not a fact
      const superseded = {};
      if (AMEND.test(sent)) {
        for (const m of sent.matchAll(new RegExp('\\bfrom\\s+([^.;]{3,40}?)\\s+to\\s+([^.;]{3,40})', 'gi'))) {
          const a = dates(m[1])[0], b = dates(m[2])[0]; if (a && b && a.iso !== b.iso) superseded[b.iso] = a.iso;
        }
        if (!Object.keys(superseded).length && ds.length === 2 && /\b(extend|postpon|mov|push|delay|defer)/i.test(sent) && ds[0].iso < ds[1].iso) superseded[ds[1].iso] = ds[0].iso;
      }
      const oldDates = new Set(Object.values(superseded));
      let from = 0;
      for (const d of ds) {
        if (oldDates.has(d.iso)) { from = d.end; continue; }
        // the clause that ends at this date: from the last boundary ("and shall", ";", the previous date) to the date
        let clause = sent.slice(from, d.index);
        const cut = Math.max(clause.search(/;(?![^;]*;)/), clause.lastIndexOf(' and '), clause.lastIndexOf(', and '));
        const vbFull = verbOf(clause);
        const lastAnd = clause.lastIndexOf(' and ');
        if (lastAnd >= 0 && vbFull && vbFull.index > lastAnd) clause = clause.slice(lastAnd + 5);
        else if (cut > 0 && vbFull && vbFull.index > cut) clause = clause.slice(cut + 1);
        let vb = verbOf(clause);
        // "... to appoint an accredited service provider from 31 July 2026 to 30 October 2026": the new date's own clause is " to ", so
        // its verb is the last one before it in the sentence
        if (!vb) { clause = sent.slice(0, d.index); vb = verbOf(clause.replace(/\bfrom\s+[^.;]{3,40}?\s+to\s*$/i, '')); }
        let obligation = obligationOf(clause, vb);
        if (!vb && /\bdeadline\b/i.test(clause)) { vb = { verb: 'deadline', index: 0 }; obligation = 'deadline'; }
        if (!vb || !obligation) { from = d.end; continue; }
        out.push({ topic: m0.topic || '', date: d.iso, precision: d.precision, verb: vb.verb, obligation: obligation.slice(0, 140), subject, subject_class,
          threshold: thr.threshold, url: s(m0.url), paragraph: sent.slice(0, 500), role: m0.role || 'official', source_tier: m0.tier == null ? null : m0.tier,
          source_date: s(m0.source_date), supersedes: superseded[d.iso] || '', amendment: !!superseded[d.iso] });
        from = d.end;
      }
    }
    // the same obligation said twice on one page keeps one row (the one that names what it supersedes, else the first)
    const seen = new Map();
    for (const f of out) { const k = f.verb + '|' + f.subject_class + '|' + f.date; const o = seen.get(k); if (!o || (!o.supersedes && f.supersedes)) seen.set(k, f); }
    return [...seen.values()];
  };
  // when the source was published: the reader's header, then a dated upload path (/2026/05/) or a dated file name (-20260514)
  const sourceDate = (url, text) => {
    const p = s(text).match(/^Published Time:\s*(\d{4}-\d{2}-\d{2})/m); if (p) return p[1];
    const f = s(url).match(/[-_](20\d{2})(\d{2})(\d{2})(?=[-_.]|$)/); if (f && validDay(+f[1], +f[2], +f[3])) return f[1] + '-' + f[2] + '-' + f[3];
    const u = s(url).match(/\/(20\d{2})\/(\d{2})\//); if (u && +u[2] >= 1 && +u[2] <= 12) return u[1] + '-' + u[2];
    return '';
  };

  // ---------- which pages to read (shared by the SearXNG path and the DataForSEO fallback) ----------
  // tasks[i] is the search whose answer is results[i] (an array of { url, title, content }). Per topic: the official text on file first,
  // then up to OFFICIAL official pages (a dated upload path first: the newest decision), then up to SECONDARY independent secondary
  // sources on different sites (the second tier needs two that agree); then the client's own posts; at most MAX_READS pages in all.
  const OFFICIAL = 2, SECONDARY = 3, MAX_READS = 12;
  // FU-SV (merge 2026-10-30): a search result that is a search-engine redirect is read as the page it leads to when the redirect carries
  // it (the source kit's SRC.unwrap, inlined in the nodes that pick); an opaque one (google.com/goto?url=<token>) is never picked
  const target = (u) => { const x = s(u).trim(); if (typeof SRC === 'undefined' || !SRC.isRedirect(x)) return x; return SRC.unwrap(x) || ''; };
  const pick = (plan, tasks, results, data, market) => {
    const P = plan || {}, out = [], seen = new Set(), hints = [];
    const add = (x) => { const k = urlKey(x.url); if (!k || seen.has(k) || out.length >= MAX_READS) return false; seen.add(k); out.push(x); return true; };
    const KIND = { amendment: 0, deadline: 1, secondary: 2 };
    for (const t of P.topics || []) {
      const offDomains = (t.official || []).concat((market || {}).official || []);
      const rows = [];
      (tasks || []).forEach((q, i) => { if (!q || q.topic !== t.id) return;
        (Array.isArray(results[i]) ? results[i] : []).forEach((r, rank) => { const url = target(r && r.url); if (!/^https?:\/\//i.test(url)) return;
          rows.push({ url, title: clean(r.title).slice(0, 160), snippet: clean(r.content || r.description).slice(0, 300), host: host(url), kind: q.kind, rank }); }); });
      for (const r of rows) if (r.kind === 'amendment' && AMEND.test(r.title + ' ' + r.snippet) && hints.length < 4) hints.push({ topic: t.id, url: r.url, title: r.title });
      for (const k of (P.known_reads || []).filter(x => x.topic === t.id)) add({ read: true, topic: t.id, role: 'official', url: k.url, title: '', snippet: '', via: 'on file' });
      const off = rows.filter(r => onDomain(r.host, offDomains))
        .sort((a, b) => (sourceDate(b.url) > sourceDate(a.url) ? 1 : sourceDate(b.url) < sourceDate(a.url) ? -1 : (KIND[a.kind] - KIND[b.kind]) || (a.rank - b.rank)));
      let n = 0; for (const r of off) { if (n >= OFFICIAL) break; if (add({ read: true, topic: t.id, role: 'official', url: r.url, title: r.title, snippet: r.snippet, via: r.kind })) n++; }
      const sites = new Set(); let m = 0;
      for (const r of rows.filter(x => isSecondary(x.host, data)).sort((a, b) => (KIND[a.kind] - KIND[b.kind]) || (a.rank - b.rank))) {
        const site = registrable(r.host); if (m >= SECONDARY || sites.has(site)) continue;
        if (add({ read: true, topic: t.id, role: 'secondary', url: r.url, title: r.title, snippet: r.snippet, via: r.kind })) { sites.add(site); m++; }
      }
    }
    for (const o of P.own_posts || []) add({ read: true, topic: o.topic, role: 'own', url: o.url, title: '', snippet: '', via: 'own site' });
    return { reads: out, hints };
  };

  // ---------- status, against the day the page is written ----------
  const statusOf = (f, asOf) => { const e = endOf(f.date); if (!e || !asOf) return 'unknown';
    if (e >= asOf) return 'upcoming';
    return /^(implement|start)$/.test(f.verb) ? 'in_force' : 'passed'; };
  const TIER = { official: 1, on_file: 1, secondary_pair: 2 };

  // ---------- one fact per obligation ----------
  // cands: facts from REG.extract (role official / secondary / own) and the data file's `known` rows (role on_file)
  // opts: { asOf, data, market }
  const resolve = (cands, opts) => {
    const o = opts || {}, chosen = [], notes = [], conflicts = [];
    const keyOf = (f) => f.topic + '|' + (f.verb === 'deadline' ? 'deadline' : f.verb) + '|' + f.subject_class;
    const groups = new Map();
    for (const f of cands || []) { if (!f || !f.date || f.role === 'own') continue; const k = keyOf(f); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    for (const [k, list] of groups) {
      const official = list.filter(f => f.role === 'official' || f.role === 'on_file');
      if (official.length) {
        // the latest dated source wins; an undated source never beats a dated one; on the same source date, the one that names what it
        // supersedes wins, then the official text read live over the copy on file
        const rank = (f) => [s(f.source_date) || '0000', f.supersedes ? 1 : 0, f.role === 'official' ? 1 : 0];
        const sorted = official.slice().sort((a, b) => { const A = rank(a), B = rank(b); for (let i = 0; i < 3; i++) { if (A[i] > B[i]) return -1; if (A[i] < B[i]) return 1; } return 0; });
        const top = sorted[0];
        const rivals = sorted.filter(f => f.date !== top.date);
        const sameRank = rivals.filter(f => s(f.source_date) === s(top.source_date) && !!f.supersedes === !!top.supersedes);
        if (sameRank.length && !top.supersedes) { conflicts.push({ key: k, dates: [top.date].concat(sameRank.map(f => f.date)), urls: [top.url].concat(sameRank.map(f => f.url)).slice(0, 4),
          reason: 'official sources of the same date state different dates for the same obligation' }); continue; }
        const older = rivals.filter(f => f.date < top.date || s(f.source_date) < s(top.source_date)).map(f => f.date).sort().reverse();
        const twins = official.filter(f => f.date === top.date);
        const supersedes = top.supersedes || twins.map(f => f.supersedes).find(Boolean) || (older.length ? older[0] : '');
        const instrument = top.instrument || twins.map(f => f.instrument).find(Boolean) || '';
        chosen.push({ ...top, supersedes, instrument, source_kind: top.role === 'on_file' ? 'official_on_file' : 'official', source_tier: TIER[top.role] || 1, reported_by: [host(top.url)] });
        continue;
      }
      // the second tier: two independent secondary sources (different registrable sites) that state the same date
      const sec = list.filter(f => f.role === 'secondary');
      const byDate = new Map();
      for (const f of sec) { if (!byDate.has(f.date)) byDate.set(f.date, []); byDate.get(f.date).push(f); }
      const pairs = [...byDate.entries()].map(([date, fs]) => { const sites = [...new Map(fs.map(f => [registrable(host(f.url)), f])).values()];
        return { date, sites, newest: sites.map(f => s(f.source_date)).sort().reverse()[0] || '', supersedes: (fs.find(f => f.supersedes) || {}).supersedes || '' }; })
        .filter(p => p.sites.length >= 2);
      if (!pairs.length) { if (sec.length) notes.push({ key: k, reason: 'only one independent source states it (' + [...new Set(sec.map(f => registrable(host(f.url))))].slice(0, 3).join(', ') + '), so it is not used' }); continue; }
      let pick = pairs[0];
      if (pairs.length > 1) {
        const superseded = new Set(pairs.map(p => p.supersedes).filter(Boolean));
        const live = pairs.filter(p => !superseded.has(p.date));
        const dated = live.filter(p => p.newest).sort((a, b) => (a.newest < b.newest ? 1 : -1));
        if (live.length === 1) pick = live[0];
        else if (dated.length && (dated.length === 1 || dated[0].newest !== dated[1].newest) && dated.length === live.length) pick = dated[0];
        else { conflicts.push({ key: k, dates: pairs.map(p => p.date), urls: pairs.flatMap(p => p.sites.map(f => f.url)).slice(0, 4),
          reason: 'independent sources agree in pairs on different dates and none is dated later than the other' }); continue; }
      }
      const a = pick.sites[0], b = pick.sites[1];
      const others = pairs.filter(p => p !== pick).map(p => p.date).sort().reverse();
      chosen.push({ ...a, supersedes: pick.supersedes || a.supersedes || (others.length && others[0] < pick.date ? others[0] : ''), source_kind: 'secondary_pair', source_tier: 2,
        source_date: pick.newest, reported_by: [registrable(host(a.url)), registrable(host(b.url))], urls: [a.url, b.url] });
    }
    for (const f of chosen) f.status = statusOf(f, o.asOf);
    chosen.sort((a, b) => (a.topic === b.topic ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) : (a.topic < b.topic ? -1 : 1)));
    return { chosen, notes, conflicts };
  };

  // the client's own posts are read for consistency only: a date one of them states for an obligation we confirmed differently
  const ownConflicts = (ownFacts, chosen) => {
    const out = [];
    for (const f of ownFacts || []) {
      const c = (chosen || []).find(x => x.topic === f.topic && x.verb === f.verb && x.subject_class === f.subject_class);
      if (c && c.date !== f.date) out.push({ url: f.url, says: fmt(f.date), current: fmt(c.date), obligation: c.obligation, superseded: c.supersedes === f.date });
    }
    const seen = new Set(); return out.filter(x => { const k = x.url + '|' + x.says; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
  };

  // ---------- the block the brief and the writer print ----------
  const STATUS_WORDS = { upcoming: 'upcoming', passed: 'passed', in_force: 'in force', unknown: 'status unknown' };
  const sourceLine = (f) => f.source_kind === 'secondary_pair'
    ? 'reported by ' + (f.reported_by || []).join(' and ') + ' (no official text could be read; write "as reported by ' + (f.reported_by || []).join(' and ') + '" and link ' + (f.urls || [f.url]).join(' and ') + ')'
    : 'official: ' + (f.instrument ? f.instrument + ', ' : '') + f.url;
  const digest = (reg) => {
    const r = reg || {};
    if (!r.topics || !r.topics.length) return '';
    const L = ['REGULATORY FACTS (' + s(r.market_name) + ', as of ' + fmt(r.as_of) + ', the day this page is written; read on official sources by this run, never from memory)'];
    for (const t of r.topics) {
      const fs = (r.facts || []).filter(f => f.topic === t.id);
      L.push('Topic: ' + t.label + (t.relevance === 'core'
        ? ' (this page is about it: state the current timeline below in the section where the reader decides, each date with what it means today and its source link)'
        : ' (the business works on it: mention it only where it changes the reader\'s decision, once, in a sentence or a table row with its source link; never add a section for it)'));
      if (!fs.length) { L.push('- No current date could be confirmed on an official source or by two independent sources that agree. Write no date, deadline or threshold for it'
        + (t.official && t.official.length ? '; if the reader needs one, tell them to check ' + t.official.slice(0, 2).join(' or ') : '') + '.'); continue; }
      for (const f of fs) {
        const when = f.status === 'passed' ? 'was ' + fmt(f.date) + ' (passed: write it in the past tense, never as coming)' : f.status === 'in_force' ? 'since ' + fmt(f.date) + ' (in force)' : 'by ' + fmt(f.date) + ' (upcoming)';
        L.push('- ' + (f.subject ? f.subject.replace(/\s*\((phase \d)\)$/i, ' ($1)') + ': ' : '') + f.obligation + ' ' + when + (f.threshold ? '. Threshold: ' + f.threshold : '') + '. Source: ' + sourceLine(f) + '.'
          + (f.supersedes ? ' This replaces the earlier date ' + fmt(f.supersedes) + ': never write the earlier date as current.' : ''));
      }
    }
    L.push('RULES: dates, deadlines and thresholds for these topics come only from this block, quoted with their source link. Write each as a date ("by 30 October 2026"), never "next month", "tomorrow" or "in N days", because the page is read long after today. A deadline marked passed is written as passed, with what follows from it. Do not add a date this block does not give.');
    return L.join('\n');
  };

  // ---------- what Content QA records (no score: Wave 2's accuracy items read it) ----------
  const dateForms = (iso) => { const m = s(iso).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); if (!m) return [];
    const y = m[1], mo = MONTH_NAMES[+m[2]], ab = mo.slice(0, 3), d = m[3] ? String(+m[3]) : '';
    return d ? [d + '(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:' + mo + '|' + ab + ')\\.?,?\\s+' + y, '(?:' + mo + '|' + ab + ')\\.?\\s+' + d + '(?:st|nd|rd|th)?,?\\s+' + y, y + '-' + m[2] + '-' + m[3]]
      : ['(?:' + mo + '|' + ab + ')\\.?,?\\s+' + y]; };
  const hasDate = (md, iso) => dateForms(iso).some(p => new RegExp('\\b' + p + '\\b', 'i').test(s(md)));
  const qa = (md, reg) => {
    const r = reg || null;
    if (!r || !r.topics || !r.topics.length) return { required: false, stated: null, status: r ? 'not_applicable' : 'not_checked', source_tier: null, missing: [], stale: [], passed_as_upcoming: [] };
    const core = new Set(r.topics.filter(t => t.relevance === 'core').map(t => t.id));
    const facts = (r.facts || []).filter(f => f.verb !== 'start' || core.has(f.topic));
    const req = facts.filter(f => core.has(f.topic) && f.status !== 'in_force');
    const stated = facts.filter(f => hasDate(md, f.date));
    const missing = req.filter(f => !hasDate(md, f.date)).map(f => ({ topic: f.topic, date: f.date, obligation: f.obligation }));
    const stale = facts.filter(f => f.supersedes && hasDate(md, f.supersedes) && !hasDate(md, f.date)).map(f => ({ topic: f.topic, written: f.supersedes, current: f.date }));
    const passed_as_upcoming = [];
    for (const f of facts.filter(x => x.status === 'passed')) for (const sent of sentencesOf(md)) {
      if (!hasDate(sent, f.date)) continue;
      if (/\b(was|were|passed|closed|ended|expired|has been|had|lapsed|already)\b/i.test(sent)) continue;
      if (/\b(by|before|ahead of|upcoming|will|must|need to|deadline is|deadline of|until)\b/i.test(sent)) passed_as_upcoming.push({ date: f.date, sentence: sent.slice(0, 240) });
    }
    const coreNone = r.topics.some(t => t.relevance === 'core' && !(r.facts || []).some(f => f.topic === t.id));
    const status = stale.length || passed_as_upcoming.length ? 'stale_date' : !core.size ? 'not_required' : coreNone && !req.length ? 'none_confirmed'
      : missing.length ? 'missing' : 'stated';
    const tiers = stated.map(f => f.source_tier).filter(x => x != null);
    return { required: core.size > 0 && req.length > 0, stated: stated.length, required_facts: req.length, status, source_tier: tiers.length ? Math.min(...tiers) : null,
      missing, stale, passed_as_upcoming: passed_as_upcoming.slice(0, 4) };
  };

  return { MAX_TOPICS, MAX_FACTS_TOPIC, MAX_CONTEXT_FACTS, host, registrable, onDomain, urlKey, dates, fmt, endOf, asOfFor, zoneOf, dayFor, addDays, marketOf, touches, topicsOf, officialOf,
    queries, isSecondary, extract, sourceDate, pick, statusOf, resolve, ownConflicts, digest, qa, hasDate, sentencesOf };
})();
// W0-F (page-quality programme 2026-10-29, PLAN §3 Fix 6; REVIEW_EVIDENCE H5): the dated obligations this page may state, each with its
// source, its source's date, the day it is true as of, what it supersedes and its status on the day the page is written. Every route of
// the regulatory step ends here (nothing to research, nothing found, pages read), and it always answers ONE item: the competitor reading
// it was given plus `regulatory` (the summary, the REGULATORY FACTS block the brief and the writer print, what was read and why a source
// was not used), `regulatory_facts` (the PRC shape, read by Build Webhook Response) and `regulatory_sources` (the same facts as citable
// sources, which *Collect Facts* puts first in the run's verified facts so the figure check and the evidence plan know them).
// Rules: the official text first; the latest dated official source wins and records the date it supersedes (31 July 2026 -> 30 October
// 2026 for the UAE phase 1 provider deadline); with no official text read, two independent secondary sources that agree, labelled as
// reported by them; one secondary source alone is never used; else "none could be confirmed". The client's own posts are read only to tell
// the client where they still say an old date. A failure anywhere here never stops the page: the run goes on without the block.
const base = $('Analyze Competitor Pages').first().json || {};
const one = (regulatory, regulatory_facts, regulatory_sources) => [{ json: { ...base, regulatory, regulatory_facts: regulatory_facts || [], regulatory_sources: regulatory_sources || [] } }];
try {
  const firstOf = (n) => { try { return $(n).all().map(i => i.json || {}); } catch (e) { return null; } };
  const planItems = firstOf('Regulatory Plan') || [];
  const plan = (planItems[0] || {}).regulatory_plan || { topics: [] };
  if (!planItems.length || (planItems[0] || {}).skip) {
    return one({ status: 'not_applicable', reason: (planItems[0] || {}).reason || 'the regulatory step did not run', market: plan.market || '', market_name: plan.market_name || '',
      as_of: plan.as_of || '', topics: [], facts: [], sources_read: [], not_used: [], own_posts: [], hints: [], digest: '' });
  }
  const market = REG.marketOf(REGULATORS, plan.market) || { topics: {}, official: [] };
  const asOf = plan.as_of;
  // the candidates the pages were read for: the paid fallback's when it ran, else the free search's
  const serpC = firstOf('Regulatory SERP Candidates');
  const freeC = firstOf('Regulatory Candidates') || [];
  const candsAll = (serpC && serpC.length ? serpC : freeC).filter(c => c && c.read);
  const searched = ((serpC && serpC.length ? serpC : freeC)[0] || {}).searched || null;
  const hints = ((serpC && serpC.length ? serpC : freeC)[0] || {}).hints || [];
  const reads = candsAll.length ? (firstOf('Read Regulatory Pages') || []) : [];
  const textOf = (r) => String((r && (r.page_text ?? r.data ?? r.body)) || '');
  const WALL = /\b(just a moment|attention required|access denied|enable javascript and cookies|verify you are human|captcha|request blocked|403 forbidden)\b/i;
  const cands = [], sources_read = [];
  candsAll.forEach((c, i) => {
    const r = reads[i]; const text = textOf(r);
    const T = (market.topics || {})[c.topic] || {};
    let state = 'read';
    if (!r) state = 'not read';
    else if (r.error || !text.trim()) state = 'could not be read' + (r.error ? ' (' + String(r.error.message || r.error).slice(0, 80) + ')' : '');
    else if (text.length < 4000 && WALL.test(text)) state = 'blocked by a bot wall';
    if (state !== 'read') { sources_read.push({ url: c.url, role: c.role, topic: c.topic, state, facts: 0 }); return; }
    const facts = REG.extract(text, { topic: c.topic, url: c.url, role: c.role, tier: c.role === 'official' ? 1 : c.role === 'secondary' ? 2 : null,
      source_date: REG.sourceDate(c.url, text), triggers: T.triggers || [] });
    facts.forEach(f => cands.push(f));
    sources_read.push({ url: c.url, role: c.role, topic: c.topic, state: facts.length ? 'read' : 'read, no dated obligation found', facts: facts.length, source_date: REG.sourceDate(c.url, text) });
  });
  // the dated obligations a person read on the official text itself (v5/data/regulators.json `known`), while they are fresh
  for (const t of plan.topics || []) { const T = (market.topics || {})[t.id] || {}; if (T.fresh_until && T.fresh_until < asOf) continue;
    for (const k of T.known || []) cands.push({ ...k, topic: t.id, role: 'on_file', precision: /^\d{4}-\d{2}-\d{2}$/.test(k.date) ? 'day' : 'month', source_tier: 1, amendment: !!k.supersedes }); }
  // old obligations are not news: a date more than 400 days before today is left out
  const floor = REG.addDays(asOf, -400);
  const recent = cands.filter(f => REG.endOf(f.date) >= floor);
  const R = REG.resolve(recent.filter(f => f.role !== 'own'), { asOf });
  const relevance = new Map((plan.topics || []).map(t => [t.id, t.relevance]));
  // per topic, in date order; over the cap, the oldest date that has already passed or come into force goes first, then the furthest away
  const facts = [];
  for (const t of plan.topics || []) {
    const mine = R.chosen.filter(f => f.topic === t.id && !(relevance.get(t.id) !== 'core' && f.verb === 'start' && f.status === 'in_force'))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const cap = relevance.get(t.id) === 'core' ? REG.MAX_FACTS_TOPIC : REG.MAX_CONTEXT_FACTS;
    while (mine.length > cap) { const k = mine.findIndex(f => f.status !== 'upcoming'); mine.splice(k >= 0 ? k : mine.length - 1, 1); }
    mine.forEach(f => facts.push(f));
  }
  const regulatory_facts = facts.map(f => ({ market: plan.market, topic: f.topic, date: f.date, obligation: f.obligation, subject: f.subject || '', threshold: f.threshold || '',
    url: f.url, paragraph: f.paragraph || '', source_tier: f.source_tier, source_date: f.source_date || '', as_of: asOf, supersedes: f.supersedes || '', status: f.status,
    source_kind: f.source_kind, reported_by: f.reported_by || [], ...(f.urls ? { urls: f.urls } : {}), ...(f.instrument ? { instrument: f.instrument } : {}), verb: f.verb, subject_class: f.subject_class }));
  // the same facts as citable sources for the run's verified facts (one per page and paragraph)
  const srcSeen = new Set(), regulatory_sources = [];
  for (const f of regulatory_facts) for (const u of (f.urls && f.urls.length ? f.urls : [f.url])) {
    const para = (f.urls && f.urls.length ? ((recent.find(x => x.url === u && x.date === f.date) || {}).paragraph || f.paragraph) : f.paragraph);
    const k = REG.urlKey(u) + '|' + para; if (!u || srcSeen.has(k)) continue; srcSeen.add(k);
    regulatory_sources.push({ claim: (para || (f.obligation + ' by ' + REG.fmt(f.date))).slice(0, 400),
      text: [f.instrument, para, (f.subject ? f.subject + ': ' : '') + f.obligation + ' by ' + REG.fmt(f.date) + (f.threshold ? ' (threshold: ' + f.threshold + ')' : '')].filter(Boolean).join(' - ').slice(0, 900),
      source: REG.host(u), url: u, title: (f.instrument || '').slice(0, 160), authority: 'high', year: f.date.slice(0, 4), regulatory: true, status: f.status, as_of: asOf });
  }
  // the client's own posts: dates they state for an obligation confirmed differently (advice for the client, never a source)
  const own = recent.filter(f => f.role === 'own');
  const ownConf = REG.ownConflicts(own, facts);
  const own_posts = sources_read.filter(x => x.role === 'own').map(x => ({ url: x.url, state: x.state, conflicts: ownConf.filter(c => c.url === x.url) }));
  const topics = (plan.topics || []).map(t => { const n = facts.filter(f => f.topic === t.id); const best = n.length ? Math.min(...n.map(f => f.source_tier || 9)) : null;
    return { ...t, facts: n.length, confirmed: n.length > 0, source_tier: best,
      basis: n.length ? n.length + ' dated obligation(s), ' + (best === 1 ? 'from the official text' : 'reported by two independent sources that agree (no official text could be read)')
        : 'none could be confirmed on an official source or by two independent sources that agree' }; });
  const not_used = R.notes.map(x => ({ ...x, kind: 'single_source' })).concat(R.conflicts.map(x => ({ ...x, kind: 'conflict' })));
  const regulatory = { status: facts.length ? 'confirmed' : 'none_confirmed', market: plan.market, market_name: plan.market_name, as_of: asOf, topics, facts: regulatory_facts,
    sources_read, not_used, own_posts, hints, searched, required: topics.some(t => t.relevance === 'core') };
  regulatory.digest = REG.digest({ ...regulatory, topics: topics.map(t => ({ ...t })) });
  return one(regulatory, regulatory_facts, regulatory_sources);
} catch (e) {
  return one({ status: 'error', reason: 'the regulatory step failed and the page goes on without it: ' + String((e && e.message) || e).slice(0, 200), topics: [], facts: [], sources_read: [],
    not_used: [], own_posts: [], hints: [], digest: '' });
}
