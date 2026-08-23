import React, { useState, useRef, useEffect } from 'react';
import { getDistrictSuggestions, fetchDistrictCode, fetchStateCode } from '../utils/geoLookup';

interface DistrictAutocompleteProps {
  value: string;
  onChange: (val: string, selectedDistrict?: { code: string; name: string; stateCode: string }) => void;
  stateInput?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  title?: string;
  id?: string;
}

export const DistrictAutocomplete: React.FC<DistrictAutocompleteProps> = ({
  value,
  onChange,
  stateInput = '',
  placeholder = 'e.g. Ludhiana, LDH, Amritsar...',
  className = '',
  required = false,
  title = 'Type or select District Name/Code',
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = getDistrictSuggestions(value, stateInput);
  const stateDetails = fetchStateCode(stateInput);
  const stateLabel = stateDetails.name || stateInput || 'All States';

  // Handle clicking outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (item: { code: string; name: string; stateCode: string }) => {
    onChange(item.code, item);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        required={required}
        title={title}
        className={className}
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-slate-900 shadow-xl transition-all font-sans">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-700 text-[10px] font-semibold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
            <span>DISTRICT SUGGESTIONS ({stateLabel})</span>
            <span className="text-[9px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
              {suggestions.length} available
            </span>
          </div>

          {suggestions.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 dark:text-zinc-500 text-center italic">
              No districts starting with &quot;{value}&quot; found for {stateLabel}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800/50">
              {suggestions.map((item) => {
                const isSelected = value.toUpperCase() === item.code || value.toLowerCase() === item.name.toLowerCase();
                return (
                  <li
                    key={item.code}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-zinc-100 font-medium">{item.name}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">({item.stateName})</span>
                    </div>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      {item.code}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
