import { useState } from "react";
import { Plus, MoreVertical, Edit, Trash2, Copy, Archive, Send, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { ASSESSMENTS } from "../../mocks/data";
import type { Assessment } from "../../types";
import { Column } from "../../components/tables/DataTable";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import DataTable from "../../components/tables/DataTable";
import Button from "../../components/ui/Button";
import StatusChip from "../../components/ui/StatusChip";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";

export default function AssessmentsPage() {
  const [showCreate, setShowCreate] = useState(false);

  const columns: Column<Assessment>[] = [
    { key: "id", header: "ID", sortable: true, render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
    { key: "name", header: "Assessment Name", sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-slate-900 text-xs">{r.name}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Created {r.createdAt}</p>
      </div>
    )},
    { key: "type", header: "Type", render: (r) => <Badge tone="purple">{r.type}</Badge> },
    { key: "subject", header: "Subject", render: (r) => <Badge tone="blue">{r.subject}</Badge> },
    { key: "grade", header: "Grade", render: (r) => <span className="text-xs">{r.grade}</span> },
    { key: "language", header: "Language", render: (r) => <span className="text-xs">{r.language}</span> },
    { key: "academicYear", header: "Year", render: (r) => <span className="text-xs">{r.academicYear}</span> },
    { key: "totalMarks", header: "Marks", sortable: true, render: (r) => <span className="text-xs font-medium">{r.totalMarks}</span> },
    { key: "duration", header: "Duration", render: (r) => <span className="text-xs">{r.duration}m</span> },
    { key: "questionCount", header: "Q's", sortable: true, render: (r) => <span className="text-xs">{r.questionCount}</span> },
    { key: "status", header: "Status", render: (r) => <StatusChip status={r.status} /> },
    { key: "templateStatus", header: "Template", render: (r) => <StatusChip status={r.templateStatus} /> },
    { key: "id", header: "", width: "40px", render: () => (
      <button className="text-slate-400 hover:text-slate-700">
        <MoreVertical className="w-4 h-4" />
      </button>
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assessments"
        subtitle={`${ASSESSMENTS.length} assessments · Manage templates, scheduling and publishing`}
        actions={
          <>
            <Button variant="secondary"><Send className="w-4 h-4" /> Publish All Drafts</Button>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Assessment</Button>
          </>
        }
      />

      <Card noPadding>
        <DataTable columns={columns} data={ASSESSMENTS} searchable searchPlaceholder="Search assessments…" pageSize={10} />
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Assessment" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Assessment Name</label><input className="input mt-1" placeholder="e.g. FLN Mid-Term 2025-26" /></div>
            <div><label className="label">Academic Year</label><input className="input mt-1" defaultValue="2025-26" /></div>
            <div>
              <label className="label">Type</label>
              <select className="input mt-1">
                <option>Diagnostic</option><option>Formative</option><option>Summative</option><option>Practice</option>
              </select>
            </div>
            <div>
              <label className="label">Subject</label>
              <select className="input mt-1">
                <option>Both</option><option>Literacy</option><option>Numeracy</option>
              </select>
            </div>
            <div>
              <label className="label">Grade</label>
              <select className="input mt-1">
                <option>Class 1</option><option>Class 2</option><option>Class 3</option><option>Class 4</option><option>Class 5</option>
              </select>
            </div>
            <div>
              <label className="label">Language</label>
              <select className="input mt-1">
                <option>English</option><option>Hindi</option><option>Tamil</option><option>Multi</option>
              </select>
            </div>
            <div><label className="label">Total Marks</label><input type="number" className="input mt-1" defaultValue={50} /></div>
            <div><label className="label">Duration (min)</label><input type="number" className="input mt-1" defaultValue={60} /></div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input mt-1 min-h-[60px]" placeholder="Brief description…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={() => { toast.success("Assessment created as draft"); setShowCreate(false); }}>Create as Draft</Button>
          <Button variant="primary" onClick={() => { toast.success("Assessment created"); setShowCreate(false); }}>Create &amp; Generate Template</Button>
        </div>
      </Modal>
    </div>
  );
}