import { Resolver } from 'node:dns/promises';
import { CRAWLER_LIMITS, type BotDef, type Verification } from '@seo/shared';
import { inSource, isCloudflareIp, isPrivateIp } from './ranges';

/**
 * Is a request that calls itself a crawler really that crawler? (app/docs/LOG_ANALYTICS.md §3) Never the user agent alone:
 *  1. the vendor's published IP list — on it: verified;
 *  2. otherwise, for vendors that document it (Google, Bing, Apple, Amazon, Yandex), forward-confirmed reverse DNS — the address's
 *     name ends in the vendor's domain and that name resolves back to the same address: verified; a name elsewhere: spoofed;
 *  3. a vendor with a list and no DNS rule, and the address is not on the list: spoofed;
 *  4. a vendor that publishes no way to check (Bytespider, Meta, SEO tools, unknown bots): claimed;
 *  5. no address, a private or CDN address (the server logged its proxy), DNS that did not answer, or the per-ingest DNS budget
 *     spent: unchecked — never "spoofed" on missing evidence.
 */

export interface Dns {
  reverse(ip: string): Promise<string[]>;
  resolve(host: string, v6: boolean): Promise<string[]>;
}

const resolver = new Resolver({ timeout: 2500, tries: 1 });
export const systemDns: Dns = {
  reverse: (ip) => resolver.reverse(ip),
  resolve: (host, v6) => (v6 ? resolver.resolve6(host) : resolver.resolve4(host)),
};

type DnsAnswer = { name: string | null; confirmed: boolean } | 'error';
// across ingests: an address keeps its name for a day (crawler addresses repeat all day long)
const dnsCache = new Map<string, { at: number; answer: DnsAnswer }>();
const DNS_TTL = 24 * 3600_000;
const DNS_CACHE_MAX = 50_000;

const sameIp = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

async function fcrdns(dns: Dns, ip: string): Promise<DnsAnswer> {
  const hit = dnsCache.get(ip);
  if (hit && Date.now() - hit.at < DNS_TTL) return hit.answer;
  let answer: DnsAnswer;
  try {
    const names = await dns.reverse(ip);
    const name = names[0]?.toLowerCase().replace(/\.$/, '') ?? null;
    if (!name) answer = { name: null, confirmed: false };
    else {
      const back = await dns.resolve(name, ip.includes(':')).catch(() => [] as string[]);
      answer = { name, confirmed: back.some((x) => sameIp(x, ip)) };
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    // "no such name" is an answer (the address has no name: not the vendor); a timeout or a server failure is not
    answer = code === 'ENOTFOUND' || code === 'ENODATA' ? { name: null, confirmed: false } : 'error';
  }
  if (answer !== 'error') {
    if (dnsCache.size >= DNS_CACHE_MAX) dnsCache.delete(dnsCache.keys().next().value!);
    dnsCache.set(ip, { at: Date.now(), answer });
  }
  return answer;
}

export function clearDnsCacheForTest() {
  dnsCache.clear();
}

/** One verifier per ingest: it remembers each (bot, address) answer and spends at most `dnsLookupsPerIngest` DNS checks. */
export class Verifier {
  private memo = new Map<string, Verification>();
  private lookups = 0;
  constructor(
    private dns: Dns = systemDns,
    private budget: number = CRAWLER_LIMITS.dnsLookupsPerIngest,
  ) {}

  /** the cheap part: everything that needs no DNS. Returns null when DNS must decide. */
  quick(bot: BotDef, ip: string | null, proxied: boolean): Verification | null {
    if (!bot.ranges?.length && !bot.rdns?.length) return 'claimed';
    if (!ip || proxied || isPrivateIp(ip) || isCloudflareIp(ip)) return 'unchecked';
    if (bot.ranges?.some((r) => inSource(r, ip))) return 'verified';
    if (!bot.rdns?.length) return 'spoofed';
    return this.memo.get(`${bot.key}|${ip}`) ?? null;
  }

  async verify(bot: BotDef, ip: string | null, proxied = false): Promise<Verification> {
    const q = this.quick(bot, ip, proxied);
    if (q) return q;
    const key = `${bot.key}|${ip}`;
    if (this.lookups >= this.budget) return 'unchecked';
    this.lookups++;
    const a = await fcrdns(this.dns, ip!);
    const v: Verification = a === 'error' ? 'unchecked' : a.name && a.confirmed && bot.rdns!.some((s) => a.name!.endsWith(s)) ? 'verified' : 'spoofed';
    this.memo.set(key, v);
    return v;
  }

  /** decides every pending (bot, address) pair of a batch, a few DNS checks at a time */
  async verifyAll(items: { bot: BotDef; ip: string | null; proxied: boolean }[], concurrency = 16): Promise<Verification[]> {
    const out: Verification[] = new Array(items.length);
    const pending = new Map<string, number[]>();
    items.forEach((it, i) => {
      const q = this.quick(it.bot, it.ip, it.proxied);
      if (q) out[i] = q;
      else {
        const k = `${it.bot.key}|${it.ip}`;
        const list = pending.get(k);
        if (list) list.push(i);
        else pending.set(k, [i]);
      }
    });
    const keys = [...pending.keys()];
    let next = 0;
    const worker = async () => {
      while (next < keys.length) {
        const idxs = pending.get(keys[next++])!;
        const it = items[idxs[0]];
        const v = await this.verify(it.bot, it.ip, it.proxied);
        for (const i of idxs) out[i] = v;
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
    return out;
  }

  get dnsLookups() {
    return this.lookups;
  }
}
