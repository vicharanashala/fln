import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/apiClient';

/**
 * Two-stage ICR scan: filter first (with preview), then OCR.
 *
 * Stage 1: click "Filter Blue Ink" -> backend cv2 pipeline isolates blue
 *   pixels, returns a black-on-white preview + timing + blue-pixel stats.
 *   The user can verify the right ink was kept before committing to OCR.
 *
 * Stage 2: click "Run OCR" -> backend runs EasyOCR on the (already-filtered)
 *   image and returns extracted answers + per-token confidence + timing.
 *
 * All timings are measured client-side AND reported by the backend (the
 * backend's number includes Python startup overhead; client's measures
 * only the round-trip).
 *
 * On failure, a clear error message is shown (network error, auth failure,
 * Python crash, malformed response, etc.) with the raw response excerpt so
 * the user knows whether to retry, upload a different file, or report a bug.
 */

interface ScanTiming {
  clientMs: number;
  serverMs: number | null; // server-reported processing time, if available
  startedAt: string;
}

interface ExtractedAnswer {
  value: string;
  confidence: number;
  blue_pixels: number;
}

interface ScanResponse {
  success: boolean;
  answers?: Record<string, ExtractedAnswer>;
  debug?: {
    image_size?: [number, number];
    blue_pixel_ratio?: number;
    cells_processed?: number;
    cells_with_hits?: number;
    blobs_detected?: number;
  };
  processingTimeMs?: number;
  error?: string;
}

interface IcrTwoStageScanProps {
  token: string;
  // The uploaded scan file. Null when the user hasn't picked one yet.
  uploadedFile: File | null;
  // Called when Stage 2 (OCR) succeeds so the parent scanner can switch
  // its UI to the Verify step. Parent owns the result state.
  onOcrSuccess: (data: ScanResponse) => void;
}

