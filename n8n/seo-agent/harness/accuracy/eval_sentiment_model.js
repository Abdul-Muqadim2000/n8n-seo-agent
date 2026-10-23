// W2-E2 (2026-10-23): scores the Sentiment Reader's MODEL (Claude Haiku, the prompt v5/prompts/ai_sentiment.txt, the parser SENT.parseModel)
// on the labelled set accuracy/ai_sentiment.json - the one figure the offline harness cannot measure. NOT RUN in the build (it is a paid call:
// 256 short Haiku calls, about $0.10). Run it with a key, then put the hold-out kappa into SENT.KAPPA.model in v5/code/_ai_sentiment.js
// (the report then stops saying "not yet validated" once it is >= 0.7):
//   ANTHROPIC_API_KEY=... node accuracy/eval_sentiment_model.js [--split holdout] [--model claude-haiku-4-5-20251001]
const fs = require('fs'); const path = require('path');
const { load } = require('./score_ai_sentiment.js');
const { SENT } = load();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const KEY = process.env.ANTHROPIC_API_KEY; if (!KEY) { console.error('set ANTHROPIC_API_KEY (never printed)'); process.exit(2); }
const MODEL = arg('--model', 'claude-haiku-4-5-20251001'); const SPLIT = arg('--split', null);
const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'v5', 'prompts', 'ai_sentiment.txt'), 'utf8');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_sentiment.json'), 'utf8')).cases.filter(c => !SPLIT || c.split === SPLIT);
const fill = (c) => tpl.replace(/\{\{\s*\$json\.business\s*\}\}/g, c.business).replace(/\{\{\s*\$json\.items_text\s*\}\}/g, 'PASSAGE 1 [chatgpt] rivals: ' + ((c.rivals || []).join(', ') || 'none') + '\nQ: (a buyer question)\n' + SENT.snippet(c.text, c.business, c.rivals || []));
(async () => { const rows = [];
  for (const c of cases) { let label = null;
    try { const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: fill(c) }] }) });
      const j = await r.json(); const txt = ((j.content || [])[0] || {}).text || ''; label = SENT.parseModel(txt, { items: [{ n: 1, key: c.id }] }).get(c.id) || null; } catch (e) { label = null; }
    rows.push({ c, m: label }); }
  const by = (f) => { const P = rows.filter(f); return { n: P.length, answered: P.filter(x => x.m).length, kappa: SENT.kappa(P.map(x => [x.c.polarity, x.m ? x.m.polarity : 'none'])) }; };
  const out = { model: MODEL, all: by(() => true) }; for (const s of [...new Set(cases.map(c => c.split))]) out[s] = by(x => x.c.split === s);
  console.log(JSON.stringify(out, null, 1)); })();
