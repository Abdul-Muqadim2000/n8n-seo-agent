import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, CircleCheck, Handshake, LifeBuoy, Mail, Presentation, Send, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { Container, IconTile, Reveal, Section } from '../components';
import { ArrowLink, PageHero } from '../components/company/PageHero';
import { contactTopics, site, type ContactTopic } from '../content/site';
import { useSeo } from '../useSeo';

// The form has no backend: on submit it opens the visitor's e-mail app with a `mailto:` link (address from content/site.ts),
// subject and body filled in. The page says so next to the button.

const OPTIONS: { topic: ContactTopic; icon: LucideIcon; title: string; body: string; cta: string }[] = [
  {
    topic: 'sales',
    icon: Presentation,
    title: 'Sales and demos',
    body: 'Plans, a walkthrough of the product, and what Enterprise looks like for your portfolio of companies and websites.',
    cta: 'Talk to sales',
  },
  {
    topic: 'support',
    icon: LifeBuoy,
    title: 'Support',
    body: 'Help with your account, websites, runs or reports. Include your company name so we can find your workspace.',
    cta: 'Get help',
  },
  {
    topic: 'partnerships',
    icon: Handshake,
    title: 'Partnerships',
    body: 'Agencies, consultants and technology partners who want to work with Ascentra or build on it.',
    cta: 'Start a conversation',
  },
];

const TOPIC_IDS = contactTopics.map((t) => t.id) as [ContactTopic, ...ContactTopic[]];
const topicOf = (id: ContactTopic) => contactTopics.find((t) => t.id === id) ?? contactTopics[0];

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name.'),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your work e-mail.')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid e-mail address, like name@company.com.'),
  company: z.string().trim().min(1, 'Enter your company name.'),
  website: z
    .string()
    .trim()
    .refine((v) => v === '' || /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(v), 'Enter a website like yourcompany.com, or leave it empty.'),
  topic: z.enum(TOPIC_IDS),
  message: z.string().trim().min(20, 'Tell us a little more — at least 20 characters.').max(2000, 'Keep the message under 2,000 characters.'),
});
type Values = z.infer<typeof schema>;

