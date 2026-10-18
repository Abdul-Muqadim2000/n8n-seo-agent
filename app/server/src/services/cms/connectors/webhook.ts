import { createHmac, timingSafeEqual } from 'node:crypto';
import { CMS, cmsWebhookBody } from '@seo/shared';
import { cmsRequest } from '../http';
import { cmsMessage, CmsError, obj, str, type CmsConnector, type ConnCtx } from './types';

/**
 * Any other stack: the page package as JSON, signed (HMAC-SHA256 over "<timestamp>.<body>", the scheme report delivery uses),
 * with an idempotency key that is the same for every send of the same item. App/docs/CMS_PUBLISHING.md §4 "Generic signed webhook".
 */

export const signCms = (secret: string, timestamp: string, body: string): string => 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

/** A receiver's side of the check (exported for the tests and quoted in the guide). */
export function verifyCms(secret: string, timestamp: string, body: string, signature: string): boolean {
  const want = Buffer.from(signCms(secret, timestamp, body));
  const got = Buffer.from(String(signature || ''));
  return want.length === got.length && timingSafeEqual(want, got);
}

async function post(c: ConnCtx, event: string, payload: Record<string, unknown>, idempotencyKey: string) {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  return cmsRequest({
    method: 'POST',
    url: c.baseUrl,
    headers: {
      'content-type': 'application/json',
      [CMS.timestampHeader]: timestamp,
      [CMS.signatureHeader]: signCms(c.secret, timestamp, body),
      [CMS.eventHeader]: event,
      'idempotency-key': idempotencyKey,
    },
    body,
    timeoutMs: 60_000,
  });
}

export const webhook: CmsConnector = {
  kind: 'webhook',

  async test(c) {
    const res = await post(c, 'cms.test', { event: 'cms.test', version: 1, sent_at: new Date().toISOString(), note: 'A test from Alaventra: answer 2xx. Nothing to publish.' }, `test-${Date.now()}`);
    if (res.status >= 200 && res.status < 300) return { ok: true, message: `Your endpoint answered ${res.status}. Check the signature on your side with the secret you were shown.`, settings: { account: c.baseUrl.replace(/^https?:\/\//, '').split('/')[0] } };
    return { ok: false, message: `Your endpoint answered ${res.status}${cmsMessage(res) ? `: ${cmsMessage(res)}` : ''}. It must answer 2xx to a signed POST.` };
  },

  // a webhook cannot be asked: the item is whatever the receiver answered the last time
  async find() {
    return null;
  },
  async status() {
    return null;
  },

  async push(c, page, o) {
    const notes: string[] = [];
    let budget: number = CMS.webhookMaxImageBytes;
    const images = o.images.map((im) => {
      if (im.data && im.data.length <= budget) {
        budget -= im.data.length;
        return { ...im, data: im.data.toString('base64') };
      }
      if (im.data) notes.push(`${im.fileName} was too large to carry in the body and was sent without its bytes.`);
      return { ...im, data: undefined };
    });
    const payload = cmsWebhookBody({ idempotencyKey: o.idempotencyKey, mode: o.mode, domain: o.domain, page, images, publicUrl: o.publicUrl, report: o.report, sentAt: new Date().toISOString(), sentBy: o.sentBy });
    const res = await post(c, 'cms.publish', payload, o.idempotencyKey);
    if (res.status < 200 || res.status >= 300) throw new CmsError(`Your endpoint answered ${res.status}${cmsMessage(res) ? `: ${cmsMessage(res)}` : ''}.`, res.status);
    const j = obj(res.json);
    const answered = str(j.status).toLowerCase();
    return {
      id: str(j.id) || o.remote?.id || o.idempotencyKey,
      url: str(j.url) || o.publicUrl,
      // the receiver says what it did; without an answer, a live send is taken as live
      status: answered === 'published' || answered === 'publish' || answered === 'live' ? 'published' : answered === 'draft' ? 'draft' : o.mode === 'live' ? 'published' : 'draft',
      notes,
    };
  },
};
