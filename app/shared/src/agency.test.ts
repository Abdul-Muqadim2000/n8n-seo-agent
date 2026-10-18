import { describe, expect, it } from 'vitest';
import {
  AA,
  brandCss,
  brandingSchema,
  brandTokens,
  clientSafePayload,
  clientWorkspaceRole,
  contrastRatio,
  effectiveBrand,
  fromCheckPasses,
  inviteRoleProblem,
  NEUTRALS,
  normalizeHost,
  overviewCsvRow,
  OVERVIEW_CSV_COLUMNS,
  parseHex,
  portalHostProblem,
  portalTxtName,
  portalTxtValue,
  provisionedRole,
  rebrandText,
  senderDisplayName,
  type AgencyOverviewRow,
} from './agency';
import { roleAtLeast } from './constants';
import { csvCell } from './identity';

describe('roles', () => {
  it('client roles rank below viewer, so every viewer route refuses them', () => {
    expect(roleAtLeast('client_viewer', 'viewer')).toBe(false);
    expect(roleAtLeast('client_approver', 'viewer')).toBe(false);
    expect(roleAtLeast('client_approver', 'client_viewer')).toBe(true);
    expect(roleAtLeast('client_viewer', 'client_approver')).toBe(false);
    expect(roleAtLeast('viewer', 'client_approver')).toBe(true);
  });

  const m = (role: string, deactivated = false) => ({ role, deactivated });
  it('agency owners and admins reach every client; members and viewers only when assigned', () => {
    expect(clientWorkspaceRole({ direct: null, agency: m('owner') })).toBe('owner');
    expect(clientWorkspaceRole({ direct: null, agency: m('admin') })).toBe('admin');
    expect(clientWorkspaceRole({ direct: null, agency: m('member') })).toBeNull();
    expect(clientWorkspaceRole({ direct: null, agency: m('viewer') })).toBeNull();
    expect(clientWorkspaceRole({ direct: m('member'), agency: m('viewer') })).toBe('member');
    expect(clientWorkspaceRole({ direct: m('viewer'), agency: m('admin') })).toBe('admin');
  });
  it('an assignment means nothing without an active agency membership, and never makes an owner', () => {
    expect(clientWorkspaceRole({ direct: m('admin'), agency: null })).toBeNull();
    expect(clientWorkspaceRole({ direct: m('admin'), agency: m('member', true) })).toBeNull();
    expect(clientWorkspaceRole({ direct: null, agency: m('owner', true) })).toBeNull();
    expect(clientWorkspaceRole({ direct: m('owner'), agency: m('member') })).toBeNull();
  });
  it('client people have their client role; a switched-off one has none', () => {
    expect(clientWorkspaceRole({ direct: m('client_viewer'), agency: null })).toBe('client_viewer');
    expect(clientWorkspaceRole({ direct: m('client_approver'), agency: null })).toBe('client_approver');
    expect(clientWorkspaceRole({ direct: m('client_approver', true), agency: null })).toBeNull();
  });
  it('invitations: client roles only into client workspaces, staff roles never there', () => {
    expect(inviteRoleProblem('client', 'client_viewer')).toBeNull();
    expect(inviteRoleProblem('client', 'member')).toMatch(/assigning/);
    expect(inviteRoleProblem('agency', 'client_viewer')).toMatch(/only in client/);
    expect(inviteRoleProblem('standard', 'admin')).toBeNull();
  });
  it('single sign-on and SCIM never provision staff into a client workspace', () => {
    expect(provisionedRole('client', 'admin')).toBe('client_viewer');
    expect(provisionedRole('client', 'client_approver')).toBe('client_approver');
    expect(provisionedRole('standard', 'viewer')).toBe('viewer');
    expect(provisionedRole('standard', 'owner')).toBe('member');
  });
});

