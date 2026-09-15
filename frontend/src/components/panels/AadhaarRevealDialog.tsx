/**
 * AadhaarRevealDialog — per-student step-up detokenization.
 *
 * This dialog NEVER renders a QR code. It NEVER calls /mfa/enroll.
 * Enrollment is the SecurityPanel's responsibility. The dialog only
 * does preflight (account-level) → step-up request → TOTP entry →
 * approve → detokenize. If the caller has no ENROLLED factor, it
 * shows a "Go to Security" message and routes the admin to the
 * dedicated enrollment surface.
 *
 * The factor is long-lived. The step-up challenge is temporary.
 * See CLAUDE.md.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { Student, MfaFactor } from '../../types';

type Phase =
  | 'preflight'      // GET /api/me/mfa/factors in flight — checking for ENROLLED factor
  | 'awaiting_totp'  // challenge minted; admin types TOTP
  | 'approving'      // POST /step-up/approve in flight
  | 'detokenizing'   // POST /detokenize in flight
  | 'revealed'       // plaintext visible (auto-clears)
  | 'error'
  | 'not_enrolled';  // preflight saw no ENROLLED factor; route admin to SecurityPanel

type Props = {
  /**
   * The dialog never renders a QR or calls /mfa/enroll. Enrollment
   * is the SecurityPanel's responsibility.
   */
  student: Student;
  token: string;
  onClose: () => void;
  /** Routes the admin to the dedicated enrollment surface (SecurityPanel). */
  onNavigateToSecurity?: () => void;
};

const AUTO_CLEAR_MS = 60_000; // 60s safety net — primary path is the "Copy & Close" button
const PREFLIGHT_TIMEOUT_MS = 8_000; // see comment on the preflight useEffect

