import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  Wand2, CheckCircle2, RotateCcw, ChevronLeft, FileDown,
  Edit3, Check, X, BookOpen, Trophy, Clock, Plus, Trash2,
  KeyRound, AlertCircle, ImageIcon, Sparkles, Loader2, Edit,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import assessmentApi from "../../services/assessmentApi";
import { exportAnswerKeyPdf } from "../../utils/exportAnswerKeyPdf";
import type { Question } from "../../types/assessment";
import { QUESTION_TYPES, DIFFICULTY } from "../../types/assessment";

type WorkflowStep = "upload" | "processing" | "review" | "approved";

const STEPS: { key: WorkflowStep; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "1. Upload PDF", icon: Wand2 },
  { key: "processing", label: "2. AI Processing", icon: Clock },
  { key: "review", label: "3. Review & Edit", icon: Edit3 },
  { key: "approved", label: "4. Approved", icon: CheckCircle2 },
];

const STATUS_STEP: Record<string, WorkflowStep> = {
  Pending: "upload",
  Processing: "processing",
  Generated: "review",
  Draft: "review",
  Approved: "approved",
};

interface EditableQuestion extends Question {
  _edit?: boolean;
  _savedAt?: number;
}

const EVAL_RULES = ["exact", "contains", "tolerance", "range", "subjective", "manual"];

