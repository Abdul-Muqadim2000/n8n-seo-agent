import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// G4 (app/docs/INTEGRATIONS.md): every vendor call of the integrations, against stand-ins that answer what the vendors document.
// Request shapes from:
//  Jira Cloud REST v3   https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post
//                       https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-get
//  Linear GraphQL       https://linear.app/developers/graphql (issueCreate, issue, teams)
//  Asana                https://developers.asana.com/reference/createtask · /reference/gettask · /reference/getproject
//  S3 PutObject + SigV4 https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html · sig-v4-header-based-auth.html
//  BigQuery load jobs   https://cloud.google.com/bigquery/docs/reference/api-uploads (resumable) · rest/v2/jobs/get
//  Google OAuth (JWT)   https://developers.google.com/identity/protocols/oauth2/service-account#httprest

vi.mock('../src/config', () => ({ config: { appUrl: 'https://app.example.com', brand: 'Alaventra', isProd: false, mailboxKey: 'a'.repeat(64) } }));
vi.mock('../src/db', async () => ({ db: {}, schema: await import('../src/db/schema') }));

const { transport } = await import('../src/lib/netGuard');
const { VENDORS } = await import('../src/services/issueTrackers');
const { putObject, objectUrl, loadIntoBigQuery } = await import('../src/services/exports');
const { signRequest, encodeRfc3986, sha256Hex } = await import('../src/lib/sigv4');
const { forgetTokens } = await import('../src/lib/googleSa');
const { exportTable } = await import('@seo/shared');

type Req = { url: string; method: string; headers: Record<string, string>; body: string };
type Ans = { status: number; json?: unknown; text?: string; headers?: Record<string, string> };
const realSend = transport.send;
afterEach(() => {
  transport.send = realSend;
  forgetTokens();
});
/** answers the requests in order with the vendor's documented shapes, and records them */
const script = (...answers: Ans[]) => {
  const sent: Req[] = [];
  transport.send = vi.fn(async (r) => {
    sent.push({ url: r.url, method: r.method, headers: r.headers ?? {}, body: Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body ?? '') });
    const a = answers.shift();
    if (!a) throw new Error('unexpected request ' + r.url);
    return { status: a.status, headers: a.headers ?? {}, text: a.text ?? (a.json === undefined ? '' : JSON.stringify(a.json)) };
  });
  return sent;
};
const ticket = { title: '[SEO] Pages with no H1', paragraphs: ['Found by the technical audit.', 'Example pages:', '- https://northwind.example/a', 'The fix: add one H1.'], link: 'https://app.example.com/o/x/sites/y/technical' };

