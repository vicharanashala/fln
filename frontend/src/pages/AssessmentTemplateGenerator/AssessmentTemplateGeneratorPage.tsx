import { useState } from "react";
import { Upload, FileText, Sparkles, CheckCircle2, AlertCircle, Loader2, Edit3, Save, Download, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";

type Phase = "upload" | "processing" | "review" | "saved";

interface DetectedQuestion {
  id: string;
  number: number;
  text: string;
  type: string;
  marks: number;
  difficulty: string;
  concept: string;
  correctAnswer: string;
  pageNumber: number;
  status: "Detected" | "Edited" | "Approved";
}

const STAGES = [
  { key: "ocr", label: "OCR", icon: FileText },
  { key: "image", label: "Image Analysis", icon: Sparkles },
  { key: "detect", label: "Question Detection", icon: CheckCircle2 },
  { key: "answer", label: "Suggested Answer Key", icon: Sparkles },
  { key: "preview", label: "Template Preview", icon: FileText },
];

const SAMPLE_QUESTIONS: DetectedQuestion[] = [
  { id: "q1", number: 1, text: "Read the passage and answer the questions that follow.", type: "Short Answer", marks: 2, difficulty: "Easy", concept: "Reading Comprehension", correctAnswer: "Comprehension", pageNumber: 1, status: "Detected" },
  { id: "q2", number: 2, text: "Identify the noun in the sentence: 'The cat sat on the mat.'", type: "MCQ", marks: 1, difficulty: "Easy", concept: "Grammar", correctAnswer: "cat, mat", pageNumber: 1, status: "Detected" },
  { id: "q3", number: 3, text: "Write 5 words that begin with the letter 'B'.", type: "Short Answer", marks: 5, difficulty: "Medium", concept: "Vocabulary", correctAnswer: "ball, book, bag, boy, bed", pageNumber: 2, status: "Detected" },
  { id: "q4", number: 4, text: "Solve: 45 + 27 = ?", type: "Fill in the Blanks", marks: 1, difficulty: "Easy", concept: "Addition", correctAnswer: "72", pageNumber: 2, status: "Detected" },
  { id: "q5", number: 5, text: "Match the following animals with their sounds.", type: "Match the Following", marks: 4, difficulty: "Easy", concept: "General Knowledge", correctAnswer: "Dog-Bark, Cat-Meow", pageNumber: 3, status: "Detected" },
  { id: "q6", number: 6, text: "Draw a picture of your family and write 3 sentences about them.", type: "Drawing", marks: 5, difficulty: "Hard", concept: "Creative Expression", correctAnswer: "Subjective", pageNumber: 3, status: "Detected" },
  { id: "q7", number: 7, text: "What is the next number in the series: 2, 4, 8, 16, ?", type: "MCQ", marks: 1, difficulty: "Medium", concept: "Number Patterns", correctAnswer: "32", pageNumber: 4, status: "Detected" },
  { id: "q8", number: 8, text: "Trace the dotted line to complete the letter 'A'.", type: "Trace", marks: 2, difficulty: "Easy", concept: "Motor Skills", correctAnswer: "N/A", pageNumber: 4, status: "Detected" },
];

export default function AssessmentTemplateGeneratorPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [questions, setQuestions] = useState<DetectedQuestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function startProcessing() {
    setPhase("processing");
    setProgress(0);
    setCurrentStage(0);
    let p = 0;
    let stage = 0;
    const id = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(id);
        setTimeout(() => {
          setQuestions(SAMPLE_QUESTIONS);
          setPhase("review");
          toast.success(`Detected ${SAMPLE_QUESTIONS.length} questions`);
        }, 400);
      }
      setProgress(Math.min(100, p));
      setCurrentStage(Math.min(STAGES.length - 1, Math.floor((p / 100) * STAGES.length)));
    }, 200);
  }

  function updateQuestion(id: string, patch: Partial<DetectedQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch, status: "Edited" } : q)));
  }

  function approveAll() {
    setQuestions((qs) => qs.map((q) => ({ ...q, status: "Approved" })));
    setPhase("saved");
    toast.success("Template saved and approved");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Assessment Template Generator"
        subtitle="Upload a question paper PDF → AI extracts questions → review & approve"
      />

      {/* Workflow pipeline */}
      <Card>
        <div className="flex items-center justify-between">
          {[
            { key: "upload", label: "1. Upload PDF" },
            { key: "processing", label: "2. AI Processing" },
            { key: "review", label: "3. Review & Edit" },
            { key: "saved", label: "4. Approve" },
          ].map((s, i, arr) => {
            const idx = arr.findIndex((x) => x.key === phase);
            const isDone = i < idx;
            const isCurrent = i === idx;
            return (
              <div key={s.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold transition ${
                    isDone ? "bg-green-500 text-white" : isCurrent ? "bg-blue-600 text-white ring-4 ring-blue-100" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <p className={`text-[10px] mt-1.5 font-medium ${isCurrent ? "text-blue-600" : "text-slate-500"}`}>{s.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < idx ? "bg-green-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Phase: Upload */}
      {phase === "upload" && (
        <Card>
          <div
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 transition rounded-xl p-12 text-center cursor-pointer"
            onClick={startProcessing}
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Upload Question Paper PDF</h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
              Drag and drop your question paper PDF here, or click to browse. Supports PDF up to 50MB.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Badge tone="blue">PDF</Badge>
              <Badge tone="green">Auto OCR</Badge>
              <Badge tone="purple">AI Vision</Badge>
              <Badge tone="orange">Question Detection</Badge>
            </div>
            <Button className="mt-5" onClick={(e) => { e.stopPropagation(); startProcessing(); }}>
              <Upload className="w-4 h-4" /> Choose File
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-900">💡 Pro tip</p>
              <p className="text-[11px] text-blue-700 mt-1">Use scanned PDFs at 300+ DPI for best OCR accuracy.</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-900">⚡ Fast extraction</p>
              <p className="text-[11px] text-green-700 mt-1">Most PDFs are processed in under 30 seconds.</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-purple-900">✏️ Fully editable</p>
              <p className="text-[11px] text-purple-700 mt-1">All detected fields can be edited before saving.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Phase: Processing */}
      {phase === "processing" && (
        <Card>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">Processing your question paper…</p>
                <p className="text-xs text-slate-500">Currently: {STAGES[currentStage]?.label || "Finalizing"}</p>
              </div>
              <span className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</span>
            </div>

            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {STAGES.map((s, i) => {
                const done = i < currentStage;
                const current = i === currentStage;
                const Icon = s.icon;
                return (
                  <div key={s.key} className={`text-center p-3 rounded-lg border ${
                    done ? "bg-green-50 border-green-200" : current ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-100"
                  }`}>
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${done ? "text-green-600" : current ? "text-blue-600 animate-pulse" : "text-slate-300"}`} />
                    <p className={`text-[10px] font-medium ${done ? "text-green-700" : current ? "text-blue-700" : "text-slate-400"}`}>{s.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 font-mono text-[10px] text-slate-600 space-y-1 max-h-32 overflow-y-auto">
              <p>📄 File: question_paper_class3_2025.pdf (2.4 MB)</p>
              <p>📊 Pages detected: 4</p>
              <p>🔤 Language: English</p>
              <p>✓ OCR completed on page 1</p>
              <p>✓ OCR completed on page 2</p>
              <p>✓ OCR completed on page 3</p>
              <p>⏳ Analyzing page 4 for question structures…</p>
            </div>
          </div>
        </Card>
      )}

      {/* Phase: Review */}
      {(phase === "review" || phase === "saved") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Card title={`Detected Questions (${questions.length})`} subtitle="Click any field to edit">
              <div className="space-y-2.5">
                {questions.map((q) => (
                  <div key={q.id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 grid place-items-center text-xs font-bold">
                          {q.number}
                        </div>
                        <Badge tone={q.difficulty === "Easy" ? "green" : q.difficulty === "Medium" ? "orange" : "red"}>
                          {q.difficulty}
                        </Badge>
                        <Badge tone="purple">{q.type}</Badge>
                        <Badge tone="slate">{q.marks} marks</Badge>
                        <Badge tone="blue">P{q.pageNumber}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {q.status === "Approved" && <Badge tone="green" withDot>Approved</Badge>}
                        {q.status === "Edited" && <Badge tone="orange" withDot>Edited</Badge>}
                        <button onClick={() => setEditingId(editingId === q.id ? null : q.id)} className="text-slate-400 hover:text-blue-600 p-1">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      className="input text-sm font-medium"
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                      disabled={phase === "saved"}
                    />

                    {editingId === q.id && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input
                          className="input text-xs"
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                          placeholder="Correct answer"
                        />
                        <input
                          className="input text-xs"
                          value={q.concept}
                          onChange={(e) => updateQuestion(q.id, { concept: e.target.value })}
                          placeholder="Concept"
                        />
                        <input
                          className="input text-xs"
                          type="number"
                          value={q.marks}
                          onChange={(e) => updateQuestion(q.id, { marks: parseInt(e.target.value) || 0 })}
                          placeholder="Marks"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span>Concept: <b className="text-slate-700">{q.concept}</b></span>
                      <span>•</span>
                      <span>Answer: <b className="text-slate-700">{q.correctAnswer}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card title="Summary">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-600">Total questions</span><b>{questions.length}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Total marks</span><b>{questions.reduce((a, b) => a + b.marks, 0)}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Easy</span><b>{questions.filter(q => q.difficulty === "Easy").length}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Medium</span><b>{questions.filter(q => q.difficulty === "Medium").length}</b></div>
                <div className="flex justify-between"><span className="text-slate-600">Hard</span><b>{questions.filter(q => q.difficulty === "Hard").length}</b></div>
              </div>
            </Card>

            <Card title="Question Types">
              <div className="space-y-1.5">
                {[...new Set(questions.map((q) => q.type))].map((t) => {
                  const count = questions.filter((q) => q.type === t).length;
                  return (
                    <div key={t} className="flex justify-between text-xs">
                      <span className="text-slate-700">{t}</span>
                      <Badge tone="blue">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <Button className="w-full" disabled={phase === "saved"} onClick={approveAll}>
                  <Save className="w-4 h-4" /> Save &amp; Approve Template
                </Button>
                <Button variant="secondary" className="w-full" disabled={phase === "saved"}>
                  <Download className="w-4 h-4" /> Export as JSON
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { setPhase("upload"); setQuestions([]); setProgress(0); }}>
                  Start Over
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}