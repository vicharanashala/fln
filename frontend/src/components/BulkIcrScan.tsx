import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';

/**
 * Bulk-class OCR scan. Calls /api/icr/evaluate-bulk which:
 *   1. Splits a multi-student PDF into N per-student sub-PDFs (pagesPerStudent).
 *   2. OCRs each sub-PDF separately via Ollama Gemma 4 (sized to fit the body cap).
 *   3. Reads the printed student name from the top-left of page 1 of each chunk.
 *   4. Returns one entry per chunk with studentName + answers[].
 *
 * Output flow: on success the parent gets `onBulkOcrSuccess({results, ...})`.
 * The parent owns the per-chunk result state and renders the per-student dropdown
 * + verify tables in its own step.
 *
 * Reuses the same OCR provider + error UX as IcrTwoStageScan (single flow), but
 * the work pattern is different: bulk is one POST, not a filter→OCR two-stage.
 */

export interface BulkChunkResult {
  studentIndex: number;
  pageFrom: number;
  pageTo: number;
  pageCount: number;
  success: boolean;
  answers: string[];
  rawOcrText?: string;
  studentName: string | null;
  studentNameError: string | null;
  studentNameProcessingTimeMs?: number;
  ocrEngine?: string;
  processingTimeMs: number;
  error?: string;
}

export interface BulkOcrResponse {
  success: boolean;
  provider: string;
  totalPages: number;
  pagesPerStudent: number;
  totalStudents: number;
  successfulStudents: number;
  failedStudents: number;
  results: BulkChunkResult[];
  processingTimeMs: number;
}

interface BulkIcrScanProps {
  token: string;
  uploadedFile: File | null;
  pagesPerStudent: number;
  // Called once per chunk when the bulk OCR call succeeds. The parent takes
  // ownership of the result state and renders its own per-student UI.
  onBulkOcrSuccess: (resp: BulkOcrResponse) => void;
}

type BulkState = 'idle' | 'running' | 'done' | 'error';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export const BulkIcrScan: React.FC<BulkIcrScanProps> = ({
  token,
  uploadedFile,
  pagesPerStudent,
  onBulkOcrSuccess,
}) => {
  const [state, setState] = useState<BulkState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [timeTaken, setTimeTaken] = useState<{ clientMs: number; serverMs: number | null } | null>(null);
  const [liveElapsed, setLiveElapsed] = useState<number | null>(null);
  const [providersConfigured, setProvidersConfigured] = useState<Record<string, boolean> | null>(null);

  // On mount: check which providers are configured. Disables the button
  // when Ollama isn't set up so the user knows before they upload.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/icr/cloud-config', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.providers) setProvidersConfigured(data.providers);
      } catch {
        // Non-fatal: button stays enabled, the click will surface the real error.
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Reset state when the user picks a different file so an old error
  // doesn't linger into a fresh upload.
  useEffect(() => {
    setState('idle');
    setError(null);
    setTimeTaken(null);
    setLiveElapsed(null);
  }, [uploadedFile]);

  // Live elapsed timer while running.
  useEffect(() => {
    if (state !== 'running') {
      setLiveElapsed(null);
      return;
    }
    const t0 = performance.now();
    const id = window.setInterval(() => setLiveElapsed(performance.now() - t0), 100);
    return () => window.clearInterval(id);
  }, [state]);

  const runBulkOcr = async () => {
    if (!uploadedFile) return;
    setState('running');
    setError(null);
    const t0 = performance.now();
    try {
      const dataUrl = await fileToDataUrl(uploadedFile);
      const res = await apiFetch('/api/icr/evaluate-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: 'ollama-gemma4',
          fileDataUrl: dataUrl,
          pagesPerStudent,
        }),
      });
      const clientMs = Math.round(performance.now() - t0);
      const data = await res.json();
      if (!res.ok || !data.success) {
        const providerMsg = data.error || `Bulk OCR HTTP ${res.status}`;
        let adminHint = '';
        if (res.status === 503) {
          adminHint = ' Admin must set the OLLAMA_API_KEY (or ICR_CLOUD_API_KEY_OLLAMA_GEMMA4) env var or POST a key to /api/icr/cloud-config.';
        } else if (res.status === 502) {
          adminHint = ' Ollama Cloud dropped or refused the connection. Retry usually helps; check the Ollama status page.';
        } else if (res.status === 413) {
          adminHint = ' PDF too large for the bulk endpoint. Split the batch in half and try again.';
        }
        setError(providerMsg + adminHint);
        setState('error');
        return;
      }
      setTimeTaken({ clientMs, serverMs: data.processingTimeMs ?? null });
      setState('done');
      onBulkOcrSuccess(data as BulkOcrResponse);
    } catch (err: any) {
      setError('Network or client error: ' + (err?.message || String(err)));
      setState('error');
    }
  };

  const disabled = !uploadedFile;
  const ollamaReady = providersConfigured?.['ollama-gemma4'] === true;
  const ollamaMissing = providersConfigured?.['ollama-gemma4'] === false;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <BigButton
          icon={<CloudIcon />}
          title="Run Bulk OCR (whole class) with Ollama Gemma 4"
          subtitle={
            ollamaReady
              ? `Server has OLLAMA_API_KEY configured. Will split into ${pagesPerStudent}-page chunks.`
              : ollamaMissing
              ? 'No API key — ask admin to set OLLAMA_API_KEY (or ICR_CLOUD_API_KEY_OLLAMA_GEMMA4).'
              : 'Checking server configuration…'
          }
          timeTaken={state === 'done' ? timeTaken : null}
          liveElapsed={state === 'running' ? liveElapsed : null}
          state={state}
          onClick={runBulkOcr}
          disabled={disabled || !ollamaReady}
        />
      </div>

      {error && (
        <ErrorPanel
          title="Bulk OCR failed"
          error={error}
          onRetry={runBulkOcr}
          onDismiss={() => {
            setError(null);
            setState('idle');
          }}
        />
      )}
    </div>
  );
};

