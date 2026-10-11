// AI readiness of the key pages (v4.12): can an AI assistant read and quote the page? Scored on what the evidence supports (AI_GROWTH_SPEC.md §2):
// reachable and indexable (a 200, no noindex, under 4 MB — ChatGPT drops bigger pages), the text present in the raw HTML (ChatGPT, Claude,
// Perplexity and Gemini fetchers run no JavaScript), the answer in the first ~200 characters after the H1 (what ChatGPT's retriever sees of a
// page), a VISIBLE update date within 90 days (AI cites fresher pages; dates only in JSON-LD are stripped by ChatGPT), question headings, sourced
// figures, lists / tables, an author, an FAQ. Schema and llms.txt are reported but not scored (no measurable effect on AI citations).
// Bing's crawl state of each page comes from Bing Webmaster Tools (GetUrlInfo) when the site is in the Bing account.
const reqs = (() => { try { return $('Page Requests (Growth)').all().map(i => i.json); } catch (e) { return []; } })();
const res = (() => { try { return $('Fetch Key Pages').all().map(i => i.json); } catch (e) { return []; } })();
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
let bq = [], br = []; try { bq = $('Bing Growth Requests').all().map(i => i.json); br = $('Fetch Bing Growth').all().map(i => i.json); } catch (e) {}
const jsonOf = (r) => { if (!r) return {}; if (r.d !== undefined) return r; const b = r.body ?? r.data; if (b && typeof b === 'object') return b; try { return JSON.parse(b || '{}'); } catch (e) { return {}; } };
const dateOfMs = (v) => { const m = String(v || '').match(/Date\((-?\d+)/); if (!m) return ''; const t = Number(m[1]); return t > 946684800000 ? new Date(t).toISOString() : ''; };
const now = new Date(); const iso = now.toISOString();
const dec = (s) => String(s || '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'").replace(/&ldquo;|&rdquo;/gi, '"').replace(/&ndash;|&mdash;/gi, '-').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)));
const strip = (h) => dec(String(h || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const words = (t) => String(t || '').split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length;
const hostOf = (u) => { const m = String(u || '').match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
const keyOf = (u) => { const m = String(u || '').trim().match(/^https?:\/\/(?:www\.)?([^\/?#]+)([^?#]*)/i); if (!m) return ''; return m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/'); };
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';
const DATE_RE = new RegExp('(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:' + MONTHS + ')\\.?,?\\s+\\d{4}|(?:' + MONTHS + ')\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|(?:' + MONTHS + ')\\.?\\s+\\d{4})', 'i');
const toIso = (s) => { const t = Date.parse(String(s).replace(/(\d)(st|nd|rd|th)/i, '$1')); return Number.isFinite(t) && t > 946684800000 && t < now.getTime() + 864e5 * 2 ? new Date(t).toISOString().slice(0, 10) : ''; };
const QWORD = /^(how|what|which|why|when|where|who|is|are|can|does|do|should|will|was|were)\b/i;
const out = [];
reqs.forEach((q, i) => {
  if (!q || q.skip) return;
  const p = plans.find(x => x.site_id === q.site_id); if (!p) return;
  const r = res[i] || {}; const status = Number(r.statusCode) || 0; const html = String(r.body ?? r.data ?? ''); const H = (r.headers || {});
  const hdr = (k) => String(H[k] || H[k.toLowerCase()] || '');
  const checks = []; const add = (key, ok, weight, label, fix, detail) => checks.push({ key, ok: ok === true ? true : ok === 'partial' ? 'partial' : false, weight, label, fix, detail: detail || '' });
  const reachable = status >= 200 && status < 300 && html.length > 200;
  const noindex = /<meta[^>]+name=["'](?:robots|googlebot|bingbot)["'][^>]*content=["'][^"']*noindex/i.test(html) || /noindex/i.test(hdr('x-robots-tag'));
  const canon = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) || [])[1] || '';
  const canonElsewhere = !!canon && /^https?:/i.test(canon) && keyOf(canon) !== keyOf(q.url);
  const tooBig = html.length > 4000000;
  add('reachable', reachable && !tooBig, 20, 'Answers with the page (HTTP ' + (status || 'no answer') + ')', status >= 300 || !status ? 'The page did not answer with 200 — fix the error or the redirect so assistants can read it.' : 'The page is over 4 MB of HTML — ChatGPT skips pages that large; trim inline code and data.', tooBig ? Math.round(html.length / 1e6) + ' MB' : '');
  add('indexable', reachable && !noindex && !canonElsewhere, 10, 'Indexable (no noindex, canonical to itself)', noindex ? 'Remove the noindex: search engines and the AI answers built on them drop the page.' : 'The canonical points to ' + canon + ' — AI and search engines treat that page as the original.', canonElsewhere ? canon : '');
  let score = 0, words_raw = 0, title = '', h1 = '', updated_on = '', updated_visible = false;
  if (reachable) {
    const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
    title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 160);
    const mainHtml = (clean.match(/<main\b[\s\S]*?<\/main>/i) || clean.match(/<article\b[\s\S]*?<\/article>/i) || clean.match(/<body\b[\s\S]*<\/body>/i) || [clean])[0].replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
    const text = strip(mainHtml); words_raw = words(text);
    h1 = strip((mainHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
    add('raw_text', words_raw >= 300 ? true : words_raw >= 120 ? 'partial' : false, 12, 'Text readable without JavaScript (' + words_raw + ' words in the raw HTML)', 'Most of the text needs JavaScript: ChatGPT, Claude, Perplexity and Gemini do not run it. Render the content on the server (SSR / static HTML).');
    // the answer right after the H1: what an assistant's retriever sees first (~200 characters)
    const afterH1 = h1 ? strip(mainHtml.slice(Math.max(0, mainHtml.search(/<\/h1>/i)) + 5)) : text;
    // the first real paragraph after the H1 (bylines and dates skipped) and where it starts
    const afterHtml = h1 ? mainHtml.slice(Math.max(0, mainHtml.search(/<\/h1>/i))) : mainHtml;
    const para = [...afterHtml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)].map(m => ({ attrs: m[1], text: strip(m[2]) })).find(x => words(x.text) >= 12 && !/byline|author|meta|date|breadcrumb|caption/i.test(x.attrs) && !/^(by\s|last updated|updated|published|reviewed|posted)/i.test(x.text));
    const firstP = para ? para.text : ''; const at = firstP ? afterH1.indexOf(firstP.slice(0, 40)) : -1; const lead = firstP ? afterH1.slice(Math.max(0, at), Math.max(0, at) + 220) : afterH1.slice(0, 220);
    const topical = (h1 || title).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3).some(w => firstP.toLowerCase().includes(w));
    const fp = words(firstP); const cta = /^(contact|book|call|get (a|your)|request|sign up|subscribe|learn more|read more|skip to)/i.test(firstP.trim());
    const ansOk = !!h1 && !!firstP && at >= 0 && at <= 400 && topical && !cta && fp >= 12 && fp <= 90;
    add('answer_first', ansOk ? true : (h1 && firstP && !cta) ? 'partial' : false, 14, 'Answers right after the H1 (first ~200 characters)', !h1 ? 'Add one H1 that states the topic or question, then answer it in the first sentence.' : 'Open with a 40-60 word direct answer to the H1 (no intro, no call to action first): assistants quote the first lines of a page.', lead.slice(0, 160));
    // a VISIBLE update date (fresh = 90 days); metadata-only dates are half credit (ChatGPT strips JSON-LD)
    const visM = text.match(new RegExp('(?:last\\s+updated|updated|last\\s+reviewed|reviewed|modified|published)\\s*(?:on|:)?\\s*' + DATE_RE.source, 'i')) || null;
    const timeM = (mainHtml.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1] || '';
    const metaM = (html.match(/property=["']article:modified_time["'][^>]*content=["']([^"']+)["']/i) || html.match(/"dateModified"\s*:\s*"([^"]+)"/i) || html.match(/"datePublished"\s*:\s*"([^"]+)"/i) || [])[1] || '';
    const visIso = visM ? toIso(visM[1]) : (timeM ? toIso(timeM) : ''); const metaIso = metaM ? toIso(metaM) : '';
    updated_on = visIso || metaIso; updated_visible = !!visIso;
    const age = updated_on ? (now - new Date(updated_on)) / 864e5 : Infinity;
    add('fresh', visIso && age <= 90 ? true : ((visIso && age <= 365) || (metaIso && age <= 90)) ? 'partial' : false, 14, 'Visible update date ' + (updated_on ? updated_on + (updated_visible ? '' : ' (only in the metadata)') : 'none found'),
      !updated_on ? 'Show "Last updated: <date>" near the top and update the page at least every 90 days with real changes — AI cites fresh pages far more often.' : age > 90 ? 'Last updated ' + Math.round(age) + ' days ago: refresh it with new facts and show the new date — pages not updated for 3+ months lose AI citations.' : 'The date is only in the metadata: show it on the page ("Last updated: …").');
    const heads = [...mainHtml.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => strip(m[2])).filter(Boolean);
    const qh = heads.filter(h => /\?\s*$/.test(h) || QWORD.test(h)).length;
    add('question_headings', qh >= 2 ? true : qh === 1 ? 'partial' : false, 7, qh + ' question-style heading(s) of ' + heads.length, 'Phrase 2+ section headings as the questions buyers ask (each answered in its first sentence): assistants match questions to passages.');
    add('structure', heads.length >= 3, 4, heads.length + ' H2/H3 sections', 'Break the page into clear H2 sections, one sub-question each.');
    const nums = (text.match(/\b\d[\d,.]*\s?(%|percent|per cent|million|billion|bn|k\b|x\b|days|weeks|months|hours|AED|USD|SAR|\$)/gi) || []).length + (text.match(/[$€£]\s?\d/g) || []).length;
    const outLinks = [...mainHtml.matchAll(/<a\b[^>]+href=["'](https?:\/\/[^"'#]+)["']/gi)].map(m => hostOf(m[1])).filter(h => h && h !== p.domain && !h.endsWith('.' + p.domain) && !/(facebook|twitter|x|linkedin|instagram|youtube|wa\.me|whatsapp|t\.me)\./.test(h + '.'));
    add('sourced_figures', nums >= 3 && new Set(outLinks).size >= 2 ? true : (nums >= 2 || new Set(outLinks).size >= 1) ? 'partial' : false, 7, nums + ' figures, ' + new Set(outLinks).size + ' outside sources linked', 'Add concrete figures with their source linked (an official or research page): statistics and cited sources raise AI visibility by 30-40% in the GEO study.');
    const lists = (mainHtml.match(/<table\b/gi) || []).length + [...mainHtml.matchAll(/<(ul|ol)\b[\s\S]*?<\/\1>/gi)].filter(m => (m[0].match(/<li\b/gi) || []).length >= 3).length;
    add('lists_tables', lists >= 1, 4, lists + ' list(s) / table(s)', 'Put comparisons, steps and figures into a table or list: assistants lift them whole.');
    const author = /rel=["']author["']|class=["'][^"']*\b(author|byline)\b|"@type"\s*:\s*"Person"|\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(html);
    add('author', author, 5, author ? 'Author shown' : 'No author', 'Show who wrote or reviewed it (name, role, credentials): experience signals help AI and Google trust the page.');
    const faq = heads.some(h => /faq|frequently asked/i.test(h)) || /"@type"\s*:\s*"FAQPage"/.test(html);
    add('faq', faq, 3, faq ? 'FAQ section' : 'No FAQ section', 'Add 3-6 short FAQs with the follow-up questions AI searches for.');
    checks.push({ key: 'schema', ok: /application\/ld\+json/i.test(html) ? true : false, weight: 0, label: /application\/ld\+json/i.test(html) ? 'Schema markup present' : 'No schema markup', fix: 'Schema helps rich results and Bing; it does not measurably change AI citations (informational).', detail: '' });
  }
  const total = checks.reduce((t, c) => t + c.weight, 0) || 100;
  score = reachable ? Math.round(100 * checks.reduce((t, c) => t + (c.ok === true ? c.weight : c.ok === 'partial' ? c.weight / 2 : 0), 0) / total) : 0;
  if (reachable && (noindex || canonElsewhere)) score = Math.min(score, 40);
  const bi = bq.findIndex(x => x && x.kind === 'info' && x.site_id === q.site_id && keyOf(x.page) === keyOf(q.url)); const bd = bi >= 0 ? (jsonOf(br[bi]).d || null) : null;
  const pr = (p.stored_pages || []).find(x => x.key === keyOf(q.url)) || {};
  const issues = checks.filter(c => c.ok !== true && c.weight > 0).sort((a, b) => b.weight - a.weight).map(c => c.fix);
  out.push({ json: { site_id: q.site_id, domain: p.domain, url: q.url, kind: q.kind, checked_at: iso, status, score, checks, issues, words_raw, title, h1, updated_on, updated_visible,
    bing_known: !!bd, bing_crawled_at: bd ? dateOfMs(bd.LastCrawledDate) : (pr.bing_crawled_at || ''), bing_status: bd ? (Number(bd.HttpStatus) || 0) : (Number(pr.bing_status) || 0), bing_discovered_at: bd ? dateOfMs(bd.DiscoveryDate) : '' } });
});
return out.length ? out : [{ json: { skip: true } }];
