import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import {
  Calculator,
  Check,
  Clock,
  ChevronsLeftRight,
  CalendarClock,
  Coins,
  Gauge,
  Hand,
  Info,
  Layers,
  Link2,
  Minus,
  PauseCircle,
  Recycle,
  Rocket,
  ShieldCheck,
  Sparkles,
  Upload,
  Wrench,
  Timer,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Container, CtaBand, Faq, IconTile, Reveal, Section, SectionHeading } from '../components';
import { ArrowLink, PageHero } from '../components/company/PageHero';
import { Drawn, MockBadge } from '../components/mockups/parts';
import {
  annualDiscount,
  annualMonthly,
  costControls,
  creditExamples,
  creditPackValidity,
  creditPacks,
  creditPacksNote,
  creditRules,
  pricingFaqs,
  pricingMatrix,
  pricingTiers,
  pricingUsageNote,
  servicePackages,
  servicesNote,
  type MatrixValue,
  type PricingTier,
  type ServicePackage,
} from '../content/pricing';
import { useSeo } from '../useSeo';

type Billing = 'monthly' | 'annual';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const discountLabel = `Save ${Math.round(annualDiscount * 100)}%`;

const ALL_PLANS = ['Search Console, GA4 and Trends tracking', 'The price in credits before every analysis', 'Roles and invitations', 'Monthly audits with a fix pack'];

/** The jobs one subscription covers — each is a capability on /platform, not a claim about another product. */
const REPLACES = ['Keyword research', 'Rank tracking', 'Site crawler', 'Content writing with SEO QA', 'AI answer tracking', 'Backlink index', 'Outreach'];

const COST_ICONS: LucideIcon[] = [Calculator, Wallet, Gauge, Recycle, Link2];

/** one icon per line of `creditRules`, in order */
const CREDIT_ICONS: LucideIcon[] = [Layers, Calculator, ShieldCheck, Hand, PauseCircle, CalendarClock];

const credits = (n: number) => n.toLocaleString('en-US');

/** Price for a tier in the chosen billing period: the big figure, the line under it and the struck-through monthly price. */
function priceFor(t: PricingTier, billing: Billing) {
  if (t.monthly === undefined) return { figure: t.price, unit: '', note: 'Custom pricing for your portfolio', was: null as string | null };
  if (billing === 'monthly') return { figure: usd(t.monthly), unit: t.period, note: 'Billed monthly', was: null };
  const m = annualMonthly(t.monthly);
  return { figure: usd(m), unit: t.period, note: `${usd(m * 12)} billed yearly`, was: usd(t.monthly) };
}

/** Monthly / Annual switch: a radio group with a sliding thumb; arrow keys move between the two. */
function BillingToggle({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  const refs = useRef<Record<Billing, HTMLButtonElement | null>>({ monthly: null, annual: null });
  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next: Billing = value === 'monthly' ? 'annual' : 'monthly';
    onChange(next);
    refs.current[next]?.focus();
  };
  const opt = (b: Billing, label: string, extra?: React.ReactNode) => (
    <button
      ref={(el) => {
        refs.current[b] = el;
      }}
      type="button"
      role="radio"
      aria-checked={value === b}
      tabIndex={value === b ? 0 : -1}
      onClick={() => onChange(b)}
      className={cn(
        'relative z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-200 ease-brand',
        value === b ? 'text-page' : 'text-ink-2 hover:text-ink',
      )}
    >
      {label}
      {extra}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Billing period" onKeyDown={onKey} className="relative inline-grid grid-cols-2 rounded-full border border-line bg-surface p-1 shadow-card">
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink shadow-card transition-transform duration-[250ms] ease-brand"
        style={{ transform: value === 'annual' ? 'translateX(100%)' : 'none' }}
      />
      {opt('monthly', 'Monthly')}
      {opt(
        'annual',
        'Annual',
        <span
          className={cn(
            'rounded-full px-1.5 py-px font-mono text-[10.5px] font-medium transition-colors duration-200 ease-brand',
            value === 'annual' ? 'bg-page/15 text-page' : 'bg-accent-soft text-accent-text',
          )}
        >
          {discountLabel}
        </span>,
      )}
    </div>
  );
}

