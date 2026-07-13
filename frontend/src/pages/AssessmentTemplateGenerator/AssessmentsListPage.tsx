import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Upload, Wand2, FileText, Sparkles, Loader2, X, FileImage } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import assessmentApi from "../../services/assessmentApi";
import type { CreateAssessmentDTO } from "../../services/assessmentApi";
import {
  ASSESSMENT_TYPES,
  SUBJECTS,
  GRADES,
  LANGUAGES,
} from "../../types/assessment";

type Phase = "idle" | "uploading" | "extracting" | "ready";

export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const fullMut = useMutation({
    mutationFn: async ({ data, files }: { data: CreateAssessmentDTO; files: File[] }) => {
      setPhase("uploading");
      setProgress(15);
      const createRes = await assessmentApi.createWithFiles(data, files);
      const assessmentId = createRes.data.assessment._id;
      setProgress(45);

      setPhase("extracting");
      const genRes = await assessmentApi.generateTemplate(assessmentId);
      setProgress(100);
      setPhase("ready");

      return { assessmentId, preview: genRes.data.preview, model: genRes.data.model };
    },
    onSuccess: (data) => {
      toast.success("Uploaded & extracted — review the questions");
      setShowCreate(false);
      navigate(`/assessment-template-generator/${data.assessmentId}/review`, {
        state: { template: data.preview, model: data.model },
      });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Something went wrong");
      setPhase("idle");
      setProgress(0);
    },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Assessment Template Generator</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload a question paper PDF → AI extracts questions → review &amp; approve the template.
        </p>
      </div>

      {/* Empty-state CTA — single button, no list of past assessments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Start a new assessment template</h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
            Enter class details, choose a paper type, and upload your question paper PDF. The AI
            will extract every question for you to review and approve.
          </p>

          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            <Wand2 className="w-4 h-4" />
            Create Assessment + Template
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

      {/* Create Modal */}
      <CreateAssessmentModal
        open={showCreate}
        onClose={() => phase === "idle" && setShowCreate(false)}
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
      language: "English",
      academicYear: "2025-26",
      duration: 60,
      totalMarks: 30,
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
              label="Class / Grade *"
              options={GRADES.map((g) => ({ value: g, label: g }))}
              {...register("grade", { required: true })}
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
            <Input
              label="Total Marks"
              type="number"
              {...register("totalMarks", { valueAsNumber: true })}
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
              Generate Template
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
          {phase === "extracting" && "Sending to Gemini Vision for analysis"}
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