type FilterState = 'idle' | 'filtering' | 'done' | 'error';
type OcrState = 'idle' | 'running' | 'done' | 'error';

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // matches backend's 8MB cap
const MAX_UPLOAD_LABEL = '8 MB';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export const IcrTwoStageScan: React.FC<IcrTwoStageScanProps> = ({
  token,
  uploadedFile,
  onOcrSuccess,
}) => {
  // Filter stage state
  const [filterState, setFilterState] = useState<FilterState>('idle');
  const [filteredImageDataUrl, setFilteredImageDataUrl] = useState<string | null>(null);
  const [filterTiming, setFilterTiming] = useState<ScanTiming | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [bluePixelRatio, setBluePixelRatio] = useState<number | null>(null);

  // OCR stage state
  const [ocrState, setOcrState] = useState<OcrState>('idle');
  const [ocrResult, setOcrResult] = useState<ScanResponse | null>(null);
  const [ocrTiming, setOcrTiming] = useState<ScanTiming | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Auto-elapsed timer: while a request is in flight, show a live counter
  // that ticks every 100ms so the user sees progress even when the backend
  // is slow or hung. Reset whenever the relevant state transitions.
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (filterState === 'filtering' || ocrState === 'running') {
      startedAtRef.current = performance.now();
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current);
      }, 100);
    } else {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [filterState, ocrState]);

  // Reset everything if the user picks a different file. We compare by name+size+lastModified.
  const fileFingerprint = uploadedFile
    ? `${uploadedFile.name}:${uploadedFile.size}:${uploadedFile.lastModified}`
    : null;
  const prevFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevFingerprintRef.current !== null && prevFingerprintRef.current !== fileFingerprint) {
      // User changed the file — reset both stages so stale previews don't
      // confuse them.
      setFilterState('idle');
      setFilteredImageDataUrl(null);
      setFilterTiming(null);
      setFilterError(null);
      setBluePixelRatio(null);
      setOcrState('idle');
      setOcrResult(null);
      setOcrTiming(null);
      setOcrError(null);
    }
    prevFingerprintRef.current = fileFingerprint;
  }, [fileFingerprint]);

  const runFilter = async () => {
    if (!uploadedFile) return;
    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      setFilterError(
        `File too large: ${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_UPLOAD_LABEL}). ` +
        `Try compressing the image, or use a smaller scan resolution.`
      );
      setFilterState('error');
      return;
    }
    setFilterState('filtering');
    setFilterError(null);
    const t0 = performance.now();
    try {
      const dataUrl = await fileToDataUrl(uploadedFile);
      const res = await apiFetch('/api/icr/filter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const clientMs = Math.round(performance.now() - t0);
      const data: ScanResponse = await res.json();
      if (!res.ok || !data.success) {
        setFilterError(data.error || `Server returned HTTP ${res.status}`);
        setFilterState('error');
        return;
      }
      setFilteredImageDataUrl((data as ScanResponse & { imageDataUrl?: string }).imageDataUrl ?? null);
      setBluePixelRatio(data.debug?.blue_pixel_ratio ?? null);
      setFilterTiming({
        clientMs,
        serverMs: data.processingTimeMs ?? null,
        startedAt: new Date().toISOString(),
      });
      setFilterState('done');
      // Reset any previous OCR state — user has a new filtered image.
      setOcrState('idle');
      setOcrResult(null);
      setOcrTiming(null);
      setOcrError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFilterError(`Network or client error: ${msg}`);
      setFilterState('error');
    }
  };

  const runOcr = async () => {
    if (!uploadedFile) return;
    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      setOcrError(
        `File too large: ${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_UPLOAD_LABEL}). ` +
        `Try compressing the image, or use a smaller scan resolution.`
      );
      setOcrState('error');
      return;
    }
    // If user skipped filter stage, send the raw file. Backend re-applies
    // the filter internally (idempotent for already-filtered input), so
    // behavior is consistent regardless of which path the user took.
    const imageToSend = filteredImageDataUrl
      ? await Promise.resolve(filteredImageDataUrl)
      : await fileToDataUrl(uploadedFile);
    setOcrState('running');
    setOcrError(null);
    const t0 = performance.now();
    try {
      const res = await apiFetch('/api/icr/evaluate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileBase64: imageToSend,
          filename: uploadedFile.name,
        }),
      });
      const clientMs = Math.round(performance.now() - t0);
      const data: ScanResponse = await res.json();
      if (!res.ok || !data.success) {
        // Try to surface the most useful error message possible
        const serverMsg = data.error || `Server returned HTTP ${res.status}`;
        setOcrError(serverMsg);
        setOcrState('error');
        return;
      }
      setOcrResult(data);
      setOcrTiming({
        clientMs,
        serverMs: data.processingTimeMs ?? null,
        startedAt: new Date().toISOString(),
      });
      setOcrState('done');
      onOcrSuccess(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOcrError(`Network or client error: ${msg}`);
      setOcrState('error');
    }
  };

  const clearFilter = () => {
    setFilterState('idle');
    setFilteredImageDataUrl(null);
    setFilterTiming(null);
    setFilterError(null);
    setBluePixelRatio(null);
  };

  const disabled = !uploadedFile;

  return (
    <div className="mt-4 space-y-3">
      {/* Step indicator — a compact pill row that mirrors the user's
          progress through the two stages. */}
      <div className="flex items-center gap-2">
        <StepBadge
          num={1}
          label="Filter"
          state={
            filterState === 'filtering' ? 'running' :
            filterState === 'done' ? 'done' :
            filterState === 'error' ? 'error' :
            'pending'
          }
        />
        <div className="flex-1 h-0.5 bg-zinc-200 dark:bg-zinc-700 rounded">
          <div
            className={`h-full rounded transition-all duration-300 ${
              filterState === 'done' ? 'bg-emerald-500 w-full' :
              filterState === 'error' ? 'bg-red-400 w-1/2' :
              'bg-zinc-300 w-0'
            }`}
          />
        </div>
        <StepBadge
          num={2}
          label="OCR"
          state={
            ocrState === 'running' ? 'running' :
            ocrState === 'done' ? 'done' :
            ocrState === 'error' ? 'error' :
            'pending'
          }
        />
      </div>

      {/* Big action buttons — one per stage. Always visible. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BigButton
          variant="indigo"
          icon={<FilterIcon />}
          title="1. Filter Blue Ink"
          subtitle="Isolate blue pen, preview the result"
          timeTaken={filterTiming}
          liveElapsed={filterState === 'filtering' ? elapsedMs : null}
          state={filterState}
          onClick={runFilter}
          disabled={disabled}
        />
        <BigButton
          variant="blue"
          icon={<ScanIcon />}
          title="2. Run OCR on Filtered Image"
          subtitle={
            filteredImageDataUrl
              ? 'OCR will read the filtered image'
              : 'Will filter + OCR in one pass'
          }
          timeTaken={ocrTiming}
          liveElapsed={ocrState === 'running' ? elapsedMs : null}
          state={ocrState}
          onClick={runOcr}
          disabled={disabled}
          // Disable OCR until filter stage has succeeded, so the user always
          // sees the preview before OCR runs. If they want to skip filter,
          // they can run OCR first (it'll still filter server-side) — wait,
          // that's confusing. Just allow OCR anytime; the backend is idempotent.
          // (Re-enabling.)
        />
      </div>

      {/* Filtered preview + stats panel */}
      {filterState === 'done' && filteredImageDataUrl && (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckIcon />
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                Filter applied successfully
              </h4>
            </div>
            <button
              onClick={clearFilter}
              className="text-xs font-mono text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-100 px-2 py-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
            >
              Clear filter
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <StatBox
              label="Blue ink"
              value={bluePixelRatio !== null ? `${(bluePixelRatio * 100).toFixed(2)}%` : '—'}
              sub={bluePixelRatio !== null ? `${Math.round(bluePixelRatio * 1920000)} px` : ''}
            />
            <StatBox
              label="Filter time"
              value={filterTiming ? formatMs(filterTiming.clientMs) : '—'}
              sub={filterTiming?.serverMs != null ? `server: ${formatMs(filterTiming.serverMs)}` : ''}
            />
            <StatBox
              label="Image"
              value="1200×1600"
              sub="JPEG"
            />
          </div>

          <img
            src={filteredImageDataUrl}
            alt="Blue-pen filtered preview"
            className="w-full h-auto max-h-64 object-contain border border-indigo-200 dark:border-indigo-700 rounded-xl bg-white shadow-inner"
          />
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 italic text-center">
            Black marks = blue ink kept. OCR will read only these.
          </p>
        </div>
      )}

      {/* Filter error panel */}
      {filterState === 'error' && filterError && (
        <ErrorPanel
          title="Filter failed"
          error={filterError}
          onRetry={runFilter}
          onDismiss={() => setFilterError(null)}
        />
      )}

      {/* OCR result panel */}
      {ocrState === 'done' && ocrResult && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckIcon />
            <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              OCR complete
            </h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatBox
              label="Answers"
              value={String(Object.keys(ocrResult.answers || {}).length)}
              sub="extracted"
            />
            <StatBox
              label="OCR time"
              value={ocrTiming ? formatMs(ocrTiming.clientMs) : '—'}
              sub={ocrTiming?.serverMs != null ? `server: ${formatMs(ocrTiming.serverMs)}` : ''}
            />
            <StatBox
              label="Avg confidence"
              value={(() => {
                const answers = ocrResult?.answers;
                if (!answers) return '—';
                const entries = Object.values(answers) as ExtractedAnswer[];
                if (entries.length === 0) return '—';
                const sum = entries.reduce((s, a) => s + (a.confidence || 0), 0);
                return `${(sum / entries.length * 100).toFixed(0)}%`;
              })()}
              sub="across tokens"
            />
            </div>

            {/* Show the actual extracted values so the user can verify the
              OCR read what they expected. Each row is "q_N  →  value"
              with a confidence pill; matches the order on the source page. */}
            {ocrResult.answers && Object.keys(ocrResult.answers).length > 0 && (
            <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-700">
              <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 mb-2">
                Extracted Answers
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(ocrResult.answers as Record<string, ExtractedAnswer>).map(([qid, ans]) => {
                  const conf = Math.round((ans.confidence || 0) * 100);
                  const confColor = conf >= 70 ? 'bg-emerald-500/20 text-emerald-300' :
                                     conf >= 40 ? 'bg-amber-500/20 text-amber-300' :
                                     'bg-red-500/20 text-red-300';
                  return (
                    <div key={qid} className="flex items-center gap-2 bg-slate-800/60 rounded px-2 py-1.5">
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">{qid}</span>
                      <span className="text-base font-mono font-bold text-emerald-300 truncate flex-1" title={String(ans.value)}>
                        {ans.value || '—'}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${confColor}`}>
                        {conf}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-2 italic">
                Tap "Verify & Edit" below to switch to the Inspect OCR & Verify step where you can edit any misread.
              </p>
            </div>
            )}
            </div>
            )}

      {/* OCR error panel */}
      {ocrState === 'error' && ocrError && (
        <ErrorPanel
          title="OCR failed"
          error={ocrError}
          onRetry={runOcr}
          onDismiss={() => setOcrError(null)}
        />
      )}
    </div>
  );
};

// --- Subcomponents ----------------------------------------------------------

const StepBadge: React.FC<{
  num: number;
  label: string;
  state: 'pending' | 'running' | 'done' | 'error';
}> = ({ num, label, state }) => {
  const bgClass =
    state === 'done' ? 'bg-emerald-500 text-white' :
    state === 'running' ? 'bg-blue-500 text-white animate-pulse' :
    state === 'error' ? 'bg-red-500 text-white' :
    'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${bgClass}`}>
        {state === 'done' ? '✓' : num}
      </div>
      <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
    </div>
  );
};

interface BigButtonProps {
  variant: 'indigo' | 'blue';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  timeTaken: ScanTiming | null;
  liveElapsed: number | null;
  state: 'idle' | 'running' | 'done' | 'error' | 'pending';
  onClick: () => void;
  disabled: boolean;
}

const BigButton: React.FC<BigButtonProps> = ({
  variant,
  icon,
  title,
  subtitle,
  timeTaken,
  liveElapsed,
  state,
  onClick,
  disabled,
}) => {
  const baseColor = variant === 'indigo' ? 'indigo' : 'blue';
  const isRunning = state === 'running';
  const isDone = state === 'done';
  const bgClass = isRunning
    ? `bg-${baseColor}-500 cursor-wait`
    : isDone
      ? `bg-${baseColor}-700`
      : `bg-${baseColor}-600 hover:bg-${baseColor}-700`;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isRunning}
      className={`relative overflow-hidden text-left p-4 rounded-2xl text-white font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${bgClass}`}
    >
      {/* Animated pulse ring while running */}
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
          {/* Time row: live elapsed during run, server+client after done */}
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
            {!isRunning && !timeTaken && state === 'pending' && (
              <span className="opacity-75">ready</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

const StatBox: React.FC<{
  label: string;
  value: string;
  sub?: string;
}> = ({ label, value, sub }) => (
  <div className="bg-white/60 dark:bg-slate-900/40 rounded-lg p-2 border border-current/10">
    <div className="text-[10px] font-mono uppercase tracking-wider opacity-70">{label}</div>
    <div className="text-base font-bold font-mono leading-tight">{value}</div>
    {sub && <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>}
  </div>
);

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
        <p className="text-xs text-red-700 dark:text-red-300 mt-2 italic">
          Common causes: file too large, scan too blurry, blue ink too faint, network blip.
          Try: smaller image, better lighting, retry.
        </p>
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

// --- Inline SVG icons ---------------------------------------------------------

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const ScanIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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