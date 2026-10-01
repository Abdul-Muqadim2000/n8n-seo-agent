// body.workflow picks the target (default: SEO Agent v4); the rest of the body is forwarded like the API does.
const raw = $input.first().json || {}; const b = (raw.body && typeof raw.body === 'object') ? raw.body : {};
const target = String(b.workflow || 'SEOagentV4Full01');
const request_id = String(b.request_id || $execution.id);
return [{ json: { target, request_id, forward: { headers: raw.headers || {}, body: { ...b, workflow: undefined, request_id, client_ip: 'test-runner' } } } }];