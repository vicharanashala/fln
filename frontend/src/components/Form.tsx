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
    <div className="w-full space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <input
        className={`w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.75 text-sm text-slate-900 shadow-sm placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15 dark:border-red-600' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="block rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</span>
      )}
      {helperText && !error && (
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{helperText}</span>
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
    <div className="w-full space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <select
        className={`w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 py-2.75 text-sm text-slate-900 shadow-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15 dark:border-red-600' : ''
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
        <span className="block rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</span>
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
    <div className="w-full space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <textarea
        className={`w-full rounded-[20px] border border-slate-200/80 bg-white/90 px-3.5 py-2.75 text-sm text-slate-900 shadow-sm placeholder-slate-400 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15 dark:border-red-600' : ''
        } ${className}`}
        {...props}
      />
      {error && (
        <span className="block rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</span>
      )}
    </div>
  );
};
