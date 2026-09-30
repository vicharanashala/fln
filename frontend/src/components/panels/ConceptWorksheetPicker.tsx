// Issue #605: the concept-worksheet picker flow.
//
// The issue body asks for a paper-type -> concept-scope -> preview flow
// that ends by POSTing to /api/worksheets/generate-concept-batch (#601).
// This component implements the concept-scoped half of that flow.
// (The diagnostic-vs-level-personalized paper types go through OTHER
// routes -- WorksheetsPanel.tsx -> /generate-level-batch,
// BulkDiagnosticWorkflow.tsx -> /diagnostic/bulk -- not this one, per
// the issue's own framing of where this picker plugs in.)
//
// Per the issue:
//   - New component/screen, calling the generate-concept-batch route
//     the same way WorksheetWorkflow.tsx:126 calls /generate-pdf.
//   - Concept-scope picker must filter client-side against assessmentMode,
//     excluding any 'observed'-only node from the selectable list
//     (those route to the teacher-observation flow, not this generator).
//
// Note on Stage 0 completion: this picker is a standalone component
// (no props like studentAnswers from WorksheetWorkflow); it uses apiFetch
// which reads the token from localStorage (per apiClient.ts), so a
// separate panel route can mount it without threading props down.

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, FileQuestion, Loader2, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import { PageHeader } from './PanelShared';
import { apiFetch } from '../../services/apiClient';
import type { QuestionTemplate } from '../../types';

// Mirror the backend's QUESTIONS_PER_PAGE_MAX so the preview reflects
// what #602's renderConceptWorksheet will actually do. If the two drift,
// the preview lies. Issue #603 owns this constant.
const QUESTIONS_PER_PAGE_MAX = 6;

/**
 * Shape returned by POST /api/worksheets/generate-concept-batch (#601).
 * Duplicated here to keep this component self-contained -- the contract
 * is small enough that mirroring is cheaper than a cross-workspace type
 * import (and the import would only be needed for this one type).
 */
interface GenerateConceptBatchResult {
  success: boolean;
  worksheetId?: string;
  totalQuestions?: number;
  concepts?: Array<{ conceptId: string; questionCount: number }>;
  pdfUrl?: string | undefined;
  error?: string;
}

/**
 * A concept is selectable for the worksheet ONLY if at least one of its
 * templates is NOT assessmentMode='observed'. Concepts whose templates are
 * all 'observed' route to the teacher-observation flow (#618) and are
 * excluded here -- this is the issue's explicit requirement.
 */
function pickEligibleTemplates(templates: QuestionTemplate[]): QuestionTemplate[] {
  return templates.filter(t => t.assessmentMode !== 'observed');
}

