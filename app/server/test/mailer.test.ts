import { describe, expect, it, vi } from 'vitest';

// The account e-mails' layout (lib/mailer.ts): the logo, one button, the link written out, the help line, and nothing that makes
// Gmail file an invitation under Promotions (product cards, a row of site links, several images).
vi.hoisted(() => {
  process.env.APP_URL = 'https://app.alaventra.test';
  process.env.SUPPORT_EMAIL = 'help@alaventra.test';
  process.env.LOG_LEVEL = 'silent';
  process.env.SEO_API_KEY = 'test-only';
});

const { renderMail } = await import('../src/lib/mailer');

const invite = {
  to: 'new@techand.ai',
  subject: 'Sara invited you to Techand Systems on Alaventra',
  title: 'Join Techand Systems on Alaventra',
  lines: ['Sara Khan invited you to join Techand Systems as member.', 'You will see the SEO dashboards.'],
  details: [{ label: 'Your role', value: 'Member' }],
  action: { label: 'Accept the invitation', url: 'https://app.alaventra.test/invite/abc' },
  footer: 'The invitation works for 7 days.',
};

describe('account e-mail layout', () => {
  it('our own e-mail: the logo from our domain, the button, the help page and address, no marketing links', () => {
    const { html, text } = renderMail(invite);
    expect(html).toContain('src="https://app.alaventra.test/brand/alaventra-email-logo.png"');
    expect(html).toContain('alt="Alaventra"');
    expect(html).toContain('Join Techand Systems on Alaventra');
    expect(html).toContain('href="https://app.alaventra.test/invite/abc"');
    expect(html).toContain('https://app.alaventra.test/contact?topic=support');
    expect(html).toContain('mailto:help@alaventra.test');
    expect(html.match(/<img /g)).toHaveLength(1);
    // the links: the button, the same link written out, the help page, the support address; nothing else
    expect(html.match(/href="/g)).toHaveLength(4);
    expect(html).not.toMatch(/\/pricing|\/platform|unsubscribe/i);
    expect(text).toContain('Accept the invitation: https://app.alaventra.test/invite/abc');
    expect(text).toContain('Your role: Member');
    expect(text).toContain('help@alaventra.test');
    expect(html + text).not.toMatch(/[—–“”‘’…]/);
  });

  it('a white-label agency: its name and support address, never our logo, links or name', () => {
    const { html, text } = renderMail({
      ...invite,
      title: 'Join Techand Systems on North Insights',
      action: { label: 'Accept the invitation', url: 'https://seo.north.example.com/invite/abc' },
      sender: { brandName: 'North Insights', buttonColor: '#ff6600', from: 'x', whiteLabel: true, logoUrl: 'https://north.example.com/logo.svg', supportEmail: 'care@north.example.com', footerText: 'North Agency, Dubai' },
    });
    expect(html).not.toContain('alaventra');
    expect(text).not.toContain('alaventra');
    expect(html).not.toContain('<img '); // an SVG logo: Gmail draws none, so the name is written
    expect(html).toContain('North Insights');
    expect(html).toContain('mailto:care@north.example.com');
    expect(html).toContain('North Agency, Dubai');
    expect(html).toContain('background:#ff6600');
  });

  it('escapes what people typed', () => {
    const { html } = renderMail({ ...invite, lines: ['<script>x</script> & "you"'] });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;you&quot;');
  });
});
