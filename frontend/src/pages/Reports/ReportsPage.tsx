import { FileText, FileSpreadsheet, Printer, BarChart3, Map, Building2, School, Users, GraduationCap, ClipboardCheck, ChevronRight } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

const REPORTS = [
  { level: "National", icon: Map, color: "blue", count: 24, desc: "Pan-India performance, completion rates, trends" },
  { level: "State", icon: Map, color: "green", count: 156, desc: "State-level literacy, numeracy, district rankings" },
  { level: "District", icon: Building2, color: "orange", count: 892, desc: "District performance, block comparisons, schools" },
  { level: "School", icon: School, color: "purple", count: 8432, desc: "School performance, student analytics, teacher load" },
  { level: "Teacher", icon: Users, color: "indigo", count: 28456, desc: "Teacher activity, assessments conducted, class progress" },
  { level: "Student", icon: GraduationCap, color: "pink", count: 1240000, desc: "Individual progress, learning gaps, recommendations" },
  { level: "Assessment", icon: ClipboardCheck, color: "cyan", count: 4382, desc: "Question-wise analysis, difficulty, discrimination" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Pre-built reports across all levels with PDF and Excel exports"
        actions={
          <>
            <Button variant="secondary"><Printer className="w-4 h-4" /> Print</Button>
            <Button variant="secondary"><FileSpreadsheet className="w-4 h-4" /> Export All</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.level} className="card-hover cursor-pointer">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl grid place-items-center bg-${r.color}-50 text-${r.color}-600`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">{r.level} Report</h3>
                    <Badge tone="blue">{r.count}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
                  <div className="flex items-center gap-1 mt-3">
                    <button className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 hover:text-blue-700">
                      View Report <ChevronRight className="w-3 h-3" />
                    </button>
                    <span className="text-slate-300">·</span>
                    <button className="text-[10px] text-slate-500 hover:text-slate-700">PDF</button>
                    <span className="text-slate-300">·</span>
                    <button className="text-[10px] text-slate-500 hover:text-slate-700">Excel</button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Recent Generated Reports">
        <div className="divide-y divide-slate-100">
          {[
            { name: "National FLN Performance Q3 2025-26", type: "PDF", size: "2.4 MB", time: "5 min ago", user: "Super Admin" },
            { name: "Maharashtra State Report — November", type: "Excel", size: "1.8 MB", time: "1 hour ago", user: "Super Admin" },
            { name: "District-wise Top Performers 2025", type: "PDF", size: "3.1 MB", time: "Yesterday", user: "State Admin (MH)" },
            { name: "Numeracy Assessment Analysis — Grade 3", type: "PDF", size: "892 KB", time: "2 days ago", user: "Super Admin" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 grid place-items-center">
                {r.type === "PDF" ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{r.name}</p>
                <p className="text-[10px] text-slate-500">{r.user} · {r.time}</p>
              </div>
              <Badge tone="slate">{r.size}</Badge>
              <Button variant="ghost" size="sm">Download</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}