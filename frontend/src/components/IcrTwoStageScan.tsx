import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/apiClient';

/**
 * Single-step ICR scan: click "Run OCR with Ollama Gemma 4" → backend
 * rasterizes the (PDF or image) upload to PNG, POSTs to Ollama Cloud's
 * gemma4 model, and returns structured answers.
 *
 * The previous two-stage flow (blue-ink filter → local EasyOCR) was
 * removed when consolidating OCR to a single provider. The
 * /api/icr/filter and /api/icr/evaluate-pdf endpoints are gone.
 *
 * On failure, a clear error message is shown (network error, auth
 * failure, upstream provider rejection, etc.) so the user knows
 * whether to retry, upload a different file, or report a bug.
 */

interface ExtractedAnswer {
  value: string;
  confidence: number;
  // Required by the parent component (IcrScanner) — used by the verify
  // table even though we don't have a meaningful blue-pixel count from
  // cloud OCR. Always 0 from the cloud path.
  blue_pixels: number;
}

interface ScanResponse {
  success: boolean;
  answers?: Record<string, ExtractedAnswer>;
  ocrAnalysis?: {
    rawOcrText: string;
    extractedTokens: Array<{ text: string; confidence: number; bbox?: number[][] }>;
    processingTimeMs: number;
    ocrEngine: string;
  };
  processingTimeMs?: number;
  error?: string;
  // Issue #234: present when the caller told the backend how many
  // questions this sheet should have (expectedCount below). true means
  // the model's row count didn't match — the parent surfaces a warning.
  countMismatch?: boolean | null;
  expectedCount?: number | null;
}

interface IcrTwoStageScanProps {
  token: string;
  // The uploaded scan file. Null when the user hasn't picked one yet.
  uploadedFile: File | null;
  // Called when OCR succeeds so the parent scanner can switch its UI
  // to the Verify step. Parent owns the result state.
  onOcrSuccess: (data: ScanResponse) => void;
  // Issue #234: the real question count for the selected student/class's
  // paper, when known ahead of the scan (resolved by the parent from the
  // diagnostic answer key). Passed to the backend so it can tell the OCR
  // model exactly how many rows to expect, and so a count mismatch can be
  // flagged explicitly instead of silently padding/truncating the mapping.
  expectedCount?: number | null;
}

type OcrState = 'idle' | 'running' | 'done' | 'error';

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // matches backend's 8MB cap
const MAX_UPLOAD_LABEL = '8 MB';

