import { useAuth } from "../../contexts/AuthContext";
import { Users, School, FileCheck2, Activity } from "lucide-react";

function Stat({ icon: Icon, label, value, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 grid place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminOverview() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Welcome back, {user?.firstName || "Admin"}.
        </h2>
        <p className="text-sm text-slate-500">
          Here's a high-level view of the FLN platform.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Total users" value="—" tone="blue" />
        <Stat icon={School} label="Schools" value="—" tone="green" />
        <Stat icon={FileCheck2} label="Assessments" value="—" tone="orange" />
        <Stat icon={Activity} label="Active sessions" value="1" tone="purple" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Next steps</h3>
        <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
          <li>Create your first assessment</li>
          <li>Upload a question paper PDF to extract questions with AI</li>
          <li>Review, edit and approve the template</li>
          <li>Generate the answer key</li>
        </ul>
      </div>
    </div>
  );
}