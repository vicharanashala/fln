import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  Upload, Wand2, FileText, Sparkles, Loader2, X, FileImage,
  FileCheck2, ChevronRight, Clock, Edit, FileDown, Search,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatusChip from "../../components/ui/StatusChip";
import assessmentApi from "../../services/assessmentApi";
import type { AssessmentTemplate } from "../../types";
import { exportAnswerKeyPdf } from "../../utils/exportAnswerKeyPdf";
import type { CreateAssessmentDTO } from "../../services/assessmentApi";
import type { Assessment } from "../../types";
import {
  ASSESSMENT_TYPES,
  SUBJECTS,
  GRADES,
  LANGUAGES,
} from "../../types";

type Phase = "idle" | "uploading" | "extracting" | "ready";

interface AssessmentsListPageProps {
  onNavigateToReview?: (id: string) => void;
}

export default function AssessmentsListPage({ onNavigateToReview }: AssessmentsListPageProps = {}) {
  const navigate = useNavigate();
  const goToReview = (id: string) => {
    if (onNavigateToReview) {
      onNavigateToReview(id);
    } else {
      navigate(`/answer-key-generator/${id}/review`);
    }
  };
  const [showCreate, setShowCreate] = useState(false);
  const showCreateRef = useRef(showCreate);
  showCreateRef.current = showCreate;

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  // Load existing assessments to show as recent templates
  const { data: assessments, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: () => assessmentApi.list().then((r) => r.data.assessments),
    refetchOnWindowFocus: false,
  });

  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssessments = assessments
    ? assessments.filter((a: Assessment) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        const code = (a.assessmentCode || "").toLowerCase();
        const title = (a.title || "").toLowerCase();
        const grade = (a.grade || "").toLowerCase();
        const setNum = (a.setNumber || "").toLowerCase();
        const subject = (a.subject || "").toLowerCase();

        return (
          code.includes(query) ||
          title.includes(query) ||
          grade.includes(query) ||
          setNum.includes(query) ||
          subject.includes(query)
        );
      })
    : [];

  const fullMut = useMutation({
    mutationFn: async ({ data, files }: { data: CreateAssessmentDTO; files: File[] }) => {
      setPhase("uploading");
      setProgress(15);
      const createRes = await assessmentApi.createWithFiles(data, files);
      const assessmentId = createRes.data.assessment._id!;
      setProgress(45);

      setPhase("extracting");
      const genRes = await assessmentApi.generateTemplate(assessmentId);
      setProgress(100);
      setPhase("ready");

      return { assessmentId, preview: genRes.data.preview, model: genRes.data.model };
    },
    onSuccess: (data) => {
      if (!showCreateRef.current) return;
      toast.success("Uploaded & extracted — review the questions");
      setShowCreate(false);
      goToReview(data.assessmentId);
    },
    onError: (e: any) => {
      if (!showCreateRef.current) return;
      const errorMsg = e.response?.data?.message || e.message || "Something went wrong";
      toast.error(errorMsg, { duration: 8000 });
      setPhase("idle");
      setProgress(0);
    },
  });

  async function handleDownloadPdf(a: Assessment) {
    const tpl = a.templateId && typeof a.templateId === "object" ? (a.templateId as any) : null;
    if (!tpl) {
      toast.error("No template data available");
      return;
    }
    setPdfLoadingId(a._id || null);
    try {
      // Always fetch the full template to get the questions array
      const res = await assessmentApi.getTemplate(a._id!);
      const fullTpl: AssessmentTemplate = res.data.template;
      await exportAnswerKeyPdf({
        assessmentCode: a.assessmentCode || fullTpl.assessmentCode || "AS0000",
        title: a.title ?? a.name ?? '',
        grade: a.grade || "—",
        subject: a.subject || "—",
        setNumber: a.setNumber,
        status: fullTpl.status || "Approved",
        totalMarks: fullTpl.totalMarks || 0,
        questions: (fullTpl.questions || []).map((q) => ({
          questionNo: q.questionNo || 0,
          pageNumber: q.pageNumber,
          questionText: q.questionText || "",
          questionType: q.questionType || "",
          difficulty: q.difficulty || "",
          marks: q.marks || 0,
          correctAnswer: q.correctAnswer || "",
          alternateAnswers: q.alternateAnswers || [],
          evaluationRule: q.evaluationRule || "",
          images: q.images || [],
        })),
        approvedAt: fullTpl.verifiedAt || undefined,
      });
      toast.success("Answer key PDF downloaded ✓");
    } catch (err: any) {
      toast.error(`PDF export failed: ${err.message || "Unknown error"}`);
    } finally {
      setPdfLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Answer Key Generator</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload a question paper PDF → AI extracts questions → review &amp; approve the template.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Wand2 className="w-4 h-4" /> New Answer Key
        </Button>
      </div>

      {/* Assessments & Answer Keys */}
      {!isLoading && assessments && assessments.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex-1">
              <Input
                placeholder="Search assessments by class, set, assessment code, subject, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>
          </div>

          <Card
            title="Assessments & Answer Keys"
            subtitle={
              searchQuery
                ? `Showing ${filteredAssessments.length} of ${assessments.length} matching assessments`
                : `${assessments.length} saved in the database — IDs match student_id + assessment_id for evaluation`
            }
          >
            {filteredAssessments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">No assessments found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -m-5">
                {filteredAssessments.map((a: Assessment) => {
                  const tpl = a.templateId && typeof a.templateId === "object" ? a.templateId : null;
                  return (
                    <div
                      key={a._id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition"
                    >
                      <div className="px-3 py-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white font-mono font-bold text-sm flex-shrink-0">
                        {a.assessmentCode || "AS????"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <Badge tone="blue">{a.grade}</Badge>
                          {a.setNumber && <Badge tone="purple">{a.setNumber}</Badge>}
                          <Badge tone="slate">{a.subject}</Badge>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusChip status={a.templateStatus} />
                        {tpl && (
                          <span className="text-xs text-slate-600 hidden sm:inline">
                            {tpl.totalQuestions ?? 0}Q · {tpl.totalMarks ?? 0}M
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => goToReview(a._id!)}
                        >
                          <Edit className="w-3 h-3" /> Edit
                        </Button>
                        {a.templateStatus === "Approved" && tpl && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Download printable PDF of the approved answer key"
                            loading={pdfLoadingId === a._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(a);
                            }}
                          >
                            <FileDown className="w-3 h-3" /> Save as PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Empty-state CTA — shown when no assessments exist */}
      {!isLoading && (!assessments || assessments.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Generate a new answer key</h2>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
              Enter class details, choose a paper type, and upload your question paper PDF. The AI
              will extract every question + generate the answer key for you to review and approve.
            </p>

            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
            >
              <Wand2 className="w-4 h-4" />
              Generate Answer Key
            </button>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-blue-900">1 · Enter details</p>
                <p className="text-[11px] text-blue-700 mt-1">Class, subject, paper type, marks</p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-purple-900">2 · Upload PDF</p>
                <p className="text-[11px] text-purple-700 mt-1">We send it to AI for analysis</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-left">
                <p className="text-xs font-semibold text-green-900">3 · Review &amp; approve</p>
                <p className="text-[11px] text-green-700 mt-1">Edit questions, then save</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateAssessmentModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setPhase("idle");
          setProgress(0);
          fullMut.reset();
        }}
        loading={fullMut.isPending}
        phase={phase}
        progress={progress}
        onSubmit={(data, files) => fullMut.mutate({ data, files })}
      />
    </div>
  );
}

function CreateAssessmentModal({
  open,
  onClose,
  loading,
  phase,
  progress,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  phase: Phase;
  progress: number;
  onSubmit: (data: CreateAssessmentDTO, files: File[]) => void;
}) {
  const { register, handleSubmit, reset } = useForm<Record<string, unknown>>({
    defaultValues: {
      title: "",
      assessmentType: "Diagnostic",
      subject: "Numeracy",
      grade: "Class 3",
      setNumber: "Set 1",
      language: "English",
      academicYear: "2025-26",
      duration: 30,
    },
  });
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png|webp|gif)$/));
    if (arr.length === 0) {
      toast.error("Only PDF / JPG / PNG files allowed");
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  function submit(data: Record<string, unknown>) {
    if (files.length === 0) {
      toast.error("Please upload at least one file");
      return;
    }
    onSubmit(data as unknown as CreateAssessmentDTO, files);
    reset();
    setFiles([]);
  }

  const busy = loading || phase !== "idle";

  return (
    <Modal open={open} onClose={onClose} title="Create Assessment + Template" size="lg">
      {phase !== "idle" ? (
        <ProcessingState phase={phase} progress={progress} />
      ) : (
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <p className="text-xs text-slate-500 -mt-1">FLN supports Class 1 to 4 (Foundational Literacy &amp; Numeracy)</p>
          <Input
            label="Assessment Title *"
            {...register("title", { required: true })}
            placeholder="e.g. Class 3 Mathematics FA1 2025-26"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Paper Type *"
              options={ASSESSMENT_TYPES.map((t) => ({ value: t, label: t }))}
              {...register("assessmentType", { required: true })}
            />
            <Select
              label="Subject *"
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              {...register("subject", { required: true })}
            />
            <Select
              label="Class *"
              options={GRADES.map((g) => ({ value: g, label: g }))}
              {...register("grade", { required: true })}
            />
            <Input
              label="Set Number *"
              {...register("setNumber", { required: true })}
              placeholder="e.g. Set A, Set 1, Version 2"
            />
            <Select
              label="Language"
              options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              {...register("language")}
            />
            <Input label="Academic Year" {...register("academicYear")} placeholder="2025-26" />
            <Input
              label="Duration (min)"
              type="number"
              {...register("duration", { valueAsNumber: true })}
            />
          </div>

          <div>
            <label className="label">
              Question Paper(s) * <span className="text-slate-400 font-normal">(PDF or images)</span>
            </label>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 border-2 border-dashed border-slate-200 hover:border-blue-400 transition rounded-xl p-5 text-center cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-sm text-slate-700 font-medium">Click or drag to upload</p>
              <p className="text-xs text-slate-500 mt-0.5">
                PDF (full paper) · OR multiple JPG/PNG images (one question per image)
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto">
                {files.map((f, i) => {
                  const isImage = f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(f.name);
                  const Icon = isImage ? FileImage : FileText;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isImage ? "text-blue-600" : "text-slate-500"}`} />
                        <p className="text-xs text-slate-700 truncate">{f.name}</p>
                        <span className="text-[10px] text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <X className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <Wand2 className="w-4 h-4" />
              Generate Answer Key
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ProcessingState({ phase, progress }: { phase: Phase; progress: number }) {
  const steps = [
    { key: "uploading", label: "Uploading PDF", icon: Upload },
    { key: "extracting", label: "AI extracting questions", icon: Sparkles },
    { key: "ready", label: "Loading review", icon: Loader2 },
  ];
  const currentIndex = steps.findIndex((s) => s.key === phase);

  return (
    <div className="space-y-5 py-2">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 text-blue-600 grid place-items-center mb-3">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-900">
          {phase === "uploading" && "Uploading PDF…"}
          {phase === "extracting" && "AI is extracting questions…"}
          {phase === "ready" && "Opening review…"}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {phase === "uploading" && "Saving question paper to server"}
          {phase === "extracting" && "AI is analyzing the question paper"}
          {phase === "ready" && "Almost there"}
        </p>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className={`text-center p-2.5 rounded-lg border ${
                done
                  ? "bg-green-50 border-green-200"
                  : current
                  ? "bg-blue-50 border-blue-200"
                  : "bg-slate-50 border-slate-100"
              }`}
            >
              <Icon
                className={`w-4 h-4 mx-auto mb-1 ${
                  done ? "text-green-600" : current ? "text-blue-600 animate-pulse" : "text-slate-300"
                }`}
              />
              <p
                className={`text-[10px] font-medium ${
                  done ? "text-green-700" : current ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}