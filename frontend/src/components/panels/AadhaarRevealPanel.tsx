// Admin Aadhaar Reveal Panel — top-level entry to the Step-Up detokenization UX.
//
// Lists students the current admin can access with a "Reveal" button per row.
// Clicking a row opens the AadhaarRevealDialog which drives the step-up flow.
//
// The data is fetched server-side: pagination, search, and the latest-first
// sort all happen on the backend so the browser never has to materialise the
// 86,400-row roster. This panel deliberately does NOT use the shared
// `usePanelData` hook (which still uses `?all=1` for other admin panels that
// need the full set).
//
// Only SUPERADMIN / ADMIN / DISTRICT_ADMIN / BLOCK_ADMIN can see the panel —
// the backend mirrors this gate on every route under
// backend/src/routes/aadhaarDetokenize.ts. The frontend gate here is purely
// for UX (don't even render the menu item for teachers / volunteers).
import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Student, User, UserRole } from '../../types';
import { PageHeader } from './PanelShared';
import { AadhaarRevealDialog } from './AadhaarRevealDialog';
import { apiFetch } from '../../services/apiClient';

interface Props {
  /** Optional pre-fetched roster (e.g. from the parent PanelViews). When
   *  provided, the panel renders it as the first paint and then refreshes
   *  against the server on mount / search / page change. The prop is
   *  ignored once a server response lands. */
  students?: Student[];
  currentUser: User;
  token: string;
  /** Routes the user to the dedicated MFA enrollment surface (SecurityPanel)
   *  when the reveal dialog needs to send them to enroll a factor first. */
  onSelectView?: (view: string) => void;
}