export default function TemplateReviewPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { template?: { questions?: EditableQuestion[] }; model?: string } | null;
  const [questions, setQuestions] = useState<EditableQuestion[]>(locationState?.template?.questions || []);
  const [modelName, setModelName] = useState(locationState?.model || "mock");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: assessment } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => assessmentApi.get(id!).then((r) => r.data.assessment),
    enabled: !!id,
  });

  // Fetch the existing template from DB on mount so users editing
  // an already-created assessment see their saved questions + answers.
  const { data: existingTemplate, isLoading: templateLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: () => assessmentApi.getTemplate(id!).then((r) => r.data.template),
    enabled: !!id,
    staleTime: 0,
  });

  useEffect(() => {
    if (existingTemplate?.questions) {
      setQuestions(existingTemplate.questions as EditableQuestion[]);
      if (existingTemplate.modelName) setModelName(existingTemplate.modelName);
    }
  }, [existingTemplate]);

  const step: WorkflowStep = assessment ? STATUS_STEP[assessment.templateStatus] || "review" : "review";
  const isApproved =
    assessment?.templateStatus === "Approved" ||
    (existingTemplate as any)?.status === "Approved";

  const approveMut = useMutation({
    mutationFn: async (opts?: { questionsOverride?: EditableQuestion[] }) => {
      const toSave = opts?.questionsOverride || questions;
      // First persist all edits as Draft, then approve
      try {
        await assessmentApi.saveTemplate(id!, {
          questions: toSave,
          status: "Draft",
          modelName,
        });
      } catch (e: any) {
        throw new Error(`Save failed: ${e?.response?.data?.message || e.message}`);
      }
      try {
        const approveRes = await assessmentApi.approveTemplate(id!);
        return { savedQuestions: toSave, approvedRes: approveRes };
      } catch (e: any) {
        throw new Error(`Approve failed: ${e?.response?.data?.message || e.message}`);
      }
    },
    onSuccess: (r) => {
      const saved = r.savedQuestions as EditableQuestion[];
      const now = Date.now();
      setQuestions((qs) =>
        qs.map((q, i) => {
          const s = saved[i];
          return s
            ? { ...s, _savedAt: now, _edit: false }
            : { ...q, _savedAt: now, _edit: false };
        })
      );
      setEditingId(null);
      toast.success("Template approved & saved to database ✓");
      setTimeout(() => navigate("/answer-key-generator"), 800);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const generateAgainMut = useMutation({
    mutationFn: () => assessmentApi.generateTemplate(id!),
    onSuccess: (r) => {
      toast.success(`Regenerated — ${r.data.preview?.totalQuestions} questions`);
      setQuestions(r.data.preview?.questions || []);
      setModelName(r.data.model || "mock");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleExportPdf() {
    if (questions.length === 0) {
      toast.error("No questions to export");
      return;
    }
    try {
      await exportAnswerKeyPdf({
        assessmentCode: assessment?.assessmentCode || existingTemplate?.assessmentCode || "AS0000",
        title: assessment?.title || "Untitled Assessment",
        grade: assessment?.grade || "—",
        subject: assessment?.subject || "—",
        setNumber: assessment?.setNumber,
        status: existingTemplate?.status || assessment?.templateStatus || "Draft",
        totalMarks: existingTemplate?.totalMarks || questions.reduce((s, q) => s + (q.marks || 0), 0),
        questions: questions.map((q) => ({
          questionNo: q.questionNo,
          pageNumber: q.pageNumber,
          questionText: q.questionText,
          questionType: q.questionType,
          difficulty: q.difficulty,
          marks: q.marks,
          correctAnswer: q.correctAnswer,
          alternateAnswers: q.alternateAnswers || [],
          evaluationRule: q.evaluationRule,
          images: q.images || [],
        })),
        approvedAt: existingTemplate?.verifiedAt,
      });
      toast.success("Answer key PDF downloaded ✓");
    } catch (e: any) {
      toast.error(`PDF export failed: ${e.message}`);
    }
  }

  const regenerateOneMut = useMutation({
    mutationFn: (questionIndex: number) =>
      assessmentApi.regenerateQuestion(id!, questionIndex),
    onSuccess: (r, questionIndex) => {
      if (r.data?.question) {
        setQuestions((qs) => qs.map((q, i) => (i === questionIndex ? { ...q, ...r.data.question, _edit: true } : q)));
        toast.success("Answer regenerated — review and edit");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch, _edit: true } : q)));
  }

  function deleteQuestion(idx: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNo: i + 1 })));
  }

  function addAlternate(idx: number, value: string) {
    if (!value.trim()) return;
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === idx ? { ...q, alternateAnswers: [...(q.alternateAnswers || []), value.trim()], _edit: true } : q
      )
    );
  }

  function removeAlternate(idx: number, altIdx: number) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === idx
          ? { ...q, alternateAnswers: q.alternateAnswers.filter((_, j) => j !== altIdx), _edit: true }
          : q
      )
    );
  }

  const totalMarks = questions.reduce((a, q) => a + (q.marks || 0), 0);
  const answeredCount = questions.filter((q) => q.correctAnswer && q.correctAnswer.trim()).length;
  const pendingAnswers = questions.length - answeredCount;

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <Card>
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex((x) => x.key === step);
            const done = i < idx;
            const current = i === idx;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold transition-all ${
                      done
                        ? "bg-green-500 text-white"
                        : current
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <p className={`text-[10px] mt-1.5 font-medium ${current ? "text-blue-600" : "text-slate-500"}`}>
                    {s.label}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < idx ? "bg-green-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Assessment Info */}
      {assessment && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Assessment", value: assessment.title },
            { label: "Grade / Subject", value: `${assessment.grade} · ${assessment.subject}` },
            { label: "Paper Type", value: assessment.assessmentType },
            { label: "AI Model", value: modelName },
          ].map((item) => (
            <div key={item.label} className="card p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Answer Key Summary Banner */}
      {questions.length > 0 && (
        <div
          className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
            pendingAnswers === 0
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg grid place-items-center ${
                pendingAnswers === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Answer Key: {answeredCount} of {questions.length} answered
              </p>
              <p className="text-xs text-slate-600">
                {pendingAnswers === 0
                  ? "All questions have answers. You can save & approve."
                  : `${pendingAnswers} question${pendingAnswers > 1 ? "s" : ""} need an answer before approval.`}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            loading={approveMut.isPending}
            disabled={questions.length === 0}
            onClick={() => approveMut.mutate()}
          >
            <CheckCircle2 className="w-4 h-4" /> Approve Template
          </Button>
        </div>
      )}

      {/* Questions */}
      <Card
        title={`Questions & Answer Key (${questions.length})`}
        subtitle="Click the pencil icon to edit a question, its answer, and accepted alternates"
      >
        {templateLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-6 h-6 mx-auto text-blue-500 animate-spin" />
            <p className="text-sm text-slate-500 mt-2">Loading saved template from database…</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No questions yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click "Generate Again" to re-run AI extraction on the uploaded PDF.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionCard
                key={`${q.questionNo}-${idx}`}
                q={q}
                idx={idx}
                isEditing={editingId === idx}
                onToggleEdit={() => {
                  if (editingId === idx) {
                    // Exiting edit mode → just commit edits to local state.
                    // DB save only happens when "Approve Template" is clicked.
                    setQuestions((qs) =>
                      qs.map((q, i) => (i === idx ? { ...q, _edit: false } : q))
                    );
                  }
                  setEditingId(editingId === idx ? null : idx);
                }}
                onUpdate={(patch) => updateQuestion(idx, patch)}
                onDelete={() => deleteQuestion(idx)}
                onAddAlternate={(val) => addAlternate(idx, val)}
                onRemoveAlternate={(altIdx) => removeAlternate(idx, altIdx)}
                onRegenerate={() => regenerateOneMut.mutate(idx)}
                regenerating={regenerateOneMut.isPending && regenerateOneMut.variables === idx}
                saving={approveMut.isPending && editingId === idx}
                justSaved={!!q._savedAt && Date.now() - (q._savedAt as number) < 4000}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
            <p className="text-xs text-blue-700">Questions</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{answeredCount}</p>
            <p className="text-xs text-green-700">Answered</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{totalMarks}</p>
            <p className="text-xs text-purple-700">Total Marks</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">
              {questions.filter((q) => q.difficulty === "Easy").length}
            </p>
            <p className="text-xs text-orange-700">
              Easy · {questions.filter((q) => q.difficulty === "Hard").length} Hard
            </p>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate("/answer-key-generator")}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            loading={generateAgainMut.isPending}
            onClick={() => generateAgainMut.mutate()}
          >
            <RotateCcw className="w-4 h-4" /> Generate Again
          </Button>
          {isApproved && (
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={questions.length === 0}
              title="Download printable PDF of the approved answer key"
            >
              <FileDown className="w-4 h-4" /> Save as PDF
            </Button>
          )}
          <Button
            variant="primary"
            loading={approveMut.isPending}
            onClick={() => approveMut.mutate()}
          >
            <CheckCircle2 className="w-4 h-4" /> Approve Template
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  idx,
  isEditing,
  onToggleEdit,
  onUpdate,
  onDelete,
  onAddAlternate,
  onRemoveAlternate,
  onRegenerate,
  regenerating,
  saving,
  justSaved,
}: {
  q: EditableQuestion;
  idx: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onAddAlternate: (val: string) => void;
  onRemoveAlternate: (altIdx: number) => void;
  onRegenerate: () => void;
  regenerating?: boolean;
  saving?: boolean;
  justSaved?: boolean;
}) {
  const [altInput, setAltInput] = useState("");
  const hasAnswer = q.correctAnswer && q.correctAnswer.trim().length > 0;
  const isManual = q.evaluationRule === "manual";

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        q._edit ? "border-blue-300 bg-blue-50/30" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white grid place-items-center text-xs font-bold">
            {q.questionNo}
          </div>
          <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "orange"}>
            {q.difficulty}
          </Badge>
          <Badge tone="purple">{q.questionType}</Badge>
          <Badge tone="slate">{q.marks} marks</Badge>
          {saving && <Badge tone="amber" withDot><Loader2 className="w-2.5 h-2.5 animate-spin mr-0.5" />Saving…</Badge>}
          {!saving && justSaved && (
            <Badge tone="green" withDot>
              <Check className="w-2.5 h-2.5 mr-0.5" />
              Approved &amp; Saved to DB
            </Badge>
          )}
          {q._edit && !justSaved && !saving && <Badge tone="amber" withDot>Edited — pending approval</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition disabled:opacity-50"
            title="Re-ask AI for a better answer"
          >
            {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleEdit}
            disabled={saving}
            className={`p-1.5 rounded-md transition disabled:opacity-50 ${
              isEditing ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            }`}
            title={isEditing ? "Done editing" : "Edit question + answer"}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
            title="Delete question"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="label">Question text</label>
            <textarea
              value={q.questionText}
              onChange={(e) => onUpdate({ questionText: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              rows={2}
              placeholder="Question text…"
            />
          </div>

          {(q.images?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {q.images!.map((img, i) => (
                <img
                  key={i}
                  src={img.imageUrl}
                  alt=""
                  className="w-full h-28 object-contain bg-slate-50 rounded-lg border border-slate-200"
                />
              ))}
            </div>
          )}

          <Input
            label="Visual description (if question references an image)"
            value={q.visualDescription || ""}
            onChange={(e) => onUpdate({ visualDescription: e.target.value })}
            placeholder="e.g. Picture of 5 stars to count"
          />

          <div className="grid grid-cols-4 gap-2">
            <Select
              label="Type"
              options={QUESTION_TYPES.map((t) => ({ value: t, label: t }))}
              value={q.questionType}
              onChange={(e) => onUpdate({ questionType: e.target.value })}
            />
            <Select
              label="Difficulty"
              options={DIFFICULTY.map((d) => ({ value: d, label: d }))}
              value={q.difficulty}
              onChange={(e) => onUpdate({ difficulty: e.target.value })}
            />
            <Input
              label="Marks"
              type="number"
              value={String(q.marks)}
              onChange={(e) => onUpdate({ marks: parseInt(e.target.value) || 1 })}
            />
            <Input label="Concept" value={q.concept} onChange={(e) => onUpdate({ concept: e.target.value })} />
          </div>

          {/* Answer Key editing */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <KeyRound className="w-3.5 h-3.5" /> Answer Key
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input
                  label="Correct Answer"
                  value={q.correctAnswer}
                  onChange={(e) => {
                    const val = e.target.value;
                    // If a real answer is being typed and rule is "manual",
                    // auto-switch to "exact" so the answer shows up.
                    if (val.trim() && q.evaluationRule === "manual") {
                      onUpdate({ correctAnswer: val, evaluationRule: "exact" });
                    } else {
                      onUpdate({ correctAnswer: val });
                    }
                  }}
                  placeholder={isManual ? "N/A — manual grading" : "AI-generated answer (editable)"}
                />
              </div>
              <Select
                label="Evaluation Rule"
                options={EVAL_RULES.map((r) => ({ value: r, label: r }))}
                value={q.evaluationRule}
                onChange={(e) => onUpdate({ evaluationRule: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Alternate Answers (also accepted)</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(q.alternateAnswers || []).map((alt, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-amber-200 text-xs text-slate-700"
                  >
                    {alt}
                    <button
                      onClick={() => onRemoveAlternate(i)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={altInput}
                    onChange={(e) => setAltInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddAlternate(altInput);
                        setAltInput("");
                      }
                    }}
                    placeholder="Add alternate…"
                    className="px-2 py-1 text-xs border border-amber-200 rounded-md outline-none focus:ring-1 focus:ring-amber-400 w-32"
                  />
                  <button
                    onClick={() => {
                      onAddAlternate(altInput);
                      setAltInput("");
                    }}
                    className="p-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-slate-900">{q.questionText || "—"}</p>

          {/* Images from PDF page */}
          {(q.images?.length ?? 0) > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                  Question Image{q.images!.length > 1 ? "s" : ""} ({q.images!.length})
                </span>
                {(q as any).croppedFromPage && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                    ✂️ Cropped from PDF page {(q as any).croppedFromPage}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {q.images!.map((img, i) => (
                  <a
                    key={i}
                    href={img.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-slate-50 rounded-lg border border-slate-200 overflow-hidden hover:border-blue-400 transition group"
                  >
                    <img
                      src={img.imageUrl}
                      alt={`Question ${q.questionNo} image ${i + 1}`}
                      className="w-full h-40 object-contain bg-white group-hover:scale-105 transition"
                    />
                    <p className="text-[10px] text-slate-500 p-1.5 text-center truncate">
                      {q.visualDescription || `Image ${i + 1}`}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {q.visualDescription && (q.images?.length ?? 0) === 0 && (
            <div className="mt-2 flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <ImageIcon className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900">
                <span className="font-semibold">Image expected:</span> {q.visualDescription}
              </div>
            </div>
          )}

          {/* Answer Key display */}
          <div
            className={`mt-3 rounded-lg border p-3 ${
              isManual
                ? "bg-slate-50 border-slate-200"
                : hasAnswer
                ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              <Trophy className="w-3 h-3" />
              <span
                className={
                  isManual ? "text-slate-600" : hasAnswer ? "text-green-700" : "text-red-600"
                }
              >
                Answer Key
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 normal-case font-normal">{q.evaluationRule}</span>
            </div>

            {isManual && !hasAnswer ? (
              <p className="text-sm text-slate-500 italic">Manual grading — no auto answer key</p>
            ) : hasAnswer ? (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {q.correctAnswer}
                </p>
                {(q.alternateAnswers || []).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-500">Also accepted:</span>
                    {q.alternateAnswers.map((alt, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-white border border-green-200 text-[10px] text-slate-600"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-red-600 italic flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> No answer yet — click edit to add one
              </p>
            )}
          </div>

          {q.concept && (
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-3">
              <span>
                <BookOpen className="w-3 h-3 inline" /> {q.concept}
              </span>
              <span>· Page {q.pageNumber}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}