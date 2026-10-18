// Runs Code.gs in Node with stand-ins for the Apps Script services, against a stand-in Alaventra read API:
//   node integrations/looker-studio/test/connector.test.mjs
// It checks what the connector sends (the key as a Bearer token, the date range as since / until, the paging) and what it hands
// Looker Studio (typed fields, values in Looker's date formats, the requested field order). No network, no Google account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const KEY = 'asc_' + 'k'.repeat(43);
const calls = [];
const props = new Map();
const tables = [{ id: 'rank_history', label: 'Rank history', dateColumn: 'checked_at', columns: [
  { name: 'website_domain', type: 'STRING', description: 'site' },
  { name: 'keyword', type: 'STRING', description: 'kw' },
  { name: 'checked_at', type: 'TIMESTAMP', description: 'when' },
  { name: 'position', type: 'INTEGER', description: 'pos' },
  { name: 'rung', type: 'INTEGER', description: 'rung' },
] }];
const pages = {
  '': { items: [{ keyword: 'peppol uae', checked_at: '2026-10-12T06:00:00.000Z', position: 4, rung: 1, website_domain: 'n.example' }], nextCursor: 'c2' },
  c2: { items: [{ keyword: 'e invoicing', checked_at: '2026-10-13T06:00:00.000Z', position: null, rung: 4, website_domain: 'n.example' }], nextCursor: null },
};

// a builder that accepts any chained call and remembers what was set
const builder = (kind, store = {}) => new Proxy(store, { get: (t, k) => (k === 'build' ? () => t : k === '__kind' ? kind : k in t ? t[k] : (...a) => { t[k] = a.length > 1 ? a : a[0]; return builder(kind, t); }) });
const fieldsList = [];
const fields = {
  newMetric: () => { const f = builder('METRIC', { concept: 'METRIC' }); fieldsList.push(f); return f; },
  newDimension: () => { const f = builder('DIMENSION', { concept: 'DIMENSION' }); fieldsList.push(f); return f; },
  setDefaultDimension: () => fields,
  forIds: (ids) => ({ build: () => ids.map((id) => fieldsList.find((f) => f.setId === id)) }),
  build: () => fieldsList,
};
const cc = {
  AuthType: { KEY: 'KEY' },
  FieldType: new Proxy({}, { get: (_, k) => k }),
  AggregationType: { SUM: 'SUM', AVG: 'AVG' },
  newAuthTypeResponse: () => builder('auth'),
  getConfig: () => builder('config', {}),
  getFields: () => { fieldsList.length = 0; return fields; },
  newUserError: () => ({ setText(m) { this.m = m; return this; }, setDebugText() { return this; }, throwException() { throw new Error(this.m); } }),
};
const sandbox = {
  DataStudioApp: { createCommunityConnector: () => cc },
  PropertiesService: { getUserProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v), deleteProperty: (k) => props.delete(k) }) },
  UrlFetchApp: {
    fetch: (url, opts) => {
      calls.push({ url, opts });
      const path = url.replace('https://app.example.com', '');
      let body = { error: 'not found' };
      let status = 404;
      if (opts.headers.Authorization !== `Bearer ${KEY}`) status = 401;
      else if (path === '/api/v1/tables') (status = 200), (body = { items: tables });
      else if (path.startsWith('/api/v1/websites/site-1/tables/rank_history')) (status = 200), (body = pages[new URL('https://x' + path).searchParams.get('cursor') ?? '']);
      return { getResponseCode: () => status, getContentText: () => JSON.stringify(body) };
    },
  },
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../Code.gs', import.meta.url), 'utf8'), sandbox);

// credentials
assert.equal(sandbox.setCredentials({ key: 'nope' }).errorCode, 'INVALID_CREDENTIALS');
assert.equal(sandbox.isAuthValid(), false);
assert.equal(sandbox.setCredentials({ key: KEY }).errorCode, 'NONE');
assert.equal(sandbox.isAuthValid(), true);

const req = { configParams: { appUrl: 'https://app.example.com/', websiteId: 'site-1', table: 'rank_history' }, dateRange: { startDate: '2026-10-01', endDate: '2026-10-17' }, fields: [{ name: 'checked_at' }, { name: 'keyword' }, { name: 'position' }] };

// schema: typed, rung is a dimension though it is a number, position a metric averaged
const schema = sandbox.getSchema(req).schema;
const byId = Object.fromEntries(schema.map((f) => [f.setId, f]));
assert.equal(byId.keyword.concept, 'DIMENSION');
assert.equal(byId.checked_at.setType, 'YEAR_MONTH_DAY_SECOND');
assert.equal(byId.position.concept, 'METRIC');
assert.equal(byId.position.setAggregation, 'AVG');
assert.equal(byId.rung.concept, 'DIMENSION');

// data: both pages, the requested order, Looker's formats, null kept null
calls.length = 0;
const data = sandbox.getData(req);
assert.deepEqual(JSON.parse(JSON.stringify(data.rows)), [{ values: ['20261012060000', 'peppol uae', 4] }, { values: ['20261013060000', 'e invoicing', null] }]);
const rowCalls = calls.filter((c) => c.url.includes('/tables/rank_history'));
assert.equal(rowCalls.length, 2);
assert.match(rowCalls[0].url, /since=2026-10-01&until=2026-10-17T23%3A59%3A59Z/);
assert.match(rowCalls[1].url, /cursor=c2/);
assert.equal(rowCalls[0].opts.followRedirects, false);

// a refused key and a non-https address are said in words
props.set('alaventra.key', 'asc_' + 'x'.repeat(43));
assert.throws(() => sandbox.getData(req), /refused the API key/);
assert.throws(() => sandbox.getSchema({ configParams: { appUrl: 'http://app.example.com', table: 'rank_history' } }), /https/);

console.log('looker-studio connector: 15 checks passed');
