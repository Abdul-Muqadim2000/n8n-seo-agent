// G5 (gap #12, app/docs/WHITE_LABEL.md): agencies, their client workspaces and the white-label client portal.
//
// The rules shared by the server (which enforces them) and the web app (which mirrors them): org kinds and client roles, the brand
// an agency sets and the colour tokens computed from it (WCAG AA in light and dark), the portal host rules and its DNS proof, the
// e-mail settings, approvals, and what a client person may see of a report payload.

import { z } from 'zod';
import { brandInitials, brandLogoUrl } from './brand';
import { ROLE_RANK, type Role } from './constants';

// ---------------------------------------------------------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------------------------------------------------------

export const ORG_KINDS = ['standard', 'agency', 'client'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];
export const orgKindOf = (v: unknown): OrgKind => ((ORG_KINDS as readonly string[]).includes(String(v)) ? (v as OrgKind) : 'standard');

/** The two roles a client person can hold, both below `viewer`: every route that asks for viewer or more refuses them. */
export const CLIENT_ROLES = ['client_approver', 'client_viewer'] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];
export const STAFF_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const isClientRole = (r: unknown): r is ClientRole => (CLIENT_ROLES as readonly string[]).includes(String(r));
export const isStaffRole = (r: unknown): r is StaffRole => (STAFF_ROLES as readonly string[]).includes(String(r));
/** what an agency admin can assign an agency member in one client workspace (owner comes only from the agency's owners) */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** the higher of two roles (null-safe) */
export function higherRole(a: Role | null | undefined, b: Role | null | undefined): Role | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return ROLE_RANK[b] > ROLE_RANK[a] ? b : a;
}

/**
 * The role a person has in a client workspace, from what they hold there and in its agency (WHITE_LABEL.md §4):
 *  - an agency owner / admin reaches every client with that role;
 *  - an agency member / viewer reaches only clients they were assigned to (a staff membership in the client), with that role;
 *  - a client person has their client role;
 *  - nothing from an agency membership that is gone or switched off, and no assignment is honoured without one.
 * The highest of these wins; null = no access (the caller answers 404).
 */
export function clientWorkspaceRole(o: {
  direct: { role: string; deactivated: boolean } | null;
  agency: { role: string; deactivated: boolean } | null;
}): Role | null {
  const agencyActive = o.agency && !o.agency.deactivated && isStaffRole(o.agency.role) ? (o.agency.role as StaffRole) : null;
  let best: Role | null = null;
  if (o.direct && !o.direct.deactivated) {
    if (isClientRole(o.direct.role)) best = o.direct.role;
    // an assignment, honoured only while the person is still in the agency; never owner
    else if (agencyActive && isStaffRole(o.direct.role) && o.direct.role !== 'owner') best = higherRole(best, o.direct.role);
  }
  if (agencyActive === 'owner' || agencyActive === 'admin') best = higherRole(best, agencyActive);
  return best;
}

/** inviting into a company: client roles only in client workspaces, staff roles never there (staff come by assignment) */
export function inviteRoleProblem(kind: OrgKind, role: string): string | null {
  if (kind === 'client') return isClientRole(role) ? null : 'People of the agency are added to a client by assigning them from the agency. Invite the client’s people as client viewer or client approver.';
  return isClientRole(role) ? 'Client roles exist only in client workspaces.' : null;
}

