import { describe, expect, it } from 'vitest';
import {
  asanaState,
  bigQueryDestinationSchema,
  bigQuerySchema,
  coerce,
  EXPORT_TABLES,
  exportObjectKey,
  exportRow,
  exportTable,
  findingTicket,
  issueSourceKey,
  jiraConnectSchema,
  jiraState,
  linearConnectSchema,
  linearState,
  nextExportAt,
  s3DestinationSchema,
  storageEndpoint,
  ticketAdf,
  toCsv,
  toNdjson,
} from './integrations';

// G4 (app/docs/INTEGRATIONS.md): the pure half of the issue trackers and of the warehouse export.

describe('issue trackers: connecting, the ticket, the state', () => {
  it('Jira Cloud addresses only, a project key, the token kept out of the settings', () => {
    const ok = jiraConnectSchema.parse({ kind: 'jira', siteUrl: 'https://Northwind.atlassian.net/', email: 'dana@northwind.example', apiToken: 'ATATT3xFfGF0abc', projectKey: 'seo' });
    expect([ok.siteUrl, ok.projectKey, ok.issueType]).toEqual(['https://northwind.atlassian.net', 'SEO', 'Task']);
    for (const bad of ['https://jira.northwind.example', 'http://northwind.atlassian.net', 'https://northwind.atlassian.net.evil.com', 'https://10.0.0.1'])
      expect(jiraConnectSchema.safeParse({ kind: 'jira', siteUrl: bad, email: 'a@b.co', apiToken: 'x'.repeat(10), projectKey: 'SEO' }).success).toBe(false);
    expect(linearConnectSchema.safeParse({ kind: 'linear', apiKey: 'not-a-linear-key', teamKey: 'WEB' }).success).toBe(false);
  });

  it('one finding = one key, whatever audit it is pushed from', () => {
    expect(issueSourceKey('site-1', { type: 'finding', findingKey: 'content|pages with no h1' })).toBe('finding:site-1:content|pages with no h1');
    expect(issueSourceKey('site-1', { type: 'recommendation', id: 'ai:indexnow' })).toBe('rec:site-1:ai:indexnow');
  });

  it('the ticket carries the evidence, the example pages and the fix; ADF lists the pages', () => {
    const t = findingTicket(
      { title: 'Pages with no H1', category: 'Content', severity: 'High', affected: 12, checked: 200, evidence: '12 of 200 pages have no H1', why: 'The H1 tells search engines the topic.', fix: 'Add one H1 per page.', sampleUrls: ['https://n.example/a', 'https://n.example/b'], auditedAt: '2026-10-17T06:00:00Z', reportType: 'site_audit' },
      'n.example',
      'https://app.example.com/x',
    );
    expect(t.title).toBe('[SEO] Pages with no H1');
    expect(t.paragraphs).toEqual(expect.arrayContaining(['Pages affected: 12 of 200 checked.', 'Evidence: 12 of 200 pages have no H1', '- https://n.example/a', 'The fix: Add one H1 per page.']));
    const adf = ticketAdf(t) as { content: { type: string; content: unknown[] }[] };
    const list = adf.content.find((c) => c.type === 'bulletList')!;
    expect(list.content).toHaveLength(2);
    expect(JSON.stringify(adf.content.at(-1))).toContain('"href":"https://app.example.com/x"');
  });

  it('vendor states map onto to do / in progress / done', () => {
    expect([jiraState('new'), jiraState('indeterminate'), jiraState('done'), jiraState('x')]).toEqual(['todo', 'in_progress', 'done', 'unknown']);
    expect([linearState('backlog'), linearState('started'), linearState('completed'), linearState('canceled')]).toEqual(['todo', 'in_progress', 'done', 'done']);
    expect([asanaState(false), asanaState(true), asanaState(undefined)]).toEqual(['todo', 'done', 'unknown']);
  });
});

