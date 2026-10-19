import type { ReactNode } from 'react';
import { ExternalLink } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

// The guides' inline markup (@seo/shared guides.ts): **what to click**, `what to type`, [label](https://link). Deliberately tiny,
// it keeps the content plain data that also copies cleanly into an e-mail.

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/;

export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.92em] text-ink">{part.slice(1, -1)}</code>;
    const link = part.match(LINK);
    if (link) return <ExternalLink key={i} href={link[2]}>{link[1]}</ExternalLink>;
    return <span key={i}>{part}</span>;
  });
  return <span className={cn(className)}>{parts}</span>;
}
