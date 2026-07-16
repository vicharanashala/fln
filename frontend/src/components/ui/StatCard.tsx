import { ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  title: string;
  value: string | number;
  change?: string;
  changeTone?: "up" | "down" | "neutral";
  icon: ReactNode;
  iconTone?: string;
  loading?: boolean;
}

export default function StatCard({ title, value, change, changeTone = "neutral", icon, iconTone = "bg-blue-50 text-blue-600", loading }: Props) {
  const changeColors = { up: "text-green-600", down: "text-red-600", neutral: "text-slate-500" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? "—" : value}</p>
          {change && (
            <p className={`text-xs font-medium mt-1 ${changeColors[changeTone]}`}>
              {changeTone === "up" ? "↑" : changeTone === "down" ? "↓" : "→"} {change}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl grid place-items-center ${iconTone}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}