/** the role a person provisioned by single sign-on or SCIM gets in this company (a client workspace never provisions staff) */
export function provisionedRole(kind: OrgKind, requested: string): Role {
  if (kind === 'client') return isClientRole(requested) ? requested : 'client_viewer';
  return (isStaffRole(requested) && requested !== 'owner' ? requested : 'member') as Role;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Colour: one accent, tokens for light and dark that pass WCAG AA
// ---------------------------------------------------------------------------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rrggbb` or `#rgb` → numbers; anything else → null (no names, no functions: nothing typed reaches a stylesheet as text) */
export function parseHex(v: unknown): Rgb | null {
  const s = String(v ?? '').trim();
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (m6) return { r: parseInt(m6[1]!, 16), g: parseInt(m6[2]!, 16), b: parseInt(m6[3]!, 16) };
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) return { r: parseInt(m3[1]! + m3[1]!, 16), g: parseInt(m3[2]! + m3[2]!, 16), b: parseInt(m3[3]! + m3[3]!, 16) };
  return null;
}
const h2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const toHex = (c: Rgb): string => `#${h2(c.r)}${h2(c.g)}${h2(c.b)}`;
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
/** WCAG 2.x relative luminance */
export const luminance = (c: Rgb): number => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
/** WCAG 2.x contrast ratio, 1–21 */
export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const x = typeof a === 'string' ? parseHex(a) : a;
  const y = typeof b === 'string' ? parseHex(b) : b;
  if (!x || !y) return 1;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
/** t of the way from a to b */
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const round = (c: Rgb): Rgb => parseHex(toHex(c))!;

/** moves `c` towards black (or white) in small steps until it reaches `target` against every colour in `against` */
export function adjustToContrast(c: Rgb, against: Rgb[], target: number, towards: 'darker' | 'lighter'): { color: Rgb; steps: number } {
  const end = towards === 'darker' ? BLACK : WHITE;
  for (let i = 0; i <= 100; i++) {
    const x = round(mix(c, end, i / 100));
    if (against.every((a) => contrastRatio(x, a) >= target)) return { color: x, steps: i };
  }
  return { color: end, steps: 100 };
}

/** the app's neutrals (web/src/index.css) the accent is checked against */
export const NEUTRALS = {
  light: { page: '#f6f7fb', surface: '#ffffff', surface2: '#f0f2f7', ink: '#0a0f1f', inkSurface: '#0a0f1f' },
  dark: { page: '#0a0f1f', surface: '#111729', surface2: '#182036', ink: '#f2f4fa', inkSurface: '#151c33' },
} as const;
export const AA = 4.5;

/** the token names a brand sets (the rest of the palette stays the app's) */
export const BRAND_TOKEN_NAMES = [
  'accent',
  'accent-hover',
  'accent-ink',
  'accent-soft',
  'accent-text',
  'accent-on-ink',
  'ring-color',
  'selection',
  'series-1',
  'seq-1',
  'seq-2',
  'seq-3',
  'seq-4',
  'seq-5',
  'seq-6',
] as const;
export type BrandTokenName = (typeof BRAND_TOKEN_NAMES)[number];
export type BrandTokenSet = Record<BrandTokenName, string>;

export interface BrandContrast {
  /** the colour the agency gave */
  input: string;
  /** button fill (both modes) */
  fill: string;
  /** text on the button: white or ink */
  fillText: string;
  /** links / active text in light mode and in dark mode */
  lightText: string;
  darkText: string;
  /** worst ratio of each pair (all ≥ 4.5) */
  ratios: { button: number; lightText: number; darkText: number; onInk: number };
  /** plain-language list of what was changed to pass */
  adjustments: string[];
}

export interface BrandTokens {
  light: BrandTokenSet;
  dark: BrandTokenSet;
  contrast: BrandContrast;
}

