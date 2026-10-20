// F-ENG (2026-10-20): the harness's n8n public API for executions, answering as n8n 2.41.4 does - read in the image, not assumed:
//   dist/public-api/v1/controllers/executions.public.controller.js  getExecutions: `excludeRunning: query.status !== 'running'` (the default
//     list NEVER shows a running execution), cursor paging (`nextCursor` = base64 {lastId, limit} while more match, else null), limit
//     default 100, max 250 (api-types publicApiPaginationSchema / MAX_ITEMS_PER_PAGE); getExecution: one execution whatever its status, 404
//     "Not Found" when it is not there
//   @n8n/db execution.repository.js  order id DESC; `startedAfter` / `startedBefore` both INCLUSIVE on startedAt (MoreThanOrEqual /
//     LessThanOrEqual), so an execution with no startedAt is left out when either is given; `lastId` (the cursor) = id < lastId
//   api-types list-executions-query.dto.js  startedAfter / startedBefore must be ISO datetimes with an offset (else 400)
// The answer is what the HTTP Request node hands on with fullResponse + neverError: { statusCode, headers, body }.
// execs: [{ id, workflowId, mode, status, startedAt, stoppedAt }]
const fakeN8nApi = (execs, o = {}) => (url) => {
  if (o.fail) return { statusCode: o.fail, headers: {}, body: { message: 'unauthorized' } };
  const u = String(url), [pathPart, qs = ''] = u.split('?');
  const rows = (execs || []).map(x => ({ finished: x.status === 'success', mode: 'integrated', retryOf: null, retrySuccessId: null, stoppedAt: null, waitTill: null, ...x, id: String(x.id) }));
  const one = /\/executions\/([^/]+)$/.exec(pathPart);
  if (one) { const x = rows.find(e => e.id === decodeURIComponent(one[1])); return x ? { statusCode: 200, headers: {}, body: x } : { statusCode: 404, headers: {}, body: { message: 'Not Found' } }; }
  const q = {}; for (const kv of qs.split('&').filter(Boolean)) { const i = kv.indexOf('='); q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); }
  const dt = (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
  for (const k of ['startedAfter', 'startedBefore']) if (q[k] !== undefined && !dt(q[k])) return { statusCode: 400, headers: {}, body: { message: 'request/query/' + k + ' must be a datetime' } };
  let limit = q.limit ? parseInt(q.limit, 10) : 100; if (!Number.isFinite(limit) || limit < 0) return { statusCode: 400, headers: {}, body: { message: 'Param `limit` must be a valid integer' } };
  limit = Math.min(limit, 250);
  let lastId = null;
  if (q.cursor) { try { const c = JSON.parse(Buffer.from(q.cursor, 'base64').toString()); lastId = c.lastId; if (Number.isInteger(c.limit)) limit = Math.min(Math.max(c.limit, 1), 250); } catch (e) { return { statusCode: 400, headers: {}, body: { message: 'An invalid cursor was provided' } }; } }
  let list = rows.filter(e => !q.workflowId || e.workflowId === q.workflowId);
  list = q.status ? list.filter(e => e.status === q.status) : list.filter(e => e.status !== 'running');   // excludeRunning unless status=running
  const sa = q.startedAfter ? Date.parse(q.startedAfter) : null, sb = q.startedBefore ? Date.parse(q.startedBefore) : null;
  if (sa !== null || sb !== null) list = list.filter(e => e.startedAt && (sa === null || Date.parse(e.startedAt) >= sa) && (sb === null || Date.parse(e.startedAt) <= sb));
  if (lastId !== null) list = list.filter(e => Number(e.id) < Number(lastId));
  list.sort((a, b) => Number(b.id) - Number(a.id));
  const page = list.slice(0, limit), more = list.length > page.length;
  return { statusCode: 200, headers: {}, body: { data: page, nextCursor: more && page.length ? Buffer.from(JSON.stringify({ lastId: page[page.length - 1].id, limit })).toString('base64') : null } };
};
module.exports = { fakeN8nApi };
