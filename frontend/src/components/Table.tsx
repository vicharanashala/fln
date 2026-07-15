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
      {/* Controls: Search, Filters button, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:placeholder-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterableColumns.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-lg text-xs font-semibold font-mono transition cursor-pointer ${
                showFilters || Object.values(activeFilters).some(v => v)
                  ? 'bg-indigo-50 text-indigo-755 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
                  : 'bg-white text-slate-750 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            disabled={processedData.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold font-mono bg-white text-slate-750 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Expanded Filters bar */}
      {showFilters && filterableColumns.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 dark:bg-slate-900 dark:border-slate-700">
          {filterableColumns.map(col => {
            const key = String(col.filterKey);
            return (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{col.header}</label>
                <select
                  value={activeFilters[key] || ''}
                  onChange={(e) => handleFilterChange(key, e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-white dark:border-slate-700 dark:focus:border-indigo-500"
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
                className="text-xs text-red-650 font-mono font-bold hover:underline mb-2 dark:text-red-400"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table grid */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white dark:bg-slate-900 dark:border-slate-700">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase font-bold tracking-wider dark:bg-slate-900/60 dark:border-slate-700 dark:text-slate-400">
              {columns.map((col, idx) => {
                const isSortable = !!col.sortKey;
                const isSorted = sortConfig?.key === col.sortKey;
                return (
                  <th
                    key={idx}
                    onClick={() => isSortable && col.sortKey && requestSort(col.sortKey)}
                    className={`p-4 font-bold ${col.className || ''} ${isSortable ? 'cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
                  >
                    <div className="flex items-center gap-1">
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
          <tbody className="divide-y divide-slate-100 font-sans text-slate-700 dark:divide-slate-700 dark:text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin dark:border-indigo-400" />
                    <span className="text-xs font-medium font-mono text-slate-500 dark:text-slate-400">Loading record entries...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-50/50 transition duration-150 dark:hover:bg-slate-800/50">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className={`p-4 ${col.className || ''}`}>
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Showing <strong className="text-slate-800 dark:text-slate-200">{((currentPage - 1) * rowsPerPage) + 1}</strong> to{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {Math.min(currentPage * rowsPerPage, processedData.length)}
            </strong>{' '}
            of <strong className="text-slate-800 dark:text-slate-200">{processedData.length}</strong> records
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold cursor-pointer dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold cursor-pointer dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
