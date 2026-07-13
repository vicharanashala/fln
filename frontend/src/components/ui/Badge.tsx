import { ReactNode } from "react";

type Tone = "blue" | "green" | "orange" | "amber" | "red" | "slate" | "purple";

const tones: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  green: "bg-green-50 text-green-700 ring-green-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

export default function Badge({
  children,
  tone = "slate",
  withDot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  withDot?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${tones[tone]} ${className}`}>
      {withDot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}