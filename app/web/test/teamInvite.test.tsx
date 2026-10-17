import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { InvitationPreview, Me } from '@seo/shared';
import AcceptInvitePage from '@/pages/auth/AcceptInvitePage';
import { InvitationSentNote } from '@/pages/settings/OrgSettingsPage';
import { qk } from '@/lib/queries';
import { ThemeProvider } from '@/lib/theme';
import { text } from './renderReport';

// The invite flow of the 2026-10-17 re-rating (executor D, part 1, shots i06-i10), on a server that sends no e-mail.

describe('D-10: the invite dialog says what was really sent', () => {
  it('no mail account: nothing is claimed to be sent', () => {
    const t = text(renderToString(<InvitationSentNote email="rr1017-member@example.org" role="member" emailed={false} />));
    expect(t).not.toMatch(/We sent|We e-mailed/);
    expect(t).toContain('This app sends no e-mail, so nothing has been sent');
  });
  it('with a mail account it says it was e-mailed', () => {
    expect(text(renderToString(<InvitationSentNote email="a@example.org" role="admin" emailed />))).toContain('We e-mailed an invitation to a@example.org as admin');
  });
});

describe('D-11: after joining from an invitation, the page leads into the company', () => {
  const me = { user: { id: 'u-member', email: 'rr1017-member@example.org', name: 'Rerate Member' }, orgs: [{ id: 'org-7bf8', name: 'Rerate 1017 Trading', role: 'member' }], platformAdmin: false } as unknown as Me;
  const render = (preview: InvitationPreview) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    qc.setQueryData(qk.me, me);
    qc.setQueryData(['invitation', 'tok', 'u-member'], preview);
    return text(
      renderToString(
        <ThemeProvider>
          <QueryClientProvider client={qc}>
            <MemoryRouter initialEntries={['/invite/tok']}>
              <Routes>
                <Route path="/invite/:token" element={<AcceptInvitePage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </ThemeProvider>,
      ),
    );
  };
  const base: InvitationPreview = { orgName: 'Rerate 1017 Trading', email: 'rr1017-member@example.org', role: 'member', inviterName: 'Rerate Owner', valid: false, reason: 'This invitation was already accepted.' };

  it('a member who joined from it gets "You joined … — Open it", not only "already accepted"', () => {
    const t = render({ ...base, reason: 'You are a member of Rerate 1017 Trading.', joinedOrgId: 'org-7bf8' });
    expect(t).toContain('You joined Rerate 1017 Trading');
    expect(t).toContain('Open Rerate 1017 Trading');
    expect(t).not.toContain('already accepted');
  });
  it('someone else still reads that the invitation was used', () => {
    expect(render(base)).toContain('This invitation was already accepted.');
  });
});