function mailtoFor(v: Values) {
  const t = topicOf(v.topic);
  const subject = `${t.label} — ${v.company}`;
  const body = [`Name: ${v.name}`, `E-mail: ${v.email}`, `Company: ${v.company}`, v.website ? `Website: ${v.website}` : null, `Topic: ${t.label}`, '', v.message]
    .filter((l) => l !== null)
    .join('\r\n');
  return { to: t.email, subject, body, href: `mailto:${t.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ContactForm({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [params] = useSearchParams();
  const fromQuery = params.get('topic');
  const initialTopic: ContactTopic = TOPIC_IDS.includes(fromQuery as ContactTopic) ? (fromQuery as ContactTopic) : 'sales';
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', company: '', website: '', topic: initialTopic, message: '' },
  });
  // a card further up (or a link with ?topic=) picks the topic
  useEffect(() => {
    if (fromQuery && TOPIC_IDS.includes(fromQuery as ContactTopic)) setValue('topic', fromQuery as ContactTopic);
  }, [fromQuery, setValue]);

  const [sent, setSent] = useState<ReturnType<typeof mailtoFor> | null>(null);
  const message = watch('message') ?? '';
  const topic = watch('topic');

  const onSubmit = (v: Values) => {
    const m = mailtoFor(v);
    setSent(m);
    window.location.href = m.href;
  };

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit(onSubmit)} aria-labelledby="form-title" className="scroll-mt-28">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          {(p) => <Input {...p} {...register('name')} autoComplete="name" className="h-11 text-[15px]" />}
        </Field>
        <Field label="Work e-mail" error={errors.email?.message}>
          {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" inputMode="email" placeholder="name@company.com" className="h-11 text-[15px]" />}
        </Field>
        <Field label="Company" error={errors.company?.message}>
          {(p) => <Input {...p} {...register('company')} autoComplete="organization" className="h-11 text-[15px]" />}
        </Field>
        <Field label="Website" optional error={errors.website?.message}>
          {(p) => <Input {...p} {...register('website')} autoComplete="url" inputMode="url" placeholder="yourcompany.com" className="h-11 text-[15px]" />}
        </Field>
        <Field label="Topic" className="sm:col-span-2" hint={`Goes to ${topicOf(topic).email}`}>
          {(p) => (
            <Select {...p} {...register('topic')} className="h-11 text-[15px]">
              {contactTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Message"
          className="sm:col-span-2"
          error={errors.message?.message}
          hint={
            <span className="flex justify-between gap-3">
              <span>What you would like to talk about, and the websites involved.</span>
              <span className={cn('shrink-0 font-mono tabular', message.length > 2000 && 'text-critical-text')}>{message.length} / 2,000</span>
            </span>
          }
        >
          {(p) => <Textarea {...p} {...register('message')} rows={6} className="min-h-[156px] resize-y text-[15px]" />}
        </Field>
      </div>

      {isSubmitted && Object.keys(errors).length > 0 && (
        <p className="mt-6 text-[13px] font-medium text-critical-text" role="status">
          Check the {Object.keys(errors).length === 1 ? 'field' : `${Object.keys(errors).length} fields`} marked above.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-sm items-start gap-2 text-[13px] leading-relaxed text-ink-3">
          <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Sending opens your e-mail app with this message filled in. Nothing is sent from this page.</span>
        </p>
        <Button type="submit" size="lg" className="group w-full sm:w-auto">
          <Send className="size-4" aria-hidden />
          Open in my e-mail app
        </Button>
      </div>

      {sent && (
        <div role="status" className="mt-6 flex gap-3 rounded-xl border border-good-text/25 bg-good-soft px-5 py-4 animate-fade-up">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-good-text" aria-hidden />
          <div className="min-w-0 text-[14px] leading-relaxed text-ink">
            <p className="font-medium">Your e-mail app should now be open with the message ready.</p>
            <p className="mt-1 text-ink-2">
              Press send there to reach us. Nothing opened? Copy the message and send it to{' '}
              <a href={`mailto:${sent.to}`} className="font-medium text-accent-text underline-offset-4 hover:underline">
                {sent.to}
              </a>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={`${sent.subject}\r\n\r\n${sent.body}`} label="Copy message" />
              <CopyButton text={sent.to} label="Copy address" />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

const NEXT = [
  { title: 'Your e-mail app opens', body: 'With the address, subject and message filled in from the form.' },
  { title: 'You press send', body: 'The message goes from your own mailbox, so you keep a copy.' },
  { title: 'A person replies', body: 'Someone on the team reads it and writes back.' },
];

export default function ContactPage() {
  useSeo({ title: 'Contact', description: 'Talk to the Ascentra team about plans, demos, support, partnerships or a security review.', path: '/contact' });
  const formRef = useRef<HTMLFormElement>(null);
  const [, setParams] = useSearchParams();

  const pick = (topic: ContactTopic) => {
    setParams({ topic }, { replace: true, preventScrollReset: true });
    const form = formRef.current;
    if (!form) return;
    form.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    form.querySelector<HTMLInputElement>('input[name="name"]')?.focus({ preventScroll: true });
  };

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us."
        lead="Questions about plans, onboarding or running many websites — write to us and a person will answer."
        watermark
        containerClassName="pb-12 sm:pb-16"
      />

      <section className="bg-page pb-20 sm:pb-28" aria-label="Ways to reach us">
        <Container>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {OPTIONS.map((o, i) => {
              const email = topicOf(o.topic).email;
              return (
                <Reveal as="li" key={o.topic} index={i} className="h-full">
                  <div className="group flex h-full flex-col rounded-xl border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-brand hover:-translate-y-0.5 hover:border-accent hover:shadow-raised sm:p-7">
                    <IconTile icon={o.icon} className="group-hover:bg-accent group-hover:text-accent-ink" />
                    <h2 className="mt-5 font-display text-lg font-semibold tracking-[-0.01em] text-ink">{o.title}</h2>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-2">{o.body}</p>
                    <div className="mt-5 flex min-w-0 items-center gap-2 rounded-lg border border-line bg-page py-1.5 pl-3 pr-1.5">
                      <a href={`mailto:${email}`} className="mk-tap min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2 transition-colors duration-150 ease-brand hover:text-accent-text">
                        {email}
                      </a>
                      <CopyButton text={email} label="Copy" className="max-sm:h-10 max-sm:px-3" />
                    </div>
                    <button
                      type="button"
                      onClick={() => pick(o.topic)}
                      className="mk-tap mt-5 inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-accent-text transition-colors duration-150 ease-brand hover:text-accent-hover"
                    >
                      {o.cta}
                      <ArrowRight className="size-4 transition-transform duration-200 ease-brand group-hover:translate-x-1" aria-hidden />
                    </button>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </section>

      <Section tone="surface" bordered aria-labelledby="form-title">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-20">
          <Reveal>
            <h2 id="form-title" className="font-display text-[2rem] font-semibold leading-[1.12] tracking-[-0.01em] text-ink sm:text-4xl">
              Write to us
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-2">Every field except the website is needed so we can answer properly.</p>
            <div className="mt-10">
              <ContactForm formRef={formRef} />
            </div>
          </Reveal>
          <aside className="space-y-6 lg:pt-2">
            <Reveal index={1} className="rounded-xl border border-line bg-page p-6 sm:p-7">
              <h2 className="font-display text-base font-semibold text-ink">What happens next</h2>
              <ol className="mt-5 space-y-5">
                {NEXT.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-mono text-[12px] font-medium text-accent-text tabular">{i + 1}</span>
                    <span>
                      <span className="block text-[14px] font-medium text-ink">{s.title}</span>
                      <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal index={2} className="rounded-xl border border-line bg-page p-6 sm:p-7">
              <IconTile icon={ShieldCheck} size="sm" />
              <h2 className="mt-4 font-display text-base font-semibold text-ink">Reviewing Ascentra?</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">Choose “Security review or questionnaire” as the topic, or read how Ascentra protects your data first.</p>
              <ArrowLink to="/security" className="mt-4 text-[14px]">
                Security at Ascentra
              </ArrowLink>
            </Reveal>
            <Reveal index={3} className="px-1 text-[13.5px] leading-relaxed text-ink-3">
              Already using Ascentra?{' '}
              <Link to="/login" className="font-medium text-accent-text underline-offset-4 hover:underline">
                Sign in
              </Link>{' '}
              — your company, websites and runs are all there. Prefer e-mail? Write to{' '}
              <a href={`mailto:${site.salesEmail}`} className="font-medium text-accent-text underline-offset-4 hover:underline">
                {site.salesEmail}
              </a>
              .
            </Reveal>
          </aside>
        </div>
      </Section>
    </>
  );
}
