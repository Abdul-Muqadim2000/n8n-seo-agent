// Real AI-assistant answers via DataForSEO's LLM Responses API (ChatGPT with web search, Perplexity).
// Each item becomes one request to the endpoint in `endpoint` with body `body`.
const base = $('Parse Content Review').first().json;
const q = $('AI Queries').first().json;
const country = base.country || '';
const iso = base.country_iso || 'US';
const brand = q.brand_name || base.domain.split('.')[0];
const category = q.category_query || ('best ' + (base.domain.split('.')[0]) + ' alternatives');

const cut = (s, n) => String(s).slice(0, n);
const whoPrompt = cut('What is ' + brand + ' (' + base.domain + ')? What does the company do, where is it based and who is it for? Answer in 3 sentences. If you cannot find it, say exactly: I could not find this company.', 490);
const recPrompt = cut('I need to choose a provider. Which are the ' + category.replace(/\bbest\b/i, 'best').trim() + '? Give me up to 8 companies with their website domains, best first, one line each.', 490);

const items = [
  { platform: 'chat_gpt', kind: 'who', prompt: whoPrompt,
    endpoint: 'https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live',
    body: [{ user_prompt: whoPrompt, model_name: 'gpt-4.1-mini', web_search: true, web_search_country_iso_code: iso, max_output_tokens: 400, temperature: 0.2 }] },
  { platform: 'chat_gpt', kind: 'recommend', prompt: recPrompt,
    endpoint: 'https://api.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live',
    body: [{ user_prompt: recPrompt, model_name: 'gpt-4.1-mini', web_search: true, web_search_country_iso_code: iso, max_output_tokens: 700, temperature: 0.2 }] },
  { platform: 'perplexity', kind: 'recommend', prompt: recPrompt,
    endpoint: 'https://api.dataforseo.com/v3/ai_optimization/perplexity/llm_responses/live',
    body: [{ user_prompt: recPrompt, model_name: 'sonar', max_output_tokens: 700, temperature: 0.2 }] }
];

return items.map(it => ({ json: { ...it, brand, category, country } }));
