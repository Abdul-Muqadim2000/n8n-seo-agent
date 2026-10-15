import { describe, expect, it } from 'vitest';
import { authCheckStale, compose, mailAuthGate, MAIL_AUTH_TTL_DAYS, parseIncoming, stripQuoted } from '../src/services/mail';
import type { DnsCheck } from '@seo/shared';
import type { MailboxRow } from '../src/db/schema';

const mb = { fromName: 'Sara Khan', fromEmail: 'sara@techand.ai', signatureName: 'Sara Khan', signatureTitle: 'Head of Finance Systems', company: 'Techand Systems', postalAddress: 'Office 1204, Bay Square, Dubai, UAE' } as unknown as MailboxRow;

describe('composing a sequence e-mail (v4.13)', () => {
  it('first e-mail: plain text, the footer with the postal address and the opt-out, an unsubscribe header, our own Message-ID', () => {
    const m = compose(mb, { sequenceId: '0f3c2a9b-1111-2222-3333-444455556666', step: 0, to: 'editor@erpdaily.ae', subject: 'A dead link in your guide', body: 'Hi Layla,\n\nThe link "UAE guide" is dead.', firstSubject: 'A dead link in your guide', country: 'AE', foundOn: 'https://erpdaily.ae/contact', previousIds: [] });
    expect(m.subject).toBe('A dead link in your guide'); expect(m.text).toContain('Bay Square'); expect(m.text).toMatch(/reply "no"/); expect(m.text).not.toContain('I found your address');   // not an EU / UK recipient
    expect(m.headers['List-Unsubscribe']).toBe('<mailto:sara@techand.ai?subject=unsubscribe>'); expect(m.messageId).toMatch(/^<lb\.0f3c2a9b\.0\.[\w-]+@techand\.ai>$/); expect(m.inReplyTo).toBeUndefined();
  });
  // B11-3 (2026-10-15, benchmark area 11): CAN-SPAM asks for the postal address in every commercial message, so the follow-ups
  // carry it too. Only the GDPR Art. 14 source line is first-contact-only.
  it('follow-up: same thread (Re:, In-Reply-To / References), and the postal address again', () => {
    const m = compose(mb, { sequenceId: '0f3c2a9b-1111-2222-3333-444455556666', step: 1, to: 'editor@erpdaily.ae', subject: '', body: 'One more detail.', firstSubject: 'A dead link in your guide', country: 'AE', foundOn: '', previousIds: ['<lb.0f3c2a9b.0.abc@techand.ai>'] });
    expect(m.subject).toBe('Re: A dead link in your guide'); expect(m.inReplyTo).toBe('<lb.0f3c2a9b.0.abc@techand.ai>'); expect(m.references).toEqual(['<lb.0f3c2a9b.0.abc@techand.ai>']); expect(m.text).toContain('Bay Square'); expect(m.text).not.toContain('I found your address');
  });
});

