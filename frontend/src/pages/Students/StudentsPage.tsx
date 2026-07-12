import { Plus, Download } from "lucide-react";
import { STUDENTS } from "../../mocks/data";
import type { Student } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";

export default function StudentsPage() {
  const columns: Column<Student>[] = [
    { key: "rollNumber", header: "Roll #", sortable: true, render: (r) => <span className="font-mono text-xs">{r.rollNumber}</span> },
    { key: "name", header: "Student Name", sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold ${r.gender === "Female" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
          {r.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <span className="font-medium text-slate-900 text-xs">{r.name}</span>
      </div>
    )},
    { key: "class", header: "Class", sortable: true, render: (r) => <Badge tone="blue">{r.class}</Badge> },
    { key: "schoolName", header: "School", sortable: true, render: (r) => <span className="text-xs">{r.schoolName}</span> },
    { key: "gender", header: "Gender", render: (r) => <span className="text-xs">{r.gender}</span> },
    { key: "attendance", header: "Attendance", sortable: true, render: (r) => (
      <div className="w-24"><ProgressBar value={r.attendance} tone={r.attendance >= 85 ? "green" : r.attendance >= 70 ? "orange" : "red"} /></div>
    )},
    { key: "averageScore", header: "Avg Score", sortable: true, render: (r) => <span className="text-xs font-semibold">{r.averageScore}%</span> },
    { key: "latestAssessment", header: "Latest Assessment", render: (r) => <span className="text-xs text-slate-600">{r.latestAssessment || "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        subtitle={`${STUDENTS.length.toLocaleString()} students in this view`}
        actions={
          <>
            <Button variant="secondary"><Download className="w-4 h-4" /> Export</Button>
            <Button><Plus className="w-4 h-4" /> Add Student</Button>
          </>
        }
      />
      <Card noPadding>
        <DataTable columns={columns} data={STUDENTS} searchable searchPlaceholder="Search students by name, roll #…" pageSize={15} />
      </Card>
    </div>
  );
}