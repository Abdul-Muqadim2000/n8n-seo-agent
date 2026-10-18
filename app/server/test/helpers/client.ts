import type { FastifyInstance } from 'fastify';

/**
 * G1: a browser-like test client for `app.inject`: a cookie jar, the CSRF header on mutations (like the web app's api()), and a
 * different client address per request so the per-IP rate limits of the sign-in routes do not trip in a long test.
 */
let ipSeq = 0;
export const nextIp = () => `10.${(++ipSeq >> 16) & 255}.${(ipSeq >> 8) & 255}.${ipSeq & 255}`;

export interface Res {
  status: number;
  body: any;
  headers: Record<string, unknown>;
  text: string;
}

export class Client {
  jar = new Map<string, string>();
  constructor(
    private app: FastifyInstance,
    public opts: { csrf?: boolean; ip?: string; ua?: string } = {},
  ) {}

  cookieHeader() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async req(method: string, url: string, payload?: unknown, headers: Record<string, string> = {}): Promise<Res> {
    const h: Record<string, string> = { 'user-agent': this.opts.ua ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', ...headers };
    if (this.jar.size) h.cookie = this.cookieHeader();
    if (method !== 'GET' && this.opts.csrf !== false && !('x-requested-with' in headers)) h['x-requested-with'] = 'fetch';
    const r = await this.app.inject({
      method: method as never,
      url,
      payload: payload as never,
      headers: h,
      remoteAddress: this.opts.ip ?? nextIp(),
    });
    for (const c of r.cookies as { name: string; value: string; maxAge?: number; expires?: Date }[]) {
      const gone = c.value === '' || c.maxAge === 0 || (c.expires && c.expires.getTime() < Date.now());
      if (gone) this.jar.delete(c.name);
      else this.jar.set(c.name, c.value);
    }
    let body: unknown = null;
    try {
      body = r.body ? JSON.parse(r.body) : null;
    } catch {
      body = r.body;
    }
    return { status: r.statusCode, body, headers: r.headers as Record<string, unknown>, text: r.body };
  }

  get = (url: string, headers?: Record<string, string>) => this.req('GET', url, undefined, headers);
  post = (url: string, payload?: unknown, headers?: Record<string, string>) => this.req('POST', url, payload ?? {}, headers);
  put = (url: string, payload?: unknown) => this.req('PUT', url, payload ?? {});
  patch = (url: string, payload?: unknown) => this.req('PATCH', url, payload ?? {});
  del = (url: string, payload?: unknown) => this.req('DELETE', url, payload);
}

/** signs a new person up (open sign-up) and returns their client and /api/me answer */
export async function signUp(app: FastifyInstance, email: string, name = email.split('@')[0], password = 'correct horse battery staple') {
  const c = new Client(app);
  const r = await c.post('/api/auth/signup', { name, email, password });
  if (r.status !== 200) throw new Error(`signup ${email}: ${r.status} ${r.text}`);
  return { c, me: r.body, password };
}
