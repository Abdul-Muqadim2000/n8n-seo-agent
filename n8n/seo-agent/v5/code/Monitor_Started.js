// Confirms the on-demand monitor run (form completion page / API callback stage ai_visibility_started or backlinks_started).
const d = $('Normalize Input').first().json; const s = $('Monitor Start').first().json;
let err = null; for (const nm of ['Start AI Visibility', 'Start Backlink Monitor']) { try { const r = ($(nm).first() || {}).json || {}; if (r.error) err = String(r.error.message || r.error).slice(0, 200); } catch (e) {} }
const ai = d.mode === 'ai_visibility'; const to = [d.email, d.callback_url ? 'your callback' : ''].filter(Boolean).join(' and ');
const summary = err ? 'The check could not be started (' + err + ').' : ai
  ? 'Your AI visibility check for ' + d.domain + ' has started: about 8 buyer questions are asked to ChatGPT, Perplexity, Gemini, Claude and Google AI Mode, and Google is checked for AI Overviews. The report (who AI recommends, which of your pages it cites, which sources it trusts, what to do) arrives at ' + (to || 'your address') + ' in about 5-10 minutes.'
  : 'Your backlink check for ' + d.domain + ' has started: links gained and lost, links to broken pages, spam, unlinked brand mentions and the sites that link to your competitors but not to you, with outreach drafts. The report arrives at ' + (to || 'your address') + ' in about 3-5 minutes.';
const plain = summary + (d.competitors && d.competitors.length ? '\n\nCompetitors compared: ' + d.competitors.join(', ') + '.' : '\n\nTip: name up to 3 competitors next time for a sharper comparison.') + '\n\nTo get this every week automatically, register the site with "Track my site".';
return [{ json: { ...d, status: err ? 'failed' : 'accepted', stage: (ai ? 'ai_visibility' : 'backlinks') + '_started', summary, plain, started: !err, error: err, request_id: s.request_id } }];