const rgba = (c: Rgb, a: number) => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${a})`;
const minRatio = (c: Rgb, against: Rgb[]) => Math.min(...against.map((a) => contrastRatio(c, a)));
const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * The accent tokens for one brand colour, light and dark, every text pairing at WCAG AA (4.5:1):
 *  - the button fill carries white or ink text, whichever reads better, and is darkened / lightened until that text passes;
 *  - accent text (links, the active nav item, the focus ring) is darkened in light mode and lightened in dark mode until it passes on
 *    page, surface, surface-2 and its own soft tint;
 *  - the soft tint, the selection and the sequential chart ramp are mixes of the colour, so dark mode keeps dark surfaces.
 * Null for anything that is not a hex colour.
 */
export function brandTokens(accentHex: string): BrandTokens | null {
  const input = parseHex(accentHex);
  if (!input) return null;
  const L = Object.fromEntries(Object.entries(NEUTRALS.light).map(([k, v]) => [k, parseHex(v)!])) as Record<keyof typeof NEUTRALS.light, Rgb>;
  const D = Object.fromEntries(Object.entries(NEUTRALS.dark).map(([k, v]) => [k, parseHex(v)!])) as Record<keyof typeof NEUTRALS.dark, Rgb>;
  const adjustments: string[] = [];

  // the button: white or ink text, whichever has more contrast on the colour as given; then the fill moves until it passes
  const whiteBetter = contrastRatio(input, WHITE) >= contrastRatio(input, L.ink);
  const fillText = whiteBetter ? WHITE : L.ink;
  const fillAdj = adjustToContrast(input, [fillText], AA, whiteBetter ? 'darker' : 'lighter');
  const fill = fillAdj.color;
  if (fillAdj.steps) adjustments.push(`Buttons use a ${whiteBetter ? 'darker' : 'lighter'} shade (${toHex(fill)}) so their ${whiteBetter ? 'white' : 'dark'} text passes 4.5:1.`);
  const hoverTry = round(mix(fill, whiteBetter ? BLACK : WHITE, 0.12));
  const hoverLight = contrastRatio(hoverTry, fillText) >= AA ? hoverTry : fill;
  const hoverDarkTry = round(mix(fill, whiteBetter ? WHITE : BLACK, 0.1));
  const hoverDark = contrastRatio(hoverDarkTry, fillText) >= AA ? hoverDarkTry : hoverLight;

  // light mode
  const softLight = round(mix(input, WHITE, 0.9));
  const textLightAdj = adjustToContrast(input, [L.page, L.surface, L.surface2, softLight], AA, 'darker');
  const textLight = textLightAdj.color;
  if (textLightAdj.steps) adjustments.push(`Links and highlighted text use a darker shade (${toHex(textLight)}) in light mode.`);

  // dark mode
  const softDark = round(mix(input, D.surface, 0.8));
  const textDarkAdj = adjustToContrast(input, [D.page, D.surface, D.surface2, softDark], AA, 'lighter');
  const textDark = textDarkAdj.color;
  if (textDarkAdj.steps) adjustments.push(`Links and highlighted text use a lighter shade (${toHex(textDark)}) in dark mode.`);
  const onInk = adjustToContrast(input, [L.inkSurface, D.inkSurface], AA, 'lighter').color;

  const light: BrandTokenSet = {
    accent: toHex(fill),
    'accent-hover': toHex(hoverLight),
    'accent-ink': toHex(fillText),
    'accent-soft': toHex(softLight),
    'accent-text': toHex(textLight),
    'accent-on-ink': toHex(onInk),
    'ring-color': toHex(textLight),
    selection: rgba(input, 0.18),
    'series-1': toHex(fill),
    'seq-1': toHex(mix(input, WHITE, 0.82)),
    'seq-2': toHex(mix(input, WHITE, 0.6)),
    'seq-3': toHex(mix(input, WHITE, 0.38)),
    'seq-4': toHex(mix(input, WHITE, 0.18)),
    'seq-5': toHex(input),
    'seq-6': toHex(mix(input, BLACK, 0.3)),
  };
  const dark: BrandTokenSet = {
    accent: toHex(fill),
    'accent-hover': toHex(hoverDark),
    'accent-ink': toHex(fillText),
    'accent-soft': toHex(softDark),
    'accent-text': toHex(textDark),
    'accent-on-ink': toHex(onInk),
    'ring-color': toHex(textDark),
    selection: rgba(textDark, 0.3),
    'series-1': toHex(mix(input, WHITE, 0.15)),
    'seq-1': toHex(mix(input, BLACK, 0.6)),
    'seq-2': toHex(mix(input, BLACK, 0.25)),
    'seq-3': toHex(input),
    'seq-4': toHex(mix(input, WHITE, 0.25)),
    'seq-5': toHex(mix(input, WHITE, 0.5)),
    'seq-6': toHex(mix(input, WHITE, 0.75)),
  };
  return {
    light,
    dark,
    contrast: {
      input: toHex(input),
      fill: toHex(fill),
      fillText: toHex(fillText),
      lightText: toHex(textLight),
      darkText: toHex(textDark),
      ratios: {
        button: r2(Math.min(contrastRatio(fill, fillText), contrastRatio(hoverLight, fillText), contrastRatio(hoverDark, fillText))),
        lightText: r2(minRatio(textLight, [L.page, L.surface, L.surface2, softLight])),
        darkText: r2(minRatio(textDark, [D.page, D.surface, D.surface2, softDark])),
        onInk: r2(minRatio(onInk, [L.inkSurface, D.inkSurface])),
      },
      adjustments,
    },
  };
}

/**
 * The stylesheet that applies a brand: the light tokens on `:root`, the dark ones under the app's two dark selectors (the OS setting
 * unless the person picked light, and an explicit dark pick) — the same structure as index.css, so dark mode never breaks. Only our
 * computed `#hex` / `rgba()` values are written; the agency's input never reaches it as text.
 */