function PlanCard({ tier, billing, index }: { tier: PricingTier; billing: Billing; index: number }) {
  const p = priceFor(tier, billing);
  const hi = tier.highlighted;
  return (
    <Reveal index={index}>
    <article
      aria-labelledby={`plan-${tier.id}`}
      className={cn(
        'relative flex h-full flex-col rounded-xl border bg-surface p-6 transition-[transform,box-shadow,border-color] duration-200 ease-brand hover:-translate-y-1 hover:shadow-raised sm:p-8',
        hi ? 'border-accent shadow-raised ring-1 ring-accent' : 'border-line shadow-card hover:border-line-strong',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`plan-${tier.id}`} className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
          {tier.name}
        </h2>
        {hi && <span className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium leading-none text-accent-ink">Recommended</span>}
      </div>
      <p className="mt-2 min-h-[3rem] text-[14px] leading-relaxed text-ink-2">{tier.description}</p>

      <div className="mt-6">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {/* keyed so the figure fades in again when the billing period changes */}
          <span key={`${billing}-${p.figure}`} className="font-display text-[2.6rem] font-semibold leading-none tracking-[-0.02em] text-ink" style={{ animation: 'alv-fade-up 320ms var(--brand-ease) both' }}>
            {p.figure}
          </span>
          {p.unit && <span className="text-[14px] text-ink-3">{p.unit}</span>}
          {p.was && (
            <span className="font-mono text-[13px] text-ink-3 line-through tabular">
              <span className="sr-only">instead of </span>
              {p.was}
            </span>
          )}
        </p>
        <p className="mt-2.5 text-[13px] text-ink-3">{p.note}</p>
        {tier.monthlyCredits !== undefined ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-ink">
            <Coins className="size-3.5 text-accent-text" aria-hidden />
            Includes <span className="font-mono tabular">{credits(tier.monthlyCredits)}</span> credits a month
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-ink">
            <Coins className="size-3.5 text-accent-text" aria-hidden />
            Credits to fit your portfolio
          </p>
        )}
      </div>

      <ButtonLink to={tier.cta.to} size="lg" variant={hi ? 'primary' : 'secondary'} className="mt-7 w-full">
        {tier.cta.label}
      </ButtonLink>

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-[13px] font-medium text-ink">{tier.includesPrevious ?? 'Includes:'}</p>
        <ul className="mt-4 space-y-3">
          {tier.features.map((f) => (
            <li key={f} className="flex gap-3 text-[14px] leading-snug text-ink-2">
              <span className={cn('mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full', hi ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent-text')}>
                <Check className="size-3" strokeWidth={2.75} aria-hidden />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </article>
    </Reveal>
  );
}

function Plans({ billing, setBilling }: { billing: Billing; setBilling: (b: Billing) => void }) {
  return (
    <>
      <PageHero
        align="center"
        eyebrow="Pricing"
        title="Start small. Grow when it works."
        lead="Setting up is free. Every plan writes the pages, not just a list of keywords — and every analysis shows its price in credits before it starts."
        containerClassName="pb-12 sm:pb-14"
      >
        <div className="mt-9 flex justify-center">
          <BillingToggle value={billing} onChange={setBilling} />
        </div>
      </PageHero>
      <section className="bg-page pb-20 sm:pb-28" aria-label="Plans">
        <Container>
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3 lg:gap-6">
            {pricingTiers.map((t, i) => (
              <PlanCard key={t.id} tier={t} billing={billing} index={i} />
            ))}
          </div>
          <Reveal className="mx-auto mt-10 max-w-6xl">
            <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] font-medium text-ink">Every plan includes</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
                {ALL_PLANS.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <Check className="size-3.5 text-accent-text" strokeWidth={2.5} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-surface px-6 py-5 text-center">
              <p className="text-[13px] font-medium text-ink">One subscription instead of a tool for each job</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {REPLACES.map((r) => (
                  <li key={r} className="rounded-full border border-line-strong bg-page px-3 py-1 text-[12.5px] text-ink-2">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-ink-3 sm:justify-center sm:text-center">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {pricingUsageNote}{' '}
                <a href="#credits" className="font-medium text-accent-text underline-offset-4 hover:underline">
                  How credits work
                </a>
                {' · '}
                <a href="#done-for-you" className="font-medium text-accent-text underline-offset-4 hover:underline">
                  Or have us do it for you
                </a>
              </span>
            </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

/** "How credits work": the rules in customer words, what typical work uses and the packs (prices and packs are placeholders). */
function Credits() {
  return (
    <Section tone="surface" bordered id="credits" aria-labelledby="credits-title">
      <SectionHeading
        id="credits-title"
        eyebrow="How credits work"
        title="One balance. The price before every analysis."
        lead="Everything Alaventra does for you is paid in credits — the work it runs on its own each week and the analyses you start. Your plan adds credits every month, and packs top them up when you need more."
      />
      <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {creditRules.map((r, i) => (
          <Reveal as="li" key={r.title} index={i} className="flex gap-4">
            <IconTile icon={CREDIT_ICONS[i] ?? Check} size="sm" />
            <span>
              <span className="block font-display text-[15px] font-semibold text-ink">{r.title}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{r.body}</span>
            </span>
          </Reveal>
        ))}
      </ul>

      <div className="mt-14 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Reveal className="rounded-xl border border-line bg-page p-6 sm:p-7">
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">What typical work uses</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">Every analysis shows its own price before it starts; these are a guide.</p>
          <dl className="mt-5 divide-y divide-line border-t border-line">
            {creditExamples.map((e) => (
              <div key={e.label} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="text-[14px] leading-snug text-ink-2">{e.label}</dt>
                <dd className="shrink-0 font-mono text-[13.5px] font-medium text-ink tabular">{e.credits}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal index={1} className="rounded-xl border border-line bg-page p-6 sm:p-7">
          <h3 id="packs-title" className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Credit packs
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">On top of any plan. Each pack lasts {creditPackValidity}.</p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {creditPacks.map((pk) => (
              <li key={pk.credits} className="rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card">
                <span className="block font-display text-[19px] font-semibold leading-none tracking-[-0.01em] text-ink tabular">{credits(pk.credits)}</span>
                <span className="mt-1 block text-[12px] text-ink-3">credits</span>
                <span className="mt-3 block font-mono text-[14px] font-medium text-ink tabular">{pk.price}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-ink-3">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{creditPacksNote}</span>
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

const SERVICE_ICONS: Record<ServicePackage['id'], LucideIcon> = { setup: Rocket, publishing: Upload, fixes: Wrench, managed: Sparkles };

/** One done-for-you package: what a person on the team does, what it costs and what we need from you. */
function ServiceCard({ pack, index }: { pack: ServicePackage; index: number }) {
  const Icon = SERVICE_ICONS[pack.id];
  const hi = pack.highlighted;
  return (
    <Reveal index={index}>
      <article
        aria-labelledby={`service-${pack.id}`}
        className={cn(
          'flex h-full flex-col rounded-xl border bg-surface p-6 transition-[transform,box-shadow,border-color] duration-200 ease-brand hover:-translate-y-1 hover:shadow-raised',
          hi ? 'border-accent shadow-raised ring-1 ring-accent' : 'border-line shadow-card hover:border-line-strong',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <IconTile icon={Icon} size="sm" />
          {hi && <span className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium leading-none text-accent-ink">Everything together</span>}
        </div>
        <h3 id={`service-${pack.id}`} className="mt-4 font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {pack.name}
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{pack.description}</p>
        <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[2rem] font-semibold leading-none tracking-[-0.02em] text-ink">{pack.price}</span>
          <span className="text-[13px] text-ink-3">{pack.period}</span>
        </p>
        <ul className="mt-5 flex-1 space-y-2.5 border-t border-line pt-5">
          {pack.includes.map((line) => (
            <li key={line} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
              <span className={cn('mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full', hi ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent-text')}>
                <Check className="size-3" strokeWidth={2.75} aria-hidden />
              </span>
              {line}
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[12.5px] leading-snug text-ink-3">
          <div className="flex gap-2">
            <dt className="shrink-0">
              <Clock className="mt-px size-3.5" aria-hidden />
              <span className="sr-only">Turnaround</span>
            </dt>
            <dd>{pack.turnaround}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0">
              <ShieldCheck className="mt-px size-3.5" aria-hidden />
              <span className="sr-only">What we need from you</span>
            </dt>
            <dd>{pack.needs}</dd>
          </div>
        </dl>
        <ButtonLink to={pack.cta.to} size="md" variant={hi ? 'primary' : 'secondary'} className="mt-6 w-full">
          {pack.cta.label}
        </ButtonLink>
      </article>
    </Reveal>
  );
}

/** "Done for you": the services around the software, for teams with nobody to do this work. */
function Services() {
  return (
    <Section tone="page" id="done-for-you" aria-labelledby="services-title">
      <SectionHeading
        id="services-title"
        eyebrow="Done for you"
        title="Or let us do the parts you would rather not."
        lead="The software plans above are self-serve. These are people: we connect the accounts, publish the pages on your site and fix what the audit found. Add any of them to any plan."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {servicePackages.map((pack, i) => (
          <ServiceCard key={pack.id} pack={pack} index={i} />
        ))}
      </div>
      <Reveal className="mt-8">
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-3 sm:justify-center sm:text-center">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{servicesNote}</span>
        </p>
      </Reveal>
    </Section>
  );
}

function Cell({ value }: { value: MatrixValue }) {
  if (value === true)
    return (
      <>
        <Check className="mx-auto size-[18px] text-accent-text" strokeWidth={2.25} aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus className="mx-auto size-4 text-ink-3/70" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className="text-[13.5px] font-medium text-ink">{value}</span>;
}

/** Full plan comparison. md+: the plan header row sticks under the site header while the page scrolls. Below md the table
 *  scrolls sideways inside its frame, with the feature column pinned on the left. */
function Comparison({ billing }: { billing: Billing }) {
  const growth = pricingTiers.findIndex((t) => t.highlighted);
  const colTint = (i: number) => (i === growth ? 'bg-accent-soft/45' : '');
  return (
    <Section tone="surface" bordered id="compare" aria-labelledby="compare-title">
      <SectionHeading id="compare-title" eyebrow="Compare plans" title="Every feature, side by side." lead="All plans run the same engine. Higher plans add websites, automation and the monitors that watch AI answers and backlinks." />
      <p className="mt-8 flex items-center gap-2 text-[13px] text-ink-3 md:hidden">
        <ChevronsLeftRight className="size-4" aria-hidden />
        Scroll sideways to see every plan
      </p>
      <Reveal className="relative -mx-4 mt-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:mt-12 md:overflow-visible md:px-0 md:pb-0">
        <table className="w-full min-w-[600px] table-fixed border-separate border-spacing-0 text-left">
          <caption className="sr-only">Features included in each plan</caption>
          <colgroup>
            <col className="w-[168px] md:w-[37%]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <td className="sticky left-0 z-20 border-b border-line bg-surface md:top-16 lg:top-[72px]" />
              {pricingTiers.map((t, i) => {
                const p = priceFor(t, billing);
                return (
                  <th key={t.id} scope="col" className="relative z-10 border-b border-line bg-surface px-3 pb-5 pt-5 align-bottom font-normal md:sticky md:top-16 lg:top-[72px]">
                    {i === growth && <span aria-hidden className="absolute inset-0 rounded-t-xl bg-accent-soft/45" />}
                    <span className="relative block text-center">
                      <span className="block font-display text-base font-semibold text-ink">{t.name}</span>
                      <span className="mt-1 block font-mono text-[12px] text-ink-3 tabular">
                        {p.unit ? (
                          <>
                            {p.figure}
                            <span className="font-sans"> / month</span>
                          </>
                        ) : (
                          <span className="font-sans">Custom</span>
                        )}
                      </span>
                    </span>
                    <ButtonLink to={t.cta.to} size="sm" variant={t.highlighted ? 'primary' : 'secondary'} className="relative mt-3 hidden w-full lg:inline-flex">
                      {t.cta.label}
                    </ButtonLink>
                  </th>
                );
              })}
            </tr>
          </thead>
          {pricingMatrix.map((g) => (
            <tbody key={g.group}>
              <tr>
                <th scope="rowgroup" className="sticky left-0 z-[1] bg-surface pb-3 pr-4 pt-10 text-left align-bottom md:static">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-text">{g.group}</span>
                </th>
                {pricingTiers.map((t, i) => (
                  <td key={t.id} aria-hidden className={colTint(i)} />
                ))}
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className="group/row">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] border-t border-line bg-surface py-3.5 pr-4 align-middle font-normal transition-colors duration-150 ease-brand group-hover/row:bg-page md:static"
                  >
                    <span className="block text-[14px] leading-snug text-ink">{r.label}</span>
                    {r.hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{r.hint}</span>}
                  </th>
                  {r.values.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        'border-t border-line px-3 py-3.5 text-center align-middle transition-colors duration-150 ease-brand',
                        i === growth ? colTint(i) : 'group-hover/row:bg-page',
                      )}
                    >
                      <Cell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <td className="sticky left-0 border-t border-line bg-surface md:static" />
              {pricingTiers.map((t, i) => (
                <td key={t.id} className={cn('border-t border-line px-3 pb-4 pt-5', i === growth && cn(colTint(i), 'rounded-b-xl'))}>
                  <ButtonLink to={t.cta.to} size="sm" variant={t.highlighted ? 'primary' : 'secondary'} className="w-full max-sm:h-10">
                    {t.cta.label}
                  </ButtonLink>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </Reveal>
    </Section>
  );
}

/** Sample analysis price as the app shows it before it starts, plus two runs that use no credits (sample data). */
function CostMockup() {
  return (
    <Drawn
      label="Sample data: a keyword check priced at 12 credits before it starts, with 1,240 of the company's 2,580 credits available this month; a monthly audit skipped because the sitemap has not changed; and a backlink check from free sources using no credits."
      className="relative"
    >
      <div className="rounded-xl border border-line bg-surface p-5 shadow-overlay sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
              <Coins className="size-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-ink">Keyword check</span>
              <span className="block text-[11.5px] text-ink-3">yourbrand.com</span>
            </span>
          </span>
          <MockBadge tone="good" icon={ShieldCheck}>
            Within your limits
          </MockBadge>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="mk-pop rounded-lg border border-line bg-page px-3.5 py-3" style={{ ['--mk-i' as string]: 0 }}>
            <dt className="text-[11px] text-ink-3">Price</dt>
            <dd className="mt-1 font-mono text-[20px] font-medium tracking-[-0.02em] text-ink tabular">12 credits</dd>
          </div>
          <div className="mk-pop rounded-lg border border-line bg-page px-3.5 py-3" style={{ ['--mk-i' as string]: 1 }}>
            <dt className="text-[11px] text-ink-3">Estimated time</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-mono text-[20px] font-medium tracking-[-0.02em] text-ink tabular">
              <Timer className="size-4 text-ink-3" />2 min
            </dd>
          </div>
        </dl>
        <div className="mk-pop mt-4" style={{ ['--mk-i' as string]: 2 }}>
          <span className="flex items-baseline justify-between text-[11.5px]">
            <span className="font-medium text-ink">Credits available</span>
            <span className="font-mono text-ink-2 tabular">1,240 of 2,580</span>
          </span>
          <span className="mt-2 block h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="mk-grow-x block h-full w-[48%] rounded-full bg-accent" />
          </span>
        </div>
        <span className="mt-5 flex h-9 w-full items-center justify-center rounded-lg bg-accent text-[13px] font-medium text-accent-ink">Start run</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:ml-10">
        {[
          { t: 'Monthly audit', d: 'Skipped — sitemap unchanged since the last audit', i: 3 },
          { t: 'Backlink check', d: 'Free sources only', i: 4 },
        ].map((r) => (
          <div key={r.t} className="mk-pop flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-card" style={{ ['--mk-i' as string]: r.i }}>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-ink">{r.t}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{r.d}</span>
            </span>
            <span className="shrink-0 font-mono text-[13px] font-medium text-good-text tabular">0 credits</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-right font-mono text-[11px] text-ink-3">Sample data</p>
    </Drawn>
  );
}

function Costs() {
  return (
    <Section tone="page" id="costs" spacing="lg" aria-labelledby="costs-title">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-20">
        <div>
          <SectionHeading
            id="costs-title"
            eyebrow="Credits well spent"
            title="You see the price before any work starts."
            lead="Research, writing and AI answer checks are the parts of SEO that use credits. Alaventra prices them up front, checks them against your limits and never charges twice for a result that cannot have changed."
          />
          <ul className="mt-10 space-y-6">
            {costControls.map((c, i) => (
              <Reveal as="li" key={c.title} index={i} className="flex gap-4">
                <IconTile icon={COST_ICONS[i] ?? Check} size="sm" />
                <span>
                  <span className="block font-display text-[15px] font-semibold text-ink">{c.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{c.body}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal index={1}>
          <CostMockup />
        </Reveal>
      </div>
    </Section>
  );
}

function PricingFaq() {
  return (
    <Section tone="surface" bordered>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <SectionHeading eyebrow="FAQ" title="Pricing questions." lead="Plans, credits and what an analysis uses. For anything else, a person on the team will answer." />
          <Reveal className="mt-8 flex flex-col items-start gap-3">
            <ArrowLink to="/contact?topic=sales">Talk to sales</ArrowLink>
            <ArrowLink to="/security">Security at Alaventra</ArrowLink>
          </Reveal>
        </div>
        <Reveal index={1}>
          <Faq items={pricingFaqs} schema />
        </Reveal>
      </div>
    </Section>
  );
}

export default function PricingPage() {
  useSeo({ title: 'Pricing', description: 'Alaventra plans for one website to a whole portfolio, paid in credits. Every analysis shows its price before it starts and never uses more.', path: '/pricing' });
  const [billing, setBilling] = useState<Billing>('monthly');
  return (
    <>
      <Plans billing={billing} setBilling={setBilling} />
      <Credits />
      <Services />
      <Comparison billing={billing} />
      <Costs />
      <PricingFaq />
      <CtaBand
        className="pt-20 sm:pt-28"
        title="Running SEO for many companies?"
        lead="Enterprise brings multi-company workspaces, credits and limits per company, alert watching and onboarding with your team."
        primary={{ label: 'Talk to sales', to: '/contact?topic=sales' }}
        secondary={{ label: 'Start free', to: '/signup' }}
      >
        <p className="mt-6 text-[13px] text-on-ink-2">
          Need a security review first?{' '}
          <Link to="/security" className="font-medium text-accent-on-ink underline-offset-4 hover:text-on-ink hover:underline">
            Read how Alaventra protects your data
          </Link>
        </p>
      </CtaBand>
    </>
  );
}