// --- Reusable building blocks (mirror of IcrTwoStageScan so the look matches) -

const BigButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  timeTaken: { clientMs: number; serverMs: number | null } | null;
  liveElapsed: number | null;
  state: BulkState;
  onClick: () => void;
  disabled: boolean;
}> = ({ icon, title, subtitle, timeTaken, liveElapsed, state, onClick, disabled }) => {
  const isRunning = state === 'running';
  const isDone = state === 'done';
  // Same violet palette as the single-scan button so the two flows feel like siblings.
  const bgClass = isRunning
    ? 'bg-violet-500 cursor-wait'
    : isDone
    ? 'bg-violet-700'
    : 'bg-violet-600 hover:bg-violet-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled || isRunning}
      className={`relative overflow-hidden text-left p-4 rounded-2xl text-white font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${bgClass}`}
    >
      {isRunning && (
        <div className="absolute inset-0 bg-white/10 animate-pulse rounded-2xl pointer-events-none" />
      )}
      <div className="flex items-start gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold leading-tight">{title}</div>
          <div className="text-xs opacity-90 mt-0.5">{subtitle}</div>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-mono">
            {isRunning && liveElapsed !== null && (
              <>
                <SpinnerIcon />
                <span>running for {formatMs(Math.round(liveElapsed))}</span>
              </>
            )}
            {!isRunning && timeTaken && (
              <>
                <ClockIcon />
                <span>
                  took {formatMs(timeTaken.clientMs)}
                  {timeTaken.serverMs != null && ` (server ${formatMs(timeTaken.serverMs)})`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

const ErrorPanel: React.FC<{
  title: string;
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
}> = ({ title, error, onRetry, onDismiss }) => (
  <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 border-2 border-red-300 dark:border-red-700 rounded-2xl shadow-sm">
    <div className="flex items-start gap-3 mb-3">
      <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center flex-shrink-0">
        <AlertIcon />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-red-900 dark:text-red-100">{title}</h4>
        <p className="text-sm text-red-800 dark:text-red-200 mt-1 break-words">{error}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onRetry}
        className="text-xs font-mono bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
      >
        Retry
      </button>
      <button
        onClick={onDismiss}
        className="text-xs font-mono bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-3 py-1.5 rounded-lg"
      >
        Dismiss
      </button>
    </div>
  </div>
);

const CloudIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 000-10 7 7 0 00-13.4 2.1A4 4 0 003 15z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