describe('Jira Cloud', () => {
  const cfg = { siteUrl: 'https://northwind.atlassian.net', email: 'dana@northwind.example', projectKey: 'SEO', issueType: 'task' };
  it('connect: the project and its issue type, with Basic email:token', async () => {
    const sent = script({ status: 200, json: { id: '10000', key: 'SEO', name: 'Website' } }, { status: 200, json: { issueTypes: [{ id: '10001', name: 'Task', subtask: false }, { id: '10002', name: 'Sub-task', subtask: true }] } });
    const out = await VENDORS.jira.verify(cfg, 'tok_123456789');
    expect(out).toMatchObject({ projectName: 'Website', issueType: 'Task', issueTypeId: '10001' });
    expect(sent.map((r) => r.url)).toEqual(['https://northwind.atlassian.net/rest/api/3/project/SEO', 'https://northwind.atlassian.net/rest/api/3/issue/createmeta/SEO/issuetypes']);
    expect(sent[0]!.headers.authorization).toBe('Basic ' + Buffer.from('dana@northwind.example:tok_123456789').toString('base64'));
  });
  it('connect: an issue type the project does not have is named, with the ones it has', async () => {
    script({ status: 200, json: { name: 'Website' } }, { status: 200, json: { issueTypes: [{ id: '1', name: 'Bug' }, { id: '2', name: 'Story' }] } });
    await expect(VENDORS.jira.verify(cfg, 'tok')).rejects.toThrow(/has no issue type "task". It has: Bug, Story/);
  });
  it('a refused token is said as such', async () => {
    script({ status: 401, json: { errorMessages: ['Client must be authenticated to access this resource.'] } });
    await expect(VENDORS.jira.verify(cfg, 'tok')).rejects.toMatchObject({ code: 'tracker_refused' });
  });
  it('create: summary, ADF description with the example pages as a list, labels; the key and browse URL come back', async () => {
    const sent = script({ status: 201, json: { id: '10050', key: 'SEO-42', self: 'https://northwind.atlassian.net/rest/api/3/issue/10050' } });
    const made = await VENDORS.jira.create({ ...cfg, issueTypeId: '10001' }, 'tok', ticket);
    expect(made).toMatchObject({ id: '10050', key: 'SEO-42', url: 'https://northwind.atlassian.net/browse/SEO-42', state: 'todo' });
    const body = JSON.parse(sent[0]!.body);
    expect(body.fields).toMatchObject({ project: { key: 'SEO' }, issuetype: { id: '10001' }, summary: '[SEO] Pages with no H1', labels: ['alaventra', 'seo'] });
    expect(body.fields.description.type).toBe('doc');
    expect(body.fields.description.content.map((c: { type: string }) => c.type)).toEqual(['paragraph', 'paragraph', 'bulletList', 'paragraph', 'paragraph']);
  });
  it('read: the status category becomes to do / in progress / done', async () => {
    script({ status: 200, json: { fields: { status: { name: 'In Review', statusCategory: { key: 'indeterminate' } } } } }, { status: 200, json: { fields: { status: { name: 'Done', statusCategory: { key: 'done' } } } } });
    expect(await VENDORS.jira.read(cfg, 'tok', { remoteId: '1', remoteKey: 'SEO-42' })).toEqual({ status: 'In Review', state: 'in_progress' });
    expect((await VENDORS.jira.read(cfg, 'tok', { remoteId: '1', remoteKey: 'SEO-42' })).state).toBe('done');
  });
});

describe('Linear', () => {
  it('connect: finds the team by its key with the personal key as Authorization (no Bearer)', async () => {
    const sent = script({ status: 200, json: { data: { viewer: { id: 'u', name: 'Dana' }, teams: { nodes: [{ id: 'team-uuid', key: 'WEB', name: 'Website' }] } } } });
    expect(await VENDORS.linear.verify({ teamKey: 'WEB' }, 'lin_api_abc')).toEqual({ teamKey: 'WEB', teamId: 'team-uuid', teamName: 'Website' });
    expect(sent[0]!.url).toBe('https://api.linear.app/graphql');
    expect(sent[0]!.headers.authorization).toBe('lin_api_abc');
    expect(JSON.parse(sent[0]!.body).variables).toEqual({ key: 'WEB' });
  });
  it('an error inside a 200 is an error (GraphQL)', async () => {
    script({ status: 200, json: { errors: [{ message: 'Authentication required, not authenticated' }] } });
    await expect(VENDORS.linear.verify({ teamKey: 'WEB' }, 'lin_api_x')).rejects.toMatchObject({ code: 'tracker_refused' });
  });
  it('create: issueCreate with Markdown; the identifier, URL and state type come back', async () => {
    const sent = script({ status: 200, json: { data: { issueCreate: { success: true, issue: { id: 'iss-1', identifier: 'WEB-7', url: 'https://linear.app/nw/issue/WEB-7', state: { name: 'Backlog', type: 'backlog' } } } } } });
    const made = await VENDORS.linear.create({ teamId: 'team-uuid' }, 'lin_api_abc', ticket);
    expect(made).toEqual({ id: 'iss-1', key: 'WEB-7', url: 'https://linear.app/nw/issue/WEB-7', status: 'Backlog', state: 'todo' });
    const v = JSON.parse(sent[0]!.body).variables.input;
    expect(v.teamId).toBe('team-uuid');
    expect(v.description).toContain('- https://northwind.example/a');
    expect(v.description).toContain('[Open in Alaventra](https://app.example.com/o/x/sites/y/technical)');
  });
  it('read: started / completed / canceled', async () => {
    script({ status: 200, json: { data: { issue: { identifier: 'WEB-7', url: 'u', state: { name: 'In Progress', type: 'started' } } } } }, { status: 200, json: { data: { issue: { state: { name: 'Canceled', type: 'canceled' } } } } });
    expect((await VENDORS.linear.read({}, 'k', { remoteId: 'iss-1', remoteKey: 'WEB-7' })).state).toBe('in_progress');
    expect((await VENDORS.linear.read({}, 'k', { remoteId: 'iss-1', remoteKey: 'WEB-7' })).state).toBe('done');
  });
});

