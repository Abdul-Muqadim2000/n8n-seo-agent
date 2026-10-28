import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { consistencyWarnings, type Site, type Warning } from '@seo/shared';
import { formErrorNode, showSubmitError, siteCreateConflict, type SiteFormValues } from '@/components/site/SiteBusinessFields';
import { addSiteError } from '@/pages/settings/AddSitePage';
import { websiteStepError } from '@/pages/onboarding/_components/WebsiteStep';
import { undoIdeaCheck } from '@/pages/onboarding/_components/KeywordStep';
import { CheckError } from '@/pages/site/NewLadderPage';
import { SubmitError } from '@/pages/tools/_components/kit';
import { api, ApiRequestError, CONFIRM_CANCELLED_TEXT, DONE_INSTEAD, isConfirmCancelled, setConfirmHandler, toastError, type ConfirmAnswer } from '@/lib/api';

const toasts = vi.hoisted(() => ({ error: [] as unknown[][], success: [] as unknown[][] }));
vi.mock('sonner', () => ({
  toast: Object.assign(() => undefined, {
    error: (...a: unknown[]) => void toasts.error.push(a),
    success: (...a: unknown[]) => void toasts.success.push(a),
    info: () => undefined,
    warning: () => undefined,
  }),
  Toaster: () => null,
}));

// Found while filming the tutorials (2026-10-28): adding a website whose description names another market opened "Check this first"
// (409 confirm_needed); Cancel then showed "You already added this website" with the server's API sentence about "acknowledge".
// A 409 confirm_needed is a question, not a duplicate: Cancel leaves the filled form with no error and nothing added; Continue anyway and
// Accept send the save again; only site_exists / domain_claimed (and a raced `conflict`) show the duplicate message, in our words.

const VALUES = { domain: 'devaicon.com', country: 'Pakistan', business: 'AI automation for companies in Dubai, Abu Dhabi and Riyadh' } as unknown as SiteFormValues;
const SERVER_TEXT = 'This does not match what we know about the website. Read the warnings: apply the correction they offer, or send their ids in "acknowledge" to go ahead anyway.';
const warnings = (): Warning[] => consistencyWarnings('site_update', { ...VALUES }, { site: null });
const SITES = [{ id: 's-1', domain: 'devaicon.com' }] as unknown as Site[];

/** The two screens' form error rendering, as the form does it (SiteBusinessForm: showSubmitError, then formErrorNode). */
const SCREENS = {
  'Add a website': (e: unknown) => (showSubmitError(e) ? formErrorNode(e, VALUES, addSiteError('o-1', [])) : null),
  'Add a website (the site is in the list)': (e: unknown) => (showSubmitError(e) ? formErrorNode(e, VALUES, addSiteError('o-1', SITES)) : null),
  'onboarding Website step': (e: unknown) => (showSubmitError(e) ? formErrorNode(e, VALUES, websiteStepError) : null),
};
const html = (node: unknown) => (node == null ? '' : renderToString(<MemoryRouter>{node as never}</MemoryRouter>));

/** POST /sites: answers confirm_needed until every open warning is acknowledged or its correction sent; `dup` answers a duplicate. */
function stubServer(dup?: 'site_exists' | 'domain_claimed' | 'conflict') {
  const sent: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: { body?: string }) => {
    const body = JSON.parse(init.body ?? '{}') as Record<string, unknown>;
    sent.push(body);
    if (dup) return new Response(JSON.stringify({ error: `${VALUES.domain} is already one of your websites.`, code: dup }), { status: 409 });
    const w = consistencyWarnings('site_update', body, { site: null });
    const acked = new Set(Array.isArray(body.acknowledge) ? (body.acknowledge as string[]) : []);
    const open = w.filter((x) => x.tone === 'warning' && !acked.has(x.id));
    if (open.length) return new Response(JSON.stringify({ error: SERVER_TEXT, code: 'confirm_needed', notices: w, warnings: w, needsAcknowledge: open.map((x) => x.id) }), { status: 409 });
    return new Response(JSON.stringify({ id: 's-new', domain: body.domain, country: body.country }), { status: 200 });
  });
  return sent;
}
const addSite = () => api<{ id: string; country: string }>('/api/orgs/o-1/sites', { method: 'POST', body: { ...VALUES } });

afterEach(() => {
  setConfirmHandler(null);
  vi.unstubAllGlobals();
});