const ALLOWED_ROLES: ReadonlyArray<UserRole> = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.DISTRICT_ADMIN,
  UserRole.BLOCK_ADMIN,
];

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/** Hook: returns a value that lags `value` by `delayMs`. Used so a
 *  typing burst in the search box only fires one server request. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type FetchState = {
  students: Student[];
  total: number;
  loading: boolean;
  error: string | null;
};

export const AadhaarRevealPanel: React.FC<Props> = ({ students: propStudents, currentUser, token, onSelectView }) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [target, setTarget] = useState<Student | null>(null);
  const [state, setState] = useState<FetchState>({
    students: Array.isArray(propStudents) ? propStudents : [],
    total: Array.isArray(propStudents) ? propStudents.length : 0,
    loading: true,
    error: null,
  });

  // Reset to page 1 whenever the search query or page size changes —
  // otherwise the user can land on an empty page that no longer exists.
  useEffect(() => { setPage(1); }, [debouncedQuery, rowsPerPage]);

  // Server fetch. The URL never uses `?all=1` — every call is paged
  // and (when the search box is non-empty) filtered server-side. The
  // `X-Total-Count` header (set by backend/src/routes/students.ts)
  // drives the pagination total.
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    const params = new URLSearchParams();
    params.set('limit', String(rowsPerPage));
    params.set('offset', String((page - 1) * rowsPerPage));
    params.set('sort', 'latest');
    if (debouncedQuery) params.set('q', debouncedQuery);
    const url = `/api/students?${params.toString()}`;
    apiFetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(async r => {
        const totalHeader = r.headers.get('X-Total-Count');
        const total = totalHeader ? parseInt(totalHeader, 10) : 0;
        const data = await r.json();
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setState({ students: [], total: 0, loading: false, error: 'Unexpected response from server.' });
          return;
        }
        setState({ students: data as Student[], total, loading: false, error: null });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ students: [], total: 0, loading: false, error: 'Failed to reach server.' });
      });
    return () => { cancelled = true; };
  }, [token, debouncedQuery, page, rowsPerPage]);

  const { students: visibleStudents, total, loading, error } = state;

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, totalPages);

  // Windowed page list (1, …, currentPage±1, …, last) so wide datasets
  // don't render one button per page.
  const pageItems = useMemo(() => {
    const delta = 1;
    const pages: (number | 'ellipsis')[] = [];
    const range: number[] = [];
    for (let i = Math.max(2, safePage - delta); i <= Math.min(totalPages - 1, safePage + delta); i++) {
      range.push(i);
    }
    pages.push(1);
    if (range[0] > 2) pages.push('ellipsis');
    pages.push(...range);
    if (range[range.length - 1] < totalPages - 1) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  }, [safePage, totalPages]);

  if (!ALLOWED_ROLES.includes(currentUser.role)) {
    // Defence-in-depth: the Layout menu shouldn't render this panel for
    // non-admin roles, but if it does (e.g. via a stale hash), fail closed.
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <PageHeader title="Aadhaar Reveal" desc="Step-Up detokenization (admin only)" icon={<ShieldCheck />} />
        <p className="text-slate-600 dark:text-slate-400">
          This panel is restricted to admins. Your role ({currentUser.role}) cannot reveal plaintext Aadhaar.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Aadhaar Reveal"
        desc="Step-Up detokenization for correction / audit / legal requests."
        icon={<ShieldCheck />}
      />

      <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-900 dark:text-amber-200">
        <strong>Privacy notice.</strong> Plaintext Aadhaar is shown temporarily (60s auto-clear) for the
        purpose of correcting enrollment mistakes or responding to a verified audit/legal request. It is
        never persisted in this app and never logged. Every reveal is recorded with a vault audit id.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name / displayId / masked Aadhaar / school / class / section…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span>
            {loading
              ? 'Loading…'
              : <>{total === 0 ? 'No matches' : <><strong className="text-slate-700 dark:text-slate-200">{total.toLocaleString()}</strong> match{total === 1 ? '' : 'es'}</>}</>}
          </span>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="text-left px-4 py-2">Student</th>
              <th className="text-left px-4 py-2">Class</th>
              <th className="text-left px-4 py-2">School</th>
              <th className="text-left px-4 py-2">Masked Aadhaar</th>
              <th className="text-right px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && visibleStudents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  Loading latest students…
                </td>
              </tr>
            )}
            {!loading && visibleStudents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  {query
                    ? <>No students match <span className="font-mono">&ldquo;{query}&rdquo;</span>. Try a partial school id, class, or section.</>
                    : 'No students in your scope yet.'}
                </td>
              </tr>
            )}
            {visibleStudents.map(s => (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2">
                  <div className="font-medium">{s.name ?? '—'}</div>
                  {s.displayId && <div className="text-xs text-slate-500 font-mono">{s.displayId}</div>}
                </td>
                <td className="px-4 py-2">{s.classGroup ?? '—'} / {s.section ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-400">{s.schoolId ?? '—'}</td>
                <td className="px-4 py-2 font-mono">{s.aadharMasked ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setTarget(s)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                  >
                    Reveal
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls — match the style of frontend/src/components/Table.tsx. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <span>
            {total === 0
              ? '0 records'
              : <>Showing <strong className="text-slate-700 dark:text-slate-200">{(safePage - 1) * rowsPerPage + 1}</strong>–<strong className="text-slate-700 dark:text-slate-200">{Math.min(safePage * rowsPerPage, total)}</strong> of <strong className="text-slate-700 dark:text-slate-200">{total.toLocaleString()}</strong></>}
          </span>
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={rowsPerPage}
              onChange={e => setRowsPerPage(Number(e.target.value))}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
            >
              {ROWS_PER_PAGE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            {pageItems.map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 select-none">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`min-w-[2rem] px-2 py-1 rounded border text-xs font-bold transition ${
                    item === safePage
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {target && (
        <AadhaarRevealDialog
          student={target}
          token={token}
          onClose={() => setTarget(null)}
          onNavigateToSecurity={onSelectView ? () => onSelectView('security') : undefined}
        />
      )}
    </div>
  );
};