export const AadhaarRevealDialog: React.FC<Props> = ({ student, token, onClose, onNavigateToSecurity }) => {
  const [phase, setPhase] = useState<Phase>('preflight');
  const [factorId, setFactorId] = useState<string>('');
  const [challengeId, setChallengeId] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [aadhaar, setAadhaar] = useState<string>('');
  const [last4, setLast4] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(AUTO_CLEAR_MS / 1000);
  // Bump to force the preflight useEffect to re-run. Used by the
  // "Retry check" button in the error state — the effect's dep is
  // `[student.id, preflightNonce]` so changing the nonce is enough
  // to re-fire the probe.
  const [preflightNonce, setPreflightNonce] = useState<number>(0);

  // Defensive: if the dialog unmounts or the user clicks outside, clear
  // the plaintext from React state immediately. The plaintext also clears
  // automatically after AUTO_CLEAR_MS via the timer below.
  useEffect(() => () => {
    setAadhaar('');
    setTotpCode('');
  }, []);

  // Auto-clear timer for the revealed plaintext.
  useEffect(() => {
    if (phase !== 'revealed') return;
    setCountdown(AUTO_CLEAR_MS / 1000);
    const tick = setInterval(() => setCountdown(s => Math.max(0, s - 1)), 1000);
    const stop = setTimeout(() => {
      setAadhaar('');
      setLast4('');
      setPhase('preflight');
    }, AUTO_CLEAR_MS);
    return () => { clearInterval(tick); clearTimeout(stop); };
  }, [phase]);

  // Pre-flight probe: on mount (or when the user retries from the
  // error state), ask the backend what TOTP factors exist on the
  // CALLER's account. The factor is account-scoped (not per-student),
  // so we hit the /api/me/mfa/factors endpoint, not a per-student
  // endpoint. If an ENROLLED factor exists, jump straight to
  // awaiting_totp. If no factor or only PENDING_ENROLLMENT factors
  // exist, drop into `not_enrolled` and route the admin to the
  // SecurityPanel. Errors stay on the `error` phase.
  //
  // The previous version had a parameterless `catch` that silently
  // fell through to `idle` on any error. That looked correct but had
  // one failure mode: a HUNG request (no resolve, no reject) — e.g. a
  // dead Mongo connection inside `mfa.listActiveByActor` — left the
  // dialog on "Checking your authenticator enrollment…" forever. The
  // admin saw no QR, no TOTP field, and no error message; the × close
  // button was the only working action.
  //
  // Fix: an AbortController with an 8s timeout, and a catch that
  // transitions to the `error` phase with a useful message instead
  // of silently dropping the user into the first-time enroll path
  // (where a hung server would just hang the enroll call too). The
  // error phase offers "Restart step-up" (re-runs this effect) and
  // "Go to Security" (the explicit opt-in to first-time enroll).
  useEffect(() => {
    let cancelled = false;
    setPhase('preflight');
    setErrorMsg('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PREFLIGHT_TIMEOUT_MS);

    (async () => {
      try {
        const r = await apiCall<{ factors: MfaFactor[] }>(
          'GET',
          `/api/me/mfa/factors`,
          undefined,
          { signal: controller.signal },
        );
        if (cancelled) return;
        const factors = Array.isArray(r.factors) ? r.factors : [];
        const enrolled = factors.find(f => f.lifecycleState === 'ENROLLED');
        if (enrolled) {
          // Returning admin — reuse the existing factor for this
          // reveal. We do NOT log or render the secret; the dialog
          // simply skips the QR.
          setFactorId(enrolled.factorId);
          await onRequestStepUp(enrolled.factorId);
        } else {
          // No ENROLLED factor — caller must go enroll one in
          // SecurityPanel before this dialog can do anything useful.
          setPhase('not_enrolled');
        }
      } catch (err: any) {
        if (cancelled) return;
        // The error must be visible — both in the dialog (so the
        // admin knows what to do) and in the console (so an
        // engineer debugging the production hang can see the raw
        // error without DevTools Network snooping).
        const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
        if (isAbort) {
          console.warn(
            '[AadhaarReveal] preflight GET /api/me/mfa/factors aborted after',
            `${PREFLIGHT_TIMEOUT_MS}ms — likely a hung backend (e.g. dead Mongo connection in mfa.listActiveByActor).`,
            { studentId: student.id },
          );
          setErrorMsg(
            `The server did not respond within ${PREFLIGHT_TIMEOUT_MS / 1000}s while checking your authenticator enrollment. ` +
            'Click "Restart step-up" to try again, or "Go to Security" to enroll one now.',
          );
        } else {
          console.error('[AadhaarReveal] preflight failed:', err);
          setErrorMsg(
            (err?.message || 'Could not check your authenticator enrollment.') +
            ' Click "Restart step-up" to try again.',
          );
        }
        setPhase('error');
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, preflightNonce]);

  // Auth helper — keeps the Auth header consistent with apiClient.ts's
  // behavior. We pass an explicit Authorization so the dialog works even
  // if apiClient's localStorage token check races. The `init` argument is
  // merged into the fetch options so callers can pass a `signal` (e.g.
  // for the preflight timeout) without us having to thread it through
  // every signature.
  const apiCall = async <T,>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> => {
    const res = await apiFetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(init ?? {}),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && typeof json.message === 'string') ? json.message : `HTTP ${res.status}`;
      throw new Error(`${json?.error || 'vault_error'}: ${msg}`);
    }
    return json as T;
  };

  const onRequestStepUp = async (factor: string) => {
    try {
      const r = await apiCall<{ challengeId: string; expiresAt: string }>(
        'POST',
        `/api/students/${student.id}/aadhaar/step-up/request`,
        { factorId: factor },
      );
      setChallengeId(r.challengeId);
      setExpiresAt(r.expiresAt);
      setPhase('awaiting_totp');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Step-up request failed.');
      setPhase('error');
    }
  };

  const onApprove = async () => {
    if (!/^[0-9]{6,10}$/.test(totpCode)) {
      setErrorMsg('Enter the 6- or 8-digit TOTP code from your authenticator app.');
      return;
    }
    setErrorMsg('');
    setPhase('approving');
    try {
      await apiCall<{ challengeId: string; status: string }>(
        'POST',
        `/api/students/${student.id}/aadhaar/step-up/approve`,
        { challengeId, code: totpCode },
      );
      await onDetokenize();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Step-up approval failed.');
      setPhase('awaiting_totp'); // let the admin try again with a fresh code
    }
  };

  /** Copy the revealed plaintext to the clipboard and close the
   *  dialog. The user explicitly asked for the popup to close as
   *  soon as the Aadhaar is in hand — leaving it open for the full
   *  auto-clear window is a footgun in shared offices. The clipboard
   *  write goes through `navigator.clipboard.writeText` with a
   *  user-gesture fallback for older browsers. */
  const onCopyAndClose = async () => {
    try {
      if (navigator.clipboard?.writeText && aadhaar) {
        await navigator.clipboard.writeText(aadhaar);
      }
    } catch {
      // Clipboard write can fail under insecure contexts or strict
      // permissions; fall through to closing the dialog so the
      // plaintext doesn't linger in the DOM longer than needed.
    }
    setAadhaar('');
    setLast4('');
    onClose();
  };

  const onDetokenize = async () => {
    setPhase('detokenizing');
    try {
      const r = await apiCall<{ aadhaar: string; last4: string; aadharMasked: string }>(
        'POST',
        `/api/students/${student.id}/aadhaar/detokenize`,
        { challengeId },
      );
      setAadhaar(r.aadhaar);
      setLast4(r.last4);
      setPhase('revealed');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Detokenization failed.');
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6 border border-slate-200 dark:border-slate-800"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="aadhaar-reveal-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="aadhaar-reveal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Reveal Aadhaar — {student.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Stored as <span className="font-mono">{student.aadharMasked}</span>.
              Plaintext requires Step-Up authentication with your authenticator app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setAadhaar(''); setTotpCode(''); onClose(); }}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm border border-red-200 dark:border-red-800">
            {errorMsg}
          </div>
        )}

        {/* ── Pre-flight: checking for an existing factor ─────────────── */}
        {phase === 'preflight' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Checking your authenticator enrollment…
          </div>
        )}

        {/* ── TOTP entry only (no QR — enrollment is SecurityPanel's job) ── */}
        {phase === 'awaiting_totp' && (
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              if (totpCode.length >= 6) onApprove();
            }}
          >
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              Enter the current code from your authenticator app
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Open the same authenticator app you used to enroll (Google Authenticator,
              Microsoft Authenticator, 1Password, etc.) and copy the 6- or 8-digit code it
              shows for this FLN account. The code refreshes every 30 seconds — press
              <kbd className="mx-1 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono text-[10px]">Enter</kbd>
              to submit.
            </p>
            <div>
              <label htmlFor="totp" className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">
                TOTP code
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="123456"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded font-mono text-lg bg-white dark:bg-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">
                Challenge expires at {new Date(expiresAt).toLocaleTimeString()}.
                If it expires, click <strong>Restart Step-Up</strong> at the bottom of this dialog.
              </p>
            </div>
            <button
              type="submit"
              disabled={totpCode.length < 6}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded font-medium"
            >
              Approve &amp; Detokenize
            </button>
          </form>
        )}

        {/* ── Not enrolled — route to SecurityPanel ──────────────────── */}
        {phase === 'not_enrolled' && (
          <div className="space-y-4 text-center">
            <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Authenticator required</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You haven't set up an authenticator app on this account yet.
              Aadhaar reveal will not work until you enroll one.
            </p>
            <button
              type="button"
              onClick={onNavigateToSecurity}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
            >
              Go to Security
            </button>
          </div>
        )}

        {(phase === 'approving' || phase === 'detokenizing') && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {phase === 'approving' ? 'Verifying TOTP code…' : 'Recovering plaintext…'}
          </div>
        )}

        {/* ── Step 3: Reveal plaintext ─────────────────────────────── */}
        {phase === 'revealed' && (
          <div className="space-y-3">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                Plaintext Aadhaar — TEMPORARY
              </p>
              <p className="mt-1 text-2xl font-mono font-semibold tracking-wider text-slate-900 dark:text-slate-100 select-all">
                {aadhaar}
              </p>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Auto-clears in <span className="font-mono">{countdown}s</span>.
                Do not screenshot, write down, or share with anyone who does not have a
                legitimate need-to-know.
              </p>
            </div>
            <button
              type="button"
              onClick={onCopyAndClose}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
            >
              Copy &amp; Close
            </button>
            <button
              type="button"
              onClick={() => { setAadhaar(''); setLast4(''); setPhase('preflight'); }}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded font-medium text-sm"
            >
              Clear without copying
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            {/* Two recovery paths:
                - "Restart step-up" bumps preflightNonce, which re-runs
                  the preflight useEffect from scratch. Use this when
                  the failure was a transient read-side issue (timeout,
                  momentary network blip, dead Mongo connection that
                  has since recovered).
                - "Go to Security" routes the admin to the dedicated
                  enrollment surface if the preflight is persistently
                  broken — they can enroll there and come back. */}
            <button
              type="button"
              onClick={() => { setErrorMsg(''); setPreflightNonce(n => n + 1); }}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
            >
              Restart step-up
            </button>
            <button
              type="button"
              onClick={onNavigateToSecurity}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded font-medium"
            >
              Go to Security
            </button>
          </div>
        )}
      </div>
    </div>
  );
};