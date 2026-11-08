import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Filter, Search } from 'lucide-react';
import { csvCell } from '@seo/shared';
import { cn, downloadText } from '@/lib/utils';
import { Input, Select } from './field';
import { Sheet } from './overlay';

/** KI (2026-11-08): an opt-in filter on one column, a select above the table ("All" + the options). */
export interface ColumnFilter<T> {
  label: string;
  options: { value: string; label: string }[];
  /** the value(s) a row has for this filter (a row with several matches any of them) */
  value: (row: T) => string | readonly string[] | null | undefined;
  /** the first option, default "All" */
  allLabel?: string;
}

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
  /** KI: a filter for this column (shown only when the table sets `columnFilters`) */
  filter?: ColumnFilter<T>;
  /** KI: the CSV value (default: sortValue, else the row's field); `csv: false` leaves the column out of the CSV */
  csv?: ((row: T) => unknown) | false;
  /** KI: the CSV header (default: the header when it is text, else the key) */
  csvHeader?: string;
}

/** The rows that pass every chosen column filter ('' = all). */
export function applyColumnFilters<T>(rows: readonly T[], columns: readonly Column<T>[], values: Readonly<Record<string, string>>): T[] {
  const active = columns.filter((c) => c.filter && values[c.key]);
  if (!active.length) return [...rows];
  return rows.filter((r) =>
    active.every((c) => {
      const v = c.filter!.value(r);
      const want = values[c.key];
      return Array.isArray(v) ? v.includes(want) : v === want;
    }),
  );
}

/** The CSV of these rows and columns (RFC 4180 line ends; spreadsheet formulas neutralised by csvCell). */
export function tableCsv<T>(rows: readonly T[], columns: readonly Column<T>[]): string {
  const cols = columns.filter((c) => c.csv !== false);
  const head = cols.map((c) => c.csvHeader ?? (typeof c.header === 'string' ? c.header : c.key));
  const val = (c: Column<T>, r: T): unknown => (typeof c.csv === 'function' ? c.csv(r) : c.sortValue ? c.sortValue(r) : (r as Record<string, unknown>)[c.key]);
  return [head, ...rows.map((r) => cols.map((c) => val(c, r)))].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
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
  searchPlaceholder = 'Search...',
  searchText,
  empty,
  onRowClick,
  dense,
  toolbar,
  className,
  columnFilters,
  initialFilters,
  csv,
  mobileCard,
  stickyFirst,
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
  /** KI opt-in: show the columns' `filter`s above the table (a "Filters" sheet on phones) */
  columnFilters?: boolean;
  initialFilters?: Record<string, string>;
  /** KI opt-in: a "Download CSV" button for every row that passes the search and filters, in the current order */
  csv?: { fileName: string; label?: string };
  /** KI opt-in: below `md` each row is this card instead of a table row (wide tables) */
  mobileCard?: (row: T) => ReactNode;
  /** KI opt-in: the first column stays in view while the table scrolls sideways inside its box */
  stickyFirst?: boolean;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [fv, setFv] = useState<Record<string, string>>(initialFilters ?? {});
  const [sheet, setSheet] = useState(false);
  const filterCols = columnFilters ? columns.filter((c) => c.filter) : [];
  const activeFilters = filterCols.filter((c) => fv[c.key]).length;

  const filtered = useMemo(() => {
    const base = filterCols.length ? applyColumnFilters(rows, filterCols, fv) : rows;
    if (!q.trim()) return base;
    const needle = q.trim().toLowerCase();
    return base.filter((r) => (searchText ? searchText(r) : Object.values(r as Record<string, unknown>).filter((v) => typeof v === 'string').join(' ')).toLowerCase().includes(needle));
  }, [rows, q, searchText, fv, columnFilters, columns]);

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

  const setFilter = (key: string, v: string) => {
    setPage(0);
    setFv((f) => ({ ...f, [key]: v }));
  };
  const filterControls = (stack: boolean) =>
    filterCols.map((c) => (
      <label key={c.key} className={cn('flex min-w-0 flex-col gap-1 text-xs font-medium text-ink-3', stack ? 'w-full' : 'w-auto')}>
        {c.filter!.label}
        <Select value={fv[c.key] ?? ''} onChange={(e) => setFilter(c.key, e.target.value)} className={cn('h-10 sm:h-9', stack ? 'w-full' : 'max-w-[14rem]')}>
          <option value="">{c.filter!.allLabel ?? 'All'}</option>
          {c.filter!.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>
    ));
  const downloadCsv = () => downloadText(csv!.fileName, tableCsv(sorted, columns), 'text/csv');

  return (
    <div className={className}>
      {filterCols.length > 0 && (
        <>
          <div className="mb-3 hidden flex-wrap items-end gap-3 sm:flex" data-table-filters>
            {filterControls(false)}
          </div>
          <div className="mb-3 sm:hidden">
            <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-card">
              <Filter className="size-4" aria-hidden />
              Filters{activeFilters ? ` (${activeFilters})` : ''}
            </button>
            <Sheet open={sheet} onOpenChange={setSheet} title="Filters" footer={<button type="button" onClick={() => setSheet(false)} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">Show {filtered.length} rows</button>}>
              <div className="space-y-4">{filterControls(true)}</div>
            </Sheet>
          </div>
        </>
      )}
      {(searchable || toolbar || csv) && (
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
          {csv && (
            <button type="button" onClick={downloadCsv} disabled={!sorted.length} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-card transition-colors duration-150 ease-brand hover:bg-surface-2 disabled:opacity-50 sm:h-8">
              <Download className="size-4" aria-hidden />
              {csv.label ?? 'Download CSV'}
            </button>
          )}
        </div>
      )}
      {mobileCard && (
        <ul className="space-y-2.5 md:hidden" data-table-cards>
          {visible.map((r, i) => (
            <li key={rowKey(r, i)} className="rounded-xl border border-line bg-surface p-3.5 shadow-card">
              {mobileCard(r)}
            </li>
          ))}
          {!visible.length && <li className="rounded-xl border border-line bg-surface px-3 py-8 text-center text-sm text-ink-3">{empty ?? (q || activeFilters ? 'Nothing matches your search.' : 'No rows yet.')}</li>}
        </ul>
      )}
      <div className={cn('relative overflow-x-auto rounded-xl border border-line bg-surface', mobileCard && 'hidden md:block')}>
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
                      stickyFirst && c === columns[0] && 'sticky left-0 z-[1] bg-surface-2',
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
                      stickyFirst && c === columns[0] && 'sticky left-0 z-[1] bg-surface',
                      dense ? 'py-1.5' : 'py-2.5',
                      c.align === 'right' ? 'text-right tabular' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.hideOnMobile && 'hidden md:table-cell',
                      c.className,
                    )}
                  >
                    {c.cell ? c.cell(r) : String((r as Record<string, unknown>)[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={columns.length} className="bg-surface px-3 py-10 text-center text-sm text-ink-3">
                  {empty ?? (q || activeFilters ? 'Nothing matches your search.' : 'No rows yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-[13px] text-ink-3">
          <span className="tabular">
            {current * pageSize + 1}-{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
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