describe('Asana', () => {
  it('connect: the project with Bearer PAT', async () => {
    const sent = script({ status: 200, json: { data: { gid: '1201', name: 'SEO fixes', workspace: { gid: '99' } } } });
    expect(await VENDORS.asana.verify({ projectGid: '1201234567' }, '2/1201/xyz')).toEqual({ projectGid: '1201234567', projectName: 'SEO fixes', workspaceGid: '99' });
    expect(sent[0]!.headers.authorization).toBe('Bearer 2/1201/xyz');
  });
  it('create: a task in the project with plain-text notes', async () => {
    const sent = script({ status: 201, json: { data: { gid: '555', permalink_url: 'https://app.asana.com/0/1201/555', completed: false } } });
    expect(await VENDORS.asana.create({ projectGid: '1201234567' }, 'pat', ticket)).toEqual({ id: '555', key: '555', url: 'https://app.asana.com/0/1201/555', status: 'Open', state: 'todo' });
    const d = JSON.parse(sent[0]!.body).data;
    expect(d.projects).toEqual(['1201234567']);
    expect(d.notes).toContain('Open in Alaventra: https://app.example.com/o/x/sites/y/technical');
  });
  it('read: completed', async () => {
    script({ status: 200, json: { data: { completed: true, permalink_url: 'u' } } });
    expect((await VENDORS.asana.read({}, 'pat', { remoteId: '555', remoteKey: '555' })).state).toBe('done');
  });
});