describe('reading incoming mail (v4.13)', () => {
  it('a person\'s reply: our Message-ID in In-Reply-To, the quoted e-mail stripped', async () => {
    const src = ['From: Layla Haddad <layla.haddad@erpdaily.ae>', 'To: sara@techand.ai', 'Subject: Re: A dead link in your guide', 'Message-ID: <r1@erpdaily.ae>', 'In-Reply-To: <lb.0f3c2a9b.0.abc@techand.ai>', 'References: <lb.0f3c2a9b.0.abc@techand.ai>', 'Content-Type: text/plain; charset=utf-8', '', 'Thanks Sara, could you send a short description?', '', 'On Mon, 12 Oct 2026 at 10:00, Sara Khan <sara@techand.ai> wrote:', '> Hi Layla', ''].join('\r\n');
    const m = await parseIncoming(src);
    expect(m.kind).toBe('person'); expect(m.from).toBe('layla.haddad@erpdaily.ae'); expect(m.fromDomain).toBe('erpdaily.ae'); expect(m.inReplyTo).toBe('<lb.0f3c2a9b.0.abc@techand.ai>');
    expect(stripQuoted(m.text)).toBe('Thanks Sara, could you send a short description?');
  });
  it('an out-of-office reply by its headers', async () => {
    const src = ['From: editor@erpdaily.ae', 'To: sara@techand.ai', 'Subject: Automatic reply: A dead link in your guide', 'Auto-Submitted: auto-replied', 'Message-ID: <a1@erpdaily.ae>', 'Content-Type: text/plain', '', 'I am away until 20 October.'].join('\r\n');
    expect((await parseIncoming(src)).kind).toBe('auto');
  });
  it('a hard bounce: the original Message-ID and recipient from the delivery report', async () => {
    const src = ['From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>', 'To: sara@techand.ai', 'Subject: Delivery Status Notification (Failure)', 'Message-ID: <b1@google.com>', 'MIME-Version: 1.0', 'Content-Type: multipart/report; report-type=delivery-status; boundary="BB"', '',
      '--BB', 'Content-Type: text/plain', '', 'Address not found', '', '--BB', 'Content-Type: message/delivery-status', '', 'Reporting-MTA: dns; googlemail.com', '', 'Final-Recipient: rfc822; nobody@erpdaily.ae', 'Action: failed', 'Status: 5.1.1', '',
      '--BB', 'Content-Type: text/rfc822-headers', '', 'From: sara@techand.ai', 'To: nobody@erpdaily.ae', 'Subject: A dead link in your guide', 'Message-ID: <lb.0f3c2a9b.0.abc@techand.ai>', '', '--BB--', ''].join('\r\n');
    const m = await parseIncoming(src);
    expect(m.kind).toBe('bounce'); expect(m.hardBounce).toBe(true); expect(m.policyBlock).toBe(false);
    expect(m.bounceIds).toContain('<lb.0f3c2a9b.0.abc@techand.ai>'); expect(m.bounceRecipients).toContain('nobody@erpdaily.ae');
  });
  it('a policy block (5.7.x) is told apart from an unknown address', async () => {
    const src = ['From: postmaster@outlook.com', 'To: sara@techand.ai', 'Subject: Undeliverable: A dead link', 'Content-Type: multipart/report; report-type=delivery-status; boundary="CC"', '', '--CC', 'Content-Type: message/delivery-status', '', 'Final-Recipient: rfc822; editor@x.com', 'Action: failed', 'Status: 5.7.1', '', '--CC--', ''].join('\r\n');
    const m = await parseIncoming(src); expect(m.kind).toBe('bounce'); expect(m.policyBlock).toBe(true);
  });
});

// ---- B11-4 (2026-10-15, benchmark area 11): the authentication gate runs on the read path too -------------------------------
// SPF / DKIM / DMARC used to be read once, when the mailbox was connected, stored on the row and never looked at again — and no
// path refused a send over the answer. These prove the refusal and, just as importantly, what it does NOT refuse.
describe('B11-4 the sending domain is checked before a new conversation', () => {
  const dns = (o: Partial<DnsCheck>): DnsCheck => ({ spf: 'pass', dmarc: 'pass', dkim: 'found', checkedAt: new Date().toISOString(), notes: [], ...o });
  it('a reading younger than the window is used as it stands, and nothing is looked up', async () => {
    const g = await mailAuthGate('sara@techand.ai', dns({}));
    expect(g.ok).toBe(true); expect(g.rechecked).toBe(false);
  });
  it('neither SPF nor DKIM on the From domain stops a new conversation, and says why', async () => {
    const g = await mailAuthGate('sara@techand.ai', dns({ spf: 'missing', dkim: 'unknown', dmarc: 'missing' }));
    expect(g.ok).toBe(false);
    expect(g.why).toContain('techand.ai');
    expect(g.why).toMatch(/SPF/); expect(g.why).toMatch(/DKIM/);
    expect(g.why).toMatch(/follow-ups/);   // an open conversation is never left hanging
  });
  it('DKIM alone is enough: a missing SPF is a note, not a refusal', async () => {
    expect((await mailAuthGate('sara@techand.ai', dns({ spf: 'missing', dkim: 'found' }))).ok).toBe(true);
  });
  it('a weak SPF or a p=none DMARC is never a refusal — only the total absence of authentication is', async () => {
    expect((await mailAuthGate('sara@techand.ai', dns({ spf: 'weak', dmarc: 'none' }))).ok).toBe(true);
  });
  it('a reading older than the window, or one that was never taken, is re-read before it is trusted', () => {
    const old = new Date(Date.now() - (MAIL_AUTH_TTL_DAYS + 1) * 864e5).toISOString();
    expect(authCheckStale(dns({ checkedAt: old }))).toBe(true);
    expect(authCheckStale(null)).toBe(true);
    expect(authCheckStale(dns({ checkedAt: 'not a date' }))).toBe(true);
    expect(authCheckStale(dns({}))).toBe(false);
  });
});