describe('export: one schema, typed rows, both formats', () => {
  it('every table has its date column among its columns, and unique column names', () => {
    for (const t of EXPORT_TABLES) {
      const names = t.columns.map((c) => c.name);
      expect(names).toContain(t.dateColumn);
      expect(new Set(names).size).toBe(names.length);
    }
    expect(bigQuerySchema(exportTable('runs')!).fields.every((f) => f.mode === 'NULLABLE')).toBe(true);
  });

  it('values are typed; a value the engine did not store is null, never 0', () => {
    expect([coerce('12', 'INTEGER'), coerce('', 'INTEGER'), coerce('x', 'FLOAT'), coerce('true', 'BOOLEAN'), coerce('2026-10-17T06:00:00Z', 'TIMESTAMP'), coerce('2026-10-11T00:00:00Z', 'DATE'), coerce('nope', 'TIMESTAMP')]).toEqual([
      12, null, null, true, '2026-10-17T06:00:00.000Z', '2026-10-11', null,
    ]);
    const r = exportRow(exportTable('rank_history')!, { keyword: 'peppol uae', position: '4', checked_at: '2026-10-17T06:00:00Z', extra_column: 'dropped' }, { companyId: 'c', websiteId: 'w', websiteDomain: 'n.example', exportedAt: '2026-10-17T07:00:00.000Z' });
    expect(r).toMatchObject({ company_id: 'c', keyword: 'peppol uae', position: 4, share_of_voice: null });
    expect('extra_column' in r).toBe(false);
  });

  it('NDJSON one object a line; CSV quoted, with spreadsheet formulas defused', () => {
    expect(toNdjson([{ a: 1 }, { a: null }])).toBe('{"a":1}\n{"a":null}\n');
    const cols = [
      { name: 'title', type: 'STRING' as const, description: '' },
      { name: 'n', type: 'INTEGER' as const, description: '' },
    ];
    expect(toCsv(cols, [{ title: 'Say "hi", world', n: -3 }, { title: '=HYPERLINK("x")', n: null }])).toBe('title,n\r\n"Say ""hi"", world",-3\r\n"\'=HYPERLINK(""x"")",\r\n');
  });

  it('object names are Hive-style partitions; storage endpoints are the provider’s own', () => {
    expect(exportObjectKey('ascentra', 'runs', 'r1', new Date('2026-10-17T03:00:00Z'), 'csv')).toBe('ascentra/runs/dt=2026-10-17/runs-r1.csv');
    expect(storageEndpoint({ provider: 'aws', region: 'eu-west-1' })).toBe('https://s3.eu-west-1.amazonaws.com');
    expect(storageEndpoint({ provider: 'aws', region: 'mars' })).toBeNull();
    expect(storageEndpoint({ provider: 'other', region: 'auto', endpoint: 'https://10.0.0.5' })).toBeNull();
    expect(storageEndpoint({ provider: 'other', region: 'auto', endpoint: 'https://s3.wasabisys.com' })).toBe('https://s3.wasabisys.com');
  });

  it('destinations: the S3 form checks the provider’s fields; BigQuery takes the whole key file', () => {
    expect(s3DestinationSchema.safeParse({ kind: 's3', provider: 'r2', accountId: 'nope', bucket: 'b-1', accessKeyId: 'AKID12345', secretAccessKey: 'x'.repeat(20) }).success).toBe(false);
    const s3 = s3DestinationSchema.parse({ kind: 's3', provider: 'aws', region: 'eu-west-1', bucket: 'nw-seo', prefix: '/exports/', accessKeyId: 'AKID12345', secretAccessKey: 'x'.repeat(20) });
    expect([s3.prefix, s3.tables.length, s3.schedule]).toEqual(['exports', EXPORT_TABLES.length, 'daily']);
    const key = JSON.stringify({ type: 'service_account', project_id: 'acme-analytics', client_email: 'x@acme-analytics.iam.gserviceaccount.com', private_key: 'PEM PRIVATE KEY (test placeholder)' });
    expect(bigQueryDestinationSchema.parse({ kind: 'bigquery', projectId: 'acme-analytics', datasetId: 'seo', serviceAccountJson: key }).serviceAccountJson.client_email).toBe('x@acme-analytics.iam.gserviceaccount.com');
    expect(bigQueryDestinationSchema.safeParse({ kind: 'bigquery', projectId: 'acme-analytics', datasetId: 'seo', serviceAccountJson: '{"type":"authorized_user"}' }).success).toBe(false);
  });

  it('schedules: daily at the hour, weekly on the day (UTC)', () => {
    const from = new Date('2026-10-17T05:00:00Z'); // a Saturday
    expect(nextExportAt({ schedule: 'daily', hour: 3 }, from)!.toISOString()).toBe('2026-10-18T03:00:00.000Z');
    expect(nextExportAt({ schedule: 'daily', hour: 6 }, from)!.toISOString()).toBe('2026-10-17T06:00:00.000Z');
    expect(nextExportAt({ schedule: 'weekly', hour: 3, weekday: 0 }, from)!.toISOString()).toBe('2026-10-19T03:00:00.000Z');
    expect(nextExportAt({ schedule: 'off', hour: 3 }, from)).toBeNull();
  });
});
