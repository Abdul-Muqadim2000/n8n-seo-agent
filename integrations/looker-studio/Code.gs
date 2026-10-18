/**
 * Ascentra — Looker Studio community connector (G4, app/docs/INTEGRATIONS.md §6).
 *
 * Reads one export table of one website through Ascentra's read API with a company API key:
 *   GET <app>/api/v1                                   -> who the key belongs to (used to check the key)
 *   GET <app>/api/v1/tables                            -> the tables and their typed columns (the schema)
 *   GET <app>/api/v1/websites                          -> the company's websites (for the configuration list)
 *   GET <app>/api/v1/websites/:id/tables/:table        -> the rows, oldest first, ?since=&until=&limit=100&cursor=
 * Community connector reference: https://developers.google.com/looker-studio/connector/reference
 *
 * The key is kept in the viewer's own user properties (PropertiesService.getUserProperties), never in the report. Use a key with
 * only the "Read" permission: this connector never writes anything.
 */

var cc = DataStudioApp.createCommunityConnector();
var KEY_PROPERTY = 'ascentra.key';
var MAX_PAGES = 400; // 400 pages x 100 rows = the export's own 40,000-row view per request

// ------------------------------------------------------------------ authentication (an API key)

function getAuthType() {
  return cc.newAuthTypeResponse().setAuthType(cc.AuthType.KEY).setHelpUrl('https://github.com/Abdul-Muqadim2000/n8n-seo-agent/tree/main/integrations/looker-studio').build();
}

function isAuthValid() {
  var key = PropertiesService.getUserProperties().getProperty(KEY_PROPERTY);
  return typeof key === 'string' && /^asc_[A-Za-z0-9_-]{43}$/.test(key);
}

function setCredentials(request) {
  var key = request && request.key ? String(request.key).trim() : '';
  if (!/^asc_[A-Za-z0-9_-]{43}$/.test(key)) return { errorCode: 'INVALID_CREDENTIALS' };
  PropertiesService.getUserProperties().setProperty(KEY_PROPERTY, key);
  return { errorCode: 'NONE' };
}

function resetAuth() {
  PropertiesService.getUserProperties().deleteProperty(KEY_PROPERTY);
}

function isAdminUser() {
  return false;
}

// ------------------------------------------------------------------ the API

function appUrlOf(configParams) {
  var url = String((configParams && configParams.appUrl) || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+$/.test(url)) userError('Enter your Ascentra address, like https://app.your-company.com (https, no path).');
  return url;
}

function userError(message) {
  cc.newUserError().setText(message).setDebugText(message).throwException();
}

