import { HTMLAttributes, ReactNode } from "react";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  noPadding?: boolean;
}

export default function Card({ title, subtitle, action, noPadding, children, className = "", ...rest }: Props) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`} {...rest}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </div>
  );
}