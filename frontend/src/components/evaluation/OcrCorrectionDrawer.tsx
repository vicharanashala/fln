import React, { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Image as ImageIcon, Save, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export interface QuestionCorrectionItem {
  questionId: string;
  questionNumber?: number | string;
  questionText?: string;
  expectedAnswer?: string;
  submittedAnswer?: string;
  isCorrect: boolean;
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  cropImageUrl?: string;
}

export interface OcrCorrectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  studentName?: string;
  studentId?: string;
  questionResults: QuestionCorrectionItem[];
  token: string;
  onOverrideSuccess?: (updatedData: { report: any; levelChanged: boolean }) => void;
}

export const OcrCorrectionDrawer: React.FC<OcrCorrectionDrawerProps> = ({
  isOpen,
  onClose,
  reportId,
  studentName,
  studentId,
  questionResults,
  token,
  onOverrideSuccess,
}) => {
  const [corrections, setCorrections] = useState<Record<string, { isCorrect: boolean; correctedAnswer: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initialize local correction state when drawer opens or questions change
  useEffect(() => {
    if (isOpen && questionResults.length > 0) {
      const initial: Record<string, { isCorrect: boolean; correctedAnswer: string }> = {};
      questionResults.forEach((q) => {
        initial[q.questionId] = {
          isCorrect: q.isCorrect,
          correctedAnswer: q.submittedAnswer || '',
        };
      });
      setCorrections(initial);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, questionResults]);

  // Handle ESC key press to close drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleCorrect = (questionId: string, value: boolean) => {
    setCorrections((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        isCorrect: value,
      },
    }));
  };

  const handleAnswerTextChange = (questionId: string, text: string) => {
    setCorrections((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        correctedAnswer: text,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payloadCorrections = Object.entries(corrections).map(([questionId, data]) => ({
      questionId,
      isCorrect: data.isCorrect,
      correctedAnswer: data.correctedAnswer,
    }));

    try {
      const res = await apiFetch(`/api/evaluation/${reportId}/override`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ corrections: payloadCorrections }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update evaluation report override.');
      }

      setSuccessMsg('OCR verification override submitted successfully!');
      if (onOverrideSuccess) {
        onOverrideSuccess(data);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error updating evaluation override.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-drawer-title"
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 uppercase tracking-wider">
                ICR Verification
              </span>
              {studentName && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Student: <strong className="text-slate-900 dark:text-white">{studentName}</strong> {studentId && `(${studentId})`}
                </span>
              )}
            </div>
            <h2 id="ocr-drawer-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              OCR Correction & Manual Verification
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close correction drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form and Question List */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {errorMsg && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review digitized student responses against expected answers. Update incorrect OCR transcriptions or adjust grading flags as needed.
            </p>

            {questionResults.map((q, index) => {
              const currentCorrection = corrections[q.questionId] || {
                isCorrect: q.isCorrect,
                correctedAnswer: q.submittedAnswer || '',
              };

              const confLevel = q.confidenceLevel || (q.confidence ? (q.confidence > 0.85 ? 'high' : q.confidence > 0.6 ? 'medium' : 'low') : 'medium');
              const badgeBg =
                confLevel === 'high'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : confLevel === 'medium'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';

              return (
                <div
                  key={q.questionId}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Question #{q.questionNumber || index + 1} ({q.questionId})
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeBg}`}>
                      {confLevel === 'low' && <AlertTriangle className="h-3 w-3" />}
                      Confidence: {confLevel}
                    </span>
                  </div>

                  {q.questionText && (
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {q.questionText}
                    </p>
                  )}

                  {/* Student Handwriting Crop Preview */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <ImageIcon className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Cropped Handwriting Image</span>
                    </div>
                    {q.cropImageUrl ? (
                      <img
                        src={q.cropImageUrl}
                        alt={`Cropped response for question ${q.questionId}`}
                        className="max-h-32 w-auto rounded border border-slate-200 object-contain dark:border-slate-700"
                      />
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-xs text-slate-400 font-mono">
                        [ Handwriting Scan Segment Preview ]
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Expected Answer (Key)
                      </label>
                      <div className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {q.expectedAnswer || 'N/A'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Recognized OCR / Corrected Answer
                      </label>
                      <input
                        type="text"
                        value={currentCorrection.correctedAnswer}
                        onChange={(e) => handleAnswerTextChange(q.questionId, e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Enter text..."
                      />
                    </div>
                  </div>

                  {/* Verdict Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-2">
                      Grading Verdict:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleCorrect(q.questionId, true)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        currentCorrection.isCorrect
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Mark Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleCorrect(q.questionId, false)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        !currentCorrection.isCorrect
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                      Mark Incorrect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drawer Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {submitting ? 'Saving Overrides...' : 'Save & Update Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
