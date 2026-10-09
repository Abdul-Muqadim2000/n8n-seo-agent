import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './field';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** cell content; defaults to String(row[key]) */
  cell?: (row: T) => ReactNode;
  /** value used for sorting (numbers sort numerically) */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** hidden below the md breakpoint */
  hideOnMobile?: boolean;
  width?: string;
}

const pagerBtn =
  'inline-flex size-8 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-2 shadow-card transition-[color,background-color,translate] duration-150 ease-brand hover:bg-surface-2 hover:text-ink active:translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none';

/**
 * A sortable, searchable, paginated table for in-memory rows (dashboards load their rows once).
 * Numbers align right with tabular figures.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  pageSize = 20,
  searchable,
  searchPlaceholder = 'Search…',
  searchText,
  empty,
  onRowClick,
  dense,
  toolbar,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, i: number) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** text a row is searched by (defaults to all string cells) */
  searchText?: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  toolbar?: ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (searchText ? searchText(r) : Object.values(r as Record<string, unknown>).filter((v) => typeof v === 'string').join(' ')).toLowerCase().includes(needle));
  }, [rows, q, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const get = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number | null);
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  return (
    <div className={className}>
      {(searchable || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-2/70">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortValue != null || c.cell == null;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'h-9 whitespace-nowrap border-b border-line px-3 py-2 text-xs font-medium text-ink-3',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.hideOnMobile && 'hidden md:table-cell',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={cn(
                          'group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-surface-3 hover:text-ink active:bg-line',
                          active && 'text-ink',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? (
                            <ArrowUp className="size-3 text-accent-text" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3 text-accent-text" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40 transition-opacity group-hover:opacity-80" aria-hidden />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr
                key={rowKey(r, i)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('border-b border-line transition-colors duration-100 last:border-b-0', onRowClick ? 'cursor-pointer hover:bg-accent-soft/60' : 'hover:bg-surface-2/50')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 align-middle text-ink',
                      dense ? 'py-1.5' : 'py-2.5',
                      c.align === 'right' ? 'text-right tabular' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.hideOnMobile && 'hidden md:table-cell',
                      c.className,
                    )}
                  >
                    {c.cell ? c.cell(r) : String((r as Record<string, unknown>)[c.key] ?? '–')}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length} className="bg-surface px-3 py-10 text-center text-sm text-ink-3">
                  {empty ?? (q ? 'Nothing matches your search.' : 'No rows yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px] text-ink-3">
          <span className="tabular">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden tabular sm:inline">
              Page {current + 1} of {pages}
            </span>
            <button type="button" className={pagerBtn} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" className={pagerBtn} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
