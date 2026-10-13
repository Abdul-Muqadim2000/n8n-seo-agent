// Turns the Error Trigger payload into a readable ops alert.
// R5 (2026-10-13, re-rating RESULTS §3.2): a TRIGGER-mode failure has no `execution` object at all -- it arrives as
// `{ trigger: { error: { message, description, cause, … } } }`. Live, execution 516 (the Console Alerts IMAP trigger failing at runtime and
// being deactivated) produced node "unknown node", message "no message" and an empty execution id, so the real cause never reached anybody.
// Both shapes are read here: the execution's error first, then the trigger's, and the failed node's name is taken from the trigger message
// when n8n only names it there ("The trigger node \"Mailbox Trigger\" failed at runtime …").
const e = $input.first().json;
const ex = e.execution || {};
const tr = e.trigger || {};
const err = ex.error || tr.error || {};
const wfName = (e.workflow || {}).name || 'unknown workflow';
const causeOf = (c, depth) => { if (!c || depth > 3) return ''; const m = String(c.message || c.description || '').trim(); return m || causeOf(c.cause, depth + 1); };
const named = String(err.message || err.description || '').match(/(?:trigger )?node ["'“”]([^"'“”]{1,120})["'“”]/i);
const node = ex.lastNodeExecuted || (err.node && (err.node.name || err.node)) || (named && named[1]) || (e.trigger ? 'trigger node' : 'unknown node');
const parts = [String(err.message || '').trim(), String(err.description || '').trim(), causeOf(err.cause, 0)].filter(Boolean);
const msg = ([...new Set(parts)].join(' — ') || 'no message').slice(0, 800);
const url = ex.url || tr.url || '';
const mode = ex.mode || (e.trigger ? 'trigger' : '');
const when = new Date().toISOString();
const subject = `[SEO Agent] ${mode === 'trigger' ? 'Trigger failed' : 'Run failed'} at "${node}" — ${wfName}`;
const html = `<p><b>Workflow:</b> ${wfName}<br><b>Execution:</b> ${ex.id || (mode === 'trigger' ? 'none (the trigger itself failed)' : '?')} (${mode}) ${url ? '— <a href="' + url + '">open</a>' : ''}<br><b>Failed node:</b> ${node}<br><b>When:</b> ${when}</p>
<pre style="background:#f1f5f9;padding:10px;white-space:pre-wrap">${msg.replace(/</g, '&lt;')}</pre>
<p>Typical causes: DataForSEO/Jina credentials or credits, a site that blocks readers, an AI response that was not valid JSON, a crawl that never finished, or — in trigger mode — a mailbox or schedule trigger n8n has deactivated after a runtime failure (re-activate it once the cause is fixed).<br>
If a customer is waiting for an emailed report, re-run the execution from the failed node or tell them what happened.</p>`;
return [{ json: { subject, html, node, workflow: wfName, execution_id: ex.id || null, execution_url: url, message: msg, mode, when } }];