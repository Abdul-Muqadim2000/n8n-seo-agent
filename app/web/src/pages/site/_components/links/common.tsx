// Link building (v4.13, n8n/seo-agent/LINK_BUILDER_SPEC.md): labels, icons and small pieces shared by the page's sections.
import type { ReactNode } from 'react';
import { AtSign, Bot, Library, Link2, Link2Off, ListOrdered, Network, Newspaper, PenLine, Swords, Unlink, Wrench } from 'lucide-react';
import { OPPORTUNITY_LABEL, REPLY_LABEL, SEQUENCE_LABEL, titleCase, type MailboxView, type OutreachContact, type ReplyClass, type SequenceStatus, type LinkBuildingData } from '@seo/shared';
import { prefersReducedMotion } from '@/components/insight';
import { Badge, StatusBadge, type Tone } from '@/components/ui/badge';

export const typeLabel = (t: string) => OPPORTUNITY_LABEL[t] ?? titleCase(t || 'other');

export const TYPE_ICON: Record<string, ReactNode> = {
  lost: <Unlink />,
  mention: <AtSign />,
  list: <ListOrdered />,
  comp_new: <Swords />,
  gap: <Network />,
  ai_source: <Bot />,
  resource: <Library />,
  broken: <Link2Off />,
  press: <Newspaper />,
  reclaim: <Wrench />,
  manual: <PenLine />,
};
export const typeIcon = (t: string) => TYPE_ICON[t] ?? <Link2 />;

export const CONTACT_KIND: Record<OutreachContact['kind'], string> = { person: 'Named person', editorial: 'Editorial inbox', general: 'General inbox', other: 'Other address' };

/** The link text we ask for (never a keyword). */
export const ANCHOR_LABEL: Record<string, string> = { brand: 'Your brand name', title: 'The page\'s title', url: 'The page\'s address', 'as before': 'The same text as before' };
export const anchorLabel = (a: string) => ANCHOR_LABEL[a] ?? (a ? a : ANCHOR_LABEL.brand!);
export const ANCHOR_INFO =
  'We never ask for a keyword as the link text: Google names optimised link text in requested links as link spam. Your brand or the page\'s title is what an editor would write anyway.';

export function SequenceBadge({ status }: { status: SequenceStatus }) {
  const tone: Tone = status === 'won' ? 'good' : status === 'replied' ? 'accent' : status === 'paused' ? 'warning' : status === 'bounced' || status === 'failed' ? 'critical' : 'neutral';
  return tone === 'neutral' ? <Badge>{SEQUENCE_LABEL[status] ?? titleCase(status)}</Badge> : <StatusBadge tone={tone}>{SEQUENCE_LABEL[status] ?? titleCase(status)}</StatusBadge>;
}

/** Reply classes: a link that went live is good news; payment / swaps / opt-outs are warnings; the rest is information. */
export const REPLY_TONE: Record<ReplyClass, Tone> = {
  says_linked: 'good',
  interested: 'accent',
  question: 'accent',
  wants_payment: 'warning',
  link_swap: 'warning',
  not_now: 'neutral',
  declined: 'neutral',
  unsubscribe: 'neutral',
  wrong_person: 'neutral',
  out_of_office: 'neutral',
  other: 'neutral',
};
export function ReplyBadge({ cls }: { cls: ReplyClass | null }) {
  const c = cls ?? 'other';
  const tone = REPLY_TONE[c] ?? 'neutral';
  return tone === 'neutral' ? <Badge>{REPLY_LABEL[c] ?? 'Replied'}</Badge> : <StatusBadge tone={tone}>{REPLY_LABEL[c] ?? 'Replied'}</StatusBadge>;
}
/** What a reply class means for the person (shown under the reply). */
export const REPLY_NOTE: Partial<Record<ReplyClass, string>> = {
  says_linked: 'They say the link is live: our link check confirms it on their page, then it counts as won.',
  wants_payment: 'A paid link must carry rel="sponsored" and passes no SEO value, so we do not pursue it. Answer politely or mark it not a fit.',
  link_swap: 'Google treats excessive link exchanges as link spam. Offer something useful instead, or mark it not a fit.',
  unsubscribe: 'They asked not to be contacted: the address is on your opt-out list and gets nothing more.',
  declined: 'They said no: the address is on your opt-out list.',
  wrong_person: 'Ask who the right person is, or approve a new pitch to the address they named.',
  out_of_office: 'An automatic reply: the next e-mail waits until they are back.',
};

export const VERDICT: Record<string, { label: string; tone: Tone }> = {
  likely_helped: { label: 'Likely helped', tone: 'good' },
  possibly_helped: { label: 'Possibly helped', tone: 'accent' },
  no_effect_yet: { label: 'No measurable effect yet', tone: 'neutral' },
  too_early: { label: 'Too early', tone: 'neutral' },
  cant_tell: { label: 'Can\'t tell', tone: 'neutral' },
};
export const verdictOf = (v: string) => VERDICT[v] ?? { label: titleCase(v || 'unknown'), tone: 'neutral' as Tone };

/** The mailbox pitches go out from: the website's choice when it is active, else the company's first active one. */
export function sendingMailbox(d: Pick<LinkBuildingData, 'settings' | 'mailboxes'>, id?: string | null): MailboxView | null {
  return d.mailboxes.find((m) => m.id === (id ?? d.settings.mailboxId) && m.status === 'active') ?? d.mailboxes.find((m) => m.status === 'active') ?? null;
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** "Mon-Fri 08:00-17:00 (Asia/Dubai)" */
export const windowText = (m: Pick<MailboxView, 'windowStart' | 'windowEnd' | 'timezone'>) => `Mon-Fri ${pad(m.windowStart)}-${pad(m.windowEnd)} (${m.timezone})`;

/** Scrolls to a section of the page (instant under reduced motion). */
export function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** Word count of an e-mail text (the hints: 80-130 words for a first e-mail, 40-70 for a follow-up). */
export const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
