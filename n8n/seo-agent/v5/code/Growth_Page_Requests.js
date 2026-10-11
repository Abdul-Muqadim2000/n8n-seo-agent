// The key pages to check this week (AI Readiness): the raw HTML as an AI assistant's fetcher gets it — no JavaScript (ChatGPT, Claude, Perplexity
// and Gemini fetchers do not run it; only Copilot's does).
const plans = $('Growth Plan').all().map(i => i.json).filter(p => !p.nothing_to_do);
const out = plans.flatMap(p => p.audit.map(a => ({ json: { site_id: p.site_id, url: a.url, kind: a.kind } })));
return out.length ? out : [{ json: { skip: true } }];
