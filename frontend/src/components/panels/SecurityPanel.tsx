/**
 * SecurityPanel — account-level Authenticator enrollment for Aadhaar step-up.
 *
 * This is the ONLY place in the UI that renders a QR code. The per-student
 * reveal dialog (AadhaarRevealDialog) NEVER renders a QR and NEVER calls
 * /api/me/mfa/enroll — it only does preflight (this endpoint), then step-up.
 *
 * The factor is long-lived. The step-up challenge is temporary. Never
 * lazy-enroll on a step-up failure. See CLAUDE.md.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, ShieldCheck, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { apiFetch } from '../../services/apiClient';
import { User, MfaFactor } from '../../types';
import { PageHeader } from './PanelShared';

type Props = {
  currentUser: User;
  token: string;
};

type State = 'NotEnrolled' | 'Pending' | 'Enrolled' | 'Loading' | 'Error';

type EnrollResponse = {
  factorId: string;
  otpauthUri: string;
  lifecycleState: 'PENDING_ENROLLMENT';
};

type FactorsResponse = {
  factors: MfaFactor[];
};

export const SecurityPanel: React.FC<Props> = ({ currentUser, token }) => {
  const [state, setState] = useState<State>('Loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [factors, setFactors] = useState<MfaFactor[]>([]);

  // Pending enrollment state
  const [pendingFactorId, setPendingFactorId] = useState<string>('');
  const [otpauthUri, setOtpauthUri] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [enrolling, setEnrolling] = useState<boolean>(false);

  // Verify state
  const [code, setCode] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>('');

  // Revoke state
  const [revoking, setRevoking] = useState<boolean>(false);

  // Helper: build auth headers consistent with apiClient (so the explicit
  // token is honoured even if the apiClient's localStorage check races).
  const authedFetch = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const res = await apiFetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof json.message === 'string'
            ? json.message
            : `HTTP ${res.status}`;
        throw new Error(`${json?.error || 'request_error'}: ${msg}`);
      }
      return json as T;
    },
    [token],
  );

  const loadFactors = useCallback(async () => {
    setState('Loading');
    setErrorMsg('');
    try {
      const r = await authedFetch<FactorsResponse>('GET', '/api/me/mfa/factors');
      const list = Array.isArray(r.factors) ? r.factors : [];
      // Sort newest-first by createdAt (defensive — backend already sorts).
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setFactors(list);
      const pending = list.find((f) => f.lifecycleState === 'PENDING_ENROLLMENT');
      const enrolled = list.find((f) => f.lifecycleState === 'ENROLLED');
      if (pending) {
        setPendingFactorId(pending.factorId);
        // If the backend returned an otpauthUri for a pending factor,
        // use it; otherwise it stays empty and the Pending card shows
        // a "no URI" note (this branch is hit on a refresh after the
        // first /api/me/mfa/enroll response is discarded).
        setOtpauthUri((pending as any).otpauthUri || '');
        setState('Pending');
      } else if (enrolled) {
        setState('Enrolled');
      } else {
        setState('NotEnrolled');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not load authenticator status.');
      setState('Error');
    }
  }, [authedFetch]);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  // Render the QR when otpauthUri changes.
  useEffect(() => {
    if (!otpauthUri) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(otpauthUri, { margin: 1, scale: 5, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  const onEnroll = async () => {
    setEnrolling(true);
    setErrorMsg('');
    setVerifyError('');
    try {
      const r = await authedFetch<EnrollResponse>(
        'POST',
        '/api/me/mfa/enroll',
        { label: `FLN ${currentUser.role} ${currentUser.email}` },
      );
      setPendingFactorId(r.factorId);
      setOtpauthUri(r.otpauthUri || '');
      setCode('');
      setState('Pending');
      // Do NOT call `loadFactors()` here. The enroll response
      // already carries factorId + otpauthUri, and `loadFactors`
      // would re-GET `/api/me/mfa/factors` — which, per the
      // route's tightened filter, returns only `ENROLLED` rows.
      // Re-fetching would clobber the local `Pending` state with
      // `NotEnrolled` (no PENDING in the list) and the QR would
      // never render. Background refresh after enroll is a
      // follow-up; the route's filter would need to expand first.
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authenticator enrollment failed.');
      setState('Error');
    } finally {
      setEnrolling(false);
    }
  };

  const onVerify = async () => {
    if (!/^[0-9]{6,10}$/.test(code)) {
      setVerifyError('Enter the 6- or 8-digit code from your authenticator app.');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      await authedFetch<{ factorId: string; lifecycleState: 'ENROLLED' }>(
        'POST',
        '/api/me/mfa/verify',
        { factorId: pendingFactorId, code },
      );
      // Transition locally for instant feedback, then refresh.
      setOtpauthUri('');
      setCode('');
      setQrDataUrl('');
      setVerifyError('');
      await loadFactors();
    } catch (err: any) {
      setVerifyError(err?.message || 'Invalid code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onRevoke = async (factorId: string) => {
    if (
      !window.confirm(
        'Revoke this authenticator? You will need to set up a new one before you can reveal Aadhaar.',
      )
    ) {
      return;
    }
    setRevoking(true);
    setErrorMsg('');
    try {
      await authedFetch<unknown>('DELETE', `/api/me/mfa/factors/${factorId}`);
      await loadFactors();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Revoke failed.');
    } finally {
      setRevoking(false);
    }
  };

  const renderNotEnrolled = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Your account doesn't have an authenticator app set up yet. Aadhaar reveal will
        not work until you enroll one.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        You'll need an RFC 6238 TOTP app (Google Authenticator, Microsoft Authenticator,
        1Password, Bitwarden, etc.) on your phone or computer.
      </p>
      <button
        type="button"
        onClick={onEnroll}
        disabled={enrolling}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded font-medium"
      >
        {enrolling ? 'Setting up…' : 'Set up authenticator'}
      </button>
    </div>
  );

  const renderPending = () => (
    <form
      className="space-y-4"
      onSubmit={e => {
        e.preventDefault();
        if (code.length >= 6 && !verifying) onVerify();
      }}
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Authenticator — awaiting first code
      </p>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Scan this QR in your authenticator app, then enter the 6- or 8-digit code below.
          Press <kbd className="mx-1 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono text-[10px]">Enter</kbd>
          to submit.
        </p>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="TOTP enrollment QR"
            className="mx-auto border border-slate-200 dark:border-slate-700 rounded p-1"
            width="180"
            height="180"
          />
        ) : (
          <div className="text-xs text-slate-500 text-center py-6">
            {otpauthUri ? 'Rendering QR…' : 'No setup URI on file. Click "Restart enrollment" below.'}
          </div>
        )}
        <details className="mt-2">
          <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
            Can't scan? Show manual setup URI
          </summary>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Copy this text and paste it into your app's <em>Enter setup key manually</em> field
            (under <em>Add account</em>).
          </p>
          <code className="block text-xs break-all bg-slate-100 dark:bg-slate-800 p-2 mt-1 rounded select-all">
            {otpauthUri}
          </code>
        </details>
      </div>
      <div>
        <label
          htmlFor="security-totp"
          className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200"
        >
          TOTP code from your app
        </label>
        <input
          id="security-totp"
          type="text"
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
          placeholder="123456"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded font-mono text-lg bg-white dark:bg-slate-800"
        />
        {verifyError && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{verifyError}</span>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={verifying || code.length < 6}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded font-medium"
      >
        {verifying ? 'Verifying…' : 'Confirm enrollment'}
      </button>
      <button
        type="button"
        onClick={onEnroll}
        disabled={enrolling}
        className="w-full py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 rounded font-medium"
      >
        Restart enrollment (mint a new QR)
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        This QR appears once. After this enrollment, you'll only need to type the 6- or
        8-digit code from your authenticator app.
      </p>
    </form>
  );

  const renderEnrolled = () => {
    // Pick the most-recent ENROLLED factor; show its summary, never its secret.
    const enrolled =
      factors.filter((f) => f.lifecycleState === 'ENROLLED')[0] ||
      factors[0];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm font-medium">Authenticator — ✓ Active</p>
        </div>
        {enrolled && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {enrolled.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Algorithm {enrolled.algorithm} · Last used{' '}
              {enrolled.lastUsedAt
                ? new Date(enrolled.lastUsedAt).toLocaleString()
                : 'never'}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => enrolled && onRevoke(enrolled.factorId)}
          disabled={revoking || !enrolled}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded font-medium text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {revoking ? 'Revoking…' : 'Revoke authenticator'}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          You can have one active authenticator. Revoke to set up a new device.
        </p>
      </div>
    );
  };

  const renderError = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
        <AlertCircle className="h-5 w-5" />
        <p className="text-sm font-medium">Could not load authenticator status</p>
      </div>
      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm border border-red-200 dark:border-red-800">
          {errorMsg}
        </div>
      )}
      <button
        type="button"
        onClick={loadFactors}
        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
      >
        Retry
      </button>
    </div>
  );

  const renderLoading = () => (
    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <ShieldCheck className="h-4 w-4" />
      <span>Loading authenticator status…</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        desc="Authenticator app for Aadhaar step-up."
        icon={<KeyRound className="h-6 w-6" />}
      />
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm max-w-xl">
        {state === 'Loading' && renderLoading()}
        {state === 'NotEnrolled' && renderNotEnrolled()}
        {state === 'Pending' && renderPending()}
        {state === 'Enrolled' && renderEnrolled()}
        {state === 'Error' && renderError()}
      </div>
    </div>
  );
};