export const IcrTwoStageScan: React.FC<IcrTwoStageScanProps> = ({
  token,
  uploadedFile,
  onOcrSuccess,
  expectedCount,
}) => {
  // Cloud OCR state — the only OCR state we keep.
  const [cloudOcrState, setCloudOcrState] = useState<OcrState>('idle');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudProvidersConfigured, setCloudProvidersConfigured] = useState<Record<string, boolean>>({});

  // On mount, fetch which providers the server has configured. The ICR
  // UI uses this to enable/disable the cloud button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/icr/cloud-config', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data.providers) {
          setCloudProvidersConfigured(data.providers);
        }
      } catch {
        // Ignore — button stays disabled
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Auto-elapsed timer: while a request is in flight, show a live
  // counter that ticks every 100ms.
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  useEffect(() => {
    if (cloudOcrState === 'running') {
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
  }, [cloudOcrState]);

  // Reset cloud OCR state when the user picks a different file.
  // Compare by name+size+lastModified.
  const fileFingerprint = uploadedFile
    ? `${uploadedFile.name}:${uploadedFile.size}:${uploadedFile.lastModified}`
    : null;
  const prevFingerprintRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevFingerprintRef.current !== null && prevFingerprintRef.current !== fileFingerprint) {
      setCloudOcrState('idle');
      setCloudError(null);
    }
    prevFingerprintRef.current = fileFingerprint;
  }, [fileFingerprint]);

  const runCloudOcr = async () => {
    if (!uploadedFile) return;
    if (uploadedFile.size > MAX_UPLOAD_BYTES) {
      setCloudError(
        `File too large: ${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_UPLOAD_LABEL}). ` +
        `Try compressing the image, or use a smaller scan resolution.`
      );
      return;
    }
    setCloudOcrState('running');
    setCloudError(null);
    const t0 = performance.now();
    try {
      // Single OCR provider: ollama-gemma4. The provider field is sent
      // for backend-validation clarity; the backend also hardcodes the
      // provider check. The frontend sends the raw file as a single
      // data URL; the backend rasterizes PDFs to PNG before posting to
      // Ollama (Ollama's vision API only accepts image MIME types).
      // NO apiKey is ever sent from the frontend.
      const dataUrl = await fileToDataUrl(uploadedFile);
      const res = await apiFetch('/api/icr/evaluate-cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: 'ollama-gemma4',
          imageDataUrl: dataUrl,
          // Issue #234: tell the backend how many questions this paper
          // actually has, when known, so the model is told an explicit
          // target row count instead of guessing from the image alone.
          ...(typeof expectedCount === 'number' && expectedCount > 0 ? { expectedCount } : {}),
        }),
      });
      const clientMs = Math.round(performance.now() - t0);
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Surface the backend's error message verbatim. With Ollama as
        // the sole provider, the backend returns messages like "Ollama
        // Cloud: ..." — pass that straight to the user with a short
        // admin-action hint appended so they know who to ask.
        const providerMsg = data.error || `Cloud OCR HTTP ${res.status}`;
        const adminHint =
          res.status === 503
            ? ` Admin must set the OLLAMA_API_KEY (or ICR_CLOUD_API_KEY_OLLAMA_GEMMA4) env var or POST a key to /api/icr/cloud-config.`
            : res.status === 502
            ? ` The upstream Ollama Cloud rejected the request — likely an invalid/revoked key, billing not enabled, or rate limit. Ask the admin to verify the OLLAMA_API_KEY value.`
            : '';
        setCloudError(providerMsg + adminHint);
        setCloudOcrState('error');
        return;
      }
      // Prefer structured `answers` array from Ollama's JSON-output mode.
      // Fall back to extractedTokens if no structured response.
      const answers: Record<string, ExtractedAnswer> = {};
      if (data.answers && Array.isArray(data.answers) && data.answers.length > 0) {
        data.answers.forEach((v: any, i: number) => {
          answers[`q_${i + 1}`] = {
            value: String(v ?? ''),
            confidence: 0.8,
            blue_pixels: 0,
          };
        });
      } else if (data.extractedTokens && data.extractedTokens.length > 0) {
        data.extractedTokens.forEach((t: any, i: number) => {
          const v = String(t?.text ?? '').trim();
          if (!v) return;
          answers[`q_${i + 1}`] = {
            value: v,
            confidence: Number(t?.confidence ?? 0.7),
            blue_pixels: 0,
          };
        });
      }
      const normalized: ScanResponse = {
        success: true,
        answers,
        ocrAnalysis: {
          rawOcrText: data.rawOcrText || '',
          extractedTokens: (data.extractedTokens || []).map((t: any) => ({
            text: t.text,
            confidence: t.confidence ?? 0.9,
            bbox: t.bbox,
          })),
          processingTimeMs: data.processingTimeMs ?? clientMs,
          ocrEngine: data.ocrEngine || (data.model ? `Ollama Gemma 4 (${data.model})` : 'Ollama Gemma 4'),
        },
        processingTimeMs: data.processingTimeMs ?? clientMs,
        countMismatch: data.countMismatch ?? null,
        expectedCount: data.expectedCount ?? null,
      };
      setCloudOcrState('done');
      onOcrSuccess(normalized);
    } catch (err: any) {
      setCloudError(
        `Network or client error: ${err?.message || String(err)}`
      );
      setCloudOcrState('error');
    }
  };

  const disabled = !uploadedFile;

  return (
    <div className="space-y-4">
      {/* Single OCR action — Ollama Gemma 4 only. The button is always
          rendered; it shows a clear subtitle + error state when the
          server doesn't have an OLLAMA_API_KEY configured. */}
      <div className="space-y-2">
        <BigButton
          icon={<CloudIcon />}
          title="Run OCR with Ollama Gemma 4"
          subtitle={
            cloudProvidersConfigured['ollama-gemma4'] === true
              ? 'Server has OLLAMA_API_KEY configured.'
              : cloudProvidersConfigured['ollama-gemma4'] === false
              ? 'No API key — ask admin to set OLLAMA_API_KEY (or ICR_CLOUD_API_KEY_OLLAMA_GEMMA4).'
              : 'Checking server configuration…'
          }
          timeTaken={null}
          liveElapsed={cloudOcrState === 'running' ? elapsedMs : null}
          state={cloudOcrState}
          onClick={runCloudOcr}
          disabled={disabled || cloudProvidersConfigured['ollama-gemma4'] !== true}
        />
      </div>

      {/* Cloud OCR error panel — surfaced when /api/icr/evaluate-cloud
          rejects (no key, bad key, billing, rate limit, network blip,
          etc.). Doesn't require ocrState==='error' because cloud errors
          may come back before that state was set (e.g. file too large). */}
      {cloudError && (
        <ErrorPanel
          title="Ollama Gemma 4 — Cloud OCR failed"
          error={cloudError}
          onRetry={runCloudOcr}
          onDismiss={() => {
            setCloudError(null);
            setCloudOcrState('idle');
          }}
        />
      )}
    </div>
  );
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

// --- Reusable building blocks ----------------------------------------------

const BigButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  timeTaken: { clientMs: number; serverMs: number | null } | null;
  liveElapsed: number | null;
  state: 'idle' | 'running' | 'done' | 'error';
  onClick: () => void;
  disabled: boolean;
}> = ({
  icon,
  title,
  subtitle,
  timeTaken,
  liveElapsed,
  state,
  onClick,
  disabled,
}) => {
  const isRunning = state === 'running';
  const isDone = state === 'done';
  // Fixed palette (Ollama Gemma 4 only). Litearl class names so Tailwind's
  // JIT sees them at build time.
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
