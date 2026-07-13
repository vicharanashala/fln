import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  Wand2, CheckCircle2, Save, RotateCcw, ChevronLeft, ChevronRight,
  Plus, Trash2, Edit3, Check, X, BookOpen, Trophy, Clock, AlertCircle,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import assessmentApi from "../../services/assessmentApi";
import type { Assessment, AssessmentTemplate, Question } from "../../types/assessment";
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
}

export default function TemplateReviewPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    (location.state as any)?.template?.questions || []
  );
  const [modelName, setModelName] = useState((location.state as any)?.model || "mock");
  const [processingTime, setProcessingTime] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: assessment } = useQuery({
    queryKey: ["assessment", id],
    queryFn: () => assessmentApi.get(id!).then((r) => r.data.assessment),
    enabled: !!id,
  });

  const step: WorkflowStep = assessment ? STATUS_STEP[assessment.templateStatus] || "review" : "review";

  const saveMut = useMutation({
    mutationFn: () => assessmentApi.saveTemplate(id!, {
      questions,
      status: "Draft",
      modelName,
    }),
    onSuccess: (r) => {
      toast.success("Draft saved");
      setQuestions(r.data.template.questions);
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => assessmentApi.approveTemplate(id!),
    onSuccess: () => {
      toast.success("Template approved!");
      navigate("/assessment-template-generator");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateAgainMut = useMutation({
    mutationFn: () => assessmentApi.generateTemplate(id!),
    onSuccess: (r) => {
      toast.success(`Regenerated — ${r.data.preview?.totalQuestions} questions`);
      setQuestions(r.data.preview?.questions || []);
      setModelName(r.data.model || "mock");
      setProcessingTime(r.data.processingTime || 0);
    },
    onError: (e) => toast.error(e.message),
  });

  function updateQuestion(idx: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch, _edit: true } : q)));
  }

  function deleteQuestion(idx: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  }

  const totalMarks = questions.reduce((a, q) => a + (q.marks || 0), 0);

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
                  <div className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold transition-all ${
                    done ? "bg-green-500 text-white" : current ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <p className={`text-[10px] mt-1.5 font-medium ${current ? "text-blue-600" : "text-slate-500"}`}>{s.label}</p>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < idx ? "bg-green-500" : "bg-slate-200"}`} />}
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
            { label: "AI Model", value: modelName },
            { label: "Total Questions", value: String(questions.length) },
          ].map((item) => (
            <div key={item.label} className="card p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Questions */}
      <Card title={`Questions (${questions.length})`} subtitle="Click any field to edit inline before approving">
        {questions.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No questions yet. Click "Generate Again" to re-run AI extraction.
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionCard
                key={q.questionNo}
                q={q}
                idx={idx}
                isEditing={editingId === idx}
                onToggleEdit={() => setEditingId(editingId === idx ? null : idx)}
                onUpdate={(patch) => updateQuestion(idx, patch)}
                onDelete={() => deleteQuestion(idx)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{questions.length}</p>
            <p className="text-xs text-blue-700">Questions</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{totalMarks}</p>
            <p className="text-xs text-green-700">Total Marks</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">{questions.filter((q) => q.difficulty === "Easy").length}</p>
            <p className="text-xs text-purple-700">Easy / {questions.filter((q) => q.difficulty === "Hard").length} Hard</p>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate("/assessment-template-generator")}>
          <ChevronLeft className="w-4 h-4" /> Back to List
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            loading={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button
            variant="outline"
            loading={generateAgainMut.isPending}
            onClick={() => generateAgainMut.mutate()}
          >
            <RotateCcw className="w-4 h-4" /> Generate Again
          </Button>
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

function QuestionCard({ q, idx, isEditing, onToggleEdit, onUpdate, onDelete }: {
  q: EditableQuestion;
  idx: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: (patch: Partial<Question>) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`border rounded-xl p-4 transition-all ${q._edit ? "border-blue-300 bg-blue-50/30" : "border-slate-200 hover:border-slate-300"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white grid place-items-center text-xs font-bold">
            {q.questionNo}
          </div>
          <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Hard" ? "red" : "orange"}>{q.difficulty}</Badge>
          <Badge tone="purple">{q.questionType}</Badge>
          <Badge tone="slate">{q.marks} marks</Badge>
          {q._edit && <Badge tone="blue" withDot>Edited</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleEdit} className={`p-1.5 rounded-md transition ${isEditing ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}>
            {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2.5">
          <textarea
            value={q.questionText}
            onChange={(e) => onUpdate({ questionText: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            rows={2}
            placeholder="Question text…"
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
            <Input
              label="Concept"
              value={q.concept}
              onChange={(e) => onUpdate({ concept: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Correct Answer"
              value={q.correctAnswer}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
            />
            <Input
              label="Evaluation Rule"
              value={q.evaluationRule}
              onChange={(e) => onUpdate({ evaluationRule: e.target.value })}
              hint="exact | contains | tolerance | range | subjective"
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-slate-900">{q.questionText || "—"}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            {q.concept && <span><BookOpen className="w-3 h-3 inline" /> {q.concept}</span>}
            {q.correctAnswer && <span><Trophy className="w-3 h-3 inline" /> Answer: {q.correctAnswer}</span>}
            <span>Page {q.pageNumber}</span>
          </div>
        </div>
      )}
    </div>
  );
}