export const ConceptWorksheetPicker: React.FC = () => {
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [questionsPerConcept, setQuestionsPerConcept] = useState<number>(4);
  const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateConceptBatchResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/question-templates');
        if (!res.ok) {
          setLoadError('Could not load question templates.');
          return;
        }
        setTemplates(await res.json());
        setLoadError(null);
      } catch {
        setLoadError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Eligible set: templates the picker can route through this generator.
  const eligible = useMemo(() => pickEligibleTemplates(templates), [templates]);

  // Distinct concept ids grouped by conceptId (each concept is one
  // option in the picker; counting its eligible templates tells the
  // teacher how much they have to work with).
  const concepts = useMemo(() => {
    const map = new Map<string, { conceptId: string; eligibleCount: number; levelNumber: number | null }>();
    for (const t of eligible) {
      const cur = map.get(t.conceptId) ?? { conceptId: t.conceptId, eligibleCount: 0, levelNumber: t.levelNumber ?? null };
      cur.eligibleCount += 1;
      map.set(t.conceptId, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.conceptId.localeCompare(b.conceptId));
  }, [eligible]);

  // Concepts that exist in the DB but have ZERO eligible templates --
  // shown greyed-out so the teacher knows those exist but are observation-only.
  const observationOnlyConcepts = useMemo(() => {
    const eligibleIds = new Set(concepts.map(c => c.conceptId));
    return Array.from(new Set(templates.map(t => t.conceptId))).filter(id => !eligibleIds.has(id));
  }, [templates, concepts]);

  // Page-count preview: matches #602's behaviour exactly (one concept per
  // block, QUESTIONS_PER_PAGE_MAX per page). Estimate uses
  // questionsPerConcept * selectedConcepts.length / QUESTIONS_PER_PAGE_MAX.
  const previewPages = useMemo(() => {
    if (selectedConcepts.size === 0 || questionsPerConcept <= 0) return 0;
    return Math.max(
      selectedConcepts.size, // one block per concept, even if 0 questions
      Math.ceil((selectedConcepts.size * questionsPerConcept) / QUESTIONS_PER_PAGE_MAX),
    );
  }, [selectedConcepts, questionsPerConcept]);

  const previewTotalQuestions = selectedConcepts.size * questionsPerConcept;

  const toggleConcept = (id: string) => {
    setSelectedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canSubmit =
    selectedConcepts.size > 0 &&
    className.trim().length > 0 &&
    section.trim().length > 0 &&
    questionsPerConcept > 0 &&
    !submitting;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const res = await apiFetch('/api/worksheets/generate-concept-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptIds: Array.from(selectedConcepts),
          questionsPerConcept,
          className: className.trim(),
          section: section.trim(),
        }),
      });
      const data: GenerateConceptBatchResult = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Generation failed.');
        return;
      }
      setResult(data);
    } catch (e: any) {
      setSubmitError(e?.message || 'Generation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Concept Worksheet Picker" desc="Pick the concepts, set the count per concept, generate a Balvatika paper." icon={<Sparkles className="h-5 w-5" />} />
        <div className="p-6 text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
        <PageHeader title="Concept Worksheet Picker" desc="Pick the concepts, set the count per concept, generate a Balvatika paper." icon={<Sparkles className="h-5 w-5" />} />
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
      <PageHeader
        title="Concept Worksheet Picker"
        desc="Generate a Balvatika paper from selected concepts. 'Observed'-only templates route to the teacher observation sheet, not this paper."
        icon={<Sparkles className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Class</label>
          <input
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder="e.g. Class 1"
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Section</label>
          <input
            value={section}
            onChange={e => setSection(e.target.value)}
            placeholder="e.g. A"
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Questions per concept</label>
          <input
            type="number"
            min={1}
            max={QUESTIONS_PER_PAGE_MAX}
            value={questionsPerConcept}
            onChange={e => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v > 0) setQuestionsPerConcept(Math.min(v, QUESTIONS_PER_PAGE_MAX));
            }}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Concept scope ({selectedConcepts.size} selected)
          </label>
          <span className="text-[10px] text-slate-400">
            page-count preview: <strong>{previewPages}</strong> page{previewPages === 1 ? '' : 's'} for {previewTotalQuestions} question{previewTotalQuestions === 1 ? '' : 's'}
          </span>
        </div>

        {concepts.length === 0 ? (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 p-6 text-center text-slate-500">
            No authored (written-or-both) question templates yet. Author some in the Superadmin → Question Templates panel first.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {concepts.map(c => {
              const selected = selectedConcepts.has(c.conceptId);
              return (
                <button
                  key={c.conceptId}
                  type="button"
                  onClick={() => toggleConcept(c.conceptId)}
                  aria-pressed={selected}
                  className={`text-left rounded-md border px-3 py-2 transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{c.conceptId}</span>
                    {selected && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <FileQuestion className="h-3 w-3" /> {c.eligibleCount} template{c.eligibleCount === 1 ? '' : 's'} · L{c.levelNumber ?? '?'}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {observationOnlyConcepts.length > 0 && (
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="text-[11px] font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1 mb-1">
              <Eye className="h-3 w-3" /> Observation-only (excluded from this picker)
            </div>
            <div className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
              {observationOnlyConcepts.join(', ')}
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              These concepts route to the teacher observation sheet (#618), not a printable child worksheet.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {previewPages > 0
            ? `Estimated ${previewPages} page${previewPages === 1 ? '' : 's'}, ${previewTotalQuestions} questions.`
            : 'Select at least one concept to see the preview.'}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Generating...' : 'Generate worksheet'}
        </button>
      </div>

      {submitError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {submitError}
        </div>
      )}

      {result?.success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm space-y-2">
          <div className="font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Worksheet persisted
          </div>
          <div className="text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
            <div>Worksheet id: <code className="font-mono">{result.worksheetId}</code></div>
            <div>Total questions: {result.totalQuestions}</div>
            {result.concepts && (
              <div className="flex flex-wrap gap-1 mt-1">
                {result.concepts.map(c => (
                  <span key={c.conceptId} className="rounded bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-[11px] font-mono">
                    {c.conceptId}: {c.questionCount}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!result.pdfUrl && (
            <div className="text-amber-700 dark:text-amber-300 text-xs mt-2 flex items-center gap-1">
              <Eye className="h-3 w-3" /> PDF rendering pending (issue #602). The worksheet record is persisted and queryable; once #602's renderer is wired into the route, POST /generate-pdf will produce the PDF.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConceptWorksheetPicker;