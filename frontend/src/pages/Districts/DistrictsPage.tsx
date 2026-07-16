import { Plus, Download } from "lucide-react";
import { DISTRICTS, STATES } from "../../mocks/data";
import type { District } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";

export default function DistrictsPage() {
  const columns: Column<District>[] = [
    { key: "name", header: "District Name", sortable: true, render: (r) => <span className="font-medium text-slate-900 text-xs">{r.name}</span> },
    { key: "stateName", header: "State", sortable: true, render: (r) => <span className="text-xs">{r.stateName}</span> },
    { key: "blockCount", header: "Blocks", sortable: true, render: (r) => Math.round(r.blockCount) },
    { key: "schoolCount", header: "Schools", sortable: true, render: (r) => Math.round(r.schoolCount).toLocaleString() },
    { key: "teacherCount", header: "Teachers", sortable: true, render: (r) => Math.round(r.teacherCount).toLocaleString() },
    { key: "studentCount", header: "Students", sortable: true, render: (r) => Math.round(r.studentCount).toLocaleString() },
    { key: "averageScore", header: "Avg Score", sortable: true, render: (r) => (
      <span className={`text-xs font-semibold ${r.averageScore >= 65 ? "text-green-700" : r.averageScore >= 50 ? "text-amber-700" : "text-red-600"}`}>
        {r.averageScore}%
      </span>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Districts"
        subtitle={`${DISTRICTS.length} districts across ${STATES.length} states/UTs`}
        actions={
          <>
            <Button variant="secondary"><Download className="w-4 h-4" /> Export</Button>
            <Button><Plus className="w-4 h-4" /> Add District</Button>
          </>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} data={DISTRICTS} searchable searchPlaceholder="Search districts…" pageSize={15} />
      </Card>
    </div>
  );
}