describe('colour', () => {
  it('reads hex only', () => {
    expect(parseHex('#2E4BFF')).toEqual({ r: 46, g: 75, b: 255 });
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('#2e4bff;}body{display:none')).toBeNull();
  });
  it('contrast ratio matches WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  const COLOURS = ['#2e4bff', '#ffd400', '#e6e6e6', '#00ff00', '#000000', '#ffffff', '#ff6600', '#7a1fa2', '#0a7d5a', '#f0f2f7', '#111729', '#9b9b9b'];
  for (const c of COLOURS) {
    it(`every text pairing passes AA in light and dark for ${c}`, () => {
      const t = brandTokens(c)!;
      expect(t).not.toBeNull();
      const L = NEUTRALS.light;
      const D = NEUTRALS.dark;
      // button text on the fill and its hovers
      for (const s of [t.light, t.dark]) {
        expect(contrastRatio(s.accent, s['accent-ink'])).toBeGreaterThanOrEqual(AA);
        expect(contrastRatio(s['accent-hover'], s['accent-ink'])).toBeGreaterThanOrEqual(AA);
      }
      for (const bg of [L.page, L.surface, L.surface2, t.light['accent-soft']]) expect(contrastRatio(t.light['accent-text'], bg)).toBeGreaterThanOrEqual(AA);
      for (const bg of [D.page, D.surface, D.surface2, t.dark['accent-soft']]) expect(contrastRatio(t.dark['accent-text'], bg)).toBeGreaterThanOrEqual(AA);
      for (const bg of [L.inkSurface, D.inkSurface]) expect(contrastRatio(t.light['accent-on-ink'], bg)).toBeGreaterThanOrEqual(AA);
      // dark mode keeps a dark soft tint (never a light block on a dark page)
      expect(contrastRatio(t.dark['accent-soft'], D.ink)).toBeGreaterThanOrEqual(AA);
      expect(t.contrast.ratios.button).toBeGreaterThanOrEqual(AA);
    });
  }
  it('says what it changed, and changes nothing that already passes', () => {
    expect(brandTokens('#ffd400')!.contrast.adjustments.join(' ')).toMatch(/darker shade/);
    const blue = brandTokens('#2238d9')!;
    expect(blue.light.accent).toBe('#2238d9');
    expect(blue.light['accent-ink']).toBe('#ffffff');
  });
  it('the stylesheet carries only computed values, under the app\'s dark selectors', () => {
    const css = brandCss(brandTokens('#2e4bff')!);
    expect(css).toMatch(/^:root\{--accent:#[0-9a-f]{6};/);
    expect(css).toContain("@media (prefers-color-scheme: dark){:root:not([data-theme='light']){");
    expect(css).toContain(":root[data-theme='dark']{");
    expect(css.replace(/rgba\([\d., ]+\)|#[0-9a-f]{6}/g, '')).not.toMatch(/[<>"\\]|url\(|expression/i);
    expect(brandTokens('javascript:alert(1)')).toBeNull();
  });
});

describe('branding', () => {
  it('validates the settings', () => {
    expect(brandingSchema.safeParse({ accent: 'blue' }).success).toBe(false);
    expect(brandingSchema.safeParse({ logoUrl: 'http://agency.com/logo.png' }).success).toBe(false);
    expect(brandingSchema.safeParse({ logoUrl: 'https://10.0.0.1/logo.png' }).success).toBe(false);
    expect(brandingSchema.safeParse({ productName: 'Acme <script>' }).success).toBe(false);
    expect(brandingSchema.parse({ accent: '#1F6FEB' }).accent).toBe('#1f6feb');
  });
  it('a brand exists only with white-label on; client overrides win; names fall back to the agency', () => {
    expect(effectiveBrand({ name: 'Agency', branding: { productName: 'X' } })).toBeNull();
    const b = effectiveBrand({ name: 'North Agency', branding: { whiteLabel: true, accent: '#ff6600', logoUrl: 'https://north.example.com/l.svg' } }, { branding: { productName: 'Acme Insights' } })!;
    expect(b.name).toBe('Acme Insights');
    expect(b.accent).toBe('#ff6600');
    expect(b.logoUrl).toBe('https://north.example.com/l.svg');
    expect(b.poweredBy).toBe(false);
    expect(effectiveBrand({ name: 'North Agency', branding: { whiteLabel: true } })!.name).toBe('North Agency');
    expect(effectiveBrand({ name: 'North Agency', branding: { whiteLabel: true } })!.initials).toBe('NA');
  });
  it('rebrands whole words only', () => {
    expect(rebrandText('Prepared by Dev SEO for acme. DEV SEO report.', ['Dev SEO', 'Ascentra'], 'North')).toBe('Prepared by North for acme. North report.');
    expect(rebrandText('Ascentrals and Ascentra', ['Ascentra'], 'North')).toBe('Ascentrals and North');
    expect(rebrandText('an SE report', ['SE'], 'North')).toBe('an SE report');
  });
  it('a display name cannot break the address header', () => {
    expect(senderDisplayName('Acme "SEO" <x@y>\r\nBcc: z')).toBe('Acme SEO x@yBcc: z');
  });
  it('a custom From needs SPF and DKIM', () => {
    expect(fromCheckPasses({ spf: 'pass', dkim: 'found' })).toBe(true);
    expect(fromCheckPasses({ spf: 'weak', dkim: 'found' })).toBe(false);
    expect(fromCheckPasses({ spf: 'pass', dkim: 'unknown' })).toBe(false);
    expect(fromCheckPasses(null)).toBe(false);
  });
});

describe('portal host', () => {
  it('normalises what people paste', () => {
    expect(normalizeHost('https://SEO.Agency.com:443/login')).toBe('seo.agency.com');
    expect(normalizeHost('seo.agency.com.')).toBe('seo.agency.com');
    expect(normalizeHost('localhost')).toBeNull();
    expect(normalizeHost('192.168.1.1')).toBeNull();
    expect(normalizeHost('user@seo.agency.com')).toBeNull();
    expect(normalizeHost('seо.agency.com')).toBeNull(); // a Cyrillic "о"
    expect(normalizeHost('-bad.agency.com')).toBeNull();
  });
  it('refuses the platform\'s own hosts and private names', () => {
    expect(portalHostProblem('app.ascentra.app', ['ascentra.app'])).toMatch(/platform/);
    expect(portalHostProblem('ascentra.app', ['ascentra.app'])).toMatch(/platform/);
    expect(portalHostProblem('seo.agency.test', [])).toMatch(/public/);
    expect(portalHostProblem('seo.agency.com', ['ascentra.app'])).toBeNull();
    expect(portalHostProblem(null, [])).toMatch(/Enter/);
  });
  it('the DNS proof names no product', () => {
    expect(portalTxtName('seo.agency.com')).toBe('_portal-verification.seo.agency.com');
    expect(portalTxtValue('abc')).toBe('portal-verification=abc');
  });
});

describe('what a client person sees', () => {
  it('drops cost, ledger and budget keys at any depth and keeps the rest', () => {
    const p = clientSafePayload({
      health_score: 80,
      run_cost_usd: 1.2,
      cost: { dataforseo: 1 },
      engine: { ledger: [1], spentUsd: 3, findings: [{ title: 'x', price_usd: 2 }] },
      budget_left: 4,
      run_cost_estimate_usd: 0.5,
      keyword: 'price of erp',
    });
    expect(p).toEqual({ health_score: 80, engine: { findings: [{ title: 'x' }] }, keyword: 'price of erp' });
  });
  it('the overview CSV is formula-safe and lines up with its header', () => {
    const r: AgencyOverviewRow = { clientId: 'c', clientName: '=HYPERLINK("x")', siteId: 's', domain: 'acme.com', verified: true, tracking: 'active', healthScore: 81, healthAt: '2026-10-01', rankGains: 3, rankDrops: 1, clicksPct: 12.5, aiVisibility: 40, aiMentionRate: 0.2, alerts14d: 0, approvalsWaiting: 2, spentUsd: 3.2, budgetUsd: 25 };
    const line = overviewCsvRow(r, csvCell);
    expect(line.startsWith(`"'=HYPERLINK`)).toBe(true);
    expect(line.split('","').length).toBe(OVERVIEW_CSV_COLUMNS.length);
  });
});
