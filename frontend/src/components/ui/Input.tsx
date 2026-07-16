import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, leftIcon, rightIcon, className = "", ...rest },
  ref
) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</span>
        )}
        <input
          ref={ref}
          className={`input ${leftIcon ? "!pl-9" : ""} ${rightIcon ? "!pr-9" : ""} ${error ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : ""} ${className}`}
          {...rest}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{rightIcon}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
});

export default Input;