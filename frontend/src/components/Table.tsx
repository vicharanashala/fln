import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Search, SlidersHorizontal } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortKey?: keyof T;
  filterKey?: keyof T;
  filterOptions?: string[];
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T | ((row: T) => string);
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchKey,
  loading = false,
  emptyMessage = 'No records found.'
}: TableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Sorting Handler
  const requestSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter columns
  const filterableColumns = useMemo(() => {
    return columns.filter(c => c.filterKey && c.filterOptions);
  }, [columns]);

  // Filter, Search, Sort Data
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Apply Filters
    Object.entries(activeFilters).forEach(([key, val]) => {
      if (val) {
        result = result.filter(item => String(item[key]) === val);
      }
    });

    // 2. Apply Search
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(row => {
        if (typeof searchKey === 'function') {
          return searchKey(row).toLowerCase().includes(term);
        } else if (searchKey) {
          return String(row[searchKey]).toLowerCase().includes(term);
        }
        // Fallback to checking all string/number columns
        return Object.values(row).some(v => 
          (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(term)
        );
      });
    }

    // 3. Apply Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, searchKey, sortConfig, activeFilters]);

  // Pagination calculations
  const totalPages = Math.ceil(processedData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return processedData.slice(start, start + rowsPerPage);
  }, [processedData, currentPage, rowsPerPage]);

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (processedData.length === 0) return;
    
    // Headers
    const headers = columns.map(c => c.header).join(',');
    
    // Row content
    const csvRows = processedData.map(row => {
      return columns.map(col => {
        let val = '';
        if (typeof col.accessor === 'function') {
          val = row[col.sortKey as string] || row[col.filterKey as string] || '';
        } else {
          val = row[col.accessor] || '';
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...csvRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "exported_table_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50/80 to-white p-4 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/70 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-900/90 dark:ring-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full rounded-2xl border border-slate-200/80 bg-white/90 py-2.75 pl-10 pr-4 text-sm font-medium text-slate-700 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.45)] outline-none transition duration-200 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterableColumns.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 ${
                showFilters || Object.values(activeFilters).some(v => v)
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={processedData.length === 0}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {showFilters && filterableColumns.length > 0 && (
        <div className="grid grid-cols-1 gap-4 rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:grid-cols-2 md:grid-cols-3 dark:border-slate-700/70 dark:bg-slate-900/70">
          {filterableColumns.map(col => {
            const key = String(col.filterKey);
            return (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{col.header}</label>
                <select
                  value={activeFilters[key] || ''}
                  onChange={(e) => handleFilterChange(key, e.target.value)}
                  className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white"
                >
                  <option value="">All</option>
                  {col.filterOptions?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          })}
          {Object.values(activeFilters).some(v => v) && (
            <div className="flex items-end">
              <button
                onClick={() => { setActiveFilters({}); setCurrentPage(1); }}
                className="mb-1 rounded-full border border-rose-200/70 bg-rose-50/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/80 dark:ring-white/5">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200/70 bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/90 dark:text-slate-400">
                {columns.map((col, idx) => {
                  const isSortable = !!col.sortKey;
                  const isSorted = sortConfig?.key === col.sortKey;
                  return (
                    <th
                      key={idx}
                      onClick={() => isSortable && col.sortKey && requestSort(col.sortKey)}
                      className={`px-4 py-3.5 font-semibold whitespace-nowrap ${col.className || ''} ${isSortable ? 'cursor-pointer select-none transition duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {isSortable && (
                          isSorted ? (
                            sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> : <ChevronDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 text-slate-400 dark:text-slate-600" />
                          )
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 bg-white text-sm text-slate-700 dark:divide-slate-700/70 dark:bg-slate-900 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-8 py-10 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-400" />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Loading record entries...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center">
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-8 py-10 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em]">Empty state</span>
                      <span>{emptyMessage}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rIdx) => (
                  <tr key={row.id || rIdx} className="transition-all duration-200 odd:bg-white even:bg-slate-50/70 hover:bg-indigo-50/70 hover:shadow-[inset_0_1px_0_rgba(99,102,241,0.08)] dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800/70">
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className={`px-4 py-3.5 align-middle text-[13px] leading-6 ${col.className || ''}`}>
                        {typeof col.accessor === 'function' ? (
                          col.accessor(row)
                        ) : (
                          String(row[col.accessor] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-slate-200/70 bg-white/80 px-4 py-3 text-sm shadow-[0_12px_40px_-28px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/70 dark:bg-slate-900/70">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200">{((currentPage - 1) * rowsPerPage) + 1}</strong> to{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * rowsPerPage, processedData.length)}
            </strong>{' '}
            of <strong className="text-slate-800 dark:text-slate-200">{processedData.length}</strong> records
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`rounded-2xl border px-3 py-1.5 text-xs font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 ${
                  currentPage === page
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
