export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  tone,
}: {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  tone?: "blue" | "green" | "orange" | "red";
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = { blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500", red: "bg-red-500" };
  const c = colors[tone ?? (pct >= 80 ? "green" : pct >= 50 ? "orange" : "blue")];
  return (
    <div className="w-full space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs text-slate-600">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-medium">{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}