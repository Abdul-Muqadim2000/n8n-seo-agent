import { BadgeCheck, Bug, Building2, Check, KeyRound, Minus, ShieldCheck, Users, Wallet, type LucideIcon } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CtaBand, Faq, IconTile, Reveal, Section, SectionHeading } from '../components';
import { ArrowLink, PageHero } from '../components/company/PageHero';
import { LayeredShield } from '../components/company/LayeredShield';
import type { FaqItem } from '../content/features';
import { site } from '../content/site';
import { useSeo } from '../useSeo';

// Every line on this page describes how the app works today (app/server: auth, sessions, CSP, CSRF, roles, budgets).
// No certifications, audits, hosting or data-residency claims.

const GROUPS: { icon: LucideIcon; title: string; items: string[] }[] = [
  {
    icon: KeyRound,
    title: 'Sign-in and accounts',
    items: [
      'Passwords hashed with argon2id',
      'Google sign-in with PKCE',
      'E-mail verification and password reset by one-time links',
      'One-time links stored only as hashes, and they expire',
      'Sessions in HttpOnly cookies; only a hash of each session is stored',
      'Unknown addresses get the same password check, so sign-in timing does not reveal accounts',
    ],
  },
  {
    icon: Users,
    title: 'Roles and access',
    items: [
      'Owner, admin, member and viewer, per company',
      'Invitations by link, which admins can revoke',
      'Every request checked against your role on the server, not only in the browser',
      'Signing in with Google to an unconfirmed account removes its old password and sessions',
    ],
  },
  {
    icon: Building2,
    title: 'Data isolation',
    items: [
      'Each company’s websites, runs, reports and files are kept apart',
      'Website data appears only after ownership is verified',
      'Deleting a website or company also removes its plans from the automation engine',
    ],
  },
  {
    icon: BadgeCheck,
    title: 'Website ownership',
    items: [
      'Proof by Search Console ownership, a DNS TXT record or a meta tag',
      'One verified owner per domain',
      'Proof must come from a person — Ascentra’s own Google access never counts',
      'A GA4 property is accepted only when it measures the verified domain',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Application safeguards',
    items: [
      'CSRF protection on every request that changes something',
      'A strict Content-Security-Policy: scripts load only from Ascentra itself',
      'Report previews open in sandboxed frames, and files are served with a fixed type',
      'Secret tokens are redacted from logs',
      'Rate limits on sign-in, runs, invitations and verification',
    ],
  },
  {
    icon: Wallet,
    title: 'Spend controls',
    items: [
      'A cost estimate before every run',
      'Company budgets checked before any paid work — under a lock, so runs started together cannot overshoot',
      'A platform-wide daily spend limit above every budget',
      'Results reused where nothing has changed, so nothing is paid for twice',
    ],
  },
];

const ROLES = ['Owner', 'Admin', 'Member', 'Viewer'] as const;
const ROLE_ROWS: { action: string; allowed: [boolean, boolean, boolean, boolean] }[] = [
  { action: 'See dashboards, reports and alerts', allowed: [true, true, true, true] },
  { action: 'Start runs, keyword checks and link imports', allowed: [true, true, true, false] },
  { action: 'Add and verify websites, change their settings', allowed: [true, true, false, false] },
  { action: 'Invite people and change their roles', allowed: [true, true, false, false] },
  { action: 'Set the budget and delete the company', allowed: [true, false, false, false] },
];

const GOOGLE_STEPS = [
  { title: 'You add Ascentra as a user', body: 'In Search Console and GA4, you add Ascentra’s service account to the properties you choose — nothing else.' },
  { title: 'Ascentra reads, read-only', body: 'Search performance, index coverage, sitemaps and traffic. Ascentra asks Google for read access only, so it cannot change your settings.' },
  { title: 'You stay in charge', body: 'Remove the service account in Google at any time to stop access. Error messages never list other customers’ properties.' },
];

const FAQS: FaqItem[] = [
  {
    q: 'Does Ascentra change anything on our website?',
    a: 'No. Ascentra reads your website and your Google data. The pages it writes arrive as a package or a WordPress draft, and your team decides what to publish.',
  },
  {
    q: 'What access does Ascentra need to Google?',
    a: 'Read-only access to Search Console and GA4, through a service account you add as a user to the properties you choose. To prove ownership with Google, you sign in yourself; Ascentra’s own access never counts as proof.',
  },
  {
    q: 'Who can see our data?',
    a: 'Only the people in your company, according to their role. Other companies on Ascentra never see your websites, runs or reports.',
  },
  {
    q: 'How do we remove a person or a website?',
    a: 'Admins remove people and revoke open invitations from the team settings, and remove websites from the website settings. Deleting a website also removes its plans from the automation engine.',
  },
  {
    q: 'Can you go through our security questionnaire?',
    a: 'Send it through the contact form with the topic “Security review or questionnaire”, or by e-mail, and a person on the team will go through it with you.',
  },
];

function Groups() {
  return (
    <Section tone="surface" bordered aria-labelledby="layers-title">
      <SectionHeading
        id="layers-title"
        eyebrow="Protection at every layer"
        title="What protects your account, your company and your data."
        lead="Plain facts about how Ascentra works today."
      />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g, i) => (
          <Reveal key={g.title} index={i % 3} className="h-full">
            <article className="group h-full rounded-xl border border-line bg-page p-6 transition-[border-color,box-shadow,background-color] duration-200 ease-brand hover:border-line-strong hover:bg-surface hover:shadow-raised sm:p-7">
              <IconTile icon={g.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
              <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{g.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[14px] leading-snug text-ink-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-text" strokeWidth={2.25} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function GoogleAccess() {
  return (
    <Section tone="ink" spacing="lg" aria-labelledby="google-title">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <SectionHeading
          id="google-title"
          eyebrow="Your Google data"
          title="Read-only access, on the properties you choose."
          lead="Search Console and GA4 are where your most sensitive search data lives. Ascentra reads them; it never writes to them."
        />
        <ol className="relative space-y-4">
          {GOOGLE_STEPS.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              index={i}
              className="group relative flex gap-5 rounded-xl border border-line-on-ink p-5 transition-colors duration-200 ease-brand hover:bg-on-ink/[0.04] sm:p-6"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-on-ink font-mono text-[13px] font-medium text-accent-on-ink tabular transition-colors duration-200 ease-brand group-hover:border-accent-on-ink">
                {i + 1}
              </span>
              <span>
                <span className="block font-display text-base font-semibold text-on-ink">{s.title}</span>
                <span className="mt-1.5 block text-[14px] leading-relaxed text-on-ink-2">{s.body}</span>
              </span>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function RoleMatrix() {
  return (
    <Section tone="page" id="roles" aria-labelledby="roles-title">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHeading
          id="roles-title"
          eyebrow="Roles"
          title="Four roles, enforced on the server."
          lead="Give each person the access their work needs. The app hides what a role cannot do, and the server refuses it anyway."
        />
        <Reveal index={1} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[340px] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full border-separate border-spacing-0 text-left">
              <caption className="sr-only">What each role can do</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-line bg-surface-2 px-4 py-3.5 text-[12px] font-medium text-ink-3 sm:px-5">
                    What they can do
                  </th>
                  {ROLES.map((r) => (
                    <th key={r} scope="col" className="w-[15%] border-b border-line bg-surface-2 px-1 py-3.5 text-center text-[11.5px] font-semibold text-ink sm:w-[13%] sm:px-2 sm:text-[12.5px]">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_ROWS.map((row, ri) => (
                  <tr key={row.action} className="group/row transition-colors duration-150 ease-brand hover:bg-page">
                    <th scope="row" className={cn('px-4 py-4 text-[13.5px] font-normal leading-snug text-ink sm:px-5 sm:text-[14px]', ri > 0 && 'border-t border-line')}>
                      {row.action}
                    </th>
                    {row.allowed.map((ok, i) => (
                      <td key={ROLES[i]} className={cn('px-1 py-4 text-center sm:px-2', ri > 0 && 'border-t border-line')}>
                        {ok ? (
                          <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-accent-soft text-accent-text sm:size-6">
                            <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                            <span className="sr-only">Yes</span>
                          </span>
                        ) : (
                          <>
                            <Minus className="mx-auto size-4 text-ink-3/70" aria-hidden />
                            <span className="sr-only">No</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Disclosure() {
  return (
    <Section tone="surface" bordered spacing="sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Reveal className="h-full">
          <div className="flex h-full gap-5 rounded-xl border border-line bg-page p-6 sm:p-7">
            <IconTile icon={Bug} />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">Found a security issue?</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                Write to{' '}
                <a href={`mailto:${site.securityEmail}`} className="font-medium text-accent-text underline-offset-4 hover:underline">
                  {site.securityEmail}
                </a>{' '}
                with the steps to reproduce it. Please give us the chance to fix it before you share it.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal index={1} className="h-full">
          <div className="flex h-full gap-5 rounded-xl border border-line bg-page p-6 sm:p-7">
            <IconTile icon={ShieldCheck} />
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">Reviewing Ascentra for your company?</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">Send your questionnaire or checklist and a person on the team will go through it with you.</p>
              <ArrowLink to="/contact?topic=security" className="mt-4">
                Start a security review
              </ArrowLink>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function SecurityFaq() {
  return (
    <Section tone="page">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <SectionHeading eyebrow="FAQ" title="Security questions." lead="The questions security and IT teams ask first." />
        <Reveal index={1}>
          <Faq items={FAQS} schema />
        </Reveal>
      </div>
    </Section>
  );
}

export default function SecurityPage() {
  useSeo({
    title: 'Security',
    description:
      'How Ascentra protects your data: argon2id passwords, Google sign-in with PKCE, four roles, verified website ownership, isolation per company, a strict CSP and budget caps.',
    path: '/security',
  });
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Your data, your websites, your rules."
        lead="Ascentra works with your Search Console, analytics and content. Here is how that is protected, from sign-in to the reports you download."
        watermark
        actions={
          <>
            <ButtonLink to="/contact?topic=security" size="lg">
              Talk to us about security
            </ButtonLink>
            <ButtonLink to="#roles" size="lg" variant="secondary">
              See the roles
            </ButtonLink>
          </>
        }
        aside={<LayeredShield />}
      />
      <Groups />
      <GoogleAccess />
      <RoleMatrix />
      <Disclosure />
      <SecurityFaq />
      <CtaBand
        title="Security questionnaire? Talk to us."
        lead="Send it over with any review checklist, and a person on the team will go through it with you before you connect a single website."
        primary={{ label: 'Contact us', to: '/contact?topic=security' }}
        secondary={{ label: 'Start free', to: '/signup' }}
      />
    </>
  );
}
