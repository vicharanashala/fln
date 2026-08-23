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

interface FilteredPage {
  pageNumber: number;
  imageDataUrl: string;
  bluePixelRatio?: number;
  bluePixelCount?: number;
  imageSize?: number[];
}

interface ScanResponse {
  success: boolean;
  answers?: Record<string, ExtractedAnswer>;
  // Cloud OCR responses put per-token details under ocrAnalysis; local
  // PaddleOCR responses (no-classId path) put them under ocrAnalysis too
  // (see backend /api/icr/evaluate-pdf). Both flows share this shape.
  ocrAnalysis?: {
    rawOcrText: string;
    extractedTokens: Array<{ text: string; confidence: number; bbox?: number[][] }>;
    processingTimeMs: number;
    ocrEngine: string;
  };
  debug?: {
    image_size?: [number, number];
    blue_pixel_ratio?: number;
    cells_processed?: number;
    cells_with_hits?: number;
    blobs_detected?: number;
  };
  processingTimeMs?: number;
  error?: string;
  // Multi-page filter response (PDFs): one entry per rasterized page.
  pageCount?: number;
  pages?: FilteredPage[];
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

// Brand-ish Tailwind color name per cloud provider. Drives both the
// provider-toggle pills above the cloud BigButton AND the BigButton's
// own background so the active model is obvious at a glance.
//
// IMPORTANT: All class strings below must be LITERAL (no template-literal
// interpolation) so Vite's Tailwind v4 JIT picks them up during the
// source scan. The PROVider_CLASSES map below uses pre-built class strings
// for each provider — that way Tailwind sees every class as a literal.
const PROVIDER_COLORS: Record<
  'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4',
  'violet'
> = {
  google: 'violet',
  aws: 'violet',
  azure: 'violet',
  minimax: 'violet',
  ocrspace: 'violet',
  'ollama-gemma4': 'violet',
};

// Pre-built Tailwind class strings for each provider. Two sets: the
// "active" pill (solid background, white text, ring) and the "inactive"
// pill (soft background, colored text, bordered). Kept as full literals
// so Tailwind's JIT sees every class.
//
// NOTE: Per user request, ALL providers share the same violet palette
// (matching MiniMax). And per follow-up request, the active vs inactive
// pills also look the same — the user wants one uniform violet row, with
// the active model indicated by the "Run via Cloud API" button subtitle
// ("Using GOOGLE — admin-configured on server"), NOT by pill color.
const PROVIDER_PILL_CLASS: Record<'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4', string> = {
  google:   'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
  aws:      'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
  azure:    'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
  minimax:  'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
  ocrspace: 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
  'ollama-gemma4': 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-700 dark:border-violet-800',
};

// Pre-built BigButton bg class strings per provider. Same JIT-safety
// reason as the pill maps above.
const PROVIDER_BUTTON_BG: Record<'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4', string> = {
  google:   'bg-violet-600 hover:bg-violet-700',
  aws:      'bg-violet-600 hover:bg-violet-700',
  azure:    'bg-violet-600 hover:bg-violet-700',
  minimax:  'bg-violet-600 hover:bg-violet-700',
  ocrspace: 'bg-violet-600 hover:bg-violet-700',
  'ollama-gemma4': 'bg-violet-600 hover:bg-violet-700',
};
const PROVIDER_BUTTON_BG_RUNNING: Record<'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4', string> = {
  google:   'bg-violet-500 cursor-wait',
  aws:      'bg-violet-500 cursor-wait',
  azure:    'bg-violet-500 cursor-wait',
  minimax:  'bg-violet-500 cursor-wait',
  ocrspace: 'bg-violet-500 cursor-wait',
  'ollama-gemma4': 'bg-violet-500 cursor-wait',
};
const PROVIDER_BUTTON_BG_DONE: Record<'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4', string> = {
  google:   'bg-violet-700',
  aws:      'bg-violet-700',
  azure:    'bg-violet-700',
  minimax:  'bg-violet-700',
  ocrspace: 'bg-violet-700',
  'ollama-gemma4': 'bg-violet-700',
};

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
  const [filteredPages, setFilteredPages] = useState<FilteredPage[]>([]);
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
      setFilteredPages([]);
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
          // Guard: an empty/invalid data URL is the most common source of the
          // cryptic "imageDataUrl is required" backend error. Catch it here and
          // show a clearer message instead.
          // dataUrl is empty/null OR starts with something other than data:image/
                // or data:application/pdf. Distinguish so the user gets an actionable message.
                const isImage = dataUrl?.startsWith('data:image/');
                const isPdf = dataUrl?.startsWith('data:application/pdf');
                if (!dataUrl || (!isImage && !isPdf)) {
                  const mimeHint = dataUrl?.startsWith('data:')
                    ? ` (got data URL of type ${dataUrl.slice(5, dataUrl.indexOf(';')) || 'unknown'})`
                    : '';
                  setFilterError(
                    `Could not read the uploaded file as an image or PDF${mimeHint}. ` +
                    `Only PNG/JPEG/WebP scans and PDFs work with the blue-ink filter — try re-exporting the scan.`
                  );
                  setFilterState('error');
                  return;
                }
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
          // Multi-page: build pages[] first (server returns either a pages[]
          // array for PDFs, or a single imageDataUrl for plain image uploads).
          // Then derive the legacy `filteredImageDataUrl` from pages[0] so the
          // OCR stage (which only reads one image) and the gallery gate both
          // work without further changes.
          const legacySingle = (data as ScanResponse & { imageDataUrl?: string }).imageDataUrl;
          const pages = (data.pages && data.pages.length > 0)
            ? data.pages
            : legacySingle
              ? [{
                  pageNumber: 1,
                  imageDataUrl: legacySingle,
                  bluePixelRatio: data.debug?.blue_pixel_ratio ?? undefined,
                  imageSize: data.debug?.image_size,
                }]
              : [];
          setFilteredPages(pages);
          setFilteredImageDataUrl(pages[0]?.imageDataUrl ?? null);
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
    setOcrState('running');
    setOcrError(null);
    const t0 = performance.now();
    try {
      // Prefer the new pages[] shape so the backend runs OCR on every
      // filtered page (one OCR call per page, per-page timeout 180s).
      // Falls back to the legacy single-image path if the user skipped
      // the filter stage.
      const body: Record<string, unknown> = { filename: uploadedFile.name };
      if (filteredPages.length > 0) {
        body.pages = filteredPages.map((p) => ({ pageNumber: p.pageNumber, imageDataUrl: p.imageDataUrl }));
      } else {
        // No filter done — send the raw uploaded file (backend re-applies
        // the filter internally, idempotent for already-filtered input).
        const imageToSend = filteredImageDataUrl
          ? filteredImageDataUrl
          : await fileToDataUrl(uploadedFile);
        body.fileBase64 = imageToSend;
      }
      const res = await apiFetch('/api/icr/evaluate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
    setFilteredPages([]);
    setFilterTiming(null);
    setFilterError(null);
    setBluePixelRatio(null);
  };

  // Cloud OCR: backend stores the API key server-side (env var or
  // admin-configured via /api/icr/cloud-config). Frontend NEVER sees
  // the key — it just picks a provider and asks the backend to OCR.
  // The button is disabled until the backend confirms at least one
    // provider is configured.
    // Default order: a stored choice from a previous session; otherwise
    // 'ollama-gemma4' if it's the lone configured provider (we'll correct on
    // the providersConfigured effect); finally 'google' as the historical
    // fallback.
    const [cloudProvider, setCloudProviderState] = useState<'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4'>(
        () => {
          const stored = localStorage.getItem('icrCloudProvider');
          if (stored === 'google' || stored === 'aws' || stored === 'azure' ||
              stored === 'minimax' || stored === 'ocrspace' || stored === 'ollama-gemma4') {
            return stored;
          }
          return 'google';
        }
      );
      const setCloudProvider = (p: 'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4') => {
        setCloudProviderState(p);
        localStorage.setItem('icrCloudProvider', p);
      };
      const [cloudProvidersConfigured, setCloudProvidersConfigured] = useState<Record<string, boolean>>({});
      const [cloudError, setCloudError] = useState<string | null>(null);

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
            // If the persisted or default provider isn't actually configured
            // AND exactly one provider IS configured, auto-pick that one.
            // This avoids the "google is not configured" surprise for new
            // Ollama-only or single-provider setups.
            const configured = Object.keys(data.providers).filter(k => data.providers[k]);
            if (configured.length === 1 && !data.providers[cloudProvider as string]) {
              const only = configured[0] as 'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4';
              setCloudProviderState(only);
              localStorage.setItem('icrCloudProvider', only);
            }
          }
        } catch {
          // Ignore — button stays disabled
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [token, cloudProvider]);

  const runCloudOcr = async () => {
      if (!uploadedFile) return;
      if (uploadedFile.size > MAX_UPLOAD_BYTES) {
        setCloudError(
          `File too large: ${(uploadedFile.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_UPLOAD_LABEL}). ` +
          `Try compressing the image, or use a smaller scan resolution.`
        );
        return;
      }
      setOcrState('running');
      setCloudError(null);
      const t0 = performance.now();
      try {
        // Prefer the pages[] shape (same as the local OCR path) so the
        // backend runs Cloud OCR on every filtered page, not just the
        // first — a multi-page scan (e.g. several students' sheets in one
        // PDF) shouldn't silently drop pages 2+. Falls back to a single
        // imageDataUrl if the user skipped the filter stage.
        // NO apiKey is ever sent from the frontend.
        const body: Record<string, unknown> = { provider: cloudProvider };
        if (filteredPages.length > 0) {
          body.pages = filteredPages.map((p) => ({ pageNumber: p.pageNumber, imageDataUrl: p.imageDataUrl }));
        } else {
          body.imageDataUrl = filteredImageDataUrl
            ? filteredImageDataUrl
            : await fileToDataUrl(uploadedFile);
        }
        const res = await apiFetch('/api/icr/evaluate-cloud', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const clientMs = Math.round(performance.now() - t0);
        const data = await res.json();
        if (!res.ok || !data.success) {
          // Surface the backend's provider-specific message verbatim. The 502
          // body already says things like "Google Vision: billing not enabled"
          // or "OCR.space: rate limit" — pass that straight to the user with a
          // short admin-action hint appended so they know who to ask.
          const providerMsg = data.error || `Cloud OCR HTTP ${res.status}`;
          const adminHint =
            res.status === 503
              ? ` Admin must set the ICR_CLOUD_API_KEY_${cloudProvider.toUpperCase()} env var or POST a key to /api/icr/cloud-config.`
              : res.status === 502
              ? ` The upstream provider rejected the request — likely an invalid/revoked key, billing not enabled, or rate limit. Ask the admin to verify the ICR_CLOUD_API_KEY_${cloudProvider.toUpperCase()} value.`
              : '';
          setCloudError(providerMsg + adminHint);
          setOcrState('error');
          return;
        }
        // Prefer the structured `studentResponses` from Ollama's JSON-output mode
        // (question_number → response, with status: answered|blank|unclear).
        // Next, prefer the backend's already-parsed `answers` array (present
        // whenever `structured: true` — see /api/icr/evaluate-cloud) — this
        // is the model's real per-question answers, not raw OCR text.
        // Only fall back to `extractedTokens` (the raw token stream, which
        // can include JSON punctuation from the model's own response text)
        // when neither structured shape is available.
        const answers: Record<string, { value: string; confidence: number; blue_pixels: number }> = {};
        if (data.studentResponses && Array.isArray(data.studentResponses)) {
          for (const r of data.studentResponses) {
            const qKey = `q_${r.question_number}`;
            const status = r.status || 'answered';
            let value = String(r.response || '');
            // [BLANK] / [UNCLEAR] pass through unchanged so the verify table
            // can show them as non-answers.
            if (status === 'blank') value = '[BLANK]';
            else if (status === 'unclear') value = '[UNCLEAR]';
            answers[qKey] = {
              value,
              confidence: status === 'answered' ? 0.85 : 0.5,
              blue_pixels: 0,
            };
          }
        } else if (data.answers && Array.isArray(data.answers) && data.answers.length > 0) {
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

                  // tokens exist, that's already handled above; if neither is present
                  // (shouldn't happen for a successful call) the consumer will warn.
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
                    ocrEngine: data.ocrEngine || (data.model ? `Cloud OCR (${data.model})` : `Cloud OCR (${cloudProvider})`),
                  },
                  processingTimeMs: data.processingTimeMs ?? clientMs,
                };
        setOcrResult(normalized);
        setOcrTiming({
          clientMs,
          serverMs: data.processingTimeMs ?? null,
          startedAt: new Date().toISOString(),
        });
        setOcrState('done');
        onOcrSuccess(normalized);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCloudError(`Network or client error: ${msg}`);
        setOcrState('error');
      }
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
        {/* Provider toggle — shows providers the server has keys for.
                            With 2+ configured, user picks. With exactly 1, show that
                            one as a single informational pill (auto-selected) so a
                            single Ollama-only setup still surfaces the provider. */}
                        {(() => {
                          const configuredProviders = (['google', 'minimax', 'ocrspace', 'aws', 'azure', 'ollama-gemma4'] as const)
                            .filter((p) => cloudProvidersConfigured[p]);
                          if (configuredProviders.length === 0) return null;
                                            return (
                                      <div className="flex flex-wrap items-center gap-1.5 px-1">
                                                                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mr-1">
                                                                        Model:
                                                                      </span>
                                                                      {configuredProviders.map((p) => (
                                                                        <button
                                                                          key={p}
                                                                          type="button"
                                                                          onClick={() => setCloudProvider(p)}
                                                                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold shadow-sm transition-all ${configuredProviders.length === 1 ? 'cursor-default opacity-90' : ''} ${PROVIDER_PILL_CLASS[p]}`}
                                                                          title={p.toUpperCase()}
                                                                        >
                                                                          {p.toUpperCase()}
                                                                        </button>
                                                                      ))}
                                                                    </div>
                                                                  );
                        })()}

                <BigButton
                                  providerKey={cloudProvider}
                                  icon={<CloudIcon />}
                                  title="3. Run via Cloud API"
                                  subtitle={
                                    cloudProvidersConfigured[cloudProvider]
                                      ? `Using ${cloudProvider.toUpperCase()} — admin-configured on server`
                                      : 'No API key configured — ask admin to set ICR_CLOUD_API_KEY_' + cloudProvider.toUpperCase()
                                  }
                                  timeTaken={null}
                                  liveElapsed={ocrState === 'running' ? elapsedMs : null}
                                  state={ocrState}
                                  onClick={runCloudOcr}
                                  disabled={disabled || !cloudProvidersConfigured[cloudProvider]}
                                />
      </div>

      {/* Filtered preview + stats panel */}
      {filterState === 'done' && filteredImageDataUrl && (
        <FilteredPagesGallery
          pages={filteredPages}
          onClearFilter={clearFilter}
          filterTiming={filterTiming}
          primaryBlueRatio={bluePixelRatio}
        />
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

      {/* OCR error panel (local PaddleOCR/EasyOCR pipeline) */}
            {ocrState === 'error' && ocrError && (
              <ErrorPanel
                title="OCR failed"
                error={ocrError}
                onRetry={runOcr}
                onDismiss={() => setOcrError(null)}
              />
            )}

            {/* Cloud OCR error panel — separate from the local OCR panel so the
                message and retry target are correct. Triggered when /api/icr/evaluate-cloud
                rejects (no key, bad key, billing, rate limit, etc.). Doesn't
                require ocrState==='error' because cloud errors may come back before
                that state was set if the request never started (e.g. file too large). */}
            {cloudError && (
              <ErrorPanel
                title={`Cloud OCR failed (${cloudProvider.toUpperCase()})`}
                error={cloudError}
                onRetry={runCloudOcr}
                onDismiss={() => setCloudError(null)}
              />
            )}

      {/* Cloud OCR status hint. Visible only when the user picked the
          cloud provider but the server has no key for it. Tells the
          user how to enable it (admin env var or admin POST to
          /api/icr/cloud-config). The key itself never enters the UI. */}
      {cloudProvidersConfigured[cloudProvider] === false && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-xs text-purple-800 dark:text-purple-200">
          <strong>{cloudProvider.toUpperCase()}</strong> is not configured on this server.
          Ask an admin to set the <code className="font-mono">ICR_CLOUD_API_KEY_{cloudProvider.toUpperCase()}</code> environment
          variable, or POST the key to <code className="font-mono">/api/icr/cloud-config</code> as an admin.
          Until then, use the local OCR button (PaddleOCR).
        </div>
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
  // Generic color names (kept for backward compat with non-cloud buttons),
  // OR one of the five literal PROVIDER_BUTTON_BG keys so a single
  // BigButton can render any provider's brand color. We split them into
  // two props to avoid a discriminated-union ceremony at every call site.
  variant?: 'indigo' | 'blue' | 'purple' | 'violet' | 'teal' | 'orange' | 'sky';
  providerKey?: 'google' | 'aws' | 'azure' | 'minimax' | 'ocrspace' | 'ollama-gemma4';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  timeTaken: ScanTiming | null;
  liveElapsed: number | null;
  state: 'idle' | 'running' | 'filtering' | 'done' | 'error' | 'pending';
  onClick: () => void;
  disabled: boolean;
}

// Fallback for non-cloud call sites that pass `variant` directly. Kept as
// full Tailwind literals so the JIT picks them up.
const LEGACY_VARIANT_BG: Record<'indigo' | 'blue' | 'purple', string> = {
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
};
const LEGACY_VARIANT_BG_RUNNING: Record<'indigo' | 'blue' | 'purple', string> = {
  indigo: 'bg-indigo-500 cursor-wait',
  blue: 'bg-blue-500 cursor-wait',
  purple: 'bg-purple-500 cursor-wait',
};
const LEGACY_VARIANT_BG_DONE: Record<'indigo' | 'blue' | 'purple', string> = {
  indigo: 'bg-indigo-700',
  blue: 'bg-blue-700',
  purple: 'bg-purple-700',
};

const BigButton: React.FC<BigButtonProps> = ({
  variant,
  providerKey,
  icon,
  title,
  subtitle,
  timeTaken,
  liveElapsed,
  state,
  onClick,
  disabled,
}) => {
  const isRunning = state === 'running' || state === 'filtering';
  const isDone = state === 'done';
  // Pick the bg class from a literal lookup so Tailwind's JIT sees every
  // class as a literal. providerKey (preferred for cloud buttons) wins
  // over the legacy generic variant prop.
  let bgClass: string;
  if (providerKey) {
    bgClass = isRunning
      ? PROVIDER_BUTTON_BG_RUNNING[providerKey]
      : isDone
        ? PROVIDER_BUTTON_BG_DONE[providerKey]
        : PROVIDER_BUTTON_BG[providerKey];
  } else {
    const v = (variant || 'indigo') as 'indigo' | 'blue' | 'purple';
    bgClass = isRunning
      ? LEGACY_VARIANT_BG_RUNNING[v]
      : isDone
        ? LEGACY_VARIANT_BG_DONE[v]
        : LEGACY_VARIANT_BG[v];
  }

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

const CloudIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 000-10 7 7 0 00-13.4 2.1A4 4 0 003 15z" />
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
/**
 * Multi-page filter preview gallery.
 *
 * Shows one large preview + a thumbnail strip for PDFs that have multiple
 * pages. Click a thumbnail to swap it into the main preview. Stats are
 * shown for the active page; the overall filter timing is constant.
 */
const FilteredPagesGallery: React.FC<{
  pages: FilteredPage[];
  onClearFilter: () => void;
  filterTiming: ScanTiming | null;
  primaryBlueRatio: number | null;
}> = ({ pages, onClearFilter, filterTiming, primaryBlueRatio }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = pages[Math.max(0, Math.min(activeIdx, pages.length - 1))] || pages[0];
  if (!active) return null;

  const ratio = active.bluePixelRatio ?? primaryBlueRatio;
  const isMulti = pages.length > 1;

  return (
    <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckIcon />
          <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
            Filter applied successfully
            {isMulti && (
              <span className="ml-2 text-xs font-normal text-indigo-700 dark:text-indigo-300">
                — {pages.length} pages
              </span>
            )}
          </h4>
        </div>
        <button
          onClick={onClearFilter}
          className="text-xs font-mono text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-100 px-2 py-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
        >
          Clear filter
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <StatBox
          label="Blue ink"
          value={ratio != null ? `${(ratio * 100).toFixed(2)}%` : '—'}
          sub=""
        />
        <StatBox
          label="Filter time"
          value={filterTiming ? formatMs(filterTiming.clientMs) : '—'}
          sub={filterTiming?.serverMs != null ? `server: ${formatMs(filterTiming.serverMs)}` : ''}
        />
        <StatBox
          label={isMulti ? 'Pages' : 'Page'}
          value={isMulti ? `${active.pageNumber} / ${pages.length}` : '1 / 1'}
          sub="JPEG"
        />
      </div>

      {/* Large preview of the active page */}
      <div className="relative">
        <img
          src={active.imageDataUrl}
          alt={`Filtered preview — page ${active.pageNumber}`}
          className="w-full h-auto max-h-[28rem] object-contain border border-indigo-200 dark:border-indigo-700 rounded-xl bg-white shadow-inner"
        />
        {isMulti && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-600 text-white rounded-md shadow">
            Page {active.pageNumber}
          </span>
        )}
      </div>

      {/* Thumbnail strip — only for multi-page PDFs */}
      {isMulti && (
        <div className="mt-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-1.5">
            All pages — click to preview
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {pages.map((p, i) => (
              <button
                key={p.pageNumber}
                onClick={() => setActiveIdx(i)}
                className={
                  'shrink-0 w-20 h-24 rounded-lg overflow-hidden border-2 transition-all bg-white ' +
                  (i === activeIdx
                    ? 'border-indigo-600 ring-2 ring-indigo-400 dark:border-indigo-400 dark:ring-indigo-500'
                    : 'border-indigo-200 dark:border-indigo-700 hover:border-indigo-400')
                }
                title={`Page ${p.pageNumber}`}
              >
                <img
                  src={p.imageDataUrl}
                  alt={`Page ${p.pageNumber}`}
                  className="w-full h-full object-contain"
                />
                <span className="block text-[9px] font-mono font-bold text-indigo-900 dark:text-indigo-100 bg-indigo-100 dark:bg-indigo-900/60 -mt-4 relative">
                  p{p.pageNumber}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2 italic text-center">
        Black marks = blue ink kept. OCR will read only these.
      </p>
    </div>
  );
};