describe('adding a website whose description names another market', () => {
  it('the fixture asks "Check this first" (a warning with an Accept and an "anyway")', () => {
    const w = warnings().filter((x) => x.tone === 'warning');
    expect(w.length).toBeGreaterThan(0);
    expect(w.some((x) => x.accept)).toBe(true);
  });

  for (const [screen, view] of Object.entries(SCREENS)) {
    it(`${screen}: Cancel keeps the filled form, no error, nothing added`, async () => {
      const sent = stubServer();
      let asked = 0;
      setConfirmHandler(async () => {
        asked++;
        return null;
      });
      const e = await addSite().catch((x: unknown) => x);
      expect(asked).toBe(1);
      expect(sent).toHaveLength(1);   // the save was not sent again: nothing added
      expect(isConfirmCancelled(e)).toBe(true);
      expect(siteCreateConflict(e)).toBeNull();
      expect(view(e)).toBeNull();
      expect((e as Error).message).toBe(CONFIRM_CANCELLED_TEXT);
      expect((e as Error).message).not.toMatch(/acknowledge/i);
    });

    it(`${screen}: Continue anyway sends the save again with the warnings acknowledged`, async () => {
      const sent = stubServer();
      setConfirmHandler(async (ws, ids) => ({ acknowledge: ids.length ? ids : ws.map((x) => x.id), set: {} }));
      const site = await addSite();
      expect(site.id).toBe('s-new');
      expect(sent).toHaveLength(2);
      expect(sent[1]!.acknowledge).toEqual(expect.arrayContaining(warnings().filter((x) => x.tone === 'warning').map((x) => x.id)));
    });

    it(`${screen}: Accept sends the save again with the correction`, async () => {
      const sent = stubServer();
      // Accept every warning that offers a field correction, "anyway" for the rest (as the dialog's Continue sends it)
      setConfirmHandler(async (ws): Promise<ConfirmAnswer> => {
        const set: Record<string, unknown> = {};
        const acknowledge: string[] = [];
        for (const w of ws.filter((x) => x.tone === 'warning')) {
          const c = w.accept?.change;
          if (c && c.kind === 'fields') Object.assign(set, c.set);
          else acknowledge.push(w.id);
        }
        return { acknowledge, set };
      });
      const corrected = warnings().find((w) => w.accept?.change.kind === 'fields');
      const e = await addSite().catch((x: unknown) => x);
      if (corrected) expect(sent[1]).toMatchObject((corrected.accept!.change as { set: Record<string, unknown> }).set);
      // the corrected save either went through, or asked again about what the correction changed: never a duplicate, never raw text
      if (e && typeof e === 'object' && 'status' in e) {
        expect(siteCreateConflict(e)).toBeNull();
        expect(html(view(e))).not.toMatch(/acknowledge|already added/i);
      } else expect((e as { id: string }).id).toBe('s-new');
      expect(sent.length).toBeGreaterThanOrEqual(2);
    });

    it(`${screen}: a real duplicate shows its own message, in our words`, async () => {
      stubServer('site_exists');
      setConfirmHandler(async () => null);
      const e = await addSite().catch((x: unknown) => x);
      expect(isConfirmCancelled(e)).toBe(false);
      expect(siteCreateConflict(e)).toBe('exists');
      const out = html(view(e));
      expect(out).toContain('You already added this website');
      expect(out).toContain('devaicon.com is already one of your company&#x27;s websites.');
      expect(out).not.toContain('already one of your websites.');   // the server's sentence is not printed
    });
  }

  it('the duplicate message points the way: Open its settings (Add a website), the list above (onboarding)', async () => {
    stubServer('site_exists');
    const e = await addSite().catch((x: unknown) => x);
    expect(html(SCREENS['Add a website (the site is in the list)'](e))).toContain('Open its settings');
    expect(html(SCREENS['onboarding Website step'](e))).toContain('Choose it in the list above to continue.');
  });

  it('a raced save (409 conflict) is a duplicate too; another company verified it = its own message', async () => {
    stubServer('conflict');
    expect(siteCreateConflict(await addSite().catch((x: unknown) => x))).toBe('exists');
    vi.unstubAllGlobals();
    stubServer('domain_claimed');
    const e = await addSite().catch((x: unknown) => x);
    expect(siteCreateConflict(e)).toBe('claimed');
    for (const view of Object.values(SCREENS)) expect(html(view(e))).toContain('already belongs to another company');
  });

  it('with no dialog to ask, a confirm_needed still never prints the server text or "already added"', async () => {
    stubServer();
    const e = await addSite().catch((x: unknown) => x);
    expect(isConfirmCancelled(e)).toBe(true);
    expect((e as Error).message).not.toMatch(/acknowledge/i);
  });
});

