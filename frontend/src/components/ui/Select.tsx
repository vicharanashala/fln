import { SelectHTMLAttributes, forwardRef } from "react";

interface Option { value: string; label: string; }

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, placeholder, className = "", ...rest },
  ref
) {
  return (
    <div className="space-y-1">
      {label && <label className="label">{label}</label>}
      <select
        ref={ref}
        className={`input appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDIwIDIwIj48cGF0aCBmaWxsPSIjMzMzIiBkPSJNNyA3bDMgMyAzaC0yeiIvPjwvc3ZnPg==')] bg-no-repeat bg-[right_0.75rem_center] pr-8 cursor-pointer ${error ? "border-red-300" : ""} ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

export default Select;