import { Plus, Download } from "lucide-react";
import { TEACHERS } from "../../mocks/data";
import type { Teacher } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";
import StatusChip from "../../components/ui/StatusChip";
import Badge from "../../components/ui/Badge";

export default function TeachersPage() {
  const columns: Column<Teacher>[] = [
    { key: "employeeId", header: "Employee ID", sortable: true, render: (r) => <span className="font-mono text-xs">{r.employeeId}</span> },
    { key: "name", header: "Teacher Name", sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-[10px] font-bold">
          {r.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <span className="font-medium text-slate-900 text-xs">{r.name}</span>
      </div>
    )},
    { key: "schoolName", header: "School", sortable: true, render: (r) => <span className="text-xs">{r.schoolName}</span> },
    { key: "designation", header: "Designation", render: (r) => <Badge tone="blue">{r.designation}</Badge> },
    { key: "subjects", header: "Subjects", render: (r) => (
      <div className="flex gap-1 flex-wrap">
        {r.subjects.map((s) => <span key={s} className="chip-slate text-[10px]">{s}</span>)}
      </div>
    )},
    { key: "classes", header: "Classes", render: (r) => r.classes.join(", ") },
    { key: "studentCount", header: "Students", sortable: true, render: (r) => r.studentCount },
    { key: "assessmentsConducted", header: "Assessments", sortable: true, render: (r) => r.assessmentsConducted },
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teachers"
        subtitle={`${TEACHERS.length} teachers in this view`}
        actions={
          <>
            <Button variant="secondary"><Download className="w-4 h-4" /> Export</Button>
            <Button><Plus className="w-4 h-4" /> Add Teacher</Button>
          </>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} data={TEACHERS} searchable searchPlaceholder="Search teachers…" pageSize={15} />
      </Card>
    </div>
  );
}