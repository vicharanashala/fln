import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      <input
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 outline-none transition focus:border-indigo-650 focus:ring-1 focus:ring-indigo-600 disabled:opacity-50 disabled:bg-slate-50 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="text-[10px] font-mono font-semibold text-red-600 dark:text-red-400 block">{error}</span>
      )}
      {helperText && !error && (
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block">{helperText}</span>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { label: string; value: string | number }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      <select
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 bg-white outline-none transition focus:border-indigo-650 focus:ring-1 focus:ring-indigo-600 disabled:opacity-50 disabled:bg-slate-50 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' : ''
        } ${className}`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-[10px] font-mono font-semibold text-red-600 dark:text-red-400 block">{error}</span>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
        {label}
      </label>
      <textarea
        className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 bg-white placeholder-slate-400 outline-none transition focus:border-indigo-650 focus:ring-1 focus:ring-indigo-600 disabled:opacity-50 disabled:bg-slate-50 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="text-[10px] font-mono font-semibold text-red-600 dark:text-red-400 block">{error}</span>
      )}
    </div>
  );
};