describe('SigV4 (S3-compatible storage)', () => {
  it('matches the signature AWS publishes for its GET Object example', () => {
    // AWS documentation example credentials (public, not a real key): "Example: GET Object", sig-v4-header-based-auth.html
    const h = signRequest({
      method: 'GET',
      url: 'https://examplebucket.s3.amazonaws.com/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      headers: { range: 'bytes=0-9' },
      payloadHash: sha256Hex(''),
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(h.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
  it('encodes object keys the S3 way (= and spaces escaped, / kept)', () => {
    expect(encodeRfc3986('alaventra/rank_history/dt=2026-10-17/a b.ndjson', true)).toBe('alaventra/rank_history/dt%3D2026-10-17/a%20b.ndjson');
  });
  it('object URLs: virtual-hosted on AWS, path-style on R2 and Google Cloud Storage', () => {
    const base = { region: 'eu-west-1', accountId: 'f'.repeat(32), endpoint: '', bucket: 'nw-seo', prefix: 'alaventra', format: 'ndjson' as const };
    expect(objectUrl({ ...base, provider: 'aws' }, 'a/dt=1/x.ndjson')).toBe('https://nw-seo.s3.eu-west-1.amazonaws.com/a/dt%3D1/x.ndjson');
    expect(objectUrl({ ...base, provider: 'r2' }, 'a.ndjson')).toBe(`https://${'f'.repeat(32)}.r2.cloudflarestorage.com/nw-seo/a.ndjson`);
    expect(objectUrl({ ...base, provider: 'gcs' }, 'a.ndjson')).toBe('https://storage.googleapis.com/nw-seo/a.ndjson');
  });
  it('PUT: signed, with the body hash; the store’s XML error is read back', async () => {
    const sent = script({ status: 200 }, { status: 403, text: '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>' });
    const c = { provider: 'r2' as const, region: 'auto', accountId: 'f'.repeat(32), endpoint: '', bucket: 'nw-seo', prefix: 'p', format: 'ndjson' as const };
    await putObject(c, { accessKeyId: 'AKID12345', secretAccessKey: 'secret-secret-secret' }, 'p/x.ndjson', Buffer.from('{"a":1}\n'), 'application/x-ndjson');
    expect(sent[0]!.method).toBe('PUT');
    expect(sent[0]!.headers['x-amz-content-sha256']).toBe(sha256Hex('{"a":1}\n'));
    expect(sent[0]!.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID12345\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    await expect(putObject(c, { accessKeyId: 'AKID12345', secretAccessKey: 'secret-secret-secret' }, 'p/y', Buffer.from('x'), 'text/plain')).rejects.toThrow('The storage answered 403 AccessDenied: Access Denied');
  });
});

describe('BigQuery load job', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const key = { client_email: 'exporter@acme-analytics.iam.gserviceaccount.com', private_key: privateKey };
  const cfg = { projectId: 'acme-analytics', datasetId: 'seo', location: 'EU', tablePrefix: 'alaventra_' };
  const t = exportTable('rank_history')!;
  const session = 'https://bigquery.googleapis.com/upload/bigquery/v2/projects/acme-analytics/jobs?uploadType=resumable&upload_id=xyz';

  it('token (JWT bearer), resumable session with the job, the data, then polls until DONE', async () => {
    const sent = script(
      { status: 200, json: { access_token: 'ya29.test', expires_in: 3600 } },
      { status: 200, headers: { location: session } },
      { status: 200, json: { status: { state: 'RUNNING' } } },
      { status: 200, json: { status: { state: 'RUNNING' } } },
      { status: 200, json: { status: { state: 'DONE' } } },
    );
    const jobId = await loadIntoBigQuery(cfg, key, t, Buffer.from('{"keyword":"x"}\n'), { pollMs: 0 });
    expect(jobId).toMatch(/^alaventra_rank_history_[0-9a-f]{32}$/);
    expect(sent[0]!.url).toBe('https://oauth2.googleapis.com/token');
    expect(sent[0]!.body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    const job = JSON.parse(sent[1]!.body);
    expect(sent[1]!.url).toBe('https://bigquery.googleapis.com/upload/bigquery/v2/projects/acme-analytics/jobs?uploadType=resumable');
    expect(sent[1]!.headers.authorization).toBe('Bearer ya29.test');
    expect(job.configuration.load).toMatchObject({ destinationTable: { projectId: 'acme-analytics', datasetId: 'seo', tableId: 'alaventra_rank_history' }, sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_TRUNCATE' });
    expect(job.configuration.load.schema.fields.map((f: { name: string }) => f.name).slice(0, 5)).toEqual(['company_id', 'website_id', 'website_domain', 'exported_at', 'ladder_id']);
    expect([sent[2]!.method, sent[2]!.url, sent[2]!.body]).toEqual(['PUT', session, '{"keyword":"x"}\n']);
    expect(sent[3]!.url).toBe(`https://bigquery.googleapis.com/bigquery/v2/projects/acme-analytics/jobs/${jobId}?location=EU`);
  });

  it('a job that finished with an error is an error, with BigQuery’s reason', async () => {
    script({ status: 200, json: { access_token: 'ya29.t' } }, { status: 200, headers: { location: session } }, { status: 200, json: {} }, { status: 200, json: { status: { state: 'DONE', errorResult: { reason: 'invalid', message: 'Provided Schema does not match Table' } } } });
    await expect(loadIntoBigQuery(cfg, key, t, Buffer.from('{}\n'), { pollMs: 0 })).rejects.toThrow('Provided Schema does not match Table');
  });

  it('an upload session pointing anywhere but BigQuery is refused', async () => {
    script({ status: 200, json: { access_token: 'ya29.t' } }, { status: 200, headers: { location: 'https://evil.example/upload' } });
    await expect(loadIntoBigQuery(cfg, key, t, Buffer.from('{}\n'), { pollMs: 0 })).rejects.toThrow(/upload session/);
  });

  it('a refused service account is said as such', async () => {
    script({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' } });
    await expect(loadIntoBigQuery(cfg, key, t, Buffer.from('{}\n'), { pollMs: 0 })).rejects.toThrow('Google refused the service account (Invalid JWT Signature.)');
  });
});
