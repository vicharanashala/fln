import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Upload, Plus, RefreshCw, Eye, Wand2, Trash2, FileText, Loader2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import DataTable from "../../components/tables/DataTable";
import StatusChip from "../../components/ui/StatusChip";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import Toolbar from "../../components/ui/Toolbar";
import { Column } from "../../components/tables/DataTable";
import assessmentApi from "../../services/assessmentApi";
import type { Assessment, Question } from "../../types/assessment";
import { SUBJECTS, GRADES, LANGUAGES, ASSESSMENT_STATUS, ASSESSMENT_TEMPLATE_STATUS } from "../../types/assessment";

export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState({ q: "", subject: "", grade: "", templateStatus: "" });
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["assessments", filter],
    queryFn: () => assessmentApi.list(filter).then((r) => r.data.assessments),
  });

  const createMut = useMutation({
    mutationFn: assessmentApi.create,
    onSuccess: (r) => {
      toast.success("Assessment created");
      qc.invalidateQueries({ queryKey: ["assessments"] });
      setShowCreate(false);
      navigate(`/assessment-template-generator/${r.data.assessment._id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: assessmentApi.delete,
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const generateMut = useMutation({
    mutationFn: (id: string) => assessmentApi.generateTemplate(id),
    onSuccess: (r, id) => {
      toast.success(`Template generated — ${r.data.preview?.totalQuestions || 10} questions`);
      qc.invalidateQueries({ queryKey: ["assessments"] });
      navigate(`/assessment-template-generator/${id}/review`, {
        state: { template: r.data.preview, model: r.data.model },
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const columns: Column<Assessment>[] = [
    {
      key: "title", header: "Assessment Name", sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 text-xs">{r.title}</p>
          <p className="text-[10px] text-slate-500">ID: {r._id.slice(-6)}</p>
        </div>
      ),
    },
    { key: "grade", header: "Grade", sortable: true, render: (r) => <Badge tone="blue">{r.grade}</Badge> },
    { key: "subject", header: "Subject", render: (r) => <Badge tone="purple">{r.subject}</Badge> },
    {
      key: "questionPaperUrl", header: "Question Paper",
      render: (r) => r.questionPaperUrl
        ? <a href={r.questionPaperUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1"><FileText className="w-3 h-3" />View PDF</a>
        : <span className="text-slate-400 text-xs">Not uploaded</span>,
    },
    { key: "templateStatus", header: "Template Status", render: (r) => <StatusChip status={r.templateStatus} /> },
    { key: "createdAt", header: "Created", sortable: true, render: (r) => new Date(r.createdAt).toLocaleDateString("en-IN") },
    {
      key: "actions", header: "Actions", width: "280px",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.templateStatus === "Pending" || r.templateStatus === "Generated" || r.templateStatus === "Draft" ? (
            <Button
              variant="primary"
              size="sm"
              loading={generatingId === r._id}
              onClick={() => { setGeneratingId(r._id); generateMut.mutate(r._id); }}
            >
              <Wand2 className="w-3 h-3" /> Generate
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/assessment-template-generator/${r._id}/review`)}
            >
              <Eye className="w-3 h-3" /> View
            </Button>
          )}
          <button
            onClick={() => deleteMut.mutate(r._id)}
            className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Assessment Template Generator</h1>
          <p className="text-xs text-slate-500 mt-0.5">Upload question paper → AI extracts questions → review & approve</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Assessment</Button>
      </div>

      <Card noPadding>
        <DataTable
          columns={columns}
          data={data || []}
          loading={isLoading}
          searchable
          searchPlaceholder="Search assessments…"
          pageSize={15}
          emptyMessage="No assessments found"
        />
      </Card>

      {/* Create Modal */}
      <CreateAssessmentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => createMut.mutate(data)}
        loading={createMut.isPending}
      />
    </div>
  );
}

function CreateAssessmentModal({ open, onClose, onSubmit, loading }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Parameters<typeof assessmentApi.create>[0]) => void;
  loading: boolean;
}) {
  const { register, handleSubmit, watch, reset } = useForm<Record<string, unknown>>({
    defaultValues: {
      title: "",
      subject: "Numeracy",
      grade: "Class 3",
      language: "English",
      academicYear: "2025-26",
      duration: 60,
      totalMarks: 30,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileRef = register("questionPaper") as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const watchFile = watch("questionPaper") as any;

  function submit(data: Record<string, unknown>) {
    onSubmit(data as unknown as Parameters<typeof assessmentApi.create>[0]);
    reset();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Assessment" size="lg">
      <form onSubmit={handleSubmit(submit)} className="space-y-4">
        <Input label="Assessment Title *" {...register("title", { required: true })} placeholder="e.g. Class 3 Mathematics FA1 2025-26" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Subject *" options={SUBJECTS.map((s) => ({ value: s, label: s }))} {...register("subject", { required: true })} />
          <Select label="Grade *" options={GRADES.map((g) => ({ value: g, label: g }))} {...register("grade", { required: true })} />
          <Select label="Language" options={LANGUAGES.map((l) => ({ value: l, label: l }))} {...register("language")} />
          <Input label="Academic Year" {...register("academicYear")} placeholder="2025-26" />
          <Input label="Duration (min)" type="number" {...register("duration", { valueAsNumber: true })} />
          <Input label="Total Marks" type="number" {...register("totalMarks", { valueAsNumber: true })} />
        </div>
        <div>
          <label className="label">Question Paper PDF</label>
          <div className="mt-1 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-blue-400 transition cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" {...fileRef} />
            <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
            <p className="text-xs text-slate-600">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(watchFile as any)?.[0]?.name || "Click or drag to upload PDF"}
            </p>
          </div>
        </div>
      </form>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit(submit)} loading={loading}>
          <Wand2 className="w-4 h-4" /> Create &amp; Generate Template
        </Button>
      </div>
    </Modal>
  );
}