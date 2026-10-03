import type { ReactNode } from 'react';
import { Callout } from '@/components/ui/feedback';
import { CopyButton, ExternalLink } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

// How a company gives our Google service account read access: a user in Search Console (permission Full) and a Viewer in GA4.
// The same account reads every customer's data, so no Google sign-in or consent screen is involved.

export function StepList({ steps, start = 1, className }: { steps: ReactNode[]; start?: number; className?: string }) {
  return (
    <ol start={start} className={cn('space-y-2.5', className)}>
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text tabular" aria-hidden>
            {start + i}
          </span>
          <span className="min-w-0">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** The service account e-mail in a copyable box. */
export function ServiceAccountEmail({ email }: { email: string | null }) {
  if (!email)
    return (
      <Callout tone="warning" title="The Google service account is not set up on this server">
        Search Console and GA4 cannot be connected until the platform administrator configures it. You can still verify with a DNS record or a meta tag.
      </Callout>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-2">
      <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{email}</code>
      <CopyButton text={email} label="Copy e-mail" />
    </div>
  );
}

const Ui = ({ children }: { children: ReactNode }) => <strong className="font-medium text-ink">{children}</strong>;

export function SearchConsoleSteps({ email, domain }: { email: string | null; domain: string }) {
  return (
    <div className="space-y-3">
      <StepList
        steps={[
          <>
            Open <ExternalLink href="https://search.google.com/search-console">Google Search Console</ExternalLink> and choose the property for <Ui>{domain}</Ui>. No
            property yet? Add one (a Domain property is best) and verify it in Search Console first.
          </>,
          <>
            Go to <Ui>Settings</Ui> → <Ui>Users and permissions</Ui>.
          </>,
          <>
            Click <Ui>Add user</Ui> and paste this e-mail address:
          </>,
        ]}
      />
      <div className="pl-8">
        <ServiceAccountEmail email={email} />
      </div>
      <StepList
        start={4}
        steps={[
          <>
            Set <Ui>Permission</Ui> to <Ui>Full</Ui> and click <Ui>Add</Ui>. Full lets us read sitemaps and check whether your pages are indexed; we never change anything.
          </>,
        ]}
      />
    </div>
  );
}

export function Ga4Steps({ email }: { email: string | null }) {
  return (
    <div className="space-y-3">
      <StepList
        steps={[
          <>
            Open <ExternalLink href="https://analytics.google.com/">Google Analytics</ExternalLink> and click <Ui>Admin</Ui> (the gear at the bottom left).
          </>,
          <>
            Under <Ui>Property</Ui>, open <Ui>Property access management</Ui>.
          </>,
          <>
            Click <Ui>+</Ui> → <Ui>Add users</Ui>, paste the same e-mail address, choose the <Ui>Viewer</Ui> role and click <Ui>Add</Ui>.
          </>,
        ]}
      />
      {email && (
        <div className="pl-8">
          <ServiceAccountEmail email={email} />
        </div>
      )}
    </div>
  );
}
