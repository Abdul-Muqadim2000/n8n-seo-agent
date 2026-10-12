// Turns the Error Trigger payload into a readable ops alert.
const e = $input.first().json;
const ex = e.execution || {};
const err = ex.error || {};
const wfName = (e.workflow || {}).name || 'unknown workflow';
const node = ex.lastNodeExecuted || (err.node && err.node.name) || 'unknown node';
const msg = String(err.message || err.description || 'no message').slice(0, 800);
const url = ex.url || '';
const mode = ex.mode || '';
const when = new Date().toISOString();
const subject = `[SEO Agent] Run failed at "${node}" — ${wfName}`;
const html = `<p><b>Workflow:</b> ${wfName}<br><b>Execution:</b> ${ex.id || '?'} (${mode}) ${url ? '— <a href="' + url + '">open</a>' : ''}<br><b>Failed node:</b> ${node}<br><b>When:</b> ${when}</p>
<pre style="background:#f1f5f9;padding:10px;white-space:pre-wrap">${msg.replace(/</g, '&lt;')}</pre>
<p>Typical causes: DataForSEO/Jina credentials or credits, a site that blocks readers, an AI response that was not valid JSON, or a crawl that never finished.<br>
If a customer is waiting for an emailed report, re-run the execution from the failed node or tell them what happened.</p>`;
return [{ json: { subject, html, node, workflow: wfName, execution_id: ex.id || null, execution_url: url, message: msg, mode, when } }];