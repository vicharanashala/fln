import { Eye, Edit, Plus, Download } from "lucide-react";
import { SCHOOLS } from "../../mocks/data";
import type { School } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";
import StatusChip from "../../components/ui/StatusChip";
import Badge from "../../components/ui/Badge";

export default function SchoolsPage() {
  const columns: Column<School>[] = [
    { key: "udiseId", header: "UDISE ID", sortable: true, render: (r) => <span className="font-mono text-xs">{r.udiseId}</span> },
    { key: "name", header: "School Name", sortable: true, render: (r) => <span className="font-medium text-slate-900 text-xs">{r.name}</span> },
    { key: "stateName", header: "State", sortable: true, render: (r) => <span className="text-xs">{r.stateName}</span> },
    { key: "districtName", header: "District", sortable: true, render: (r) => <span className="text-xs">{r.districtName}</span> },
    { key: "cluster", header: "Cluster", render: (r) => <span className="text-xs">{r.cluster}</span> },
    { key: "type", header: "Type", render: (r) => <Badge tone={r.type === "Government" ? "blue" : r.type === "Private" ? "purple" : "slate"}>{r.type}</Badge> },
    { key: "principal", header: "Principal", render: (r) => <span className="text-xs">{r.principal}</span> },
    { key: "teacherCount", header: "Teachers", sortable: true, render: (r) => r.teacherCount },
    { key: "studentCount", header: "Students", sortable: true, render: (r) => r.studentCount },
    { key: "averageScore", header: "Avg Score", sortable: true, render: (r) => <span className="text-xs font-semibold">{r.averageScore}%</span> },
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
    { key: "id", header: "Actions", render: () => (
      <div className="flex items-center gap-2">
        <button className="text-blue-600 hover:text-blue-700"><Eye className="w-3.5 h-3.5" /></button>
        <button className="text-slate-500 hover:text-slate-700"><Edit className="w-3.5 h-3.5" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schools"
        subtitle={`${SCHOOLS.length.toLocaleString()} schools in this view · ${SCHOOLS.reduce((a, b) => a + b.studentCount, 0).toLocaleString()} students enrolled`}
        actions={
          <>
            <Button variant="secondary"><Download className="w-4 h-4" /> Export</Button>
            <Button><Plus className="w-4 h-4" /> Add School</Button>
          </>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} data={SCHOOLS} searchable searchPlaceholder="Search schools by name, UDISE…" pageSize={15} />
      </Card>
    </div>
  );
}