export function brandCss(t: BrandTokens, scope = ':root'): string {
  const decl = (s: BrandTokenSet) => BRAND_TOKEN_NAMES.map((k) => `--${k}:${s[k]};`).join('');
  return `${scope}{${decl(t.light)}}@media (prefers-color-scheme: dark){${scope}:not([data-theme='light']){${decl(t.dark)}}}${scope}[data-theme='dark']{${decl(t.dark)}}`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Branding settings
// ---------------------------------------------------------------------------------------------------------------------------

const hexOrEmpty = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === '' || /^#[0-9a-f]{6}$/.test(v), 'Use a colour like #1f6feb');
const logoOrEmpty = z
  .string()
  .trim()
  .max(512)
  .refine((v) => v === '' || brandLogoUrl(v) !== null, 'Use an https address on a public website (for example https://youragency.com/logo.svg)');
const plainName = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/[<>\r\n"\\]/.test(v), 'Letters, numbers and punctuation only');
const emailOrEmpty = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => v === '' || /^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/i.test(v), 'Enter a valid e-mail address');

/** what an agency sets (Company settings → Branding) */
export const brandingSchema = z.object({
  /** the switch: off = clients see the app as it is (Ascentra) with the agency's name only where it is a fact */
  whiteLabel: z.boolean().default(false),
  productName: plainName(60).default(''),
  logoUrl: logoOrEmpty.default(''),
  /** a version drawn for dark backgrounds; empty = the light one on a white tile */
  logoDarkUrl: logoOrEmpty.default(''),
  accent: hexOrEmpty.default(''),
  supportEmail: emailOrEmpty.default(''),
  footerText: plainName(200).default(''),
  /** a small "Powered by Ascentra" line in the portal footer and documents (default off) */
  poweredBy: z.boolean().default(false),
});
export type Branding = z.infer<typeof brandingSchema>;
export const DEFAULT_BRANDING: Branding = brandingSchema.parse({});
export const brandingOf = (v: unknown): Branding => {
  const p = brandingSchema.safeParse(v ?? {});
  return p.success ? p.data : DEFAULT_BRANDING;
};

/** what a client workspace may override (empty = the agency's) and whether its approval is required */
export const clientBrandingSchema = z.object({
  productName: plainName(60).default(''),
  logoUrl: logoOrEmpty.default(''),
  logoDarkUrl: logoOrEmpty.default(''),
  accent: hexOrEmpty.default(''),
});
export type ClientBranding = z.infer<typeof clientBrandingSchema>;
export const clientBrandingOf = (v: unknown): ClientBranding => {
  const p = clientBrandingSchema.safeParse(v ?? {});
  return p.success ? p.data : clientBrandingSchema.parse({});
};

/** The brand a client-facing surface uses: the agency's, with the client's overrides, or null when white-label is off. */
export interface PortalBrand {
  whiteLabel: true;
  name: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  initials: string;
  /** the accent as given (the web app computes the tokens with `brandTokens`) or null for the app's own blue */
  accent: string | null;
  supportEmail: string | null;
  footerText: string | null;
  poweredBy: boolean;
}

export function effectiveBrand(agency: { name: string; branding: unknown } | null, client?: { branding: unknown } | null): PortalBrand | null {
  if (!agency) return null;
  const a = brandingOf(agency.branding);
  if (!a.whiteLabel) return null;
  const c = client ? clientBrandingOf(client.branding) : null;
  const name = (c?.productName || a.productName || agency.name).trim() || agency.name;
  const logo = brandLogoUrl(c?.logoUrl || a.logoUrl);
  const logoDark = brandLogoUrl(c?.logoUrl ? c.logoDarkUrl : a.logoDarkUrl) ?? null;
  const accent = parseHex(c?.accent || a.accent) ? toHex(parseHex(c?.accent || a.accent)!) : null;
  return {
    whiteLabel: true,
    name,
    logoUrl: logo,
    logoDarkUrl: logoDark,
    initials: brandInitials(name),
    accent,
    supportEmail: a.supportEmail || null,
    footerText: a.footerText || null,
    poweredBy: a.poweredBy,
  };
}

/** the platform's name as it may appear on a client-facing surface: never when white-label is on, unless "powered by" is */
export const PLATFORM_NAME = 'Ascentra';
export const poweredByLine = (b: PortalBrand | null): string | null => (b ? (b.poweredBy ? `Powered by ${PLATFORM_NAME}` : null) : null);

/**
 * Replaces the engine's report brand (SEO_BRAND, printed into the documents it produces) and our own name in text a client person
 * receives. Whole words, case-insensitive; an empty or two-letter brand replaces nothing (it would hit ordinary words).
 */
export function rebrandText(text: string, from: (string | null | undefined)[], to: string): string {
  let out = text;
  for (const f of from) {
    const w = String(f ?? '').trim();
    if (w.length < 3 || w.toLowerCase() === to.trim().toLowerCase()) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, to);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Portal host
// ---------------------------------------------------------------------------------------------------------------------------

/** the DNS proof: TXT at `_portal-verification.<host>` with `portal-verification=<token>` (no product name: clients can read DNS) */
export const PORTAL_TXT_LABEL = '_portal-verification';
export const portalTxtName = (host: string) => `${PORTAL_TXT_LABEL}.${host}`;
export const portalTxtValue = (token: string) => `portal-verification=${token}`;
export const PORTAL_DOMAIN = {
  /** a company holds at most this many portal hosts */
  maxPerOrg: 3,
  /** consecutive failed re-checks before a verified host lapses */
  lapseAfterFailures: 3,
} as const;

/** `https://SEO.Agency.com:443/x` → `seo.agency.com`; null when it is not a host name we could serve */
export function normalizeHost(v: unknown): string | null {
  let s = String(v ?? '').trim().toLowerCase();
  if (!s || s.length > 253) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0]!;
  if (s.includes('@')) return null;
  s = s.replace(/:\d+$/, '').replace(/\.$/, '');
  // ascii only (an internationalised name is entered as its xn-- form): no look-alike letters in a login host
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  if (s.split('.').some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return null;
  if (/^\d+(\.\d+){3}$/.test(s)) return null;
  return s;
}

/** why a host cannot be a portal host on this installation (null = it can) */
export function portalHostProblem(host: string | null, reserved: string[]): string | null {
  if (!host) return 'Enter a host name such as portal.youragency.com.';
  const tld = host.split('.').pop()!;
  if (/^\d+$/.test(tld)) return 'Use a host name, not an IP address.';
  if (['localhost', 'local', 'internal', 'test', 'example', 'invalid', 'onion', 'lan', 'home', 'corp'].includes(tld)) return 'Use a public host name.';
  for (const r of reserved.map((x) => normalizeHost(x)).filter(Boolean) as string[]) {
    if (host === r || host.endsWith(`.${r}`)) return 'This host belongs to the platform itself.';
  }
  return null;
}

export type PortalDomainStatus = 'pending' | 'verified' | 'lapsed';
export interface PortalDomainView {
  id: string;
  host: string;
  status: PortalDomainStatus;
  txtName: string;
  txtValue: string;
  /** null when this installation does not check the CNAME */
  cnameTarget: string | null;
  verifiedAt: string | null;
  lastCheckAt: string | null;
  lastCheckOk: boolean | null;
  lastCheckDetail: string | null;
  failures: number;
  createdAt: string;
  url: string;
}

export interface PortalDomainCheck {
  ok: boolean;
  txt: 'found' | 'missing' | 'wrong' | 'error';
  cname: 'ok' | 'missing' | 'elsewhere' | 'not_checked' | 'error';
  detail: string;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Client e-mail
// ---------------------------------------------------------------------------------------------------------------------------

export const portalMailSchema = z.object({
  /** the display name on e-mails to clients (the address stays the platform's unless a custom From is set) */
  senderName: plainName(80).default(''),
  replyTo: emailOrEmpty.default(''),
  /** an SMTP / OAuth mailbox the agency connected (Company settings → Mailboxes); null = the platform's address */
  fromMailboxId: z.string().uuid().nullable().default(null),
  /** the DKIM selector to look for, when it is not one of the common ones */
  dkimSelector: z
    .string()
    .trim()
    .max(63)
    .refine((v) => v === '' || /^[a-z0-9][a-z0-9._-]*$/i.test(v), 'Letters, numbers, dots and dashes only')
    .default(''),
});
export type PortalMailSettings = z.infer<typeof portalMailSchema>;
export const portalMailOf = (v: unknown): PortalMailSettings & { fromCheck?: PortalFromCheck | null } => {
  const p = portalMailSchema.safeParse(v ?? {});
  const base = p.success ? p.data : portalMailSchema.parse({});
  const check = v && typeof v === 'object' ? ((v as { fromCheck?: PortalFromCheck }).fromCheck ?? null) : null;
  return { ...base, fromCheck: check };
};

export interface PortalFromCheck {
  ok: boolean;
  email: string;
  spf: 'pass' | 'weak' | 'missing';
  dkim: 'found' | 'unknown';
  checkedAt: string;
  notes: string[];
}

/** a custom From is used only when the domain publishes SPF (not +all / ?all) and a DKIM key we found */
export const fromCheckPasses = (c: { spf: string; dkim: string } | null | undefined): boolean => !!c && c.spf === 'pass' && c.dkim === 'found';

export interface PortalMailView extends PortalMailSettings {
  fromEmail: string | null;
  fromCheck: PortalFromCheck | null;
  /** what clients will see in From right now */
  effectiveFrom: string;
  mailboxes: { id: string; email: string; label: string; status: string }[];
  smtpConfigured: boolean;
}

/** a display name safe for an address header */
export const senderDisplayName = (v: string): string => v.replace(/["\\\r\n<>]/g, '').trim().slice(0, 80);

// ---------------------------------------------------------------------------------------------------------------------------
// Clients, staff, overview
// ---------------------------------------------------------------------------------------------------------------------------

export const createClientSchema = z.object({
  name: plainName(120).refine((v) => v.length >= 2, 'Enter the client’s name'),
  monthlyBudgetUsd: z.number().min(0).max(100000).optional(),
  website: z.string().trim().max(200).default(''),
});
export const staffAssignSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES).nullable() });
export const clientSettingsSchema = z.object({ clientApproval: z.boolean() });

export interface AgencyClient {
  id: string;
  name: string;
  createdAt: string;
  sites: number;
  clientPeople: number;
  staff: number;
  monthlyBudgetUsd: number;
  spentUsd: number;
  clientApproval: boolean;
  /** what the signed-in person can do there */
  role: Role;
}

export interface StaffAccess {
  userId: string;
  name: string;
  email: string;
  agencyRole: Role;
  /** inherited (owner / admin of the agency) or assigned */
  access: 'inherited' | 'assigned' | 'none';
  role: Role | null;
}

export interface AgencyOverviewRow {
  clientId: string;
  clientName: string;
  siteId: string | null;
  domain: string | null;
  verified: boolean;
  tracking: string | null;
  healthScore: number | null;
  healthAt: string | null;
  rankGains: number | null;
  rankDrops: number | null;
  clicksPct: number | null;
  aiVisibility: number | null;
  aiMentionRate: number | null;
  alerts14d: number;
  approvalsWaiting: number;
  spentUsd: number;
  budgetUsd: number;
}

export const OVERVIEW_CSV_COLUMNS = [
  'client',
  'website',
  'verified',
  'tracking',
  'health_score',
  'health_checked',
  'rank_gains',
  'rank_drops',
  'clicks_change_pct',
  'ai_visibility',
  'ai_mention_rate',
  'alerts_14d',
  'approvals_waiting',
  'spent_usd_month',
  'budget_usd_month',
] as const;

export function overviewCsvRow(r: AgencyOverviewRow, cell: (v: unknown) => string): string {
  return [
    r.clientName,
    r.domain ?? '',
    r.siteId ? (r.verified ? 'yes' : 'no') : '',
    r.tracking ?? '',
    r.healthScore,
    r.healthAt,
    r.rankGains,
    r.rankDrops,
    r.clicksPct,
    r.aiVisibility,
    r.aiMentionRate,
    r.alerts14d,
    r.approvalsWaiting,
    r.spentUsd,
    r.budgetUsd,
  ]
    .map(cell)
    .join(',');
}

// ---------------------------------------------------------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------------------------------------------------------

export const APPROVAL_KINDS = ['page', 'outreach'] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'withdrawn';

export const approvalRequestSchema = z.object({
  kind: z.enum(APPROVAL_KINDS),
  /** a report id (page), or `prospect-domain|type` (outreach) */
  itemId: z.string().trim().min(3).max(300),
  siteId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).default(''),
});
export const approvalDecisionSchema = z.object({
  decision: z.enum(['approved', 'changes_requested']),
  note: z.string().trim().max(2000).default(''),
});
export const outreachItemId = (prospectDomain: string, type: string) => `${prospectDomain.trim().toLowerCase()}|${type.trim().toLowerCase()}`;

export interface ApprovalView {
  id: string;
  kind: ApprovalKind;
  itemId: string;
  siteId: string | null;
  siteDomain: string | null;
  title: string;
  status: ApprovalStatus;
  note: string;
  requestedBy: string | null;
  requestedAt: string;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  /** for a page: the report it is about */
  reportId: string | null;
}

export interface ApprovalCandidate {
  kind: ApprovalKind;
  itemId: string;
  siteId: string | null;
  siteDomain: string | null;
  title: string;
  at: string;
}

// ---------------------------------------------------------------------------------------------------------------------------
// What a client person sees
// ---------------------------------------------------------------------------------------------------------------------------

/** key names that carry what something cost us: never shown to a client person (the agency's price is its own business) */
const COST_KEY = /(^|_)(costs?|usd|spend|spent|budget|ledger|price|prices|billing|balance)(_|$)|(Cost|Usd|Spend|Budget|Ledger|Price|Balance)s?$|^cost/i;
export const isCostKey = (k: string): boolean => COST_KEY.test(k);

/** a report payload without its cost / ledger / budget keys, at any depth up to 6 */
export function clientSafePayload<T>(v: T, depth = 0): T {
  if (depth > 6 || v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => clientSafePayload(x, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (isCostKey(k)) continue;
    out[k] = clientSafePayload(x, depth + 1);
  }
  return out as T;
}

/** the context a page gets from the host it was opened on (null = the app's own host) */
export interface PortalContext {
  host: string;
  brand: PortalBrand | null;
  /** single sign-on / Google run on the app's own host; the portal hands the session over */
  appUrl: string;
}

/** the agency a client workspace belongs to, as the client sees it */
export interface OrgAgencyInfo {
  name: string;
  /** shown only to agency staff */
  id?: string;
}

/** GET / PUT /api/orgs/:orgId/branding */
export interface BrandingResponse {
  kind: 'agency' | 'client';
  branding: Branding | ClientBranding;
  /** client workspace: approval required before a live publish / an outreach send */
  clientApproval?: boolean;
  contrast: BrandContrast | null;
  /** client workspace: the agency's brand its overrides apply to */
  agencyBrand: PortalBrand | null;
}