// The same defect on the keyword check (onboarding Keyword step, New keyword ladder): after Cancel the card showed the server's sentence
// 'send their ids in "acknowledge"'. A confirm_needed is answered in the dialog only; it is never an error message anywhere.
describe('a keyword check that asks "Check this first"', () => {
  const CHECK_WARNINGS = (): Warning[] =>
    consistencyWarnings('keyword_check', { keyword: 'ai automation services dubai', country: 'Pakistan' }, { site: { domain: 'devaicon.com', country: 'Pakistan', business: 'Software' } });
  function stubCheck() {
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body?: string }) => {
      const body = JSON.parse(init.body ?? '{}') as Record<string, unknown>;
      sent.push(body);
      const w = CHECK_WARNINGS();
      const acked = Array.isArray(body.acknowledge) ? (body.acknowledge as string[]) : [];
      const open = w.filter((x) => x.tone === 'warning' && !acked.includes(x.id));
      if (open.length) return new Response(JSON.stringify({ error: SERVER_TEXT, code: 'confirm_needed', warnings: w, notices: w, needsAcknowledge: open.map((x) => x.id) }), { status: 409 });
      return new Response(JSON.stringify({ id: 'k-1', keyword: body.keyword }), { status: 200 });
    });
    return sent;
  }
  const assess = () => api('/api/orgs/o-1/sites/s-1/keywords/assess', { method: 'POST', body: { keyword: 'ai automation services dubai' } });

  it('the fixture asks (a keyword about another market than the website)', () => {
    expect(CHECK_WARNINGS().filter((x) => x.tone === 'warning').length).toBeGreaterThan(0);
  });

  it('Cancel: nothing sent again, the New keyword ladder card shows no error and no server text', async () => {
    const sent = stubCheck();
    setConfirmHandler(async () => null);
    const e = await assess().catch((x: unknown) => x);
    expect(sent).toHaveLength(1);
    expect(isConfirmCancelled(e)).toBe(true);
    expect(renderToString(<CheckError error={e} />)).toBe('');
    expect((e as Error).message).not.toMatch(/acknowledge/i);
  });

  it('Cancel: the onboarding Keyword step puts its cards back as they were', () => {
    type I = { keyword: string; state: string };
    const other: I = { keyword: 'erp uae', state: 'done' };
    // a new idea being checked is taken off; the other cards stay
    expect(undoIdeaCheck<I>([other, { keyword: 'AI automation dubai', state: 'checking' }], 'ai automation dubai')).toEqual([other]);
    // an alternative tried in place of a checked card: the card it replaced comes back
    const prev: I = { keyword: 'ai consulting', state: 'done' };
    expect(undoIdeaCheck<I>([{ keyword: 'ai consulting dubai', state: 'checking' }, other], 'ai consulting dubai', prev)).toEqual([prev, other]);
  });

  it('Continue anyway: the check is sent again with the warnings acknowledged', async () => {
    const sent = stubCheck();
    setConfirmHandler(async (_ws, ids) => ({ acknowledge: ids, set: {} }));
    expect(await assess()).toMatchObject({ id: 'k-1' });
    expect(sent).toHaveLength(2);
  });

  it('a tool form (Keyword Check and every run form) shows no error card after Cancel', async () => {
    stubCheck();
    setConfirmHandler(async () => null);
    const e = await assess().catch((x: unknown) => x);
    expect(renderToString(<SubmitError error={e} />)).toBe('');
  });

  it('toasts: a cancelled check says nothing, an Accept that replaced the request says what was done, a real error is shown', () => {
    toasts.error.length = 0;
    toasts.success.length = 0;
    toastError(new ApiRequestError(409, CONFIRM_CANCELLED_TEXT, {}, 'confirm_needed', { cancelled: true }), 'The change was not saved');
    expect(toasts.error).toHaveLength(0);
    toastError(new ApiRequestError(409, 'Done: added to your ladder. Nothing new was started.', {}, DONE_INSTEAD));
    expect(toasts.success).toHaveLength(1);
    toastError(new ApiRequestError(500, 'The server could not answer (500).'), 'The change was not saved');
    expect(toasts.error).toEqual([['The change was not saved', { description: 'The server could not answer (500).' }]]);
  });
});
