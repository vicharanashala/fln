import { Eye, MapPin, Users, School, GraduationCap, Award } from "lucide-react";
import { STATES } from "../../mocks/data";
import { scoreColor } from "../../data/indiaMap";
import { Column } from "../../components/tables/DataTable";
import type { State } from "../../types";
import PageHeader from "../../components/ui/PageHeader";
import Toolbar from "../../components/ui/Toolbar";
import DataTable from "../../components/tables/DataTable";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";

export default function StatesPage() {
  const columns: Column<State>[] = [
    { key: "name", header: "State Name", sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 grid place-items-center text-[10px] font-bold">
          {r.code}
        </div>
        <div>
          <p className="font-medium text-slate-900 text-xs">{r.name}</p>
          <p className="text-[10px] text-slate-500">{r.type}</p>
        </div>
      </div>
    )},
    { key: "code", header: "Code", sortable: true, width: "80px", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "districtCount", header: "Districts", sortable: true, width: "90px", render: (r) => r.districtCount },
    { key: "schoolCount", header: "Schools", sortable: true, render: (r) => <span className="text-xs">{r.schoolCount.toLocaleString()}</span> },
    { key: "teacherCount", header: "Teachers", sortable: true, render: (r) => <span className="text-xs">{r.teacherCount.toLocaleString()}</span> },
    { key: "studentCount", header: "Students", sortable: true, render: (r) => <span className="text-xs font-medium">{(r.studentCount / 1000000).toFixed(2)}M</span> },
    { key: "averageScore", header: "Avg Score", sortable: true, width: "140px", render: (r) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-16">
          <div className="h-full" style={{ width: `${r.averageScore}%`, background: scoreColor(r.averageScore) }} />
        </div>
        <span className="text-xs font-semibold">{r.averageScore}%</span>
      </div>
    )},
    { key: "id", header: "Actions", width: "70px", render: () => (
      <button className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1">
        <Eye className="w-3 h-3" /> View
      </button>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="States & Union Territories"
        subtitle={`Managing ${STATES.length} states/UTs across India`}
        actions={<Toolbar onExport={() => {}} onAdd={() => {}} addLabel="Add State" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total States" value={STATES.filter(s => s.type === "State").length} icon={<MapPin className="w-5 h-5" />} iconTone="bg-blue-50 text-blue-600" />
        <StatCard title="Union Territories" value={STATES.filter(s => s.type === "Union Territory").length} icon={<MapPin className="w-5 h-5" />} iconTone="bg-purple-50 text-purple-600" />
        <StatCard title="Total Districts" value={STATES.reduce((a, b) => a + b.districtCount, 0)} icon={<School className="w-5 h-5" />} iconTone="bg-green-50 text-green-600" />
        <StatCard title="National Avg Score" value={(STATES.reduce((a, b) => a + b.averageScore, 0) / STATES.length).toFixed(1) + "%"} icon={<Award className="w-5 h-5" />} iconTone="bg-yellow-50 text-yellow-600" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} data={STATES} searchable searchPlaceholder="Search states by name, code…" pageSize={12} />
      </Card>
    </div>
  );
}