function apiGet(configParams, path) {
  var key = PropertiesService.getUserProperties().getProperty(KEY_PROPERTY);
  var res = UrlFetchApp.fetch(appUrlOf(configParams) + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  var status = res.getResponseCode();
  var body = {};
  try {
    body = JSON.parse(res.getContentText() || '{}');
  } catch (e) {
    body = {};
  }
  if (status === 401) userError('Ascentra refused the API key (unknown, revoked or expired). Create a new read-only key in Company settings -> API access and reconnect.');
  if (status === 403) userError(body.error || 'This key may not read that.');
  if (status === 404) userError(body.error || 'Not found: check the website and the table.');
  if (status === 429) userError('Too many requests to Ascentra right now (120 a minute per key). Try again in a minute.');
  if (status < 200 || status >= 300) userError('Ascentra answered ' + status + (body.error ? ': ' + body.error : ''));
  return body;
}

// ------------------------------------------------------------------ configuration

function getConfig(request) {
  var config = cc.getConfig();
  var params = (request && request.configParams) || {};
  config.newInfo().setId('intro').setText('Ascentra: one table of one website per data source. Use a key with only the Read permission.');
  config.newTextInput().setId('appUrl').setName('Ascentra address').setHelpText('e.g. https://app.your-company.com').setPlaceholder('https://').setIsDynamic(true);
  if (params.appUrl) {
    var sites = apiGet(params, '/api/v1/websites?limit=100').items || [];
    var site = config.newSelectSingle().setId('websiteId').setName('Website').setIsDynamic(true);
    sites.forEach(function (s) {
      site.addOption(config.newOptionBuilder().setLabel(s.domain + (s.verified ? '' : ' (not verified yet)')).setValue(s.id));
    });
    var tables = apiGet(params, '/api/v1/tables').items || [];
    var table = config.newSelectSingle().setId('table').setName('Table');
    tables.forEach(function (t) {
      table.addOption(config.newOptionBuilder().setLabel(t.label + ' (' + t.id + ')').setValue(t.id));
    });
  } else {
    config.setIsSteppedConfig(true);
  }
  config.setDateRangeRequired(true);
  return config.build();
}

// ------------------------------------------------------------------ schema

var TYPES = {
  STRING: { type: 'TEXT', concept: 'DIMENSION' },
  BOOLEAN: { type: 'BOOLEAN', concept: 'DIMENSION' },
  INTEGER: { type: 'NUMBER', concept: 'METRIC' },
  FLOAT: { type: 'NUMBER', concept: 'METRIC' },
  TIMESTAMP: { type: 'YEAR_MONTH_DAY_SECOND', concept: 'DIMENSION' },
  DATE: { type: 'YEAR_MONTH_DAY', concept: 'DIMENSION' },
};
// identifiers are dimensions even when they are numbers
var ID_COLUMNS = { rung: true, position: false };

function tableOf(configParams) {
  if (!configParams || !configParams.table) userError('Choose a table.');
  var tables = apiGet(configParams, '/api/v1/tables').items || [];
  var t = tables.filter(function (x) {
    return x.id === configParams.table;
  })[0];
  if (!t) userError('Unknown table: ' + configParams.table);
  return t;
}

function fieldsOf(table) {
  var fields = cc.getFields();
  var types = cc.FieldType;
  table.columns.forEach(function (c) {
    var t = TYPES[c.type] || TYPES.STRING;
    var f = t.concept === 'METRIC' && !ID_COLUMNS[c.name] ? fields.newMetric() : fields.newDimension();
    f.setId(c.name).setName(c.name).setDescription(c.description || '').setType(types[t.type]);
    if (t.concept === 'METRIC' && !ID_COLUMNS[c.name]) f.setAggregation(c.name === 'position' ? cc.AggregationType.AVG : cc.AggregationType.SUM);
  });
  fields.setDefaultDimension(table.dateColumn);
  return fields;
}

function getSchema(request) {
  return { schema: fieldsOf(tableOf(request.configParams)).build() };
}

// ------------------------------------------------------------------ data

/** an export value as Looker Studio wants it for the field's type */
function cell(value, type) {
  if (value === null || value === undefined) return null;
  if (type === 'TIMESTAMP') return String(value).replace(/[-:T]/g, '').slice(0, 14);
  if (type === 'DATE') return String(value).replace(/-/g, '').slice(0, 8);
  if (type === 'INTEGER' || type === 'FLOAT') return Number(value);
  if (type === 'BOOLEAN') return value === true;
  return String(value);
}

function getData(request) {
  var p = request.configParams || {};
  if (!p.websiteId) userError('Choose a website.');
  var table = tableOf(p);
  var wanted = request.fields.map(function (f) {
    return f.name;
  });
  var cols = table.columns.filter(function (c) {
    return wanted.indexOf(c.name) >= 0;
  });
  var byName = {};
  cols.forEach(function (c) {
    byName[c.name] = c;
  });
  var ordered = wanted.map(function (n) {
    return byName[n];
  });
  var range = request.dateRange || {};
  var q = '?limit=100' + (range.startDate ? '&since=' + encodeURIComponent(range.startDate) : '') + (range.endDate ? '&until=' + encodeURIComponent(range.endDate + 'T23:59:59Z') : '');
  var rows = [];
  var cursor = null;
  for (var i = 0; i < MAX_PAGES; i++) {
    var page = apiGet(p, '/api/v1/websites/' + encodeURIComponent(p.websiteId) + '/tables/' + encodeURIComponent(table.id) + q + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    (page.items || []).forEach(function (r) {
      rows.push({
        values: ordered.map(function (c) {
          return c ? cell(r[c.name], c.type) : null;
        }),
      });
    });
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return { schema: fieldsOf(table).forIds(wanted).build(), rows: rows };
}
