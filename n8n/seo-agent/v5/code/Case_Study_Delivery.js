// Restores the case-study intake after the Data Table steps and the spawn, and tells the owner what happens next.
const r = $('Case Study Row').first().json; const d = $('Normalize Input').first().json;
const errOf = (name) => { try { const s = ($(name).first() || {}).json || {}; return s.error ? String(s.error.message || s.error.description || s.error).slice(0, 200) : null; } catch (e) { return 'step did not run: ' + String(e.message || e).slice(0, 120); } };
const store_error = errOf('Save Case Study'); const spawn_error = errOf('Start Case Study Run');
const hints = [];
if (!/\d/.test(r.results)) hints.push('the results carry no numbers — before/after figures (time, cost, error rate, revenue) make a case study convincing');
if (!r.quote) hints.push('a short client quote (with name and role) adds the strongest proof');
if (!r.timeline) hints.push('a timeline (weeks or dates) makes the project concrete');
const to = [d.email, d.callback_url ? 'your callback' : ''].filter(Boolean).join(' and ');
const summary = (spawn_error ? 'The case study could not be started (' + spawn_error + ').' : 'Your case study "' + r.title + '" is being written (about 10-15 minutes) and will be sent to ' + (to || 'you') + ': the PDF report plus the ready-to-publish article (HTML, Markdown, meta.json).')
  + (store_error ? ' The facts could not be stored (' + store_error + ').' : ' Its facts are stored as proof: later pages for ' + d.domain + ' may cite them, with a link once the case study is published.');
const plain = summary + (hints.length ? '\n\nTo make the next one stronger: ' + hints.join('; ') + '.' : '') + '\n\nWhen it is live, report the link with "I published a page" (keyword: ' + r.keyword + ').';
return [{ json: { ...d, case_id: r.case_id, case_title: r.title, keyword: r.keyword, request_id: r.request_id, stored: !store_error, store_error, started: !spawn_error, spawn_error, hints, summary, plain, status: spawn_error ? 'failed' : 'accepted', stage: 'case_study_started' } }];
