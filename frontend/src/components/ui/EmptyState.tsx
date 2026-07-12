import { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 grid place-items-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <EmptyState
      icon={<span className="text-red-500">!</span>}
      title={title}
      description={description}
      action={action}
    />
  );
}